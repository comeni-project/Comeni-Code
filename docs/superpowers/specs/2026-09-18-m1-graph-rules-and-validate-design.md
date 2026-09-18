# M1 part 3 — graph rules and the validate command

**Status: agreed 2026-09-18.** This is part 3 of phase M1 (architecture spec R4). The parts list is
in [`2026-09-18-m1-in-parts.md`](../../notes/journal/2026-09-18-m1-in-parts.md). It builds on
[part 1](2026-09-18-m1-node-folder-and-core-fields-design.md) (the folder, the fields, `Problem`)
and [part 2](2026-09-18-m1-links-in-the-schema-design.md) (links, and the rules it handed over in
M1P2.7). It decides:

- where the validate command lives, and how `comeni-code-content`'s CI runs it;
- how the command finds the nodes in a content folder;
- the rules that need more than one file, and their messages;
- the command's output, for people and for GitHub.

The operator made every decision here on 2026-09-18, section by section; an agent proposed them.

---

## M1P3.1 What this part does

`code-schema validate <content root>` reads a whole content folder — every node, the region
registry, and the links between them — and reports every problem in one run, on the line at
fault. `comeni-code-content`'s CI runs it on every pull request, pinned to a Comeni-Code commit.

**Done when:**

- every graph rule in M1P3.4 fails with its exact message and line, and a tangle of cycles gives
  one message with the full ring;
- the near misses of M1P3.3 (`node.yml`, a `body.md` with no `node.yaml`) are caught;
- a valid content root exits 0 with `N nodes, no problems`; a broken one exits 1 with every
  problem; a missing root exits 2;
- `--format github` output is escaped correctly, and tested;
- `uvx --from "git+https://github.com/comeni-project/Comeni-Code@<sha>#subdirectory=packages/code-schema" code-schema validate <folder>`
  works against a scratch content folder, which proves the install route before anything depends
  on it;
- **with the operator's go-ahead**, a pull request in `comeni-code-content` adds `regions.yaml` and
  the pinned step to the `validate` job, turns green and merges.

**Out of scope:** the Salmon fixtures (part 4); the index, which will call the same
`read_content` (part 5); warnings such as the tutor spec's *a node needs one two levels above it*,
which belong to S2's health view — the validator only refuses.

## M1P3.2 Where the command lives, and which version checks content

**A module in `code-schema` with a console script**, `code-schema validate`. It stays pure,
testable and free of Django, and `read_content(root)` — the function behind it — is the one part
5's index loader will call, so content CI and the index can never disagree about what a valid node
is.

**`comeni-code-content` pins a Comeni-Code commit:**

```yaml
- name: Validate nodes
  run: >
    uvx --from "git+https://github.com/comeni-project/Comeni-Code@<sha>#subdirectory=packages/code-schema"
    code-schema validate . --format github
```

This is how the Actions are already pinned. A content pull request is checked by a known
validator, and moving to a newer one is a **deliberate pull request in the content repository**,
whose own CI then proves the existing content passes the new rules. `schema: 1` keeps a stale pin
honest: content the pinned validator does not understand is refused by name, not misread. The bump
is manual — Dependabot does not follow a SHA inside a `run:` line — which is acceptable while one
person runs both repositories.

The content repository's own hygiene checks (the licence, the README, file sizes, YAML that parses)
**stay in its `validate.py`**: they are rules about that repository, not about the node format. The
job gains a step and keeps its name, which the ruleset requires.

**Rejected:**

| Alternative | Why not |
|---|---|
| The content repository follows Comeni-Code's `main` | a stricter rule merged here would fail content pull requests that changed nothing; the same pull request could pass today and fail tomorrow |
| Publishing `code-schema` to PyPI | an outward-facing release process for one consumer; revisit when a second one (Labs reading nodes) exists |
| Copying the validator into the content repository | drifts on the first change |
| A service in `apps/api` | the content repository's CI has no Django and no database |

## M1P3.3 Finding the nodes

- **A folder is a node when it holds `node.yaml`**, at any depth (M1P1.2). Folders whose names
  start with `.` — `.git`, `.github` — are skipped.
- **`regions.yaml` at the root is required**; every region check depends on it.
- **Files outside node folders are not the validator's business** — `README.md`, `LICENSE` belong
  to the repository.
- **Near misses are caught**, because they otherwise fail silently: a folder that looks like a node
  but has no `node.yaml` is simply not a node, and nobody would know.

| Near miss | Message |
|---|---|
| a file whose name is close to `node.yaml` | `salmon/: node.yml is not read — did you mean node.yaml?` |
| `body.md` without `node.yaml` | `salmon/: has body.md but no node.yaml — a node folder holds both` |
| `node.yaml` at the content root | `node.yaml: the content root is not a node — node folders go inside it` |

- **It walks the filesystem, not `git ls-files`.** The pure package cannot run `git` —
  `subprocess` is not on its allowlist — and in CI the checkout is exactly the tracked files.
  Locally an untracked scratch folder is validated too.
- **An empty content root is valid**: `regions.yaml` and no nodes is *0 nodes, no problems*. That is
  the content repository today.

## M1P3.4 The graph rules

