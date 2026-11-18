/**
 * The theme is re-derived from `upstream/who.css`, never compared to itself.
 *
 * @module smart-base/themes/themes.test
 *
 * `who-iris/themes/themes.test.ts` set this bar and the reason is its own:
 * *"does not compare these constants against a copy of themselves … If the
 * capture is ever re-taken and IRIS has re-skinned, the tests fail rather than
 * the theme quietly describing a site that no longer looks like this."*
 *
 * The same risk is sharper here, because `local-template` depends on
 * `who.template.root#current` — upstream can re-skin at any time and the IG
 * picks it up on its next build. `UPSTREAM.template.sha` pins WHICH version
 * this theme describes; these tests assert the vendored bytes still say what
 * the theme claims they say.
 *
 * ## What is NOT tested here, deliberately
 *
 * That the rendered page looks like the IG. A theme is colour and geometry, the
 * top navbar is deliberately not reproduced (owner: *"navbar on LHS not top"*),
 * and a green test here is not a rendered page — which is the whole argument
 * for `bun run cat preview:site` existing.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { WHO_SMART_THEMES, THEME_INSTANCE, UPSTREAM, whoSmartThemeById } from "./themes.js";

/** The vendored stylesheet, read as bytes — the artefact, not a summary of it. */
const WHO_CSS = readFileSync(join(import.meta.dir, UPSTREAM.template.vendored), "utf-8");

/** The value of a CSS custom property declared in `who.css`. */
function customProperty(name: string): string | undefined {
  return new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(WHO_CSS)?.[1]?.trim();
}

describe("the vendored source is the one the theme claims", () => {
  test("whoCssIsWholeFile", () => {
    // 705 lines when vendored. A truncated copy would still satisfy every
    // property assertion below while describing a stylesheet nobody shipped.
    expect(WHO_CSS.split("\n").length).toBeGreaterThan(700);
  });

  test("pinnedShasAreFullCommitIds", () => {
    // A short sha is ambiguous and a branch name is not a pin. `#current` is
    // what the upstream dependency says, and pinning is this file's answer to it.
    for (const [what, sha] of [
      ["ig", UPSTREAM.ig.sha],
      ["template", UPSTREAM.template.sha],
      ["base", UPSTREAM.base.sha],
    ] as const) {
      expect({ [what]: sha }).toEqual({ [what]: expect.stringMatching(/^[0-9a-f]{40}$/) });
    }
  });

  test("licencePermitsVendoring", () => {
    expect(UPSTREAM.template.licence).toBe("CC0-1.0");
  });
});

