import { runTrial } from "@/lib/jury/orchestrator";
import { EXAMPLE_PROMPTS, type ExamplePrompt } from "@/lib/examples";
import { DOMAIN_LABELS } from "@/lib/jury/prompts";
import type { Domain } from "@/lib/openrouter";
import type { FinalLabel } from "@/lib/jury/types";
import { makeStdoutEmitter, type RenderMode, type TrialResult } from "./render";
import { banner, colorize, rule, systemPrefix } from "./ansi";
import { buildReviewPrompt, collectInputs } from "./review";

const VALID_DOMAINS: Domain[] = ["software", "engineering", "mixed", "finance"];

const DOMAIN_ALIAS: Record<string, Domain> = {
  s: "software",
  software: "software",
  sw: "software",
  e: "engineering",
  eng: "engineering",
  engineering: "engineering",
  m: "mixed",
  mix: "mixed",
  mixed: "mixed",
  f: "finance",
  fin: "finance",
  finance: "finance",
};

export function parseDomain(input: string | undefined, fallback: Domain = "mixed"): Domain {
  if (!input) return fallback;
  const key = input.toLowerCase();
  return DOMAIN_ALIAS[key] ?? fallback;
}

export function exitCodeFor(label?: FinalLabel, errored?: boolean): number {
  if (errored) return 3;
  if (label === "TRUSTED") return 0;
  if (label === "REVISED") return 1;
  if (label === "HALLUCINATION") return 2;
  return 3;
}

