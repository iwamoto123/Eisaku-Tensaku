/**
 * 生成中の進行状況を、流れてくるJSONの中身から推定する。
 *
 * Structured Outputs はスキーマの順にフィールドを書き出すので、
 * どのキーまで現れたかを見れば「今どこを書いているか」が分かる。
 * あわせて、書き終わった項目の見出しを取り出して画面に出す。
 * 4分ほど待つことになるため、何が起きているかが見えるようにしている。
 */

export type StepState = "done" | "active" | "todo";

export type Step = {
  key: string;
  label: string;
  state: StepState;
  /** その工程で書き終わったものの一覧（直すところの見出しなど） */
  items: string[];
};

export type Progress = {
  label: string;
  percent: number;
  detail: string;
  steps: Step[];
};

type StageDef = { key: string; jsonKey: string; label: string; percent: number };

const STAGES: StageDef[] = [
  { key: "read", jsonKey: '"submitted_essay"', label: "答案を読み取る", percent: 18 },
  { key: "good", jsonKey: '"good_points"', label: "できている点を整理する", percent: 27 },
  { key: "score", jsonKey: '"scoring"', label: "4つの観点で評価する", percent: 34 },
  { key: "fix", jsonKey: '"corrections"', label: "直すところを書く", percent: 42 },
  { key: "revised", jsonKey: '"revised_essay"', label: "直しを反映した答案を作る", percent: 78 },
  { key: "final", jsonKey: '"final_essay"', label: "完成形と日本語訳を作る", percent: 85 },
  { key: "check", jsonKey: '"self_check"', label: "セルフチェック項目を作る", percent: 92 },
  { key: "next", jsonKey: '"next_steps"', label: "次に取り組むことをまとめる", percent: 96 },
];

const CORRECTIONS_START = 42;
const CORRECTIONS_END = 78;
const EXPECTED_CORRECTIONS = 7;

/** 途中まで届いたJSONから、閉じ引用符まで揃っている文字列だけを取り出す */
function completeStrings(source: string, key: string): string[] {
  const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "g");
  const out: string[] = [];
  for (const m of source.matchAll(re)) {
    const value = m[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim();
    if (value) out.push(value);
  }
  return out;
}

function sectionAfter(raw: string, jsonKey: string): string {
  const at = raw.indexOf(jsonKey);
  return at < 0 ? "" : raw.slice(at);
}

function sectionBetween(raw: string, from: string, to: string): string {
  const start = raw.indexOf(from);
  if (start < 0) return "";
  const end = raw.indexOf(to, start);
  return raw.slice(start, end < 0 ? undefined : end);
}

export function deriveProgress(raw: string, elapsedSec: number): Progress {
  const elapsed = `${elapsedSec}秒経過`;

  // どこまで書けたか
  let reachedIndex = -1;
  for (let i = 0; i < STAGES.length; i++) {
    if (raw.includes(STAGES[i].jsonKey)) reachedIndex = i;
  }

  // 各工程で書き終わったものを拾う
  const wordCount = completeStrings(sectionAfter(raw, '"submitted_essay"'), "word_count")[0];
  const goodPoints = completeStrings(
    sectionBetween(raw, '"good_points"', '"scoring"'),
    "lead",
  );
  const criteria = completeStrings(sectionBetween(raw, '"scoring"', '"corrections"'), "criterion");
  const fixes = completeStrings(sectionAfter(raw, '"corrections"'), "label");

  const itemsFor: Record<string, string[]> = {
    read: wordCount ? [wordCount] : [],
    good: goodPoints,
    score: criteria.length > 0 ? [criteria.join("・")] : [],
    fix: fixes,
    revised: [],
    final: [],
    check: [],
    next: [],
  };

  const steps: Step[] = STAGES.map((stage, i) => ({
    key: stage.key,
    label: stage.label,
    state: i < reachedIndex ? "done" : i === reachedIndex ? "active" : "todo",
    items: itemsFor[stage.key] ?? [],
  }));

  if (raw.length === 0) {
    return {
      label: "答案を読み、添削の方針を考えています",
      percent: 4,
      detail: `${elapsed}／最初の出力まで1分半ほどかかります`,
      steps,
    };
  }

  if (reachedIndex < 0) {
    return { label: "資料の作成を始めています", percent: 8, detail: elapsed, steps };
  }

  const stage = STAGES[reachedIndex];

  if (stage.key === "fix") {
    const ratio = Math.min(fixes.length / EXPECTED_CORRECTIONS, 1);
    return {
      label:
        fixes.length > 0
          ? `直すところを書いています（${fixes.length}件目）`
          : "直すところを書いています",
      percent: Math.round(CORRECTIONS_START + (CORRECTIONS_END - CORRECTIONS_START) * ratio),
      detail: elapsed,
      steps,
    };
  }

  return {
    label: `${stage.label.replace(/る$/, "っています")}`,
    percent: stage.percent,
    detail: elapsed,
    steps,
  };
}
