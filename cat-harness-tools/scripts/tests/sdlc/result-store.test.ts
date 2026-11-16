/**
 * `result-store.ts`: content-addressed green results, many per gate, and the
 * rule that only an exact match is ever reused.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { entryDigest, findReusable, gateDir, listResults, MAX_PER_GATE, putResult } from "../../result-store.ts";

type E = { base: string; reads: Record<string, string> };
const R = "recipe-1";

describe("result-store", () => {
  let root: string;
  beforeEach(() => (root = mkdtempSync(join(tmpdir(), "result-store-"))));
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  const put = (entry: E, at: string, gate = "x:check", recipe = R) => putResult<E>(root, { gate, recipe, recordedAt: at, run: `sha-${at}`, entry });

  test("the digest is of gate, recipe and record, whatever the key order", () => {
    const a = entryDigest("g", R, { base: "b", reads: { p: "1", q: "2" } });
    expect(entryDigest("g", R, { reads: { q: "2", p: "1" }, base: "b" })).toBe(a);
    expect(entryDigest("h", R, { base: "b", reads: { p: "1", q: "2" } })).not.toBe(a);
    expect(entryDigest("g", "recipe-2", { base: "b", reads: { p: "1", q: "2" } })).not.toBe(a);
  });

  test("the same inputs file once; different inputs file apart, newest first", () => {
    put({ base: "b", reads: { p: "1" } }, "2026-11-05T01:00:00Z");
    put({ base: "b", reads: { p: "1" } }, "2026-11-05T02:00:00Z");
    put({ base: "b", reads: { p: "2" } }, "2026-11-05T03:00:00Z");
    const all = listResults<E>(root, "x:check", R);
    expect(all.map((r) => r.entry.reads.p)).toEqual(["2", "1"]);
    // The first filing of an entry stands: its run is the one that recorded it.
    expect(all[1]!.recordedAt).toBe("2026-11-05T01:00:00Z");
  });

  test("a gate keeps at most MAX_PER_GATE entries, dropping the oldest", () => {
    for (let i = 0; i < MAX_PER_GATE + 3; i++) put({ base: "b", reads: { p: String(i) } }, `2026-11-05T00:00:${String(i).padStart(2, "0")}Z`);
    const all = listResults<E>(root, "x:check", R);
    expect(all).toHaveLength(MAX_PER_GATE);
    expect(all.at(-1)!.entry.reads.p).toBe("3");
  });

  test("a script name with colons is a directory of its own", () => {
    put({ base: "b", reads: {} }, "t");
    expect(gateDir(root, "x:check")).toContain("x%3Acheck");
    expect(listResults<E>(root, "y:check", R)).toHaveLength(0);
  });

  test("an edited or truncated entry, or another recipe's, is never offered", () => {
    const d = put({ base: "b", reads: { p: "1" } }, "t");
    put({ base: "b", reads: { p: "1" } }, "t", "x:check", "recipe-2");
    const file = join(gateDir(root, "x:check"), `${d}.json`);
    writeFileSync(file, JSON.stringify({ $schema: "cat-gate-result/v1", gate: "x:check", recipe: R, recordedAt: "t", run: "r", entry: { base: "b", reads: { p: "EDITED" } } }));
    expect(listResults<E>(root, "x:check", R)).toHaveLength(0);
    writeFileSync(join(gateDir(root, "x:check"), "junk.json"), "{not json");
    expect(listResults<E>(root, "x:check", R)).toHaveLength(0);
    expect(listResults<E>(root, "x:check", "recipe-2")).toHaveLength(1);
  });

  test("findReusable takes the newest entry the matcher accepts, and names its run", () => {
    put({ base: "b", reads: { p: "1" } }, "2026-11-05T01:00:00Z");
    put({ base: "b", reads: { p: "2" } }, "2026-11-05T02:00:00Z");
    const now = { p: "1" };
    const r = findReusable<E>(root, "x:check", R, (e) => (e.reads.p === now.p ? { skip: true, why: "same" } : { skip: false, why: `p is ${now.p}` }));
    expect(r.reuse).toBe(true);
    if (r.reuse) expect(r.why).toBe("reused sha-2026-11-05T01:00:00Z: same");
  });

  test("nothing stored, nothing matching, or a matcher that throws: the gate runs", () => {
    expect(findReusable<E>(root, "x:check", R, () => ({ skip: true, why: "?" }))).toEqual({ reuse: false, why: "no stored result" });
    put({ base: "b", reads: { p: "1" } }, "t");
    const miss = findReusable<E>(root, "x:check", R, () => ({ skip: false, why: "p changed" }));
    expect(miss).toEqual({ reuse: false, why: "none of 1 stored result(s) matches (newest: p changed)" });
    const threw = findReusable<E>(root, "x:check", R, () => {
      throw new Error("boom");
    });
    expect(threw.reuse).toBe(false);
    expect(readdirSync(gateDir(root, "x:check"))).toHaveLength(1);
  });
});
