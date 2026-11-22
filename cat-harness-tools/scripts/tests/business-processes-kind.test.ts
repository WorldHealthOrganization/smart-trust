/**
 * The `business-processes` kind: BPMN that describes work as content (a
 * DAK's business processes). The processes viewer and `render:bpmn` read it;
 * `workflowFiles`, which every engine gate reads, does not (owner,
 * 2026-11-01, Q-SUBG-4 B, Q-SUBG-6 A).
 *
 * @module cat-harness-tools/scripts/tests/business-processes-kind.test
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defaultGraphTypologies } from "../../schemas/kg/graph-typology-registry.ts";
import { businessProcessFiles, workflowFiles } from "../known-skills.ts";

describe("the business-processes kind", () => {
  test("is registered, as content that nothing renders as a page by itself", () => {
    const def = defaultGraphTypologies.get("business-processes");
    expect(def?.holds).toBe("content");
    expect(def?.renderable).toBe(false);
  });

  test("its diagrams are read by businessProcessFiles and never by workflowFiles", () => {
    const root = mkdtempSync(join(tmpdir(), "bp-kind-"));
    try {
      writeFileSync(
        join(root, "ig.json"),
        JSON.stringify({
          $schema: "cat-harness-declaration/1.0.0",
          name: "ig",
          version: "0.1.0",
          directories: [{ id: "ig-bp", path: "input/business-processes/", graphTypologies: ["business-processes"] }],
        }),
      );
      mkdirSync(join(root, "input", "business-processes"), { recursive: true });
      writeFileSync(join(root, "input", "business-processes", "A.bpmn"), "<bpmn:definitions/>");
      expect(businessProcessFiles(root).map((f) => f.slice(root.length))).toEqual(["/input/business-processes/A.bpmn"]);
      expect(workflowFiles(root).some((f) => f.endsWith("A.bpmn"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("business-processes sits within processes", () => {
  test("declares within: processes (display only, no inheritance)", () => {
    expect(defaultGraphTypologies.get("business-processes")?.within).toBe("processes");
  });
});

describe("a BPMN held as a folio block", () => {
  test("is a business process: listed by businessProcessFiles, never by workflowFiles", () => {
    const root = mkdtempSync(join(tmpdir(), "bp-folio-"));
    try {
      writeFileSync(
        join(root, "ig.json"),
        JSON.stringify({
          $schema: "cat-harness-declaration/1.0.0",
          name: "ig",
          version: "0.1.0",
          directories: [{ id: "ig-folio", path: "folio/", graphTypologies: ["folio"] }],
        }),
      );
      mkdirSync(join(root, "folio", "ig", "intro"), { recursive: true });
      writeFileSync(join(root, "folio", "ig", "intro", "bp-01.bpmn"), "<bpmn:definitions/>");
      expect(businessProcessFiles(root).map((f) => f.slice(root.length))).toEqual(["/folio/ig/intro/bp-01.bpmn"]);
      expect(workflowFiles(root).some((f) => f.endsWith("bp-01.bpmn"))).toBe(false);
      // render:bpmn leaves it alone: the block already carries its own SVG.
      expect(businessProcessFiles(root, { folio: false })).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
