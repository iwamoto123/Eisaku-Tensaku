"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AppHeader({
  email,
  breadcrumb,
  back,
}: {
  email: string;
  breadcrumb?: { label: string; href?: string }[];
  /** 前の画面へ戻る導線。どの画面からでも1つ上に戻れるようにする */
  back?: { href: string; label: string };
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="app-header">
      {back && (
        <Link href={back.href} className="back-link" title={`${back.label}へ戻る`}>
          <span aria-hidden>←</span>
          <span className="back-label">{back.label}</span>
        </Link>
      )}
      <Link href="/" className="brand">
        英作文添削メーカー
      </Link>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="crumbs">
          {breadcrumb.map((c, i) => (
            <span key={i}>
              <span className="sep">/</span>
              {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <span className="spacer" />
      <span className="who">{email}</span>
      <Link href="/settings" className="link-button">
        設定
      </Link>
      <button className="link-button" onClick={signOut}>
        ログアウト
      </button>
    </header>
  );
}
