"use client";

import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import type { SimulationResult } from "@/src/lib/simulation";

type Intake = {
  caseContext: string;
  evidenceFiles: { name: string; size: number }[];
  createdAt: string;
};

const percentFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
  style: "percent",
});

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  currency: "GBP",
  maximumFractionDigits: 0,
  style: "currency",
});

export default function DashboardPage() {
  const [intake, setIntake] = useState<Intake | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const raw = window.sessionStorage.getItem("tribunalNavigator.intake");
      if (raw) setIntake(JSON.parse(raw) as Intake);

      const rawResult = window.sessionStorage.getItem("tribunalNavigator.simulationResult");
      if (rawResult) setResult(JSON.parse(rawResult) as SimulationResult);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const debatesForClaimant =
    result?.debates.filter((debate) => debate.votes.some((vote) => vote.outcome === "win")).length ?? 0;

  return (
    <main className="min-h-screen w-full bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-12 lg:py-20">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-foreground text-background">
            <Scale className="size-4" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Tribunal Navigator</span>
        </div>

        <div className="mt-12 flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Your assessment
          </span>
          <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">
            {result ? "Your tribunal assessment is ready." : "Case dashboard."}
          </h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {result
              ? result.recommendation
              : "This is where your full recommendation — Case Merit, Forecast, Practical Impact and Action Plan — will appear."}
          </p>
        </div>

        {result ? (
          <>
            <section className="mt-10 grid gap-3 md:grid-cols-3">
              <article className="rounded-xl border bg-card p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Case Merit</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">
                  {percentFormatter.format(result.caseMerit.winProbability)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Projected claimant win probability</p>
              </article>
              <article className="rounded-xl border bg-card p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Expected Award</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">
                  {currencyFormatter.format(result.caseMerit.expectedAwardGbp)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Spread {currencyFormatter.format(result.caseMerit.awardSpreadGbp.min)}-
                  {currencyFormatter.format(result.caseMerit.awardSpreadGbp.max)}
                </p>
              </article>
              <article className="rounded-xl border bg-card p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Practical Impact</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">
                  {result.practicalImpact.typicalMonthsToResolution} months
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.practicalImpact.abandonmentRisk} abandonment risk
                </p>
              </article>
            </section>

            <section className="mt-10 rounded-xl border bg-card p-5">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Judge debates</p>
                <h2 className="text-xl font-semibold tracking-tight">
                  {debatesForClaimant} of {result.debates.length} debates found a claimant path.
                </h2>
              </div>
              <div className="mt-5 grid gap-3">
                {result.debates.map((debate) => (
                  <article key={debate.id} className="rounded-lg border bg-muted/20 p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-semibold">
                        {debate.strictJudge.name} vs {debate.lenientJudge.name}
                      </p>
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {debate.disagreed ? "Split view" : "Aligned view"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{debate.votes[0]?.keyReason}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {intake && (
          <section className="mt-10 rounded-xl border bg-muted/30 p-4">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Your account</p>
            <p className="line-clamp-4 text-sm leading-relaxed text-foreground">{intake.caseContext}</p>
            {intake.evidenceFiles.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {intake.evidenceFiles.length} document
                {intake.evidenceFiles.length === 1 ? "" : "s"} attached
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
