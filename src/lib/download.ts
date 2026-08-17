import jsPDF from "jspdf";
import { CANVAS_MAX_EDGE, renderPages, renderSlice } from "@/lib/render-pages";

/* ============ PDFの体裁 ============
   ここの数値を変えると、書き出したPDFの余白とページの詰まり方が変わる。 */

/** A4のサイズ（mm） */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/**
 * 紙の端から本文までの余白（mm）。
 * 0にすると紙いっぱいに印刷する形になるが、家庭用プリンタは端まで印刷できないため
 * 文字が切れる。10mmあれば、たいていのプリンタでそのまま印刷できる。
 */
const PDF_MARGIN_MM = 10;

/** ページ番号を入れるか */
const PDF_PAGE_NUMBERS = true;

const CONTENT_WIDTH_MM = A4_WIDTH_MM - PDF_MARGIN_MM * 2;
const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - PDF_MARGIN_MM * 2;

export type DownloadFormat = "pdf" | "png-split" | "png-single";

export type DownloadResult = {
  pages: number;
  /** 1枚PNGで解像度を落とした場合のみ 2 未満になる */
  pixelRatio: number;
  /** PDFのみ。生成されたファイルのバイト数 */
  bytes?: number;
  /** 動作確認用。dryRunのときだけ入る */
  dataUri?: string;
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
    // 余白のぶんだけ本文が入る領域は狭くなる。ページを切る高さもその比率に合わせる
    const pageHeight = Math.floor(node.offsetWidth * (CONTENT_HEIGHT_MM / CONTENT_WIDTH_MM));
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    let first = true;

    const pages = await renderPages(
      node,
      { maxPageHeight: pageHeight, pixelRatio, mimeType: "image/jpeg", quality: 0.92 },
      (page, index, total) => {
        if (!first) pdf.addPage();
        first = false;
        const heightMm = (page.heightPx / page.widthPx) * CONTENT_WIDTH_MM;
        pdf.addImage(
          page.dataUrl,
          "JPEG",
          PDF_MARGIN_MM,
          PDF_MARGIN_MM,
          CONTENT_WIDTH_MM,
          Math.min(heightMm, CONTENT_HEIGHT_MM),
        );
        opts.onProgress?.(index + 1, total);
      },
    );

    if (PDF_PAGE_NUMBERS && pages > 1) {
      // 日本語の書体を持たないので、番号は英数字だけで入れる
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      for (let i = 1; i <= pages; i++) {
        pdf.setPage(i);
        pdf.text(`${i} / ${pages}`, A4_WIDTH_MM / 2, A4_HEIGHT_MM - 4.5, { align: "center" });
      }
    }

    if (!opts.dryRun) pdf.save(`${opts.fileBase}.pdf`);
    return {
      pages,
      pixelRatio,
      bytes: pdf.output("blob").size,
      dataUri: opts.dryRun ? pdf.output("datauristring") : undefined,
    };
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
