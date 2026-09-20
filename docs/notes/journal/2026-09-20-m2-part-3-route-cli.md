# 2026-09-20 — M2 part 3: the route command

**`code-weaver route salmon --root tests/fixtures/salmon` prints the route, one line per stop.**
Part 3 of M2's four ([parts list](2026-09-19-m2-in-parts.md)); the
[spec](../../superpowers/specs/2026-09-20-m2-route-cli-design.md) and the
[plan](../../superpowers/plans/2026-09-20-m2-route-cli.md) are in the same pull request.

```
Route to Salmon — 17 stops · about 3 h 4 min · First steps → Intermediate

 1. DNA and genes               first-steps    10m  → Gene expression: Expression is a gene being r…
 2. Gene expression             first-steps    10m  → Splicing: Splicing happens to the RNA a gene …
```

The operator decided the three questions and approved the design section by section; one agent
built it, test first.

---

## Where things stand

| Claim | Check |
|---|---|
| The header, 17 numbered stops, and the first and last lines pinned | `uv run pytest tests/weaver/test_cli.py -k per_stop` |
| Every line is at most 100 characters, whatever the terminal | `uv run pytest tests/weaver/test_cli.py -k fixed_width` |
| `--known read-mapping` gives 14 stops and `· 1 known` | `uv run pytest tests/weaver/test_cli.py -k known` |
| A missing folder and an unknown goal exit 2; content problems and a refused graph exit 1 | `uv run pytest tests/weaver/test_cli.py -k "exits_2 or validator or refused"` |
| A long title and a long reason are cut with `…` | `uv run pytest tests/weaver/test_cli.py -k cut` |
| By hand | `uv run code-weaver route salmon --root tests/fixtures/salmon`, then `--known read-mapping` |
| The whole command set passes (345 tests) | `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest` |

**Each pin was seen failing:** the stop line printed without cutting, `--known` not passed to
`weave`, an unknown goal exiting 1, and the content's problems re-listed instead of counted.

## What changed this session

| Commit | What is now true |
|---|---|
| `1dd04a6`, `fb4d2eb` | the spec and the plan |
| `f397099` | `code_weaver/cli.py`, the `code-weaver` script, the widened allowlist |

Plus CLAUDE.md's status, commands and layout, and this entry.

## Decisions made, and why

1. **One line per stop** (M2P3.2): number, title, level, minutes, then the first stop that needs
   it with its stored reason. *Rejected:* every reason indented under each stop (about 40 lines for
   Salmon, and the node page already lists them all); ids only (says nothing about why a stop is
   there).
2. **A fixed width of 100, never the terminal's** (M2P3.2). The same route must print the same
   bytes everywhere, which is what part 1's determinism claims.
3. **Exit codes stay 0, 1 and 2** (M2P3.4), as `code-schema validate` and `rebuild_index` use
   them; `argparse` already exits 2 for a bad flag. *Rejected:* a code per failure — nothing needs
   to branch on which one, since part 4's API calls `weave` directly, and each new code is another
   thing to keep in step across three commands.
4. **`--known` now** (M2P3.2), because `weave` already takes it and nothing else exercises it
   until learners have records.

**Found while planning:** a cycle in a content folder is reported by `read_content` first, so the
command exits 1 on content problems and never reaches `GraphError`. That branch is defensive; its
test builds the refusal directly rather than a cyclic folder.

**Where the build departed from the plan:** the plan's pinned column spacing was a guess and was
one space out in two columns; the real output replaced it, which the plan allows for spacing only.
Ruff also wanted the imports in one first-party block, and the pinned 100-character line needs
`# noqa: E501` because the quotes push the source line past 100.

## What is next

1. **M2 part 4: the API**, which weaves from the index rather than from files, and regenerates
   `openapi.json` and `schema.ts`. It closes M2.
2. Then M3, the thin learner path, which is where routes first reach a screen.

## Open questions

- **Whether the API takes a known set** in part 4, or waits for learner records.
- **Whether the command ever needs `--format json`.** Nothing consumes one; part 4 serves
  machines.

## Traps

- **The pinned lines break when a fixture's title, minutes or first reason changes.** That is the
  point: the output is the contract. Print the command and compare before editing a test.
- **`cli.py` is the only module in the package that imports `code-schema` or touches files.**
  Keeping `graph.py` and `weave.py` import-free is what the purity guard checks.
- **The allowlist now names `code_schema.content` and `code_schema.node`,** not the whole package:
  a new `code_schema` module in the CLI fails the static guard until it is listed.
- **`--known` counts only ids that are in the content**, so `· N known` can be smaller than the
  number of flags given.
