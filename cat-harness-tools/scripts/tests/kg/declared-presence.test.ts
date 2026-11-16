/** Bean `95ir` — a declared-but-absent library is reported, distinct from empty, and never fails a scanner. */
import { describe, expect, test } from "bun:test";

import { noteAbsent, splitDeclared } from "../../lib/declared-presence.ts";

describe("declared, and on disk or not", () => {
  test("splits without dropping", () => {
    const r = splitDeclared(["/a", "/b", "/c"], (p) => p !== "/b");
    expect(r).toEqual({ present: ["/a", "/c"], absent: ["/b"] });
  });
  test("an absent one is SAID — in words that are not 'empty' — and said once", () => {
    const lines: string[] = [];
    noteAbsent(["/lib-x"], "a library", (s) => lines.push(s));
    noteAbsent(["/lib-x"], "a library", (s) => lines.push(s));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("not on disk");
    expect(lines[0]).toContain("NOT read as empty");
  });
});
