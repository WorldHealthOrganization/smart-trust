/**
 * Landing backdrops: one logical image is several files, and a renderer must
 * be able to tell which one it got.
 *
 * @module schemas/kg-node.test
 */
import { describe, expect, test } from "bun:test";

import {
  ImageRegionSchema,
  KgImageSchema,
  imagesForRole,
  pickLayout,
  displayTitle,
  type KgImage,
} from "./kg-node";

import { requireHarnessRoot } from "../harness-root.ts";
describe("displayTitle", () => {
  test("title, else name, else id — never blank for a node with an id", () => {
    // A blank label in a sidebar reads as a renderer bug, not a missing field.
    expect(displayTitle({ id: "x", name: "n", title: "t" })).toBe("t");
    expect(displayTitle({ id: "x", name: "n" })).toBe("n");
    expect(displayTitle({ id: "x" })).toBe("x");
  });
});

describe("landing backdrops — layout variants", () => {
  const laptop: KgImage = {
    id: "landing-laptop", src: "a.webp", role: "landing", layout: "laptop",
    width: 1671, height: 941, textRegion: { x: 0.205, y: 0.285, w: 0.625, h: 0.235 },
  };
  const mobile: KgImage = { id: "landing-mobile", src: "b.webp", role: "landing", layout: "mobile" };
  const mark: KgImage = { id: "mark", src: "m.svg", role: "mark" };

  test("variants are grouped by role and keyed by layout", () => {
    const m = imagesForRole([laptop, mobile, mark], "landing");
    expect([...m.keys()].sort()).toEqual(["laptop", "mobile"]);
  });

  test("a layout-independent image is not a variant of anything", () => {
    // An SVG mark is the same file everywhere and must not be handed back as
    // though it were cut for a viewport.
    expect(imagesForRole([mark], "mark").size).toBe(0);
  });

  test("an exact layout match reports NO substitution", () => {
    const p = pickLayout([laptop, mobile], "landing", "mobile");
    expect(p.image?.id).toBe("landing-mobile");
    expect(p.substituted).toBeUndefined();
  });

  test("a missing layout falls back AND says which it used", () => {
    // A phone served the laptop crop is a real degradation: that crop's text
    // region is wrong for it, so the overlay lands somewhere nobody chose. A
    // renderer that cannot tell it happened will ship that.
    const p = pickLayout([laptop], "landing", "mobile");
    expect(p.image?.id).toBe("landing-laptop");
    expect(p.substituted).toBe("laptop");
  });

  test("no variant at all is a THIRD state, not a substitution", () => {
    const p = pickLayout([mark], "landing", "laptop");
    expect(p.image).toBeUndefined();
    expect(p.substituted).toBeUndefined();
  });

  test("a region running off the edge is rejected, not clamped", () => {
    // Clamping silently moves the text somewhere nobody chose — the exact
    // failure this field exists to prevent.
    expect(() => ImageRegionSchema.parse({ x: 0.8, y: 0.1, w: 0.5, h: 0.2 })).toThrow();
    expect(() => ImageRegionSchema.parse({ x: 0.1, y: 0.9, w: 0.2, h: 0.5 })).toThrow();
    expect(ImageRegionSchema.parse({ x: 0.205, y: 0.285, w: 0.625, h: 0.235 })).toBeTruthy();
  });

  test("a zero-width region is rejected", () => {
    expect(() => ImageRegionSchema.parse({ x: 0, y: 0, w: 0, h: 0.2 })).toThrow();
  });

  test("the declared laptop variant parses with its region", () => {
    expect(KgImageSchema.parse(laptop)).toBeTruthy();
  });
});

describe("this instance's own declaration", () => {
  test("all three layouts are declared, each with its own region", async () => {
    // One region per layout is the point: the same cloud sits differently in a
    // portrait crop, and the square crop is pushed right by the cat. Sharing
    // one set of numbers puts the words on the cat at two of the three.
    const { readDeclaration } = await import("./cat-harness");
    const decl = readDeclaration(requireHarnessRoot());
    const variants = imagesForRole(decl?.images, "landing");
    expect([...variants.keys()].sort()).toEqual(["card", "laptop", "mobile"]);
    const regions = [...variants.values()].map((v) => JSON.stringify(v.textRegion));
    expect(new Set(regions).size).toBe(3);
    for (const v of variants.values()) {
      expect(v.width).toBeGreaterThan(0);
      expect(v.height).toBeGreaterThan(0);
      expect(v.textRegion).toBeDefined();
    }
  });

  test("the laptop backdrop is declared, with its measured text region pinned", async () => {
    // Guards the numbers that were found by rendering candidates and looking
    // at them — a later re-crop of the image must not silently keep a region
    // measured against the old one.
    const { readDeclaration } = await import("./cat-harness");
    const decl = readDeclaration(requireHarnessRoot());
    const p = pickLayout(decl?.images, "landing", "laptop");
    expect(p.image?.src).toContain("landing-laptop");
    // Moved right and up when the lead line grew to two wrapped lines: the
    // taller block no longer cleared the cat's ear at x = 0.205, and the cloud
    // is deeper further right. Pinned so a later re-crop cannot silently keep
    // a region measured against the old image.
    expect(p.image?.textRegion).toEqual({ x: 0.33, y: 0.25, w: 0.53, h: 0.28 });
  });
});

describe("the description survives Jekyll's markdown renderer", () => {
  // Verified against kramdown 2.5.2 directly, not reasoned about: Jekyll
  // renders `description` through `markdownify`, and its default is
  // `hard_wrap: false`. What that means for this string was measured.
  //
  //   blank-line separated  -> 5 <p> elements          (what is committed)
  //   single-newline        -> 1 <p> with soft breaks  (renders as one line)
  //
  // The second is what this description WAS, so the derivation ladder would
  // have shipped as a single run-on line. These two assertions are the input
  // invariants that keep the first outcome; kramdown itself cannot run here.

  const description = async (): Promise<string> => {
    const { readDeclaration } = await import("./cat-harness");
    return readDeclaration(requireHarnessRoot())?.description ?? "";
  };

  test("blocks are separated by BLANK lines, not single newlines", async () => {
    const d = await description();
    expect(d).toContain("\n\n");
    // No single newline may survive outside a blank-line pair, or the blocks
    // either side of it silently merge into one paragraph.
    expect(/[^\n]\n[^\n]/.test(d)).toBe(false);
  });

  test("the last rung's leading character is U+00A0, not a space", async () => {
    // Measured: kramdown STRIPS a leading plain space (`<p>c@t-harness</p>`)
    // and preserves U+00A0 (`<p>\u00a0c@t-harness</p>`). That character is
    // load-bearing — it lines `c@t` up under `c&at` so the ladder reads as a
    // derivation — so a plain space here is a silent misalignment.
    const d = await description();
    const blocks = d.split(/\n{2,}/);
    const rung = blocks[blocks.length - 1];
    expect(rung).toContain("c@t-harness");
    expect(rung!.startsWith("\u00a0")).toBe(true);
  });

  test("the lead block comes first, since typography is by position", async () => {
    const d = await description();
    const blocks = d.split(/\n{2,}/);
    expect(blocks[0]).toContain("computable adjudication");
    expect(blocks).toHaveLength(5);
  });
});
