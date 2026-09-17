# M0 part 9: repository guardrails — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task, driven by one agent. Subagents are for review only (the operator's rule in CLAUDE.md). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `main` in `comeni-code-content` and in Comeni-Code accepts only pull requests whose
checks passed, with no bypass; the content repository's green pull requests can merge themselves.

**Architecture:** A `validate` workflow in the content repository; merge settings through the REST
API; one ruleset per repository, kept as `.github/rulesets/main.json` and applied with `gh api`;
proofs by pull requests and a refused push.

**Tech Stack:** GitHub Actions, repository rulesets, `gh` CLI, a uv script with PyYAML.

**Spec:** [`docs/superpowers/specs/2026-09-17-m0-repository-guardrails-design.md`](../specs/2026-09-17-m0-repository-guardrails-design.md)
(agreed 2026-09-17).

**Tested before writing:** `validate.py` ran in a scratch clone of the content repository: ok on
the repository as it is; failed for invalid YAML, a 6 MB file and a changed licence. The GitHub
Actions app ID (15368) was read from Comeni-Code's check runs. Neither repository has a ruleset.

## Global Constraints

- **STOP before every step marked ⚠ SETTINGS** and get the operator's explicit confirmation for
  that change in the conversation. Approval of the plan is not approval of the settings.
- **Merge only on green, checking the exit code:** `gh pr checks --watch > /tmp/checks.log 2>&1; rc=$?; tail -5 /tmp/checks.log; echo "checks exit=$rc"` then merge only
  if `rc` is 0. Never pipe `gh pr checks` into another command before `&&`.
- **Never attempt a force push or a branch deletion** on either `main`; those rules are proven by
  reading the live ruleset back.
- **Run the link check after `git add`** (it reads tracked files only).
- **The content repository** is the sibling checkout `../comeni-code-content`. Its commits follow
  the same message style and attribution.
- **Commits:** `type(scope): what is now true`, a body that says why, ending with
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. PR descriptions end with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Never commit to `main`.

---

### Task 0: Land the spec and plan, then branch

- [ ] **Step 1: Commit on `docs/m0-part-9`, push, PR, merge on green**

```bash
git add docs/superpowers/specs/2026-09-17-m0-repository-guardrails-design.md docs/superpowers/specs/README.md docs/superpowers/plans/2026-09-17-m0-repository-guardrails.md
uv run pytest -q tests/repo
git commit -m "docs(spec): M0 part 9 — repository guardrails

Settles the last part of M0: a validate CI stub, squash-only auto-merge and a no-bypass ruleset for
comeni-code-content, and a no-bypass ruleset requiring python, web and stack on Comeni-Code's main,
each kept as a file and applied only after the operator confirms.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin docs/m0-part-9
gh pr create --base main --title "M0 part 9: spec and plan — repository guardrails" --body "Spec and plan for M0 part 9, agreed section by section on 2026-09-17.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch > /tmp/checks.log 2>&1; rc=$?; tail -5 /tmp/checks.log; echo "checks exit=$rc"
[ $rc -eq 0 ] && gh pr merge --merge
git checkout main && git pull --ff-only
```

---

### Task 1: The `validate` stub in the content repository

**Files (in `../comeni-code-content`):**
- Create: `.github/scripts/validate.py`, `.github/workflows/validate.yml`

- [ ] **Step 1: Branch** — `cd ../comeni-code-content && git checkout main && git pull --ff-only && git checkout -b ci/validate`

- [ ] **Step 2: `.github/scripts/validate.py`**

