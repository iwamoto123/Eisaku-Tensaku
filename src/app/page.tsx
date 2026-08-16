"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FeedbackDoc from "@/components/FeedbackDoc";
import { downloadDocument, type DownloadFormat } from "@/lib/download";
import { prepareImage, type PreparedImage } from "@/lib/image";
import { deriveProgress, type Progress } from "@/lib/progress";
import type { Feedback } from "@/lib/schema";

const GRADES = [
  "英検準2級 対策",
  "英検2級 対策",
  "英検準1級 対策",
  "英検1級 対策",
  "大学入試 英作文",
];

const PREFS_KEY = "writing-tensaku:prefs";
const DRAFT_KEY = "writing-tensaku:draft";

function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function toJaDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(y)}年${Number(m)}月${Number(d)}日`;
}

function nowLabel() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Draft = { html: string; savedAt: string; title: string };

export default function Home() {
  const [studentName, setStudentName] = useState("");
  const [honorific, setHonorific] = useState("くん");
  const [slug, setSlug] = useState("");
  const [grade, setGrade] = useState(GRADES[1]);
  const [instructorName, setInstructorName] = useState("");
  const [date, setDate] = useState(todayISO());
  const [topic, setTopic] = useState("");
  const [englishPoints, setEnglishPoints] = useState("");
  const [notes, setNotes] = useState("");

  const [images, setImages] = useState<PreparedImage[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [data, setData] = useState<Feedback | null>(null);
  // 前回の編集内容を復元したときは、生成結果ではなくこのHTMLを表示する
  const [restoredHtml, setRestoredHtml] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);
  const [savedAt, setSavedAt] = useState("");
  const [dirty, setDirty] = useState(false);

  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const docRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasDoc = Boolean(data || restoredHtml);

  // 講師名・級はブラウザに覚えさせて、毎回入力しなくてよいようにする
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
      if (saved.instructorName) setInstructorName(saved.instructorName);
      if (saved.grade) setGrade(saved.grade);
    } catch {
      /* 保存値が壊れていても無視する */
    }
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as Draft | null;
      if (draft?.html) setPendingDraft(draft);
    } catch {
      /* 同上 */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ instructorName, grade }));
  }, [instructorName, grade]);

  const saveDraft = useCallback(() => {
    if (!docRef.current) return;
    const draft: Draft = {
      html: docRef.current.innerHTML,
      savedAt: new Date().toISOString(),
      title: `${studentName || "生徒"}${honorific}／${toJaDate(date)}`,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setSavedAt(nowLabel());
    setDirty(false);
  }, [studentName, honorific, date]);

  // 編集するたびに自動保存する（打ち終わってから少し待って書き込む）
  const handleDocInput = useCallback(() => {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveDraft, 1500);
  }, [saveDraft]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setError("");
    try {
      const prepared = await Promise.all(list.map(prepareImage));
      setImages((prev) => [...prev, ...prepared].slice(0, 6));
    } catch (e) {
      setError(e instanceof Error ? e.message : "画像の処理に失敗しました。");
    }
  }, []);

  // クリップボードから直接貼り付けられるようにする
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      // 資料の編集中は、そちらの貼り付けを邪魔しない
      if (target?.isContentEditable) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length > 0) void addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  async function generate() {
    if (images.length === 0) {
      setError("答案の画像を追加してください。");
      return;
    }
    setLoading(true);
    setError("");
    setStatus("");
    setData(null);
    setRestoredHtml(null);
    setPendingDraft(null);
    setSavedAt("");
    setDirty(false);
    setEditing(false);
    setProgress(deriveProgress("", 0));

    const started = Date.now();
    const ticker = setInterval(() => {
      setProgress((p) =>
        p ? { ...p, detail: p.detail.replace(/^\d+秒経過/, `${Math.round((Date.now() - started) / 1000)}秒経過`) } : p,
      );
    }, 1000);

    try {
      const res = await fetch("/api/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meta: {
            studentName,
            honorific,
            grade,
            instructorName,
            dateLabel: toJaDate(date),
            topic,
            englishPoints,
            instructorNotes: notes,
          },
          images: images.map(({ media_type, data }) => ({ media_type, data })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "生成に失敗しました。" }));
        throw new Error(body.error ?? "生成に失敗しました。");
      }
      if (!res.body) throw new Error("応答がありません。");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        setProgress(deriveProgress(raw, Math.round((Date.now() - started) / 1000)));
      }

      const errIndex = raw.indexOf("__ERROR__:");
      if (errIndex >= 0) throw new Error(raw.slice(errIndex + "__ERROR__:".length).trim());

      let parsed: Feedback;
      try {
        parsed = JSON.parse(raw) as Feedback;
      } catch {
        const where = deriveProgress(raw, 0).label;
        throw new Error(
          `生成が途中で終わりました（${where}のところまで）。通信が切れたか、APIの上限に達した可能性があります。`,
        );
      }

      if (parsed.corrections.length === 0 || parsed.good_points.length === 0) {
        setData(parsed);
        throw new Error(
          "資料が途中までしか作られませんでした。表示されている内容は不完全です。もう一度お試しください。",
        );
      }

      setData(parsed);
      localStorage.removeItem(DRAFT_KEY);
      setProgress({ label: "完成しました", percent: 100, detail: `${Math.round((Date.now() - started) / 1000)}秒` });
      setStatus("内容を確認して、必要なら本文を直してから書き出してください。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました。");
      setProgress(null);
    } finally {
      clearInterval(ticker);
      setLoading(false);
    }
  }

  async function handleDownload(format: DownloadFormat) {
    if (!docRef.current) return;
    setExporting(true);
    setError("");
    const wasEditing = editing;
    if (wasEditing) {
      saveDraft();
      setEditing(false);
    }
    try {
      // contentEditable の枠線が画像に写らないよう、解除を1フレーム待つ
      await new Promise((r) => setTimeout(r, 60));
      const base = `${date}_${slug.trim() || "student"}_writing-feedback`;
      const { pages, pixelRatio } = await downloadDocument(docRef.current, {
        fileBase: base,
        format,
        onProgress: (done, total) =>
          setProgress({
            label: format === "pdf" ? "PDFを作っています" : "PNGを書き出しています",
            percent: total > 0 ? Math.round((done / total) * 100) : 0,
            detail: `${done} / ${total}ページ`,
          }),
      });
      setProgress(null);
      if (format === "pdf") {
        setStatus(`PDFを書き出しました（全${pages}ページ）。ダウンロードフォルダを確認してください。`);
      } else if (format === "png-split") {
        setStatus(`PNGを${pages}枚書き出しました。ダウンロードフォルダを確認してください。`);
      } else {
        setStatus(
          pixelRatio < 2
            ? `PNGを1枚書き出しました。資料が長いため解像度を${Math.round(pixelRatio * 100)}%に下げています。読みやすさを優先するならページ分割かPDFを使ってください。`
            : "PNGを1枚書き出しました。",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "書き出しに失敗しました。");
      setProgress(null);
    } finally {
      setEditing(wasEditing);
      setExporting(false);
    }
  }

  return (
    <div className="app">
      <div className="panel">
        <h1>英作文添削メーカー</h1>
        <p className="sub">白谷塾オンライン教室</p>

        <div className="field">
          <label>
            答案の画像<span className="hint">複数枚可・貼り付け可</span>
          </label>
          <div
            className={dragOver ? "dropzone over" : "dropzone"}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void addFiles(e.dataTransfer.files);
            }}
          >
            ここに画像をドラッグ、またはクリックして選択
            <br />
            スクリーンショットは Cmd+V で貼り付けられます
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {images.length > 0 && (
            <div className="thumbs">
              {images.map((img) => (
                <div className="thumb" key={img.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.previewUrl} alt="答案" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))}
                    aria-label="削除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <label>生徒名</label>
          <div className="row2">
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="山田花子"
            />
            <select value={honorific} onChange={(e) => setHonorific(e.target.value)}>
              <option>くん</option>
              <option>さん</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label>
            ファイル名<span className="hint">英数字。PNG・PDFの名前になります</span>
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.replace(/[^A-Za-z0-9_-]/g, ""))}
            placeholder="yamada-hanako"
          />
        </div>

        <div className="field">
          <label>級・コース</label>
          <select value={grade} onChange={(e) => setGrade(e.target.value)}>
            {GRADES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>担当講師</label>
          <input
            type="text"
            value={instructorName}
            onChange={(e) => setInstructorName(e.target.value)}
            placeholder="鈴木一郎"
          />
        </div>

        <div className="field">
          <label>日付</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="field">
          <label>
            出題内容<span className="hint">任意</span>
          </label>
          <textarea
            rows={2}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="大都市に住むほうが小さな町に住むよりよいと思うか（意見論述・80〜100語）"
          />
        </div>

        <div className="field">
          <label>
            指摘したい英語の内容<span className="hint">任意・ここに書いた項目は必ず扱われます</span>
          </label>
          <textarea
            rows={6}
            value={englishPoints}
            onChange={(e) => setEnglishPoints(e.target.value)}
            placeholder={
              "赤ペンを入れた箇所を書いてください。簡単な書き方で構いません。\n\n例：\n・convenience → convenient（品詞の使い分け）\n・文頭の Because の使い方\n・hasn't ではなく doesn't have\n・結論が1文目のコピーになっている\n・段落のインデントがない"
            }
          />
        </div>

        <div className="field">
          <label>
            追加で伝えたいこと<span className="hint">任意</span>
          </label>
          <textarea
            rows={6}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              "英語の指摘以外で、資料に入れたいことを書いてください。\n\n例：\n・前回と同じミスが続いているので重点的に扱ってほしい\n・今は単語と熟語を優先する方針で進めている\n・保護者からの質問に答える形で一言入れてほしい\n・インデントの話は今回は省いてよい"
            }
          />
        </div>

        <button className="primary" onClick={generate} disabled={loading || exporting}>
          {loading ? "作成中…" : "添削資料をつくる"}
        </button>

        {progress && (
          <div className="progress">
            <div className="progress-head">
              <span className="progress-label">{progress.label}</span>
              <span className="progress-percent">{progress.percent}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-bar" style={{ width: `${progress.percent}%` }} />
            </div>
            <div className="progress-detail">{progress.detail}</div>
          </div>
        )}

        {status && !error && <div className="status">{status}</div>}
        {error && <div className="status error">{error}</div>}
      </div>

      <div className="stage">
        {pendingDraft && !hasDoc && (
          <div className="banner">
            <div>
              前回の編集内容が残っています（{pendingDraft.title}）。
              <br />
              復元すると、そのまま続きを直して書き出せます。
            </div>
            <div className="banner-actions">
              <button
                className="ghost"
                onClick={() => {
                  setRestoredHtml(pendingDraft.html);
                  setPendingDraft(null);
                  setStatus("前回の編集内容を復元しました。");
                }}
              >
                復元する
              </button>
              <button
                className="ghost"
                onClick={() => {
                  localStorage.removeItem(DRAFT_KEY);
                  setPendingDraft(null);
                }}
              >
                破棄する
              </button>
            </div>
          </div>
        )}

        <div className="toolbar">
          {editing ? (
            <>
              <button
                className="ghost strong"
                onClick={() => {
                  if (saveTimer.current) clearTimeout(saveTimer.current);
                  saveDraft();
                }}
                disabled={exporting}
              >
                編集内容を保存
              </button>
              <button
                className="ghost"
                onClick={() => {
                  if (saveTimer.current) clearTimeout(saveTimer.current);
                  saveDraft();
                  setEditing(false);
                }}
                disabled={exporting}
              >
                保存して編集を終える
              </button>
            </>
          ) : (
            <button
              className="ghost"
              onClick={() => setEditing(true)}
              disabled={!hasDoc || exporting}
            >
              本文を編集する
            </button>
          )}
          <span className="divider" />
          <button
            className="ghost strong"
            onClick={() => handleDownload("pdf")}
            disabled={!hasDoc || exporting}
          >
            PDFで保存
          </button>
          <button
            className="ghost"
            onClick={() => handleDownload("png-split")}
            disabled={!hasDoc || exporting}
          >
            PNGで保存（ページ分割）
          </button>
          <button
            className="ghost"
            onClick={() => handleDownload("png-single")}
            disabled={!hasDoc || exporting}
          >
            PNGで保存（1枚）
          </button>
          <span className="spacer" />
          {hasDoc && (
            <span className={dirty ? "save-state unsaved" : "save-state"}>
              {dirty
                ? "未保存の変更があります"
                : savedAt
                  ? `${savedAt} に保存しました`
                  : editing
                    ? "資料を直接クリックして書き換えられます"
                    : ""}
            </span>
          )}
        </div>

        {hasDoc ? (
          restoredHtml !== null ? (
            <div
              className="doc-frame"
              ref={docRef}
              contentEditable={editing}
              suppressContentEditableWarning
              onInput={handleDocInput}
              dangerouslySetInnerHTML={{ __html: restoredHtml }}
            />
          ) : (
            <div
              className="doc-frame"
              ref={docRef}
              contentEditable={editing}
              suppressContentEditableWarning
              onInput={handleDocInput}
            >
              <FeedbackDoc data={data!} />
            </div>
          )
        ) : (
          <div className="empty">
            左のパネルに答案の画像と生徒の情報を入れて、「添削資料をつくる」を押してください。
            <br />
            できあがった資料はこの場所に表示されます。文面を直してからPDFやPNGにできます。
          </div>
        )}
      </div>
    </div>
  );
}
