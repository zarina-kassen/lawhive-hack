import { readFile } from "node:fs/promises";
import path from "node:path";

import { enrichCase, isMeritsOutcome, type EnrichedCase } from "./enrichment";

export type CaseOutcome = "claimant_won" | "dismissed" | "partly_upheld" | "withdrawn" | "unclear";

export type PrecedentCase = {
  case_number: string;
  claimant: string;
  respondent: string;
  judge_name: string | null;
  judge_raw: string | null;
  decision_date: string;
  country: string;
  jurisdiction: string[];
  judgment_type: string;
  panel_type: string;
  outcome: CaseOutcome;
  outcome_method: string;
  needs_outcome_llm: boolean;
  word_count: number;
  files: Array<{ filename: string; size_kb: number }>;
  total_size_kb: number;
  needs_deep_pass: boolean;
  source_link: string;
  schema_version: string;
  year_folder: string;
};

export type JudgeSummary = {
  n_cases: number;
  n_final_merits: number;
  profile_reliable: boolean;
  claimant_success_rate_final: number;
  outcomes_final_merits: Record<string, number>;
  judgment_types: Record<string, number>;
  top_jurisdictions: Record<string, number>;
  date_range: [string, string];
};

type RawJudgesFile = {
  meta: Record<string, unknown>;
  judges: Record<string, { summary: JudgeSummary; cases: PrecedentCase[] }>;
};

export type JudgeProfile = {
  name: string;
  disposition: "strict" | "lenient";
  summary: JudgeSummary;
  cases: EnrichedCase[];
};

export type CaseIndex = {
  meta: Record<string, unknown>;
  judges: JudgeProfile[];
  byJurisdiction: Map<string, EnrichedCase[]>;
  jurisdictions: Array<{ id: string; count: number }>;
};

let cachedIndex: Promise<CaseIndex> | undefined;

function judgeDisposition(successRate: number): JudgeProfile["disposition"] {
  return successRate >= 0.5 ? "lenient" : "strict";
}

function normaliseCase(judgeName: string, caseRecord: PrecedentCase): PrecedentCase {
  return {
    ...caseRecord,
    judge_name: caseRecord.judge_name ?? judgeName,
    jurisdiction: Array.isArray(caseRecord.jurisdiction) ? caseRecord.jurisdiction : [],
  };
}

async function readJudgesFile(): Promise<RawJudgesFile> {
  const file = await readFile(path.join(process.cwd(), "judges.json"), "utf8");
  return JSON.parse(file) as RawJudgesFile;
}

async function buildIndex(): Promise<CaseIndex> {
  const raw = await readJudgesFile();
  const byJurisdiction = new Map<string, EnrichedCase[]>();
  const judges: JudgeProfile[] = [];

  for (const [name, profile] of Object.entries(raw.judges)) {
    const summary = profile.summary;

    if (name === "UNKNOWN" || !summary.profile_reliable || summary.n_final_merits < 5) {
      continue;
    }

    const cases = profile.cases
      .map((caseRecord) => normaliseCase(name, caseRecord))
      .filter((caseRecord) => caseRecord.judgment_type === "final_merits")
      .filter((caseRecord) => isMeritsOutcome(caseRecord.outcome))
      .map(enrichCase);

    if (cases.length === 0) {
      continue;
    }

    judges.push({
      name,
      disposition: judgeDisposition(summary.claimant_success_rate_final),
      summary,
      cases,
    });

    for (const caseRecord of cases) {
      for (const jurisdiction of caseRecord.jurisdiction) {
        const bucket = byJurisdiction.get(jurisdiction) ?? [];
        bucket.push(caseRecord);
        byJurisdiction.set(jurisdiction, bucket);
      }
    }
  }

  const jurisdictions = Array.from(byJurisdiction.entries())
    .map(([id, cases]) => ({ id, count: cases.length }))
    .sort((a, b) => b.count - a.count);

  judges.sort((a, b) => a.summary.claimant_success_rate_final - b.summary.claimant_success_rate_final);

  return {
    meta: raw.meta,
    judges,
    byJurisdiction,
    jurisdictions,
  };
}

export function getCaseIndex(): Promise<CaseIndex> {
  cachedIndex ??= buildIndex();
  return cachedIndex;
}

export function formatJurisdiction(id: string): string {
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
