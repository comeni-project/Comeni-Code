# 2026-09-29 — the Route map fits any route, the plan is an issue tree, and M3 is merged

**The M3 stack is on `main`, the Route map no longer depends on Salmon's shape, and the current
plan lives on GitHub as a tree of sub-issues.** After the morning's docs compaction, the operator
asked where development stood, took three decisions, asked whether the metro renderer was
overfitted (it was), and asked for Labs' issue tree here. An agent tested, fixed, filed and merged;
the operator approved each merge.

---

## Where things stand

| Claim | Check |
|---|---|
| M3 parts 4–6, the docs compaction, the layout fix and the issue-tree doc are on `main`; CI passed on the tip | `git log --oneline --first-parent -7 main`; the CI run for `7b0b3e7` |
| The layout holds for eight synthetic route shapes and Salmon: level or 45° only, no line through a label, no label over a label or stop, no run for a goal-only line | `npx vitest run src/route/layout.test.ts` in `apps/web` |
| The current plan is a sub-issue tree | `gh api repos/comeni-project/Comeni-Code/issues/79/sub_issues`; `docs/internals/walking.md`, *Where an issue lives* |
| M3 (#79) is open only for M3.5 (#84), which holds #76 | same |
| Khan Academy is linked, never embedded, in the tutor spec | `grep -n "never embedded" docs/superpowers/specs/2026-09-17-code-as-tutor-design.md` |

## What changed

| Where | What is now true |
|---|---|
| #78 (`da575b2`) | `layout.ts`: gaps widen to fit their 45° climbs and again beside a crowded label; a goal-only line draws no run; labels move off lines. `shapes.fixture.ts` holds the synthetic routes; 23 new tests failed on the old layout |
| #113 (`d21b5d5`) | the issue tree's numbering in `walking.md` |
| #65, #66, #67, #75, #78, #113 | merged bottom-up, each retargeted to `main` first: `7675db3`, `57648f0`, `e0bb403`, `1536f2b`, `dc006ac`, `7b0b3e7` |
| GitHub | the tree #79–#111; #73 and #77 filed and closed by #78; #76 filed |
| This branch | T4.2, T5.3 and T14.2 of the tutor spec say Khan Academy is linked only; R4's M3 notes the embedded resource as deferred |

## Decisions made, and why

1. **Khan Academy is linked, never embedded** (operator; #76, `decided`). *Rejected:* embedding
   once a person has read its terms, the spec's earlier line.
2. **Content and page polish wait for the end of the MVP** (operator). "We are making the app, not
   the pages yet." A replacement video for the Khan fixtures is content, so #89 is `deferred`, and
   M3's *done when* line asking for an embedded resource is deferred rather than missing.
3. **#73's geometry was left to the agent's eye** (operator). The layout fix for #77 settles it:
   the steep connector is 45° and the crossings are gone.
4. **The layout rule is measured, not tuned to Salmon.** Columns start at the narrowest gaps that
   fit their climbs and widen only where a label cannot be placed clear; the first fix, which kept
   a label's width beside every climb, made Salmon scroll at 1440 and was replaced.
5. **The plan is a sub-issue tree, Labs-style**: `M3 — …`, `M3.4 — …`, `M3.5.1 — …`, and a plan's
   tasks as `#91.3 — …` for work outside a phase. Findings hang unnumbered under the step that found
   them. Pull requests name what they close.
6. **R8 was walked through with the operator**, with recommendations recorded on #101, #102 and
   #108–#111. Item 1 (search) is effectively answered by M3 part 2; nothing in R8 was changed yet.
7. **Pull requests are merged by the agent only after the operator says yes to that merge.**

## What is next

1. **#76, Khan Academy link-only**: M3.5.2 (#88, `embed: false` and the fixtures as links) and
   M3.5.4 (#90, walk the two node pages). M3.5.1 (#87) is this branch; M3.5.3 (#89) is deferred.
   Then M3.5 and M3 close.
2. **M4.0 (#100)**: M4's parts list, for the operator's approval; the two R8 decisions (#101,
   #102) are made at M4's start.

## Open questions

- Whether R8's text should now say item 1 is answered and name the issues for the rest.
- The merged remote branches (the M0–M3 ones and this session's) are not deleted; the repository
  does not delete branches on merge.

## Traps

- **The published canvas link shows *Page not found* on this Claude account.** It was published
  from another one. `.design/*.dc.html` need the canvas runtime and render blank when served alone,
  so the Route fix was compared with the pre-fix page, not the canvas.
- **An audit stack runs beside the development one**: Compose project `code-audit`, with a scratch
  override moving Postgres to 5434, Redis to 6381 and web to 8091, because Labs' `wiener-db` holds
  5433. `rebuild_index` reaches it with `CODE_DATABASE_URL` and `CODE_REDIS_URL` on the command
  line. The operator asked to keep it up for debugging.
- **This machine's Node is 22**, so the web checks ran in the stack's Node 24 image with the whole
  repository mounted (`schema.test.ts` and `tokens.test.ts` read files outside `apps/web`). A
  `tsc -b` there wrote `apps/web/tsconfig.tsbuildinfo`, which is neither tracked nor ignored:
  delete it.
- **`pkill -f` killed its own shell again** — its pattern was in its own command line. `now.md`
  already says so; stop a server by its PID.
- **Retarget a stacked pull request to `main` before merging it.** The repository does not delete
  merged branches, so GitHub does not retarget the next one by itself.
