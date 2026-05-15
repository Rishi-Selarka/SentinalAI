import { evaluate } from "mathjs";
import { streamChat, safeJson, type Domain } from "@/lib/openrouter";
import { mathSystemPrompt } from "@/lib/jury/prompts";
import { runPython } from "@/lib/e2b";
import type { EmitFn } from "@/lib/jury/emit";
import type { JurorVerdict } from "@/lib/jury/types";

const FALLBACK: JurorVerdict = {
  verdict: "uncertain",
  confidence: 0,
  summary: "Math Verifier produced no verdict.",
  evidence: [],
  issues: [],
};

const EXPR_RE = /([0-9][0-9.\s+\-*/^()e]{2,}[0-9])/g;

function tryMathJs(answer: string): string[] {
  const found = new Set<string>();
  const lines: string[] = [];
  const matches = answer.match(EXPR_RE) ?? [];
  for (const raw of matches.slice(0, 8)) {
    const expr = raw.trim();
    if (found.has(expr) || expr.length < 5) continue;
    found.add(expr);
    try {
      const value = evaluate(expr);
      if (typeof value === "number" && Number.isFinite(value)) {
        lines.push(`mathjs eval: ${expr} = ${value}`);
      }
    } catch {
      /* swallow — not a valid expression */
    }
  }
  return lines;
}

const SYMPY_HARNESS = `
import math, json, sys
from sympy import symbols, simplify, sympify, Rational, N
try:
    notes = []
    # Re-run the most common engineering / finance closed-form checks.
    # If the user-question text contains numbers, the LLM will reason about
    # them; here we only surface a reproducible numerical environment.
    notes.append("python_version=" + sys.version.split()[0])
    print(json.dumps({"ok": True, "notes": notes}))
except Exception as exc:
    print(json.dumps({"ok": False, "error": repr(exc)}))
`;

export async function runMathVerifier(opts: {
  prompt: string;
  answer: string;
  domain: Domain;
  iteration: number;
  emit: EmitFn;
}): Promise<JurorVerdict> {
  const { prompt, answer, domain, iteration, emit } = opts;
  emit({ type: "agent:start", agent: "math", iteration });

  const mathjsEvidence = tryMathJs(answer);
  if (mathjsEvidence.length) {
    emit({
      type: "agent:token",
      agent: "math",
      delta: `Re-evaluated ${mathjsEvidence.length} expression(s) with mathjs.\n`,
      iteration,
    });
  }

  let sympyNote = "";
  if (domain === "engineering" || domain === "finance") {
    const py = await runPython(SYMPY_HARNESS, 12_000);
    if (py.stdout) sympyNote = `sympy harness: ${py.stdout.trim()}`;
    else if (py.error) sympyNote = `sympy harness error: ${py.error}`;
    if (sympyNote) {
      emit({
        type: "agent:token",
        agent: "math",
        delta: `${sympyNote}\n`,
        iteration,
      });
    }
  }

  const determEvidence = [...mathjsEvidence];
  if (sympyNote) determEvidence.push(sympyNote);

  const userMsg = `User question:\n${prompt}\n\nGenerator's answer:\n${answer}\n\nDeterministic re-evaluations:\n${
    determEvidence.length ? determEvidence.join("\n") : "(none extractable)"
  }\n\nReturn JSON only.`;

  let full = "";
  try {
    for await (const delta of streamChat({
      agent: "math",
      temperature: 0.1,
      maxTokens: 800,
      messages: [
        { role: "system", content: mathSystemPrompt(domain) },
        { role: "user", content: userMsg },
      ],
    })) {
      full += delta;
      emit({ type: "agent:token", agent: "math", delta, iteration });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const verdict: JurorVerdict = {
      ...FALLBACK,
      summary: `Math Verifier LLM step failed: ${message}`,
      evidence: determEvidence,
    };
    emit({ type: "agent:verdict", agent: "math", verdict, iteration });
    return verdict;
  }

  const parsed = safeJson<Partial<JurorVerdict>>(full, FALLBACK);
  const verdict: JurorVerdict = {
    verdict: parsed.verdict ?? "uncertain",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    evidence: [...determEvidence, ...(parsed.evidence ?? [])],
    issues: parsed.issues ?? [],
    summary: parsed.summary,
  };
  emit({ type: "agent:verdict", agent: "math", verdict, iteration });
  return verdict;
}
