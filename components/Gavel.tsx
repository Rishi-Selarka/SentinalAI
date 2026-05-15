"use client";

import type { FinalLabel } from "@/lib/jury/types";

const LABEL_STYLES: Record<FinalLabel, { color: string; bg: string; tagline: string }> = {
  TRUSTED: {
    color: "#1b1208",
    bg: "linear-gradient(135deg, #f1c875 0%, #6ed197 100%)",
    tagline: "The jury finds the answer truthful and verifiable.",
  },
  REVISED: {
    color: "#1b1208",
    bg: "linear-gradient(135deg, #f1c875 0%, #c79a4a 100%)",
    tagline: "The original answer was unsafe; a revised verdict was reached.",
  },
  HALLUCINATION: {
    color: "#fff5f5",
    bg: "linear-gradient(135deg, #c75050 0%, #5a1818 100%)",
    tagline: "The jury finds the answer unsafe to trust.",
  },
};

export function Gavel({
  label,
  score,
  summary,
  iterations,
}: {
  label: FinalLabel;
  score: number;
  summary: string;
  iterations: number;
}) {
  const styles = LABEL_STYLES[label];
  return (
    <div className="animate-fade-in flex flex-col gap-3">
      <div
        className="rounded-2xl p-5 border border-brass/40 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
        style={{ background: styles.bg, color: styles.color }}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl animate-gavel" aria-hidden>
            ⚖️
          </span>
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] opacity-80">
              Final Verdict
            </div>
            <div className="text-3xl font-serif font-extrabold leading-tight">
              {label}
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[11px] uppercase tracking-[0.3em] opacity-80">
              Reliability Score
            </div>
            <div className="text-2xl font-mono font-bold">
              {score.toFixed(2)}
            </div>
            <div className="text-[10px] opacity-70">
              after {iterations} iteration{iterations === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <div className="mt-3 text-sm italic opacity-90">{styles.tagline}</div>
      </div>
      <div className="wood-panel rounded-xl p-4 text-sm text-parchment-soft">
        <div className="text-[10px] uppercase tracking-[0.2em] text-brass mb-1">
          Judge's Summary
        </div>
        <p className="whitespace-pre-wrap leading-relaxed">{summary}</p>
      </div>
    </div>
  );
}
