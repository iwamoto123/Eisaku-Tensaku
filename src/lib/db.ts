import type { Feedback } from "@/lib/schema";
import type { TranslationFeedback } from "@/lib/schema-translation";

/** 添削の種類。writing=ライティング答案、translation=毎日の英訳課題 */
export type CorrectionKind = "writing" | "translation";

export const KIND_LABEL: Record<CorrectionKind, string> = {
  writing: "ライティング",
  translation: "英訳課題",
};

/** corrections テーブルの行 */
export type CorrectionRow = {
  id: string;
  student_id: string;
  instructor_id: string | null;
  kind: CorrectionKind;
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
  data: Feedback | TranslationFeedback | null;
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
  | "id"
  | "target_date"
  | "topic"
  | "status"
  | "kind"
  | "fix_count"
  | "is_edited"
  | "image_paths"
>;

export const CORRECTION_LIST_COLUMNS =
  "id, student_id, target_date, topic, status, kind, fix_count, is_edited, image_paths";

export type StudentWithCount = StudentRow & {
  correction_count: number;
  last_correction_at: string | null;
};

/** 書き出すファイル名。日本語ファイル名はリンクが開けないので英数字にする。 */
export function fileBaseFor(
  student: { slug: string; name: string },
  targetDate: string,
  kind: CorrectionKind = "writing",
): string {
  const slug = student.slug.trim() || "student";
  const suffix = kind === "translation" ? "translation-feedback" : "writing-feedback";
  return `${targetDate}_${slug}_${suffix}`;
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
