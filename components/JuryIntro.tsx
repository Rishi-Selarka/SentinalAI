"use client";

const PILLARS = [
  {
    role: "Defendant",
    name: "Generator",
    model: "Claude Sonnet 4.5",
    blurb: "Drafts the technical answer the jury will examine.",
    color: "#f1c875",
  },
  {
    role: "Juror — Logic",
    name: "Reasoning Critic",
    model: "GPT-4o",
    blurb: "Catches hidden assumptions and broken reasoning chains.",
    color: "#c79a4a",
  },
  {
    role: "Juror — Facts",
    name: "Fact-Checker",
    model: "Perplexity Sonar",
    blurb: "Verifies citations and API claims with live web search.",
    color: "#c79a4a",
  },
  {
    role: "Juror — Code",
    name: "Code Executor",
    model: "DeepSeek + E2B sandbox",
    blurb: "Actually runs generated code and reads stdout, stderr, errors.",
    color: "#c79a4a",
  },
  {
    role: "Juror — Math",
    name: "Math Verifier",
    model: "DeepSeek + mathjs/sympy",
    blurb: "Re-derives every number from first principles.",
    color: "#c79a4a",
  },
  {
    role: "Juror — Standards",
    name: "Standards Verifier",
    model: "Claude Haiku 4.5 + bundled corpus",
    blurb: "Cross-checks every cited section against authoritative excerpts.",
    color: "#c79a4a",
  },
  {
    role: "Judge",
    name: "Jury Aggregator",
    model: "GPT-4o-mini",
    blurb: "Weighs the verdicts. TRUSTED, REVISED, or HALLUCINATION.",
    color: "#f1c875",
  },
];

export function JuryIntro() {
  return (
    <section className="wood-panel rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-brass">
            How the jury sits
          </div>
          <h2 className="text-lg font-serif font-bold text-parchment">
            Seven agents, three model families, one verdict
          </h2>
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-parchment-soft/50">
          Cross-model independence
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PILLARS.map((p) => (
          <div
            key={p.name}
            className="parchment rounded-lg p-3 flex flex-col gap-1"
            style={{ borderTop: `3px solid ${p.color}` }}
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#7a4f1e]">
              {p.role}
            </div>
            <div className="text-sm font-serif font-bold text-[#1b1208]">
              {p.name}
            </div>
            <div className="text-[10px] font-mono text-[#3b2810]/80">
              {p.model}
            </div>
            <div className="text-xs text-[#3b2810] mt-1">{p.blurb}</div>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-parchment-soft/70 leading-relaxed">
        Verdicts come back as <span className="text-pass font-semibold">pass</span>,{" "}
        <span className="text-fail font-semibold">fail</span>, or{" "}
        <span className="text-uncertain font-semibold">uncertain</span> with
        confidence. The Judge computes a weighted reliability score (code & math
        weighted highest because they are deterministic). If the score is
        negative and any juror failed at high confidence, the Generator gets a
        revision brief and tries again — up to two retries.
      </div>
    </section>
  );
}
