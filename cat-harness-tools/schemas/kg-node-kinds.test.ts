/**
 * `KgRef.kind` is a closed list (#1168 B9c), so it must cover every node kind
 * the exported graph mints — otherwise a reference to a real node would fail
 * to parse.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { KG_NODE_KINDS, KgRefSchema } from "./kg/carried-note.js";

describe("KgRef.kind is closed, and covers the graph", () => {
  test("every kind kg-export mints an IRI for is a KG_NODE_KIND", () => {
    const src = readFileSync(join(import.meta.dir, "..", "scripts", "kg-export.ts"), "utf8");
    const minted = [...new Set([...src.matchAll(/makeIri\(doc, "([a-z-]+)"/g)].map((m) => m[1]!))];
    expect(minted.length).toBeGreaterThan(5);
    expect(minted.filter((k) => !(KG_NODE_KINDS as readonly string[]).includes(k))).toEqual([]);
  });

  test("a typo does not parse", () => {
    expect(KgRefSchema.safeParse({ kind: "skill", id: "kg-export" }).success).toBe(true);
    expect(KgRefSchema.safeParse({ kind: "skil", id: "kg-export" }).success).toBe(false);
  });
});
