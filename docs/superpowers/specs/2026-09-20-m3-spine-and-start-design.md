# M3 part 3 — the spine, and the Start page

**Status: agreed 2026-09-20.** The third of phase M3's six parts (architecture spec R4).
The parts list is in [`2026-09-20-m3-in-parts.md`](../../notes/journal/2026-09-20-m3-in-parts.md);
parts [1](2026-09-20-m3-resources-and-questions-design.md) and
[2](2026-09-20-m3-search-design.md) built what it reads. It is the **first screen in the
project**, and it decides:

- how the web app routes, fetches and words its states;
- what lives at which path;
- what the Start page (L1) does, and what of its board waits.

The operator made every decision here on 2026-09-20, question by question; an agent proposed them.

---

## M3P3.1 What this part does

```
apps/web
 ├── router          /  Start · /health · /identity · anything else → not found
 ├── TopBar          logo · search · (account waits for M4)
 ├── api/            client.ts, search.ts, routes.ts — beside health.ts
 └── start/          the L1 page: ask → confirm → preview
```

It calls `GET /api/search` (M3P2.4) for candidates and `GET /api/routes` (M2P4.2) for the
preview. Both exist, so **nothing on this page is mocked**.

**The three stages the board draws**, on one page:

1. **Ask** — *What do you want to learn?*, the goal box, the board's five example chips.
2. **Is this what you mean?** — candidates as cards (title, claim), *Suggested from your words ·
   you decide*, up to three targets.
3. **Your route** — stop count, total time, level span, and the stops in order, ending at the
   goal. *Start from the beginning* links to `/route?goal=…`, which part 4 builds.

**Done when:**

- `/` is Start, `/health` is the health page, `/identity` is the specimen, anything else is the
  not-found page, all under the top bar;
- typing *salmon* and submitting shows *Salmon* as a candidate; choosing it shows the 17-stop
  preview with its time and span;
- a word nothing is about is named, rather than an empty list;
- every state — pending, no match, no index, unreachable — is a sentence;
- the tests of M3P3.5 pass; `npm run lint`, `npm run test` and `npm run typecheck` are clean;
  CI is green;
