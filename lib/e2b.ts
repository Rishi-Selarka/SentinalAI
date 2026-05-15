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
  const langPattern = lang ? `(?:${lang})` : `[a-zA-Z0-9_+-]*`;
  const re = new RegExp(`\`\`\`${langPattern}\\s*\\n([\\s\\S]*?)\`\`\``, "i");
  const match = text.match(re);
  return match ? match[1].trim() : null;
}

export function extractAnyPython(text: string): string | null {
  const candidates = ["python", "py", "python3", ""];
  for (const lang of candidates) {
    const block = extractCodeBlock(text, lang || undefined);
    if (block) return block;
  }
  return null;
}
