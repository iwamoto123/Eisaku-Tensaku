"use client";

import type { Progress } from "@/lib/progress";

/**
 * 生成中の様子を見せるパネル。
 * 4分ほど待つことになるので、いま何が書かれているかが分かるようにしている。
 */
export default function ProgressPanel({ progress }: { progress: Progress }) {
  return (
    <div className="progress">
      <div className="progress-head">
        <span className="progress-label">
          <span className="pulse-dot" />
          {progress.label}
        </span>
        <span className="progress-percent">{progress.percent}%</span>
      </div>

      <div className="progress-track">
        <div className="progress-bar" style={{ width: `${progress.percent}%` }} />
      </div>

      <div className="progress-detail">{progress.detail}</div>

      {progress.steps.length > 0 && (
        <ol className="steps">
          {progress.steps.map((step) => (
            <li key={step.key} className={`step ${step.state}`}>
              <span className="step-mark" aria-hidden>
                {step.state === "done" ? "✓" : step.state === "active" ? "●" : "○"}
              </span>
              <span className="step-body">
                <span className="step-label">{step.label}</span>
                {step.items.length > 0 && (
                  <span className="step-items">
                    {step.items.map((item, i) => (
                      <span className="step-item" key={i}>
                        {item}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
