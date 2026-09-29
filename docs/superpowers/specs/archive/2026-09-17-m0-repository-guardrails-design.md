# M0 part 9 — repository guardrails

**Status: agreed 2026-09-17; built in comeni-code-content #1–#4 and Comeni-Code #30–#31.** This is part 9, the last part of phase M0 (architecture spec R4).
The parts list is in [`2026-09-17-m0-in-parts.md`](../../notes/journal/2026-09-17-m0-in-parts.md),
which already decided that the content repository's protection has **no bypass**, the operator
included. This spec decides what R7 leaves to this part:

- what the content repository's CI stub checks;
- its merge settings;
- the rulesets, for `comeni-code-content` and (added in this part) for Comeni-Code itself;
- how the rulesets are kept and proven.

The operator made every decision here on 2026-09-17, section by section. An agent proposed them
and checked the CI stub in a scratch clone. **Every change to GitHub settings is applied only after
the operator confirms it.**

---

## P9.1 What this part does

It makes `main` in both repositories reachable only through a pull request whose checks passed,
for everyone. In `comeni-code-content` a green pull request can merge itself, which is what
landing (R3) will rely on.

**Done when:**

- `comeni-code-content` has the `validate` workflow, auto-merge on, squash merges only, branches
  deleted after merge, and the ruleset in `.github/rulesets/main.json` active with no bypass;
- in `comeni-code-content`:
  - a useful pull request marked for auto-merge merges on its own once `validate` passes;
  - a pull request with invalid YAML turns `validate` red and does not merge; it is then closed;
  - a direct push to `main` from the operator's account is refused (GH013). The force-push and
    deletion rules are confirmed by reading the live ruleset back, not by trying them: if a
    ruleset were wrong, a force push that succeeded would rewrite `main`;
- Comeni-Code has the ruleset in `.github/rulesets/main.json` active with no bypass, requiring
  `python`, `web` and `stack`; merging a pull request before its checks finish is refused, and a
  direct push to `main` is refused;
- **M0's done-when holds in full**, and the journal checks each item.

Out of scope: a required human review of pull requests that don't come from Studio (P9.2), and an
automated CI check that the live rulesets still match their files (P9.3).

## P9.2 The content repository: CI stub and merge settings

```
.github/workflows/validate.yml   one job, named validate, on pull requests and pushes to main
.github/scripts/validate.py      the checks (uv script; PyYAML)
.github/rulesets/main.json       the ruleset, applied with gh api
```

- **The job is named `validate`,** and the ruleset requires that name, so it stays. Comeni Code M1
  replaces what it checks, not the name.
- **Until the node format exists, it checks what already has rules:**
  1. `LICENSE` exists and starts with *Attribution 4.0 International* (CC BY 4.0);
  2. `README.md` exists;
  3. every tracked `*.yaml` or `*.yml` file parses (reported as `file:line: problem`);
  4. no tracked file is larger than 5 MB;
  5. then it says that node validation arrives with M1, so green is not mistaken for more.
- **Scratch build:** the script passed on the repository as it is, and failed for invalid YAML
  (`broken.yaml:2: not valid YAML (expected ',' or ']', but got '<stream end>')`), a 6 MB file, and
  a changed licence. `actions/checkout` and `astral-sh/setup-uv` are pinned to the SHAs Comeni-Code
  uses.
- **Merge settings:** auto-merge on; **squash only**, so one landing batch is one commit on
  `main`, the commit the index records (R3); delete branches after merge.
- **Not in M0: a required review for pull requests that don't come from Studio** (the README's
  rule). With one maintainer, a required approval blocks the maintainer's own pull requests
  (GitHub doesn't count an author's approval), and Studio has no GitHub identity yet to exempt.
  It is decided with landing in M4 and added to R8.

**Rejected:**

| Alternative | Why not |
|---|---|
| A stub that always passes | proves nothing; the first real check would arrive untested |
| Merge commits | the index would pick one commit from each batch |
| A required approval now | blocks the only maintainer |

## P9.3 The rulesets

Both repositories get a ruleset named `main` on the default branch, **enforcement active, no
bypass actors**, kept as `.github/rulesets/main.json` and applied with
`gh api -X POST repos/<owner>/<repo>/rulesets --input .github/rulesets/main.json`:

| Rule | `comeni-code-content` | Comeni-Code |
|---|---|---|
| Pull request required (0 approvals; review threads resolved) | yes | yes |
| Allowed merge method | squash | merge commit (the house style) |
| Required checks (GitHub Actions, app 15368), not strict | `validate` | `python`, `web`, `stack` |
| Block force pushes (`non_fast_forward`) | yes | yes |
| Block deleting `main` | yes | yes |

- **Comeni-Code's ruleset was added by the operator in this part:** PR #26 merged with a red check
  because nothing on GitHub refused it. With the ruleset, GitHub refuses whatever a command does.
  The cost, accepted: every change, a typo included, waits for CI (about a minute), and so does an
  emergency fix.
- **Not strict** (branches needn't be up to date with `main` before merging): landing batches touch
  different node folders, and requiring updates would serialise them. Comeni-Code's PRs are
  sequential anyway.
- **The files are the record.** A settings change is a reviewed diff; the file is applied after
  its pull request merges.

**Order**, each outward step after the operator's confirmation:

1. content: the `validate` workflow and script by pull request, merged when green (nothing requires
   it yet, so this step cannot lock anything);
2. content: merge settings (auto-merge, squash only, delete branches);
3. content: the ruleset file by pull request, then applied;
4. content: the proofs (P9.1);
5. Comeni-Code: the ruleset file by pull request (this part's build PR), merged, then applied;
6. Comeni-Code: the proofs, using the journal PR (merge refused while checks run) and a direct push;
   the live ruleset read back and compared with the file in both repositories.

**Rejected:**

| Alternative | Why not |
|---|---|
| Classic branch protection | rulesets are GitHub's current mechanism, and can be listed and read through the API as JSON |
| A bypass for the operator | the M0 check says the operator's push is refused too (parts list) |
| Settings only in the web interface | no record of what was set or why |
| A CI check comparing live rulesets with the files | needs an API token in CI; revisit when something else does |

## P9.4 Docs

- **`comeni-code-content` README:** what `validate` checks today, that `main` takes pull requests
  only, and that review of non-Studio pull requests arrives with M4.
- **Architecture spec R8:** a new open question, *required review for pull requests that don't come
  from Studio*, decided with landing (M4).
- **Comeni-Code CLAUDE.md:** `main` in both repositories accepts only pull requests with green
  checks, for everyone; rulesets live in `.github/rulesets/`; the repository settings in *Confirm
  outward-facing actions first* now name them.

## P9.5 Risks

- **No bypass means no shortcut.** If CI itself breaks (a runner outage, a pinned action removed),
  nothing merges until it is fixed or the operator edits the ruleset in the web interface, which
  is a recorded settings change.
- **A renamed CI job blocks every merge.** The ruleset requires jobs by name; renaming one means
  changing the ruleset file in the same change.
- **The `stack` job now gates every Comeni-Code merge.** A slow or flaky Docker build blocks docs
  changes too. If that happens, the answer is caching or fixing the flake, not dropping the check.
