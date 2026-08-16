"use client";

import { useCallback, useRef, useState } from "react";
import FeedbackDoc from "@/components/FeedbackDoc";
import { createClient } from "@/lib/supabase/client";
import { downloadDocument, type DownloadFormat } from "@/lib/download";
import { fileBaseFor, type CorrectionRow, type StudentRow } from "@/lib/db";

function nowLabel() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function CorrectionView({
  correction,
  student,
}: {
  correction: CorrectionRow;
  student: StudentRow;
}) {
  // 講師が編集した版があればそれを表示する。無ければ生成結果から組み立てる
  const [editedHtml, setEditedHtml] = useState<string | null>(correction.edited_html);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const docRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async () => {
    if (!docRef.current) return;
    const html = docRef.current.innerHTML;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("corrections")
        .update({ edited_html: html })
        .eq("id", correction.id);
      if (error) throw error;
      setEditedHtml(html);
      setSavedAt(nowLabel());
      setDirty(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました。");
    }
  }, [correction.id]);

  const handleInput = useCallback(() => {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 1500);
  }, [save]);

  async function handleDownload(format: DownloadFormat) {
    if (!docRef.current) return;
    setBusy(true);
    setError("");
    const wasEditing = editing;
    if (wasEditing) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await save();
      setEditing(false);
    }
    try {
      // contentEditable の枠線が画像に写らないよう、解除を1フレーム待つ
      await new Promise((r) => setTimeout(r, 60));
      const { pages, pixelRatio } = await downloadDocument(docRef.current, {
        fileBase: fileBaseFor(student, correction.target_date),
        format,
        onProgress: (done, total) =>
          setStatus(total > 1 ? `書き出しています… ${done} / ${total}ページ` : "書き出しています…"),
      });
      if (format === "pdf") {
        setStatus(`PDFを書き出しました（全${pages}ページ）。`);
      } else if (format === "png-split") {
        setStatus(`PNGを${pages}枚書き出しました。`);
      } else {
        setStatus(
          pixelRatio < 2
            ? `PNGを1枚書き出しました。資料が長いため解像度を${Math.round(pixelRatio * 100)}%に下げています。`
            : "PNGを1枚書き出しました。",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "書き出しに失敗しました。");
    } finally {
      setEditing(wasEditing);
      setBusy(false);
    }
  }

  async function revert() {
    if (!confirm("編集内容を破棄して、生成された内容に戻します。よろしいですか。")) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("corrections")
        .update({ edited_html: null })
        .eq("id", correction.id);
      if (error) throw error;
      setEditedHtml(null);
      setEditing(false);
      setDirty(false);
      setSavedAt("");
      setStatus("生成された内容に戻しました。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "戻せませんでした。");
    }
  }

  return (
    <main className="stage">
      <div className="toolbar">
        {editing ? (
          <>
            <button
              className="ghost strong"
              onClick={() => {
                if (saveTimer.current) clearTimeout(saveTimer.current);
                void save();
              }}
              disabled={busy}
            >
              編集内容を保存
            </button>
            <button
              className="ghost"
              onClick={async () => {
                if (saveTimer.current) clearTimeout(saveTimer.current);
                await save();
                setEditing(false);
              }}
              disabled={busy}
            >
              保存して編集を終える
            </button>
          </>
        ) : (
          <button className="ghost" onClick={() => setEditing(true)} disabled={busy}>
            本文を編集する
          </button>
        )}
        <span className="divider" />
        <button className="ghost strong" onClick={() => handleDownload("pdf")} disabled={busy}>
          PDFで保存
        </button>
        <button className="ghost" onClick={() => handleDownload("png-split")} disabled={busy}>
          PNGで保存（ページ分割）
        </button>
        <button className="ghost" onClick={() => handleDownload("png-single")} disabled={busy}>
          PNGで保存（1枚）
        </button>
        <span className="spacer" />
        <span className={dirty ? "save-state unsaved" : "save-state"}>
          {dirty
            ? "未保存の変更があります"
            : savedAt
              ? `${savedAt} に保存しました`
              : editedHtml
                ? "編集済み"
                : ""}
        </span>
        {editedHtml && !editing && (
          <button className="link-button" onClick={revert} disabled={busy}>
            編集を取り消す
          </button>
        )}
      </div>

      {status && !error && <div className="status inline">{status}</div>}
      {error && <div className="status error inline">{error}</div>}

      {editedHtml !== null ? (
        <div
          className="doc-frame"
          ref={docRef}
          contentEditable={editing}
          suppressContentEditableWarning
          onInput={handleInput}
          dangerouslySetInnerHTML={{ __html: editedHtml }}
        />
      ) : (
        <div
          className="doc-frame"
          ref={docRef}
          contentEditable={editing}
          suppressContentEditableWarning
          onInput={handleInput}
        >
          <FeedbackDoc data={correction.data!} />
        </div>
      )}
    </main>
  );
}
