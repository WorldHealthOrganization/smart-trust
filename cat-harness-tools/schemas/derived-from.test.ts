/**
 * `derivedFrom` on a directory declaration (bean `nama`): what a derived graph is
 * computed FROM. Resolution and order are `check:derived-from`'s; this pins the
 * shape alone.
 */
import { describe, expect, test } from "bun:test";

import { ContentDirectorySchema } from "./kg/cat-harness.ts";

const dir = (extra: Record<string, unknown>) => ({ id: "ig-docs", path: "docs/", graphTypologies: ["docs"], ...extra });

describe("derivedFrom", () => {
  test("absent is valid: 'not declared', which check:derived-from reports separately", () => {
    expect(ContentDirectorySchema.safeParse(dir({})).success).toBe(true);
  });
  test("a list of directory ids is valid", () => {
    const r = ContentDirectorySchema.safeParse(dir({ derivedFrom: ["artifact-index", "ig-ast"] }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.derivedFrom).toEqual(["artifact-index", "ig-ast"]);
  });
  test("an empty list says nothing a reader can act on, so it is refused", () => {
    expect(ContentDirectorySchema.safeParse(dir({ derivedFrom: [] })).success).toBe(false);
  });
  test("an empty id is refused", () => {
    expect(ContentDirectorySchema.safeParse(dir({ derivedFrom: [""] })).success).toBe(false);
  });
  test("an id named twice is refused", () => {
    const r = ContentDirectorySchema.safeParse(dir({ derivedFrom: ["a", "a"] }));
    expect(r.success).toBe(false);
    if (!r.success) expect(JSON.stringify(r.error.issues)).toContain("derivedFrom names an id twice");
  });
});
