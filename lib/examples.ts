import type { Domain } from "@/lib/openrouter";

export type ExamplePrompt = {
  id: string;
  domain: Domain;
  title: string;
  prompt: string;
  catchHint: string;
};

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    id: "sw-pandas-lookup",
    domain: "software",
    title: "pandas.DataFrame.lookup",
    prompt:
      "Write a self-contained Python function using pandas.DataFrame.lookup() to map a list of (row_label, col_label) pairs to values from a DataFrame. Include a small example that prints the result.",
    catchHint:
      ".lookup() was removed in pandas 2.0 — the Code Executor should see an AttributeError and the Standards Verifier should cite the changelog.",
  },
  {
    id: "sw-s3-sync",
    domain: "software",
    title: "AWS SDK v3 synchronous getSignedUrl",
    prompt:
      "Show me a JavaScript snippet that uses AWS SDK v3 to call s3.getSignedUrl('getObject', params) synchronously and returns the URL.",
    catchHint:
      "AWS SDK v3 uses @aws-sdk/s3-request-presigner asynchronously — Critic + Fact-Checker should catch the synchronous claim.",
  },
  {
    id: "eng-beam-deflection",
    domain: "engineering",
    title: "W12x26 beam deflection",
    prompt:
      "Calculate the maximum mid-span deflection of a 6 m simply supported steel I-beam (W12x26, E = 200 GPa) carrying a single 50 kN point load at mid-span. Show every formula and unit.",
    catchHint:
      "Common mistake: using the UDL formula 5wL^4 / (384EI) instead of PL^3 / (48EI) for a point load.",
  },
  {
    id: "mixed-ieee754-nan",
    domain: "mixed",
    title: "IEEE 754 NaN payload propagation",
    prompt:
      "Cite the exact section of IEEE 754-2019 that defines NaN payload propagation across min(NaN, 1), and quote the relevant sentence.",
    catchHint:
      "LLMs frequently invent section numbers like §7.4 or §7.5. Standards Verifier should flag mismatched citations.",
  },
  {
    id: "fin-macaulay-duration",
    domain: "finance",
    title: "Macaulay duration",
    prompt:
      "Compute the Macaulay duration of a 5-year bond with a 6% annual coupon and a 4% yield to maturity, par value 1000. Show every cash flow and weight.",
    catchHint:
      "Off-by-one errors on cash-flow years are common — Math Verifier should re-derive with deterministic weights.",
  },
];

export function examplesForDomain(domain: Domain): ExamplePrompt[] {
  return EXAMPLE_PROMPTS.filter((p) => p.domain === domain);
}
