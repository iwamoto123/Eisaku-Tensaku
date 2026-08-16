import { toCanvas } from "html-to-image";

/**
 * 資料を「ページ」に切って画像化する共通処理。PNG書き出しとPDF書き出しの両方が使う。
 *
 * 前提となる2つの制約:
 *  1. ブラウザのcanvasは1辺16384pxが上限。全体を1枚に描くと自動で縮小され、解像度が落ちる。
 *  2. html-to-image は1回の呼び出しでDOM全体を複製するため、ページ数だけ呼ぶと非常に遅い。
 *
 * そこで「上限に収まる大きさの塊」単位で描画し、その塊からページを切り出す。
 * 13000px の資料なら描画は2回で済み、各ページは等倍で書き出せる。
 */

export const CANVAS_MAX_EDGE = 16000;

/** A4縦の比率（297 / 210）。PDFはこの高さでページを切る。 */
export const A4_RATIO = 297 / 210;

export type PageImage = {
  dataUrl: string;
  /** 画像そのものの画素数 */
  widthPx: number;
  heightPx: number;
  /** 資料上での高さ（CSSピクセル） */
  cssHeight: number;
};

/**
 * 切れ目の候補になる要素。
 * 段落・表・囲み枠の「先頭」で切るので、要素が途中で分断されることはない。
 */
const CUT_SELECTOR = [
  "[data-sec]",
  ".doc h2",
  ".doc h3",
  ".doc > section > p",
  ".doc > section > ul",
  ".doc > section > ol",
  ".doc > section > table",
  ".doc > section > .box",
  ".doc > section > .quote",
].join(",");

/**
 * ページの切れ目を計算する。
 *
 * セクションの先頭だけを候補にすると、1ページに1セクションしか載らず余白だらけになる。
 * そこで段落や表の先頭も候補に入れ、ページをできるだけ埋める。
 * ただし見出しだけがページ末尾に取り残されないよう、見出しの直後で切る場合は
 * 見出しごと次のページへ送る。
 */
export function planPages(node: HTMLElement, maxPageHeight: number): number[] {
  const nodeTop = node.getBoundingClientRect().top;

  const candidates = Array.from(node.querySelectorAll<HTMLElement>(CUT_SELECTOR))
    .map((el) => ({ el, top: el.getBoundingClientRect().top - nodeTop }))
    .filter((c) => c.top > 0)
    .sort((a, b) => a.top - b.top);

  /** 直前が見出しなら、その見出しの先頭まで切れ目を戻す */
  const pullBackOverHeadings = (index: number): number => {
    let el: Element | null = candidates[index].el;
    let top = candidates[index].top;
    for (;;) {
      const prev: Element | null = el?.previousElementSibling ?? null;
      if (!prev || !/^H[23]$/.test(prev.tagName)) return top;
      el = prev;
      top = prev.getBoundingClientRect().top - nodeTop;
    }
  };

  const total = node.scrollHeight;
  const cuts: number[] = [0];
  let start = 0;

  while (total - start > maxPageHeight) {
    let next = -1;
    for (let i = candidates.length - 1; i >= 0; i--) {
      if (candidates[i].top <= start) break;
      if (candidates[i].top - start > maxPageHeight) continue;
      const pulled = pullBackOverHeadings(i);
      if (pulled > start) {
        next = pulled;
        break;
      }
    }
    // 1つの要素だけで maxPageHeight を超える場合は、やむを得ず途中で切る
    if (next <= start) next = start + maxPageHeight;
    cuts.push(next);
    start = next;
  }

  cuts.push(total);
  return cuts;
}

export async function renderSlice(
  node: HTMLElement,
  top: number,
  height: number,
  pixelRatio: number,
): Promise<HTMLCanvasElement> {
  return toCanvas(node, {
    pixelRatio,
    backgroundColor: "#ffffff",
    width: node.offsetWidth,
    height,
    style: {
      transform: `translateY(${-top}px)`,
      transformOrigin: "top left",
    },
  });
}

function crop(source: HTMLCanvasElement, topPx: number, heightPx: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = Math.round(heightPx);
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(
    source,
    0,
    Math.round(topPx),
    source.width,
    Math.round(heightPx),
    0,
    0,
    source.width,
    Math.round(heightPx),
  );
  return out;
}

/**
 * ページごとに画像を作り、1枚できるたびに onPage を呼ぶ。
 * 全ページをメモリに溜めないので、10ページを超える資料でも重くならない。
 */
export async function renderPages(
  node: HTMLElement,
  opts: {
    maxPageHeight: number;
    pixelRatio: number;
    mimeType?: "image/png" | "image/jpeg";
    quality?: number;
  },
  onPage: (page: PageImage, index: number, total: number) => void | Promise<void>,
): Promise<number> {
  const { maxPageHeight, pixelRatio } = opts;
  const mimeType = opts.mimeType ?? "image/png";
  const quality = opts.quality ?? 0.92;

  const cuts = planPages(node, maxPageHeight);
  const pageCount = cuts.length - 1;
  const chunkMax = CANVAS_MAX_EDGE / pixelRatio;

  let pageIndex = 0;
  while (pageIndex < pageCount) {
    // 上限に収まる範囲で、できるだけ多くのページを1回の描画にまとめる
    const chunkTop = cuts[pageIndex];
    let lastPage = pageIndex;
    while (lastPage + 1 < pageCount && cuts[lastPage + 2] - chunkTop <= chunkMax) {
      lastPage++;
    }
    const chunkHeight = cuts[lastPage + 1] - chunkTop;
    const chunk = await renderSlice(node, chunkTop, chunkHeight, pixelRatio);
    const scale = chunk.height / chunkHeight;

    for (let i = pageIndex; i <= lastPage; i++) {
      const cssHeight = cuts[i + 1] - cuts[i];
      const page = crop(chunk, (cuts[i] - chunkTop) * scale, cssHeight * scale);
      await onPage(
        {
          dataUrl: page.toDataURL(mimeType, quality),
          widthPx: page.width,
          heightPx: page.height,
          cssHeight,
        },
        i,
        pageCount,
      );
    }

    pageIndex = lastPage + 1;
  }

  return pageCount;
}
