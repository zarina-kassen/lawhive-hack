"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Scale, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  "Building your case profile",
  "Selecting relevant tribunal judges",
  "Running judge debates",
  "Preparing your recommendation",
];

export default function ProcessingPage() {
  const router = useRouter();
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    if (activeStage < STAGES.length) {
      const t = setTimeout(() => setActiveStage((s) => s + 1), 1400);
      return () => clearTimeout(t);
    }
    const done = setTimeout(() => router.push("/dashboard"), 600);
    return () => clearTimeout(done);
  }, [activeStage, router]);

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
          <h1 className="text-2xl font-semibold tracking-tight">Preparing your assessment.</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We&apos;re reconstructing a panel of real UK Employment Tribunal judges and running them
            through your case.
          </p>
        </div>

        <ul className="mt-8 flex w-full flex-col gap-2 text-left">
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
      </div>
    </main>
  );
}
