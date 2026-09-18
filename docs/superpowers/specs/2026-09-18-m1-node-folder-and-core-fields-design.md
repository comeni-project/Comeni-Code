# M1 part 1 — the node folder and its core fields

**Status: agreed 2026-09-18.** This is part 1 of phase M1 (architecture spec R4). The parts list is
in [`2026-09-18-m1-in-parts.md`](../../notes/journal/2026-09-18-m1-in-parts.md). It is the first
part of the project that touches content, and what it settles is the format every later node is
written against, in this repository and in `comeni-code-content`. R3 left the exact fields to M1;
this spec decides them:

- what a node folder holds, and what identifies a node;
- the core fields of `node.yaml`, and the region registry they need;
- the envelope `body.md` must obey, and what M1 checks inside it (almost nothing);
- how files are parsed, and what a problem message says;
- how files are written back, and what "round-trips" means.

The operator made every decision here on 2026-09-18, section by section. An agent proposed them.

Links are **part 2**; anything needing the whole graph is **part 3**; the Salmon fixtures are
**part 4**. The block vocabulary inside `body.md` is **M3**.

---

## M1P1.1 What this part does

`code-schema` reads a node folder into a `Node`, tells an author precisely what is wrong when it
cannot, and writes a `Node` back as the same bytes it read. Nothing else in the system exists yet
— no graph, no index, no command.

**Done when:**

- `code-schema` reads a node folder into a `Node`, writes it back, and a node built by the test in
  `tmp_path` satisfies the three round-trip laws of M1P1.6 (the curated Salmon set is part 4);
- every field rule has a test that fails with its exact message, including `schema: 2` refused as
  *this node is schema 2; this validator understands 1*;
- one run reports **every** problem in a broken node, each naming the file, the field, and the line
  where there is one;
- `regions.yaml` is parsed and validated, and an unknown region is refused with the closest match;
- a missing or empty `body.md` is refused;
- the purity guard passes with the allowlist lines this part adds, changed in the same pull
  request that needs them.

**Out of scope:** links (part 2), graph rules and the validate command (part 3), the Salmon
fixtures (part 4) — part 1's tests build their files in `tmp_path` from text written in the test,
so `tests/fixtures/` stays one curated set rather than a scattering of ad-hoc nodes. Also out:
the index (part 5), the API (part 6), the block vocabulary (M3), and replacing the content
repository's `validate.py` stub, which waits for part 3's command.

## M1P1.2 The folder, and what identifies a node

```
salmon/
  node.yaml      the fields of M1P1.3, and part 2's links
  body.md        one file, required, opaque in M1
  data/          YAML payloads referenced from body blocks — unused until M3
```

- **The folder name is the id.** There is no `id:` field. `salmon/` is the node `salmon`, and
  part 2's links name it as `salmon`.
- **A folder is a node when it holds `node.yaml`.** Folders may nest for browsing
  (`sequence-analysis/salmon/`), the **leaf name is the id**, and a node folder may not contain
  another node folder — one node, one folder, no ambiguity about which `body.md` belongs to whom.
- **Ids are slugs:** `^[a-z0-9]+(-[a-z0-9]+)*$`, **unique across the whole tree** whatever the
  nesting.
- **A rename is a folder move and rewritten links, in one pull request.** Part 3's dangling-link
  rule makes that safe rather than hopeful.

**Rejected:**

| Alternative | Why not |
|---|---|
| An `id:` field, the folder a mere location | two things to keep in sync, and a reviewer reading a diff cannot tell which node a file belongs to |
| An opaque stable id plus a slug (`01J9X4ZK…` + `salmon`) | renames become free, and every link in a diff becomes unreadable. Content lives in git so that a person can review the diff; this trades away the reason |
| The id as the full relative path (`sequence-analysis/salmon`) | folders would then be part of every link, so moving a node for tidiness would rewrite the graph |

**Noted, not decided:** if content ever leaves git for a central database, ids become rows and
this rule goes with the files. Nothing outside the schema package depends on it.

## M1P1.3 The core fields, and `regions.yaml`

A field exists only if something reads it — the same criterion the link kinds were held to (W3.2).

| Field | Example | What reads it |
|---|---|---|
| `schema` | `1` | the loader and the validator, so a format change is detected rather than guessed at |
| `title` | `Salmon` | every screen |
| `claim` | `Salmon quantifies transcript abundance from RNA-seq reads without aligning them to the genome.` | L4's selected-stop panel, L5's top, S2's rows. W3.1's *one claim per node*, as a field |
| `region` | `sequence-analysis` | route ordering ties (W3.3 step 5), S2's tree, L12's facets |
| `level` | `intermediate` | T10.1's five levels; the direction of a *goes deeper* link; S2's health warning when a node needs one two levels above it |
| `minutes` | `12` | L4's *time left with a pace estimate*, the route preview's *40 stops · about 9 h*, L2's placement value |

All six are **required**, the set is **closed** (an unknown key is a problem), and the rules are:

