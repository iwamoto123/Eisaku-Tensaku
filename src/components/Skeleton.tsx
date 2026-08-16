/**
 * 画面の切り替え中に出す仮の枠。
 *
 * サーバーから中身が届くまで数百ミリ秒かかるため、
 * 何も出ないと固まったように見える。先に形だけ出して待ち時間を短く感じさせる。
 */
export default function Skeleton({ kind }: { kind: "list" | "student" | "form" | "doc" }) {
  if (kind === "doc") {
    return (
      <main className="stage">
        <div className="toolbar">
          <span className="sk sk-btn" />
          <span className="sk sk-btn" />
          <span className="sk sk-btn" />
        </div>
        <div className="doc-frame sk-doc">
          <div className="sk sk-hero" />
          <div className="sk-doc-body">
            <span className="sk sk-line w80" />
            <span className="sk sk-line w95" />
            <span className="sk sk-line w60" />
            <span className="sk sk-block" />
            <span className="sk sk-line w90" />
            <span className="sk sk-line w70" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={kind === "form" ? "page narrow" : "page"}>
      <div className="page-head">
        <span className="sk sk-title" />
        <span className="sk sk-line w40" />
      </div>

      {kind === "student" && <span className="sk sk-cta" />}

      {kind === "form" ? (
        <>
          <span className="sk sk-block tall" />
          <span className="sk sk-line w30" />
          <span className="sk sk-input" />
          <span className="sk sk-line w30" />
          <span className="sk sk-input" />
          <span className="sk sk-block" />
        </>
      ) : (
        <div className="sk-cards">
          <span className="sk sk-card" />
          <span className="sk sk-card" />
          <span className="sk sk-card" />
        </div>
      )}
    </main>
  );
}
