/**
 * Plane stripping — the difference between 8 of 8 processes drawn and 7.
 *
 * A BPMN file may carry a top-level plane plus one per collapsed sub-process
 * drilled into. `IMMZ.D.Administer Vaccine` has eight, and `IMMZ.D17` appears
 * both as a shape in the top-level diagram and as the root of its own plane.
 * That is legal BPMN, and a plain bpmn-js Viewer **cannot import it at all** —
 * "element <IMMZ.D17> already exists", raised during `importXML`, before
 * anything renders.
 *
 * So the extra planes are stripped before import and counted. Catching the
 * failure instead would yield no diagram for that file; stripping yields the
 * top-level one plus an honest count of what is not shown.
 *
 * Text-level on purpose: parsing and re-serialising risks rewriting the
 * namespace prefixes the DI references depend on. These pin that the cut is
 * exact.
 */
import { describe, test, expect } from "bun:test";
import { keepPrimaryPlane, svgName } from "../../../scripts/bpmn-render";

const plane = (id: string) =>
  `<bpmndi:BPMNDiagram id="${id}"><bpmndi:BPMNPlane bpmnElement="P${id}"/></bpmndi:BPMNDiagram>`;

describe("keepPrimaryPlane", () => {
  test("a single-plane file is returned untouched", () => {
    const xml = `<definitions>${plane("D1")}</definitions>`;
    const r = keepPrimaryPlane(xml);
    expect(r.stripped).toBe(0);
    expect(r.xml).toBe(xml);
  });

  test("a file with no diagram at all is untouched", () => {
    const xml = "<definitions><process id='p'/></definitions>";
    expect(keepPrimaryPlane(xml)).toEqual({ xml, stripped: 0 });
  });

  test("keeps the first plane and counts the rest", () => {
    const xml = `<definitions>${plane("D1")}${plane("D2")}${plane("D3")}</definitions>`;
    const r = keepPrimaryPlane(xml);
    expect(r.stripped).toBe(2);
    expect(r.xml).toContain('id="D1"');
    expect(r.xml).not.toContain('id="D2"');
    expect(r.xml).not.toContain('id="D3"');
  });

  test("the document stays well-formed — the closing tag survives", () => {
    const xml = `<definitions>${plane("D1")}${plane("D2")}</definitions>`;
    expect(keepPrimaryPlane(xml).xml.endsWith("</definitions>")).toBe(true);
  });

  test("process content before the diagrams is preserved", () => {
    // Stripping DI must never touch the semantic model.
    const xml = `<definitions><process id="p"><task id="t"/></process>${plane("D1")}${plane("D2")}</definitions>`;
    const r = keepPrimaryPlane(xml);
    expect(r.xml).toContain('<task id="t"/>');
  });

  test("works with an unprefixed BPMNDiagram", () => {
    const xml = `<definitions><BPMNDiagram id="a"/></definitions>`;
    // One plane, nothing to strip — and the unprefixed form must still match,
    // or a file using it would be mis-counted as having none.
    expect(keepPrimaryPlane(xml).stripped).toBe(0);
  });
});

describe("svgName", () => {
  test("a sole diagram is named for its file", () => {
    expect(svgName("/x/IMMZ.A.Foo.bpmn", "Diagram_1", true)).toBe("IMMZ.A.Foo.svg");
  });

  test("multiple diagrams are distinguished by id", () => {
    expect(svgName("/x/IMMZ.A.Foo.bpmn", "Diagram_1", false)).toBe("IMMZ.A.Foo__Diagram_1.svg");
  });

  test("spaces in a WHO filename become safe", () => {
    // Real files are named "Workflow D_ administer vaccine business process.bpmn".
    expect(svgName("/x/Workflow D_ admin.bpmn", "d", true)).toBe("Workflow-D_-admin.svg");
  });
});
