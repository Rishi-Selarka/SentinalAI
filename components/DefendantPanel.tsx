"use client";

import { useEffect, useRef } from "react";
import type { AgentState } from "@/hooks/useTrialStream";
import type { IterationRecord } from "@/hooks/useTrialStream";

export function DefendantPanel({
  state,
  iterations,
}: {
  state: AgentState;
  iterations: IterationRecord[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.tokens]);

  const currentText =
    state.status === "done" && iterations.length
      ? iterations[iterations.length - 1].answer
      : state.tokens;

  return (
    <div className="parchment rounded-2xl p-4 shadow-[inset_0_0_40px_rgba(120,80,30,0.2)] flex flex-col gap-3 min-h-[280px]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#7a4f1e]">
            Defendant testimony
          </div>
          <div className="text-base font-serif font-bold text-[#1b1208]">
            Generator (Iteration {state.iteration})
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#7a4f1e]">
          {state.status === "running"
            ? "speaking…"
            : state.status === "done"
            ? "rests its case"
            : "awaits the floor"}
        </div>
      </div>
      <div
        ref={scrollRef}
        className="font-mono text-[12px] leading-relaxed text-[#22170a] bg-[#fbf4dc] rounded-md p-3 flex-1 min-h-[180px] max-h-[360px] overflow-y-auto whitespace-pre-wrap scroll-thin"
      >
        {currentText || (
          <span className="text-[#7a4f1e]/60">
            The defendant has not yet been called.
          </span>
        )}
      </div>
    </div>
  );
}
