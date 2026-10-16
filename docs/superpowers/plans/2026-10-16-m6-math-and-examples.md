# M6.2 Math and example blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `math` and `example` blocks, and `$…$` formulas in Markdown, from the format to the
Node page and the workbench.

**Architecture:** `code-schema` reads and writes the two blocks and checks every formula (a new
`code_schema/math.py`: find the formulas by `remark-math`'s rule, then the pure checks). The index,
the content API and Studio's block API carry them as two more kinds, like `sequence` did (M4.8c).
The web draws formulas with one pinned KaTeX through a `Formula` component used by the math
block and by `prose.tsx`'s inline math.

**Tech Stack:** Python 3.14 (`code-schema`, pure), Django Ninja, React 19 + react-markdown 10,
`remark-math` 6.0.0, `katex` pinned exactly, vitest.

**Spec:** `docs/superpowers/specs/2026-10-16-m6-math-and-examples-design.md` (M6MX.1–M6MX.5), #329.

## Global Constraints

- Directives: `:::{math}` (no title, TeX inside) and `:::{example} <title>` (Markdown inside).
- Index JSON: `{"kind": "math", "tex": …}`, `{"kind": "example", "title": …, "markdown": …}`.
- New codes, CS04xx band, `emitted_by: schema`, all refusing: CS0419 *the math block is empty*;
  CS0420 *an example has no title*; CS0421 *the example is empty*; CS0422 *a formula's braces or
  environments do not balance*; CS0423 *a formula uses a command that is not allowed* (`\href`,
  `\url`, `\includegraphics`, `\htmlClass`, `\htmlId`, `\htmlStyle`, `\htmlData`); CS0424 *a
  formula defines a macro* (`\def`, `\gdef`, `\edef`, `\xdef`, `\let`, `\newcommand`,
  `\renewcommand`, `\providecommand`). A `math` block that is empty is CS0419, not CS0422.
- Inline formulas are checked in text blocks, callouts, examples and exam stems' text; question
  fields (ask, options, hints, rationale) are plain text and unchanged.
- Exam stems allow `text`, `sequence` and `math`; `example` is refused there as `try`/callout are.
- KaTeX: `trust: false`, `throwOnError: false`, a fresh `macros: {}` per formula; learners see an
  unreadable formula as plain mono source; Studio's preview shows it in `text-open` with KaTeX's
  message.
- `katex` pinned to an exact release at least two weeks old (0.18.11 or 0.19.0, both 2026-10-01;
  read the 0.19.0 changelog and take 0.19.0 unless it breaks `trust`/`macros`); `remark-math`
  `6.0.0`; no `rehype-katex`. KaTeX's CSS imported once (its fonts bundled by Vite).
- `code-schema` stays pure: `re` and the standard library only; the purity allowlist unchanged.
- Web commands run in `node:24-alpine` (`docker run --rm -u $(id -u):$(id -g) -v $PWD:/w -w /w/apps/web node:24-alpine …`); a new dependency is installed the same way (`npm install --save-exact`).

## Review Focus

1. A `$` in a code span or fence (`` `echo $HOME` ``, a shell example): never a formula, never checked.
2. A formula that runs over a soft line break inside a paragraph: found and checked; a blank line ends it.
3. `\$5 and \$10` in prose: plain text, no formula.
4. A math block whose TeX contains `:::` on a line: the parser's closing rule decides (it closes the
   block); the writer never produces it, so the round trip holds (CS0415 otherwise).
5. An index built before this change (no math or example rows): reads as before; `block_from_json`
   accepts the new kinds and refuses unknown ones as now.

---

### Task 1: The format reads and writes `math` and `example` (M6MX.1, M6MX.2, M6MX.4)

**Files:**
- Modify: `packages/code-schema/src/code_schema/blocks.py` (`Math`, `Example`, `Block`, parser,
  writer, codec, `block_text`, `_LATER`), `packages/code-schema/src/code_schema/__init__.py`
  (export `Math`, `Example`), `packages/code-schema/src/code_schema/exam.py` (stems refuse
  `Example`), `packages/code-schema/src/code_schema/diagnostics.yml` (CS0419–CS0421)
- Regenerate: `docs/reference/diagnostics.md`
- Test: `tests/schema/test_blocks.py`, `tests/schema/test_exam.py` (or the file holding stem tests)

**Interfaces:**
- Produces: `@dataclass(frozen=True) class Math: tex: str` and
  `@dataclass(frozen=True) class Example: title: str; markdown: str`;
  `Block = Text | Try | Callout | SequenceBlock | Math | Example`.
- `block_text(Math) == tex`, `block_text(Example) == markdown`.

