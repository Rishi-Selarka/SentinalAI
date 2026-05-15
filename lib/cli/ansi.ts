const ESC = "[";

export type Color =
  | "reset"
  | "dim"
  | "bold"
  | "text"
  | "muted"
  | "accent"
  | "ok"
  | "fail"
  | "warn"
  | "info"
  | "powder"
  | "powderDim";

const CODES: Record<Color, string> = {
  reset: "0",
  dim: "2",
  bold: "1",
  text: "39",
  muted: "38;5;247",
  accent: "38;5;173",
  ok: "38;5;100",
  fail: "38;5;131",
  warn: "38;5;136",
  info: "38;5;67",
  powder: "38;5;153",
  powderDim: "38;5;152",
};

let colorEnabled = true;

export function setColor(enabled: boolean): void {
  colorEnabled = enabled;
}

export function colorize(text: string, color: Color): string {
  if (!colorEnabled) return text;
  return `${ESC}${CODES[color]}m${text}${ESC}${CODES.reset}m`;
}

export function c(color: Color) {
  return (text: string) => colorize(text, color);
}

const PREFIX_WIDTH = 13;

export function prefix(label: string): string {
  const padded = label.padEnd(PREFIX_WIDTH).slice(0, PREFIX_WIDTH);
  return colorize(`[${padded}]`, "muted");
}

const AGENT_PREFIX: Record<string, string> = {
  generator: "generator",
  critic: "critic",
  factChecker: "fact-check",
  codeExecutor: "code-exec",
  math: "math",
  standards: "standards",
  aggregator: "judge",
};

export function agentPrefix(agent: string): string {
  return prefix(AGENT_PREFIX[agent] ?? agent);
}

export function systemPrefix(label: string): string {
  return colorize(`[${label.padEnd(PREFIX_WIDTH).slice(0, PREFIX_WIDTH)}]`, "accent");
}

export function bar(value: number, width = 10): string {
  const v = Math.max(0, Math.min(1, value));
  const filled = Math.round(v * width);
  const full = "█".repeat(filled);
  const empty = "░".repeat(width - filled);
  return `[${full}${empty}]`;
}

export function rule(width = 60): string {
  return colorize("─".repeat(width), "muted");
}

export function banner(line: string): string {
  return colorize(line, "accent");
}
