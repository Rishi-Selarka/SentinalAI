import { streamChat, safeJson, type Domain } from "@/lib/openrouter";
import { codeExecutorSystemPrompt } from "@/lib/jury/prompts";
import { extractAnyPython, runPython } from "@/lib/e2b";
import type { EmitFn } from "@/lib/jury/emit";
import type { JurorVerdict } from "@/lib/jury/types";

const FALLBACK: JurorVerdict = {
  verdict: "uncertain",
  confidence: 0,
  summary: "Code Executor could not produce a verdict.",
  evidence: [],
  issues: [],
};

export async function runCodeExecutor(opts: {
  prompt: string;
  answer: string;
  domain: Domain;
  iteration: number;
  emit: EmitFn;
}): Promise<JurorVerdict> {
  const { prompt, answer, domain, iteration, emit } = opts;
  emit({ type: "agent:start", agent: "codeExecutor", iteration });

  const code = extractAnyPython(answer);
  if (!code) {
    const verdict: JurorVerdict = {
      verdict: "uncertain",
      confidence: 0.3,
      summary: "No runnable Python code block detected in the answer.",
      evidence: ["No fenced Python block was found in the generator's response."],
      issues: [],
    };
    emit({ type: "agent:token", agent: "codeExecutor", delta: verdict.summary + "\n", iteration });
    emit({ type: "agent:verdict", agent: "codeExecutor", verdict, iteration });
    return verdict;
  }

  emit({
    type: "agent:token",
    agent: "codeExecutor",
    delta: "Running extracted Python in sandbox...\n",
    iteration,
  });

  const result = await runPython(code);

  const transcript =
    `# Source\n${code}\n\n# stdout\n${result.stdout || "(empty)"}\n\n# stderr\n${result.stderr || "(empty)"}\n` +
    (result.error ? `\n# error\n${result.error}\n` : "") +
    `\n# duration_ms\n${result.durationMs}`;

  emit({
    type: "agent:token",
    agent: "codeExecutor",
    delta: `\nExecution finished in ${result.durationMs}ms.\n`,
    iteration,
  });

  const userMsg = `User question:\n${prompt}\n\nGenerator answer:\n${answer}\n\nSandbox transcript:\n${transcript}\n\nReturn JSON only.`;

  let full = "";
  try {
    for await (const delta of streamChat({
      agent: "codeExecutor",
      temperature: 0.1,
      maxTokens: 800,
      messages: [
        { role: "system", content: codeExecutorSystemPrompt(domain) },
        { role: "user", content: userMsg },
      ],
    })) {
      full += delta;
      emit({ type: "agent:token", agent: "codeExecutor", delta, iteration });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const verdict: JurorVerdict = {
      ...FALLBACK,
      summary: `Code Executor LLM step failed: ${message}`,
      evidence: result.error ? [result.error] : [],
    };
    emit({ type: "agent:verdict", agent: "codeExecutor", verdict, iteration });
    return verdict;
  }

  const parsed = safeJson<Partial<JurorVerdict>>(full, FALLBACK);
  const evidence = [...(parsed.evidence ?? [])];
  if (result.error) evidence.unshift(`sandbox error: ${result.error}`);
  if (result.stderr) evidence.push(`stderr: ${result.stderr.slice(0, 400)}`);
  if (result.stdout) evidence.push(`stdout: ${result.stdout.slice(0, 400)}`);

  const verdict: JurorVerdict = {
    verdict: parsed.verdict ?? (result.error ? "fail" : "uncertain"),
    confidence:
      typeof parsed.confidence === "number"
        ? parsed.confidence
        : result.error
        ? 0.85
        : 0.4,
    evidence,
    issues: parsed.issues ?? [],
    summary: parsed.summary,
  };
  emit({ type: "agent:verdict", agent: "codeExecutor", verdict, iteration });
  return verdict;
}
