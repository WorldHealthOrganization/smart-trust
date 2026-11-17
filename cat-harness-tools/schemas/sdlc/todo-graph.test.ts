/**
 * The todo graph declares its own directories, and refuses what must not be
 * accepted quietly.
 *
 * @module schemas/todo-graph.test
 */
import { describe, expect, test } from "bun:test";

import {
  parseTodoGraph,
  nodeOfKind,
  DEFAULT_TODO_GRAPH,
  TODO_GRAPH_FILE,
  DEFAULT_TODO_GRAPH_ROOT,
  TODO_NODE_KINDS,
} from "./todo-graph";
import { defaultGraphTypologies } from "../kg/cat-harness";

describe("the default layout", () => {
  test("it parses, and names both node kinds", () => {
    const g = parseTodoGraph(DEFAULT_TODO_GRAPH);
    expect(nodeOfKind(g, "todo-items")?.path).toBe("items");
    expect(nodeOfKind(g, "todo-feedback")?.path).toBe("feedback");
  });

  test("both kinds are in the SHARED registry, not a private enum", () => {
    // The vocabulary is `BASE_GRAPH_TYPOLOGIES`. A parallel closed list is exactly
    // what `bean-graph.ts` had to unwind.
    for (const k of TODO_NODE_KINDS) expect(defaultGraphTypologies.has(k)).toBe(true);
  });

  test("the file and root names are declared, not scattered literals", () => {
    expect(TODO_GRAPH_FILE).toBe("todos.json");
    expect(DEFAULT_TODO_GRAPH_ROOT).toBe("todos");
  });
});

describe("what it refuses", () => {
  const ok = { id: "items", path: "items", graphTypologies: ["todo-items"] };

  test("an unknown graph typology is rejected, not accepted and ignored", () => {
    // A node whose kind nothing understands is a store nothing will read.
    expect(() =>
      parseTodoGraph({ name: "x", directories: [{ id: "a", path: "a", graphTypologies: ["no-such-kind"] }] }),
    ).toThrow(/unknown graph typology/);
  });

  test("a duplicate node id is rejected", () => {
    expect(() => parseTodoGraph({ name: "x", directories: [ok, { ...ok }] })).toThrow(/duplicate node id/);
  });

  test("an absolute path is rejected", () => {
    expect(() =>
      parseTodoGraph({ name: "x", directories: [{ ...ok, path: "/etc" }] }),
    ).toThrow(/escapes the graph root/);
  });

  test("a path escaping the root is rejected", () => {
    // A store outside the graph is not a node of it.
    expect(() =>
      parseTodoGraph({ name: "x", directories: [{ ...ok, path: "../elsewhere" }] }),
    ).toThrow(/escapes the graph root/);
  });

  test("an empty directory list is rejected", () => {
    expect(() => parseTodoGraph({ name: "x", directories: [] })).toThrow();
  });
});

describe("what it deliberately allows", () => {
  test("two feedback stores — unlike the bean graph's workflow-state", () => {
    // A folio may keep one feedback store per paper. There is no shared
    // mutable state for a second store to split, so the bean graph's
    // single-node rule has no analogue here.
    const g = parseTodoGraph({
      name: "x",
      directories: [
        { id: "fb-a", path: "feedback/a", graphTypologies: ["todo-feedback"] },
        { id: "fb-b", path: "feedback/b", graphTypologies: ["todo-feedback"] },
      ],
    });
    expect(g.directories).toHaveLength(2);
  });

  test("one directory may hold both kinds — it is a place to look", () => {
    // `graphs` is an array because a directory may hold more than one part of
    // the graph; the FILES say which they are (`$schema: todo/1.0.0`).
    const g = parseTodoGraph({
      name: "x",
      directories: [{ id: "all", path: "all", graphTypologies: ["todo-items", "todo-feedback"] }],
    });
    expect(nodeOfKind(g, "todo-items")).toBe(nodeOfKind(g, "todo-feedback")!);
  });

  test("but the graph ROOT itself is not a node of the graph", () => {
    // Inherited from the bean graph's rule and kept deliberately: `todos/`
    // holds `todos.json`, and a node claiming the same directory makes "which
    // files belong to which node" unanswerable.
    expect(() =>
      parseTodoGraph({ name: "x", directories: [{ id: "root", path: ".", graphTypologies: ["todo-items"] }] }),
    ).toThrow(/escapes the graph root/);
  });
});
