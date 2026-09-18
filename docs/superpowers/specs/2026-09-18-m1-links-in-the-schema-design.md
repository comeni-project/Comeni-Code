# M1 part 2 — links in the schema

**Status: agreed 2026-09-18.** This is part 2 of phase M1 (architecture spec R4). The parts list is
in [`2026-09-18-m1-in-parts.md`](../../notes/journal/2026-09-18-m1-in-parts.md). It builds on
[part 1](2026-09-18-m1-node-folder-and-core-fields-design.md) — the folder, the core fields, the
`Problem` shape and the canonical writer — and turns W3.2 of the
[weaving spec](2026-09-16-comeni-code-weaving-and-pages-design.md) into fields. It decides:

- the shape of a link in `node.yaml`, one shape for every kind;
- what *needs* is (a list, not groups), and the rule for what may be a need;
- where *related* is written, and what *goes deeper* may point at;
- the rules one node's file can be checked against, and their messages;
- how links are written back.

The operator made every decision here on 2026-09-18, section by section; an agent proposed them.
Three of them changed agreed specs, which were edited in the same pull request: W3.2 (reasons on
every link; *needs* as a list; two optional paths designed), W3.3 step 3 (no choices in v1), and
CLAUDE.md's invariant 2.

Rules that need **more than one file** — targets exist, *related* is symmetric, no cycles, the
level of a *goes deeper* target — are **part 3**. The Salmon fixtures are **part 4**.

---

## M1P2.1 What this part does

A node's `node.yaml` carries its *needs*, *goes deeper* and *related* links, each with a reason;
`code-schema` reads them, refuses everything a single file can show is wrong, and writes them back
canonically.

**Done when:**

- a node with all three kinds of link reads into a `Node` and satisfies part 1's three round-trip
  laws (M1P1.6), links included;
- every per-node rule in M1P2.5 has a test that fails with its exact message, and each message
  names the line of the entry at fault;
- a node with no links at all still reads, and writes no link keys;
- a typo of an optional field (`goes_deeper`) is answered with *did you mean `goes-deeper`?*;
- the purity guard passes with no new allowlist lines — this part needs no new import.

**Out of scope:** everything needing the whole graph (part 3); the fixtures (part 4); *helps* and
*any-of*, which are designed in W3.2 and not wired (M1P2.3); the page and map that show links
(M3 and later).

## M1P2.2 One shape for every link

Every link, of every kind, is a mapping with exactly two keys:

```yaml
needs:
  - node: what-tpm-measures
    reason: Salmon reports abundance in TPM.
goes-deeper:
  - node: pufferfish-index
    reason: How Salmon fits a transcriptome's k-mers into memory, and why that makes it fast.
related:
  - node: kallisto
    reason: kallisto does the same job by pseudoalignment, without Salmon's bias correction.
```

- **`node`** is the target's id — a slug, the target's folder name (M1P1.2).
- **`reason`** follows the claim's rule: one line, ending in `.`, `?` or `!`, at most 200
  characters. It is written from **this page's point of view**, and each kind's reason answers
  its own question:

| Kind | The reason answers |
|---|---|
| *needs* | why you need it first |
| *goes deeper* | what more you get there |
| *related* | **how it differs from this node** |

**Why every link has a reason.** A reason is what the learner reads — a route's *why it is here*
is built from *needs* reasons (W3.3 step 6), and a side-door is worth opening only if it says what
is behind it. It is also **the check that a link belongs**: an author, or a model proposing links
(a declared model site), who cannot write one has a feeling rather than a link, and a reviewer has
nothing to approve. The target's claim cannot stand in: it says what the target is, not how it
relates to *this* node.

**One shape is also less to build:** one parser, one set of messages, one canonical form for all
three kinds, and for the two designed optional paths when they arrive.

**Rejected:**

| Alternative | Why not |
|---|---|
| Reasons on *needs* only; plain id lists for the others | the page would say *Related: kallisto* and nothing more; "more about Salmon" and "OH THIS IS RELATED" are what an unreasoned link reads as. The operator's objection, and it held |
| A bare id for *needs* with the reason optional | an optional reason is a missing reason; the route's *why it is here* would have holes |
| Different shapes per kind | three parsers and three sets of messages for no difference in meaning |

