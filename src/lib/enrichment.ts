import { createHash } from "node:crypto";

import type { CaseOutcome, PrecedentCase } from "./judges";

export type EnrichedCase = PrecedentCase & {
  enrichment: {
    synthetic: true;
    award_gbp: number;
    months_to_resolution: number;
    reasoning_blurb: string;
  };
};

const DISCRIMINATION_TAGS = [
  "disability-discrimination",
  "race-discrimination",
  "sex-discrimination",
  "age-discrimination",
  "religion-or-belief-discrimination",
  "victimisation-discrimination",
  "sexual-orientation-discrimination-transexualism",
];

function hashRatio(seed: string): number {
  const digest = createHash("sha256").update(seed).digest("hex").slice(0, 8);
  return Number.parseInt(digest, 16) / 0xffffffff;
}

function includesAny(values: string[], candidates: string[]): boolean {
  return candidates.some((candidate) => values.includes(candidate));
}

function awardBand(caseRecord: PrecedentCase): [number, number] {
  const jurisdictions = caseRecord.jurisdiction;

  if (caseRecord.outcome === "dismissed" || caseRecord.outcome === "withdrawn") {
    return [0, 0];
  }

  if (includesAny(jurisdictions, DISCRIMINATION_TAGS)) {
    return caseRecord.outcome === "partly_upheld" ? [2_500, 18_000] : [8_000, 65_000];
  }

  if (jurisdictions.includes("unfair-dismissal")) {
    return caseRecord.outcome === "partly_upheld" ? [1_500, 10_000] : [5_000, 28_000];
  }

  if (
    jurisdictions.includes("unlawful-deduction-from-wages") ||
    jurisdictions.includes("working-time-regulations") ||
    jurisdictions.includes("breach-of-contract")
  ) {
    return caseRecord.outcome === "partly_upheld" ? [300, 3_500] : [900, 9_000];
  }

  if (jurisdictions.includes("redundancy")) {
    return caseRecord.outcome === "partly_upheld" ? [1_000, 7_500] : [4_000, 22_000];
  }

  return caseRecord.outcome === "partly_upheld" ? [750, 6_000] : [2_500, 18_000];
}

function resolutionBand(caseRecord: PrecedentCase): [number, number] {
  const jurisdictions = caseRecord.jurisdiction;

  if (includesAny(jurisdictions, DISCRIMINATION_TAGS) || caseRecord.panel_type === "full_panel") {
    return [14, 28];
  }

  if (caseRecord.judgment_type === "strike_out") {
    return [4, 10];
  }

  if (jurisdictions.includes("unfair-dismissal") || jurisdictions.includes("public-interest-disclosure")) {
    return [10, 24];
  }

  return [6, 18];
}

function scaledInteger(seed: string, min: number, max: number): number {
  if (min === max) {
    return min;
  }

  return Math.round(min + hashRatio(seed) * (max - min));
}

function reasoningBlurb(caseRecord: PrecedentCase): string {
  const mainClaim = caseRecord.jurisdiction[0]?.replaceAll("-", " ") ?? "employment";
  const claimant = caseRecord.claimant || "the claimant";
  const respondent = caseRecord.respondent || "the respondent";

  if (caseRecord.outcome === "claimant_won") {
    return `The tribunal accepted ${claimant}'s core ${mainClaim} allegations and found ${respondent}'s explanation did not displace the claimant's account.`;
  }

  if (caseRecord.outcome === "partly_upheld") {
    return `The tribunal accepted part of the ${mainClaim} case but rejected wider allegations or limited the remedy to the proven loss.`;
  }

  if (caseRecord.outcome === "dismissed") {
    return `The tribunal dismissed the ${mainClaim} claim because the evidence did not meet the legal threshold or the respondent's reason was preferred.`;
  }

  return `The published result was unclear in the fast-pass data, so this case should only be used as a weak analogy.`;
}

export function enrichCase(caseRecord: PrecedentCase): EnrichedCase {
  const [awardMin, awardMax] = awardBand(caseRecord);
  const [monthsMin, monthsMax] = resolutionBand(caseRecord);

  return {
    ...caseRecord,
    enrichment: {
      synthetic: true,
      award_gbp: scaledInteger(`${caseRecord.case_number}:award`, awardMin, awardMax),
      months_to_resolution: scaledInteger(`${caseRecord.case_number}:months`, monthsMin, monthsMax),
      reasoning_blurb: reasoningBlurb(caseRecord),
    },
  };
}

export function isMeritsOutcome(outcome: CaseOutcome): boolean {
  return outcome === "claimant_won" || outcome === "partly_upheld" || outcome === "dismissed";
}
