import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifyLeanRefTarget,
  auditLakeTargetLeanResolution,
} from "../check-lake-targets.js";

describe("lake-target-lean-resolution", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "lake-target-test-"));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe("classifyLeanRefTarget", () => {
    test("resolving built refs that land in Lake build targets via targetModules", () => {
      const opts = {
        targetModules: new Set(["QOU.FluidDynamics", "QOU.Core.Algebra"]),
      };

      // Exact module declaration
      expect(
        classifyLeanRefTarget("qou:QOU.FluidDynamics.q_bkm_criterion", opts),
      ).toBe("built");

      // Nested declaration in module
      expect(
        classifyLeanRefTarget("qou:QOU.Core.Algebra.Matrix.identity", opts),
      ).toBe("built");

      // Without package prefix
      expect(
        classifyLeanRefTarget("QOU.FluidDynamics.boundary_condition", opts),
      ).toBe("built");
    });

    test("resolving built refs that land in Lake build targets via lakefile.toml and source tree", () => {
      // Create a lakefile.toml
      const lakeRoot = join(tempDir, "lake_proj");
      mkdirSync(lakeRoot, { recursive: true });
      writeFileSync(
        join(lakeRoot, "lakefile.toml"),
        `name = "qou"\n\n[[lean_lib]]\nname = "QOU"\n`,
      );

      // Create QOU/FluidDynamics.lean declaring q_bkm_criterion
      const qouDir = join(lakeRoot, "QOU");
      mkdirSync(qouDir, { recursive: true });
      writeFileSync(
        join(qouDir, "FluidDynamics.lean"),
        `import Mathlib\n\ntheorem q_bkm_criterion : True := by trivial\n`,
      );

      const res = classifyLeanRefTarget("qou:QOU.FluidDynamics.q_bkm_criterion", {
        lakeRoot,
      });
      expect(res).toBe("built");
    });

    test("resolving built refs that land in Lake build targets via lakefile.lean", () => {
      const lakeRoot = join(tempDir, "lake_lean_proj");
      mkdirSync(lakeRoot, { recursive: true });
      writeFileSync(
        join(lakeRoot, "lakefile.lean"),
        `import Lake\nopen Lake DSL\n\npackage "solo" where\n\nlean_lib Solo\n`,
      );

      const soloDir = join(lakeRoot, "Solo");
      mkdirSync(soloDir, { recursive: true });
      writeFileSync(
        join(soloDir, "Intro.lean"),
        `def my_definition : Nat := 42\n`,
      );

      const res = classifyLeanRefTarget("Solo:Solo.Intro.my_definition", {
        lakeRoot,
      });
      expect(res).toBe("built");
    });

    test("resolving built refs via compiled .olean module target", () => {
      const lakeRoot = join(tempDir, "compiled_proj");
      mkdirSync(lakeRoot, { recursive: true });
      writeFileSync(
        join(lakeRoot, "lakefile.toml"),
        `name = "my_pkg"\n\n[[lean_lib]]\nname = "MyPkg"\n`,
      );

      // Create .lake/build/lib/MyPkg/Compiled.olean
      const oleanDir = join(lakeRoot, ".lake", "build", "lib", "MyPkg");
      mkdirSync(oleanDir, { recursive: true });
      writeFileSync(join(oleanDir, "Compiled.olean"), "fake olean bytes");

      const res = classifyLeanRefTarget("my_pkg:MyPkg.Compiled.some_lemma", {
        lakeRoot,
      });
      expect(res).toBe("built");
    });

    test("resolving sibling_only refs that exist only in chapter directory .lean files but are not in Lake targets", () => {
      const opts = {
        targetModules: new Set(["QOU.FluidDynamics"]),
        chapterDirFiles: new Set([
          "chapters/01_introduction/UncompiledSibling.lean",
        ]),
      };

      const res = classifyLeanRefTarget(
        "qou:UncompiledSibling.intro_statement",
        opts,
      );
      expect(res).toBe("sibling_only");
    });

    test("resolving sibling_only refs via on-disk chapter directory file", () => {
      const lakeRoot = join(tempDir, "paper", "lean");
      mkdirSync(lakeRoot, { recursive: true });
      writeFileSync(
        join(lakeRoot, "lakefile.toml"),
        `name = "qou"\n\n[[lean_lib]]\nname = "QOU"\n`,
      );
      mkdirSync(join(lakeRoot, "QOU"), { recursive: true });
      writeFileSync(
        join(lakeRoot, "QOU", "Core.lean"),
        `def core_val := 1\n`,
      );

      // Chapter directory beside lean/
      const chapDir = join(tempDir, "paper", "chapters", "01");
      mkdirSync(chapDir, { recursive: true });
      writeFileSync(
        join(chapDir, "IntroSibling.lean"),
        `theorem intro_thm : True := by trivial\n`,
      );

      // Ref is absent from QOU/ library target, but present in chapter dir IntroSibling.lean
      const res = classifyLeanRefTarget("qou:IntroSibling.intro_thm", {
        lakeRoot,
      });
      expect(res).toBe("sibling_only");
    });

    test("detecting dangling refs that resolve nowhere", () => {
      const opts = {
        targetModules: new Set(["QOU.FluidDynamics"]),
        chapterDirFiles: new Set(["chapters/01/Sibling.lean"]),
      };

      // Completely non-existent ref
      const res = classifyLeanRefTarget("qou:Ghost.nowhere", opts);
      expect(res).toBe("dangling");

      // Empty decl
      expect(classifyLeanRefTarget("qou:", opts)).toBe("dangling");
    });

    test("third-state unknown when Lake environment is unreachable", () => {
      // 1. Missing both targetModules and lakeRoot
      expect(classifyLeanRefTarget("qou:QOU.FluidDynamics.thm", {})).toBe(
        "unknown",
      );

      // 2. Non-existent lakeRoot
      expect(
        classifyLeanRefTarget("qou:QOU.FluidDynamics.thm", {
          lakeRoot: join(tempDir, "non_existent_lake_root"),
        }),
      ).toBe("unknown");

      // 3. Existing lakeRoot but missing lakefile.toml and lakefile.lean
      const emptyDir = join(tempDir, "empty_lake");
      mkdirSync(emptyDir, { recursive: true });
      expect(
        classifyLeanRefTarget("qou:QOU.FluidDynamics.thm", {
          lakeRoot: emptyDir,
        }),
      ).toBe("unknown");
    });
  });

  describe("auditLakeTargetLeanResolution", () => {
    test("vacuity guard when 0 blocks/refs exist", () => {
      // Explicit 0 blocks
      const audit = auditLakeTargetLeanResolution(tempDir, { blocks: [] });
      expect(audit.result).toBe("unknown");
      expect(audit.findings.length).toBe(1);
      expect(audit.findings[0].detail).toContain("vacuity guard");

      // Empty directory with no block files
      const emptyDirAudit = auditLakeTargetLeanResolution(tempDir);
      expect(emptyDirAudit.result).toBe("unknown");
      expect(emptyDirAudit.findings[0].detail).toContain("vacuity guard");
    });

    test("returns unknown when Lake environment is unreachable in audit", () => {
      const blocks = [
        {
          ref: "qou:QOU.FluidDynamics.thm",
          label: "thm:fluid",
          file: "chapters/01/fluid.ts",
        },
      ];

      // lakeRoot does not exist
      const audit = auditLakeTargetLeanResolution(tempDir, {
        blocks,
        lakeRoot: join(tempDir, "non_existent"),
      });
      expect(audit.result).toBe("unknown");
      expect(audit.findings[0].detail).toContain("missing or unreadable");
    });

    test("reports pass when all refs land in Lake build targets", () => {
      const blocks = [
        {
          ref: "qou:QOU.FluidDynamics.thm",
          label: "thm:fluid",
          file: "chapters/01/fluid.ts",
        },
        {
          ref: "qou:QOU.Core.Algebra.lem",
          label: "lem:algebra",
          file: "chapters/02/algebra.ts",
        },
      ];

      const audit = auditLakeTargetLeanResolution(tempDir, {
        blocks,
        targetModules: new Set(["QOU.FluidDynamics", "QOU.Core.Algebra"]),
      });
      expect(audit.result).toBe("pass");
      expect(audit.findings.length).toBe(0);
    });

    test("reports fail with advisory findings when sibling_only and dangling refs are present", () => {
      const blocks = [
        {
          ref: "qou:QOU.FluidDynamics.thm",
          label: "thm:fluid",
          file: "chapters/01/fluid.ts",
        },
        {
          ref: "qou:Chapter1.intro_thm",
          label: "thm:intro",
          file: "chapters/01/intro.ts",
        },
        {
          ref: "qou:Ghost.vanished",
          label: "thm:ghost",
          file: "chapters/03/ghost.ts",
        },
      ];

      const audit = auditLakeTargetLeanResolution(tempDir, {
        blocks,
        targetModules: new Set(["QOU.FluidDynamics"]),
        chapterDirFiles: new Set(["chapters/01/intro_thm.lean"]),
      });

      expect(audit.result).toBe("fail");
      expect(audit.findings.length).toBe(2);

      // First finding: sibling_only
      expect(audit.findings[0].where).toBe("thm:intro");
      expect(audit.findings[0].detail).toContain("chapter directory sibling");

      // Second finding: dangling
      expect(audit.findings[1].where).toBe("thm:ghost");
      expect(audit.findings[1].detail).toContain("dangles");
    });
  });
});
