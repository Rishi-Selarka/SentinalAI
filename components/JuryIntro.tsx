"use client";

import { motion } from "framer-motion";
import {
  Brain,
  Globe2,
  TerminalSquare,
  Sigma,
  BookMarked,
  Gavel,
  Quote,
} from "lucide-react";
import { easeOutExpo } from "@/lib/motion";

const PILLARS = [
  {
    role: "Defendant",
    name: "Generator",
    model: "Claude Sonnet 4.5",
    blurb: "Drafts the technical answer the jury will examine.",
    icon: Quote,
    accent: "bg-suits-500/15 text-suits-500",
  },
  {
    role: "Juror · Logic",
    name: "Reasoning Critic",
    model: "GPT-4o",
    blurb: "Catches hidden assumptions and broken reasoning chains.",
    icon: Brain,
    accent: "bg-surface text-cream",
  },
  {
    role: "Juror · Facts",
    name: "Fact-Checker",
    model: "Perplexity Sonar",
    blurb: "Verifies citations and API claims with live web search.",
    icon: Globe2,
    accent: "bg-surface text-cream",
  },
  {
    role: "Juror · Code",
    name: "Code Executor",
    model: "DeepSeek + E2B sandbox",
    blurb: "Actually runs generated code and reads stdout, stderr, errors.",
    icon: TerminalSquare,
    accent: "bg-surface text-cream",
  },
  {
    role: "Juror · Math",
    name: "Math Verifier",
    model: "DeepSeek + mathjs/sympy",
    blurb: "Re-derives every number from first principles.",
    icon: Sigma,
    accent: "bg-surface text-cream",
  },
  {
    role: "Juror · Standards",
    name: "Standards Verifier",
    model: "Claude Haiku 4.5 + bundled corpus",
    blurb: "Cross-checks every cited section against authoritative excerpts.",
    icon: BookMarked,
    accent: "bg-surface text-cream",
  },
  {
    role: "Judge",
    name: "Jury Aggregator",
    model: "GPT-4o-mini",
    blurb: "Weighs the verdicts. TRUSTED, REVISED, or HALLUCINATION.",
    icon: Gavel,
    accent: "bg-suits-500/15 text-suits-500",
  },
];

export function JuryIntro() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeOutExpo }}
      className="bg-white border border-cream-300 rounded-2xl p-5 md:p-6 flex flex-col gap-5"
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-suits-600 font-medium">
            How the jury sits
          </div>
          <h2 className="text-xl md:text-2xl font-light text-surface mt-1">
            Seven agents, three model families, one verdict
          </h2>
        </div>
        <div className="text-[11px] uppercase tracking-wider text-surface-500">
          Cross-model independence
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PILLARS.map((p, i) => {
          const Icon = p.icon;
          return (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.4, ease: easeOutExpo }}
              className="bg-cream rounded-xl p-3.5 border border-cream-200 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${p.accent}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-surface-500">
                  {p.role}
                </span>
              </div>
              <div className="text-sm font-semibold text-surface">{p.name}</div>
              <div className="text-[10px] font-mono text-suits-600">{p.model}</div>
              <div className="text-xs text-surface-600 leading-snug">{p.blurb}</div>
            </motion.div>
          );
        })}
      </div>

      <div className="text-[12px] text-surface-600 leading-relaxed border-t border-cream-200 pt-4">
        Verdicts come back as <span className="text-risk-low font-semibold">pass</span>,{" "}
        <span className="text-risk-high font-semibold">fail</span>, or{" "}
        <span className="text-risk-medium font-semibold">uncertain</span> with
        confidence. The Judge computes a weighted reliability score — code & math
        weighted highest because they are deterministic. If the score is negative
        and any juror failed at high confidence, the Generator gets a revision
        brief and tries again, up to two retries.
      </div>
    </motion.section>
  );
}
