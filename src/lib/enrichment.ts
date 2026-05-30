import type { CaseRecord, EnrichedCaseRecord } from "./judges";

function stableNumber(input: string, modulo: number): number {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash % modulo;
}

function hasJurisdiction(caseRecord: CaseRecord, fragment: string): boolean {
  return caseRecord.jurisdiction.some((jurisdiction) => jurisdiction.includes(fragment));
}

function awardBand(caseRecord: CaseRecord): [number, number] {
  if (caseRecord.outcome === "dismissed" || caseRecord.outcome === "withdrawn") return [0, 0];

  if (hasJurisdiction(caseRecord, "discrimination")) return [8_000, 45_000];
  if (hasJurisdiction(caseRecord, "unfair-dismissal")) return [4_000, 22_000];
  if (hasJurisdiction(caseRecord, "redundancy")) return [2_000, 14_000];
  if (hasJurisdiction(caseRecord, "wages") || hasJurisdiction(caseRecord, "contract")) return [750, 8_000];

  return [1_000, 12_000];
}

function estimateAward(caseRecord: CaseRecord): number {
  const [min, max] = awardBand(caseRecord);
  if (max === 0) return 0;

  const spread = max - min;
  const amount = min + stableNumber(caseRecord.case_number, spread + 1);

  return caseRecord.outcome === "partly_upheld" ? Math.round(amount * 0.55) : amount;
}

function estimateMonths(caseRecord: CaseRecord): number {
  const base = hasJurisdiction(caseRecord, "discrimination") ? 14 : 8;
  const panelDelay = caseRecord.panel_type === "full_panel" ? 4 : 0;

  return base + panelDelay + stableNumber(`${caseRecord.case_number}-months`, 9);
}

function buildReasoningBlurb(caseRecord: CaseRecord): string {
  const claimant = caseRecord.claimant ?? "the claimant";
  const respondent = caseRecord.respondent ?? "the respondent";
  const claimType = caseRecord.jurisdiction[0]?.replaceAll("-", " ") ?? "employment";

  if (caseRecord.outcome === "claimant_won") {
    return `The tribunal accepted ${claimant}'s core ${claimType} allegations and found ${respondent}'s explanation did not displace the claimant's account.`;
  }

  if (caseRecord.outcome === "partly_upheld") {
    return `The tribunal accepted part of the ${claimType} case but rejected wider allegations or limited the remedy to the proven loss.`;
  }

  return `The tribunal preferred ${respondent}'s explanation or found the evidence did not meet the threshold for the ${claimType} claim.`;
}

export function enrichCase(caseRecord: CaseRecord): EnrichedCaseRecord {
  if (caseRecord.enrichment) return caseRecord as EnrichedCaseRecord;

  return {
    ...caseRecord,
    enrichment: {
      synthetic: true,
      award_gbp: estimateAward(caseRecord),
      months_to_resolution: estimateMonths(caseRecord),
      reasoning_blurb: buildReasoningBlurb(caseRecord),
    },
  };
}
