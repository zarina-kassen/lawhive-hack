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

type CohortSegment = {
  label: string;
  count: number;
  tone: "settle" | "abandon" | "lose" | "negative" | "positive";
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

function buildCohort(result: SimulationResult): CohortSegment[] {
  const settle = Math.min(22, Math.max(6, Math.round((1 - result.realityCost.abandonmentRisk) * 16)));
  const abandon = Math.min(88, Math.max(5, Math.round(result.realityCost.abandonmentRisk * 100)));
  const contested = Math.max(0, 100 - settle - abandon);
  const lose = Math.round(contested * (1 - result.merit.winProbability));
  const winners = contested - lose;
  const positiveShare = result.realityCost.netPositionGbp > 0 ? 0.72 : 0.28;
  const winPositive = Math.round(winners * positiveShare);
  const winNegative = winners - winPositive;

  return [
    { label: "Settle early", count: settle, tone: "settle" },
    { label: "Abandon", count: abandon, tone: "abandon" },
    { label: "Lose", count: lose, tone: "lose" },
    { label: "Win, net negative", count: winNegative, tone: "negative" },
    { label: "Win, net positive", count: winPositive, tone: "positive" },
  ];
}

function voteTone(debate: Debate): "win" | "lose" | "split" {
  const winVotes = debate.votes.filter((vote) => vote.outcome === "win").length;
  if (winVotes > 1) return "win";
  if (winVotes === 0) return "lose";
  return "split";
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

  const cohort = useMemo(() => (result ? buildCohort(result) : []), [result]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
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
    } catch {
      setError("The simulation service did not respond.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="case-console">
      <header className="topbar">
        <div>
          <p className="kicker">Employment Tribunal Reality Desk</p>
          <h1>Case merit and reality cost</h1>
        </div>
        <dl className="system-strip" aria-label="System status">
          <div>
            <dt>Dataset</dt>
            <dd>2,438 ET decisions</dd>
          </div>
          <div>
            <dt>Judges</dt>
            <dd>457 named profiles</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>{isLoading ? "Running" : result ? "Complete" : "Ready"}</dd>
          </div>
        </dl>
      </header>

      <section className="console-grid">
        <form className="intake-panel" onSubmit={onSubmit}>
          <div className="panel-heading">
            <p className="kicker">Intake</p>
            <h2>Employee chronology</h2>
          </div>

          <label className="field-block" htmlFor="narrative">
            <span>Case narrative</span>
            <textarea id="narrative" value={narrative} onChange={(event) => setNarrative(event.target.value)} />
          </label>

          <div className="control-stack">
            <label className="field-block">
              <span>Expected claim value</span>
              <input
                type="number"
                min={0}
                max={500000}
                step={500}
                value={claimedValueGbp}
                onChange={(event) => setClaimedValueGbp(Number(event.target.value))}
              />
            </label>

            <label className="range-block">
              <span>
                Financial runway <strong>{financialRunwayMonths}m</strong>
              </span>
              <input
                type="range"
                min={0}
                max={36}
                value={financialRunwayMonths}
                onChange={(event) => setFinancialRunwayMonths(Number(event.target.value))}
              />
            </label>

            <label className="range-block">
              <span>
                Emotional resilience <strong>{emotionalResilience}/100</strong>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={emotionalResilience}
                onChange={(event) => setEmotionalResilience(Number(event.target.value))}
              />
            </label>
          </div>

          <button className="run-button" type="submit" disabled={isLoading}>
            <span>{isLoading ? "Running debates" : "Run reality check"}</span>
            <span aria-hidden="true">↵</span>
          </button>
          {error ? <p className="error">{error}</p> : null}
        </form>

        <section className="main-panel" aria-live="polite">
          {result ? (
            <>
              <div className="verdict-band">
                <div>
                  <p className="kicker">Worth-It Verdict</p>
                  <h2>{result.worthItVerdict}</h2>
                  <p>{result.caveat}</p>
                </div>
                <div className="net-position">
                  <span>Net position</span>
                  <strong>{money(result.realityCost.netPositionGbp)}</strong>
                </div>
              </div>

              <div className="metric-grid">
                <article>
                  <span>Win probability</span>
                  <strong>{percent(result.merit.winProbability)}</strong>
                  <small>{money(result.merit.expectedAwardGbp)} expected winning award</small>
                </article>
                <article>
                  <span>Award median</span>
                  <strong>{money(result.merit.awardSpread.median)}</strong>
                  <small>
                    {money(result.merit.awardSpread.min)} to {money(result.merit.awardSpread.max)}
                  </small>
                </article>
                <article>
                  <span>Reality cost</span>
                  <strong>{money(result.realityCost.unrecoverableCostGbp)}</strong>
                  <small>Over ~{result.realityCost.expectedMonths} months</small>
                </article>
                <article>
                  <span>Abandonment risk</span>
                  <strong>{percent(result.realityCost.abandonmentRisk)}</strong>
                  <small>Runway and resilience adjusted</small>
                </article>
              </div>

              <div className="case-classification">
                {result.caseProfile.jurisdictions.map((jurisdiction) => (
                  <span key={jurisdiction}>{label(jurisdiction)}</span>
                ))}
                {result.caseProfile.signals.map((signal) => (
                  <span key={signal}>{signal}</span>
                ))}
              </div>

              <div className="analysis-grid">
                <section className="debate-panel">
                  <div className="panel-heading">
                    <p className="kicker">Debate Graph</p>
                    <h3>Judge vote network</h3>
                  </div>
                  <div className="debate-graph" aria-label="Debate graph">
                    <div className="graph-axis axis-a" />
                    <div className="graph-axis axis-b" />
                    <div className="center-node">
                      <span>Your case</span>
                    </div>
                    {result.debates.map((debate, index) => {
                      const tone = voteTone(debate);
                      return (
                        <button
                          key={debate.id}
                          type="button"
                          className={`graph-node node-${index} ${selectedDebate?.id === debate.id ? "active" : ""} ${tone}`}
                          onClick={() => setSelectedDebateId(debate.id)}
                          aria-label={`Open debate ${index + 1}`}
                        >
                          <span>D{index + 1}</span>
                          <small>{debate.disagreement ? "split" : tone}</small>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="cohort-panel">
                  <div className="panel-heading">
                    <p className="kicker">100-Person Cohort</p>
                    <h3>Reality flow</h3>
                  </div>
                  <div className="cohort-flow">
                    {cohort.map((segment) => (
                      <div key={segment.label} className={`cohort-row ${segment.tone}`}>
                        <div>
                          <strong>{segment.count}</strong>
                          <span>{segment.label}</span>
                        </div>
                        <i style={{ inlineSize: `${segment.count}%` }} />
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {selectedDebate ? (
                <article className="transcript-panel">
                  <div className="transcript-heading">
                    <div>
                      <p className="kicker">Selected Debate</p>
                      <h3>
                        {selectedDebate.strictJudge} vs {selectedDebate.lenientJudge}
                      </h3>
                    </div>
                    <span>{selectedDebate.disagreement ? "Disagreement" : "Aligned vote"}</span>
                  </div>

                  <div className="anchor-cases">
                    <p>
                      <strong>{selectedDebate.strictCase.case_number}</strong>
                      {selectedDebate.strictCase.enrichment.reasoning_blurb}
                    </p>
                    <p>
                      <strong>{selectedDebate.lenientCase.case_number}</strong>
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
            </>
          ) : (
            <section className="empty-panel">
              <div>
                <p className="kicker">Awaiting Simulation</p>
                <h2>Five judge debates will appear here.</h2>
              </div>
              <div className="empty-grid" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <dl>
                <div>
                  <dt>Case merit</dt>
                  <dd>Pending</dd>
                </div>
                <div>
                  <dt>Reality cost</dt>
                  <dd>Pending</dd>
                </div>
                <div>
                  <dt>Worth-It Verdict</dt>
                  <dd>Pending</dd>
                </div>
              </dl>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}
