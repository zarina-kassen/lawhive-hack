"use client";

import { useEffect, useState } from "react";
import { Scale, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Intake = {
  caseContext: string;
  evidenceFiles: { name: string; size: number }[];
  createdAt: string;
};

const STAGES = [
  "Building your case profile",
  "Selecting relevant tribunal judges",
  "Running judge debates",
  "Preparing your recommendation",
];

export default function DashboardPage() {
  const [intake, setIntake] = useState<Intake | null>(null);
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const raw = window.sessionStorage.getItem("tribunalNavigator.intake");
    if (raw) setIntake(JSON.parse(raw) as Intake);
  }, []);

  useEffect(() => {
    if (activeStage >= STAGES.length - 1) return;
    const t = setTimeout(() => setActiveStage((s) => s + 1), 1400);
    return () => clearTimeout(t);
  }, [activeStage]);

  return (
    <main className="min-h-screen w-full bg-background">
      <div className="mx-auto w-full max-w-2xl px-6 py-12 lg:py-20">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-foreground text-background">
            <Scale className="size-4" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Tribunal Navigator</span>
        </div>

        <div className="mt-12 flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Simulation running
          </span>
          <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">
            Preparing your tribunal assessment.
          </h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            We&apos;re reconstructing a panel of real UK Employment Tribunal judges and running them
            through your case. This page will become your full recommendation.
          </p>
        </div>

        <ul className="mt-10 flex flex-col gap-2">
          {STAGES.map((stage, i) => {
            const done = i < activeStage;
            const active = i === activeStage;
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
                    <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-background text-[11px]">
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

        {intake && (
          <div className="mt-10 rounded-xl border bg-muted/30 p-4">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Your account</p>
            <p className="line-clamp-4 text-sm leading-relaxed text-foreground">{intake.caseContext}</p>
            {intake.evidenceFiles.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {intake.evidenceFiles.length} document
                {intake.evidenceFiles.length === 1 ? "" : "s"} attached
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
