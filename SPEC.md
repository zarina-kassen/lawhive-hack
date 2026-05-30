# Spec — Employment Dispute Reality-Check (hackathon MVP)

> Domain language lives in [CONTEXT.md](CONTEXT.md). Key decisions:
> [ADR-0001 synthetic data](docs/adr/0001-synthetic-enrichment-of-missing-case-data.md),
> [ADR-0002 debate architecture](docs/adr/0002-debate-architecture-under-single-model-gateway.md).

## 1. One-liner

An employee describes their situation in a chat; we run a swarm of **real UK
Employment Tribunal judges** (reconstructed from 2,438 real decisions) who
**debate each other** over the case; we aggregate their verdicts into a
**Case Merit** number — then deliver the brutal **Worth-It Verdict**: even if
you'd win, the money/time/emotional cost often makes it not worth it.

## 2. The thesis (what makes this win)

Employees think "42% chance to win = I'll win." Reality: a "win" is often a net
loss after ~2 years, unrecoverable legal costs, and emotional toll — and many
claimants **abandon mid-case**. We separate **Case Merit** (legal strength) from
**Reality Cost** (what it actually does to your life) and show both.

## 3. Stack

- **Next.js (App Router) + Vercel AI SDK**, deployed on Vercel.
- **LLM:** `vertex_ai/claude-opus-4-7` **only**, via gateway
  `https://ai.hack.lawhive.co.uk`, auth `authToken`/Bearer (NOT `apiKey`).
  Key in `.env.local` (gitignored). Configure the Anthropic provider with custom
  `baseURL` + `headers: { Authorization: Bearer <key> }`.
- **Data:** `judges.json` shipped in-repo (3.4MB). The 2,971 PDFs stay **local
  only** — too big for deploy, and not needed at runtime (reasoning is enriched).
- **State:** in-memory per request. No database.
- **Viz libs:** `react-force-graph` (Debate Graph), `d3-sankey`/recharts
  (Cohort Flow), custom SVG (Gauntlet Timeline).

## 4. Data pipeline (do this first — ~30 min)

1. **Load + filter** `judges.json` to judges with `profile_reliable: true`
   (n≥5) and `final_merits` outcomes (the only trustworthy ones).
2. **Pre-enrich** each case once (script → `enriched.json`) per
   [ADR-0001](docs/adr/0001-synthetic-enrichment-of-missing-case-data.md):
   - `award_gbp` — synthetic, by jurisdiction + outcome (e.g. unfair-dismissal
     median ~£5–15k capped; discrimination uncapped, wider spread; £0 if
     dismissed). Mark `synthetic: true`.
   - `months_to_resolution` — synthetic 6–24, longer for discrimination / panel.
   - `reasoning_blurb` — 1–2 sentence synthetic rationale fitting the outcome.
3. **Index by jurisdiction** so the Orchestrator can pick from the right bucket.

## 5. Core flow

```
Intake chat ──► Case profile ──► Orchestrator ──► N Debates (concurrent)
                                      │                  │
                                      │            each: 2 real judges,
                                      │            2–3 sequential rounds,
                                      │            then 2 final votes
                                      ▼                  ▼
                              Aggregate (N×2 votes) ──► Case Merit
                                      │
                              + Resilience Profile (LLM) ──► Reality Cost
                                      ▼
                              Worth-It Verdict + visualizations
```

### 5.1 Intake (live, no hardcoding)
- Chat UI. User describes situation in free text; bot asks follow-ups; bot tells
  them which docs to upload; user uploads.
- **Chat is source of truth.** Uploads = best-effort text extraction (PDF/.txt/
  .docx appended); images vision-pass only if time.
- Output: structured **Case profile** — claim type(s) (mapped to `jurisdiction`
  tags), employment length, reason given, grievance raised?, protected
  characteristic?, free-text narrative.

### 5.2 Orchestrator (one Opus call to set up, then fan-out)
- **Select** ~10 real reliable-profile judges in the user's jurisdiction(s):
  pair **low** `claimant_success_rate_final` (employer-leaning/strict) vs
  **high** (claimant-leaning/lenient) → 5 pairs = 5 Debates. LLM-picked from a
  summarized candidate list (no embeddings — see CONTEXT.md).
- **Run** the 5 Debates concurrently (see 5.3).
- **Analyse** verdicts → Case Merit (5.4).

### 5.3 Debate (per [ADR-0002](docs/adr/0002-debate-architecture-under-single-model-gateway.md))
- Two independent Opus agents, each system-primed with their real judge's stats
  + anchored real case + (optional/stretch) reasoning style.
- 2–3 **sequential** rounds; each judge rebuts the other's last argument.
- Each judge emits a **final structured vote**: `{ outcome: win|lose,
  award_gbp: number, confidence: 0–1, key_reason: string }`.
- **Stream** rounds to the client so the Debate Graph fills in live.

### 5.4 Aggregate → Case Merit
- All judge votes pooled: `P(win) = claimant-votes / (N×2)`.
- `E[award] = mean(award_gbp of winning votes)`; show spread (min/median/max).
- Per-debate "disagreement" flag when the two judges split → surfaced on node.

### 5.5 Reality Cost + Resilience Profile (LLM-estimated)
- One Opus call reads the Case profile → estimates **financial runway**,
  **emotional resilience**, and an **abandonment-risk curve** over the timeline.
- Combine with synthetic award/time + the "no costs recovered" rule →
  net-position math (even wins can be net-negative).

### 5.6 Worth-It Verdict
- Synthesis line: e.g. *"Likely win (62%) — but expected net –£3,200 over ~22
  months, and high chance you abandon. Worth it? Probably not."*

## 6. Visualizations (build in this order; degrade gracefully)

1. **Debate Graph** (FRONT DOOR / hero) — force-graph; node = Debate, color =
   win/lose, size = award £, center = "your case"; click → debate transcript.
2. **Case Merit headline** — big number(s): P(win), E[£], split spread.
3. **Cohort Flow ("100 people like you")** — Sankey: settle / abandon / lose /
   win-net-negative / win-net-positive.
4. **Resilience Sliders** — financial runway + emotional resilience; re-flow the
   Cohort Flow live (demonstrates the non-deterministic variables).
5. **Gauntlet Timeline** — Today → Verdict with draining money/energy/time bars.
6. **Expectation vs Reality** — naive imagined number vs real spread.

## 7. Build priority ladder (ship whatever we reach)

1. Data pipeline → `enriched.json`.
2. Debate engine (N=5, concurrent, streaming) + Debate Graph + Case Merit. ← demo
3. Cohort Flow + Resilience (the reality-check gut-punch).
4. Gauntlet Timeline + Expectation-vs-Reality (polish).
5. Scale N toward 50.

Later items degrade to static/mocked if time runs out.

## 8. Explicitly out of scope (MVP)

- Embeddings / vector retrieval (LLM-picked instead).
- Real award/time/reasoning extraction from PDFs (synthetic — ADR-0001).
- Real document parsing reliability (best-effort; demo uses rehearsed input).
- Auth, persistence, multi-user, the legalist/purposive axis (stretch only).
