/**
 * Test suite for generic orphan detection across declared graph kinds (bean folio-assistant-9mmu).
 *
 * Covers:
 * 1. Vacuity guard (empty candidate set returns unknown, never a false pass).
 * 2. Positive orphan detection (beans referencing missing parents/blockers, sidecars with missing subjects).
 * 3. Clean resolution (all candidates resolve to existing targets -> pass).
 * 4. Integration with kg-audit and kg-qa schema.
 *
 * @module scripts/tests/orphan-detector-audit.test
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  detectOrphansAcrossGraphs,
  orphanSubjectResolves,
} from "../orphan-detector.js";
import { KG_CRITERIA_BY_ID } from "../../schemas/sdlc/kg-qa.js";

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

function createTempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "orphan-detector-test-"));
  tmpDirs.push(d);
  return d;
}

describe("orphan-detector: vacuity guard", () => {
  test("empty candidate set returns unknown, never pass", () => {
    const res = detectOrphansAcrossGraphs({
      beans: [],
      sidecars: [],
      attestations: [],
    });

    expect(res.candidatesExamined).toBe(0);
    expect(res.entry.result).toBe("unknown");
    expect(res.entry.findings.length).toBeGreaterThan(0);
    expect(res.entry.findings[0].detail).toContain("vacuity guard returns unknown");
  });

  test("empty directory returns unknown due to vacuity guard", () => {
    const emptyDir = createTempDir();
    const res = detectOrphansAcrossGraphs({
      root: emptyDir,
      repoRoot: emptyDir,
      beansDir: join(emptyDir, "beans", "defs"),
      sidecarDir: join(emptyDir, "test", "results", "kg-qa"),
      attestationsDir: join(emptyDir, "test", "attestations"),
    });

    expect(res.candidatesExamined).toBe(0);
    expect(res.entry.result).toBe("unknown");
  });
});

describe("orphan-detector: positive orphan detection", () => {
  test("detects bean referencing nonexistent parent", () => {
    const res = detectOrphansAcrossGraphs({
      beans: [
        {
          id: "bean-child",
          parent: "nonexistent-epic-123",
        },
      ],
      sidecars: [],
      attestations: [],
    });

    expect(res.candidatesExamined).toBe(1);
    expect(res.entry.result).toBe("fail");
    expect(res.findings.length).toBe(1);
    expect(res.findings[0].where).toBe("bean-child");
    expect(res.findings[0].detail).toContain('references parent "nonexistent-epic-123" which does not exist');
  });

  test("detects bean referencing nonexistent blocking target", () => {
    const res = detectOrphansAcrossGraphs({
      beans: [
        {
          id: "bean-blocker",
          blocking: ["missing-task-456"],
        },
      ],
      sidecars: [],
      attestations: [],
    });

    expect(res.candidatesExamined).toBe(1);
    expect(res.entry.result).toBe("fail");
    expect(res.findings.length).toBe(1);
    expect(res.findings[0].where).toBe("bean-blocker");
    expect(res.findings[0].detail).toContain('references blocking target "missing-task-456" which does not exist');
  });

  test("detects bean referencing nonexistent blocked_by target", () => {
    const res = detectOrphansAcrossGraphs({
      beans: [
        {
          id: "bean-blocked",
          declaredBlockedBy: ["missing-predecessor-789"],
        },
      ],
      sidecars: [],
      attestations: [],
    });

    expect(res.candidatesExamined).toBe(1);
    expect(res.entry.result).toBe("fail");
    expect(res.findings.length).toBe(1);
    expect(res.findings[0].where).toBe("bean-blocked");
    expect(res.findings[0].detail).toContain('references blocked_by target "missing-predecessor-789" which does not exist');
  });

  test("detects QA sidecar whose subject file is missing on disk", () => {
    const tempDir = createTempDir();
    const res = detectOrphansAcrossGraphs({
      root: tempDir,
      repoRoot: tempDir,
      beans: [],
      sidecars: [
        {
          path: "test/results/kg-qa/skills/missing-skill.kg-qa.json",
          subjectPath: "skills/pkg/missing-skill.md",
        },
      ],
      attestations: [],
    });

    expect(res.candidatesExamined).toBe(1);
    expect(res.entry.result).toBe("fail");
    expect(res.findings.length).toBe(1);
    expect(res.findings[0].where).toBe("test/results/kg-qa/skills/missing-skill.kg-qa.json");
    expect(res.findings[0].detail).toContain('audits subject "skills/pkg/missing-skill.md" which does not exist on disk');
  });

  test("detects unreadable QA sidecar", () => {
    const res = detectOrphansAcrossGraphs({
      beans: [],
      sidecars: [
        {
          path: "test/results/kg-qa/corrupt.kg-qa.json",
          unreadable: true,
        },
      ],
      attestations: [],
    });

    expect(res.candidatesExamined).toBe(1);
    expect(res.entry.result).toBe("fail");
    expect(res.findings[0].detail).toContain("could not be parsed as JSON");
  });

  test("detects attestation whose subject is missing on disk", () => {
    const tempDir = createTempDir();
    const res = detectOrphansAcrossGraphs({
      root: tempDir,
      repoRoot: tempDir,
      beans: [],
      sidecars: [],
      attestations: [
        {
          path: "test/attestations/kg-qa/missing.attestations.json",
          subjectPath: "processes/missing-process.bpmn",
        },
      ],
    });

    expect(res.candidatesExamined).toBe(1);
    expect(res.entry.result).toBe("fail");
    expect(res.findings[0].detail).toContain('attests to subject "processes/missing-process.bpmn" which does not exist on disk');
  });
});

describe("orphan-detector: clean resolution", () => {
  test("resolves cleanly when all bean and sidecar targets exist", () => {
    const tempDir = createTempDir();
    const existingSubjectRel = "skills/demo/skill.md";
    mkdirSync(join(tempDir, "skills", "demo"), { recursive: true });
    writeFileSync(join(tempDir, existingSubjectRel), "# Demo Skill\n");

    const res = detectOrphansAcrossGraphs({
      root: tempDir,
      repoRoot: tempDir,
      beans: [
        {
          id: "bean-epic",
        },
        {
          id: "bean-task",
          parent: "bean-epic",
          blocking: ["bean-blocked"],
        },
        {
          id: "bean-blocked",
          declaredBlockedBy: ["bean-task"],
        },
      ],
      sidecars: [
        {
          path: "test/results/kg-qa/skills/demo/skill.kg-qa.json",
          subjectPath: existingSubjectRel,
        },
      ],
      attestations: [
        {
          path: "test/attestations/kg-qa/skills/demo/skill.attestations.json",
          subjectPath: existingSubjectRel,
        },
      ],
    });

    expect(res.candidatesExamined).toBe(5); // 3 bean refs + 1 sidecar + 1 attestation
    expect(res.entry.result).toBe("pass");
    expect(res.findings.length).toBe(0);
  });
});

describe("orphan-detector: filesystem-based integration", () => {
  test("reads bean definitions from defs directory with valid and invalid references", () => {
    const tempDir = createTempDir();
    const defsDir = join(tempDir, "beans", "defs");
    mkdirSync(defsDir, { recursive: true });

    // Existing epic
    writeFileSync(
      join(defsDir, "epic-001--first-epic.md"),
      `---
id: epic-001
title: First Epic
type: epic
status: in-progress
---
Epic body.
`,
    );

    // Valid child task
    writeFileSync(
      join(defsDir, "task-002--child-task.md"),
      `---
id: task-002
title: Child Task
type: task
status: in-progress
parent: epic-001
---
Task body.
`,
    );

    // Orphan child task
    writeFileSync(
      join(defsDir, "task-003--orphan-task.md"),
      `---
id: task-003
title: Orphan Task
type: task
status: in-progress
parent: gone-epic-999
---
Orphan body.
`,
    );

    const res = detectOrphansAcrossGraphs({
      root: tempDir,
      repoRoot: tempDir,
      beansDir: defsDir,
      sidecars: [],
      attestations: [],
    });

    expect(res.stats.beansExamined).toBe(2);
    expect(res.entry.result).toBe("fail");
    expect(res.findings.length).toBe(1);
    expect(res.findings[0].where).toBe("task-003");
    expect(res.findings[0].detail).toContain('references parent "gone-epic-999" which does not exist');
  });
});

describe("orphan-detector: schema and kg-audit integration", () => {
  test("criterion orphan-subject-resolves is registered in KG_CRITERIA", () => {
    const def = KG_CRITERIA_BY_ID["orphan-subject-resolves"];
    expect(def).toBeDefined();
    expect(def.id).toBe("orphan-subject-resolves");
    expect(def.applies).toContain("graph");
    expect(def.scope).toBe("repo");
    expect(def.severity).toBe("minor");
    expect(def.scopeBasis).toBeDefined();
    expect(def.scopeBasis!.length).toBeGreaterThan(80);
    expect(/repoRootFor|repository root|repository-level|MEASURED/.test(def.scopeBasis!)).toBe(true);
    expect(def.summary).toContain("orphan");
  });

  test("orphanSubjectResolves returns a valid KgCriterionEntry on current repo", () => {
    const entry = orphanSubjectResolves(process.cwd());
    expect(["pass", "fail", "unknown"]).toContain(entry.result);
    expect(Array.isArray(entry.findings)).toBe(true);
  });
});
