# M3 part 6 — the First steps node page, and M3's close

**Status: agreed 2026-09-21.** The last of phase M3's six parts (architecture spec R4). The
parts list is in [`2026-09-20-m3-in-parts.md`](../../notes/journal/2026-09-20-m3-in-parts.md).
Part 5 built the Node page ([spec](2026-09-21-m3-node-page-design.md)); this part gives a
*First steps* node its own form of that page and closes M3.

Part 6 was agreed on 2026-09-21. The operator chose to keep going with the defaults below rather
than decide each one, because the MVP matters more than a perfect page, and details can be
worked out later. **The reference is the published canvas**, board *L5 · Node at First steps*,
compared in light at 1440.

---

## M3P6.1 What this part does

A node whose level is *First steps* is drawn in the board's First steps form: larger type, one
column and less on the page (tutor spec T10.2). It uses the same URL, the same data and the
same components underneath. Then M3's *done when* is checked in the stack, and the phase is
recorded as done.

**Out of scope:** the figure (M6); *Why this matters for your goal*, which is connecting text
(W3.4); *1 of 2 questions* and review, which need learner records (T7); *Reviewed by* and
*not yet reviewed* (M4).

## M3P6.2 The form

The form is chosen by the node's level alone: `level === "first-steps"`. The level describes
the node, never the learner, so the same node always reads the same way. The measures below are
taken from `build_pages.mjs`.

- **Frame.** One centred column, 820 px wide, with 44 px top padding. There is no *On this
  page* and no *Around this node* rail. First steps nodes are short, and the board has neither.
- **The strip** is 52 px high with 15 px text. It says *the very first stop* when the node is
  the route's first stop, and *stop N of M* otherwise. Otherwise it is part 5's strip.
- **Head.** The level tag and *About N minutes* at 16 px. Then the title at 48 px, and the
  claim as a 21 px lead. There is no boxed claim: the board uses a lead sentence.
- **Prefer to watch?** When the node has an embedded video, a row says *Prefer to watch? A short
  video explains the same idea.* It has a *Read · Watch · N min* switch, and *Watch* opens the
  player below the row. Reading stays the default. The length comes from the part when there is
  one; otherwise the row leaves the length out.
- **Body** text is 20 px at 1.65, and `##` sections are numbered: *1 · …*, *2 · …*.
  *Further reading* is not numbered: it moves to the footer.
- **A try question** is the board's large panel: *Try it · question N*, a 24 px ask, answers as
  large buttons two to a row at 19 px, and *Show a hint* as a large button. The rationale sits
  in the green box at 17 px. It behaves exactly as in part 5.
- **Next on your route.** On a route, a card names the next stop in route order, with its
  level tag and a large *Continue →* that keeps the route. At the last stop, or off the route,
  there is no card. Route order is the weaver's order. For a first-steps learner, *what's
  next* is the one question worth answering. Part 5 rejected previous and next buttons in the
  strip for the full page, and that still holds there.
- **Where this comes from** is the footer. It lists the node's other resources (links) and the
  body's *Further reading*, in the board's box.

**Rejected:**
- *A separate route for First steps pages.* That would make two addresses for one node.
- *Choosing the form by the learner.* A level describes the node (T10.1).
- *Keeping the rail.* The board has none, and a first-steps node's neighbours are few.

## M3P6.3 The fixture gains what the board shows

*DNA and genes* is the Salmon route's first stop, and it gains the two things the board needs:

- a **video** resource: Khan Academy's high-school biology *DNA* video
  (`khanacademy.org/science/high-school-biology/…/v/dna-deoxyribonucleic-acid`), which Khan
  plays from YouTube as `AmOO4j0E408` (13:01), `display: embed`, level *foundations*;
- a **try question** (a choice): *In DNA, which base pairs with A?*. It has a hint that does not
  give the answer, and a rationale taken from the body's own sentence.

The resource's *covers* line is written from the video's page and title. Nobody has watched the
video yet, so a reviewer checks it before real content copies it.

## M3P6.4 M3's close

- The stack check fetches a node through the web container and confirms that `video` is set on
  de Bruijn graphs, so a broken index shows in CI.
- A journal entry checks R4's *done when* for M3 line by line against the running stack:
  - Start, Route and Node sit beside L1, L4 and L5;
  - the First steps page sits beside its own board;
  - *Learn it* has an embedded and a linked resource;
  - the level tag, and the try questions with hints and a rationale;
  - the Route page's level span.
- `CLAUDE.md` then says M3 is done.

## M3P6.5 What the tests prove

| Test | Proves |
|---|---|
| a first-steps node renders the First steps form; any other level renders part 5's | the level chooses the form |
| no *On this page*, no rail; the claim is a lead, not a box | the board's single column |
| sections are numbered, and *Further reading* moves to *Where this comes from* | the board's sections and footer |
| *Watch* shows the player, and *Read* hides it | the video is offered, not forced |
| *Continue* goes to the next stop with the route; no card at the goal or off the route | the next step |
| the strip says *the very first stop* on the first stop | the board's strip |
| the fixture validates, and the API returns the new resource and question | the content |
| the stack check sees `video` | M3's close in CI |

In the browser, the audit's `node` sweep already covers every node, the five first-steps nodes
included.