- [ ] **Step 1: Tests** — `test_a_math_block_round_trips` (body
  `":::{math}\nG_k(R) = (V, E)\n:::\n"` → `(Math("G_k(R) = (V, E)\n"),)`, written back
  byte for byte); `test_an_example_round_trips` (title *Three reads into one sequence*, a body
  holding a code fence, round trip); `test_an_empty_math_block_is_cs0419`;
  `test_an_untitled_example_is_cs0420`; `test_an_empty_example_is_cs0421`;
  `test_math_takes_no_title` (`:::{math} x` → CS0425);
  `test_math_and_example_are_no_longer_later` (no CS0413 for either);
  `test_block_json_round_trips_math_and_example`; `test_a_stem_refuses_an_example` (CS code the
  stem filter already uses, message *a stem holds text, sequences and math*);
  `test_a_stem_holds_math`.
- [ ] **Step 2: Run** `uv run pytest tests/schema/test_blocks.py tests/schema -q -k "math or example or stem"` — fail.
- [ ] **Step 3: Implement.** A title on `math` is refused with a new code **CS0425** *the math block
  takes no title* (declare it with CS0419–CS0421). Writer: `:::{math}{nl}{tex}:::{nl}` and
  `:::{example} {title}{nl}{markdown}:::{nl}`. The stem filter's message becomes *a stem holds
  text, sequences and math* (a pinned message: update its test).
- [ ] **Step 4: Run** `uv run pytest tests/schema -q` and `uv run code-schema diagnostics --write docs/reference/diagnostics.md` — pass.
- [ ] **Step 5: Commit** — `feat(schema): math and example blocks (#329)`.

### Task 2: Every formula is found and checked (M6MX.1, M6MX.3)

**Files:**
- Create: `packages/code-schema/src/code_schema/math.py`
- Modify: `blocks.py` (call the checks from `parse_blocks` for text, callout, example and math
  blocks, at the block's start line plus the formula's offset), `diagnostics.yml` (CS0422–CS0424)
- Test: `tests/schema/test_math.py` (new)

**Interfaces:**
- Produces: `inline_formulas(markdown: str) -> list[tuple[int, str]]` — `(line offset from the
  markdown's first line, tex)` for each `$…$` by `remark-math`'s math-text rule: a run of *n*
  unescaped `$` opens and the next run of exactly *n* closes; none inside code spans or fenced/
  indented code; a blank line ends the search; an unclosed run is text.
- Produces: `formula_problems(tex: str) -> list[tuple[str, str]]` — `(code, message)` pairs:
  CS0422 for unbalanced `{}` (ignoring `\{`/`\}`) or `\begin{x}`/`\end{x}`; CS0423 per untrusted
  command; CS0424 per macro definition. A command matches only as a whole name (`\hrefx` is not
  `\href`).

- [ ] **Step 1: Tests** in `test_math.py`: `inline_formulas` on `"$k$-mers"` → `[(0, "k")]`;
  `"$5 and $10"` → `[(0, "5 and ")]`; `"\\$5 and \\$10"` → `[]`; `` "`$x$`" `` → `[]`; a fenced
  block holding `$x$` → `[]`; `"$$x$$"` → `[(0, "x")]`; `"a $b\nc$ d"` → `[(0, "b\nc")]`;
  `"a $b\n\nc$"` → `[]`; `formula_problems("\\frac{a}{b")` → CS0422;
  `formula_problems("\\begin{aligned}x\\end{array}")` → CS0422; `formula_problems("\\href{x}{y}")`
  → CS0423; `formula_problems("\\newcommand{\\a}{b}")` → CS0424; `formula_problems("\\{a\\}")` → `[]`;
  and through `parse_blocks`: a text block `"Read $\\url{x}$.\n"` → CS0423 on line 1; a callout
  and an example likewise; a math block `"\\def\\a{b}"` → CS0424.
- [ ] **Step 2: Run** `uv run pytest tests/schema/test_math.py -q` — fail.
- [ ] **Step 3: Implement** `math.py` with `re` only, and wire it into `parse_blocks`.
- [ ] **Step 4: Run** `uv run pytest tests/schema tests/guards -q` — pass (purity holds).
- [ ] **Step 5: Commit** — `feat(schema): formulas are found as remark-math finds them, and checked (#329)`.

### Task 3: The index, the API and the fixtures (M6MX.4)

**Files:**
- Modify: `apps/api/src/code_api/content/schemas.py` (`MathBlockOut(kind: Literal["math"], tex)`,
  `ExampleBlockOut(kind: Literal["example"], title, markdown)`, both in the discriminated union),
  `content/reads.py` and `studio/schemas.py` (their block mappers), `studio/api.py` (`BlockIn`:
  kinds `math`, `example`; a `tex` field; the mapper), `studio/keys.py` (`Math`, `Example` in
  `Content`, `BODY`, the kind switch and `_signature`)
