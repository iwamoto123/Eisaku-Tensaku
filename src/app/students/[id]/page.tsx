import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import type { CorrectionRow, StudentRow } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<CorrectionRow["status"], string> = {
  generating: "作成中",
  done: "",
  error: "失敗",
};

export default async function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: student } = await supabase.from("students").select("*").eq("id", id).single();
  if (!student) notFound();

  const { data: corrections } = await supabase
    .from("corrections")
    .select("*")
    .eq("student_id", id)
    .order("target_date", { ascending: false })
    .order("created_at", { ascending: false });

  const s = student as StudentRow;
  const list = (corrections ?? []) as CorrectionRow[];

  return (
    <>
      <AppHeader
        email={user?.email ?? ""}
        breadcrumb={[{ label: `${s.name}${s.honorific}` }]}
      />
      <main className="page">
        <div className="page-head">
          <h1>
            {s.name}
            {s.honorific}
          </h1>
          <p className="lead-text">{s.grade}</p>
        </div>

        <Link className="ghost add-button strong" href={`/corrections/new?student=${s.id}`}>
          ＋ 新しい添削をつくる
        </Link>

        {list.length === 0 ? (
          <div className="empty">
            まだ添削がありません。
            <br />
            上のボタンから最初の1件を作ってください。
          </div>
        ) : (
          <ul className="card-list">
            {list.map((c) => (
              <li key={c.id}>
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
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
