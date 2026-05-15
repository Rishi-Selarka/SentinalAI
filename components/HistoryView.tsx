"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Scale, Trash2, ChevronDown, Quote } from "lucide-react";
import {
  loadHistory,
  deleteTrial,
  clearHistory,
  onHistoryChange,
  type TrialHistoryRecord,
} from "@/lib/history";
import { renderMarkdown } from "./TrialSummary";
import { easeOutExpo } from "@/lib/motion";

const LABEL_STYLE: Record<
  TrialHistoryRecord["finalLabel"],
  { text: string; chip: string; ring: string }
> = {
  TRUSTED: {
    text: "text-risk-low",
    chip: "bg-risk-low/12 text-risk-low",
    ring: "border-risk-low/40",
  },
  REVISED: {
    text: "text-suits-500",
    chip: "bg-suits-500/12 text-suits-500",
    ring: "border-suits-400/40",
  },
  HALLUCINATION: {
    text: "text-risk-high",
    chip: "bg-risk-high/12 text-risk-high",
    ring: "border-risk-high/40",
  },
};

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function HistoryView() {
  const [records, setRecords] = useState<TrialHistoryRecord[]>(loadHistory);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => onHistoryChange(() => setRecords(loadHistory())), []);

  if (records.length === 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeOutExpo }}
        className="rounded-2xl border border-cream-300 bg-white p-10 flex flex-col items-center justify-center gap-3 text-center"
      >
        <div className="w-12 h-12 rounded-xl bg-cream-200 flex items-center justify-center">
          <Clock className="w-6 h-6 text-surface-500" />
        </div>
        <h2 className="text-xl font-medium text-surface">No trials yet</h2>
        <p className="text-sm text-surface-500 max-w-md">
          Completed trials are saved here automatically. Run a trial from{" "}
          <span className="font-medium text-surface-300">New Trial</span> to
          build your history.
        </p>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOutExpo }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium text-surface">Trial History</h2>
          <p className="text-sm text-surface-500">
            {records.length} saved trial{records.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm("Clear all trial history? This cannot be undone.")) {
              clearHistory();
            }
          }}
          className="flex items-center gap-2 text-xs font-medium text-surface-500 hover:text-risk-high px-3 py-2 rounded-lg hover:bg-risk-high/8 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear all
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {records.map((r) => {
          const style = LABEL_STYLE[r.finalLabel];
          const isOpen = expanded === r.id;
          return (
            <div
              key={r.id}
              className={`bg-white border ${style.ring} rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(9,9,11,0.05)]`}
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : r.id)}
                className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-cream-100 transition-colors"
              >
                <div
                  className={`w-9 h-9 rounded-xl border ${style.ring} ${style.text} flex items-center justify-center shrink-0 mt-0.5`}
                >
                  <Scale className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${style.chip}`}
                    >
                      {r.finalLabel}
                    </span>
                    <span className="text-[10px] text-surface-500">
                      score {r.finalScore.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-surface-500">
                      · {r.domain}
                    </span>
                    <span className="text-[10px] text-surface-500">
                      · {timeAgo(r.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-surface-200 mt-1.5 line-clamp-2">
                    {r.prompt}
                  </p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-surface-500 shrink-0 mt-1 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: easeOutExpo }}
                    className="overflow-hidden border-t border-cream-300"
                  >
                    <div className="px-5 py-5">
                      {r.finalSummary && (
                        <div className="flex gap-3 rounded-xl bg-cream-100 border border-cream-300 p-4 mb-4">
                          <Quote className="w-4 h-4 text-surface-500 shrink-0 mt-0.5" />
                          <p className="text-[13.5px] leading-relaxed text-surface-200 italic">
                            {r.finalSummary}
                          </p>
                        </div>
                      )}
                      <div className="text-[10px] uppercase tracking-[0.22em] text-surface-500 mb-2">
                        Answer to your question
                      </div>
                      <div className="prose-none">
                        {renderMarkdown(r.answer)}
                      </div>
                      <div className="flex justify-end mt-4 pt-4 border-t border-cream-300">
                        <button
                          type="button"
                          onClick={() => {
                            deleteTrial(r.id);
                            if (expanded === r.id) setExpanded(null);
                          }}
                          className="flex items-center gap-2 text-xs font-medium text-surface-500 hover:text-risk-high px-3 py-2 rounded-lg hover:bg-risk-high/8 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete trial
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
