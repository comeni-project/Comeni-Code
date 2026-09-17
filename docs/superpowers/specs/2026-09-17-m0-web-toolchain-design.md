# M0 part 5 — the web toolchain

**Status: agreed 2026-09-17.** This is part 5 of phase M0 (architecture spec R4). The parts list
is in [`2026-09-17-m0-in-parts.md`](../../notes/journal/2026-09-17-m0-in-parts.md). R1 decided the
stack: React, Vite, TypeScript, TanStack Query and Tailwind. This spec decides what R7 leaves to
this part:

- the package manager and layout;
- the Node version;
- the TypeScript version and its strictness;
- the linter and formatter;
- the test setup;
- the CI job.

The operator made every decision here on 2026-09-17, section by section. An agent proposed them
and checked them in a scratch build with a portable, checksum-verified Node 24.21.0.

---

## P5.1 What this part does

It adds `apps/web`: a React app that type-checks, lints, tests and builds, locally and in its own
CI job. It shows a plain shell page. The identity tokens come in part 6, and the health page in
part 7.

**Done when:**

- in `apps/web` on Node 24: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` and
  `npm run build` pass locally and in CI's `web` job;
- a planted accessibility violation, an unformatted file and a type error each fail their check,
  seen once and then undone;
- `npm run dev` serves the shell on `127.0.0.1:5173`, confirmed with `curl` and a Firefox
  screenshot;
- the `python` CI job is unchanged and still passes.

## P5.2 Layout and toolchain

```
.nvmrc                      24
apps/web/
  package.json              name code-web; engines node ">=24 <25"; the scripts below
  package-lock.json
  .npmrc                    ignore-scripts, save-exact, engine-strict
  index.html
  vite.config.ts            Vite 8, @vitejs/plugin-react 6, vitest config, dev server
  tsconfig.json             TypeScript 7, strict (P5.3)
  biome.json                Biome 2.5 (P5.3)
  src/main.tsx              React 19 root, StrictMode, TanStack Query provider
  src/App.tsx               the shell: a heading and a sentence
  src/App.test.tsx          the first test
  src/test-setup.ts         jest-dom matchers for vitest
```

**Versions** (exact, from the lockfile):

| Kind | Packages |
|---|---|
| Runtime | react and react-dom 19.3.0, @tanstack/react-query 5.103.1 |
| Build | vite 8.3.0, @vitejs/plugin-react 6.1.1, typescript 7.0.2, @types/react and @types/react-dom 19.3.0, @types/node 24 |
| Test | vitest 5.0.1, jsdom 30.1.0, @testing-library/react 16.3.3, @testing-library/jest-dom 7.0.1 |
| Lint and format | @biomejs/biome 2.5.14 |

**Scripts**, identical locally and in CI:

| Script | Runs |
|---|---|
| `npm run lint` | `biome ci .` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | `vitest run` |
| `npm run build` | `vite build` |
| `npm run dev` | `vite` on `127.0.0.1:5173`, `strictPort` |

- **npm, with `npm ci`** installing exactly what the lockfile holds.
- **`ignore-scripts=true`:** installs never run package scripts, a common supply-chain attack
  route. Rolldown (inside Vite) and Biome ship native binaries as optional packages, so nothing
  needs install scripts. The scratch build installed and ran everything this way.
- **`save-exact=true`:** added dependencies are recorded without `^` ranges.
- **`engine-strict=true`:** npm refuses to install on a Node outside `engines`. The scratch build
  saw `npm ci` fail with `EBADENGINE` on Node 22 and succeed on 24.
- **Node 24 LTS**, the longest-supported line (maintenance until April 2028), pinned in `.nvmrc`,
  `engines` and CI. On this machine it comes from Fedora's `nodejs24` package, which the operator
  installs with `sudo dnf install nodejs24`.
- **TanStack Query's provider is mounted now,** so part 7 only adds queries.

**Rejected:**

| Alternative | Why not |
|---|---|
| npm workspaces at the root | pays off only with several JavaScript packages; there is one |
| pnpm or Bun | another tool to install everywhere; npm ships with Node |
| Node 22 | already in maintenance, so the pin would move within about seven months |
| Node 24 in CI but 22 allowed locally | local and CI could behave differently |
| Create React App | retired |

## P5.3 TypeScript, Biome and tests

**TypeScript 7.0, strict.** One `tsconfig.json` covers `src/` and `vite.config.ts`:

- `strict`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`, `noUnusedLocals` and `noUnusedParameters`;
- `verbatimModuleSyntax` and `isolatedModules`, which Vite's one-file-at-a-time compiling needs;
- `moduleResolution: bundler`, target `ES2024`, `jsx: react-jsx`, `noEmit`, and types
  `vite/client` and `node`.

This matches the Python side's mypy strict. The scratch build confirmed TypeScript 7 works with
Vite, vitest and the React types.

**Biome 2.5:**

- linter preset `recommended`, which includes accessibility and React hooks rules;
- formatter: 2-space indent, 100-character lines (as ruff), double quotes, trailing commas;
- imports organised;
- files: everything except `dist` and `node_modules`;
- **no VCS integration:** it looks for a `.gitignore` inside `apps/web`, and the explicit file
  list already covers what it would give.

**A trap the scratch build found:** `biome migrate` rewrote the deprecated
`"recommended": true` as **`"preset": "none"`**, which silently disables every lint rule while
`biome ci` still passes. The config uses `"preset": "recommended"`, and a planted `<img>` without
alt text must fail with `lint/a11y/useAltText`. That canary is part of the done-when check.

**Tests:**

- vitest 5 with jsdom 30;
- `@testing-library/jest-dom/vitest` loaded from a setup file;
- the first test renders `<App />` and finds the heading by its accessible role and name, the
  query style later screens use.

**Rejected:**

| Alternative | Why not |
|---|---|
| ESLint + typescript-eslint + Prettier | typescript-eslint supports TypeScript below 6.1 only, so we'd stay on TypeScript 6; slowest; three tools (operator) |
| oxlint + Prettier | two tools and two configs (operator) |
| TypeScript 6 | only needed for typescript-eslint |
| Plain `strict` | adding the extra flags later means fixing every existing file |
| happy-dom | faster, but jsdom is closer to browsers and Testing Library's default |

## P5.4 CI and docs

- **A second job, `web`,** in `.github/workflows/ci.yml`, running in parallel with `python`:
  - `actions/checkout` at the pinned SHA;
  - **`actions/setup-node` v7.0.0 at `820762786026740c76f36085b0efc47a31fe5020`** (verified with
    `gh api`), reading `.nvmrc`, with npm caching keyed to `apps/web/package-lock.json`;
  - in `apps/web`: `npm ci`, then `npm run lint`, `npm run typecheck`, `npm test` and
    `npm run build`.
- **CLAUDE.md:** Node 24 and its install command, the web commands, and `apps/web/` and
  `.nvmrc` in *Layout*.
- `node_modules/` and `dist/` are already git-ignored.

## P5.5 Risks

- **TypeScript 7 is new** (7.0.2). If a tool the web app needs later requires the TypeScript JS
  API, TypeScript 6 is the fallback, decided in that part's spec.
- **Biome's config format moves between versions,** as the preset change showed. The a11y canary
  catches a config that silently turns rules off.
- **Two Node versions on this machine:** Fedora keeps `node-22` beside `node-24`. Commands must
  run on 24 (`node --version`); `engine-strict` stops `npm ci` on the wrong one.
