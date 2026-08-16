"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GRADES } from "@/lib/constants";
import type { StudentRow } from "@/lib/db";

export default function StudentSettings({
  student,
  correctionCount,
}: {
  student: StudentRow;
  correctionCount: number;
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(student.name);
  const [honorific, setHonorific] = useState(student.honorific);
  const [slug, setSlug] = useState(student.slug);
  const [grade, setGrade] = useState(student.grade);
  const [note, setNote] = useState(student.note);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const changed =
    name !== student.name ||
    honorific !== student.honorific ||
    slug !== student.slug ||
    grade !== student.grade ||
    note !== student.note;

  async function save() {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("students")
        .update({
          name: name.trim(),
          honorific,
          slug: slug.trim(),
          grade,
          note,
        })
        .eq("id", student.id);
      if (error) throw error;
      setStatus("保存しました。");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const warning =
      correctionCount > 0
        ? `${student.name}${student.honorific}と、これまでの添削${correctionCount}件をすべて削除します。元に戻せません。よろしいですか。`
        : `${student.name}${student.honorific}を削除します。よろしいですか。`;
    if (!confirm(warning)) return;

    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("students").delete().eq("id", student.id);
      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました。");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="link-button" onClick={() => setOpen(true)}>
        生徒の情報を編集する
      </button>
    );
  }

  return (
    <div className="panel-box">
      <h2>生徒の情報</h2>

      <div className="field">
        <label>氏名</label>
        <div className="row2">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={honorific} onChange={(e) => setHonorific(e.target.value)}>
            <option>くん</option>
            <option>さん</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>
          ファイル名<span className="hint">英数字。PDF・PNGの名前になります</span>
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
          {!GRADES.includes(grade) && <option>{grade}</option>}
        </select>
      </div>

      <div className="field">
        <label>
          メモ<span className="hint">任意・この画面でだけ見えます</span>
        </label>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="志望校、指導の方針、保護者から聞いていることなど"
        />
      </div>

      <div className="form-actions">
        <button className="primary compact" onClick={save} disabled={busy || !name.trim() || !changed}>
          {busy ? "保存中…" : changed ? "保存する" : "変更なし"}
        </button>
        <button className="ghost" onClick={() => setOpen(false)} disabled={busy}>
          閉じる
        </button>
        <span className="spacer" />
        <button className="ghost danger" onClick={remove} disabled={busy}>
          この生徒を削除
        </button>
      </div>

      {status && !error && <div className="status">{status}</div>}
      {error && <div className="status error">{error}</div>}
    </div>
  );
}
