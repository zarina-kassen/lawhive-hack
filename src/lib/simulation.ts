import { z } from "zod";

import type { EnrichedCase } from "./enrichment";
import { formatJurisdiction, getCaseIndex, type JudgeProfile } from "./judges";

export const simulationRequestSchema = z.object({
  narrative: z.string().min(20),
  claimedValueGbp: z.number().int().min(0).max(500_000).optional(),
  financialRunwayMonths: z.number().min(0).max(36).optional(),
  emotionalResilience: z.number().min(0).max(100).optional(),
});

export type SimulationRequest = z.infer<typeof simulationRequestSchema>;

export type DebateRound = {
  speaker: string;
  disposition: JudgeProfile["disposition"];
  text: string;
};

export type JudgeVote = {
  judge: string;
  outcome: "win" | "lose";
  award_gbp: number;
  confidence: number;
  key_reason: string;
};

export type DebateResult = {
  id: string;
  strictJudge: string;
  lenientJudge: string;
  strictCase: EnrichedCase;
  lenientCase: EnrichedCase;
  rounds: DebateRound[];
  votes: JudgeVote[];
  disagreement: boolean;
};

export type SimulationResult = {
  caseProfile: {
    narrative: string;
    jurisdictions: string[];
    signals: string[];
  };
  debates: DebateResult[];
  merit: {
    winProbability: number;
    expectedAwardGbp: number;
    awardSpread: { min: number; median: number; max: number };
  };
  realityCost: {
    expectedMonths: number;
    unrecoverableCostGbp: number;
    abandonmentRisk: number;
    netPositionGbp: number;
  };
  worthItVerdict: string;
  caveat: string;
};

const JURISDICTION_KEYWORDS: Array<{ id: string; keywords: string[] }> = [
  { id: "unfair-dismissal", keywords: ["dismiss", "sacked", "fired", "redundant", "termination"] },
  { id: "disability-discrimination", keywords: ["disability", "disabled", "reasonable adjustment", "health condition"] },
  { id: "race-discrimination", keywords: ["race", "racial", "ethnicity", "ethnic"] },
  { id: "sex-discrimination", keywords: ["sexism", "sex discrimination", "pregnant", "pregnancy", "maternity"] },
  { id: "public-interest-disclosure", keywords: ["whistleblow", "whistleblowing", "protected disclosure"] },
  { id: "unlawful-deduction-from-wages", keywords: ["unpaid", "wages", "salary", "deducted", "holiday pay"] },
  { id: "working-time-regulations", keywords: ["hours", "holiday", "breaks", "working time"] },
  { id: "breach-of-contract", keywords: ["contract", "notice", "bonus", "commission"] },
  { id: "redundancy", keywords: ["redundancy", "selection pool", "consultation"] },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[midpoint - 1] + sorted[midpoint]) / 2) : sorted[midpoint];
}

function inferJurisdictions(narrative: string): string[] {
  const text = narrative.toLowerCase();
  const matches = JURISDICTION_KEYWORDS.filter(({ keywords }) => keywords.some((keyword) => text.includes(keyword))).map(
    ({ id }) => id,
  );

  return matches.length > 0 ? matches.slice(0, 3) : ["unfair-dismissal"];
}

function inferSignals(narrative: string): string[] {
  const text = narrative.toLowerCase();
  const signals: string[] = [];

  if (/(grievance|appeal|complain|complaint)/.test(text)) signals.push("raised concerns internally");
  if (/(evidence|email|slack|message|recording|witness)/.test(text)) signals.push("has documentary evidence");
  if (/(pregnant|disabled|race|sex|religion|age|whistle)/.test(text)) signals.push("possible protected ground");
  if (/(less than two years|under two years|probation)/.test(text)) signals.push("short service risk");
  if (/(settlement|acas|early conciliation)/.test(text)) signals.push("settlement route already in play");

  return signals.length > 0 ? signals : ["facts need follow-up questions"];
}

