"use client";

import { useEffect, useRef } from "react";
import type { AgentId } from "@/lib/openrouter";
import type { AgentState } from "@/hooks/useTrialStream";
import { AGENT_LABELS, AGENT_ROLE } from "@/lib/jury/types";

function verdictColor(state: AgentState): string {
  if (!state.verdict) return "var(--brass)";
  if (state.verdict.verdict === "pass") return "var(--pass)";
  if (state.verdict.verdict === "fail") return "var(--fail)";
  return "var(--uncertain)";
}

function ConfidenceRing({ value, color }: { value: number; color: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  const dash = Math.round(clamped * 100);
  return (
    <div className="relative w-12 h-12">
      <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="rgba(199,154,74,0.15)"
          strokeWidth="2.5"
        />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray={`${dash} 100`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 600ms ease-out" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-parchment">
        {dash}%
      </span>
    </div>
  );
}

export function JurorCard({
  agent,
  state,
}: {
  agent: AgentId;
  state: AgentState;
}) {
  const tokensRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tokensRef.current) {
      tokensRef.current.scrollTop = tokensRef.current.scrollHeight;
    }
  }, [state.tokens]);

  const color = verdictColor(state);
  const verdictText = state.verdict?.verdict?.toUpperCase() ?? null;

  return (
    <div
      className={`parchment rounded-xl p-3 shadow-[inset_0_0_30px_rgba(120,80,30,0.15)] flex flex-col gap-2 transition ${
        state.status === "running" ? "animate-glow" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a4f1e]">
            {AGENT_ROLE[agent]}
          </div>
          <div className="text-sm font-serif font-bold text-[#1b1208]">
            {AGENT_LABELS[agent]}
          </div>
        </div>
        <ConfidenceRing value={state.verdict?.confidence ?? 0} color={color} />
      </div>

      {verdictText && (
        <div
          className="self-start px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider"
          style={{ background: color, color: "#1b1208" }}
        >
          {verdictText}
        </div>
      )}

      {state.verdict?.summary && (
        <div className="text-xs text-[#3b2810] italic">
          “{state.verdict.summary}”
        </div>
      )}

      <div
        ref={tokensRef}
        className="font-mono text-[11px] leading-snug text-[#2a1d0c] bg-[#fbf4dc] rounded-md p-2 max-h-32 overflow-y-auto whitespace-pre-wrap scroll-thin"
      >
        {state.tokens || (
          <span className="text-[#7a4f1e]/60">
            {state.status === "idle" ? "awaiting deliberation…" : "..."}
          </span>
        )}
      </div>

      {state.verdict?.issues && state.verdict.issues.length > 0 && (
        <ul className="text-[11px] text-[#7d2b2b] space-y-1">
          {state.verdict.issues.slice(0, 3).map((issue, i) => (
            <li key={i} className="flex gap-1">
              <span className="font-bold">[{issue.severity}]</span>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}

      {state.verdict?.evidence && state.verdict.evidence.length > 0 && (
        <details className="text-[11px] text-[#3b2810]">
          <summary className="cursor-pointer text-brass-bright/90 text-[10px] uppercase tracking-[0.18em]">
            Exhibits ({state.verdict.evidence.length})
          </summary>
          <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto scroll-thin">
            {state.verdict.evidence.slice(0, 8).map((e, i) => (
              <li key={i} className="break-words">
                • {e}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
