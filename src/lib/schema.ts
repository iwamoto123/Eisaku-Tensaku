/**
 * 添削フィードバック資料のデータ構造。
 * Claude の Structured Outputs (output_config.format) にそのまま渡す JSON Schema と、
 * 対応する TypeScript の型を定義する。
 *
 * Structured Outputs の制約:
 *  - すべての object に additionalProperties: false と required が必要
 *  - 再帰スキーマは不可
 *  - スキーマ全体が大きすぎると "compiled grammar is too large" で 400 になる
 *
 * このため各フィールドの書き方の指示はここには書かず、prompt.ts の
 * SYSTEM_PROMPT 側にまとめている。ここは構造だけを定義する。
 * 「任意項目」は空文字・空配列で表現する。
 */

export type BlockType =
  | "text"
  | "note"
  | "note_blue"
  | "list"
  | "ordered_list"
  | "table";

export type Block = {
  type: BlockType;
  heading: string;
  text: string;
  items: string[];
  table_headers: string[];
  table_rows: { cells: string[] }[];
};

export type Correction = {
  label: string;
  before: string;
  after: string;
  blocks: Block[];
};

export type Feedback = {
  meta: {
    student_name: string;
    honorific: string;
    grade_label: string;
    date_label: string;
    instructor_name: string;
    topic: string;
  };
  intro: string;
  submitted_essay: {
    html: string;
    word_count: string;
    note: string;
  };
  good_points: { lead: string; detail: string }[];
  scoring: {
    criterion: string;
    checked: string;
    assessment: string;
    status: "ok" | "ng";
  }[];
  corrections: Correction[];
  revised_essay: { html: string; note: string };
  final_essay: { html: string; translation: string; note: string };
  instructor_note_section: { title: string; blocks: Block[] };
  self_check: string[];
  next_steps: { title: string; blocks: Block[] };
  closing: string;
};

const str = { type: "string" } as const;
const strArray = { type: "array", items: { type: "string" } } as const;
const blockArray = { type: "array", items: { $ref: "#/$defs/block" } } as const;

export const FEEDBACK_SCHEMA = {
  type: "object",
  $defs: {
    block: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["text", "note", "note_blue", "list", "ordered_list", "table"],
        },
        heading: str,
        text: str,
        items: strArray,
        table_headers: strArray,
        table_rows: {
          type: "array",
          items: {
            type: "object",
            properties: { cells: strArray },
            required: ["cells"],
            additionalProperties: false,
          },
        },
      },
      required: ["type", "heading", "text", "items", "table_headers", "table_rows"],
      additionalProperties: false,
    },
  },
  properties: {
    meta: {
      type: "object",
      properties: {
        student_name: str,
        honorific: str,
        grade_label: str,
        date_label: str,
        instructor_name: str,
        topic: str,
      },
      required: [
        "student_name",
        "honorific",
        "grade_label",
        "date_label",
        "instructor_name",
        "topic",
      ],
      additionalProperties: false,
    },
    intro: str,
    submitted_essay: {
      type: "object",
      properties: { html: str, word_count: str, note: str },
      required: ["html", "word_count", "note"],
      additionalProperties: false,
    },
    good_points: {
      type: "array",
      items: {
        type: "object",
        properties: { lead: str, detail: str },
        required: ["lead", "detail"],
        additionalProperties: false,
      },
    },
    scoring: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterion: str,
          checked: str,
          assessment: str,
          status: { type: "string", enum: ["ok", "ng"] },
        },
        required: ["criterion", "checked", "assessment", "status"],
        additionalProperties: false,
      },
    },
    corrections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: str,
          before: str,
          after: str,
          blocks: blockArray,
        },
        required: ["label", "before", "after", "blocks"],
        additionalProperties: false,
      },
    },
    revised_essay: {
      type: "object",
      properties: { html: str, note: str },
      required: ["html", "note"],
      additionalProperties: false,
    },
    final_essay: {
      type: "object",
      properties: { html: str, translation: str, note: str },
      required: ["html", "translation", "note"],
      additionalProperties: false,
    },
    instructor_note_section: {
      type: "object",
      properties: { title: str, blocks: blockArray },
      required: ["title", "blocks"],
      additionalProperties: false,
    },
    self_check: strArray,
    next_steps: {
      type: "object",
      properties: { title: str, blocks: blockArray },
      required: ["title", "blocks"],
      additionalProperties: false,
    },
    closing: str,
  },
  required: [
    "meta",
    "intro",
    "submitted_essay",
    "good_points",
    "scoring",
    "corrections",
    "revised_essay",
    "final_essay",
    "instructor_note_section",
    "self_check",
    "next_steps",
    "closing",
  ],
  additionalProperties: false,
} as const;
