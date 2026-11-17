/**
 * A theme is valid only with all three layouts, and the check must be able to fire.
 *
 * The owner's rule, 2026-09-19: *"themes need all three layouts to be defined
 * to be considered valid."* A validity rule nothing exercises is a comment, so
 * the first thing asserted here is a theme missing one layout being REFUSED —
 * not that a good one passes, which a schema that checked nothing would also do.
 */
import { describe, expect, test } from "bun:test";

import {
  hexHue,
  THEME_LAYOUTS,
  THEME_SCHEMA_TAG,
  ThemeSchema,
  missingLayouts,
  resolveThemeBackdrop,
  themeCssVars,
  ResolvedThemeSchema,
} from "./theme.js";
import { themeById } from "./themes.js";

const GEOM = { minWidth: "17rem", padding: "0.7em 0.8em", fontScale: 1 };

function theme(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    $schema: THEME_SCHEMA_TAG,
    id: "pale-sage",
    // Stated, not defaulted. `ThemeSchema` defaults `kind` for an author's
    // convenience; the RESOLVED form never does, because `resolveTheme` always
    // sets it and a resolved theme that has not said which surface it dresses
    // is incomplete rather than sticky-by-luck.
    kind: "sticky",
    name: "Pale sage",
    palette: {
      surface: "#e8eee6",
      ink: "#1d221c",
      edge: "#c2cdbd",
      accent: "#7d9a72",
    },
    layouts: { laptop: GEOM, mobile: GEOM, card: GEOM },
    ...over,
  };
}

describe("all three layouts, or invalid", () => {
  test("a complete theme parses, in both forms", () => {
    expect(ThemeSchema.safeParse(theme()).success).toBe(true);
    expect(ResolvedThemeSchema.safeParse(theme()).success).toBe(true);
  });

  test.each([...THEME_LAYOUTS])("a theme missing `%s` is REFUSED, not degraded", (layout) => {
    // The assertion that matters. There is deliberately no fallback to another
    // layout's geometry: a theme that renders wrong on a phone SHIPS, while one
    // that refuses to load is noticed.
    //
    // Checked on the RESOLVED form since themes gained inheritance (bean
    // `j66n`). The invariant did not weaken; it moved one step later, which is
    // where it has to live once a theme may state one layout and inherit two.
    // `data-modelling` step 7 names this exact trap: "checking requiredness on
    // the declaration instead is how inheritance turns into optionality by
    // accident."
    const layouts: Record<string, unknown> = { laptop: GEOM, mobile: GEOM, card: GEOM };
    delete layouts[layout];
    expect(ResolvedThemeSchema.safeParse(theme({ layouts })).success).toBe(false);
  });

  test("and the DECLARED form accepts it, which is the point of inheriting", () => {
    // The other half, asserted so the pair cannot silently become one. A theme
    // that states `laptop` and inherits the rest is a legal declaration and an
    // illegal render target, and both facts have to be checkable.
    const layouts = { laptop: GEOM };
    expect(ThemeSchema.safeParse(theme({ layouts })).success).toBe(true);
    expect(ResolvedThemeSchema.safeParse(theme({ layouts })).success).toBe(false);
  });

  test("the refusal can say WHICH layout is missing", () => {
    // A gate whose message is "invalid" teaches nobody what to fix.
    expect(missingLayouts(theme({ layouts: { laptop: GEOM, card: GEOM } }))).toEqual(["mobile"]);
    expect(missingLayouts({})).toEqual([...THEME_LAYOUTS]);
    expect(missingLayouts(null)).toEqual([...THEME_LAYOUTS]);
  });

  test("a complete theme names none", () => {
    expect(missingLayouts(theme())).toEqual([]);
  });
});

