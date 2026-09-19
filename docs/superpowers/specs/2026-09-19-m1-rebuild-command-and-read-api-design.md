# M1 part 6 — the rebuild command and the read API

**Status: agreed 2026-09-19.** This is the last of M1's six parts (architecture spec R4). The parts
list is in [`2026-09-18-m1-in-parts.md`](../../notes/journal/2026-09-18-m1-in-parts.md). It builds
on [part 5](2026-09-19-m1-index-and-loader-design.md)'s `rebuild_index` and index. It decides:

- where the command reads content from, and what it reports;
- what `/api/nodes/<id>` returns about a node's neighbours;
- which endpoints exist in M1;
- what the API answers when the id is not in the index.

The operator made every decision here on 2026-09-19, question by question; an agent proposed them.

---

## M1P6.1 What this part does

Two thin layers over part 5. A management command runs `rebuild_index` on a folder and turns the
build's outcome into an exit code; a read-only endpoint serves one node and its neighbours from the
index.

```
content folder ──manage.py rebuild_index──► index ──GET /api/nodes/<id>──► node + four lists
```

**Done when:**

- `manage.py rebuild_index --root tests/fixtures/salmon` into an empty database gives the full index
  and exits 0 (the parts list's *the command rebuilds from files alone*);
- `/api/nodes/<id>` returns the three kinds of link and the derived *needed by*;
- every test in M1P6.5 passes, and CI is green.

With parts 3 and 4, this closes M1 (M1P6.6).

**Out of scope:** a node list, regions or build-information endpoints (M1P6.4); the worker that
follows the content repository; content inside Compose; web pages that show a node; search (R8.1);
anything the weaver computes (M2).

## M1P6.2 The command

`apps/api/src/code_api/content/management/commands/rebuild_index.py`:

```
manage.py rebuild_index [--root PATH] [--commit SHA]
```

**The folder is `--root` if given, else the `CODE_CONTENT_ROOT` setting; there is no default.**
`Env` gains `content_root: Path | None = None`, exposed as `settings.CODE_CONTENT_ROOT`; a relative
path is from the working directory, as `static_root` is. The setting is optional, so the API, worker
and beat start without a content checkout — only the command needs one (M1P5.4).

1. **No folder given:** exit 2, `set CODE_CONTENT_ROOT or pass --root`. Nothing is written.
2. **The path is missing or not a folder:** exit 2, naming the path. Nothing is written. This check
   is the command's one real duty: `read_content` reads a missing folder as empty content, and an
   empty folder with no problems would replace the index with nothing.
3. **Otherwise** `build = rebuild_index(root, commit=commit)`:
   - `applied` → stdout `Applied: 26 nodes, digest 3f2a9c01be47` (the digest's first 12
     characters), exit 0;
   - `refused` → stderr `Refused: N problems`, then each of `build.problems` on its own line,
     exit 1. The old index stands (M1P5.2).

- **`--commit`** is stored on the build and is blank otherwise. The command never runs git; the
  future worker passes the SHA it pulled (M1P5.5).
- **Exit codes:** 0 applied, 1 refused, 2 could not start. A script or the worker needs nothing
  else to decide what happened; the reasons are in the output and in `IndexBuild`.
- `.env.example` gains a commented `# CODE_CONTENT_ROOT=../comeni-code-content`.

**Rejected:**

| Alternative | Why not |
|---|---|
| `CODE_CONTENT_ROOT` required at startup | every process would need a content checkout to start, against M1P5.4's *only the rebuild needs the files* |
| A default of `../comeni-code-content` | right on one laptop, wrong in Docker and in CI; a wrong default quietly indexes the wrong folder |

## M1P6.3 The endpoint

`apps/api/src/code_api/content/api.py`: a router mounted at `/api/nodes` in `code_api/api.py`,
tagged `content`, in the health router's pattern. **`GET /api/nodes/{id}`** answers 200 with:

```json
{
  "id": "salmon",
  "title": "Salmon",
  "claim": "…",
  "region": {"id": "transcriptomics", "name": "Transcriptomics"},
  "level": "intermediate",
  "minutes": 15,
  "body": "…Markdown…",
  "folder": "transcriptomics/salmon",
  "needs": [{"id": "rna-seq-libraries", "title": "…", "level": "…", "reason": "…"}],
  "goes_deeper": [],
  "related": [],
  "needed_by": []
}
```

**Each neighbour is a card: `id`, `title`, `level`, `reason`.** One request fills a node page's side
panel (L5), and the cards cost no query per neighbour.

- **`needs`, `goes_deeper`, `related`** are the node's outgoing links, each list in the author's
  order (`Link.position`).
- **`needed_by`** is derived (W1): the incoming *needs* links. Each card's `reason` is the one
  written on the needing node — why *it* needs this one. Nothing orders these by hand, so they are
  sorted by title, then id.
- **Three queries, whatever the node's size:** the node with its region; its outgoing links with
  their targets; its incoming *needs* links with their sources.
- **Read-only:** `GET` only, no sign-in (the content is openly licensed), no caching headers yet — a
  rebuild shows at once.
- The route and its schemas appear in `/api/openapi.json`, so `/api/docs` shows them.

**Rejected:**

| Alternative | Why not |
|---|---|
| Ids and reasons only | a page would need one more request per neighbour to show titles |
| Each neighbour's full node | heavy, and duplicates `/api/nodes/<other>` |

## M1P6.4 One endpoint, and its misses

**Part 6 adds only `GET /api/nodes/{id}`.** A node list, the regions and the latest build wait for
the first thing that uses them — the web pages, search, or the weaver's goal picker. *Rejected:* a
list for browsing in `/api/docs`, which nothing uses yet; a build-information endpoint, which makes
a fact about the deployment public before anyone needs it.

**An id not in the index is a normal case** (M1P5.3):

| Case | Answer |
|---|---|
| no node with that id, and an applied build exists | **404** `{"detail": "No topic with id 'x'. It may have been removed or renamed."}` |
| no node with that id, and no build was ever applied | **503** `{"detail": "The index has not been built yet."}` |

- **The build check runs only on a miss,** so a found node costs nothing extra.
- **Refused builds do not count:** a database whose only builds were refused has no index, and
  answers 503.
- **Any string is an id.** A malformed one (`Bad_ID`) is simply not in the index: 404, never 422.
- The API cannot tell *removed* from *never existed* without keeping history, which the MVP does
  not. *Rejected:* a table of removed ids answering 410 Gone.

## M1P6.5 What the tests prove

Against Compose's Postgres, reading only `tests/fixtures/salmon/` or copies of it in `tmp_path`.

`apps/api/tests/test_rebuild_command.py`, through `call_command`:

| Test | Proves |
|---|---|
| `--root` the fixtures into an empty database: exit 0, `Applied: 26 nodes`, the same index as calling `rebuild_index` directly | the command rebuilds from files alone |
| the setting alone is used; `--root` wins over it | where the folder comes from |
| `--commit abc123` is stored on the build | the commit passes through |
| a broken copy: exit 1, the validator's messages on stderr, the index unchanged | refusal becomes an exit code |
| no folder given; a missing path: exit 2, no `IndexBuild` written, the index unchanged | the command never indexes nothing |

`apps/api/tests/test_nodes_api.py`, with the fixtures rebuilt first:

| Test | Proves |
|---|---|
| *Salmon*: every field, needs in the file's order, five goes-deeper, related *kallisto* | the three kinds of link |
| *EM algorithm*'s `needed_by` holds *Salmon*, with *Salmon*'s reason | *needed by* is derived |
| *Probability* has no needs | a first-steps node |
| an unknown id and a malformed id: 404 with the message | misses after a build |
| an empty database; one with only refused builds: 503 | no index yet |
| three queries for *Salmon* | no query per neighbour |
| the route is in the OpenAPI schema | the docs show it |

## M1P6.6 M1 is done when

R4's *done when*, as the parts list states it, is three checks:

1. the validator accepts the fixtures — part 4, `tests/schema/test_fixtures.py`;
2. it rejects a broken node with a message naming the file and the field — part 3's tests;
3. the index rebuilds from the files alone — this part's command test.

The part 6 journal entry lists the three with their commands and records M1 done; CLAUDE.md's status
says M1 is complete and M2, the weaver, is next, and its commands gain
`uv run python apps/api/manage.py rebuild_index --root tests/fixtures/salmon` to fill a local
database.

**Scaling** is unchanged from M1P5.7. The endpoint reads only the index, so its contract can outlive
the move to a central database.
