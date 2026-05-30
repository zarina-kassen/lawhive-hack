"use client";

import { useEffect, useState } from "react";
import { Scale } from "lucide-react";

type Intake = {
  caseContext: string;
  evidenceFiles: { name: string; size: number }[];
  createdAt: string;
};

export default function DashboardPage() {
  const [intake, setIntake] = useState<Intake | null>(null);

  useEffect(() => {
    const raw = window.sessionStorage.getItem("tribunalNavigator.intake");
    if (raw) setIntake(JSON.parse(raw) as Intake);
  }, []);

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
            Your assessment
          </span>
          <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">
            Case dashboard.
          </h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            This is where your full recommendation — Case Merit, Forecast, Practical Impact and
            Action Plan — will appear.
          </p>
        </div>

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
