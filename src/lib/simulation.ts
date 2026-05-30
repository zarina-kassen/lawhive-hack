import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

import { getCaseIndex, type EnrichedCaseRecord, type JudgeProfile } from "./judges";

const MODEL_ID = "vertex_ai/claude-opus-4-7";
const DEFAULT_GATEWAY_URL = "https://ai.hack.lawhive.co.uk";
const DEBATE_COUNT = 5;

const evidenceFileSchema = z.object({
  name: z.string(),
  size: z.number().nonnegative(),
});

export const simulationRequestSchema = z
  .object({
    description: z.string().optional(),
    caseContext: z.string().optional(),
    evidenceFiles: z.array(evidenceFileSchema).optional().default([]),
  })
  .transform((request) => ({
    caseContext: (request.description ?? request.caseContext ?? "").trim(),
    evidenceFiles: request.evidenceFiles,
  }))
  .pipe(
    z.object({
      caseContext: z.string().min(20),
      evidenceFiles: z.array(evidenceFileSchema),
    }),
  );

export type SimulationRequest = z.infer<typeof simulationRequestSchema>;

const voteSchema = z.object({
  outcome: z.enum(["win", "lose"]),
  awardGbp: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
  keyReason: z.string().min(8),
});

const debateSchema = z.object({
  transcript: z.array(
    z.object({
      speaker: z.enum(["strict", "lenient"]),
      message: z.string().min(20),
    }),
  ),
  strictVote: voteSchema,
  lenientVote: voteSchema,
});

type Vote = z.infer<typeof voteSchema>;
type Transcript = z.infer<typeof debateSchema>["transcript"];

type JudgeSummary = {
  name: string;
  claimantSuccessRateFinal: number;
  nFinalMerits: number;
};

type AnchorCase = {
  caseNumber: string;
  claimant: string | null;
  respondent: string | null;
  outcome: string;
  jurisdiction: string[];
  reasoningBlurb: string;
};

type DebatePair = {
  strictJudge: JudgeProfile;
  lenientJudge: JudgeProfile;
  strictCase: EnrichedCaseRecord;
  lenientCase: EnrichedCaseRecord;
};

type SimulationDebate = {
  id: string;
  strictJudge: JudgeSummary;
  lenientJudge: JudgeSummary;
  anchorCases: AnchorCase[];
  transcript: Transcript;
  votes: Array<Vote & { judge: string; disposition: "strict" | "lenient" }>;
  disagreed: boolean;
};

export type SimulationResult = {
  caseMerit: {
    winProbability: number;
    expectedAwardGbp: number;
    awardSpreadGbp: {
      min: number;
      median: number;
      max: number;
    };
  };
  practicalImpact: {
    typicalMonthsToResolution: number;
    likelyUnrecoverableCostGbp: number;
    abandonmentRisk: "low" | "medium" | "high";
  };
  recommendation: string;
  debates: SimulationDebate[];
};

type JurisdictionMatch = readonly [jurisdiction: string, keywords: readonly string[]];

function getGatewayKey(): string {
  const key =
    process.env.ANTHROPIC_AUTH_TOKEN ??
    process.env.ANTHROPIC_API_KEY ??
    process.env.AI_GATEWAY_API_KEY ??
    process.env.LAWHIVE_AI_GATEWAY_API_KEY ??
    process.env.LAWHIVE_AI_GATEWAY_KEY;

  if (!key) {
    throw new Error("Missing AI gateway key. Set ANTHROPIC_AUTH_TOKEN in .env.");
  }

  return key;
}

