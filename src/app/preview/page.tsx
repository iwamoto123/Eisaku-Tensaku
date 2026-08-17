"use client";

/**
 * デザイン確認用のページ。
 * public/sample-output.json（過去の生成結果）を読み込んで資料だけを表示する。
 * APIを叩かずに見た目とPNG書き出しを確認したいときに使う。
 *
 * ?autotest=1 を付けると、PNG生成が動くかだけを自動で確認して結果を表示する。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toCanvas } from "html-to-image";
import FeedbackDoc from "@/components/FeedbackDoc";
import { downloadDocument, type DownloadFormat } from "@/lib/download";
import { planPages } from "@/lib/render-pages";
import type { Feedback } from "@/lib/schema";

export default function Preview() {
  const [data, setData] = useState<Feedback | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [slice, setSlice] = useState("");
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/sample-output.json")
      .then((r) => {
        if (!r.ok) throw new Error("public/sample-output.json がありません。");
        return r.json();
      })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  const autotest = useCallback(async () => {
    if (!docRef.current) return;
    setBusy(true);
    try {
      const node = docRef.current;
      const started = Date.now();
      // PDFと同じ高さでページを切り、各ページの埋まり具合を測る
      const pdfPageHeight = Math.floor(node.offsetWidth * (277 / 190));
      const pdfCuts = planPages(node, pdfPageHeight);
      const fills = [];
      for (let i = 0; i < pdfCuts.length - 1; i++) {
        fills.push(Math.round(((pdfCuts[i + 1] - pdfCuts[i]) / pdfPageHeight) * 100));
      }
      const worst = Math.min(...fills);
      const avg = Math.round(fills.reduce((a, b) => a + b, 0) / fills.length);

      const cuts = planPages(node, 1600);
      const pdf = await downloadDocument(node, {
        fileBase: "autotest",
        format: "pdf",
        dryRun: true,
      });
      // 実際の書き出しと同じ経路で、資料の途中のページを1枚だけ描いて確かめる
      const i = Math.floor((cuts.length - 1) / 2);
      const canvas = await toCanvas(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        width: node.offsetWidth,
        height: cuts[i + 1] - cuts[i],
        style: {
          transform: `translateY(${-cuts[i]}px)`,
          transformOrigin: "top left",
        },
      });
      setSlice(canvas.toDataURL("image/png"));
      if (new URLSearchParams(window.location.search).get("pdf") === "1" && pdf.dataUri) {
        const el = document.createElement("textarea");
        el.id = "pdfout";
        el.textContent = pdf.dataUri;
        el.style.display = "none";
        document.body.appendChild(el);
      }
      setMessage(
        `AUTOTEST OK docH=${node.scrollHeight} pngPages=${cuts.length - 1} ` +
          `png${i + 1}=${canvas.width}x${canvas.height} ` +
          `pdfPages=${pdf.pages} pdfKB=${Math.round((pdf.bytes ?? 0) / 1024)} ` +
          `fill平均=${avg}% 最小=${worst}% 各ページ=[${fills.join(",")}] ` +
          `ms=${Date.now() - started}`,
      );
    } catch (e) {
      setMessage(`AUTOTEST FAILED ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!data) return;
    if (new URLSearchParams(window.location.search).get("autotest") === "1") {
      void autotest();
    }
  }, [data, autotest]);

  async function handleExport(format: DownloadFormat) {
    if (!docRef.current) return;
    setBusy(true);
    try {
      const { pages } = await downloadDocument(docRef.current, {
        fileBase: "preview",
        format,
        onProgress: (done, total) => setMessage(`書き出し中… ${done}/${total}`),
      });
      setMessage(`${pages}ページ書き出しました。`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "書き出しに失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  if (error)
    return (
      <div className="stage">
        <div className="empty">{error}</div>
      </div>
    );
  if (!data)
    return (
      <div className="stage">
        <div className="empty">読み込み中…</div>
      </div>
    );

  return (
    <div className="stage">
      <div className="toolbar">
        <button className="ghost strong" onClick={() => handleExport("pdf")} disabled={busy}>
          PDFで保存
        </button>
        <button className="ghost" onClick={() => handleExport("png-split")} disabled={busy}>
          PNGで保存（ページ分割）
        </button>
        <button className="ghost" onClick={() => handleExport("png-single")} disabled={busy}>
          PNGで保存（1枚）
        </button>
        <span className="spacer" />
        {message && <span className="note">{message}</span>}
      </div>
      {slice && (
        <div style={{ marginBottom: 24 }}>
          <p className="note">↓ 書き出しの確認用に、途中の1ページを実際にPNG化したもの</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slice} alt="page preview" style={{ width: 800, border: "1px solid #d1d5db" }} />
        </div>
      )}
      <div className="doc-frame" ref={docRef}>
        <FeedbackDoc data={data} />
      </div>
    </div>
  );
}
