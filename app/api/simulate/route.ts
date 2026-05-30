import { NextResponse } from "next/server";

import { runSimulation, simulationRequestSchema } from "@/src/lib/simulation";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = simulationRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "The simulation request was not valid.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await runSimulation(parsed.data);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The real Opus simulation failed.";
    console.error("Simulation failed", error);

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