## M1P2.3 *needs*: a list, and what may be a need

**The list means *all of these*.** Each entry is one node. W3.2 had *all of* and *any of* groups;
writing examples showed that a group's single reason is either vague (*"Salmon needs these to make
sense"*) or wants splitting, and once every group is split, *all of* is just the list. The route is
the plain closure of *needs*, shortened only by evidence of what the learner knows (placement,
test-out, work done — W3.3 step 4).

**A need is what understanding the claim requires, never how to operate a tool.** *Salmon*'s claim
can be understood without a shell, so *command-line basics* is not one of its needs — and not a
peer, since nobody reads it instead of *Salmon*. Ways to run something are **resources in the body**
(T4): Salmon's documentation, the Galaxy Training Network's tutorial, the Labs pipeline. A practical
node (*Working with FASTQ files*) may need *command-line basics* in the ordinary way. No validator
can check this; S6's review does.

**Optional paths are designed, not wired.** W3.2 describes two, and this part only keeps the door
open for them:

- ***helps*** — a list beside *needs*, same entry shape, never added to a route; a detour the
  learner may take.
- ***any-of*** — an entry inside *needs* with `any-of: [a, b]` and a `default`; the default goes on
  the route and the learner may switch.

Both arrive **without changing a single existing node**: entries are mappings, so a mapping with an
`any-of` key is a second entry kind beside `node`, and `helps` is a new optional field. Until they
are wired, both are **refused** like any unknown key — so no content depends on them before their
rules exist. M1 part 4's Salmon fixtures are the first evidence of whether either is needed.

**Rejected:**

| Alternative | Why not |
|---|---|
| *all of* / *any of* groups (W3.2 as it stood) | a shared reason is vague; the list is already *all of*; choices guessed from "what the learner holds" rarely fire, because a new learner has no evidence |
| Choices resolved by shortest remaining route | an author's judgment (audience, level) is a better signal than a count of stops |
| A bare list of ids (`needs: [k-mers, graphs]`) | no room for a reason, and no room for a second entry kind later without rewriting every node |
| *command-line basics* as a need of a conceptual node | would add a tool-operation stop to every route through the node, for a skill its claim does not depend on |

## M1P2.4 *goes deeper* and *related*

**Related is written on both nodes**, each with its own reason from its own page:

```yaml
# salmon/node.yaml
related:
  - node: kallisto
    reason: kallisto does the same job by pseudoalignment, without Salmon's bias correction.
```

```yaml
# kallisto/node.yaml
related:
  - node: salmon
    reason: Salmon adds GC and positional bias correction, at some cost in speed.
```

Opening any `node.yaml` then shows **every neighbour it has** except the derived *needed by*. The
double edit is Studio's to make — its content API writes both sides in one call (W5.2), so neither
a person in S2 nor a model remembers anything — and part 3 refuses a link written on one side only.
The cap of four is a rule on one file.

**Goes deeper is written on one node**, the shallower one, and points **to the same level or
higher, never lower**. *Salmon* (Intermediate) → *pufferfish index* (Advanced) is the usual case;
*Transcription* → *Transcription termination*, both Introductory, is deeper in detail at the same
level and is fine; a lower target is the way back up, which is derived. The target's level is in
another file, so the check is part 3's.

**Rejected:**

| Alternative | Why not |
|---|---|
| *Related* on one side, either one, mirrored by the index | a file no longer shows its own neighbours, a reviewer of one node never sees the link, and the cap becomes a graph rule |
| *Related* on the alphabetically first side | *rsem* would list *salmon* and *salmon*'s file would show nothing — a rule nobody would guess |
| A `related.yaml` of pairs at the content root | symmetric by construction and one edit per link, but node files stop being the whole truth, one shared reason cannot hold two points of view, and every batch touching a peer edits the same file |
| *Goes deeper* strictly to a higher level | refuses real depth at one level (*Transcription* → *Transcription termination*) |

