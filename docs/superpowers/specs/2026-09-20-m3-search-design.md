# M3 part 2 — finding a target without AI

**Status: agreed 2026-09-20.** The second of phase M3's six parts (architecture spec R4).
The parts list is in [`2026-09-20-m3-in-parts.md`](../../notes/journal/2026-09-20-m3-in-parts.md);
part 1 is [`2026-09-20-m3-resources-and-questions-design.md`](2026-09-20-m3-resources-and-questions-design.md).
It gives the Start page (part 3) the candidates its *Is this what you mean?* panel confirms, and
it decides:

- where the matching lives, and what it takes;
- how typed words match a topic;
- what a match comes back as, through a command and an endpoint.

The operator made every decision here on 2026-09-20, question by question; an agent proposed them.

---

## M3P2.1 What this part does

```
words ─► code_weaver.find(targets, words) ─► ranked candidates
                                     │
                    ┌────────────────┴────────────────┐
              code-weaver find                  GET /api/search
              (files, via code-schema)          (the index)
```

`find` is **W3.3's step 1 without a model** — the search fallback R4 promises M5 will fall back
to. It sits beside `weave` in `code-weaver` and is pure, so the same function answers from files
and from the index, and M5 can put a model in front of it without changing it.

**Its input is not the weave's `Topic`.** A topic carries id, region, level and needs, and no
prose; search needs the words. So `find` takes its own small type:

```python
@dataclass(frozen=True)
class Target:
    id: str
    title: str
    claim: str

@dataclass(frozen=True)
class Found:
    words: tuple[str, ...]        # what the text became, after the stop list
    ids: tuple[str, ...]          # the candidates, best first
    unmatched: tuple[str, ...]    # words that matched nothing anywhere

def find(targets: Iterable[Target], words: str, limit: int = 10) -> Found
```

**Cards are built by the caller**, as `Route`'s stops are: the pure function ranks, the edges
dress. That is what keeps one ranking for the command, which has `code_schema` nodes, and the
endpoint, which has index rows.

**Done when:**

- `find` ranks *Salmon* first for "salmon", and *Mapping reads to a reference* first for
  "why my reads don't map";
- a word that matched nothing comes back named;
- repeated runs are byte-identical, as the weave's are;
- `code-weaver find "<words>" --root <folder>` prints the candidates, exiting 0, 1 or 2 on
  `route`'s rules;
- `GET /api/search?q=` answers from the index in one query, 422 on a blank `q`, 503 before any
  applied build;
- `openapi.json` and `apps/web/src/api/schema.ts` are regenerated;
- every test in M3P2.5 passes, and CI is green.

**Out of scope:** the Start page and the top bar's search (part 3); resolving words with a model
(M5); *learn this as a goal* as a page action (part 3); requesting a node that does not exist
(M7); searching bodies, resources or questions — a goal is a topic, and a body full of matches is
a different feature.

## M3P2.2 How words match

**Text into words.** Fold case; **remove apostrophes**, so `don't` is one word to stop rather
than `don` and a stray `t`; split on anything that is not a letter or a digit, so `k-mers` becomes
`k`, `mers` and `de-bruijn-graphs` becomes `de`, `bruijn`, `graphs`; then drop the stop list:

```
a and are arent as at be but by cant do does doesnt dont for from how i im in is isnt it its
ive me my no not of on or that the this to was wasnt what when where which who why with wont
you your youre
```

**If every word is a stop word, none are dropped.** Someone searching "how to" gets our best
answer, not silence.

**When a query word hits a target word:**

| Rule | Why |
|---|---|
| the target word starts with the query word | *map* finds *Mapping*, *seq* finds *sequencing* |
| a trailing `s` is trimmed from a query word longer than three letters | *reads* finds *read* |
| a one-letter query word must match exactly | otherwise *k* hits *kallisto* and half the graph |

**Scoring.** Each query word scores once, in the best field it hits: **id 3, title 2, claim 1**.
Two bonuses: the words joined by hyphens being exactly a target's id (*read mapping* →
`read-mapping`) adds 4; the words being exactly a title adds 2.

**Order:** words matched, most first; then score; then title; then id.

Words-matched leads because covering the question matters more than where the words landed: a
candidate that answers both of *reads* and *map* beats one that answers *reads* loudly. The last
two keys make repeats byte-identical.

```
"why my reads don't map"  →  [reads, map]

Mapping reads to a reference   read|s and map|ping in the title   2 words, score 4
Multi-mapping reads            read|s and map|ping in the title   2 words, score 4
k-mers                         read in the claim                  1 word,  score 1
```

