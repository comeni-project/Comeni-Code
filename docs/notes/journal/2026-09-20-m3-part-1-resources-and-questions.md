# 2026-09-20 — M3 part 1: resources and try questions

**A node can now point outward and ask.** `node.yaml` carries `resources:` — checked against a
`providers.yaml` registry that decides which licences a provider may hold and whether it may be
embedded — and `try:` questions with hints and a rationale, placed in the prose by
`{% try <id> %}` markers. Both go through the index to `GET /api/nodes/{node_id}`. Part 1 of M3's
six ([parts list](2026-09-20-m3-in-parts.md)); the
[spec](../../superpowers/specs/2026-09-20-m3-resources-and-questions-design.md) and the
[plan](../../superpowers/plans/2026-09-20-m3-resources-and-questions.md) are in the same pull
request.

The operator decided the four questions and approved the design section by section; one agent
built it, test first.

---

## Where things stand

| Claim | Check |
|---|---|
| The fixtures carry an embedded and two linked resources, and two questions | `uv run pytest tests/schema/test_fixtures.py -k "resource or question"` |
| An unknown provider, a licence the provider does not list and a refused embed are each one problem | `uv run pytest tests/schema/test_resources.py -k "provider or licence or embed"` |
| `providers.yaml` is needed only when a resource cites a provider | `uv run pytest tests/schema/test_content.py -k registry` |
| A hint may not contain the answer, and *5-mers* is not the answer 5 | `uv run pytest tests/schema/test_questions.py -k hint` |
| Every marker names a question, and every question has one marker | `uv run pytest tests/schema/test_node.py -k marker` |
| A node that teaches still round-trips byte for byte | `uv run pytest tests/schema/test_writer.py -k teaches` |
| The index stores all three, and a rebuild replaces them | `uv run pytest apps/api/tests/test_content_index.py -k "stores or replaces"` |
| `providers.yaml` is part of the digest | `uv run pytest apps/api/tests/test_content_index.py -k digest` |
| The endpoint returns both lists in the author's order, in five queries | `uv run pytest apps/api/tests/test_nodes_api.py -k "resources or question or queries"` |
| The stack serves them | `docker compose up -d --wait --build`, `uv run python apps/api/manage.py rebuild_index --root tests/fixtures/salmon`, then `curl "http://127.0.0.1:8090/api/nodes/de-bruijn-graphs"` |
| The whole command set passes (465 tests) | `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest` |

## What changed this session

| Commit | What is now true |
|---|---|
| `c052408`, `a3c1d7b` | the spec and the plan |
| `762a480` | `providers.yaml` is read, and its absence is not a problem by itself |
| `9d10ea0` | `resources:` parses, with the registry deciding licence and embed |
| `408182f` | `try:` parses, with hints, a rationale and the answer-in-a-hint check |
| `751d84d` | `find_markers` reads `{% try %}` and reports every other marker |
| `525c407` | a node carries both, the marker rules run, and the writer writes them back |
| `85cb93f` | `read_content` reads the registry once and hands it to every node |
| `d904ca4` | the fixtures teach: three resources and two questions on *de Bruijn graphs* |
| `63b611d` | `Provider`, `Resource` and `Question` tables, filled by `rebuild_index` |
| `0a6d96b` | the node endpoint returns both, `openapi.json` and `schema.ts` regenerated |

Plus CLAUDE.md's status and layout, and this entry.

**Each pin was seen failing:** the registry rules skipped when there is no registry, a marker with
no question, a question with no marker, the digest without `providers.yaml`, and the endpoint's
query count.

## Decisions made, and why

1. **`node.yaml` holds them; `body.md` says where** (M3P1.2, M3P1.3). Resources and questions are
   lists in the structured file, parsed by the machinery links already use, and a `{% try id %}`
   line in the prose puts the question where the author wants it. *Rejected:* fenced blocks inside
   `body.md` (the body stays Markdown in M3, and a problem's line would come from inside a prose
   file); separate `resources.yaml` and `try.yaml` files (four files per node, two usually absent).
