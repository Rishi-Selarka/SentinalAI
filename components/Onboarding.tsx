"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { easeOutExpo } from "@/lib/motion";
import { ContributionHeatmap } from "./ContributionHeatmap";
import { AetherLogo } from "./AetherLogo";

export function Onboarding({ onContinue }: { onContinue: (name: string) => void }) {
  const [name, setName] = useState("");
  const canSubmit = name.trim().length >= 2;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (canSubmit) onContinue(name.trim());
  };

  return (
    <motion.div
      className="fixed inset-0 bg-cream flex overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: easeOutExpo }}
    >
      {/* ── Left panel: powder-blue GitHub-style activity heatmap ──
          The grid is full-bleed and its right edge fades into the cream
          form area so the two halves blend seamlessly with no hard seam. */}
      <motion.div
        className="hidden lg:block w-1/2 relative bg-cream overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: easeOutExpo }}
      >
        {/* Soft radial glow behind the grid for ambient depth. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 28% 45%, rgba(79, 150, 204, 0.18), transparent 55%), radial-gradient(circle at 65% 80%, rgba(108, 174, 219, 0.12), transparent 55%)",
          }}
        />

        {/* The heatmap itself. heatmap-fade masks the right edge → transparent. */}
        <div className="absolute inset-0 px-10 py-14 heatmap-fade">
          <ContributionHeatmap />
        </div>

        {/* Frosted veil across the seam — blurs the grid into the form bg. */}
        <div className="heatmap-veil" />

        {/* Caption pinned to the bottom — explains what the grid represents. */}
        <div className="absolute bottom-10 left-10 right-16 z-10">
          <div className="text-[11px] uppercase tracking-[0.28em] text-suits-700 font-medium mb-1">
            Trial activity
          </div>
          <div className="text-xs text-surface-500 max-w-[18rem] leading-relaxed">
            Every square is a verdict the jury has rendered. Darker means more
            hallucinations caught.
          </div>
        </div>
      </motion.div>

      {/* ── Form area ── */}
      <div className="flex-1 flex items-center justify-center px-8 lg:px-16 relative z-10 py-12 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Brand mark */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease: easeOutExpo }}
            className="mb-12"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center ring-1 ring-suits-500/25 shadow-[0_8px_24px_-8px_rgba(79,150,204,0.45)]">
                <AetherLogo className="w-5 h-5 text-suits-600" />
              </div>
              <span className="text-surface-200 text-sm font-semibold tracking-widest uppercase">
                Sentinel<span className="text-suits-600">AI</span>
              </span>
            </div>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOutExpo }}
            className="text-4xl lg:text-5xl font-light text-surface leading-tight mb-3"
          >
            The AI<br />Hallucination Juror
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="text-surface-500 text-base mb-8"
          >
            A multi-agent jury that verifies every AI answer before you trust it.
          </motion.p>

          {/* Form card */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: easeOutExpo }}
            className="bg-white rounded-2xl p-6 space-y-4 border border-cream-300 ring-1 ring-suits-500/10 shadow-[0_28px_70px_-28px_rgba(79,150,204,0.5)]"
          >
            <div>
              <label className="block text-xs font-medium text-suits-700 uppercase tracking-wider mb-2">
                Your name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
                autoComplete="name"
                autoFocus
                className="w-full bg-cream-100 text-base text-surface placeholder:text-surface-400 rounded-xl px-4 py-3 outline-none border border-cream-300 focus:border-suits-400 focus:ring-2 focus:ring-suits-500/25 transition-all duration-300 caret-[color:var(--color-suits-500)]"
              />
            </div>

            <motion.button
              type="submit"
              disabled={!canSubmit}
              className="w-full mt-2 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-suits-500 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-suits-600 active:scale-[0.98] transition-all duration-200 shadow-[0_12px_30px_-12px_rgba(79,150,204,0.7)]"
              whileTap={canSubmit ? { scale: 0.98 } : {}}
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </motion.form>

        </div>
      </div>
    </motion.div>
  );
}
