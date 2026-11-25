/**
 * Lean project tests — compilation readiness, library presence, sorry audit.
 *
 * Walks every paper Lake package registered in the root workspace
 * (`schemas/lean-packages.ts`) plus the root workspace itself.
 *
 * EVERY assertion here is about the FOLIO (content repo): the Lake
 * workspace, `lean-toolchain`, and the papers' `.lean` trees all live
 * there, not in this platform repo. Before this guard the file asserted
 * them against the platform root and contributed 17 permanent failures —
 * red for a condition that is simply not knowable from here.
 *
 * With no folio attached these skip. Run them from a folio checkout (or
 * with one as a sibling) to exercise them for real.
 */

import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join, relative } from "path";
import {
  LEAN_DIR,
  FOLIO_ROOT,
  INSTANCE_ROOT,
  hasFolio,
  discoverLeanProjects,
  discoverDependencies,
  findLeanFiles,
} from "./helpers";

/** Skip content-repo assertions when no folio is attached. */
const folio = hasFolio();

import { LEAN_PACKAGES } from "../../schemas/lean-packages.js";

// ── Root workspace ──────────────────────────────────────────────

describe.skipIf(!folio)("Lean root workspace", () => {
  test("root lean-toolchain exists", () => {
    expect(existsSync(join(LEAN_DIR, "lean-toolchain"))).toBe(true);
  });

  test("root lean-toolchain has valid version", () => {
    const tc = readFileSync(join(LEAN_DIR, "lean-toolchain"), "utf-8").trim();
    expect(tc).toMatch(/^leanprover\/lean4:v\d+\.\d+/);
  });

  test("root lakefile.toml exists", () => {
    expect(existsSync(join(LEAN_DIR, "lakefile.toml"))).toBe(true);
  });

  test("root lakefile declares every paper package", () => {
    const src = readFileSync(join(LEAN_DIR, "lakefile.toml"), "utf-8");
    for (const pkg of LEAN_PACKAGES) {
      expect(src).toContain(`name = "${pkg.name}"`);
    }
  });
});

// ── Required dependencies ───────────────────────────────────────

describe.skipIf(!folio)("Lean dependencies", () => {
  const deps = discoverDependencies();

  test("mathlib is declared", () => {
    expect(deps).toContain("mathlib");
  });

  test("every registered paper package is declared", () => {
    for (const pkg of LEAN_PACKAGES) {
      expect(deps).toContain(pkg.name);
    }
  });
});

// ── Per-paper Lake packages ─────────────────────────────────────

const projects = discoverLeanProjects();

describe.skipIf(!folio)("Lean project discovery", () => {
  test("at least one project found", () => {
    expect(projects.length).toBeGreaterThan(0);
  });

  test("every LEAN_PACKAGES entry's lib is discovered", () => {
    for (const pkg of LEAN_PACKAGES) {
      expect(projects).toContain(pkg.lib);
    }
  });
});

describe.skipIf(!folio).each(LEAN_PACKAGES.map((pkg) => [pkg.name, pkg.lib, pkg] as const))("Paper package: %s (lib: %s)", (_name, _lib, pkg) => {
  const pkgRoot = join(FOLIO_ROOT ?? INSTANCE_ROOT, pkg.lakeRoot);
  const projDir = join(pkgRoot, pkg.lib);
  const leanFiles = findLeanFiles(projDir);

  test("lakefile.toml exists", () => {
    expect(existsSync(join(pkgRoot, "lakefile.toml"))).toBe(true);
  });

  test("library directory exists", () => {
    expect(existsSync(projDir)).toBe(true);
  });

  test("has .lean files", () => {
    expect(leanFiles.length).toBeGreaterThan(0);
  });

  describe.each(leanFiles.map((file) => [relative(INSTANCE_ROOT, file), file] as const))("%s", (_rel, file) => {
    test("is non-empty", () => {
      const content = readFileSync(file, "utf-8");
      expect(content.trim().length).toBeGreaterThan(0);
    });

    test("declares something or imports something", () => {
      // This used to assert `hasImport || isRoot`, on the theory that a
      // module with no `import` was suspect. It is not: `Nat`, `ℕ`, `List`,
      // `structure`, `inductive` and `class` are all core Lean, so a module
      // can be entirely self-contained and correct. Checked against the
      // five QOU modules it flagged — four compile clean and sorry-free
      // with no imports at all. It caught the one genuinely broken file
      // (`IsotopeRecord.lean`, accessors defined outside the structure's
      // namespace so `r.A` could not resolve) only by coincidence: the
      // defect was that it did not COMPILE, which no import check detects.
      //
      // What a cheap static test can honestly assert is that the file is
      // not empty — it either declares something or pulls something in.
      // Compilation is the Lean build's job, not this suite's.
      const content = readFileSync(file, "utf-8");
      const basename = file.split("/").pop()?.replace(".lean", "");
      const hasImport = /^import\s/m.test(content);
      const hasDecl =
        /^(private\s+|protected\s+|noncomputable\s+|partial\s+|unsafe\s+)*(theorem|lemma|def|abbrev|structure|inductive|class|instance|axiom|example|opaque)\s/m.test(
          content,
        );
      const isRoot = basename === pkg.lib;
      expect(hasImport || hasDecl || isRoot).toBe(true);
    });
  });

  // A REPORT, not a gate: a nonzero `sorry` count is the expected state of
  // a paper in progress, so asserting zero would be wrong. It used to end
  // in `expect(true).toBe(true)` and so could not fail for ANY reason —
  // including the one that matters, `findLeanFiles` returning nothing and
  // the audit reporting a clean "0 sorry" over an empty directory.
  test("sorry audit (report)", () => {
    let totalSorry = 0;
    const sorryFiles: string[] = [];
    for (const file of leanFiles) {
      const content = readFileSync(file, "utf-8");
      const count = (content.match(/\bsorry\b/g) || []).length;
      if (count > 0) {
        totalSorry += count;
        sorryFiles.push(`${relative(INSTANCE_ROOT, file)}(${count})`);
      }
    }
    if (totalSorry > 0) {
      console.log(`    ℹ ${pkg.lib}: ${totalSorry} sorry in ${sorryFiles.length} files: ${sorryFiles.join(", ")}`);
    }
    // The one thing that can go wrong unnoticed: an audit of no files.
    expect(leanFiles.length).toBeGreaterThan(0);
  });

  // Build artifacts not tracked
  test("no .lake/ artifacts tracked in git", () => {
    // Only git being unavailable is tolerated; the expectation sits outside
    // the catch, where a failed assertion is not swallowed with it.
    let tracked: string;
    try {
      tracked = execSync(`git ls-files --cached ${pkg.lakeRoot}/.lake/`, {
        cwd: INSTANCE_ROOT,
        encoding: "utf-8",
      }).trim();
    } catch {
      // git not available — skip
      return;
    }
    expect(tracked).toBe("");
  });
});
