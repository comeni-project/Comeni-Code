# Changelog

All notable changes to this project are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
will adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) from its first release.
Nothing has been released, and there is no code yet, so everything below is design and
documentation.

## [Unreleased]

### Added

- **The first design document** (2026-09-02): what Code is, why Metacademy and Khan Academy's
  Knowledge Map died, the node as typed holes, the review interaction as the highest-risk
  design, and why the social and game layer is refused.
- **The second design document** (2026-09-16): routes woven from goals over *needs* links;
  every learner and Studio page, with the research behind each; content as validated blocks
  written through a CMS-style API; where the AI runs and what it costs; the Comeni hybrid
  identity shared with Labs.
- **The design canvas generator** in `.design/`: identity tokens and every key page, rebuilt
  with `node .design/build_pages.mjs`.
- **Repository foundations**: contributing guide, Code of Conduct (Contributor Covenant 3.0),
  security policy, issue and pull-request templates, citation file, content licence (CC BY 4.0),
  the working journal, and a documentation map.

### Removed

- The five 2026-09-02 artboards (the map, hole-by-hole review, a node, a problem, entering from
  Labs). Every page they drew was redesigned after weaving replaced authored tracks; they remain
  in git history.
