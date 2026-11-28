/**
 * preview-record: an agent-built preview is checked against a full CI
 * rebuild of the same tree (owner, 2026-11-01, Q-SPD-9 B, Q-SPD-9b A;
 * folio-assistant#2881).
 */
import { describe, test, expect } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FRAGMENT } from "../../staging-banner.ts";
import { compareRecords, comparisonText, digestOf, isBuildFact, makeRecord, readRecord, RECORD_FILE } from "../../preview-record.ts";

function tree(files: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), "record-"));
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(d, p, ".."), { recursive: true });
    writeFileSync(join(d, p), c);
  }
  return d;
}

function repo(): string {
  const d = tree({ "index.lock.json": "{}", "a.md": "a" });
  const g = (...a: string[]) => execFileSync("git", ["-C", d, ...a], { stdio: "pipe" });
  g("init", "-q");
  g("-c", "user.name=t", "-c", "user.email=t@t", "add", "-A");
  g("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "x");
  return d;
}

const PAGE = `<html><head><meta name="fa-staging" content="preview"></head><body>${FRAGMENT}<p>x</p></body></html>`;

describe("a record of what a preview build produced", () => {
  const r = repo();
  test("hashes every file but the build facts, and names the tree", () => {
    const site = tree({ "index.html": PAGE, "a/b.css": "b{}", "staging.json": "{\"t\":1}", "_render-log/x.json": "{}" });
    const rec = makeRecord({ site, repo: r, slug: "s1", builder: "agent" });
    expect(Object.keys(rec.files).sort()).toEqual(["a/b.css", "index.html"]);
    expect(rec.tree).toMatch(/^[0-9a-f]{40}$/);
    expect(rec.digest).toBe(digestOf(rec.files));
  });
  test("two builds that differ only in their build facts and slug edits are the same", () => {
    const a = makeRecord({ site: tree({ "index.html": PAGE, "staging.json": "1" }), repo: r, slug: "s1", builder: "agent" });
    const b = makeRecord({ site: tree({ "index.html": PAGE.replace('content="preview"', 'content=""'), "staging.json": "2" }), repo: r, slug: "s1", builder: "ci" });
    expect(compareRecords(a, b).same).toBe(true);
  });
  test("any other difference is reported by path", () => {
    const a = makeRecord({ site: tree({ "index.html": PAGE, "x.js": "1", "old.js": "o" }), repo: r, slug: "s1", builder: "agent" });
    const b = makeRecord({ site: tree({ "index.html": PAGE.replace("<p>x</p>", "<p>y</p>"), "x.js": "1", "new.js": "n" }), repo: r, slug: "s1", builder: "ci" });
    const c = compareRecords(a, b);
    expect(c.same).toBe(false);
    expect(c.changed).toEqual(["index.html"]);
    expect(c.onlyClaimed).toEqual(["old.js"]);
    expect(c.onlyRebuilt).toEqual(["new.js"]);
    expect(comparisonText(c, { slug: "s1" })).toContain("replaced it");
  });
  test("builds of different trees are never compared file by file", () => {
    const a = makeRecord({ site: tree({ "x": "1" }), repo: r, slug: "s1", builder: "agent" });
    const c = compareRecords(a, { ...a, tree: "0".repeat(40) });
    expect(c.same).toBe(false);
    expect(c.incomparable).toContain("different trees");
    expect(comparisonText(c, { slug: "s1" })).toContain("stale");
  });
  test("an empty build is refused, not recorded", () => {
    expect(() => makeRecord({ site: tree({ "staging.json": "1" }), repo: r, slug: "s1", builder: "agent" })).toThrow("no files");
  });
  test("a record whose digest does not match its files is refused", () => {
    const rec = makeRecord({ site: tree({ "x": "1" }), repo: r, slug: "s1", builder: "agent" });
    const d = tree({ [RECORD_FILE]: JSON.stringify({ ...rec, files: { x: "f".repeat(64) } }) });
    expect(() => readRecord(join(d, RECORD_FILE))).toThrow("digest");
    const ok = tree({ [RECORD_FILE]: JSON.stringify(rec) });
    expect(readRecord(join(ok, RECORD_FILE)).digest).toBe(rec.digest);
  });
  test("the build-fact list is fixed in code", () => {
    expect(isBuildFact(RECORD_FILE)).toBe(true);
    expect(isBuildFact("_render-log/a")).toBe(true);
    expect(isBuildFact("en/index.html")).toBe(false);
  });
});
