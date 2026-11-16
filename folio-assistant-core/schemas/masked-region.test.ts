/**
 * `maskedRegions` — the rules, each against the mistake it exists for.
 *
 * A mask is the one declaration in this schema whose failure is INVISIBLE in
 * the artefact it describes: a rectangle that covers less than it claims, or
 * that was measured against a rendering with different dimensions, produces a
 * PNG that looks deliberate either way. Nothing downstream can tell a mask
 * that worked from one that missed, so the checking has to happen here.
 *
 * Fixtures use `state: "referenced"` rather than `"materialized"`. That is not
 * laziness: `materialized` additionally requires `localPath` and all five
 * `gates`, and a first draft of this file used it and got `"state
 * materialized requires all five gates"` back for EVERY case — including the
 * ones expected to pass. Seven refusals in a row read as seven rules working.
 * They were one unrelated rule firing seven times, and the mask rules were
 * never reached at all.
 */
import { describe, expect, it } from "bun:test";

import { BitstreamSchema } from "./catalogue.js";

const mat = { state: "referenced" as const, provenance: { local: "x.pdf#page=1" } };
/** A 300x212 raster — the real `wpr-rdo-2020-003-eng` cover's dimensions. */
const base = { name: "c.png", bundle: "THUMBNAIL", pixelWidth: 300, pixelHeight: 212, materialization: mat };
const region = { x0: 105, y0: 66, x1: 193, y1: 108, reason: "the WHO emblem" };

const refusal = (v: unknown): string | undefined => {
  const r = BitstreamSchema.safeParse(v);
  return r.success ? undefined : r.error.issues[0]!.message;
};

describe("maskedRegions", () => {
  it("acceptsRegionInsideRaster", () => {
    expect(refusal({ ...base, maskedRegions: [region] })).toBeUndefined();
  });

  it("acceptsNoMask", () => {
    expect(refusal(base)).toBeUndefined();
  });

  it("refusesRegionPastRaster", () => {
    // The defect: a region measured on one rendering and left behind when the
    // width changed. It still READS as a mask, and the part that fell outside
    // is simply not covered any more.
    expect(refusal({ ...base, maskedRegions: [{ ...region, x1: 400 }] })).toContain("outside the declared 300x212");
    expect(refusal({ ...base, maskedRegions: [{ ...region, y1: 900 }] })).toContain("outside the declared 300x212");
  });

  it("refusesRegionWithoutReason", () => {
    const { reason: _drop, ...noReason } = region;
    expect(refusal({ ...base, maskedRegions: [noReason] })).toBeDefined();
  });

  it("refusesZeroArea", () => {
    expect(refusal({ ...base, maskedRegions: [{ ...region, x1: region.x0 }] })).toContain("positive area");
    expect(refusal({ ...base, maskedRegions: [{ ...region, y1: region.y0 - 1 }] })).toContain("positive area");
  });

  it("refusesEmptyList", () => {
    // `[]` reads as "a mask list somebody emptied", which is a fact about an
    // edit rather than about the image. Absent says nothing was masked.
    expect(refusal({ ...base, maskedRegions: [] })).toBeDefined();
  });

  it("refusesMaskWithoutDimensions", () => {
    // Coordinates in the raster's own pixels need a raster to be stated in.
    // Without dimensions the rectangle cannot be checked against anything and
    // could name pixels the file does not have.
    const { pixelWidth: _w, pixelHeight: _h, ...noDims } = base;
    expect(refusal({ ...noDims, maskedRegions: [region] })).toContain("pixelWidth");
  });
});