- `schema` is exactly `1`. A higher number is refused by name, not parsed hopefully.
- `title` is one line, at most 80 characters.
- `claim` is **one line, ends with `.`, `?` or `!`, and is at most 200 characters.** "One sentence"
  is the guidance; this is the enforceable form of it. Counting sentences is a rule we cannot keep
  (*e.g.* alone breaks it), and a rule that misfires on good content is worse than a length.
- `region` is an id listed in `regions.yaml`.
- `level` is one of `first-steps`, `foundations`, `introductory`, `intermediate`, `advanced`
  (T10.1).
- `minutes` is a whole number of at least 1. **No upper bound:** W3.1's 5–15 minutes is an
  authoring guide, and hardening a soft bound into a refusal would make the validator wrong about
  content that is right.

**`regions.yaml` sits at the content root** and is the only file that is not a node. Part 1 owns it
because `region` cannot be checked without it:

```yaml
regions:
  - id: sequence-analysis
    name: Sequence analysis
  - id: molecular-biology
    name: Molecular biology
```

Ids are slugs and unique; names are one line. A new region is a pull request, which is the right
amount of friction for a classification that appears on three screens.

**Rejected:**

| Alternative | Why not |
|---|---|
| `region` as free text | it drifts within a month (`sequence-analysis`, `sequence analysis`, `Sequence Analysis`) and every facet and tie-break quietly splits in two |
| Regions with parents, a tree | nothing reads a tree yet; S2's tree can be built from a flat list plus a later `parent` field without changing a single node |
| `minutes` derived from the body's length | the body is opaque in M1, and a computed estimate would change under an author with no way to correct it |
| `minutes` deferred to M2 | the weaver needs it for every time figure on L4, and adding a required field after content exists is a migration across a second repository |
| Provenance, review state, resources, aliases | provenance and review state land with M4; resources need the block schema (M3); nothing reads aliases yet |

## M1P1.4 The body envelope

`body.md` is a **block document** (W5.1) — prose plus typed blocks, rendered by our components, so
nothing an author or a model writes can inject markup. Studio edits *blocks* in Postgres (W5.2);
landing writes the files. **The file is therefore an export and review format**, and it has three
jobs: derivable from blocks without loss, parseable back into the same blocks (R3 rebuilds the
index from files alone), and **readable as a diff** — the reason content lives in git at all.

The envelope, decided here so that M3 does not have to renegotiate the layout:

1. `body.md` is **MyST Markdown, UTF-8, required, non-empty**. One file per node.
2. **Blocks are MyST directives** — ` ```{name} ` with YAML options and content. Prose between
   directives is a `text` block; nobody writes `{text}` by hand.
3. **The directive set is closed.** An unknown directive is refused, as an unimported module is in
   the purity guard. The set is empty in M1 and fills in M3, so adding a block type is a reviewed
   change rather than something a model can invent.
4. **Payload data is never inline.** A block whose value is data references `data/<name>.yaml`
   through an option (`:data: pufferfish-index`), so prose diffs stay prose.
5. **Writing is canonical, one way only**, and `parse(write(blocks)) == blocks` is a test M3 must
   pass.

**The claim lives in `node.yaml` only.** W5.1 lists a `claim` block; it becomes a *rendering* of
the field, not something an author writes twice. Two places holding one sentence is drift waiting
to happen.

**What M1 checks inside the body: that it exists, is UTF-8, and is not empty.** Not that it parses
as MyST. Nearly any text is valid Markdown, so the check proves almost nothing, and it would pull a
Markdown parser into a pure package's allowlist to buy it. The first real body check is rule 3,
when there is a closed set to check against.

**Rejected:**

| Alternative | Why not |
|---|---|
| `blocks.yaml` — Wagtail's StreamField on disk | exact and trivial to load, and unreadable as a diff: prose inside quoted YAML strings, re-indented on every edit. It stays the fallback if block → MyST → block proves lossy in M3, and `schema: 1` is what makes that switch cheap |
| Several body files per node | a node is one claim and 5–15 minutes; splitting it buys nothing and adds an ordering decision and worse diffs |
| Free Markdown, no block vocabulary | invariant 6: content is validated blocks, and nothing an author or a model writes may inject markup or styling |
| Deciding the block vocabulary here | a `figure` serialises a component name and its data, and the components do not exist yet (W5.3); a `problem` carries a generator and checker M3 designs |

## M1P1.5 Parsing, problems and messages

**`comeni-code-content`'s own CI must run this** (P9.2 replaces its `validate.py` stub in part 3),
and that CI has no Django and no index. So the package reads files itself, in two layers:

```python
parse_node(node_yaml_text, body_text, *, node_id) -> tuple[Node | None, list[Problem]]
read_node(folder: Path)                           -> tuple[Node | None, list[Problem]]
```

Everything interesting is testable without a filesystem; `read_node` is the thin wrapper that
takes the id from the folder name.

**Nothing raises.** Problems accumulate and are returned, so one run reports every problem in every
node — a content pull request fails once with a complete list, not once per round trip. A
`yaml.YAMLError` is itself a problem, with the mark's line.

**A problem is one line:**

```
salmon/node.yaml:3: unknown field `clam` — did you mean `claim`? (claim is required and missing)
salmon/node.yaml:4: region: "sequence analysis" is not a region — regions.yaml lists 7, closest is `sequence-analysis`
salmon/node.yaml:5: level: "expert" is not a level (first-steps, foundations, introductory, intermediate, advanced)
salmon/node.yaml:6: minutes: "twelve" is not a whole number
salmon/: body.md is missing
```

Path relative to the content root, then the line where there is one, then the field, then what is
wrong and what was expected.

- **Line numbers come from a `SafeLoader` subclass** that records each key's line as it constructs
  mappings. `yaml.safe_load` discards the marks, and no schema library can recover them — it only
  ever sees the dict. The payoff is not only better text: the content repository's CI can emit
  `::error file=salmon/node.yaml,line=5::…` and GitHub prints it **on the diff line**, where the
  reviewer already is. A missing field has no line, and says so by omitting one.
- **A typo reports once.** An unknown key that closely matches a missing required field
  (`difflib.get_close_matches`) merges both problems into one line that says what to do. Any schema
  library would report two.
- **No coercion.** `minutes: "twelve"` fails, and so does `minutes: "12"`. A coerced value means
  the file and the object disagree, and the canonical writer would rewrite the file on the next
  landing.

**Validation is table-driven**, so part 2 adds rows rather than rewriting anything:

```python
@dataclass(frozen=True)
class Problem:
    file: str  # "salmon/node.yaml"
    field: str | None  # "level"
    message: str
    line: int | None


