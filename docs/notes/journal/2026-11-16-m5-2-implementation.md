# 2026-11-16 — M5.2 implemented and verified

## Where things stand

- M5.2's ten implementation steps (#466–#475) are implemented on `docs/m5-2-drafting`, stacked on the still-open M5.1 PR #465. Real ChatGPT sign-in is not an acceptance gate. No M5.2 PR was opened because publication is a separate approval step in the approved plan.
- Python: `uv run pytest -q` — 1,938 passed. Django check and migration check, Ruff lint/format, mypy, and locked workspace sync pass. Web: 970 tests with two workers, Biome, strict TypeScript, and Vite production build pass.
- Isolated Compose project `comeni-m5-2-check` passed `ops/stack-check.sh` through port 18090. A local OpenAI-compatible stub drove the worker. A 1440px browser walk covered all three proposal kinds, no-model refusal, malformed reply, daily cap, delayed reply racing a manual save, human correction surviving two redrafts, explicit overlap resolution, duplicate Keep, private/public source handling, resource selection, body/shared/question figures, and Use followed by normal Save. Light/dark screens were inspected; no runtime errors or horizontal overflow.
- The working tree contains only the inherited untracked `.env.walk-aside`; it was not read, changed, or staged.

## What changed

- `d8a8313` records the approved plan; `d4f3533` through `e460a4c` implement the public provenance codec, proposal models, explicit origin mapping, replay, worker, author API, landing/index preservation and UI.
- Versioned prompts, closed typed adapters and one recorded gateway call power the flow. A proposal never edits a draft before author action. Figure data stays in the composer working copy until ordinary Save commits both content and provenance.
- `provenance.json` is validated with content fingerprints and survives landing, index rebuild and later draft opening. Private source excerpts and author identity stay in Studio.

## Decisions made, and why

- A missing imported AI baseline is an explicit conflict; a public receipt alone cannot recreate a private raw answer. This avoids inventing replay history.
- Figure source/copy checks bind the proposal UUID and saved working-copy digest. Figure Save consumes the proposal in the same transaction and can retain an author correction made after Use.
- No live model account was used. Faked gateway tests and an isolated local HTTP stub exercise the application flow without provider sign-in.

## What is next

1. Review and publish this branch after the operator authorises the PR; run its CI.
2. Do not merge the M5.2 PR until the operator approves that specific green PR. M5.1 PR #465 remains open pending its own merge approval.
3. Continue with the next approved M5 part after M5.2 is reviewed.

## Open questions

- None in M5.2. Live ChatGPT sign-in was intentionally not tested.

## Traps

- The isolated stack has a separate Compose project, ports and volumes. Stop only `comeni-m5-2-check` when its artifacts are no longer needed.
- The Vite build prints the existing large-chunk advisory; the build succeeds.