function judgeRelevantCase(judge: JudgeProfile, jurisdictions: string[], preferWin: boolean): EnrichedCase {
  const matching = judge.cases.filter((caseRecord) =>
    caseRecord.jurisdiction.some((jurisdiction) => jurisdictions.includes(jurisdiction)),
  );
  const pool = matching.length > 0 ? matching : judge.cases;
  const preferred = pool.find((caseRecord) =>
    preferWin ? caseRecord.outcome !== "dismissed" : caseRecord.outcome === "dismissed",
  );

  return preferred ?? pool[0];
}

function pickJudgePairs(judges: JudgeProfile[], jurisdictions: string[], count: number): Array<[JudgeProfile, JudgeProfile]> {
  const relevant = judges.filter((judge) =>
    jurisdictions.some((jurisdiction) => judge.summary.top_jurisdictions[jurisdiction] !== undefined),
  );
  const pool = relevant.length >= count * 2 ? relevant : judges;
  const strict = pool.filter((judge) => judge.disposition === "strict");
  const lenient = pool.filter((judge) => judge.disposition === "lenient").reverse();
  const pairs: Array<[JudgeProfile, JudgeProfile]> = [];

  for (let index = 0; index < count; index += 1) {
    pairs.push([strict[index % strict.length], lenient[index % lenient.length]]);
  }

  return pairs;
}

function meritsSignalAdjustment(signals: string[]): number {
  let adjustment = 0;

  if (signals.includes("raised concerns internally")) adjustment += 0.06;
  if (signals.includes("has documentary evidence")) adjustment += 0.08;
  if (signals.includes("possible protected ground")) adjustment += 0.07;
  if (signals.includes("short service risk")) adjustment -= 0.15;

  return adjustment;
}

function voteForJudge(
  judge: JudgeProfile,
  anchor: EnrichedCase,
  signals: string[],
  claimedValueGbp: number | undefined,
): JudgeVote {
  const base = judge.summary.claimant_success_rate_final;
  const anchorPush = anchor.outcome === "dismissed" ? -0.08 : anchor.outcome === "partly_upheld" ? 0.02 : 0.08;
  const score = clamp(base + anchorPush + meritsSignalAdjustment(signals), 0.05, 0.95);
  const outcome = score >= 0.5 ? "win" : "lose";
  const award =
    outcome === "win"
      ? Math.round((anchor.enrichment.award_gbp || claimedValueGbp || 6_000) * clamp(score + 0.2, 0.35, 1.1))
      : 0;

  return {
    judge: judge.name,
    outcome,
    award_gbp: award,
    confidence: Number(clamp(Math.abs(score - 0.5) + 0.5, 0.52, 0.92).toFixed(2)),
    key_reason:
      outcome === "win"
        ? `${judge.name} gives weight to the claimant-side signals and the analogy to ${anchor.case_number}.`
        : `${judge.name} treats the evidential/legal threshold as the main weakness, anchored by ${anchor.case_number}.`,
  };
}

function debateTranscript(
  strictJudge: JudgeProfile,
  lenientJudge: JudgeProfile,
  strictCase: EnrichedCase,
  lenientCase: EnrichedCase,
  jurisdictions: string[],
  signals: string[],
): DebateRound[] {
  const claimLabel = jurisdictions.map(formatJurisdiction).join(" / ");
  const signalLabel = signals.join(", ");

  return [
    {
      speaker: strictJudge.name,
      disposition: "strict",
      text: `I would start from ${strictCase.case_number}, where the ${claimLabel} threshold was not lightly assumed. The risk here is proof: ${signalLabel}.`,
    },
    {
      speaker: lenientJudge.name,
      disposition: "lenient",
      text: `In ${lenientCase.case_number}, the tribunal looked closely at the practical reality for the worker. Those same facts make this case more claimant-friendly.`,
    },
    {
      speaker: strictJudge.name,
      disposition: "strict",
      text: `Even if the account is sympathetic, the claimant still has to prove causation, loss, and timely presentation. I would discount the award for litigation risk.`,
    },
    {
      speaker: lenientJudge.name,
      disposition: "lenient",
      text: `The contemporaneous signals matter. If the documents support the narrative, I would be slow to dismiss this as merely workplace unfairness.`,
    },
  ];
}

