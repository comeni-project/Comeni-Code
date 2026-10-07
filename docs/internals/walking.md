# Walking it: issues, decisions, rounds

How a session in the running app turns into fixes and decisions without anything getting lost or
quietly worked around. Adopted from Comeni Labs on 2026-09-29, with the same labels.

A **walk** is driving the running app in a browser beside the
[published canvas](https://claude.ai/artifact/1NUmoDUfo1x2oZ7ywhvCxx), at the page's real width, in
light and dark. Every screen in M3 was walked, and every walk found defects no test suite could.
From M5 a walk also means a session with a real model.

## The rule underneath

**Rules are tuned, never forced.** When a rule blocks a walk — the validator, the weaver, an
invariant, a board — the answer is never to make it work anyway. It is to decide, in the open,
whether that rule is too strict (loosen it) or too loose (tighten it). A workaround hides which
rule was wrong.

## A round

1. **Walk one scenario**: a goal, a route, a node, a width, a theme. Note every finding as you go;
   do not stop to fix.
2. **Open an issue for every finding**, mechanical ones too, before touching code. Use the
   *Walk: mechanical* or *Walk: protocol* template.
3. **Sort it** (below) and take its path.
4. **Walk the scenario again** once its issues are closed or decided. A round ends when the
   scenario passes, or is blocked on a protocol issue that is decided but not built.

## Sorting a finding

| It is | when fixing it | path |
|---|---|---|
| **mechanical** | makes the code do what was already agreed: a label off its stop, a missing state, a field the page forgets, a screen that differs from its board | fix it |
| **protocol** | changes what the product asks, allows, refuses or promises: a link kind, a validator rule, what a page shows a learner, an invariant | decide it |

**Unsure means protocol.** That is the side that errs toward asking the operator. A mechanical
issue that turns out to need a decision is relabelled `protocol`, with a comment saying why.

A finding that is not a defect (the code was read wrong) is closed with a comment saying what was
misread, and labelled `invalid`. It stays on the record.

## The mechanical path

A mechanical fix needs only **a one-paragraph approach the operator approves**: what changes,
where, and the test that proves it. If the paragraph grows a choice, it was a protocol issue.

1. A failing test that reproduces the finding. Watch it fail.
2. The fix. Watch it pass; run the suite the change touches.
3. Commit with the issue number in the message.
4. Close the issue with a comment:

   > Fixed in `<sha>`: <one line on what changed>. Test: `<test name>`, watched failing first.

A layout defect jsdom cannot see is proved by the walk instead: say what was seen, at which width
and theme, before and after.

## The protocol path

1. **Brainstorm.** Two or three options, each with what it costs, and whether it **loosens** or
   **tightens** a rule. Say which you recommend and why. Present them as choices, not prose.
2. **The operator chooses.** Nobody picks silently.
3. **Comment the decision on the issue** and add the `decided` label:

   > **Decided (YYYY-MM-DD).** <The option chosen, in one or two sentences.>
   >
   > - **Loosens / tightens:** <which rule, and in which direction; or neither>
   > - **Rejected:** <each other option, and why>
   > - **Recorded in:** <a spec, `CLAUDE.md`'s invariants; or nowhere, and why>
   > - **Built by:** <the issue or part that implements it, or "this issue">

4. **Implement it** the way all work is done here: spec, then plan, each seen by the operator,
   then test-first. A decision small enough to need no spec says so, and the operator agrees.
5. **Close** citing the commit, and remove `decided`.

A change to an invariant is written into a spec before it is built, never only in the issue.
`gh issue list --label decided` is the list of promises outstanding.

## Where an issue lives

**The current plan is a tree of GitHub sub-issues**, as Labs keeps its task tree (its #119):

| Level | Title | Example |
|---|---|---|
| a phase | `M<phase> — <name>` | `M3 — The thin learner path` (#79) |
| a part of it, a step | `M<phase>.<part> — <what it does>` | `M3.4 — The Route page` (#83) |
| a substep, when a step is split | `M<phase>.<part>.<n> — …` | `M3.5.1 — Khan Academy is link only…` (#87) |
| work outside a phase | a parent issue, its plan's tasks as `#<parent>.<n> — …` | `#91.3 — Every backticked path…` (#94) |

Each issue's body starts by naming its parent (*Step of M3 (#79).*) and points at its spec, plan or
pull request. A step gets substeps only when it is split; a phase gets its parts when its parts
list is approved (R5). A walk finding is a sub-issue of the step that found it, unnumbered, so the
tree stays whole (#73 and #77 under M3.4); a finding that becomes a piece of work of its own gets
numbered substeps under it (#76's M3.5.1–M3.5.4). A pull request says which issues it closes, so
the tree closes itself as work lands; a parent closes when its last child does.

Loose ends with no step yet — a `prediction`, a `deferred` item, an open R8 question — are issues
of their own, labelled, outside the tree until work picks them up.

`gh api repos/comeni-project/Comeni-Code/issues/<n>/sub_issues` lists a node's children;
`gh api -X POST …/issues/<parent>/sub_issues -F sub_issue_id=<id>` adds one, where `<id>` is the
issue's `id` from `gh api …/issues/<n>`, not its number.

## Labels

| label | means |
|---|---|
| `walk` | found while walking the running app |
| `mechanical` | the code is wrong against what was agreed |
| `protocol` | a rule or a promise needs deciding |
| `decided` | the operator has chosen; not built yet |
| `deferred` | decided to do later; not forgotten |
| `prediction` | a problem expected at scale but not yet seen; worked on only if it shows up |

## Writing the issue

Lead with **what happened** and **what was expected**, then the evidence: the URL, the width and
theme, the board it was compared with, and any API response or console error. For a protocol
issue, say which way the rule failed (**too strict**, **too loose**, or **unclear**) and which
rule it touches. Read the code before claiming what it does. In frontend comments, cite an issue
as *issue 110*: `#110` reads as a colour.
