import Anthropic from "@anthropic-ai/sdk";
import { FEEDBACK_SCHEMA, type Feedback } from "@/lib/schema";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompt";
import { recordUsage } from "@/lib/usage-log";
import { createClient } from "@/lib/supabase/server";
import { ANSWERS_BUCKET } from "@/lib/constants";
import type { CorrectionRow, StudentRow } from "@/lib/db";

export const runtime = "nodejs";
// 実測で約250秒かかる。Vercel Pro は800秒まで指定できる
export const maxDuration = 800;

/**
 * APIのエラーは英語のJSONがそのまま返るため、よくあるものは日本語にして返す。
 * 原因が分からないまま「生成に失敗しました」だけ出るのを避ける。
 */
function toJapaneseError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (/credit balance is too low/i.test(raw)) {
    return (
      "Anthropic APIのクレジット残高が不足しています。" +
      "console.anthropic.com の Plans & Billing でクレジットを追加してから、もう一度お試しください。"
    );
  }
  if (/rate_limit|rate limit/i.test(raw)) {
    return "APIのレート制限に達しました。1分ほど待ってから、もう一度お試しください。";
  }
  if (/overloaded/i.test(raw)) {
    return "APIが混み合っています。少し待ってから、もう一度お試しください。";
  }
  if (/authentication|invalid x-api-key/i.test(raw)) {
    return "APIキーが正しくありません。環境変数 ANTHROPIC_API_KEY を確認してください。";
  }
  if (/permission|not_found_error/i.test(raw)) {
    return "このAPIキーではモデルを利用できません。キーの権限とモデル名を確認してください。";
  }
  return raw;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ANTHROPIC_API_KEY が設定されていません。" }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let correctionId: string;
  try {
    ({ correctionId } = await req.json());
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }
  if (!correctionId) {
    return Response.json({ error: "correctionId がありません。" }, { status: 400 });
  }

  const { data: correction } = await supabase
    .from("corrections")
    .select("*")
    .eq("id", correctionId)
    .single();
  if (!correction) {
    return Response.json({ error: "対象の添削が見つかりません。" }, { status: 404 });
  }
  const row = correction as CorrectionRow;

  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", row.student_id)
    .single();
  if (!student) {
    return Response.json({ error: "生徒が見つかりません。" }, { status: 404 });
  }
  const s = student as StudentRow;

  // 答案画像は Storage から取り出す。
  // ブラウザから直接送るとリクエストの上限（4.5MB）に当たるため、この経路にしている。
  const imageBlocks: Anthropic.ContentBlockParam[] = [];
  for (const path of row.image_paths) {
    const { data: blob, error } = await supabase.storage.from(ANSWERS_BUCKET).download(path);
    if (error || !blob) {
      return Response.json({ error: `答案画像を読み込めませんでした: ${path}` }, { status: 500 });
    }
    const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
    imageBlocks.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: base64 },
    });
  }
  if (imageBlocks.length === 0) {
    return Response.json({ error: "答案画像がありません。" }, { status: 400 });
  }

  const content: Anthropic.ContentBlockParam[] = [
    ...imageBlocks,
    {
      type: "text",
      text: buildUserPrompt({
        studentName: s.name,
        honorific: s.honorific,
        grade: row.grade || s.grade,
        instructorName: row.instructor_name,
        dateLabel: row.date_label,
        topic: row.topic,
        englishPoints: row.english_points,
        instructorNotes: row.instructor_notes,
      }),
    },
  ];

  const effort = (process.env.ANTHROPIC_EFFORT ?? "high") as
    | "low"
    | "medium"
    | "high"
    | "xhigh"
    | "max";

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const fail = async (message: string) => {
        await supabase
          .from("corrections")
          .update({ status: "error", error_message: message })
          .eq("id", correctionId);
        controller.enqueue(encoder.encode(`\n\n__ERROR__:${message}`));
        controller.close();
      };

      try {
        const messageStream = client.messages.stream({
          model: process.env.ANTHROPIC_MODEL ?? "claude-opus-5",
          // thinking のトークンもここに含まれる。資料が長いので余裕を持たせる
          max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS ?? 64000),
          thinking: { type: "adaptive" },
          output_config: {
            effort,
            format: { type: "json_schema", schema: FEEDBACK_SCHEMA },
          },
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content }],
        });

        let raw = "";
        for await (const event of messageStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            raw += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        const finalMessage = await messageStream.finalMessage();
        await recordUsage(finalMessage.model, finalMessage.usage);
        console.log(
          `[correct] id=${correctionId} stop_reason=${finalMessage.stop_reason}`,
          `input=${finalMessage.usage.input_tokens}`,
          `output=${finalMessage.usage.output_tokens}`,
        );

        if (finalMessage.stop_reason === "max_tokens") {
          await fail(
            "出力の上限に達して途中で切れました。ANTHROPIC_MAX_TOKENS を増やすか、指摘の件数を絞ってもう一度お試しください。",
          );
          return;
        }
        if (finalMessage.stop_reason === "refusal") {
          await fail("安全性の判定により生成が中断されました。画像を変えてお試しください。");
          return;
        }

        let parsed: Feedback;
        try {
          parsed = JSON.parse(raw) as Feedback;
        } catch {
          await fail("生成が途中で終わりました。通信が切れた可能性があります。もう一度お試しください。");
          return;
        }

        if (parsed.corrections.length === 0 || parsed.good_points.length === 0) {
          await fail("資料が途中までしか作られませんでした。もう一度お試しください。");
          return;
        }

        // ブラウザを閉じられていても結果が残るよう、ここで保存する
        await supabase
          .from("corrections")
          .update({
            status: "done",
            error_message: "",
            data: parsed,
            model: finalMessage.model,
            input_tokens: finalMessage.usage.input_tokens,
            output_tokens: finalMessage.usage.output_tokens,
            elapsed_seconds: Math.round((Date.now() - startedAt) / 1000),
            topic: row.topic || parsed.meta.topic,
          })
          .eq("id", correctionId);

        controller.close();
      } catch (err) {
        console.error("[correct] failed", err);
        await fail(toJapaneseError(err));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