## M1P2.5 The per-node rules, and their messages

All three fields are **optional**. A *First steps* node may need nothing, and most nodes have no
peers. **An empty list is written by leaving the key out** — `related: []` is refused, so the
canonical form has one spelling.

| Rule | Message |
|---|---|
| the field is a list of links | `salmon/node.yaml:7: needs: must be a list of links, each with a node and a reason` |
| the list is not empty | `salmon/node.yaml:7: needs: an empty list is written by leaving the field out` |
| each entry is a mapping | `salmon/node.yaml:7: needs: "k-mers" is not a link — write node: and reason: on separate lines` |
| an entry has no other keys | ``salmon/node.yaml:9: needs: unknown key `why` in a link (a link has node and reason)`` |
| an entry has a node | `salmon/node.yaml:8: needs: a link has no node` |
| the node is a slug | `salmon/node.yaml:8: needs: "K-mers" is not a node id (lower case, digits and single hyphens)` |
| an entry has a reason | `salmon/node.yaml:8: needs: the link to k-mers has no reason` |
| the reason is one sentence | `salmon/node.yaml:9: needs: the reason for k-mers must end with . ? or !` |
| no node twice in one list | `salmon/node.yaml:12: needs: k-mers is listed twice (first on line 8)` |
| no link to itself | `salmon/node.yaml:8: related: salmon links to itself` |
| *related* has at most four | `salmon/node.yaml:20: related: 5 peers, at most 4 — a node with more is probably two nodes` |
| no node under two kinds | `salmon/node.yaml:14: related: kallisto is also under needs (line 5) — a node is one kind of neighbour, not two` |

- **Lines are the entry's own** — part 1 keeps key lines per mapping, which is what makes the second
  entry's problem name the second entry's line. A problem about a whole entry names its `node`
  line; a problem about the reason names the `reason` line; a list-level problem names the field's
  key.
- **Two kinds at once is a contradiction.** *Needs* X and *related* X means before *and* instead of;
  *needs* X and *goes deeper* X means before *and* after. The message names both lines.
- **A typo of any field gets a suggestion**, not only of a required one: `goes_deeper` →
  *did you mean `goes-deeper`?*. The suffix *(… is required and missing)* is added only when it is
  true.
- **Every problem in a node is still reported in one run**, links and core fields together, sorted
  by line.

In code, the links become `Link(node: str, reason: str)`, and `Node` gains `needs`, `goes_deeper`
and `related`, each a tuple of `Link` in the author's order, empty by default. The YAML keys are
`needs`, `goes-deeper` and `related`.

## M1P2.6 Writing links back

The canonical form (M1P1.6) gains the three keys **after `minutes`, in the order `needs`,
`goes-deeper`, `related`**, each omitted when empty. Entries keep the author's order, and within an
entry `node` comes before `reason`. **Lists are indented under their key** (`  - node: …`), as every
example in the specs is written; PyYAML's default puts the dash at the key's column, so the writer
uses a dumper that indents them. The three round-trip laws now hold with links.

## M1P2.7 What part 3 inherits

The rules that need more than one file, each already given a home by this part's decisions:

- every link's `node` names a node that exists;
- *related* is symmetric — each side names the other;
- *needs* has no cycle, and neither does *goes deeper*;
- a *goes deeper* target is at the same level or higher.

## M1P2.8 Risks

- **Reasons are prose, and prose can be empty of meaning** (*"Related to Salmon."*). The validator
  checks form, not content; S6's review and the per-kind question (*how does it differ?*) are the
  defence. If S2 shows a pattern of empty reasons, a model-scored reason check is a later, declared
  model site.
- **Symmetric *related* doubles the hand edit.** Studio makes both; a person editing YAML by hand
  must edit two files, and part 3's message says exactly which.
- **The optional paths may never be wired.** That is the intent if content does not ask for them;
  W3.2 keeps their design so they are not reinvented differently later.
- **A need that is really a tool** (*command-line basics* under *Salmon*) passes every check in this part.
  The rule in M1P2.3 is enforced by review alone.
