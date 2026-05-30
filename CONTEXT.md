# Context & Glossary

The shared language for this project. This file is a glossary, not a spec.
Terms are canonical: if code or conversation uses a word, it should mean what
is written here.

Domain: Tribunal Navigator, a tool that helps an employee understand and act on
a UK employment dispute by simulating how different judges, reasoning from real
Employment Tribunal decisions, would rule on their situation.

## Glossary

### Tribunal Navigator
The product: a guided assessment for UK employment disputes that combines judge
simulation, practical risk analysis, and recommended next steps.
_Avoid_: Reality Check, Reality Desk

### Precedent Case
A single real UK **Employment Tribunal (ET) decision** in our cleaned dataset
(`judges.json`: 2,438 cases, 457 judges; PDFs in `real_cases/2026 Cases`).

Each case record (fast-pass) carries: `case_number`, claimant, respondent,
`judge_name`, `decision_date`, `jurisdiction` tags, `judgment_type`,
`outcome` (`claimant_won` / `dismissed` / `partly_upheld` / `withdrawn` /
`unclear`), and the source PDF filename.

> **Data reality (from `meta.notes`):** this is **fast-pass only**. There is
> **NO award £ / compensation** and **NO extracted reasoning text** (deferred to
> a "deep pass" that has not run; reasoning lives only inside the PDFs). Outcome
> is ~83% accurate — **trust win-rates on `final_merits` only**.

> Note: first-instance ET decisions are not *binding precedent* in the strict
> legal sense (only appellate courts set precedent). We use "Precedent Case"
> loosely to mean "a prior decided case we reason by analogy from."

### Top Judge Dataset
The enriched deep-pass dataset for the ten most active substantive judges across
2025-2026 (`judges_2025-2026_[Enriched + Top 10 Judges].json`). Unlike the
fast-pass dataset, it includes reasoning profiles, verified outcomes, and real
award extraction where available, making it the preferred source for Demo
Simulation judge names, anchor cases, and debate flavor.

### Judicial Disposition
The temperament of a judge. **Primary axis = data-backed** from `judges.json`:

- **Claimant-leaning (lenient)** — high real `claimant_success_rate_final`.
- **Employer-leaning (strict)** — low real `claimant_success_rate_final`.

A Debate pairs a low-success-rate real judge vs a high-success-rate real judge,
both specialising in the user's jurisdiction. Because the stats are real and the
judges are **named real people** (with reliable profiles, n≥5 cases), this is
stronger than archetypes.

> **Secondary axis (Legalist vs Purposivist)** — how strictly vs purposively a
> judge reads the law — is NOT in the fast-pass data (needs reasoning text).
> Treated as an **optional live flavor**: since only a few anchor cases are
> LLM-picked per Simulation, their **PDFs can be read at simulation time** to
> extract real reasoning style. Stretch goal, not core.

### Judge Persona / Agent
An LLM agent that simulates how a particular **real named judge** would rule on
the user's situation. The agent is grounded in that judge's **real profile**
from `judges.json` (claimant success rate, jurisdiction specialism, strike-out
tendency) and **anchored to one of their real Precedent Cases**. The "100-200
agents" are real judges with reliable profiles selected for the simulation —
not invented archetypes.

### Debate
A contest between **two Judge Personas of opposing Judicial Disposition** (a
Legalist vs a Purposivist), each **anchored to a real Precedent Case** from the
dataset ("In Case X I ruled for the employer; your facts match"). They exchange
**2-3 rounds** of argument over the user's situation, then produce a **joint
verdict**: outcome (claimant win / lose) + estimated award £. The verdict is
one data point. Deadlock resolution: TBD (forced verdict vs tie-break referee).

