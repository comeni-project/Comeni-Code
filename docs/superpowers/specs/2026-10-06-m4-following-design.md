# M4.7 — Following the content repository

**Status: agreed 2026-10-06.** The seventh part of M4 (#74), issue #125. Designed with the
operator in conversation on 2026-10-06, section by section. It builds on M4.6's landing (archived
spec `2026-10-06-m4-landing-design.md`): approved drafts go out as one pull request per batch, and
a landing turns `merged` when its pull request merges.

It decides:

- how the index follows `comeni-code-content`'s `main`: one reconciler (M4F.1);
- where content comes from: one interface, two sources, one factory (M4F.2);
- when a draft is `landed` (M4F.3);
- when following runs (M4F.4);
- what the team sees of the index (M4F.5);
- the build and *done when* (M4F.6).

**No screens** (M4.9 shows the route). **No webhooks** (a local stack cannot receive them).

---

## M4F.1 One reconciler

**Decided: the index follows `main` through one method, `follow(source)`**, a reconciler — the loop
GitOps tools (Argo CD, Flux) and Kubernetes controllers use. Each round compares what should be
with what is, and makes one move towards it:

1. **What should be**: `want = source.head()`. **What is**: the live build's commit (the latest
   applied `IndexBuild`). If they are equal, go to step 3.
2. **Build**: `with source.checkout(want) as folder: rebuild_index(folder, commit=want)`. A head
   whose own last attempt was refused is skipped until `main` moves.
3. **Mark landed**: every `merged` landing whose merge commit the live build contains
   (`source.contains`) has its drafts marked `landed` (M4F.3).

Every case falls out of the loop, with no rule of its own: a failing commit is refused and the old
index stands; a build from another folder makes *what is* differ, so the next round puts `main`
back; two workers at once take one try-lock around `follow`, and the second skips; a refused build
lands nothing, because step 3 reads only the live build. **Each round is safe to repeat**: building
the same commit changes nothing, and `landed` is final.

*Rejected:* a handler per event (merge seen, commit pushed) with special cases for manual rebuilds
and refusals — the agent drifted into it, and the operator found it "really hard to follow and
complex for no reason"; a worker's checkout of `main` (#125's first wording; rejected with M4.6's
M4L.2: workers keep no state).

## M4F.2 One interface, two sources, one factory

The operator asked that the manual rebuild not be a second path ("dead code on live"): **one method,
and only where content comes from varies** — the Strategy pattern, with a factory to pick it.

**`Source`**: `head() -> str | None`, `checkout(head) -> ContextManager[Path]`,
`contains(ancestor, commit) -> bool`.

