/**
 * `xd1g` Done-when 3 — the census the owner ruled should ship.
 *
 * It reports and does not fail on its findings, so the cases that matter are
 * about the MEASUREMENT being honest rather than about a verdict.
 *
 * The tests of this file that read the whole checkout (scans
 * folio-assistant-core's scripts) live in
 * `test/root-scan-census-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { build, census, censusRepository } from "../root-scan-census.ts";
import { TOOLS_ROOT } from "../lib/roots.ts";

function repo(files: Record<string, string>): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "census-"));
  spawnSync("git", ["init", "-q"], { cwd: dir });
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("the census covers the repository, and says which instances it scanned (tqv4)", () => {
  const decl = (name: string) => JSON.stringify({ name, version: "0.1.0", directories: [] });

  test("a script in a SECOND instance is counted — moving a script up never drops it from the census", () => {
    // The defect: the census scanned only its own layer, so every script
    // moved into another read as one fewer scanner, and the headline family
    // read 0 of 0 while its only member sat one directory over.
    const { dir, cleanup } = repo({
      "alpha/alpha.json": decl("alpha"),
      "alpha/scripts/a.ts": 'const ROOT = "x";\nreaddirSync(ROOT);\n',
      "beta/beta.json": decl("beta"),
      "beta/scripts/b.ts": 'const REPO_ROOT = "x";\nreaddirSync(REPO_ROOT);\n',
      "gamma/gamma.json": decl("gamma"),
    });
    const { rows, scope } = censusRepository(dir);
    expect(rows.map((r) => r.file).sort()).toEqual(["alpha/scripts/a.ts", "beta/scripts/b.ts"]);
    expect(scope.map((s) => [s.instance, s.state, s.enumerating])).toEqual([
      ["alpha", "scanned", 1],
      ["beta", "scanned", 1],
      ["gamma", "no-scripts-dir", 0],
    ]);
    cleanup();
  });

  test("the sidecar carries the scope, so a drop in scope cannot read as a drop in scanners", () => {
    const { dir, cleanup } = repo({
      "alpha/alpha.json": decl("alpha"),
      "alpha/scripts/a.ts": 'const ROOT = "x";\nreaddirSync(ROOT);\n',
    });
    const { rows, scope } = censusRepository(dir);
    const fam = build(rows, scope).families.scope;
    expect(fam.entries).toEqual([{ instance: "alpha", path: "alpha/scripts", state: "scanned", enumerating: 1 }]);
    cleanup();
  });
});

describe("root-scan census", () => {
  test("A CONVERTED SCANNER STAYS IN THE DENOMINATOR", () => {
    // The load-bearing case, and it is a defect this census actually had for
    // one run. A converted scanner no longer contains `readdirSync` or
    // `new Glob` — that IS the conversion — so a bare-walk-only pattern drops
    // it from the population instead of moving it to the population's good
    // side. The first run read "57 enumerating scripts, 1 asks git" on a tree
    // where eleven had just been converted.
    //
    // A measurement whose headline gets WORSE as the corpus improves is worse
    // than none, which is the failure this whole bean is about — committed in
    // the census reporting on it.
    const { dir, cleanup } = repo({
      "scripts/converted.ts": 'const ROOT = "x";\ngitFiles(ROOT, () => true);\n',
      "scripts/unconverted.ts": 'const ROOT = "x";\nreaddirSync(ROOT);\n',
    });
    const rows = census(join(dir, "scripts"));
    expect(rows.map((r) => r.file.split("/").at(-1)).sort()).toEqual(["converted.ts", "unconverted.ts"]);
    expect(rows.find((r) => r.file.endsWith("converted.ts"))?.gitAware).toBe(true);
    expect(rows.find((r) => r.file.endsWith("unconverted.ts"))?.gitAware).toBe(false);
    cleanup();
  });

  test("a script that enumerates but binds no root constant is not censused", () => {
    // The loose filter is already an over-count; without this it would sweep
    // every `readdirSync` in the repository and report a number nobody could
    // act on at all.
    const { dir, cleanup } = repo({ "scripts/local.ts": 'readdirSync(someDir);\n' });
    expect(census(join(dir, "scripts"))).toEqual([]);
    cleanup();
  });

  test("`seededAtRoot` is narrower than `enumerates`, and that GAP is the finding", () => {
    // The two filters disagree by design. A recursion helper defeats the tight
    // one, which is exactly why a syntactic check cannot answer this question
    // and the real guard is behavioural.
    const { dir, cleanup } = repo({
      "scripts/seeded.ts": 'const REPO_ROOT = "x";\nreaddirSync(REPO_ROOT);\n',
      "scripts/helper.ts": 'const REPO_ROOT = "x";\nconst go = (d) => readdirSync(d);\ngo(REPO_ROOT);\n',
    });
    const rows = census(join(dir, "scripts"));
    expect(rows.find((r) => r.file.endsWith("seeded.ts"))?.seededAtRoot).toBe(true);
    // Missed by the tight filter — recorded as the known limit, not as a pass.
    expect(rows.find((r) => r.file.endsWith("helper.ts"))?.seededAtRoot).toBe(false);
    cleanup();
  });

  test("tests and declaration files are not scanners", () => {
    const { dir, cleanup } = repo({
      "scripts/a.test.ts": 'const ROOT = "x";\nreaddirSync(ROOT);\n',
      "scripts/b.d.ts": 'const ROOT = "x";\nreaddirSync(ROOT);\n',
    });
    expect(census(join(dir, "scripts"))).toEqual([]);
    cleanup();
  });

  test("it is DISCRIMINATING over this repository", () => {
    // The vacuity control: a census that found nothing would satisfy every
    // shape assertion above while measuring nothing at all.
    const rows = census(resolve(import.meta.dir, ".."));
    expect(rows.length).toBeGreaterThan(20);
    expect(rows.some((r) => r.gitAware)).toBe(true);
  });
});

/**
 * `qrlc` — the git-helper roster is DERIVED, not listed.
 *
 * This census has now had the same defect twice: a scanner that was fixed fell
 * out of the population instead of moving to its good side, so the headline
 * got worse as the corpus improved.
 *
 *   1. The first time, `ENUMERATES` matched only bare walks, and a conversion
 *      removes the `readdirSync` it keyed on. Fixed by admitting the git
 *      spellings — as a HARDCODED list.
 *   2. The second time, that list went stale the hour it was written:
 *      `gitTopLevelDirs` was added, three scanners were converted to call it,
 *      and the census read 66/10 before and **65/10** after. The three had
 *      left the denominator and the git-aware count had not moved.
 *
 * Both are one class — a roster kept by hand beside the thing it tracks — and
 * it is the same class as the dead `SKILLS_CATEGORIES` key and the stale
 * `coverage.visualiser` refs. The repair is to stop keeping the roster.
 */