*Mapping reads to a reference* wins that tie on title.

- A candidate must match **at least one word**.
- **At most `limit` come back**, ten by default.
- **Every word that matched nothing anywhere is returned by name**, which is what lets the Start
  page say *nothing here is about "nanopore"* rather than going blank.

**A known gap, stated rather than hidden:** accents are not folded. It needs `unicodedata`, and
`code-weaver`'s import allowlist is closed by design; a search convenience is not a reason to
open it. The content is English. When that stops being true, the allowlist change is reviewed.

**Rejected:**

| Alternative | Why not |
|---|---|
| Postgres full-text or trigram search | it can only answer from the index, never from files; every test would need the database, and a phase about screens would gain a migration and an index to maintain |
| A helper inside `code_api.content` | outside the purity guard, unreachable from a command, and a piece of the weave pipeline kept away from the rest of it |
| Whole words with an edit distance of one | *map* and *mapping* are three edits apart, so the board's own example fails unless stemming is added anyway |
| The typed text as one substring | two lines of code, and nothing at all for "why my reads don't map" |
| Searching bodies too | every page mentioning reads would answer a question about reads; a goal is a topic |

## M3P2.3 The command

**`code-weaver find "<words>" --root <folder> [--limit 10]`**, in `cli.py` beside `route`, at the
same width of 100:

```
2 topics match "why my reads don't map"

 1. Mapping reads to a reference introductory   12m  Mapping finds where in a reference each read c…
 2. Multi-mapping reads          introductory   10m  A read that fits several transcripts equally …

Nothing matches: nanopore
```

- The header counts the candidates and quotes the words; the last line appears only when some
  word matched nothing.
- **Nothing found is exit 0**, with `Nothing matches "zzz"`. An unanswered question is not a
  broken content folder.
- **Exit 1** is content the validator rejects, **exit 2** a missing folder or an empty query —
  `route`'s rules (M2P3.4), so the two commands never disagree.
- `--limit` takes 1 to 50; anything else is argparse's own exit 2.

## M3P2.4 The endpoint

**`GET /api/search?q=<words>&limit=10`**, in the `content` router beside `/api/nodes` and
`/api/routes`:

```json
{
  "query": "why my reads don't map",
  "unmatched": [],
  "results": [
    {
      "id": "read-mapping",
      "title": "Mapping reads to a reference",
      "claim": "Mapping finds where in a reference each read could have come from…",
      "level": "introductory",
      "minutes": 12,
      "region": {"id": "sequence-analysis", "name": "Sequence analysis"}
    }
  ]
}
```

- **One query:** every node's id, title, claim, level, minutes and region, joined. The ranking is
  in memory, as the weave is, and the same MVP bargain applies (M2P4.3).
- A result is the card the board's *Is this what you mean?* panel shows: enough to confirm a
  target without another request.
- `limit` is 1 to 50, default 10; outside that, django-ninja's own **422**.
- A blank `q` is **422** with *A search needs a word.*; no `q` at all is django-ninja's **422**.
- **503** before any applied build, checked only when there are no results — the node endpoint's
  rule, so a hit pays nothing.
- **No match is 200 with an empty list**, never 404: the index answered, and the page has
  something to say.

## M3P2.5 What the tests prove

| Test | Proves |
|---|---|
| "salmon" ranks *Salmon* first; "why my reads don't map" ranks *Mapping reads to a reference* first | the board's two examples |
| "read mapping" hits the id bonus; "k" finds *k-mers* and not *kallisto* | the id bonus and the one-letter rule |
| "reads" finds nodes whose words are *read*; "sequenc" finds *sequencing* | the plural and prefix rules |
| "nanopore" returns nothing and names itself in `unmatched` | a word that matched nothing is named |
| "how to" still ranks something | the all-stopped rule |
| a tie is broken by title, then id; two runs in subprocesses with different `PYTHONHASHSEED` agree | determinism (M2P1.5) |
| the command prints the pinned lines; nothing found exits 0; a bad folder exits 2; broken content exits 1 | M3P2.3 |
| the endpoint and the command rank the same words the same way | files and index search alike |
| one query; 422 on a blank `q` and on `limit=0`; 503 on an empty index; 200 with `[]` on no match | M3P2.4 |
| `/api/search` is in the OpenAPI schema with 200, 422 and 503 | the docs show it |

The Salmon route, the fixtures' 26 nodes and every M2 and M3 part 1 pin stay exactly as they are:
nothing here writes to the index or changes a node.
