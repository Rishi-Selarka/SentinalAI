import { runTrial } from "@/lib/jury/orchestrator";
import { EXAMPLE_PROMPTS, type ExamplePrompt } from "@/lib/examples";
import { DOMAIN_LABELS } from "@/lib/jury/prompts";
import type { Domain } from "@/lib/openrouter";
import type { FinalLabel } from "@/lib/jury/types";
import { makeStdoutEmitter, type RenderMode } from "./render";
import { agentPrefix, banner, colorize, rule, systemPrefix } from "./ansi";

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

export async function cmdTrial(opts: {
  prompt: string;
  domain: Domain;
  mode: RenderMode;
}): Promise<number> {
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
  const result = await emitter.done;
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
  process.stdout.write(
    `${systemPrefix("loaded")} ${colorize(ex.title, "accent")} — ${colorize(
      ex.catchHint,
      "muted"
    )}\n`
  );
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
