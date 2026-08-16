"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GRADES } from "@/lib/constants";

export default function NewStudentForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [honorific, setHonorific] = useState("くん");
  const [slug, setSlug] = useState("");
  const [grade, setGrade] = useState(GRADES[1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from("students").insert({
        name: name.trim(),
        honorific,
        slug: slug.trim(),
        grade,
        created_by: user?.id ?? null,
      });
      if (error) throw error;

      setName("");
      setSlug("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="ghost add-button" onClick={() => setOpen(true)}>
        ＋ 生徒を追加する
      </button>
    );
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <h2>生徒を追加</h2>

      <div className="field">
        <label>氏名</label>
        <div className="row2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="山田花子"
            required
            autoFocus
          />
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
        </select>
      </div>

      <div className="form-actions">
        <button className="primary compact" type="submit" disabled={busy || !name.trim()}>
          {busy ? "登録中…" : "登録する"}
        </button>
        <button type="button" className="ghost" onClick={() => setOpen(false)} disabled={busy}>
          やめる
        </button>
      </div>

      {error && <div className="status error">{error}</div>}
    </form>
  );
}
