# 2026-09-21 — M3 part 5: the Node page

**M3 part 5 is built.** `/node/<id>` shows a node as the published L5 board draws it. *Learn it*
holds a Khan Academy video that really plays in the page, the node's try questions sit in its
body, and the links around it are listed. Opened from a route, the page also says where the
node sits on that route. The [spec](../../superpowers/specs/2026-09-21-m3-node-page-design.md)
(M3P5) and the [plan](../../superpowers/plans/2026-09-21-m3-node-page.md) are in the same branch.
It was built in the session that closed part 4 ([previous entry](2026-09-21-m3-part-4-map-redraw.md)),
and was checked against the published canvas in Chrome as each piece landed.

---

## Where things stand

| Claim | Check |
|---|---|
| An embedded video names the video it plays, checked against the provider's players | `uv run pytest tests/schema/test_resources.py tests/schema/test_providers.py` |
| The fixtures pass the validator | `uv run code-schema validate tests/fixtures/salmon` (26 nodes, no problems) |
| `GET /api/nodes/de-bruijn-graphs` returns `video: "youtube:Jnk_4Maf5Fk"`, and each neighbour its minutes | `uv run pytest apps/api/tests/test_nodes_api.py` |
| The body splits at its markers, outside fences; the player's src carries a part | `npm test -- src/node/body.test.ts src/node/embed.test.ts` |
| A try question gives hints one at a time and its rationale after | `npm test -- src/node/TryQuestion.test.tsx` |
| *Learn it* plays the video and links the rest out | `npm test -- src/node/LearnIt.test.tsx` |
| The page, its strip and its states; *Open page* carries the route | `npm test -- src/node/NodePage.test.tsx src/route/RoutePage.test.tsx` |
| All checks pass: 530 Python tests, 162 web tests | the commands in `CLAUDE.md` |
| It sits beside L5, and holds from 360 to 1920 px, light and dark | seen in Chrome beside the published canvas; the scratchpad audit passes 168 of 168 cases (108 of them node pages) |

**Done when (R4 for part 5)** holds:
- `/node/de-bruijn-graphs?goal=salmon` plays the Khan Academy video in the page, shows the
  OpenStax and Galaxy Training cards, the level tag and the route strip, and asks two try
  questions that give their hints one at a time and their rationale after.
- `/node/read-mapping` shows *Learn it* with its single linked resource.

## What changed

| Commit | What is now true |
|---|---|
| `fa18aa5`, `7829168` | the spec and the plan |
| `d1834fb` | `code-schema`: a resource's `video: <player>:<id>`, a provider's `players`, four new problems; the fixture's invented range removed |
| `0eb45dc` | the index and `ResourceOut` carry `video` (migration `0003`) |
| `6a04ab3` | the node endpoint's neighbours carry `minutes` (`SideCardOut`); the route's cards do not change |
| `c1b9fe9` | `fetchNode`, `splitBody`, `headingsOf`, `playerSrc`, `withRoute`; `react-markdown` and `remark-gfm` pinned |
| `e164427`, `2dd27f9` | a try question, then brought to the board's measures from `build_pages.mjs` |
| `a2df517` | *Learn it*, with the shared kind and level tags |
| `4886b72` | the page, its strip, its side column and `/node/:id`; *Open page* carries the route |
| `07d6802` | what looking beside the board found (below) |

## Decisions made, and why

1. **A video resource records its video.** A Khan Academy page cannot be framed with a start
   and an end, and the page URL does not contain the video's id. The operator chose this over
   framing the URL or showing no player. **Open:** whether Khan Academy's terms allow embedding
   at all. The operator raised it: the mechanism is general, and the decision belongs to the
   first real content that lists Khan Academy.
2. **The fixture's `2:10–7:45` is gone.** The range came from the board's placeholder player
   (*of 11:02*), but the real video is 4:41. It stays out until someone gives a range they
   have checked.
3. **The route travels in the URL** (the operator's choice). The strip reuses the Route page's
   cached query, and *Open page*, *Back to the route*, the needs chips and the side rows all
   keep `goal` and `known`.
4. **The side column's time comes from the API**, as `SideCardOut`, and not from a request per
   row. The route endpoint is untouched.
5. **Styles are read from `build_pages.mjs`**, not guessed from screenshots. That covers the
   question's 26 px square, the 2 px selection border, the button green for a right answer,
   the board's tags, and the 200 / 800 / 290 columns.

## Found beside the board, and fixed

- *Open page* was a plain link, so it reloaded the app and fetched the route again. It is now a
  router link, and the node reuses the map's route.
- Inline code had the page's own colour as its background, which made it invisible as a chip.
  It now sits on the surface colour with a border.
- The loading and missing states rendered outside `<main>`. The audit caught it, and they now
  sit in the landmark as the Route page's do.

## Absent on purpose

- Question progress and *Answered · back in review*, *Already know this?* and *Test me out* (T7).
- Figures, math, the image, the worked example's check, and the problem (M6).
- The green on-your-route text and *Not yet reviewed* (W3.4, M4), and *About this page* with its
  reviewer (M4).
- The Read / Watch toggle, *Learn it elsewhere* and *Sources* (rejected in M3P5.2).

## What is next

1. **Part 4's pull request (#65) merges**, then part 5's. Part 5's pull request is based on
   part 4's branch until then.
2. **M3 part 6: the First steps node page and M3's close**, compared with the published
   *L5 · Node at First steps* board from the start.

## Traps

- **The index must be rebuilt after a fixture change.** Compose does not do it. Run
  `uv run python apps/api/manage.py rebuild_index --root tests/fixtures/salmon` against the
  stack's database, or `video` comes back `null`.
- **`debruijn.fixture.ts` is the API's real answer**, and its header says how to capture it
  again. de Bruijn graphs is **not** on the Salmon route (M1 part 4 put it below), so its strip
  says *Not on your route*. `read-mapping` is on the route: stop 10 of 17.
- **A command chain ending in `| tail` hides the exit code.** One commit this session went in
  with two failing tests that way (amended before any push). Take the exit code from the check
  itself.

## Then: the operator's review of the page

| Asked | Done |
|---|---|
| *Goes deeper*, *Related* and *Needed by* open by default felt odd | each group is folded behind a button with its count (*Needed by · 3*), and the column is sticky |
| The paragraphs on *Mapping reads to a reference* looked oddly formatted | the paragraphs were capped at 66ch inside an 800 px column, so they stopped short of the boxes, and the Learn it sentence was capped at 52ch. The article is now one 720 px measure that text and boxes share, and a lone resource card takes the full width |

Both are recorded in M3P5.2. The audit passes all 108 node cases again.

**Then, the layout itself.** The operator wanted the body to get the room, not the neighbours.
They chose a folding rail from three options (see M3P5.2, which also records the two rejected):
- *On this page* sits at the left edge.
- The neighbours share an *Around this node* rail that folds to a strip with its count, and the
  body widens when it does.

The page was then compared with L5 **in light, at 1440**, as the operator asked; comparing in
dark mode had hidden details. That fixed the top bar's search, which every board centres with a
magnifier (`e341098`), and restored the board's 36 px frame, 27 px contents rows and 15 px text
(`21bf25c`). **The L5 board was changed to the new rail at the operator's request** (`561aeee`),
and the published canvas's L5 artboard was republished from it (version 8; the live copy was
checked first and matched the file it replaced). The audit passes 168 of 168.
