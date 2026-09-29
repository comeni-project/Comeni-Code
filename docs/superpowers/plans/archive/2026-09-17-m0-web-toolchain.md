# M0 part 5: the web toolchain — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task, driven by one agent. Subagents are for review only (the operator's rule in CLAUDE.md). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `apps/web` (Vite 8, React 19, TypeScript 7 strict, TanStack Query, Biome 2.5,
vitest 5) that lints, type-checks, tests and builds on Node 24, locally and in a parallel `web`
CI job.

**Architecture:** A standalone npm project in `apps/web` with its own lockfile. The root stays
the Python uv workspace. One CI job per language.

**Tech Stack:** Node 24 LTS, npm, Vite 8.3, React 19.3, TypeScript 7.0, TanStack Query 5.103,
Biome 2.5.14, vitest 5.0 with jsdom 30 and Testing Library.

**Spec:** [`docs/superpowers/specs/2026-09-17-m0-web-toolchain-design.md`](../specs/2026-09-17-m0-web-toolchain-design.md)
(agreed 2026-09-17).

**Tested before writing:** every file below was built in a scratch directory with a portable,
checksum-verified Node 24.21.0.
- A clean `npm ci` installed with 0 vulnerabilities and no install scripts, and `lint`,
  `typecheck`, `test` and `build` all passed.
- The a11y, formatting and type canaries each failed as expected.
- The dev server served the shell (curl and a Firefox screenshot).
- `npm ci` refused on Node 22 (`EBADENGINE`).
- **Trap found:** `biome migrate` turned the old rules setting into `"preset": "none"`, which
  disables every lint rule. The config below uses `"preset": "recommended"`, proven by the a11y
  canary.

## Global Constraints

- **Node 24 only** (`.nvmrc` `24`; `engines` `>=24 <25`; `engine-strict`). Every `npm` command runs
  on Node 24.
- **Exact dependency versions,** as listed in `package.json` below, with the lockfile committed.
  Install with `npm ci`.
- **`apps/web/.npmrc`:** `ignore-scripts=true`, `save-exact=true`, `engine-strict=true`.
- **TypeScript flags** exactly as in `tsconfig.json` below. **Biome** `"preset": "recommended"` with
  100-character lines.
- **Dev server** on `127.0.0.1:5173` with `strictPort`.
- **CI:** a `web` job beside `python`, with `actions/setup-node` pinned to
  `820762786026740c76f36085b0efc47a31fe5020` (v7.0.0).
- **Background processes** are started from a script file, kept by `$!`, and stopped by that PID.
  Check the port is free first. Never use `pkill -f` or `pgrep -f` with a pattern in your own
  command line (part 4's journal).
- **Commits:** `type(scope): what is now true`, a body that says why, ending with
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. PR descriptions end with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Never commit to `main`.

---

### Task 0: Land the spec and plan, then branch

- [ ] **Step 1: Commit on `docs/m0-part-5`, push, PR, merge after CI**

```bash
git add docs/superpowers/specs/2026-09-17-m0-web-toolchain-design.md docs/superpowers/specs/README.md
git commit -m "docs(spec): M0 part 5 — the web toolchain

Settles what R7 leaves to part 5: npm and Node 24, Vite 8 with React 19, TypeScript 7 strict,
Biome for lint and format, vitest with jsdom, and a web CI job beside the Python one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git add docs/superpowers/plans/2026-09-17-m0-web-toolchain.md
git commit -m "docs(plan): M0 part 5 — the web toolchain

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin docs/m0-part-5
gh pr create --base main --title "M0 part 5: spec and plan — the web toolchain" --body "Spec and plan for M0 part 5, agreed section by section on 2026-09-17.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch && gh pr merge --merge
git checkout main && git pull --ff-only && git checkout -b feat/m0-web-toolchain
```

---

### Task 1: Node 24, the app, and its first test

**Files:**
- Create: `.nvmrc`, `apps/web/.npmrc`, `apps/web/package.json`, `apps/web/package-lock.json` (generated), `apps/web/index.html`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/biome.json`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/test-setup.ts`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Node 24 must be available**

Run: `node --version`
- **Expected:** `v24.x`.
- **If it isn't:** check `rpm -q nodejs24`. If Fedora's package is missing, **stop and ask the
  operator** to run `! sudo dnf install nodejs24`.
- **If it's installed but `node` is still 22:** run `rpm -ql nodejs24 | grep '/bin/'`, and prefix
  every command in this plan with that directory on `PATH` (for example
  `PATH=<dir>:$PATH npm ci`). Confirm with `node --version` again.

- [ ] **Step 2: Pin Node, and write the npm config and manifest**

`.nvmrc` (repository root):

```
24
```

`apps/web/.npmrc`:

```
# Installs never run package scripts (a common supply-chain route); native tools ship as optional packages.
ignore-scripts=true
save-exact=true
engine-strict=true
```

`apps/web/package.json`:

```json
{
  "name": "code-web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "engines": {
    "node": ">=24 <25"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "biome ci ."
  },
  "dependencies": {
    "@tanstack/react-query": "5.103.1",
    "react": "19.3.0",
    "react-dom": "19.3.0"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.14",
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.3",
    "@types/node": "24.13.5",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "6.1.1",
    "jsdom": "30.1.0",
    "typescript": "7.0.2",
    "vite": "8.3.0",
    "vitest": "5.0.1"
  }
}
```

Run, in `apps/web`: `npm install`
Expected: `package-lock.json` created, `found 0 vulnerabilities`, no install scripts run.

- [ ] **Step 3: Write the failing test and its setup**

`apps/web/src/test-setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

`apps/web/src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the Comeni Code heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Comeni Code" })).toBeInTheDocument();
  });
});
```

`apps/web/vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// M0 part 5 spec, P5.2–P5.3. Part 7 adds the /api proxy.
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

