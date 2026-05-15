"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, Settings as SettingsIcon } from "lucide-react";
import { AetherLogo } from "./AetherLogo";
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
import type { SidebarView } from "./Sidebar";

const JURORS: AgentId[] = ["critic", "factChecker", "codeExecutor", "math", "standards"];

export function Courtroom({
  userName,
  view = "home",
}: {
  userName: string;
  view?: SidebarView;
}) {
  const { state, start, reset } = useTrialStream();
  const [domain, setDomain] = useState<Domain>("software");
  const [prompt, setPrompt] = useState("");

  const running = state.status === "streaming";
  const firstName = userName.split(" ")[0];

  return (
    <motion.div
      className="min-h-screen w-full bg-cream"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: easeOutExpo }}
    >
      <div className="max-w-5xl mx-auto px-6 md:px-10 py-8 flex flex-col gap-8">
        {/* Top header — app name on the main screen */}
        <header className="flex items-center justify-between gap-4 pb-5 border-b border-cream-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border border-cream-300 flex items-center justify-center shadow-[0_8px_24px_-10px_rgba(79,150,204,0.45)]">
              <AetherLogo className="w-5 h-5 text-suits-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-surface tracking-tight leading-none">
                Sentinel<span className="text-suits-600">AI</span>
              </h1>
              <div className="text-[11px] uppercase tracking-[0.25em] text-surface-500 mt-1.5">
                The AI Hallucination Juror
              </div>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-[11px] uppercase tracking-wider text-surface-500">
              Presiding for
            </div>
            <div className="text-sm font-medium text-surface-200">{firstName}</div>
          </div>
        </header>

        {view === "home" && (
          <HomeView
            firstName={firstName}
            prompt={prompt}
            domain={domain}
            running={running}
            state={state}
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
        )}

        {view === "jurors" && <JuryIntro />}

        {view === "examples" && (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-medium text-surface">Pre-seeded cases</h2>
              <p className="text-sm text-surface-500 mt-1">
                Hand-picked prompts designed to make a model hallucinate. Pick one
                to convene the jury instantly.
              </p>
            </div>
            <ExamplePicker
              disabled={running}
              onPick={(ex) => {
                setPrompt(ex.prompt);
                setDomain(ex.domain);
                start(ex.prompt, ex.domain);
              }}
            />
          </section>
        )}

        {view === "history" && <ComingSoon icon={Clock} label="History" />}
        {view === "settings" && <ComingSoon icon={SettingsIcon} label="Settings" />}
      </div>

      {/* Floating shortcut to the repo analyzer — only rendered for signed-in
          users (since this component is only mounted after onboarding). */}
      <Link
        href="/repo"
        className="fixed bottom-6 right-6 z-50 px-4 py-2 rounded-full bg-surface text-cream text-xs font-medium shadow-lg hover:shadow-xl hover:bg-surface-200 transition"
      >
        Analyze GitHub repo →
      </Link>
    </motion.div>
  );
}

function HomeView({
  firstName,
  prompt,
  domain,
  running,
  state,
  onSubmit,
  onClear,
}: {
  firstName: string;
  prompt: string;
  domain: Domain;
  running: boolean;
  state: ReturnType<typeof useTrialStream>["state"];
  onSubmit: (p: string, d: Domain) => void;
  onClear: () => void;
}) {
  return (
    <>
      {/* Brief intro + chat */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: easeOutExpo }}
        className="flex flex-col gap-4"
      >
        <h2 className="text-3xl md:text-4xl font-light text-surface leading-tight">
          Welcome back, <span className="font-medium">{firstName}</span>.
        </h2>
        <p className="text-sm md:text-base text-surface-500 max-w-2xl">
          Submit a technical question. A jury of five independent agents — each on
          a different model family — will inspect, run, and fact-check the answer
          before the Judge issues a verdict.
        </p>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.5, ease: easeOutExpo }}
      >
        <PromptBar
          initialPrompt={prompt}
          initialDomain={domain}
          disabled={running}
          onSubmit={onSubmit}
          onClear={onClear}
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

      {state.status !== "idle" && state.status !== "error" && (
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
    </>
  );
}

function ComingSoon({ icon: Icon, label }: { icon: typeof Clock; label: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOutExpo }}
      className="rounded-2xl border border-cream-300 bg-white p-10 flex flex-col items-center justify-center gap-3 text-center"
    >
      <div className="w-12 h-12 rounded-xl bg-cream-200 flex items-center justify-center">
        <Icon className="w-6 h-6 text-surface-500" />
      </div>
      <h2 className="text-xl font-medium text-surface">{label}</h2>
      <p className="text-sm text-surface-500 max-w-md">
        Coming soon. This area is reserved for upcoming functionality.
      </p>
    </motion.section>
  );
}
