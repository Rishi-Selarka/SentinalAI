"use client";

import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import type { FinalLabel } from "@/lib/jury/types";
import { easeOutExpo } from "@/lib/motion";

const LABEL_THEME: Record<
  FinalLabel,
  { icon: typeof ShieldCheck; tagline: string; ring: string; text: string; pill: string; }
> = {
  TRUSTED: {
    icon: ShieldCheck,
    tagline: "The jury finds the answer truthful and verifiable.",
    ring: "ring-risk-low/30 bg-risk-low/5",
    text: "text-risk-low",
    pill: "bg-risk-low/15 text-risk-low",
  },
  REVISED: {
    icon: RefreshCw,
    tagline: "The original answer was unsafe; a revised verdict was reached.",
    ring: "ring-suits-400/30 bg-suits-50",
    text: "text-suits-600",
    pill: "bg-suits-100 text-suits-700",
  },
  HALLUCINATION: {
    icon: ShieldAlert,
    tagline: "The jury finds the answer unsafe to trust.",
    ring: "ring-risk-high/30 bg-risk-high/5",
    text: "text-risk-high",
    pill: "bg-risk-high/15 text-risk-high",
  },
};

export function Gavel({
  label,
  score,
  summary,
  iterations,
}: {
  label: FinalLabel;
  score: number;
  summary: string;
  iterations: number;
}) {
  const theme = LABEL_THEME[label];
  const Icon = theme.icon;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: easeOutExpo }}
      className="flex flex-col gap-3"
    >
      <div className={`rounded-2xl border ring-1 p-5 ${theme.ring} border-cream-300`}>
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ rotate: -20, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: easeOutExpo }}
            className={`w-12 h-12 rounded-2xl bg-white border border-cream-300 flex items-center justify-center ${theme.text}`}
          >
            <Icon className="w-6 h-6" />
          </motion.div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-[0.25em] text-surface-500">
              Final Verdict
            </div>
            <div className="flex items-baseline gap-3">
              <span className={`text-2xl font-semibold ${theme.text}`}>{label}</span>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md ${theme.pill}`}>
                {iterations} iteration{iterations === 1 ? "" : "s"}
              </span>
            </div>
            <div className="text-sm text-surface-600 italic mt-1">{theme.tagline}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-surface-500">
              Reliability score
            </div>
            <div className={`text-2xl font-mono font-bold ${theme.text}`}>
              {score.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white border border-cream-300 rounded-xl p-4">
        <div className="text-[10px] uppercase tracking-wider text-surface-500 mb-1.5">
          Judge’s summary
        </div>
        <p className="text-sm text-surface-700 leading-relaxed whitespace-pre-wrap">
          {summary}
        </p>
      </div>
    </motion.div>
  );
}
