import { z } from "zod";

import demoSimulation from "./demo-simulation.json";

const DEFAULT_DEMO_SIMULATION_DELAY_MS = 9_000;

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
  }));

export type SimulationRequest = z.infer<typeof simulationRequestSchema>;

type Vote = {
  outcome: "win" | "lose";
  awardGbp: number;
  confidence: number;
  keyReason: string;
};

type Transcript = Array<{
  speaker: "strict" | "lenient";
  message: string;
}>;

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

function getDemoSimulationDelayMs(): number {
  const configuredDelay = Number(process.env.DEMO_SIMULATION_DELAY_MS);

  if (Number.isFinite(configuredDelay) && configuredDelay >= 0) {
    return configuredDelay;
  }

  return DEFAULT_DEMO_SIMULATION_DELAY_MS;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runSimulation(request: SimulationRequest): Promise<SimulationResult> {
  void request;

  await delay(getDemoSimulationDelayMs());

  return structuredClone(demoSimulation) as SimulationResult;
}
