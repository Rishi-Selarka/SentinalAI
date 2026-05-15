import { streamChat, safeJson, type Domain } from "@/lib/openrouter";
import { factCheckerSystemPrompt } from "@/lib/jury/prompts";
import type { EmitFn } from "@/lib/jury/emit";
import type { JurorVerdict } from "@/lib/jury/types";

const FALLBACK: JurorVerdict = {
  verdict: "uncertain",
  confidence: 0,
  summary: "Fact-checker failed to produce a verdict.",
  evidence: [],
  issues: [],
};

export async function runFactChecker(opts: {
  prompt: string;
  answer: string;
  domain: Domain;
  iteration: number;
  emit: EmitFn;
}): Promise<JurorVerdict> {
  const { prompt, answer, domain, iteration, emit } = opts;
  emit({ type: "agent:start", agent: "factChecker", iteration });

  const userMsg = `User question:\n${prompt}\n\nGenerator's answer to verify:\n${answer}\n\nSearch the web for each factual claim. Return JSON only.`;

  let full = "";
  try {
    for await (const delta of streamChat({
      agent: "factChecker",
      temperature: 0.1,
      maxTokens: 900,
      messages: [
        { role: "system", content: factCheckerSystemPrompt(domain) },
        { role: "user", content: userMsg },
      ],
    })) {
      full += delta;
      emit({ type: "agent:token", agent: "factChecker", delta, iteration });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const verdict: JurorVerdict = {
      ...FALLBACK,
      summary: `Fact-checker call failed: ${message}`,
    };
    emit({ type: "agent:verdict", agent: "factChecker", verdict, iteration });
    return verdict;
  }

  const parsed = safeJson<Partial<JurorVerdict>>(full, FALLBACK);
  const verdict: JurorVerdict = {
    verdict: parsed.verdict ?? "uncertain",
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    evidence: parsed.evidence ?? [],
    issues: parsed.issues ?? [],
    summary: parsed.summary,
  };
  emit({ type: "agent:verdict", agent: "factChecker", verdict, iteration });
  return verdict;
}
