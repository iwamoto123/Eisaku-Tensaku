/**
 * モデル出力のインラインHTMLを、許可したタグ・クラスだけに絞る。
 * 資料に差し込む前に必ず通す。
 *
 * 方針: 文字列をタグ単位に切り分け、許可タグはそのまま通し、
 * それ以外はタグを落として中身のテキストだけ残す。テキストは必ずエスケープする。
 */

const ALLOWED_SPAN_CLASSES = new Set([
  "en",
  "ng",
  "ok",
  "lead",
  "arrow",
  "strike",
  "mark",
  "indent",
  "ja",
]);

const ALLOWED_SIMPLE_TAGS = new Set(["strong", "em", "b", "i", "u"]);

const TAG_RE = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
const CLASS_RE = /class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function sanitizeInline(input: string): string {
  if (!input) return "";

  let out = "";
  let lastIndex = 0;
  // 閉じタグの数を合わせるため、開いた許可タグを記録する
  const openStack: string[] = [];

  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TAG_RE.exec(input)) !== null) {
    const [full, slash, rawName, attrs] = match;
    out += escapeText(input.slice(lastIndex, match.index));
    lastIndex = match.index + full.length;

    const name = rawName.toLowerCase();
    const isClosing = slash === "/";

    if (name === "br") {
      out += "<br>";
      continue;
    }

    if (ALLOWED_SIMPLE_TAGS.has(name)) {
      if (isClosing) {
        if (openStack[openStack.length - 1] === name) {
          openStack.pop();
          out += `</${name}>`;
        }
      } else {
        openStack.push(name);
        out += `<${name}>`;
      }
      continue;
    }

    if (name === "span") {
      if (isClosing) {
        if (openStack[openStack.length - 1] === "span") {
          openStack.pop();
          out += "</span>";
        }
      } else {
        const classMatch = CLASS_RE.exec(attrs ?? "");
        const rawClasses = classMatch
          ? (classMatch[1] ?? classMatch[2] ?? classMatch[3] ?? "")
          : "";
        const classes = rawClasses
          .split(/\s+/)
          .filter((c) => ALLOWED_SPAN_CLASSES.has(c.toLowerCase()));
        openStack.push("span");
        out += classes.length ? `<span class="${classes.join(" ")}">` : "<span>";
      }
      continue;
    }

    // 許可していないタグはタグごと落とす（中身のテキストは残る）
  }

  out += escapeText(input.slice(lastIndex));

  // 閉じ忘れがあれば補う
  while (openStack.length > 0) {
    out += `</${openStack.pop()}>`;
  }

  return out;
}
