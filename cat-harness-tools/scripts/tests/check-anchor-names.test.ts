/**
 * The anchor-name check, and the boundary of what it claims.
 *
 * Bean `b963`, fourth class. The last test here is the important one: it
 * asserts that this check does NOT catch the defect the class is named for,
 * so nobody later mistakes a green run for coverage it does not have.
 *
 * @module folio-assistant/scripts/tests/check-anchor-names
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AMBIGUOUS_NAMES, checkAnchorNames, instanceDirs } from "../check-anchor-names.ts";
import { writeDeclaration } from "../../test/support/instance-fixture.js";

/** A repo with one layer at `cat-harness/`, holding `scripts/tests/a.ts`. */
function fixture(src: string): string {
  const root = mkdtempSync(join(tmpdir(), "anchors-"));
  mkdirSync(join(root, "cat-harness", "scripts", "tests"), { recursive: true });
  writeDeclaration(join(root, "cat-harness"), { name: "cat-harness" });
  writeFileSync(join(root, "cat-harness", "scripts", "tests", "a.ts"), src);
  return root;
}

describe("a name that claims an anchor must land on it", () => {
  test("REPO_ROOT landing on an instance root is a finding, and names its fix", () => {
    // `../..` from cat-harness/scripts/tests/ is cat-harness/ — a layer.
    const r = checkAnchorNames(fixture('const REPO_ROOT = resolve(import.meta.dir, "..", "..");\n'));
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]!.detail).toContain("rename it to `INSTANCE_ROOT`");
  });

  test("INSTANCE_ROOT landing on the repository root is a finding the other way", () => {
    const r = checkAnchorNames(fixture('const INSTANCE_ROOT = resolve(import.meta.dir, "..", "..", "..");\n'));
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]!.detail).toContain("rename it to `REPO_ROOT`");
  });

  test.each([
    ['const INSTANCE_ROOT = resolve(import.meta.dir, "..", "..");', "instance root, correctly named"],
    ['const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");', "repository root, correctly named"],
    ['const OUT_DIR = resolve(import.meta.dir, "..", "build");', "a name claiming no anchor at all"],
  ])("%s is clean — %s", (src) => {
    expect(checkAnchorNames(fixture(src + "\n")).findings).toEqual([]);
  });
});

describe("a symbolic link is not walked", () => {
  test("a file reached through a link is judged at its real path only", () => {
    // `cat-harness/scripts/tests/a.ts` is correct where it lives. Read through
    // `cat-harness/content/scripts -> ../scripts`, its `../..` would count
    // from the link and land one level off (bean rnfl's transitional link).
    const root = fixture('const INSTANCE_ROOT = resolve(import.meta.dir, "..", "..");\n');
    mkdirSync(join(root, "cat-harness", "content"));
    symlinkSync("../scripts", join(root, "cat-harness", "content", "scripts"));
    const r = checkAnchorNames(root);
    expect(r.filesRead).toBe(1);
    expect(r.findings).toEqual([]);
  });
});

describe("PLATFORM is refused because it means two things HERE", () => {
  test("it is a finding wherever it lands", () => {
    const inst = checkAnchorNames(fixture('const PLATFORM = resolve(import.meta.dir, "..", "..");\n'));
    const repo = checkAnchorNames(fixture('const PLATFORM = resolve(import.meta.dir, "..", "..", "..");\n'));
    expect(inst.findings).toHaveLength(1);
    expect(repo.findings).toHaveLength(1);
    // And it tells you which one to use, from where it actually landed.
    expect(inst.findings[0]!.detail).toContain("`INSTANCE_ROOT`");
    expect(repo.findings[0]!.detail).toContain("`REPO_ROOT`");
  });

  test("the vocabulary is the reason, not a style preference", () => {
    // Measured 2026-09-20: within cat-harness/scripts/tests/ alone,
    // init-folio.test.ts used PLATFORM for the repository root while five
    // siblings used it for cat-harness/. One name, two anchors, one directory.
    expect(AMBIGUOUS_NAMES.test("PLATFORM")).toBe(true);
    expect(AMBIGUOUS_NAMES.test("platformRoot")).toBe(true);
  });
});

