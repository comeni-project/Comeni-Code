# M3 part 5 — the Node page

**Status: agreed 2026-09-21.** The fifth of phase M3's six parts (architecture spec R4). The
parts list is in [`2026-09-20-m3-in-parts.md`](../../notes/journal/2026-09-20-m3-in-parts.md).
Part 1 gave a node its resources and try questions
([spec](2026-09-20-m3-resources-and-questions-design.md)), and part 4 links here from the
selected stop's *Open page* ([spec](2026-09-20-m3-route-page-design.md),
[redraw](2026-09-21-m3-route-map-redraw-design.md)). This part decides:

- what the page holds, measured against the published L5 board;
- how a video resource is really played;
- how the page knows the route it was opened from;
- how the body's Markdown and its try questions are drawn.

The operator decided the embed and the route strip question by question on 2026-09-21, and
approved the page's structure and then the spec as written. **The reference is the published canvas**
(https://claude.ai/artifact/WGDwxV8gHZwSxyzSQAJKPa), L5 *de Bruijn graphs*, open in Chrome
while each piece is built (M3P4R.1), not only at the end.

---

## M3P5.1 What this part does

`/node/:id` is the page a learner reads for one node. It shows the node, its **Learn it**
resources and its try questions, with the links around it. When it is opened from a route, it
also shows where the node sits on that route.

**Out of scope:** the First steps form (part 6); figures, math, images and the problem (M6);
learner state: *Answered · back in review*, question progress, *Already know this?* and *Test
me out* (T7); the green on-your-route text (W3.4); *Not yet reviewed* and *About this page*,
which need reviewers (M4). None of them is faked.

## M3P5.2 What the page holds

It is measured against the L5 board, at its 1440 frame. There are three columns at `lg` and one
on a phone.

**The route strip** sits under the top bar, only when the URL carries a goal (M3P5.4).

**Left: *On this page*.** *Learn it*, then each `##` heading of the body, in order. It is
sticky, and it marks the section being read. It is hidden below `lg`.

**Middle, in the board's order:**

1. The breadcrumb, *region › title*, then the title.
2. The level tag and *About N min*. N is the node's minutes plus one per try question.
3. The claim, in the board's box: *What you'll be able to do*.
4. ***Before this, all of:*** one chip per need, linking to that node. A need in `known=` is
   ticked. Nothing else is ticked, because no learner state exists.
5. ***Learn it*** (M3P5.3).
6. The body, with its try questions in place (M3P5.5). The body's own *Further reading*
   section is drawn as written. It stands in for the board's *Sources* until citations are
   blocks (M4).

**Right: the side column.** *Goes deeper*, *Related* and *Needed by*, as the board's rows:
the title on the left, then *level · N min* on the right. On a route, the goal's row in
*Needed by* says *your goal*. Every row links to its node and keeps the route in the URL. An
empty group is left out.

**On a phone** everything is one column. The strip wraps, and the side column follows the body.

**Rejected:**
- *The board's Read / Watch toggle.* It only reorders the page, and a learner can scroll.
- *Learn it elsewhere* in the side column. It repeats *Learn it* two screens apart.
- *Sources as a separate list.* The body already ends with its reading list, and citations
  become structured only with M4's blocks.

## M3P5.3 Learn it, and playing a video

The intro sentence is the board's: *Read our explanation below, or watch first. Each outside
resource was picked by a reviewer for the part of this page it covers.*

- **An embedded video** is the board's large card:
  - on the left, the player;
  - on the right: kind and level tags, the title, **Covers:**, then *provider · licence*, and
    *Open on <provider>*.
- **Every other resource** is a small card with kind and level tags, licence, title (*provider
  · part*) and *covers*. It links out in a new tab. The cards sit two to a row.
- A non-video resource with `display: embed` (none exists yet) is drawn as a small card in M3,
  marked *shown here* as the board does, with the link.

**A page URL cannot be played.** The fixture's Khan Academy resource is a page
(`khanacademy.org/…/v/dna-sequencing`). A page cannot be framed with a start and an end, and
Khan's own page is a whole site. Khan Academy plays that video from YouTube
(`youtube-nocookie.com/embed/Jnk_4Maf5Fk`), so the content records it:

```yaml
- kind: video
  provider: khan-academy
  url: https://www.khanacademy.org/science/ap-biology/gene-expression-and-regulation/biotechnology/v/dna-sequencing
  video: youtube:Jnk_4Maf5Fk
  covers: How a sequencer returns short overlapping pieces, which is what these graphs put back together.
  licence: YouTube embed
  display: embed
  level: foundations
```

- **`code-schema`.**
  - A resource gains an optional `video`, in the form `<player>:<id>`.
  - Each entry in `providers.yaml` gains `players`, the players it may be embedded through.
    Khan Academy's is `[youtube]`.
  - Each of these is one problem, naming the file, line and field:
    - a `video` resource with `display: embed` and no `video`;
    - a `video` on any other kind;
    - a player the provider does not list;
    - an id not in the player's form (YouTube: 11 characters of `A–Z a–z 0–9 _ -`).
  - The canonical writer puts `video` after `url`.
- **The index** gains `Resource.video` (one migration), and `ResourceOut` gains
  `video: str | None`. The OpenAPI file and `schema.ts` are regenerated.
- **The page** plays `https://www.youtube-nocookie.com/embed/<id>`. `start` and `end` come
  from `part`, when there is one. The iframe gets a title, `loading="lazy"`, and the permissions
  YouTube asks for. The page makes no other request to YouTube.

**The fixture's part is removed.** `2:10–7:45` came from the board's placeholder player
(*of 11:02*). The real video is 4:41 long, so the range does not exist. The whole video plays
until the operator gives a range they have checked. No range is invented.

**Open: whether Khan Academy may be embedded at all.** The mechanism is general, and the
fixture uses it to prove a real player works. Whether Khan Academy's terms allow its videos
inside another site is a licensing decision for real content (invariant 13, T5.3). It is made
when `comeni-code-content` first lists Khan Academy, not here.

**Rejected:**
- *Framing the resource's own URL.* It cannot honour a part, and it shows a whole site in a
  box. It also works only where a provider allows framing.
- *No player in M3.* It would break R4's *done when*: *a real embedded resource*.
- *A per-provider URL template.* A Khan Academy page URL does not contain its video's id, so no
  template can derive it.

## M3P5.4 The route the page was opened from

The route travels in the URL, as it does on the Route page: `/node/<id>?goal=salmon`, plus any
`known=`.

- **Links carry the route.** *Open page* on the Route page carries it, and so does every link
  from this page to another node (needs chips and side rows).
- **The strip.** With a goal, the page reads `GET /api/routes`, through the query the Route
  page caches. The strip says:

  > On your route to **Salmon** · *Sequence analysis* line · stop 9 of 17 · unlocks **Salmon**
  > …… **Back to the route**

  - *unlocks* names the stops on the route that need this one, and *your goal* when that stop
    is the goal.
  - *Back to the route* goes to `/route?goal=…&stop=<id>`, so the node comes back selected.
  - A node that is not on the route (reached through *Goes deeper*, say) says *Not on your
    route to Salmon* and keeps the back link.
  - With several goals, the strip names them as the Route page's header does.
- **With no goal there is no strip.** The node reads alone (invariant 3).
- A route that cannot be woven drops the strip, and the node still shows. The node matters
  more than its context.

**Rejected:**
- *Previous and next stop in the strip.* It is not on the board. It also makes route order look
  like a single sequence, when the map says stops at the same distance can be done in any order.
- *No strip.* That drops a board element that needs no learner state.

## M3P5.5 The body and its questions

**Markdown is rendered with `react-markdown` and `remark-gfm`, with raw HTML skipped.** It
renders to React elements, so no author HTML reaches the page (invariant 6). The page supplies
its own components in the identity:

- `##` headings, with ids for *On this page*;
- paragraphs, strong text and emphasis;
- inline and fenced code, in the mono face, with the board's code box;
- links, which open outside links in a new tab;
- lists.

A `#` heading in a body is drawn as `##`, because the page's title is the only `h1`.

**Questions go in by splitting, not by a plugin.** The body is cut at every line matching
part 1's marker (`{% try <id> %}`, M3P1.3). Markdown chunks and questions alternate. A marker
naming a question the node does not have cannot reach the page: the validator refuses it.

**A try question**, as the board draws it:

- **Collapsed:** its number, the ask, *1 min · a count* or *1 min · a choice*, and *Try it ⌄*.
- **Open:**
  - a *choice* question shows its options as buttons;
  - a *number* question shows a field with its unit and a *Check* button.
- **Checking** happens in the browser. A number is right within its `tolerance`, or exactly
  when there is none. Part 1 sent the answer to the browser on purpose (M3P1.4).
- **Right:** *Right — <answer>. Why:*, then the rationale, in the board's green box.
- **Wrong:** *Not quite*, and the learner can try again. The rationale shows after a second
  wrong answer, or on *Show the answer*.
- ***Show a hint*** reveals one hint at a time: *Hint 1 of 2 used*, then the hint's text.
- **Nothing is stored.** A reload starts the question again, and there is no *back in review*
  line.

**Rejected:**
- *`markdown-it` to an HTML string.* It needs `dangerouslySetInnerHTML` and a sanitiser to trust.
- *A hand-written renderer.* It breaks on the first thing an author writes that it did not
  expect.
- *MyST now.* The body stays Markdown in M3 (the M3 parts list, decision 3).

## M3P5.6 States

- **Loading:** *Loading the page…*
- **An unknown id:** the API's 404 sentence, with a link to Start. This is the Route page's
  pattern.
- **No index / API down:** the API's own sentence, as on the other pages.
- **A node with no resources** has no *Learn it* section, and *On this page* leaves it out.
- **A node with no questions** has none, and its *About N min* is its minutes.

## M3P5.7 What the tests prove

| Test | Proves |
|---|---|
| a resource with `video` round-trips byte for byte | the writer still matches the reader (M1P1) |
| an embedded video with no `video`; `video` on a reading; a player the provider does not list; a malformed id | each is one problem, naming file, line and field |
| `GET /api/nodes/de-bruijn-graphs` returns `video: "youtube:Jnk_4Maf5Fk"`; a linked resource returns `null` | the index and the API carry it |
| splitting a body with two markers gives five pieces in order | questions land where the author put them |
| *On this page* lists *Learn it* and the body's headings | the contents come from the body |
| the embed's `src` is youtube-nocookie with `start`/`end` from `part`, and has neither when there is no part | a part plays as written |
| a choice and a number question: hints one at a time, a right answer, a wrong one, the rationale after | the board's try behaviour |
| the strip with a goal, without one, and for a node off the route | the page reads alone, and shows its route when it has one |
| side rows and needs chips keep `goal` and `known`; *Open page* on the Route page carries them | the route travels |
| unknown id, no resources, no questions | the states |

**In the browser.** The part 4 audit script is extended to `/node/<id>` for all 26 nodes. It
runs at 360, 768, 1280 and 1920 px, light and dark, and checks for sideways scroll, spills and
columns overlapping. **Beside the canvas:** each piece is checked in Chrome against the
published L5 board as it lands.

**Done when** (R4 for part 5):
- `/node/de-bruijn-graphs?goal=salmon` sits beside the L5 board, with:
  - the Khan Academy video playing in the page;
  - the OpenStax and Galaxy Training cards;
  - the level tag;
  - the route strip;
  - two try questions that give their hints one at a time and their rationale after.
- `/node/read-mapping` shows *Learn it* with its single linked resource.
