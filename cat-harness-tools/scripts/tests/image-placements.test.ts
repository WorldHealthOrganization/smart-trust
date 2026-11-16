/**
 * One entry per DISTINCT image, and the placements the collapse must not lose.
 *
 * @module scripts/tests/image-placements.test
 * @graphNode none — a test
 *
 * Bean `j820`, issue #1234. Written because the migration that introduced
 * `placements[]` passed the whole 138-gate set UNTOUCHED — schema, generator,
 * 29 rewritten sidecars, 530 deleted PNGs, and not one red. A change that big
 * going green means nothing was looking, which is the `1xhc` shape. These are
 * the assertions that would have gone red.
 *
 * The corpus case at the end is the non-vacuous one: it reads the real
 * sidecars, so it fails if a future ingest re-introduces per-placement entries.
 *
 * The tests of this file that read the whole checkout (reads the image
 * sidecars of smart-base's library entries) live in
 * `test/image-placements-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";

import { DocumentImageSchema } from "../../schemas/content/document-image.ts";

const geometry = (page: number) => ({
  method: "geometry" as const,
  coverage: 0.01,
  imagesOnPage: 3,
  page,
});

describe("placements — the array is optional and its first entry is `basis`", () => {
  test("a singly-placed image needs none", () => {
    const r = DocumentImageSchema.safeParse({
      id: "img-p001-1",
      file: "images/img-p001-1.png",
      role: "figure",
      basis: geometry(1),
    });
    expect(r.success).toBe(true);
  });

  test("placements[0] must be the placement `basis` describes", () => {
    // The drift this forbids is silent: `basis.page` and `placements` are two
    // spellings of where an image first appears, and a consumer reading one
    // would disagree with a consumer reading the other with nothing failing.
    const r = DocumentImageSchema.safeParse({
      id: "img-p003-6",
      file: "images/img-p003-6.png",
      role: "figure",
      basis: geometry(3),
      placements: [{ page: 7, coverage: 0.01, imagesOnPage: 3 }],
    });
    expect(r.success, "a placements[0] on another page must be refused").toBe(false);
  });

  test("the same image on several pages is accepted, first placement leading", () => {
    const r = DocumentImageSchema.safeParse({
      id: "img-p028-1",
      file: "images/img-p028-1.png",
      role: "figure",
      basis: geometry(28),
      narrative: [{ text: "The Principles for Digital Development logo.", lang: "en", state: "draft",
        drafted_by: { kind: "agent", id: "claude", model: "claude-opus-5" }, drafted_at: "2026-09-24" }],
      placements: [
        { page: 28, coverage: 0.01, imagesOnPage: 3 },
        { page: 42, coverage: 0.01, imagesOnPage: 3, note: "header for this page's two principles" },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("an empty placements array is refused — absent means singly placed", () => {
    const r = DocumentImageSchema.safeParse({
      id: "img-p001-1", file: "images/img-p001-1.png", role: "figure",
      basis: geometry(1), placements: [],
    });
    expect(r.success).toBe(false);
  });

  test("a note may not be empty — an unsaid thing is an absent field", () => {
    const r = DocumentImageSchema.safeParse({
      id: "img-p001-1", file: "images/img-p001-1.png", role: "figure",
      basis: geometry(1),
      placements: [{ page: 1, coverage: 0.01, imagesOnPage: 3, note: "" }],
    });
    expect(r.success).toBe(false);
  });
});
