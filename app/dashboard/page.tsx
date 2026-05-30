"use client";


import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Scale,
  Plus,
  Share2,
  Download,
  ChevronDown,
  Gavel,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";
import { MOCK_RESULT, type SimulationResult } from "./mock";
import GaugeChart from "./gauge-chart";
import { RecommendationItem, type Recommendation } from "./recommendation-item";

const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${Math.round(n * 100)}%`;

const RISK_STYLES: Record<string, string> = {
  low: "text-chart-4 border-chart-4/30 bg-chart-4/10",
  medium: "text-chart-2 border-chart-2/30 bg-chart-2/10",
  high: "text-destructive border-destructive/30 bg-destructive/10",
};

type View = "dashboard" | "debates";

export default function DashboardPage() {
  const [result, setResult] = useState<SimulationResult>(MOCK_RESULT);
  const [view, setView] = useState<View>("dashboard");

  useEffect(() => {
    const rawResult = window.sessionStorage.getItem("tribunalNavigator.result");
    if (rawResult) {
      try {
        setResult(JSON.parse(rawResult) as SimulationResult);
      } catch {
        /* fall back to mock */
      }
    }
  }, []);

  const { caseMerit, practicalImpact, recommendation, debates } = result;
  const netPosition = caseMerit.expectedAwardGbp - practicalImpact.likelyUnrecoverableCostGbp;
  const winScore = Math.round(caseMerit.winProbability * 100);
  const worthIt = netPosition > 0 && caseMerit.winProbability >= 0.55;

  // Vote tally for the outcome breakdown.
  const tally = useMemo(() => {
    const allVotes = debates.flatMap((d) => d.votes);
    const wins = allVotes.filter((v) => v.outcome === "win").length;
    const losses = allVotes.filter((v) => v.outcome === "lose").length;
    const splits = debates.filter((d) => d.disagreed).length;
    return { total: allVotes.length, wins, losses, splits };
  }, [debates]);

  // Strategic recommendations derived from the result.
  const recommendations = useMemo<Recommendation[]>(() => {
    const items: Recommendation[] = [];
    items.push({
      id: "settlement",
      provision: "Settlement Leverage",
      text: `Test settlement first: with a ${pct(caseMerit.winProbability)} win probability, an early settlement near ${gbp(
        caseMerit.expectedAwardGbp
      )} likely beats the net outcome of a full hearing.`,
      tone: netPosition > 0 ? "info" : "warn",
      tag: netPosition > 0 ? "Recommended" : "High priority",
    });
    if (practicalImpact.abandonmentRisk !== "low") {
      items.push({
        id: "timeline",
        provision: "Timeline & Runway",
        text: `Plan for a long process: cases like this take ~${practicalImpact.typicalMonthsToResolution} months and abandonment risk is ${practicalImpact.abandonmentRisk}. Secure financial runway before escalating.`,
        tone: practicalImpact.abandonmentRisk === "high" ? "danger" : "warn",
        tag: practicalImpact.abandonmentRisk === "high" ? "High priority" : "Watch",
      });
    }
    items.push({
      id: "evidence",
      provision: "Evidence Strength",
      text: "Strengthen your record: contemporaneous documents (consultation minutes, payslips, emails) swing the split panels. Prioritise gathering these.",
      tone: "info",
      tag: "Action",
    });
    return items;
  }, [caseMerit, practicalImpact, netPosition]);

  const claimLabel = "Redundancy & Unpaid Wages";

  return (
    <main className="min-h-screen w-full bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
              <Scale className="size-3.5" />
            </div>
            <span className="text-sm font-medium">{claimLabel}</span>
          </div>

          <div className="flex items-center rounded-full border bg-muted/40 p-0.5 text-sm">
            {(["dashboard", "debates"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded-full px-4 py-1 font-medium capitalize transition-colors",
                  view === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label="Share">
              <Share2 className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label="Export">
              <Download className="size-4" />
            </Button>
            <Button asChild variant="outline" size="sm" className="ml-1">
              <Link href="/">
                <Plus className="size-4" /> New case
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-5 p-5">
        {view === "dashboard" ? (
          <>
            {/* Verdict hero */}
            <Card>
              <CardContent className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-2 lg:max-w-2xl">
                  <span
                    className={cn(
                      "inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                      worthIt ? RISK_STYLES.low : RISK_STYLES.high
                    )}
                  >
                    {worthIt ? "Worth pursuing" : "Probably not worth it"}
                  </span>
                  <p className="font-heading text-xl leading-snug tracking-tight lg:text-2xl">
                    {recommendation}
                  </p>
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
                  <HeroStat label="Win" value={`${winScore}%`} />
                  <HeroStat label="Expected" value={gbp(caseMerit.expectedAwardGbp)} />
                  <HeroStat
                    label="Net"
                    value={gbp(netPosition)}
                    valueClass={netPosition >= 0 ? "text-chart-4" : "text-destructive"}
                  />
                  <HeroStat label="Timeline" value={`~${practicalImpact.typicalMonthsToResolution}mo`} />
                </div>
              </CardContent>
            </Card>

            {/* Main grid */}
            <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-sm">Case Merit</CardTitle>
                  <CardDescription className="text-xs">Overall odds and outcome breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center">
                    <GaugeChart target={winScore} />
                    <span
                      className={cn(
                        "text-sm font-medium",
                        netPosition >= 0 ? "text-chart-4" : "text-destructive"
                      )}
                    >
                      Net {gbp(netPosition)} after costs
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Median award {gbp(caseMerit.expectedAwardGbp)}
                    </span>
                  </div>

                  <Separator className="my-4" />

                  <div className="my-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Outcome breakdown
                  </div>
                  <div className="mb-4 flex h-2 w-full gap-x-0.5 overflow-hidden rounded-full bg-muted">
                    <div className="rounded-l-full bg-chart-4" style={{ width: `${(tally.wins / tally.total) * 100}%` }} />
                    <div className="bg-chart-2" style={{ width: `${(tally.splits / tally.total) * 100}%` }} />
                    <div className="rounded-r-full bg-destructive" style={{ width: `${(tally.losses / tally.total) * 100}%` }} />
                  </div>

                  <div>
                    <BreakdownRow
                      color="success"
                      icon={<CheckCircle2 className="size-3" />}
                      label="Claimant wins"
                      count={`${tally.wins} votes`}
                    />
                    <BreakdownRow
                      color="warning"
                      icon={<AlertCircle className="size-3" />}
                      label="Split panels"
                      count={`${tally.splits} debates`}
                    />
                    <BreakdownRow
                      color="destructive"
                      icon={<XCircle className="size-3" />}
                      label="Employer wins"
                      count={`${tally.losses} votes`}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Middle column: Recommendations */}
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-sm">Recommendations</CardTitle>
                <CardDescription className="text-xs">Strategic next steps for your case</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {recommendations.map((rec) => (
                    <RecommendationItem key={rec.id} recommendation={rec} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Right column: Snapshot */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Case Snapshot</CardTitle>
                <CardDescription className="text-xs">Key figures from your simulation</CardDescription>
              </CardHeader>
              <CardContent>
                <SnapshotGroup icon={<Gavel className="size-3.5" />} title="Forecast">
                  <SnapshotRow label="Win probability" value={pct(caseMerit.winProbability)} />
                  <SnapshotRow label="Expected award" value={gbp(caseMerit.expectedAwardGbp)} />
                  <SnapshotRow
                    label="Award spread"
                    value={`${gbp(caseMerit.awardSpreadGbp.min)} – ${gbp(caseMerit.awardSpreadGbp.max)}`}
                  />
                </SnapshotGroup>

                <Separator className="my-4" />

                <SnapshotGroup icon={<Clock className="size-3.5" />} title="Reality cost">
                  <SnapshotRow
                    label="Time to resolution"
                    value={`~${practicalImpact.typicalMonthsToResolution} months`}
                  />
                  <SnapshotRow
                    label="Unrecoverable cost"
                    value={gbp(practicalImpact.likelyUnrecoverableCostGbp)}
                  />
                  <SnapshotRow
                    label="Net position"
                    value={gbp(netPosition)}
                    valueClass={netPosition >= 0 ? "text-chart-4" : "text-destructive"}
                  />
                </SnapshotGroup>

                <Separator className="my-4" />

                <SnapshotGroup icon={<Wallet className="size-3.5" />} title="Risk">
                  <SnapshotRow
                    label="Abandonment risk"
                    value={practicalImpact.abandonmentRisk}
                    valueClass={cn(
                      "capitalize",
                      practicalImpact.abandonmentRisk === "high"
                        ? "text-destructive"
                        : practicalImpact.abandonmentRisk === "medium"
                          ? "text-chart-2"
                          : "text-chart-4"
                    )}
                  />
                  <SnapshotRow label="Judge votes" value={`${tally.total} total`} />
                </SnapshotGroup>

              </CardContent>
            </Card>
            </div>
          </>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            <div className="mb-1">
              <h2 className="text-sm font-semibold">The judge debates</h2>
              <p className="text-sm text-muted-foreground">
                {debates.length} debates between strict and lenient real tribunal judges.
              </p>
            </div>
            {debates.map((debate) => (
              <DebateCard key={debate.id} debate={debate} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function HeroStat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center sm:min-w-24">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-heading text-lg tracking-tight tabular-nums", valueClass)}>{value}</p>
    </div>
  );
}

function BreakdownRow({
  icon,
  label,
  count,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  count: string;
  color: "success" | "warning" | "destructive";
}) {
  return (
    <div className="flex w-full items-center justify-between gap-x-3 py-2.5 text-start font-semibold">
      <Pill color={color} icon={icon}>
        {label}
      </Pill>
      <span className="text-xs font-normal text-muted-foreground">{count}</span>
    </div>
  );
}

function SnapshotGroup({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function SnapshotRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}

function DebateCard({ debate }: { debate: SimulationResult["debates"][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <Gavel className="size-4" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="truncate">{debate.strictJudge.name}</span>
            <span className="text-muted-foreground">vs</span>
            <span className="truncate">{debate.lenientJudge.name}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {debate.votes.map((v) => (
              <span
                key={v.judge}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  v.outcome === "win" ? RISK_STYLES.low : "border-border text-muted-foreground"
                )}
              >
                {v.outcome === "win" ? `Win · ${gbp(v.awardGbp)}` : "Lose"}
              </span>
            ))}
            {debate.disagreed && (
              <span className="inline-flex items-center gap-1 rounded-full border border-chart-2/30 bg-chart-2/10 px-2 py-0.5 text-[11px] font-medium text-chart-2">
                Split
              </span>
            )}
          </div>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t px-5 py-4">
          <ul className="flex flex-col gap-3">
            {debate.transcript.map((line, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className={cn(
                    "mt-0.5 inline-flex h-fit shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    line.speaker === "strict"
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  {line.speaker === "strict" ? debate.strictJudge.name : debate.lenientJudge.name}
                </span>
                <p className="text-sm leading-relaxed text-foreground/90">{line.message}</p>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {debate.votes.map((v) => (
              <div key={v.judge} className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{v.judge}</span>
                  <span className="text-muted-foreground">{pct(v.confidence)} confident</span>
                </div>
                <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                  <ArrowRight className="mt-0.5 size-3 shrink-0" />
                  {v.keyReason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
