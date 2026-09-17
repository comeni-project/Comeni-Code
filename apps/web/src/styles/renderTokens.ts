// Turns .design/tokens.json into the CSS the app uses (M0 part 6 spec, P6.2). Pure: no files here.

export type Palette = Record<string, string>;
export interface Tokens {
  light: Palette;
  dark: Palette;
  fonts: { ui: string; mono: string };
  radius: Record<string, string>;
}

// What each colour means, from the colour law (W10). Settled spends no colour.
const ROLES: Record<string, string> = {
  line: "route · valid",
  lineSoft: "route · valid (fill)",
  sel: "next · selected",
  selSoft: "next · selected (fill)",
  meas: "measured · stale · not yet reviewed",
  measBar: "measured · stale (marks)",
  measSoft: "measured · stale (fill)",
  open: "needs you · wrong",
  openSoft: "needs you · wrong (fill)",
  settled: "settled: spends no colour",
};

// Fontsource registers the variable fonts under these family names; they come first.
const BUNDLED_FONT = { ui: '"Lexend Variable"', mono: '"Geist Mono Variable"' };

const COLOUR = /^(#[0-9A-Fa-f]{6}|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(0|1|0?\.\d+)\s*\))$/;
const SHADOWS = new Set(["float"]);

export const kebab = (name: string): string =>
  name.replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase();

// Writes a value the way Biome formats CSS, so the generated file passes `biome ci` unchanged:
// lowercase hex, spaced rgba() arguments with a leading zero, double-quoted font names.
export const cssValue = (value: string): string =>
  value
    .replace(/#[0-9A-Fa-f]{6}\b/g, (hex) => hex.toLowerCase())
    .replace(
      /rgba\(([^)]*)\)/g,
      (_, args: string) =>
        `rgba(${args
          .split(",")
          .map((a) => a.trim().replace(/^\./, "0."))
          .join(", ")})`,
    )
    .replace(/'([^']*)'/g, '"$1"');

const names = (palette: Palette): string[] => Object.keys(palette).filter((n) => n !== "name");

export function validate(tokens: Tokens): void {
  const light = names(tokens.light).sort();
  const dark = names(tokens.dark).sort();
  const onlyLight = light.filter((n) => !dark.includes(n));
  const onlyDark = dark.filter((n) => !light.includes(n));
  if (onlyLight.length > 0 || onlyDark.length > 0) {
    throw new Error(
      `light and dark must name the same tokens; only light: ${onlyLight.join(", ") || "none"}; only dark: ${onlyDark.join(", ") || "none"}`,
    );
  }
  for (const [theme, palette] of [
    ["light", tokens.light],
    ["dark", tokens.dark],
  ] as const) {
    for (const name of names(palette)) {
      const value = palette[name] ?? "";
      if (!SHADOWS.has(name) && !COLOUR.test(value)) {
        throw new Error(`${theme}.${name} is not a #RRGGBB or rgba() colour: ${value}`);
      }
    }
  }
}

function block(palette: Palette, indent: string): string {
  return names(palette)
    .map((name) => {
      const role = ROLES[name];
      return `${indent}--${kebab(name)}: ${cssValue(palette[name] ?? "")};${role ? ` /* ${role} */` : ""}`;
    })
    .join("\n");
}

export function renderTokensCss(tokens: Tokens): string {
  validate(tokens);
  const colours = names(tokens.light).filter((n) => !SHADOWS.has(n));
  const shadows = names(tokens.light).filter((n) => SHADOWS.has(n));
  return `/* Generated from .design/tokens.json by \`npm run tokens\`. Do not edit (M0 part 6 spec, P6.2). */

/* Light, the default. */
:root {
  color-scheme: light;
${block(tokens.light, "  ")}
}

/* Dark when the system asks for it, unless someone chose light. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
${block(tokens.dark, "    ")}
  }
}

/* Dark when someone chose it, whatever the system says. */
:root[data-theme="dark"] {
  color-scheme: dark;
${block(tokens.dark, "  ")}
}

/* Tailwind's palette is only ours: no default colours, so no colour outside the law. */
@theme {
  --color-*: initial;
}

@theme inline {
${colours.map((n) => `  --color-${kebab(n)}: var(--${kebab(n)});`).join("\n")}
${shadows.map((n) => `  --shadow-${kebab(n)}: var(--${kebab(n)});`).join("\n")}
  --font-sans: ${BUNDLED_FONT.ui}, ${cssValue(tokens.fonts.ui)};
  --font-mono: ${BUNDLED_FONT.mono}, ${cssValue(tokens.fonts.mono)};
${Object.entries(tokens.radius)
  .map(([n, v]) => `  --radius-${kebab(n)}: ${v};`)
  .join("\n")}
}

/* \`dark:\` follows the same rule as the variables: the system, unless someone chose. */
@custom-variant dark {
  @media (prefers-color-scheme: dark) {
    &:where(:root:not([data-theme="light"]), :root:not([data-theme="light"]) *) {
      @slot;
    }
  }
  &:where([data-theme="dark"], [data-theme="dark"] *) {
    @slot;
  }
}
`;
}
