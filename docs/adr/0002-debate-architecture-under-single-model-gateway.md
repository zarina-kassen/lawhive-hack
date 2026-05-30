# 2. Debate architecture under a single-model gateway

Date: 2026-05-30
Status: Accepted

## Context

The hackathon gateway (`https://ai.hack.lawhive.co.uk`) routes **only one model**:
`vertex_ai/claude-opus-4-7`. There is no cheap/fast tier (no Haiku/Sonnet). Auth
is `authToken` / Bearer, not `apiKey`. The product wants judges to *genuinely
debate each other*, at N=5 debates for the MVP, scaling toward N=50.

A naive design (separate call per judge per round) costs N × judges × rounds
Opus calls — 20–30 for N=5, ~200–300 for N=50: slow and a dead live demo if
done sequentially. But the user explicitly wants real adversarial debate, not a
single model role-playing both sides, and is not concerned about rate limits.

## Decision

A **Debate** is a **real multi-round exchange between two independent Opus
agents** (an employer-leaning/strict judge vs a claimant-leaning/lenient judge,
each grounded in a real judge profile + anchored to a real precedent case).
Rounds are **sequential within a debate** (each judge reads and rebuts the
other's last argument). All N debates run **fully concurrently**. No forced
consensus: after the rounds, **each judge casts a final vote** (win/lose +
award £); votes are tallied across all debates (N×2 votes → P(win)).

## Consequences

- Genuinely adversarial dynamics and a real transcript to render in the
  front-door Debate Graph.
- Latency = (rounds × per-call latency) because rounds are sequential per debate,
  but bounded since debates are concurrent. Streaming fills the graph live.
- Cost scales with N×2×rounds Opus calls; acceptable given no rate-limit concern.
- Aggregating per-judge votes (not per-debate consensus) sidesteps deadlock and
  yields more data points; "the two judges disagreed" becomes a UI feature.
- Reversible toward a cheaper single-call-per-debate mode if latency bites at
  N=50.
