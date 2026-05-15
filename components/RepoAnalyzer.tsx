"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  FolderGit2,
  Search,
  X,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { useRepoStream, type FileAnalysis, type FileReviewLabel } from "@/hooks/useRepoStream";
import { AGENT_LABELS } from "@/lib/jury/types";
import { easeOutExpo } from "@/lib/motion";
import type { AgentId } from "@/lib/openrouter";

const JURORS: AgentId[] = ["critic", "factChecker", "codeExecutor", "math", "standards"];

const LABEL_META: Record<
  FileReviewLabel,
  { cls: string; icon: typeof CheckCircle2 }
> = {
  CLEAN: { cls: "bg-risk-low/10 text-risk-low border-risk-low/30", icon: CheckCircle2 },
  BUGS: { cls: "bg-risk-medium/10 text-risk-medium border-risk-medium/30", icon: AlertTriangle },
  SERIOUS: { cls: "bg-risk-high/10 text-risk-high border-risk-high/30", icon: ShieldAlert },
  UNRELIABLE: { cls: "bg-cream-200 text-surface-500 border-cream-300", icon: HelpCircle },
  ERROR: { cls: "bg-cream-200 text-surface-500 border-cream-300", icon: HelpCircle },
};

type Finding = { severity: string; message: string; file: string };

function severityRank(s: string): number {
  const v = s.toLowerCase();
  if (v === "high") return 0;
  if (v === "med" || v === "medium") return 1;
  return 2;
}

function collectFindings(files: FileAnalysis[]): Finding[] {
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const f of files) {
    for (const a of Object.values(f.agents)) {
      for (const i of a?.verdict?.issues ?? []) {
        const key = `${f.file.path}::${i.message.trim().toLowerCase()}`;
        if (seen.has(key) || !i.message.trim()) continue;
        seen.add(key);
        out.push({ severity: i.severity, message: i.message.trim(), file: f.file.path });
      }
    }
  }
  return out.sort((x, y) => severityRank(x.severity) - severityRank(y.severity));
}

