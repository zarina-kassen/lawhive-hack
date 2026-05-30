export type Vote = {
  outcome: "win" | "lose";
  awardGbp: number;
  confidence: number;
  keyReason: string;
  judge: string;
  disposition: "strict" | "lenient";
};

export type SimulationDebate = {
  id: string;
  strictJudge: { name: string; claimantSuccessRateFinal: number; nFinalMerits: number };
  lenientJudge: { name: string; claimantSuccessRateFinal: number; nFinalMerits: number };
  anchorCases: {
    caseNumber: string;
    claimant: string | null;
    respondent: string | null;
    outcome: string;
    jurisdiction: string[];
    reasoningBlurb: string;
  }[];
  transcript: { speaker: "strict" | "lenient"; message: string }[];
  votes: Vote[];
  disagreed: boolean;
};

export type SimulationResult = {
  caseMerit: {
    winProbability: number;
    expectedAwardGbp: number;
    awardSpreadGbp: { min: number; median: number; max: number };
  };
  practicalImpact: {
    typicalMonthsToResolution: number;
    likelyUnrecoverableCostGbp: number;
    abandonmentRisk: "low" | "medium" | "high";
  };
  recommendation: string;
  debates: SimulationDebate[];
};

export const MOCK_RESULT: SimulationResult = {
  caseMerit: {
    winProbability: 0.58,
    expectedAwardGbp: 9200,
    awardSpreadGbp: { min: 3100, median: 9200, max: 21400 },
  },
  practicalImpact: {
    typicalMonthsToResolution: 18,
    likelyUnrecoverableCostGbp: 6300,
    abandonmentRisk: "high",
  },
  recommendation:
    "Likely win (58%) — but the expected award barely clears your unrecoverable costs, and over ~18 months the attrition risk is high. Test settlement leverage before escalating.",
  debates: [
    {
      id: "debate-1",
      strictJudge: { name: "EJ Marsden", claimantSuccessRateFinal: 0.31, nFinalMerits: 42 },
      lenientJudge: { name: "EJ Okafor", claimantSuccessRateFinal: 0.71, nFinalMerits: 38 },
      anchorCases: [
        {
          caseNumber: "2401123/2022",
          claimant: "Claimant A",
          respondent: "Acme Logistics Ltd",
          outcome: "dismissed",
          jurisdiction: ["unfair-dismissal", "unlawful-deduction-from-wages"],
          reasoningBlurb: "Process flaws were minor and would not have changed the outcome.",
        },
        {
          caseNumber: "1804456/2021",
          claimant: "Claimant B",
          respondent: "Northgate Care",
          outcome: "upheld",
          jurisdiction: ["unfair-dismissal"],
          reasoningBlurb: "No genuine consultation; selection pool was manipulated.",
        },
      ],
      transcript: [
        { speaker: "strict", message: "The employer ran a redundancy exercise with a documented business case. Absent evidence of a sham, the dismissal is likely fair." },
        { speaker: "lenient", message: "There was no individual consultation and the selection criteria appeared after the decision. That is a textbook procedural failure." },
        { speaker: "strict", message: "Even so, Polkey reductions would heavily discount any award if the outcome was inevitable." },
        { speaker: "lenient", message: "Inevitability is not made out on these facts. A reasonable tribunal would find unfairness with a modest Polkey deduction." },
      ],
      votes: [
        { outcome: "lose", awardGbp: 0, confidence: 0.62, keyReason: "Genuine redundancy with adequate business justification.", judge: "EJ Marsden", disposition: "strict" },
        { outcome: "win", awardGbp: 11200, confidence: 0.68, keyReason: "Absence of consultation renders the dismissal unfair.", judge: "EJ Okafor", disposition: "lenient" },
      ],
      disagreed: true,
    },
    {
      id: "debate-2",
      strictJudge: { name: "EJ Whitlock", claimantSuccessRateFinal: 0.36, nFinalMerits: 51 },
      lenientJudge: { name: "EJ Bashir", claimantSuccessRateFinal: 0.66, nFinalMerits: 33 },
      anchorCases: [
        {
          caseNumber: "3201987/2020",
          claimant: "Claimant C",
          respondent: "Pendle Retail",
          outcome: "upheld",
          jurisdiction: ["unlawful-deduction-from-wages"],
          reasoningBlurb: "Final salary and notice pay were never paid; deduction unlawful.",
        },
        {
          caseNumber: "2502310/2023",
          claimant: "Claimant D",
          respondent: "Acme Logistics Ltd",
          outcome: "upheld",
          jurisdiction: ["unfair-dismissal"],
          reasoningBlurb: "Redundancy used as cover for performance concerns.",
        },
      ],
      transcript: [
        { speaker: "strict", message: "The unpaid-wages element is strong, but the unfair dismissal claim is weaker on these facts." },
        { speaker: "lenient", message: "Agreed on wages. On dismissal, the timing relative to the grievance is suggestive of an ulterior motive." },
        { speaker: "strict", message: "Suggestive, not determinative. I would uphold wages, dismiss the unfair dismissal claim." },
        { speaker: "lenient", message: "I would uphold both, with a reduced compensatory award reflecting contributory conduct." },
      ],
      votes: [
        { outcome: "win", awardGbp: 4200, confidence: 0.74, keyReason: "Unlawful deduction is clearly established.", judge: "EJ Whitlock", disposition: "strict" },
        { outcome: "win", awardGbp: 13800, confidence: 0.61, keyReason: "Both claims succeed with a contributory reduction.", judge: "EJ Bashir", disposition: "lenient" },
      ],
      disagreed: false,
    },
    {
      id: "debate-3",
      strictJudge: { name: "EJ Caldwell", claimantSuccessRateFinal: 0.28, nFinalMerits: 47 },
      lenientJudge: { name: "EJ Nair", claimantSuccessRateFinal: 0.69, nFinalMerits: 40 },
      anchorCases: [
        {
          caseNumber: "1601442/2019",
          claimant: "Claimant E",
          respondent: "Harbour Foods",
          outcome: "dismissed",
          jurisdiction: ["unfair-dismissal"],
          reasoningBlurb: "Fair process; redundancy genuine and consultation adequate.",
        },
        {
          caseNumber: "2902765/2022",
          claimant: "Claimant F",
          respondent: "Northgate Care",
          outcome: "upheld",
          jurisdiction: ["unfair-dismissal", "unlawful-deduction-from-wages"],
          reasoningBlurb: "Sham consultation; predetermined outcome.",
        },
      ],
      transcript: [
        { speaker: "strict", message: "If the consultation was meaningful, the claim fails regardless of sympathy for the claimant." },
        { speaker: "lenient", message: "The records show a single 15-minute meeting after the decision was minuted. That is not meaningful." },
        { speaker: "strict", message: "Then the dispute turns entirely on the contemporaneous documents." },
        { speaker: "lenient", message: "Which favour the claimant here. I find unfairness." },
      ],
      votes: [
        { outcome: "lose", awardGbp: 0, confidence: 0.55, keyReason: "Consultation arguably adequate on the evidence.", judge: "EJ Caldwell", disposition: "strict" },
        { outcome: "win", awardGbp: 8600, confidence: 0.64, keyReason: "Predetermined outcome; consultation was a formality.", judge: "EJ Nair", disposition: "lenient" },
      ],
      disagreed: true,
    },
    {
      id: "debate-4",
      strictJudge: { name: "EJ Forsythe", claimantSuccessRateFinal: 0.34, nFinalMerits: 39 },
      lenientJudge: { name: "EJ Adeyemi", claimantSuccessRateFinal: 0.73, nFinalMerits: 36 },
      anchorCases: [
        {
          caseNumber: "2103998/2021",
          claimant: "Claimant G",
          respondent: "Pendle Retail",
          outcome: "upheld",
          jurisdiction: ["unlawful-deduction-from-wages"],
          reasoningBlurb: "Outstanding notice pay unlawfully withheld.",
        },
        {
          caseNumber: "1705221/2020",
          claimant: "Claimant H",
          respondent: "Harbour Foods",
          outcome: "upheld",
          jurisdiction: ["unfair-dismissal"],
          reasoningBlurb: "Selection criteria applied inconsistently across the pool.",
        },
      ],
      transcript: [
        { speaker: "strict", message: "The strongest part of this case is plainly the money owed, not the dismissal." },
        { speaker: "lenient", message: "But the inconsistent scoring across comparable employees supports the unfair dismissal claim too." },
        { speaker: "strict", message: "I would award the wages and decline the rest." },
        { speaker: "lenient", message: "I would award both — the scoring inconsistency is material." },
      ],
      votes: [
        { outcome: "win", awardGbp: 3900, confidence: 0.7, keyReason: "Notice pay was unlawfully withheld.", judge: "EJ Forsythe", disposition: "strict" },
        { outcome: "win", awardGbp: 15600, confidence: 0.6, keyReason: "Inconsistent selection scoring establishes unfairness.", judge: "EJ Adeyemi", disposition: "lenient" },
      ],
      disagreed: false,
    },
    {
      id: "debate-5",
      strictJudge: { name: "EJ Pritchard", claimantSuccessRateFinal: 0.3, nFinalMerits: 44 },
      lenientJudge: { name: "EJ Sandhu", claimantSuccessRateFinal: 0.68, nFinalMerits: 41 },
      anchorCases: [
        {
          caseNumber: "2404117/2022",
          claimant: "Claimant I",
          respondent: "Acme Logistics Ltd",
          outcome: "dismissed",
          jurisdiction: ["unfair-dismissal"],
          reasoningBlurb: "Genuine economic redundancy; fair selection.",
        },
        {
          caseNumber: "1903660/2021",
          claimant: "Claimant J",
          respondent: "Northgate Care",
          outcome: "upheld",
          jurisdiction: ["unfair-dismissal"],
          reasoningBlurb: "No alternatives to redundancy were considered.",
        },
      ],
      transcript: [
        { speaker: "strict", message: "Where the business need is genuine and selection is fair, the tribunal should not substitute its own view." },
        { speaker: "lenient", message: "The duty to consider suitable alternative employment was effectively ignored. That is a recognised failing." },
        { speaker: "strict", message: "If no alternatives existed, the failing is academic." },
        { speaker: "lenient", message: "Two vacancies were advertised externally during the consultation window. They existed." },
      ],
      votes: [
        { outcome: "lose", awardGbp: 0, confidence: 0.58, keyReason: "Genuine redundancy with fair selection.", judge: "EJ Pritchard", disposition: "strict" },
        { outcome: "win", awardGbp: 7400, confidence: 0.66, keyReason: "Failure to consider alternative roles renders dismissal unfair.", judge: "EJ Sandhu", disposition: "lenient" },
      ],
      disagreed: true,
    },
  ],
};
