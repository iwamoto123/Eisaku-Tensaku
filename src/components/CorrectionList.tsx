"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ANSWERS_BUCKET } from "@/lib/constants";
import type { CorrectionRow } from "@/lib/db";

const STATUS_LABEL: Record<CorrectionRow["status"], string> = {
  generating: "作成中",
  done: "",
  error: "失敗",
};

export default function CorrectionList({ corrections }: { corrections: CorrectionRow[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function remove(c: CorrectionRow) {
    const label = c.target_date.replaceAll("-", "/");
    if (!confirm(`${label} の添削を削除します。元に戻せません。よろしいですか。`)) return;

    setDeletingId(c.id);
    setError("");
    try {
      const supabase = createClient();

      // 答案の画像も一緒に消す。残しても参照されず、容量だけを使うため
      if (c.image_paths.length > 0) {
        await supabase.storage.from(ANSWERS_BUCKET).remove(c.image_paths);
      }

      const { error } = await supabase.from("corrections").delete().eq("id", c.id);
      if (error) throw error;

      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました。");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {error && <div className="status error">{error}</div>}
      <ul className="card-list">
        {corrections.map((c) => (
          <li key={c.id} className="card-row">
            <Link href={`/corrections/${c.id}`} className="card">
              <span className="card-main">
                <span className="card-title">
                  {c.target_date.replaceAll("-", "/")}
                  {c.status !== "done" && (
                    <span className={`badge ${c.status}`}>{STATUS_LABEL[c.status]}</span>
                  )}
                </span>
                <span className="card-sub">{c.topic || "（出題内容の記録なし）"}</span>
              </span>
              <span className="card-meta">
                {c.data ? `直すところ ${c.data.corrections.length}件` : ""}
                {c.edited_html && <span className="dim">　編集済み</span>}
              </span>
            </Link>
            <button
              className="card-delete"
              onClick={() => remove(c)}
              disabled={deletingId === c.id}
              aria-label="この添削を削除"
              title="この添削を削除"
            >
              {deletingId === c.id ? "…" : "×"}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
