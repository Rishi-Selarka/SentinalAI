import { streamChat, safeJson, type Domain } from "@/lib/openrouter";
import { criticSystemPrompt } from "@/lib/jury/prompts";
import type { EmitFn } from "@/lib/jury/emit";
import type { JurorVerdict } from "@/lib/jury/types";

const FALLBACK: JurorVerdict = {
  verdict: "uncertain",
  confidence: 0,
  summary: "Critic failed to produce a verdict.",
  evidence: [],
  issues: [],
};

export async function runCritic(opts: {
  prompt: string;
  answer: string;
  domain: Domain;
  iteration: number;
  emit: EmitFn;
}): Promise<JurorVerdict> {
  const { prompt, answer, domain, iteration, emit } = opts;
  emit({ type: "agent:start", agent: "critic", iteration });

  const userMsg = `User question:\n${prompt}\n\nGenerator's answer:\n${answer}\n\nReturn JSON only.`;

  let full = "";
  try {
    for await (const delta of streamChat({
      agent: "critic",
      temperature: 0.2,
      maxTokens: 800,
      messages: [
        { role: "system", content: criticSystemPrompt(domain) },
        { role: "user", content: userMsg },
      ],
    })) {
      full += delta;
      emit({ type: "agent:token", agent: "critic", delta, iteration });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const verdict: JurorVerdict = {
      ...FALLBACK,
      summary: `Critic call failed: ${message}`,
    };
    emit({ type: "agent:verdict", agent: "critic", verdict, iteration });
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
  emit({ type: "agent:verdict", agent: "critic", verdict, iteration });
  return verdict;
}
