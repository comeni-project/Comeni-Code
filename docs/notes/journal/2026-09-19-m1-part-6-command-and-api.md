# 2026-09-19 — M1 part 6: the rebuild command and the read API, and M1 done

**`manage.py rebuild_index` fills the index from a folder and exits 0, 1 or 2; `GET
/api/nodes/{node_id}` serves a node with its needs, goes-deeper, related and derived needed-by.
With it, M1 is done.** Part 6 of M1's six ([parts list](2026-09-18-m1-in-parts.md)); the
[spec](../../superpowers/specs/2026-09-19-m1-rebuild-command-and-read-api-design.md) and the
[plan](../../superpowers/plans/2026-09-19-m1-rebuild-command-and-read-api.md) are in the same pull
request.

The operator decided the four questions and approved the design section by section; one agent built
it, test first.

---

## Where things stand

| Claim | Check |
|---|---|
| The command rebuilds from files alone, and gives what `rebuild_index` gives | `uv run pytest apps/api/tests/test_rebuild_command.py -k files_alone` |
| `--root` wins over `CODE_CONTENT_ROOT`; `--commit` is kept | `uv run pytest apps/api/tests/test_rebuild_command.py -k "setting or commit"` |
| A refusal exits 1 with the validator's messages; no folder, a missing path or a file exits 2; neither changes the index | `uv run pytest apps/api/tests/test_rebuild_command.py -k "refusal or exits_2"` |
| A node comes with its three kinds of link, in the author's order, and derived needed-by | `uv run pytest apps/api/tests/test_nodes_api.py -k "three_kinds or needed_by or first_steps"` |
| A miss is 404; no applied build is 503 | `uv run pytest apps/api/tests/test_nodes_api.py -k "404 or 503 or refused"` |
| Three queries per node | `uv run pytest apps/api/tests/test_nodes_api.py -k queries` |
| By hand | `uv run python apps/api/manage.py rebuild_index --root tests/fixtures/salmon` → `Applied: 26 nodes, digest 49e434a42d33`, then `/api/docs` |
| The whole command set passes (296 tests) | `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest` |

**M1P6.1's done-when:** the command test above, the endpoint tests, and CI on the pull request.

**M1 is done.** R4's *done when*, as the parts list states it:

| Done when | Check |
|---|---|
| the validator accepts the fixtures | `uv run code-schema validate tests/fixtures/salmon` → `26 nodes, no problems` |
| it rejects a broken node with a message naming the file and the field | `uv run pytest tests/schema/test_fields.py tests/schema/test_cli.py` |
| the index rebuilds from the files alone | `uv run pytest apps/api/tests/test_rebuild_command.py -k files_alone` |

**Each pin was seen failing:** the folder check removed (a traceback instead of exit 2), links in
reverse order, needed-by sorted with case, and targets fetched one query per link.

## What changed this session

| Commit | What is now true |
|---|---|
| `803303d`, `79843ff` | the spec, and a correction: `read_content` raises on a missing folder, it does not read it as empty |
| `4edb793` | the plan; the spec sorts needed-by ignoring case |
| `7b02f30` | `CODE_CONTENT_ROOT`, `manage.py rebuild_index` |
| `85a0448` | `GET /api/nodes/{node_id}`; `openapi.json` and `schema.ts` regenerated |

Plus CLAUDE.md's status, commands and layout, and this entry.

## Decisions made, and why

The operator's four answers, each with its rejected alternatives in the spec:

1. **`--root`, else `CODE_CONTENT_ROOT`, no default** (M1P6.2). Only the command needs content;
   a default would quietly index the wrong folder.
2. **Neighbours are cards** — `id`, `title`, `level`, `reason` (M1P6.3). One request fills a node
   page's side panel. *Needed by* carries the needing node's reason.
3. **One endpoint** (M1P6.4). Lists, regions and build information wait for what uses them.
4. **404, or 503 while nothing was ever applied** (M1P6.4). The check runs only on a miss.

**Found while planning:** Postgres's collation puts *kallisto* before *Salmon* and Python's default
sort puts it after, so needed-by is sorted in Python, by title ignoring case, then id.

**A refusal is `SystemExit(1)`, not `CommandError`**, so stderr is the header and the problems with
no `CommandError:` line after them. Exit 2 is `CommandError`.

**Where the build departed from the plan:**

- pytest-django exports `Settings`, not `SettingsWrapper`; the plan is corrected.
- The plan's Salmon test expected no needed-by. Three attached nodes (*Decoy sequences*,
  *Salmon's bias models*, *Uncertainty in abundance*) need Salmon; the expected cards are now
  derived from the files, and the three ids pinned.
- The local database lacked part 5's migration; `migrate` before running the command by hand.

## What is next

1. **M2, the weaver**: split into parts in a new journal entry (R5), for the operator's approval.
   It reads this index.
2. **The master's seeds**, when the operator sends each class's content; the fixtures go into
   `comeni-code-content` then, in block format.

## Open questions

- **Whether `IndexBuild` rows need pruning** (carried from part 5). Decide when the worker exists.
- **Whether a node list comes with the web pages or with search** — whichever is built first.

## Traps

- **An unexpected crash also exits 1**, as Python does. A refusal is told apart by `Refused:` on
  stderr and a refused `IndexBuild` row; a script that must tell them apart reads either.
- **A new link to a fixture node changes its needed-by**, and the Salmon test derives it from the
  files, so it follows; the pinned ids do not.
- **`openapi.json` and `schema.ts` are committed.** Any change to the endpoint regenerates both, or
  a Python test and a web test fail.
- **Tests need Compose's Postgres**, and the command by hand needs a migrated database.
