"use client";

import { FormEvent, useMemo, useState } from "react";

type Vote = {
  judge: string;
  outcome: "win" | "lose";
  award_gbp: number;
  confidence: number;
  key_reason: string;
};

type Debate = {
  id: string;
  strictJudge: string;
  lenientJudge: string;
  strictCase: {
    case_number: string;
    claimant: string;
    respondent: string;
    outcome: string;
    jurisdiction: string[];
    enrichment: { award_gbp: number; months_to_resolution: number; reasoning_blurb: string };
  };
  lenientCase: {
    case_number: string;
    claimant: string;
    respondent: string;
    outcome: string;
    jurisdiction: string[];
    enrichment: { award_gbp: number; months_to_resolution: number; reasoning_blurb: string };
  };
  rounds: Array<{ speaker: string; disposition: "strict" | "lenient"; text: string }>;
  votes: Vote[];
  disagreement: boolean;
};

type SimulationResult = {
  caseProfile: { narrative: string; jurisdictions: string[]; signals: string[] };
  debates: Debate[];
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

const starterNarrative =
  "I was dismissed after raising repeated concerns about unpaid overtime and unsafe shift patterns. I have emails to HR, witness messages from colleagues, and I appealed the dismissal but the company said it was performance related.";

function money(value: number): string {
  return `£${value.toLocaleString("en-GB")}`;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function label(value: string): string {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function Home() {
  const [narrative, setNarrative] = useState(starterNarrative);
  const [claimedValueGbp, setClaimedValueGbp] = useState(12_000);
  const [financialRunwayMonths, setFinancialRunwayMonths] = useState(6);
  const [emotionalResilience, setEmotionalResilience] = useState(55);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [selectedDebateId, setSelectedDebateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectedDebate = useMemo(
    () => result?.debates.find((debate) => debate.id === selectedDebateId) ?? result?.debates[0] ?? null,
    [result, selectedDebateId],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const response = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ narrative, claimedValueGbp, financialRunwayMonths, emotionalResilience }),
    });

    const payload = (await response.json()) as SimulationResult | { error?: string };

    if (!response.ok) {
      setError("error" in payload && payload.error ? payload.error : "Could not run the simulation.");
      setIsLoading(false);
      return;
    }

    setResult(payload as SimulationResult);
    setSelectedDebateId((payload as SimulationResult).debates[0]?.id ?? null);
    setIsLoading(false);
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Employment Tribunal simulator</p>
          <h1>The reality check before you spend two years fighting.</h1>
          <p className="hero-copy">
            Describe the dispute. The app selects real judge profiles from judges.json, simulates strict vs lenient
            tribunal reasoning, and separates legal merit from the cost of surviving the case.
          </p>
        </div>
        <div className="hero-card">
          <span>Dataset</span>
          <strong>2,438 ET decisions</strong>
          <small>457 real judges, fast-pass metadata, synthetic hackathon enrichment.</small>
        </div>
      </section>

      <section className="workspace">
        <form className="intake-card" onSubmit={onSubmit}>
          <label htmlFor="narrative">Tell the intake chat what happened</label>
          <textarea id="narrative" value={narrative} onChange={(event) => setNarrative(event.target.value)} />

          <div className="slider-row">
            <label>
              Expected claim value
              <input
                type="number"
                min={0}
                max={500000}
                step={500}
                value={claimedValueGbp}
                onChange={(event) => setClaimedValueGbp(Number(event.target.value))}
              />
            </label>
            <label>
              Financial runway: {financialRunwayMonths} months
              <input
                type="range"
                min={0}
                max={36}
                value={financialRunwayMonths}
                onChange={(event) => setFinancialRunwayMonths(Number(event.target.value))}
              />
            </label>
            <label>
              Emotional resilience: {emotionalResilience}/100
              <input
                type="range"
                min={0}
                max={100}
                value={emotionalResilience}
                onChange={(event) => setEmotionalResilience(Number(event.target.value))}
              />
            </label>
          </div>

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Running five debates..." : "Run reality check"}
          </button>
          {error ? <p className="error">{error}</p> : null}
        </form>

        {result ? (
          <section className="results">
            <div className="verdict-card">
              <p className="eyebrow">Worth-It Verdict</p>
              <h2>{result.worthItVerdict}</h2>
              <p>{result.caveat}</p>
            </div>

            <div className="metric-grid">
              <article>
                <span>Case Merit</span>
                <strong>{percent(result.merit.winProbability)}</strong>
                <small>Expected winning award: {money(result.merit.expectedAwardGbp)}</small>
              </article>
              <article>
                <span>Award Spread</span>
                <strong>{money(result.merit.awardSpread.median)}</strong>
                <small>
                  {money(result.merit.awardSpread.min)} to {money(result.merit.awardSpread.max)}
                </small>
              </article>
              <article>
                <span>Reality Cost</span>
                <strong>{money(result.realityCost.unrecoverableCostGbp)}</strong>
                <small>Over ~{result.realityCost.expectedMonths} months</small>
              </article>
              <article>
                <span>Abandonment Risk</span>
                <strong>{percent(result.realityCost.abandonmentRisk)}</strong>
                <small>Driven by time, runway, and resilience</small>
              </article>
            </div>

            <div className="case-tags">
              {result.caseProfile.jurisdictions.map((jurisdiction) => (
                <span key={jurisdiction}>{label(jurisdiction)}</span>
              ))}
              {result.caseProfile.signals.map((signal) => (
                <span key={signal}>{signal}</span>
              ))}
            </div>

            <div className="debate-layout">
              <div className="debate-graph" aria-label="Debate graph">
                <div className="center-node">Your case</div>
                {result.debates.map((debate, index) => {
                  const winVotes = debate.votes.filter((vote) => vote.outcome === "win").length;
                  return (
                    <button
                      key={debate.id}
                      type="button"
                      className={`graph-node node-${index} ${selectedDebate?.id === debate.id ? "active" : ""} ${
                        winVotes > 1 ? "win" : winVotes === 0 ? "lose" : "split"
                      }`}
                      onClick={() => setSelectedDebateId(debate.id)}
                    >
                      D{index + 1}
                      {debate.disagreement ? <small>split</small> : null}
                    </button>
                  );
                })}
              </div>

              {selectedDebate ? (
                <article className="transcript-card">
                  <div className="transcript-heading">
                    <div>
                      <p className="eyebrow">Selected debate</p>
                      <h3>
                        {selectedDebate.strictJudge} vs {selectedDebate.lenientJudge}
                      </h3>
                    </div>
                    <span>{selectedDebate.disagreement ? "Disagreement" : "Aligned vote"}</span>
                  </div>

                  <div className="anchor-cases">
                    <p>
                      <strong>{selectedDebate.strictCase.case_number}</strong>:{" "}
                      {selectedDebate.strictCase.enrichment.reasoning_blurb}
                    </p>
                    <p>
                      <strong>{selectedDebate.lenientCase.case_number}</strong>:{" "}
                      {selectedDebate.lenientCase.enrichment.reasoning_blurb}
                    </p>
                  </div>

                  <div className="rounds">
                    {selectedDebate.rounds.map((round, index) => (
                      <p key={`${round.speaker}-${index}`} className={round.disposition}>
                        <strong>{round.speaker}</strong>
                        {round.text}
                      </p>
                    ))}
                  </div>

                  <div className="votes">
                    {selectedDebate.votes.map((vote) => (
                      <div key={vote.judge}>
                        <span className={vote.outcome}>{vote.outcome}</span>
                        <strong>
                          {vote.judge}: {money(vote.award_gbp)}
                        </strong>
                        <small>
                          {Math.round(vote.confidence * 100)}% confidence. {vote.key_reason}
                        </small>
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="empty-state">
            <h2>First vertical slice</h2>
            <p>
              This demo already exercises the data path: reliable named judges, final-merits cases only, synthetic
              award/time/reasoning enrichment, five strict-vs-lenient debates, and a Worth-It Verdict.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
