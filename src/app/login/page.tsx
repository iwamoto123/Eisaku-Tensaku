"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
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
      const message = err instanceof Error ? err.message : String(err);
      setError(
        /not allowed|signups not allowed|user not found/i.test(message)
          ? "このメールアドレスは登録されていません。管理者に登録を依頼してください。"
          : message,
      );
    } finally {
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
        </p>
        <button className="ghost" onClick={() => setSent(false)}>
          別のアドレスで送り直す
        </button>
      </div>
    );
  }

  return (
    <div className="login-card">
      <h1>英作文添削メーカー</h1>
      <p className="login-lead">白谷塾オンライン教室</p>

      <form onSubmit={send}>
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
        <button className="primary" type="submit" disabled={busy || !email.trim()}>
          {busy ? "送信中…" : "ログイン用のリンクを送る"}
        </button>
      </form>

      <p className="login-note">
        パスワードはありません。メールに届くリンクを押すとログインできます。
      </p>
      {error && <div className="status error">{error}</div>}
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
