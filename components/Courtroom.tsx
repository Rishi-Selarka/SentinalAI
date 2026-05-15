"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Scale, RotateCcw } from "lucide-react";
import { useTrialStream } from "@/hooks/useTrialStream";
import { PromptBar } from "./PromptBar";
import { JurorCard } from "./JurorCard";
import { DefendantPanel } from "./DefendantPanel";
import { Gavel } from "./Gavel";
import { RevisionDiff } from "./RevisionDiff";
import { ExamplePicker } from "./ExamplePicker";
import { JuryIntro } from "./JuryIntro";
import { easeOutExpo } from "@/lib/motion";
import type { AgentId, Domain } from "@/lib/openrouter";

const JURORS: AgentId[] = ["critic", "factChecker", "codeExecutor", "math", "standards"];

export function Courtroom({
  userName,
  onResetUser,
}: {
  userName: string;
  onResetUser?: () => void;
}) {
  const { state, start, reset } = useTrialStream();
  const [domain, setDomain] = useState<Domain>("software");
  const [prompt, setPrompt] = useState("");

  const running = state.status === "streaming";

  return (
    <motion.div
      className="min-h-screen w-full bg-cream"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: easeOutExpo }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
              <Scale className="w-5 h-5 text-cream" />
            </div>
            <div>
              <div className="text-surface-200 text-sm font-semibold tracking-widest uppercase">
                SentinelAI
              </div>
              <div className="text-xs text-surface-500 mt-0.5">
                The AI Hallucination Juror
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-surface-500">
                Presiding for
              </div>
              <div className="text-sm font-medium text-surface-200">{userName}</div>
            </div>
            {onResetUser && (
              <button
                onClick={onResetUser}
                className="p-2 rounded-lg border border-cream-300 text-surface-500 hover:text-surface-200 hover:bg-cream-100 transition"
                title="Sign out"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6, ease: easeOutExpo }}
          className="flex flex-col gap-3"
        >
          <h1 className="text-3xl md:text-4xl font-light text-surface leading-tight">
            Welcome, <span className="font-medium">{userName.split(" ")[0]}</span>.<br />
            What shall the jury weigh today?
          </h1>
          <p className="text-sm md:text-base text-surface-500 max-w-2xl">
            Submit a technical question. The Generator drafts an answer, then five
            independent juror agents — each running on a different model family —
            inspect, run, and fact-check it. The Judge issues a final verdict.
          </p>
        </motion.section>

        {/* Prompt + Examples */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, ease: easeOutExpo }}
          className="flex flex-col gap-4"
        >
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
        </motion.section>

        {state.status === "error" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-risk-high/10 border border-risk-high/20 p-4 text-sm text-risk-high"
          >
            <div className="text-[10px] uppercase tracking-[0.25em] mb-1 opacity-70">
              Mistrial
            </div>
            {state.error}
          </motion.div>
        )}

        {state.status === "idle" && <JuryIntro />}

        {state.status !== "idle" && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOutExpo }}
            className="grid lg:grid-cols-[1fr_2fr_1fr] gap-4"
          >
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
          </motion.section>
        )}

        <footer className="text-[10px] uppercase tracking-[0.22em] text-surface-500/70 mt-4 leading-relaxed">
          Generator · Claude Sonnet 4.5 &nbsp;•&nbsp; Critic · GPT-4o &nbsp;•&nbsp;
          Fact-Checker · Perplexity Sonar &nbsp;•&nbsp; Code · DeepSeek + E2B
          &nbsp;•&nbsp; Math · DeepSeek + mathjs/sympy &nbsp;•&nbsp; Standards ·
          Claude Haiku &nbsp;•&nbsp; Judge · GPT-4o-mini
        </footer>
      </div>
    </motion.div>
  );
}
