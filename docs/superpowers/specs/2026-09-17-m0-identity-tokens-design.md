# M0 part 6 — identity tokens into Tailwind

**Status: agreed 2026-09-17.** This is part 6 of phase M0 (architecture spec R4). The parts list
is in [`2026-09-17-m0-in-parts.md`](../../notes/journal/2026-09-17-m0-in-parts.md). It builds on
part 5's web toolchain ([P5.2](2026-09-17-m0-web-toolchain-design.md)) and brings in the identity
settled in W10 of the [2026-09-16 spec](2026-09-16-comeni-code-weaving-and-pages-design.md). This
spec decides what R7 leaves to this part:

- how the tokens reach the app from one source;
- the Tailwind 4 setup;
- the dark-mode strategy;
- how the fonts are served;
- what the app shows until real pages arrive.

The operator made every decision here on 2026-09-17, section by section. An agent proposed them
and checked them in a scratch build first.

---

## P6.1 What this part does

It gives the web app the Comeni hybrid identity: the light and dark colour tokens, Lexend and
Geist Mono, and the radii, all as Tailwind classes generated from the same file the design boards
are drawn from. The app shows an **identity specimen** at `/`.

**Done when:**

- `.design/tokens.json` is the only place a token value is written. `node .design/build_pages.mjs`
  regenerates every board **byte-identical** to before the move;
- `npm run tokens` writes `apps/web/src/styles/tokens.css`, and a test fails with
  *"run npm run tokens"* when the committed file is stale, seen once and then undone;
- a test proves Tailwind resolves our classes to the runtime variables and generates nothing for a
  default colour such as `bg-red-500`;
- `npm run lint`, `typecheck`, `test` and `build` pass locally and in CI's `web` job, unchanged;
- light and dark screenshots of the specimen sit beside the `IdentityCodeLight` and
  `IdentityCodeDark` boards in the journal, and the built app makes no request to another origin;
- the contrast ratios of the main text pairs are recorded in the journal, and pairs under 4.5 : 1
  are reported to the operator, not silently changed.

Out of scope: a saved theme preference and its setting (P6.3), the health page (part 7), Labs
adopting the tokens (W10 leaves that to Labs).

## P6.2 One source, a generated theme

```
.design/tokens.json                 light, dark, fonts, radius: the only token values
.design/_identity.mjs               imports tokens.json; draws the identity boards as before
apps/web/scripts/generate-tokens.ts npm run tokens: tokens.json → src/styles/tokens.css
apps/web/src/styles/renderTokens.ts the pure renderer and validator (no files)
apps/web/src/styles/tokens.css      generated and committed
apps/web/src/styles/tokens.test.ts  drift, validation and Tailwind resolution
```

- **`tokens.json` holds exactly today's values,** moved out of `_identity.mjs`, plus `radius`
  (`control` 10 px, `panel` 14 px, `pill`), from W10's "tighter corners (10–14 px)".
  `_identity.mjs` reads it with `import … with { type: 'json' }`. The boards don't change.
- **The renderer validates before it writes:** light and dark must name the same tokens, and every
  colour must be `#RRGGBB` or `rgba()`; `float` is a shadow. Each error names the token.
- **`tokens.css` is committed,** so a token change shows up in review as CSS, and the app build
  never runs the generator.
- **The drift test** compares the committed file with a fresh render and fails with
  *"src/styles/tokens.css is stale: run npm run tokens"*.
- **The generated file is written in Biome's CSS style** (lowercase hex, spaced `rgba()` arguments
  with a leading zero, double-quoted font names), so `biome ci` accepts it unchanged. The JSON keeps
  the boards' spelling, so the boards stay byte-identical.
- **Variables are kebab-case** (`ink2` → `--ink-2`, `lineSoft` → `--line-soft`). Colour-law
  tokens carry their meaning as a comment (`--sel: …; /* next · selected */`).
- `package.json` gains `"tokens": "node scripts/generate-tokens.ts"`. Node 24 runs TypeScript
  directly, so `tsconfig.json` gains `allowImportingTsExtensions` and `erasableSyntaxOnly` and
  includes `scripts/`.

**Rejected:**

| Alternative | Why not |
|---|---|
| The app imports `_identity.mjs` directly | it is a board generator full of HTML templates; the app would bundle or execute it |
| Generate the CSS at build time, uncommitted | a token change would be invisible in review, and the build would depend on `.design/` |
| Tokens in a TypeScript file under `apps/web` | the boards would read from the app, the wrong direction |
| Style Dictionary or a similar tool | a dependency and a config for 27 tokens in two themes |

## P6.3 Tailwind 4 and dark mode

- **Tailwind 4.3** with `@tailwindcss/vite`; no JavaScript config. `src/styles/app.css` imports
  `tailwindcss`, the two fonts and `tokens.css`, and sets the body to `bg-bg font-sans text-ink`.
