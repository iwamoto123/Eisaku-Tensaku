/**
 * 毎日の英訳課題のフィードバック。
 *
 * ライティングの添削資料より短く、A4で1〜2ページに収まる分量にする。
 * 1問ずつ「出題の日本語 → 生徒の答案 → 直すところ → 模範解答 → 覚えたいこと」を並べる。
 *
 * スキーマが大きすぎるとAPIが弾くため、各項目の説明は prompt-translation.ts に書く。
 */

export type TranslationVerdict = "ok" | "minor" | "fix";

export type TranslationItem = {
  number: string;
  japanese: string;
  student_answer: string;
  verdict: TranslationVerdict;
  verdict_note: string;
  fixes: { before: string; after: string; reason: string }[];
  model_answer: string;
  note: string;
};

export type TranslationFeedback = {
  meta: {
    student_name: string;
    honorific: string;
    grade_label: string;
    date_label: string;
    instructor_name: string;
    assignment_label: string;
  };
  intro: string;
  items: TranslationItem[];
  summary: { title: string; items: string[] };
  closing: string;
};

const str = { type: "string" } as const;

export const TRANSLATION_SCHEMA = {
  type: "object",
  properties: {
    meta: {
      type: "object",
      properties: {
        student_name: str,
        honorific: str,
        grade_label: str,
        date_label: str,
        instructor_name: str,
        assignment_label: str,
      },
      required: [
        "student_name",
        "honorific",
        "grade_label",
        "date_label",
        "instructor_name",
        "assignment_label",
      ],
      additionalProperties: false,
    },
    intro: str,
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          number: str,
          japanese: str,
          student_answer: str,
          verdict: { type: "string", enum: ["ok", "minor", "fix"] },
          verdict_note: str,
          fixes: {
            type: "array",
            items: {
              type: "object",
              properties: { before: str, after: str, reason: str },
              required: ["before", "after", "reason"],
              additionalProperties: false,
            },
          },
          model_answer: str,
          note: str,
        },
        required: [
          "number",
          "japanese",
          "student_answer",
          "verdict",
          "verdict_note",
          "fixes",
          "model_answer",
          "note",
        ],
        additionalProperties: false,
      },
    },
    summary: {
      type: "object",
      properties: { title: str, items: { type: "array", items: str } },
      required: ["title", "items"],
      additionalProperties: false,
    },
    closing: str,
  },
  required: ["meta", "intro", "items", "summary", "closing"],
  additionalProperties: false,
} as const;