function buildWorthItVerdict(winProbability: number, netPositionGbp: number, abandonmentRisk: number, months: number): string {
  const legalStrength = winProbability >= 0.6 ? "Likely win" : winProbability >= 0.42 ? "Live case" : "Uphill case";
  const worth = netPositionGbp >= 0 && abandonmentRisk < 0.45 ? "worth exploring" : "probably not worth it without settlement leverage";

  return `${legalStrength} (${Math.round(winProbability * 100)}%), but expected net ${netPositionGbp < 0 ? "-" : "+"}£${Math.abs(
    netPositionGbp,
  ).toLocaleString()} over ~${months} months with ${Math.round(abandonmentRisk * 100)}% abandonment risk. Worth it? ${worth}.`;
}

export async function runSimulation(request: SimulationRequest): Promise<SimulationResult> {
  const index = await getCaseIndex();
  const jurisdictions = inferJurisdictions(request.narrative);
  const signals = inferSignals(request.narrative);
  const pairs = pickJudgePairs(index.judges, jurisdictions, 5);

  const debates = pairs.map(([strictJudge, lenientJudge], pairIndex) => {
    const strictCase = judgeRelevantCase(strictJudge, jurisdictions, false);
    const lenientCase = judgeRelevantCase(lenientJudge, jurisdictions, true);
    const votes = [
      voteForJudge(strictJudge, strictCase, signals, request.claimedValueGbp),
      voteForJudge(lenientJudge, lenientCase, signals, request.claimedValueGbp),
    ];

    return {
      id: `debate-${pairIndex + 1}`,
      strictJudge: strictJudge.name,
      lenientJudge: lenientJudge.name,
      strictCase,
      lenientCase,
      rounds: debateTranscript(strictJudge, lenientJudge, strictCase, lenientCase, jurisdictions, signals),
      votes,
      disagreement: votes[0].outcome !== votes[1].outcome,
    };
  });

  const votes = debates.flatMap((debate) => debate.votes);
  const winningAwards = votes.filter((vote) => vote.outcome === "win").map((vote) => vote.award_gbp);
  const winProbability = votes.filter((vote) => vote.outcome === "win").length / votes.length;
  const expectedAwardGbp = winningAwards.length > 0 ? Math.round(winningAwards.reduce((sum, award) => sum + award, 0) / winningAwards.length) : 0;
  const months = Math.round(
    debates.flatMap((debate) => [debate.strictCase, debate.lenientCase]).reduce((sum, caseRecord) => sum + caseRecord.enrichment.months_to_resolution, 0) /
      (debates.length * 2),
  );
  const financialRunway = request.financialRunwayMonths ?? 6;
  const resilience = request.emotionalResilience ?? 55;
  const unrecoverableCostGbp = Math.round(months * 850 + Math.max(0, 12 - financialRunway) * 350);
  const abandonmentRisk = clamp(0.18 + months / 60 + Math.max(0, 50 - resilience) / 100 + Math.max(0, 8 - financialRunway) / 30, 0.08, 0.88);
  const netPositionGbp = Math.round(winProbability * expectedAwardGbp - unrecoverableCostGbp);

  return {
    caseProfile: {
      narrative: request.narrative,
      jurisdictions,
      signals,
    },
    debates,
    merit: {
      winProbability,
      expectedAwardGbp,
      awardSpread: {
        min: winningAwards.length > 0 ? Math.min(...winningAwards) : 0,
        median: winningAwards.length > 0 ? median(winningAwards) : 0,
        max: winningAwards.length > 0 ? Math.max(...winningAwards) : 0,
      },
    },
    realityCost: {
      expectedMonths: months,
      unrecoverableCostGbp,
      abandonmentRisk,
      netPositionGbp,
    },
    worthItVerdict: buildWorthItVerdict(winProbability, netPositionGbp, abandonmentRisk, months),
    caveat: "Awards, timelines, reasoning blurbs, and demo debate text are synthetic hackathon enrichment, not real tribunal compensation data.",
  };
}
