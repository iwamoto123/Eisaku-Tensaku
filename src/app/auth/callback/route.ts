import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * メールのリンクから戻ってきたときに、セッションを確立する。
 *
 * 2通りの経路に対応する。
 *  - token_hash … メールのテンプレートを {{ .TokenHash }} にした場合。
 *    リンクを押した端末とログイン操作をした端末が違っても通る。こちらを推奨。
 *  - code       … PKCE。ログイン操作をしたブラウザと同じでないと通らない。
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") || "/";

  // Supabase 側で失敗した場合は、その理由がクエリに載って戻ってくる
  const providerError = searchParams.get("error_description") || searchParams.get("error");
  if (providerError) {
    console.error("[auth] リンク側のエラー:", providerError);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(providerError)}`);
  }

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") || "email") as EmailOtpType;

  const supabase = await createClient();

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth] verifyOtp 失敗:", error.message);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);

    // PKCE は、ログイン操作をしたブラウザに残る照合用の値が必要になる。
    // 別のブラウザや端末でリンクを開くとここで失敗する。
    const names = request.cookies.getAll().map((c) => c.name);
    const hasVerifier = names.some((n) => n.includes("code-verifier"));
    console.error(
      "[auth] exchangeCodeForSession 失敗:",
      error.message,
      `照合用データ=${hasVerifier ? "あり" : "なし"}`,
      `cookie=${names.join(",") || "（なし）"}`,
    );

    const message = hasVerifier
      ? error.message
      : "ログインを開始したブラウザと、リンクを開いたブラウザが違うようです。同じブラウザで開き直すか、管理者にメールのテンプレート設定を確認してもらってください。";
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("リンクに認証情報が含まれていませんでした。")}`,
  );
}