describe("the git-helper roster is derived from git-corpus.ts", () => {
  test("EVERY exported helper is recognised as git-aware", () => {
    // The regression test for defect 2, written against the real module so a
    // helper added tomorrow is covered without anybody editing this file.
    const src = readFileSync(resolve(TOOLS_ROOT, "schemas", "sdlc", "git-corpus.ts"), "utf-8");
    const helpers = [...src.matchAll(/^export function (\w+)/gm)].map((m) => m[1]!);
    expect(helpers.length).toBeGreaterThan(3);

    const { dir, cleanup } = repo(
      Object.fromEntries(
        helpers.map((h, i) => [`scripts/uses-${i}.ts`, `const ROOT = "x";\n${h}(ROOT);\n`]),
      ),
    );
    const rows = census(join(dir, "scripts"));
    expect(rows).toHaveLength(helpers.length);
    const notRecognised = rows.filter((r) => !r.gitAware).map((r) => r.file);
    expect(notRecognised).toEqual([]);
    cleanup();
  });

  test("a converted scanner MOVES to the good side rather than leaving", () => {
    // Stated as the invariant rather than as a count, because a count is what
    // went stale. Converting must not shrink the population.
    const bare = { "scripts/s.ts": 'const ROOT = "x";\nreaddirSync(ROOT);\n' };
    const converted = { "scripts/s.ts": 'const ROOT = "x";\ngitTopLevelDirs(ROOT);\n' };
    const a = repo(bare);
    const b = repo(converted);
    const before = census(join(a.dir, "scripts"));
    const after = census(join(b.dir, "scripts"));
    expect(after).toHaveLength(before.length);
    expect(before[0]?.gitAware).toBe(false);
    expect(after[0]?.gitAware).toBe(true);
    a.cleanup();
    b.cleanup();
  });
});
