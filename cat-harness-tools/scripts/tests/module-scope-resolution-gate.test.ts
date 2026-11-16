/**
 * The gate must catch the hazard and must NOT catch its own remedy.
 *
 * Both halves are load-bearing, and this gate has been written twice and got
 * the second half wrong both times. The first version flagged
 * `const X = (): string => folioDir(root)`; widening the pattern to reach
 * nested calls then flagged
 * `const X = deferResolution(() => join(folioDir(root), "y"), …)` — the very
 * shape its own failure message recommends. A gate that reports its remedy is
 * worse than no gate: the only way to satisfy it is to stop using the fix.
 *
 * @module scripts/tests/module-scope-resolution-gate.test
 */
import { describe, test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { checkModuleScopeResolution } from "../check-module-scope-resolution.ts";
import { writeDeclaration } from "../../test/support/instance-fixture.js";

/** A repo with one layer holding one module, and nothing else. */
function repoWith(source: string): string {
  const root = mkdtempSync(join(tmpdir(), "modscope-"));
  const inst = join(root, "thing");
  mkdirSync(join(inst, "content", "pipeline"), { recursive: true });
  writeDeclaration(inst, JSON.stringify({ name: "thing", directories: [] }));
  writeFileSync(join(inst, "content", "pipeline", "m.ts"), source, "utf-8");
  return root;
}

const hits = (src: string) => checkModuleScopeResolution(repoWith(src)).findings.map((f) => f.text);

describe("the hazard is caught", () => {
  test("a call in first position", () => {
    expect(hits(`const FOLIO_DIR = folioDir(ROOT);\n`)).toHaveLength(1);
  });

  test("a call NESTED in another — the shape the anchored pattern missed", () => {
    // Ten real sites looked like this and were reported clean until
    // 2026-09-21: `= folioDir\(` only matches the first position.
    expect(hits(`const LEDGER = join(folioDir(ROOT), "x.json");\n`)).toHaveLength(1);
  });

  test("the two resolvers beyond folioDir, which also throw", () => {
    expect(hits(`const U = directoryForGraph(ROOT, "uploads") ?? join(ROOT, "uploads");\n`)).toHaveLength(1);
    expect(hits(`const L = directoriesForGraph(ROOT, "library");\n`)).toHaveLength(1);
  });

  test("`let` and `var`, not just `const`", () => {
    expect(hits(`let a = folioDir(ROOT);\n`)).toHaveLength(1);
    expect(hits(`var b = folioDir(ROOT);\n`)).toHaveLength(1);
  });
});

describe("the remedy is NOT caught", () => {
  test("deferResolution over a nested call", () => {
    expect(
      hits(`const LEDGER = deferResolution(() => join(folioDir(ROOT), "x.json"), {\n  moduleUrl: import.meta.url,\n});\n`),
    ).toEqual([]);
  });

  test("a hand-written accessor — the arrow is the rule, not the helper's name", () => {
    expect(hits(`const FOLIO_DIR = (): string => folioDir(ROOT);\n`)).toEqual([]);
  });

  test("a call inside a function body is not module scope at all", () => {
    expect(hits(`function f() {\n  const d = folioDir(ROOT);\n  return d;\n}\n`)).toEqual([]);
  });
});

describe("findContentRepoRoot is deliberately absent", () => {
  test("it is not flagged, because it cannot throw", () => {
    // Made total in #695: every `folioDir` probe inside it is wrapped and it
    // ends in a declared fallback. A gate against a hazard that does not exist
    // is where a reader learns something false.
    expect(hits(`const REPO_ROOT = findContentRepoRoot();\n`)).toEqual([]);
  });
});

describe("examining nothing is not a pass", () => {
  test("an empty repo reports that it read no files", () => {
    const empty = mkdtempSync(join(tmpdir(), "modscope-empty-"));
    expect(checkModuleScopeResolution(empty).filesRead).toBe(0);
  });
});
