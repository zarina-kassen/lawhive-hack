import { NextResponse } from "next/server";

import { runSimulation, simulationRequestSchema } from "@/src/lib/simulation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = simulationRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please describe the employment dispute in at least 20 characters.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const result = await runSimulation(parsed.data);

  return NextResponse.json(result);
}
