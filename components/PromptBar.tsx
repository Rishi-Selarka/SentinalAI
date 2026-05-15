"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import type { Domain } from "@/lib/openrouter";
import { DOMAIN_LABELS } from "@/lib/jury/prompts";
import { easeOutExpo } from "@/lib/motion";

const DOMAINS: Domain[] = ["software", "engineering", "mixed", "finance"];

export function PromptBar({
  initialPrompt = "",
  initialDomain = "software",
  disabled,
  onSubmit,
  onClear,
}: {
  initialPrompt?: string;
  initialDomain?: Domain;
  disabled?: boolean;
  onSubmit: (prompt: string, domain: Domain) => void;
  onClear?: () => void;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [domain, setDomain] = useState<Domain>(initialDomain);

  useEffect(() => setPrompt(initialPrompt), [initialPrompt]);
  useEffect(() => setDomain(initialDomain), [initialDomain]);

  return (
    <motion.form
      onSubmit={(e) => {
        e.preventDefault();
        if (!prompt.trim() || disabled) return;
        onSubmit(prompt.trim(), domain);
      }}
      className="bg-surface rounded-2xl p-5 flex flex-col gap-4 shadow-[0_10px_40px_rgba(9,9,11,0.10)]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-surface-600 font-medium">
          Domain
        </span>
        <div className="flex flex-wrap gap-1.5">
          {DOMAINS.map((d) => (
            <button
              type="button"
              key={d}
              onClick={() => setDomain(d)}
              disabled={disabled}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors duration-200 ${
                domain === d
                  ? "bg-cream text-surface border-cream"
                  : "bg-transparent text-surface-600 border-surface-400 hover:text-surface-800 hover:border-surface-500"
              } disabled:opacity-40`}
            >
              {DOMAIN_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Type the technical question to put on trial…"
        rows={3}
        disabled={disabled}
        className="w-full bg-surface-200 text-base text-white placeholder:text-surface-500 rounded-xl px-4 py-3 outline-none border border-surface-300 focus:border-surface-500 transition-colors duration-300 caret-white resize-y min-h-[88px] font-mono text-sm"
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-surface-600 flex items-center gap-2">
          {disabled ? (
            <>
              <span className="flex gap-1 items-end h-4">
                <span className="w-1 h-1 rounded-full bg-suits-400 typing-dot" />
                <span className="w-1 h-1 rounded-full bg-suits-400 typing-dot" />
                <span className="w-1 h-1 rounded-full bg-suits-400 typing-dot" />
              </span>
              <span>Trial in session</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-suits-400" />
              Ready to convene the jury
            </>
          )}
        </span>
        <div className="flex gap-2">
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className="px-3 py-2 rounded-xl text-xs font-medium border border-surface-400 text-surface-700 hover:bg-surface-200 hover:text-white disabled:opacity-40 transition-colors"
            >
              New case
            </button>
          )}
          <motion.button
            type="submit"
            disabled={disabled || !prompt.trim()}
            whileTap={!disabled && prompt.trim() ? { scale: 0.98 } : {}}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-cream text-surface hover:bg-cream-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
          >
            <span>Convene jury</span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.form>
  );
}
