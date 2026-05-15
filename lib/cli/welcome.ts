import { homedir } from "node:os";
import { colorize, type Color } from "./ansi";

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

const BOX_W = 64; // total visible width
const INNER = BOX_W - 4; // "│ " + inner + " │"

type Seg = { t: string; c?: Color };

function boxLine(segs: Seg[]): string {
  const plainLen = segs.reduce((n, s) => n + s.t.length, 0);
  const pad = plainLen < INNER ? " ".repeat(INNER - plainLen) : "";
  const body = segs.map((s) => (s.c ? colorize(s.t, s.c) : s.t)).join("") + pad;
  const bar = colorize("│", "powder");
  return `${bar} ${body} ${bar}`;
}

function boxTop(): string {
  return colorize("╭" + "─".repeat(BOX_W - 2) + "╮", "powder");
}
function boxBottom(): string {
  return colorize("╰" + "─".repeat(BOX_W - 2) + "╯", "powder");
}
function boxRule(): string {
  const bar = colorize("│", "powder");
  return `${bar} ${colorize("·".repeat(INNER), "powderDim")} ${bar}`;
}

// Stacked-block emblem (a stylized shield/gavel mark) — renders in any
// monospace font, no emoji width surprises.
const EMBLEM = [
  "  ▟██▙  ",
  " ▟████▙ ",
  " ▜████▛ ",
  "  ▜██▛  ",
];

const WORDMARK = "S E N T I N E L · A I";

export function renderBanner(opts: { cwd: string; version: string }): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(boxTop());
  lines.push(boxLine([{ t: "" }]));

  // Emblem (left) beside the wordmark + meta (right), four rows tall.
  const rightCol: Seg[][] = [
    [{ t: WORDMARK, c: "powder" }],
    [{ t: "The AI Hallucination Juror", c: "muted" }],
    [{ t: "7-agent jury · OpenRouter + E2B sandbox", c: "muted" }],
    [{ t: `v${opts.version}`, c: "powderDim" }],
  ];
  for (let i = 0; i < EMBLEM.length; i++) {
    lines.push(
      boxLine([
        { t: " " },
        { t: EMBLEM[i], c: "powder" },
        { t: "  " },
        ...rightCol[i],
      ])
    );
  }

  lines.push(boxLine([{ t: "" }]));
  lines.push(boxRule());
  lines.push(boxLine([{ t: "" }]));
  lines.push(boxLine([{ t: "commands", c: "muted" }]));
  for (const { cmd, args, desc } of COMMANDS) {
    const left = `${cmd} ${args}`;
    const leftPad = left.padEnd(24).slice(left.length);
    lines.push(
      boxLine([
        { t: "  " },
        { t: cmd, c: "powder" },
        { t: left.slice(cmd.length) + leftPad, c: "muted" },
        { t: desc, c: "text" },
      ])
    );
  }
  lines.push(boxLine([{ t: "" }]));
  lines.push(boxBottom());
  lines.push(
    "  " +
      colorize("tip", "muted") +
      "  " +
      colorize("sentinelai review src/", "powder") +
      colorize("  scans a directory and exits non-zero on bugs", "muted")
  );
  lines.push("  " + colorize(abbreviateHome(opts.cwd), "powderDim"));
  lines.push("");

  return lines.join("\n");
}

export function printBanner(opts: { cwd: string; version: string }): void {
  process.stdout.write(renderBanner(opts) + "\n");
}
