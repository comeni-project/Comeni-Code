# M4.1.1 — diagnostic codes

**Status: agreed 2026-09-29.** The first substep of M4.1 (#119), before the block document
(M4.1.2, [`2026-09-29-m4-block-document-design.md`](2026-09-29-m4-block-document-design.md)).
The parts list is the journal entry *M4 in parts* (2026-09-29). It gives every problem Code can
report a **code**: declared once, classed by subsystem and concern, explained on demand, and
listed on a generated reference page, as Comeni Labs does with its `MD`, `MF` and `MI` codes. It
decides:

- where codes are declared, and what a declaration holds;
- how codes are classed and numbered;
- how a problem carries its code, in each subsystem;
- how a code is explained, and how the registry is kept honest.

The operator asked for it ("errors divided into classes and numbers so we can follow it") and made
every decision here on 2026-09-29, question by question; an agent proposed them after reading
Labs' `comeni_core/diagnostics.yml` and `diagnostics.py`.

---

## M4D.1 Why now

M4 is about to add refusals in every part — the block document's dozen, then accounts, drafts,
review, landing and the worker. Every validator message today is a plain string: nothing names
it, so a runbook, an issue or a content author cannot point at one, and a message reworded is a
different message. Coding the existing ones first means everything M4 adds is born with a code,
and nothing is written twice.

## M4D.2 One registry

`packages/code-schema/src/code_schema/diagnostics.yml` declares every code. `code-schema` is the
package every other subsystem already reads, and it is pure, so the registry is data inside the
purity guard.

```yaml
CS0201:
  emitted_by: schema          # schema | weaver | api
  concern: resources
  says: a resource cites a provider providers.yaml does not list
  refuses: true               # true: an error; false: a warning that never blocks
  fix: |
    Correct the provider's id, or add the provider to providers.yaml in its own pull request.
  explanation: |
    Every resource names the provider it comes from, and providers.yaml decides which licences
    that provider may carry and whether it may be embedded (tutor spec T4.2). …
```

- **`says`** is the general sentence; the problem's own message stays specific (*openstax2 is not
  a provider in providers.yaml — did you mean openstax?*).
- **A code is never renumbered.** One that goes out of use stays, with `retired: <date> — <why>`.
- **`bands:`** at the top of the file holds the classes as data, so a test can check them
  (M4D.6); the header comment says the same in prose.

*Rejected:* a registry per package (three places to ask "which codes exist"); a Python dict
(Labs had one beside a hand-kept table, and a code existed in either alone); the registry in a new
package (a fourth package for one file).

## M4D.3 Classes and bands