```python
# /// script
# requires-python = ">=3.12"
# dependencies = ["pyyaml>=6.0,<7"]
# ///
"""The `validate` check for comeni-code-content (Comeni Code, M0 part 9 spec).

Until the node format exists (Comeni Code M1), it checks only what already has rules: the licence
and README are present, every YAML file parses, and no file is larger than 5 MB.
Run from the repository root: uv run .github/scripts/validate.py
"""

import subprocess
import sys
from pathlib import Path

import yaml

MAX_BYTES = 5 * 1024 * 1024
LICENCE_FIRST_LINE = "Attribution 4.0 International"


def tracked_files() -> list[Path]:
    out = subprocess.run(["git", "ls-files", "-z"], capture_output=True, check=True).stdout
    return [Path(name) for name in out.decode().split("\0") if name]


def problems(files: list[Path]) -> list[str]:
    found: list[str] = []
    licence = Path("LICENSE")
    if not licence.is_file():
        found.append("LICENSE is missing")
    elif licence.read_text(encoding="utf-8").splitlines()[:1] != [LICENCE_FIRST_LINE]:
        found.append(f"LICENSE does not start with {LICENCE_FIRST_LINE!r} (CC BY 4.0)")
    if not Path("README.md").is_file():
        found.append("README.md is missing")
    for path in files:
        if not path.is_file():
            continue
        if path.stat().st_size > MAX_BYTES:
            found.append(f"{path} is larger than 5 MB")
        if path.suffix in {".yaml", ".yml"}:
            try:
                yaml.safe_load(path.read_text(encoding="utf-8"))
            except yaml.YAMLError as error:
                mark = getattr(error, "problem_mark", None)
                where = f":{mark.line + 1}" if mark is not None else ""
                what = getattr(error, "problem", None) or "does not parse"
                found.append(f"{path}{where}: not valid YAML ({what})")
    return found


def main() -> int:
    files = tracked_files()
    found = problems(files)
    for problem in found:
        print(f"FAIL: {problem}")
    if found:
        return 1
    print(f"ok: licence, README, YAML and sizes across {len(files)} files")
    print("Node validation arrives with Comeni Code M1; this check does not validate nodes yet.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: `.github/workflows/validate.yml`**

```yaml
name: validate

# Every pull request to main must pass `validate` (the ruleset in .github/rulesets/main.json).
# Keep the job's name: the ruleset requires it by name. Comeni Code M1 replaces what it checks.

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1

      - name: Install uv
        uses: astral-sh/setup-uv@bec219d24cd3e171d82865faccec33120bb574f4 # v10.1.0

      - name: Validate
        run: uv run .github/scripts/validate.py
```

- [ ] **Step 4: See it pass, and fail on broken YAML**

```bash
git add .github
uv run -q .github/scripts/validate.py; echo "exit=$?"
printf 'a: [1, 2\n' > broken.yaml && git add broken.yaml
uv run -q .github/scripts/validate.py; echo "exit=$?"
git rm -q --cached broken.yaml && rm broken.yaml
```
Expected: `ok: licence, README, YAML and sizes across 5 files` and exit 0; then
`FAIL: broken.yaml:2: not valid YAML (...)` and exit 1.

- [ ] **Step 5: Commit, push, PR, merge on green** (nothing requires `validate` yet)

```bash
git commit -m "ci: a validate check on every pull request

Comeni Code M0 part 9 (spec P9.2). Until the node format exists it checks the licence, the README,
that YAML parses and that no file exceeds 5 MB, and says that node validation comes with M1. The
ruleset will require this job by name.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin ci/validate
gh pr create --base main --title "ci: a validate check on every pull request" --body "The CI stub for Comeni Code M0 part 9: licence, README, YAML parses, no file over 5 MB. Node validation arrives with M1.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch > /tmp/checks.log 2>&1; rc=$?; tail -5 /tmp/checks.log; echo "checks exit=$rc"
[ $rc -eq 0 ] && gh pr merge --squash --delete-branch
git checkout main && git pull --ff-only
```
Expected: the PR's `validate` passes; merged.

---

### Task 2: ⚠ SETTINGS — merge settings on the content repository

- [ ] **Step 1: Confirm with the operator:** "Turn on auto-merge, allow squash merges only, and
  delete branches after merge on comeni-code-content?"

- [ ] **Step 2: Apply and read back**

```bash
gh api -X PATCH repos/comeni-project/comeni-code-content \
  -F allow_auto_merge=true -F allow_squash_merge=true -F allow_merge_commit=false \
  -F allow_rebase_merge=false -F delete_branch_on_merge=true \
  --jq '{allow_auto_merge, allow_squash_merge, allow_merge_commit, allow_rebase_merge, delete_branch_on_merge}'
