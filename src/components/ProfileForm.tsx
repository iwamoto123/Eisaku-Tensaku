"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProfileForm({
  email,
  displayName,
}: {
  email: string;
  displayName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const changed = name !== displayName;

  async function save() {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("instructors")
        .update({ display_name: name.trim() })
        .eq("id", user?.id ?? "");
      if (error) throw error;
      setStatus("保存しました。次に添削を作るとき、この名前が初期値になります。");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel-box">
      <h2>あなたの情報</h2>

      <div className="field">
        <label>
          メールアドレス<span className="hint">ログインに使います。変更できません</span>
        </label>
        <input type="text" value={email} disabled />
      </div>

      <div className="field">
        <label>
          担当講師名<span className="hint">添削資料に「担当：○○ 先生」として入ります</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="鈴木一郎"
        />
      </div>

      <div className="form-actions">
        <button className="primary compact" onClick={save} disabled={busy || !changed}>
          {busy ? "保存中…" : changed ? "保存する" : "変更なし"}
        </button>
      </div>

      {status && !error && <div className="status">{status}</div>}
      {error && <div className="status error">{error}</div>}
    </div>
  );
}