describe("what this check does NOT claim", () => {
  test("a re-rooted ascent with a truthful name passes — the defect is NOT caught", () => {
    // THE POINT OF THIS TEST. `INSTANCE_ROOT` landing on a layer root is
    // clean whatever the fixture then does with it, which is exactly how
    // init-folio.test.ts's PLATFORM survived its move. Three designs that
    // tried to catch the real defect were measured and failed; this one
    // removes the ambiguity the defect hid behind and no more. A later
    // session must not read a green run as coverage of the fourth class.
    const r = checkAnchorNames(fixture('const INSTANCE_ROOT = resolve(import.meta.dir, "..", "..");\n'));
    expect(r.findings).toEqual([]);
  });

  test("EXAMINED NOTHING is not a pass", () => {
    const root = mkdtempSync(join(tmpdir(), "anchors-empty-"));
    expect(checkAnchorNames(root).filesRead).toBe(0);
  });

  test("instances are discovered by harness.json, never listed", () => {
    const root = fixture("\n");
    mkdirSync(join(root, "who-iris"), { recursive: true });
    writeDeclaration(join(root, "who-iris"), { name: "who-iris" });
    expect(instanceDirs(root).sort()).toEqual(["cat-harness", "who-iris"]);
  });
});

describe("a quoted example of an ascent is not an ascent", () => {
  test("a fixture string is skipped — this file would otherwise report itself", () => {
    // Measured: the first run of this check reported three findings against
    // THIS test file, because its fixtures embed sample ascents as strings.
    // A check that cannot tell code from a quoted example of code gets
    // reported to by every test exercising it, which is the fastest route to
    // somebody deleting it.
    const src = [
      'const SAMPLE = \'const REPO_ROOT = resolve(import.meta.dir, "..", "..");\';',
      'const REAL = resolve(import.meta.dir, "..", "..");',
    ].join("\n");
    const r = checkAnchorNames(fixture(src + "\n"));
    // One ascent counted (the real one), and it is correctly named, so clean.
    expect(r.ascents).toBe(1);
    expect(r.findings).toEqual([]);
  });
});

describe("every spelling of the base is matched", () => {
  // WHY THIS BLOCK EXISTS. Until 2026-09-27 the base alternation was
  // `import.meta.dir|__dirname` only, so an ascent written in either
  // `dirname()` spelling was not an ascent as far as the check was concerned.
  // On `main` at `e6404bc80de` that hid 75 ascents, 9 of them findings —
  // `REPO_ROOT`/`REPO` landing on `cat-harness/` — while the check printed
  // "every name that claims an anchor lands on it".
  //
  // The alternation is an ENUMERATION and cannot stop being one: a base is a
  // syntactic form, so there is no filesystem to ask the way `instanceDirs`
  // asks it. A case PER SPELLING is what stands in for the guarantee — drop a
  // form from the alternation and its case goes red here, rather than the
  // check going quietly green over a seventh of its subject.
  const BASES = [
    ["import.meta.dir", "import.meta.dir"],
    ["__dirname", "__dirname"],
    ["dirname(fileURLToPath(import.meta.url))", "portable ESM"],
    ["dirname(__filename)", "CJS via __filename"],
  ] as const;

  test.each(BASES)("resolve(%s, ...) is an ascent — %s", (base) => {
    const r = checkAnchorNames(fixture(`const REPO_ROOT = resolve(${base}, "..", "..");\n`));
    expect(r.ascents).toBe(1);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]!.detail).toContain("rename it to `INSTANCE_ROOT`");
  });

  test.each(BASES)("join(%s, ...) is an ascent too — %s", (base) => {
    const r = checkAnchorNames(fixture(`const REPO_ROOT = join(${base}, "..", "..");\n`));
    expect(r.ascents).toBe(1);
    expect(r.findings).toHaveLength(1);
  });

  test("a correctly-named anchor in a dirname() spelling stays clean", () => {
    // The point is coverage, not a new source of findings: extending the base
    // must not make a truthful name red.
    const r = checkAnchorNames(
      fixture('const INSTANCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");\n'),
    );
    expect(r.ascents).toBe(1);
    expect(r.findings).toEqual([]);
  });

  test("whitespace inside the dirname() call does not hide the ascent", () => {
    const r = checkAnchorNames(
      fixture('const REPO_ROOT = resolve( dirname( fileURLToPath( import.meta.url ) ) , "..", "..");\n'),
    );
    expect(r.ascents).toBe(1);
    expect(r.findings).toHaveLength(1);
  });
});
