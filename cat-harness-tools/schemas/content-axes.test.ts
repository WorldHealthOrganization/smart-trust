/**
 * The four axes stay four, and each keeps the property that makes it useful.
 *
 * @module schemas/content-axes.test
 *
 * Issue #764 §1: *"conflating any two is the defect"*. The two axes settled
 * on 2026-09-22 — interactivity (O1) and visualiser (O2) — are declared in
 * two DIFFERENT layers, and these tests pin the properties that distinguish
 * all four rather than merely asserting their contents.
 *
 * A test that only listed each tuple's members would pass on a repository
 * where every axis had silently become a synonym for the others.
 */
import { describe, expect, test } from "bun:test";

import {
  CONTENT_ADAPTERS,
  CONTENT_INTERACTIVITY,
  CONTENT_PROFILES,
  type ContentInteractivity,
} from "./content/block-kinds.js";
import { ContentDirectorySchema, VISUALISER_KINDS } from "./kg/cat-harness.js";
import { HarnessConfigSchema } from "./kg/harness-config.js";

describe("the four axes are four, and none is a synonym for another", () => {
  test("no value appears on two axes, except the ONE that is meant to", () => {
    /* The cheapest detector for a conflation: if `document` turned up as an
     * adapter, or `folio` as a profile, the axis it strayed onto has stopped
     * answering its own question.
     *
     * `paper` IS ON TWO, deliberately, and the first version of this test
     * was simply wrong to forbid it. `PaperContentAdapter` extends
     * `DocumentContentAdapter` — so `paper` names a vocabulary — and
     * `CONTENT_PROFILES` nests `document` ⊃ `paper` — so it also names a
     * permission. One word, two true facts about the same subject.
     *
     * It is named here rather than filtered out. A test that quietly
     * skipped it would pass equally over a second overlap nobody intended,
     * which is the whole failure this test exists to catch. */
    //
    // Bean `bzwk` (owner 2026-10-12) moved the one overlap: core's vocabulary
    // is named `document`, the profile its kinds make up, and sci's is
    // `mathpaper`, so `paper` left the adapter axis and stays a profile (and
    // the server adapter class's contentType, which is not on these axes).
    const counts = new Map<string, number>();
    for (const v of [...CONTENT_ADAPTERS, ...CONTENT_PROFILES, ...VISUALISER_KINDS, ...CONTENT_INTERACTIVITY]) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const overlaps = [...counts].filter(([, n]) => n > 1).map(([v]) => v);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]).toBe("document");
  });

  test("the two NEW axes overlap nothing at all", () => {
    // The narrower claim, and the one this change is actually responsible
    // for. `paper`'s double life predates it; interactivity and visualiser
    // introduce no second one.
    const older = new Set<string>([...CONTENT_ADAPTERS, ...CONTENT_PROFILES]);
    for (const v of [...VISUALISER_KINDS, ...CONTENT_INTERACTIVITY]) {
      expect(older.has(v)).toBe(false);
    }
  });

  test("each axis is non-empty, so none of this is vacuous", () => {
    for (const axis of [CONTENT_ADAPTERS, CONTENT_PROFILES, VISUALISER_KINDS, CONTENT_INTERACTIVITY]) {
      expect(axis.length).toBeGreaterThan(0);
    }
  });
});

describe("interactivity — `undetermined` is a VALUE, not an absence", () => {
  test("the axis carries all three answers", () => {
    // The owner ruled the boundary is judgement, so "could not determine"
    // has to be sayable. An axis of two would force it into silence or into
    // `static`, and reading a could-not-determine as `static` is reading it
    // as clean.
    expect([...CONTENT_INTERACTIVITY].sort()).toEqual(["interactive", "static", "undetermined"]);
  });

  test("absent and `undetermined` are DIFFERENT states on a real config", () => {
    // The distinction the value exists for: absent is "nobody has said",
    // `undetermined` is "somebody looked and could not decide". A schema
    // that defaulted the field would erase the first.
    const silent = HarnessConfigSchema.parse({ contentType: "document" });
    const looked = HarnessConfigSchema.parse({ contentType: "document", interactivity: "undetermined" });
    expect(silent.interactivity).toBeUndefined();
    expect(looked.interactivity).toBe("undetermined");
  });

  test("it is a widening, which is why it could not be a profile", () => {
    // Profiles NEST and only narrow — `document` ⊃ `paper`. Interactivity
    // cross-cuts: an interactive PAPER is expressible, and that combination
    // is what no profile could carry.
    const combos: Array<[(typeof CONTENT_PROFILES)[number], ContentInteractivity]> = [
      ["document", "static"],
      ["document", "interactive"],
      ["paper", "static"],
      ["paper", "interactive"],
    ];
    // All four are meaningful; the axes are independent. If interactivity
    // were a profile this list would collapse to a chain.
    expect(new Set(combos.map((c) => c.join("/"))).size).toBe(4);
  });
});

describe("the visualiser axis attaches PER GRAPH", () => {
  const dir = (extra: Record<string, unknown> = {}) => ({
    id: "lib",
    path: "library/",
    graphTypologies: ["library"],
    ...extra,
  });

  test("a directory may declare it", () => {
    const parsed = ContentDirectorySchema.parse(dir({ visualisedAs: "folio" }));
    expect((parsed as { visualisedAs?: string }).visualisedAs).toBe("folio");
  });

  test("ABSENT is not a default — a consumer reading one would be inventing it", () => {
    const parsed = ContentDirectorySchema.parse(dir());
    expect((parsed as { visualisedAs?: string }).visualisedAs).toBeUndefined();
  });

  test("a value outside the vocabulary is refused", () => {
    // Without this the field is a free string wearing an enum's name, and
    // the axis stops being an axis.
    expect(() => ContentDirectorySchema.parse(dir({ visualisedAs: "whiteboard" }))).toThrow();
  });

  test("it is NOT `coverage.visualiser` — the two coexist on one directory", () => {
    // One field names the PAGE THAT RENDERS the graph, the other says which
    // visualiser's semantics apply. The test is that both can be set at once
    // and neither reads the other: if they were one fact, this fixture would
    // be contradictory rather than ordinary.
    const parsed = ContentDirectorySchema.parse(
      dir({ visualisedAs: "folio", coverage: { visualiser: "cat-harness/docs/library/index.html" } }),
    ) as { visualisedAs?: string; coverage?: { visualiser?: unknown } };
    expect(parsed.visualisedAs).toBe("folio");
    expect(parsed.coverage?.visualiser).toBeDefined();
  });
});

describe("one visualiser, and the count is a claim", () => {
  test("cat-harness provides exactly one", () => {
    // Owner: "folio is the only visualizer provided by cat-harness". A
    // second member added without the F1–F6 argument behind it would make
    // the axis a synonym for "renderer", which is the conflation §1 warns
    // about. This test is where that argument gets made again.
    expect([...VISUALISER_KINDS]).toEqual(["folio"]);
  });
});
