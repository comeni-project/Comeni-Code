# M5.4 — Learner goal suggestions

Part of M5 (#449), following M5.1's gateway, M5.2's provenance-aware drafting, and M5.3's block
scores. It wires the already-declared `goal-suggestions` call site into Start (L1). The existing
search and route surfaces remain; no new screen or board is needed.

## What it does

When a learner submits words on Start, the API may ask the model to choose up to three existing
node targets that best match the learner's intent. The learner sees the same cards as today and
must choose each target. The model never chooses or orders the route: after a learner confirms a
target, the existing deterministic route API walks `needs` links and explains each stop.

The model may choose only from a bounded candidate set built from deterministic search results
and the human-authored `related` links of those results. This preserves the peer test from W3.3:
targets are existing, reviewed pages rather than model inventions. Returned ids are treated as
untrusted input, deduplicated, checked against that set, and resolved to current indexed titles,
claims, levels, regions and durations. Reasons, generated page content and arbitrary node IDs are
not returned.

If there is no configured model, the daily cap is reached, a provider call fails, the reply has the
wrong shape, or any returned id is outside the candidate set, Start uses the existing plain search
result for the submitted words. The fallback is visible only as the ordinary search cards; it does
not interrupt the learner with an AI error. Search remains usable without an AI call.

## Request and response

- Add a public, anonymous `POST /api/goals/suggest` endpoint with a small bounded input string.
- Reply with the normalized query and up to three ordinary `ResultOut` targets. Do not return
  prompts, provider text, confidence, raw scores, candidate internals, or learner identifiers.
- Keep the endpoint stateless. It records the gateway call with `by=None`, uses the declared
  `goal-suggestions` site and a versioned prompt id, and stores no query text or reply in `AICall`.
- Candidate construction and result mapping use the current index. The model receives only the
  query and public candidate IDs/titles/claims; it has no tools and cannot retrieve URLs.
- No model call runs if the query is blank, the index is unavailable, or deterministic search has
  no candidate to offer. These cases use the existing search behavior.

## Start behavior

- Submitting the query requests suggestions. The page displays the response in the existing target
  card list and keeps the current URL and explicit learner selection behavior.
- The learner must confirm one or more target cards; no target auto-selects and no route starts
  automatically. Existing multi-target (maximum three), back-button and route preview behavior
  remains intact.
- Suggestion loading and fallback search loading reuse the existing “Searching…” state. A fallback
  is a normal result, not a separate error panel. Network or API failures retain the current
  readable error behavior.
- Repeated submission can make another call, subject to the gateway's daily site cap. Ordinary
  typing and URL changes do not issue calls until the learner submits.

## Safety, privacy and bounds

- The gateway enforces the declared daily cap and records model, prompt id, tokens, cost, duration,
  outcome and anonymous identity. It records no prompt or response text.
- Query input has a strict maximum length; candidate count and output count are bounded. The reply
  schema is closed and contains only an ordered list of candidate IDs.
- Use a deterministic candidate order and preserve model order only after validation. Invalid,
  duplicate or excess IDs are discarded; a wholly invalid result falls back to search.
- Learner responses contain no score, reason, prompt, provider error or usage detail.
- There is no stored learner profile or conversation history, no free-form model-generated target,
  no route planning by AI, and no changes to the content graph.

## Acceptance checks

1. A valid typed reply selects only candidates from lexical search and their approved `related`
   peers, and maps them to current `ResultOut` records.
2. No candidate, missing index, missing model, cap, provider failure, malformed response or invalid
   IDs falls back to deterministic search without exposing provider details.
3. The anonymous gateway record contains no user, query, prompt or reply; usage and cap behavior
   remain visible on AI Models/Usage.
4. Start submits only on explicit action, shows suggestions as unselected cards, and preserves
   existing URL, target confirmation, route preview and three-target behavior.
5. No learner-facing schema gains score, confidence, explanation or authoring data.

## Decisions

- Candidate IDs come from deterministic search plus `related` peers. Rejected model-authored
  targets because the architecture requires a human-approved peer set.
- Model failure falls back silently to plain search. This keeps the no-AI lane working and avoids
  making provider state part of the learner's task.
- Targets remain suggestions; the route stays a deterministic graph operation and the learner
  chooses each target.
