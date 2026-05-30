"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { ArrowLeft, BadgePoundSterling, CircleDot, Scale, Split, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import demoSimulation from "@/src/lib/demo-simulation.json";
import type { SimulationResult } from "@/src/lib/simulation";

type Debate = SimulationResult["debates"][number];
type Vote = Debate["votes"][number];

type CaseNodeData = {
  kind: "case";
  title: string;
  subtitle: string;
  winProbability: number;
};

type DebateNodeData = {
  kind: "debate";
  debate: Debate;
  selected: boolean;
};

type JudgeNodeData = {
  kind: "judge";
  judgeName: string;
  disposition: "strict" | "lenient";
  successRate: number;
  vote: Vote;
};

type GraphNodeData = CaseNodeData | DebateNodeData | JudgeNodeData;

const percentFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
  style: "percent",
});

const currencyFormatter = new Intl.NumberFormat("en-GB", {
  currency: "GBP",
  maximumFractionDigits: 0,
  style: "currency",
});

function readStoredSimulation(): SimulationResult {
  if (typeof window === "undefined") return demoSimulation as SimulationResult;

  const stored = window.sessionStorage.getItem("tribunalNavigator.simulationResult");
  if (!stored) return demoSimulation as SimulationResult;

  try {
    return JSON.parse(stored) as SimulationResult;
  } catch {
    window.sessionStorage.removeItem("tribunalNavigator.simulationResult");
    return demoSimulation as SimulationResult;
  }
}

function debateWinner(debate: Debate): "win" | "lose" | "split" {
  const wins = debate.votes.filter((vote) => vote.outcome === "win").length;
  if (wins === debate.votes.length) return "win";
  if (wins === 0) return "lose";
  return "split";
}

function debateAward(debate: Debate): number {
  const awards = debate.votes.map((vote) => vote.awardGbp).filter((award) => award > 0);
  if (awards.length === 0) return 0;
  return Math.round(awards.reduce((sum, award) => sum + award, 0) / awards.length);
}

function CaseNode({ data }: NodeProps<Node<CaseNodeData>>) {
  return (
    <div className="w-64 rounded-2xl border border-foreground/20 bg-foreground px-5 py-4 text-background shadow-2xl">
      <Handle type="source" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="source" position={Position.Left} className="opacity-0" />
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-md bg-background text-foreground">
          <Scale className="size-4" />
        </div>
        <span className="text-xs font-medium uppercase tracking-wider opacity-70">Demo case</span>
      </div>
      <h2 className="mt-4 text-xl font-semibold leading-tight tracking-tight">{data.title}</h2>
      <p className="mt-2 text-xs leading-relaxed opacity-70">{data.subtitle}</p>
      <div className="mt-4 flex items-end justify-between border-t border-background/15 pt-3">
        <span className="text-xs uppercase tracking-wider opacity-60">Win probability</span>
        <strong className="text-2xl leading-none">{percentFormatter.format(data.winProbability)}</strong>
      </div>
    </div>
  );
}

function DebateNode({ data }: NodeProps<Node<DebateNodeData>>) {
  const winner = debateWinner(data.debate);
  const wins = data.debate.votes.filter((vote) => vote.outcome === "win").length;
  const tone =
    winner === "win"
      ? "border-emerald-600/50 bg-emerald-50 text-emerald-950"
      : winner === "lose"
        ? "border-red-700/40 bg-red-50 text-red-950"
        : "border-amber-600/50 bg-amber-50 text-amber-950";

  return (
    <button
      type="button"
      className={`w-64 rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${tone} ${
        data.selected ? "ring-2 ring-foreground/50" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-wider opacity-65">
            {data.debate.id.replace("-", " ")}
          </p>
          <h3 className="mt-1 text-base font-semibold leading-tight">
            {data.debate.strictJudge.name} vs {data.debate.lenientJudge.name}
          </h3>
        </div>
        {data.debate.disagreed ? <Split className="size-4 shrink-0" /> : <CircleDot className="size-4 shrink-0" />}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-white/55 p-2">
          <p className="opacity-60">Votes</p>
          <p className="font-semibold">{wins}/2 claimant</p>
        </div>
        <div className="rounded-lg bg-white/55 p-2">
          <p className="opacity-60">Award signal</p>
          <p className="font-semibold">{currencyFormatter.format(debateAward(data.debate))}</p>
        </div>
      </div>
    </button>
  );
}

function JudgeNode({ data }: NodeProps<Node<JudgeNodeData>>) {
  const isWin = data.vote.outcome === "win";

  return (
    <div className="w-56 rounded-xl border bg-card p-3 shadow-sm">
      <Handle type="source" position={Position.Top} className="opacity-0" />
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold">{data.judgeName}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider ${
            data.disposition === "strict" ? "bg-red-100 text-red-900" : "bg-emerald-100 text-emerald-900"
          }`}
        >
          {data.disposition}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span>{percentFormatter.format(data.successRate)} claimant rate</span>
        <span className={isWin ? "text-emerald-700" : "text-red-700"}>
          {isWin ? "Votes win" : "Votes lose"}
        </span>
      </div>
    </div>
  );
}

