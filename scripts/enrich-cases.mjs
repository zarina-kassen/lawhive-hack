import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "judges.json");
const OUT_DIR = path.join(ROOT, "data");
const OUT = path.join(OUT_DIR, "enriched.json");

const WIN_OUTCOMES = new Set(["claimant_won", "partly_upheld"]);
const FINAL_OUTCOMES = new Set(["claimant_won", "partly_upheld", "dismissed"]);

const AWARD_BANDS = [
  {
    match: (jurisdictions) => jurisdictions.some((j) => j.includes("discrimination")),
    label: "discrimination",
    min: 6000,
    max: 45000,
    months: [14, 26]
  },
  {
    match: (jurisdictions) => jurisdictions.includes("public-interest-disclosure"),
    label: "whistleblowing",
    min: 8000,
    max: 55000,
    months: [14, 28]
  },
  {
    match: (jurisdictions) => jurisdictions.includes("unfair-dismissal"),
    label: "unfair dismissal",
    min: 5000,
    max: 18000,
    months: [9, 20]
  },
  {
    match: (jurisdictions) => jurisdictions.includes("redundancy"),
    label: "redundancy",
    min: 2500,
    max: 16000,
    months: [8, 18]
  },
  {
    match: (jurisdictions) => jurisdictions.includes("unlawful-deduction-from-wages"),
    label: "wage deduction",
    min: 500,
    max: 5000,
    months: [6, 14]
  },
  {
    match: (jurisdictions) => jurisdictions.includes("working-time-regulations"),
    label: "working time",
    min: 750,
    max: 6000,
    months: [7, 15]
  },
  {
    match: (jurisdictions) => jurisdictions.includes("breach-of-contract"),
    label: "contract",
    min: 1000,
    max: 9000,
    months: [7, 16]
  },
  {
    match: (jurisdictions) => jurisdictions.includes("protective-award"),
    label: "protective award",
    min: 4000,
    max: 25000,
    months: [8, 18]
  }
];

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function ratio(seed, salt) {
  return (hashString(`${seed}:${salt}`) % 10000) / 10000;
}

function intBetween(seed, salt, min, max) {
  return Math.round(min + ratio(seed, salt) * (max - min));
}

function bandFor(jurisdictions) {
  return AWARD_BANDS.find((band) => band.match(jurisdictions)) ?? {
    label: "employment rights",
    min: 1500,
    max: 12000,
    months: [8, 18]
  };
}

function syntheticAward(caseRecord) {
  if (!WIN_OUTCOMES.has(caseRecord.outcome)) {
    return 0;
  }

  const band = bandFor(caseRecord.jurisdiction ?? []);
  const raw = intBetween(caseRecord.case_number, "award", band.min, band.max);
  const partlyDiscount = caseRecord.outcome === "partly_upheld" ? 0.48 : 1;
  return Math.round((raw * partlyDiscount) / 100) * 100;
}

function syntheticMonths(caseRecord) {
  const band = bandFor(caseRecord.jurisdiction ?? []);
  let [min, max] = band.months;

  if (caseRecord.panel_type === "full_panel") {
    min += 2;
    max += 3;
  }

  if (caseRecord.outcome === "dismissed") {
    max = Math.max(min, max - 3);
  }

  return intBetween(caseRecord.case_number, "months", min, max);
}

function reasoningBlurb(caseRecord) {
  const jurisdictions = caseRecord.jurisdiction ?? [];
  const band = bandFor(jurisdictions);
  const claim = band.label;

  if (caseRecord.outcome === "claimant_won") {
    return `The tribunal accepted the core ${claim} complaint, treating the claimant's contemporaneous account and the respondent's process gaps as decisive. Remedy is modelled from typical awards for this claim type, not extracted from the PDF.`;
  }

  if (caseRecord.outcome === "partly_upheld") {
    return `The tribunal found some parts of the ${claim} complaint proved but rejected wider allegations or reduced remedy for evidential and causation limits. Remedy is synthetic and should be replaced by a deep-pass extraction before production use.`;
  }

  return `The tribunal dismissed the ${claim} complaint, most plausibly because the claimant could not prove the legal test, causation, or procedural unfairness on the available evidence. No award is modelled for a dismissed final-merits outcome.`;
}

function disposition(rate) {
  if (rate <= 0.33) return "employer_leaning";
  if (rate >= 0.67) return "claimant_leaning";
  return "balanced";
}

function makeCaseId(judgeName, caseRecord) {
  return `${judgeName}:${caseRecord.case_number}`.replace(/\s+/g, "-");
}

function main() {
  const source = JSON.parse(readFileSync(SOURCE, "utf8"));
  const judgeProfiles = [];
  const cases = [];
  const jurisdictionIndex = {};

  for (const [judgeName, judge] of Object.entries(source.judges)) {
    const summary = judge.summary;
    if (judgeName === "UNKNOWN" || !summary?.profile_reliable) {
      continue;
    }

    const profile = {
      id: judgeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name: judgeName,
      nCases: summary.n_cases,
      nFinalMerits: summary.n_final_merits,
      claimantSuccessRateFinal: summary.claimant_success_rate_final,
      disposition: disposition(summary.claimant_success_rate_final),
      topJurisdictions: summary.top_jurisdictions,
      dateRange: summary.date_range
    };
    judgeProfiles.push(profile);

    for (const caseRecord of judge.cases ?? []) {
      if (caseRecord.judgment_type !== "final_merits" || !FINAL_OUTCOMES.has(caseRecord.outcome)) {
        continue;
      }

      const id = makeCaseId(judgeName, caseRecord);
      const enriched = {
        id,
        caseNumber: caseRecord.case_number,
        claimant: caseRecord.claimant,
        respondent: caseRecord.respondent,
        judgeName,
        decisionDate: caseRecord.decision_date,
        country: caseRecord.country,
        jurisdiction: caseRecord.jurisdiction ?? [],
        judgmentType: caseRecord.judgment_type,
        panelType: caseRecord.panel_type,
        outcome: caseRecord.outcome,
        wordCount: caseRecord.word_count,
        files: caseRecord.files ?? [],
        sourceLink: caseRecord.source_link,
        synthetic: {
          synthetic: true,
          awardGbp: syntheticAward(caseRecord),
          monthsToResolution: syntheticMonths(caseRecord),
          reasoningBlurb: reasoningBlurb(caseRecord)
        }
      };

      cases.push(enriched);
      for (const jurisdiction of enriched.jurisdiction) {
        jurisdictionIndex[jurisdiction] ??= [];
        jurisdictionIndex[jurisdiction].push(id);
      }
    }
  }

  judgeProfiles.sort((a, b) => a.name.localeCompare(b.name));
  cases.sort((a, b) => a.judgeName.localeCompare(b.judgeName) || a.caseNumber.localeCompare(b.caseNumber));

  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      sourceSchemaVersion: source.meta.schema_version,
      sourceCaseCount: source.meta.n_cases,
      sourceJudgeCount: source.meta.n_distinct_judges,
      reliableNamedJudgeCount: judgeProfiles.length,
      enrichedFinalMeritsCaseCount: cases.length,
      syntheticFields: ["awardGbp", "monthsToResolution", "reasoningBlurb"],
      warning: "Synthetic fields are plausible hackathon data, not extracted tribunal facts."
    },
    judgeProfiles,
    cases,
    jurisdictionIndex
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${path.relative(ROOT, OUT)} with ${cases.length} enriched cases across ${judgeProfiles.length} named reliable judges.`);
}

main();
