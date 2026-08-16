import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import CorrectionView from "@/components/CorrectionView";
import { createClient } from "@/lib/supabase/server";
import type { CorrectionRow, StudentRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CorrectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: correction } = await supabase
    .from("corrections")
    .select("*")
    .eq("id", id)
    .single();
  if (!correction) notFound();
  const c = correction as CorrectionRow;

  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", c.student_id)
    .single();
  if (!student) notFound();
  const s = student as StudentRow;

  const crumbs = [
    { label: `${s.name}${s.honorific}`, href: `/students/${s.id}` },
    { label: c.target_date.replaceAll("-", "/") },
  ];

  if (c.status !== "done" || !c.data) {
    return (
      <>
        <AppHeader
          email={user?.email ?? ""}
          back={{ href: `/students/${s.id}`, label: `${s.name}${s.honorific}` }}
          breadcrumb={crumbs}
        />
        <main className="page">
          <div className="empty">
            {c.status === "generating" ? (
              <>
                この添削はまだ作成中です。
                <br />
                作成した画面を開いたまましばらくお待ちいただき、ページを再読み込みしてください。
              </>
            ) : (
              <>
                作成に失敗しました。
                <br />
                {c.error_message || "原因は記録されていません。"}
              </>
            )}
            <br />
            <br />
            <Link className="ghost" href={`/corrections/new?student=${s.id}`}>
              作り直す
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader
          email={user?.email ?? ""}
          back={{ href: `/students/${s.id}`, label: `${s.name}${s.honorific}` }}
          breadcrumb={crumbs}
        />
      <CorrectionView correction={c} student={s} />
    </>
  );
}
