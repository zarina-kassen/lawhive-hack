# lawhive-hack

Employment dispute reality-check hackathon MVP.

## Run locally

```bash
npm install
npm run enrich
npm run dev
```

Open `http://localhost:3000`.

## What is built

- Next.js App Router UI for the intake narrative, resilience sliders, Case Merit, Reality Cost, and Debate Graph.
- `src/lib/judges.ts` loads `judges.json`, keeps reliable named judges only, and indexes final-merits cases by jurisdiction.
- `src/lib/enrichment.ts` adds deterministic synthetic award, timeline, and reasoning fields per ADR-0001.
- `src/lib/simulation.ts` runs five strict-vs-lenient judge debates and aggregates votes into the Worth-It Verdict.
- `scripts/enrich-cases.ts` writes the pre-enriched `enriched.json` artifact.

Synthetic fields are hackathon data only, not extracted tribunal compensation facts.