function getGatewayBaseUrl(): string {
  const baseUrl = process.env.ANTHROPIC_BASE_URL ?? process.env.AI_GATEWAY_BASE_URL ?? DEFAULT_GATEWAY_URL;
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  // The AI SDK Anthropic provider appends `/messages`; the hackathon gateway serves Anthropic at `/v1/messages`.
  return normalizedBaseUrl.endsWith("/v1") ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`;
}

function getModel() {
  const token = getGatewayKey();
  const anthropic = createAnthropic({
    apiKey: token,
    baseURL: getGatewayBaseUrl(),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return anthropic(MODEL_ID);
}

function inferJurisdictions(caseContext: string, availableJurisdictions: string[]): string[] {
  const text = caseContext.toLowerCase();
  const matchers: JurisdictionMatch[] = [
    ["disability-discrimination", ["disability", "reasonable adjustment", "disabled"]],
    ["race-discrimination", ["race", "racial", "ethnicity"]],
    ["sex-discrimination", ["sex discrimination", "pregnant", "maternity", "woman", "women"]],
    ["unfair-dismissal", ["dismiss", "fired", "sacked", "redundant", "redundancy"]],
    ["unlawful-deduction-from-wages", ["wage", "salary", "pay", "deduction", "unpaid"]],
    ["breach-of-contract", ["contract", "notice", "bonus", "commission"]],
    ["public-interest-disclosure", ["whistle", "disclosure", "reported"]],
  ];
  const matches = matchers
    .filter(
      ([jurisdiction, keywords]) =>
        availableJurisdictions.includes(jurisdiction) && keywords.some((keyword) => text.includes(keyword)),
    )
    .map(([jurisdiction]) => jurisdiction);

  if (matches.length > 0) return matches;

  return ["unfair-dismissal"].filter((jurisdiction) => availableJurisdictions.includes(jurisdiction));
}

function judgeMatchesJurisdiction(judge: JudgeProfile, jurisdictions: string[]): boolean {
  return judge.topJurisdictions.some((jurisdiction) => jurisdictions.includes(jurisdiction));
}

function pickAnchorCase(judge: JudgeProfile, jurisdictions: string[]): EnrichedCaseRecord {
  return (
    judge.cases.find((caseRecord) => caseRecord.jurisdiction.some((jurisdiction) => jurisdictions.includes(jurisdiction))) ??
    judge.cases[0]
  );
}

async function selectDebatePairs(caseContext: string): Promise<DebatePair[]> {
  const index = await getCaseIndex();
  const jurisdictions = inferJurisdictions(
    caseContext,
    index.jurisdictions.map((jurisdiction) => jurisdiction.id),
  );
  const jurisdictionJudges = index.judges.filter((judge) => judgeMatchesJurisdiction(judge, jurisdictions));
  const candidates = jurisdictionJudges.length >= DEBATE_COUNT * 2 ? jurisdictionJudges : index.judges;
  const strictJudges = candidates.slice(0, DEBATE_COUNT);
  const lenientJudges = candidates.slice(-DEBATE_COUNT).reverse();

  return strictJudges.map((strictJudge, index) => {
    const lenientJudge = lenientJudges[index] ?? lenientJudges[0];

    return {
      strictJudge,
      lenientJudge,
      strictCase: pickAnchorCase(strictJudge, jurisdictions),
      lenientCase: pickAnchorCase(lenientJudge, jurisdictions),
    };
  });
}

function summarizeJudge(judge: JudgeProfile): JudgeSummary {
  return {
    name: judge.name,
    claimantSuccessRateFinal: judge.claimantSuccessRateFinal,
    nFinalMerits: judge.nFinalMerits,
  };
}

function summarizeCase(caseRecord: EnrichedCaseRecord): AnchorCase {
  return {
    caseNumber: caseRecord.case_number,
    claimant: caseRecord.claimant,
    respondent: caseRecord.respondent,
    outcome: caseRecord.outcome,
    jurisdiction: caseRecord.jurisdiction,
    reasoningBlurb: caseRecord.enrichment.reasoning_blurb,
  };
}

function formatCaseForPrompt(label: string, caseRecord: EnrichedCaseRecord): string {
  return `${label}: ${caseRecord.case_number}, ${caseRecord.claimant ?? "claimant"} v ${
    caseRecord.respondent ?? "respondent"
  }, outcome ${caseRecord.outcome}, jurisdictions ${caseRecord.jurisdiction.join(", ")}. Synthetic reasoning note: ${
    caseRecord.enrichment.reasoning_blurb
  }`;
}

async function runDebate(pair: DebatePair, caseContext: string, debateIndex: number): Promise<SimulationDebate> {
  const prompt = [
    "You are simulating a UK Employment Tribunal debate for a hackathon product.",
    "Use the two named real judge profiles and their anchor cases. Do not invent statutes or claim certainty.",
    "Produce a concise adversarial exchange and two separate final votes.",
    "",
    `Employee situation: ${caseContext}`,
    "",
    `Strict judge: ${pair.strictJudge.name}. Claimant success rate: ${pair.strictJudge.claimantSuccessRateFinal}.`,
    formatCaseForPrompt("Strict judge anchor case", pair.strictCase),
    "",
    `Lenient judge: ${pair.lenientJudge.name}. Claimant success rate: ${pair.lenientJudge.claimantSuccessRateFinal}.`,
    formatCaseForPrompt("Lenient judge anchor case", pair.lenientCase),
  ].join("\n");

  const { object } = await generateObject({
    model: getModel(),
    schema: debateSchema,
    prompt,
  });

  return {
    id: `debate-${debateIndex + 1}`,
    strictJudge: summarizeJudge(pair.strictJudge),
    lenientJudge: summarizeJudge(pair.lenientJudge),
    anchorCases: [summarizeCase(pair.strictCase), summarizeCase(pair.lenientCase)],
    transcript: object.transcript,
    votes: [
      { ...object.strictVote, judge: pair.strictJudge.name, disposition: "strict" },
      { ...object.lenientVote, judge: pair.lenientJudge.name, disposition: "lenient" },
    ],
    disagreed: object.strictVote.outcome !== object.lenientVote.outcome,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? Math.round((sorted[midpoint - 1] + sorted[midpoint]) / 2) : sorted[midpoint];
}

function calculateAbandonmentRisk(months: number, winProbability: number): "low" | "medium" | "high" {
  if (months >= 16 && winProbability < 0.55) return "high";
  if (months >= 12 || winProbability < 0.45) return "medium";
  return "low";
}

function anchorMonthsFor(debate: SimulationDebate, pairs: DebatePair[]): number[] {
  return debate.anchorCases.map((anchorCase) => {
    const pair = pairs.find(
      (candidate) =>
        candidate.strictCase.case_number === anchorCase.caseNumber || candidate.lenientCase.case_number === anchorCase.caseNumber,
    );

    if (pair?.strictCase.case_number === anchorCase.caseNumber) return pair.strictCase.enrichment.months_to_resolution;
    if (pair?.lenientCase.case_number === anchorCase.caseNumber) return pair.lenientCase.enrichment.months_to_resolution;
    return 12;
  });
}

export async function runSimulation(request: SimulationRequest): Promise<SimulationResult> {
  const pairs = await selectDebatePairs(request.caseContext);
  const debates = await Promise.all(pairs.map((pair, index) => runDebate(pair, request.caseContext, index)));
  const votes = debates.flatMap((debate) => debate.votes);
  const winningVotes = votes.filter((vote) => vote.outcome === "win");
  const awards = winningVotes.map((vote) => vote.awardGbp).filter((award) => award > 0);
  const anchorMonths = debates.flatMap((debate) => anchorMonthsFor(debate, pairs));
  const winProbability = votes.length === 0 ? 0 : winningVotes.length / votes.length;
  const expectedAwardGbp = median(awards);
  const typicalMonthsToResolution = median(anchorMonths);
  const likelyUnrecoverableCostGbp = Math.round(typicalMonthsToResolution * 350);
  const abandonmentRisk = calculateAbandonmentRisk(typicalMonthsToResolution, winProbability);
  const netPosition = expectedAwardGbp - likelyUnrecoverableCostGbp;

  return {
    caseMerit: {
      winProbability,
      expectedAwardGbp,
      awardSpreadGbp: {
        min: awards.length > 0 ? Math.min(...awards) : 0,
        median: expectedAwardGbp,
        max: awards.length > 0 ? Math.max(...awards) : 0,
      },
    },
    practicalImpact: {
      typicalMonthsToResolution,
      likelyUnrecoverableCostGbp,
      abandonmentRisk,
    },
    recommendation:
      netPosition > 0 && winProbability >= 0.55
        ? "Your legal case appears worth exploring, but treat settlement leverage and evidence quality as the next decision point."
        : "Be careful about escalating before testing settlement leverage: the expected time, unrecoverable cost, and attrition risk may outweigh the legal upside.",
    debates,
  };
}
