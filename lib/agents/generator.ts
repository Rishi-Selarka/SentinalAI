import { streamChat, type Domain } from "@/lib/openrouter";
import { generatorSystemPrompt } from "@/lib/jury/prompts";
import type { EmitFn } from "@/lib/jury/emit";

export async function runGenerator(opts: {
  prompt: string;
  domain: Domain;
  revisionBrief?: string;
  iteration: number;
  emit: EmitFn;
  fast?: boolean;
}): Promise<string> {
  const { prompt, domain, revisionBrief, iteration, emit, fast } = opts;
  emit({ type: "agent:start", agent: "generator", iteration });

  let full = "";
  try {
    for await (const delta of streamChat({
      agent: "generator",
      fast,
      temperature: 0.5,
      maxTokens: 1800,
      messages: [
        { role: "system", content: generatorSystemPrompt(domain, revisionBrief) },
        { role: "user", content: prompt },
      ],
    })) {
      full += delta;
      emit({ type: "agent:token", agent: "generator", delta, iteration });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({
      type: "agent:token",
      agent: "generator",
      delta: `\n\n[Generator error: ${message}]`,
      iteration,
    });
  }

  emit({ type: "agent:answer", agent: "generator", answer: full, iteration });
  return full;
}
