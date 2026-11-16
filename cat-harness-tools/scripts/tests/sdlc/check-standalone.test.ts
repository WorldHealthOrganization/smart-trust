/**
 * `check:standalone` — the judgement, and the two falsifiers bean `ho66` asks
 * for, run through the REAL probe on a scratch repository: an empty layer is
 * never a pass, and a planted read of a sibling the layer does not declare is
 * red.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { judge, layerRelativeKey, parsePart, refreshCommand, STANDALONE_EXIT } from "../../check-standalone.ts";
import { parseJunitFiles, probeStandalone, type LayerDecl } from "../../seed-ready.ts";

describe("judge, one part of the test files (--part, S-CI6)", () => {
  const ran = (findings: string[], files: string[], count = findings.length) =>
    ({ state: "measured", count, findings, files }) as const;
  const baseline = { failing: ["a.test.ts > x", "b.test.ts > y"], failed: 2 };

  test("a new failure in the part is red, exactly as in a whole run", () => {
    const j = judge(ran(["a.test.ts > x", "a.test.ts > z"], ["a.test.ts"]), baseline, undefined, "1/2");
    expect(j.exit).toBe(STANDALONE_EXIT.grew);
    expect(j.lines.join("\n")).toContain("+ a.test.ts > z");
  });
  test("a listed test of another part is not reported as passing", () => {
    const j = judge(ran(["a.test.ts > x"], ["a.test.ts"]), baseline, undefined, "1/2");
    expect(j.exit).toBe(STANDALONE_EXIT.held);
    expect(j.lines.join("\n")).not.toContain("b.test.ts");
  });
  test("a listed test of this part that now passes is reported", () => {
    const j = judge(ran([], ["b.test.ts"]), baseline, undefined, "2/2");
    expect(j.exit).toBe(STANDALONE_EXIT.held);
    expect(j.lines.join("\n")).toContain("- b.test.ts > y");
  });
  test("an unnamed failure beyond the whole baseline's allowance is red", () => {
    expect(judge(ran(["a.test.ts > x"], ["a.test.ts"], 2), baseline, undefined, "1/2").exit).toBe(STANDALONE_EXIT.grew);
    expect(judge(ran(["a.test.ts > x"], ["a.test.ts"], 2), { ...baseline, failed: 3 }, undefined, "1/2").exit).toBe(STANDALONE_EXIT.held);
  });
  test("a part that cannot say which files it ran is not held", () => {
    const j = judge({ state: "measured", count: 0, findings: [] }, baseline, undefined, "1/2");
    expect(j.exit).toBe(STANDALONE_EXIT.undetermined);
  });
  test("parsePart takes i/n with 1 <= i <= n only", () => {
    expect(parsePart("2/4")).toEqual({ i: 2, n: 4 });
    for (const bad of ["0/4", "5/4", "x", "1/0", "", undefined]) expect(parsePart(bad)).toBeUndefined();
  });
  test("parseJunitFiles names each outermost suite once", () => {
    const xml = `<?xml version="1.0"?><testsuites><testsuite name="a.test.ts"><testsuite name="describe"><testcase name="t"/></testsuite></testsuite><testsuite name="b &amp; c.test.ts"/></testsuites>`;
    expect(parseJunitFiles(xml)).toEqual(["a.test.ts", "b & c.test.ts"]);
  });
});

describe("judge", () => {
  const measured = (findings: string[], count = findings.length) =>
    ({ state: "measured", count, findings }) as const;

  test("the same failing set holds", () => {
    expect(judge(measured(["a > b"]), { failing: ["a > b"], failed: 1 }).exit).toBe(STANDALONE_EXIT.held);
  });
  test("a new failure is red and named", () => {
    const j = judge(measured(["a > b", "c > d"]), { failing: ["a > b"], failed: 1 });
    expect(j.exit).toBe(STANDALONE_EXIT.grew);
    expect(j.lines.join("\n")).toContain("+ c > d");
  });
  test("a listed test that now passes is reported, not red (an unstable entry must not flip CI)", () => {
    const j = judge(measured([]), { failing: ["a > b"], failed: 1 });
    expect(j.exit).toBe(STANDALONE_EXIT.held);
    expect(j.lines.join("\n")).toContain("- a > b");
    expect(j.lines.join("\n")).toContain("standalone:baseline");
  });
  test("a new failure is red even when another listed one passed", () => {
    expect(judge(measured(["c > d"]), { failing: ["a > b"], failed: 1 }).exit).toBe(STANDALONE_EXIT.grew);
  });
  test("more unnamed failures is red", () => {
    expect(judge(measured(["a > b"], 3), { failing: ["a > b"], failed: 2 }).exit).toBe(STANDALONE_EXIT.grew);
  });
  test("an error and a missing baseline are never held", () => {
    expect(judge({ state: "error", note: "x" }, { failing: [], failed: 0 }).exit).toBe(STANDALONE_EXIT.undetermined);
    expect(judge(measured([]), undefined).exit).toBe(STANDALONE_EXIT.undetermined);
  });
});

describe("the falsifiers, through the real probe", () => {
  function scratchRepo(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "check-standalone-"));
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(join(root, rel, ".."), { recursive: true });
      writeFileSync(join(root, rel), body);
    }
    const git = (args: string[]) =>
      execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@invalid", "-c", "commit.gpgsign=false", ...args], {
        cwd: root,
        stdio: "ignore",
      });
    git(["init", "-q"]);
    git(["add", "-A"]);
    git(["commit", "-q", "-m", "fixture"]);
    return root;
  }
  const DECLS: LayerDecl[] = [{ name: "layer", dir: "layer", needs: [] }];
  // A one-file fixture needs no 3 GB; the floor is for the real corpus.
  const OPTS = { minFreeBytes: 0 };

  test("an empty layer exits non-zero", () => {
    const root = scratchRepo({ "layer/README.md": "nothing to test\n" });
    try {
      const probe = probeStandalone(root, "layer", DECLS, OPTS);
      // bun finds no test and prints no summary: an error, never a measured 0.
      expect(probe.state).toBe("error");
      expect(judge(probe, { failing: [], failed: 0 }).exit).toBe(STANDALONE_EXIT.undetermined);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);

  test("a run that executes nothing is never measured, whatever BUN_OPTIONS says", () => {
    // CI's shards set BUN_OPTIONS=--shard=N/4; inherited, the probe ran a
    // quarter of the layer and a one-test layer ran nothing (#1977).
    const root = scratchRepo({
      "layer/a.test.ts": 'import { test } from "bun:test";\ntest("a", () => {});\n',
    });
    const before = process.env.BUN_OPTIONS;
    process.env.BUN_OPTIONS = "--shard=2/4";
    try {
      expect(probeStandalone(root, "layer", DECLS, OPTS)).toMatchObject({ state: "measured", count: 0 });
    } finally {
      if (before === undefined) delete process.env.BUN_OPTIONS;
      else process.env.BUN_OPTIONS = before;
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);

  test("the parts of a layer together run every test file once (--part, S-CI6)", () => {
    const files: Record<string, string> = {};
    for (const n of ["a", "b", "c", "d", "e"]) {
      files[`layer/${n}.test.ts`] = `import { expect, test } from "bun:test";\ntest("${n}", () => { expect("${n}").toBe(${n === "c" ? '"x"' : `"${n}"`}); });\n`;
    }
    const root = scratchRepo(files);
    try {
      const parts = [1, 2, 3].map((i) => probeStandalone(root, "layer", DECLS, { ...OPTS, shard: `${i}/3` }));
      const ran = parts.flatMap((p) => (p.state === "measured" ? (p.files ?? []).map((f) => f.split("/").at(-1)) : []));
      expect(ran.sort()).toEqual(["a.test.ts", "b.test.ts", "c.test.ts", "d.test.ts", "e.test.ts"]);
      const failing = parts.flatMap((p) => (p.state === "measured" ? p.findings : []));
      expect(failing).toHaveLength(1);
      expect(failing[0]).toContain("c.test.ts > c");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 120_000);

  test("a remote-mounted dependency, in no index, is still laid out beside the layer (#2470)", () => {
    // A mount is an IGNORED directory: `git ls-files` names none of it, and
    // before this the rehearsal ran with no closure at all.
    const root = scratchRepo({
      ".gitignore": "/dep/\n",
      "dep/x": "a mounted file\n",
      "layer/reads.test.ts": [
        'import { expect, test } from "bun:test";',
        'import { existsSync } from "node:fs";',
        'import { join } from "node:path";',
        'test("reads dep", () => { expect(existsSync(join(import.meta.dir, "../dep/x"))).toBe(true); });',
        "",
      ].join("\n"),
    });
    const decls: LayerDecl[] = [
      { name: "layer", dir: "layer", needs: ["dep"] },
      { name: "dep", dir: "dep", needs: [] },
    ];
    try {
      expect(probeStandalone(root, "layer", decls, OPTS)).toMatchObject({ state: "measured", count: 0 });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);

  test("a planted read of an undeclared sibling is red", () => {
    const root = scratchRepo({
      "folio-assistant-core/x": "only the monorepo has this\n",
      "layer/reads.test.ts": [
        'import { expect, test } from "bun:test";',
        'import { existsSync } from "node:fs";',
        'import { join } from "node:path";',
        'test("reads core", () => { expect(existsSync(join(import.meta.dir, "../folio-assistant-core/x"))).toBe(true); });',
        "",
      ].join("\n"),
    });
    try {
      const probe = probeStandalone(root, "layer", DECLS, OPTS);
      expect(probe).toMatchObject({ state: "measured", count: 1 }); // a mismatch prints the probe's note
      const j = judge(probe, { failing: [], failed: 0 });
      expect(j.exit).toBe(STANDALONE_EXIT.grew);
      expect(j.measured?.failing).toEqual(["reads.test.ts > reads core"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});

describe("check-standalone: keys and hints are the layer's, not the machine's", () => {
  const measured = (findings: string[], count = findings.length) =>
    ({ state: "measured", count, findings }) as const;

  test("a failure keyed by an absolute path matches its baseline entry wherever it ran", () => {
    const ci = "/home/runner/work/x/fa/cat-harness-tools/pipeline/p.test.ts > d > t";
    expect(layerRelativeKey(ci, "cat-harness-tools")).toBe("pipeline/p.test.ts > d > t");
    expect(layerRelativeKey("scripts/a.test.ts > t", "cat-harness-tools")).toBe("scripts/a.test.ts > t");
    const j = judge(measured([ci]), { failing: ["/home/user/fa/cat-harness-tools/pipeline/p.test.ts > d > t"], failed: 1 }, "cat-harness-tools");
    expect(j.exit).toBe(STANDALONE_EXIT.held);
  });

  test("the hint names the command that rewrites THIS layer's entry", () => {
    const j = judge(measured([]), { failing: ["a > b"], failed: 1 }, "cat-harness-tools");
    expect(j.lines.join("\n")).toContain(refreshCommand("cat-harness-tools"));
  });
});
