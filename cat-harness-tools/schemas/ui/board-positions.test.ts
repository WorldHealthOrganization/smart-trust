/**
 * The positions layer sits on top of notes, and its order is a function of its
 * contents.
 *
 * Bean `6lb8`, on the owner's ruling. Three properties carry the whole design
 * and each is easy to lose silently:
 *
 * - **the arrow runs one way** — a note knows nothing about a board;
 * - **the order is deterministic** — the mergeability the ruling rests on is
 *   worthless the moment a writer emits in iteration order;
 * - **one position per note per board is STRUCTURAL** — the owner's Q2 ruling
 *   of 2026-09-20. It was enforced by `place()` alone and asserted "through
 *   this path", which is exactly what a second writer, a hand edit or a merge
 *   walks around. The tests below now assert the type refuses it.
 *
 * @module schemas/board-positions.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  BOARD_POSITIONS_SCHEMA_TAG,
  BoardPositionsSchema,
  emptyPositions,
  moveBy,
  orphanPositions,
  place,
  positionOf,
  positionsOn,
  renderPositions,
  sortPositions,
  unplace,
  type BoardPositions,
} from "./board-positions.js";

/** The tools layer, which holds the schema modules this file reads as source (bean `8lcl`). */
const CODE = resolve(import.meta.dir, "..", "..");

const doc = (): BoardPositions => ({
  $schema: BOARD_POSITIONS_SCHEMA_TAG,
  boards: {
    landing: {
      zebra: { x: 3, y: 4 },
      apple: { x: 1, y: 2 },
    },
  },
});

describe("the order is a function of the contents, not of the writer", () => {
  test("boards and notes both sort ascending", () => {
    const d = sortPositions({
      $schema: BOARD_POSITIONS_SCHEMA_TAG,
      boards: { zulu: { b: { x: 0, y: 0 } }, alpha: { c: { x: 0, y: 0 }, a: { x: 0, y: 0 } } },
    });
    expect(Object.keys(d.boards)).toEqual(["alpha", "zulu"]);
    expect(Object.keys(d.boards["alpha"]!)).toEqual(["a", "c"]);
  });

  test("sorting is IDEMPOTENT — a save of unchanged state is a no-op diff", () => {
    // The property the ruling rests on. A writer that reshuffled would make
    // every save a conflict with every other save, which is the defect the
    // one-line-per-position layout exists to avoid.
    const once = renderPositions(doc());
    expect(renderPositions(sortPositions(doc()))).toBe(once);
  });

  test("insertion order does not reach the output", () => {
    // Sharper under a map than it was under an array: `JSON.stringify` emits a
    // JSON object in INSERTION order, so a sort that only read in order while
    // rebuilding nothing would pass every other test here and still write two
    // different files for one document.
    const a: BoardPositions = {
      $schema: BOARD_POSITIONS_SCHEMA_TAG,
      boards: { b: { y: { x: 1, y: 1 } }, a: { x: { x: 0, y: 0 } } },
    };
    const b: BoardPositions = {
      $schema: BOARD_POSITIONS_SCHEMA_TAG,
      boards: { a: { x: { x: 0, y: 0 } }, b: { y: { x: 1, y: 1 } } },
    };
    expect(renderPositions(a)).toBe(renderPositions(b));
  });

  test("note keys are rebuilt in order, not merely iterated in order", () => {
    const d = sortPositions({
      $schema: BOARD_POSITIONS_SCHEMA_TAG,
      boards: { only: { zed: { x: 0, y: 0 }, abe: { x: 1, y: 1 } } },
    });
    expect(JSON.stringify(d.boards["only"])).toBe('{"abe":{"x":1,"y":1},"zed":{"x":0,"y":0}}');
  });

  test("the sort is not locale-dependent", () => {
    // `localeCompare` would let two machines order the same ids differently
    // and each rewrite the other's file. Asserted on a pair that a locale
    // collation really does reorder.
    const d = sortPositions({
      $schema: BOARD_POSITIONS_SCHEMA_TAG,
      boards: { x: { "a-b": { x: 0, y: 0 }, ab: { x: 0, y: 0 } } },
    });
    expect(Object.keys(d.boards["x"]!)).toEqual(["a-b", "ab"]);
  });
});

