"use client";

import { useState } from "react";

export function Onboarding({ onContinue }: { onContinue: (name: string) => void }) {
  const [name, setName] = useState("");
  const canContinue = name.trim().length > 1;

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2">
      {/* Left half — image / brand panel (placeholder until user-supplied image is added) */}
      <aside className="relative bg-bg-subtle border-b lg:border-b-0 lg:border-r border-border flex items-center justify-center overflow-hidden">
        {/* Replace this block with the user-supplied image once provided.
            Drop the file at /public/onboarding.{jpg,png,webp} and switch to
            <Image src="/onboarding.jpg" fill alt="..." className="object-cover" /> */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(79, 70, 229, 0.12), transparent 55%), radial-gradient(circle at 70% 80%, rgba(16, 185, 129, 0.10), transparent 55%), linear-gradient(180deg, #f7f7f8 0%, #ffffff 100%)",
          }}
        />
        <div className="relative z-10 max-w-md px-8 py-12">
          <div className="text-[11px] uppercase tracking-[0.32em] text-ink-muted mb-3">
            SentinelAI
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold text-ink leading-tight">
            The AI Hallucination Juror
          </h1>
          <p className="mt-4 text-sm text-ink-soft leading-relaxed">
            A multi-agent jury verifies every AI-generated answer — running the
            code, re-deriving the math, fact-checking citations against
            authoritative sources, and grading the result before you trust it.
          </p>
          <div className="mt-8 flex flex-col gap-2 text-xs text-ink-muted">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
              <span>7 agents • 3 model families • 1 verdict</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-pass inline-block" />
              <span>Real code execution in a live sandbox</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-uncertain inline-block" />
              <span>Auto-retry with revision brief on failure</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Right half — name entry form */}
      <section className="flex items-center justify-center p-8 md:p-12">
        <form
          className="w-full max-w-sm flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (canContinue) onContinue(name.trim());
          }}
        >
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-ink-muted mb-2">
              Welcome
            </div>
            <h2 className="text-2xl font-semibold text-ink">
              Let’s get you set up
            </h2>
            <p className="text-sm text-ink-muted mt-2">
              Tell us your name so the jury can address you correctly during the
              trial.
            </p>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-ink-soft">Your name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rishi Selarka"
              className="w-full bg-white border border-border-strong rounded-lg px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
            />
          </label>

          <button
            type="submit"
            disabled={!canContinue}
            className="w-full bg-ink text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-accent-soft disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Continue →
          </button>

          <p className="text-[11px] text-ink-faint text-center">
            Your name is stored locally in this browser only.
          </p>
        </form>
      </section>
    </div>
  );
}
