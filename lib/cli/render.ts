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

export type Severity = "low" | "med" | "high";

export type TrialResult = {
  label?: FinalLabel;
  score?: number;
  errored: boolean;
  highestSeverity: Severity | "none";
  issueCount: { high: number; med: number; low: number };
  codeExecutorFailed: boolean;
  standardsFailed: boolean;
};

export type StdoutEmitter = {
  emit: (event: AgentEvent) => void;
  done: Promise<TrialResult>;
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
  let resolveDone: (r: TrialResult) => void;
  const done = new Promise<TrialResult>((r) => {
    resolveDone = r;
  });
  let finalLabel: FinalLabel | undefined;
  let finalScore: number | undefined;
  let errored = false;
  let closed = false;
  const issueCount = { high: 0, med: 0, low: 0 };
  let codeExecutorFailed = false;
  let standardsFailed = false;

  function severityRank(s: Severity | "none"): number {
    return s === "high" ? 3 : s === "med" ? 2 : s === "low" ? 1 : 0;
  }
  function highestSeverity(): Severity | "none" {
    if (issueCount.high) return "high";
    if (issueCount.med) return "med";
    if (issueCount.low) return "low";
    return "none";
  }

  function trackVerdict(agent: AgentId, v: import("@/lib/jury/types").JurorVerdict) {
    if (agent === "codeExecutor" && v.verdict === "fail") codeExecutorFailed = true;
    if (agent === "standards" && v.verdict === "fail") standardsFailed = true;
    for (const issue of v.issues) {
      const sev = issue.severity as Severity;
      if (sev === "high" || sev === "med" || sev === "low") issueCount[sev]++;
    }
  }

  function buildResult(): TrialResult {
    return {
      label: finalLabel,
      score: finalScore,
      errored,
      highestSeverity: highestSeverity(),
      issueCount: { ...issueCount },
      codeExecutorFailed,
      standardsFailed,
    };
  }
  void severityRank; // retain helper for future use

  function flushAgentLines(agent: AgentId, includeTrailing = false): void {
    const buf = buffers.get(agent) ?? "";
    if (!buf) return;
    const parts = buf.split("\n");
    let remaining = "";
    if (includeTrailing) {
      if (parts[parts.length - 1] === "") parts.pop();
    } else {
      remaining = parts.pop() ?? "";
    }
    for (const line of parts) {
      write(`${agentPrefix(agent)} ${colorize(line, "text")}`);
    }
    buffers.set(agent, remaining);
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
        trackVerdict(event.agent, v);
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
        const rawBrief: unknown = event.brief;
        const briefText =
          typeof rawBrief === "string"
            ? rawBrief
            : Array.isArray(rawBrief)
            ? rawBrief.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("\n")
            : rawBrief == null
            ? ""
            : JSON.stringify(rawBrief);
        const briefLine = briefText.split("\n")[0]?.slice(0, 120) ?? "";
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
        resolveDone(buildResult());
        break;
      }
    }
  }

  function emit(event: AgentEvent): void {
    if (closed && event.type !== "trial:end") return;
    try {
      if (mode === "json") {
        emitJson(event);
        if (event.type === "agent:verdict") {
          trackVerdict(event.agent, event.verdict);
        }
        if (event.type === "jury:final") {
          finalLabel = event.label;
          finalScore = event.score;
        }
        if (event.type === "trial:error") {
          errored = true;
        }
        if (event.type === "trial:end" && !closed) {
          closed = true;
          resolveDone(buildResult());
        }
        return;
      }
      emitAnsi(event);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`\n[render error] ${msg}\n`);
      // Never propagate render errors — the trial should keep running.
      if (event.type === "trial:end" && !closed) {
        closed = true;
        resolveDone(buildResult());
      }
    }
  }

  return { emit, done };
}

function shortPrompt(p: string): string {
  const oneLine = p.replace(/\s+/g, " ").trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 60)}…` : oneLine;
}
