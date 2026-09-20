# M2 part 3 — the route command

**Status: agreed 2026-09-20.** This is part 3 of phase M2's four (architecture spec R4). The parts
list is in [`2026-09-19-m2-in-parts.md`](../../notes/journal/2026-09-19-m2-in-parts.md). It gives
parts [1](2026-09-19-m2-walk-back-and-order-design.md) and
[2](2026-09-19-m2-why-known-and-span-design.md)'s weave a command line, and decides:

- what `code-weaver route` prints;
- how it exits when something is wrong;
- that it takes a known set.

The operator made every decision here on 2026-09-20, question by question; an agent proposed them.

---

## M2P3.1 What this part does

```
files ──read_content──► Content ──Graph(...)──► weave(goals, known) ──► one line per stop
```

**Done when:**

- `uv run code-weaver route salmon --root tests/fixtures/salmon` prints the 17 stops with the
  header line of M2P3.2 and exits 0;
- `--known read-mapping` prints 14 stops and `· 1 known`;
- each failure in M2P3.4 gives its message and code;
- every test in M2P3.5 passes, and CI is green.

**Out of scope:** the API (part 4); goal resolution by a model (M5); connecting text (W3.4); a
`--format json` output — nothing consumes one yet, and part 4 serves machines.

## M2P3.2 The command and its output

```
code-weaver route <goal>… --root <folder> [--known <id>]…
```

- **Goals** are node ids, one or more. **`--root`** is required and has no default (as
  M1P6.2 decided for `rebuild_index`: a default would quietly weave the wrong folder).
  **`--known`** is repeatable and may name topics the learner already holds.
- The entry point is `code-weaver = "code_weaver.cli:run"`, as `code-schema` declares its own.

**The output is one line per stop, at a fixed width of 100 characters.** The width is not read
from the terminal: the same weave must print the same bytes everywhere, which is what part 1's
determinism tests claim.

```
Route to Salmon — 17 stops · about 3 h 4 min · First steps → Intermediate

 1. DNA and genes            first-steps  10m  → Gene expression: Expression is a gene being…
 2. Gene expression          first-steps  10m  → Splicing: Splicing happens to the RNA a gen…
```

- **The header** names the goals by title, in route order, then the number of stops, the sum of
  their minutes and the span, each level shown as its name (*First steps*, not `first-steps`).
  With `--known`, it ends `· N known`, counting only known ids that are in the content.
- **Each stop line**: its number, the title, the level, the minutes, then **the first stop that
  needs it** and that stop's stored reason (M2P2.2). The rest of the reasons are on the node page,
  which lists them all (M1P6.3).
- **A goal prints no `→` part** unless another goal needs it.
- Titles and reasons are cut with `…` so every line is at most 100 characters.
- Time is `about 3 h 4 min`, or `about 45 min` below an hour.

**Rejected:**

| Alternative | Why not |
|---|---|
| Every reason under each stop, indented | about 40 lines for Salmon; the node page already holds the full list |
| Ids only, one per line | nothing says why a stop is there, which is the route's point |
| A width read from `COLUMNS` | the same route would print different bytes on different terminals |

## M2P3.3 Filling the graph

`code_weaver/cli.py` reads the folder with `code-schema`'s `read_content` and builds a `Graph`
from it: each node's id, region, level and *needs* with their reasons, the regions in
`regions.yaml`'s order, and the levels in `Level`'s order. Titles and minutes for printing come
from the same `Content`.

- **`code-weaver` gains a dependency on `code-schema`**, declared as a workspace source the way
  `apps/api` declares it. Part 1 planned this: only the CLI module imports `code-schema`; `graph`
  and `weave` still import nothing outside the standard library.
- The static purity guard's list for `code-weaver` gains `argparse`, `pathlib`, `sys` and
  `code_schema`. Both packages stay pure in the guard's sense: no web framework, HTTP client or
  model library.

## M2P3.4 How it fails

The three codes `code-schema validate` and `rebuild_index` already use: **0** nothing wrong,
**1** the content is wrong, **2** the command was used wrongly. `argparse` itself exits 2 for a
bad flag, so 2 is already the usage code.

| What happened | Printed on stderr | Exit |
|---|---|---|
| `--root` is not a folder | `code-weaver: no such folder: x` | 2 |
| `read_content` found problems | `code-weaver: 3 problems in the content; run code-schema validate x` | 1 |
| `Graph(...)` refused the content | `GraphError`'s lines, one per problem | 1 |
| A goal is not a node in the content | `code-weaver: not in the content: zzz` | 2 |

- **Content problems are not re-listed.** `code-schema validate` prints them with file, line and
  field; this command names it instead of copying it.
- **An unknown goal is a typo in the command**, like a missing folder, so it is 2. The check is
  `weave`'s `UnknownGoal` (M2P1.5), caught and printed.

**Rejected:** a code per failure (3 for an unknown goal, 4 for a refused graph). Nothing needs to
branch on which failure: the one caller that must, part 4's API, calls `weave` directly. Each new
code is another thing to keep in step across three commands.

## M2P3.5 What the tests prove

`tests/weaver/test_cli.py`, calling `main([...])` as `tests/schema/test_cli.py` does, against
`tests/fixtures/salmon/` and folders built in `tmp_path`.

| Test | Proves |
|---|---|
| *Salmon*: exit 0, the header line, 17 numbered lines, and the first and last pinned in full | the output, byte for byte |
| every line is at most 100 characters, whatever the terminal | the fixed width |
| `--known read-mapping`: 14 stops, `· 1 known`, and *k-mers* absent | `--known` reaches `weave` |
| a known id not in the content is not counted in `· N known` | the count means what it says |
| two goals: both named in the header, in route order | goals are a set (M2P1.4) |
| a missing folder, a file as the root: the message and 2 | usage errors |
| a content folder with a broken node: the count, the advice, and 1 | content problems |
| a content folder whose needs form a cycle: `GraphError`'s line and 1 | a refused graph |
| an unknown goal: `not in the content: zzz` and 2 | `UnknownGoal` is caught |
| a node with a 60-character title and a long reason: the line is cut with `…` and still 100 | cutting |

**Scaling** is the weave's (M2P1.7) plus reading the folder, which `code-schema` already does for
`validate`.
