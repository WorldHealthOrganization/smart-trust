/**
 * `3vc1` — the guard that refuses a reading taken through a lying filesystem.
 *
 * The assertions that matter are the DISCRIMINATION ones. A guard that flagged
 * every nested install would pass a test that only counted findings, and it would
 * also have blocked every local gate run in a correctly set-up checkout — measured
 * before it shipped: `cat-harness/schemas/block-qa-schema` is a declared
 * sub-package with its own `bun.lock`, so its `node_modules` is expected.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { distortions, importsPackage, nestedNodeModules } from "../check-environment.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));

/** A fixture repo: a root install, plus a sub-package that may shadow and may import. */
function fixture(opts: { shadowVersion?: string; importIt?: boolean }): {
  root: string;
  cleanup: () => void;
} {
  const root = mkdtempSync(join(tmpdir(), "3vc1-"));
  const pkg = (dir: string, version: string): void => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "dep", version }));
  };
  pkg(join(root, "node_modules", "dep"), "2.0.0");
  const sub = join(root, "sub");
  mkdirSync(sub, { recursive: true });
  if (opts.shadowVersion) pkg(join(sub, "node_modules", "dep"), opts.shadowVersion);
  writeFileSync(
    join(sub, "source.ts"),
    opts.importIt ? 'import { a } from "dep";\nexport const b = a;\n' : "export const b = 1;\n",
  );
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

describe("nestedNodeModules — the walk, bounded and excluding the root's own", () => {
  test("finds a nested install and NEVER reports the root one", () => {
    const { root, cleanup } = fixture({ shadowVersion: "1.0.0" });
    try {
      const found = nestedNodeModules(root);
      expect(found).toEqual([join(root, "sub", "node_modules")]);
      expect(found).not.toContain(join(root, "node_modules"));
    } finally {
      cleanup();
    }
  });

  test("a checkout with only a root install has none", () => {
    const { root, cleanup } = fixture({});
    try {
      expect(nestedNodeModules(root)).toEqual([]);
    } finally {
      cleanup();
    }
  });
});

describe("importsPackage — the predicate that replaced `any nested install`", () => {
  test("true when a source beside the install imports it", () => {
    const { root, cleanup } = fixture({ shadowVersion: "1.0.0", importIt: true });
    try {
      expect(importsPackage(join(root, "sub"), "dep")).toBe(true);
    } finally {
      cleanup();
    }
  });

  test("false when no source imports it — this is what spares a declared sub-package", () => {
    const { root, cleanup } = fixture({ shadowVersion: "1.0.0", importIt: false });
    try {
      expect(importsPackage(join(root, "sub"), "dep")).toBe(false);
    } finally {
      cleanup();
    }
  });

  test("does not read through the install's OWN node_modules", () => {
    // Otherwise a dependency that imports `dep` internally would make every
    // nested install look harmful, which is the false positive this guards.
    const { root, cleanup } = fixture({ shadowVersion: "1.0.0", importIt: false });
    try {
      const inner = join(root, "sub", "node_modules", "other");
      mkdirSync(inner, { recursive: true });
      writeFileSync(join(inner, "index.ts"), 'import { a } from "dep";\nexport const c = a;\n');
      expect(importsPackage(join(root, "sub"), "dep")).toBe(false);
    } finally {
      cleanup();
    }
  });
});

