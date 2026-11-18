/**
 * No QA checker is a silent n/a stub (folio-assistant-89wq, as a class).
 *
 * `qa-checkers-stub-sentinels.test.ts` pins the four stubs the bean named by
 * CALLING them. This reads the checker modules' SOURCE instead, so it needs
 * none of their imports (that file currently fails to load on main through
 * folio-assistant-sci's `qa-checkers-cost.ts`, a moved-path import) and it
 * covers a stub nobody has named yet.
 *
 * @module scripts/tests/qa-checkers-no-silent-stub.test
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

/**
 * The CLASS, not the four. Every exported `check*` in the checker modules
 * whose whole body is one `return` of `n/a` must say so in its notes, or a
 * fifth stub lands looking exactly like a correct decline — the defect this
 * bean measured at 8949 sidecar entries. Read from source, because a stub is
 * a property of the body: no call can tell "declined" from "never looked".
 */
describe("no checker is a silent n/a stub (folio-assistant-89wq, as a class)", () => {
  const DIR = join(import.meta.dir, "../../pipeline");
  const MODULES = readdirSync(DIR).filter((f) => /^qa-checkers.*\.ts$/.test(f) && !f.endsWith(".test.ts"));

  /** Each exported checker's name and body, cut at the first `}` in column 0. */
  function checkers(src: string): { name: string; body: string }[] {
    const out: { name: string; body: string }[] = [];
    for (const m of src.matchAll(/^export function (check\w+)\s*\([\s\S]*?\)\s*:\s*[\w<>[\]| ]+\s*\{\n([\s\S]*?)^\}/gm)) {
      out.push({ name: m[1]!, body: m[2]! });
    }
    return out;
  }

  /** A body with exactly one statement-level `return`, and that one `n/a`. */
  function isStub(body: string): boolean {
    const code = body.replace(/^\s*\/\/.*$/gm, "");
    const returns = code.match(/\breturn\b/g) ?? [];
    return returns.length === 1 && /return\s*\{\s*result:\s*"n\/a"/.test(code);
  }

  test("the checker modules are found and parsed", () => {
    expect(MODULES.length).toBeGreaterThan(0);
    const all = MODULES.flatMap((f) => checkers(readFileSync(join(DIR, f), "utf8")));
    // The four this bean names are among them, so the parse reaches the file's tail.
    for (const n of ["checkDetanglerNoXChapterFwd", "checkDetanglerArchimedeanWall", "checkVoiceTitleScholarly"]) {
      expect(all.map((c) => c.name)).toContain(n);
    }
  });

  test("the stub detector fires on a stub and not on a decline that looked", () => {
    expect(isStub('  return { result: "n/a", hits: [] };\n')).toBe(true);
    expect(isStub('  if (!p) return { result: "n/a", hits: [] };\n  return { result: "pass", hits: [] };\n')).toBe(false);
  });

  test("every stub carries the not-implemented sentinel", () => {
    const silent: string[] = [];
    for (const f of MODULES) {
      for (const c of checkers(readFileSync(join(DIR, f), "utf8"))) {
        if (isStub(c.body) && !/notes:\s*"not implemented: /.test(c.body)) silent.push(`${f}: ${c.name}`);
      }
    }
    expect(silent).toEqual([]);
  });
});
