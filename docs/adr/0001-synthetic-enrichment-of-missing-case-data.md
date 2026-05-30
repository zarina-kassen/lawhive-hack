# 1. Synthetic enrichment of missing case data (award £, time, reasoning)

Date: 2026-05-30
Status: Accepted

## Context

`judges.json` is "fast-pass only" (`meta.notes`). It does **not** contain:
- award £ / compensation,
- time-to-resolution (only a single `decision_date`, no filing date),
- extracted reasoning text (lives only inside the PDFs).

The product's core value — the **Reality Cost** and **Worth-It Verdict** — depends
on exactly these missing fields (money, time, the emotional grind). Running the
real "deep pass" over 2,438 PDFs is not feasible in a 5-hour hackathon.

Options considered:
1. Compute heuristics at runtime per request.
2. Run the real deep-pass LLM extraction over the PDFs (too slow for the window).
3. **Pre-enrich each case once with realistic synthetic values.**

## Decision

Pre-enrich each case with **realistic synthetic values** for award £,
time-to-resolution, and a short reasoning blurb — assigned plausibly by claim
type + outcome and grounded in real UK ET norms (statutory caps, typical median
awards, realistic 6–24 month timelines). The values are **synthetic but
believable**, and **flagged as synthetic internally** (e.g. a `synthetic: true`
marker on enriched fields).

## Consequences

- **Demo works end-to-end** with credible numbers; the reality-check thesis lands.
- **Integrity risk:** these are NOT real awards. Anyone extending this must not
  present synthetic £/time as real tribunal data, and must replace it with the
  real deep-pass before any production/legal use. The internal flag exists to
  make this impossible to forget.
- Reversible: swapping synthetic enrichment for a real deep-pass is a data-layer
  change, not an architecture change.
