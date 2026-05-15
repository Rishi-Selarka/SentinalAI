import { readFile, readdir, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { extname, basename, relative, resolve, join } from "node:path";

export type ReviewInput = {
  path: string;          // absolute or "<stdin>"
  display: string;       // short label for UI
  lang: string;          // markdown fence tag
  langName: string;      // human-readable
  bytes: number;
  content: string;
  runnable: boolean;     // true => Code Executor can run it in E2B (currently: python only)
};

export type CollectOptions = {
  maxBytes?: number;     // per-file cap, default 50KB
  cwd?: string;
};

const DEFAULT_MAX_BYTES = 50 * 1024;

const LANG_BY_EXT: Record<string, { lang: string; name: string; runnable?: boolean }> = {
  ".py": { lang: "python", name: "Python", runnable: true },
  ".pyw": { lang: "python", name: "Python", runnable: true },
  ".ipynb": { lang: "json", name: "Jupyter Notebook" },
  ".js": { lang: "javascript", name: "JavaScript" },
  ".mjs": { lang: "javascript", name: "JavaScript" },
  ".cjs": { lang: "javascript", name: "JavaScript" },
  ".ts": { lang: "typescript", name: "TypeScript" },
  ".tsx": { lang: "tsx", name: "TypeScript JSX" },
  ".jsx": { lang: "jsx", name: "JavaScript JSX" },
  ".go": { lang: "go", name: "Go" },
  ".rs": { lang: "rust", name: "Rust" },
  ".java": { lang: "java", name: "Java" },
  ".kt": { lang: "kotlin", name: "Kotlin" },
  ".rb": { lang: "ruby", name: "Ruby" },
  ".php": { lang: "php", name: "PHP" },
  ".c": { lang: "c", name: "C" },
  ".h": { lang: "c", name: "C header" },
  ".cpp": { lang: "cpp", name: "C++" },
  ".hpp": { lang: "cpp", name: "C++ header" },
  ".cs": { lang: "csharp", name: "C#" },
  ".swift": { lang: "swift", name: "Swift" },
  ".sh": { lang: "bash", name: "Shell" },
  ".bash": { lang: "bash", name: "Shell" },
  ".sql": { lang: "sql", name: "SQL" },
  ".yaml": { lang: "yaml", name: "YAML" },
  ".yml": { lang: "yaml", name: "YAML" },
  ".json": { lang: "json", name: "JSON" },
  ".toml": { lang: "toml", name: "TOML" },
  ".html": { lang: "html", name: "HTML" },
  ".css": { lang: "css", name: "CSS" },
  ".md": { lang: "markdown", name: "Markdown" },
};

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", ".venv", "venv",
  "__pycache__", ".pytest_cache", ".turbo", "coverage", ".cache",
]);

const SKIP_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock",
  "poetry.lock", "Gemfile.lock", "uv.lock",
]);

function detectLang(path: string): { lang: string; name: string; runnable: boolean } {
  const ext = extname(path).toLowerCase();
  const hit = LANG_BY_EXT[ext];
  if (!hit) return { lang: "text", name: "Plain text", runnable: false };
  return { lang: hit.lang, name: hit.name, runnable: hit.runnable ?? false };
}

function looksBinary(buf: string): boolean {
  // null byte in first 8KB == binary
  const slice = buf.slice(0, 8192);
  return slice.indexOf("\0") !== -1;
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function walkDir(root: string): Promise<string[]> {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        if (SKIP_FILES.has(entry.name)) continue;
        const ext = extname(entry.name).toLowerCase();
        if (!(ext in LANG_BY_EXT)) continue;
        out.push(full);
      }
    }
  }
  return out;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|\\]/g, "\\$&");
  const re = escaped
    .replace(/\*\*/g, "\x00\x00")
    .replace(/\*/g, "[^/]*")
    .replace(/\x00\x00/g, ".*")
    .replace(/\?/g, "[^/]");
  return new RegExp(`^${re}$`);
}

