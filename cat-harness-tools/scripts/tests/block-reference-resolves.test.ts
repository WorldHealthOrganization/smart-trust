import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  auditBlockReferences,
  auditFolioBlocks,
  parseBlockManifest,
  resolveBlockReferences,
  BLOCK_REFERENCE_RESOLVES_CRITERION,
  type BlockInput,
} from "../block-reference-resolver.js";
import { KG_CRITERIA_BY_ID } from "../../schemas/sdlc/kg-qa.js";

describe("block-reference-resolves criterion registration", () => {
  test("registered in KG_CRITERIA_BY_ID with expected attributes", () => {
    const crit = KG_CRITERIA_BY_ID[BLOCK_REFERENCE_RESOLVES_CRITERION];
    expect(crit).toBeDefined();
    expect(crit.id).toBe("block-reference-resolves");
    expect(crit.applies).toContain("folio");
    expect(crit.scope).toBe("block");
    expect(crit.severity).toBe("minor");
    expect(crit.summary).toContain("computation.script");
  });
});

describe("reference resolution checker", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "block-resolver-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("resolving valid computation.script paths", () => {
    test("resolves computation.script inside declared computations directory", () => {
      const compDir = join(tempDir, "computations");
      mkdirSync(compDir, { recursive: true });
      const scriptFile = join(compDir, "proof_chi.py");
      writeFileSync(scriptFile, "# valid script");

      const block: BlockInput = {
        label: "thm:chi",
        computation: {
          script: "computations/proof_chi.py",
        },
      };

      const result = resolveBlockReferences(block, {
        instanceRoot: tempDir,
        declaredDirectories: { computations: compDir },
      });

      expect(result.result).toBe("pass");
      expect(result.findings).toHaveLength(0);
      expect(result.blocksAudited).toBe(1);
    });

    test("resolves bare script name against declared computation directory", () => {
      const compDir = join(tempDir, "computations");
      mkdirSync(compDir, { recursive: true });
      writeFileSync(join(compDir, "solve.py"), "# solver");

      const block: BlockInput = {
        label: "thm:solve",
        computation: {
          script: "solve.py",
        },
      };

      const result = resolveBlockReferences(block, {
        instanceRoot: tempDir,
        declaredDirectories: { computations: compDir },
      });

      expect(result.result).toBe("pass");
      expect(result.findings).toHaveLength(0);
    });

    test("resolves computation.script from parsed .ts manifest file", () => {
      const compDir = join(tempDir, "computations");
      mkdirSync(compDir, { recursive: true });
      writeFileSync(join(compDir, "verify.py"), "# verify");

      const folioDir = join(tempDir, "folio", "ch1");
      mkdirSync(folioDir, { recursive: true });
      const manifestPath = join(folioDir, "thm-1.ts");
      writeFileSync(
        manifestPath,
        `export default theorem({
  label: "thm:first",
  title: "First theorem",
  computation: {
    engine: "python",
    script: "computations/verify.py",
    status: "verified"
  }
});`,
      );

      const parsed = parseBlockManifest(manifestPath);
      expect(parsed).toBeDefined();
      expect(parsed?.label).toBe("thm:first");
      expect(parsed?.computation?.script).toBe("computations/verify.py");

      const result = resolveBlockReferences(parsed!, {
        instanceRoot: tempDir,
        declaredDirectories: { computations: compDir },
      });
      expect(result.result).toBe("pass");
      expect(result.findings).toHaveLength(0);
    });
  });

  describe("detecting missing/broken computation.script paths", () => {
    test("fails when computation.script does not exist in declared directory", () => {
      const compDir = join(tempDir, "computations");
      mkdirSync(compDir, { recursive: true });

      const block: BlockInput = {
        label: "thm:missing-script",
        computation: {
          script: "computations/does_not_exist.py",
        },
      };

      const result = resolveBlockReferences(block, {
        instanceRoot: tempDir,
        declaredDirectories: { computations: compDir },
      });

      expect(result.result).toBe("fail");
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]!.kind).toBe("computation.script");
      expect(result.findings[0]!.where).toBe("thm:missing-script");
      expect(result.findings[0]!.detail).toContain("does not exist in declared computation directory");
    });
  });

  describe("resolving template {{...}} macros vs undeclared macros", () => {
    test("resolves macros declared in knownMacros or paperConfig", () => {
      const block: BlockInput = {
        label: "thm:macro-valid",
        prose: "As shown by {{ alpha_const }} and {{ chi_bound }}.",
      };

      const result = resolveBlockReferences(block, {
        instanceRoot: tempDir,
        knownMacros: ["alpha_const"],
        paperConfig: {
          macros: {
            chi_bound: { tex: "\\chi_{bound}" },
          },
        },
      });

      expect(result.result).toBe("pass");
      expect(result.findings).toHaveLength(0);
    });

    test("fails when prose contains undeclared {{...}} macro template", () => {
      const block: BlockInput = {
        label: "thm:macro-unknown",
        prose: "Formula uses {{ undefined_macro }} in calculation.",
      };

      const result = resolveBlockReferences(block, {
        instanceRoot: tempDir,
        knownMacros: ["known_macro"],
      });

      expect(result.result).toBe("fail");
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]!.kind).toBe("macro-template");
      expect(result.findings[0]!.where).toBe("thm:macro-unknown");
      expect(result.findings[0]!.detail).toContain("macro template \"{{undefined_macro}}\" does not resolve");
    });

    test("resolves valid Liquid value references against declared data directory", () => {
      const compDir = join(tempDir, "computations");
      mkdirSync(compDir, { recursive: true });
      writeFileSync(
        join(compDir, "masses.witness.json"),
        JSON.stringify({ data: { m: "0.5109989" } }),
      );

      const block: BlockInput = {
        label: "def:mass",
        prose: "Electron mass is {{ demo.computations.masses.data.m | precision: 4 }}.",
      };

      const result = resolveBlockReferences(block, {
        instanceRoot: tempDir,
        declaredDirectories: { computations: compDir },
        knownLiquidPrefixes: ["demo"],
      });

      expect(result.result).toBe("pass");
      expect(result.findings).toHaveLength(0);
    });

    test("detects missing entry in Liquid reference as failure", () => {
      const compDir = join(tempDir, "computations");
      mkdirSync(compDir, { recursive: true });

      const block: BlockInput = {
        label: "def:missing-data",
        prose: "Missing mass is {{ demo.computations.nonexistent_witness.data.m }}.",
      };

      const result = resolveBlockReferences(block, {
        instanceRoot: tempDir,
        declaredDirectories: { computations: compDir },
        knownLiquidPrefixes: ["demo"],
      });

      expect(result.result).toBe("fail");
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]!.kind).toBe("macro-template");
      expect(result.findings[0]!.detail).toContain('entry "nonexistent_witness" not found in directory "computations"');
    });
  });

  describe("third-state / undetermined behavior when directories are absent", () => {
    test("returns unknown when declared computation directory is absent on disk", () => {
      const absentCompDir = join(tempDir, "nonexistent_computations");

      const block: BlockInput = {
        label: "thm:absent-comp-dir",
        computation: {
          script: "nonexistent_computations/calc.py",
        },
      };

      const result = resolveBlockReferences(block, {
        instanceRoot: tempDir,
        declaredDirectories: { computations: absentCompDir },
      });

      // Third-state rule: never pass and never a false clean; undetermined => unknown
      expect(result.result).toBe("unknown");
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]!.kind).toBe("undetermined");
      expect(result.findings[0]!.detail).toContain("is absent from disk");
    });

    test("returns unknown when computation directory is undeclared in instance", () => {
      const block: BlockInput = {
        label: "thm:undeclared-comp",
        computation: {
          script: "computations/calc.py",
        },
      };

      const result = resolveBlockReferences(block, {
        instanceRoot: tempDir,
        declaredDirectories: {}, // No computation directory declared
      });

      expect(result.result).toBe("unknown");
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]!.kind).toBe("undetermined");
      expect(result.findings[0]!.detail).toContain("computation directory is undeclared in instance");
    });

    test("returns unknown when relative link points to absent target directory", () => {
      const absentUploads = join(tempDir, "uploads");

      const block: BlockInput = {
        label: "fig:chart",
        figure: {
          src: "uploads/chart.png",
        },
      };

      const result = resolveBlockReferences(block, {
        instanceRoot: tempDir,
        declaredDirectories: { uploads: absentUploads },
      });

      expect(result.result).toBe("unknown");
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]!.kind).toBe("undetermined");
      expect(result.findings[0]!.detail).toContain("is absent from disk");
    });

    test("returns unknown when Liquid reference targets undeclared directory", () => {
      const block: BlockInput = {
        label: "def:undeclared-dir",
        prose: "Reference: {{ demo.mystery_dir.entry.path }}.",
      };

      const result = resolveBlockReferences(block, {
        instanceRoot: tempDir,
        declaredDirectories: {},
        knownLiquidPrefixes: ["demo"],
      });

      expect(result.result).toBe("unknown");
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]!.kind).toBe("undetermined");
      expect(result.findings[0]!.detail).toContain('directory "mystery_dir" is undeclared in instance');
    });
  });

  describe("vacuity guard", () => {
    test("returns unknown when zero blocks are examined", () => {
      const result = resolveBlockReferences([], {
        instanceRoot: tempDir,
      });

      expect(result.result).toBe("unknown");
      expect(result.blocksAudited).toBe(0);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]!.kind).toBe("vacuity");
      expect(result.findings[0]!.detail).toContain("vacuity guard: zero blocks were examined");
    });

    test("returns unknown when folio directory is absent on disk", () => {
      const result = auditBlockReferences(join(tempDir, "nonexistent-instance"));

      expect(result.result).toBe("unknown");
      expect(result.blocksAudited).toBe(0);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]!.detail).toContain("is absent from disk");
    });
  });

  describe("auditFolioBlocks sidecar report generation", () => {
    test("returns KgQaReport with block-reference-resolves criterion", () => {
      const folioDir = join(tempDir, "folio", "ch1");
      mkdirSync(folioDir, { recursive: true });
      writeFileSync(
        join(folioDir, "thm.ts"),
        `export default theorem({
  label: "thm:sample",
  title: "Sample"
});`,
      );

      const reports = auditFolioBlocks(tempDir, {
        declaredDirectories: { folio: join(tempDir, "folio") },
      });

      expect(reports).toHaveLength(1);
      const r = reports[0]!;
      expect(r.subject.kind).toBe("folio");
      expect(r.criteria[BLOCK_REFERENCE_RESOLVES_CRITERION]).toBeDefined();
      expect(r.criteria[BLOCK_REFERENCE_RESOLVES_CRITERION]!.result).toBe("pass");
      expect(r.totals.pass).toBe(1);
    });

    test("returns empty array when no folio directory is declared", () => {
      const reports = auditFolioBlocks(tempDir, {
        declaredDirectories: {},
      });
      expect(reports).toHaveLength(0);
    });
  });
});
