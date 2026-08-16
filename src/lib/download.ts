import jsPDF from "jspdf";
import {
  A4_RATIO,
  CANVAS_MAX_EDGE,
  renderPages,
  renderSlice,
} from "@/lib/render-pages";

export type DownloadFormat = "pdf" | "png-split" | "png-single";

export type DownloadResult = {
  pages: number;
  /** 1枚PNGで解像度を落とした場合のみ 2 未満になる */
  pixelRatio: number;
  /** PDFのみ。生成されたファイルのバイト数 */
  bytes?: number;
};

export type DownloadOptions = {
  fileBase: string;
  format: DownloadFormat;
  pixelRatio?: number;
  /** PNG分割時の1ページの高さ（CSSピクセル） */
  maxPageHeight?: number;
  onProgress?: (done: number, total: number) => void;
  /** 動作確認用。書き出し処理は通すが、ファイルの保存だけ行わない */
  dryRun?: boolean;
};

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/** ブラウザが連続ダウンロードを弾かないよう少し間を空ける */
const pause = () => new Promise((r) => setTimeout(r, 400));

export async function downloadDocument(
  node: HTMLElement,
  opts: DownloadOptions,
): Promise<DownloadResult> {
  const pixelRatio = opts.pixelRatio ?? 2;

  if (opts.format === "pdf") {
    // A4縦。資料の横幅を210mmに合わせ、ページの高さもA4比率で切る
    const pageHeight = Math.floor(node.offsetWidth * A4_RATIO);
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    let first = true;

    const pages = await renderPages(
      node,
      { maxPageHeight: pageHeight, pixelRatio, mimeType: "image/jpeg", quality: 0.92 },
      (page, index, total) => {
        if (!first) pdf.addPage();
        first = false;
        const heightMm = (page.heightPx / page.widthPx) * 210;
        pdf.addImage(page.dataUrl, "JPEG", 0, 0, 210, Math.min(heightMm, 297));
        opts.onProgress?.(index + 1, total);
      },
    );

    if (!opts.dryRun) pdf.save(`${opts.fileBase}.pdf`);
    return { pages, pixelRatio, bytes: pdf.output("blob").size };
  }

  if (opts.format === "png-single") {
    // 1枚にまとめる場合は、canvasの上限に収まるよう倍率を落とす
    const total = node.scrollHeight;
    const ratio = Math.min(pixelRatio, CANVAS_MAX_EDGE / Math.max(total, 1));
    opts.onProgress?.(0, 1);
    const canvas = await renderSlice(node, 0, total, ratio);
    if (!opts.dryRun) downloadDataUrl(canvas.toDataURL("image/png"), `${opts.fileBase}.png`);
    opts.onProgress?.(1, 1);
    return { pages: 1, pixelRatio: ratio };
  }

  const maxPageHeight = opts.maxPageHeight ?? 1600;
  const pages = await renderPages(
    node,
    { maxPageHeight, pixelRatio, mimeType: "image/png" },
    async (page, index, total) => {
      const name =
        total === 1
          ? `${opts.fileBase}.png`
          : `${opts.fileBase}_${String(index + 1).padStart(2, "0")}.png`;
      if (!opts.dryRun) downloadDataUrl(page.dataUrl, name);
      opts.onProgress?.(index + 1, total);
      if (!opts.dryRun) await pause();
    },
  );

  return { pages, pixelRatio };
}
