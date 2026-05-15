import { chat, safeJson, type AgentId } from "@/lib/openrouter";
import { aggregatorSystemPrompt } from "./prompts";
import type { FinalLabel, JurorVerdict } from "./types";

const WEIGHTS: Record<AgentId, number> = {
  generator: 0,
  critic: 0.8,
  factChecker: 1.2,
  codeExecutor: 1.5,
  math: 1.5,
  standards: 1.0,
  aggregator: 0,
};

const SIGN: Record<JurorVerdict["verdict"], number> = {
  pass: 1,
  fail: -1,
  uncertain: 0,
};

export function computeScore(verdicts: Record<string, JurorVerdict>): number {
  let sum = 0;
  for (const [agent, v] of Object.entries(verdicts)) {
    const w = WEIGHTS[agent as AgentId] ?? 0;
    sum += w * v.confidence * SIGN[v.verdict];
  }
  return Number(sum.toFixed(3));
}

export function shouldRetry(
  score: number,
  verdicts: Record<string, JurorVerdict>,
): boolean {
  if (score >= 0) return false;
  return Object.values(verdicts).some(
    (v) => v.verdict === "fail" && v.confidence > 0.6,
  );
}

export type AggregatorOutput = {
  label: FinalLabel;
  score: number;
  summary: string;
  revisionBrief: string;
};

export async function runAggregator(opts: {
  prompt: string;
  answer: string;
  verdicts: Record<string, JurorVerdict>;
  iteration: number;
  maxIterations: number;
  fast?: boolean;
}): Promise<AggregatorOutput> {
  const { prompt, answer, verdicts, iteration, maxIterations, fast } = opts;
  const score = computeScore(verdicts);

  // Decide preliminary label from score + retry budget. The LLM only renders
  // a human summary + revision brief that the orchestrator can act on.
  let label: FinalLabel;
  if (score >= 1.5) {
    label = "TRUSTED";
  } else if (shouldRetry(score, verdicts) && iteration < maxIterations) {
    label = "REVISED"; // tentative — will be re-applied after next round
  } else if (score < 0) {
    label = "HALLUCINATION";
  } else if (iteration > 1) {
    // Survived at least one retry already; ship the corrected answer.
    label = "REVISED";
  } else {
    label = score < 0.5 ? "HALLUCINATION" : "TRUSTED";
  }

  const verdictsBlock = Object.entries(verdicts)
    .map(
      ([agent, v]) =>
        `- ${agent}: ${v.verdict} (conf ${v.confidence.toFixed(2)}) — ${
          v.summary ?? "no summary"
        }; issues=${v.issues
          .map((i) => `[${i.severity}] ${i.message}`)
          .join(" | ")}`,
    )
    .join("\n");

  const userMsg = `User prompt:\n${prompt}\n\nCurrent generator answer:\n${answer}\n\nJuror verdicts:\n${verdictsBlock}\n\nComputed score: ${score}\nPreliminary label: ${label}\nIteration: ${iteration} / ${maxIterations}\n\nReturn JSON: { "label": "...", "summary": "...", "revisionBrief": "..." }`;

  let raw = "";
  try {
    raw = await chat({
      agent: "aggregator",
      fast,
      temperature: 0,
      maxTokens: 600,
      responseFormat: { type: "json_object" },
      messages: [
        { role: "system", content: aggregatorSystemPrompt() },
        { role: "user", content: userMsg },
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      label,
      score,
      summary: `Aggregator LLM call failed (${message}). Falling back to deterministic verdict.`,
      revisionBrief: "",
    };
  }

  const parsed = safeJson<{ label?: FinalLabel; summary?: string; revisionBrief?: string }>(
    raw,
    {},
  );
  return {
    label: parsed.label ?? label,
    score,
    summary: parsed.summary ?? "No summary.",
    revisionBrief: parsed.revisionBrief ?? "",
  };
}