async function expandGlob(pattern: string, cwd: string): Promise<string[]> {
  // Find the deepest fixed root segment (before any *, ?, [).
  const parts = pattern.split("/");
  const fixed: string[] = [];
  for (const part of parts) {
    if (/[*?[]/.test(part)) break;
    fixed.push(part);
  }
  const rootRel = fixed.join("/") || ".";
  const root = resolve(cwd, rootRel);
  let isDir = false;
  try {
    isDir = (await stat(root)).isDirectory();
  } catch {
    return [];
  }
  if (!isDir) return [root];
  const all = await walkDir(root);
  const re = globToRegex(pattern);
  return all.filter((abs) => {
    const rel = relative(cwd, abs);
    return re.test(rel) || re.test(rel.split("/").slice(fixed.length).join("/"));
  });
}

async function expandPath(input: string, cwd: string): Promise<string[]> {
  if (input.includes("*") || input.includes("?") || input.includes("[")) {
    return expandGlob(input, cwd);
  }
  const abs = resolve(cwd, input);
  try {
    const s = await stat(abs);
    if (s.isDirectory()) {
      return walkDir(abs);
    }
    return [abs];
  } catch {
    throw new Error(`path not found: ${input}`);
  }
}

export async function collectInputs(
  paths: string[],
  opts: CollectOptions = {}
): Promise<{ inputs: ReviewInput[]; skipped: { path: string; reason: string }[] }> {
  const cwd = opts.cwd ?? process.cwd();
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const skipped: { path: string; reason: string }[] = [];
  const inputs: ReviewInput[] = [];

  for (const raw of paths) {
    if (raw === "-") {
      const content = await readStdin();
      if (!content.trim()) {
        skipped.push({ path: "<stdin>", reason: "empty" });
        continue;
      }
      inputs.push({
        path: "<stdin>",
        display: "<stdin>",
        lang: "text",
        langName: "Plain text",
        bytes: Buffer.byteLength(content, "utf8"),
        content,
        runnable: false,
      });
      continue;
    }

    let expanded: string[];
    try {
      expanded = await expandPath(raw, cwd);
    } catch (err) {
      skipped.push({ path: raw, reason: (err as Error).message });
      continue;
    }

    if (!expanded.length) {
      skipped.push({ path: raw, reason: "no matching files" });
      continue;
    }

    for (const abs of expanded) {
      try {
        const buf = await readFile(abs);
        const bytes = buf.length;
        if (bytes === 0) {
          skipped.push({ path: abs, reason: "empty" });
          continue;
        }
        const content = buf.toString("utf8");
        if (looksBinary(content)) {
          skipped.push({ path: abs, reason: "binary file" });
          continue;
        }
        if (bytes > maxBytes) {
          skipped.push({
            path: abs,
            reason: `${bytes} bytes > limit ${maxBytes} (raise with --max-size)`,
          });
          continue;
        }
        const detected = detectLang(abs);
        inputs.push({
          path: abs,
          display: relative(cwd, abs) || basename(abs),
          lang: detected.lang,
          langName: detected.name,
          bytes,
          content: content.replace(/﻿/, ""),
          runnable: detected.runnable,
        });
      } catch (err) {
        skipped.push({ path: abs, reason: (err as Error).message });
      }
    }
  }

  return { inputs, skipped };
}

export function buildReviewPrompt(input: ReviewInput): string {
  const quoteInstruction = input.runnable
    ? `1. First, repeat the entire file verbatim inside a fenced \`\`\`${input.lang}\`\`\` block so the sandbox can re-execute it.
2. Then list every bug you find. For each bug give: line number(s), severity (low/med/high), what's wrong, and why it's wrong.
3. End with a one-line summary: clean, minor issues, or serious bugs.`
    : `1. List every bug you find. For each bug give: line number(s), severity (low/med/high), what's wrong, and why it's wrong.
2. End with a one-line summary: clean, minor issues, or serious bugs.`;

  return `You are reviewing the file \`${input.display}\` (${input.langName}) for bugs, errors, security issues, and obvious correctness problems.

${quoteInstruction}

Be precise and avoid false positives — flagging non-issues wastes reviewer time. If the file looks fine, say so plainly. Do not invent bugs to pad the report.

File contents:

\`\`\`${input.lang}
${input.content}
\`\`\`
`;
}

// Synchronous variant for use from non-async paths (e.g., bin args display)
export function readFileSyncSafe(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}
