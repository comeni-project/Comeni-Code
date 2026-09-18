# 2026-09-18 — M1 part 3: graph rules and the validate command

**`code-schema validate <content root>` reads a whole content folder and reports every problem —
in each node, and between nodes — on the line at fault.** Part 3 of M1's six
([parts list](2026-09-18-m1-in-parts.md)); the
[spec](../../superpowers/specs/2026-09-18-m1-graph-rules-and-validate-design.md) and the
[plan](../../superpowers/plans/2026-09-18-m1-graph-rules-and-validate.md) landed first, in #47.

The operator decided the design section by section; an agent built it from the plan, one agent,
test first.

---

## Where things stand

| Claim | Check |
|---|---|
| `read_content` finds nodes at any depth, skips hidden folders, catches near misses | `uv run pytest tests/schema/test_content.py` |
| Targets exist, *related* is on both nodes, *goes deeper* never points down | `uv run pytest tests/schema/test_graph.py -k "target or related or goes_deeper"` |
| One message per tangle of cycles, with a whole ring; no recursion limit | `uv run pytest tests/schema/test_graph.py -k "cycle or tangle or strongly or ring"` |
| The command: summary, exit codes 0/1/2, escaped GitHub annotations | `uv run pytest tests/schema/test_cli.py` |
| The console script runs, through the workspace and through `uvx` | `uv run code-schema validate <folder>` |
| The allowlist gained exactly `argparse` and `sys` | `grep -n -A14 '"code-schema"' tests/guards/purity.py` |
| The whole command set passes (227 tests) | `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest` |
| **The content repository does not run it yet** | Task 6 of the plan, waiting for the operator's go-ahead |

**M1P3.1's done-when, item by item:**

| Done when | Proved by |
|---|---|
| every graph rule fails with its exact message and line | `test_graph.py`, one test per row of M1P3.4 |
| a tangle gives one message with the full ring | `test_a_tangle_says_how_many_more_nodes_are_caught`, `test_a_needs_cycle_is_one_message_with_the_whole_ring` |
| the near misses are caught | `test_a_near_miss_of_node_yaml_is_caught`, `test_a_body_without_node_yaml_is_caught`, `test_the_content_root_is_not_a_node` |
| exit 0 / 1 / 2 with the summary | `test_clean_content_exits_0_with_a_summary`, `test_problems_exit_1_are_printed_and_counted`, `test_a_missing_root_exits_2` |
| `--format github` escaped, tested | `test_github_lines_are_escaped` and the two property tests |
| `uvx` from git works against a scratch folder | after this pull request merges, with its SHA — recorded below |
| the content repository runs it | **not yet** — the operator is asked first |

## What changed this session

| Commit | What is now true |
|---|---|
| `46fb524` (#47) | the spec and the plan |
| `3587af5` | `read_content`: discovery, near misses, unique ids; `locate_links` |
| `305c538` | targets, symmetry, levels |
| `9a40437` | cycles: iterative Tarjan, one shortest ring per tangle |
| `de9f3ac` | the command, the summary, GitHub annotations, the console script |

Plus this entry, `Content` and `read_content` in the public API, and CLAUDE.md's status and
command list.

## Decisions made, and why

The design decisions are in the spec with their rejected alternatives. The one that shapes the
future most: **the content repository pins a Comeni-Code commit** and moves it by a deliberate pull
request, so the same content pull request always meets the same validator. Following `main` was
rejected because a rule tightened here would fail content that changed nothing.

**Where the build departed from the plan** — none touches a message:

- **The test helpers live in `tests/schema/content_helpers.py` from the start**, imported as
  `schema.content_helpers` (`tests/` is on the path). The plan had them move in Task 2 and imported
  as `content_helpers`, which would not have resolved.
- **Five tests the plan did not have:** `README.md` at the root is not a near miss; the missing half
  of a *related* link names a nested folder's path; *goes deeper* to a higher level passes; a node
  named like another's prefix (`salmon`, `salmon-index`) is not counted twice in the summary; a
  file problem without a line has no `line=` in its annotation.
- **`strongly_connected` has a small `visit` helper** for the three lines the plan repeated.

**The ten failing tests on the first full run were not this change:** Postgres and Redis were not
running locally. `docker compose up -d --wait postgres redis` and the suite passed.

## What is next

1. **Prove the git route** with this pull request's merged SHA, then **ask the operator** before
   the content repository pull request (M1P3.6): `regions.yaml` and the pinned step.
2. **Part 4: the Salmon fixtures** — 8–12 real nodes in `tests/fixtures/`, which the validator
   must accept, and the first evidence of whether *helps* or *any-of* is needed.

## Open questions

- **Bumping the pin is manual.** Dependabot does not follow a SHA in a `run:` line. When landing
  exists (M4), a check that the pin is not far behind `main` may be worth adding.
- **Whether `regions.yaml`'s first list is right** — part 4's fixtures will say.

## Traps

- **`read_content` is the index's reader too (part 5).** A rule added to the validator is a rule the
  index enforces; that is the point, and also why rules are added by spec.
- **The DB tests need Compose's Postgres and Redis.** After a restart, start them before trusting a
  red full run.
- **`--format github` is never inferred.** Locally the command prints plain lines; the content
  workflow passes the flag.
