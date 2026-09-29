# 2026-09-29 — M4.1.2, the block document

## Where things stand

- A node's `body.md` is MyST: `:::{try} <id>` then `:::` places a question, and
  `:::{misconception|caveat|convention} <title>` … `:::` is a callout. `code_schema.blocks` reads it
  into `Text`, `Try` and `Callout`, and `write_blocks` gives the same bytes back
  (`uv run pytest tests/schema/test_blocks.py tests/schema/test_fixtures.py`).
- The index stores each node's blocks as JSON (migration `content.0004_node_blocks`), and
  `GET /api/nodes/{id}` serves `blocks` and no `body` (`uv run pytest apps/api/tests`).
- The node pages draw blocks; `tpm` carries the fixtures' one callout. Walked on the audit stack in
  Chrome: tpm at 1440 light and dark and at 360 (the callout wraps, nothing overflows); de Bruijn
  graphs and DNA and genes draw as before, questions where the author put them, no `:::` visible.
- New codes CS0406–CS0415 (concern *body*); CS0402 retired
  (`uv run code-schema explain CS0415`).

## What changed

- `d128f8f`, `51310f4`: blocks in code-schema, the fixtures moved to fences, `markers.py` removed.
- `2d914bd`: the index and the node API carry blocks.
- `868eba3`: after the checkpoint review, code fences follow CommonMark (a fence closes only on its
  own character, at least as long, with no info string; four spaces of indent open none), callouts
  included, and a body its blocks would not write back unchanged is refused as CS0415.
- `332b6a4`: the web draws blocks; `Callout.tsx`; the Markdown components moved to `prose.tsx`.

## Decisions, and why

- **The round-trip law holds by construction** (CS0415), rather than blocks carrying their raw
  directive lines. M4.4 writes bodies from blocks; a body that cannot come back unchanged is refused
  now instead of silently rewritten then. Rejected: storing each directive's raw text, which puts
  whitespace into the API and the editor's model.
- **The callout spends no colour** (invariant 11): the Learn it panel style with a grey kind tag.
  No learner board draws a callout yet, so this is the plan's choice, not a board match.
- **Checkpoint findings stayed on #129**, not separate issues: they were in unmerged code.

## What is next

1. The final whole-branch review, then the PR closing #129, merged on the operator's yes.
2. Compact the journal: M4.1.1 and M4.1.2 have both closed.
3. M4.2, exam pools, with the content repository's pinned validator moved to fences.

## Open questions

- The deferred minors from the checkpoint (valid MyST spellings such as `::: {caveat}` or `::::`
  read as prose; no id check inside `parse_blocks`; `Node.blocks` defaulting to `()`) are listed in
  the PR. M4.4's editor is where most of them start to matter.

## Traps

- The content repository still uses `{% try %}` markers until its validator pin moves: validating
  it with this branch's `code-schema` reports CS0414 on every placed question. That is expected.
- `Node.blocks` is `compare=False`: two nodes with the same body compare equal whatever their blocks.
