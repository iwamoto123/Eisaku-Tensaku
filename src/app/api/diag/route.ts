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
 * 値そのものは返さない。有無と名前だけを返す。
 */

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

export async function GET() {
  // 動的に引くので、ビルド時の置き換えが起きない＝実行時の環境そのもの
  const runtimeEnv: Record<string, boolean> = {};
  for (const key of EXPECTED) runtimeEnv[key] = Boolean(process.env[key]);

  // こちらはビルド時に値が埋め込まれる書き方
  const inlined = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };

  // 実際に環境へ入っている NEXT_PUBLIC_ の名前一覧。綴り違いをここで見つける
  const publicNames = Object.keys(process.env)
    .filter((k) => k.startsWith("NEXT_PUBLIC"))
    .sort();

  return Response.json({
    runtimeEnv,
    inlined,
    publicNames,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    builtAt: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  });
}
