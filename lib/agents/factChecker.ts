import { streamChat, type Domain } from "@/lib/openrouter";
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

// Perplexity/sonar often wraps JSON in prose/citations or gets truncated
// mid-object. Parse defensively: direct, trim-to-last-brace, then
// brace-balance a truncated stream.
function parseVerdictJson(raw: string): Partial<JurorVerdict> | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : trimmed;
  const start = body.indexOf("{");
  if (start === -1) return null;
  const cand = body.slice(start);

  const attempts: string[] = [cand];
  const lastBrace = cand.lastIndexOf("}");
  if (lastBrace > 0) attempts.push(cand.slice(0, lastBrace + 1));
  let depth = 0;
  for (const ch of cand) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }
  if (depth > 0) {
    const repaired =
      cand.replace(/,\s*$/, "").replace(/:\s*"[^"]*$/, ': ""') +
      "}".repeat(depth);
    attempts.push(repaired);
  }
  for (const a of attempts) {
    try {
      const obj = JSON.parse(a) as Partial<JurorVerdict>;
      if (obj && (obj.verdict || obj.summary || obj.evidence)) return obj;
    } catch {
      /* try next */
    }
  }
  return null;
}

// If no JSON at all, salvage a signal from the prose so a whole juror
// isn't silently lost — without poisoning the aggregate.
function salvageFromProse(raw: string): JurorVerdict {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) {
    return {
      verdict: "uncertain",
      confidence: 0,
      summary: "Fact-Checker returned no usable response.",
      evidence: [],
      issues: [],
    };
  }
  const negative =
    /\b(incorrect|wrong|false|outdated|deprecated|removed|does not exist|doesn'?t exist|hallucinat|not accurate|inaccurate|misleading|no longer)\b/i.test(
      text
    );
  return {
    verdict: negative ? "fail" : "pass",
    confidence: negative ? 0.5 : 0.45,
    evidence: [text.slice(0, 400)],
    issues: negative
      ? [{ severity: "med", message: text.slice(0, 280) }]
      : [],
    summary: negative
      ? "Fact-Checker flagged possible inaccuracies (response was unstructured)."
      : "Fact-Checker found no contradicting evidence (response was unstructured).",
  };
}

export async function runFactChecker(opts: {
  prompt: string;
  answer: string;
  domain: Domain;
  iteration: number;
  emit: EmitFn;
  fast?: boolean;
}): Promise<JurorVerdict> {
  const { prompt, answer, domain, iteration, emit, fast } = opts;
  emit({ type: "agent:start", agent: "factChecker", iteration });

  const userMsg = `User question:\n${prompt}\n\nGenerator's answer to verify:\n${answer}\n\nSearch the web for each factual claim. Return JSON only.`;

  let full = "";
  try {
    for await (const delta of streamChat({
      agent: "factChecker",
      fast,
      temperature: 0.1,
      maxTokens: 1500,
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

  const parsed = parseVerdictJson(full);
  const verdict: JurorVerdict = parsed
    ? {
        verdict: parsed.verdict ?? "uncertain",
        confidence:
          typeof parsed.confidence === "number" ? parsed.confidence : 0.4,
        evidence: parsed.evidence ?? [],
        issues: parsed.issues ?? [],
        summary: parsed.summary,
      }
    : salvageFromProse(full);
  emit({ type: "agent:verdict", agent: "factChecker", verdict, iteration });
  return verdict;
}
