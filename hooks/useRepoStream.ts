"use client";

import { useCallback, useReducer, useRef } from "react";
import type { AgentEvent, FinalLabel } from "@/lib/jury/types";
import type { AgentId } from "@/lib/openrouter";
import type { RepoFile, RepoSummary } from "@/lib/github/fetcher";

export type FileStatus = "pending" | "running" | "done" | "skipped";
export type FileReviewLabel = "CLEAN" | "BUGS" | "SERIOUS" | "UNRELIABLE" | "ERROR";

export type FileAnalysis = {
  file: RepoFile;
  status: FileStatus;
  agents: Partial<Record<AgentId, { tokens: string; status: "idle" | "running" | "done"; verdict?: { verdict: "pass" | "fail" | "uncertain"; confidence: number; summary?: string; issues: { severity: string; message: string }[] } }>>;
  finalLabel?: FinalLabel;
  finalScore?: number;
  finalSummary?: string;
  issueCount: { high: number; med: number; low: number };
  codeExecutorFailed: boolean;
  standardsFailed: boolean;
  reviewLabel?: FileReviewLabel;
  error?: string;
};

export type RepoState = {
  status: "idle" | "fetching" | "streaming" | "done" | "error";
  summary?: RepoSummary;
  files: FileAnalysis[];
  currentFileIndex: number;
  cleanFiles: number;
  buggyFiles: number;
  error?: string;
};

type RepoEvent =
  | { type: "repo:start"; summary: RepoSummary; files: RepoFile[] }
  | { type: "file:start"; index: number; total: number; file: RepoFile }
  | { type: "file:trial"; event: AgentEvent }
  | {
      type: "file:end";
      index: number;
      file: RepoFile;
      label?: FinalLabel;
      score?: number;
      issueCount: { high: number; med: number; low: number };
      codeExecutorFailed: boolean;
      standardsFailed: boolean;
    }
  | { type: "repo:complete"; filesAnalyzed: number; cleanFiles: number; buggyFiles: number }
  | { type: "repo:error"; message: string };

const INITIAL_STATE: RepoState = {
  status: "idle",
  files: [],
  currentFileIndex: -1,
  cleanFiles: 0,
  buggyFiles: 0,
};

function emptyFileAnalysis(file: RepoFile): FileAnalysis {
  return {
    file,
    status: "pending",
    agents: {},
    issueCount: { high: 0, med: 0, low: 0 },
    codeExecutorFailed: false,
    standardsFailed: false,
  };
}

function computeReviewLabel(f: FileAnalysis): FileReviewLabel {
  if (f.error) return "ERROR";
  if (f.finalLabel === "HALLUCINATION") return "UNRELIABLE";
  if (f.codeExecutorFailed || f.issueCount.high > 0) return "SERIOUS";
  if (f.standardsFailed || f.issueCount.med > 0 || f.issueCount.low > 0) return "BUGS";
  return "CLEAN";
}

type Action =
  | { type: "reset" }
  | { type: "start" }
  | { type: "event"; event: RepoEvent };

function reducer(state: RepoState, action: Action): RepoState {
  if (action.type === "reset") return INITIAL_STATE;
  if (action.type === "start") return { ...INITIAL_STATE, status: "fetching" };

  const ev = action.event;
  switch (ev.type) {
    case "repo:start":
      return {
        ...state,
        status: "streaming",
        summary: ev.summary,
        files: ev.files.map(emptyFileAnalysis),
      };
    case "file:start": {
      const files = [...state.files];
      if (files[ev.index]) {
        files[ev.index] = { ...files[ev.index], status: "running" };
      }
      return { ...state, files, currentFileIndex: ev.index };
    }
    case "file:trial": {
      const idx = state.currentFileIndex;
      if (idx < 0 || !state.files[idx]) return state;
      const files = [...state.files];
      const f = { ...files[idx] };
      const agents = { ...f.agents };

      const inner = ev.event;
      switch (inner.type) {
        case "agent:start": {
          agents[inner.agent] = {
            tokens: "",
            status: "running",
          };
          break;
        }
        case "agent:token": {
          const prev = agents[inner.agent] ?? { tokens: "", status: "running" as const };
          agents[inner.agent] = {
            ...prev,
            status: "running",
            tokens: prev.tokens + inner.delta,
          };
          break;
        }
        case "agent:verdict": {
          const prev = agents[inner.agent] ?? { tokens: "", status: "running" as const };
          agents[inner.agent] = {
            ...prev,
            status: "done",
            verdict: {
              verdict: inner.verdict.verdict,
              confidence: inner.verdict.confidence,
              summary: inner.verdict.summary,
              issues: inner.verdict.issues.map((i) => ({
                severity: i.severity,
                message: i.message,
              })),
            },
          };
          break;
        }
        case "jury:final": {
          f.finalLabel = inner.label;
          f.finalScore = inner.score;
          f.finalSummary = inner.summary;
          break;
        }
        case "trial:error": {
          f.error = inner.message;
          break;
        }
      }
      f.agents = agents;
      files[idx] = f;
      return { ...state, files };
    }
    case "file:end": {
      const files = [...state.files];
      const f = files[ev.index];
      if (!f) return state;
      const updated: FileAnalysis = {
        ...f,
        status: "done",
        finalLabel: ev.label ?? f.finalLabel,
        finalScore: ev.score ?? f.finalScore,
        issueCount: ev.issueCount,
        codeExecutorFailed: ev.codeExecutorFailed,
        standardsFailed: ev.standardsFailed,
      };
      updated.reviewLabel = computeReviewLabel(updated);
      files[ev.index] = updated;
      return { ...state, files };
    }
    case "repo:complete":
      return {
        ...state,
        status: "done",
        cleanFiles: ev.cleanFiles,
        buggyFiles: ev.buggyFiles,
      };
    case "repo:error":
      return { ...state, status: "error", error: ev.message };
    default:
      return state;
  }
}

export function useRepoStream() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: "reset" });
  }, []);

  const start = useCallback(async (url: string, branch?: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "start" });

    try {
      const res = await fetch("/api/analyze-repo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, branch }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        dispatch({
          type: "event",
          event: { type: "repo:error", message: `request failed (${res.status}): ${text}` },
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const line of block.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const parsed = JSON.parse(payload) as RepoEvent;
              dispatch({ type: "event", event: parsed });
            } catch {
              /* ignore */
            }
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      const message = err instanceof Error ? err.message : String(err);
      dispatch({
        type: "event",
        event: { type: "repo:error", message },
      });
    } finally {
      abortRef.current = null;
    }
  }, []);

  return { state, start, reset };
}
