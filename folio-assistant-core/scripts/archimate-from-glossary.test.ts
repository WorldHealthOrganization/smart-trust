/**
 * The model drawn from the graph (owner, 2026-11-01, smart-ra#166, B then A):
 * terms whose focus is an ArchiMate element make the model agree, matched by
 * `skosConcept`, never by name, and never moving a box.
 */
import { describe, expect, test } from "bun:test";

import { applyPlan, isIngested, plan, seedFrom, type GraphElement } from "./archimate-from-glossary.ts";

const am = "../../cat-harness-tools/archimate";
const { parseArchimate, layerOf } = await import(`${am}/schemas/archimate.ts`);

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="M" id="id-m" version="5.0.0">
  <folder name="Business" id="id-fb" type="business"/>
  <folder name="Application" id="id-fa" type="application">
    <element xsi:type="archimate:ApplicationComponent" name="CR" id="id-cr">
      <property key="skosConcept" value="ra.glossary.json#client-registry"/>
    </element>
    <element xsi:type="archimate:ApplicationService" name="Lookup" id="id-ls">
      <property key="skosConcept" value="ra.glossary.json#client-lookup"/>
    </element>
    <element xsi:type="archimate:ApplicationComponent" name="Unlinked" id="id-un"/>
  </folder>
  <folder name="Relations" id="id-fr" type="relations">
    <element xsi:type="archimate:ServingRelationship" id="id-old" source="id-ls" target="id-cr"/>
  </folder>
  <folder name="Views" id="id-fv" type="diagrams">
    <element xsi:type="archimate:ArchimateDiagramModel" name="V" id="id-v">
      <child xsi:type="archimate:DiagramObject" id="id-n1" targetConnections="id-c1" archimateElement="id-cr">
        <bounds x="10" y="20" width="120" height="55"/>
      </child>
      <child xsi:type="archimate:DiagramObject" id="id-n2" archimateElement="id-ls">
        <bounds x="200" y="20" width="120" height="55"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c1" source="id-n2" target="id-n1" archimateRelationship="id-old"/>
      </child>
    </element>
  </folder>
</archimate:model>
`;

const term = (termId: string, name: string, focus: GraphElement["focus"], documentation?: string): GraphElement => ({
  key: `ra.glossary.json#${termId}`,
  scheme: "ra",
  termId,
  name,
  ...(documentation ? { documentation } : {}),
  focus,
});
const TERMS: GraphElement[] = [
  term("client-registry", "Client Registry", { archimate: "ApplicationComponent", relationships: [{ type: "Realization", target: "client-lookup" }] }, "Holds who the clients are."),
  term("client-lookup", "Client lookup", { archimate: "ApplicationService" }),
  term("client-role", "Client", { archimate: "BusinessRole", relationships: [{ type: "Serving", target: "nowhere-local" }] }),
];

describe("archimate-from-glossary", () => {
  const model = parseArchimate(XML);
  const p = plan(model, TERMS, "m");

  test("plansByLink", () => {
    expect(p.linked).toBe(2);
    expect(p.unlinked).toBe(1);
    expect(p.update).toEqual([{ id: "id-cr", term: TERMS[0], name: "Client Registry", documentation: "Holds who the clients are." }, { id: "id-ls", term: TERMS[1], name: "Client lookup" }]);
    expect(p.create.map((c) => c.term.termId)).toEqual(["client-role"]);
    expect(p.relate.map((r) => [r.type, r.source, r.target])).toEqual([["Realization", "id-cr", "id-ls"]]);
    expect(p.extra.map((x) => x.id)).toEqual(["id-old"]);
    expect(p.problems).toEqual([]);
    expect(plan(model, TERMS, "m")).toEqual(p);
  });

  test("typeDisagreementReported", () => {
    const wrong = plan(model, [term("client-registry", "Client Registry", { archimate: "ApplicationService" })], "m");
    expect(wrong.problems[0]).toContain("is a ApplicationComponent, the graph says ApplicationService");
  });

  test("writtenBackAgrees", () => {
    const xml = applyPlan(XML, p, layerOf);
    const after = parseArchimate(xml);
    const again = plan(after, TERMS, "m");
    expect([again.create, again.update, again.relate]).toEqual([[], [], []]);
    expect(after.elements.find((e: { id: string }) => e.id === "id-cr").documentation).toBe("Holds who the clients are.");
    expect(after.elements.find((e: { type: string }) => e.type === "BusinessRole").properties).toEqual([{ key: "skosConcept", value: "ra.glossary.json#client-role" }]);
    expect(xml).toContain(`<bounds x="10" y="20" width="120" height="55"/>`);
    expect(xml).toContain(`archimateRelationship="id-old"`);
  });

  test("pruneRemovesUnlisted", () => {
    const xml = applyPlan(XML, p, layerOf, { prune: true });
    expect(xml).not.toContain("id-old");
    expect(xml).not.toContain("id-c1");
    const after = parseArchimate(xml);
    expect(after.views[0].connections).toEqual([]);
    expect(plan(after, TERMS, "m").extra).toEqual([]);
  });

  test("seedMovesLinkedOnce", () => {
    const seeds = seedFrom(model, [{ file: "ra.glossary.json", id: "ra", terms: [{ id: "client-registry" }, { id: "client-lookup", focus: { archimate: "ApplicationService" } }] }]);
    expect(seeds).toEqual([{ file: "ra.glossary.json", focus: [{ termId: "client-registry", focus: { archimate: "ApplicationComponent" } }] }]);
    const both = seedFrom(model, [{ file: "ra.glossary.json", id: "ra", terms: [{ id: "client-registry" }, { id: "client-lookup" }] }]);
    expect(both[0]!.focus.find((x) => x.termId === "client-lookup")!.focus).toEqual({ archimate: "ApplicationService", relationships: [{ type: "Serving", target: "client-registry" }] });
  });

  test("seedOnlyIngestedModel", () => {
    expect(isIngested("/r", "/r/library/who-ra-2024/model.archimate")).toBe(true);
    expect(isIngested("/r", "/r/archimate/0.3.0-draft.1/WHOBaseFile.archimate")).toBe(false);
    expect(isIngested("/r", "/r/library-copy/model.archimate")).toBe(false);
    expect(isIngested("/r", "/elsewhere/library/model.archimate")).toBe(false);
  });
});
