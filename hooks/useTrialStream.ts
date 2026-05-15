"use client";

import { useCallback, useReducer, useRef } from "react";
import type { AgentEvent, FinalLabel, JurorVerdict } from "@/lib/jury/types";
import type { AgentId, Domain } from "@/lib/openrouter";

export type AgentState = {
  status: "idle" | "running" | "done";
  tokens: string;
  verdict?: JurorVerdict;
  iteration: number;
};

export type IterationRecord = {
  iteration: number;
  answer: string;
  retryBrief?: string;
};

export type TrialState = {
  status: "idle" | "streaming" | "done" | "error";
  prompt?: string;
  domain?: Domain;
  agents: Record<AgentId, AgentState>;
  iterations: IterationRecord[];
  finalLabel?: FinalLabel;
  finalScore?: number;
  finalSummary?: string;
  error?: string;
  currentIteration: number;
};

const INITIAL_AGENTS: Record<AgentId, AgentState> = {
  generator: { status: "idle", tokens: "", iteration: 1 },
  critic: { status: "idle", tokens: "", iteration: 1 },
  factChecker: { status: "idle", tokens: "", iteration: 1 },
  codeExecutor: { status: "idle", tokens: "", iteration: 1 },
  math: { status: "idle", tokens: "", iteration: 1 },
  standards: { status: "idle", tokens: "", iteration: 1 },
  aggregator: { status: "idle", tokens: "", iteration: 1 },
};

const INITIAL_STATE: TrialState = {
  status: "idle",
  agents: INITIAL_AGENTS,
  iterations: [],
  currentIteration: 1,
};

type Action =
  | { type: "reset" }
  | { type: "event"; event: AgentEvent };

function freshAgent(iteration: number): AgentState {
  return { status: "running", tokens: "", iteration };
}

function reducer(state: TrialState, action: Action): TrialState {
  if (action.type === "reset") return INITIAL_STATE;
  const event = action.event;
  switch (event.type) {
    case "trial:start":
      return {
        ...INITIAL_STATE,
        status: "streaming",
        prompt: event.prompt,
        domain: event.domain,
      };
    case "agent:start": {
      const agents = { ...state.agents };
      agents[event.agent] = freshAgent(event.iteration);
      return { ...state, agents, currentIteration: event.iteration };
    }
    case "agent:token": {
      const prev = state.agents[event.agent] ?? freshAgent(event.iteration);
      const agents = {
        ...state.agents,
        [event.agent]: {
          ...prev,
          status: "running" as const,
          tokens: prev.tokens + event.delta,
          iteration: event.iteration,
        },
      };
      return { ...state, agents };
    }
    case "agent:verdict": {
      const prev = state.agents[event.agent] ?? freshAgent(event.iteration);
      const agents = {
        ...state.agents,
        [event.agent]: {
          ...prev,
          status: "done" as const,
          verdict: event.verdict,
          iteration: event.iteration,
        },
      };
      return { ...state, agents };
    }
    case "agent:answer": {
      const iterations = [...state.iterations];
      const existing = iterations.findIndex((i) => i.iteration === event.iteration);
      const record: IterationRecord = {
        iteration: event.iteration,
        answer: event.answer,
      };
      if (existing === -1) iterations.push(record);
      else iterations[existing] = { ...iterations[existing], ...record };
      return { ...state, iterations };
    }
    case "jury:retry": {
      const iterations = state.iterations.map((rec) =>
        rec.iteration === event.iteration ? { ...rec, retryBrief: event.brief } : rec,
      );
      const nextIter = event.iteration + 1;
      const resetAgents = { ...state.agents };
      for (const k of Object.keys(resetAgents) as AgentId[]) {
        if (k === "generator") continue;
        resetAgents[k] = { status: "idle", tokens: "", iteration: nextIter };
      }
      return {
        ...state,
        iterations,
        agents: resetAgents,
        currentIteration: nextIter,
      };
    }
    case "jury:final":
      return {
        ...state,
        finalLabel: event.label,
        finalScore: event.score,
        finalSummary: event.summary,
        status: "done",
      };
    case "trial:error":
      return { ...state, status: "error", error: event.message };
    case "trial:end":
      return state.status === "error" ? state : { ...state, status: "done" };
    default:
      return state;
  }
}

export function useTrialStream() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: "reset" });
  }, []);

  const start = useCallback(async (prompt: string, domain: Domain) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "reset" });

    try {
      const res = await fetch("/api/trial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, domain }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        dispatch({
          type: "event",
          event: {
            type: "trial:error",
            message: `Request failed (${res.status}): ${text}`,
          },
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
          const lines = block.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const ev = JSON.parse(payload) as AgentEvent;
              dispatch({ type: "event", event: ev });
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
        event: { type: "trial:error", message },
      });
    } finally {
      abortRef.current = null;
    }
  }, []);

  return { state, start, reset };
}
