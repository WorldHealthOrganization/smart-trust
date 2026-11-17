/**
 * Code lists — owner, 2026-09-23: "list of codes and corresponding narrative
 * desc and source should be part of a node/asset".
 *
 * Three properties, each asserted where it can fail:
 *  1. the SHAPE refuses a list a reader could not use (a code with no
 *     definition, a source that names nothing, a code listed twice);
 *  2. the ENGINE refuses an adjudication whose codes disagree with the list
 *     it names — the point of moving the codes into a node;
 *  3. the constants code reads are the list's values, so the two cannot drift.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { ownNamespaceValues } from "../../schemas/kg/graph-typology-registry.ts";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  CodeListSchema,
  activeCodes,
  codeListDirs,
  codeListToSkos,
  loadCodeLists,
  type CodeList,
} from "../../schemas/library/code-list.ts";
import * as ns from "../../schemas/kg/namespaces.ts";
import { loadProcessModel } from "../../src/workflow/process-model.js";
import { buildCodeListsDoc, unlistedAdjudications } from "../code-lists";
import { jsonLdNamespacesInUse } from "../external-schemas";
import { HARNESS_ROOT } from "../lib/roots.ts";

const INSTANCE = resolve(HARNESS_ROOT);

const list = (over: Partial<CodeList> = {}): unknown => ({
  $schema: "folio-code-list/v1",
  id: "t",
  title: "T",
  description: "A test list of two answers.",
  source: { note: "a test" },
  codes: [
    { code: "yes", label: "Yes", definition: "The thing holds, as asked." },
    { code: "no", label: "No", definition: "The thing does not hold, as asked." },
  ],
  ...over,
});

describe("the shape", () => {
  test("a well-formed list parses", () => {
    expect(CodeListSchema.safeParse(list()).success).toBe(true);
  });

  test("refuses a code listed twice, a source naming nothing, a code with no definition", () => {
    const dup = list({ codes: [{ code: "a", label: "A", definition: "the first meaning" }, { code: "a", label: "A2", definition: "a second meaning" }] as CodeList["codes"] });
    expect(CodeListSchema.safeParse(dup).success).toBe(false);
    expect(CodeListSchema.safeParse(list({ source: {} as CodeList["source"] })).success).toBe(false);
    const bare = list({ codes: [{ code: "a", label: "A" }] as unknown as CodeList["codes"] });
    expect(CodeListSchema.safeParse(bare).success).toBe(false);
  });

  test("a retired code stays in the list but is not one of its values", () => {
    const l = CodeListSchema.parse(list({ codes: [
      { code: "old", label: "Old", definition: "an answer no longer offered", status: "retired" },
      { code: "new", label: "New", definition: "the answer offered now" },
    ] as CodeList["codes"] }));
    expect(activeCodes(l)).toEqual(["new"]);
    const skos = codeListToSkos(l, "https://x.example/d.jsonld");
    expect(skos.find((n) => n["notation"] === "old")?.["deprecated"]).toBe(true);
    expect(skos[0]!["@type"]).toBe("skos:ConceptScheme");
  });
});

describe("loading", () => {
  test("skips files that are not code lists; a later directory overrides an earlier one", () => {
    const a = mkdtempSync(join(tmpdir(), "cl-a-"));
    const b = mkdtempSync(join(tmpdir(), "cl-b-"));
    writeFileSync(join(a, "t.json"), JSON.stringify(list()));
    writeFileSync(join(a, "other.json"), JSON.stringify({ $schema: "something-else/v1" }));
    writeFileSync(join(b, "t.json"), JSON.stringify(list({ title: "Overridden" })));
    const m = loadCodeLists([a, b]);
    expect([...m.keys()]).toEqual(["t"]);
    expect(m.get("t")!.title).toBe("Overridden");
  });

  test("this instance declares its code lists, and every one parses", async () => {
    const lists = loadCodeLists(await codeListDirs(INSTANCE));
    expect(lists.size).toBeGreaterThan(0);
    expect(lists.has("own-namespaces")).toBe(true);
    const doc = buildCodeListsDoc([...lists.values()], "https://x.example/cl.jsonld");
    expect((doc["@graph"] as unknown[]).length).toBeGreaterThan(lists.size);
  });
});

describe("the engine checks an adjudication's codes against the list it names", () => {
  // Under the layer, so the diagram resolves the layer's real lists; a
  // dot-prefixed directory, which every corpus walker skips.
  const dir = mkdtempSync(join(INSTANCE, "test", ".code-list-fixture-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const diagram = (adj: string) => {
    // input-site: inert #9c8a98d8 — a unique scratch name or throwaway token; no assertion depends on its value
    const p = join(dir, `${Math.random().toString(36).slice(2)}.bpmn`);
    writeFileSync(
      p,
      `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/" xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/" targetNamespace="urn:t">
  <bpmn:process id="Process_T" isExecutable="false">
    <bpmn:startEvent id="Start_T"/>
    <bpmn:task id="A_T" name="Adjudicate">
      <bpmn:extensionElements>${adj}<cat-harness.processes:fulfilment kinds="person agent" reason="a judgement"/></bpmn:extensionElements>
    </bpmn:task>
  </bpmn:process>
</bpmn:definitions>
`,
    );
    return p;
  };

  test("the list's own codes load", async () => {
    const m = await loadProcessModel(diagram('<cat-harness.processes:adjudication codes="stands withdrawn" list="adjudication-content-finding"/>'));
    expect(m.nodes.get("A_T")!.adjudication).toEqual({ codes: ["stands", "withdrawn"], list: "adjudication-content-finding" });
  });

  test("REFUSES a code the list does not define, and one it defines that is missing", async () => {
    await expect(
      loadProcessModel(diagram('<cat-harness.processes:adjudication codes="stands overruled" list="adjudication-content-finding"/>')),
    ).rejects.toThrow(/defines \(stands, withdrawn\)/);
  });

  test("REFUSES a list nothing declares", async () => {
    await expect(
      loadProcessModel(diagram('<cat-harness.processes:adjudication codes="a b" list="no-such-list"/>')),
    ).rejects.toThrow(/no declared code-list/);
  });

  test("REFUSES a list with no codes beside it", async () => {
    await expect(
      loadProcessModel(diagram('<cat-harness.processes:adjudication list="adjudication-criterion"/>')),
    ).rejects.toThrow(/without `codes`/);
  });

  test("this repository's diagrams all name their list", () => {
    const f = mkdtempSync(join(tmpdir(), "cl-unlisted-"));
    mkdirSync(join(f, "p"));
    writeFileSync(
      join(f, "p", "x.bpmn"),
      `<bpmn:definitions xmlns:bootstrap.processes="${ns.BOOTSTRAP_PROCESSES_NS}" xmlns:cat-harness.processes="${ns.CAT_HARNESS_PROCESSES_NS}"><cat-harness.processes:adjudication codes="a b"/><cat-harness.processes:adjudication codes="a b" list="l"/></bpmn:definitions>`,
    );
    expect(unlistedAdjudications([join(f, "p", "x.bpmn")], f)).toHaveLength(1);
  });
});

describe("our namespaces are the code list's values", () => {
  test("each constant equals its code's value", async () => {
    const own = JSON.parse(readFileSync(join(INSTANCE, "code-lists", "own-namespaces.json"), "utf-8")) as {
      codes: { code: string; value?: string }[];
    };
    const v = (code: string) => own.codes.find((c) => c.code === code)!.value!;
    expect(ns.WORKFLOWS_NS).toBe(v("workflows"));
    expect(ns.FOLIO_BPMN_NS).toBe(v("folio-bpmn"));
    expect(ns.CAT_HARNESS_NS).toBe(v("cat-harness"));
    expect(ns.OWN_NAMESPACE_VALUES).toContain(ns.FOLIO_BASE);
  });

  test("the JSON-LD scan (bean 2j09) sees external vocabularies and none of ours", () => {
    const found = [...jsonLdNamespacesInUse().keys()];
    expect(found).toContain("http://www.w3.org/ns/prov#");
    expect(found).toContain("http://www.w3.org/2004/02/skos/core#");
    const ours = ownNamespaceValues();
    expect(found.filter((iri) => ours.some((o) => iri.startsWith(o) || o.startsWith(iri)))).toEqual([]);
  });
});
