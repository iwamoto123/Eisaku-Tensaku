/**
 * 生成中の進行状況を、流れてくるJSONの中身から推定する。
 *
 * Structured Outputs はスキーマの順にフィールドを書き出すので、
 * どのキーまで現れたかを見れば「今どこを書いているか」が分かる。
 */

type Stage = {
  key: string;
  label: string;
  percent: number;
};

const STAGES: Stage[] = [
  { key: '"meta"', label: "答案を読み取っています", percent: 8 },
  { key: '"intro"', label: "全体の見立てをまとめています", percent: 13 },
  { key: '"submitted_essay"', label: "答案を書き起こしています", percent: 20 },
  { key: '"good_points"', label: "できている点を整理しています", percent: 28 },
  { key: '"scoring"', label: "4つの観点で評価しています", percent: 35 },
  { key: '"corrections"', label: "直すところを書いています", percent: 42 },
  { key: '"revised_essay"', label: "直しを反映した答案を作っています", percent: 78 },
  { key: '"final_essay"', label: "完成形の答案と日本語訳を作っています", percent: 84 },
  { key: '"instructor_note_section"', label: "追加で伝えたいことを反映しています", percent: 89 },
  { key: '"self_check"', label: "セルフチェック項目を作っています", percent: 93 },
  { key: '"next_steps"', label: "次に取り組むことをまとめています", percent: 96 },
  { key: '"closing"', label: "仕上げています", percent: 98 },
];

/** 「直すところ」は件数が多く時間もかかるので、項目数から細かく進捗を出す */
const CORRECTIONS_START = 42;
const CORRECTIONS_END = 78;
const EXPECTED_CORRECTIONS = 7;

export type Progress = {
  label: string;
  percent: number;
  detail: string;
};

export function deriveProgress(raw: string, elapsedSec: number): Progress {
  const detail = `${elapsedSec}秒経過`;

  if (raw.length === 0) {
    return {
      label: "答案を読み、添削の方針を考えています",
      percent: 4,
      detail: `${detail}／最初の出力まで1分半ほどかかります`,
    };
  }

  let current = STAGES[0];
  for (const stage of STAGES) {
    if (raw.includes(stage.key)) current = stage;
  }

  if (current.key === '"corrections"') {
    const after = raw.slice(raw.indexOf('"corrections"'));
    // 各項目は "label" から始まる
    const written = (after.match(/"label"\s*:/g) ?? []).length;
    const ratio = Math.min(written / EXPECTED_CORRECTIONS, 1);
    return {
      label:
        written > 0
          ? `直すところを書いています（${written}件目）`
          : "直すところを書いています",
      percent: Math.round(CORRECTIONS_START + (CORRECTIONS_END - CORRECTIONS_START) * ratio),
      detail,
    };
  }

  return { label: current.label, percent: current.percent, detail };
}
