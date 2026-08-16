import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import NewStudentForm from "@/components/NewStudentForm";
import { getViewer } from "@/lib/supabase/server";
import type { StudentRow } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "まだありません";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default async function Home() {
  const { supabase, user } = await getViewer();

  const { data: students } = await supabase
    .from("students")
    .select("*")
    .order("updated_at", { ascending: false });

  const { data: corrections } = await supabase
    .from("corrections")
    .select("student_id, created_at, status")
    .order("created_at", { ascending: false });

  // 生徒ごとの件数と最終日を数える（件数が少ないのでここで集計して足りる）
  const stats = new Map<string, { count: number; last: string | null }>();
  for (const c of corrections ?? []) {
    if (c.status !== "done") continue;
    const s = stats.get(c.student_id) ?? { count: 0, last: null };
    s.count += 1;
    if (!s.last) s.last = c.created_at;
    stats.set(c.student_id, s);
  }

  const list = (students ?? []) as StudentRow[];

  return (
    <>
      <AppHeader email={user?.email ?? ""} />
      <main className="page">
        <div className="page-head">
          <h1>生徒</h1>
          <p className="lead-text">生徒を選ぶと、これまでの添削の履歴が見られます。</p>
        </div>

        {list.length === 0 ? (
          <div className="empty">
            まだ生徒が登録されていません。
            <br />
            下のフォームから追加してください。
          </div>
        ) : (
          <ul className="card-list">
            {list.map((s) => {
              const st = stats.get(s.id);
              return (
                <li key={s.id}>
                  <Link href={`/students/${s.id}`} className="card">
                    <span className="card-main">
                      <span className="card-title">
                        {s.name}
                        {s.honorific}
                      </span>
                      <span className="card-sub">{s.grade}</span>
                    </span>
                    <span className="card-meta">
                      添削 {st?.count ?? 0}件
                      <span className="dim">　最終 {formatDate(st?.last ?? null)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <NewStudentForm />
      </main>
    </>
  );
}
