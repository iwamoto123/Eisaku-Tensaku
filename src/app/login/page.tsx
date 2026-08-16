"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function friendlyError(message: string): string {
  if (/not allowed|signups not allowed|user not found/i.test(message)) {
    return "このメールアドレスは登録されていません。管理者に登録を依頼してください。";
  }
  if (/rate limit|only request this after/i.test(message)) {
    return "送信の間隔が短いか、1時間あたりの送信上限に達しました。しばらく待つか、パスワードでのログインをお使いください。";
  }
  if (/invalid login credentials/i.test(message)) {
    return "メールアドレスかパスワードが違います。";
  }
  return message;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const linkError = params.get("error");

  const [mode, setMode] = useState<"link" | "password">("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    linkError === "link" ? "ログインに失敗しました。もう一度お試しください。" : (linkError ?? ""),
  );

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          shouldCreateUser: false, // 登録済みの講師だけがログインできる
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : String(err)));
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="login-card">
        <h1>メールを送りました</h1>
        <p className="login-lead">
          <strong>{email}</strong> 宛にログイン用のリンクを送りました。
          <br />
          メールを開いてリンクを押すと、そのままログインできます。
        </p>
        <p className="login-note">
          届かない場合は迷惑メールをご確認ください。リンクの有効期限は1時間です。
          <br />
          <strong>ログインを始めたのと同じブラウザで開いてください。</strong>
        </p>
        <button className="ghost" onClick={() => setSent(false)}>
          戻る
        </button>
      </div>
    );
  }

  return (
    <div className="login-card">
      <h1>英作文添削メーカー</h1>
      <p className="login-lead">白谷塾オンライン教室</p>

      <form onSubmit={mode === "link" ? sendLink : signInWithPassword}>
        <div className="field">
          <label>メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
          />
        </div>

        {mode === "password" && (
          <div className="field">
            <label>パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        )}

        <button
          className="primary"
          type="submit"
          disabled={busy || !email.trim() || (mode === "password" && !password)}
        >
          {busy
            ? mode === "link"
              ? "送信中…"
              : "ログイン中…"
            : mode === "link"
              ? "ログイン用のリンクを送る"
              : "ログインする"}
        </button>
      </form>

      {error && <div className="status error">{error}</div>}

      <div className="login-note">
        {mode === "link" ? (
          <>
            パスワードはありません。メールに届くリンクを押すとログインできます。
            <br />
            <button className="link-button" onClick={() => setMode("password")}>
              パスワードでログインする
            </button>
          </>
        ) : (
          <>
            管理者から受け取ったパスワードを入力してください。
            <br />
            <button className="link-button" onClick={() => setMode("link")}>
              メールのリンクでログインする
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="login-stage">
        <div className="login-card">
          <h1>セットアップが必要です</h1>
          <p className="login-lead">
            Supabase の接続情報が設定されていません。
            <br />
            <code>supabase/SETUP.md</code> の手順に従って、
            <code>.env.local</code> に次の2つを追加してください。
          </p>
          <pre className="setup-code">
NEXT_PUBLIC_SUPABASE_URL=...{"\n"}NEXT_PUBLIC_SUPABASE_ANON_KEY=...
          </pre>
          <p className="login-note">追加したら開発サーバーを再起動してください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-stage">
      <Suspense fallback={<div className="login-card">読み込み中…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
