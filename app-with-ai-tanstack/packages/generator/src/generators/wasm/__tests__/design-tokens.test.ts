/**
 * The two stylesheets have to agree about what the product looks like.
 *
 * A generated application can be painted by either of two files, and they cannot
 * share one: `frontend/src/styles/globals.css` declares Tailwind/shadcn
 * variables as HSL triples, and `templates/wasm/styles.css` declares plain CSS
 * variables as hex, because the browser runtime has no Tailwind and no build
 * step to give it one.
 *
 * So the palette was written down twice, and the only thing keeping the copies
 * together was a sentence in CLAUDE.md. That is not a mechanism. This is: both
 * files are checked against `templates/common/design-tokens.json`, and changing
 * a colour in one place fails here until it is changed in the other.
 *
 * What this does not check is the whole stylesheet — only the palette, the
 * corner radius and the typefaces, which are the things that make two screens
 * look like the same product or like two different ones.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const TEMPLATES = join(import.meta.dirname, "../../../../templates");

const tokens = JSON.parse(readFileSync(join(TEMPLATES, "common/design-tokens.json"), "utf-8")) as {
  light: Record<string, string>;
  radius: string;
  fonts: Record<string, string>;
};

const reactCss = readFileSync(
  join(TEMPLATES, "tanstack-start-nestjs/frontend/src/styles/globals.css"),
  "utf-8"
);
const browserCss = readFileSync(join(TEMPLATES, "wasm/styles.css"), "utf-8");

/** `182 78% 27%` -> `#0d6e6e`, so the two notations can be compared at all. */
function hslToHex(triple: string): string | null {
  const match = triple.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) return null;
  const [h, s, l] = [Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100];
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - chroma / 2;
  const sector = Math.floor(h / 60) % 6;
  const [r, g, b] = (
    [
      [chroma, x, 0],
      [x, chroma, 0],
      [0, chroma, x],
      [0, x, chroma],
      [x, 0, chroma],
      [chroma, 0, x],
    ] as const
  )[sector] ?? [0, 0, 0];
  const byte = (value: number) =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/** Read a custom property out of a stylesheet's first (light) block. */
function propertyOf(css: string, name: string): string | null {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return match ? match[1]!.trim() : null;
}

/** Two hex colours are the same colour if they differ by at most one step. */
function near(a: string, b: string, tolerance = 2): boolean {
  const parse = (hex: string) =>
    [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const [x, y] = [parse(a.toLowerCase()), parse(b.toLowerCase())];
  return x.every((channel, index) => Math.abs(channel - y[index]!) <= tolerance);
}

describe("the Swiss Clean palette", () => {
  // globals.css writes HSL because Tailwind composes with it (`hsl(var(--primary)
  // / 0.5)`); the rounding to whole percentages is why this compares with a
  // tolerance rather than for equality.
  const REACT = {
    background: "background",
    surface: "card",
    foreground: "foreground",
    muted: "muted",
    mutedForeground: "muted-foreground",
    primary: "primary",
    primaryForeground: "primary-foreground",
    destructive: "destructive",
    border: "border",
  } as const;

  for (const [token, property] of Object.entries(REACT)) {
    it(`globals.css agrees on ${token}`, () => {
      const declared = propertyOf(reactCss, property);
      expect(declared, `--${property} is not declared`).toBeTruthy();
      const asHex = hslToHex(declared!);
      expect(asHex, `--${property} is "${declared}", which is not an HSL triple`).toBeTruthy();
      expect(
        near(asHex!, tokens.light[token]!),
        `--${property} is ${asHex} (${declared}), design-tokens.json says ${tokens.light[token]}`
      ).toBe(true);
    });
  }

  // The browser runtime writes hex, because nothing composes with its variables.
  const BROWSER = {
    primary: "primary",
    primaryForeground: "primary-on",
  } as const;

  for (const [token, property] of Object.entries(BROWSER)) {
    it(`the browser runtime agrees on ${token}`, () => {
      const declared = propertyOf(browserCss, property);
      expect(declared, `--${property} is not declared`).toBeTruthy();
      expect(
        near(declared!, tokens.light[token]!),
        `--${property} is ${declared}, design-tokens.json says ${tokens.light[token]}`
      ).toBe(true);
    });
  }

  it("both stylesheets use the declared corner radius", () => {
    expect(propertyOf(reactCss, "radius")).toBe(tokens.radius);
    expect(browserCss).toContain(tokens.radius);
  });

  it("both stylesheets name the declared typefaces", () => {
    for (const face of Object.values(tokens.fonts)) {
      expect(reactCss, `globals.css does not name ${face}`).toContain(face);
      expect(browserCss, `the browser runtime does not name ${face}`).toContain(face);
    }
  });
});