| | `GitHubSource` (live) | `FolderSource` (local, tests) |
|---|---|---|
| `head()` | `main`'s commit | `None`: unknown, so every round builds |
| `checkout()` | the commit's tarball, unpacked to a temporary folder, deleted after | the folder itself |
| `contains()` | the merge-commit check (compare's status: *identical* or *ahead*) | false: nothing lands locally |

**`configured_source()`** picks from settings: the GitHub App when it is configured (M4.6), else
`CODE_CONTENT_ROOT`, else nothing (following is off).

**Everything calls the same method**: beat and the landing poller, `follow(configured_source())`;
`manage.py rebuild_index`, `follow(FolderSource(root))` with `--root`, or
`follow(configured_source())` without; the tests, a `FolderSource` over the fixtures or a fake
GitHub source. A `--root` rebuild on a live server is put back to `main` by the next round, so it
needs no refusal, no `--force` and no mode.

**The tarball is unpacked safely**: its size is capped, and Python's `tarfile` `data` filter
refuses absolute paths, `..`, and links that leave the folder. Compare is used for its status only,
never for its file list, so its 300-file cap does not apply (M4.6, #203).

`rebuild_index`, the function, stays the internal step that writes the index; only `follow` calls
it (and existing tests that build an index directly).

## M4F.3 Landed

- **A landing remembers its merge commit**: the poller records GitHub's `merge_commit_sha` as
  `Landing.merge_commit` when it sees the pull request merged, and queues `follow`.
- **`Draft.State.LANDED`**, final, with a `landed` event naming the build. Not a live state: the node
  is free for a new draft, which starts from the index that now holds the landed version. The
  landing's entries are released.
- **A refused build lands nothing**: the drafts stay `approved`, held by their merged landing, until a
  build containing the merge is applied. `main` refuses force-pushes, so once a commit contains the
  merge, every later one does.
- **Every follow fills `IndexBuild.commit`**, so drafts opened after it have a starting commit for
  M4.6's staleness check. A draft opened from an older build without one still meets CA0308 at
  landing; reopening it after a follow fixes that.

## M4F.4 When following runs

**Decided: on a timer, and at once when a landing merges** (operator: A). Beat runs `follow` every
five minutes, which catches direct pull requests and anything missed; the landing poller queues it
the moment it records a merge, so a landed node reaches learners in seconds. *Rejected:* a timer
only (a landed node waits up to an interval); only on merge (misses direct pull requests).

## M4F.5 What the team sees

**Decided: `GET /api/studio/index`** (any member, `studio(Role.AUTHOR)`) (operator: A): the live
build (commit, time, node count), the latest attempt and, when refused, the validator's own
messages, `main`'s last-seen head and `behind` when it differs from the live build. The last-seen
head is a cache entry written by each round, so the route asks GitHub nothing.

**`/api/health` is unchanged**: its checks are up or down, and an index behind `main` is not the
service down (it would fail the stack check over content). *Rejected:* a line in health; nothing
beyond the `IndexBuild` rows.

## M4F.6 The build and *done when*

**Modules**: `code_api/studio/follow.py` (`Source`, `GitHubSource`, `FolderSource`,
`configured_source`, `follow`); `landing.mark_landed`; `github.py` gains `tarball` and the
merge-commit check, and `PullState` the merge commit; the `rebuild_index` command moves into the
studio app under the same name, as a wrapper around `follow`, so the content app depends on nothing
in Studio; `Landing.merge_commit`, `Draft.State.LANDED` and the `landed` event; a Celery task and
beat entry for `follow`; the route.

**Tests**, test-first, with a fake GitHub source serving tarballs built in memory from the
fixtures: a new commit is indexed in one round, its commit recorded; a refused commit leaves the old
index and is not retried until `main` moves; a second `follow` while one runs skips; a build from
another folder is put back next round; a merged landing's drafts become `landed` once the live build
contains the merge, and not while it is refused; `landed` frees the node; the tarball cannot write
outside its folder; the route reports, `behind` included; `rebuild_index --root` still fills a
local index.

**Done when** #125's check holds, reworded with M4F.1: a commit in the fake GitHub is indexed
within one round; a refused commit leaves the old index; a draft flips to landed.

## Notes from the build

- **A refused head falls back to `main`'s last good build** (#216): M4F.1's step 2 only skipped a
  refused head, so a stray folder build stayed live while `main` was refused. Now the round keeps
  the latest applied build that came from a commit, and "main wins" holds in that case too.
- **One landing GitHub cannot check never stops the others** (#216): each merged landing's
  `contains` call is tried on its own, in order; an error is logged and retried next round.
- **Queueing after a merge or a landing is robust** (#216): a broker that is down no longer turns a
  committed merge into a 500; beat's timer catches up.
- **Tarballs refuse absolute and `..` paths outright**, and the root is read from what was
  unpacked: Python's `data` filter strips a leading `/` quietly rather than refusing it.
- **The command says "Nothing built"** when the index is already at the source's head, or that head
  was refused before; its exit codes and other lines are unchanged.

## Not in this part

Webhooks; the screens (M4.9); `providers.yaml` in `comeni-code-content` (content for M4.9's first
walk: without it the real `main` is refused); registering the app (M4.9).