describe("one position per note per board — in the TYPE, not in one function", () => {
  test("the shape cannot express a note twice on one board", () => {
    // The owner's Q2 ruling, and the reason it is not "place() filters": a
    // duplicate had to be UNREPRESENTABLE rather than unreachable through the
    // one writer that happened to check. Under the old array shape this very
    // document validated.
    const twice = {
      $schema: BOARD_POSITIONS_SCHEMA_TAG,
      boards: { landing: [{ note: "n", x: 1, y: 1 }, { note: "n", x: 9, y: 9 }] },
    };
    expect(BoardPositionsSchema.safeParse(twice).success).toBe(false);
  });

  test("placing twice replaces rather than appends", () => {
    let d = place(emptyPositions(), "landing", "n", { x: 1, y: 1 });
    d = place(d, "landing", "n", { x: 9, y: 9 });
    expect(d.boards["landing"]).toEqual({ n: { x: 9, y: 9 } });
  });

  test("a note may sit on SEVERAL boards at different places", () => {
    // The property per-note coordinates could not have had without a second
    // vocabulary. Unchanged by the reshape: the restriction is per board.
    let d = place(emptyPositions(), "landing", "n", { x: 1, y: 1 });
    d = place(d, "review", "n", { x: 5, y: 5 });
    expect(positionOf(d, "landing", "n")).toEqual({ x: 1, y: 1 });
    expect(positionOf(d, "review", "n")).toEqual({ x: 5, y: 5 });
  });

  test("unplacing returns the note to having no position, which is a real state", () => {
    const d = unplace(place(emptyPositions(), "landing", "n", { x: 1, y: 1 }), "landing", "n");
    expect(d.boards["landing"]).toEqual({});
    expect(positionOf(d, "landing", "n")).toBeUndefined();
  });

  test("unplacing from a board that does not exist is a no-op, not a throw", () => {
    expect(unplace(emptyPositions(), "nope", "n")).toEqual(emptyPositions());
  });

  test("unplacing a note that was never placed leaves the document alone", () => {
    const d = place(emptyPositions(), "landing", "other", { x: 0, y: 0 });
    expect(unplace(d, "landing", "n")).toBe(d);
  });

  test("a position carries no note of its own", () => {
    // One fact, one place: the note is the key. A `note` field beside it could
    // disagree with the key the moment anybody edits the file by hand.
    const withNote = {
      $schema: BOARD_POSITIONS_SCHEMA_TAG,
      boards: { landing: { n: { note: "n", x: 1, y: 1 } } },
    };
    expect(BoardPositionsSchema.safeParse(withNote).success).toBe(false);
  });
});

describe("a map is the right storage; a list is the right thing to render", () => {
  test("positionsOn returns each note with the id it is keyed by, in order", () => {
    expect(positionsOn(doc(), "landing")).toEqual([
      { note: "apple", x: 1, y: 2 },
      { note: "zebra", x: 3, y: 4 },
    ]);
  });

  test("an unknown board is EMPTY, not an exception", () => {
    // A folio that has not placed anything yet is a real state, so asking
    // about its board is a question with an answer.
    expect(positionsOn(emptyPositions(), "landing")).toEqual([]);
  });

  test("positionsOn does not mutate, and its result is not aliased into the document", () => {
    const d = doc();
    const before = renderPositions(d);
    const out = positionsOn(d, "landing");
    out[0]!.x = 999;
    expect(renderPositions(d)).toBe(before);
  });
});

describe("orphans are reported, never removed", () => {
  test("a position whose note is gone is listed", () => {
    expect(orphanPositions(doc(), new Set(["apple"]))).toEqual([{ board: "landing", note: "zebra" }]);
  });

  test("and nothing is reported when every note resolves", () => {
    // The other direction: every assertion above passes for a function that
    // reports everything.
    expect(orphanPositions(doc(), new Set(["apple", "zebra"]))).toEqual([]);
  });

  test("the document is not mutated by asking", () => {
    const asked = doc();
    const before = renderPositions(asked);
    expect(orphanPositions(asked, new Set())).toHaveLength(2);
    expect(renderPositions(asked)).toBe(before);
  });
});

describe("the arrow runs ONE way — a note knows nothing about a board", () => {
  test("no note schema carries a position or a board", () => {
    // The structural half of the owner's ruling, asserted against the SOURCE
    // rather than against a value, because the failure it guards is somebody
    // later adding `x`/`y` to a note "for convenience". That would make a
    // content node carry state and give one note two answers on two boards.
    for (const f of ["sdlc/todo.ts", "kg/carried-note.ts", "content/landing-sticky.ts", "ui/note-anchor.ts"]) {
      const src = readFileSync(join(CODE, "schemas", f), "utf-8");
      const fields = [...src.matchAll(/^\s{2}(\w+)[?]?:\s/gm)].map((m) => m[1]!);
      expect({ f, offending: fields.filter((n) => ["x", "y", "board", "position"].includes(n)) }).toEqual({
        f,
        offending: [],
      });
    }
  });

  test("this module imports no note module", () => {
    // The dependency direction, checked at the import level. `board-positions`
    // may not reach DOWN into a note's schema: it names notes by id, and an
    // id needs no type from the layer below.
    const src = readFileSync(join(CODE, "schemas", "ui", "board-positions.ts"), "utf-8");
    const imports = [...src.matchAll(/^import .*? from "([^"]+)";$/gm)].map((m) => m[1]!);
    expect(imports).toEqual(["zod"]);
  });
});

