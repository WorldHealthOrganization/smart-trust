/**
 * The knowledge-graph EXTRACTORS, ported from WHO smart-kg `tools/extract-*.mjs`
 * (main 3f5e477) into each emitting layer's schemas folder (issue #359).
 *
 * Each is run on smart-base's own real inputs where they exist, and its output
 * is held to `check()` with no errors and to the node classes it should emit.
 * extract-l3 has no built fsh-generated/ in a plain checkout, so it reads the
 * IG's FSH source tree, which is real input; the one extractor with no real
 * input of its kind (an isolated BPMN under a DAK namespace) is given a minimal
 * fixture built in the test rather than a committed data file.
 *
 * The inputs live at the IG repository root (`input/`, `sushi-config.yaml`),
 * one level above this named subgraph's root (`smart-base/`).
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { extract as extractBpmn, readPersonaTitles } from "../../../L2-bpmn/schemas/extract-bpmn.ts";
import { extract as extractCitations } from "../../../L2-dmn/schemas/extract-citations.ts";
import { extract as extractDmn } from "../../../L2-dmn/schemas/extract-dmn.ts";
import { extract as extractDak } from "../../../L2/schemas/extract-dak.ts";
import { extract as extractL3 } from "../../../L3/schemas/extract-l3.ts";
import { LAYER_ROOT } from "../layers.ts";
import { check } from "../validate.ts";

/** The IG repository root — one above `smart-base/` (LAYER_ROOT). */
const IG = join(LAYER_ROOT, "..");
const BCG = join(IG, "input/dmn/DAK.DT.IMMZ.D2.DT.BCG.dmn");
const FSH = join(IG, "input/fsh");
const BPMN = join(IG, "smart-base/collab/processes/content/SGAuthoring.DAKLifecycle.bpmn");
/**
 * Whether the IG's own inputs are in this checkout. An index mounts this
 * package (`smart-base/`) but not the IG around it, so there `input/` is not
 * here and the extractors that read it are n/a, as in `generated.test.ts`.
 * In the IG repository `input/` is present and a missing input still fails.
 */
const IG_INPUT = existsSync(join(IG, "input"));
const IG_ONLY = { skip: IG_INPUT ? false : "no input/ here (an index mounts the package, not the IG): NOT checked (n/a, not a pass)" };

type AnyNode = { id: string; type: string; properties?: Record<string, unknown> };
const externalOf = (...docs: { nodes: AnyNode[] }[]): Map<string, AnyNode> => {
  const m = new Map<string, AnyNode>();
  for (const d of docs) for (const n of d.nodes) if (!m.has(n.id)) m.set(n.id, n);
  return m;
};
const classes = (doc: { nodes: { type: string }[] }): Set<string> => new Set(doc.nodes.map((n) => n.type));
const noErrors = (doc: unknown, external?: Map<string, AnyNode>) => {
  const v = check(doc, external);
  assert.deepEqual(v.errors, [], v.errors.join("\n"));
  return v;
};

test("extractCitations: the BCG table's L1 references, with the README's coverage", IG_ONLY, () => {
  assert.ok(existsSync(BCG), `missing real input ${BCG}`);
  const { doc, stats } = extractCitations(readFileSync(BCG, "utf8"), BCG);
  // README: "25 rules, 1 distinct L1 citation(s)" and "coverage: 1/25 rules cite an L1 source".
  assert.equal(stats.rules, 25);
  assert.equal(stats.citations, 1);
  assert.equal(stats.cited, 1);
  assert.deepEqual([...classes(doc)].sort(), ["citation", "external-artifact"]);
  noErrors(doc);
});

test("extractDmn: the BCG table's interior as the L2-DMN subgraph", IG_ONLY, () => {
  const { doc } = extractDmn(readFileSync(BCG, "utf8"), BCG);
  for (const c of ["dmn-definitions", "dmn-decision", "dmn-decision-table", "dmn-input-clause", "dmn-output-clause", "dmn-rule", "data-element"]) {
    assert.ok(classes(doc).has(c), `expected a ${c} node`);
  }
  assert.equal(doc.nodes.filter((n) => n.type === "dmn-rule").length, 25);
  // citesSource reaches an L1 citation minted in the citations document; resolve it cross-document.
  const { doc: cit } = extractCitations(readFileSync(BCG, "utf8"), BCG);
  noErrors(doc, externalOf(cit));
});

