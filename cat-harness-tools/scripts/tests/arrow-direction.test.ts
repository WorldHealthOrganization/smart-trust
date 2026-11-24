import { describe, expect, test } from "bun:test";
import { processArrowFindings, schemaArrowFindings } from "../arrow-direction.js";
import type { SchemaDecl, SchemaEdge, SchemaGraph } from "../schema-graph.js";

const decl = (name: string, general = false): SchemaDecl => ({
  id: `m.ts#${name}`, name, module: "m.ts", kind: "zod-object", fields: [], extendsNames: [], values: [],
  refs: [], unresolved: [], external: [], line: 1, exported: true, ...(general ? { general: true as const } : {}),
});
const ref = (from: string, via: string, to: string): SchemaEdge => ({
  from: `m.ts#${from}`, to: `m.ts#${to}`, via, kind: "id-ref", optional: false, array: false,
});
const graph = (decls: SchemaDecl[], edges: SchemaEdge[]): SchemaGraph => ({ roots: [], modules: [], decls, edges, refProblems: [], unread: [] });

describe("the dependent holds the pointer (#1168, B5)", () => {
  test("a general node pointing at a dependent is a finding; general to general is not", () => {
    const g = graph(
      [decl("Role", true), decl("Skill", true), decl("Voice")],
      [ref("Role", "skills", "Skill"), ref("Role", "voice", "Voice"), ref("Voice", "roles", "Role")],
    );
    const f = schemaArrowFindings(g);
    expect(f.map((x) => x.where)).toEqual(["m.ts#Role.voice"]);
  });

  test("only declared id-refs are arrows — composition is part-of, not a pointer", () => {
    const g = graph([decl("Role", true), decl("Part")], [{ ...ref("Role", "part", "Part"), kind: "field" }]);
    expect(schemaArrowFindings(g)).toEqual([]);
  });

  test("a process may point at its skills, roles and decisions, and at nothing that depends on it", () => {
    const bpmn = `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
      xmlns:b.p="https://example.org/bootstrap/processes/ns#" xmlns:c.p="https://example.org/cat-harness/processes/ns#">
      <b.p:skill ref="todo-manager"/><b.p:role ref="author"/>
      <c.p:decision ref="decisions/x.dmn#D"/><c.p:bean op="claim"/>
      <c.p:implements workflow=".github/workflows/x.yml"/>
      <c.p:link href="x.html#y" /><bpmn:task id="T" name="not an extension"/>`;
    const r = processArrowFindings("p.bpmn", bpmn);
    expect(r.examined).toBe(6);
    expect(r.findings.map((x) => x.detail.split(" — ")[0])).toEqual([
      '<c.p:implements workflow=".github/workflows/x.yml">',
      '<c.p:link href="x.html#y">',
    ]);
  });

  test("the extension prefixes are read from the file, so a renamed namespace is still examined", () => {
    const old = `<x xmlns:folio="https://example.org/folio#" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"><folio:link href="a.html"/></x>`;
    const r = processArrowFindings("p.bpmn", old);
    expect(r.examined).toBe(1);
    expect(r.findings).toHaveLength(1);
    expect(processArrowFindings("q.bpmn", "<bpmn:task/>").examined).toBe(0);
  });
});
