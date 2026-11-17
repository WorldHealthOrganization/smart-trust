/**
 * `avatarRegion` — declared per image, square in pixels, and checkable.
 *
 * Bean `603s`, first slice. The navbar avatar is a theme's card art CLIPPED to
 * the cat, not the card scaled down, and the cat sits somewhere different in
 * every composition — so the box is authored data beside `textRegion` rather
 * than a literal in a stylesheet.
 *
 * Two of the first seven boxes landed on scenery rather than on the cat, and
 * only a render caught it. Nothing here can catch that; what it CAN catch is
 * the failure that is invisible in a render too — a box that is not square,
 * which stretches the subject by `w/h` rather than framing the wrong thing.
 *
 * @module schemas/avatar-region.test
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  AVATAR_SQUARENESS_TOLERANCE_PX,
  KgImageSchema,
  type KgImage,
} from "./kg/kg-node.js";
// `folio` is registered by a load-time side effect in core. `bunfig.toml`
// preloads it for every test file on purpose — five files carried the same
// latent order-dependence and the suite was green locally and red in CI on one
// commit — so importing it here too would be a second answer to a question
// already answered in one place.
import { readDeclaration } from "./kg/cat-harness.js";

import { requireHarnessRoot } from "./harness-root.ts";
const ROOT = requireHarnessRoot();

/** A square 1254px card, so each case below differs in exactly one field. */
const card = (over: Partial<KgImage> = {}): Record<string, unknown> => ({
  id: "x",
  src: "a.webp",
  width: 1254,
  height: 1254,
  ...over,
});

describe("this repository's seven measured boxes", () => {
  const images = (readDeclaration(ROOT)?.images ?? []).filter((i) => i.avatarRegion !== undefined);

  test("every card crop carries one — the set is complete, not partial", () => {
    // A partial set is the state worth failing on: the navbar renders six
    // themed avatars and one grey square, which reads as a broken image
    // rather than as an undeclared box.
    const cards = (readDeclaration(ROOT)?.images ?? []).filter((i) => i.layout === "card");
    expect(cards.length).toBeGreaterThan(0); // not vacuous
    expect(cards.filter((i) => i.avatarRegion === undefined).map((i) => i.id)).toEqual([]);
  });

  test("only CARD crops carry one", () => {
    // The avatar is cut from the square crop. A box on the laptop or mobile
    // art would be measured against a composition the frame never shows, and
    // it would validate — squareness is checkable, relevance is not.
    expect(images.filter((i) => i.layout !== "card").map((i) => i.id)).toEqual([]);
  });

  test("each one validates, which is squareness and bounds together", () => {
    for (const img of images) {
      const r = KgImageSchema.safeParse(img);
      expect(r.success ? [] : r.error.issues.map((i) => `${img.id}: ${i.message}`)).toEqual([]);
    }
  });

  test("each names a file that exists", () => {
    // A box measured against art that is not there is a box measured against
    // nothing, and it validates perfectly.
    for (const img of images) expect(existsSync(join(ROOT, img.src))).toBe(true);
  });

  test("no box is the whole frame", () => {
    // `{0,0,1,1}` is square, in bounds, and means "the avatar was never
    // measured" — which is exactly the four-pixel-cat case this field exists
    // to prevent, arrived at through a declaration rather than through its
    // absence.
    for (const img of images) {
      expect({ id: img.id, whole: img.avatarRegion!.w >= 1 && img.avatarRegion!.h >= 1 }).toEqual({
        id: img.id,
        whole: false,
      });
    }
  });
});

