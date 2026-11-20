/**
 * A reader's filter narrows their view and commits nothing.
 *
 * @module schemas/reader-filter.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  NO_READER_FILTER,
  propertyValues,
  readerFilterProblem,
  readerShows,
  visibleOn,
  type FilterableNode,
} from "./reader-filter.js";
import { BoardSchema, boardContent } from "../ui/board.js";
import { BoardPositionsSchema, place, positionOf, renderPositions } from "../ui/board-positions.js";

type Node = { page: string; node: string; kind?: string; properties?: Record<string, string> };

const NODES: Node[] = [
  { page: "one", node: "a", kind: "todo", properties: { status: "open", priority: "high" } },
  { page: "one", node: "b", kind: "todo", properties: { status: "done", priority: "high" } },
  { page: "two", node: "c", kind: "bean", properties: { status: "open", priority: "low" } },
  { page: "two", node: "d", kind: "todo", properties: { status: "open", priority: "low" } },
  // No kind and no properties: the node that must not pass a filter by default.
  { page: "two", node: "e" },
];

const WHOLE = BoardSchema.parse({ $schema: "folio-board/v1", id: "all", title: "All" });
const PAGE_ONE = BoardSchema.parse({
  $schema: "folio-board/v1",
  id: "one",
  title: "Page one",
  filter: { pages: ["one"] },
});

describe("an absent filter filters nothing", () => {
  test("every node the board shows stays shown", () => {
    expect(visibleOn(NODES, NO_READER_FILTER)).toEqual(NODES);
    expect(readerFilterProblem(NO_READER_FILTER)).toBeUndefined();
    // On a board: what the board shows is what the reader sees, node for node,
    // for a scoped board and the whole-folio one alike.
    for (const board of [PAGE_ONE, WHOLE]) {
      const shown = boardContent(board, NODES);
      expect(shown.length).toBeGreaterThan(0);
      const visible = visibleOn(shown, NO_READER_FILTER);
      expect(visible).toHaveLength(shown.length);
      visible.forEach((n, i) => expect(n).toBe(shown[i]!));
    }
  });
});

describe("OR within an axis, AND across — the declared filter's logic, deliberately", () => {
  test("two kinds is a union", () => {
    // A reader who has learned what the board's filter means has learned what
    // theirs means. Two logics on one surface is a thing nobody can predict.
    expect(visibleOn(NODES, { kinds: ["todo", "bean"] }).map((n) => n.node)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  test("two properties is an intersection", () => {
    expect(
      visibleOn(NODES, { properties: { status: ["open"], priority: ["high"] } }).map((n) => n.node),
    ).toEqual(["a"]);
  });

  test("values within one property are a union", () => {
    expect(
      visibleOn(NODES, { properties: { priority: ["high", "low"] } }).map((n) => n.node),
    ).toEqual(["a", "b", "c", "d"]);
  });

  test("kind and properties are an intersection too", () => {
    expect(
      visibleOn(NODES, { kinds: ["todo"], properties: { status: ["open"] } }).map((n) => n.node),
    ).toEqual(["a", "d"]);
  });
});

describe("a node that cannot answer has not answered YES", () => {
  test("no kind is excluded by a kind filter", () => {
    // The same total answer `boardShows` gives, and for the same reason.
    expect(readerShows({ kinds: ["todo"] }, { })).toBe(false);
  });

  test("a missing property is excluded by a filter on it", () => {
    expect(readerShows({ properties: { status: ["open"] } }, { kind: "todo" })).toBe(false);
  });

  test("but it survives a filter that does not ask", () => {
    expect(readerShows(NO_READER_FILTER, {})).toBe(true);
  });
});

describe("an EMPTY axis is refused rather than read as `match nothing`", () => {
  test("a kind filter with nothing selected is a problem, named", () => {
    // It reads as "match nothing" to a naive implementation and "no filter" to
    // a careless one, and neither is what a reader who just cleared every
    // checkbox meant.
    expect(readerFilterProblem({ kinds: [] })).toContain("nothing selected");
  });

  test("so is a property filter with nothing selected, and it names WHICH", () => {
    const problem = readerFilterProblem({ properties: { status: [] } });
    expect(problem).toContain("status");
    expect(problem).toContain("nothing selected");
  });

  test("a populated axis is not a problem", () => {
    expect(readerFilterProblem({ kinds: ["todo"], properties: { status: ["open"] } })).toBeUndefined();
  });
});

describe("the reader's filter can only NARROW", () => {
  test("its result is always a subset of what the board shows", () => {
    // Asserted over every filter this fixture can express, rather than
    // trusting the composition in `visibleOn` to stay written that way.
    const shown = boardContent(PAGE_ONE, NODES);
    const filters = [
      NO_READER_FILTER,
      { kinds: ["todo"] },
      { kinds: ["bean"] },
      { properties: { status: ["open"] } },
      { properties: { priority: ["low"] } },
      { kinds: ["todo"], properties: { status: ["done"] } },
    ];
    for (const f of filters) {
      const visible = visibleOn(shown, f);
      for (const n of visible) {
        expect(shown, `${JSON.stringify(f)} produced a node the board does not show`).toContain(n);
      }
      expect(visible.length).toBeLessThanOrEqual(shown.length);
    }
  });

  test("a reader cannot see past the board's declared scope", () => {
    // The board is scoped to page one; a reader filtering for `bean` — which
    // only exists on page two — sees nothing rather than reaching page two.
    const shown = boardContent(PAGE_ONE, NODES);
    expect(visibleOn(shown, { kinds: ["bean"] })).toEqual([]);
    // And the same filter on the WHOLE-folio board does find it, so the
    // emptiness above is the board's scope rather than a broken filter.
    expect(visibleOn(boardContent(WHOLE, NODES), { kinds: ["bean"] }).map((n) => n.node)).toEqual([
      "c",
    ]);
  });

  test("document order is preserved, because the linear floor renders it", () => {
    const visible = visibleOn(NODES, { properties: { status: ["open"] } });
    expect(visible.map((n) => n.node)).toEqual(["a", "c", "d"]);
  });
});

describe("it commits NOTHING — the separation, asserted rather than named", () => {
  test("filtering leaves the board's own declaration byte-identical", () => {
    // Conflating the two filters would make a reader's temporary view edit the
    // board everyone else opens. This is that property, checked.
    const before = JSON.stringify(PAGE_ONE);
    visibleOn(boardContent(PAGE_ONE, NODES), { kinds: ["todo"], properties: { status: ["done"] } });
    expect(JSON.stringify(PAGE_ONE)).toBe(before);
  });

  test("and leaves the layout document byte-identical", () => {
    // The other document a "filter" could plausibly write to. A filtered-out
    // note keeps its position; it is not unplaced.
    let doc = BoardPositionsSchema.parse({ $schema: "folio-board-positions/v1", boards: {} });
    doc = place(doc, "one", "a", { x: 1, y: 2 });
    doc = place(doc, "one", "b", { x: 3, y: 4 });
    const before = renderPositions(doc);
    // A filter that hides both placed notes leaves both placed.
    expect(visibleOn(NODES, { kinds: ["bean"] }).map((n) => n.node)).toEqual(["c"]);
    expect(renderPositions(doc)).toBe(before);
    expect(positionOf(doc, "one", "a")).toEqual({ x: 1, y: 2 });
    expect(positionOf(doc, "one", "b")).toEqual({ x: 3, y: 4 });
    // And handed the layout document's own entries, frozen so any write would
    // throw, it filters them and writes nothing.
    const freeze = <T>(o: T): T => {
      if (o && typeof o === "object") {
        for (const v of Object.values(o)) freeze(v);
        Object.freeze(o);
      }
      return o;
    };
    freeze(doc);
    // A position carries neither a kind nor properties, so it is typed as the
    // node shape here only to hand it to the filter.
    const entries = Object.values(doc.boards.one!) as FilterableNode[];
    expect(visibleOn(entries, NO_READER_FILTER)).toEqual(entries);
    expect(visibleOn(entries, { kinds: ["bean"] })).toEqual([]);
    expect(visibleOn(entries, { properties: { status: ["open"] } })).toEqual([]);
    expect(renderPositions(doc)).toBe(before);
  });

  test("the module holds no file name and no schema tag, which is the design", () => {
    // `window-stack.ts`'s rule: state, not a document. A `$schema` here would
    // be the first step towards somebody persisting it.
    const src = readFileSync(new URL("./reader-filter.ts", import.meta.url), "utf-8");
    expect(src).not.toContain("$schema:");
    expect(src).not.toMatch(/\.json"/);
    // The CODE, comments removed (the prose names what it refuses to hold).
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code.length).toBeGreaterThan(0);
    expect(code).not.toContain("$schema");
    expect(code).not.toMatch(/SCHEMA_TAG|_FILE\b/);
    // No string literal names a file or a versioned tag.
    const literals = [...code.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]!);
    for (const lit of literals) {
      expect({ lit, file: /\.(json|jsonld|ya?ml|md|ts|js)\b/.test(lit) }).toEqual({ lit, file: false });
      expect({ lit, tag: /^[\w-]+\/v\d+$/.test(lit) }).toEqual({ lit, tag: false });
    }
    // And it imports nothing, so it has no way to read or write a file.
    expect(code).not.toMatch(/^\s*import\b/m);
    expect(code).not.toMatch(/\brequire\(|readFileSync|writeFileSync/);
  });
});

describe("propertyValues populates a control from the corpus", () => {
  test("every value present, sorted, deduplicated", () => {
    // Sorted because an option list that reorders between renders is one a
    // reader cannot build a habit on.
    expect(propertyValues(NODES, "status")).toEqual(["done", "open"]);
    expect(propertyValues(NODES, "priority")).toEqual(["high", "low"]);
  });

  test("a property nothing carries gives an empty list, not a throw", () => {
    expect(propertyValues(NODES, "nonexistent")).toEqual([]);
  });
});

describe("a multi-valued property — a todo's assignees and beans (todos.jsonld)", () => {
  const MULTI = [
    { kind: "todo", properties: { person: ["github:a", "github:b"] } },
    { kind: "todo", properties: { person: ["github:c"] } },
    { kind: "todo", properties: { person: [] as string[] } },
  ];

  test("a node matches when ANY of its values is selected", () => {
    const f = { properties: { person: ["github:b"] } };
    expect(MULTI.map((n) => readerShows(f, n))).toEqual([true, false, false]);
  });

  test("an empty list cannot answer, so a filter on it excludes the node", () => {
    expect(readerShows({ properties: { person: ["github:a"] } }, MULTI[2]!)).toBe(false);
    expect(readerShows(NO_READER_FILTER, MULTI[2]!)).toBe(true);
  });

  test("every value of every node populates the control, once", () => {
    expect(propertyValues(MULTI, "person")).toEqual(["github:a", "github:b", "github:c"]);
  });
});
