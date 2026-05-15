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
  fast?: boolean;
}): Promise<TrialResult> {
  const emitter = makeStdoutEmitter({ mode: opts.mode });
  try {
    await runTrial({
      prompt: opts.prompt,
      domain: opts.domain,
      emit: emitter.emit,
      fast: opts.fast ?? false,
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

  const multi = inputs.length > 1;
  if (opts.mode !== "json") {
    process.stdout.write(
      `${systemPrefix("review")} ${colorize(
        `${inputs.length} file${inputs.length === 1 ? "" : "s"}`,
        "accent"
      )} queued${
        multi
          ? colorize(" · running quietly, concatenated summary at the end", "muted")
          : ""
      }\n`
    );
  }

  let worst = 0;
  type FileResult = {
    display: string;
    exitCode: number;
    label: ReviewLabel;
    bugs: number;
    topIssues: { severity: string; message: string }[];
    elapsedMs: number;
  };
  const results: FileResult[] = [];

  function topIssues(
    issues: { severity: string; message: string }[],
    n = 3
  ): { severity: string; message: string }[] {
    const rank: Record<string, number> = { high: 3, med: 2, low: 1 };
    const seen = new Set<string>();
    return issues
      .filter((it) => {
        const k = it.message.slice(0, 60).toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0))
      .slice(0, n);
  }

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const tag = `(${i + 1}/${inputs.length})`;

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
    } else if (multi) {
      // Quiet, ticked progress. TTY: one rewriting line. Pipe: a start line.
      if (process.stdout.isTTY) {
        process.stdout.write(
          `\r\x1b[2K${colorize("⠋", "powder")} ${colorize(tag, "muted")} ${colorize(
            input.display,
            "text"
          )} ${colorize("reviewing…", "muted")}`
        );
      } else {
        process.stdout.write(
          `${colorize("·", "muted")} ${colorize(tag, "muted")} ${input.display}\n`
        );
      }
    } else {
      process.stdout.write("\n");
      process.stdout.write(rule() + "\n");
      process.stdout.write(
        `${systemPrefix("file")} ${colorize(tag, "muted")} ${colorize(
          input.display,
          "accent"
        )} ${colorize(`· ${input.langName} · ${input.bytes}b`, "muted")}\n`
      );
    }

    const prompt = buildReviewPrompt(input);
    // Review is bug-finding at scale — fast mode (single pass, no retry).
    // Multi-file reviews render quietly; the per-file detail would be a
    // wall of text for a directory, so only progress + a final summary.
    const trial = await runTrialOnce({
      prompt,
      domain: opts.domain,
      mode: multi && opts.mode !== "json" ? "quiet" : opts.mode,
      fast: true,
    });
    const reviewExit = reviewExitCode(trial);
    const label = reviewLabel(trial);
    const bugs =
      trial.issueCount.high + trial.issueCount.med + trial.issueCount.low;
    const top = topIssues(trial.issues);
    results.push({
      display: input.display,
      exitCode: reviewExit,
      label,
      bugs,
      topIssues: top,
      elapsedMs: trial.elapsedMs,
    });
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
    } else if (multi) {
      const color = reviewColor(label);
      const secs = `${(trial.elapsedMs / 1000).toFixed(0)}s`;
      const line = `${colorize("✓", "ok")} ${colorize(tag, "muted")} ${colorize(
        label.padEnd(8),
        color
      )} ${colorize(input.display, "text")} ${colorize(
        `${bugs} issue${bugs === 1 ? "" : "s"} · ${secs}`,
        "muted"
      )}`;
      if (process.stdout.isTTY) process.stdout.write(`\r\x1b[2K${line}\n`);
      else process.stdout.write(`${line}\n`);
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
    }
  }

  if (opts.mode !== "json") {
    const rank: Record<ReviewLabel, number> = {
      SERIOUS: 4,
      UNRELIABLE: 3,
      ERROR: 3,
      BUGS: 2,
      CLEAN: 1,
    };
    const serious = results.filter((r) => r.label === "SERIOUS").length;
    const bugCount = results.filter((r) => r.label === "BUGS").length;
    const cleanCount = results.filter((r) => r.label === "CLEAN").length;
    const worstLabel =
      worst >= 3 ? "ERROR" : worst === 2 ? "SERIOUS" : worst === 1 ? "BUGS" : "CLEAN";

    process.stdout.write("\n");
    process.stdout.write(colorize("═".repeat(62), "powder") + "\n");
    process.stdout.write(
      `  ${colorize("review summary", "powder")}   ${colorize(
        `${results.length} files`,
        "text"
      )} · ${colorize(`${cleanCount} clean`, "ok")} · ${colorize(
        `${bugCount} bugs`,
        bugCount ? "warn" : "muted"
      )} · ${colorize(`${serious} serious`, serious ? "fail" : "muted")} · ${colorize(
        `worst: ${worstLabel}`,
        worst >= 2 ? "fail" : worst === 1 ? "warn" : "ok"
      )}\n`
    );
    process.stdout.write(colorize("═".repeat(62), "powder") + "\n");

    const sorted = [...results].sort(
      (a, b) =>
        rank[b.label] - rank[a.label] || b.bugs - a.bugs
    );
    for (const r of sorted) {
      const color = reviewColor(r.label);
      process.stdout.write(
        ` ${colorize(r.label.padEnd(8), color)} ${colorize(r.display, "text")}${
          r.bugs ? colorize(`  (${r.bugs})`, "muted") : ""
        }\n`
      );
      if (r.label !== "CLEAN") {
        for (const it of r.topIssues) {
          const sevColor =
            it.severity === "high"
              ? "fail"
              : it.severity === "med"
              ? "warn"
              : "muted";
          const msg = it.message.replace(/\s+/g, " ").trim().slice(0, 92);
          process.stdout.write(
            `          ${colorize(it.severity.toUpperCase().padEnd(4), sevColor)} ${colorize(
              msg,
              "muted"
            )}\n`
          );
        }
      }
    }
    process.stdout.write(colorize("═".repeat(62), "powder") + "\n");
  }

  return worst;
}

type ReviewLabel = "CLEAN" | "BUGS" | "SERIOUS" | "UNRELIABLE" | "ERROR";

// Concrete findings outrank the meta-verdict. When the jury correctly
// FAILs buggy code the score goes negative and (in fast mode) the
// orchestrator returns HALLUCINATION — that means "the answer failed",
// NOT "the review is unreliable". So check sandbox/severity signals
// first; only treat HALLUCINATION as UNRELIABLE when nothing concrete
// was found (the jury genuinely couldn't get a read).
function reviewExitCode(t: TrialResult): number {
  if (t.errored) return 3;
  if (t.codeExecutorFailed || t.highestSeverity === "high") return 2;
  if (t.standardsFailed || t.highestSeverity === "med" || t.highestSeverity === "low") return 1;
  if (t.label === "HALLUCINATION") return 3;
  return 0;
}

function reviewLabel(t: TrialResult): ReviewLabel {
  if (t.errored) return "ERROR";
  if (t.codeExecutorFailed || t.highestSeverity === "high") return "SERIOUS";
  if (t.standardsFailed || t.highestSeverity === "med" || t.highestSeverity === "low") return "BUGS";
  if (t.label === "HALLUCINATION") return "UNRELIABLE";
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
