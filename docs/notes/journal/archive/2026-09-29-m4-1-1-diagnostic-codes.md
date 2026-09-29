# 2026-09-29 — M4.1.1: every problem has a code

**Every problem Code reports now carries a declared diagnostic code**, as Comeni Labs' do: `CS`
from the content validator, `CW` from the weaver, `CA` from the API, in bands of one hundred by
concern, from one registry. `code-schema explain` says what a code means, how to fix it and why,
and `docs/reference/diagnostics.md` lists them all, generated. The first substep of M4.1 (#119);
the [spec](../../superpowers/specs/2026-09-29-m4-diagnostic-codes-design.md) and the
[plan](../../superpowers/plans/2026-09-29-m4-diagnostic-codes.md) are in the same branch.

The operator asked for it while M4.1's block document was being designed, approved the spec and
plan, and chose native execution with three fresh-reviewer checkpoints; an agent built it, test
first.

---

## Where things stand

| Claim | Check |
|---|---|
| 118 codes declared — 103 `CS`, 9 `CW`, 6 `CA` — each with says, refuses, fix and why | `uv run pytest tests/schema/test_diagnostics.py` |
| Every problem is built with a declared code; one without cannot be built | `uv run pytest tests/schema/test_problems.py` |
| A problem prints `file:line: field: CODE message`; a GitHub annotation carries the code as its title | `uv run code-schema validate <folder> --format github` |
| Each package writes only its prefix; no declared code is dead; no written code is undeclared; every code is named by a test | `uv run pytest tests/repo/test_diagnostic_ownership.py` |
| `explain` answers in any case, suggests the closest for a typo, and still explains a retired code | `uv run code-schema explain CS0203` |
| The reference page is generated and current | `uv run pytest tests/repo/test_reference.py` |
| The API's own error bodies carry a code; Ninja's 422s keep Ninja's shape | `uv run pytest apps/api/tests -k "404 or 422 or 503"` |
| The registry ships in the wheel the content repository installs | `uv run pytest tests/schema/test_diagnostics.py -k wheel` |
| Message wording is unchanged | both review checkpoints compared every string, byte for byte |

## What changed

Fourteen commits, `01d75f3` (the plan) to `ec0ea91`: the registry (`0d6d04e`); `Problem.code`
and checks returning `Wrong(code, message)` (`c8092a4`); codes module by module (`def3ed9`,
`00098fa`, `d720f05`, `cb2b03c`, `525ad8c`); the weaver (`2462e24`); the API (`aa8cd7a`);
`explain` and the page (`10114bd`); `code` required and the registry guards (`ec0ea91`); and two
fixes the checkpoints asked for (`614b8a6`, `3b912c5`); and the final review's one fix, `explain`
suggesting the code two swapped digits meant (`003c07e`). Its eight minors are #131, `deferred`.

## Decisions made, and why

1. **A shared check has one code wherever it is used** — *must be one line* is `CS0009` on a title
   or a hint — and the problem's field says where.
2. **A composed message keeps the code of the check that failed** — *what this resource covers
   must not be empty* is `CS0008`. Following that rule, three codes the mapping had given composed
   sentences (`CS0105`, `CS0107`, `CS0210`) could never be emitted, and were **removed before
   publication**; the spec forbids renumbering published codes only.
3. **Every declared code is named by a test.** The second checkpoint found eighteen emitted codes no
   test named — swapping two passed the suite. They are pinned now, and a guard keeps it so.
4. **The weaver stays pure**: its codes are literals, tied to the registry by a test, not an import.

## What is next

1. **M4.1.2, the block document** (#129): its refusals are born with `CS04xx` codes.
2. **M4.2** moves the content repository's pinned validator, once, for the codes, the blocks and
   exam pools together — content CI shows codes from then on.

## Traps

- **A new problem needs a registry entry first** — `Problem` refuses an undeclared code — then the
  reference page regenerated, and a test that names the code.
- **The registry guard scans source text**: a code quoted in a comment counts as written.
- **Planted defects were used to watch each registry guard fail**; `CS0099` is a poor plant, since a
  test names it as a band's upper bound.
