import type { Feedback } from "@/lib/schema";

/** corrections テーブルの行 */
export type CorrectionRow = {
  id: string;
  student_id: string;
  instructor_id: string | null;
  instructor_name: string;
  grade: string;
  date_label: string;
  target_date: string;
  topic: string;
  english_points: string;
  instructor_notes: string;
  image_paths: string[];
  status: "generating" | "done" | "error";
  error_message: string;
  data: Feedback | null;
  edited_html: string | null;
  fix_count: number;
  is_edited: boolean;
  model: string;
  input_tokens: number;
  output_tokens: number;
  elapsed_seconds: number;
  created_at: string;
  updated_at: string;
};

/** students テーブルの行 */
export type StudentRow = {
  id: string;
  name: string;
  honorific: string;
  slug: string;
  grade: string;
  note: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** 一覧に必要な最小限の列。添削データ本体は重いので読まない */
export type CorrectionSummary = Pick<
  CorrectionRow,
  "id" | "target_date" | "topic" | "status" | "fix_count" | "is_edited" | "image_paths"
>;

export const CORRECTION_LIST_COLUMNS =
  "id, student_id, target_date, topic, status, fix_count, is_edited, image_paths";

export type StudentWithCount = StudentRow & {
  correction_count: number;
  last_correction_at: string | null;
};

/** 書き出すファイル名。日本語ファイル名はリンクが開けないので英数字にする。 */
export function fileBaseFor(student: { slug: string; name: string }, targetDate: string): string {
  const slug = student.slug.trim() || "student";
  return `${targetDate}_${slug}_writing-feedback`;
}

export function toJaDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(y)}年${Number(m)}月${Number(d)}日`;
}

export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