- **`@theme { --color-*: initial; }` removes Tailwind's palette.** Only our colours exist, so no
  class can reach a colour outside the law (W10). `shadow-sm`, spacing and type scales stay.
- **`@theme inline`** maps each class to the runtime variable (`--color-surface: var(--surface)`),
  so one set of classes follows the theme. It adds `--shadow-float`, `--font-sans`, `--font-mono`
  and `--radius-control|panel|pill`.
- **Dark mode is CSS-first,** in the order W10 set: *the default follows the system*.
  1. `:root` holds light, with `color-scheme: light`;
  2. `@media (prefers-color-scheme: dark)` applies dark to `:root:not([data-theme="light"])`;
  3. `:root[data-theme="dark"]` applies dark whatever the system says.
- **`dark:` follows the same rule** through `@custom-variant dark`, so a component never needs it
  for colour but can use it for anything else.
- **No script runs before the first paint.** The theme itself needs no JavaScript, so the first
  paint is already right and nothing flashes. A script is needed only to apply a *saved* choice
  before paint. That arrives with the Theme setting, whose part decides where the choice is
  stored.
- **The specimen's theme switch** sets or removes `data-theme` on `<html>` for this visit only.

**Rejected:**

| Alternative | Why not |
|---|---|
| Tailwind's `class` strategy (`.dark` on `<html>`) | needs JavaScript to follow the system, so the first paint can be wrong |
| An inline script now that reads `localStorage` | nothing saves a preference yet; it belongs with the Theme setting (operator) |
| Keep Tailwind's default palette | `bg-red-500` would work and break the colour law silently |
| A Tailwind 3 JavaScript config (`@config`) | Tailwind 4's CSS theme is the supported path |

## P6.4 Fonts and the specimen

- **Self-hosted variable fonts** from Fontsource: `@fontsource-variable/lexend` and
  `@fontsource-variable/geist-mono` 5.3.0 (both OFL-1.1). Vite bundles the `woff2` files, so the
  app works offline and tells no font service who is reading. Their family names
  (`"Lexend Variable"`, `"Geist Mono Variable"`) come first, then the boards' stacks.
- **The specimen** (`src/identity/Specimen.tsx`) replaces the shell at `/` until real pages arrive
  (M3). It shows every token in use, laid out like the Identity board:
  - the top bar with the transit-line mark and "Comeni Code", and the theme switch
    (system · light · dark, `aria-pressed`);
  - the five colour roles, each **named in words** (*Route · valid*, *Next · selected*,
    *Measured · stale*, *Needs you · wrong*, *Settled · no colour*);
  - surfaces, lines and the three inks;
  - the tactile primary button, a secondary button and worded state chips;
  - Lexend and Geist Mono samples, the smallest at 11 px, one panel floating.
- **Tests:** the roles appear in words; the switch sets `data-theme` and *system* removes it; the
  app renders the specimen under the bar.

**Rejected:**

| Alternative | Why not |
|---|---|
| Google Fonts or another CDN | a request to a third party on every page, and no offline development |
| Static weights (several files per weight) | more files; the variable font covers every weight in one |
| A Storybook | a second app and toolchain for one page of tokens |
| Keep the plain shell until M3 | nothing would show the theme working in a browser |

## P6.5 Tests and traps found in the scratch build

- **`biome ci` can't parse Tailwind's CSS** (`@theme`, `@custom-variant`, `@apply`) by default.
  `biome.json` sets `css.parser.tailwindDirectives: true`.
- **The token tests run in vitest's `node` environment** (`// @vitest-environment node`). Under
  jsdom, `new URL(…, import.meta.url)` is not a `file:` URL, and `readFileSync` refuses it.
- **Testing Library doesn't clean up between tests when vitest globals are off.** Without
  `afterEach(cleanup)` in `test-setup.ts`, the second test finds two theme switches.
- **The Tailwind test compiles with `@tailwindcss/node`'s `compile`** (a dev dependency, same
  version), so it checks real class output, not a hand-written expectation.
- **Screenshots:** a Firefox profile with `ui.systemUsesDarkTheme` set to 1 renders the system-dark
  path, without clicking the switch.
- **Tailwind and Lightning CSS ship native binaries as optional packages,** so they install and
  build with `ignore-scripts=true`, as part 5 required.

## P6.6 Risks

- **Contrast of soft fills:** in light, three chip pairings measure under 4.5 : 1 (*next* on its
  fill 3.92, *needs you* on its fill 4.44, the button green on the route fill 4.28). W10 promises
  AA. This part records the numbers and reports them; changing a token is a design decision for
  the operator, made on the boards first.
- **Tailwind 4 minor versions change CSS details.** The resolution test pins what we rely on
  (`var(--surface)`, the shadow, the radius, the mono family).
- **Two places draw the identity:** the boards (HTML strings) and the app (Tailwind). They share
  values, not components; a layout change on a board is not reflected automatically.