- [ ] **Step 4: Run it and watch it fail**

Run, in `apps/web`: `npm test`
Expected: a failure resolving `./App` (the file doesn't exist).

- [ ] **Step 5: Write the app**

`apps/web/src/App.tsx`:

```tsx
// The shell. Part 6 brings the identity tokens and part 7 the health page (M0 part 5 spec, P5.2).
export function App() {
  return (
    <main>
      <h1>Comeni Code</h1>
      <p>The web app is running.</p>
    </main>
  );
}
```

`apps/web/src/main.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("index.html has no #root element");
}

// Part 7 adds the first query; the provider is here from the start.
const queryClient = new QueryClient();

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
```

`apps/web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Comeni Code</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Run it and watch it pass**

Run: `npm test`
Expected: `Tests  1 passed (1)`.

- [ ] **Step 7: TypeScript and Biome configs**

`apps/web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "types": ["vite/client", "node"],
    "noEmit": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["src", "vite.config.ts"]
}
```

`apps/web/biome.json`:

```json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "files": { "includes": ["**", "!dist", "!node_modules"] },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": { "quoteStyle": "double", "trailingCommas": "all" }
  },
  "linter": { "enabled": true, "rules": { "preset": "recommended" } },
  "assist": { "enabled": true, "actions": { "source": { "organizeImports": "on" } } }
}
```

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: Biome `No fixes applied`, with no errors or infos; typecheck silent; 1 test passed;
`✓ built`. If Biome reports formatting differences in the files above, run
`npx biome format --write .` once, then rerun.

- [ ] **Step 8: Commit** (from the repository root)

```bash
git add .nvmrc apps/web
git status --short   # no node_modules or dist listed
git commit -m "feat(web): a React shell that lints, type-checks, tests and builds on Node 24

M0 part 5 (spec P5.2–P5.3). TypeScript 7 strict matches the Python side's mypy strict. Biome
lints and formats in one step. Installs run no package scripts and refuse any Node but 24.
TanStack Query's provider is mounted now so part 7 only adds queries.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: See each check fail, and see the dev server

- [ ] **Step 1: The a11y canary** (proves lint rules are on)

```bash
cd apps/web
cp src/App.tsx /tmp/App.tsx.bak
printf '\nexport function Canary() {\n  return <img src="x.png" />;\n}\n' >> src/App.tsx
npm run lint; cp /tmp/App.tsx.bak src/App.tsx
```
Expected: fails with `lint/a11y/useAltText`.

- [ ] **Step 2: The formatting canary**

```bash
sed -i 's|<h1>Comeni Code</h1>|<h1  >Comeni Code</h1>|' src/App.tsx
npm run lint; cp /tmp/App.tsx.bak src/App.tsx
```
Expected: fails with `File content differs from formatting output`.

- [ ] **Step 3: The type canary**

```bash
printf '\nexport const broken: number = "not a number";\n' >> src/App.tsx
npm run typecheck; cp /tmp/App.tsx.bak src/App.tsx
npm run lint && npm run typecheck
```
Expected: the first typecheck fails with `TS2322`; the final lint and typecheck pass.
`git status` shows nothing modified.

- [ ] **Step 4: The dev server.** Write this script to a scratch file and run it with `bash`, in a
  separate command from the one that writes it:

