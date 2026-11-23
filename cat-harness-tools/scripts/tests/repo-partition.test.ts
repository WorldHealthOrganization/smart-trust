import { describe, expect, test } from "bun:test";
import { analyse, classify } from "../repo-partition";

describe("repo-partition classification", () => {
  test("explicit path rules win over keyword rules", () => {
    // `workflow` would match nothing sci/base, but the point is that an
    // explicit harness rule is consulted before any keyword sweep.
    // The examples this used to name (`src/tools/workflow.ts`, `src/core/rbac.ts`,
    // then `scripts/workflow-bpmn.ts`, `src/core/access.ts`) left the
    // partition's scope as 70lx moved the code out (the dead rules were
    // removed, owner 2026-10-10); these are explicit harness rules over files
    // the partition still scans.
    // declared-path-literal: test VECTORS for the partition classifier — never read.
    expect(classify("schemas/content/avatars.ts")).toEqual({ repo: "harness", provenance: "rule" });
    expect(classify("schemas/ui/blank-avatar.ts")).toEqual({ repo: "harness", provenance: "rule" });
  });

  test("a test is classified by what it IS, not by what it exercises", () => {
    // The regression this ordering exists to prevent: a Lean test being
    // partitioned into folio-asst-sci and then counted as sci's module.
    const a = classify("scripts/tests/lean-witness.test.ts");
    expect(a.repo).toBe("test");
    expect(a.provenance).toBe("rule");
  });

  test("domain keywords assign with keyword provenance, not rule", () => {
    const a = classify("pipeline/render-latex.ts");
    expect(a.repo).toBe("sci");
    expect(a.provenance).toBe("keyword");
  });

  test("an unclaimed module is unassigned — never silently defaulted to core", () => {
    // The third-state discipline. If this ever returns `core`, the report
    // stops distinguishing "determined" from "could not determine", which is
    // exactly how a wrong partition comes to look like a clean one.
    const a = classify("scripts/some-unrecognised-platform-script.ts");
    expect(a.repo).toBe("unassigned");
    expect(a.provenance).toBe("default");
  });
});

describe("repo-partition analysis", () => {
  const report = analyse();

  test("scans a non-empty corpus", () => {
    // The dh4f gate: an empty corpus must not read as a clean partition.
    expect(report.modules.size).toBeGreaterThan(100);
    expect(report.totalEdges).toBeGreaterThan(100);
  });

  test("a test module's cross-boundary imports are never violations", () => {
    for (const e of report.crossEdges) {
      expect(e.fromRepo).not.toBe("test");
    }
  });

  test("every cross-edge has both endpoints classified", () => {
    for (const e of report.crossEdges) {
      expect(report.modules.has(e.from)).toBe(true);
      expect(report.modules.has(e.to)).toBe(true);
    }
  });
});
