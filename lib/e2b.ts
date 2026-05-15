import { Sandbox } from "@e2b/code-interpreter";

export type SandboxResult = {
  stdout: string;
  stderr: string;
  error?: string;
  durationMs: number;
};

export async function runPython(code: string, timeoutMs = 20_000): Promise<SandboxResult> {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey || apiKey.startsWith("e2b_...")) {
    return {
      stdout: "",
      stderr: "",
      error: "E2B_API_KEY is not configured — skipping live execution.",
      durationMs: 0,
    };
  }
  const start = Date.now();
  let sandbox: Sandbox | undefined;
  try {
    sandbox = await Sandbox.create({ apiKey, timeoutMs: 60_000 });
    const exec = await sandbox.runCode(code, { timeoutMs });
    const stdout = exec.logs.stdout.join("");
    const stderr = exec.logs.stderr.join("");
    const errorMsg = exec.error
      ? `${exec.error.name}: ${exec.error.value}\n${exec.error.traceback ?? ""}`
      : undefined;
    return {
      stdout,
      stderr,
      error: errorMsg,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      stdout: "",
      stderr: "",
      error: `Sandbox failure: ${message}`,
      durationMs: Date.now() - start,
    };
  } finally {
    if (sandbox) {
      try {
        await sandbox.kill();
      } catch {
        /* swallow */
      }
    }
  }
}

export function extractCodeBlock(text: string, lang?: string): string | null {
  if (lang) {
    // Match a fence explicitly tagged with this language.
    const re = new RegExp("```(?:" + lang + ")[ \\t]*\\r?\\n([\\s\\S]*?)```", "i");
    const m = text.match(re);
    return m ? m[1].trim() : null;
  }
  // Untagged fence only: ``` followed by optional spaces then a newline.
  // Deliberately does NOT match ```yaml / ```json / ```bash etc.
  const m = text.match(/```[ \t]*\r?\n([\s\S]*?)```/);
  return m ? m[1].trim() : null;
}

// Lightweight sniff so an untagged or mislabeled block that is clearly
// not Python (YAML, JSON, shell, Dockerfile, …) is never executed.
function looksLikePython(code: string): boolean {
  if (!code.trim()) return false;
  const pyHints =
    /\b(def |class |import |from \w+ import |print\(|if __name__|return |lambda |async def )/;
  if (pyHints.test(code)) return true;
  // Strong non-Python signals.
  const yamlish = /^[ \t]*[\w.-]+:\s*($|\S)/m; // key: value lines
  const looksYaml =
    yamlish.test(code) && !/[=;{}]|def |import /.test(code.split("\n")[0] ?? "");
  if (looksYaml) return false;
  if (/^\s*[{[]/.test(code) && /[}\]]\s*$/.test(code)) return false; // JSON
  if (/^\s*#!\s*\/(bin|usr)/.test(code)) return false; // shebang script
  return true; // ambiguous → allow (Python is the default target)
}

export function extractAnyPython(text: string): string | null {
  for (const lang of ["python3", "python", "py"]) {
    const block = extractCodeBlock(text, lang);
    if (block) return block;
  }
  const untagged = extractCodeBlock(text);
  if (untagged && looksLikePython(untagged)) return untagged;
  return null;
}