```bash
#!/usr/bin/env bash
set -u
cd <repository root>/apps/web
if ss -ltn | grep -q ':5173 '; then echo "port 5173 busy"; exit 1; fi
npx vite > /tmp/code-vite.log 2>&1 &
VITE=$!
for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:5173/ && break; sleep 0.25; done
curl -s http://127.0.0.1:5173/ | grep -o "<title>[^<]*</title>"
P=$(mktemp -d)
timeout 60 firefox --headless --profile "$P" --no-remote --window-size=900,500 --screenshot /tmp/code-web.png http://127.0.0.1:5173/
kill "$VITE"; wait "$VITE" 2>/dev/null
ps -p "$VITE" >/dev/null && echo "vite still running" || echo "vite stopped"
```
Expected: `<title>Comeni Code</title>`, a screenshot showing the heading and sentence, and
`vite stopped`. `npx vite` is a child of `npx`; if the saved PID isn't the server, find its child
with `pgrep -P $VITE` and stop that PID.

---

### Task 3: CI and docs, then the PR

**Files:**
- Modify: `.github/workflows/ci.yml`, `CLAUDE.md`

- [ ] **Step 1: The `web` job.** Append to `jobs:` in `.github/workflows/ci.yml`, after the
  `python` job:

```yaml
  web:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1

      - name: Install Node
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .nvmrc
          cache: npm
          cache-dependency-path: apps/web/package-lock.json

      # The lockfile is the contract; .npmrc refuses install scripts and any Node but 24.
      - name: Install
        run: npm ci

      - name: Lint and format
        run: npm run lint

      - name: Types
        run: npm run typecheck

      - name: Tests
        run: npm test

      - name: Build
        run: npm run build
```

Also change the workflow's top comment to say that each language has its own job.

- [ ] **Step 2: CLAUDE.md**
- In **Status**, say the web app exists as a shell.
- In **First-time setup**, add:

```
sudo dnf install nodejs24                                # Node 24 (the web app refuses others)
cd apps/web && npm ci && cd ../..
```

- Add a **Web commands** block after **Commands**:

```
cd apps/web
npm run lint        # Biome: lint and formatting
npm run typecheck   # TypeScript 7, strict
npm test            # vitest
npm run build       # vite build
npm run dev         # http://127.0.0.1:5173
```

- In *Layout*, add `.nvmrc` (`Node 24 for the web app`) and
  `apps/web/                 the React app (Vite, TypeScript, Biome, vitest)`.

- [ ] **Step 3: Check, commit, push, PR, CI**

Run (root): `uv run pytest -q tests/repo && uv run ruff format --check .`
Expected: clean (the link check covers CLAUDE.md).

```bash
git add .github/workflows/ci.yml CLAUDE.md
git commit -m "ci: a web job lints, type-checks, tests and builds the React app on Node 24

Spec P5.4. It runs beside the Python job, with setup-node pinned to a verified SHA and npm
caching keyed to the lockfile. CLAUDE.md gives the Node 24 install and the web commands.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin feat/m0-web-toolchain
gh pr create --base main --title "M0 part 5: the web toolchain" --body "M0 part 5 per docs/superpowers/specs/2026-09-17-m0-web-toolchain-design.md: apps/web (Vite 8, React 19, TypeScript 7 strict, Biome, vitest) on Node 24, with a web CI job.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch
```
Expected: both `python` and `web` pass.

---

### Task 4: Check against *done when*, and record the part

- [ ] **Step 1: Check spec P5.1**

| Item | How |
|---|---|
| The five commands pass locally on Node 24 | Task 1 Step 7, after `node --version` shows v24 |
| The five commands pass in CI | the PR's `web` job log shows each step |
| The three canaries fail, then pass again | Task 2 Steps 1–3 |
| The dev server serves the shell | Task 2 Step 4 (title and screenshot) |
| `python` still passes | the PR's `python` job |

- [ ] **Step 2: Mark the spec as built** (`**Status: agreed 2026-09-17; built in PR <number>.**`;
specs README row `agreed; built`).

- [ ] **Step 3: Journal entry** `docs/notes/journal/2026-09-17-m0-part-5-web-toolchain.md` (use
the finishing date if different), in the README's order:
- **Where things stand:** the P5.1 checks with commands, the CI run, the screenshot result.
- **What changed:** commit hashes and PR numbers.
- **Decisions:** Biome (over oxlint and ESLint), Node 24 (over 22), TypeScript 7 strict, and
  `engine-strict`.
- **What is next:** part 6 (identity tokens into Tailwind), whose spec comes first.
- **Traps:**
  - `biome migrate` can write `"preset": "none"`;
  - two Node versions on Fedora;
  - `npx` starts a child process, so stop the child;
  - TypeScript 7 has no JS API for tools that need one.

Update the journal README box and table.

- [ ] **Step 4: Commit, push, merge**

```bash
git add docs
git commit -m "docs(journal): M0 part 5 built — the web toolchain

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push && gh pr checks --watch && gh pr merge --merge
git checkout main && git pull --ff-only
```