describe("distortions — DISCRIMINATION, which is the whole contract", () => {
  test("a shadowing install whose sources import it IS a distortion", () => {
    const { root, cleanup } = fixture({ shadowVersion: "1.0.0", importIt: true });
    try {
      const d = distortions(root);
      expect(d).toHaveLength(1);
      expect(d[0]!.path).toBe(join("sub", "node_modules"));
      expect(d[0]!.effect).toContain("1.0.0");
      expect(d[0]!.effect).toContain("2.0.0");
      expect(d[0]!.bean).toBe("3vc1");
    } finally {
      cleanup();
    }
  });

  test("a shadowing install NOBODY imports is NOT a distortion", () => {
    // The `block-qa-schema` case. Reporting it would refuse every gate run in a
    // correctly set-up checkout — worse than the defect being guarded.
    const { root, cleanup } = fixture({ shadowVersion: "1.0.0", importIt: false });
    try {
      expect(distortions(root)).toEqual([]);
    } finally {
      cleanup();
    }
  });

  test("an install at the SAME version is not a distortion even when imported", () => {
    // Nothing resolves differently, so no reading can move.
    const { root, cleanup } = fixture({ shadowVersion: "2.0.0", importIt: true });
    try {
      expect(distortions(root)).toEqual([]);
    } finally {
      cleanup();
    }
  });

  // THE BOUNDARY, and both sides of it were measured on the real tree rather than
  // chosen. `3vc1`'s fix regenerated a stale lockfile, taking the nested SDK from
  // 1.28.0 to 1.30.1 against the root's 1.30.0 — and root `tsc` went from 12 errors
  // to 0 while an equality-based guard still refused. So:
  //
  //   1.28.0 vs 1.30.0   minor differs   12 errors   -> a distortion
  //   1.30.1 vs 1.30.0   patch differs    0 errors   -> NOT a distortion
  //
  // Major-only would have missed the case this guard exists for; equality refuses a
  // clean tree. These two tests pin the line so it cannot drift either way.
  test("a PATCH-level difference is NOT a distortion — the measured 1.30.1 vs 1.30.0", () => {
    const { root, cleanup } = fixture({ shadowVersion: "2.0.1", importIt: true });
    try {
      expect(distortions(root)).toEqual([]);
    } finally {
      cleanup();
    }
  });

  test("a MINOR-level difference IS a distortion — the measured 1.28 vs 1.30", () => {
    const { root, cleanup } = fixture({ shadowVersion: "2.1.0", importIt: true });
    try {
      const d = distortions(root);
      expect(d).toHaveLength(1);
      expect(d[0]!.effect).toContain("2.1.0");
    } finally {
      cleanup();
    }
  });

  test("a version neither side can parse is reported, not waved through", () => {
    // `could not tell` belongs on the refusing side: the alternative is a silent pass.
    const { root, cleanup } = fixture({ shadowVersion: "not-a-version", importIt: true });
    try {
      expect(distortions(root)).toHaveLength(1);
    } finally {
      cleanup();
    }
  });

  test("a SYMLINKED root install is a distortion on its own — `qook`", () => {
    const root = mkdtempSync(join(tmpdir(), "3vc1-link-"));
    const real = mkdtempSync(join(tmpdir(), "3vc1-real-"));
    try {
      symlinkSync(real, join(root, "node_modules"));
      const d = distortions(root);
      expect(d.map((x) => x.bean)).toContain("qook");
      expect(d.find((x) => x.bean === "qook")!.effect).toContain("SYMLINK");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(real, { recursive: true, force: true });
    }
  });

  /**
   * A throwaway worktree whose `.git` file points at a fixture checkout's git
   * dir, as `check-merged` builds one. Self-contained rather than reading this
   * checkout: a test that leans on the monorepo's own `node_modules` fails when
   * the layer stands alone (`check:cat-harness-standalone`), and this
   * checkout's `.git` is itself a file in a worktree.
   */
  function worktreeFixture(): { checkout: string; wt: string; cleanup: () => void } {
    const base = mkdtempSync(join(tmpdir(), "qook-"));
    const checkout = join(base, "checkout");
    mkdirSync(join(checkout, "node_modules"), { recursive: true });
    const init = spawnSync("git", ["init", "-q", checkout], { encoding: "utf-8" });
    if (init.status !== 0) throw new Error(`git init failed: ${init.stderr}`);
    const wt = join(base, "wt");
    mkdirSync(wt);
    writeFileSync(join(wt, ".git"), `gitdir: ${join(checkout, ".git")}\n`);
    return { checkout, wt, cleanup: () => rmSync(base, { recursive: true, force: true }) };
  }

  test("a SYMLINKED root install pointing into the checkout that owns the worktree is NOT a distortion (bean qook)", () => {
    const { checkout, wt, cleanup } = worktreeFixture();
    try {
      symlinkSync(join(checkout, "node_modules"), join(wt, "node_modules"));
      expect(distortions(wt).filter((x) => x.bean === "qook")).toEqual([]);
    } finally {
      cleanup();
    }
  });

  test("the same worktree with its install symlinked OUTSIDE that checkout IS a distortion (bean qook)", () => {
    const { wt, cleanup } = worktreeFixture();
    const elsewhere = mkdtempSync(join(tmpdir(), "qook-elsewhere-"));
    try {
      symlinkSync(elsewhere, join(wt, "node_modules"));
      expect(distortions(wt).map((x) => x.bean)).toContain("qook");
    } finally {
      cleanup();
      rmSync(elsewhere, { recursive: true, force: true });
    }
  });
});

describe("this repository, right now", () => {
  // ANTI-VACUITY in the other direction (`6tkl`): if this returned findings on a
  // normal checkout the guard would be unusable, and every gate run would refuse.
  test("is not distorted — otherwise `bun run cat gates` refuses for everyone", () => {
    expect(distortions(REPO)).toEqual([]);
  });

  // WHAT THIS DOES NOT ASSERT, and why the first version of it failed in CI.
  //
  // It read `expect(nestedNodeModules(REPO).length).toBeGreaterThan(0)` — reaching
  // for anti-vacuity, on the ground that if this repository held no nested install
  // then the test above ("is not distorted") proved nothing. It passed locally,
  // where `schemas/block-qa-schema` is installed, and FAILED IN CI, which installs
  // only from the repository root.
  //
  // So it encoded a fact about one ENVIRONMENT as an invariant of the REPOSITORY —
  // in the test file whose whole subject is not confusing those two. The count is
  // legitimately 1 on a developer checkout and legitimately 0 on a runner, and a
  // test that demands either is wrong somewhere.
  //
  // The anti-vacuity guarantee belongs on the FIXTURES, which are
  // environment-independent: the five `distortions` cases above prove
  // discrimination by construction, so `distortions(REPO) === []` is not vacuous
  // whatever this checkout happens to hold. What is left here is the narrow true
  // thing — the walk runs against a real tree of this size and returns a list —
  // plus the count, reported rather than graded.
  test("the walk runs against the real tree and returns a list, whatever it holds", () => {
    const found = nestedNodeModules(REPO);
    expect(Array.isArray(found)).toBe(true);
    // Reported, not asserted: 1 on a developer checkout that installed the
    // sub-package, 0 on a runner that installed only the root. Both are correct.
    console.log(`    nested install(s) in this checkout: ${found.length}`);
    for (const f of found) expect(f.endsWith("node_modules")).toBe(true);
  });
});
