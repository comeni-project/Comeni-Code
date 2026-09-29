# 2026-09-17 — M0 part 5: the web toolchain

**Part 5 of M0 is built.**
- `apps/web` is a React 19 app on Vite 8 and TypeScript 7 strict, with Biome and vitest.
- It lints, type-checks, tests and builds on Node 24, locally and in a `web` CI job beside
  `python`.
- It shows a plain shell. Identity tokens come in part 6, the health page in part 7.

**Next is part 6** (identity tokens into Tailwind).

The operator agreed the design section by section, installed Fedora's `nodejs24`, and made one
decision during the build (jsdom 29).

---

## Where things stand

| Claim | Check |
|---|---|
| The five web commands pass locally on Node 24.14.1 | `node --version` shows v24, then in `apps/web`: `npm ci && npm run lint && npm run typecheck && npm test && npm run build` |
| They pass in CI on Node 24.20.0, alongside the Python job | PR #21, run 35218829033: every `web` step succeeded; `python` passed |
| The a11y, formatting and type canaries each fail, then pass again | done during the build: `lint/a11y/useAltText`, "differs from formatting output", `TS2322` |
| The dev server serves the shell | `npm run dev`, then `curl http://127.0.0.1:5173/` shows `<title>Comeni Code</title>`; a Firefox screenshot shows the heading; Vite stopped and the port freed afterwards |
| `npm ci` refuses a Node other than 24 | `engine-strict`; seen as `EBADENGINE` on Node 22 in the scratch build |

## What changed this session

- PR #20: part 5's spec and plan.
- Part 5's commits, oldest first: c97aac8 6023439 438c5c8 (PR #21).

## Decisions made, and why

The spec holds the rejected alternatives. In order:

1. **Biome** (operator), over oxlint with Prettier and over ESLint with typescript-eslint and
   Prettier. typescript-eslint supports TypeScript below 6.1 only, which would have held us on
   TypeScript 6.
2. **Node 24 LTS** (operator), over 22 (in maintenance) and over allowing 22 locally.
3. **Section 1:** a standalone npm project; `ignore-scripts` and `save-exact`; TanStack Query's
   provider mounted now.
4. **Section 2:** TypeScript 7 strict with the extra flags; Biome's recommended preset with
   100-character lines; jsdom and Testing Library.
5. **Section 3:** a parallel `web` CI job with `setup-node` pinned; Fedora's `nodejs24`.
6. **Found in the scratch build:**
   - `biome migrate` wrote `"preset": "none"`, which disables every rule while `biome ci`
     passes, so an a11y canary proves rules are on;
   - Biome's VCS mode is off, because it wanted a `.gitignore` inside `apps/web`;
   - `engine-strict=true`.
7. **During the build: jsdom 29.1.1 instead of 30.1.0** (operator). jsdom 30 declares Node
   24.15+, Fedora's `nodejs24` is 24.14.1 (nothing newer even in updates-testing), and
   `engine-strict` refused. **Rejected:**
   - official Node 24.21 in user space;
   - happy-dom;
   - turning `engine-strict` off.

   **Bump to jsdom 30 when Fedora ships 24.15.** The scratch build used nodejs.org's 24.21,
   which is why it missed this.

## What is next

1. **Part 6, identity tokens into Tailwind.** The tokens in `.design/_identity.mjs` become the
   Tailwind theme, light and dark, from a single source. A test fails when they drift, and a
   screenshot is compared with the Identity board. Its spec comes first; it decides how the
   tokens flow. This may take more than one session.
2. **Later: bump jsdom to 30** once `rpm -q nodejs24` shows 24.15 or newer.

## Traps

- **Fedora keeps Node 22 as `node`.**
  - `npm-24` runs under whatever `node` comes first on `PATH`.
  - Use the `~/.local/node24/bin` directory from CLAUDE.md, and check with `node --version`.
  - The build used an equivalent directory in the agent's scratchpad.
- **A scratch build on a newer patch release can hide engine limits.** Match the target
  machine's version for install checks.
- **`biome migrate` can silently disable linting.** Keep the a11y canary in mind after any
  Biome upgrade.
- **TypeScript 7 has no JavaScript API yet.** A tool that needs one (typescript-eslint, some
  codegen) won't work without a fallback to TypeScript 6.
- **`npx vite` puts `npx` between you and Vite.** Start Vite with
  `node ./node_modules/vite/bin/vite.js` when you need its PID.
