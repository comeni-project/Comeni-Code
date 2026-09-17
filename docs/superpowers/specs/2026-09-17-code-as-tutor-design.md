# Comeni Code — the tutor on top of what already exists

**Status: design, agreed by the operator on 2026-09-17.** This is the fourth design document and,
from today, **the current statement of what Comeni Code is.** It is built on:

- [`2026-09-02-comeni-code-design.md`](2026-09-02-comeni-code-design.md) — why Code exists;
- [`2026-09-16-comeni-code-weaving-and-pages-design.md`](2026-09-16-comeni-code-weaving-and-pages-design.md) — weaving, pages, identity;
- [`2026-09-17-comeni-code-architecture-and-roadmap-design.md`](2026-09-17-comeni-code-architecture-and-roadmap-design.md) — stack and phases.

Where they disagree with this document, this one wins. Each has been edited to point here.
Section numbers like T4 refer to this document.

The research behind it is kept in
[`docs/notes/research/2026-09-17-khan-academy.html`](../../notes/research/2026-09-17-khan-academy.html).
It is a study of Khan Academy's philosophy, course structure, pages and evidence, with its sources.

Nothing here has been built.

---

## T1. The shift, in one paragraph

**Comeni Code does not try to out-write Khan Academy. It is the tutor on top of the material that
already exists.** Khan Academy is the largest organised body of free learning material in one
place, but it is linear, slow to change, hand-made by a small team, and stops before anyone
touches real tools. A learner can't ask it *what do I need first?* Code organises the best
existing explanations into the right order for one learner's goal. Those explanations come from:

- Khan Academy;
- OpenStax;
- the Galaxy Training Network;
- the Carpentries;
- Code's own reviewed nodes.

Code checks what the learner already knows, takes them back a step when an answer shows a gap,
brings things back for review, and ends at a pipeline they can run in Comeni Labs. **Nodes with
declared prerequisites are still the product, and courses still build themselves from them**
(W3.3). What changes is that:

- a node points outward to the best existing teaching;
- the first nodes are drafted from public course outlines rather than written from a blank page;
- AI review scores every drafted block so people spend their attention where it is needed.

Google did not write the web. It organised it and won on how it presented the result. Code's
equivalent of that organisation is the prerequisite graph, the woven route, and the checks along
it.

---

## T2. Decisions

All decided by the operator on 2026-09-17, after the research report.

