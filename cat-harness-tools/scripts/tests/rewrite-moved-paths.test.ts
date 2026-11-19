/**
 * `rewrite-moved-paths.ts`: rewrite a mention only where the file moved, and
 * never inside a record.
 *
 * @graphNode none — a test
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { DEFAULT_RECORD_GLOBS, isRecord, rewriteMovedPaths } from "../rewrite-moved-paths.ts";

let base: string;
let src: string;
let dst: string;

function put(root: string, rel: string, text = "x\n"): void {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
}

const SKILL = "skills/a/how.md";
const PROPOSAL = "docs/proposals/plan-2026.md";
const MEMORY = "memory/a-note.md";
const FIXTURE = "schemas/thing.test.ts";
const LINE = "Run `bun run oldlayer/scripts/moved.ts` then read oldlayer/scripts/stays.ts and oldlayer/scripts/nowhere.ts.\n";

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "rewrite-moved-"));
  src = join(base, "oldlayer");
  dst = join(base, "newlayer");
  put(dst, "scripts/moved.ts"); // moved: in the destination only
  put(src, "scripts/stays.ts"); // still in the source
  put(dst, "scripts/stays.ts"); // …and a same-named file in the destination: NOT a move
  for (const f of [SKILL, PROPOSAL, MEMORY, FIXTURE]) put(src, f, LINE);
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

const opts = () => ({
  scan: src,
  fromName: "oldlayer",
  fromRoot: src,
  toName: "newlayer",
  toRoot: dst,
  prefixes: ["scripts"],
  files: [SKILL, PROPOSAL, MEMORY, FIXTURE],
});

describe("rewrite-moved-paths", () => {
  test("reports without writing by default", () => {
    const r = rewriteMovedPaths(opts());
    expect(r.rewrites.map((w) => [w.file, w.to])).toEqual([[SKILL, "newlayer/scripts/moved.ts"]]);
    expect(readFileSync(join(src, SKILL), "utf-8")).toBe(LINE);
  });

  test("rewrites only a path whose file is in the destination and not in the source", () => {
    const r = rewriteMovedPaths(opts(), true);
    expect(readFileSync(join(src, SKILL), "utf-8")).toBe(
      "Run `bun run newlayer/scripts/moved.ts` then read oldlayer/scripts/stays.ts and oldlayer/scripts/nowhere.ts.\n",
    );
    expect(r.leftAlone.map((w) => w.from).sort()).toEqual(["oldlayer/scripts/nowhere.ts", "oldlayer/scripts/stays.ts"]);
  });

  test("never reads, let alone rewrites, a record: proposals, memory, fixtures", () => {
    const r = rewriteMovedPaths(opts(), true);
    expect(r.records.sort()).toEqual([MEMORY, PROPOSAL, FIXTURE].sort());
    for (const f of [PROPOSAL, MEMORY, FIXTURE]) expect(readFileSync(join(src, f), "utf-8")).toBe(LINE);
  });

  test("a second run owes nothing, which is what --check gates on", () => {
    rewriteMovedPaths(opts(), true);
    expect(rewriteMovedPaths(opts()).rewrites).toEqual([]);
  });

  test("the record shapes the 70lx sweep kept", () => {
    for (const f of ["beans/defs/x.md", "test/results/kg-qa/a.json", "upstream/upstream-pins.json", "library/p/vector-figures.json", "a/b/c.test.ts"]) {
      expect(isRecord(f, DEFAULT_RECORD_GLOBS)).toBe(true);
    }
    for (const f of ["skills/a/b.md", "docs/guides/x.md", "AGENTS.md", "schemas/x.ts"]) expect(isRecord(f, DEFAULT_RECORD_GLOBS)).toBe(false);
  });
});
