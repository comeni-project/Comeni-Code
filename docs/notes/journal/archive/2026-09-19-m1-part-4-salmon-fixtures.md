# 2026-09-19 — M1 part 4: the Salmon fixtures

**`tests/fixtures/salmon/` holds 26 real nodes: a route from no background to *Salmon*, and the
nodes attached below and beside it. The validator accepts them, and tests pin the route's shape.**
Part 4 of M1's six ([parts list](2026-09-18-m1-in-parts.md)); the
[spec](../../superpowers/specs/2026-09-19-m1-salmon-fixtures-design.md) and the
[plan](../../superpowers/plans/2026-09-19-m1-salmon-fixtures.md) are in the same pull request.

The operator set the goal (*"make a path that someone with 0 knowledge understands how Salmon
mostly works, then add the go deeper nodes attached"*) and read every node in the plan before it
was built. One agent built it, test first.

---

## Where things stand

| Claim | Check |
|---|---|
| The validator accepts the fixtures | `uv run code-schema validate tests/fixtures/salmon` → `26 nodes, no problems` |
| The route is exactly 17 nodes, starting only at first-steps, never needing a harder node | `uv run pytest tests/schema/test_fixtures.py -k "route or harder"` |
| Each attached node hangs off by exactly the links the spec gives it; *kallisto* and *Salmon* are peers | `uv run pytest tests/schema/test_fixtures.py -k "attached or peers"` |
| Every `node.yaml` is in the writer's canonical form | `uv run pytest tests/schema/test_fixtures.py -k canonical` |
| W1 no longer puts *de Bruijn graphs* on the route to *Salmon* | `grep -n "Revised 2026-09-19" docs/superpowers/specs/2026-09-16-comeni-code-weaving-and-pages-design.md` |
| The whole command set passes (266 tests) | `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest` |

**M1P4.1's done-when:** the command and a test through `main` both give `26 nodes, no problems`;
the four shape tests pass; W1 carries the dated note. All three hold.

## What changed this session

| Commit | What is now true |
|---|---|
| `a61f42a` | the spec |
| `e02e28f` | the plan, with every node written out in full |
| `01c11f5` | `test_fixtures.py` and the region registry, failing |
| `3691918` | the 17 route nodes: 4 tests pass, the missing targets are the only problems |
| `9e58898` | the 9 attached nodes: all 8 pass |

Plus the W1 note, CLAUDE.md's status and layout, and this entry.

## Decisions made, and why

- ***de Bruijn graphs* is below *Salmon*, not on its route.** The need rule says a need is what
  understanding the claim requires; the pufferfish index is how Salmon finds candidates fast, not
  what Salmon claims. The operator agreed after asking what the index is. Rejected: writing the
  index into Salmon's claim so it becomes a need, which makes the claim about implementation.
- **Part 4 grew from the parts list's 8–12 nodes to 26.** *No background* is what makes the route
  long: it has to start at DNA and at probability. The operator chose to build all 26 now rather
  than the route first. The parts list is not edited (the journal is append-only); this is the
  record.
- **Three of the research note's route nodes were left out** by the need rule: *Transcription*
  (inside *Gene expression*), *Dynamic programming* (how an alignment is computed; now a *goes
  deeper*), *Ratios and normalisation* (school mathematics).
- **No *helps* or *any-of* was needed.** The whole route is plain needs, the first evidence that
  those optional paths can stay unwired.
- **Bodies are short and true, not finished pages.** The block vocabulary is not decided; a long
  body now would be rewritten then.
- **This is a small test, not the first seed.** The operator will supply the contents of the
  classes of their bioinformatics master's, and the first large graphs are built from those.

**Where the build departed from the plan:** nowhere. The two Oxford Academic DOIs
(`10.1093/bib/bbq015`, `10.1093/bioinformatics/bty292`) answer a script with 403; `doi.org`
redirects them correctly and Crossref confirms the titles and authors, so they stay.

## What is next

1. **Part 5: the index and the loader** — Django models filled by `read_content`, from these
   fixtures; a rebuild gives the same index twice.
2. **Part 6: `rebuild_index` and the read API.**
3. **Ask the operator** whether these nodes should also go into `comeni-code-content` as its first
   real content (a separate pull request there).

## Open questions

- **Whether `sequencing` and `sequence-analysis` stay two regions** once the master's classes are
  seeded.
- **How a body's resources become structured** (T4), with the block vocabulary.

## Traps

- **The fixtures are the graph parts 5 and 6 test against.** Changing a link changes their
  expected results; the shape tests here say what the graph is supposed to be.
- **`test_each_attached_node_hangs_off_by_its_links` lists every incoming link.** A new link to an
  attached node — even a correct one — fails it until `ATTACHED` is updated. That is deliberate.
- **External links are not checked in CI** (no network). They were opened by hand once.