FIELDS = (
    Spec("schema", required=True, check=exactly(1)),
    Spec("title", required=True, check=one_line(max_len=80)),
    Spec("claim", required=True, check=one_sentence(max_len=200)),
    Spec("region", required=True, check=in_registry("regions.yaml")),
    Spec("level", required=True, check=one_of(LEVELS)),
    Spec("minutes", required=True, check=whole_number(minimum=1)),
)
```

**The allowlist in `tests/guards/purity.py` gains** `pathlib`, `dataclasses`, `enum`, `re`,
`difflib`, `collections.abc` and `yaml`, in the pull request that needs them. None is a web
framework, an HTTP client or a model library.

**Rejected:**

| Alternative | Why not |
|---|---|
| **pydantic v2** | shorter, and Ninja is pydantic underneath — but the line map, the "did you mean" merge, the registry lookup, the claim rule, the missing-`body.md` check and the rendering of every message stay ours either way. It saves the type checks, the cheapest part, and puts a compiled dependency in the package whose identity is being pure and small. Its `schema`/`BaseModel.schema` collision on our first field is a fair omen. Part 6 serves from Postgres models, not from these objects, so the composition saves less than it looks |
| Raising on the first problem | an author fixes one thing per round trip; a content pull request should fail once with everything |
| `ruamel.yaml` for the line map | round-trip loading carries comments we deliberately do not keep (M1P1.6), and the marks are 15 lines of `SafeLoader` |
| JSON Schema | the messages would be someone else's, and they are a done-when of M1 |

## M1P1.6 The canonical writer, and what round-trips means

**There is exactly one correct way to write a node.** Fixed field order (`schema`, `title`,
`claim`, `region`, `level`, `minutes`, then part 2's links), block style, no key sorting, no line
folding — a long claim stays on one line — quotes only where YAML requires them, two-space indent,
LF, one trailing newline. `body.md` is written back byte for byte, since M1 does not look inside
it.

**Three laws, each a test:**

1. `read → write → read` gives an equal `Node`: nothing is lost in either direction.
2. For a canonical file, `write(read(f)) == f` **byte-exact** — landing a node nobody edited
   produces an empty diff.
3. `write` is idempotent: no file drifts by being rewritten.

**Comments in `node.yaml` are not preserved.** Files are generated by landing, and the next write
drops a hand-added comment. That is the right trade — the journal and the specs are where reasons
live — but it means `node.yaml` is not a place to leave a note, and the spec says so rather than
letting someone find out.

## M1P1.7 Risks

- **This is the expensive format to change.** Once fixtures and content are written against it, a
  field rename is a migration of files in another repository. `schema: 1` is the mitigation: a
  breaking change bumps it, and the validator refuses what it does not understand instead of
  misreading it.
- **The folder is the id**, so a rename touches every link that names it. Part 3's dangling-link
  rule is what makes that a safe operation; until part 3 exists, a rename is unchecked.
- **`minutes` is an author's guess.** Nothing measures it in M1, and every time figure on L4 is
  built from these guesses. If they prove wildly off, the answer is a measurement in a later phase,
  not a validator rule.
- **The body envelope is a promise M3 must keep.** If block → MyST → block turns out lossy,
  `blocks.yaml` is the fallback and the diff quality is what is lost. Nothing else in M1 depends on
  the body's internals, which is what keeps that switch cheap.
- **A closed field set refuses tomorrow's field.** Adding one is a reviewed change to this spec and
  to the table — which is the intent, not a side effect.
