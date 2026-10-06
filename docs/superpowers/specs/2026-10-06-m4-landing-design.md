# M4.6 — Landing through the GitHub App

**Status: agreed 2026-10-06.** The sixth part of M4 (#74), issue #124. Designed with the operator
in conversation on 2026-10-06, section by section. It builds on M4.5's review (archived spec
`2026-10-06-m4-review-design.md`): a draft is `approved` at a named revision, with its event log.

It decides:

- what a batch is and who chooses it (M4L.1);
- how Studio writes to GitHub, and why no worker keeps a checkout (M4L.2);
- a landing's states, and what is checked before anything is written (M4L.3);
- the GitHub App, its client, what lands and the provenance (M4L.4);
- the API and its codes (M4L.5);
- #102: review of content pull requests that do not come from Studio (M4L.6);
- the build and *done when* (M4L.7).

**No screens** (S10, the Land screen, is M4.9). **Not following `main`**: marking drafts landed
once a merge is indexed is M4.7. **Nothing reaches GitHub in tests**; registering the app and the
first real landing are M4.9's walk.

---

## M4L.1 The batch

**Decided: the operator picks** approved drafts from a list, all of them preselected, and lands
them as one batch: one commit, one pull request. Only an operator lands (#124).

*Rejected:* always everything approved (one bad draft fails all of them, and a draft cannot wait
for its *related* partner); one pull request per draft (two nodes that link as *related* could
never land together, and #124 asks for batches).

## M4L.2 How Studio writes to GitHub: no checkout anywhere

The operator asked that workers stay identical and disposable, so that they scale out (several
processes now, Kubernetes later). **Decided: no worker keeps a checkout of the content
repository.** Postgres is the shared state and GitHub is the store. Everything a landing needs is
already in one of them:

- **Validating the batch in place** uses the index, which holds every node; it is what *verify*
  already does for one draft (M4.4), done for the whole batch at once. If the index lags `main`
  slightly, the pull request's own CI is the final word.
- **Whether a node changed on `main`** is one *compare* call between the draft's starting commit
  and `main`'s head (M4L.3).
- **The commit** is built with the Git Data API: a tree with the files inline on top of `main`'s
  tree, a commit, a branch. A landing is a constant handful of calls whatever its size.

Landings need no lock: two batches never share a draft (M4L.3), so they run in parallel on any
worker. If `main` moves between a landing and its merge, GitHub reports the conflict and the
landing shows as failed. M4.7 can follow `main` the same way, from a commit's tarball unpacked to a
temporary folder; that is its spec to decide.

*Rejected:* a worker's checkout with git over the wire (proposed first, then dropped: it ties
landing and following to one stateful process, and copies the repository to every worker that may
need it); the Contents API (one commit per file, not one per batch). The Git Data API was first set
aside on the belief that validation needed the whole repository fetched; the index already is the
whole repository.

**#124's check changes accordingly**: a local bare remote was named as the test double; with no git
over the wire, a fake of the GitHub API is the only one.

## M4L.3 A landing, its states and what is checked first

**`Landing`**: one batch. `public_id`, `started_by` (an operator), `started_at`, its drafts (each
with the revision it lands at), `main_head` (the commit it was built on), `branch`, `pull_number`,
`pull_url`, `state`, and `reason` when it does not land.

| State | Means |
|---|---|
| `pending` | queued; any worker may take it |
| `refused` | nothing left Studio: every draft in it was dropped (below) |
| `open` | the branch is pushed, the pull request is open, auto-merge is on |
| `failed` | a required check failed, or GitHub found a conflict |
| `merged` | the pull request merged (set by the poller, M4L.4) |
| `closed` | an operator closed a failed landing: its pull request is closed, its branch deleted |

**A draft is in at most one `pending` or `open` landing**, held by Postgres (a partial unique
constraint on the landing's draft rows). That constraint is why landings need no lock. The draft's
own state stays `approved` throughout; M4.7 moves it to `landed`. When its landing is refused,
failed or closed, the draft is free for a new batch, or an operator sends it back (M4.5).

**Checked when the landing is asked for** (in the request, against the index, no GitHub): every
draft is `approved` and in no live landing, and **the batch validates in place**: the graph rules
with every draft of the batch standing in for its node. A *related* link whose partner is neither
on `main` nor in the batch fails here, so the batch is refused before anything leaves Studio, with
the failing items, as the checklist reports them.

**Checked by the worker** before writing, per draft; a draft that fails is **dropped**, named with
its code, and the rest go ahead:

- **its node changed on `main`**: the node's folder is among the files changed between the draft's
  starting commit and `main`'s head;
- **a new node's folder already exists** on `main`;
- **its starting build has no commit**: the commit is `IndexBuild.commit` of the build whose digest
  the draft started from (`Draft.base_digest`); M4.7 fills it, and until then the draft cannot be
  checked for staleness, so it is dropped rather than guessed.

If every draft is dropped, the landing is `refused`.

**A region change moves nothing.** The validator does not tie a folder to a region (ids are unique
wherever the folders sit), so a draft lands in the folder it was opened at.

Each draft's `DraftEvent` log gains a **`landing`** event pointing at the batch when its landing
opens. *Rejected:* refusing the whole batch for one stale draft (it blocks unrelated nodes);
landing a stale draft anyway (the pull request auto-merges when green, so nobody would look).

## M4L.4 The GitHub App, its client, and what lands

**Settings**, all read by `code_api/config/env.py`: `CODE_GITHUB_APP_ID`,
`CODE_GITHUB_APP_INSTALLATION_ID`, `CODE_GITHUB_APP_PRIVATE_KEY` (the PEM key),
`CODE_CONTENT_REPOSITORY` (`owner/name`) and `CODE_GITHUB_API_URL` (GitHub's API by default; the
tests point it at a stub). Unset, landing answers that it is not configured, and the rest of
Studio works.

**Authentication**: the app signs a short JWT with its key (PyJWT, already in the lock through
allauth) and exchanges it for an installation token, which lasts an hour and is cached until
shortly before it expires. No long-lived token exists.

**One client, `code_api/studio/github.py`**, wraps the calls used, over `requests` (in the lock):
read `main`'s head and tree; compare two commits; create a tree, a commit and a branch; open and
close a pull request; delete a branch; enable auto-merge (GraphQL, squash, the only method the
content repository allows); read a pull request's state and its checks. Every call has a timeout.
A GitHub error becomes the landing's `reason` in plain words, never a 500.

**What lands:**

- the branch `studio/landing-<short id>`;
- one commit, `content: land <n> nodes (<ids>)`, whose tree is `main`'s plus each draft's three
  files at its approved revision, written by the canonical writer; an empty `exam.yaml` deletes the
  file;
- one pull request, titled as the commit, with auto-merge on.

**The provenance** (W9, the first spec's §5.4) is the pull request's body, one section per node:
its id and title, new or changed; drafted by (everyone who saved a revision); approved by, at which
revision; the review (questions answered, how many wrong); and **self-approved**, with its stated
reason, where it applies. People appear as **`@login` where a GitHub account is linked, else their
display name; never an email** (the content repository is public). The body ends with a hidden
marker, `<!-- comeni-studio landing <public id> -->`, so a merge can be matched to its landing.

*Rejected:* display names only (a full name the person never chose to publish); roles only (the
public record could not say who stands behind a node).

**Watching**: a beat task polls each `open` landing every few minutes, from any worker. A merged
pull request makes it `merged`; a failed required check or a conflict makes it `failed`, with the
check's name and link as its reason. Polling, because a local stack cannot receive webhooks;
webhooks can come later.

## M4L.5 The API

Under Studio's gate, **operator only**:

| Route | Does |
|---|---|
| `GET /api/studio/drafts?state=approved` | (exists) gains `landing`: the draft's live landing, or null |
| `POST /api/studio/landings` | `{drafts: [public_id, …]}`: checks the batch (M4L.3), creates it `pending`, queues it; **202** |
| `GET /api/studio/landings` | the landings, newest first |
| `GET /api/studio/landings/{id}` | state, drafts landed and dropped (each with code and reason), branch, pull request, reason |
| `POST /api/studio/landings/{id}/close` | a `failed` landing only: closes its pull request, deletes its branch |

**Codes**, a new band `CA0300–CA0399`, *landing*: landing is not configured; a draft is not
approved; a draft is already in a landing; the batch is empty; the batch fails validation in place
(with its items); dropped — the node changed on `main`; dropped — a new node's folder exists;
dropped — its starting build has no commit; only a failed landing can be closed.

## M4L.6 #102: content pull requests that do not come from Studio

R1 says a pull request from outside Studio needs a maintainer's review; R8.9 asked how, with one
maintainer, whose required approval would block their own pull requests. Today the content
repository requires `validate` and no approval, and the operator is its only collaborator.

**Decided: a `review` check in the content repository** (operator: "do a, it's fine"):

- **`MAINTAINERS`** lists the people (the operator, today); **`.github/studio-app`** holds the
  app's bot login, filled in at M4.9 when the app is registered;
- a **`review`** job in `validate.yml`, run also when a review is submitted: it passes when the
  pull request's author is the Studio app or a maintainer, and otherwise only once a maintainer has
  approved it;
- the content repository's **ruleset requires `review`** beside `validate` (its JSON kept in that
  repository's `.github/rulesets/main.json`).

Requiring `review` early breaks nothing: the operator is a maintainer. **Each step is outward and
confirmed with the operator first**: the content repository's pull request and the ruleset change
in this part, the app's login in M4.9. A second maintainer is a one-line pull request to
`MAINTAINERS`.

*Rejected:* one required approval with the app as a bypass actor (a bypass skips every rule,
`validate` included, and the sole maintainer could not merge their own); no rule until a second
person has write access (proposed when the operator asked why it was needed today, then set aside:
the check is small and recognises Studio by its app).

## M4L.7 The build and *done when*

**Modules**: `code_api/studio/landing.py` (the batch, its checks, the worker's steps, the poller),
`code_api/studio/github.py` (the client and the app's token), the `Landing` model and its draft
rows in `studio/models.py`, the routes in `studio/api.py`; Celery tasks for a landing and for the
poller, scheduled by beat.

**Tests**, test-first, with **a fake GitHub**: commits, trees, branches and pull requests in
memory behind the client's interface, which can fail a check, report a conflict or answer with an
error. The real client is tested against a local HTTP stub: the JWT, the token exchange and its
cache, a timeout, an error becoming a reason. They cover:

- a batch of two drafts: **one commit** on one branch, **one pull request** whose body carries the
  provenance;
- a failed check: both drafts still `approved`, the landing `failed`; closing it frees them;
- a stale draft, an existing folder and a missing starting commit, each dropped while the rest
  land; every draft dropped is `refused`;
- a batch failing in place (a *related* partner missing) refused before any GitHub call;
- an empty `exam.yaml` deleting the file; self-approval with its reason in the body; `@login` for a
  linked account, the display name otherwise, and no email anywhere;
- two landings racing for one draft (one wins, through the constraint); two with different drafts
  both open;
- the poller: `open` to `merged`, or to `failed` with the check's link;
- every route's statuses and codes, operator only.

**Beside the code**: the settings in `.env.example`, `env.py` and CI's `env:`; CA03xx in
`diagnostics.yml` and the regenerated reference; `openapi.json` and the web's types; `CLAUDE.md`'s
layout line; #124's check reworded (M4L.2); a journal entry; #102 closed by the content
repository's pull request.

**Done when** #124's check holds as reworded: a batch of two drafts is one commit in the fake
GitHub with the provenance in its pull request, and a failed check leaves the drafts approved, not
landed; and the content repository's `review` check is merged and required.

## Notes from the build

Decided while building, each with its reason; the plan's ledger holds the rest.

- **A failed landing holds its drafts** until an operator closes it (M4L.3 said *failed* frees
  them): its pull request can still merge on a re-run, so freeing them could land a node twice.
  A landing without auto-merge (GitHub refused to turn it on) stays failed when its checks go
  green, or its pull request would sit open forever (#203).
- **Staleness compares the folder's tree** at the draft's starting commit and at `main`'s head,
  not the *compare* call M4L.2 names: compare lists at most 300 changed files, on its first page
  only, so a large change on `main` would go unseen (#203).
- **Every failure ends a landing in words, and leaves nothing behind Studio cannot close** (#203).
  GitHub's calls run outside any transaction; a short one claims the landing and names its
  branch. After a failure, a pull request that exists makes the landing failed; otherwise the
  branch is deleted and the landing refused. A landing claimed long ago is recovered, and one
  lost in the queue (Celery acknowledges on delivery) is run by the poller. A worker without the
  app's settings refuses the landing.
- **The claim is a token** (#204): recovery takes a new claim, and a worker whose claim is gone
  writes no branch, or closes the pull request it opened. Commit statuses count as failed checks
  (the `review` check is one); an open landing without auto-merge becomes failed; close reads the
  pull request first, so one merged since the last poll keeps its drafts.
- **Routes in `studio/landing_api.py`**, their own router gated by operator, beside the drafts
  router; the poll interval is `WATCH_LANDINGS_SECONDS` in settings.
- **The `review` check runs on `pull_request_target`** and posts a commit status, not a job in
  `validate.yml` (M4L.6): a pull request runs its own copy of a `pull_request` workflow, so it
  could edit the check that judges it.

## Not in this part

The Land screen (M4.9); following `main`, `landed` drafts and filling `IndexBuild.commit` (M4.7);
registering the app and the first real landing (M4.9); moving the content repository's validator
pin (before the first landing, M4.9); webhooks; a rebase tool for a stale draft.
