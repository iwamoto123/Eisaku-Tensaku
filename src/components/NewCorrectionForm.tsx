"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ANSWERS_BUCKET } from "@/lib/constants";
import { toJaDate, todayISO, type CorrectionKind, type StudentRow } from "@/lib/db";
import { prepareImage, type PreparedImage } from "@/lib/image";
import { deriveProgress, type Progress } from "@/lib/progress";
import ProgressPanel from "@/components/ProgressPanel";

const INSTRUCTOR_KEY = "writing-tensaku:instructor";

export default function NewCorrectionForm({
  student,
  defaultInstructorName,
}: {
  student: StudentRow;
  defaultInstructorName: string;
}) {
  const router = useRouter();

  const [kind, setKind] = useState<CorrectionKind>("writing");
  const [instructorName, setInstructorName] = useState(defaultInstructorName);
  const [date, setDate] = useState(todayISO());
  const [topic, setTopic] = useState("");
  const [englishPoints, setEnglishPoints] = useState("");
  const [notes, setNotes] = useState("");

  const [images, setImages] = useState<PreparedImage[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (defaultInstructorName) return;
    const saved = localStorage.getItem(INSTRUCTOR_KEY);
    if (saved) setInstructorName(saved);
  }, [defaultInstructorName]);

  useEffect(() => {
    if (instructorName) localStorage.setItem(INSTRUCTOR_KEY, instructorName);
  }, [instructorName]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setError("");
    try {
      const prepared = await Promise.all(list.map(prepareImage));
      setImages((prev) => [...prev, ...prepared].slice(0, 8));
    } catch (e) {
      setError(e instanceof Error ? e.message : "画像の処理に失敗しました。");
    }
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length > 0) void addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  /** dataURL の base64 部分を Blob に戻す（Storage へは Blob で上げる） */
  function toBlob(img: PreparedImage): Blob {
    const bytes = Uint8Array.from(atob(img.data), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: img.media_type });
  }

  async function generate() {
    if (images.length === 0) {
      setError("答案の画像を追加してください。");
      return;
    }
    setLoading(true);
    setError("");
    setProgress({ ...deriveProgress("", 0, kind), label: "答案の画像を保存しています", percent: 2 });

    const started = Date.now();
    const ticker = setInterval(() => {
      setProgress((p) =>
        p
          ? {
              ...p,
              detail: p.detail.replace(
                /^\d+秒経過/,
                `${Math.round((Date.now() - started) / 1000)}秒経過`,
              ),
            }
          : p,
      );
    }, 1000);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 添削のIDを先に決めてから画像を上げる。画像の置き場所をIDで分けるため
      const correctionId = crypto.randomUUID();
      const paths: string[] = [];

      for (const [i, img] of images.entries()) {
        const path = `${correctionId}/${String(i + 1).padStart(2, "0")}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(ANSWERS_BUCKET)
          .upload(path, toBlob(img), { contentType: img.media_type, upsert: true });
        if (upErr) throw new Error(`画像の保存に失敗しました: ${upErr.message}`);
        paths.push(path);
      }

      const { error: insErr } = await supabase.from("corrections").insert({
        id: correctionId,
        student_id: student.id,
        instructor_id: user?.id ?? null,
        instructor_name: instructorName,
        grade: student.grade,
        date_label: toJaDate(date),
        target_date: date,
        topic,
        english_points: englishPoints,
        instructor_notes: notes,
        image_paths: paths,
        kind,
        status: "generating",
      });
      if (insErr) throw new Error(`記録の作成に失敗しました: ${insErr.message}`);

      setProgress(deriveProgress("", 0, kind));

      const res = await fetch("/api/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correctionId }),
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
        setProgress(deriveProgress(raw, Math.round((Date.now() - started) / 1000), kind));
      }

      const errIndex = raw.indexOf("__ERROR__:");
      if (errIndex >= 0) throw new Error(raw.slice(errIndex + "__ERROR__:".length).trim());

      setProgress({
        ...deriveProgress(raw, Math.round((Date.now() - started) / 1000), kind),
        label: "完成しました",
        percent: 100,
      });
      router.push(`/corrections/${correctionId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました。");
      setProgress(null);
      setLoading(false);
    } finally {
      clearInterval(ticker);
    }
  }

  return (
    <main className="page narrow">
      <div className="page-head">
        <h1>
          {student.name}
          {student.honorific}のフィードバックをつくる
        </h1>
        <p className="lead-text">{student.grade}</p>
      </div>

      <div className="field">
        <label>種類</label>
        <div className="segmented">
          <button
            type="button"
            className={kind === "writing" ? "seg on" : "seg"}
            onClick={() => setKind("writing")}
            disabled={loading}
          >
            <span className="seg-title">ライティング</span>
            <span className="seg-sub">意見論述などの答案。詳しい資料（A4で10ページ前後）</span>
          </button>
          <button
            type="button"
            className={kind === "translation" ? "seg on" : "seg"}
            onClick={() => setKind("translation")}
            disabled={loading}
          >
            <span className="seg-title">英訳課題</span>
            <span className="seg-sub">毎日の英訳。1問ずつ短く（A4で1〜2ページ）</span>
          </button>
        </div>
      </div>

      <div className="field">
        <label>
          画像<span className="hint">問題と答案の両方でOK・最大8枚・貼り付け可</span>
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
          問題用紙と答案を分けて入れても、まとめて読み取ります
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

      <div className="field-row">
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
            "赤ペンを入れた箇所を書いてください。簡単な書き方で構いません。\n\n例：\n・convenience → convenient（品詞の使い分け）\n・文頭の Because の使い方\n・hasn't ではなく doesn't have\n・結論が1文目のコピーになっている"
          }
        />
      </div>

      <div className="field">
        <label>
          追加で伝えたいこと<span className="hint">任意</span>
        </label>
        <textarea
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            "英語の指摘以外で、資料に入れたいことを書いてください。\n\n例：\n・前回と同じミスが続いているので重点的に扱ってほしい\n・今は単語と熟語を優先する方針で進めている"
          }
        />
      </div>

      <button className="primary" onClick={generate} disabled={loading}>
        {loading ? "作成中…" : kind === "translation" ? "フィードバックをつくる" : "添削資料をつくる"}
      </button>

      {progress && <ProgressPanel progress={progress} />}

      {loading && (
        <p className="login-note">
          完成すると結果のページに移動します。
          {kind === "translation" ? "1〜2分" : "3〜5分"}
          ほどかかるので、このまま開いたままお待ちください。
        </p>
      )}

      {error && <div className="status error">{error}</div>}
    </main>
  );
}