describe("the palette is roles, and a gradient needs both stops", () => {
  test("one gradient stop is refused", () => {
    // A gradient with one stop is a flat fill claiming to be a gradient — it
    // renders, which is exactly why nothing would catch it later.
    const one = theme({
      palette: { surface: "#fff", ink: "#000", edge: "#ccc", accent: "#7d9a72", gradientFrom: "#fff" },
    });
    // On the RESOLVED form, for the same reason the layout rule moved there:
    // the pair is a fact about a COMPLETE palette, and a child that overrides
    // `gradientFrom` while inheriting `gradientTo` is a legal declaration whose
    // resolution is still whole. Refusing it at declaration time would make
    // inheriting one stop impossible, which is a rule about authoring dressed
    // up as a rule about rendering.
    expect(ResolvedThemeSchema.safeParse(one).success).toBe(false);
  });

  test("...and the declared form permits it, because the other stop may be inherited", () => {
    const one = theme({
      palette: { surface: "#fff", ink: "#000", edge: "#ccc", accent: "#7d9a72", gradientFrom: "#fff" },
    });
    expect(ThemeSchema.safeParse(one).success).toBe(true);
  });

  test("both stops, or neither, are fine", () => {
    const both = theme({
      palette: {
        surface: "#fff", ink: "#000", edge: "#ccc", accent: "#7d9a72",
        gradientFrom: "#fff", gradientTo: "#e8eee6",
      },
    });
    expect(ThemeSchema.safeParse(both).success).toBe(true);
    expect(ThemeSchema.safeParse(theme()).success).toBe(true);
  });

  test("an unknown palette key is refused rather than ignored", () => {
    // `.strict()`. A typo'd role that parses is a role that silently never
    // reaches the CSS — the same class of defect as an undeclared @context term
    // being dropped.
    const typo = theme({
      palette: { surface: "#fff", ink: "#000", edge: "#ccc", accent: "#7d9a72", surfase: "#fff" },
    });
    expect(ThemeSchema.safeParse(typo).success).toBe(false);
  });
});

describe("ids and names", () => {
  test("an id is lowercase kebab-case, because the CSS class is built from it", () => {
    expect(ThemeSchema.safeParse(theme({ id: "Pale Sage" })).success).toBe(false);
    expect(ThemeSchema.safeParse(theme({ id: "dusty-carolina-blue" })).success).toBe(true);
  });

  test("a theme must declare its $schema tag", () => {
    expect(ThemeSchema.safeParse(theme({ $schema: undefined })).success).toBe(false);
  });
});

describe("the CSS a theme contributes is roles, not colour names", () => {
  test("every emitted property is an `--fa-sticky-*` role", () => {
    const css = themeCssVars(ResolvedThemeSchema.parse(theme()));
    for (const line of css.split("\n")) {
      expect(line.trim().startsWith("--fa-sticky-")).toBe(true);
    }
  });

  test("a theme without a gradient emits no gradient properties", () => {
    // Otherwise a consumer gets `--fa-sticky-grad-from: undefined`, which CSS
    // silently ignores — a value that looks set and is not.
    expect(themeCssVars(ResolvedThemeSchema.parse(theme()))).not.toContain("grad-from");
  });

  test("a gradated theme emits both stops", () => {
    const g = ResolvedThemeSchema.parse(theme({
      palette: {
        surface: "#fff", ink: "#000", edge: "#ccc", accent: "#7d9a72",
        gradientFrom: "#fff", gradientTo: "#e8eee6",
      },
    }));
    expect(themeCssVars(g)).toContain("--fa-sticky-grad-from: #fff;");
    expect(themeCssVars(g)).toContain("--fa-sticky-grad-to: #e8eee6;");
  });
});

// ── The backdrop ─────────────────────────────────────────────────────

/**
 * WCAG 2.x relative luminance, from sRGB 0-255 channels.
 *
 * Written out rather than imported so this file's contrast claim depends on the
 * published formula and not on another module of ours agreeing with it. A test
 * that borrows the thing it is checking proves the two are consistent, which is
 * not the question.
 */
