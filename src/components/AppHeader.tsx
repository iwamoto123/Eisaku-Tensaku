"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AppHeader({
  email,
  breadcrumb,
}: {
  email: string;
  breadcrumb?: { label: string; href?: string }[];
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
      <button className="link-button" onClick={signOut}>
        ログアウト
      </button>
    </header>
  );
}
