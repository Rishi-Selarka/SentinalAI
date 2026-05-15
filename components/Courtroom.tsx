"use client";

import { useTrialStream } from "@/hooks/useTrialStream";
import { PromptBar } from "./PromptBar";
import { JurorCard } from "./JurorCard";
import { DefendantPanel } from "./DefendantPanel";
import { Gavel } from "./Gavel";
import { RevisionDiff } from "./RevisionDiff";
import { ExamplePicker } from "./ExamplePicker";
import { JuryIntro } from "./JuryIntro";
import type { AgentId, Domain } from "@/lib/openrouter";
import { useState } from "react";

const JURORS: AgentId[] = ["critic", "factChecker", "codeExecutor", "math", "standards"];

export function Courtroom() {
  const { state, start, reset } = useTrialStream();
  const [domain, setDomain] = useState<Domain>("software");
  const [prompt, setPrompt] = useState("");

  const running = state.status === "streaming";

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            ⚖️
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-extrabold text-parchment leading-none">
              SentinelAI
            </h1>
            <div className="text-[11px] uppercase tracking-[0.3em] text-brass">
              The AI Hallucination Juror
            </div>
          </div>
        </div>
        <p className="text-sm text-parchment-soft/80 max-w-3xl">
          Submit a technical question. The Generator drafts an answer, then five
          independent juror agents — each running on a different model family —
          inspect it. The Judge tallies a reliability score and either certifies
          the answer or sends it back for revision.
        </p>
        <div className="brass-divider" />
      </header>

      <PromptBar
        initialPrompt={prompt}
        initialDomain={domain}
        disabled={running}
        onSubmit={(p, d) => {
          setPrompt(p);
          setDomain(d);
          start(p, d);
        }}
        onClear={() => {
          setPrompt("");
          reset();
        }}
      />

      <ExamplePicker
        disabled={running}
        onPick={(ex) => {
          setPrompt(ex.prompt);
          setDomain(ex.domain);
          start(ex.prompt, ex.domain);
        }}
      />

      {state.status === "idle" && <JuryIntro />}

      {state.status === "error" && (
        <div className="wood-panel rounded-xl p-4 border-fail/60 text-fail">
          <div className="text-[10px] uppercase tracking-[0.25em] text-fail mb-1">
            Mistrial
          </div>
          <div className="text-sm">{state.error}</div>
        </div>
      )}

      {state.status !== "idle" && (
        <section className="grid lg:grid-cols-[1fr_2fr_1fr] gap-4">
          <div className="flex flex-col gap-3">
            {JURORS.slice(0, 3).map((agent) => (
              <JurorCard key={agent} agent={agent} state={state.agents[agent]} />
            ))}
          </div>
          <div className="flex flex-col gap-4">
            <DefendantPanel
              state={state.agents.generator}
              iterations={state.iterations}
            />
            {state.finalLabel && (
              <Gavel
                label={state.finalLabel}
                score={state.finalScore ?? 0}
                summary={state.finalSummary ?? ""}
                iterations={state.currentIteration}
              />
            )}
            {state.iterations.length > 1 && (
              <RevisionDiff iterations={state.iterations} />
            )}
          </div>
          <div className="flex flex-col gap-3">
            {JURORS.slice(3).map((agent) => (
              <JurorCard key={agent} agent={agent} state={state.agents[agent]} />
            ))}
          </div>
        </section>
      )}

      <footer className="text-[10px] uppercase tracking-[0.25em] text-parchment-soft/40 mt-4">
        Generator: Claude Sonnet 4.5 • Critic: GPT-4o • Fact-Checker: Perplexity
        Sonar • Code: DeepSeek + E2B • Math: DeepSeek + mathjs/sympy • Standards:
        Claude Haiku • Judge: GPT-4o-mini
      </footer>
    </div>
  );
}
