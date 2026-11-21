/**
 * The shipped themes satisfy what was asked for, and the accessibility ones
 * actually are accessible.
 *
 * Parsing proves a theme is well-formed. It does not prove the palette is
 * legible, so the contrast ratios are computed here rather than asserted in a
 * comment — a high-contrast theme whose contrast nobody measured is a claim.
 */
import { describe, expect, test } from "bun:test";

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { readDeclaration } from "../kg/cat-harness.js";
import {
  THEME_LAYOUTS,
  ResolvedThemeSchema,
  ThemeSchema,
  resolveThemeBackdrop,
} from "./theme.js";
import {
  DEFAULT_THEME_ID,
  GRADATED_THEME_IDS,
  HIGH_CONTRAST_THEME_IDS,
  THEMES,
  themeById,
} from "./themes.js";

import { requireHarnessRoot } from "../harness-root.ts";
/** WCAG relative luminance. */
function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("the corpus is what was asked for", () => {
  test("there are themes to check — otherwise this proves nothing", () => {
    expect(THEMES.length).toBeGreaterThan(4);
  });

  test("every shipped theme parses and defines all three layouts", () => {
    for (const t of THEMES) {
      expect({ id: t.id, ok: ThemeSchema.safeParse(t).success }).toEqual({ id: t.id, ok: true });
      for (const l of THEME_LAYOUTS) expect(`${t.id}:${l}`).toBe(`${t.id}:${l in t.layouts ? l : "MISSING"}`);
    }
  });

  test("ids are unique — the CSS class is built from the id", () => {
    const ids = THEMES.map((t) => t.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  test("the asked-for families are all present", () => {
    const ids = THEMES.map((t) => t.id);
    expect(ids.some((i) => i.startsWith("pale-sage"))).toBe(true);
    expect(ids.some((i) => i.startsWith("dusty-carolina"))).toBe(true);
    expect(ids).toContain("grumpy-cat");
    expect([...HIGH_CONTRAST_THEME_IDS].every((i) => ids.includes(i))).toBe(true);
  });

  test("a couple of fading gradations exist", () => {
    expect(GRADATED_THEME_IDS.length).toBeGreaterThanOrEqual(2);
  });
});

describe("the default", () => {
  test("it resolves, and it is a pale sage", () => {
    expect(themeById(DEFAULT_THEME_ID)?.id).toBe(DEFAULT_THEME_ID);
    expect(DEFAULT_THEME_ID.startsWith("pale-sage")).toBe(true);
  });

  // NOT asserted: that it MATCHES the staging bar. The sticky and the banner
  // appear together on exactly one surface — the deployed staging site — so a
  // checkout cannot check it, and a test claiming to would be asserting a
  // number nobody measured against the thing it is supposed to match.
  //
  // It WAS checked, on the staging preview for PR #405, and confirmed by the
  // owner 2026-09-19. That is a human judgement with a date, recorded here so
  // the next reader knows it happened — not a gap, and not something to
  // "fix" by adding an assertion that cannot see the banner.
});

describe("the high-contrast pair really is high contrast", () => {
  test.each([...HIGH_CONTRAST_THEME_IDS])("%s clears WCAG AAA body text (7:1)", (id) => {
    const t = themeById(id)!;
    expect(contrast(t.palette.ink, t.palette.surface)).toBeGreaterThanOrEqual(7);
  });

  test("they carry NO gradient, and that is deliberate", () => {
    // A gradated surface has a RANGE of ratios against its ink, so the worst
    // point governs — and the point of a high-contrast theme is that there is
    // no worst point to go looking for.
    for (const id of HIGH_CONTRAST_THEME_IDS) {
      expect({ id, grad: themeById(id)!.palette.gradientFrom }).toEqual({ id, grad: undefined });
    }
  });
});

describe("a sticky's inline-code chip is legible in every theme", () => {
  // `.fa-landing-sticky__text code` paints the chip with the CARD's palette —
  // `--fa-sticky-surface` behind `--fa-sticky-ink` — after the site-wide chip
  // (light text on `#0d1117`) had its foreground overridden by the sticky ink
  // and went to **1.23:1**, invisible, on the published landing page.
  //
  // The first fix used `--fa-sticky-edge` as the background. Nine themes came
  // back 9.33-10.14:1 and it looked done; the two high-contrast themes have
  // **ink == edge**, so they were 1.00:1 — the same defect, moved. Hence this
  // pair and this test.
  test.each(THEMES.map((t) => t.id))("%s clears AAA (7:1) for ink on surface", (id) => {
    const t = themeById(id)!;
    expect(contrast(t.palette.ink, t.palette.surface)).toBeGreaterThanOrEqual(7);
  });

  test("`edge` is NOT a safe chip background, which is why the rule does not use it", () => {
    // Guards the simplification, not the palette: if somebody rewrites the CSS
    // to `background: var(--fa-sticky-edge)` because it looks tidier, this says
    // why that is wrong — at least one shipped theme cannot survive it.
    const worst = Math.min(...THEMES.map((t) => contrast(t.palette.ink, t.palette.edge)));
    expect(worst).toBeLessThan(4.5);
  });
});

describe("every theme is readable, not just the ones that advertise it", () => {
  test.each(THEMES.map((t) => t.id))("%s clears WCAG AA body text (4.5:1)", (id) => {
    // The decorative themes are the ones where this slips: a pale surface and a
    // mid-tone ink look fine to whoever picked them and fail for everyone else.
    const t = themeById(id)!;
    expect(contrast(t.palette.ink, t.palette.surface)).toBeGreaterThanOrEqual(4.5);
  });

  test.each(THEMES.filter((t) => t.palette.gradientFrom).map((t) => t.id))(
    "%s clears AA at BOTH gradient stops, not just the surface",
    (id) => {
      // The failure a flat check misses entirely: a gradient is legible at the
      // top of the card and not at the bottom.
      const t = themeById(id)!;
      expect(contrast(t.palette.ink, t.palette.gradientFrom!)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.palette.ink, t.palette.gradientTo!)).toBeGreaterThanOrEqual(4.5);
    },
  );
});

// ── A shipped backdrop must actually resolve against this layer ──

describe("every shipped backdrop resolves against THIS instance's declaration", () => {
  // The join no other test covers. A theme parses with `imageRole: "anything"`
  // — the schema validates the field's SHAPE, because whether art exists is a
  // question about the layer, not about the theme. So a theme naming a role
  // this repository does not declare is well-formed, ships, and renders
  // palette-only with nothing reporting why.
  //
  // This is also the guard that keeps an INCOMPLETE set out. Measured
  // 2026-09-20: the architecture art arrived as two layouts of three (the third
  // upload was a byte-identical copy of the second), so the `architecture`
  // theme shipped palette-only until the owner supplied the portrait crop on
  // 2026-09-24. Adding a backdrop before that failed here, which is the point:
  // a theme must never serve a landscape crop to a phone.
  const decl = readDeclaration(requireHarnessRoot());
  const themed = THEMES.filter((t) => t.backdrop !== undefined);

  test("there are backdrops to check — otherwise this proves nothing", () => {
    expect(themed.length).toBeGreaterThan(0);
  });

  test.each(themed.map((t) => [t.id] as const))("`%s` resolves all three layouts", (id) => {
    const theme = themeById(id)!;
    const r = resolveThemeBackdrop(theme, decl?.images);
    expect({ id, missing: r.missing, none: r.none }).toEqual({ id, missing: [], none: false });
    expect([...r.art.keys()].sort()).toEqual([...THEME_LAYOUTS].sort());
  });

  test.each(themed.map((t) => [t.id] as const))("`%s`'s art exists on disk", (id) => {
    // A declared src that is not there is the `dh4f` shape: a consumer resolves
    // it, reports success, and serves a 404.
    const theme = themeById(id)!;
    for (const img of resolveThemeBackdrop(theme, decl?.images).art.values()) {
      expect({ id, src: img.src, exists: existsSync(resolve(requireHarnessRoot(), img.src)) })
        .toEqual({ id, src: img.src, exists: true });
    }
  });

  test("the check CAN fire — a role nothing declares is reported missing", () => {
    // RESOLVED, not declared: `resolveThemeBackdrop` consumes a complete
    // theme, and the declared form went lax when themes gained inheritance.
    // Parsing the resolved schema here is what keeps this test about the
    // BACKDROP rather than about which form it was handed.
    const bogus = ResolvedThemeSchema.parse({
      ...themed[0]!,
      id: "not-shipped",
      backdrop: { imageRole: "no-such-role", scrim: "rgba(0,0,0,0.5)" },
    });
    const r = resolveThemeBackdrop(bogus, decl?.images);
    expect(r.missing).toEqual([...THEME_LAYOUTS]);
    expect(r.none).toBe(false);
  });

  test("the high-contrast pair declares NO backdrop, deliberately", () => {
    // Art behind ink is the thing those two exist to remove, and a scrim strong
    // enough to make a photograph safe at their ratios would hide it anyway.
    for (const id of HIGH_CONTRAST_THEME_IDS) {
      expect({ id, backdrop: themeById(id)?.backdrop }).toEqual({ id, backdrop: undefined });
    }
  });
});

describe("every surface is OPAQUE — the pin gesture depends on it", () => {
  /**
   * Bean `ivfw`. `.fa-sticky-floating` used to set a flat `background` and
   * `color` unconditionally, because a sticky lifted onto the page sits over
   * content and must not be see-through. It sits after `.fa-sticky` at equal
   * specificity, so it won — and a themed sticky came back from the float
   * layer as a slab of `#27262b`. The theme is a property of the sticky; the
   * pin button was silently changing what the note is.
   *
   * The fix scopes that override to `:not([data-fa-sticky-theme])`, which is
   * only sound while every theme's own surface is opaque. That is true of all
   * of them today and it is NOT a property the schema enforces —
   * `ThemePaletteSchema.surface` is `z.string()`, so `rgba(…, 0.4)` parses.
   *
   * So the CSS fix has a premise, and this is it. Without this test a theme
   * added with a translucent surface reintroduces the bug on a page nobody
   * re-checks, and the symptom (text over page content) looks nothing like
   * the cause (one colour value in a different file).
   */
  const OPAQUE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

  test("no theme's surface can be seen through", () => {
    const translucent = THEMES.filter((t) => !OPAQUE.test(t.palette.surface)).map(
      (t) => `${t.id}: ${t.palette.surface}`,
    );
    expect(translucent).toEqual([]);
    expect(THEMES.length).toBeGreaterThan(0); // not vacuous
  });

  test("the check CAN fire — an rgba() surface is caught", () => {
    // Every assertion above passes equally for a regex that matches anything.
    expect(OPAQUE.test("rgba(128, 128, 128, 0.08)")).toBe(false);
    expect(OPAQUE.test("#e9efe6")).toBe(true);
  });

  test("a gradated theme's stops are opaque too", () => {
    // `.fa-sticky` paints `--fa-sticky-grad-from` as the background and layers
    // a gradient over it, so a translucent stop is see-through by the same
    // route as a translucent surface — one field further along.
    const bad = THEMES.flatMap((t) =>
      [t.palette.gradientFrom, t.palette.gradientTo]
        .filter((v): v is string => v !== undefined)
        .filter((v) => !OPAQUE.test(v))
        .map((v) => `${t.id}: ${v}`),
    );
    expect(bad).toEqual([]);
  });
});