const nodeTypes = {
  case: CaseNode,
  debate: DebateNode,
  judge: JudgeNode,
};

function buildGraph(result: SimulationResult, selectedDebateId: string): { nodes: Node<GraphNodeData>[]; edges: Edge[] } {
  const nodes: Node<GraphNodeData>[] = [
    {
      id: "case",
      type: "case",
      position: { x: 500, y: 360 },
      data: {
        kind: "case",
        title: "Leah Miller v Granthorne Logistics",
        subtitle: "Retaliatory redundancy, grievance, settlement pressure, recordings, and STIP bonus risk.",
        winProbability: result.caseMerit.winProbability,
      },
      draggable: false,
    },
  ];
  const edges: Edge[] = [];

  const center = { x: 532, y: 392 };
  const radiusX = 470;
  const radiusY = 300;

  result.debates.forEach((debate, index) => {
    const angle = -Math.PI / 2 + (index / result.debates.length) * Math.PI * 2;
    const unit = { x: Math.cos(angle), y: Math.sin(angle) };
    const tangent = { x: -Math.sin(angle), y: Math.cos(angle) };
    const debatePosition = {
      x: center.x + unit.x * radiusX,
      y: center.y + unit.y * radiusY,
    };
    const strictPosition = {
      x: debatePosition.x + tangent.x * -145 + unit.x * 95,
      y: debatePosition.y + tangent.y * -145 + unit.y * 70,
    };
    const lenientPosition = {
      x: debatePosition.x + tangent.x * 145 + unit.x * 95,
      y: debatePosition.y + tangent.y * 145 + unit.y * 70,
    };
    const winner = debateWinner(debate);
    const edgeColor = winner === "win" ? "#047857" : winner === "lose" ? "#b91c1c" : "#b45309";

    nodes.push({
      id: debate.id,
      type: "debate",
      position: { x: debatePosition.x, y: debatePosition.y },
      data: { kind: "debate", debate, selected: debate.id === selectedDebateId },
    });
    nodes.push({
      id: `${debate.id}-strict`,
      type: "judge",
      position: strictPosition,
      data: {
        kind: "judge",
        judgeName: debate.strictJudge.name,
        disposition: "strict",
        successRate: debate.strictJudge.claimantSuccessRateFinal,
        vote: debate.votes.find((vote) => vote.disposition === "strict") ?? debate.votes[0],
      },
    });
    nodes.push({
      id: `${debate.id}-lenient`,
      type: "judge",
      position: lenientPosition,
      data: {
        kind: "judge",
        judgeName: debate.lenientJudge.name,
        disposition: "lenient",
        successRate: debate.lenientJudge.claimantSuccessRateFinal,
        vote: debate.votes.find((vote) => vote.disposition === "lenient") ?? debate.votes[1],
      },
    });

    edges.push({
      id: `case-${debate.id}`,
      source: "case",
      target: debate.id,
      animated: debate.id === selectedDebateId,
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
      style: { stroke: edgeColor, strokeWidth: debate.id === selectedDebateId ? 3 : 2 },
    });
    edges.push({
      id: `${debate.id}-strict-edge`,
      source: `${debate.id}-strict`,
      target: debate.id,
      style: { stroke: "#991b1b", strokeDasharray: "5 5" },
    });
    edges.push({
      id: `${debate.id}-lenient-edge`,
      source: `${debate.id}-lenient`,
      target: debate.id,
      style: { stroke: "#047857", strokeDasharray: "5 5" },
    });
  });

  return { nodes, edges };
}

