import { streamChat, safeJson, type Domain } from "@/lib/openrouter";
import { standardsSystemPrompt } from "@/lib/jury/prompts";
import { corpusBlock } from "@/lib/standards/corpus";
import type { EmitFn } from "@/lib/jury/emit";
import type { JurorVerdict } from "@/lib/jury/types";

const FALLBACK: JurorVerdict = {
  verdict: "uncertain",
  confidence: 0,
  summary: "Standards Verifier produced no verdict.",
  evidence: [],
  issues: [],
};

export async function runStandardsVerifier(opts: {
  prompt: string;
  answer: string;
  domain: Domain;
  iteration: number;
  emit: EmitFn;
}): Promise<JurorVerdict> {
  const { prompt, answer, domain, iteration, emit } = opts;
  emit({ type: "agent:start", agent: "standards", iteration });

  const corpus = corpusBlock(domain);
  const userMsg = `User question:\n${prompt}\n\nGenerator's answer:\n${answer}\n\nAuthoritative standards corpus (treat as ground truth — anything the answer claims that contradicts these excerpts is a fail):\n${corpus}\n\nReturn JSON only.`;

  let full = "";
  try {
    for await (const delta of streamChat({
      agent: "standards",
      temperature: 0.1,
      maxTokens: 800,
      messages: [
        { role: "system", content: standardsSystemPrompt(domain) },
        { role: "user", content: userMsg },
      ],
    })) {
      full += delta;
      emit({ type: "agent:token", agent: "standards", delta, iteration });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const verdict: JurorVerdict = {
      ...FALLBACK,
      summary: `Standards Verifier call failed: ${message}`,
    };
    emit({ type: "agent:verdict", agent: "standards", verdict, iteration });
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
  emit({ type: "agent:verdict", agent: "standards", verdict, iteration });
  return verdict;
}
