import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Claude API の利用量を JSONL に追記する。works/api-cost-notifier が月次で集計する。
 * Python側の api-cost-notifier/src/usage_log.py と同じ形式で書く。
 *
 * 記録に失敗しても添削の生成は止めない。
 */

const PROJECT = "writing-tensaku";

function logDir(): string {
  const override = process.env.API_USAGE_LOG_DIR;
  if (override) return override;
  // works/writing-tensaku で起動する前提。works/api-cost-notifier/data を指す
  return path.resolve(process.cwd(), "..", "api-cost-notifier", "data");
}

export async function recordUsage(
  model: string,
  usage: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  } | null,
): Promise<void> {
  if (!usage) return;
  try {
    const now = new Date();
    const dir = logDir();
    await mkdir(dir, { recursive: true });

    const row = {
      ts: now.toISOString().replace(/\.\d{3}Z$/, "+00:00"),
      project: PROJECT,
      model,
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
    };

    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    await appendFile(path.join(dir, `usage-${month}.jsonl`), `${JSON.stringify(row)}\n`, "utf-8");
  } catch {
    // 記録の失敗は無視する
  }
}
