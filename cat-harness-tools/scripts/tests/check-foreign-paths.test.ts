/**
 * `check:foreign-paths` (bean `gz47`): what counts as a foreign literal, the
 * `docs/` rule that keeps it from crying wolf, and the one-way ratchet.
 */
import { describe, expect, test } from "bun:test";

import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { foreignTargets, judge, notThisCheckouts, overLines, scanText, type InstanceDirs } from "../check-foreign-paths.ts";
import { TOOLS_ROOT } from "../lib/roots.ts";

const ROOT: InstanceDirs = { name: "root", root: "", dirs: ["beans", "fsh-guts", "themes", "uploads"] };
const HARNESS: InstanceDirs = { name: "harness", root: "harness", dirs: ["harness/themes", "harness/skills"] };
const ALL = [ROOT, HARNESS];
const targets = foreignTargets(HARNESS, ALL);
const scan = (text: string) => scanText(text, "harness/scripts/x.ts", "harness", targets);

describe("which names are foreign", () => {
  test("a name only another instance declares is foreign; a shared name is not (the `docs/` rule, shown with `themes`)", () => {
    const dirs = targets.map((t) => t.dir).sort();
    expect(dirs).toEqual(["beans", "fsh-guts", "uploads"]);
  });
  test("a directory inside the scanner's own tree is never foreign to it", () => {
    expect(foreignTargets(ROOT, ALL).map((t) => t.dir)).not.toContain("harness/themes");
  });
});

describe("what a scan counts", () => {
  test("a spelled path into another instance's directory is counted, with its owner", () => {
    const r = scan('const A = "fsh-guts/uploads";\n');
    expect(r.counted).toHaveLength(1);
    expect(r.counted[0]).toMatchObject({ target: "fsh-guts", owner: "root", line: 1 });
  });
  test("a bare segment counts only as the first literal of a path-building call", () => {
    expect(scan('readdirSync(join(ROOT, "beans", "defs"));\n').counted).toHaveLength(1);
    expect(scan('const tool = { id: "beans" };\n').counted).toHaveLength(0);
    expect(scan('join(ROOT, "x", "beans");\n').counted).toHaveLength(0);
  });
  test("a `../` path from the instance's root resolves before matching", () => {
    expect(scan('const p = "../uploads/a.pdf";\n').counted).toHaveLength(1);
  });
  test("comments, templates and sentences are not paths", () => {
    expect(scan('// see beans/defs\nconst t = `fsh-guts/${x}`;\nconst s = "beans/ is the work plan";\n').counted).toHaveLength(0);
  });
  test("a name the scanner also declares is not a finding (the false positive the shared-name rule exists for)", () => {
    expect(scan('join(ROOT, "themes", "index.md");\n').counted).toHaveLength(0);
  });
  test("a module specifier is code, not a path into a directory", () => {
    expect(scan('const m = await import("../beans/x.js");\n').counted).toHaveLength(0);
  });
  test("a literal nested in another call inside the path call is not the path (an option name)", () => {
    expect(scan('const d = resolve(opt("beans")!);\n').counted).toHaveLength(0);
  });
  test("a segment joined onto the INSTANCE's own root is the instance's own", () => {
    expect(scan('const OUT = join(INSTANCE, "beans");\n').counted).toHaveLength(0);
    expect(scan('const OUT = join(import.meta.dir, "..", "beans");\n').counted).toHaveLength(0);
    // ...while the checkout root is still caught.
    expect(scan('const D = join(REPO, "beans");\n').counted).toHaveLength(1);
  });
  test("a marked site is reported with its reason, not counted", () => {
    const r = scan('// declared-path-literal: the ignore file cannot read a declaration\nconst LOG = "fsh-guts/logs";\n');
    expect(r.counted).toHaveLength(0);
    expect(r.marked[0]?.reason).toContain("ignore file");
  });
});