| Question | Decision | Rejected, and why |
|---|---|---|
| Compete with Khan Academy? | **No. Complement it.** Code is the tutor and organiser; Khan Academy and other sources supply much of the explanation | **Compete head-on** — a team this size cannot out-write a 20-person content team with a decade's head start, and would repeat its bottleneck |
| Where does explanation come from? | **Our node plus curated outside resources** (T4), embedded where allowed and always linked | **Only our own writing** — the same slow, hand-made model that is Khan Academy's weakness. **Copying outside text in** — licences forbid it for Khan Academy (T5.3) |
| Video | **A first-class way to learn** (T4.3) | Text and figures only — ignores the format Khan Academy is best at |
| How do the first tracks start? | **From skeletons**: public course outlines that AI turns into node stubs and *needs* links, accepted by people (T5) | **Blank pages** — too slow. **AI writing tracks directly** — breaks invariant 1; courses must come from the graph |
| What does AI draft skeletons from? | **Public or openly licensed outlines**: the College Board AP Biology course description, OpenStax Biology 2e (CC BY), Galaxy Training topics (CC BY), Carpentries lessons (CC BY) | **Automatically extracting Khan Academy's outlines** — its terms forbid scraping and using its content to build AI, and its public API closed in 2020. Khan Academy is used by people, as a reference and as linked resources (T5.3) |
| What does a wrong answer do? | **Explains the misconception and offers a step back** to the prerequisite it reveals (T6.1) | Correction only — a tutor diagnoses, not only marks |
| Hints | **Ordered hints while answering and a rationale afterwards** in every check (T6.2) | Feedback only after submitting |
| Learner state | **Evidence, not levels**: a node is *known* or not, and every answer is stored so levels can be derived later (T7) | **Mastery levels now** (Khan Academy's four) — the weaver only needs *known*, and decaying levels need more questions per node than v1 will have |
| Exams | **Self-tests in v1** (T7.1, added later the same day): each node holds a pool of auto-graded exam questions; a learner generates an exam at any point from the nodes done so far or the whole route, and results confirm or question what they know | **Deferred past v1** (the first answer the same day) — the pieces already exist (evidence, review engine, scored drafting), and exams give *known* a real check. **Certified exams** — unsupervised self-tests prove nothing to anyone else |
| Learner chat | **Planned, not in v1** (T12). Invariant 8 holds for v1 | **Chat in v1** — Khan Academy's measured tutoring gains are modest (T11), and the structured tutor does not need it |
| Scoring drafted work | **An AI judge scores every drafted block with reasons; low scores are redrafted automatically; reviewers filter and sort by score** (T8) | **No scoring** — reviewers would face skeleton-scale drafting unaided |
| Automatic deployment of high scores | **Deferred until judge–human agreement is measured**, and then only for low-risk block types (T8.4) | **Auto-deploy now** — breaks invariant 5 without evidence |
| Audience | **Self-directed learners at every level** (operator, revised the same day), with **five content levels** on nodes: *First steps · Foundations · Introductory · Intermediate · Advanced* (T10.1). A level describes a node, never a learner. Learning needs no account at any age; accounts are 13+ until a consent spec (T10.2) | **University students and researchers only** (the earlier answer the same day) — leaves out learners before university. **Stage-of-education labels for learners** — they label adults by school age and differ by country |

---

## T3. The tutor loop

What a good human tutor does, done by the system. Each station is a page or a mechanism that
already exists or is added here.

```
diagnose ──► sequence ──► explain ──► check ──► review
(placement)  (weaver)     (node +     (try,       (spaced,
 L2           W3.3         resources)  problem,    mixed, L7)
                          T4           hints) T6
                              ▲           │
                              └── step back to the prerequisite a wrong answer reveals (T6.1)
```

- **Diagnose.** Placement (L2) asks one question per candidate node and drops what the learner
  knows.
- **Sequence.** The weaver (W3.3) orders what remains and says why each stop is there. It is
  unchanged. No model chooses the route.
- **Explain.** The node is our claim, explanation, figures and sources, **plus the best existing
  video or reading** for it (T4).
- **Check.** `try` and `problem` blocks, now with hints and rationales (T6.2).
- **Step back.** A wrong answer that reveals a gap offers a detour to the prerequisite, then
  returns to the same question (T6.1).
- **Review.** Checks return on a spacing schedule, mixed across nodes, never as a backlog (L7).

---

## T4. Nodes point outward

### T4.1 The `resource` block

A new block type (it extends W5.1):

| Field | Holds | Checked by |
|---|---|---|
| `kind` | `video` · `reading` · `tutorial` · `exercise` | enum |
| `provider` | e.g. Khan Academy, OpenStax, Galaxy Training, the Carpentries, YouTube channel | from an allow-list |
| `url` | the page | resolves (content CI and a scheduled check) |
| `part` | a timestamp range (`2:10–7:45`) or a section | parses |
| `covers` | one sentence: what this resource teaches that the node needs | present |
| `licence` | the resource's licence or terms, e.g. `CC BY 4.0`, `CC BY-NC-SA`, `YouTube embed` | known value |
| `display` | `embed` or `link` | `embed` allowed only where the licence and provider allow it (T4.2) |
| `level` | `first-steps` · `foundations` · `introductory` · `intermediate` · `advanced` (T10.1) | enum; flagged in review if two or more levels from the node's |
| `reviewed_by` | who accepted it | set by review, never by a model |

A model may **suggest** resources. A suggestion is a draft block, and it is scored (T8) and
reviewed like any other. **No resource text is copied into our repository.** A `resource` block
holds our own one-sentence description and a link.

A node shows its resources in a fixed **Learn it** section near the top: our explanation first,
then the resources. On a node page they also appear in the side column.

### T4.2 Embed and link

- **Always link.** Linking is always allowed.
- **Embed** only when the provider's terms allow it and the licence is recorded:
  - Khan Academy videos through their YouTube embeds, non-commercially and with attribution;
  - OpenStax, Galaxy Training and Carpentries material under CC BY 4.0.
- An embedded player is a component drawn in our identity. It always shows the provider, the part
  and the licence.
- If an embed breaks, the link remains. A resource whose link fails the scheduled check is hidden
  from learners and listed in Quality (S11).

### T4.3 Video

A node can lead with **Read** or **Watch**. Watch plays the chosen video resource's part. Our
own short screencasts, under six minutes and with transcripts required, come later as `resource`
entries with `provider: Comeni`. Short, informal videos hold attention best (Guo, Kim & Rubin
2014, from 6.9 million edX sessions).

---

## T5. Skeletons

### T5.1 What a skeleton is

A **skeleton** is a draft set of node stubs (title, claim, region, level) and draft *needs* links,
proposed from a public course outline and mapped onto the existing graph. It is **not a track**.
Tracks still come only from the weaver (invariant 1). A skeleton only proposes the nodes and links
the weaver will use.

### T5.2 The pipeline

```
outline source ──► AI proposes stubs + needs ──► mapped to existing nodes ──► request queue ──► people accept ──► implementing
 (T5.3)             (declared call site, T9)       (match / new / merge)        (S7, invariant 4)
```

1. **Import an outline** from an allowed source (T5.3), recording its version and licence.
2. **Propose.** A model turns each outline item into a stub with a claim, and proposes *needs*
   links with reasons. It flags items that match existing nodes.
3. **Score.** Every stub and link is scored (T8). Low scores are redrafted before a person sees
   them.
4. **Map.** Each stub is shown as *matches existing node*, *new node*, or *merge*.
5. **Send to Requests.** Accepted stubs become requests. Nothing leaves the queue without a person
   (invariant 4).
6. **Check coverage.** A person compares the resulting nodes with reference courses, including
   Khan Academy's, and records gaps as requests.

A skeletons page (S18) holds this flow.

### T5.3 Which sources, and the Khan Academy boundary

| Source | Use by AI | Use by people |
|---|---|---|
| College Board AP Biology course description (units and topics) | outline for skeletons | coverage checklist |
| OpenStax Biology 2e (CC BY 4.0) | outline and adaptable text, attributed | resources, embedded or linked |
| Galaxy Training Network (CC BY 4.0) | outline and adaptable text, attributed | resources |
| The Carpentries (CC BY 4.0) | outline and adaptable text, attributed | resources |
| **Khan Academy** (CC BY-NC-SA for most content; videos not openly licensed; terms forbid scraping and use to build AI) | **none** | **reading its course layout as a reference, citing it; linking and embedding its videos and exercises as resources** |

The terms page could not be read by an automated reader when the research was done. **A person
reads Khan Academy's current terms once before the first Khan Academy resource is embedded**,
and records the date in the journal.

---

## T6. Checks that teach

### T6.1 Step back

A `callout` of kind `misconception` gains an optional `step_back_to` field naming a node the
misconception shows is missing. It must be one of the node's *needs* ancestors. When a wrong
answer matches that misconception:

- the feedback shows the misconception text;
- it offers **Revisit *X* first** (a detour);
- the route (L4) shows the detour as a short loop off the current stop;
- finishing the detour returns the learner to the same question.

A detour never changes the route's order. It is a visit, and the weaver is unaffected. The node
still counts as not known until its checks are passed.

### T6.2 Hints and rationales

`try` and `problem` blocks gain:

- **`hints`**: an ordered list, shown one at a time on request, each small enough to leave work
  for the learner;
- **`rationale`**: shown after answering, right or wrong.

Both are reviewed like prose. A hint may not contain the answer, which is a check.

---

## T7. Learner state is evidence

The weaver needs one fact per node: **does this learner already know it?** In v1 a node is
*known* when placement says so or when its checks and problem are passed. It stops being known
only if the learner says so ("I've forgotten this").

**Every answer is stored as evidence** from the first day:

- which check;
- when;
- right or wrong;
- which hints were used;
- which misconception matched;
- whether a step back was taken.

The first spec's §8.3 already requires this. Mastery levels and decay can then be derived later
from stored evidence, with no migration; self-tests (T7.1) are built on it in v1. This answers W13 question 2 for v1: a node becomes
known when its `try` checks are answered and its problem is solved.

### T7.1 Self-tests

*Added 2026-09-17, after the operator asked for an exam system before freezing the design.*

**Any time, a learner can test themselves.** Code builds an exam from the nodes in a chosen
scope, grades it automatically, and shows the result on the route's map. It is how *known*
gets checked: **self-tests are the mastery system for v1**, without levels.

**The question pool.**

- Each node holds an **exam pool** of about **4–6 questions**, separate from its inline `try`
  checks, so an exam never replays what the learner just read.
- Pool questions are auto-gradable only: choice, number, sequence or string, and figure
  interactions with computed answers.
- A question may be **seeded**, drawing its numbers or sequence from a generator (as problems
  do, §5.1.1), so retakes differ and answers can't be memorised.
- Pool questions are drafted, scored (T8) and reviewed like any other block. A node without a
  reviewed pool of at least 4 is left out of exams, and the setup page says so.

**Authoring questions: the same block editor as a page.** *(Added the same day, at the
operator's request.)* An exam question is a small **block document**, built in the Workbench's
**Exam pool** tab with the same editor, outline, live preview and checks as a node page (W7 S3).
It is not a plain text form.

| Part | Built from | Checked by |
|---|---|---|
| **Stem** | `text`, `math`, `figure` (a library component filled with data), `image` (with author and licence), `table`, `code` or sequence block | the same checks as on a page (W5.1, W5.3); alt text required on figures and images |
| **Answer** | one of: **choice** (each option may itself hold text, a figure or an image), **number** (with tolerance and unit), **sequence or string** (exact, or a normalisation rule), **figure interaction** (the component computes the answer, e.g. click the bubble in a graph), **order** (put steps in order) | exactly one correct answer; distractors distinct; a figure-interaction answer computed, never typed |
| **Variants** | an optional **seed**: the component or generator draws numbers, sequences or graphs per learner | a self-test over 20 seeds: every variant has one correct answer and renders |
| **Metadata** | the node it tests, the claim it checks, its **level** (T10.1), difficulty estimate, the misconception each distractor targets (links to a `callout`, so a wrong answer can step back, T6.1) | every distractor names a misconception or is marked plain |
| **Rationale** | shown only in the results, never during the test | present |

- **Hints are not allowed in exam questions.** A test has none (T7.1).
- **AI may draft questions,** and they are scored (T8) and reviewed like any other block. The
  model fills a component's data; it never draws.
- **Preview** shows the question exactly as a learner sees it in a test, across several seeds,
  on desktop and phone, and in dark mode.

**Building an exam.**

| Choice | Options |
|---|---|
| Scope | **what I've done so far** on a route · **the whole route** · **one line** · a region |
| Length | about 15, 30 or 60 minutes |

- Questions are **sampled across the nodes in scope and mixed**, weighted toward nodes tested
  least recently and nodes marked *shaky*. There are at least 2 questions per node when length
  allows; otherwise nodes rotate across exams.
- Assembly is **deterministic given the scope, the learner's evidence and a seed**, so an exam
  can be reproduced for checking.
- **No hints and no feedback until the end.** The topic of each question is not announced
  (W4.1). The learner can stop and resume.

**Results.** Per node, never as one pass or fail:

| Result | Means | What happens |
|---|---|---|
| **confirmed** | answered right, with evidence from at least 2 questions | the node stays *known* |
| **shaky** | mixed | offered for review; a step back to the prerequisite the wrong answers point at |
| **not yet** | mostly wrong | the node returns to the route as not known |

- Results are drawn on the route's **metro map** (invariant 12), with a list view.
- There is no overall score, no grade and nothing to share or rank (invariant 10). A share of
  questions answered may be shown as a measurement.
- A whole-route exam taken before starting is **test out of everything**. It is placement
  (L2) at depth.
- Every answer is stored as evidence (T7).

**What it is not.** Not a certificate: self-tests are unsupervised and prove nothing to anyone
else. Not timed pressure: a length is a guide, not a clock. Not a backlog: nothing prompts a
learner to take one.

**Where it lands.**

- **L13 Exam:** set up, in progress and results.
- A **Test yourself** action on Route (L4) and Home (L3).
- An **Exam pool** tab in the Workbench (S3).
- Pool question statistics in Quality (S11): questions everyone gets right or wrong, and
  questions that don't separate learners who know a node from those who don't.

---

## T8. Block scores

### T8.1 What is scored

Every **drafted** block: `text`, `figure` data, `try`, `problem`, `callout`, `resource`,
connecting text, and skeleton stubs and links. Scores belong to drafts in Postgres, never to
landed files, and **are never shown to learners** (invariants 9 and 10).

### T8.2 How

1. **Deterministic checks first** (W5.1, W5.3): schema, citations resolve, computed values,
   problem self-test, links resolve. A block that fails is not scored. It is simply wrong.
2. **A judge model scores the block** against a versioned rubric for its type. The score has
   named parts (for text: *accurate to the cited sources*, *clear at the node's level*, *serves
   the claim*), each on a 1–5 scale with a written reason, and an overall score.
3. **The judge is a different model family from the drafter.** A model scoring its own family's
   work is a model approving its own draft, which invariant 5 forbids for people too. Judge
   models also favour longer answers, the first option shown and their own family's output
   (Zheng et al. 2023).
4. Each score records the rubric version, the judge model, the prompt id and the cost.

### T8.3 What scores do

- **Below x: automatic redraft.** The critique goes back to the drafting call, at most **N
  attempts** within a cost cap. After that, the block goes to a person marked *stuck*.
- **Triage.** Review (S6), Workbench (S3), Skeletons (S18) and Requests (S7) sort and filter by
  score. Reviewers see the parts and reasons beside the block. The lowest and most uncertain
  blocks come first.
- **Agreement.** Every human review of a scored block records whether the person agreed with the
  score. Quality (S11) shows judge–human agreement per block type and per rubric version.

The thresholds x and N are settings on the AI page (S17), not constants in code.

### T8.4 Automatic deployment: deferred

A block scoring above y may **one day** land without a person, but only when all of these hold,
decided in its own spec:

- judge–human agreement for that block type is measured over at least a few hundred reviews and
  is high;
- the block type is low-risk (resource descriptions, perhaps connecting text; never claims,
  problems or figures first);
- the block carries the *not yet reviewed* label, a sample is still reviewed by people, and a
  learner report or a drop in the T9 measures pulls it back automatically.

Until then invariant 5 holds without exception: AI drafts, people approve.

---

## T9. Measuring the tutor

Aggregates only (invariant 9); none is shown to learners as a score.

- **Main: correctness on the next attempt after a step back** or after a hint. It is the measure
  Khan Academy tunes its tutor on (next-item correctness), and the one that says whether the
  tutor teaches.
- Route completion and time to *known* per node.
- Resources marked *didn't help*.
- Judge–human agreement (T8.3).

These appear in Quality (S11).

---

## T10. The slice, the audience and levels

**Who Code is for: self-directed learners at every level, from their first steps in a science to
research.** *(Revised later the same day. An earlier version said university students and
researchers only; the operator widened it to learners before university too.)* Khan Academy
serves school-age learners inside a school system, with teachers and districts around them. Code
serves anyone building toward real understanding and real analyses, with the tutor doing the
structuring a teacher would (T3). The tool and pipeline goals mean many learners will be
university students and researchers, but a route reaches as far down as the learner needs.
**The audience shapes page content, not the overall design:** depth, tone, examples and what a
node assumes are set by the node's **level** (T10.1). The product and interface design (the tutor
loop, routes, maps, Studio) stand as specified, with the exception noted for First steps.

### T10.1 Levels

Every node has one **level**. It describes **the node's content**: what it assumes and how deep
it goes. **It never describes the learner.** Nobody "is" a level, and a level is never a prize or
a rank (invariant 10).

| Level | Content that… | Roughly matches (authors only) | Salmon-route examples |
|---|---|---|---|
| **First steps** | assumes nothing beyond everyday knowledge | primary to lower secondary school | what a cell is; living things carry instructions |
| **Foundations** | builds the school science the rest needs | upper secondary to pre-university (GCSE, AP, A-level, IB) | DNA and genes; gene expression; transcription |
| **Introductory** | starts a field at university depth | first-year undergraduate, or a researcher new to the field | sequencing reads; FASTQ; k-mers |
| **Intermediate** | applies it: analyses, code, methods sections | upper undergraduate or practitioner | de Bruijn graphs; alignment; expectation–maximisation |
| **Advanced** | reads and builds on primary research | graduate and research | selective alignment; pufferfish's index; bias correction |

**Learners see the names; authors see the stages.** The names do not label people by age, they
work in every country, and they describe content. The stage mapping gives authors a concrete
target.

What a level does:

- **Writing.** Each level has a short **writing guide**: vocabulary, reading age, how much maths,
  what may be assumed, and the stage it roughly matches. Authors write to it, drafting prompts
  receive it, and the judge's *clear at this level* part (T8.2) scores against it.
- **Resources and exam questions carry a level too** (T4.1, T7.1). A node links resources and
  holds exam questions at or near its own level. A resource two or more levels away is flagged
  in review.
- **Routes are unchanged.** Routes come only from *needs* links (invariant 1). A level never adds
  or removes a stop; placement and the learner's evidence do. A route **shows its span**, for
  example *Foundations → Advanced · starts at Introductory for you*.
- **Placement can take a hint.** A learner may say what they have studied ("a biology degree").
  Placement then asks about lower-level nodes first, expecting to drop them, but it still asks:
  a hint never marks a node known.
- **Explore and search** filter by level.
- **Graph health (S2)** warns when a node *needs* a node two or more levels above it. That
  usually means a wrong link or a mis-levelled node.
- **Skeletons** propose a level for each stub from the outline's stage (T5).

**Rejected:**

| Alternative | Why not |
|---|---|
| **Stages of education as the learner-facing labels** ("Lower secondary", "GCSE", "AP") | they label adults by school age, and they mean different things in different countries. Kept for authors only |
| **Four levels, starting at Foundations** | "Foundations" would stretch from primary school to AP, too wide to write for |
| **Six levels, one per stage** | more boundaries to argue in review, for little gain; undergraduate can split later if nodes cluster there |
| **Numbered levels (1–5)** | read as a ranking |
| **A level on the learner** | turns content depth into a rank; the learner's state is evidence per node (T7) |

### T10.2 Young learners

Levels below university bring learners under 18, and some under 13.

- **Learning needs no account at any age.** A learner can already start without one (R1).
  Anonymous use asks no age.
- **Accounts are for 13 and over** (or the local age of digital consent, 13–16 across the EU
  under the GDPR) **until a consent spec exists.** That spec covers parental consent (COPPA in
  the US) and how long a minor's stored evidence (T7) is kept, and how it is deleted.
- **Learner chat stays off for under-18s even after v1** (T12), until its own safety review.
- **First steps pages may need interface changes** (larger type, shorter pages, less density).
  This is the one place the audience may reach the design. First steps content and those changes
  come together, in their own design round.
- **First steps is in the MVP** (operator, the same day). So:
  - the design round for First steps pages happens **before M3**, when the learner pages are
    first built;
  - v1 includes a small set of First steps nodes below the Salmon route's Foundations nodes, so a
    route can start there;
  - under-13s use v1 without an account (above); accounts for them wait for the consent spec,
    which is not an MVP requirement.

- **The v1 demo stays *learn Salmon*** (R1, W12), but the route **starts at AP-biology level**,
  with its lower nodes drafted from skeletons (T5), and ends at a runnable Labs pipeline. The
  claim under test is: *someone who knows AP Biology, or less, gets from "learn Salmon" to a
  pipeline they can run.*
- The Salmon route's nodes span **First steps → Advanced**: v1 includes a few First steps nodes
  beneath its Foundations nodes (T10.2).
- The first spec's §4 learner, a wet-lab biologist handed sequencing data, is still the v1
  learner the slice is tested with. Levels let the same route serve a school student who wants
  to learn Salmon too.

---

## T11. What the research found, briefly

The full report with sources is in
[`docs/notes/research/2026-09-17-khan-academy.html`](../../notes/research/2026-09-17-khan-academy.html).
The findings that drive this document:

- **Take:**
  - mastery shown as levels that can drop;
  - short, informal videos;
  - a hint for each step and a rationale afterwards;
  - spaced, mixed review;
  - test-out;
  - one consistent anatomy for every course;
  - measuring learning rather than activity. Surfacing unmastered prerequisites raised
    Khanmigo's next-item correctness by 2.7%.
- **Weak spots:**
  - no way to ask *what do I need first?* (the knowledge map was removed in 2013, and
    prerequisites are hand-packaged "Get ready for" courses);
  - slow, hand-curated production by about 20 people;
  - stops at AP and intro-college level, with no bioinformatics;
  - self-directed learners drift (about 9% reach the recommended weekly time);
  - tutoring is behind a paywall or a teacher, with modest measured gains;
  - no sources behind claims;
  - growing gamification;
  - closed to builders.
- **Watch:** Khan Academy removed its map partly because most learners did better on a linear
  path. Code keeps metro maps for orientation, while *Continue* and *next up* do the steering.
  Whether learners use the map is to be measured.

---

## T12. Deferred past v1

| Deferred | Why | Where it would go |
|---|---|---|
| **Learner chat** | the structured tutor comes first; the evidence for chat tutoring is modest | a new declared call site (invariant 7), in its own spec |
| **Mastery levels and decay** | need more questions per node | derived from stored evidence and self-test results (T7, T7.1) |
| **Certified or supervised exams** | self-tests prove nothing to anyone else | its own spec |
| **Accounts for under-13s** (or under the local age of digital consent) | need parental consent and rules for minors' evidence | a consent spec (T10.2) |
| **Automatic deployment** | needs measured judge–human agreement | T8.4, its own spec |
| **Our own screencasts** | outside videos cover v1 | `resource` with `provider: Comeni` |

---

## T13. What changes elsewhere

### T13.1 Invariants (CLAUDE.md)

- **6** — outside resources are validated `resource` blocks. Embeds come only from allowed
  providers, with a recorded licence.
- **7** — three new declared call sites: **skeleton drafting**, **resource suggestion** and
  **block evaluation**. Automatic redrafts reuse page drafting.
- **8** — learners never chat **in v1**. A learner chat later is a reviewed change with its own
  spec.
- **10** — block scores are never shown to learners.
- **New 13: Code organises; it does not copy.** Others' material is linked or embedded as its
  licence allows. Nothing is scraped, and no model is fed content whose terms forbid it.

### T13.2 Earlier specs

| Spec | Section | Now |
|---|---|---|
| 2026-09-02 | status, §4, §8.1, §8.2 | point here: outward resources and skeletons reduce the writing bill; the slice starts at AP level |
| 2026-09-16 | W1, W5.1, W6.2 (L2, L5, L7), W7.3 (S3, S6, S11, new S18), W8, W9, W12, W13 q2 | point to T4–T10 |
| 2026-09-17 architecture | R1, R4 (M1, M3, M5, M7, M9), R6, R8 | point here; M1 gains the new block fields and evidence; M5 gains judge and skeleton drafting; R6 gains T12; R8 gains the shared sign-in question |

### T13.3 Pages

| Page | Change |
|---|---|
| **L2 Placement** | drawn for the first time; the first station of the loop |
| **L4 Route** | shows a detour loop; shows the route's **level span** and where it starts for this learner |
| **L5 Node** | shows the node's **level** beside its time |
| **L12 Explore** | a **level** filter; each track's span |
| **S2 Graph** | a health warning when a node needs one two or more levels above it |
| **L5 Node** | a **Learn it** section with **Read / Watch** and outside resources; hints in checks; a step back in the problem's feedback; resources in the side column |
| **L7 Review** | hints and step back apply in review too (not redrawn this round) |
| **L13 Exam** | new: set up (scope, length), in progress (mixed, no hints), results per node on the map (T7.1) |
| **L3 Home, L4 Route** | a **Test yourself** action |
| **S3 Node workbench** | the node's **level** in Settings, with its writing guide linked; a **Resources** tab and an **Exam pool** tab; `resource` and hints in the block list; **scores** in the outline and a **Score** panel |
| **S3 Exam pool (question builder)** | new board: the pool's questions with state and score; a question as blocks (stem with figure or image; answer type; options that hold figures); variants across seeds; distractors mapped to misconceptions; live preview as in a test; checks (T7.1) |
| **S6 Review** | drawn for the first time: blocks sorted and filtered by score, with the judge's reasons, redraft history, and *agree / disagree* |
| **S11 Quality** | drawn for the first time: tutor measures (T9), judge–human agreement, broken or unhelpful resources, automatic deployment shown as locked |
| **S17 AI · Models** | the three new call sites, the judge's model family rule, and the x / N settings |
| **S18 Skeletons** | new: import an outline, review proposed stubs and links with scores, map them to the graph, send them to Requests |

---

## T14. Open questions

1. **Values of x, N and the agreement threshold,** to be set from the first reviews.
2. **Which providers are on the embed allow-list** after the terms are read (T5.3).
3. **Whether *didn't help* on a resource should reorder resources automatically,** or only flag
   them for a person.
4. **How far down the Foundations start goes** for the Salmon route: whole AP units, or only the
   topics Salmon's route actually needs.
5. **Whether a detour (T6.1) should shorten** when the learner answers the prerequisite's check
   correctly on sight.
6. **Pool size and the confirmed rule** (T7.1): are 4–6 questions and "2 right" enough, or should
   it depend on the node's size?
7. **Whether a *not yet* result from a self-test should return a node to the route
   automatically,** or ask the learner first.
8. ~~**First steps in the MVP, or deferred?**~~ *Decided: in the MVP (T10.2).*
9. **Where the level boundaries fall in practice.** The first skeleton review (S18) will show
   whether Introductory and Intermediate need clearer writing guides.

---

## T15. Sources

The research report lists all of them. The ones this document relies on:

- [KA Help: mastery levels](https://support.khanacademy.org/hc/en-us/articles/5548760867853--How-do-Khan-Academy-s-Mastery-levels-work)
- [KA Help Center: What happened to the knowledge map?](https://support.khanacademy.org/hc/en-us/community/posts/360027982751-What-happened-to-the-knowledge-map)
- [KA blog: Get ready for courses](https://blog.khanacademy.org/new-math-courses-to-help-students-get-ready-for/)
- [KA efficacy results, November 2024](https://blog.khanacademy.org/khan-academy-efficacy-results-november-2024/)
- [KA blog: Building a better AI tutor](https://blog.khanacademy.org/how-khan-academy-is-building-a-better-ai-tutor-our-most-recent-learnings/)
- [J-PAL: Khanmigo tutoring study](https://www.povertyactionlab.org/initiative-project/ai-powered-tutoring-unleashing-full-potential-personalized-learning-khanmigo)
- [KA Help: Using our videos and materials](https://support.khanacademy.org/hc/en-us/articles/202262954-Can-I-use-Khan-Academy-s-videos-name-materials-links-in-my-project)
- [KA Help Center: API removal notice](https://support.khanacademy.org/hc/en-us/community/posts/360055082872-API-removal-notice)
- [KA Help: What the terms allow](https://support.khanacademy.org/hc/en-us/articles/42929097425037-What-s-allowed-and-not-allowed-under-Khan-Academy-s-Terms-of-Service)
- [Guo, Kim & Rubin 2014: video production and engagement](https://dl.acm.org/doi/10.1145/2556325.2566239)
- [Zheng et al. 2023: Judging LLM-as-a-judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685)
- [College Board: AP Biology](https://apcentral.collegeboard.org/courses/ap-biology)
- [OpenStax Biology 2e](https://openstax.org/details/books/biology-2e)
- [Galaxy Training: content licence](https://training.galaxyproject.org/training-material/faqs/gtn/gtn_license.html)
- [Software Carpentry licence](https://github.com/swcarpentry/shell-novice/blob/main/LICENSE.md)
