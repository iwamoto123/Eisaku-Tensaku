"use client";

import { sanitizeInline } from "@/lib/sanitize";
import type { TranslationFeedback, TranslationVerdict } from "@/lib/schema-translation";

const VERDICT_LABEL: Record<TranslationVerdict, string> = {
  ok: "正解",
  minor: "おしい",
  fix: "直しあり",
};

function Html({
  html,
  as = "p",
  className,
}: {
  html: string;
  as?: "p" | "div" | "span" | "li";
  className?: string;
}) {
  const Tag = as as "p";
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: sanitizeInline(html) }} />;
}

/**
 * 毎日の英訳課題のフィードバック。
 * 配布物なので、ライティングの添削資料と同じ配色・書体で揃えている。
 */
export default function TranslationDoc({ data }: { data: TranslationFeedback }) {
  const { meta } = data;

  return (
    <div className="doc">
      <div className="hero" data-sec>
        <p className="eyebrow">
          白谷塾オンライン教室　{meta.grade_label}
          {meta.assignment_label ? `　${meta.assignment_label}` : ""}
        </p>
        <h1>英訳課題 フィードバック</h1>
        <p className="metaline">
          {meta.student_name}
          {meta.honorific}／{meta.date_label}
          {meta.instructor_name ? `／担当：${meta.instructor_name} 先生` : ""}
        </p>
      </div>

      <div data-sec>
        <Html html={data.intro} />
      </div>

      {data.items.map((item, i) => (
        <section key={i} data-sec className="tr-item">
          <h2>
            {item.number}
            <span className={`verdict ${item.verdict}`}>{VERDICT_LABEL[item.verdict]}</span>
          </h2>

          <Html className="tr-ja" html={item.japanese} />

          <div className="tr-label">提出した英文</div>
          <Html as="div" className="quote" html={item.student_answer} />

          {item.verdict_note && <Html html={item.verdict_note} />}

          {item.fixes.map((fix, j) => (
            <div className="box" key={j}>
              <p>
                <span
                  className="ng"
                  dangerouslySetInnerHTML={{ __html: sanitizeInline(fix.before) }}
                />{" "}
                <span className="arrow">→</span>{" "}
                <span
                  className="lead"
                  dangerouslySetInnerHTML={{ __html: sanitizeInline(fix.after) }}
                />
              </p>
              <Html html={fix.reason} />
            </div>
          ))}

          <div className="tr-label">模範解答</div>
          <Html as="div" className="quote model" html={item.model_answer} />

          {item.note && (
            <div className="box blue">
              <Html html={item.note} />
            </div>
          )}
        </section>
      ))}

      {data.summary.items.length > 0 && (
        <section data-sec>
          <h2>{data.summary.title || "今回の要点"}</h2>
          <div className="box">
            <ul>
              {data.summary.items.map((s, i) => (
                <Html key={i} as="li" html={s} />
              ))}
            </ul>
          </div>
        </section>
      )}

      {data.closing && (
        <div data-sec>
          <Html html={data.closing} />
        </div>
      )}

      <div className="footer" data-sec>
        白谷塾オンライン教室　{meta.grade_label} 英訳課題フィードバック／{meta.student_name}
        {meta.honorific}／{meta.date_label}
        {meta.instructor_name ? `／担当：${meta.instructor_name}` : ""}
      </div>
    </div>
  );
}