export default function SimulationsPage() {
  const [result, setResult] = useState<SimulationResult>(demoSimulation as SimulationResult);
  const [selectedDebateId, setSelectedDebateId] = useState((demoSimulation as SimulationResult).debates[0]?.id ?? "");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedResult = readStoredSimulation();
      setResult(storedResult);
      setSelectedDebateId(storedResult.debates[0]?.id ?? "");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const selectedDebate = result.debates.find((debate) => debate.id === selectedDebateId) ?? result.debates[0];
  const { nodes, edges } = useMemo(() => buildGraph(result, selectedDebate?.id ?? ""), [result, selectedDebate?.id]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:py-10">
        <header className="flex flex-col gap-5 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back to dashboard
            </Link>
            <div className="mt-6 flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-md bg-foreground text-background">
                <UsersRound className="size-4" />
              </div>
              <span className="text-[15px] font-semibold tracking-tight">Tribunal Navigator</span>
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight lg:text-5xl">Debate Graph</h1>
            <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
              A mapped view of the fixed Case 09 simulation: five judge debates around Leah&apos;s case,
              with each pair&apos;s vote, award signal, anchor cases, and transcript.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:min-w-[360px]">
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Case Merit</p>
              <p className="mt-1 text-xl font-semibold">{percentFormatter.format(result.caseMerit.winProbability)}</p>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Expected</p>
              <p className="mt-1 text-xl font-semibold">{currencyFormatter.format(result.caseMerit.expectedAwardGbp)}</p>
            </div>
            <div className="rounded-xl border bg-card p-3">
              <p className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">Debates</p>
              <p className="mt-1 text-xl font-semibold">{result.debates.length}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="h-[680px] overflow-hidden rounded-2xl border bg-card">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.22 }}
              minZoom={0.35}
              maxZoom={1.25}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              onNodeClick={(_, node) => {
                if (node.type === "debate") setSelectedDebateId(node.id);
                if (node.id.includes("-strict") || node.id.includes("-lenient")) {
                  setSelectedDebateId(node.id.split("-").slice(0, 2).join("-"));
                }
              }}
            >
              <Background color="oklch(0.55 0.015 50)" gap={28} size={1} />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) => {
                  if (node.type === "case") return "#181713";
                  if (node.type === "judge") return node.id.endsWith("strict") ? "#991b1b" : "#047857";
                  const debate = result.debates.find((item) => item.id === node.id);
                  const winner = debate ? debateWinner(debate) : "split";
                  return winner === "win" ? "#047857" : winner === "lose" ? "#b91c1c" : "#b45309";
                }}
              />
            </ReactFlow>
          </div>

          {selectedDebate ? (
            <aside className="rounded-2xl border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {selectedDebate.id.replace("-", " ")}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                    {selectedDebate.strictJudge.name} vs {selectedDebate.lenientJudge.name}
                  </h2>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  {selectedDebate.disagreed ? "Split view" : "Aligned view"}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {selectedDebate.votes.map((vote) => (
                  <div key={`${vote.judge}-${vote.disposition}`} className="rounded-xl border bg-muted/25 p-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{vote.disposition}</p>
                    <p className="mt-1 text-sm font-semibold">{vote.judge}</p>
                    <p className={vote.outcome === "win" ? "mt-2 text-sm text-emerald-700" : "mt-2 text-sm text-red-700"}>
                      {vote.outcome === "win" ? "Claimant win" : "Claimant lose"} ·{" "}
                      {percentFormatter.format(vote.confidence)}
                    </p>
                    <p className="mt-1 text-sm font-medium">{currencyFormatter.format(vote.awardGbp)}</p>
                  </div>
                ))}
              </div>

              <section className="mt-6">
                <div className="mb-3 flex items-center gap-2">
                  <BadgePoundSterling className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Why this debate matters</h3>
                </div>
                <div className="space-y-3">
                  {selectedDebate.votes.map((vote) => (
                    <p key={vote.judge} className="rounded-xl bg-muted/35 p-3 text-sm leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">{vote.judge}:</span> {vote.keyReason}
                    </p>
                  ))}
                </div>
              </section>

              <section className="mt-6">
                <h3 className="text-sm font-semibold">Transcript</h3>
                <div className="mt-3 space-y-3">
                  {selectedDebate.transcript.map((turn, index) => (
                    <div
                      key={`${turn.speaker}-${index}`}
                      className={`rounded-xl border p-3 ${
                        turn.speaker === "strict" ? "border-red-200 bg-red-50/60" : "border-emerald-200 bg-emerald-50/60"
                      }`}
                    >
                      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                        {turn.speaker} judge
                      </p>
                      <p className="mt-1 text-sm leading-relaxed">{turn.message}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-6">
                <h3 className="text-sm font-semibold">Anchor cases</h3>
                <div className="mt-3 space-y-3">
                  {selectedDebate.anchorCases.map((anchorCase) => (
                    <article key={anchorCase.caseNumber} className="rounded-xl border p-3">
                      <p className="text-xs font-medium text-muted-foreground">{anchorCase.caseNumber}</p>
                      <p className="mt-1 text-sm font-semibold">
                        {anchorCase.claimant} v {anchorCase.respondent}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{anchorCase.reasoningBlurb}</p>
                    </article>
                  ))}
                </div>
              </section>
            </aside>
          ) : null}
        </section>

        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link href="/dashboard">Return to assessment</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