```
Expected: `{"allow_auto_merge":true,"allow_squash_merge":true,"allow_merge_commit":false,"allow_rebase_merge":false,"delete_branch_on_merge":true}`.

---

### Task 3: The content repository's ruleset

**Files (in `../comeni-code-content`):**
- Create: `.github/rulesets/main.json`

- [ ] **Step 1: The file, by pull request**

`.github/rulesets/main.json`:

```json
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": {
    "ref_name": {
      "include": [
        "~DEFAULT_BRANCH"
      ],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "deletion"
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": [
          "squash"
        ]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          {
            "context": "validate",
            "integration_id": 15368
          }
        ]
      }
    }
  ]
}
```

```bash
git checkout -b ci/ruleset
git add .github/rulesets/main.json
uv run -q .github/scripts/validate.py
git commit -m "ci: the ruleset for main, as a file

Comeni Code M0 part 9 (spec P9.3). Pull requests only, validate must pass, squash merges, no force
pushes or deletion, and no bypass for anyone. The file is the record; it is applied with gh api.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin ci/ruleset
gh pr create --base main --title "ci: the ruleset for main, as a file" --body "Comeni Code M0 part 9: the no-bypass ruleset for main, applied after this merges.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch > /tmp/checks.log 2>&1; rc=$?; tail -5 /tmp/checks.log; echo "checks exit=$rc"
[ $rc -eq 0 ] && gh pr merge --squash --delete-branch
git checkout main && git pull --ff-only
```

- [ ] **Step 2: ⚠ SETTINGS — confirm with the operator:** "Apply this ruleset to comeni-code-content's
  main now? After this, nobody (you included) can push to main; everything goes through a green
  pull request."

- [ ] **Step 3: Apply and read back**

```bash
gh api -X POST repos/comeni-project/comeni-code-content/rulesets --input .github/rulesets/main.json --jq '{id, name, enforcement}'
REPO=comeni-project/comeni-code-content
gh api repos/$REPO/rulesets --jq '.[] | select(.name=="main") | .id' > /tmp/ruleset-id
gh api repos/$REPO/rulesets/$(cat /tmp/ruleset-id) > /tmp/live.json
python3 - <<'PY'
import json
file = json.load(open(".github/rulesets/main.json"))
live = json.load(open("/tmp/live.json"))
# GitHub adds default parameters to rules; compare what the file sets.
diffs = [k for k in ("name", "target", "enforcement", "bypass_actors", "conditions") if file[k] != live.get(k)]
live_rules = {r["type"]: r.get("parameters", {}) for r in live["rules"]}
for rule in file["rules"]:
    got = live_rules.get(rule["type"])
    if got is None:
        diffs.append(f"missing rule {rule['type']}")
        continue
    for key, want in rule.get("parameters", {}).items():
        if got.get(key) != want:
            diffs.append(f"{rule['type']}.{key}: file {want!r}, live {got.get(key)!r}")