| Rule | Message |
|---|---|
| ids are unique across the tree | `tools/salmon/: salmon is already a node at sequence-analysis/salmon/ — ids are unique across the tree` |
| every link's target exists | ``salmon/node.yaml:8: needs: kmers is not a node — closest is `k-mers` `` |
| *related* is written on both nodes | `salmon/node.yaml:14: related: kallisto does not list salmon back — add it to kallisto/node.yaml` |
| *goes deeper* never points down | `salmon/node.yaml:12: goes-deeper: what-tpm-measures is introductory, below salmon (intermediate)` |
| *needs* has no cycle | `de-bruijn-graphs/node.yaml:8: needs: a cycle — de-bruijn-graphs → k-mers → hashing → de-bruijn-graphs` |
| *goes deeper* has no cycle | the same shape, `goes-deeper: a cycle — …` |

- **Every message points at a line that exists.** The missing half of a *related* link has no line,
  so the message goes on **the half that is written** and names the file that needs the other; in
  CI the annotation lands on the line the author just added. A missing target gets the closest id
  when there is one (difflib's default cutoff, as in part 1), and nothing when there is not.
- **Uniqueness:** folders are taken in sorted path order, and the first one keeps the id.
- **Cycles: one message per tangle, with a whole ring.** Every cycle can be exponentially many, so
  the command finds each strongly connected group (Tarjan's algorithm, iterative so a deep graph
  cannot hit Python's recursion limit), and prints **one** shortest cycle through its
  alphabetically first node, at that node's link to the next. When the tangle holds more nodes than
  the ring shows, the message ends *, and 3 more nodes are caught in it*. The whole ring is printed
  because the author needs every edge to find the wrong one. Neighbours are taken in sorted order,
  so every run prints the same ring.
- **A broken node does not cascade.** A link to a folder holding `node.yaml` points at an existing
  node, even if that node has problems of its own. Symmetry, levels and cycles are checked only
  among nodes that parsed; the broken node's problems are already reported, and one mistake should
  not appear as five.
- **Link lines are found by reading the file's key lines again**, not stored on `Node`: `Node` is a
  value compared by the round-trip laws, and lines are not part of a node.

**Rejected:**

| Alternative | Why not |
|---|---|
| Reporting every elementary cycle | can be exponential, and five messages about one tangle hide the one wrong edge |
| The first cycle a depth-first search meets | depends on walk order, so the message would change between runs |
| The symmetry message on the side missing the link | there is no line there to point at |
| Checking links to broken nodes as if the target were missing | reports the same mistake twice, the second time wrongly |
| A warning for a need two levels up | the validator refuses; warnings are S2's (tutor spec T10.1) |

## M1P3.5 Output

**Plain, by default:** the problems sorted by file and line, then one summary line —
`40 nodes, no problems`; `3 problems in 2 of 40 nodes`; or, when no problem is inside a node,
`1 problem outside the nodes (40 nodes)`. Singular and plural are right (*1 node*, *1 problem*).

**`--format github`** prints each problem as a workflow command, and GitHub shows it on that line
of the pull request's diff:

```
::error file=salmon/node.yaml,line=14::salmon/node.yaml:14: related: kallisto does not list salmon back — add it to kallisto/node.yaml
```

- **A flag, not detection.** Detecting Actions means reading `GITHUB_ACTIONS`, and the pure package
  does not read the environment — `os` is not on its allowlist. The content repository's workflow
  passes the flag.
- **Escaped as GitHub specifies:** `%`, CR and LF in the message; also `:` and `,` in property
  values. The message is the whole rendered problem, so it reads the same in the log.
- **`file=` only for a file.** A problem about a folder (`salmon/`) has no file to annotate; it is
  printed without properties and appears in the run's summary.

**Exit codes:** 0 no problems; 1 problems; 2 the command was used wrongly (no such folder, a bad
option — `argparse`'s own code).

**The allowlist gains `argparse` and `sys`,** both standard library, for the command-line wrapper.
Nothing else is added: the cycle search needs no `collections`.

## M1P3.6 The content repository's pull request

With the operator's go-ahead, after this part's code has merged:

1. **`regions.yaml`**, a first list for the Salmon route — `molecular-biology`, `sequencing`,
   `sequence-analysis`, `statistics` — which part 4's fixtures may adjust through a later pull
   request;
2. **the pinned step** in `.github/workflows/validate.yml`, after the hygiene checks, with the
   merged commit's SHA;
3. **the README** says what `validate` now checks and how to bump the pin.

It cannot lock anything: if the new step fails, the pull request stays red and does not merge. It
is still confirmed first, because it changes what every later content pull request must pass.

## M1P3.7 Risks

- **The pin falls behind.** Content could then pass the pinned validator and be refused by the index
  (part 5), which runs the deployed code. `schema:` catches format changes by name; a rule that
  tightened without a schema bump shows up as a refused landing, and the fix is the bump pull
  request. Worth automating when landing exists (M4).
- **Walking the filesystem validates untracked files locally.** Harmless in CI; locally it can
  report a scratch folder. That is arguably a feature, and the message names the folder.
- **Near-miss detection guesses.** A file named `nodes.yaml` for another purpose inside a non-node
  folder would be flagged. Nothing in the format uses such names; if one ever does, the rule
  narrows.
- **The console script is installed from git by `uvx`**, so a GitHub outage stops content CI. So
  does any outage of the runners themselves; nothing merges without CI by design (P9.5).