describe("a box that is not square is refused", () => {
  test("wider than tall", () => {
    const r = KgImageSchema.safeParse(card({ avatarRegion: { x: 0, y: 0, w: 0.5, h: 0.25 } }));
    expect(r.success).toBe(false);
    expect(r.success ? "" : r.error.issues[0]!.message).toContain("not square");
  });

  test("taller than wide", () => {
    expect(KgImageSchema.safeParse(card({ avatarRegion: { x: 0, y: 0, w: 0.25, h: 0.5 } })).success).toBe(false);
  });

  test("square IS accepted — the assertions above pass for a schema that refuses everything", () => {
    expect(KgImageSchema.safeParse(card({ avatarRegion: { x: 0, y: 0.46, w: 0.5, h: 0.5 } })).success).toBe(true);
  });

  test("equal fractions on a NON-square image are refused", () => {
    // The trap this check exists for. `w === h` is square only on a square
    // image; on a 1671x941 landscape crop the same fractions are a box 1.78
    // times wider than it is tall, and a fraction-only check would pass it.
    const r = KgImageSchema.safeParse(
      card({ width: 1671, height: 941, avatarRegion: { x: 0, y: 0, w: 0.4, h: 0.4 } }),
    );
    expect(r.success).toBe(false);
  });

  test("and the matching PIXEL-square box on that image is accepted", () => {
    // Same image, a box that really is square: 0.4*1671 = 668.4px wide, so
    // 668.4/941 = 0.7103 tall.
    const r = KgImageSchema.safeParse(
      card({ width: 1671, height: 941, avatarRegion: { x: 0, y: 0, w: 0.4, h: 0.7103 } }),
    );
    expect(r.success).toBe(true);
  });

  test("the tolerance is a pixel, and it is not a licence", () => {
    // Below: sub-pixel rounding from two-decimal fractions, accepted.
    // Above: a stretch nobody would call rounding, refused.
    const near = AVATAR_SQUARENESS_TOLERANCE_PX / 2 / 1254;
    expect(KgImageSchema.safeParse(card({ avatarRegion: { x: 0, y: 0, w: 0.5, h: 0.5 + near } })).success).toBe(true);
    expect(KgImageSchema.safeParse(card({ avatarRegion: { x: 0, y: 0, w: 0.5, h: 0.52 } })).success).toBe(false);
  });
});

describe("an unverifiable box is refused, not accepted unchecked", () => {
  test("no width", () => {
    const r = KgImageSchema.safeParse({
      id: "x",
      src: "a.webp",
      height: 1254,
      avatarRegion: { x: 0, y: 0, w: 0.5, h: 0.5 },
    });
    expect(r.success).toBe(false);
    expect(r.success ? "" : r.error.issues[0]!.message).toContain("`width` and `height`");
  });

  test("no dimensions at all", () => {
    expect(
      KgImageSchema.safeParse({ id: "x", src: "a.webp", avatarRegion: { x: 0, y: 0, w: 0.5, h: 0.5 } }).success,
    ).toBe(false);
  });

  test("but an image with NO avatarRegion needs no dimensions", () => {
    // The refusal is scoped to the claim. An SVG mark declares neither and is
    // not being asked to.
    expect(KgImageSchema.safeParse({ id: "mark", src: "m.svg" }).success).toBe(true);
  });
});

describe("it does not disturb textRegion", () => {
  test("a wide shallow textRegion is still fine — squareness is avatar-only", () => {
    // Every textRegion declared today is wide and shallow, because a quiet
    // interior for a sentence is. Applying the avatar rule to both would have
    // failed the whole existing corpus.
    expect(
      KgImageSchema.safeParse(card({ textRegion: { x: 0.3, y: 0.255, w: 0.58, h: 0.235 } })).success,
    ).toBe(true);
  });

  test("both regions on one image, each judged by its own rule", () => {
    expect(
      KgImageSchema.safeParse(
        card({
          textRegion: { x: 0.3, y: 0.255, w: 0.58, h: 0.235 },
          avatarRegion: { x: 0, y: 0.46, w: 0.5, h: 0.5 },
        }),
      ).success,
    ).toBe(true);
  });

  test("out of bounds is still refused, and the message names neither field", () => {
    const r = KgImageSchema.safeParse(card({ avatarRegion: { x: 0.8, y: 0, w: 0.5, h: 0.5 } }));
    expect(r.success).toBe(false);
    expect(r.success ? "" : r.error.issues[0]!.message).toBe("region extends past the edge of the image");
  });
});
