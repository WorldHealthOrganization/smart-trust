/**
 * `targetNamespacesInUse` — bean `rtrg`.
 *
 * Every diagram shares ONE targetNamespace, because a `calledElement` is a
 * QName: a call into a diagram in another namespace does not resolve in a
 * conformant tool. The check must fire on drift, on a missing declaration,
 * and must pass on the real corpus.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { WORKFLOWS_NS } from "../../schemas/kg/namespaces.ts";
import { targetNamespacesInUse } from "../external-schemas";

/** Writes the diagrams and returns [the file list, the base they are relative to]. */
function corpus(files: Record<string, string>): [string[], string] {
  const root = mkdtempSync(join(tmpdir(), "target-ns-"));
  mkdirSync(join(root, "processes"));
  for (const [f, src] of Object.entries(files)) writeFileSync(join(root, "processes", f), src);
  return [Object.keys(files).sort().map((f) => join(root, "processes", f)), root];
}
const diagram = (ns?: string) =>
  `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D"${ns === undefined ? "" : ` targetNamespace="${ns}"`}><bpmn:process id="P"/></bpmn:definitions>`;

describe("targetNamespacesInUse", () => {
  test("groups diagrams by the namespace they declare", () => {
    const root = corpus({
      "a.bpmn": diagram(WORKFLOWS_NS),
      "b.bpmn": diagram("http://folio-assistant.dev/bpmn/b"),
      "c.bpmn": diagram(WORKFLOWS_NS),
    });
    const m = targetNamespacesInUse(...root);
    expect(m.get(WORKFLOWS_NS)).toEqual(["processes/a.bpmn", "processes/c.bpmn"]);
    expect(m.get("http://folio-assistant.dev/bpmn/b")).toEqual(["processes/b.bpmn"]);
  });

  test("a diagram that declares none is reported, not skipped", () => {
    expect(targetNamespacesInUse(...corpus({ "x.bpmn": diagram() })).get("")).toEqual(["processes/x.bpmn"]);
  });

  test("the real corpus has exactly one, and it is the canonical IRI", () => {
    const m = targetNamespacesInUse();
    expect([...m.keys()]).toEqual([WORKFLOWS_NS]);
    expect(m.get(WORKFLOWS_NS)!.length).toBeGreaterThan(0);
  });
});
