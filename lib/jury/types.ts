import type { AgentId, Domain } from "@/lib/openrouter";

export type Severity = "low" | "med" | "high";

export type Issue = {
  severity: Severity;
  message: string;
  location?: string;
};

export type Verdict = "pass" | "fail" | "uncertain";

export type JurorVerdict = {
  verdict: Verdict;
  confidence: number; // 0..1
  evidence: string[];
  issues: Issue[];
  summary?: string;
};

export type FinalLabel = "TRUSTED" | "REVISED" | "HALLUCINATION";

export type AgentEvent =
  | { type: "trial:start"; prompt: string; domain: Domain }
  | { type: "agent:start"; agent: AgentId; iteration: number }
  | { type: "agent:token"; agent: AgentId; delta: string; iteration: number }
  | {
      type: "agent:verdict";
      agent: AgentId;
      verdict: JurorVerdict;
      iteration: number;
    }
  | { type: "agent:answer"; agent: "generator"; answer: string; iteration: number }
  | {
      type: "jury:retry";
      iteration: number;
      brief: string;
      score: number;
    }
  | {
      type: "jury:final";
      label: FinalLabel;
      score: number;
      summary: string;
      iterations: number;
    }
  | { type: "trial:error"; message: string }
  | { type: "trial:end" };

export type TrialRequest = {
  prompt: string;
  domain: Domain;
};

export const JUROR_AGENTS: AgentId[] = [
  "critic",
  "factChecker",
  "codeExecutor",
  "math",
  "standards",
];

export const AGENT_LABELS: Record<AgentId, string> = {
  generator: "Generator",
  critic: "Reasoning Critic",
  factChecker: "Fact-Checker",
  codeExecutor: "Code Executor",
  math: "Math Verifier",
  standards: "Standards Verifier",
  aggregator: "Jury Aggregator",
};

export const AGENT_ROLE: Record<AgentId, string> = {
  generator: "Defendant",
  critic: "Juror — Logic",
  factChecker: "Juror — Facts",
  codeExecutor: "Juror — Code",
  math: "Juror — Math",
  standards: "Juror — Standards",
  aggregator: "Judge",
};
