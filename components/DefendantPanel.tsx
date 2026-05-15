"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import type { AgentState, IterationRecord } from "@/hooks/useTrialStream";
import { easeOutExpo } from "@/lib/motion";

export function DefendantPanel({
  state,
  iterations,
}: {
  state: AgentState;
  iterations: IterationRecord[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [state.tokens]);

  const currentText =
    state.status === "done" && iterations.length
      ? iterations[iterations.length - 1].answer
      : state.tokens;

  const statusLabel =
    state.status === "running"
      ? "Speaking…"
      : state.status === "done"
        ? "Rests its case"
        : "Awaits the floor";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOutExpo }}
      className="bg-surface rounded-2xl p-5 flex flex-col gap-3 min-h-[280px] shadow-[0_10px_40px_rgba(9,9,11,0.10)]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-suits-500/15 text-suits-400 flex items-center justify-center">
            <Quote className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-surface-500">
              Defendant testimony
            </div>
            <div className="text-sm font-semibold text-cream">
              Generator <span className="text-surface-500">· iteration {state.iteration}</span>
            </div>
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-surface-500 flex items-center gap-2">
          {state.status === "running" && (
            <span className="flex gap-1 items-end h-3">
              <span className="w-1 h-1 rounded-full bg-suits-400 typing-dot" />
              <span className="w-1 h-1 rounded-full bg-suits-400 typing-dot" />
              <span className="w-1 h-1 rounded-full bg-suits-400 typing-dot" />
            </span>
          )}
          {statusLabel}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="font-mono text-[12px] leading-relaxed text-cream bg-surface-100 border border-surface-300 rounded-xl p-3.5 flex-1 min-h-[200px] max-h-[420px] overflow-y-auto whitespace-pre-wrap"
      >
        {currentText || (
          <span className="text-surface-500">
            The defendant has not yet been called.
          </span>
        )}
        {state.status === "running" && (
          <span className="streaming-cursor text-suits-400">▍</span>
        )}
      </div>
    </motion.div>
  );
}
