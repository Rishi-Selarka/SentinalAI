"use client";

import type { IterationRecord } from "@/hooks/useTrialStream";

export function RevisionDiff({ iterations }: { iterations: IterationRecord[] }) {
  if (iterations.length < 2) return null;
  const original = iterations[0];
  const revised = iterations[iterations.length - 1];
  return (
    <div className="wood-panel rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.25em] text-brass">
          Original vs Revised Testimony
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-parchment-soft/60">
          {iterations.length - 1} revision{iterations.length === 2 ? "" : "s"}
        </div>
      </div>
      {original.retryBrief && (
        <div className="text-[11px] italic text-fail/90 bg-[#1a0c0c]/40 rounded-md p-2">
          Jury revision brief: {original.retryBrief}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="parchment rounded-lg p-3 max-h-72 overflow-y-auto scroll-thin">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#7d2b2b] mb-1">
            Iteration {original.iteration} — challenged
          </div>
          <pre className="text-[11px] whitespace-pre-wrap font-mono text-[#22170a]">
            {original.answer}
          </pre>
        </div>
        <div className="parchment rounded-lg p-3 max-h-72 overflow-y-auto scroll-thin">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#1b6a3d] mb-1">
            Iteration {revised.iteration} — accepted
          </div>
          <pre className="text-[11px] whitespace-pre-wrap font-mono text-[#22170a]">
            {revised.answer}
          </pre>
        </div>
      </div>
    </div>
  );
}
