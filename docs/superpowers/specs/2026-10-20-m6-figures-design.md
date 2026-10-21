# M6.4 — Figures, the ground

**Status: agreed 2026-10-20; built.** The fourth part of M6 (#325), issue
#331. Designed with the operator on 2026-10-20 from the boards on the M6 canvas
(https://claude.ai/artifact/4TEYrit2cBWGcJJmXrKAyw: *L5 · Figures — the general kits* and
*S3 · Workbench — a figure block*), approved that day. The operator decided: **charts are
Vega-Lite made safe** by an allowlist, a re-check in the browser, a locked-down renderer and a
Content Security Policy (M6FG.4); **a diagram no kit draws is an image** (M6.3) until a better
component or engine is built; **a figure is ours**, so naming its data's source is optional, and
**an image's source becomes optional too** (#360). The rest is the agent's, each marked *my call*. From W5.1 and W5.3
(*AI chooses a component and fills its data; a human validates*; the general kits `flow`,
`sequence-track`, `table` and `chart` as Vega-Lite), W4.2 (*figure tools lead with data*; alt text
names the type, what it shows and why), invariant 6 (*figures are library components filled with
data*) and invariant 11 (*one meaning per colour*).

It decides:

- the figure in the format: its file, its block, and where a figure may sit (M6FG.1);
- `code-figures`, the pure package: a component, its schema and its checks (M6FG.2);
- the four general kits and their data (M6FG.3);
- the chart's safety (M6FG.4);
- drafts, review, landing and the index (M6FG.5);
- the page and the workbench (M6FG.6); the build and *done when* (M6FG.7).

**Not in M6.4**: the figure composer (M6.5, S4); domain components (`read-tiling`, `kmer-window`,
`kmer-graph`, …) and answering by a figure (`interact`, M6.6); figures in an exam answer option
(M6.6); interactive charts (selections, sliders); a model filling figure data (M5's declared site).

---

## M6FG.1 In the format

**The file sits in the node's folder** under `figures/`, one YAML file per figure:
`algorithms/choosing-k/figures/kmers-by-k.yaml`. Names are lowercase letters, digits and hyphens,
then `.yaml`, as image names are.

```yaml
component: chart
alt: A line chart. Distinct k-mers rise with k for both genomes; the simple one levels off by k = 11.
data:
  mark: {type: line, point: true}
  data:
    values:
      - {k: 3, genome: simple, kmers: 64}
      # …
  encoding:
    x: {field: k, type: quantitative}
    y: {field: kmers, type: quantitative, title: distinct k-mers}
    color: {field: genome, type: nominal}
```

`component` names a registered component, `alt` is required (W4.2's rule: the type, what it shows,
the takeaway), and `data` is what that component's schema accepts. **`source` is optional**
(operator: *"a figure was us that made it"*): `source: {title, url?}`, for data taken from
elsewhere, drawn after the caption as *Data: <title>*, the title linking to `url` (an `https://`
link) when there is one. Nothing else is allowed at the top. **The block places it** in the body, as the image block does:

````
:::{figure} kmers-by-k
Distinct k-mers as k grows, for two genomes of the same length.
:::
````

The argument is the file's stem; the content is the **caption**, one paragraph of Markdown,
required. **Where a figure may sit**: a body block; an exam stem (as images do, M6IM.1); and a try
question, by a new optional key, `figure: <stem>`, drawn above the ask (*my call*: try questions
are fields in `node.yaml`, not blocks, and M6.6's `interact` will hang off the same key).

**Refused**: a block or try naming no figure file; a figure file nothing places; an unknown
component; a missing `alt`; a key outside `component`, `alt`, `data`, `source`; a `source` without a `title`, or
whose `url` is not an `https://` link; data its component refuses
(M6FG.2); a file over **64 KB** (*my call*: a figure is data written by a person or a model, not a
dataset). A figure file may be placed more than once (the body and a try question share one, as on
the board). New band **CS1000–CS1099, figures**, each code with its test, `explain` and the
generated reference.

*My call*: one file per figure, not records in `node.yaml` as images have — a chart's spec or a
flow's graph is too large and too nested to sit among the node's fields, and R1 already promises
*YAML data files* per node. A file is refused only for what it says, never for its layout, and
**Studio keeps a figure's text as its author wrote it**, comments and layout included (*my call*,
from the builder check): every key outside the schema is refused, so a valid file holds nothing
that was not parsed.

*Rejected*: data inline in the block (`:::{figure}` with a YAML body — the body stays prose and
placements, M6IM.1's reason); JSON files (YAML is what the folder already speaks, and comments
survive).

## M6FG.2 `code-figures`

A new pure package, `packages/code-figures` (`code_figures`), named in R2. **A component is one
module** exposing:

- `name`, and **its schema**: a JSON Schema document kept as data,
  `code_figures/schemas/<name>.json`, the one statement of what its data may hold. Every object in
  it is closed (`additionalProperties: false`), every list and string bounded.
- **`check(data) -> list[Problem]`**: the checks a schema cannot say — internal truth, W5.3's
  *derived values computed, never typed* — each problem with its code and a **JSON path**
  (`data.encoding.y.field`).
- **`derive(data)`**, the computed values the page draws and a person never writes (a track's
  lanes); empty for a kit with none.

`code_figures.registry` maps names to components; one function, `figure_problems(component, data)`,
runs the schema and then the component's checks. **The schema is checked by a small validator in
the package** (`code_figures.schema`), for the subset of JSON Schema the schemas use: `type`,
`properties`, `required`, `additionalProperties: false`, `items`, `enum`, `const`, `pattern`,
`minimum`/`maximum`, `maxItems`/`maxLength`, `oneOf` (*my call*: a library would need a reviewed
widening of the purity allowlist, and the subset is small). **Schemas only widen** once content uses them: a change that would refuse a file
that was valid is a new component name, never a version (*my call*; S4's pinned version is
M6.5's question). The allowlist for `code-figures` is
`__future__`, `collections.abc`, `dataclasses`, `json`, `pathlib`, `re`, `typing`; `code-schema`
gains `code_figures` and calls it while reading a node, so `validate`, verify, the weaver's loading
and `rebuild_index` all refuse a bad figure by the one path.

**The web reads the same schemas.** `npm run figure-types` (as `api-types`) writes
`apps/web/src/figures/schemas.ts`, the schemas and their TypeScript types
(`json-schema-to-typescript`, already a dev dependency), and a test fails until the committed file
matches the package's schemas, as `tokens.css` does. A second test fails if the web's renderer
registry and the package's registry name different components. The web's validator for the same
subset is a hand-written TypeScript twin, **and both run one shared set of cases** (valid and
refused documents in `tests/fixtures/figures/`), so they cannot drift (*my call*: Ajv compiles
schemas with `new Function`, which the CSP forbids, M6FG.4).

## M6FG.3 The four kits

As the L5 board draws them. Bounds are *my call*, chosen to stay legible at 390 px (W5.3's
*legibility* check, stated as caps rather than measured).

**`table`** — `columns: [{name, type: text | number | sequence, unit?, decimals?}]` (at most 8) and
`rows` (at most 50), each a list of one cell per column. Checks: each row has every column; each
cell is of its column's type; a sequence cell is letters only. Drawn as Figure 1: a header rule,
numbers right-aligned in Geist Mono with tabular figures, grouped thousands, the unit in the header.
A GFM table in a text block stays as it is: the kit is for a table that is a numbered, checked
figure.

**`chart`** — a Vega-Lite subset; M6FG.4 says which.

**`flow`** — `nodes: [{id, label, group?}]` (at most 20, W4.2's readability line; a label at most
40 characters), `edges: [{from, to, label?}]` (at most 40; an edge label at most 24),
`direction: right | down` (default `right`), `groups: [{id, label}]` (at most 4). Checks: ids
unique; every edge and `group` names one that exists. Laid out in the browser by
**`@dagrejs/dagre`** and drawn in our SVG (boxes, curved arrows, a dashed group), never dagre's own
drawing. The layout is a pure function (`figures/flow/layout.ts`) with tests, as the route map's is.
Cycles are allowed (dagre breaks them). *Rejected*: elkjs (about 1.4 MB, more than the problem
needs); extending the metro layout (built for routes, not DAGs).

**`sequence-track`** — `alphabet: dna | rna | protein`, `sequence` (at most 120 letters, drawn
base by base) or `length` alone (at most 100 000, a ruler without letters), and
`features: [{start, end, label, kind}]` (at most 30, 1-based and inclusive, as biologists count;
`kind` one of `exon`, `intron`, `cds`, `utr`, `primer`, `motif`, `region`; `strand: + | -`
optional). Checks: letters in the alphabet; `1 ≤ start ≤ end ≤` the length. `derive` packs
overlapping features into lanes (first fit by start), so a person never places a lane. Each kind is
a shape (box, chevron, arrow, bracket), never a colour alone, using the `exon` token where W10
already gives one.

**Colour** (invariant 11): one series is neutral ink; two or more take a **categorical palette**,
which moves into `tokens.json` as `series` for light and dark (today it is a list in
`build_pages.mjs`, S16's), validated for colour-blind separation as S16's was. Teal, blue, amber and
red keep their meanings and are never series colours.

## M6FG.4 The chart, made safe

A chart's danger is that Vega can load URLs (`data.url`, the `image` mark, the `href` channel), its
expressions are code (`calculate`, `filter` strings, `params`, `signal`, condition `test`s), a
spec's own `config` and `usermeta` can carry anything, and generators and heavy transforms can hang
a browser. Vega's expression functions have had XSS advisories. Four layers, each enough to stop
something on its own (operator, 2026-10-20: *"can we make it safe?"* — yes, this way):

1. **An allowlist, not a denylist** (`code_figures/schemas/chart.json`). Allowed: `mark` (a type or
   `{type, point, interpolate, opacity}`; types `bar`, `line`, `point`, `area`, `rule`, `tick`,
   `text`); `data: {values}` only — at most 2 000 rows and 20 columns, each cell a string (at most
   200 characters), a number, a boolean or null; `encoding` with the channels `x`, `y`, `x2`,
   `y2`, `xOffset`, `color`, `size`, `shape`, `opacity`, `text`, `detail`, `row`, `column`, each
   `{field, type, aggregate, bin, timeUnit, sort, stack, title, scale, axis, legend}` with each of
   those closed in turn (`scale` only `zero`, `domain`, `type: linear | log | sqrt`; `axis` only
   `title`, `format`, `tickCount`; no `scheme`, `range` or `value` on `color`, so the palette stays
   ours); `layer` (at most 4, each `{mark, encoding}`, sharing the data). **Refused**: everything
   else, by its path, with one code (`data.encoding.href: not allowed`). `check` adds that every
   `field` is a column of `values`, and that a `quantitative` field's values are numbers and a
   `temporal` field's ISO dates.
2. **Nothing outside the allowlist reaches the renderer.** A saved file holds only allowed keys
   (layer 1 refuses the rest), the index sends the parsed data, never the text, and `$schema`,
   `config`, `width`, `height` and `autosize` are added only at render time, from our tokens and
   the page's width. An author never sets them.
3. **The browser checks again** with the same schema before compiling (M6FG.2's twin). A figure that
   fails is never half-drawn: the page shows *This figure could not be drawn.* with its alt text,
   and keeps the caption (the board's Figure 6).
4. **The renderer is locked down.** `vega-lite` compiles; `vega` parses with `ast: true` and runs
   with **`vega-interpreter`** (no `new Function`), a **loader that refuses every load and
   sanitise**, the SVG renderer, and no tooltip handler. Vega and Vega-Lite load **lazily**, as
   one chunk, only on a page with a chart (about 500 kB compressed; a page without one pays
   nothing). Theme: Vega `config` built from `tokens.json` (Lexend for titles, Geist Mono for
   ticks, `ink3` axes, `border` grid, `series`), redrawn when the theme changes.

**And a Content Security Policy for the whole app**, from `ops/nginx/default.conf` (today it sets
only `Referrer-Policy`): `default-src 'self'`; `script-src 'self'` (no `unsafe-eval`, no
`unsafe-inline`); `style-src 'self' 'unsafe-inline'` (React's and KaTeX's inline styles);
`img-src 'self'`; `connect-src 'self'`; `font-src 'self'`; `frame-src https://www.youtube-nocookie.com` (the one
host `embed.ts` builds, written in the config; a repository test fails if a player in
`code_schema.providers.PLAYERS` has no host in the config); `object-src 'none'`; `base-uri 'self'`; `frame-ancestors 'none'`. It is
sent on the app's paths (`location /`), not on `/api/`, `/_allauth/` or `/static/` (*my call*: those
answer JSON or serve the API docs page, which draws its own icons from `data:` URLs). It is
its own issue under #331, **lands before charts reach learners**, and is walked in the Compose
stack (the YouTube embed, KaTeX, a chart, signing in through allauth); `ops/stack-check.sh` checks
the header. Vite's dev server sends none (*my call*: the stack is where the policy is real).

**What remains**: a bug inside Vega's allowlisted subset, with no expressions and no loads, under a
CSP that forbids eval and outside connections. Dependabot already watches the web's dependencies.

*Rejected*: rendering charts to SVG on the server (needs Node or a headless step in the API, and
the pure package cannot); our own chart grammar (safest, but a model writes Vega-Lite reliably,
which M5 needs, W5.3); Vega with expressions allowed and only `url` refused (the advisories were in
expression functions).

## M6FG.5 Drafts, review, landing and the index

**A draft keeps its figures as text**: `Revision.figures`, a JSON mapping of stem to the file's
text, beside `images` (*my call*: they are small text, so no `Asset`). A save that adds, changes or
removes a figure is one edit and one revision, like every other. Three pure edits in
`code_schema.edits`: **add a figure** (a component's starter data from `code_figures`, a free stem
by M6.3's `free_name`, and its block), **set a figure** (the file's new text; refused unless it
parses; kept as written), **remove a figure** (its file, its blocks, and
its key on any try question and exam stem — #356's lesson).

**Review**: a figure block is its own review key, kind `figure`, whose content is the block and its
file's text, so a changed file is a changed key and an earlier verdict does not carry over. A try
question's figure, and each figure an exam stem places, is part of that question's key, by the
file's text (*my call*, from the builder check). The review screen draws the figure as the page
does, with the file beneath it.

**Landing** writes each figure as a text blob beside the node's files and removes one no longer
placed; Land's file list names `figures/*.yaml` (#358's lesson). **The index** keeps each landed node's figures in `NodeFigure` (node, stem, the file's text, and
its parsed `component`, `alt`, `data`, `derived` and `source`), as `NodeImage` keeps images.
`GET /api/nodes/{id}` sends them as the node's `figures`, and a figure block as `{kind: figure,
file, caption}`; the page joins the two by stem, as it does images, so no new route is needed. A
try question's `figure` and an exam stem's figure blocks name a stem the same way. Keeping the text
means a draft opened from the index (`content/snapshot.py`) starts from the files as they landed,
comments included, and review compares text with text (*my call*, from the builder check; it
follows the images' pattern rather than folding the data into each block). The follower reads `figures/` from the tarball like the rest.

## M6FG.6 The page and the workbench

**On the page**, a figure is drawn as the L5 board draws it: its body, then *Figure N.* and the
caption. Figures and images share the one sequence in reading order (M6IM.5); a figure in an exam
stem or a try question is not numbered on the page's sequence (*my call*, as M6IM.5 for stems; the
board's *Figure 4* inside the try is drawn unnumbered when built). Renderers live in
`apps/web/src/figures/`, one per component, behind one `Figure` that checks the data first and
falls back to the alt text. Each renderer draws in our SVG at the column's width and at 390 px;
light and dark from the tokens.

**In the workbench** (the S3 board): *Add* gains **Figure**, which asks for a component and adds
its starter. The block's editor holds the component (fixed once added, *my call*: changing kind
is removing and adding), the file's stem, the caption, and **the figure's file as YAML text**,
saved when you leave it, as every editor is. Its checks list each problem with its code and path.
A try question's editor gains a figure picker of the node's figures. The preview draws the saved
figure. M6.5's composer replaces the YAML editor with a sheet; until then the file itself is the
editor.

## M6FG.6a An image's source is optional (#360)

Operator, 2026-10-20: *"image source should be optional as well"*. In an image's record (M6IM.1)
`source` is optional; when present it is still an `https://` link or `own work` (CS0907 stays for
a wrong value, no longer for a missing one). The credit line drops its source part when there is
none: *Image: <author> · <licence>*. The upload editor's Source field is optional; Commons still
fills it. Author and licence stay required (invariant 6).

## M6FG.7 The build, and done when

In order, test-first: #360 first (small, and it touches the record code-figures' `source`
mirrors); then `code-figures` with its validator, schemas and shared cases; the four kits'
checks and the track's lanes; the format (block, try key, stems, CS10xx); drafts, the edits and
review; landing and the index; the CSP (its own issue and pull request or commit, walked in the
stack); the web's validator, `Figure` and the renderers (`table`, `flow` with dagre,
`sequence-track`, then `chart` with Vega lazily); the workbench. The `series` tokens move into
`tokens.json` with the first renderer that needs them. The fixtures gain no node
(*my call*: the 26 and every count stay): the de Bruijn fixture takes one figure of each kit (the
board's data) and a try with a figure, and TPM's exam pool a question whose stem places a figure.

**Done when**, walked against `runserver` and Vite as an author, and in the Compose stack as a
learner:

1. The de Bruijn fixture's page draws all four kits as the L5 board does, compared at 1440 in light and dark
   and at 390, numbered with its image in one sequence.
2. A chart with `href`, `data.url`, a `calculate` transform or a `params` entry is refused in the
   workbench with its code and path; the same file planted in the index is not drawn in the browser
   (the fallback shows), and no request leaves the page.
3. In the stack, the CSP header is sent; the YouTube embed, KaTeX, sign-in and the chart all work
   under it, and the console shows no violation.
4. An author adds a flow in the workbench, edits its YAML, sees a dangling edge refused and fixed,
   and submits; the reviewer sees the figure drawn and gives it a verdict; landing it would write
   `figures/<stem>.yaml` (checked against the fake GitHub client), and the index serves it after a
   rebuild.
