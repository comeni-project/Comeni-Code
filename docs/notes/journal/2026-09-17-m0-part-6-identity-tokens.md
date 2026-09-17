# 2026-09-17 — M0 part 6: identity tokens into Tailwind

**Part 6 of M0 is built.**
- `.design/tokens.json` is the only place a token value is written. The boards read it, and
  `npm run tokens` generates the web app's committed `tokens.css` from it.
- Tailwind 4 has only our colours. Dark mode follows the system in plain CSS, and `data-theme`
  overrides it.
- Lexend and Geist Mono are bundled with the app. `/` shows the identity specimen.

**Next is part 7** (the health page).

The operator agreed the design section by section, asked why there is no script on load (answer:
nothing saves a preference yet; that script arrives with the Theme setting), and **kept the
current tokens** although three light chip pairs measure under 4.5 : 1.

---

## Where things stand

| Claim | Check |
|---|---|
| The boards regenerate byte-identical from `tokens.json` | `sha256sum` of every `.dc.html` and `canvas.json` before the move, then `node .design/build_pages.mjs` and `sha256sum -c`: all OK |
| A stale `tokens.css` fails a test | done during the build: `--ink` edited by hand → "src/styles/tokens.css is stale: run npm run tokens"; regenerated → pass |
| Tailwind resolves our classes; default colours produce nothing | `src/styles/tokens.test.ts` compiles `bg-surface`, `shadow-float`, `rounded-panel`, `font-mono`, … and `bg-red-500` |
| lint, typecheck, test (8) and build pass locally and in CI | in `apps/web`: `npm run lint && npm run typecheck && npm test && npm run build`; PR #23, run 35222506740: `web` and `python` passed |
| The built app requests nothing from another origin | `dist` served by `python3 -m http.server` with Firefox headless: only `/`, the JS, the CSS, one Lexend and one Geist Mono `woff2` |
| The specimen matches the Identity boards | Firefox screenshots with `ui.systemUsesDarkTheme` 0 and 1, beside `IdentityCodeLight` and `IdentityCodeDark`: same ground, surfaces, top bar and mark, tactile button, worded chips, both fonts. The specimen is a token sheet, not the board's lesson layout, so layouts differ by design |

**Contrast** (WCAG, from `tokens.json`; bold is under 4.5 : 1):

| Pair | Light | Dark |
|---|---|---|
| `ink` on `surface` | 17.32 | 14.00 |
| `ink` on `bg` | 15.89 | 15.31 |
| `ink` on `canvas` | 16.45 | 14.75 |
| `ink2` on `surface` | 8.37 | 8.24 |
| `ink2` on `bg` | 7.68 | 9.01 |
| `ink2` on `canvas` | 7.94 | 8.68 |
| `ink3` on `surface` | 5.19 | 5.44 |
| `ink3` on `bg` | 4.76 | 5.95 |
| `ink3` on `canvas` | 4.93 | 5.73 |
| `line` on `surface` | **3.43** | 7.82 |
| `sel` on `surface` | 4.57 | 6.63 |
| `meas` on `surface` | 5.43 | 9.32 |
| `open` on `surface` | 5.33 | 6.19 |
| `settled` on `surface` | 8.37 | 8.24 |
| `btnInk` on `btn` | 4.96 | 7.94 |
| `sel` on `selSoft` | **3.92** | 5.94 |
| `open` on `openSoft` | **4.44** | 5.69 |
| `meas` on `measSoft` | 4.81 | 7.89 |
| `btn` on `lineSoft` | **4.28** | 6.24 |

`line` on `surface` is used for route lines and marks, where 3 : 1 is the bar. The three chip
pairs are text. **The operator kept the tokens**; revisit on the boards if the chips prove hard
to read (spec P6.6).

## What changed this session

- PR #22: part 6's spec and plan.
- Part 6's commits, oldest first: 6c5c5e1 215405c 35d0a2d 01ab3f1 (PR #23).

## Decisions made, and why

The spec holds the rejected alternatives. In order:

1. **Section 1: one JSON source,** read by `_identity.mjs` through a JSON import and by a small
   TypeScript renderer; the generated CSS is committed so token changes show in review.
2. **Section 2: Tailwind 4 with `@theme inline`,** the default palette removed, and dark mode
   in CSS that follows the system with a `data-theme` override. **No script on load** (operator
   asked; agreed): it only matters for a saved preference, which doesn't exist yet.
3. **Section 3: Fontsource variable fonts** bundled by Vite; the identity specimen at `/` until
   M3; contrast measured and reported, not fixed.
4. **After the scratch build: keep the current tokens** (operator).

## What is next

1. **Part 7, the health page:** TanStack Query reads `/api/health` through Vite's proxy, each
   state in words as well as colour. Its spec comes first. It can use the token classes now.
2. Part 8 (Compose, with CI starting the stack), then part 9 (content repo guardrails, which
   needs the operator's confirmation for GitHub settings).

## Open questions

- The light chip contrast (above), kept for now.
- jsdom 30 once Fedora ships Node 24.15 (part 5).

## Traps

- **Biome can't parse Tailwind's CSS** without `css.parser.tailwindDirectives: true`.
- **The generated CSS must be in Biome's style** (lowercase hex, spaced `rgba()`, double
  quotes). Otherwise `biome check --write` rewrites `tokens.css` and the drift test fails. Fix
  `cssValue` in the renderer, never the CSS.
- **Token tests need `// @vitest-environment node`:** under jsdom a `new URL(…, import.meta.url)`
  isn't a `file:` URL.
- **Testing Library doesn't clean up with vitest globals off;** `test-setup.ts` calls
  `cleanup` after each test.
- **Checking a font at 13 px by eye is unreliable.** I first misread Geist Mono in a screenshot
  as a fallback font; a zoomed crop (the slashed zero) settled it, and the HTTP log proves the file
  loads.
- **The plan expected 12 or more `woff2` files; the build has 9** (Lexend ships 3 subsets, Geist
  Mono 6). Nothing is missing.
- **The board generator now needs Node 22 or newer** for the JSON import (`.design/README.md`).