describe("the document declares what it is", () => {
  test("a file without the tag does not validate", () => {
    // Declaration over location, as every other store here does it: a `.json`
    // in the directory is not a positions file unless it says so.
    expect(BoardPositionsSchema.safeParse({ boards: {} }).success).toBe(false);
    expect(BoardPositionsSchema.safeParse(emptyPositions()).success).toBe(true);
  });

  test("an empty document is VALID — a folio with no board yet", () => {
    expect(Object.keys(emptyPositions().boards)).toEqual([]);
    expect(BoardPositionsSchema.safeParse(emptyPositions()).success).toBe(true);
  });

  test("a non-finite coordinate is refused", () => {
    // `NaN` and `Infinity` survive `z.number()` and serialise to `null`, which
    // reads back as a position that is not a position.
    const bad = { $schema: BOARD_POSITIONS_SCHEMA_TAG, boards: { a: { n: { x: NaN, y: 0 } } } };
    expect(BoardPositionsSchema.safeParse(bad).success).toBe(false);
  });

  test("an empty note id is refused — a key that names nothing", () => {
    const bad = { $schema: BOARD_POSITIONS_SCHEMA_TAG, boards: { a: { "": { x: 0, y: 0 } } } };
    expect(BoardPositionsSchema.safeParse(bad).success).toBe(false);
  });

  test("it renders indented, one position per line-block", () => {
    // The mergeability layout, asserted rather than assumed: minified, any
    // change on both sides of a merge is a whole-file conflict. Under the map
    // the note id IS the line that opens each block, so that is what is
    // counted — the old assertion counted `"note"` fields, which no longer
    // exist, and a count that cannot fail would have read as coverage.
    const out = renderPositions(doc());
    expect(out.split("\n").filter((l) => /^\s{6}"\w+": \{$/.test(l)).length).toBe(2);
    expect(out.endsWith("\n")).toBe(true);
  });
});

describe("moveBy — a move edits the LAYER and reaches no note", () => {
  const placed = () =>
    place(
      place(BoardPositionsSchema.parse({ $schema: BOARD_POSITIONS_SCHEMA_TAG, boards: {} }), "b", "n1", {
        x: 10,
        y: 20,
      }),
      "b",
      "n2",
      { x: 0, y: 0 },
    );

  test("a delta is applied to the note's current position", () => {
    const doc = moveBy(placed(), "b", "n1", 5, -3)!;
    expect(positionOf(doc, "b", "n1")).toEqual({ x: 15, y: 17 });
  });

  test("a note that is NOT placed is not moved, and does not appear", () => {
    // "Move it from where it is" has no answer for a note that is nowhere, and
    // answering anyway would put it somewhere nobody chose.
    expect(moveBy(placed(), "b", "never-placed", 5, 5)).toBeUndefined();
    expect(moveBy(placed(), "no-such-board", "n1", 5, 5)).toBeUndefined();
  });

  test("it returns a NEW document and leaves the old one alone", () => {
    const before = placed();
    const snapshot = renderPositions(before);
    const after = moveBy(before, "b", "n1", 100, 100)!;
    expect(after).not.toBe(before);
    expect(after.boards).not.toBe(before.boards);
    expect(after.boards.b).not.toBe(before.boards.b);
    expect(positionOf(after, "b", "n1")).toEqual({ x: 110, y: 120 });
    expect(renderPositions(before)).toBe(snapshot);
  });

  test("moving one note leaves every other position untouched", () => {
    const doc = moveBy(placed(), "b", "n1", 7, 7)!;
    expect(positionOf(doc, "b", "n2")).toEqual({ x: 0, y: 0 });
  });

  test("a note still appears at most ONCE on a board after a move", () => {
    // The map's invariant, carried through a second writer. Two entries for
    // one note is what makes a position ambiguous.
    const doc = moveBy(moveBy(placed(), "b", "n1", 1, 1)!, "b", "n1", 1, 1)!;
    expect(Object.keys(doc.boards.b!).filter((k) => k === "n1").length).toBe(1);
    expect(positionOf(doc, "b", "n1")).toEqual({ x: 12, y: 22 });
  });

  test("a zero delta is a no-op in value, not a refusal", () => {
    // A drag that ends where it started is still a completed gesture, and a
    // caller should not have to special-case it.
    const doc = moveBy(placed(), "b", "n1", 0, 0)!;
    expect(positionOf(doc, "b", "n1")).toEqual({ x: 10, y: 20 });
  });
});
