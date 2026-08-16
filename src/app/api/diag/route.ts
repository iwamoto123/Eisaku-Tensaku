/**
 * 環境変数が本番に届いているかを調べるための診断用エンドポイント。
 *
 * NEXT_PUBLIC_ で始まる変数は「ビルド時にコードへ焼き込まれる」ため、
 * 設定したのに反映されない、という食い違いが起きやすい。
 * ここでは次の2つを分けて確認する。
 *
 *  - runtime … 実行時の環境に存在するか（動的アクセスなので焼き込みの影響を受けない）
 *  - inlined … ビルド時に焼き込まれたか（通常のアクセス）
 *
 * 値そのものは返さない。長さや先頭数文字といった、取り違えを見つけるための情報だけを返す。
 * ?check=anthropic を付けると、APIキーが実際に通るかを確かめる（トークン数の計算のみで無料）。
 */

import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_EFFORT",
  "ANTHROPIC_MAX_TOKENS",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

/** 値そのものは出さず、取り違えを見つけられる程度の情報だけを返す */
function shapeOf(value: string | undefined) {
  if (!value) return { present: false };
  return {
    present: true,
    length: value.length,
    head: value.slice(0, 14),
    tail4: value.slice(-4),
    // 貼り付けのときに紛れ込みやすいもの
    hasSurroundingSpace: value !== value.trim(),
    hasQuotes: /^["']|["']$/.test(value),
    hasNewline: /[\r\n]/.test(value),
  };
}

export async function GET(req: Request) {
  const runtimeEnv: Record<string, boolean> = {};
  for (const key of EXPECTED) runtimeEnv[key] = Boolean(process.env[key]);

  const inlined = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };

  const publicNames = Object.keys(process.env)
    .filter((k) => k.startsWith("NEXT_PUBLIC"))
    .sort();

  const body: Record<string, unknown> = {
    runtimeEnv,
    inlined,
    publicNames,
    anthropicKey: shapeOf(process.env["ANTHROPIC_API_KEY"]),
    anthropicModel: process.env["ANTHROPIC_MODEL"] ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  };

  // 実際にAPIへ通してみる。トークン数の計算だけなので課金されない
  if (new URL(req.url).searchParams.get("check") === "anthropic") {
    try {
      const client = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] });
      const result = await client.messages.countTokens({
        model: process.env["ANTHROPIC_MODEL"] ?? "claude-opus-5",
        messages: [{ role: "user", content: "ping" }],
      });
      body.anthropicCheck = { ok: true, inputTokens: result.input_tokens };
    } catch (err) {
      body.anthropicCheck = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return Response.json(body);
}
