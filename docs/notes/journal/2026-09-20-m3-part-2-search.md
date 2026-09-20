# 2026-09-20 — M3 part 2: finding a target without AI

**Typed words become ranked candidate goals, with no model anywhere.** `code_weaver.find` is
W3.3's step 1 without the model — the search fallback R4 already promises M5 will fall back to —
and it answers through `code-weaver find` from files and `GET /api/search` from the index. Part 2
of M3's six ([parts list](2026-09-20-m3-in-parts.md)); the
[spec](../../superpowers/specs/2026-09-20-m3-search-design.md) and the
[plan](../../superpowers/plans/2026-09-20-m3-search.md) are in the same pull request.

The operator decided the four questions and approved the design section by section; one agent
built it, test first.

---

## Where things stand

| Claim | Check |
|---|---|
| "why my reads don't map" finds *Mapping reads to a reference* first | `uv run code-weaver find "why my reads don't map" --root tests/fixtures/salmon` |
| A word that matched nothing comes back by name | `uv run code-weaver find "salmon nanopore" --root tests/fixtures/salmon` |
| *k* finds *k-mers* and not *kallisto*; *reads* finds nodes whose word is *read* | `uv run pytest tests/weaver/test_find.py -k "single_letter or plural"` |
| The order does not depend on the hash seed | `uv run pytest tests/weaver/test_find.py -k hash_seed` |
| Nothing found exits 0; a missing folder exits 2; broken content exits 1 | `uv run pytest tests/weaver/test_cli.py -k "nothing or folder or broken"` |
| The endpoint ranks what the command ranks | `uv run pytest apps/api/tests/test_search_api.py -k agree` |
| One query; 422 on a blank `q` or a bad limit; 503 on an empty index | `uv run pytest apps/api/tests/test_search_api.py -k "query or 422 or 503"` |
| The stack answers | `docker compose up -d --wait --build`, `ops/stack-check.sh`, then `curl "http://127.0.0.1:8090/api/search?q=salmon"` |
| The whole command set passes (506 tests) | `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest` |

## What changed this session

| Commit | What is now true |
|---|---|
| `86005e9` | the spec and the plan |
| `9a6b51b` | `code_weaver.find` ranks targets, and `re` joins the weaver's allowlist |
| `5d6f06f` | `code-weaver find "<words>" --root <folder>` prints the candidates |
| `4bcba8f` | `GET /api/search?q=&limit=`, `openapi.json` and `schema.ts` |

Plus CLAUDE.md's status, commands and layout, and this entry.

**Each pin was seen failing:** the apostrophe that left a stray *t* among the words, the
one-letter rule, the tie broken by title, the endpoint's query count, and the blank query.

## Decisions made, and why

1. **The matching is pure, and lives beside the weave** (M3P2.1). `find` is step 1 of the same
   pipeline, it is testable without a database, and it answers from files and from the index
   alike. *Rejected:* Postgres full-text or trigram search (it can only answer from the index,
   every test would need the database, and a phase about screens would gain a migration and an
   index to maintain); a helper inside `code_api.content` (outside the purity guard, unreachable
   from a command).
2. **`find` takes its own `Target`, not the weave's `Topic`** (M3P2.1). A topic carries no prose
   on purpose. The function returns ids, and the caller builds the cards — the rule `Route`
   already follows.
3. **Words, prefix-matched, with a trimmed plural** (M3P2.2), so the board's own example works:
   *map* finds *Mapping* and *reads* finds *read*. A one-letter word must match exactly, or *k*
   hits half the graph. *Rejected:* whole words with an edit distance of one (*map* and *mapping*
   are three edits apart); the typed text as one substring (nothing at all for the board's
   example).
4. **Order by words matched, then score, then title, then id** (M3P2.2). Covering the question
   beats landing loudly in one field, and the last two keys make repeats byte-identical.
5. **A word that matched nothing is returned by name.** It is what lets the Start page say
   *nothing here is about "nanopore"* instead of going blank — and it is the seed of M7's
   request path.
6. **Nothing found is exit 0 and HTTP 200 with an empty list** (M3P2.3, M3P2.4). An unanswered
   question is not a broken content folder, and the index did answer.
7. **`re` joins `code-weaver`'s allowlist; `unicodedata` does not.** That is the one reviewed
   import this part adds, and the reason accents are not folded. The content is English; when
   that stops being true, the allowlist change is reviewed on its own.

**Where the build departed from the plan:**

- **`don't` broke the stop list.** Splitting on non-alphanumerics gave *don* (stopped) and a
  stray *t* (not), which then matched nothing and reported itself. Apostrophes are now removed
  before the split, and the stop list carries the contractions — *dont*, *cant*, *isnt* and the
  rest. The spec was updated with the real list.
- **The command's pinned output was guessed too small.** Against the real 26 fixtures, "why my
  reads don't map" matches ten topics, not two: many claims mention a read. The ranking was
  right — the two titles holding both words lead — so the test now pins the ranking and the real
  count. Pinning output before seeing it is M2 part 3's trap, twice now.
- `limit` needed `Annotated[int, Query(ge=1, le=50)]`; a bare `Query(...)` default fails mypy's
  `type-arg` check, exactly as in M2 part 4.

## What is next

1. **M3 part 3, the spine and L1 Start**: a router, the top bar with search, fetching against the
   generated types, and the Start page calling this endpoint.
2. **`providers.yaml` in `comeni-code-content`** — still waiting on the operator; nothing there
   cites a provider yet.
3. **The master's-class seeds**, when the operator sends them.

## Open questions

- **Whether the Start page needs a *learn this as a goal* row** when nothing matches, or whether
  that waits for M7's requests. Part 3 decides.
- **Whether search should ever reach bodies.** It does not today: a goal is a topic, and a body
  full of matches answers a different question.
- **How the ranking behaves on hundreds of nodes.** It is linear over the index per request, the
  same bargain the weave makes (M2P4.3), and the same note applies.

## Traps

- **Accents are not folded.** Deliberate: `unicodedata` is not in the allowlist.
- **A one-letter word matches exactly, not as a prefix.** Changing that makes *k* useless.
- **The stop list is applied after apostrophes are removed**, so a contraction is one word.
  Adding *don't* rather than *dont* to the list would do nothing.
- **If every word is a stop word, none are dropped** — "how to" gets our best answer, not silence.
- **The endpoint's 503 check runs only when nothing was found**, so a hit costs one query.
- **`openapi.json` and `schema.ts` are committed.** Any change to the endpoint regenerates both.
