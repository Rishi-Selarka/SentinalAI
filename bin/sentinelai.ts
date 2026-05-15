#!/usr/bin/env -S npx tsx
import { loadEnv } from "@/lib/cli/env";
import { setColor, banner, colorize } from "@/lib/cli/ansi";
import {
  cmdTrial,
  cmdExample,
  cmdExamples,
  cmdReview,
  parseDomain,
} from "@/lib/cli/commands";
import { runRepl } from "@/lib/cli/repl";
import type { RenderMode } from "@/lib/cli/render";

type ParsedArgs = {
  command: string | undefined;
  positional: string[];
  flags: Record<string, string | boolean>;
};

function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith("-")) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else if (a.startsWith("-") && a.length > 1) {
      flags[a.slice(1)] = true;
    } else {
      positional.push(a);
    }
  }
  return { command: positional[0], positional: positional.slice(1), flags };
}

const HELP = `
${banner("sentinelai")} — multi-agent jury for AI-generated technical answers

usage:
  sentinelai trial "<prompt>" [--domain s|e|m|f] [--json] [--no-color]
  sentinelai review <file|dir|glob|->... [--domain s|e|m|f] [--max-size BYTES] [--json]
  sentinelai example <id> [--domain s|e|m|f] [--json] [--no-color]
  sentinelai examples
  sentinelai repl [--domain s|e|m|f] [--json] [--no-color]
  sentinelai doctor
  sentinelai --help

review examples:
  sentinelai review app.py
  sentinelai review src/                       # walk directory, code files only
  sentinelai review 'src/**/*.ts'              # glob (quote to protect from shell)
  sentinelai review a.py b.py                  # multiple files
  cat broken.py | sentinelai review -          # stdin

flags:
  --domain      one of: software (s) · engineering (e) · mixed (m) · finance (f)
  --json        emit NDJSON events (one per line) instead of human output
  --no-color    disable ANSI colors (auto-disabled when piped)
  --max-size N  per-file byte cap for review (default 51200, ~50KB)

exit codes:
  trial / example:  0 TRUSTED   1 REVISED   2 HALLUCINATION   3 error
  review:           0 CLEAN     1 BUGS      2 SERIOUS BUGS    3 unreliable/error
  (review with multiple files returns the worst code across all files)
`;

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const { command, positional, flags } = parsed;

  if (flags.help || flags.h || command === "help") {
    process.stdout.write(HELP + "\n");
    process.exitCode = 0;
    return;
  }

  if (flags["no-color"] || !process.stdout.isTTY) {
    setColor(false);
  }

  loadEnv(import.meta.url);

  const mode: RenderMode = flags.json ? "json" : "ansi";
  const domain = parseDomain(
    typeof flags.domain === "string" ? flags.domain : undefined,
    "mixed"
  );

  switch (command) {
    case undefined: {
      process.stdout.write(HELP + "\n");
      process.exitCode = 0;
      return;
    }
    case "trial": {
      const prompt = positional.join(" ").trim();
      if (!prompt) {
        process.stderr.write(`${colorize("error:", "fail")} trial requires a prompt\n`);
        process.exitCode = 3;
        return;
      }
      process.exitCode = await cmdTrial({ prompt, domain, mode });
      return;
    }
    case "example": {
      const id = positional[0];
      if (!id) {
        process.stderr.write(`${colorize("error:", "fail")} example requires an id\n`);
        process.exitCode = 3;
        return;
      }
      process.exitCode = await cmdExample({
        id,
        mode,
        domainOverride: typeof flags.domain === "string" ? domain : undefined,
      });
      return;
    }
    case "examples": {
      process.exitCode = cmdExamples();
      return;
    }
    case "review": {
      if (!positional.length) {
        process.stderr.write(
          `${colorize("error:", "fail")} review requires at least one path (file, dir, glob, or '-')\n`
        );
        process.exitCode = 3;
        return;
      }
      const maxBytesRaw = flags["max-size"];
      const maxBytes =
        typeof maxBytesRaw === "string" && /^\d+$/.test(maxBytesRaw)
          ? parseInt(maxBytesRaw, 10)
          : undefined;
      const reviewDomain =
        typeof flags.domain === "string" ? domain : "software";
      process.exitCode = await cmdReview({
        paths: positional,
        mode,
        domain: reviewDomain,
        maxBytes,
      });
      return;
    }
    case "doctor": {
      const or = process.env.OPENROUTER_API_KEY;
      const e2b = process.env.E2B_API_KEY;
      const orOk = or && !or.startsWith("sk-or-v1-...");
      const e2bOk = e2b && !e2b.startsWith("e2b_...");
      process.stdout.write(
        `${colorize("OPENROUTER_API_KEY", "muted")}  ${
          orOk ? colorize("ok", "ok") + " (" + or.slice(0, 12) + "…)" : colorize("missing", "fail")
        }\n`
      );
      process.stdout.write(
        `${colorize("E2B_API_KEY       ", "muted")}  ${
          e2bOk ? colorize("ok", "ok") + " (" + e2b.slice(0, 8) + "…)" : colorize("missing", "fail")
        }\n`
      );
      process.exitCode = orOk && e2bOk ? 0 : 3;
      return;
    }
    case "repl": {
      process.exitCode = await runRepl({ domain, mode });
      return;
    }
    default: {
      process.stderr.write(
        `${colorize("error:", "fail")} unknown command: ${command}\n`
      );
      process.stderr.write(HELP + "\n");
      process.exitCode = 3;
    }
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${colorize("fatal:", "fail")} ${message}\n`);
  process.exitCode = 3;
});
