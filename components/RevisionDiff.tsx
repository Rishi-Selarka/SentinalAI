"use client";

import { motion } from "framer-motion";
import { GitCompare } from "lucide-react";
import type { IterationRecord } from "@/hooks/useTrialStream";
import { easeOutExpo } from "@/lib/motion";

export function RevisionDiff({ iterations }: { iterations: IterationRecord[] }) {
  if (iterations.length < 2) return null;
  const original = iterations[0];
  const revised = iterations[iterations.length - 1];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOutExpo }}
      className="bg-white border border-cream-300 rounded-xl p-4 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-suits-500" />
          <span className="text-[10px] uppercase tracking-wider text-surface-500">
            Original vs Revised Testimony
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-surface-500">
          {iterations.length - 1} revision{iterations.length === 2 ? "" : "s"}
        </span>
      </div>

      {original.retryBrief && (
        <div className="text-[11px] italic text-risk-high bg-risk-high/5 border border-risk-high/20 rounded-lg p-2.5">
          <span className="font-semibold not-italic text-risk-high uppercase tracking-wider text-[10px] mr-1">
            Brief
          </span>
          {original.retryBrief}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-risk-high/5 border border-risk-high/20 rounded-lg p-3 max-h-72 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-wider text-risk-high mb-1.5">
            Iteration {original.iteration} — challenged
          </div>
          <pre className="text-[11px] whitespace-pre-wrap font-mono text-surface-700">
            {original.answer}
          </pre>
        </div>
        <div className="bg-risk-low/5 border border-risk-low/20 rounded-lg p-3 max-h-72 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-wider text-risk-low mb-1.5">
            Iteration {revised.iteration} — accepted
          </div>
          <pre className="text-[11px] whitespace-pre-wrap font-mono text-surface-700">
            {revised.answer}
          </pre>
        </div>
      </div>
    </motion.div>
  );
}
