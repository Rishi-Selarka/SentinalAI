import type { AgentEvent, FinalLabel, Verdict } from "@/lib/jury/types";
import type { AgentId } from "@/lib/openrouter";
import {
  agentPrefix,
  bar,
  banner,
  colorize,
  rule,
  systemPrefix,
} from "./ansi";

export type RenderMode = "ansi" | "json";

export type StdoutEmitter = {
  emit: (event: AgentEvent) => void;
  done: Promise<{ label?: FinalLabel; score?: number; errored: boolean }>;
};

const VERDICT_COLOR: Record<Verdict, "ok" | "fail" | "warn"> = {
  pass: "ok",
  fail: "fail",
  uncertain: "warn",
};

const LABEL_COLOR: Record<FinalLabel, "ok" | "warn" | "fail"> = {
  TRUSTED: "ok",
  REVISED: "warn",
  HALLUCINATION: "fail",
};

function write(line: string): void {
  process.stdout.write(line + "\n");
}

export function makeStdoutEmitter(opts: {
  mode?: RenderMode;
  startedAt?: number;
} = {}): StdoutEmitter {
  const mode = opts.mode ?? "ansi";
  const startedAt = opts.startedAt ?? Date.now();
  const buffers = new Map<AgentId, string>();
  let resolveDone: (r: { label?: FinalLabel; score?: number; errored: boolean }) => void;
  const done = new Promise<{ label?: FinalLabel; score?: number; errored: boolean }>(
    (r) => {
      resolveDone = r;
    }
  );
  let finalLabel: FinalLabel | undefined;
  let finalScore: number | undefined;
  let errored = false;
  let closed = false;

  function flushAgentLines(agent: AgentId, includeTrailing = false): void {
    const buf = buffers.get(agent) ?? "";
    if (!buf) return;
    const parts = buf.split("\n");
    const trailing = includeTrailing ? "" : (parts.pop() ?? "");
    for (const line of parts) {
      write(`${agentPrefix(agent)} ${colorize(line, "text")}`);
    }
    if (includeTrailing && trailing) {
      write(`${agentPrefix(agent)} ${colorize(trailing, "text")}`);
      buffers.set(agent, "");
    } else {
      buffers.set(agent, trailing);
    }
  }

  function emitJson(event: AgentEvent): void {
    process.stdout.write(JSON.stringify(event) + "\n");
  }

  function emitAnsi(event: AgentEvent): void {
    switch (event.type) {
      case "trial:start": {
        write("");
        write(banner(`sentinelai  ·  ${event.domain}  ·  ${shortPrompt(event.prompt)}`));
        write(rule());
        break;
      }
      case "agent:start": {
        if (event.iteration > 1 && event.agent === "generator") {
          write(`${systemPrefix("trial")} ${colorize(`iteration ${event.iteration}`, "info")}`);
        }
        buffers.set(event.agent, "");
        break;
      }
      case "agent:token": {
        const prev = buffers.get(event.agent) ?? "";
        buffers.set(event.agent, prev + event.delta);
        flushAgentLines(event.agent, false);
        break;
      }
      case "agent:answer": {
        flushAgentLines(event.agent, true);
        break;
      }
      case "agent:verdict": {
        flushAgentLines(event.agent, true);
        const v = event.verdict;
        const verdictColor = VERDICT_COLOR[v.verdict];
        const label = colorize(v.verdict.toUpperCase().padEnd(8), verdictColor);
        const conf = colorize(bar(v.confidence), "muted");
        const num = colorize(v.confidence.toFixed(2), "muted");
        const summary = v.summary ? `  ${colorize(v.summary, "text")}` : "";
        write(`${agentPrefix(event.agent)} ▶ ${label} ${conf} ${num}${summary}`);
        for (const issue of v.issues.slice(0, 3)) {
          const sev = colorize(`[${issue.severity}]`, "fail");
          write(`${agentPrefix(event.agent)}   ${sev} ${colorize(issue.message, "muted")}`);
        }
        break;
      }
      case "jury:retry": {
        write(
          `${systemPrefix("judge")} ${colorize(
            `score ${event.score.toFixed(2)} · revising (iter ${event.iteration})`,
            "warn"
          )}`
        );
        const briefLine = event.brief.split("\n")[0]?.slice(0, 120) ?? "";
        if (briefLine) {
          write(`${systemPrefix("judge")} ${colorize(briefLine, "muted")}`);
        }
        break;
      }
      case "jury:final": {
        finalLabel = event.label;
        finalScore = event.score;
        const labelColor = LABEL_COLOR[event.label];
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        write(rule());
        write(
          `${systemPrefix("judge")} ▶ ${colorize(event.label, labelColor)}   ${colorize(
            `score ${event.score.toFixed(2)}`,
            "text"
          )}   ${colorize(`${event.iterations} iter`, "muted")}   ${colorize(`${elapsed}s`, "muted")}`
        );
        if (event.summary) {
          for (const line of event.summary.split("\n").slice(0, 6)) {
            if (!line.trim()) continue;
            write(`${systemPrefix("judge")} ${colorize(line, "text")}`);
          }
        }
        write(rule());
        write("");
        break;
      }
      case "trial:error": {
        errored = true;
        write("");
        write(`${systemPrefix("error")} ${colorize(event.message, "fail")}`);
        write("");
        break;
      }
      case "trial:end": {
        if (closed) return;
        closed = true;
        resolveDone({ label: finalLabel, score: finalScore, errored });
        break;
      }
    }
  }

  function emit(event: AgentEvent): void {
    if (closed && event.type !== "trial:end") return;
    if (mode === "json") {
      emitJson(event);
      if (event.type === "jury:final") {
        finalLabel = event.label;
        finalScore = event.score;
      }
      if (event.type === "trial:error") {
        errored = true;
      }
      if (event.type === "trial:end" && !closed) {
        closed = true;
        resolveDone({ label: finalLabel, score: finalScore, errored });
      }
      return;
    }
    emitAnsi(event);
  }

  return { emit, done };
}

function shortPrompt(p: string): string {
  const oneLine = p.replace(/\s+/g, " ").trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 60)}…` : oneLine;
}