export async function runTrialOnce(opts: {
  prompt: string;
  domain: Domain;
  mode: RenderMode;
}): Promise<TrialResult> {
  const emitter = makeStdoutEmitter({ mode: opts.mode });
  try {
    await runTrial({
      prompt: opts.prompt,
      domain: opts.domain,
      emit: emitter.emit,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emitter.emit({ type: "trial:error", message });
    emitter.emit({ type: "trial:end" });
  }
  return emitter.done;
}

export async function cmdTrial(opts: {
  prompt: string;
  domain: Domain;
  mode: RenderMode;
}): Promise<number> {
  const result = await runTrialOnce(opts);
  return exitCodeFor(result.label, result.errored);
}

export async function cmdExample(opts: {
  id: string;
  mode: RenderMode;
  domainOverride?: Domain;
}): Promise<number> {
  const ex = lookupExample(opts.id);
  if (!ex) {
    process.stderr.write(
      `${systemPrefix("error")} unknown example "${opts.id}". try: sentinelai examples\n`
    );
    return 3;
  }
  if (opts.mode !== "json") {
    process.stdout.write(
      `${systemPrefix("loaded")} ${colorize(ex.title, "accent")} — ${colorize(
        ex.catchHint,
        "muted"
      )}\n`
    );
  }
  return cmdTrial({
    prompt: ex.prompt,
    domain: opts.domainOverride ?? ex.domain,
    mode: opts.mode,
  });
}

export function cmdExamples(): number {
  process.stdout.write("\n");
  process.stdout.write(banner("seeded cases — call with: sentinelai example <id>") + "\n");
  process.stdout.write(rule() + "\n");
  for (const ex of EXAMPLE_PROMPTS) {
    const idCol = colorize(ex.id.padEnd(22), "accent");
    const domain = colorize(`[${DOMAIN_LABELS[ex.domain]}]`, "muted");
    process.stdout.write(`  ${idCol} ${domain} ${colorize(ex.title, "text")}\n`);
    process.stdout.write(`  ${"".padEnd(22)} ${colorize(ex.catchHint, "muted")}\n\n`);
  }
  return 0;
}

export async function cmdReview(opts: {
  paths: string[];
  mode: RenderMode;
  domain: Domain;
  maxBytes?: number;
}): Promise<number> {
  if (!opts.paths.length) {
    process.stderr.write(
      `${systemPrefix("error")} review needs at least one path (file, directory, glob, or '-')\n`
    );
    return 3;
  }

  const { inputs, skipped } = await collectInputs(opts.paths, {
    maxBytes: opts.maxBytes,
  });

  if (opts.mode !== "json") {
    for (const s of skipped) {
      process.stdout.write(
        `${systemPrefix("skipped")} ${colorize(s.path, "muted")} — ${colorize(s.reason, "muted")}\n`
      );
    }
  } else {
    for (const s of skipped) {
      process.stdout.write(JSON.stringify({ type: "review:skipped", ...s }) + "\n");
    }
  }

  if (!inputs.length) {
    process.stderr.write(
      `${systemPrefix("error")} no reviewable files (all skipped or none matched)\n`
    );
    return 3;
  }

  if (opts.mode !== "json") {
    process.stdout.write(
      `${systemPrefix("review")} ${colorize(`${inputs.length} file${inputs.length === 1 ? "" : "s"}`, "accent")} queued\n`
    );
  }

  let worst = 0;
  type FileResult = {
    display: string;
    exitCode: number;
    label: ReviewLabel;
    bugs: number;
  };
  const results: FileResult[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    if (opts.mode === "json") {
      process.stdout.write(
        JSON.stringify({
          type: "review:file:start",
          index: i + 1,
          total: inputs.length,
          path: input.path,
          display: input.display,
          lang: input.lang,
          bytes: input.bytes,
        }) + "\n"
      );
    } else {
      process.stdout.write("\n");
      process.stdout.write(rule() + "\n");
      process.stdout.write(
        `${systemPrefix("file")} ${colorize(
          `(${i + 1}/${inputs.length})`,
          "muted"
        )} ${colorize(input.display, "accent")} ${colorize(
          `· ${input.langName} · ${input.bytes}b`,
          "muted"
        )}\n`
      );
    }

    const prompt = buildReviewPrompt(input);
    const trial = await runTrialOnce({ prompt, domain: opts.domain, mode: opts.mode });
    const reviewExit = reviewExitCode(trial);
    const label = reviewLabel(trial);
    const bugs = trial.issueCount.high + trial.issueCount.med + trial.issueCount.low;
    results.push({ display: input.display, exitCode: reviewExit, label, bugs });
    if (reviewExit > worst) worst = reviewExit;

    if (opts.mode === "json") {
      process.stdout.write(
        JSON.stringify({
          type: "review:file:done",
          path: input.path,
          display: input.display,
          label,
          exitCode: reviewExit,
          metaVerdict: trial.label,
          highestSeverity: trial.highestSeverity,
          issueCount: trial.issueCount,
        }) + "\n"
      );
    } else {
      const color = reviewColor(label);
      const severityNote =
        trial.highestSeverity !== "none"
          ? colorize(`  highest severity: ${trial.highestSeverity}`, "muted")
          : "";
      process.stdout.write(
        `${systemPrefix("file")} ${colorize(label.padEnd(8), color)} ${colorize(
          `${bugs} issue${bugs === 1 ? "" : "s"} reported by jury`,
          "muted"
        )}${severityNote}\n`
      );
      if (trial.label && trial.label !== "TRUSTED") {
        process.stdout.write(
          `${systemPrefix("file")} ${colorize(
            `(review reliability: ${trial.label.toLowerCase()})`,
            "muted"
          )}\n`
        );
      }
    }
  }

  if (opts.mode !== "json") {
    process.stdout.write("\n");
    process.stdout.write(rule() + "\n");
    process.stdout.write(`${systemPrefix("review")} ${colorize("summary", "accent")}\n`);
    const bugCount = results.filter((r) => r.label === "BUGS" || r.label === "SERIOUS").length;
    const cleanCount = results.filter((r) => r.label === "CLEAN").length;
    process.stdout.write(
      `  ${colorize(`${results.length} file${results.length === 1 ? "" : "s"}`, "text")}  ·  ${colorize(
        `${cleanCount} clean`,
        "ok"
      )}  ·  ${colorize(`${bugCount} with bugs`, bugCount ? "fail" : "muted")}\n`
    );
    for (const r of results) {
      const color = reviewColor(r.label);
      process.stdout.write(
        `  ${colorize(r.label.padEnd(8), color)} ${colorize(r.display, "text")} ${colorize(
          `(${r.bugs} issue${r.bugs === 1 ? "" : "s"})`,
          "muted"
        )}\n`
      );
    }
  }

  return worst;
}

type ReviewLabel = "CLEAN" | "BUGS" | "SERIOUS" | "UNRELIABLE" | "ERROR";

function reviewExitCode(t: TrialResult): number {
  if (t.errored) return 3;
  if (t.label === "HALLUCINATION") return 3;
  if (t.codeExecutorFailed || t.highestSeverity === "high") return 2;
  if (t.standardsFailed || t.highestSeverity === "med" || t.highestSeverity === "low") return 1;
  return 0;
}

function reviewLabel(t: TrialResult): ReviewLabel {
  if (t.errored) return "ERROR";
  if (t.label === "HALLUCINATION") return "UNRELIABLE";
  if (t.codeExecutorFailed || t.highestSeverity === "high") return "SERIOUS";
  if (t.standardsFailed || t.highestSeverity === "med" || t.highestSeverity === "low") return "BUGS";
  return "CLEAN";
}

function reviewColor(label: ReviewLabel): "ok" | "warn" | "fail" {
  if (label === "CLEAN") return "ok";
  if (label === "BUGS") return "warn";
  return "fail";
}

export function lookupExample(idOrShort: string): ExamplePrompt | undefined {
  const exact = EXAMPLE_PROMPTS.find((e) => e.id === idOrShort);
  if (exact) return exact;
  const suffix = EXAMPLE_PROMPTS.find((e) => e.id.endsWith(idOrShort));
  if (suffix) return suffix;
  return EXAMPLE_PROMPTS.find((e) =>
    e.id.toLowerCase().includes(idOrShort.toLowerCase())
  );
}

export function isValidDomain(s: string): s is Domain {
  return (VALID_DOMAINS as string[]).includes(s);
}