2. **Providers are a content registry, not a constant here** (M3P1.2). `providers.yaml` lists each
   provider with the licences it may carry and whether it may be embedded, so adding a publisher
   is a content pull request rather than a release of `code-schema`. **It is read only when a
   resource cites a provider**, which is what keeps `comeni-code-content` green today.
3. **Choice and number questions; a figure question is refused by name** (M3P1.3). Both can be
   checked without running anything, and both are what review (T7) will store answers for.
   `kind` is written rather than inferred, so *the number question X has no answer* is the message
   instead of *this has neither options nor an answer*. *Rejected:* short text (string matching is
   where question quality quietly dies); choice only (it would rewrite a question the board drew).
4. **A hint may not contain the answer** (T6.2), checked as the right option's text for a choice
   and as a standalone number for a number — so a hint may say *5-mers* while the answer is 5, but
   not *= 96*. Near-miss matching was rejected: a false positive blocks a correct node with no way
   around it.
5. **Three index tables, not JSON on `Node`** (M3P1.4). The index is tables derived from files, and
   the Quality page (S11) will one day query every resource to check its link.
6. **The try answer goes to the browser** (M3P1.4). It is formative, and the page shows the
   rationale after either answer. Written down because **exam questions (T7.1) are scored and
   theirs must not**; a comment on `QuestionOut` says so.
7. **Three of T4.1's fields stay out for now**: `reviewed_by` (nothing can set it until M4),
   whether a `url` resolves (the validator makes no network calls; S11's scheduled check does),
   and per-question minutes (a node's `minutes` already covers the page, and M2's route totals are
   pinned to it).

**Where the build departed from the plan:**

- `Level` had to move to its own module (`code_schema.levels`) so resources and questions can name
  a level without importing nodes. `node.py` re-exports it, which is where every earlier part
  imports it from, and mypy needed the explicit `as Level` form to allow that.
- The plan's expected line for an unknown provider was 8; the provider key is on line 9.
- The fixtures' questions are written against the body the fixture already had — 4-mers of an
  8-letter transcript, answer 5 — not the board's 100-base read. A question has to be true of the
  page it sits on.

## What is next

1. **M3 part 2, finding a target without AI**: search over ids, titles and claims, ranked, which
   the Start page in part 3 calls.
2. **`providers.yaml` in `comeni-code-content`** — a change to that repository, and therefore the
   operator's call. Nothing there cites a provider yet, so nothing is broken until a node does.
3. **The master's-class seeds**, when the operator sends them.

## Open questions

- **How an embedded video's player URL is derived.** The fixture cites a Khan Academy page with a
  part of `2:10–7:45`; the page (part 5) decides whether that needs a provider embed endpoint or a
  field of its own.
- **Whether a resource's level distance from the node's should be flagged** (T4.1). It needs a
  severity `code-schema` does not have, so it belongs with M4's review queue.
- **Whether `try` answers become evidence** (T7) or stay a page interaction. Part 5 decides.
- **Whether `IndexBuild` rows need pruning** (carried from M1 part 5).

## Traps

- **`providers.yaml` missing is not a problem until a resource cites a provider.** A test pins
  both halves; do not "fix" it into a required file.
- **A question that did not parse has its marker check skipped**, so one mistake is one problem.
- **The answer comes back as a float** (`5.0`): the column is a `FloatField` because a number
  question may be fractional. The page formats it.
- **`{% figure %}`, `{% math %}` and `{% claim %}` are refused by name.** They arrive with W5.1 and
  M6; until then they are not silently rendered.
- **The endpoint now costs five queries**, not three, and its test says so.
- **`openapi.json` and `schema.ts` are committed.** Any change to the endpoint regenerates both.
- **The API image has no `tests/`**, so a stack check rebuilds the index from the host against
  Compose's Postgres, not from inside the container.
