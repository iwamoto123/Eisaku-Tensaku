"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  /**
   * 編集する領域は、Reactの管理下から完全に外している。
   *
   * contentEditable の中身をReactが持っていると、状態が変わって再描画されるたびに
   * カーソルが先頭へ戻り、途中の書き換えが効かなくなる。
   * そこで資料は「一度だけHTMLとして流し込み、あとはDOMをそのまま正とする」形にした。
   *
   * 生成直後（まだ編集していない）の資料は、いったん非表示の場所にReactで描いてから
   * そのHTMLを取り出し、編集用の領域へ移している。
   */
  const docRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);

  const generatedHtml = useRef<string | null>(null);
  const currentHtml = useRef<string | null>(correction.edited_html);

  const [docKey, setDocKey] = useState(0);
  const [needsSource, setNeedsSource] = useState(correction.edited_html === null);

  const [hasEdits, setHasEdits] = useState(Boolean(correction.edited_html));
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // 資料を編集用の領域へ流し込む。docKey を変えたときだけやり直す
  useEffect(() => {
    const target = docRef.current;
    if (!target) return;

    if (currentHtml.current === null && sourceRef.current) {
      // Reactが描いた資料のHTMLを取り出して覚えておく
      generatedHtml.current = sourceRef.current.innerHTML;
      currentHtml.current = generatedHtml.current;
      setNeedsSource(false); // 取り出したら非表示の複製は捨てる
    }
    target.innerHTML = currentHtml.current ?? "";
  }, [docKey]);

  const save = useCallback(async () => {
    if (!docRef.current) return false;
    const html = docRef.current.innerHTML;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("corrections")
        .update({ edited_html: html })
        .eq("id", correction.id);
      if (error) throw error;
      currentHtml.current = html; // 表示は差し替えない。次に描き直すときのために覚えるだけ
      setHasEdits(true);
      setSavedAt(nowLabel());
      setDirty(false);
      setError("");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました。");
      return false;
    }
  }, [correction.id]);

  const handleInput = useCallback(() => {
    setDirty((prev) => prev || true);
  }, []);

  // 保存していない変更があるまま閉じようとしたら引き止める
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function saveAndClose() {
    setBusy(true);
    const ok = await save();
    setBusy(false);
    if (ok) {
      setEditing(false);
      setStatus("保存しました。");
    }
  }

  function cancelEditing() {
    if (!dirty) {
      setEditing(false);
      return;
    }
    if (!confirm("保存していない変更を捨てます。よろしいですか。")) return;
    setDirty(false);
    setEditing(false);
    setDocKey((k) => k + 1); // 保存済みの内容で描き直す
  }

  async function handleDownload(format: DownloadFormat) {
    if (!docRef.current) return;
    setBusy(true);
    setError("");
    try {
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
      setBusy(false);
    }
  }

  /** 講師の編集をすべて捨て、AIが作った内容に戻す */
  async function revertToGenerated() {
    if (!confirm("編集した内容をすべて捨てて、AIが作った最初の状態に戻します。よろしいですか。")) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("corrections")
        .update({ edited_html: null })
        .eq("id", correction.id);
      if (error) throw error;

      currentHtml.current = generatedHtml.current;
      if (currentHtml.current === null) setNeedsSource(true); // 一度も描いていない場合
      setDocKey((k) => k + 1);
      setHasEdits(false);
      setEditing(false);
      setDirty(false);
      setSavedAt("");
      setStatus("AIが作った内容に戻しました。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "戻せませんでした。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="stage">
      <div className="toolbar">
        {editing ? (
          <>
            <button className="ghost strong" onClick={saveAndClose} disabled={busy}>
              保存
            </button>
            <button className="ghost" onClick={cancelEditing} disabled={busy}>
              キャンセル
            </button>
            <span className="spacer" />
            <span className={dirty ? "save-state unsaved" : "save-state"}>
              {dirty ? "未保存の変更があります" : "変更なし"}
            </span>
          </>
        ) : (
          <>
            <button className="ghost" onClick={() => setEditing(true)} disabled={busy}>
              本文を編集
            </button>
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
            <span className="save-state">
              {savedAt ? `${savedAt} に保存しました` : hasEdits ? "編集済み" : ""}
            </span>
            {hasEdits && (
              <button className="link-button" onClick={revertToGenerated} disabled={busy}>
                AIの生成内容に戻す
              </button>
            )}
          </>
        )}
      </div>

      {editing && (
        <div className="status inline">
          資料をクリックして書き換えられます。取り消しは Cmd+Z です。
          <br />
          <strong>「保存」を押すまで保存されません。</strong>
        </div>
      )}
      {status && !error && !editing && <div className="status inline">{status}</div>}
      {error && <div className="status error inline">{error}</div>}

      {/* 生成直後の資料をHTMLとして取り出すための場所。取り出したら消える */}
      {needsSource && correction.data && (
        <div ref={sourceRef} hidden aria-hidden>
          <FeedbackDoc data={correction.data} />
        </div>
      )}

      {/* 編集する領域。中身はReactが持たない */}
      <div
        key={docKey}
        ref={docRef}
        className="doc-frame"
        contentEditable={editing}
        suppressContentEditableWarning
        onInput={handleInput}
      />
    </main>
  );
}
