# 2026-09-21 — M3 part 6: the First steps page, and M3 is done

**M3 part 6 is built, and phase M3 is done.** A node whose level is *First steps* now reads in
its own form: one column, larger type, the video offered rather than played, one large question,
and what comes next on the route. The
[spec](../../superpowers/specs/2026-09-21-m3-first-steps-and-close-design.md) (M3P6) and the
[plan](../../superpowers/plans/2026-09-21-m3-first-steps-and-close.md) are in the same branch,
and it follows [part 5](2026-09-21-m3-part-5-node-page.md) in the same session.

The operator asked to keep going rather than settle every question first: **the MVP matters more
than a perfect page**, and the rest can be worked out later. The defaults are in the spec.

---

## M3's *done when* (architecture spec R4), checked in the running stack

Checked at 1440 in light, against the published canvas, with `docker compose up -d --wait`.

| R4 asks | Where it stands |
|---|---|
| Start, Route and Node sit convincingly beside L1, L4 and L5 | `/?q=salmon&goal=salmon` draws the map and the span; `/route?goal=salmon` draws 17 stops with the selected stop's reasons; `/node/de-bruijn-graphs` sits beside L5 |
| A First steps node page beside its own board | `/node/dna-and-genes?goal=salmon`, beside *L5 · Node at First steps* |
| *Learn it* with at least one embedded and one linked resource | de Bruijn graphs plays Khan Academy's video in the page (`youtube-nocookie/embed/Jnk_4Maf5Fk`) and links OpenStax and Galaxy Training |
| The node's **level** tag | on both forms |
| `try` questions with hints and a rationale | two on de Bruijn graphs, one on DNA and genes; hints come one at a time |
| The Route page shows the route's **level span** | *First steps → Intermediate* |
| **Read / Watch** | **On the First steps page only.** M3P5.2 rejected it for the full page: there it would only reorder what is already on the screen. On a First steps page it decides whether a learner reads or watches, which is the choice T10.2 is about. This is a deviation from R4's 2026-09-17 line, recorded here rather than quietly met. |

**Checks:** 534 Python tests, 172 web tests, ruff, mypy, Biome, tsc, the build, `ops/stack-check.sh`,
and the browser audit at 168 of 168 cases.

## What changed

| Commit | What is now true |
|---|---|
| `4761c09` | the spec and the plan |
| `1d5af69` | *DNA and genes* offers Khan Academy's high-school DNA video (`youtube:AmOO4j0E408`, 0:00–13:01) and asks one choice question about base pairing |
| `104b283` | the First steps form, the large question, the numbered sections, the watch offer, *Next on your route* and *Where this comes from* |
| this entry | the stack check asks for `/route` and `/node/…`, and M3 closes |

## Decisions made, and why

1. **The level chooses the form**, not the learner and not the URL. A level describes the node
   (T10.1), so a node always reads the same way for everyone.
2. **The video is offered, not played.** *Read* stays the default and *Watch · 13 min* opens the
   player. On a first page, an autoplaying video would decide for the learner.
3. **One *Continue*.** For a First steps learner, the next stop in route order is the only
   question worth answering. The full page still has no previous/next, because the map says
   stops at the same distance can be done in any order.
4. **The stack check asks for the app's own deep paths.** A single-page app depends on nginx
   serving `index.html` for `/node/dna-and-genes`, and nothing checked that. Checking a node's
   `video` through the API — the spec's first draft — would have proved nothing, because CI
   never fills the index.

## Absent on purpose

The figure (M6); *Why this matters for your goal*, which is connecting text (W3.4); *1 of 2
questions* and review (T7); *Reviewed by* and *not yet reviewed* (M4).

## Traps

- **The Khan video's *covers* line was written from the video's page, not from watching it.**
  A reviewer checks it before real content copies the resource. The same holds for de Bruijn
  graphs' video.
- **A First steps node has no needs to show and no rail**, so its page is driven entirely by
  the body, the question and the route.
- The index still has to be rebuilt by hand after a fixture change (part 5's entry says how).

## What is next

M3 is done; **M4, the Studio core**, is the next phase: sign-in with roles, an author drafting a
node, checks, a reviewer approving, and content landing on `comeni-code-content` through a pull
request. Before any of it, M4 is split into parts in a new journal entry (R5).
