/**
 * A board shows the whole folio unless it says otherwise.
 *
 * The owner's CRDM Q3 ruling, and the property it buys: a board that declares
 * no filter cannot go stale, because there is no stored list to fall behind
 * the content. The tests that matter here are the ones that would pass for a
 * board that silently showed nothing.
 *
 * @module schemas/board.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  BOARD_SCHEMA_TAG,
  BoardSchema,
  boardContent,
  boardShows,
  wholeFolioBoard,
  type Board,
} from "./board.js";

/** The tools layer, which holds the schema modules this file reads as source (bean `8lcl`). */
const CODE = resolve(import.meta.dir, "..", "..");

const NODES = [
  { page: "index", node: "intro", kind: "prose" },
  { page: "index", node: "detail", kind: "table" },
  { page: "guide", node: "setup", kind: "prose" },
  { page: "guide", node: "unkinded" },
];

const filtered = (filter: Board["filter"]): Board => ({ ...wholeFolioBoard("b", "B"), filter });

describe("absent filter means the WHOLE folio — the default that cannot go stale", () => {
  test("every node passes", () => {
    expect(boardContent(wholeFolioBoard("b", "B"), NODES)).toEqual(NODES);
  });

  test("a node with no kind passes too", () => {
    // The state easiest to render as a blank: unkinded content is content.
    expect(boardShows(wholeFolioBoard("b", "B"), { page: "guide", node: "unkinded" })).toBe(true);
  });

  test("content added later needs no edit to the board", () => {
    // The whole argument for a query over a stored list, asserted rather than
    // claimed: the same board, a longer folio, and the new node is shown.
    const board = wholeFolioBoard("b", "B");
    const later = [...NODES, { page: "new", node: "arrived", kind: "prose" }];
    expect(boardContent(board, later).map((n) => n.node)).toContain("arrived");
  });
});

describe("a filter is OR within an axis, AND across axes", () => {
  test("pages alone", () => {
    expect(boardContent(filtered({ pages: ["guide"] }), NODES).map((n) => n.node)).toEqual([
      "setup",
      "unkinded",
    ]);
  });

  test("kinds alone", () => {
    expect(boardContent(filtered({ kinds: ["prose"] }), NODES).map((n) => n.node)).toEqual([
      "intro",
      "setup",
    ]);
  });

  test("both axes intersect rather than union", () => {
    // The assertion that fails for an OR: `index/intro` is prose and `guide`
    // is a page, so a union would return two nodes here.
    expect(boardContent(filtered({ pages: ["guide"], kinds: ["prose"] }), NODES).map((n) => n.node)).toEqual([
      "setup",
    ]);
  });

  test("two values on one axis union", () => {
    expect(boardContent(filtered({ pages: ["index", "guide"] }), NODES)).toEqual(NODES);
  });

  test("a kinds filter EXCLUDES a node with no kind rather than passing it", () => {
    // "Unstated" is not "matches anything". A node with no kind cannot be
    // asserted to be of the kind asked for, and a filter that let it through
    // would show content nobody selected.
    expect(boardShows(filtered({ kinds: ["prose"] }), { page: "guide", node: "unkinded" })).toBe(false);
  });

  test("a filter matching nothing returns EMPTY, which is a real answer", () => {
    expect(boardContent(filtered({ pages: ["absent"] }), NODES)).toEqual([]);
  });
});

describe("document order is preserved — the collapsed view is the same order", () => {
  test("filtering never reorders", () => {
    // R4's linear collapse renders document order. A board that reordered
    // would make the collapsed view disagree with the board it collapsed
    // from, and the collapsed view is the accessibility floor.
    const scrambled = [NODES[2]!, NODES[0]!, NODES[1]!];
    expect(boardContent(wholeFolioBoard("b", "B"), scrambled)).toEqual(scrambled);
  });
});

describe("the document declares what it is, and refuses the ambiguous states", () => {
  test("a board without the tag does not validate", () => {
    expect(BoardSchema.safeParse({ id: "b", title: "B" }).success).toBe(false);
    expect(BoardSchema.safeParse(wholeFolioBoard("b", "B")).success).toBe(true);
  });

  test("an EMPTY axis is refused — it reads one way to a human and another to a matcher", () => {
    expect(BoardSchema.safeParse(filtered({ pages: [] } as never)).success).toBe(false);
  });

  test("a filter with no axis is refused — omit `filter` instead", () => {
    // `filter: {}` and no filter at all would be two spellings of one state,
    // and the schema says which one to write.
    expect(BoardSchema.safeParse({ ...wholeFolioBoard("b", "B"), filter: {} }).success).toBe(false);
  });

  test("an unknown field is refused rather than carried", () => {
    expect(BoardSchema.safeParse({ ...wholeFolioBoard("b", "B"), notes: ["n"] }).success).toBe(false);
  });

  test("the tag names this version", () => {
    expect(BOARD_SCHEMA_TAG).toBe("folio-board/v1");
  });
});

describe("the arrows run one way — a board reaches no lower than content ids", () => {
  test("this module imports no note, position or content module", () => {
    // `folio -> board -> position -> note`. A board names content by page and
    // node id and names notes not at all; the positions layer does that, one
    // level down. Checked at the import level, as `board-positions` is.
    const src = readFileSync(join(CODE, "schemas", "ui", "board.ts"), "utf-8");
    const imports = [...src.matchAll(/^import .*? from "([^"]+)";$/gm)].map((m) => m[1]!);
    expect(imports).toEqual(["zod"]);
  });

  test("a board carries no note ids", () => {
    // Structural, against the source: a board listing its notes would be a
    // second answer to a question `board-positions.ts` already answers.
    const src = readFileSync(join(CODE, "schemas", "ui", "board.ts"), "utf-8");
    const fields = [...src.matchAll(/^\s{4}(\w+)[?]?:\s/gm)].map((m) => m[1]!);
    expect(fields.filter((n) => ["notes", "note", "positions", "x", "y"].includes(n))).toEqual([]);
  });
});
