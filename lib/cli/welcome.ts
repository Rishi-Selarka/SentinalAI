import { homedir } from "node:os";
import { colorize } from "./ansi";

function abbreviateHome(p: string): string {
  const home = homedir();
  return p.startsWith(home) ? "~" + p.slice(home.length) : p;
}

const COMMANDS: { cmd: string; args: string; desc: string }[] = [
  { cmd: "/trial", args: '"<question>"', desc: "put an AI answer on trial" },
  { cmd: "/review", args: "<file|dir|glob>", desc: "find real bugs in code" },
  { cmd: "/example", args: "<id>", desc: "run a seeded trick case" },
  { cmd: "/examples", args: "", desc: "list seeded cases" },
  { cmd: "/repl", args: "", desc: "interactive session" },
  { cmd: "/doctor", args: "", desc: "verify API keys" },
];

const JURY_LINES = [
  "generator·claude-sonnet  critic·gpt-4o  facts·perplexity",
  "code·deepseek+e2b  math·deepseek  standards·claude-haiku",
];

const WIDTH = 64;

export function renderBanner(opts: { cwd: string; version: string }): string {
  const lines: string[] = [];
  const r = colorize("─".repeat(WIDTH), "powder");

  lines.push("");
  lines.push(r);
  lines.push(
    "  " +
      colorize("◆", "powder") +
      "  " +
      colorize("SentinelAI", "powder") +
      "  " +
      colorize(`v${opts.version}`, "powderDim")
  );
  lines.push("     " + colorize("The AI Hallucination Juror", "muted"));
  lines.push(
    "     " + colorize("7-agent jury · OpenRouter + E2B sandbox", "muted")
  );
  lines.push("     " + colorize(abbreviateHome(opts.cwd), "powderDim"));
  lines.push(r);
  lines.push("");
  lines.push("  " + colorize("commands", "muted"));
  for (const { cmd, args, desc } of COMMANDS) {
    const left = `${cmd} ${args}`.padEnd(26);
    const colored =
      "    " +
      colorize(cmd, "powder") +
      colorize(left.slice(cmd.length), "muted") +
      colorize(desc, "text");
    lines.push(colored);
  }
  lines.push("");
  lines.push("  " + colorize("jury", "muted"));
  for (const jl of JURY_LINES) {
    lines.push("    " + colorize(jl, "powderDim"));
  }
  lines.push(r);
  lines.push(
    "  " +
      colorize("tip:", "muted") +
      " " +
      colorize("sentinelai review src/", "powder") +
      colorize("  reviews a whole directory and exits non-zero on bugs", "muted")
  );
  lines.push("");

  return lines.join("\n");
}

export function printBanner(opts: { cwd: string; version: string }): void {
  process.stdout.write(renderBanner(opts) + "\n");
}
