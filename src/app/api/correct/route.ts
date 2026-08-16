import Anthropic from "@anthropic-ai/sdk";
import { FEEDBACK_SCHEMA } from "@/lib/schema";
import { SYSTEM_PROMPT, buildUserPrompt, type CorrectRequestMeta } from "@/lib/prompt";
import { recordUsage } from "@/lib/usage-log";

export const runtime = "nodejs";
// 添削1件で数分かかることがある（Vercel にデプロイする場合は Pro プラン以上が必要）
export const maxDuration = 300;

type ImagePayload = { media_type: string; data: string };

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
    return "APIキーが正しくありません。.env.local の ANTHROPIC_API_KEY を確認してください。";
  }
  if (/permission|not_found_error/i.test(raw)) {
    return "このAPIキーではモデルを利用できません。キーの権限とモデル名を確認してください。";
  }
  return raw;
}

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY が設定されていません。.env.local を確認してください。" },
      { status: 500 },
    );
  }

  let body: { meta: CorrectRequestMeta; images: ImagePayload[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const images = (body.images ?? []).filter(
    (img) => img && ALLOWED_MEDIA_TYPES.includes(img.media_type) && img.data,
  );
  if (images.length === 0) {
    return Response.json({ error: "答案の画像がありません。" }, { status: 400 });
  }
  if (images.length > 6) {
    return Response.json({ error: "画像は6枚までにしてください。" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const content: Anthropic.ContentBlockParam[] = [
    ...images.map(
      (img): Anthropic.ContentBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: img.media_type as "image/png", data: img.data },
      }),
    ),
    { type: "text", text: buildUserPrompt(body.meta) },
  ];

  const effort = (process.env.ANTHROPIC_EFFORT ?? "high") as
    | "low"
    | "medium"
    | "high"
    | "xhigh"
    | "max";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
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
          system: [
            { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          ],
          messages: [{ role: "user", content }],
        });

        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        const finalMessage = await messageStream.finalMessage();
        await recordUsage(finalMessage.model, finalMessage.usage);

        // 途中で止まった原因を追えるようにサーバー側に残す
        console.log(
          `[correct] stop_reason=${finalMessage.stop_reason}`,
          `input=${finalMessage.usage.input_tokens}`,
          `output=${finalMessage.usage.output_tokens}`,
          finalMessage.stop_details ? JSON.stringify(finalMessage.stop_details) : "",
        );

        if (finalMessage.stop_reason === "max_tokens") {
          controller.enqueue(
            encoder.encode(
              "\n\n__ERROR__:出力の上限に達して途中で切れました。" +
                ".env.local の ANTHROPIC_MAX_TOKENS を増やすか、指摘の件数を絞ってもう一度お試しください。",
            ),
          );
        } else if (finalMessage.stop_reason === "refusal") {
          controller.enqueue(
            encoder.encode("\n\n__ERROR__:安全性の判定により生成が中断されました。画像を変えてお試しください。"),
          );
        }
        controller.close();
      } catch (err) {
        console.error("[correct] failed", err);
        controller.enqueue(encoder.encode(`\n\n__ERROR__:${toJapaneseError(err)}`));
        controller.close();
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
