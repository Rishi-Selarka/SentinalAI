"use client";

import { motion } from "framer-motion";
import {
  Brain,
  Globe2,
  TerminalSquare,
  Sigma,
  BookMarked,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  CircleHelp,
} from "lucide-react";
import type { AgentId } from "@/lib/openrouter";
import type { AgentState } from "@/hooks/useTrialStream";
import { AGENT_LABELS, AGENT_ROLE } from "@/lib/jury/types";
import { easeOutExpo } from "@/lib/motion";

const AGENT_ICON: Record<AgentId, typeof Brain> = {
  generator: Brain,
  critic: Brain,
  factChecker: Globe2,
  codeExecutor: TerminalSquare,
  math: Sigma,
  standards: BookMarked,
  aggregator: Brain,
};

function verdictTone(state: AgentState): "running" | "pass" | "fail" | "uncertain" | "idle" {
  if (state.status === "running") return "running";
  if (!state.verdict) return state.status === "done" ? "uncertain" : "idle";
  if (state.verdict.verdict === "pass") return "pass";
  if (state.verdict.verdict === "fail") return "fail";
  return "uncertain";
}

const TONE_CLASSES: Record<ReturnType<typeof verdictTone>, string> = {
  idle: "bg-white border-cream-300",
  running: "bg-suits-50 border-suits-200",
  pass: "bg-risk-low/5 border-risk-low/30",
  fail: "bg-risk-high/5 border-risk-high/30",
  uncertain: "bg-risk-medium/5 border-risk-medium/30",
};

const TONE_DOT: Record<ReturnType<typeof verdictTone>, string> = {
  idle: "bg-cream-400",
  running: "bg-suits-500",
  pass: "bg-risk-low",
  fail: "bg-risk-high",
  uncertain: "bg-risk-medium",
};

function StatusIcon({ tone }: { tone: ReturnType<typeof verdictTone> }) {
  if (tone === "running") return <Loader2 className="w-4 h-4 text-suits-500 animate-spin" />;
  if (tone === "pass") return <CheckCircle2 className="w-4 h-4 text-risk-low" />;
  if (tone === "fail") return <XCircle className="w-4 h-4 text-risk-high" />;
  if (tone === "uncertain") return <CircleHelp className="w-4 h-4 text-risk-medium" />;
  return <Clock className="w-4 h-4 text-cream-400" />;
}

function ConfidenceRing({ value, tone }: { value: number; tone: ReturnType<typeof verdictTone> }) {
  const clamped = Math.max(0, Math.min(1, value));
  const dash = Math.round(clamped * 100);
  const colorMap: Record<ReturnType<typeof verdictTone>, string> = {
    idle: "#B6CCDF",
    running: "#4f96cc",
    pass: "#22c55e",
    fail: "#ef4444",
    uncertain: "#f59e0b",
  };
  return (
    <div className="relative w-11 h-11 shrink-0">
      <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(196,190,167,0.45)" strokeWidth="2.5" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke={colorMap[tone]}
          strokeWidth="2.5"
          strokeDasharray={`${dash} 100`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 600ms var(--ease-out-expo)" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-surface-200">
        {dash}%
      </span>
    </div>
  );
}

export function JurorCard({ agent, state }: { agent: AgentId; state: AgentState }) {
  const tone = verdictTone(state);
  const Icon = AGENT_ICON[agent];
  const verdictText = state.verdict?.verdict?.toUpperCase() ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOutExpo }}
      className={`rounded-xl border p-4 flex flex-col gap-3 transition-all duration-300 ${TONE_CLASSES[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-surface text-cream flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-surface-500">
              {AGENT_ROLE[agent]}
            </div>
            <div className="text-sm font-semibold text-surface truncate">
              {AGENT_LABELS[agent]}
            </div>
          </div>
        </div>
        <ConfidenceRing value={state.verdict?.confidence ?? 0} tone={tone} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusIcon tone={tone} />
          {verdictText && (
            <span
              className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md uppercase ${
                tone === "pass"
                  ? "bg-risk-low/15 text-risk-low"
                  : tone === "fail"
                    ? "bg-risk-high/15 text-risk-high"
                    : "bg-risk-medium/15 text-risk-medium"
              }`}
            >
              {verdictText}
            </span>
          )}
        </div>
        <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[tone]}`} />
      </div>

      {state.verdict?.summary && (
        <div className="text-xs text-surface-700 italic leading-snug">
          “{state.verdict.summary}”
        </div>
      )}

      {state.status !== "done" && !state.verdict && (
        <div className="text-[11px] text-surface-500 italic">
          {state.status === "idle" ? "Awaiting deliberation…" : "Deliberating…"}
        </div>
      )}

      {state.verdict?.issues && state.verdict.issues.length > 0 && (
        <ul className="text-[11px] text-risk-high space-y-1">
          {state.verdict.issues.slice(0, 3).map((issue, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="font-bold uppercase text-[9px] tracking-wider">
                [{issue.severity}]
              </span>
              <span className="text-surface-700">{issue.message}</span>
            </li>
          ))}
        </ul>
      )}

      {state.verdict?.evidence && state.verdict.evidence.length > 0 && (
        <details className="text-[11px] text-surface-600">
          <summary className="cursor-pointer text-suits-600 text-[10px] uppercase tracking-wider hover:text-suits-500">
            Exhibits ({state.verdict.evidence.length})
          </summary>
          <ul className="mt-1.5 space-y-0.5 max-h-32 overflow-y-auto pl-2">
            {state.verdict.evidence.slice(0, 8).map((e, i) => (
              <li key={i} className="break-words text-surface-700">
                • {e}
              </li>
            ))}
          </ul>
        </details>
      )}
    </motion.div>
  );
}
