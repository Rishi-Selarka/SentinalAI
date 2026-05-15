"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Scale } from "lucide-react";
import { easeOutExpo } from "@/lib/motion";

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
      {/* ── Hero image (left half) — replace /public/onboarding.jpg with your image ── */}
      <motion.div
        className="hidden lg:block w-1/2 relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: easeOutExpo }}
      >
        {/* When the user supplies an image, drop it at /public/onboarding.jpg
            and uncomment the <img> below. The gradient placeholder stays
            visible until then so the layout never breaks. */}
        {/* <img
          src="/onboarding.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        /> */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 30% 25%, rgba(218, 107, 43, 0.20), transparent 55%), radial-gradient(circle at 75% 80%, rgba(9, 9, 11, 0.14), transparent 55%), linear-gradient(180deg, #F5F3E4 0%, #ECE9D8 100%)",
          }}
        />
        <div className="absolute inset-0 splash-mask pointer-events-none" />
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
              <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
                <Scale className="w-5 h-5 text-cream" />
              </div>
              <span className="text-surface-200 text-sm font-semibold tracking-widest uppercase">
                SentinelAI
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
            className="bg-surface rounded-2xl p-6 space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-surface-600 uppercase tracking-wider mb-2">
                Your name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
                autoComplete="name"
                autoFocus
                className="w-full bg-surface-200 text-base text-white placeholder:text-surface-500 rounded-xl px-4 py-3 outline-none border border-surface-300 focus:border-surface-500 transition-colors duration-300 caret-white"
              />
            </div>

            <motion.button
              type="submit"
              disabled={!canSubmit}
              className="w-full mt-2 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-cream text-surface font-semibold text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-cream-100 active:scale-[0.98] transition-all duration-200"
              whileTap={canSubmit ? { scale: 0.98 } : {}}
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </motion.form>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-6 text-center text-xs text-surface-500"
          >
            Your name is stored locally in this browser only.
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}