function FileRow({ file }: { file: FileAnalysis }) {
  const [expanded, setExpanded] = useState(false);
  const label = file.reviewLabel;
  const meta = label ? LABEL_META[label] : null;
  const bugs = file.issueCount.high + file.issueCount.med + file.issueCount.low;
  const isRunning = file.status === "running" && !label;

  return (
    <div
      className={`rounded-xl border bg-white overflow-hidden transition-colors ${
        isRunning ? "border-suits-300" : "border-cream-300"
      }`}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-cream-100 transition text-left gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          {isRunning ? (
            <Loader2 className="w-4 h-4 text-suits-500 animate-spin shrink-0" />
          ) : meta ? (
            <meta.icon
              className={`w-4 h-4 shrink-0 ${
                label === "CLEAN"
                  ? "text-risk-low"
                  : label === "BUGS"
                    ? "text-risk-medium"
                    : label === "SERIOUS"
                      ? "text-risk-high"
                      : "text-surface-500"
              }`}
            />
          ) : (
            <span className="w-4 h-4 rounded-full border border-cream-300 shrink-0" />
          )}
          <span className="font-mono text-sm text-surface truncate">{file.file.path}</span>
          <span className="text-xs text-surface-500 shrink-0 hidden sm:inline">
            {file.file.langName} · {file.file.size}b
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRunning && (
            <span className="text-xs text-suits-600 animate-pulse">reviewing…</span>
          )}
          {label && meta && (
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${meta.cls}`}
            >
              {label}
            </span>
          )}
          {bugs > 0 && (
            <span className="text-xs text-surface-500">
              {bugs} issue{bugs === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-cream-300 space-y-3 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {JURORS.map((agent) => {
              const a = file.agents[agent];
              const v = a?.verdict;
              const color = v
                ? v.verdict === "pass"
                  ? "bg-risk-low/10 text-risk-low"
                  : v.verdict === "fail"
                    ? "bg-risk-high/10 text-risk-high"
                    : "bg-risk-medium/10 text-risk-medium"
                : "bg-cream-200 text-surface-500";
              return (
                <div key={agent} className={`rounded-md p-2 text-[11px] ${color}`}>
                  <div className="font-semibold">{AGENT_LABELS[agent]}</div>
                  <div className="opacity-80 truncate">
                    {v?.verdict?.toUpperCase() ?? a?.status ?? "idle"}
                    {v ? ` · ${(v.confidence * 100).toFixed(0)}%` : ""}
                  </div>
                </div>
              );
            })}
          </div>

          {JURORS.flatMap((a) =>
            (file.agents[a]?.verdict?.issues ?? []).map((i, idx) => ({
              key: `${a}-${idx}`,
              agent: a,
              ...i,
            })),
          ).length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-surface-500 mb-1">
                Issues
              </div>
              <ul className="space-y-1">
                {JURORS.flatMap((a) =>
                  (file.agents[a]?.verdict?.issues ?? []).map((i, idx) => ({
                    key: `${a}-${idx}`,
                    agent: a,
                    ...i,
                  })),
                )
                  .slice(0, 12)
                  .map((i) => (
                    <li key={i.key} className="text-[12px] text-surface">
                      <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-risk-high/10 text-risk-high mr-2">
                        {i.severity}
                      </span>
                      <span className="text-surface-500 mr-1">
                        [{AGENT_LABELS[i.agent]}]
                      </span>
                      {i.message}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {file.finalSummary && (
            <div className="text-[12px] italic text-surface-500 pt-1">
              {file.finalSummary}
            </div>
          )}
          {file.error && (
            <div className="text-[12px] text-risk-high pt-1">{file.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function RepoAnalyzer() {
  const { state, start, reset } = useRepoStream();
  const [url, setUrl] = useState("");

  const running = state.status === "fetching" || state.status === "streaming";
  const canSubmit = !running && url.trim().length > 0;

  const total = state.files.length;
  const analyzed = state.files.filter(
    (f) => f.status === "done" || f.reviewLabel,
  ).length;
  const pct = total > 0 ? Math.round((analyzed / total) * 100) : 0;

  return (
    <div className="w-full flex flex-col gap-6">
      <header className="flex flex-col items-center text-center gap-1">
        <h2 className="text-2xl md:text-3xl font-light text-surface">
          Analyze a GitHub repo
        </h2>
      </header>

      <form
        className="flex flex-col sm:flex-row gap-2 max-w-2xl w-full mx-auto"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          start(url.trim());
        }}
      >
        <div className="flex-1 relative">
          <FolderGit2 className="w-4 h-4 text-surface-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={running}
            placeholder="owner/repo  or  https://github.com/owner/repo"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-cream-300 bg-white text-surface placeholder:text-surface-400 outline-none focus:border-suits-400 focus:ring-2 focus:ring-suits-500/20 transition"
          />
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-suits-500 text-white font-medium hover:bg-suits-600 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-[0_12px_30px_-12px_rgba(79,150,204,0.7)]"
        >
          {running ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {running ? "Analyzing…" : "Analyze repo"}
        </button>
        {state.status !== "idle" && !running && (
          <button
            type="button"
            onClick={() => {
              setUrl("");
              reset();
            }}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-cream-300 text-surface-500 hover:bg-cream-100 transition"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </form>

      {state.status === "error" && (
        <div className="rounded-xl border border-risk-high/30 bg-risk-high/10 p-4 text-sm text-risk-high max-w-2xl mx-auto w-full">
          {state.error}
        </div>
      )}

      {state.summary && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOutExpo }}
          className="rounded-xl border border-cream-300 bg-white p-4"
        >
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <a
              href={state.summary.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-sm text-surface hover:text-suits-600 hover:underline"
            >
              {state.summary.owner}/{state.summary.repo}
            </a>
            <span className="text-xs text-surface-500">
              branch: {state.summary.ref} · {total} file{total === 1 ? "" : "s"}
            </span>
          </div>
          {state.summary.description && (
            <div className="text-xs text-surface-500 mt-1">
              {state.summary.description}
            </div>
          )}

          {total > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-surface-500 mb-1.5">
                <span>
                  {running
                    ? `Reviewing the whole repo — ${analyzed} of ${total}`
                    : `${analyzed} of ${total} files reviewed`}
                </span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-cream-200 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-suits-500"
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.4, ease: easeOutExpo }}
                />
              </div>
            </div>
          )}
        </motion.div>
      )}

      {state.files.length > 0 && (
        <div className="flex flex-col gap-2">
          {state.files.map((f) => (
            <FileRow key={f.file.path} file={f} />
          ))}
        </div>
      )}

      {state.status === "done" && (() => {
        const findings = collectFindings(state.files);
        const totals = state.files.reduce(
          (acc, f) => {
            acc.high += f.issueCount.high;
            acc.med += f.issueCount.med;
            acc.low += f.issueCount.low;
            return acc;
          },
          { high: 0, med: 0, low: 0 },
        );
        const totalIssues = totals.high + totals.med + totals.low;
        const allClean = state.buggyFiles === 0;
        const headline = allClean
          ? "No bugs found — every reviewed file looks clean."
          : `Found ${totalIssues} issue${totalIssues === 1 ? "" : "s"} across ${
              state.buggyFiles
            } file${state.buggyFiles === 1 ? "" : "s"}.`;

        return (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOutExpo }}
            className="rounded-2xl border border-cream-300 bg-white overflow-hidden shadow-[0_14px_50px_-30px_rgba(9,9,11,0.25)]"
          >
            {/* Headline */}
            <div className="px-5 py-4 border-b border-cream-300 flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  allClean
                    ? "bg-risk-low/10 text-risk-low"
                    : "bg-risk-high/10 text-risk-high"
                }`}
              >
                {allClean ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <ShieldAlert className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.22em] text-surface-500">
                  Analysis summary
                </div>
                <div className="text-sm font-semibold text-surface">
                  {headline}
                </div>
              </div>
            </div>

            {/* Stat chips */}
            <div className="px-5 py-3.5 flex flex-wrap gap-2 border-b border-cream-300">
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-cream-100 text-surface-600">
                {state.files.length} file{state.files.length === 1 ? "" : "s"} analyzed
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-risk-low/10 text-risk-low">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {state.cleanFiles} clean
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-risk-high/10 text-risk-high">
                <ShieldAlert className="w-3.5 h-3.5" />
                {state.buggyFiles} with bugs
              </span>
              {totals.high > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-lg bg-risk-high/10 text-risk-high">
                  {totals.high} high
                </span>
              )}
              {totals.med > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-lg bg-risk-medium/10 text-risk-medium">
                  {totals.med} medium
                </span>
              )}
              {totals.low > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-lg bg-cream-200 text-surface-600">
                  {totals.low} low
                </span>
              )}
            </div>

            {/* Key findings */}
            {findings.length > 0 ? (
              <div className="px-5 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-surface-500 mb-2">
                  Key findings
                </div>
                <ul className="flex flex-col gap-2">
                  {findings.slice(0, 8).map((f, i) => (
                    <li key={i} className="flex gap-2.5 text-sm">
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5 shrink-0 ${
                          severityRank(f.severity) === 0
                            ? "bg-risk-high/15 text-risk-high"
                            : severityRank(f.severity) === 1
                              ? "bg-risk-medium/15 text-risk-medium"
                              : "bg-cream-200 text-surface-600"
                        }`}
                      >
                        {f.severity}
                      </span>
                      <span className="text-surface-700 min-w-0">
                        <span className="font-mono text-[12px] text-surface-500">
                          {f.file}
                        </span>{" "}
                        — {f.message}
                      </span>
                    </li>
                  ))}
                </ul>
                {findings.length > 8 && (
                  <div className="text-xs text-surface-500 mt-2.5">
                    + {findings.length - 8} more — expand a file above for the full list.
                  </div>
                )}
              </div>
            ) : (
              <div className="px-5 py-4 text-sm text-surface-500">
                The jury reviewed the code and raised no concrete issues.
              </div>
            )}
          </motion.div>
        );
      })()}
    </div>
  );
}
