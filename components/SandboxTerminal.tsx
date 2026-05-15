"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { TerminalSquare, Download, Loader2, CheckCircle2 } from "lucide-react";
import type { TrialState } from "@/hooks/useTrialStream";
import { AGENT_LABELS, JUROR_AGENTS } from "@/lib/jury/types";
import { easeOutExpo } from "@/lib/motion";

const SANDBOX_PREFIXES = ["stdout:", "stderr:", "sandbox error:"];

function latestAnswer(state: TrialState): string {
  if (state.iterations.length) {
    return state.iterations[state.iterations.length - 1].answer;
  }
  return state.agents.generator.tokens;
}

function sandboxOutput(state: TrialState): string[] {
  const ev = state.agents.codeExecutor.verdict?.evidence ?? [];
  return ev.filter((e) =>
    SANDBOX_PREFIXES.some((p) => e.toLowerCase().startsWith(p)),
  );
}

function buildMarkdown(state: TrialState): string {
  const lines: string[] = [];
  lines.push("# SentinelAI — Trial Report", "");
  lines.push(`- **Prompt:** ${state.prompt ?? "(none)"}`);
  lines.push(`- **Domain:** ${state.domain ?? "(none)"}`);
  if (state.finalLabel) {
    lines.push(
      `- **Verdict:** ${state.finalLabel} · score ${(
        state.finalScore ?? 0
      ).toFixed(2)} · ${state.currentIteration} iteration(s)`,
    );
  }
  lines.push("");

  if (state.finalSummary) {
    lines.push("## Judge's Summary", "", state.finalSummary, "");
  }

  lines.push("## Generated Answer", "", "```", latestAnswer(state) || "(empty)", "```", "");

  const sb = sandboxOutput(state);
  lines.push("## Sandbox Execution", "");
  lines.push("```", sb.length ? sb.join("\n") : "(no sandbox output captured)", "```", "");

  lines.push("## Jury (ran in the background)", "");
  for (const agent of JUROR_AGENTS) {
    const v = state.agents[agent].verdict;
    lines.push(`### ${AGENT_LABELS[agent]}`);
    if (!v) {
      lines.push("- _no verdict_", "");
      continue;
    }
    lines.push(
      `- **Verdict:** ${v.verdict.toUpperCase()} (confidence ${(
        v.confidence * 100
      ).toFixed(0)}%)`,
    );
    if (v.summary) lines.push(`- **Summary:** ${v.summary}`);
    for (const issue of v.issues) {
      lines.push(`  - [${issue.severity}] ${issue.message}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function SandboxTerminal({ state }: { state: TrialState }) {
  const bodyRef = useRef<HTMLDivElement>(null);

  const answer = latestAnswer(state);
  const sandbox = sandboxOutput(state);
  const codeStatus = state.agents.codeExecutor.status;
  const running = state.status === "streaming";
  const done = state.status === "done";

  const terminalText = useMemo(() => {
    const parts: string[] = [];
    parts.push(answer || "// awaiting generated program…");
    parts.push("");
    parts.push("────────────  SANDBOX EXECUTION  ────────────");
    if (sandbox.length) {
      parts.push(...sandbox);
    } else if (codeStatus === "running") {
      parts.push("running extracted code in E2B sandbox…");
    } else if (codeStatus === "idle") {
      parts.push("(waiting for the program to run)");
    } else {
      parts.push("(no sandbox output captured)");
    }
    return parts.join("\n");
  }, [answer, sandbox, codeStatus]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [terminalText]);

  function downloadMd() {
    const blob = new Blob([buildMarkdown(state)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentinelai-trial-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const labelColor =
    state.finalLabel === "TRUSTED"
      ? "text-risk-low"
      : state.finalLabel === "HALLUCINATION"
        ? "text-risk-high"
        : "text-suits-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: easeOutExpo }}
      className="max-w-3xl w-full mx-auto bg-surface rounded-2xl shadow-[0_14px_50px_rgba(9,9,11,0.14)] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-surface-300">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-suits-500/15 text-suits-400 flex items-center justify-center">
            <TerminalSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-surface-500">
              E2B Sandbox
            </div>
            <div className="text-sm font-semibold text-cream">
              Code execution
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider text-surface-500 flex items-center gap-1.5">
            {running ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-suits-400" />
                Jury deliberating
              </>
            ) : done ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-risk-low" />
                Complete
              </>
            ) : (
              "Idle"
            )}
          </span>
          <button
            type="button"
            onClick={downloadMd}
            disabled={!done && !state.finalLabel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-200 text-cream hover:bg-surface-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download the full report as Markdown"
          >
            <Download className="w-3.5 h-3.5" />
            .md
          </button>
        </div>
      </div>

      {/* Terminal body */}
      <div
        ref={bodyRef}
        className="font-mono text-[12px] leading-relaxed text-cream bg-surface-100 px-4 py-3.5 h-[440px] overflow-y-auto whitespace-pre-wrap"
      >
        {terminalText}
        {running && <span className="streaming-cursor text-suits-400">▍</span>}
      </div>

      {/* Compact verdict footer */}
      {state.finalLabel && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-surface-300">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className={`text-sm font-bold tracking-wide ${labelColor}`}>
              {state.finalLabel}
            </span>
            <span className="text-[11px] text-surface-500">
              score {(state.finalScore ?? 0).toFixed(2)}
            </span>
          </div>
          {state.finalSummary && (
            <span className="text-[11px] text-surface-500 truncate hidden sm:block max-w-[60%]">
              {state.finalSummary}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
