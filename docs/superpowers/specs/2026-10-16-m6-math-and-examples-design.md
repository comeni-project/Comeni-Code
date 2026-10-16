# M6.2 — Math and example blocks

**Status: agreed 2026-10-16.** The second part of M6 (#325), issue #329.
The operator asked for the defaults (*"just write a normal computer science example"*): the
choices below are the agent's, each marked *my call*. It adds two of the block kinds the format
refuses until M6 (`code_schema/blocks.py`, `_LATER`), from W5.1 of the 2026-09-16 spec and the
Node board's *Formal definition* and *Worked example* (`.design/build_pages.mjs`, `node()`).

It decides:

- the `math` block, and formulas inside text (M6MX.1);
- the `example` block (M6MX.2);
- how a formula is checked, and drawn (M6MX.3);
- the workbench, the Node page, the index and exam stems (M6MX.4);
- the build and *done when* (M6MX.5).

No figures, images or problems (M6.3 onwards), no executed examples, no AI (M5).

---

## M6MX.1 The `math` block, and formulas in text

**A display formula is a block**, written in TeX between fences, as MyST writes it:

````
:::{math}
G_k(R) = (V, E), \quad V = \{\,(k-1)\text{-mers of } R\,\}
:::
````

It holds the TeX and nothing else: no title, no options (CS0407, as every directive). An empty
one is refused. The index stores `{"kind": "math", "tex": …}`.

**A formula inside text** is `$…$`, never inside code, **wherever the app draws Markdown**: text
blocks, callouts and examples, and an exam stem's text blocks — the shared prose component draws
them all, so all are checked (*my call*). A question's ask, options, hints and rationale are plain
one-line text, drawn as text, and stay so (corrected while planning: they were never Markdown). **Which dollars make a formula is `remark-math`'s rule, and `code-schema`
copies it** (*my call*): what the check sees is what learners see. It pairs dollars much as
Markdown pairs code spans, so `$5 and $10` is a formula; a literal dollar is written `\$`, and the
workbench's Markdown help says so. Inline formulas are checked like blocks (M6MX.3). The text
toolbar gains **Math**, which wraps the selection in `$…$` (the board's toolbar has it). An
example's title is plain text, never a formula (*my call*).

*Rejected:* `$$…$$` as the way to write display math (one way to write a block, the directive, as
every other block; `remark-math` still reads `$$…$$` inside text as a formula, and the check
follows it); `\(…\)` inline (harder to type; MyST's default is the dollar); a custom tokenizer
for a stricter dollar rule (a second parser to keep in step with the first).

## M6MX.2 The `example` block

**A worked example is a titled block of Markdown**, read step by step, as a textbook prints one:

````
:::{example} Three reads into one sequence
Cut each read into 3-mers, keep the distinct ones, and walk them in order:

```
reads     ACGTT  CGTTA  GTTAG
distinct  ACG CGT GTT TTA TAG
spells    ACGTTAG
```
:::
````

The title is required (an example says what it shows; refused when missing); the body is
Markdown with code fences and inline formulas, like a callout's. An empty body is refused. The
index stores `{"kind": "example", "title": …, "markdown": …}`.

**Examples are not executed** (*my call*). W5.1 allows *optionally executable*; running anything
needs a sandbox and a checker, which are M6.7's (`code-problems`). A later part may add a
`checked` option that recomputes an example with a library checker, the way problems are checked;
until then the board's `checked` tag is not drawn.

*Rejected:* a code-only block (a worked example explains its steps, not just shows output);
executing code (M6.7's sandbox question, and invariant 6: no script from authors).

## M6MX.3 How a formula is checked, and drawn

**Drawn with KaTeX** in the browser, pinned to an exact release at least two weeks old, in strict
mode inside a `try`: a parse error, an unknown command or an untrusted one (`trust` is a callback
that throws, so `\href`, `\url`, `\includegraphics` and `\html…` never draw, not even in KaTeX's
red) is caught, so a formula KaTeX will not draw never breaks the page; `errorColor` is the text's
own and `maxSize` is bounded (corrected by the final review, #346: this line first said
`trust: false` and `throwOnError: false`, which draw untrusted commands in red). **Learners see such
a formula's source in the mono face, plainly**;
**Studio's preview** shows it in the colour Studio already gives a problem (`text-open`, as Land's
refusals), with KaTeX's message (*my call*: a learner is not shown an error colour for an author's
slip, and review sees it first). Inline formulas reach KaTeX through `remark-math`, a remark plugin beside the `remark-gfm` the
app already uses; the app renders them itself rather than through `rehype-katex`, which
pins an older KaTeX (*my call*: one KaTeX).

**Checked in `code-schema`** (pure, no JavaScript), *my call*: a formula is refused when it is
empty, its braces or `\begin{…}`/`\end{…}` do not balance, or it uses a command KaTeX would run
untrusted (`\href`, `\url`, `\includegraphics`, `\htmlClass`, `\htmlId`, `\htmlStyle`,
`\htmlData`) — invariant 6, no markup from an author or a model — or one that spends colour
(`\color`, `\textcolor`, `\colorbox`, `\fcolorbox`; invariant 11, #346), or one that defines a macro
(`\def`, `\gdef`, `\edef`, `\xdef`, `\let`, `\futurelet`, `\newcommand`, `\renewcommand`,
`\providecommand`), which KaTeX allows even untrusted and which would let one formula change how
later ones draw (invariant 3: a block reads correctly alone). Each formula is also drawn with its own
empty `macros`. That is *parses* as far as a pure
check can say; whether KaTeX knows every command is shown in the workbench preview, which draws
with the same KaTeX as learners see, and is marked there in Studio's problem colour.

*Rejected:* running KaTeX in Node in the content repository's CI (a second runtime in a check
that is Python today); a Python LaTeX parser such as `pylatexenc` (it parses LaTeX, not KaTeX's
subset, so it would accept and refuse differently from what learners see).

## M6MX.4 Where the blocks appear

- **The format**: `Math(tex)` and `Example(title, markdown)` join `Block`; `parse_blocks`,
  `write_blocks`, `block_json` and `block_from_json` read and write them byte for byte, and
  `_LATER` loses `math` and `example`. New codes in the CS04xx band (empty, untitled, a formula
  that does not balance, an untrusted command), each with a test.
- **Exam stems** may hold a `math` block (tutor spec T7.1 lists it); `example` stays out of stems.
- **The index and the API**: the block union gains both kinds; `openapi.json` and `schema.ts`
  follow. Review's per-block keys and verdicts (M4.9a) take them as any block.
- **The Node page** draws a math block in its own panel, left-aligned, as the Node board draws a
  formal definition (corrected by the walk, #344: this line first said *centred*), and an example
  as a panel headed *Worked example · <title>*, its code in the mono face. The board draws an
  example as a bare code panel under an authored heading; the title the format requires is shown
  in the panel instead.
- **The workbench**: *Add* offers **Math** and **Example**. The math editor is a TeX box with the
  formula drawn live under it; the example editor is the callout's (title and Markdown). The
  outline names them *math* and *example* with their first words.

## M6MX.5 The build, and done when

`code-schema` first (blocks, codes, the formula check), then the index and API, then the Node
page, then the workbench. Test-first; the fixtures gain one math block and one example on a node
that has neither (the de Bruijn node, as the board draws it), so the weaver and API tests see
them.

**Done when**, walked against `runserver` and Vite as an author:

1. A draft gains a math block and an example through the workbench; the preview draws both.
2. Text with `$k$-mers` draws the inline formula; `\href{…}` in a formula is refused by the save
   with its code.
3. A formula KaTeX cannot read (`\notacommand`) saves; the preview shows its source in Studio's
   problem colour with KaTeX's message, and the Node page shows it plainly in mono.
4. The Node page draws the fixture's math block and example in light and dark, compared with the
   Node board at its width.
5. An exam question's stem holds a math block and draws it.
