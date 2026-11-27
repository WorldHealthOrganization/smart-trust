import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BeanFrontMatterSchema,
  BeanTargetsSchema,
} from "../../schemas/sdlc/bean-graph.ts";
import {
  buildTraceability,
  collectBeans,
  evaluateTraceabilityAudit,
  extractExplicitTargets,
  extractInferredTargets,
  formatTraceabilityReport,
  type TraceableBlock,
} from "../trace-work.ts";
import type { BeanNode } from "../beans.ts";

describe("work traceability", () => {
  describe("BeanFrontMatterSchema and BeanTargetsSchema", () => {
    test("parses beans with declared targets array", () => {
      const data = {
        id: "folio-assistant-t123",
        title: "Formalize quantum model",
        status: "in-progress",
        targets: ["def:quantum-universe", "thm:transfer-matrix"],
      };

      const parsed = BeanFrontMatterSchema.parse(data);
      expect(parsed.targets).toEqual(["def:quantum-universe", "thm:transfer-matrix"]);
    });

    test("coerces a single string target into an array", () => {
      const parsed = BeanTargetsSchema.parse("def:single-target");
      expect(parsed).toEqual(["def:single-target"]);

      const fm = BeanFrontMatterSchema.parse({
        id: "b1",
        targets: "sec:intro",
      });
      expect(fm.targets).toEqual(["sec:intro"]);
    });

    test("allows absent targets", () => {
      const parsed = BeanFrontMatterSchema.parse({
        id: "b2",
        title: "Clean chore",
      });
      expect(parsed.targets).toBeUndefined();
    });
  });

  describe("explicit targets extraction", () => {
    test("extracts explicit targets from bean object", () => {
      const bean = {
        targets: ["thm:main", "def:helper", "thm:main"],
      };
      expect(extractExplicitTargets(bean)).toEqual(["thm:main", "def:helper"]);
    });

    test("handles unquoted or single quoted items", () => {
      const bean = {
        targets: ["'sec:intro'", "\"def:state\""],
      };
      expect(extractExplicitTargets(bean)).toEqual(["sec:intro", "def:state"]);
    });

    test("returns empty array for beans without targets", () => {
      expect(extractExplicitTargets({})).toEqual([]);
      expect(extractExplicitTargets(null)).toEqual([]);
    });
  });

  describe("inferred target extraction from titles/prose", () => {
    test("extracts block labels from title and prose", () => {
      const text = `
        Title: Work on thm:quantum-universe and def:state-space.
        We also reference sec:preliminaries, lem:adjoint, prop:unitarity, cor:finite-dim.
        Other notes: rem:clarification and ex:harmonic-oscillator.
      `;
      const targets = extractInferredTargets(text);
      expect(targets).toContain("thm:quantum-universe");
      expect(targets).toContain("def:state-space");
      expect(targets).toContain("sec:preliminaries");
      expect(targets).toContain("lem:adjoint");
      expect(targets).toContain("prop:unitarity");
      expect(targets).toContain("cor:finite-dim");
      expect(targets).toContain("rem:clarification");
      expect(targets).toContain("ex:harmonic-oscillator");
    });

    test("extracts package-qualified and bare Lean declarations", () => {
      const text = `
        Formalization of qou:QOU.CategoricalTransferMatrix in Lean 4.
        See also QOU.TransferMatrix.lifting_exists and Fred2005.FormalGroupLaw.
      `;
      const targets = extractInferredTargets(text);
      expect(targets).toContain("qou:QOU.CategoricalTransferMatrix");
      expect(targets).toContain("QOU.TransferMatrix.lifting_exists");
      expect(targets).toContain("Fred2005.FormalGroupLaw");
    });

    test("cleans trailing punctuation and ignores URLs/metadata prefixes", () => {
      const text = `
        Check def:target-one, def:target-two! Also (thm:paren-target).
        Look at https://example.com/sec:false-alarm and status:completed.
      `;
      const targets = extractInferredTargets(text);
      expect(targets).toContain("def:target-one");
      expect(targets).toContain("def:target-two");
      expect(targets).toContain("thm:paren-target");
      expect(targets).not.toContain("https:");
      expect(targets).not.toContain("status:completed");
    });

    test("excludes explicit targets from inferred targets", () => {
      const text = "Working on def:foo and thm:bar and sec:baz.";
      const explicit = ["def:foo"];
      const inferred = extractInferredTargets(text, explicit);
      expect(inferred).not.toContain("def:foo");
      expect(inferred).toContain("thm:bar");
      expect(inferred).toContain("sec:baz");
    });
  });

  describe("joining beans to content blocks and lean refs", () => {
    test("joins explicit and inferred targets to blocks and Lean declarations", () => {
      const mockBlocks: TraceableBlock[] = [
        {
          label: "def:state-space",
          kind: "definition",
          file: "/workspace/content/ch1/state-space.ts",
          root: "/workspace/content/ch1/state-space",
          leanRef: "qou:QOU.StateSpace",
          leanDeclaration: "QOU.StateSpace",
          leanFile: "/workspace/lean/QOU/StateSpace.lean",
          associatedBeans: [],
        },
        {
          label: "thm:quantum-universe",
          kind: "theorem",
          file: "/workspace/content/ch2/quantum-universe.ts",
          root: "/workspace/content/ch2/quantum-universe",
          leanRef: "qou:QOU.QuantumUniverse",
          leanDeclaration: "QOU.QuantumUniverse",
          associatedBeans: [],
        },
        {
          label: "sec:intro",
          kind: "section",
          file: "/workspace/content/ch1/intro.ts",
          root: "/workspace/content/ch1/intro",
          associatedBeans: [],
        },
      ];

      const mockBeans: BeanNode[] = [
        {
          id: "bean-1",
          file: "beans/defs/bean-1.md",
          title: "Define state space",
          status: "completed",
          type: "feature",
          priority: "normal",
          parent: "",
          blocking: [],
          createdAt: "2026-10-04",
          updatedAt: "2026-10-09",
          body: "Initial work on definition.",
          targets: ["def:state-space"],
        },
        {
          id: "bean-2",
          file: "beans/defs/bean-2.md",
          title: "Formalize thm:quantum-universe in Lean",
          status: "in-progress",
          type: "task",
          priority: "high",
          parent: "",
          blocking: [],
          createdAt: "2026-10-05",
          updatedAt: "2026-10-09",
          body: "See also sec:intro for exposition.",
          targets: [],
        },
        {
          id: "bean-3",
          file: "beans/defs/bean-3.md",
          title: "Direct Lean target declaration",
          status: "todo",
          type: "task",
          priority: "low",
          parent: "",
          blocking: [],
          createdAt: "2026-10-06",
          updatedAt: "2026-10-09",
          body: "Targeting Lean declaration by name.",
          targets: ["QOU.StateSpace"],
        },
      ];

      const report = buildTraceability({
        beans: mockBeans,
        blocks: mockBlocks,
      });

      // Bean 1 verification
      const b1 = report.beans.find((b) => b.id === "bean-1")!;
      expect(b1.explicitTargets).toEqual(["def:state-space"]);
      expect(b1.targets.length).toBe(1);
      expect(b1.targets[0]!.resolved).toBe(true);
      expect(b1.targets[0]!.blockLabel).toBe("def:state-space");
      expect(b1.targets[0]!.leanRef).toBe("qou:QOU.StateSpace");
      expect(b1.targets[0]!.leanDeclaration).toBe("QOU.StateSpace");
      expect(b1.targets[0]!.source).toBe("explicit");

      // Bean 2 verification (inferred)
      const b2 = report.beans.find((b) => b.id === "bean-2")!;
      expect(b2.inferredTargets).toContain("thm:quantum-universe");
      expect(b2.inferredTargets).toContain("sec:intro");
      const thmTarget = b2.targets.find((t) => t.target === "thm:quantum-universe")!;
      expect(thmTarget.resolved).toBe(true);
      expect(thmTarget.blockLabel).toBe("thm:quantum-universe");
      expect(thmTarget.leanRef).toBe("qou:QOU.QuantumUniverse");
      expect(thmTarget.source).toBe("inferred");

      // Bean 3 verification (target by Lean declaration name)
      const b3 = report.beans.find((b) => b.id === "bean-3")!;
      expect(b3.targets[0]!.resolved).toBe(true);
      expect(b3.targets[0]!.blockLabel).toBe("def:state-space");

      // Block associations verification
      const stateBlock = report.blocks.find((b) => b.label === "def:state-space")!;
      expect(stateBlock.associatedBeans).toEqual([
        { id: "bean-1", source: "explicit" },
        { id: "bean-3", source: "explicit" },
      ]);

      const qouBlock = report.blocks.find((b) => b.label === "thm:quantum-universe")!;
      expect(qouBlock.associatedBeans).toEqual([
        { id: "bean-2", source: "inferred" },
      ]);
    });
  });

  describe("coverage reporting", () => {
    test("computes coverage statistics, percentages, and unassociated sets", () => {
      const mockBlocks: TraceableBlock[] = [
        {
          label: "def:covered-1",
          kind: "definition",
          file: "content/def1.ts",
          root: "content/def1",
          associatedBeans: [],
        },
        {
          label: "thm:covered-2",
          kind: "theorem",
          file: "content/thm2.ts",
          root: "content/thm2",
          associatedBeans: [],
        },
        {
          label: "rem:uncovered",
          kind: "remark",
          file: "content/rem.ts",
          root: "content/rem",
          associatedBeans: [],
        },
        {
          label: "sec:uncovered",
          kind: "section",
          file: "content/sec.ts",
          root: "content/sec",
          associatedBeans: [],
        },
      ];

      const mockBeans: BeanNode[] = [
        {
          id: "bean-with-target",
          file: "beans/b1.md",
          title: "Work item",
          status: "todo",
          type: "task",
          priority: "normal",
          parent: "",
          blocking: [],
          createdAt: "",
          updatedAt: "",
          body: "",
          targets: ["def:covered-1", "thm:covered-2"],
        },
        {
          id: "bean-without-target",
          file: "beans/b2.md",
          title: "General housekeeping",
          status: "in-progress",
          type: "chore",
          priority: "low",
          parent: "",
          blocking: [],
          createdAt: "",
          updatedAt: "",
          body: "Nothing specific referenced here.",
          targets: [],
        },
      ];

      const report = buildTraceability({
        beans: mockBeans,
        blocks: mockBlocks,
      });

      const { coverage } = report;

      expect(coverage.totalBeans).toBe(2);
      expect(coverage.beansWithTargets).toBe(1);
      expect(coverage.beansWithoutTargets).toBe(1);
      expect(coverage.beansWithNoTargets).toEqual(["bean-without-target"]);
      expect(coverage.beanTargetCoveragePercent).toBe(50.0);

      expect(coverage.totalBlocks).toBe(4);
      expect(coverage.coveredBlocks).toBe(2);
      expect(coverage.uncoveredBlocks).toBe(2);
      expect(coverage.blocksWithNoBean).toEqual(["rem:uncovered", "sec:uncovered"]);
      expect(coverage.blockCoveragePercent).toBe(50.0);

      // Check formatting doesn't throw
      const formatted = formatTraceabilityReport(report);
      expect(formatted).toContain("=== Work Traceability Report ===");
      expect(formatted).toContain("Beans:  2 total, 1 with targets (50%)");
      expect(formatted).toContain("Blocks: 4 total, 2 covered (50%)");
      expect(formatted).toContain("rem:uncovered");
      expect(formatted).toContain("bean-without-target");
    });
  });

  describe("vacuity guard and audit evaluation", () => {
    test("returns unknown when 0 beans or 0 blocks exist", () => {
      // 0 beans and 0 blocks
      const emptyAudit = evaluateTraceabilityAudit({
        beans: [],
        blocks: [],
      });
      expect(emptyAudit.result).toBe("unknown");
      expect(emptyAudit.findings[0]!.where).toBe("traceability");
      expect(emptyAudit.findings[0]!.detail).toContain("traceability vacuous: 0 bean(s) and 0 block(s)");

      // Beans present, 0 blocks
      const noBlocksAudit = evaluateTraceabilityAudit({
        beans: [
          {
            id: "b1",
            file: "b1.md",
            title: "T",
            status: "todo",
            type: "task",
            priority: "",
            parent: "",
            blocking: [],
            createdAt: "",
            updatedAt: "",
            body: "",
            targets: ["def:foo"],
          },
        ],
        blocks: [],
      });
      expect(noBlocksAudit.result).toBe("unknown");

      // Blocks present, 0 beans
      const noBeansAudit = evaluateTraceabilityAudit({
        beans: [],
        blocks: [
          {
            label: "def:foo",
            kind: "definition",
            file: "f.ts",
            root: "f",
            associatedBeans: [],
          },
        ],
      });
      expect(noBeansAudit.result).toBe("unknown");
    });

    test("vacuity guard on empty temporary filesystem directory", () => {
      const tmp = mkdtempSync(join(tmpdir(), "vacuous-trace-"));
      try {
        const audit = evaluateTraceabilityAudit({ root: tmp });
        expect(audit.result).toBe("unknown");
        expect(audit.findings[0]!.detail).toContain("traceability vacuous");
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });

    test("reports findings when unassociated blocks or targetless beans exist", () => {
      const audit = evaluateTraceabilityAudit({
        beans: [
          {
            id: "bean-lonely",
            file: "b.md",
            title: "Has no targets",
            status: "todo",
            type: "task",
            priority: "",
            parent: "",
            blocking: [],
            createdAt: "",
            updatedAt: "",
            body: "",
            targets: [],
          },
        ],
        blocks: [
          {
            label: "def:unassociated",
            kind: "definition",
            file: "u.ts",
            root: "u",
            associatedBeans: [],
          },
        ],
      });

      expect(audit.result).toBe("fail");
      expect(audit.findings.some((f) => f.where === "def:unassociated")).toBe(true);
      expect(audit.findings.some((f) => f.where === "bean-lonely")).toBe(true);
    });

    test("passes when all blocks are covered and all beans have resolved targets", () => {
      const audit = evaluateTraceabilityAudit({
        beans: [
          {
            id: "bean-good",
            file: "b.md",
            title: "Covers block",
            status: "todo",
            type: "task",
            priority: "",
            parent: "",
            blocking: [],
            createdAt: "",
            updatedAt: "",
            body: "",
            targets: ["def:good"],
          },
        ],
        blocks: [
          {
            label: "def:good",
            kind: "definition",
            file: "g.ts",
            root: "g",
            associatedBeans: [],
          },
        ],
      });

      expect(audit.result).toBe("pass");
      expect(audit.findings).toHaveLength(0);
    });
  });

  describe("filesystem integration test", () => {
    test("reads beans with targets from disk fixture", () => {
      const tmp = mkdtempSync(join(tmpdir(), "disk-trace-"));
      try {
        const defsDir = join(tmp, "beans", "defs");
        mkdirSync(defsDir, { recursive: true });

        writeFileSync(
          join(defsDir, "folio-assistant-0001--first-bean.md"),
          `---
# folio-assistant-0001
title: 'Initial bean with targets'
status: in-progress
type: feature
targets:
  - def:energy-momentum
  - thm:conservation
---

Body of the bean describing def:kinetic-energy and sec:intro.
`,
          "utf-8",
        );

        const beans = collectBeans(tmp, defsDir);
        expect(beans.length).toBe(1);
        expect(beans[0]!.id).toBe("folio-assistant-0001");
        expect(beans[0]!.targets).toEqual(["def:energy-momentum", "thm:conservation"]);

        const explicit = extractExplicitTargets(beans[0]!);
        expect(explicit).toEqual(["def:energy-momentum", "thm:conservation"]);

        const inferred = extractInferredTargets(`${beans[0]!.title}\n${beans[0]!.body}`, explicit);
        expect(inferred).toContain("def:kinetic-energy");
        expect(inferred).toContain("sec:intro");
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });
  });
});
