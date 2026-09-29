# 2026-09-17 — M0 part 9: repository guardrails, and M0 is done

**Part 9 of M0 is built, and with it phase M0 (Skeleton) is done.**
- `comeni-code-content` has a `validate` check, auto-merge with squash merges only, and a
  no-bypass ruleset: `main` takes only green pull requests, from anyone.
- Comeni-Code's `main` has a no-bypass ruleset too: a pull request merges only after `python`,
  `web` and `stack` pass.
- Both rulesets live as `.github/rulesets/main.json` in their repositories.

**Next is M1 (content core),** which starts with its parts list in a new journal entry, then the
first part's spec.

The operator agreed the design section by section, added Comeni-Code's own ruleset (after PR #26
merged red in part 8), and confirmed each of the three settings changes separately before it was
applied.

---

## Where things stand

**`comeni-code-content`:**

| Claim | Check |
|---|---|
| `validate` runs on pull requests and pushes to `main` | PR #1 added it; it passed in 9 s |
| Merge settings | `gh api repos/comeni-project/comeni-code-content --jq '{allow_auto_merge, allow_squash_merge, allow_merge_commit, allow_rebase_merge, delete_branch_on_merge}'` → `true, true, false, false, true` |
| The ruleset is active and matches its file | ruleset 23605254; read back and compared with `.github/rulesets/main.json`: *live ruleset matches the file* |
| A green pull request merges itself | PR #3 (the README's protection section), marked `--auto --squash`: merged once `validate` passed, with no manual merge |
| A red pull request doesn't merge | PR #4 (`broken.yaml`): `validate` failed with `broken.yaml:2: not valid YAML (expected ',' or ']', but got '<stream end>')`; auto-merge left it open; `gh pr merge --squash` was refused ("the base branch policy prohibits the merge"); closed, branch deleted |
| A direct push is refused, the operator's included | an empty commit pushed to `main` from `rafaelmdc`: `GH013 … Changes must be made through a pull request. Required status check "validate" is expected.`; local commit reset; `main` unchanged |

**Comeni-Code:**

| Claim | Check |
|---|---|
| The ruleset is active and matches its file | ruleset 23605495; read back: *live ruleset matches the file* |
| A direct push is refused | `GH013 … Changes must be made through a pull request. 3 of 3 required status checks are expected.`; `main` unchanged at 812f69a |
| A merge before the checks finish is refused | this entry's PR (#31): `gh pr merge --merge` right after opening it exited 1, "the base branch policy prohibits the merge" |

Force pushes and deleting `main` were **not attempted** in either repository (a mistaken success
would rewrite `main`); both rules are in the read-back rulesets.

**M0's done-when** (architecture spec R4), item by item:

| Item | Held by |
|---|---|
| `docker compose up` shows a health page | part 8: `ops/stack-check.sh` locally and in CI's `stack` job |
| CI is green | `python`, `web`, `stack`, now required on `main` |
| The purity guard fails when a pure package imports Django | part 1: canary PR #5 failed CI with `code_schema/__init__.py:3: imports django` |
| The content repository refuses a direct push to main | this part: GH013 above |

**M0 is done.**

## What changed this session

- Comeni-Code: PR #29 (spec and plan), PR #30 (the ruleset file, CLAUDE.md, R8 item 9), PR #31
  (this entry).
- `comeni-code-content`: PR #1 (`validate`), PR #2 (the ruleset file), PR #3 (README), PR #4
  (the broken-YAML proof, closed unmerged).
- Settings, each confirmed by the operator first: the content repository's merge settings; the
  content repository's ruleset; Comeni-Code's ruleset.

## Decisions made, and why

The spec holds the rejected alternatives. In order:

1. **Section 1:** a `validate` stub that checks the licence, README, YAML and file sizes, and says
   node validation comes with M1; squash merges only, so one landing batch is one commit; no
   required review yet (one maintainer can't approve their own pull requests), recorded as R8
   item 9 for M4.
2. **Section 2:** rulesets as files applied with `gh api`, no bypass; **Comeni-Code's `main`
   protected too** (operator), so GitHub refuses a red merge whatever a command does.
3. **Section 3:** the proofs, with the force-push proof replaced by a read-back (spec P9.1).

## What is next

1. **M1, content core:** a parts list in a new journal entry (architecture spec R4 M1 and the
   tutor spec's additions), then the first part's spec. Node validation replaces what `validate`
   checks in the content repository; the job keeps its name.
2. Carried open questions: R8 item 9 (review of non-Studio content pull requests), image digests
   (part 8), light chip contrast (part 6), jsdom 30 (part 5).

## Traps

- **No bypass means CI must work.** If a runner or a pinned action breaks, nothing merges in that
  repository until CI is fixed, or the operator edits the ruleset (a recorded change).
- **A renamed CI job blocks every merge.** The rulesets require `validate`, `python`, `web` and
  `stack` by name; rename a job and its ruleset file in the same change, and re-apply the file.
- **`gh pr merge` suggests `--admin`.** With no bypass actors it has nothing to bypass; don't use it.
- **`gh pr close --delete-branch` fails while that branch is checked out locally,** and a pipe to
  `tail` hid it once here (PR #4 stayed open until closed again). Check out `main` first.
- **Auto-merges are credited to whoever enabled auto-merge** (`mergedBy` is the operator on PR #3),
  not to a bot.
