import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import StudentSettings from "@/components/StudentSettings";
import CorrectionList from "@/components/CorrectionList";
import { createClient } from "@/lib/supabase/server";
import type { CorrectionRow, StudentRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
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
      <AppHeader email={user?.email ?? ""} back={{ href: "/", label: "生徒一覧" }}
        breadcrumb={[{ label: `${s.name}${s.honorific}` }]} />
      <main className="page">
        <div className="page-head">
          <h1>
            {s.name}
            {s.honorific}
          </h1>
          <div className="sub">
            <span className="pill">{s.grade}</span>
            {list.length > 0 && <span className="lead-text">添削 {list.length}件</span>}
            <StudentSettings student={s} correctionCount={list.length} />
          </div>
        </div>

        {s.note && <div className="panel-box note-box">{s.note}</div>}

        <Link className="cta" href={`/corrections/new?student=${s.id}`}>
          <span className="cta-icon">＋</span>
          <span className="cta-body">
            <span className="cta-title">新しい添削をつくる</span>
            <span className="cta-sub">
              答案の画像を入れると、{s.grade}の添削フィードバック資料ができます
            </span>
          </span>
          <span className="cta-arrow">→</span>
        </Link>

        {list.length === 0 ? (
          <div className="empty">
            まだ添削がありません。
            <br />
            上のボタンから最初の1件を作ってください。
          </div>
        ) : (
          <>
            <div className="section-label">これまでの添削</div>
            <CorrectionList corrections={list} />
          </>
        )}
      </main>
    </>
  );
}