function luminance([r, g, b]: readonly [number, number, number]): number {
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** `#rrggbb` → channels. */
function hex(h: string): [number, number, number] {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `rgba(r, g, b, a)` → channels plus alpha. */
function rgba(s: string): { rgb: [number, number, number]; alpha: number } {
  const m = s.match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) throw new Error(`not an rgba() colour: ${s}`);
  return {
    rgb: [Number(m[1]), Number(m[2]), Number(m[3])],
    alpha: m[4] === undefined ? 1 : Number(m[4]),
  };
}

/** A scrim of `alpha` over `under`, composited. */
function over(
  scrim: readonly [number, number, number],
  alpha: number,
  under: readonly [number, number, number],
): [number, number, number] {
  return [0, 1, 2].map((i) => scrim[i]! * alpha + under[i]! * (1 - alpha)) as [
    number,
    number,
    number,
  ];
}

const BACKDROP = { imageRole: "landing", scrim: "rgba(237, 234, 228, 0.86)" };

describe("a backdrop names a ROLE, never a path", () => {
  test("a theme may carry one, and it parses", () => {
    const t = ResolvedThemeSchema.parse(theme({ backdrop: BACKDROP }));
    expect(t.backdrop?.imageRole).toBe("landing");
  });

  test("a theme without one is ordinary, not invalid", () => {
    // The common case. Most themes are a palette, and `backdrop` being absent
    // must not read as an omission.
    expect(ResolvedThemeSchema.parse(theme()).backdrop).toBeUndefined();
  });

  test("a `src` on a backdrop is REFUSED", () => {
    // The whole point of the field. A literal path in platform code is a
    // guaranteed 404 in every downstream folio that did not copy the art, which
    // is what `landing.html` means by "a downstream folio should not inherit a
    // grumpy cat it did not choose". `.strict()` is what makes the mistake
    // unwritable rather than merely discouraged.
    expect(() =>
      ResolvedThemeSchema.parse(theme({ backdrop: { ...BACKDROP, src: "docs/assets/img/x.webp" } })),
    ).toThrow();
  });

  test("a backdrop without a scrim is REFUSED", () => {
    // Required because ink over a photograph has no computable contrast. This
    // is the check that stops "we will add a scrim later".
    expect(() => ResolvedThemeSchema.parse(theme({ backdrop: { imageRole: "landing" } }))).toThrow();
  });
});

describe("the scrim is what makes ink over art legible, and the number is measured", () => {
  test("grumpy-cat's ink clears AAA over its scrim on the DARKEST possible art", () => {
    // Worst case, not typical case: the art is whatever a layer declares,
    // so the only safe assumption is pure black underneath. If it holds there it
    // holds for every image.
    // The SHIPPED theme's own ink and scrim, read from `themes.ts` — not
    // colours restated here, which would keep passing after the theme moved.
    const shipped = themeById("grumpy-cat");
    expect(shipped?.backdrop?.scrim).toBeDefined();
    const { rgb, alpha } = rgba(shipped!.backdrop!.scrim);
    const ground = over(rgb, alpha, [0, 0, 0]);
    const ratio = contrast(hex(shipped!.palette.ink), ground);
    expect(ratio).toBeGreaterThanOrEqual(7); // WCAG AAA, normal text
  });

  test("...and on the LIGHTEST, since a scrim cuts both ways", () => {
    // Pure white art is the other extreme. A dark ink only gains contrast
    // against it, so this is the cheap half — but asserting only the dark case
    // would leave a light-ink theme's failure undetected by the same test.
    const { rgb, alpha } = rgba(BACKDROP.scrim);
    const ground = over(rgb, alpha, [255, 255, 255]);
    expect(contrast(hex("#221f1b"), ground)).toBeGreaterThanOrEqual(7);
  });

  test("the check CAN fire — a thin scrim fails it", () => {
    // Without this, the two assertions above pass for a scrim of any strength
    // and prove nothing about the 0.86.
    const ground = over([237, 234, 228], 0.15, [0, 0, 0]);
    expect(contrast(hex("#221f1b"), ground)).toBeLessThan(7);
  });

  test("a theme with a backdrop emits the scrim as a role, and one without emits none", () => {
    const withArt = ResolvedThemeSchema.parse(theme({ backdrop: BACKDROP }));
    expect(themeCssVars(withArt)).toContain("--fa-sticky-scrim:");
    expect(themeCssVars(ResolvedThemeSchema.parse(theme()))).not.toContain("--fa-sticky-scrim");
  });
});

describe("resolution against an instance's images — three outcomes, not two", () => {
  const art = (layout: string): { role: string; layout: string; src: string } => ({
    role: "landing",
    layout,
    src: `/assets/img/harness/landing-${layout}.webp`,
  });
  const complete = THEME_LAYOUTS.map((l) => art(l));

  test("all three declared resolves to all three", () => {
    const t = ResolvedThemeSchema.parse(theme({ backdrop: BACKDROP }));
    const r = resolveThemeBackdrop(t, complete);
    expect(r.none).toBe(false);
    expect(r.missing).toEqual([]);
    expect([...r.art.keys()].sort()).toEqual([...THEME_LAYOUTS].sort());
  });

  test("no backdrop is `none`, and NOT a gap", () => {
    // The distinction that must not collapse: a palette-only theme is a choice,
    // an unresolvable one is a declaration bug in the layer. Same conflation
    // `note-anchor.ts` exists to undo for `targetLabel`.
    const r = resolveThemeBackdrop(ResolvedThemeSchema.parse(theme()), complete);
    expect(r.none).toBe(true);
    expect(r.missing).toEqual([]);
  });

  test.each([...THEME_LAYOUTS])("a missing `%s` refuses the WHOLE backdrop", (layout) => {
    // Partial is worse than absent: a phone handed the laptop crop shows the
    // art's quiet area in the wrong place and nothing reports it.
    const t = ResolvedThemeSchema.parse(theme({ backdrop: BACKDROP }));
    const r = resolveThemeBackdrop(t, complete.filter((i) => i.layout !== layout));
    expect(r.missing).toEqual([layout]);
    expect(r.art.size).toBe(0);
    expect(r.none).toBe(false);
  });

  test("an instance declaring NO images at all reports all three missing", () => {
    const t = ResolvedThemeSchema.parse(theme({ backdrop: BACKDROP }));
    const r = resolveThemeBackdrop(t, undefined);
    expect(r.missing).toEqual([...THEME_LAYOUTS]);
    expect(r.none).toBe(false);
  });

  test("images of ANOTHER role are ignored", () => {
    // `harness.json` declares `mark` and `browser-icon` beside `landing`. A
    // resolver that took any image with a layout would hand the sticky a
    // favicon.
    const t = ResolvedThemeSchema.parse(theme({ backdrop: BACKDROP }));
    const r = resolveThemeBackdrop(t, [
      ...complete,
      { role: "mark", layout: "laptop", src: "/assets/img/icons/cat-mark.svg" },
    ]);
    expect(r.art.get("laptop")?.src).toContain("landing-laptop");
  });

  test("an image of the right role but NO layout is ignored", () => {
    // `imagesForRole` encodes the same filter, and for the same reason: a
    // layout-less entry cannot answer "which crop for this viewport".
    const t = ResolvedThemeSchema.parse(theme({ backdrop: BACKDROP }));
    const r = resolveThemeBackdrop(t, [{ role: "landing", src: "/assets/img/harness/x.webp" }]);
    expect(r.missing).toEqual([...THEME_LAYOUTS]);
  });
});

describe("hexHue — a palette colour as a tile tone (bean v8n5)", () => {
  test("the primaries and secondaries land on their angles", () => {
    expect(hexHue("#ff0000")).toBe(0);
    expect(hexHue("#ffff00")).toBe(60);
    expect(hexHue("#00ff00")).toBe(120);
    expect(hexHue("#00ffff")).toBe(180);
    expect(hexHue("#0000ff")).toBe(240);
    expect(hexHue("#ff00ff")).toBe(300);
  });

  test("a hue just below red wraps to the high end rather than going negative", () => {
    expect(hexHue("#ff0010")).toBe(356);
  });

  test("short form, case and whitespace", () => {
    expect(hexHue("#F00")).toBe(0);
    expect(hexHue(" #00F ")).toBe(240);
  });

  test("a grey has no hue, and that is not red", () => {
    expect(hexHue("#ffffff")).toBeUndefined();
    expect(hexHue("#212121")).toBeUndefined();
  });

  test("a value that is not a hex colour is not guessed at", () => {
    expect(hexHue("rgb(0,0,255)")).toBeUndefined();
    expect(hexHue("#12345")).toBeUndefined();
    expect(hexHue("blue")).toBeUndefined();
  });

  test("a mid-range blue computes to the expected angle (#008dc9 → 198°)", () => {
    // 0/141/201: max is blue, (r-g)/d = -141/201, + 4 → 3.2985 × 60 = 197.9.
    expect(hexHue("#008dc9")).toBe(198);
  });
});
