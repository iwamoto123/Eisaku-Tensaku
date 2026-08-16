import { notFound, redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import NewCorrectionForm from "@/components/NewCorrectionForm";
import { createClient } from "@/lib/supabase/server";
import type { StudentRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewCorrectionPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const { student: studentId } = await searchParams;
  if (!studentId) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .single();
  if (!student) notFound();

  const { data: profile } = await supabase
    .from("instructors")
    .select("display_name")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const s = student as StudentRow;

  return (
    <>
      <AppHeader
        email={user?.email ?? ""}
        breadcrumb={[
          { label: `${s.name}${s.honorific}`, href: `/students/${s.id}` },
          { label: "新しい添削" },
        ]}
      />
      <NewCorrectionForm student={s} defaultInstructorName={profile?.display_name ?? ""} />
    </>
  );
}
