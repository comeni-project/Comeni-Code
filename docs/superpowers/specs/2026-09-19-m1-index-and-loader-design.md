# M1 part 5 — the index and the loader

**Status: agreed 2026-09-19.** This is part 5 of phase M1 (architecture spec R4). The parts list is
in [`2026-09-18-m1-in-parts.md`](../../notes/journal/2026-09-18-m1-in-parts.md). It builds on
[part 3](2026-09-18-m1-graph-rules-and-validate-design.md)'s `read_content` and loads
[part 4](2026-09-19-m1-salmon-fixtures-design.md)'s fixtures. It decides:

- what a rebuild does when the content has problems;
- how the rest of the app refers to a node;
- what the index holds, as Django models;
- how a rebuild runs, and how each attempt is recorded.

The operator made every decision here on 2026-09-19, question by question; an agent proposed them.

**This is the MVP's index, and the operator has said it will not scale as it is.** A full rebuild
per content change, and an index that is a disposable copy of a git checkout, suit one content
repository and thousands of nodes. When content moves to a central database — much later — this
part is replaced, not extended (M1P5.7).

---

## M1P5.1 What this part does

A new Django app, `code_api.content`, holds the **index**: the approved content as tables, derived
from the files and never edited (R3). One function rebuilds it from a content folder with
`read_content`, the same call content CI makes, so the app and CI can never disagree about what a
valid node is.

```
content folder ──read_content()──► rebuild_index() ──► Region · Node · Link · IndexBuild
```

**Done when:**

- a rebuild from `tests/fixtures/salmon/` gives the same index twice;
- a rebuild after an edit gives exactly what a first build of the edited folder gives;
- a folder with problems changes nothing and is recorded as refused, with the validator's messages;
- every test in M1P5.6 passes, `makemigrations --check` is clean, and CI is green.

**Out of scope:** the `rebuild_index` command and the `CODE_CONTENT_ROOT` setting (part 6); the read
API and *needed by* over HTTP (part 6); the worker that follows the content repository (a later
phase); search (R8.1); anything the weaver computes (M2).

## M1P5.2 A rebuild is all or nothing

**If `read_content` reports any problem, the rebuild changes nothing.** The old index stays, and
the attempt is recorded as refused with every problem. Otherwise the whole new index replaces the
old one in one transaction. Learners never see a half-built graph, and a route is never computed
over a graph with a node missing. Content CI already refuses broken content, so this should almost
never happen — when it does, it is loud, not quiet damage.

**Rejected:**

| Alternative | Why not |
|---|---|
| Load the valid nodes, skip the broken ones | a missing node silently shortens routes (*Salmon* without *EM*), and invariant 1's *same graph, same route* would depend on which files happened to break |
| Load everything, flag broken nodes | the most complex, and the weaver would have to understand flags |

## M1P5.3 Everything else refers to a node by its id

**Tables outside the index — learner evidence, Studio drafts, requests, self-test results — store
a node's id as a plain string, with no database foreign key to the index.** The index is then a
disposable copy: each rebuild deletes it and writes it again. A node removed from content leaves
learner data alone — evidence still says `k-mers`, and matches again if the node returns. The
price: the database cannot refuse a reference to a node that does not exist, so code treats *id
not in the index* as a normal case (the API will say the topic was removed or renamed). A rename is
already a folder move in one pull request (M1P1.2); a rename map can carry evidence across one
later.

**Rejected:** foreign keys to index rows. The rebuild would have to update rows in place, and
removing a node from content would either fail the rebuild (a protected key) or delete learners'
evidence (a cascade) — a content edit tangled with learner data.

## M1P5.4 The tables

| Model | Fields | Notes |
|---|---|---|
| `Region` | `id` (slug, primary key), `name`, `position` | `position` keeps `regions.yaml`'s order, which routes use to break ties (W3.3) |
| `Node` | `id` (slug, primary key), `title`, `claim`, `region` → `Region`, `level`, `minutes`, `body`, `folder` | `level` is one of the five values, as text; `folder` is the node's path in the content repository, for *edit on GitHub* later |
| `Link` | `source` → `Node`, `target` → `Node`, `kind`, `reason`, `position` | `kind` is `needs`, `goes-deeper` or `related`; unique on (`source`, `kind`, `target`); `position` keeps the author's order within a kind |
| `IndexBuild` | `id`, `created_at`, `outcome`, `digest`, `commit`, `node_count`, `problems` | one row per attempt, kept; `outcome` is `applied` or `refused`; `commit` may be blank; `problems` is a list of strings. The live index is the latest applied build |

