import { createInterface } from "node:readline";
import type { Domain } from "@/lib/openrouter";
import {
  cmdExample,
  cmdExamples,
  cmdReview,
  cmdTrial,
  parseDomain,
} from "./commands";
import { colorize, systemPrefix } from "./ansi";
import { printBanner } from "./welcome";
import type { RenderMode } from "./render";

const HELP = `
commands (the leading / is optional):
  /trial <prompt>            run the jury on a free-form prompt
  /review <file|dir|glob>    scan code for bugs (e.g. /review src/app.py)
  /example <id>              run a pre-seeded case (try: /examples)
  /examples                  list seeded cases
  /domain <s|e|m|f>          change default domain
  /json on|off               toggle NDJSON output mode
  /clear                     clear the screen
  /help                      this message
  /exit                      leave repl (or ctrl-d)
`;

export async function runRepl(initial: {
  domain: Domain;
  mode: RenderMode;
  version?: string;
}): Promise<number> {
  let domain = initial.domain;
  let mode = initial.mode;
  let lastPrompt = "";

  printBanner({ cwd: process.cwd(), version: initial.version ?? "0.1.0" });
  process.stdout.write(
    colorize("  interactive mode · type /help · ctrl-d to exit", "muted") + "\n\n"
  );

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: colorize("> ", "accent"),
  });

  rl.prompt();

  for await (const raw of rl) {
    const line = raw.trim();
    if (!line) {
      rl.prompt();
      continue;
    }
    const [rawCmd, ...rest] = line.split(/\s+/);
    const cmd = rawCmd.replace(/^\//, "");
    const argText = line.slice(rawCmd.length).trim();

    try {
      if (cmd === "exit" || cmd === "quit") {
        rl.close();
        break;
      } else if (cmd === "help" || cmd === "?") {
        process.stdout.write(HELP + "\n");
      } else if (cmd === "clear") {
        process.stdout.write("\x1b[2J\x1b[H");
      } else if (cmd === "examples") {
        cmdExamples();
      } else if (cmd === "domain") {
        if (!rest[0]) {
          process.stdout.write(
            `${systemPrefix("domain")} current: ${colorize(domain, "accent")}\n`
          );
        } else {
          domain = parseDomain(rest[0], domain);
          process.stdout.write(
            `${systemPrefix("domain")} set to ${colorize(domain, "accent")}\n`
          );
        }
      } else if (cmd === "json") {
        if (rest[0] === "on") mode = "json";
        else if (rest[0] === "off") mode = "ansi";
        process.stdout.write(
          `${systemPrefix("json")} ${colorize(mode === "json" ? "on" : "off", "accent")}\n`
        );
      } else if (cmd === "example") {
        if (!rest[0]) {
          process.stdout.write(
            `${systemPrefix("usage")} example <id>  ·  try: examples\n`
          );
        } else {
          rl.pause();
          await cmdExample({ id: rest[0], mode, domainOverride: domain });
          rl.resume();
        }
      } else if (cmd === "review") {
        if (!rest.length) {
          process.stdout.write(
            `${systemPrefix("usage")} review <file|dir|glob|-> [more paths...]\n`
          );
        } else {
          rl.pause();
          await cmdReview({ paths: rest, domain, mode });
          rl.resume();
        }
      } else if (cmd === "trial") {
        if (!argText) {
          process.stdout.write(`${systemPrefix("usage")} trial <prompt>\n`);
        } else {
          lastPrompt = argText;
          rl.pause();
          await cmdTrial({ prompt: argText, domain, mode });
          rl.resume();
        }
      } else if (cmd === "retry") {
        if (!lastPrompt) {
          process.stdout.write(`${systemPrefix("retry")} no previous prompt\n`);
        } else {
          rl.pause();
          await cmdTrial({ prompt: lastPrompt, domain, mode });
          rl.resume();
        }
      } else {
        process.stdout.write(
          `${systemPrefix("?")} unknown command: ${colorize(cmd, "fail")} (try: help)\n`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stdout.write(`${systemPrefix("error")} ${colorize(message, "fail")}\n`);
    }

    rl.prompt();
  }

  process.stdout.write(colorize("\nbye.\n", "muted"));
  return 0;
}
