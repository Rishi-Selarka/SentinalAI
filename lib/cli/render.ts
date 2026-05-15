import type { AgentEvent, FinalLabel, Verdict } from "@/lib/jury/types";
import { AGENT_LABELS } from "@/lib/jury/types";
import type { AgentId } from "@/lib/openrouter";
import { bar, colorize } from "./ansi";

export type RenderMode = "ansi" | "json" | "quiet";

export type Severity = "low" | "med" | "high";

export type CollectedIssue = {
  agent: AgentId;
  severity: Severity;
  message: string;
};

export type TrialResult = {
  label?: FinalLabel;
  score?: number;
  errored: boolean;
  highestSeverity: Severity | "none";
  issueCount: { high: number; med: number; low: number };
  codeExecutorFailed: boolean;
  standardsFailed: boolean;
  issues: CollectedIssue[];
  summary?: string;
  elapsedMs: number;
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

const JUROR_ORDER: AgentId[] = [
  "critic",
  "factChecker",
  "codeExecutor",
  "math",
  "standards",
];

const SHORT_NAME: Record<string, string> = {
  critic: "logic",
  factChecker: "facts",
  codeExecutor: "code",
  math: "math",
  standards: "standards",
};

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function write(line = ""): void {
  process.stdout.write(line + "\n");
}

function wrapText(text: string, width: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function makeStdoutEmitter(
  opts: { mode?: RenderMode; startedAt?: number } = {}
): StdoutEmitter {
  const mode = opts.mode ?? "ansi";
  const startedAt = opts.startedAt ?? Date.now();
  const isTTY = mode === "ansi" && !!process.stdout.isTTY;
  const collectedIssues: CollectedIssue[] = [];

  let resolveDone: (r: TrialResult) => void;
  const done = new Promise<TrialResult>((r) => {
    resolveDone = r;
  });

  let finalLabel: FinalLabel | undefined;
  let finalScore: number | undefined;
  let finalSummary: string | undefined;
  let errored = false;
  let closed = false;
  const issueCount = { high: 0, med: 0, low: 0 };
  let codeExecutorFailed = false;
  let standardsFailed = false;

  // generator answer streaming state
  let genActive = false;
  let genBuf = "";

  // jury progress state
  const jurorStatus = new Map<AgentId, "pending" | "done">();
  let spinnerTimer: ReturnType<typeof setInterval> | null = null;
  let spinnerFrame = 0;
  let spinnerLineActive = false;

  function highestSeverity(): Severity | "none" {
    if (issueCount.high) return "high";
    if (issueCount.med) return "med";
    if (issueCount.low) return "low";
    return "none";
  }

  function trackVerdict(
    agent: AgentId,
    v: import("@/lib/jury/types").JurorVerdict
  ) {
    if (agent === "codeExecutor" && v.verdict === "fail") codeExecutorFailed = true;
    if (agent === "standards" && v.verdict === "fail") standardsFailed = true;
    for (const issue of v.issues) {
      const sev = issue.severity as Severity;
      if (sev === "high" || sev === "med" || sev === "low") {
        issueCount[sev]++;
        collectedIssues.push({ agent, severity: sev, message: issue.message });
      }
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
      issues: collectedIssues.slice(),
      summary: finalSummary,
      elapsedMs: Date.now() - startedAt,
    };
  }

  function spinnerText(): string {
    const frame = SPINNER[spinnerFrame % SPINNER.length];
    const parts = JUROR_ORDER.filter((j) => jurorStatus.has(j)).map((j) => {
      const st = jurorStatus.get(j);
      const name = SHORT_NAME[j] ?? j;
      return st === "done"
        ? colorize(`${name}✓`, "ok")
        : colorize(name, "muted");
    });
    const doneN = [...jurorStatus.values()].filter((s) => s === "done").length;
    return `${colorize(frame, "powder")} jury deliberating  ${parts.join("  ")}  ${colorize(
      `${doneN}/${jurorStatus.size}`,
      "muted"
    )}`;
  }

  function clearSpinnerLine(): void {
    if (spinnerLineActive) {
      process.stdout.write("\r\x1b[2K");
      spinnerLineActive = false;
    }
  }

  function renderSpinner(): void {
    if (!isTTY) return;
    process.stdout.write("\r\x1b[2K" + spinnerText());
    spinnerLineActive = true;
  }

  function startSpinner(): void {
    if (!isTTY || spinnerTimer) return;
    renderSpinner();
    spinnerTimer = setInterval(() => {
      spinnerFrame++;
      renderSpinner();
    }, 90);
  }

  function stopSpinner(): void {
    if (spinnerTimer) {
      clearInterval(spinnerTimer);
      spinnerTimer = null;
    }
    clearSpinnerLine();
  }

  function flushGenerator(): void {
    if (!genActive) return;
    const text = genBuf.trimEnd();
    if (text) {
      for (const raw of text.split("\n")) {
        write(`  ${colorize("│", "powderDim")} ${colorize(raw, "text")}`);
      }
    }
    genBuf = "";
    genActive = false;
    write();
  }

  function verdictCard(
    agent: AgentId,
    v: import("@/lib/jury/types").JurorVerdict
  ): void {
    const vc = VERDICT_COLOR[v.verdict];
    const tag = colorize(` ${v.verdict.toUpperCase().padEnd(9)}`, vc);
    const name = colorize(AGENT_LABELS[agent].padEnd(18), "text");
    const conf = colorize(bar(v.confidence), vc);
    const num = colorize(v.confidence.toFixed(2), "muted");
    write(`${tag} ${name} ${conf} ${num}`);
    if (v.summary) {
      for (const ln of wrapText(v.summary, 72)) {
        write(`           ${colorize(ln, "muted")}`);
      }
    }
    for (const issue of v.issues.slice(0, 4)) {
      const sevColor =
        issue.severity === "high"
          ? "fail"
          : issue.severity === "med"
          ? "warn"
          : "muted";
      const lines = wrapText(issue.message, 66);
      write(
        `           ${colorize(
          `${issue.severity.toUpperCase()}`,
          sevColor
        )}  ${colorize(lines[0] ?? "", "muted")}`
      );
      for (const extra of lines.slice(1)) {
        write(`                 ${colorize(extra, "muted")}`);
      }
    }
    write();
  }

  function emitJson(event: AgentEvent): void {
    process.stdout.write(JSON.stringify(event) + "\n");
  }

  function emitAnsi(event: AgentEvent): void {
    switch (event.type) {
      case "trial:start": {
        write();
        write(colorize("┌─ trial ", "powder") + colorize("─".repeat(54), "powderDim"));
        write(
          `${colorize("│", "powder")} ${colorize("domain", "muted")}  ${colorize(
            event.domain,
            "powder"
          )}`
        );
        for (const ln of wrapText(event.prompt, 64)) {
          write(`${colorize("│", "powder")} ${colorize(ln, "text")}`);
        }
        write(colorize("└" + "─".repeat(62), "powderDim"));
        write();
        break;
      }

      case "agent:start": {
        if (event.agent === "generator") {
          stopSpinner();
          jurorStatus.clear();
          const hdr =
            event.iteration > 1
              ? `answer · revision ${event.iteration}`
              : "answer";
          write(colorize(`▌ ${hdr}`, "powder"));
          genActive = true;
          genBuf = "";
        } else if (event.agent !== "aggregator") {
          jurorStatus.set(event.agent, "pending");
          startSpinner();
        }
        break;
      }

      case "agent:token": {
        // Only the generator's tokens are human-readable prose. Juror
        // tokens are raw JSON — suppress them entirely and show progress.
        if (event.agent === "generator") {
          genBuf += event.delta;
          let nl: number;
          while ((nl = genBuf.indexOf("\n")) !== -1) {
            const line = genBuf.slice(0, nl);
            genBuf = genBuf.slice(nl + 1);
            write(`  ${colorize("│", "powderDim")} ${colorize(line, "text")}`);
          }
        }
        break;
      }

      case "agent:answer": {
        flushGenerator();
        write(colorize("▌ jury", "powder"));
        write();
        break;
      }

      case "agent:verdict": {
        trackVerdict(event.agent, event.verdict);
        if (event.agent === "aggregator") break;
        jurorStatus.set(event.agent, "done");
        const restart = spinnerTimer !== null;
        stopSpinner();
        verdictCard(event.agent, event.verdict);
        if (restart && [...jurorStatus.values()].some((s) => s === "pending")) {
          startSpinner();
        }
        break;
      }

      case "jury:retry": {
        stopSpinner();
        write(
          colorize(
            `↻ revising — score ${event.score.toFixed(2)}, iteration ${event.iteration}`,
            "warn"
          )
        );
        write();
        break;
      }

      case "jury:final": {
        stopSpinner();
        finalLabel = event.label;
        finalScore = event.score;
        finalSummary = event.summary;
        const lc = LABEL_COLOR[event.label];
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        write(colorize("═".repeat(62), lc));
        write(
          `  ${colorize(` ${event.label} `, lc)}   ${colorize(
            `score ${event.score.toFixed(2)}`,
            "text"
          )}   ${colorize(
            `${event.iterations} iter · ${elapsed}s`,
            "muted"
          )}`
        );
        if (event.summary) {
          write();
          for (const ln of wrapText(event.summary, 70)) {
            write(`  ${colorize(ln, "text")}`);
          }
        }
        write(colorize("═".repeat(62), lc));
        write();
        break;
      }

      case "trial:error": {
        stopSpinner();
        errored = true;
        write();
        write(`  ${colorize(" ERROR ", "fail")} ${colorize(event.message, "fail")}`);
        write();
        break;
      }

      case "trial:end": {
        stopSpinner();
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
      if (mode === "json" || mode === "quiet") {
        if (mode === "json") emitJson(event);
        if (event.type === "agent:verdict") trackVerdict(event.agent, event.verdict);
        if (event.type === "jury:final") {
          finalLabel = event.label;
          finalScore = event.score;
          finalSummary = event.summary;
        }
        if (event.type === "trial:error") errored = true;
        if (event.type === "trial:end" && !closed) {
          closed = true;
          resolveDone(buildResult());
        }
        return;
      }
      emitAnsi(event);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stopSpinner();
      process.stderr.write(`\n[render error] ${msg}\n`);
      if (event.type === "trial:end" && !closed) {
        closed = true;
        resolveDone(buildResult());
      }
    }
  }

  return { emit, done };
}