describe("every palette role is re-read from the stylesheet", () => {
  const theme = whoSmartThemeById("who-smart-ig");

  test("themeResolves", () => {
    expect(theme?.id).toBe("who-smart-ig");
  });

  test("accentIsNavbarBgColor", () => {
    expect(theme?.palette.accent).toBe(customProperty("navbar-bg-color"));
  });

  test("surfaceIsBodyBackground", () => {
    // TWO steps, and the indirection is the point: `body` names a VARIABLE, so
    // the test follows the same path the browser does rather than asserting the
    // literal. A future edit pointing `body` at a different variable fails here.
    expect(WHO_CSS).toMatch(/body\s*\{[^}]*background-color:\s*var\(--toc-box-bg-color\)/);
    expect(theme?.palette.surface).toBe(customProperty("toc-box-bg-color"));
  });

  test("inkIsContainerColour", () => {
    const declared = /\.container\s*\{[^}]*\bcolor:\s*(#[0-9a-fA-F]{3,6})/.exec(WHO_CSS)?.[1];
    expect(declared).toBeDefined();
    // `#000` and `#000000` are the same colour written two ways; the theme
    // stores the long form and the stylesheet declares the short one.
    expect(theme?.palette.ink).toBe(expandHex(declared!));
  });
});

describe("the three values NOT taken stay not-taken", () => {
  // Each of these is the prettier or more frequent candidate. The module docs
  // say why each was refused; these tests make a later "tidy-up" that quietly
  // adopts one fail, which is the same job `RECORDED_CONTRADICTIONS` does in
  // who-iris.

  test("hash333OnlyDropdownText", () => {
    // If a future upstream ever sets #333 on something body-like, this stops
    // being a coincidence of value and the docblock's reasoning needs rewriting.
    const uses = [...WHO_CSS.matchAll(/([^{}]+)\{[^}]*color:\s*#333\b[^}]*\}/g)].map((m) => m[1]!.trim());
    expect(uses.length).toBeGreaterThan(0);
    for (const selector of uses) {
      expect({ selector, isDropdownOnly: selector.includes("dropdown-menu") }).toEqual({
        selector,
        isDropdownOnly: true,
      });
    }
  });

  test("tocBoxBorderNotEdge", () => {
    // Present in the source, deliberately absent from the palette: it is one
    // component's border, and `edge` is documented as the generic rule.
    expect(customProperty("toc-box-border")).toBeDefined();
    expect(WHO_SMART_THEMES.map((t) => t.palette.edge)).not.toContain(customProperty("toc-box-border"));
  });

  test("topNavbarNotReproduced", () => {
    // The owner's carve-out, asserted rather than left as prose: `who.css` is
    // full of `.navbar*` rules and this theme carries none of that layout.
    expect(WHO_CSS).toMatch(/\.navbar/);
    // The CARRIED values, not the whole serialised theme. The first draft
    // asserted over `JSON.stringify(WHO_SMART_THEMES)` and failed on the
    // theme's own DESCRIPTION, which says the navbar is not reproduced — a
    // test that reads its subject's prose as if it were its data. Palette and
    // layouts are where navbar styling would have to land if it were carried.
    for (const t of WHO_SMART_THEMES) {
      expect(JSON.stringify({ palette: t.palette, layouts: t.layouts })).not.toMatch(/navbar/i);
    }
  });
});

describe("geometry is a column width, never a viewport", () => {
  test("laptopTakesDeclaredMaxWidth", () => {
    const capped = /@media\s*\(min-width:\s*2200px\)[^@]*max-width:\s*(\d+px)/.exec(WHO_CSS)?.[1];
    expect(capped).toBe("1980px");
    expect(whoSmartThemeById("who-smart-ig")?.layouts.laptop.minWidth).toBe(capped);
  });

  test("mobileAndCardTakeFluidWidth", () => {
    expect(WHO_CSS).toMatch(/\.container\s*\{[^}]*width:\s*100%/);
    const t = whoSmartThemeById("who-smart-ig");
    expect({ mobile: t?.layouts.mobile.minWidth, card: t?.layouts.card.minWidth }).toEqual({
      mobile: "100%",
      card: "100%",
    });
  });

  test("paddingIsContainerValue", () => {
    expect(WHO_CSS).toMatch(/\.container\s*\{[^}]*padding:\s*0\s+20px/);
    const t = whoSmartThemeById("who-smart-ig");
    for (const layout of ["laptop", "mobile", "card"] as const) {
      expect({ layout, padding: t?.layouts[layout].padding }).toEqual({ layout, padding: "20px" });
    }
  });

  test("fontScaleIsOneEverywhere", () => {
    // A measurement, not a placeholder — see the module docs. If upstream ever
    // adds a responsive body scale, this should be revisited rather than kept.
    expect(WHO_CSS).not.toMatch(/@media[^@]*body\s*\{[^}]*font-size/);
    const t = whoSmartThemeById("who-smart-ig");
    for (const layout of ["laptop", "mobile", "card"] as const) {
      expect({ layout, scale: t?.layouts[layout].fontScale }).toEqual({ layout, scale: 1 });
    }
  });
});

/** `#abc` → `#aabbcc`; a 6-digit value is returned unchanged, lower-cased. */
function expandHex(hex: string): string {
  const body = hex.slice(1).toLowerCase();
  return body.length === 3 ? `#${[...body].map((c) => c + c).join("")}` : `#${body}`;
}

describe("the platform can FIND this theme, not just resolve it", () => {
  // The test that was missing. Every test above imports `./themes.js`
  // directly, so they exercised the theme and never the DISCOVERY — and the
  // first version of this module exported `THEMES` where the platform reads
  // `INSTANCE_THEMES`. `instanceThemes()` returned `no-themes-module` for a
  // module that was present, resolved and fully tested, and nothing said so.
  //
  // A theme nothing can find is the `1xhc` shape: a declaration that looks
  // done and is reached by nobody.

  test("instanceThemesResolvesByName", async () => {
    const { instanceThemes } = await import("../platform/index.js");
    const found = instanceThemes(join(import.meta.dir, "..", ".."), THEME_INSTANCE);
    // The whole result on a miss, not a boolean: `no-themes-directory` and
    // `no-themes-module` are different faults with different fixes, and a bare
    // `expect(found.ok).toBe(true)` would print neither.
    expect(found.ok ? { ok: true } : found).toEqual({ ok: true });
    expect(found.ok && found.themes.map((t) => t.id)).toContain("who-smart-ig");
  });

  test("isInstancesOneWebpageTheme", async () => {
    const { instanceWebpageThemes } = await import("../platform/index.js");
    const owned = instanceWebpageThemes(join(import.meta.dir, "..", ".."));
    expect(owned.filter((o) => o.instance === THEME_INSTANCE).map((o) => o.theme.id)).toEqual(["who-smart-ig"]);
  });
});
