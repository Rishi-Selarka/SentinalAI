"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Scale, Quote } from "lucide-react";
import type { TrialState } from "@/hooks/useTrialStream";
import { easeOutExpo } from "@/lib/motion";

function finalAnswer(state: TrialState): string {
  if (state.iterations.length) {
    return state.iterations[state.iterations.length - 1].answer;
  }
  return state.agents.generator.tokens;
}

/** Minimal, dependency-free markdown → React for clean answer rendering. */
function renderMarkdown(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  const segments = src.split(/```/g);

  segments.forEach((seg, i) => {
    const isCode = i % 2 === 1;
    if (isCode) {
      const nl = seg.indexOf("\n");
      const body = nl === -1 ? seg : seg.slice(nl + 1);
      out.push(
        <pre
          key={`c${i}`}
          className="my-3 rounded-xl bg-surface text-cream font-mono text-[12.5px] leading-relaxed p-4 overflow-x-auto"
        >
          {body.replace(/\n$/, "")}
        </pre>,
      );
      return;
    }

    const lines = seg.split("\n");
    let para: string[] = [];
    let list: string[] = [];

    const flushPara = (k: string) => {
      if (!para.length) return;
      out.push(
        <p key={k} className="text-[14px] leading-relaxed text-surface-200 my-2">
          {inline(para.join(" "))}
        </p>,
      );
      para = [];
    };
    const flushList = (k: string) => {
      if (!list.length) return;
      out.push(
        <ul key={k} className="my-2 ml-1 space-y-1">
          {list.map((it, j) => (
            <li
              key={j}
              className="text-[14px] leading-relaxed text-surface-200 flex gap-2"
            >
              <span className="text-suits-500 mt-1.5 w-1 h-1 rounded-full bg-suits-500 shrink-0" />
              <span>{inline(it)}</span>
            </li>
          ))}
        </ul>,
      );
      list = [];
    };

    lines.forEach((raw, j) => {
      const line = raw.trimEnd();
      const key = `${i}-${j}`;
      const h = line.match(/^(#{1,3})\s+(.*)$/);
      const b = line.match(/^[-*]\s+(.*)$/);
      if (h) {
        flushPara(`p${key}`);
        flushList(`l${key}`);
        const lvl = h[1].length;
        out.push(
          <p
            key={`h${key}`}
            className={`font-semibold text-surface mt-4 mb-1 ${
              lvl === 1 ? "text-lg" : lvl === 2 ? "text-base" : "text-sm"
            }`}
          >
            {inline(h[2])}
          </p>,
        );
      } else if (b) {
        flushPara(`p${key}`);
        list.push(b[1]);
      } else if (line.trim() === "") {
        flushPara(`p${key}`);
        flushList(`l${key}`);
      } else {
        flushList(`l${key}`);
        para.push(line);
      }
    });
    flushPara(`pend${i}`);
    flushList(`lend${i}`);
  });

  return out;
}

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(
        <strong key={idx} className="font-semibold text-surface">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <code
          key={idx}
          className="font-mono text-[12.5px] px-1.5 py-0.5 rounded bg-cream-200 text-surface"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + tok.length;
    idx++;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const LABEL_STYLE: Record<
  NonNullable<TrialState["finalLabel"]>,
  { ring: string; text: string; chip: string }
> = {
  TRUSTED: {
    ring: "border-risk-low/40",
    text: "text-risk-low",
    chip: "bg-risk-low/12 text-risk-low",
  },
  REVISED: {
    ring: "border-suits-400/40",
    text: "text-suits-500",
    chip: "bg-suits-500/12 text-suits-500",
  },
  HALLUCINATION: {
    ring: "border-risk-high/40",
    text: "text-risk-high",
    chip: "bg-risk-high/12 text-risk-high",
  },
};

export function TrialSummary({ state }: { state: TrialState }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 350);
    return () => clearTimeout(t);
  }, []);

  if (!state.finalLabel) return null;
  const style = LABEL_STYLE[state.finalLabel];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: easeOutExpo }}
      className={`max-w-3xl w-full mx-auto mt-8 scroll-mt-8 bg-white border ${style.ring} rounded-2xl shadow-[0_14px_50px_rgba(9,9,11,0.10)] overflow-hidden`}
    >
      <div className="px-6 py-5 border-b border-cream-300 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl border ${style.ring} ${style.text} flex items-center justify-center shrink-0`}
          >
            <Scale className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.22em] text-surface-500">
              Verdict
            </div>
            <div className="flex items-center gap-2.5">
              <span className={`text-lg font-bold tracking-wide ${style.text}`}>
                {state.finalLabel}
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${style.chip}`}
              >
                score {(state.finalScore ?? 0).toFixed(2)}
              </span>
              <span className="text-[11px] text-surface-500">
                {state.currentIteration} iteration
                {state.currentIteration === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {state.finalSummary && (
        <div className="px-6 pt-5">
          <div className="flex gap-3 rounded-xl bg-cream-100 border border-cream-300 p-4">
            <Quote className="w-4 h-4 text-surface-500 shrink-0 mt-0.5" />
            <p className="text-[13.5px] leading-relaxed text-surface-200 italic">
              {state.finalSummary}
            </p>
          </div>
        </div>
      )}

      <div className="px-6 py-5">
        <div className="text-[10px] uppercase tracking-[0.22em] text-surface-500 mb-2">
          Answer to your question
        </div>
        <div className="prose-none">{renderMarkdown(finalAnswer(state))}</div>
      </div>
    </motion.div>
  );
}