> **Implementation (hackathon gateway):** only ONE routable model exists —
> `vertex_ai/claude-opus-4-7` (Opus); no cheap/fast tier. A Debate is a **real
> multi-round exchange between two independent Opus agents** (legalist judge vs
> purposivist judge). Rounds are **sequential within a debate** (each judge sees
> and rebuts the other's last argument); a verdict is extracted at the end. All
> N debates run **fully concurrently**. Rate limits are not a concern.

### Orchestrator
The controlling agent. Responsibilities: (1) **select** which Judge Personas /
Precedent Cases pair up for each Debate, (2) **run** the Debates (N parallel
Opus calls — see Debate), (3) **analyse** the verdicts into an aggregate
outcome.

Case selection is **LLM-picked** for the MVP: the Orchestrator is given a
summary list of Precedent Cases and chooses the most relevant ones to anchor
debates (no embeddings / vector store). Cases pre-tagged by claim type so it
picks from the right bucket. Upgrade path: semantic retrieval (embeddings).

### Simulation
One full run of the Orchestrator over the user's situation: N concurrent
Debates → N verdicts → an aggregate distribution (P(win), P(lose), E[award £]).
Scope: **N = 5 for the MVP**, architected to scale to **N = 50**.

For the current demo, Simulation means the **Demo Simulation**: a fixed
simulation result for the Demo Case, returned without live judge selection or
LLM calls while preserving the user's sense that a tribunal simulation is
running.

### Demo Simulation
The single hardcoded Simulation result for the Demo Case. It contains fixed
judge debates, votes, award range, practical impact, and recommendation.
_Avoid_: live simulation, real-time simulation

### Intake
The first user-facing stage: a conversational entry point where the user
describes a dispute and may upload documents. For the current demo, Intake is
only a trigger: the submitted text and uploads are ignored by the Simulation,
which always uses the Demo Case.

### Demo Case
The single hardcoded employment dispute used for the current demo:
**Case 09 / Leah Miller v Granthorne Logistics**. The case concerns alleged
retaliatory redundancy after a grievance about bullying and sex discrimination,
with a live settlement offer, ACAS certificate, covert recordings, and disputed
bonus treatment.
_Avoid_: live case, user case

### Results
The second user-facing stage: the explanation of a completed Simulation. Results
show Case Merit, Practical Impact, the Strategic Recommendation, the Action Plan,
and the visualisations that support them.

### Case Merit
Pure **legal strength** of the user's situation: P(win) / P(lose) and expected
award £, derived from aggregating Debate verdicts. Answers *"would a tribunal
rule for you?"* — and ONLY that. Deliberately kept separate from Reality Cost.

### Practical Impact
Everything that is true **regardless of whether you win**: time-to-resolution
(often 1-2+ years; derivable from real dates in the ET data), money you won't
recover (UK ET normally awards **no costs** — each side bears their own, so even
winners are out of pocket), and the **emotional / attrition toll**. These are
the "weighted non-deterministic" variables that change over time and per person.
_Avoid_: Reality Cost

> **Data note:** award £, time-to-resolution, and reasoning text are **NOT in
> `judges.json`** (fast-pass). We **pre-enrich** each case with **realistic
> synthetic values** — assigned plausibly by claim type + outcome and grounded
> in real UK ET norms (statutory caps, typical median awards, realistic
> timelines). Synthetic but believable; clearly flagged as such internally.

### Strategic Recommendation
The synthesis of Case Merit and Practical Impact. Answers *"even if you'd win,
should you pursue this?"* — the reality check no one gives employees. Core
product thesis: **a "win" is often a net loss** (money, ~2 years, mental health),
and many claimants **abandon mid-case** because they can't bear the toll.
_Avoid_: Worth-It Verdict

### Action Plan
Recommended next steps for the employee after a Simulation, grounded in Case
Merit and Practical Impact. Examples include evidence to gather, documents to
organise, settlement leverage to test, deadlines to check, or whether to pause
before escalating.

### Resilience Profile
A per-user estimate of **financial runway** and **emotional resilience**, and
the resulting **abandonment risk** over the case timeline. **LLM-estimated** by
reading the user's described situation (not hardcoded). Drives the attrition
streams in the visualisations and is adjustable via the Resilience sliders.

### Visualizations (all in scope)
- **Debate Graph** — the hero of the **Simulations deep-dive** (`/simulations`),
  reached by drilling in from the Dashboard (which is the product's front door).
  Force-graph; each node = one Debate, coloured win/lose, sized by award £;
  centre = "your case". Click a node → that debate's transcript (the two judges
  arguing).
- **Cohort Flow ("100 people like you")** — Sankey splitting a cohort into
  settle / abandon mid-case / lose / win-net-negative / win-net-positive.
- **Gauntlet Timeline** — Today → Verdict (~months) with draining bars:
  money, emotional energy, time. Win flag still shows net position.
- **Expectation vs Reality** — naive number the user imagined vs real spread.
- **Resilience Sliders** — financial runway + emotional resilience; re-flows
  the Cohort Flow live to demonstrate the non-deterministic nature.
