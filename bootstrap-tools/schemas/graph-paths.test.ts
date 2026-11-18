/**
 * A path a declaration names stays inside the declaring directory (bean
 * `dnrj`): no leading slash or backslash, no drive letter, no `..` segment.
 * The pattern is on Subgraph.path and Asset.src, and it reaches the JSON
 * Schema the generator emits, so dropping either `.regex()` fails here.
 */
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { AssetSchema, SubgraphSchema } from "./graph.ts";

const REFUSED = ["/abs", "\\abs", "C:/x", "c:x", "..", "../x", "a/../b", "a/..", "a\\..\\b"];
const ACCEPTED = ["x", "x/", "a/b/c/", "a..b", "..a/", "a/b..c", "a/.hidden"];

const subgraph = (path: string) => SubgraphSchema.safeParse({ id: "s", path, graphTypologies: ["x"] }).success;
const asset = (src: string) => AssetSchema.safeParse({ id: "a", src, role: "r" }).success;

describe("declared paths stay inside the declaring directory", () => {
  for (const p of REFUSED) {
    test(`refusesEscapingPath[${p}]`, () => {
      expect(subgraph(p)).toBe(false);
      expect(asset(p)).toBe(false);
    });
  }
  for (const p of ACCEPTED) {
    test(`acceptsContainedPath[${p}]`, () => {
      expect(subgraph(p)).toBe(true);
      expect(asset(p)).toBe(true);
    });
  }
  test("jsonSchemaCarriesPathPattern", () => {
    const s = z.toJSONSchema(SubgraphSchema, { io: "input" }) as { properties: Record<string, { pattern?: string }> };
    const a = z.toJSONSchema(AssetSchema, { io: "input" }) as { properties: Record<string, { pattern?: string }> };
    expect(s.properties.path.pattern).toBeTruthy();
    expect(a.properties.src.pattern).toBe(s.properties.path.pattern);
  });
});