test("extractBpmn: a real BPMN's interior as the L2-BPMN subgraph", () => {
  assert.ok(existsSync(BPMN), `missing real input ${BPMN}`);
  const { doc } = extractBpmn(readFileSync(BPMN, "utf8"), BPMN);
  for (const c of ["bpmn-definitions", "bpmn-process", "bpmn-participant", "bpmn-task", "persona"]) {
    assert.ok(classes(doc).has(c), `expected a ${c} node`);
  }
  // With no --personas, every pool -> persona join is unresolved and its target minted in-document.
  noErrors(doc);
});

test("extractBpmn: a pool resolves against ActorDefinition titles (built fixture)", () => {
  const dir = mkdtempSync(join(tmpdir(), "kg-bpmn-"));
  writeFileSync(
    join(dir, "actor.fsh"),
    ["Instance: DAK.Persona.Nurse", "InstanceOf: ActorDefinition", 'Usage: #definition', '* title = "Registered nurse"', '* status = #active', ""].join("\n"),
  );
  const bpmn = join(dir, "care.bpmn");
  writeFileSync(
    bpmn,
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Care" targetNamespace="http://smart.who.int/base">',
      '  <bpmn:collaboration id="C"><bpmn:participant id="P" name="Registered nurse" processRef="Proc"/></bpmn:collaboration>',
      '  <bpmn:process id="Proc" isExecutable="true"><bpmn:startEvent id="s"/><bpmn:task id="t" name="See patient"/><bpmn:endEvent id="e"/>',
      '    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="t"/><bpmn:sequenceFlow id="f2" sourceRef="t" targetRef="e"/></bpmn:process>',
      "</bpmn:definitions>",
      "",
    ].join("\n"),
  );
  const { doc } = extractBpmn(readFileSync(bpmn, "utf8"), bpmn, readPersonaTitles(dir));
  const join_ = doc.edges.find((e) => e.predicate === "performedBy");
  assert.equal(join_?.properties?.resolutionStatus, "resolved");
  // A resolved pool mints no persona node (the DAK's extractor owns that node); the edge reaches
  // it across documents, so the persona is supplied as external — as it is in a real multi-doc run.
  const persona: AnyNode = { id: join_!.target, type: "persona", properties: { resolutionStatus: "resolved" } };
  noErrors(doc, externalOf({ nodes: [persona] }));
});

test("extractDak: personas and requirements from the real FSH tree", IG_ONLY, () => {
  assert.ok(existsSync(FSH), `missing real input ${FSH}`);
  const dak = mkdtempSync(join(tmpdir(), "kg-dak-"));
  const dakPath = join(dak, "dak.json");
  writeFileSync(
    dakPath,
    JSON.stringify({ id: "base", name: "Base", title: "SMART Base", canonicalUrl: "https://smart.who.int/base", version: "0.3.0", status: "draft", publisher: { name: "WHO", url: "https://www.who.int" } }),
  );
  const { doc, stats } = extractDak({ dakPath, fshDir: FSH, dmnDir: join(IG, "input/dmn") });
  for (const c of ["dak", "persona", "functional-requirement", "requirement-statement"]) {
    assert.ok(classes(doc).has(c), `expected a ${c} node`);
  }
  assert.ok(stats.found.personas > 0 && stats.found.requirements > 0);
  // Every fulfilledBy join resolves by canonical reference against an in-document persona.
  const v = noErrors(doc);
  const joins = v.metrics.joins as { resolved?: number; unresolved?: number } | undefined;
  assert.ok(joins && joins.resolved! > 0);
});

test("extractL3: the IG's FHIR artefacts as the L3 subgraph", IG_ONLY, () => {
  assert.ok(existsSync(join(IG, "sushi-config.yaml")), "missing sushi-config.yaml");
  const { doc, stats } = extractL3(IG);
  for (const c of ["actor-definition", "requirements", "value-set", "code-system", "structure-definition", "profile"]) {
    assert.ok(classes(doc).has(c), `expected a ${c} node`);
  }
  assert.ok(stats.counts.ActorDefinition! > 0);
  noErrors(doc);
});
