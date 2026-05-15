"use client";

import { motion } from "framer-motion";
import { Code2, Calculator, Library, Coins, Sparkles } from "lucide-react";
import { EXAMPLE_PROMPTS, type ExamplePrompt } from "@/lib/examples";
import { DOMAIN_LABELS } from "@/lib/jury/prompts";
import { easeOutExpo } from "@/lib/motion";
import type { Domain } from "@/lib/openrouter";

const DOMAIN_ICON: Record<Domain, typeof Code2> = {
  software: Code2,
  engineering: Calculator,
  mixed: Library,
  finance: Coins,
};

export function ExamplePicker({
  onPick,
  disabled,
}: {
  onPick: (ex: ExamplePrompt) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-surface-500">
        <Sparkles className="w-3.5 h-3.5 text-suits-500" />
        Pre-seeded cases — designed to make a model hallucinate
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {EXAMPLE_PROMPTS.map((ex, i) => {
          const Icon = DOMAIN_ICON[ex.domain];
          return (
            <motion.button
              key={ex.id}
              disabled={disabled}
              onClick={() => onPick(ex)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.4, ease: easeOutExpo }}
              whileHover={!disabled ? { y: -2 } : {}}
              whileTap={!disabled ? { scale: 0.98 } : {}}
              className="text-left bg-white border border-cream-300 rounded-xl p-4 hover:border-surface-400 hover:shadow-md transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-surface text-cream flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-surface-500">
                  {DOMAIN_LABELS[ex.domain]}
                </span>
              </div>
              <div className="text-sm font-semibold text-surface">{ex.title}</div>
              <div className="text-xs text-surface-500 line-clamp-2">
                {ex.prompt}
              </div>
              <div className="text-[11px] text-suits-600 italic mt-1">
                {ex.catchHint}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