- **The index holds everything, `body.md` included.** The API and the weaver read only Postgres;
  only the process that rebuilds needs the content checkout. A body is a few kilobytes, trivial at
  ten thousand nodes. *Rejected for the MVP:* bodies read from disk on request — every API process
  would need the checkout mounted, and a checkout newer than the index would show a body that
  disagrees with its links. The operator noted it may return if a distributed system needs it.
- **Foreign keys inside the index are fine.** `Link` → `Node` and `Node` → `Region` are always
  replaced together, in one transaction.
- **Nothing derived is stored.** *Needed by* is a reverse query on `Link`; a *related* link is
  stored as its two written halves, as the files have it.
- **No second writer.** The only code that writes these models is `code_api/content/index.py`.
  The Django admin is not installed, and part 6's API is read-only.
- **Text columns carry no length limits.** `title` ≤ 80 and `claim` ≤ 200 are the validator's
  rules; repeating them as column sizes would give the rules two homes, and a rule tightened in one
  and not the other would turn a clean rebuild into a database error.

## M1P5.5 The rebuild

`code_api.content.index.rebuild_index(root: Path, *, commit: str = "") -> IndexBuild`:

1. **Read**: `content = read_content(root)`.
2. **Digest**: SHA-256 over `regions.yaml` and every file inside every node folder, in sorted path
   order, hashing each file's relative path and then its bytes. Files outside the nodes (a README,
   `.github/`) do not change it, because they do not change the index; hidden folders are skipped,
   as `read_content` skips them.
3. **Refuse** if `content.problems` is not empty: write `IndexBuild(outcome="refused",
   problems=[str(p) for p in content.problems], …)`, touch nothing else, return it. Refusing is an
   outcome, not an exception; part 6's command turns it into exit code 1.
4. **Apply** otherwise, in one `transaction.atomic()`: take a transaction-scoped Postgres advisory
   lock (two rebuilds at once run one after the other), delete every `Link`, `Node` and `Region`,
   bulk-insert regions, nodes, then links, and write `IndexBuild(outcome="applied", …)`. Any failure
   rolls the whole transaction back and the old index stands.
5. **Return** the build.

- **Delete and insert, never update.** M1P5.3 made the index disposable, so a fresh copy is the
  simplest correct thing, and convergence after an edit holds by construction.
- **An unchanged digest still rebuilds.** One code path; at this size it costs milliseconds.
- **It does not run git**; the caller passes `commit` (part 6's command leaves it blank, the future
  worker passes the SHA it pulled). **It does not choose the folder**; that is part 6's setting.

**Rejected:** recording only the current build (a refusal would leave no trace), or recording
nothing (a background worker's refusal would be invisible — learners would see yesterday's content
and nobody would know why).

## M1P5.6 What the tests prove

`apps/api/tests/test_content_index.py`, against Compose's Postgres, reading only
`tests/fixtures/salmon/` or copies of it in `tmp_path`. A test helper *dumps* the index: every row
of `Region`, `Node` and `Link` as sorted tuples. Builds are checked on their own, since each rebuild
adds one.

| Test | Proves |
|---|---|
| the fixtures rebuild to 26 nodes, 6 regions, the link count `read_content` gives, and an applied build with its digest and node count | a first build |
| two rebuilds give identical dumps and the same digest, and two applied builds | the same index twice |
| build a copy, edit it (a claim changed, a node removed with the links to it, a node added, a node's needs reordered), rebuild: the dump equals a fresh build of the edited folder into an empty index | converges after an edit |
| after a good build, a broken copy gives a refused build with the validator's exact messages, and the dump is unchanged | all or nothing |
| a failure forced while writing links leaves the old index and no new applied build | the transaction is all or nothing |
| *Salmon*'s needs come back in the file's order | `position` |
| the digest ignores a README change and changes when a body does | the digest tracks the index only |

The advisory lock is not tested: proving it needs two concurrent connections, which is more
machinery than the one line it guards. It is named in the plan so a reviewer checks it by eye.

## M1P5.7 Where this stops scaling

Recorded at the operator's request, so a later phase does not mistake the MVP's choices for
permanent ones:

- **A full rebuild per change** is linear in the size of the content. Fine for one repository and
  thousands of nodes; wrong for a large, frequently edited graph.
- **The index as a copy of a git checkout** assumes one source of truth on disk. A central
  database (the operator's expected direction, 2026-09-18) makes the database the source, and the
  rebuild, the digest and `IndexBuild` go with the files.
- **What should survive that change:** M1P5.3 — everything else refers to a node by its id — and
  M1P5.2's rule that learners never see a half-applied change.