extra = set(live_rules) - {r["type"] for r in file["rules"]}
diffs += [f"extra live rule {t}" for t in sorted(extra)]
print("live ruleset matches the file" if not diffs else "DIFFERENT: " + "; ".join(diffs))
PY
```
Expected: an id with `"enforcement":"active"`; `live ruleset matches the file`. If the POST
returns 422, read the message, fix the file by pull request, and try again; nothing was applied.

---

### Task 4: Prove the content repository's guardrails

- [ ] **Step 1: A useful pull request merges itself.** On branch `docs/readme-guardrails`, update
  `README.md`'s *How content arrives*:
  - `main` takes pull requests only, for everyone, and each must pass `validate`;
  - `validate` today checks the licence, the README, that YAML parses and that no file exceeds
    5 MB; node validation arrives with Comeni Code M1;
  - a required review for pull requests that don't come from Studio arrives with landing (Comeni
    Code M4).

```bash
git add README.md
git commit -m "docs: how main is protected, and what validate checks today

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin docs/readme-guardrails
gh pr create --base main --title "docs: how main is protected, and what validate checks today" --body "Also the proof that a green pull request merges itself (Comeni Code M0 part 9).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr merge --auto --squash --delete-branch
gh pr checks --watch > /tmp/checks.log 2>&1; echo "checks exit=$?"
for i in $(seq 1 30); do [ "$(gh pr view --json state --jq .state)" = MERGED ] && break; sleep 2; done; gh pr view --json state,mergedBy --jq '{state, mergedBy: .mergedBy.login}'
git checkout main && git pull --ff-only
```
Expected: checks exit 0; `"state":"MERGED"` without a manual merge.

- [ ] **Step 2: A broken pull request does not merge**

```bash
git checkout -b test/broken-yaml
printf 'a: [1, 2\n' > broken.yaml
git add broken.yaml && git commit -m "test: invalid YAML, to see validate refuse it

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin test/broken-yaml
gh pr create --base main --title "test: invalid YAML must not merge" --body "Proof for Comeni Code M0 part 9; closed after the check fails.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr merge --auto --squash
gh pr checks --watch > /tmp/checks.log 2>&1; echo "checks exit=$?"; grep validate /tmp/checks.log
gh pr view --json state --jq .state
gh pr close --delete-branch --comment "Proof done: validate failed and auto-merge did not merge it."
git checkout main && git branch -D test/broken-yaml
```
Expected: checks exit non-zero, `validate fail`; state `OPEN` before closing.

- [ ] **Step 3: A direct push is refused**

```bash
git checkout main && git pull --ff-only
git commit --allow-empty -m "test: a direct push to main must be refused"
git push origin main; echo "push exit=$?"
git reset --hard origin/main
```
Expected: push exit non-zero, with `GH013: Repository rule violations found` naming the pull
request and status check rules; the local commit is gone after the reset.

---

### Task 5: Comeni-Code's ruleset, and the docs

**Files (in Comeni-Code, branch `ci/m0-rulesets`):**
- Create: `.github/rulesets/main.json`
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-09-17-comeni-code-architecture-and-roadmap-design.md`

- [ ] **Step 1: `.github/rulesets/main.json`**

```json
{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": {
    "ref_name": {
      "include": [
        "~DEFAULT_BRANCH"
      ],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "deletion"
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": [
          "merge"
        ]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          {
            "context": "python",
            "integration_id": 15368
          },
          {
            "context": "web",
            "integration_id": 15368
          },
          {
            "context": "stack",
            "integration_id": 15368
          }
        ]
      }
    }
  ]
}
```

- [ ] **Step 2: Docs**
- CLAUDE.md *Working here*: "**`main` takes only pull requests with green checks, in both
  repositories, for everyone** (rulesets in `.github/rulesets/`, no bypass). Required checks are
  named in the ruleset: renaming a CI job means changing the ruleset in the same change." In
  *Confirm outward-facing actions first*, name rulesets and repository settings.
- Architecture spec R8, new item 9: "**Review of pull requests that don't come from Studio** — the
  content README promises a maintainer's review; with one maintainer a required approval blocks
  their own pull requests, and Studio has no GitHub identity yet. Decide with landing (M4)."

- [ ] **Step 3: Commit, push, PR, merge on green**

```bash
git checkout main && git pull --ff-only && git checkout -b ci/m0-rulesets
git add .github/rulesets/main.json CLAUDE.md docs/superpowers/specs/2026-09-17-comeni-code-architecture-and-roadmap-design.md
uv run pytest -q tests/repo && uv run ruff format --check .
git commit -m "ci: the ruleset for Comeni-Code's main, as a file

Spec P9.3. Pull requests only, python, web and stack must pass, merge commits, no force pushes or
deletion, and no bypass. PR #26 merged red because nothing on GitHub refused it; this makes GitHub
refuse it. R8 gains the review question for non-Studio content pull requests.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin ci/m0-rulesets
gh pr create --base main --title "ci: a no-bypass ruleset for main" --body "M0 part 9 (spec P9.3): the ruleset file, applied after this merges.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch > /tmp/checks.log 2>&1; rc=$?; tail -5 /tmp/checks.log; echo "checks exit=$rc"
[ $rc -eq 0 ] && gh pr merge --merge
git checkout main && git pull --ff-only
```