- **the operator has opened it beside `.design/Start.dc.html` and said it holds up.** The part
  does not close before that (R4's *done when* is a judgement, and it is theirs).

**What the board shows that M3 leaves out:**

| On the board | Why not now |
|---|---|
| *1 not written yet — requested, you can follow it* | missing nodes are requests (M7); the index cannot name a node it does not hold |
| *You probably know some of this already* → placement | L2 is not in M3; `known` comes from the URL, and part 4 uses it |
| *Just looking? Explore existing tracks* | L12, and there are no tracks until W3.5 |
| the account menu | accounts are M4 |

They are **omitted, not drawn as dead controls**, and this table is the record of why.

**Out of scope:** the Route page (part 4) and the Node page (part 5); the metro map; placement;
stored learner state (T7); goal suggestion by a model (M5).

## M3P3.2 The spine

**React Router 7.** `<BrowserRouter>` in `main.tsx`, `<Routes>` in `App`. Tests render inside
`<MemoryRouter initialEntries={[…]}>`, which replaces `App`'s `path` prop.

| Path | Page |
|---|---|
| `/` | **Start** |
| `/health` | the health page |
| `/identity` | the identity specimen |
| anything else | not found, under the bar |

Part 4 adds `/route`; part 5 adds `/node/:id`.

**The state lives in the URL:**

```
/?q=why+my+reads+don't+map          what was typed
/?q=…&goal=read-mapping             a confirmed target, repeatable, up to 3
```

The same vocabulary `GET /api/routes?goal=&known=` speaks, so part 4's `/route?goal=…` brings
nothing new to learn. The back button steps through the stages, a refresh keeps them, and a
half-finished search is a link that can be sent.

**The top bar** gains the board's field — *Search topics, tools and goals* — which submits to
`/?q=…`. That is L10's *find by the word you know* without a second page. The `/` shortcut the
board draws focuses it, unless a field already has focus. The account menu waits for M4 and is
not drawn.

**Fetching** uses react-query, a declared dependency unused since M0. Two modules beside
`api/health.ts`, in its shape:

```ts
// api/client.ts
export class ApiUnreachable extends Error { readonly reason: string }
export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T>

// api/search.ts    fetchSearch(words, signal)  → SearchOut
// api/routes.ts    fetchRoute(goals, signal)   → RouteOut
```

- `getJson` carries the API's own `detail` sentence out of a 4xx or 5xx body, so the page prints
  the API's words instead of inventing a second vocabulary.
- `health.ts` keeps its own fetch: it treats 503 as an answer, which nothing else does.
- Types come from `schema.ts`, so an endpoint change the page does not follow fails
  `npm run typecheck`.

**Rejected:**

| Alternative | Why not |
|---|---|
| The hand-rolled path switch, extended | forty lines we own, and every subtlety — back, scroll, modifier-clicks — becomes ours exactly as the app grows to five pages |
| TanStack Router | typed search params would suit `?goal=`, but it is heavier and a second TanStack dependency for a four-page app |
| Start at `/start`, health at `/` | the front door would show a health page, and every link would carry the detour forever |
| Page state in React rather than the URL | no shareable link, no back button through the stages, and part 4 would need its own vocabulary |

## M3P3.3 The Start page

**The board's words are kept**: *What do you want to learn?*; *Name a tool, a topic or a problem.
We build a route from pages that already exist — every stop says why it's there.*; the button
**Build my route**; **1 · Is this what you mean?** with *Suggested from your words · you decide*;
**2 · Your route** with *Built by following what each page needs, back from …*; and the primary
**Start from the beginning**.

**The five example chips stay as drawn** — *Salmon*, *Why my reads don't map*, *Differential
expression*, *de Bruijn graphs*, *Call variants*. They are examples of **how to phrase a thing**,
not a menu of content, and against the fixtures one of them finds nothing: that is the honest
demonstration of the no-match state.

**Every state is a sentence** (W10, and the health page's precedent):

| State | What the page says |
|---|---|
| nothing typed | the ask stage alone, with the chips |
| searching | *Searching…* |
| nothing matched | *Nothing here is about "nanopore" yet.* — the word from `unmatched` |
| candidates | the cards, and how many |
| target chosen, route loading | *Weaving your route…* |
| no index built | the API's sentence: *The index has not been built yet.* |
| unreachable | *Can't reach the API · network error* |

**Keyboard and screen reader:** the field is labelled; `/` focuses it unless a field has focus;
each candidate is a button in a list; chosen targets are removable chips; the stage that appears
is announced with `aria-live="polite"`. Nothing under 11 px, WCAG AA, colour never alone (W10).

## M3P3.4 What a stage holds

| Stage | Holds |
|---|---|
| Ask | h1, the lede, a labelled field with *Build my route*, the five chips |
| Is this what you mean? | one card per candidate: title, claim, and a button that adds it as a target; the chosen targets as chips with a remove; *+ Add another target (up to 3)* while fewer than three are chosen |
| Your route | the sentence *Built by following what each page needs, back from …*; **stops · time · span**; the stops in order with their minutes, the last marked *your goal*; **Start from the beginning** linking to `/route?goal=…` |

Stage 2 appears when a search has candidates; stage 3 when at least one target is chosen. Both
come from the URL, so they survive a refresh.

## M3P3.5 What the tests prove

`apps/web/src/start/StartPage.test.tsx`, `apps/web/src/App.test.tsx` and
`apps/web/src/layout/TopBar.test.tsx`, with `fetch` stubbed.

| Test | Proves |
|---|---|
| submitting the field puts `q` in the URL and calls `/api/search` with those words | stage 1, and the state in the URL |
| choosing a candidate adds `goal=` and shows *17 stops · about 3 h 4 min · First steps → Intermediate* | stage 3, from the real route shape |
| a second target can be added; at three the add control is gone | the board's *up to 3* |
| an unmatched word is named | the no-match state |
| a chip searches its phrase | the examples work |
| pending, 503 and unreachable each render their sentence | no silent state |
| *Start from the beginning* links to `/route?goal=…` | the handover to part 4 |
| `/`, `/health`, `/identity` and an unknown path each render under the bar | the router |
| the top bar's field submits to `/?q=…` | L10 without a second page |

`ops/stack-check.sh` gains a line for `/health`, so the move is covered where the stack runs.