- Modify: `tests/fixtures/salmon/algorithms/<the de Bruijn node>/body.md` — a *Formal definition*
  math block and the board's *Worked example*, then `rebuild_index` in tests as now
- Regenerate: `apps/api/openapi.json`, `apps/web/src/api/schema.ts`
- Test: `apps/api/tests/test_nodes_api.py`, `apps/api/tests/test_draft_edits.py`,
  `apps/api/tests/test_review_keys.py`

- [ ] **Step 1: Tests**: the de Bruijn node's `blocks` include `{"kind": "math", "tex": …}` and
  `{"kind": "example", "title": "Three reads into one sequence", "markdown": …}`; inserting a math
  block through `POST …/blocks` saves; one with `\href` is refused 422 with CS0423 among its
  problems; review keys give each new block a key and align them across revisions.
- [ ] **Step 2: Run** them — fail.
- [ ] **Step 3: Implement**, export OpenAPI, `npm run api-types` (Node 24 in Docker).
- [ ] **Step 4: Run** `uv run pytest -q` (all) — pass.
- [ ] **Step 5: Commit** — `feat(api): math and example blocks in the index and the content API (#329)`.

### Task 4: Formulas on the page (M6MX.3, M6MX.4)

**Files:**
- Modify: `apps/web/package.json`/lock (`katex`, `remark-math`, exact)
- Create: `apps/web/src/node/Formula.tsx` (`Formula({ tex, display, studio })`),
  `apps/web/src/node/MathBlock.tsx`, `apps/web/src/node/Example.tsx`
- Modify: `apps/web/src/node/prose.tsx` (`remarkMath`; `code` with class `language-math` and
  `math-inline` / `math-display` → `Formula`), `node/body.ts` (`Block` union), `node/Body.tsx`
- Test: `apps/web/src/node/Formula.test.tsx`, `apps/web/src/node/Body.test.tsx`

**Interfaces:**
- `Formula({ tex: string; display: boolean; studio?: boolean })`: KaTeX `renderToString` with
  `{ displayMode: display, trust: false, throwOnError: false, macros: {} }`; when KaTeX marks an
  error (its output holds `katex-error`), draw `tex` in `font-mono` — plain for learners, and with
  `text-open` plus KaTeX's `title` message when `studio`.

- [ ] **Step 1: Tests**: `$k$-mers` in a text block draws a `.katex` element; a math block draws a
  display formula centred; `\notacommand` draws its source in mono, without `text-open`, and with
  it when `studio`; `\href{https://x}{y}` draws no link; an example draws *Worked example ·
  <title>* and its code fence in mono; `$x$` inside a code span stays text.
- [ ] **Step 2: Run** `npx vitest run src/node` — fail.
- [ ] **Step 3: Implement**; import `katex/dist/katex.min.css` once in `main.tsx`.
- [ ] **Step 4: Run** lint, typecheck, `npx vitest run`, build — pass.
- [ ] **Step 5: Commit** — `feat(web): math and worked examples on the page (#329)`.

### Task 5: The workbench (M6MX.1, M6MX.4)

**Files:**
- Modify: `studio/workbench/BlockList.tsx` (*Add a math block*, *Add an example*),
  `BlockEditor.tsx` (`MathField`: a mono TeX box with `Formula` drawn under it, `studio`; the
  example editor reuses `CalloutFields`' title and Markdown with no kind picker), `Outline.tsx`
  (math: its first characters; example: its title), `MarkdownField.tsx` (**Math** wraps the
  selection in `$…$`; the help line says a literal dollar is `\$`), `ExamEditor.tsx` and
  `exam.ts` (a stem's add row gains *math*), `studio/review/ReviewPage.tsx` (`KINDS` gains
  `math`, `example`), `PreviewPanel.tsx` (passes `studio`)
- Test: the files' existing test files

- [ ] **Step 1: Tests**: adding a math block sends `{kind: "math", tex}` and the preview draws it;
  adding an example sends `{kind: "example", title, markdown}`; the Math button wraps `k` into
  `$k$`; the outline names both; a stem gains a math block and sends it; review lists math and
  example blocks.
- [ ] **Step 2: Run** them — fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** lint, typecheck, all tests, build — pass.
- [ ] **Step 5: Commit** — `feat(web): math and examples in the workbench (#329)`.

### Task 6: The walk, and done when (M6MX.5)

- [ ] **Step 1:** CI's commands, with CI's environment; all green.
- [ ] **Step 2:** Walk *done when* 1–5 (`runserver` on 8001 from a folder whose `.env` has no
  GitHub App, Vite on 5174 in `node:24-alpine`, Compose's worker and beat stopped); compare the
  Node page's math and example with the Node board at its width in light and dark; each defect an
  issue and a test-first fix.
- [ ] **Step 3:** Fresh reviewer over the branch; journal entry; spec status *built*; commit.
