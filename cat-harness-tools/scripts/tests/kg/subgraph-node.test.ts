/**
 * THE GATE for the subgraph-node pattern (bean `l4ay`, follow-up `r5wu`):
 * a generator that publishes the contents of a declared subgraph uses the
 * DECLARED Subgraph node as its container, and every member says it is part of it.
 *
 * `PUBLISHED` lists the documents / publishers that have adopted the pattern.
 *
 * Pattern taxonomy:
 * - "container": published as a standalone named graph whose container is the declared Subgraph node (`@type: Subgraph`, `hasPart`, `contentSource`) with member `inSubgraph` edges (`todos`, `fsh-guts`).
 * - "scheme": published as a domain document (SKOS ConceptScheme) linked to the declared Subgraph via `dcterms:isPartOf` (`swimlane-glossary`).
 * - "members": published as individual document nodes whose manifest / root carries `inSubgraph` pointing to the declared Subgraph (`library`, `docs`).
 *
 * Internal authoring stores and plain JSON indexes that are NOT standalone published subgraph documents:
 * - `scenarios/roles.json` (`roles`): An internal authoring registry for BPMN swimlanes, projected directly into the layer KG export (`kg-export.ts`) rather than published as an independent JSON-LD document.
 * - `beans` (`beans/`): The work-plan items are maintained as an internal store and exposed via CLI (`beans prime`/`list`) and plain JSON indexes, not published as a standalone JSON-LD graph.
 * - `qa` (`test/results/`): QA witness files and attestations are machine sidecars and branch-store records (on `qa-reports`), not published standalone Subgraph documents.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { declaredSubgraphNode, exportIdentity, makeIri } from "../../kg-export.ts";
import { legacyFragmentIri } from "../../lib/subject-iri.ts";
import { memberOf, subgraphContainer, subgraphIri, subgraphPublicationFindings } from "../../subgraph-node.ts";
import { buildFshGutsExport } from "../../fsh-guts-export.ts";
import { todoGraphDocument } from "../../todo-graph.ts";
import { buildGlossary } from "../../glossary-export.ts";
import { buildDocumentNodes, librarySubgraphStart } from "../../../pipeline/gen-library-jsonld.ts";
import { readRoleGraph } from "../../../schemas/process/role-graph.ts";
import { directoryForGraph, docsSourceDirFor } from "../../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);

export const PUBLISHED = [
  { subgraph: "todos", publisher: "scripts/todo-graph.ts", pattern: "container" },
  { subgraph: "fsh-guts", publisher: "scripts/fsh-guts-export.ts", pattern: "container" },
  { subgraph: "swimlane-glossary", publisher: "scripts/glossary-export.ts", pattern: "scheme" },
  { subgraph: "library", publisher: "pipeline/gen-library-jsonld.ts", pattern: "members" },
  { subgraph: "docs", publisher: "pipeline/gen-site-jsonld.ts", pattern: "members" },
] as const;

describe("the IRI is the one kg-export mints the node under", () => {
  test.each(["todos", "beans", "a b", "x#y", "p/q"])("%p", (id) => {
    expect(subgraphIri("https://e.org/i.jsonld", id)).toBe(makeIri("https://e.org/i.jsonld", "directory", id));
  });
});

describe("the check catches each way of getting it wrong", () => {
  const IRI = "https://e.org/i.jsonld#directory/todos";
  const ctx = { Subgraph: "x", hasPart: "x", inSubgraph: "x", contentSource: "x" };
  const good = () => ({
    "@context": { ...ctx },
    ...subgraphContainer({ iri: IRI, members: ["m1", "m2"] }),
    "@graph": [
      { "@id": "m1", ...memberOf(IRI) },
      { "@id": "m2", ...memberOf(IRI) },
    ],
  });
  test("the good shape is clean", () => {
    expect(subgraphPublicationFindings(good(), { iri: IRI })).toEqual([]);
  });
  test("a parallel collection container", () => {
    const d = { ...good(), "@id": "https://e.org/todos.jsonld", "@type": "TodoGraph" };
    const f = subgraphPublicationFindings(d, { iri: IRI });
    expect(f.some((x) => /not the declared Subgraph/.test(x))).toBe(true);
    expect(f.some((x) => /parallel collection/.test(x))).toBe(true);
  });
  test("a member without inSubgraph", () => {
    const d = good();
    delete (d["@graph"][1] as Record<string, unknown>)["inSubgraph"];
    expect(subgraphPublicationFindings(d, { iri: IRI })).toEqual([`member m2 has no inSubgraph → ${IRI}`]);
  });
  test("hasPart that misses a member", () => {
    const d = { ...good(), hasPart: ["m1"] };
    expect(subgraphPublicationFindings(d, { iri: IRI }).some((x) => /hasPart/.test(x))).toBe(true);
  });
  test("a context that does not define the terms", () => {
    const d = { ...good(), "@context": {} };
    expect(subgraphPublicationFindings(d, { iri: IRI }).length).toBe(4);
  });
});

describe("converted publishers follow the declared subgraph pattern", () => {
  test("container publisher: fsh-guts satisfies subgraphPublicationFindings", () => {
    const sub = declaredSubgraphNode(ROOT, "fsh-guts");
    expect(sub).toBeDefined();
    const doc = buildFshGutsExport(ROOT);
    expect(subgraphPublicationFindings(doc, { iri: sub!.iri })).toEqual([]);
  });

  test("container publisher: todos satisfies subgraphPublicationFindings", () => {
    const sub = declaredSubgraphNode(ROOT, "todos");
    expect(sub).toBeDefined();
    const sampleItem = {
      id: "todo-sample",
      summary: "Sample todo",
      comment: "",
      status: "open" as const,
      priority: "normal" as const,
      createdAt: "2026-10-09",
      tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
      relations: [],
    };
    const doc = todoGraphDocument([sampleItem], sub);
    expect(subgraphPublicationFindings(doc, { iri: sub!.iri })).toEqual([]);
  });

  test("scheme publisher: swimlane-glossary links to declared Subgraph via dcterms:isPartOf", () => {
    const sub = declaredSubgraphNode(ROOT, "swimlane-glossary");
    expect(sub).toBeDefined();
    const { doc } = buildGlossary({ instanceRoot: ROOT, today: () => "2026-09-21" });
    expect(doc["@type"]).toBe("skos:ConceptScheme");
    expect(doc["isPartOf"]).toBe(sub!.iri);
  });

  test("members publisher: library manifest carries inSubgraph pointing to declared Subgraph", () => {
    const sub = declaredSubgraphNode(ROOT, "library");
    expect(sub).toBeDefined();
    const nodes = buildDocumentNodes("doc-sample", { doc_id: "doc-sample", sections: [] }, undefined, () => false);
    const manifestFile = nodes.find((n) => n.path === "manifest.jsonld");
    expect(manifestFile).toBeDefined();
    const manifest = JSON.parse(manifestFile!.content) as Record<string, unknown>;
    expect(manifest["inSubgraph"]).toBe(sub!.iri);
  });

  test("members publisher: a library entry's subgraph is looked up from the instance that holds it", () => {
    // Asked from the content repo root, every layer's manifests named the
    // first `library` subgraph in the checkout — who-iris's named cat-harness's.
    expect(librarySubgraphStart(join(ROOT, "library", "doc-sample"))).toBe(ROOT);
    const sub = declaredSubgraphNode(ROOT, "library");
    const nodes = buildDocumentNodes("doc-sample", { doc_id: "doc-sample", sections: [] }, undefined, () => false, undefined, undefined, undefined, undefined, ROOT);
    const manifest = JSON.parse(nodes.find((n) => n.path === "manifest.jsonld")!.content) as Record<string, unknown>;
    expect(manifest["inSubgraph"]).toBe(sub!.iri);
  });

  test("members publisher: a corpus declared one folder deeper is looked up from its own layer", () => {
    // core#702 moved core's library to `library/corpus/<id>`. Taking the
    // layer as two folders up read `library/`, found no declaration, and in
    // an index every core manifest named cat-harness's library instead.
    const layer = mkdtempSync(join(tmpdir(), "libstart-"));
    try {
      writeFileSync(join(layer, "probe.json"), JSON.stringify({
        name: "probe",
        directories: [{ id: "library", path: "library/corpus/", graphTypologies: ["library"] }],
      }));
      mkdirSync(join(layer, "library", "corpus", "doc-x"), { recursive: true });
      expect(librarySubgraphStart(join(layer, "library", "corpus", "doc-x"))).toBe(layer);
    } finally {
      rmSync(layer, { recursive: true, force: true });
    }
  });

  test("members publisher: docs site pages carry inSubgraph pointing to declared Subgraph", () => {
    const sub = declaredSubgraphNode(ROOT, "docs");
    expect(sub).toBeDefined();
    // A page this layer still authors: `guides-writing-a-paper` was the
    // example until it moved to the layer whose papers it is about
    // (folio-assistant#2598).
    const pagePath = [
      join(docsSourceDirFor(ROOT), "guides-beans-and-todos", "guides-beans-and-todos.jsonld"),
      join(ROOT, "content/docs/guides-beans-and-todos/guides-beans-and-todos.jsonld"),
    ].find(existsSync);
    expect(pagePath).toBeDefined();
    const page = JSON.parse(readFileSync(pagePath!, "utf-8")) as Record<string, unknown>;
    // The page is COMMITTED in the content layer, so for the one release the
    // #603 tombstones cover it may still carry the subgraph's old fragment —
    // which the export keeps as a tombstone `sameAs` this very IRI. Either
    // names the declared node; anything else is the defect this test is for.
    // Drop the legacy arm with the tombstones.
    // The old fragment is of the document the LAST release published: the
    // host's root one, which moved under `<site>/<name>/` (#603 decision 1b).
    const id = exportIdentity({ instanceRoot: sub!.declared.instanceRoot });
    const legacy = legacyFragmentIri(sub!.iri, id.docIri, id.legacyDocIri ?? id.docIri);
    expect([sub!.iri, legacy]).toContain(page["inSubgraph"] as string);
  });

  test("authoring registries: roles.json is an authoring registry projected into KG export, not a standalone published subgraph document", () => {
    const scenarios = directoryForGraph(ROOT, "scenarios")!;
    const rolesPath = join(scenarios, "roles.json");
    expect(existsSync(rolesPath)).toBe(true);
    const g = readRoleGraph(scenarios);
    expect(g).toBeDefined();
    expect(g!.roles.length).toBeGreaterThan(0);
  });
});
