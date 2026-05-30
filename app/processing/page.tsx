"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Scale, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SimulationResult } from "@/src/lib/simulation";

type IntakePayload = {
  caseContext: string;
  evidenceFiles: Array<{ name: string; size: number }>;
  createdAt: string;
};

const STAGES = [
  "Building your case profile",
  "Selecting relevant tribunal judges",
  "Running judge debates",
  "Preparing your recommendation",
];

export default function ProcessingPage() {
  const router = useRouter();
  const hasStarted = useRef(false);
  const [activeStage, setActiveStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [simulationReady, setSimulationReady] = useState(false);

  // Random per-step durations summing to a total of 15–30s.
  const [durations] = useState(() => {
    const total = 15000 + Math.random() * 15000; // 15s–30s
    const weights = STAGES.map(() => 0.5 + Math.random());
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => (w / sum) * total);
  });

  useEffect(() => {
    if (error || activeStage >= STAGES.length) return;

    const t = setTimeout(() => setActiveStage((stage) => stage + 1), durations[activeStage]);
    return () => clearTimeout(t);
  }, [activeStage, durations, error]);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const rawIntake = window.sessionStorage.getItem("tribunalNavigator.intake");
    if (!rawIntake) {
      router.replace("/");
      return;
    }

    const intake = JSON.parse(rawIntake) as IntakePayload;
    const controller = new AbortController();

    async function runSimulation() {
      try {
        const response = await fetch("/api/simulate", {
          body: JSON.stringify({
            caseContext: intake.caseContext,
            evidenceFiles: intake.evidenceFiles,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: controller.signal,
        });
        const body = (await response.json()) as SimulationResult | { error?: string };

        if (!response.ok) {
          throw new Error("error" in body && body.error ? body.error : "The simulation failed.");
        }

        window.sessionStorage.setItem("tribunalNavigator.simulationResult", JSON.stringify(body));
        setSimulationReady(true);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : "The simulation failed.");
      }
    }

    void runSimulation();

    return () => {
      controller.abort();
    };
  }, [router]);

  useEffect(() => {
    if (!simulationReady || activeStage < STAGES.length) return;

    const done = setTimeout(() => router.push("/dashboard"), 400);
    return () => clearTimeout(done);
  }, [activeStage, router, simulationReady]);

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-foreground text-background">
            <Scale className="size-4" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Tribunal Navigator</span>
        </div>

        <div className="mt-8 flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {error ? "We could not complete the assessment." : "Preparing your assessment."}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {error
              ? error
              : "We're reconstructing a panel of real UK Employment Tribunal judges and running them through your case."}
          </p>
        </div>

        <ul className="mt-8 flex w-full flex-col gap-2 text-left">
          {STAGES.map((stage, i) => {
            const done = i < activeStage;
            const active = !error && i === activeStage;
            return (
              <li
                key={stage}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
                  active && "border-foreground/30 bg-muted/40",
                  !active && !done && "opacity-50"
                )}
              >
                <span className="flex size-5 items-center justify-center">
                  {done ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-[11px] text-background">
                      ✓
                    </span>
                  ) : active ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <span className="size-2 rounded-full bg-muted-foreground/40" />
                  )}
                </span>
                <span className={cn(done ? "text-foreground/70" : "text-foreground")}>{stage}</span>
              </li>
            );
          })}
        </ul>

        {error && (
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-6 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Back to intake
          </button>
        )}
      </div>
    </main>
  );
}
