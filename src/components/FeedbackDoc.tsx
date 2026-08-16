"use client";

import { sanitizeInline } from "@/lib/sanitize";
import type { Block, Feedback } from "@/lib/schema";

function Html({ html, as = "p", className }: { html: string; as?: "p" | "div" | "span" | "td" | "th" | "li"; className?: string }) {
  const Tag = as as "p";
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: sanitizeInline(html) }} />;
}

function BlockView({ block }: { block: Block }) {
  const heading = block.heading?.trim() ? <h3>{block.heading}</h3> : null;

  switch (block.type) {
    case "note":
    case "note_blue":
      return (
        <>
          {heading}
          <div className={block.type === "note_blue" ? "box blue" : "box"}>
            <Html html={block.text} />
          </div>
        </>
      );
    case "list":
      return (
        <>
          {heading}
          <ul>
            {block.items.map((item, i) => (
              <Html key={i} as="li" html={item} />
            ))}
          </ul>
        </>
      );
    case "ordered_list":
      return (
        <>
          {heading}
          <ol>
            {block.items.map((item, i) => (
              <Html key={i} as="li" html={item} />
            ))}
          </ol>
        </>
      );
    case "table":
      return (
        <>
          {heading}
          <table>
            {block.table_headers.length > 0 && (
              <thead>
                <tr>
                  {block.table_headers.map((h, i) => (
                    <Html key={i} as="th" html={h} />
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.table_rows.map((row, i) => (
                <tr key={i}>
                  {row.cells.map((cell, j) => (
                    <Html key={j} as="td" html={cell} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    default:
      return (
        <>
          {heading}
          <Html html={block.text} />
        </>
      );
  }
}

/**
 * data-sec を付けた直下の子要素が、PNG分割時の切れ目の候補になる。
 */
export default function FeedbackDoc({ data }: { data: Feedback }) {
  const { meta } = data;

  return (
    <div className="doc">
      <div className="hero" data-sec>
        <p className="eyebrow">白谷塾オンライン教室　{meta.grade_label}</p>
        <h1>ライティング答案 添削フィードバック</h1>
        <p className="metaline">
          {meta.student_name}
          {meta.honorific}／{meta.date_label}
          {meta.instructor_name ? `／担当：${meta.instructor_name} 先生` : ""}
          {meta.topic ? <><br />問題：{meta.topic}</> : null}
        </p>
      </div>

      <div data-sec>
        <Html html={data.intro} />
      </div>

      <section data-sec>
        <h2>今回の答案（提出したもの）</h2>
        {(data.submitted_essay.note || data.submitted_essay.word_count) && (
          <Html
            className="caption"
            html={
              data.submitted_essay.note +
              (data.submitted_essay.word_count ? `　${data.submitted_essay.word_count}。` : "")
            }
          />
        )}
        <Html as="div" className="quote" html={data.submitted_essay.html} />
      </section>

      {data.good_points.length > 0 && (
        <section data-sec>
          <h2>まず、できていること</h2>
          <p>直すところの前に、すでに身についている部分を確認しておきます。ここは本番でもそのまま使ってください。</p>
          <ul>
            {data.good_points.map((g, i) => (
              <li key={i}>
                <span className="lead">{g.lead}</span>{" "}
                <span dangerouslySetInnerHTML={{ __html: sanitizeInline(g.detail) }} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.scoring.length > 0 && (
        <section data-sec>
          <h2>{meta.grade_label}ライティングの採点は4つの観点</h2>
          <p>どこを直すと点が上がるのかをはっきりさせるために、採点のしくみを先に確認します。</p>
          <table>
            <thead>
              <tr>
                <th style={{ width: "18%" }}>観点</th>
                <th style={{ width: "44%" }}>見られていること</th>
                <th>今回</th>
              </tr>
            </thead>
            <tbody>
              {data.scoring.map((s, i) => (
                <tr key={i}>
                  <td>{s.criterion}</td>
                  <Html as="td" html={s.checked} />
                  <td>
                    <span
                      className={s.status === "ok" ? "ok" : "ng"}
                      dangerouslySetInnerHTML={{ __html: sanitizeInline(s.assessment) }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {data.corrections.map((c, i) => (
        <section key={i} data-sec>
          <h2>{c.label}</h2>
          {(c.before || c.after) && (
            <div className="box">
              <p>
                <span className="ng" dangerouslySetInnerHTML={{ __html: sanitizeInline(c.before) }} />{" "}
                <span className="arrow">→</span>{" "}
                <span className="lead" dangerouslySetInnerHTML={{ __html: sanitizeInline(c.after) }} />
              </p>
            </div>
          )}
          {c.blocks.map((b, j) => (
            <BlockView key={j} block={b} />
          ))}
        </section>
      ))}

      {data.revised_essay.html && (
        <section data-sec>
          <h2>英文の直しを反映した答案</h2>
          {data.revised_essay.note && <Html html={data.revised_essay.note} />}
          <Html as="div" className="quote model" html={data.revised_essay.html} />
        </section>
      )}

      {data.final_essay.html && (
        <section data-sec>
          <h2>完成形の答案</h2>
          {data.final_essay.note && <Html html={data.final_essay.note} />}
          <div className="quote model">
            <span dangerouslySetInnerHTML={{ __html: sanitizeInline(data.final_essay.html) }} />
            {data.final_essay.translation && (
              <span
                className="ja"
                dangerouslySetInnerHTML={{ __html: sanitizeInline(data.final_essay.translation) }}
              />
            )}
          </div>
        </section>
      )}

      {data.instructor_note_section.title && (
        <section data-sec>
          <h2>{data.instructor_note_section.title}</h2>
          {data.instructor_note_section.blocks.map((b, j) => (
            <BlockView key={j} block={b} />
          ))}
        </section>
      )}

      {data.self_check.length > 0 && (
        <section data-sec>
          <h2>本番でのセルフチェック（書き終わったら1分）</h2>
          <p>今回のミスは、次の確認でほぼ防げます。書き終えたあとに、この順で見直してください。</p>
          <div className="box">
            <ol>
              {data.self_check.map((s, i) => (
                <Html key={i} as="li" html={s} />
              ))}
            </ol>
          </div>
        </section>
      )}

      {data.next_steps.title && (
        <section data-sec>
          <h2>{data.next_steps.title}</h2>
          {data.next_steps.blocks.map((b, j) => (
            <BlockView key={j} block={b} />
          ))}
        </section>
      )}

      {data.closing && (
        <div data-sec>
          <Html html={data.closing} />
        </div>
      )}

      <div className="footer" data-sec>
        白谷塾オンライン教室　{meta.grade_label} ライティング添削フィードバック／{meta.student_name}
        {meta.honorific}／{meta.date_label}
        {meta.instructor_name ? `／担当：${meta.instructor_name}` : ""}
      </div>
    </div>
  );
}
