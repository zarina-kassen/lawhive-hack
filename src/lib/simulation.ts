import { z } from "zod";
import { generateText } from "ai";

import type { EnrichedCase } from "./enrichment";
import { getOpusModel } from "./gateway";
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

function buildWorthItVerdict(winProbability: number, netPositionGbp: number, abandonmentRisk: number, months: number): string {
  const legalStrength = winProbability >= 0.6 ? "Likely win" : winProbability >= 0.42 ? "Live case" : "Uphill case";
  const worth = netPositionGbp >= 0 && abandonmentRisk < 0.45 ? "worth exploring" : "probably not worth it without settlement leverage";

  return `${legalStrength} (${Math.round(winProbability * 100)}%), but expected net ${netPositionGbp < 0 ? "-" : "+"}£${Math.abs(
    netPositionGbp,
  ).toLocaleString()} over ~${months} months with ${Math.round(abandonmentRisk * 100)}% abandonment risk. Worth it? ${worth}.`;
}

function judgeSystemPrompt(judge: JudgeProfile, anchor: EnrichedCase): string {
  return [
    `You are Employment Judge ${judge.name}, simulated from real UK Employment Tribunal metadata.`,
    `Your judicial disposition is ${judge.disposition}.`,
    `Your final-merits claimant success rate is ${Math.round(judge.summary.claimant_success_rate_final * 100)}% across ${judge.summary.n_final_merits} final-merits cases.`,
    `Your top jurisdictions are: ${Object.entries(judge.summary.top_jurisdictions)
      .slice(0, 6)
      .map(([jurisdiction, count]) => `${formatJurisdiction(jurisdiction)} (${count})`)
      .join(", ")}.`,
    `Anchor precedent case: ${anchor.case_number}, ${anchor.claimant} v ${anchor.respondent}.`,
    `Anchor case outcome: ${anchor.outcome}. Jurisdictions: ${anchor.jurisdiction.map(formatJurisdiction).join(", ")}.`,
    `Synthetic anchor reasoning, for hackathon demo only: ${anchor.enrichment.reasoning_blurb}`,
    "Reason as this judge persona only. Do not mention that you are an AI model.",
  ].join("\n");
}

function userCasePrompt(request: SimulationRequest, jurisdictions: string[], signals: string[]): string {
  return [
    "Employee narrative:",
    request.narrative,
    "",
    `Detected claim types: ${jurisdictions.map(formatJurisdiction).join(", ")}.`,
    `Detected signals: ${signals.join(", ")}.`,
    request.claimedValueGbp ? `Claimant's expected value: £${request.claimedValueGbp.toLocaleString("en-GB")}.` : "",
    "",
    "Argue the likely Employment Tribunal outcome from your persona's perspective. Be concrete and concise.",
  ].join("\n");
}

async function generateJudgeArgument({
  judge,
  anchor,
  request,
  jurisdictions,
  signals,
  previousArgument,
}: {
  judge: JudgeProfile;
  anchor: EnrichedCase;
  request: SimulationRequest;
  jurisdictions: string[];
  signals: string[];
  previousArgument?: DebateRound;
}): Promise<string> {
  const rebuttalInstruction = previousArgument
    ? `\n\nYou are replying to ${previousArgument.speaker}'s argument:\n"${previousArgument.text}"\n\nRebut it directly.`
    : "\n\nOpen the debate.";
  const { text } = await generateText({
    model: getOpusModel(),
    system: judgeSystemPrompt(judge, anchor),
    prompt: `${userCasePrompt(request, jurisdictions, signals)}${rebuttalInstruction}`,
    temperature: 0.35,
    maxOutputTokens: 420,
  });

  return text.trim();
}

