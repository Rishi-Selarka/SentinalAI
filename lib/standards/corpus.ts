// A small curated standards corpus. The Standards Verifier is grounded by
// these excerpts so it can flag invented section numbers. Keep entries short,
// quotable, and accurate. Add more as needed for richer demo coverage.

import type { Domain } from "@/lib/openrouter";

export type StandardExcerpt = {
  source: string;
  section: string;
  domains: Domain[];
  text: string;
};

export const STANDARDS_CORPUS: StandardExcerpt[] = [
  {
    source: "IEEE 754-2019",
    section: "§6.2 (NaN handling)",
    domains: ["software", "mixed", "engineering"],
    text:
      "When neither operand is a signaling NaN, min(x, NaN) and min(NaN, x) return x for the IEEE 754-2019 minimumNumber operation. The historical minNum operation also propagates the non-NaN value. A signaling NaN raises invalidOperation.",
  },
  {
    source: "IEEE 754-2019",
    section: "§6.2.3 (NaN payload propagation)",
    domains: ["software", "mixed"],
    text:
      "The standard does not mandate a specific payload for the NaN produced by operations on quiet NaNs; implementations may choose one of the operand payloads or a default. There is no §7.4 or §7.5 governing payload propagation — claims to that effect are commonly hallucinated.",
  },
  {
    source: "Python pandas 2.0 release notes",
    section: "Removed deprecations",
    domains: ["software"],
    text:
      "pandas 2.0 removes DataFrame.lookup(). Migration: use DataFrame.melt + boolean indexing, or numpy fancy indexing on .values, or DataFrame.reindex / .merge depending on the use case. Code calling df.lookup(...) raises AttributeError on pandas >= 2.0.",
  },
  {
    source: "AWS SDK for JavaScript v3 docs (S3 client)",
    section: "getSignedUrl",
    domains: ["software"],
    text:
      "In AWS SDK v3, presigned URLs are generated via the @aws-sdk/s3-request-presigner package and the getSignedUrl(client, command, options) function, which is asynchronous and returns a Promise<string>. There is no synchronous variant; calls like s3.getSignedUrl('getObject', params) belong to v2 of the SDK.",
  },
  {
    source: "PEP 8",
    section: "Indentation",
    domains: ["software"],
    text:
      "PEP 8 recommends 4 spaces per indentation level. Tabs are discouraged and should never be mixed with spaces.",
  },
  {
    source: "Beam deflection (Euler-Bernoulli)",
    section: "Simply supported, central point load",
    domains: ["engineering"],
    text:
      "For a simply supported beam of length L with a single point load P applied at mid-span, the maximum deflection at mid-span is δ_max = P · L^3 / (48 · E · I). A common hallucination is using the UDL formula 5·w·L^4 / (384·E·I) instead.",
  },
  {
    source: "Beam deflection (Euler-Bernoulli)",
    section: "Simply supported, uniformly distributed load",
    domains: ["engineering"],
    text:
      "For a simply supported beam of length L under a uniformly distributed load w, the maximum deflection at mid-span is δ_max = 5 · w · L^4 / (384 · E · I).",
  },
  {
    source: "AISC Steel Construction Manual",
    section: "W12x26 section properties",
    domains: ["engineering"],
    text:
      "W12x26: depth d ≈ 12.22 in, flange width b_f ≈ 6.49 in, moment of inertia about strong axis I_x ≈ 204 in^4, cross-section area A ≈ 7.65 in^2. Use I_x for major-axis bending deflection.",
  },
  {
    source: "Bond mathematics (standard textbook)",
    section: "Macaulay duration",
    domains: ["finance"],
    text:
      "Macaulay duration is the weighted average time of bond cash flows, where each weight is the present value of the cash flow divided by the bond's price. For an annual-coupon bond, the periods used are integer years 1, 2, …, N at the bond's yield to maturity.",
  },
  {
    source: "ASCE 7-22",
    section: "§2.3 (Basic combinations for strength design)",
    domains: ["engineering"],
    text:
      "Strength-design load combinations in ASCE 7-22 §2.3.1 include 1.4D and 1.2D + 1.6L + 0.5(Lr or S or R) among others. Claims that ASCE 7 specifies a combination of '1.5D + 1.5L' are not part of the standard.",
  },
  {
    source: "IS 456:2000",
    section: "Cl. 39.3 (Limit state for collapse, flexure)",
    domains: ["engineering"],
    text:
      "IS 456 Cl. 39.3 uses a partial safety factor of 1.5 on the characteristic strength of concrete (fck) for limit state of collapse in flexure (resulting in design strength 0.67·fck / 1.5 = 0.447·fck after the stress block factor).",
  },
  {
    source: "Generally Accepted Accounting Principles (US GAAP)",
    section: "ASC 842 (Leases)",
    domains: ["finance"],
    text:
      "ASC 842 requires lessees to recognize a right-of-use asset and lease liability for nearly all leases on the balance sheet, replacing the prior operating/capital lease split in ASC 840.",
  },
];

export function selectExcerpts(domain: Domain, limit = 8): StandardExcerpt[] {
  const matching = STANDARDS_CORPUS.filter((e) => e.domains.includes(domain));
  return matching.slice(0, limit);
}

export function corpusBlock(domain: Domain): string {
  const items = selectExcerpts(domain);
  return items
    .map(
      (e, i) =>
        `[#${i + 1}] ${e.source} — ${e.section}\n${e.text}`,
    )
    .join("\n\n");
}