describe("the ratchet is one way", () => {
  test("a rise is red, naming the file", () => {
    const j = judge({ "a.ts": 2 }, { "a.ts": 1 });
    expect(j.exit).toBe(1);
    expect(j.over).toEqual([{ file: "a.ts", was: 1, now: 2 }]);
  });
  test("a new file with any foreign literal is red", () => {
    expect(judge({ "new.ts": 1 }, {}).exit).toBe(1);
  });
  test("a fall is reported, never red — a fix elsewhere must not redden an unrelated PR", () => {
    const j = judge({}, { "a.ts": 3 });
    expect(j.exit).toBe(0);
    expect(j.under).toEqual([{ file: "a.ts", was: 3, now: 0 }]);
  });
});

// cat-harness-tools#1701: a content instance's root declares `docs/` etc., and
// a MOUNTED layer's literal spelling it is not the root's to judge.
describe("notThisCheckouts — mounted code spelling the root's own directories", () => {
  const root: InstanceDirs = { name: "smart-ips-pilgrimage", root: "", dirs: ["docs", "translations"] };
  const fhir: InstanceDirs = { name: "fhir-harness", root: "fhir-harness", dirs: ["fhir-harness/ig-site"] };
  const site = (file: string, owner: string, target = "docs") => ({ file, line: 1, literal: target, target, owner });
  const scan = {
    counted: [
      site("cat-harness-tools/scripts/sync-docs-harness.ts", "smart-ips-pilgrimage"),
      site("scripts/local.ts", "smart-ips-pilgrimage"),
      site("cat-harness-tools/scripts/x.ts", "fhir-harness", "fhir-harness/ig-site"),
    ],
    marked: [],
  };

  test("a mounted layer's site on the root's directory is excused; the rest still count", () => {
    const r = notThisCheckouts(scan, [root, fhir], ["cat-harness-tools", "fhir-harness"]);
    expect(r.excused.map((e) => e.file)).toEqual(["cat-harness-tools/scripts/sync-docs-harness.ts"]);
    expect(r.scan.counted.map((s) => s.file)).toEqual(["scripts/local.ts", "cat-harness-tools/scripts/x.ts"]);
  });

  test("nothing is excused where the root declares no instance (the platform index)", () => {
    const idx = notThisCheckouts(scan, [fhir], ["cat-harness-tools", "fhir-harness"]);
    expect(idx.excused).toHaveLength(0);
    expect(idx.scan.counted).toHaveLength(3);
  });

  test("nothing is excused when the file's layer is not mounted by the lock", () => {
    expect(notThisCheckouts(scan, [root, fhir], []).excused).toHaveLength(0);
  });
});

describe("a block that MOVES between files is the same finding (dth-sc#24)", () => {
  // CI judges a gate red on main by the `✗` keys `gate_diagnostics.py` reads
  // from its output; run that parser itself, so the test is about CI's reading.
  const keys = (out: string[]): string[] => {
    const py = join(TOOLS_ROOT, ".github", "scripts", "layer-pr-checks");
    const r = spawnSync(
      "python3",
      ["-I", "-B", "-c", `import sys; sys.path.insert(0, ${JSON.stringify(py)}); from gate_diagnostics import diagnostics; print("\\n".join(diagnostics(sys.stdin.read())))`],
      { input: out.join("\n") + "\n", encoding: "utf-8" },
    );
    expect(r.status).toBe(0);
    return r.stdout.split("\n").filter((l) => l.length > 0).sort();
  };
  const at = (file: string, n: number) =>
    scanText('const A = "fsh-guts/page-008.md";\nconst B = "uploads/x";\n'.repeat(n), file, "harness", targets);
  const report = (file: string, n = 1) => {
    const s = at(file, n);
    return overLines(judge(Object.fromEntries([[file, s.counted.length]]), {}), s);
  };

  test("moved unchanged: the keys CI compares are identical", () => {
    const before = keys(report("harness/front-matter/p-front-page-008.ts"));
    const after = keys(report("harness/glossary/p-front-page-008.ts"));
    expect(before).toHaveLength(2);
    expect(after).toEqual(before);
  });

  test("a site really ADDED is still one more of its key", () => {
    const before = keys(report("harness/front-matter/p.ts"));
    const after = keys(report("harness/glossary/p.ts", 2));
    expect(after).toHaveLength(before.length * 2);
  });

  test("where it sits is still printed, under the finding", () => {
    expect(report("harness/glossary/p.ts").join("\n")).toContain("at harness/glossary/p.ts:1");
  });
});