A code is `C` (Code, so it cannot collide with Labs' `M`, `N` and `W`), a letter for the
subsystem, and four digits, grouped **in bands of one hundred by concern**:

| Band | Concern |
|---|---|
| `CS0001`–`CS0099` | a node's files and fields: YAML that will not parse, missing or unknown fields, the node folder |
| `CS0100`–`CS0199` | links: *needs*, *goes deeper*, *related*, and their reasons |
| `CS0200`–`CS0299` | resources and providers |
| `CS0300`–`CS0399` | questions: `try`, and exam pools from M4.2 |
| `CS0400`–`CS0499` | the body and its blocks (M4.1.2) |
| `CS0500`–`CS0599` | the graph: targets, symmetry, levels, cycles |
| `CS0600`–`CS0699` | registries: `regions.yaml`, `providers.yaml` |
| `CS0700`–`CS0799` | finding nodes in a content folder: near misses, duplicate ids |
| `CW0001`–`CW0099` | `code-weaver`: a graph refused, an unknown goal |
| `CW0100`–`CW0199` | `code-weaver`: finding targets for words |
| `CA0001`–`CA0099` | the API: the index and the read endpoints |
| `CA0100` onward | claimed by M4's parts as they are built — accounts, drafts, review, landing, the worker |

A band may overflow into a new band, recorded in `bands:`. `CS0000` and the other `…0000` codes
are unallocated on purpose, as in Labs.

*Rejected:* one class per package with plain numbers (no grouping by concern when reading a code);
classes by concern rather than package (`CF`, `CG`, `CR`, … — more prefixes, and a code no longer
says where to look).

## M4D.4 How a problem carries its code

- **`code-schema`.** `Problem` gains a required `code`. Constructing one with a code the registry
  does not declare raises `UnknownDiagnostic`: emitting an undeclared code is a bug in this
  repository, not a user's mistake, so the state is made unrepresentable rather than tested for.
  Printed, a problem reads

  ```
  tests/fixtures/salmon/…/node.yaml:9: provider: CS0201 openstax2 is not a provider in providers.yaml — did you mean openstax?
  ```

  and a GitHub annotation carries the code as its `title`, so content CI shows it.
- **`code-weaver`.** Its core (`graph.py`, `weave.py`, `find.py`) imports nothing outside the
  standard library, and stays so. `GraphError`'s problems and `UnknownGoal` carry their codes as
  string literals; a test checks each is declared with `emitted_by: weaver`. The CLI, which
  already imports `code-schema`, prints them as `code-schema` does.
- **The API.** An error body the API writes itself gains a code:
  `{"detail": "No topic with id 'x'.", "code": "CA0002"}` — the node and route 404s, the 503 before
  any build, the search endpoint's own refusals, and `rebuild_index`'s refusal and missing-folder
  exits. **Ninja's own request-validation 422s keep Ninja's shape**; coding them would mean
  replacing its error handler, which nothing needs yet. `openapi.json` and `schema.ts` are
  regenerated, and the page still prints `detail`.

## M4D.5 Explaining a code, and the reference page

- `uv run code-schema explain CS0201` prints the code's `says`, `fix` and `explanation`, and
  exits 0. An unknown code exits 2 with the closest declared one (*CS0210 is not a code — did you
  mean CS0201?*); here a bad code is exactly the reader's typo, so it answers rather than raises.
- `uv run code-schema diagnostics --write docs/reference/diagnostics.md` generates the reference
  page from the registry, grouped by prefix and band, each code with its `says`, whether it
  refuses, its `fix` and its `explanation`. The committed page is checked by a test that fails
  when it is stale, naming the command, as `openapi.json`'s test does.
- `docs/index.md` gains a *Reference* book; `CLAUDE.md`'s commands gain both lines.

## M4D.6 What keeps the registry honest

Each is a test, watched failing before it is trusted:

- **Complete entries.** Every code has every field, and `refuses` is a boolean.
- **Bands.** Every code falls in a band its `concern` owns, and its prefix matches `emitted_by`
  (`CS` schema, `CW` weaver, `CA` api).
- **Ownership.** A scan of each package's source finds only its own prefix: no `CW` literal in
  `code-schema`, no `CS` literal in `apps/api` except where it passes a schema problem through.
- **Nothing dead.** Every declared code is emitted somewhere in the source, unless it is marked
  `retired`.
- **Nothing undeclared.** A `Problem` built with an undeclared code raises; the weaver's and the
  API's literals are all declared.
- **The page is current** (M4D.5), and the API's error answers carry their codes.

## M4D.7 Numbering what exists

Every existing message gets a code, **in the band of its concern and in the order its module
reads**, so `CS0001` is the first check a node's fields meet. The plan writes the whole mapping
out — module, message, code — so review can read it message by message before any is assigned.
**Wording does not change.** The tests that pin whole message strings gain the code and nothing
else; that no test's meaning changes is how this part proves it is a relabelling, not a rewrite.

## M4D.8 Done when

- Every problem `code-schema validate`, `code-weaver` or the API can produce carries a declared
  code, and the registry tests in M4D.6 pass.
- `code-schema explain` answers for every code, and the reference page is generated and current.
- Content CI shows codes once the content repository's pin moves — M4.2's job, since the pin
  moves once for both the codes and the new format.

## M4D.9 Not in this part

Codes for M4's later refusals (each part adds its own, in the `CA` bands it claims); warnings that
do not refuse (the field exists; nothing emits one yet); translating messages; Ninja's 422 bodies.
