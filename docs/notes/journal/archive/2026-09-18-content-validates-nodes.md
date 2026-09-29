# 2026-09-18 — the content repository validates nodes, and what Salmon depends on

**`comeni-code-content` now runs `code-schema validate` on every pull request, pinned to Comeni-Code
`559cbf4`,** which closes M1 part 3's last two done-when items. Before its region registry was
written, the operator asked for research into what Salmon really depends on; that research set
the regions and leaves one question for part 4.

The operator approved the content repository pull request and asked for the research; an agent did
both.

---

## Where things stand

| Claim | Check |
|---|---|
| The validator installs from git at the merged SHA and runs | CI log of comeni-code-content #5, step *Validate nodes*: `Installed 2 packages`, `0 nodes, no problems` |
| The content repository's `validate` job has two steps: the repository, then the nodes | `.github/workflows/validate.yml` in comeni-code-content |
| Six regions are registered | `regions.yaml` in comeni-code-content (`f934a36`) |
| The research is recorded, with its sources | [`2026-09-18-salmon-dependencies.md`](../research/2026-09-18-salmon-dependencies.md) |
| **M1 part 3's done-when holds in full** | [part 3's entry](2026-09-18-m1-part-3-graph-rules.md), plus the two rows above |

## What changed this session

| Where | Commit | What is now true |
|---|---|---|
| Comeni-Code #49 | `9ccf70f` | the research note: Salmon's method from its papers and documentation, sorted into links |
| comeni-code-content #5 | `f934a36` | `regions.yaml`; the pinned *Validate nodes* step; README and hygiene script say what each step checks |

The git install route was proved locally first, from `559cbf4` exactly as CI runs it: a broken
scratch folder gave two problems and exit 1, a clean one `0 nodes, no problems` and exit 0.

## Decisions made, and why

- **Six regions, not the four the spec proposed** (M1P3.6 said part 4 might adjust the list; the
  research adjusted it first). `algorithms` holds graphs, hashing, dynamic programming and de Bruijn
  graphs — general computer science that assembly and search reuse, and how a computer-science
  learner recognises what they already hold. `transcriptomics` is the field a learner names when
  they say "quantify my RNA-seq", so *Salmon*, its peers and TPM live there.
- **Pinned to `559cbf4`, not the newer `9ccf70f`.** The research merge changed no code, and
  `559cbf4` is the commit whose install route was proved.
- **`regions.yaml` carries a comment.** The registry is written by hand, not by the canonical node
  writer, so a comment survives, and it says how a region is added.

## What is next

1. **Part 4: the Salmon fixtures**, from the research note's tables — about a dozen of its nodes, in
   `tests/fixtures/`, accepted by the validator.
2. Part 4's brainstorm opens with the question the research raised (below).

## Open questions

- **Is *de Bruijn graphs* on the route to *Salmon*?** W1 says yes, because pufferfish is built on
  one. Under the need rule (M1P2.3), *Salmon*'s claim can be understood without the index's data
  structure, so *The pufferfish index* is a *goes deeper* and *de Bruijn graphs* sits below it;
  the route still reaches *k-mers*, through mapping. Part 4 decides; if the index belongs on the
  route, *Salmon*'s claim should say why.
- **Which of the research's nodes the fixtures hold.** It names about thirty; the parts list says
  8–12.

## Traps

- **The pin does not move by itself.** A change to the validator in Comeni-Code does nothing to
  content CI until a pull request in comeni-code-content changes the SHA.
- **`regions.yaml` is content, not a fixture.** Tests never read it (R1); part 4's fixtures carry
  their own copy.
