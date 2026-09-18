# 2026-09-18 — M1 part 1: the node folder and its core fields

**`code-schema` reads a node folder, says exactly what is wrong with it, and writes it back as the
bytes it read.** It is the first code in the project that touches content. Part 1 of M1's six
([parts list](2026-09-18-m1-in-parts.md)); the
[spec](../../superpowers/specs/2026-09-18-m1-node-folder-and-core-fields-design.md) and the
[plan](../../superpowers/plans/2026-09-18-m1-node-folder-and-core-fields.md) landed first, in #43.

The operator decided the design section by section; an agent built it from the plan, one agent,
test first.

---

## Where things stand

| Claim | Check |
|---|---|
| A node folder reads into a `Node`, and every problem in it is reported in one run | `uv run pytest tests/schema/test_node.py -k one_run` |
| The three round-trip laws hold, a Windows-line-ending body included | `uv run pytest tests/schema/test_writer.py` |
| Each entry of a list reports its own line | `uv run pytest tests/schema/test_yaml_lines.py -k own_lines` |
| `code-schema` imports exactly `__future__`, `collections.abc`, `dataclasses`, `difflib`, `enum`, `pathlib`, `re`, `typing`, `yaml` | `grep -n -A12 '"code-schema"' tests/guards/purity.py` |
| The public API is ten names; parts 3–6 import from `code_schema`, not its modules | `uv run pytest tests/schema/test_public_api.py` |
| The whole command set passes | `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest` |
| **No links yet, no validate command, no fixtures** | parts 2, 3 and 4 |

**The done-when of M1P1.1, item by item:**

| Done when | Proved by |
|---|---|
| a node reads, writes back, and satisfies the three laws | `test_law_1_…`, `test_law_2_…`, `test_law_3_…` |
| every field rule fails with its exact message, `schema: 2` included | `test_a_later_schema_is_refused_by_name`, one node-level test per field in `test_node.py`, one per check in `test_fields.py` |
| one run reports every problem, with file, field and line | `test_every_problem_is_reported_in_one_run` |
| `regions.yaml` validated; an unknown region refused with the closest match | `test_regions.py`; `test_an_unknown_region_names_the_registry_and_the_closest_match` |
| a missing or empty `body.md` refused | `test_a_missing_body_is_refused`, `test_an_empty_body_is_refused` |
| the purity guard passes with the new lines, in the same pull request | `tests/guards`, and each allowlist line is in the commit that first needed it |

## What changed this session

| Commit | What is now true |
|---|---|
| `01def1d` | `Problem`: one line, `path[:line][: field]: what is wrong` |
| `50d8356` | YAML parsed with each key's line kept; PyYAML and `types-PyYAML` added |
| `af8e898` | **fix:** lines kept per mapping, not per key name (below) |
| `b8cec46` | the field checks and their messages |
| `5b3faf4` | `regions.yaml` read and validated |
| `9302f67` | `parse_node`: six fields, closed set, "did you mean" |
| `3e75115` | `read_node`: id from the folder, nesting, one node per folder, UTF-8 |
| `96efa4a` | the canonical writer and the three laws; files read without newline translation |

Plus this entry, the public API, CLAUDE.md's status and layout, and two node-level tests (title,
minutes) added while checking the done-when.

## Decisions made, and why

**Where the build departed from the plan** — each found by a test, each within the spec:

1. **Key lines are kept per mapping, not per key name.** The plan's loader recorded each key's
   first occurrence in the whole file. In a list of mappings every entry has the same keys, so a
   bad `id` in the third region would have been reported at the first region's line — and part 2's
   *needs* groups are lists of mappings too. The plan's own test encoded the bug. Found before
   `regions.yaml` was built on it; fixed in its own commit so the history shows the mistake and the
   correction. Lines are recorded against the dict PyYAML yields — the object the caller holds —
   through a replacement map constructor on the loader subclass.
2. **"Closest is" keeps `difflib`'s default cutoff (0.6).** The plan's test used `sequencing` →
   `sequence-analysis`, which scores 0.59. Real mistakes score about 0.9 (`sequence analysis`
   0.94, `clam` 0.89), and a name nothing like the registry (`genomics`, 0.08) should get no guess:
   a wrong suggestion is worse than none. The test moved to a realistic mistake, and a second test
   pins the no-guess case. **Rejected:** lowering the cutoff to fit an invented example.
3. **Files are read without newline translation.** `read_text` turned a Windows body's `\r\n` into
   `\n`, and the writer then changed a file nobody had edited — breaking "body.md is written back
   byte for byte". `node.yaml` is still always written with LF, since it is canonical.
4. **The region check is a row like the others.** The plan special-cased `region` with a
   do-nothing check and an `if` in the loop. It is now `in_registry(...)`, built from the registry
   when a node is parsed, so the field table has no exceptions for part 2 to copy.
5. **No `assert` narrowing inside the checks.** Plain `isinstance` checks; the two asserts left are
   after every check has passed, where they only inform the type checker.

**Ruff formats Python inside Markdown.** The docs pull request (#43) went red because aligned
columns in the spec's code blocks failed `ruff format --check`. Specs and plans are formatted by
the same rule as the code they describe; CLAUDE.md's command list says so.

## What is next

1. **Part 2: links in the schema.** *needs* groups (*all of* / *any of*, each with a reason),
   *goes deeper*, *related* (at most four) as rows in `fields(...)`, and `write_node_yaml` appends
   them. The per-mapping lines exist for exactly this: a bad member in the second group names its
   own line.
2. Part 2's brainstorm starts with the question this part's journal and the parts list both park:
   **which file holds a *related* link**, given it shows on both pages.

## Open questions

- **Is *related* written once or on both nodes?** (part 2)
- **Must *goes deeper* point one level further on?** (part 2)
- **How long may a message be?** The region message lists the registry's size; with forty regions,
  should it list them? Today it names the closest only, which seems right; revisit when a real
  author hits it.

## Traps

- **`Lines` holds references to the mappings it recorded**, so their ids cannot be reused while it
  is alive. Keep the data and its `Lines` together; looking up a mapping from another document
  returns `None`, never a wrong line.
- **The allowlist is closed.** A new import in `code-schema` fails `tests/guards` until it is added
  there, in the same commit, with a reason.
- **Comments in `node.yaml` do not survive a write.** Files are generated; reasons live in the
  journal and the specs.
