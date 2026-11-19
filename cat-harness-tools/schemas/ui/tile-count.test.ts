/**
 * A tile's declared count, and the third state that is the whole point.
 *
 * Issue #856, bean `tis1`. The owner ruled for a badge over greying an empty
 * tile out, and their reason is the one these tests are shaped by: a badge
 * also makes a WRONG count visible, where a dimmed tile only ever answers
 * "empty or not".
 *
 * **The assertions that matter are the ones about ABSENCE.** A count that
 * renders is easy to test and hard to get wrong. The failure mode this design
 * exists to prevent is a reader that answers `0` for a question it could not
 * read — `dh4f`, scanning nothing and reporting it clean — and every such test
 * below is written so that a `?? 0` anywhere in the reader turns it red.
 */
import { describe, expect, test } from "bun:test";

import { TILE_COUNT_FIELD, readTileCounts, tileCounts } from "./tile-count.ts";

describe("a declared count is read as declared", () => {
  test("count and unit survive the round trip", () => {
    const got = readTileCounts(tileCounts({ beans: [466, "beans"] }));
    expect(got.get("beans")).toEqual({ count: 466, unit: "beans" });
  });

  test("ZERO is a value, not a missing one", () => {
    // The state the feature exists for. A reader that treated `0` as falsy
    // would drop exactly the badge worth drawing.
    const got = readTileCounts(tileCounts({ library: [0, "entries"] }));
    expect(got.has("library")).toBe(true);
    expect(got.get("library")!.count).toBe(0);
  });

  test("ONE projection declares for TWO directories", () => {
    // Not a hypothetical: `flh4` put the queue block in
    // `assets/library/index.json` rather than minting a second projection,
    // "since two projections over it would be two answers to how many are
    // queued". So that one file owes 8 entries AND 20 waiting, and a
    // single-count-per-file design could have served only one of them.
    const got = readTileCounts(
      tileCounts({ library: [8, "entries"], uploads: [20, "waiting"] }),
    );
    expect(got.get("library")).toEqual({ count: 8, unit: "entries" });
    expect(got.get("uploads")).toEqual({ count: 20, unit: "waiting" });
  });

  test("the two numbers are allowed to disagree, which is why they are separate", () => {
    const got = readTileCounts(
      tileCounts({ library: [8, "entries"], uploads: [20, "waiting"] }),
    );
    expect(got.get("library")!.count).not.toBe(got.get("uploads")!.count);
  });
});

describe("ABSENT is not ZERO — every one of these must yield nothing", () => {
  // Each case is a way a count could go missing. A reader with a `?? 0`
  // fallback passes every "happy path" test above and fails all of these.
  const nothing: Array<[string, unknown]> = [
    ["a projection that declares no tile field", { $schema: "folio-bean-index/v1", items: [] }],
    ["null", null],
    ["undefined", undefined],
    ["a string where the projection should be", "not json"],
    ["a number", 7],
    ["an unparsed projection", []],
    ["a tile field that is null", { [TILE_COUNT_FIELD]: null }],
    ["a tile field that is a string", { [TILE_COUNT_FIELD]: "12" }],
  ];

  test.each(nothing)("%s — no counts at all", (_name, value) => {
    expect([...readTileCounts(value)]).toEqual([]);
  });
});

describe("a malformed entry is dropped, and never rounded to zero", () => {
  const bad: Array<[string, unknown]> = [
    ["count missing", { unit: "beans" }],
    ["count is a string", { count: "466", unit: "beans" }],
    ["count is NaN", { count: Number.NaN, unit: "beans" }],
    ["count is Infinity", { count: Number.POSITIVE_INFINITY, unit: "beans" }],
    ["count is null", { count: null, unit: "beans" }],
    ["unit missing", { count: 466 }],
    ["unit is blank", { count: 466, unit: "   " }],
    ["unit is not a string", { count: 466, unit: 12 }],
    ["the entry is not an object", 466],
    ["the entry is null", null],
  ];

  test.each(bad)("%s — no entry at all", (_name, entry) => {
    const got = readTileCounts({ [TILE_COUNT_FIELD]: { beans: entry } });
    expect(got.has("beans")).toBe(false);
  });

  test("NaN in particular does not slip through a `typeof` check", () => {
    // `typeof NaN === "number"` is true, so a reader checking only the type
    // would emit a badge reading "NaN". Named separately because it is the
    // one a reviewer is most likely to wave through.
    const got = readTileCounts({ [TILE_COUNT_FIELD]: { beans: { count: 0 / 0, unit: "beans" } } });
    expect(got.has("beans")).toBe(false);
  });

  test("a bad entry does not silence its SIBLING", () => {
    // The shared-projection case again: if one malformed declaration dropped
    // the whole file, `uploads` could take `library`'s badge away — and the
    // tile beside it would look like a graph nobody counted.
    const got = readTileCounts({
      [TILE_COUNT_FIELD]: {
        library: { count: "eight", unit: "entries" },
        uploads: { count: 20, unit: "waiting" },
      },
    });
    expect(got.has("library")).toBe(false);
    expect(got.get("uploads")).toEqual({ count: 20, unit: "waiting" });
  });
});

describe("only OWN properties are counted", () => {
  test("`constructor` does not mint a tile count", () => {
    // Every object literal inherits `constructor` and `toString`. A walk using
    // `for…in` or a bare `raw[id]` lookup against a guessed key would mint
    // entries for directories nobody declared — the same trap `glyphFor`
    // carries a note about in `docs-ui.js`.
    const got = readTileCounts({ [TILE_COUNT_FIELD]: {} });
    expect(got.has("constructor")).toBe(false);
    expect(got.has("toString")).toBe(false);
    expect([...got]).toEqual([]);
  });
});

describe("the field name is spelled in exactly one place", () => {
  test("the writer and the reader agree by construction", () => {
    // `tileCounts` is the only writer and `readTileCounts` the only reader,
    // both off `TILE_COUNT_FIELD`. Asserted rather than assumed, because a
    // generator that spelled the field itself would produce a projection that
    // validates, publishes, and shows no badge — a silent failure, which is
    // the class this whole file is about.
    const written = tileCounts({ todos: [3, "todos"] }) as Record<string, unknown>;
    expect(Object.keys(written)).toEqual([TILE_COUNT_FIELD]);
    expect(readTileCounts(written).get("todos")).toEqual({ count: 3, unit: "todos" });
  });
});
