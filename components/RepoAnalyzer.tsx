"use client";

import { useState } from "react";
import { useRepoStream, type FileAnalysis, type FileReviewLabel } from "@/hooks/useRepoStream";
import { AGENT_LABELS } from "@/lib/jury/types";
import type { AgentId } from "@/lib/openrouter";

const JURORS: AgentId[] = ["critic", "factChecker", "codeExecutor", "math", "standards"];

const LABEL_STYLES: Record<FileReviewLabel, { bg: string; text: string; border: string }> = {
  CLEAN:      { bg: "bg-green-100",   text: "text-green-800",  border: "border-green-300" },
  BUGS:       { bg: "bg-amber-100",   text: "text-amber-800",  border: "border-amber-300" },
  SERIOUS:    { bg: "bg-red-100",     text: "text-red-800",    border: "border-red-300" },
  UNRELIABLE: { bg: "bg-gray-100",    text: "text-gray-700",   border: "border-gray-300" },
  ERROR:      { bg: "bg-gray-100",    text: "text-gray-700",   border: "border-gray-300" },
};

function FileRow({ file }: { file: FileAnalysis }) {
  const [expanded, setExpanded] = useState(false);
  const label = file.reviewLabel;
  const styles = label ? LABEL_STYLES[label] : null;
  const bugs = file.issueCount.high + file.issueCount.med + file.issueCount.low;

  return (
    <div className="rounded-xl border border-cream-300 bg-cream-50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-cream-100 transition text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-sm text-surface truncate">{file.file.path}</span>
          <span className="text-xs text-surface-500 shrink-0">
            {file.file.langName} · {file.file.size}b
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {file.status === "running" && !label && (
            <span className="text-xs text-surface-500 animate-pulse">analyzing…</span>
          )}
          {label && styles && (
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${styles.bg} ${styles.text} ${styles.border}`}
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
          {/* Per-agent status */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {JURORS.map((agent) => {
              const a = file.agents[agent];
              const v = a?.verdict;
              const color = v
                ? v.verdict === "pass"
                  ? "bg-green-100 text-green-800"
                  : v.verdict === "fail"
                  ? "bg-red-100 text-red-800"
                  : "bg-amber-100 text-amber-800"
                : a?.status === "running"
                ? "bg-cream-200 text-surface-500 animate-pulse"
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

          {/* Aggregated issues across jurors */}
          {file.agents &&
            JURORS.flatMap((a) =>
              (file.agents[a]?.verdict?.issues ?? []).map((i, idx) => ({
                key: `${a}-${idx}`,
                agent: a,
                ...i,
              }))
            ).slice(0, 10).length > 0 && (
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
                    }))
                  )
                    .slice(0, 10)
                    .map((i) => (
                      <li key={i.key} className="text-[12px] text-surface">
                        <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-red-100 text-red-700 mr-2">
                          {i.severity}
                        </span>
                        <span className="text-surface-500 mr-1">[{AGENT_LABELS[i.agent]}]</span>
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
            <div className="text-[12px] text-red-700 pt-1">{file.error}</div>
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

  return (
    <div className="w-full">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col items-center text-center gap-1">
          <h2 className="text-2xl md:text-3xl font-light text-surface">
            Analyze a GitHub repo
          </h2>
          <p className="text-sm text-surface-500 max-w-2xl">
            Paste a public GitHub URL. The jury reviews up to 5 of the most
            interesting code files and flags real bugs.
          </p>
        </header>

        <form
          className="flex flex-col sm:flex-row gap-2 max-w-2xl w-full mx-auto"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            start(url.trim());
          }}
        >
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={running}
            placeholder="e.g. pallets/flask  or  https://github.com/owner/repo"
            className="flex-1 px-4 py-3 rounded-xl border border-cream-300 bg-cream-50 text-surface placeholder:text-surface-500 outline-none focus:border-surface-300"
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-5 py-3 rounded-xl bg-surface text-cream font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {running ? "Analyzing…" : "Analyze repo"}
          </button>
          {state.status !== "idle" && !running && (
            <button
              type="button"
              onClick={reset}
              className="px-4 py-3 rounded-xl border border-cream-300 text-surface-500 hover:bg-cream-100"
            >
              Clear
            </button>
          )}
        </form>

        {state.status === "error" && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            {state.error}
          </div>
        )}

        {state.summary && (
          <div className="rounded-xl border border-cream-300 bg-cream-50 p-4">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <a
                href={state.summary.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-sm text-surface hover:underline"
              >
                {state.summary.owner}/{state.summary.repo}
              </a>
              <span className="text-xs text-surface-500">
                branch: {state.summary.ref} · {state.files.length} file
                {state.files.length === 1 ? "" : "s"} queued
              </span>
            </div>
            {state.summary.description && (
              <div className="text-xs text-surface-500 mt-1">{state.summary.description}</div>
            )}
          </div>
        )}

        {state.files.length > 0 && (
          <div className="flex flex-col gap-2">
            {state.files.map((f) => (
              <FileRow key={f.file.path} file={f} />
            ))}
          </div>
        )}

        {state.status === "done" && (
          <div className="rounded-xl border border-cream-300 bg-cream-100 p-4 text-sm">
            <div className="font-medium text-surface">
              {state.files.length} file{state.files.length === 1 ? "" : "s"} analyzed
            </div>
            <div className="text-surface-500 mt-1">
              {state.cleanFiles} clean · {state.buggyFiles} with bugs
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