- [ ] **Step 4: ⚠ SETTINGS — confirm with the operator:** "Apply the ruleset to Comeni-Code's main
  now? After this, nobody (you included) can push to main, and a pull request merges only after
  python, web and stack pass."

- [ ] **Step 5: Apply and read back**

```bash
gh api -X POST repos/comeni-project/Comeni-Code/rulesets --input .github/rulesets/main.json --jq '{id, name, enforcement}'
REPO=comeni-project/Comeni-Code
gh api repos/$REPO/rulesets --jq '.[] | select(.name=="main") | .id' > /tmp/ruleset-id
gh api repos/$REPO/rulesets/$(cat /tmp/ruleset-id) > /tmp/live.json
python3 - <<'PY'
import json
file = json.load(open(".github/rulesets/main.json"))
live = json.load(open("/tmp/live.json"))
# GitHub adds default parameters to rules; compare what the file sets.
diffs = [k for k in ("name", "target", "enforcement", "bypass_actors", "conditions") if file[k] != live.get(k)]
live_rules = {r["type"]: r.get("parameters", {}) for r in live["rules"]}
for rule in file["rules"]:
    got = live_rules.get(rule["type"])
    if got is None:
        diffs.append(f"missing rule {rule['type']}")
        continue
    for key, want in rule.get("parameters", {}).items():
        if got.get(key) != want:
            diffs.append(f"{rule['type']}.{key}: file {want!r}, live {got.get(key)!r}")
extra = set(live_rules) - {r["type"] for r in file["rules"]}
diffs += [f"extra live rule {t}" for t in sorted(extra)]
print("live ruleset matches the file" if not diffs else "DIFFERENT: " + "; ".join(diffs))
PY
```
Expected: `"enforcement":"active"`; `live ruleset matches the file`.

---

### Task 6: Prove Comeni-Code's guardrails, check M0, and record the part

- [ ] **Step 1: A direct push is refused** (as Task 4 Step 3, in Comeni-Code).
Expected: `GH013`; local commit reset away.

- [ ] **Step 2: Mark the spec as built** (`**Status: agreed 2026-09-17; built in PRs <numbers>.**`;
specs README row `agreed; built`) and CLAUDE.md's *Status* now; the journal entry
(written in Step 4) will be
`docs/notes/journal/2026-09-17-m0-part-9-repository-guardrails.md`:
  - *Where things stand:* each proof with its command and result; both read-backs;
  - **M0's done-when, item by item** — all four hold; **M0 is done**;
  - what changed (PRs in both repositories), decisions, what is next (M1's parts list), traps
    (no bypass means CI must work; a renamed job blocks merges).
  with the journal README box and table updated. CLAUDE.md's *Status*: "M0 done; M1 next".

- [ ] **Step 3: The journal PR proves merges wait for checks.** Open the PR first, try to merge
  it at once, then write the journal with that result and merge on green.

```bash
git checkout -b docs/m0-part-9-journal
git add docs CLAUDE.md && uv run pytest -q tests/repo
git commit -m "docs: M0 part 9's spec is built; CLAUDE.md status

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin docs/m0-part-9-journal
gh pr create --base main --title "M0 part 9 built — repository guardrails; M0 is done" --body "Journal for M0 part 9, and the proof that Comeni-Code's main refuses a merge before its checks pass.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr merge --merge; echo "early merge exit=$?"
```
Expected: exit non-zero; GitHub refuses because required status checks haven't passed.

- [ ] **Step 4: The journal entry, then merge on green**

Write the entry described in Step 2 (with Step 3's refusal message), then:

```bash
git add docs && uv run pytest -q tests/repo
git commit -m "docs(journal): M0 part 9 built — repository guardrails; M0 is done

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push
gh pr checks --watch > /tmp/checks.log 2>&1; rc=$?; tail -5 /tmp/checks.log; echo "checks exit=$rc"
[ $rc -eq 0 ] && gh pr merge --merge
git checkout main && git pull --ff-only
```