const voteSchema = z.object({
  outcome: z.enum(["win", "lose"]),
  award_gbp: z.number().int().min(0).max(500_000),
  confidence: z.number().min(0).max(1),
  key_reason: z.string().min(10).max(1_000),
});

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Opus vote did not include a JSON object. Response preview: ${trimmed.slice(0, 220)}`);
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

async function generateJudgeVote({
  judge,
  anchor,
  request,
  jurisdictions,
  signals,
  rounds,
}: {
  judge: JudgeProfile;
  anchor: EnrichedCase;
  request: SimulationRequest;
  jurisdictions: string[];
  signals: string[];
  rounds: DebateRound[];
}): Promise<JudgeVote> {
  const { text } = await generateText({
    model: getOpusModel(),
    system: judgeSystemPrompt(judge, anchor),
    prompt: [
      userCasePrompt(request, jurisdictions, signals),
      "",
      "Debate so far:",
      ...rounds.map((round) => `${round.speaker}: ${round.text}`),
      "",
      "Cast your final vote. Award must be 0 if outcome is lose. If outcome is win, award must be a plausible GBP tribunal award based on the facts and anchor case.",
      'Return ONLY valid JSON with exactly these keys: {"outcome":"win"|"lose","award_gbp":number,"confidence":number,"key_reason":string}.',
    ].join("\n"),
    temperature: 0.2,
    maxOutputTokens: 320,
  });
  const object = voteSchema.parse(parseJsonObject(text));

  return {
    judge: judge.name,
    outcome: object.outcome,
    award_gbp: object.outcome === "lose" ? 0 : object.award_gbp,
    confidence: Number(object.confidence.toFixed(2)),
    key_reason: object.key_reason,
  };
}

async function runDebate({
  strictJudge,
  lenientJudge,
  strictCase,
  lenientCase,
  request,
  jurisdictions,
  signals,
  pairIndex,
}: {
  strictJudge: JudgeProfile;
  lenientJudge: JudgeProfile;
  strictCase: EnrichedCase;
  lenientCase: EnrichedCase;
  request: SimulationRequest;
  jurisdictions: string[];
  signals: string[];
  pairIndex: number;
}): Promise<DebateResult> {
  const strictOpening: DebateRound = {
    speaker: strictJudge.name,
    disposition: "strict",
    text: await generateJudgeArgument({ judge: strictJudge, anchor: strictCase, request, jurisdictions, signals }),
  };
  const lenientReply: DebateRound = {
    speaker: lenientJudge.name,
    disposition: "lenient",
    text: await generateJudgeArgument({
      judge: lenientJudge,
      anchor: lenientCase,
      request,
      jurisdictions,
      signals,
      previousArgument: strictOpening,
    }),
  };
  const strictReply: DebateRound = {
    speaker: strictJudge.name,
    disposition: "strict",
    text: await generateJudgeArgument({
      judge: strictJudge,
      anchor: strictCase,
      request,
      jurisdictions,
      signals,
      previousArgument: lenientReply,
    }),
  };
  const rounds = [strictOpening, lenientReply, strictReply];
  const votes = await Promise.all([
    generateJudgeVote({ judge: strictJudge, anchor: strictCase, request, jurisdictions, signals, rounds }),
    generateJudgeVote({ judge: lenientJudge, anchor: lenientCase, request, jurisdictions, signals, rounds }),
  ]);

  return {
    id: `debate-${pairIndex + 1}`,
    strictJudge: strictJudge.name,
    lenientJudge: lenientJudge.name,
    strictCase,
    lenientCase,
    rounds,
    votes,
    disagreement: votes[0].outcome !== votes[1].outcome,
  };
}

export async function runSimulation(request: SimulationRequest): Promise<SimulationResult> {
  const index = await getCaseIndex();
  const jurisdictions = inferJurisdictions(request.narrative);
  const signals = inferSignals(request.narrative);
  const pairs = pickJudgePairs(index.judges, jurisdictions, 5);

  const debates = await Promise.all(
    pairs.map(([strictJudge, lenientJudge], pairIndex) => {
    const strictCase = judgeRelevantCase(strictJudge, jurisdictions, false);
    const lenientCase = judgeRelevantCase(lenientJudge, jurisdictions, true);

    return runDebate({
      strictJudge,
      lenientJudge,
      strictCase,
      lenientCase,
      request,
      jurisdictions,
      signals,
      pairIndex,
    });
  }),
  );

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
    caveat:
      "Debate transcripts and votes are generated by real Opus calls. Awards, timelines, and anchor reasoning blurbs use synthetic hackathon enrichment, not extracted tribunal compensation data.",
  };
}
