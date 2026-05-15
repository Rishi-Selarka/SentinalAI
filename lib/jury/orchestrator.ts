import type { Domain } from "@/lib/openrouter";
import type { EmitFn } from "./emit";
import type { JurorVerdict } from "./types";
import { runGenerator } from "@/lib/agents/generator";
import { runCritic } from "@/lib/agents/critic";
import { runFactChecker } from "@/lib/agents/factChecker";
import { runCodeExecutor } from "@/lib/agents/codeExecutor";
import { runMathVerifier } from "@/lib/agents/math";
import { runStandardsVerifier } from "@/lib/agents/standards";
import { runAggregator, computeScore, shouldRetry } from "./aggregator";

const MAX_ITERATIONS = 3; // initial + up to 2 retries

export async function runTrial(opts: {
  prompt: string;
  domain: Domain;
  emit: EmitFn;
}) {
  const { prompt, domain, emit } = opts;
  emit({ type: "trial:start", prompt, domain });

  let iteration = 1;
  let revisionBrief: string | undefined;
  let answer = "";
  let finalSummary = "";
  let finalLabel: "TRUSTED" | "REVISED" | "HALLUCINATION" = "HALLUCINATION";
  let finalScore = 0;

  try {
    while (iteration <= MAX_ITERATIONS) {
      answer = await runGenerator({
        prompt,
        domain,
        revisionBrief,
        iteration,
        emit,
      });

      const jurorResults = await Promise.all([
        runCritic({ prompt, answer, domain, iteration, emit }),
        runFactChecker({ prompt, answer, domain, iteration, emit }),
        runCodeExecutor({ prompt, answer, domain, iteration, emit }),
        runMathVerifier({ prompt, answer, domain, iteration, emit }),
        runStandardsVerifier({ prompt, answer, domain, iteration, emit }),
      ]);

      const verdicts: Record<string, JurorVerdict> = {
        critic: jurorResults[0],
        factChecker: jurorResults[1],
        codeExecutor: jurorResults[2],
        math: jurorResults[3],
        standards: jurorResults[4],
      };

      const score = computeScore(verdicts);
      const aggregate = await runAggregator({
        prompt,
        answer,
        verdicts,
        iteration,
        maxIterations: MAX_ITERATIONS,
      });
      finalScore = aggregate.score;
      finalSummary = aggregate.summary;

      const retry =
        iteration < MAX_ITERATIONS && shouldRetry(score, verdicts);

      if (retry) {
        const brief =
          aggregate.revisionBrief ||
          fallbackRevisionBrief(verdicts);
        emit({
          type: "jury:retry",
          iteration,
          brief,
          score,
        });
        revisionBrief = brief;
        iteration += 1;
        continue;
      }

      finalLabel = aggregate.label;
      break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({ type: "trial:error", message });
    emit({ type: "trial:end" });
    return;
  }

  emit({
    type: "jury:final",
    label: finalLabel,
    score: finalScore,
    summary: finalSummary || "Jury reached a verdict.",
    iterations: iteration,
  });
  emit({ type: "trial:end" });
}

function fallbackRevisionBrief(verdicts: Record<string, JurorVerdict>): string {
  const lines: string[] = [];
  for (const [agent, v] of Object.entries(verdicts)) {
    if (v.verdict !== "fail") continue;
    for (const issue of v.issues) {
      lines.push(`- (${agent} • ${issue.severity}) ${issue.message}`);
    }
    if (!v.issues.length && v.summary) {
      lines.push(`- (${agent}) ${v.summary}`);
    }
  }
  return lines.length
    ? `The jury found the following problems with your previous answer:\n${lines.join(
        "\n",
      )}`
    : "The jury rated the previous answer as low-confidence. Re-derive each step carefully.";
}
