# M3 part 6, the First steps node page and M3's close: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/node/dna-and-genes?goal=salmon` is drawn in the board's First steps form, and M3
closes with its *done when* checked in the running stack.

**Architecture:** `NodePage` keeps the data and the states and picks a form:
`FirstSteps.tsx` when the node's level is *first-steps*, today's article otherwise. Both reuse
`Body`, `TryQuestion` and `RouteStrip`; the question's size comes from a `big` prop.

**Tech stack:** React 19, TypeScript 7, Tailwind 4, vitest, Biome; `code-schema` and the index
for the fixture.

**Spec:** [`2026-09-21-m3-first-steps-and-close-design.md`](../specs/2026-09-21-m3-first-steps-and-close-design.md)
(M3P6.1–M3P6.5).

## Global constraints

- The reference is the published canvas, board *L5 · Node at First steps*, in **light at 1440**.
- Nothing learner-shaped: no question counts, no review, no *Reviewed by*.
- Python: `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest`.
  Web (Node 24, in `apps/web`): `npm run lint && npm run typecheck && npm test && npm run build`.
- Take each check's own exit code; never read it through a pipe.

---

### Task 1: the fixture gains a video and a question

**Files:** `tests/fixtures/salmon/molecular-biology/dna-and-genes/node.yaml` and `body.md`;
`tests/schema/test_fixtures.py`; `apps/api/tests/test_nodes_api.py`.

- [ ] **Write the failing tests:** *DNA and genes* has one embedded video with
      `video: youtube:AmOO4j0E408`, and one choice question whose marker sits in the body.
- [ ] Add to `node.yaml` the resource (Khan Academy, `display: embed`, level `foundations`,
      part `0:00–13:01`) and the `try` question *In DNA, which base pairs with A?* with
      options T (right), C, G, A; a hint that does not give the answer; and the rationale from
      the body's own sentence.
- [ ] Put `{% try base-pairing %}` after the first paragraph of `body.md`.
- [ ] `uv run code-schema validate tests/fixtures/salmon`, then the Python checks. Commit.

### Task 2: the First steps form

**Files:** create `apps/web/src/node/FirstSteps.tsx` and `FirstSteps.test.tsx`;
create `apps/web/src/node/firststeps.fixture.ts` (the API's real answer for *DNA and genes*);
modify `TryQuestion.tsx` (a `big` prop) and `NodePage.tsx` (choose the form).

**Interfaces:**
- `FirstSteps({ node, goals, known, next }: { …; next: SideCardOut | undefined })`
- `TryQuestion({ question, number, big? })`

- [ ] **Write the failing tests** (M3P6.5's table), against the captured fixture.
- [ ] Implement the form to the board's measures: 820 px column, 48 px title, 21 px lead,
      20 px body, 30 px numbered sections, the watch row, the large question, the
      *Next on your route* card and the *Where this comes from* footer.
- [ ] `NodePage` picks the form by level and passes the next stop from the route.
- [ ] The web checks, then the stack rebuilt and the page seen beside the board in **light**.
      Commit.

### Task 3: M3's close

**Files:** `ops/stack-check.sh`; `docs/notes/journal/2026-09-21-m3-part-6-first-steps.md`;
`docs/notes/journal/README.md`; `CLAUDE.md`.

- [ ] The stack check fetches `/api/nodes/de-bruijn-graphs` through the web container and fails
      unless `video` is set.
- [ ] Run the audit over every node at four widths, light and dark.
- [ ] Check R4's M3 *done when* line by line against the stack, and write the journal entry
      with that table; update the README box and `CLAUDE.md` (M3 done).
- [ ] Commit, push, open the pull request with the attribution line, and wait for the checks
      with their own exit code.
