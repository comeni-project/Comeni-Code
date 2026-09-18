# Comeni Code — weaving, pages and identity

**Status: design, not agreed implementation.** Written 2026-09-16 from a brainstorming session.
It is the second design document and builds on
[`2026-09-02-comeni-code-design.md`](2026-09-02-comeni-code-design.md). That document says what
Code is for and why its predecessors died. This one settles **how routes are made** (weaving),
**which screens exist and how people move between them**, **how figures are made**, and **what
the product looks like**. Where the two disagree, this one is newer and wins; the first document
has been edited to point here. Section numbers like §5.5 refer to the first document; numbers
like W3 refer to this one.

Nothing here has been built.

**Revised 2026-09-17:** [`2026-09-17-code-as-tutor-design.md`](2026-09-17-code-as-tutor-design.md)
is now the current statement of the product. Code is the tutor on top of existing material. That
spec adds outside resources and video, skeletons, step backs, hints, stored evidence and block
scores, and wins where the two disagree. The sections it changes say so below.

---

## W1. The idea, in one paragraph

**Nodes are the product. Tracks are woven.** A node is one topic — *DNA*, *gene expression*,
*k-mers*, *de Bruijn graphs*, *sequence alignment*, *Salmon* — written once as a standalone page,
checked by a person, and reused everywhere. A learner states a goal ("I want to understand
Salmon"). The goal resolves to one to three target nodes, and the route to them is **computed by
walking the nodes' directed "needs" links backwards**, minus what the learner already knows.
Because every node declares what it needs, the network expands on its own: writing one new node
makes every goal that reaches it possible. The only per-route writing is short **connecting
text**, which AI drafts and a human reviews. Pages grow with the number of *topics*, never with
the number of *courses* — that is the scaling argument, and §8.2's "the writing is the product"
is why it matters.

*2026-09-17: nodes now also point outward to the best existing teaching, and the first nodes are
drafted from public course outlines (tutor spec T1, T4, T5). Weaving is unchanged.*

The Salmon example is a real one: since version 1.0 Salmon's default index is pufferfish, which is
built on a compacted coloured de Bruijn graph, so *de Bruijn graphs* genuinely belongs on the route
to *Salmon*.

---

## W2. Decisions taken in this session

All decided by the operator on 2026-09-16.

| Question | Decision |
|---|---|
| Who writes content in v1? | **A small invited team** — the operator plus a few experts. |
| What is a track? | **A route woven from a goal**, not an authored sequence. Supersedes §6.1. |
| Who finds the route? | **A deterministic walk over the links**, not a model (W3.3). AI proposes targets, links and connecting text; it never decides the route. |
| What links can a node have? | **needs**, **goes deeper**, **related** (W3.2). Only *needs* builds a route. |
| What can a goal be? | **One to three target nodes.** The route is the union of the walks back from each. |
| What happens when someone types a goal? | **The route appears at once** from approved nodes. AI connecting text shows as *not yet reviewed* until a human approves it. |
| Who can use a woven route? | **Its learner immediately; everyone once reviewed.** A reviewed route becomes a named track in the catalogue. |
| A goal or node that does not exist yet? | **It goes to a request queue, and moves to the implementing queue only when a human has seen it** (W3.6). |
| Where does a new learner land? | **"What do you want to learn?"**, then a route preview, then optional placement on that route. |
| Where do commands run? | **On the learner's machine.** Nothing runs on our side (§5.1.1). |
| How is a node presented? | **One page, written for university students and researchers, with questions inline.** *(2026-09-17: written at the node's **level**, First steps to Advanced — tutor spec T10.1.)* "Try it" blocks expand in place, hold the interactive figures, and return in review. Revised the same day: an earlier stepped-screens / reference-page split was judged oversimplified for this audience. |
| How is a route drawn? | **As a metro map that branches and merges** (§2.0.2's form): lines leave the start and all end at the goal, stops where lines meet are interchanges, and a need that doesn't lie along a line is a thin connector. Most routes aren't linear; a single straight line would misrepresent them. A list view gives the same order as text. |
| What does Home show? | **The route you last opened**, not the whole network. The full network lives on *Your knowledge* (L9). |
| Visual identity | **The Comeni hybrid**, shared with Labs (W10). |

Learn and Studio are **one application with two sides**, sharing the node renderer, the network
view and the tokens; Studio's *land* step writes node files into git (§5.4). Rejected: Studio as a
git-and-CLI workflow (a diff cannot force a reviewer to engage, §5.5), and a wiki edit button on
learner pages (no per-hole approval).

---

## W3. Nodes and weaving

### W3.1 A node stands alone

A node is a complete page on one topic: its claim, what it needs, exposition, figure, worked
example, check, problem, misconception (§5.1, W5). *(2026-09-17: each node also has a **level**,
which describes its content, never the learner — tutor spec T10.1.)* It **must read correctly with no route around
it** — a learner may arrive from search, from Labs, or from any of a hundred routes.

Granularity follows Math Academy's experience: a topic that turns out to hold several ideas is
**split**, and split/merge are first-class Studio actions (S2). A working bound, to be tuned: a
node is **5–15 minutes** of learning and has **one** claim.

### W3.2 Three kinds of link, all directed

*Revised 2026-09-18 (operator), before M1 fixes them in the schema. The three kinds and what they
may do are unchanged. What is new: each kind now carries **one reason for existing** and **one
reader's question it answers**, *related* is narrowed to the peer test and capped, and the
neighbours that are derived rather than authored are named. A kind exists only if it changes a
route, answers a question no other kind answers, or feeds a health check.*

*Revised again 2026-09-18 (operator, M1 part 2 — [spec](2026-09-18-m1-links-in-the-schema-design.md)):
**every link carries a reason**, not only *needs*; *needs* is **a list of entries, not *all of* /
*any of* groups**; and two **optional paths** — alternatives and detours — are designed here but
not wired in v1 (below).*

**Three directions, and an author picks one by asking which question the link answers:**

| Link | Direction | The reader's question | Means | Bounded by |
|---|---|---|---|---|
| **needs** | what comes **before** | *What must I already know?* | B cannot be understood without A | what the topic requires |
| **goes deeper** | what lies **below** | *Where do I go for more?* | A is this topic taken further | the levels of this topic |
| **related** | what stands **beside** | *Am I in the right place?* | A is what a learner might be reading **instead of** B | the peer test, and a cap of 4 |

**Why each one exists:**

- ***needs* exists for the weaver.** These edges are the only input to a route (invariant 1);
  every computed thing in the product — the metro map, the time estimate, what a learner may skip,
  the step back — is derived from them and from nothing else. **A list of entries, each one node
  with a reason**; the list itself means *all of these*. Reviewed as its own hole, one entry at a
  time (§5.1).
- ***goes deeper* exists because depth cannot live inside a node.** A node holds one claim, runs
  5–15 minutes (W3.1) and carries one level (T10.1), so *Transcription* at Foundations and at
  Intermediate are necessarily two nodes and something has to join them. And because a route
  **ends**: a learner who finishes and wants more has no move except inventing a new goal, and
  this is the one exit from a finished route. Written on the shallower node, pointing further on
  — to a node at the **same level or higher, never lower** (deeper in detail at the same level is
  common and fine; a lower target is the way back up, which is derived). A side-door on the page, **never added to a route**. Reviewed with
  the node.
- ***related* exists because a learner can move sideways only by knowing a word.** Search (L10)
  finds by the word the learner already has, which is exactly what someone new to a field lacks;
  L12 browses tracks, not nodes. Without it the graph is a strict tree of *needs* and depth. It
  matters most where there is no route at all — from search, or from Labs (L11), where no route
  exists to offer an alternative. It is also read by goal resolution
  (W3.3 step 1), which proposes targets from a human-approved set of peers instead of inventing
  them. Symmetric: written once, shown on both pages. Reviewed with the node, lightest review.

**The peer test.** *Related* means **what a learner might be looking at instead of this node** —
not "interesting nearby", not "same area". *Instead of.* Every other kind is bounded by something
real; "worth reading together" is bounded by nothing, which is how a *See also* list grows to a
dozen and stops being read. Most nodes have none to three; **the validator refuses more than
four**, and a node that wants eight is telling its author it should be split. Any node may be a
peer of any other — the test does the fencing, not regions.

Worked: *Salmon*'s peers are *kallisto*, *RSEM* and *STAR + featureCounts*; *What TPM measures*
has *What FPKM measures* and *Raw counts and why they mislead*, which is how the classic
confusable pair is served without a kind of its own. *DESeq2* is **not** a peer of *Salmon* — it
comes after, and appears free as *needed by*.

**Two relations the peer test deliberately excludes**, because each is better served elsewhere:

| Excluded | Example | Where it goes |
|---|---|---|
| **Transfer** — the same idea in another field | *k-mers* ↔ *hash functions* | body prose, in the sentence that explains the connection — which teaches more than a chip in a side panel |
| **Siblings** — the next thing in a process | *Transcription* ↔ *Translation* | a route gives the next stop; off a route, both hang under the need they share |

**Derived neighbours, never authored:** **needed by** (the inverse of *needs*, shown on L5),
**used in** (the same edges read forwards), and the way back up from a *goes deeper*. **Step back
to** (T6.1) is not a kind either: it is a pointer on a `misconception` callout, constrained to a
*needs* ancestor.

Only *needs* is load-bearing, and it is where review effort goes: **a wrong *needs* link corrupts
every route that passes through it.** *Goes deeper* and *related* only change what a page offers.
*needs* links may not form a cycle; S2's health check refuses one. *Goes deeper* may not form one
either — a topic cannot be further on than itself — and the validator refuses it.

**Every link has a reason, written from this page's point of view.** A reason is what the learner
reads, and it is also the check that a link belongs: an author — or a model proposing links — who
cannot write one does not have a link, only a feeling, and a reviewer has nothing to approve. Each
kind's reason answers its own question:

| Kind | The reason answers | *Salmon*'s example |
|---|---|---|
| *needs* | why you need it first | *Salmon reports abundance in TPM.* |
| *goes deeper* | what more you get there | *How Salmon fits a transcriptome's k-mers into memory, and why that makes it fast.* |
| *related* | **how it differs from this node** | *kallisto does the same job by pseudoalignment, without Salmon's bias correction.* |

*Related* is written **on both nodes**, each with its own reason from its own page, so opening any
`node.yaml` shows every neighbour it has (only *needed by* is derived). Studio's content API writes
both sides in one call; the validator refuses a link written on one side only.

**A need is what understanding the claim requires, never how to operate a tool.** *Salmon*'s claim
can be understood without a shell, so *command-line basics* is not one of its needs, and it is not
a peer either — nobody reads it instead of *Salmon*. Ways to run something (Salmon's documentation,
the Labs pipeline) are **resources in the body** (T4),
which the learner picks from without the route growing. A practical node, such as *Working with
FASTQ files*, may need *command-line basics* in the ordinary way.

**Optional paths — designed, not wired in v1.** A route must never change on its own except
through *needs*; anything optional happens only when the learner opens it. Two shapes are designed
so that nobody reinvents them, and each is wired only when real content (M1 part 4's Salmon
fixtures and after) shows it is needed. Both are additive: no existing node changes when they
arrive, and if one proves confusing it is removed while that is still cheap.

| | required | optional — the learner opens it |
|---|---|---|
| **before** | *needs* (auto-expands) | *helps* (a detour) · *any-of* (a switch) |
| **below** | — | *goes deeper* |
| **beside** | — | *related* |

- ***helps* — "you'll find this easier if…".** A list beside *needs*, same entry shape, **never
  added to a route**; the map shows it as a dotted side stop before the node, which the learner
  may add. It is the home of the soft prerequisite (*Salmon* is helped by *probability
  distributions*), which otherwise becomes a weak *need* and lengthens every route through it.
- ***any-of* — "one of these".** An entry inside *needs* naming two or more nodes and a
  `default`. **The author's default goes on the route**; the stop reads "or: …" and the learner
  may switch; stored evidence that the learner knows another member meets the entry. Nothing is
  guessed from route length. For two treatments that should not be merged — the same idea written
  for two audiences: *de Bruijn graphs* needs any of *graphs* and *graphs for biologists*, default
  the latter; a computer-science student who has tested out of *graphs* is ready, a biologist gets
  the biology-framed version. Two nodes with one claim are otherwise a Studio health concern
  (merge them), not a schema feature.

A learner's choices are part of their state, so invariant 1 holds: the same graph, goal and choices
give the same route.

**On maps, the learner chooses what to see.** A metro map draws the *needs* strand always; **goes
deeper and related are a toggle, off by default** (L4, L9, and the side column of L5), drawn
distinctly from the route. Turning them on never changes a route, a time estimate or a stop order
— it adds side-doors to a picture that is already computed. Invariant 12 still holds: learners see
the metro style only; neighbourhood and box drawings stay in Studio.

**Rejected as further kinds:**

| Alternative | Why not |
|---|---|
| **helps, not required** (a soft prerequisite) | the kind authors would most often confuse with the two either side of it, and its whole job is one sentence a page can say in prose. A weak *needs* link is worse than none: it lengthens every route through it. *Reversed later on 2026-09-18: as an optional detour that is **never** added to a route, it cannot weaken one, which was the objection. It is designed above and wired when content needs it* |
| **commonly confused with** | the peer test already pairs *TPM* and *FPKM*; the explanation belongs in a `misconception` callout |
| **alternative / does the same job** | off a route it is a peer; on a route, the designed *any-of* entry above |
| **application / used in** | the inverse of *needs*, read forwards — derived, not authored |
| **broader / narrower** | that is **region**, a classification, not an edge |
| **worked example, practice for** | blocks inside a node (W5) |

### W3.3 The weave

Given a goal, in order:

1. **Resolve the goal to targets.** A model proposes one to three existing nodes for the
   learner's words ("quantify my RNA-seq" → *Salmon* + *Differential expression*). The learner
   sees and confirms them. A goal no node covers goes to the request queue (W3.6).
2. **Walk back.** From each target, follow *needs* entries to their nodes, recursively.
3. ~~**Resolve *any of* groups.**~~ *Revised 2026-09-18: v1 has no choices in *needs*. When the
   designed *any-of* entry is wired (W3.2), it resolves to a member the learner is known to hold,
   otherwise to the author's default, which the learner may switch — never by route length.*
4. **Remove what is held.** Nodes the learner has settled (§9.1) or tested out of (L2) drop out,
   and so does everything *only* they needed. *(2026-09-17: "settled" is **known**, backed by
   stored evidence — tutor spec T7.)*
5. **Order.** Topologically; ties broken by region, then by the order the author declared.
6. **Explain.** Every node on the route carries **why it is there**: the chain of *needs* reasons
   back to a target ("*k-mers* — needed by *de Bruijn graphs*, needed by *Salmon*'s index").

Steps 2–6 are **pure functions of the graph and the learner's state**. The same graph, goal and
state always produce the same route — the property Labs states as *same goal in → same pipeline
out* (§1). A model is involved only in step 1, and only as a proposal the learner confirms.

**Route length is shown, never hidden.** A route of 40 nodes says so ("40 stops · about 9 h ·
you already hold 12") and offers placement before it starts.

### W3.4 Connecting text — the hard part

A standalone page does not know why *this* learner is reading it. That is Wiley's reusability
paradox (§5.2), and it is the risk the operator named. It is handled by three small per-route
texts, which is exactly where generated text is cheap and reviewable:

| Text | Where it appears | Length |
|---|---|---|
| **route introduction** | top of the route page (L4) | one paragraph: how the stops build toward the goal |
| **bridge** | between two consecutive nodes | one or two sentences: what you now have, and why the next node needs it |
| **why-for-your-goal** | a band at the top of a node when opened from the route | two or three sentences, the node's relevance to *this* goal |

**Node bodies never vary per route.** Only these texts do, which is what keeps review tractable:
a route of 20 nodes carries roughly 40 short texts, not 20 pages. This replaces §5.2's per-track
`framing` hole — framing is now the *why-for-your-goal* text, generated per route rather than
authored per track.

Connecting text is shown to the learner at once, **labelled *not yet reviewed*** until approved
in S9. The label is the §5.6 disclosure applied to a route.

### W3.5 Routes become tracks

A woven route belongs to its learner immediately. **When a reviewer approves its connecting
text (S9), it becomes a named track** in the catalogue (L12), available to everyone. Two goals
that resolve to the same target set share one track. Routes are recomputed when the graph
changes; a reviewed text whose two endpoints are no longer adjacent is flagged for re-review
rather than silently shown (a replay report, as in §5.4).

### W3.6 Requests, then implementing — a human in between

When a goal resolves to nothing, or a route needs a node that does not exist:

```
requested ──(a human sees it)──► accepted ──► implementing ──► drafted ──► approved ──► live
    │                               │
    ├─► merged into an existing node
    └─► declined, with a reason shown to whoever asked
```

- **Nothing moves out of *requested* without a person.** The model may *propose* a target, a
  new node's claim and its *needs* links, and may cluster duplicate requests, but **the move to
  the implementing queue is always a human action** (S7).
- A learner whose route hits a missing node sees it as a **"not written yet"** stop, can follow
  the request, and continues around it where the graph allows.
- The implementing queue (S8) is ordered by **how many routes a node would unblock** and how many
  learners asked. What people ask for decides what gets written next.

### W3.7 The network view

Every track drawn together is the transit map of §2.0.2 and §7.2: tracks are lines, shared nodes
are interchanges, regions are zones, thresholds are landmarks. It is **a view (L12 and on
Home), not the mechanism.** Its jobs are to show how much of a new track a learner already holds,
to make reuse visible, and — in Studio — to find orphans and disconnected clusters.

### W3.8 What could make this fail

- **Bad *needs* links.** One wrong link lengthens or breaks every route through it. Each group
  is reviewed individually with its reason, and S11 flags nodes that learners skip or fail
  unusually often on a given route.
- **Nodes that aren't really standalone.** Caught in review by reading the node with no route
  around it (S6 shows it exactly that way).
- **Routes that are too deep.** "All the way down to DNA" (§4) makes long routes. Placement,
  *I know this*, and the visible length (W3.3) are the answer; an honest long route beats a
  dishonest short one.
- **Connecting text as a new place for hallucination.** It may only refer to the claims of the
  two nodes it connects and the goal; S9 shows it beside those claims.

---

## W4. What the research says matters

The first document studied why knowledge-graph products die; this section studies what the
living ones get right on screen.

### W4.1 Learner side

- **The "what now" screen is the product.** Math Academy's learners pick from a short task list.
  Andy Matuschak's criticism is the key finding: the queue is a *black box* with no sense of how
  items relate, creating *"emotional disconnect and a feeling of passivity."* Showing *why each
  node is on your route* (W3.3 step 6) and the route itself answers that.
- **Read for a minute, then act.** Matuschak praises interleaving (*"read for 1m, then do a task"*)
  with a worked example first; Brilliant is built on the same idea.
- **Frame and close.** Galaxy Training opens tutorials with questions, objectives, prerequisites
  and time, and closes with key points; the Carpentries' template requires the same.
- **Let people skip.** The most repeated Math Academy complaint is **no skip button**.
- **Review queues kill by accumulation.** People quit Anki over the overdue pile — *the number
  becomes a source of anxiety*. Never show a backlog count.
- **Don't announce the review topic** — Matuschak predicts topic-grouped review *"will
  significantly harm transfer."*
- **Rosalind and Project Euler.** Given/Return, your own dataset, one answer; difficulty as
  **share of people who solved it**; **discussion unlocks after solving**; problems never close.
- **Questions inside serious text.** Quantum Country (Matuschak and Nielsen) embeds review
  questions in a technical essay; readers answer them in place and they return on a spaced
  schedule. Distill's interactive articles make the same case for figures a reader can operate.
  This is the model for L5.
- **Large catalogues need faceted filtering done well.** Baymard's product-list research: show
  which filters are applied (32% of sites don't), offer a filter for every attribute shown in the
  list (38% don't), and show counts. NN/g: prioritise the facets that fit the items. This is the
  model for L12.
- **Duolingo without the manipulation.** Short sessions and immediate feedback; no hearts,
  streaks, leagues or guilt (§9).
- **Metacademy already generated learning plans by walking the graph back from a target.** The
  walk works; what it lacked was reviewed content and connecting text — W3.4.

### W4.2 Authoring side

- **The costly work is tedious.** Math Academy estimates ~250 hours just to encode prerequisites
  for 1,500 topics, and splits topics that prove too broad.
- **Build a small core before opening up** — Exercism's syllabus team writes the first five or
  six concepts itself.
- **Author-shaped tools fail learners** — Canvas's *"scroll of death"*. Every Studio page that
  edits learner content has **preview as learner**.
- **Dashboards mostly describe without prescribing.** S11 lists only fixable things.
- **Editors need to see what they're making.** Current CMSs converge on the same layout: an
  outline of blocks (WordPress's list view), a settings sidebar that switches between document and
  block, a live preview beside the editor that updates as you type (Wagtail, across three
  viewports), click-in-the-preview-to-edit (Sanity's Presentation tool, Storyblok), versions you
  can compare with the live one (Contentful), and a pre-publish checklist (WordPress, Wagtail's
  moderation). S3 is built from these.
- **Figure tools lead with data, not code.** Datawrapper's steps are upload → check and
  describe → visualise → publish, and its Annotate tab carries alt text; Flourish pairs a
  template gallery with a data sheet whose columns bind to the template, and settings specific
  to that template; Storybook generates controls from a component's declared props. Penrose's
  own aim is that experts write the domain and style and authors supply only the substance —
  the split W5.3 already makes. S4 follows these. Alt text for a figure names its type, what it
  shows and why it is there, and describes the takeaway rather than every value.
- **Graph editors are search-first and local.** Node-link diagrams lose readability quickly past
  about twenty nodes except for path-following (Ghoniem et al.); Neo4j Bloom starts every
  exploration from search and expands neighbours; a comparison of ego-network views found layered
  node-link layouts the most usable; WebProtégé edits through a term tree, forms and a change
  history with discussions attached to terms. S2 follows these.
- **Queues need triage tools, not lists.** Linear's triage inbox gives each decision one key
  (accept, duplicate, decline, snooze), and only *accept* moves work into the real workflow;
  data-table guidance adds row selection with a persistent bulk bar that always states how many
  items are selected, and a list-plus-detail split so triage never leaves the list. Together with
  W4.1's filtering research, this shapes S7 and S8.

### W4.3 Figures: how Brilliant scales curation

Brilliant: designers own objectives and "aha" moments; **AI "handles the technical
implementation"** from their own code blocks, and *"every generated problem also goes through
multiple rounds of human review."* Their evals check correctness, unique solvability, visual
clarity, state consistency, impossible states and physical plausibility; the failures are all
*almost right*. Penrose (Domain / Substance / Style) and Bluefish (declared relations) reach the
same conclusion: **the model never draws; it chooses a component and fills in data.**

---

## W5. Content is structured blocks; figures are components

Extends §5.1 and partly answers first-document open question 2.

### W5.1 A node body is a block document

A node is not free HTML. It is a **document of typed blocks** — prose plus tags, in the manner of
Stripe's Markdoc (Markdown with custom tags, every tag validated against a schema) and Sanity's
Portable Text (rich text as an array of typed blocks). It is stored as a file in git (§5.4) and
rendered by our components, so **every page is styled by construction** and nothing an author
or a model writes can inject markup, script or one-off styling.

| Block | Holds | Checked by |
|---|---|---|
| `text` | Markdown prose with `cite` marks | every assertion carries a citation (§5.3) |
| `claim` | the node's one claim | gates the rest (§5.1) |
| `figure` | a component name and its data | the component's schema and checks (W5.3) |
| `image` | an asset, alt text, caption, **author, source, licence** | refused without author and licence |
| `math` | a formula | parses |
| `example` | a worked example, optionally executable | runs or recomputes (§5.3) |
| `try` | an inline question, optionally wrapping a figure whose interaction is the question | has one accepted answer; feeds review |
| `callout` | misconception, caveat, convention | misconception callouts also answer wrong submissions (§5.1.1) |
| `problem` | the Rosalind/Euler-shaped problem (§5.1.1) | seeded generator and checker self-test |

*Extended 2026-09-17 (tutor spec T4, T6): a **`resource`** block (outside video, reading,
tutorial or exercise, embedded or linked, with licence); **`hints`** and a **`rationale`** on
`try` and `problem`; **`step_back_to`** on misconception callouts. Drafted blocks carry scores
(T8).*

### W5.2 The AI writes through a content API, not a file

Studio exposes a **CMS-style API** — the same one its own editor uses, and available to models as
tools. Every call validates before it saves, and every save is a **draft** (§7.1):

- `get_node`, `list_blocks`
- `list_components` — each with its data schema, an example and its checks
- `insert_block`, `update_block`, `move_block`, `delete_block`
- `search_images` — Wikimedia Commons first, returning author and licence from its metadata
  API; `attach_image` refuses anything without both
- `verify_node` — runs every block's checks; `render_preview` — as the learner will see it

A model never writes the file directly, never uploads arbitrary media, and never publishes.

### W5.3 Figure components

**`figure`** — AI chooses a component and fills its data; a human validates. A figure sits in the
node's text or inside a `try` block, where its interaction is the question.

```yaml
figure: read-alignment
props:
  reference: ACGTTAGCCTAGGA
  read:      ACGTT----TAGGA
  show: [cigar]            # computed from the alignment above
interact:
  task: place-read
  answer: computed         # the component decides; nobody types the answer
```

Three tiers, all drawn in the W10 identity:

1. **Domain components**, hand-built once, interactive, with computed answers. First for the
   slice: `read-tiling`, `kmer-window`, `kmer-graph`, `compare-graphs`, `graph-artifacts`,
   `gene-model`, `fastq-record`, `read-alignment`, `pipeline-dag`. Then `sequencing-cycle`,
   `quality-plot`, `codon-table`, `pileup`, `dp-matrix`, `suffix-array` / `bwt-table`,
   `em-abundance`, `volcano-plot`, `p-histogram`.
2. **General kits** for the long tail: `flow` (boxes and arrows, laid out automatically),
   `sequence-track`, `table`, and `chart`, whose data is a **Vega-Lite** specification — a
   declarative grammar a model writes reliably and a schema can check — rendered with our tokens.
3. **Images**, with mandatory credit and licence (W5.2).

Adding a component is engineering work under code review; using one is authoring work under hole
review. A figure no component covers may be commissioned as a one-off and is flagged as a
component candidate (S11).

**Verification** (run before a human sees it): schema · internal truth (derived values computed,
never typed) · biological validity · unique answer · reachable and bounded states · legibility at
phone and desktop widths. A figure drawn from our components and cited data raises no licence
question; an image carries its own.

---

## W6. Learn — the learner's pages

### W6.1 Navigation

- **Top bar: logo (Home) · search · account.** Nothing else. Search is the way to find anything.
- **Account menu:** Your knowledge (the full network) · Solved problems · Your routes · Settings (theme follows the system by
  default) · Studio (team only) · Sign out.
- **Home is the overview.** Review, the weekly problem, your routes and Explore are reached from
  Home's cards, not from the bar.
- **Focused bar** in a review session and placement: close · progress. A node page keeps the
  normal bar plus a thin **route strip** (route, what it unlocks, questions answered, back to
  the route).
- **First visit:** L1 → route preview → L2 (optional) → first node. **From Labs:** L11 → node,
  with the route offered after. **Returning:** Home, always; nothing counts days missed.

### W6.2 The pages

| # | Page | Job | Holds | Refuses |
|---|---|---|---|---|
| L1 | **Start** | *What do you want to learn?* | A free-text goal with examples ("Salmon", "why my reads don't map"), the proposed targets to confirm, and the **route preview**: stops, time, how many you already hold, any *not written yet* | a catalogue wall, sign-up first |
| L2 | **Placement** | Drop what you already know **from this route** | One question per candidate node, **"I don't know this yet"**, the route shortening as you answer | a score |
| L3 | **Home** | The overview | **Continue** (one big action), **the route you last opened** drawn as its graph with a route switcher, **2–4 ready nodes**, review, weekly problem, your routes | the whole network, XP, streaks, backlog counts, a busy nav |
| L4 | **Route** | One woven route | **The outcome** in one sentence; **time left with a pace estimate** and **progress per line** (near goals sustain effort — the goal-gradient effect); the route as a **metro map** — lines split from the start and merge into the goal, thin connectors for needs off a line — with a **List** view; a **selected-stop panel** (claim, time, needs, unlocks, why it is here, incoming bridge — the roadmap.sh pattern); **next up** (max 4); **milestones** — a problem per line and the Labs pipeline at the end; *not yet reviewed* labels; missing nodes | a single straight line that hides branching; box-and-arrow diagrams; a completion bar as a prize |
| L5 | **Node** | One topic, at university level | One block document (W5): claim, needs, the *why-for-your-goal* band from a route, explanation with **figures that teach** (static and interactive), **formal definition**, conventions and caveats, licensed images, worked example, cost and scale, misconception, **the full Rosalind-shaped problem inline** (Given/Return, sample, your dataset, answer, feedback, % solved, solutions locked until solved), disclosure. **"Try it" questions inline** that expand, carry the interactive figures and feed review; page progress = questions answered. A route strip at the top; **Needs**, **Goes deeper**, **Related**, **Needed by** and *test me out* at the side | an oversimplified lesson; a chatbot as the main surface |
| L6 | **Problem** | Proving a node is solid | Given/Return, sample, rung, **your dataset**, one answer, misconception feedback, **% solved** | a leaderboard |
| L6b | **Solutions** | How others solved it | **Visible only after you solve it** | access before |
| L7 | **Review** | The daily habit | 5–15 checks **mixed across nodes**, topic revealed after answering, **"that's enough for today"** | a backlog, a streak |
| L8 | **Weekly problem** | A shared reason to return | This week's problem on public data, the nodes it needs and your readiness, the archive — all open forever | deadlines, ranks |
| L9 | **Your knowledge** | Where you stand | Everything you hold, **grouped into connected areas**: areas that share nodes are one map; areas that don't are drawn separately and join when a route links them. A List view. Due for review, solved problems, placement history | badges, comparison; one forced network |
| L10 | **Search** | Find by the word you know | Nodes, tracks, and **"learn this as a goal"** | — |
| L11 | **From Labs** | A Mendel decision → the node that explains it | The decision with rule, premise, citation; the node opened at the relevant part; **judge it yourself before the short answer** | Labs' output as the answer (§2.2) |
| L12 | **Explore** | Browse 50+ tracks | **Search first**; facets with counts (how much you hold, ends in Labs, region, goal type, time left); **applied filters as removable chips**; dense rows with *you hold N of M* and time left for you; sort by most already held; a **Network** view limited to the filtered tracks | cards that stop scaling; a network of everything by default |

*Revised 2026-09-18 (W3.2): **L4** and **L9** carry a **side-doors toggle** — goes-deeper and
related links drawn on the map, distinct from the route, **off by default**. It changes the
picture, never the route, the time left or the order of stops; L5's side column holds the same
three kinds plus the derived Needed by.*

*Revised 2026-09-17 (tutor spec T3, T13.3):*
- *L2 is the first station of the tutor loop.*
- *L4 shows detours.*
- *L5 gains a **Learn it** section (Read / Watch, outside resources), hints, and a step back in
  feedback.*
- *L7 applies hints and step backs in review.*
- *L13 **Exam** is new: self-tests built from node exam pools, with per-node results on the map
  (tutor spec T7.1).*

The weekly problem (L8) never closes, ranks nobody and counts nothing but solves; "solved by N%"
is a measurement of difficulty, as on Project Euler (§9.2).

---

## W7. Studio — the team's pages

### W7.1 Roles

| Role | Can |
|---|---|
| **author** | draft holes and links, compose figures, build problems |
| **reviewer** | approve holes, *needs* groups and connecting text; triage requests |
| **operator** | everything, plus invites and landing |

**Nobody approves what they drafted.** `threshold` stays the node author's call (§6.3).

### W7.2 Navigation

A left rail, grouped: **Work** — Inbox, Assistant, Requests, Implementing, Review · **Content** — Graph, Tracks, Weekly ·
**Insight** — Quality · then AI, Library and Team at the bottom. The rail **collapses to icons** (with a count dot and the name on hover) to give dense pages room; the choice is remembered, and focused-work pages (workbench, composer, graph, weave review) are drawn collapsed. The node workbench, figure composer
and problem builder open from a node. **Preview as learner** is on every page that edits learner
content.

### W7.3 The pages

| # | Page | Job | Holds | Refuses |
|---|---|---|---|---|
| S1 | **Inbox** | What needs me | Assigned reviews, my drafts, failed verifications, requests awaiting triage, quality alerts — each row opens the place to act | charts that lead nowhere |
| S2 | **Graph** | Keep the network sound | **Search first**, with a tree of nodes by region; a **layered neighbourhood view** as the editing surface (two steps back, needs groups, the node, needed by; goes-deeper and related drawn differently), with **Table** for bulk edits and **Whole network** for looking; an **Editing view / Learner view** switch — learners only ever see the metro style, and the learner view shows how a change will look on their maps; add, split, merge; needs entries, each with its reason; **the impact of a change before it is proposed** (routes lengthened, time added, texts needing re-review, cycles); every needs change proposed and reviewed on its own; link history; health (cycles, orphans, nodes no route reaches); weave preview for any goal | freehand layout; editing on the whole-network hairball |
| S3 | **Node workbench** | Fill one node | Tabs: **Content · Links · Problem · Settings**. An **outline** of every block with its state (Gutenberg's list view); the **block editor** with add-block points and per-block toolbars, **draft with AI** naming its prompt, model and human edits marked; **side panels** — **Preview** (live, desktop/phone, **click a block to edit it**, as in Wagtail, Sanity and Storyblok), **Checks**, **Sources** (resolves / doesn't), **History** (compare with the live version, as in Contentful), **Comments**; a **pre-submit checklist** that blocks *Submit for review* until it passes; who else is viewing | a "generate page" button; editing without seeing the result |
| S4 | **Figure composer** | W5.3 in practice | Four steps — **Choose** (a gallery of components with thumbnails), **Data** (a sheet, pasteable; settings generated from the component's schema; YAML as an advanced view), **Interaction**, **Describe** (caption, **alt text**: figure type, what it shows, why it's there; data source and licence); an **Ask** box for described changes; a large preview with desktop/phone/dark and **every interaction state**; checks that name the field to fix; the **pinned component version** and where else it is used | a drawing canvas; code as the only way in |
| S5 | **Problem builder** | Author a problem | Given/Return, **seeded dataset generator**, sample, rung, checker, **wrong answers → misconceptions**, a 20-dataset self-test | running learners' code |
| S6 | **Review** | Approve holes and *needs* groups (§5.5) | The node **shown standalone**, draft beside sources with unsourced assertions marked; Approve inert until conditions are met (every unsourced assertion marked, the node's checks answered, claim locked); reason required to reject; model edits distinct from human edits; **variant logged** | a lone Approve |
| S7 | **Requests** | The human gate of W3.6, at the scale of dozens | **Saved views** (needs triage, blocking routes, duplicates to merge, snoozed, decided); **filters with counts** (type, blocks a route, how many asked, what the model suggests, region, waiting time); a **dense table** with duplicates collapsed into one row; a **detail pane** with the model's proposal, blocked routes and a note for the record; a **bulk bar**; **one-key decisions** — accept, merge, decline, snooze (Linear's triage pattern). Each decision is logged per person, bulk or not | anything moving without a person |
| S8 | **Implementing** | Decide what gets written, for dozens of nodes | Saved views (all, unassigned, mine, waiting for review, stalled); filters with counts (stage, who, routes blocked, region, activity); rows **grouped by stage** and collapsible, ordered by **routes unblocked**; **bulk assign**; a **stalled** flag after 14 days without change; **team load** (writing and reviewing per person) to guide assignment | due dates as pressure |
| S9 | **Tracks (weave review)** | Turn routes into tracks | The route map with **every AI text pinned where learners read it** (bridges on the lines; introduction and page bands in a strip below), coloured approved / to check / flagged; progress (*6 of 24 checked*). The selected text sits **beside the two claims it may use** and the goal, with automatic checks (uses only those claims, says what you have and what's next, length, reads without the route); **Approve · Suggest an edit · Ask for a rewrite**, J/K to move (GitHub review's item-by-item pattern); approving a flagged text needs a note; *Publish as a named track* unlocks when everything is checked | editing node bodies from here; approving blind |
| S10 | **Land** | Approved work → git | Diffs of node files, provenance, the replay report (§5.4) | automatic landing |
| S11 | **Quality** | After learners arrive | Checks everyone passes without reading, checks everyone fails, where learners stop — **per route as well as per node** — wrong answers with no misconception, one-off figures used often. Every row opens its fix | any view of an individual learner |
| S12 | **Weekly** | Schedule L8 | Upcoming releases, data source, the nodes each needs, readiness preview | a deadline field |
| S13 | **Library** | What drafting draws on | Versioned prompts, citations with **resolves / does not**, the component catalogue | — |
| S14 | **Team** | Who does what | Invites, roles, expertise, audit log (§5.6) | — |
| S15 | **Assistant** | Working with the AI | Chats **tied to a node, request or route**; the assistant acts only through the content API (W5.2), and each action appears as a card the author **keeps or discards**; kept changes become drafts that still need checks and review; a list of what it can and cannot do; tokens and budget for the chat; model chosen per chat within what S17 allows | approving, publishing, landing or moving requests from a chat |
| S16 | **AI · Usage** | See what the AI costs | Tokens, cost and calls for a period; budget meter; tokens per day **by task**; tables by task, person and model (the chart's accessible view); alerts that say what happens when a cap is reached | per-learner tracking |
| S18 | **Skeletons** *(added 2026-09-17, tutor spec T5)* | Draft nodes from a public outline | Import an outline (College Board, OpenStax, Galaxy Training, Carpentries); proposed stubs and *needs* links **with scores**; each mapped to *existing / new / merge*; send to Requests | extracting outlines from sites whose terms forbid it; creating tracks directly |
| S17 | **AI · Models** | Decide where models come from | The three lanes (W9); the **fixed list of places Code calls a model**, each with its model, fallback and cap; budgets and what happens at a cap; what is recorded per call | adding a call site from the UI |

*Revised 2026-09-17 (tutor spec T8, T13.3):*
- *S3 gains a Resources tab and block scores.*
- *S6 sorts and filters by score, with the judge's reasons.*
- *S11 shows tutor measures and judge–human agreement.*
- *S17 lists the new call sites.*

---

## W8. Deliberately absent

- Streaks, XP, badges, leagues, leaderboards, hearts, loss-framed notifications — §9.
- A backlog or overdue count — W4.1.
- A chatbot as the main way to learn — §2.2. Wrong answers are answered from the misconception
  hole (§5.1.1). *(2026-09-17: learner chat is deferred past v1, not refused — tutor spec T12.)*
- Block scores shown to learners — tutor spec T8.
- Content copied or scraped from sites whose terms forbid it — tutor spec T5.3.
- A model choosing the route — W3.3.
- Anything leaving the request queue without a person — W3.6.
- In-browser code execution in v1 — W2.
- Per-learner views for authors, and per-lab views — §9.
- Freehand drawing — layout and figures are computed.

---

## W9. Where the AI runs, and what it costs

Code follows Labs' rules for models rather than inventing its own.

- **Three lanes**, as in Labs: **no AI** (every page still works — routes are computed, learners
  get search instead of suggestions), **self-hosted** (any OpenAI-compatible endpoint: Ollama,
  vLLM, OpenLLM), and **hosted keys**. All calls go through **one LiteLLM gateway**, which
  already tracks spend per key, user, team and tag, enforces budgets, and falls back between
  models. OpenLLM is a model server, so it sits behind the gateway in the self-hosted lane rather
  than replacing it.
- **Declared call sites only**, as Labs' invariant 3: goal suggestions (learners, W3.3 step 1),
  page drafting, figure data and problems, connecting text, request grouping, and assistant
  chats. Each has a model, a fallback and a cap (S17). Adding a site is a reviewed code change.
  *(2026-09-17: plus **skeleton drafting**, **resource suggestion** and **block evaluation** —
  tutor spec T8, T13.1.)*
- **Learners never chat** in v1. The only learner-facing call is goal suggestion, capped per day,
  and it falls back to plain search (§2.2). *(2026-09-17: a learner chat after v1 is possible as
  a reviewed change — tutor spec T12.)*
- **The assistant (S15) is the content API with a conversation around it.** It proposes; the
  author keeps or discards each change; kept changes are drafts under the normal checks and
  review. It cannot approve, publish, land, or move a request.
- **Every call is recorded** — task, person, model, prompt id, tokens, cost, fallback — and
  attached to the draft it produced as provenance (§5.4). Learner calls carry only an anonymous
  session.

---

## W10. Visual identity — the Comeni hybrid

Settled 2026-09-16 after five directions (Observatory, Bench notebook, Wayfinding, Gel & stain,
Friendly) were drawn in light and dark, and Friendly was applied to Labs' Builder for comparison.
**One identity for Code and Labs**, taking the legibility of *Friendly* and the precision of
*Observatory*. The reasoning: Labs' own user is someone who *describes an analysis, runs it and
watches it* — largely the same wet-lab learner — and Observatory's 9.5 px labels (`#67757A` on
`#080B0D`, about 4.1 : 1) and colour-only status fail WCAG, which Friendly's larger type and
worded states fix.

| From Friendly | From Observatory | Shared core |
|---|---|---|
| Lexend for UI and prose; nothing under 11 px; WCAG AA contrast | right-angled connections on graphs | **Geist Mono for all data**: tool names, types, sequences, files |
| states written in words ("measured", "2 need you") | hairline borders; shadows only on floating elements | **one meaning per colour**: teal-green = your route / valid · blue = next / selected · amber = measured / stale · red = needs you / wrong · **settled = no colour** |
| a tactile primary button | tighter corners (10–14 px) | the transit-line mark |
| light-first; **the default follows the system** | the faint measuring grid; a **Compact** density for large graphs | |

Reference values (light / dark): ground `#F4F5F8` / `#12141B`; surface `#FFFFFF` / `#1A1D27`;
ink `#171A26` / `#E8EAF2`; route `#0F9D7A` / `#2FC79B`; primary button `#0B7F63` / `#2FC79B`;
next `#2F6FEB` / `#6EA2FF`; measured `#9A5B00` (text) / `#F0B840`; needs-you `#C92F36` / `#FF6E73`.
The full set is in `.design/tokens.json` (moved from `_identity.mjs` by [M0 part 6](2026-09-17-m0-identity-tokens-design.md)), which the boards and the web app both read. Adopting this in Labs is a separate
decision for Labs; Code adopts it now.

---

## W11. Order of work

### W11.1 Canvas order

1. **L1 Start** with the route preview — the new core idea, seen first.
2. **L4 Route** — why each node is there, bridges, *not yet reviewed*.
3. **L3 Home** — the overview.
4. **L5 Node** — one page with inline questions.
5. **S7 Requests** and **S8 Implementing** — the human gate.
6. **S9 Weave review.**
7. **S3 Node workbench** and **S4 Figure composer.**
8. **S2 Graph** and **L12 Explore** — the network, in both sides.
9. L2, L6, L7, L8, L11, S1, S6, S11.

### W11.2 Build order

*Superseded 2026-09-17 by R4 of the
[architecture and roadmap spec](2026-09-17-comeni-code-architecture-and-roadmap-design.md), which
keeps this order's reasoning and adds the skeleton, the learner path and the demo as milestones.*

§8.2 still governs: the first question is whether the loop produces nodes people learn from.

1. **The node schema and the weaver** — links, groups, the walk (W3.3) as a pure, tested
   function with a CLI. It needs no UI and settles the model.
2. S3 + S6 + S10 with the first five components and S4: one node from draft to git.
3. L5 and L6: that node learned and proven.
4. S2, then the v1 node set authored (W12).
5. L1, L4, L2 and S9: goals become routes, routes become tracks.
6. S7 + S8: the request gate.
7. L3, L11, L12; then L7 and L8 once there are enough checks and problems; S11 once there is
   traffic.

---

## W12. The v1 slice, restated

§8.1 said *one tool, all the way down*. Under weaving it becomes **two goals that share most of
their nodes: *learn STAR* and *learn Salmon*.** They share DNA, genes and expression,
sequencing, FASTQ, reference genomes and coordinates, and what an aligner does; Salmon adds
k-mers, de Bruijn graphs, selective alignment and expectation–maximisation. That exercises every
hole, all three link kinds, reuse between two routes, a missing-node request,
and the Labs ending — at perhaps 40–60 nodes.

*Revised 2026-09-17 (tutor spec T10): the Salmon route starts at AP-biology level, its lower
nodes drafted from skeletons, and ends at a runnable Labs pipeline.*

---

## W13. Open questions

1. **Placement's shape** — adaptive, or one question per threshold on the route?
2. ~~**Which inline questions count toward settling a node**~~ — *answered 2026-09-17 for v1
   (tutor spec T7): a node is known when its `try` checks are answered and its problem is
   solved.*
3. **Solutions moderation** — the smallest rule set an invited team can sustain.
4. **Weekly problem data** — a curated list of public datasets, licence recorded?
5. **Component versions** — pinned per node and replayed like human edits?
6. **How a learner's partial route behaves when the graph changes** mid-route — recompute
   silently, or show what changed?
7. **Ordering ties** (W3.3 step 5) — is "region, then declared order" enough, or do routes need
   an author-declared preference between siblings?
8. ~~**What *related* is allowed to link** — any node, or only within a region, to keep it from
   becoming noise?~~ — *answered 2026-09-18 (W3.2): any node. The **peer test** — what a learner
   might be reading **instead of** this node — bounds it, not a region fence, which would have cut
   the best links in the graph; a cap of four makes noise visible instead of gradual.*

---

## W14. Sources

Weaving and precedent:
[Metacademy (hunch.net)](https://hunch.net/?p=2714) ·
[Math Academy: how it creates its knowledge graph](https://www.justinmath.com/how-math-academy-creates-its-knowledge-graph/) ·
[Salmon (Patro et al., 2017, Nature Methods)](https://doi.org/10.1038/nmeth.4197) ·
[Pufferfish: an index for the compacted coloured de Bruijn graph (Almodaresi et al., 2018)](https://doi.org/10.1093/bioinformatics/bty292)

Learner interface:
[Math Academy: how it works](https://www.mathacademy.com/how-it-works) ·
[Andy Matuschak on Math Academy](https://notes.andymatuschak.org/Math_Academy) ·
[A Math Academy review (nor)](https://nor-blog.pages.dev/posts/2025-04-16-mathacademy/) ·
[Galaxy Training (PLOS CB)](https://journals.plos.org/ploscompbiol/article?id=10.1371%2Fjournal.pcbi.1010752) ·
[Carpentries Workbench: episodes](https://carpentries.github.io/sandpaper-docs/episodes.html) ·
[Why people quit Anki](https://my-senpai.com/insights/why-people-quit-anki.html) ·
[Quantum Country](https://quantum.country/) ·
[Distill: communicating with interactive articles](https://distill.pub/2020/communicating-with-interactive-articles/) ·
[Baymard: product lists and filtering](https://baymard.com/research/ecommerce-product-lists) ·
[Baymard: filters for all displayed list info](https://baymard.com/blog/have-filters-for-list-item-info) ·
[NN/g: e-commerce search and faceted search](https://www.nngroup.com/reports/ecommerce-ux-search-including-faceted-search/) ·
[Rosalind problem page](https://rosalind.info/problems/dna/) ·
[Project Euler difficulty ratings](https://projecteuler.chat/viewtopic.php?t=3810)

Authoring:
[Exercism: syllabus](https://exercism.org/docs/building/tracks/syllabus) ·
[Articulate Rise at UMN](https://ccaps.umn.edu/academic-technology-and-design/story/articulate-rise-360-applied-business-program) ·
[Learning analytics dashboards (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8853217/) ·
[Linear: triage](https://linear.app/docs/triage) ·
[Datawrapper: first tour](https://www.datawrapper.de/academy/a-first-tour-through-datawrapper) ·
[Datawrapper: alternative descriptions](https://academy.datawrapper.de/article/330-how-to-write-good-alternative-descriptions-for-your-data-visualization) ·
[Flourish: adding data to a template](https://helpcenter.flourish.studio/hc/en-us/articles/8761545383183-Adding-data-to-a-template) ·
[Storybook: controls](https://storybook.js.org/docs/essentials/controls) ·
[Penrose: using Penrose](https://penrose.cs.cmu.edu/docs/ref/using) ·
[Ghoniem et al.: node-link vs matrix readability](https://journals.sagepub.com/doi/10.1057/palgrave.ivs.9500092) ·
[A study of ego network representations](https://www.sciencedirect.com/science/article/pii/S0097849324002589) ·
[Neo4j Bloom](https://neo4j.com/docs/bloom-user-guide/current/) ·
[WebProtégé (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3691821/) ·
[LiteLLM: spend tracking](https://docs.litellm.ai/docs/proxy/cost_tracking) ·
[LiteLLM: budgets and rate limits](https://docs.litellm.ai/docs/proxy/users) ·
[Wagtail 4.0: preview side panel](https://docs.wagtail.org/en/stable/releases/4.0.html) ·
[WordPress block editor](https://wordpress.org/documentation/article/wordpress-block-editor/) ·
[Sanity: visual editing](https://www.sanity.io/docs/visual-editing/introduction-to-visual-editing) ·
[Storyblok: visual editor](https://www.storyblok.com/docs/concepts/visual-editor) ·
[Contentful: versions](https://www.contentful.com/help/content-and-entries/versions/) ·
[GitHub: reviewing a pull request](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request) ·
[PatternFly: bulk selection](https://www.patternfly.org/patterns/bulk-selection/) ·
[Data table UX patterns (Pencil & Paper)](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables)

Content and figures:
[Markdoc](https://markdoc.dev/) ·
[Markdoc: validation](https://markdoc.dev/docs/validation) ·
[Portable Text (Sanity)](https://www.sanity.io/docs/studio/block-content) ·
[Vega-Lite](https://vega.github.io/vega-lite/) ·
[Wikimedia Commons: machine-readable data](https://commons.wikimedia.org/wiki/Commons:Machine-readable_data) ·
[Commons: credit line](https://commons.wikimedia.org/wiki/Commons:Credit_line) ·
[roadmap.sh](https://roadmap.sh/about) ·
[Goal-gradient effect (Ness Labs)](https://nesslabs.com/goal-gradient-hypothesis) ·
[Brilliant: hand-crafted, machine-made](https://blog.brilliant.org/hand-crafted-machine-made/) ·
[Brilliant: evals for AI learning games](https://blog.brilliant.org/when-almost-right-is-catastrophically-wrong-evals-for-ai-learning-games/) ·
[Penrose](https://github.com/penrose/penrose) ·
[Bluefish](https://vis.csail.mit.edu/pubs/bluefish/)
