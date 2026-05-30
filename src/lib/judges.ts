import { readFile } from "node:fs/promises";

import { enrichCase } from "./enrichment";

export type TribunalOutcome = "claimant_won" | "dismissed" | "partly_upheld" | "withdrawn" | "unclear";

export type CaseRecord = {
  case_number: string;
  claimant: string | null;
  respondent: string | null;
  judge_name: string | null;
  judge_raw?: string | null;
  decision_date: string;
  country?: string;
  jurisdiction: string[];
  judgment_type: string;
  panel_type?: string;
  outcome: TribunalOutcome;
  source_link?: string;
  enrichment?: {
    synthetic: true;
    award_gbp: number;
    months_to_resolution: number;
    reasoning_blurb: string;
  };
};

export type EnrichedCaseRecord = CaseRecord & {
  enrichment: {
    synthetic: true;
    award_gbp: number;
    months_to_resolution: number;
    reasoning_blurb: string;
  };
};

export type JudgeProfile = {
  name: string;
  nFinalMerits: number;
  claimantSuccessRateFinal: number;
  topJurisdictions: string[];
  cases: EnrichedCaseRecord[];
};

export type CaseIndex = {
  cases: EnrichedCaseRecord[];
  judges: JudgeProfile[];
  byJurisdiction: Map<string, EnrichedCaseRecord[]>;
  jurisdictions: { id: string; count: number }[];
};

type RawJudgesFile = {
  judges: Record<
    string,
    {
      summary?: {
        n_final_merits?: number;
        profile_reliable?: boolean;
        claimant_success_rate_final?: number;
        top_jurisdictions?: Record<string, number>;
      };
      cases?: CaseRecord[];
    }
  >;
};

type EnrichedFile = {
  cases: EnrichedCaseRecord[];
  jurisdictions?: { id: string; count: number }[];
};

let cachedIndex: Promise<CaseIndex> | undefined;

async function readJsonFile<T>(fileUrl: URL): Promise<T | undefined> {
  try {
    const contents = await readFile(fileUrl, "utf8");
    return JSON.parse(contents) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function isFinalMeritsCase(caseRecord: CaseRecord): boolean {
  return caseRecord.judgment_type === "final_merits" && caseRecord.outcome !== "unclear";
}

function buildJurisdictionIndex(cases: EnrichedCaseRecord[]): {
  byJurisdiction: Map<string, EnrichedCaseRecord[]>;
  jurisdictions: { id: string; count: number }[];
} {
  const byJurisdiction = new Map<string, EnrichedCaseRecord[]>();

  for (const caseRecord of cases) {
    for (const jurisdiction of caseRecord.jurisdiction) {
      byJurisdiction.set(jurisdiction, [...(byJurisdiction.get(jurisdiction) ?? []), caseRecord]);
    }
  }

  const jurisdictions = Array.from(byJurisdiction.entries())
    .map(([id, records]) => ({ id, count: records.length }))
    .sort((left, right) => right.count - left.count);

  return { byJurisdiction, jurisdictions };
}

function deriveProfiles(cases: EnrichedCaseRecord[]): JudgeProfile[] {
  const casesByJudge = new Map<string, EnrichedCaseRecord[]>();

  for (const caseRecord of cases) {
    if (!caseRecord.judge_name) continue;
    casesByJudge.set(caseRecord.judge_name, [...(casesByJudge.get(caseRecord.judge_name) ?? []), caseRecord]);
  }

  return Array.from(casesByJudge.entries())
    .map(([name, judgeCases]) => {
      const claimantWins = judgeCases.filter(
        (caseRecord) => caseRecord.outcome === "claimant_won" || caseRecord.outcome === "partly_upheld",
      ).length;
      const jurisdictionCounts = new Map<string, number>();

      for (const caseRecord of judgeCases) {
        for (const jurisdiction of caseRecord.jurisdiction) {
          jurisdictionCounts.set(jurisdiction, (jurisdictionCounts.get(jurisdiction) ?? 0) + 1);
        }
      }

      return {
        name,
        nFinalMerits: judgeCases.length,
        claimantSuccessRateFinal: claimantWins / judgeCases.length,
        topJurisdictions: Array.from(jurisdictionCounts.entries())
          .sort((left, right) => right[1] - left[1])
          .slice(0, 5)
          .map(([jurisdiction]) => jurisdiction),
        cases: judgeCases,
      };
    })
    .filter((profile) => profile.nFinalMerits >= 5)
    .sort((left, right) => left.claimantSuccessRateFinal - right.claimantSuccessRateFinal);
}

function buildIndexFromEnrichedFile(enrichedFile: EnrichedFile): CaseIndex {
  const cases = enrichedFile.cases.filter(isFinalMeritsCase);
  const { byJurisdiction, jurisdictions } = buildJurisdictionIndex(cases);

  return {
    cases,
    judges: deriveProfiles(cases),
    byJurisdiction,
    jurisdictions: enrichedFile.jurisdictions ?? jurisdictions,
  };
}

function buildIndexFromRawFile(rawFile: RawJudgesFile): CaseIndex {
  const judges: JudgeProfile[] = [];
  const cases: EnrichedCaseRecord[] = [];

  for (const [name, judge] of Object.entries(rawFile.judges)) {
    const summary = judge.summary;
    if (!summary?.profile_reliable || name === "UNKNOWN") continue;

    const judgeCases = (judge.cases ?? []).filter(isFinalMeritsCase).map(enrichCase);
    if (judgeCases.length === 0) continue;

    cases.push(...judgeCases);
    judges.push({
      name,
      nFinalMerits: summary.n_final_merits ?? judgeCases.length,
      claimantSuccessRateFinal: summary.claimant_success_rate_final ?? 0.5,
      topJurisdictions: Object.keys(summary.top_jurisdictions ?? {}),
      cases: judgeCases,
    });
  }

  const { byJurisdiction, jurisdictions } = buildJurisdictionIndex(cases);

  return {
    cases,
    judges: judges.sort((left, right) => left.claimantSuccessRateFinal - right.claimantSuccessRateFinal),
    byJurisdiction,
    jurisdictions,
  };
}

export function getCaseIndex(): Promise<CaseIndex> {
  cachedIndex ??= (async () => {
    const rawFile = await readJsonFile<RawJudgesFile>(new URL("../../judges.json", import.meta.url));
    if (rawFile) return buildIndexFromRawFile(rawFile);

    const enrichedFile = await readJsonFile<EnrichedFile>(new URL("../../enriched.json", import.meta.url));
    if (enrichedFile) return buildIndexFromEnrichedFile(enrichedFile);

    throw new Error("No tribunal case data found. Run `npm run enrich` or add `judges.json`.");
  })();

  return cachedIndex;
}
