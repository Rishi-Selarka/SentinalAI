import type { TrialState } from "@/hooks/useTrialStream";
import type { FinalLabel } from "@/lib/jury/types";
import type { Domain } from "@/lib/openrouter";

const STORAGE_KEY = "sentinelai.history";
const MAX_RECORDS = 50;

export type TrialHistoryRecord = {
  id: string;
  createdAt: number;
  prompt: string;
  domain: Domain;
  finalLabel: FinalLabel;
  finalScore: number;
  finalSummary?: string;
  answer: string;
  iterations: number;
};

/** Notify in-tab listeners (the storage event only fires across tabs). */
const HISTORY_EVENT = "sentinelai:history-changed";

function emitChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HISTORY_EVENT));
}

export function onHistoryChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(HISTORY_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(HISTORY_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function loadHistory(): TrialHistoryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r): r is TrialHistoryRecord => !!r && typeof r.id === "string")
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function persist(records: TrialHistoryRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(records.slice(0, MAX_RECORDS)),
    );
    emitChange();
  } catch {
    /* quota or unavailable — non-fatal */
  }
}

function finalAnswer(state: TrialState): string {
  if (state.iterations.length) {
    return state.iterations[state.iterations.length - 1].answer;
  }
  return state.agents.generator.tokens;
}

/**
 * Persist a completed trial. No-op unless the trial reached a final verdict.
 * Returns the saved record, or null if nothing was saved.
 */
export function saveTrial(state: TrialState): TrialHistoryRecord | null {
  if (typeof window === "undefined") return null;
  if (state.status !== "done" || !state.finalLabel || !state.prompt) {
    return null;
  }

  const record: TrialHistoryRecord = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `t_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    prompt: state.prompt,
    domain: state.domain ?? ("software" as Domain),
    finalLabel: state.finalLabel,
    finalScore: state.finalScore ?? 0,
    finalSummary: state.finalSummary,
    answer: finalAnswer(state),
    iterations: state.currentIteration,
  };

  const existing = loadHistory();
  // Guard against double-save (e.g. effect re-runs) of an identical trial.
  const dup = existing.find(
    (r) =>
      r.prompt === record.prompt &&
      r.answer === record.answer &&
      Math.abs(r.createdAt - record.createdAt) < 5000,
  );
  if (dup) return dup;

  persist([record, ...existing]);
  return record;
}

export function deleteTrial(id: string) {
  persist(loadHistory().filter((r) => r.id !== id));
}

export function clearHistory() {
  persist([]);
}
