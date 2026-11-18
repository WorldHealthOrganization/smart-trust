/**
 * `kinds` is an array, and the files say what they are.
 *
 * A node declares WHAT TO EXPECT in a directory, not how to tell the contents
 * apart. That division only holds if every kind's files are self-declaring —
 * otherwise a multi-kind node leaves a consumer duck-typing, which is the
 * "distinguishable by extension … a coincidence of the current layout, not a
 * contract" problem #263 named.
 *
 * So these tests pin both halves: the array, and the declarations that make it
 * safe.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseBeanGraph, nodeOfKind, DEFAULT_BEAN_GRAPH } from "../../schemas/sdlc/bean-graph.ts";
import { INSTANCE_SCHEMA } from "../../src/workflow/instance.ts";
import { loadInstance, saveInstance } from "../../src/workflow/store.ts";
import type { InstanceState } from "../../src/workflow/instance.ts";

describe("a node's `kinds` is an array", () => {
  test("one directory may declare several kinds", () => {
    const g = parseBeanGraph({
      name: "t",
      directories: [{ id: "all", path: "store", graphTypologies: ["bean-defs", "workflow-state"] }],
    });
    expect(g.directories[0]!.graphTypologies).toEqual(["bean-defs", "workflow-state"]);
    // Both resolve to the one node — the directory genuinely holds both.
    expect(nodeOfKind(g, "bean-defs")?.id).toBe("all");
    expect(nodeOfKind(g, "workflow-state")?.id).toBe("all");
  });

  test("an empty kinds array is refused", () => {
    // A node holding nothing is a directory nobody should scan; declaring it
    // is worse than omitting it.
    expect(() =>
      parseBeanGraph({ name: "t", directories: [{ id: "x", path: "p", graphTypologies: [] }] }),
    ).toThrow();
  });

  test("an unknown kind is refused, not accepted and ignored", () => {
    expect(() =>
      parseBeanGraph({ name: "t", directories: [{ id: "x", path: "p", graphTypologies: ["nonsense"] }] }),
    ).toThrow();
  });

  test("workflow-state stays limited to ONE node even as an array member", () => {
    // Splitting process state is a correctness problem, not a layout choice:
    // two stores with nothing saying which is authoritative.
    expect(() =>
      parseBeanGraph({
        name: "t",
        directories: [
          { id: "a", path: "one", graphTypologies: ["bean-defs", "workflow-state"] },
          { id: "b", path: "two", graphTypologies: ["workflow-state"] },
        ],
      }),
    ).toThrow(/workflow-state/);
  });

  test("the documented default parses as its own schema", () => {
    // The fallback layout must not be the one shape nothing validates.
    expect(() => parseBeanGraph(DEFAULT_BEAN_GRAPH)).not.toThrow();
  });
});

describe("the files declare what they are — that is what makes the array safe", () => {
  test("a saved workflow instance carries $schema", () => {
    const root = mkdtempSync(join(tmpdir(), "wf-schema-"));
    try {
      const state: InstanceState = {
        id: "i1",
        processId: "p",
        source: "docs/workflows/x.bpmn",
        subject: "s",
        tokens: [],
        arrivals: {},
        history: [],
        status: "running",
        startedAt: "2026-09-18T00:00:00Z",
        updatedAt: "2026-09-18T00:00:00Z",
      };
      const p = saveInstance(root, state);
      const raw = JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown>;
      expect(raw.$schema).toBe(INSTANCE_SCHEMA);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a file written before the tag existed still loads", () => {
    // `$schema` is optional on read: adding a declaration must not orphan the
    // layers already on disk.
    const root = mkdtempSync(join(tmpdir(), "wf-untagged-"));
    try {
      const state = {
        id: "i2",
        processId: "p",
        source: "s.bpmn",
        subject: "s",
        tokens: [],
        arrivals: {},
        history: [],
        status: "running" as const,
        startedAt: "2026-09-18T00:00:00Z",
        updatedAt: "2026-09-18T00:00:00Z",
      };
      saveInstance(root, state);
      const back = loadInstance(root, "i2");
      expect(back?.id).toBe("i2");
      // ...and the next save tags it, rather than only tagging on create.
      expect(back?.$schema).toBe(INSTANCE_SCHEMA);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
