/**
 * `scripts/gen-instance-contexts.ts` over a small fixture tree: two layers,
 * one needing the other, each with a few documents (bean folio-assistant-63q4).
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { contextPathFor, findings, generateInstanceContexts, INSTANCE_CONTEXT_PATH, NS_DOCUMENT_CONTEXT_PATH, render } from "../gen-instance-contexts.ts";

const root = mkdtempSync(join(tmpdir(), "gen-instance-contexts-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const put = (rel: string, value: unknown): void => {
  const p = join(root, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, typeof value === "string" ? value : JSON.stringify(value));
};

put("base/base.json", { name: "base", needs: [], jsonldPrefixes: { dcterms: "http://purl.org/dc/terms/", skos: "http://www.w3.org/2004/02/skos/core#" } });
put("top/top.json", { name: "top", needs: ["base"], jsonldPrefixes: { bibo: "http://purl.org/ontology/bibo/", fabio: "http://purl.org/spar/fabio/" } });
put("empty/empty.json", { name: "empty", needs: ["base"] });
// declared-path-literal: the test's subject is this published context path itself, written as consumers see it.
put("declared/declared.json", { name: "declared", needs: ["base"], builtAtPublish: [{ path: "ns/context/v1.jsonld", writer: ["jsonld:contexts"], because: "checkout", reason: "test" }] });

// base: speaks skos (inside an array) and dcterms only inside its own context file, which must not count.
put("base/nodes/a.jsonld", { "@id": "a", "@type": ["skos:Concept"] });
put("base/ns/content/v1.jsonld", { "@context": { title: "dcterms:title", dcterms: "http://purl.org/dc/terms/" } });
// top: dcterms (via needs) and bibo; a SMART-style local fhir binding; a Lean ref literal.
put("top/refs/r.jsonld", { "@context": { fhir: "https://smart.who.int/base/DataTypes.jsonld#" }, "@type": "bibo:Article", "dcterms:title": "x", "fhir:code": "y", leanRef: "qou:QOU.x" });
put("top/bad.jsonld", "{ not json");
put("orphan.jsonld", { "@type": "skos:Concept" });

const opts = { ownNamespaceOf: () => undefined, remoteContexts: new Map(), bindingContexts: new Map(), termSources: new Map() };

describe("gen-instance-contexts over a fixture tree", () => {
  const result = generateInstanceContexts(root, opts);
  const by = (n: string) => result.reports.find((r) => r.instance === n)!;

  test("instances are reported dependency-first", () => {
    expect(result.reports.map((r) => r.instance)[0]).toBe("base");
    expect(by("top").flattenedFrom).toEqual(["base", "top"]);
  });

  test("each context binds only its documents' prefixes, flattened over needs", () => {
    expect(by("base").expected).toBe(render({ "@version": 1.1, "@protected": true, skos: "http://www.w3.org/2004/02/skos/core#" }));
    expect(by("top").expected).toBe(render({ "@version": 1.1, "@protected": true, bibo: "http://purl.org/ontology/bibo/", dcterms: "http://purl.org/dc/terms/" }));
  });

  test("a context document under ns/ is not a corpus document", () => {
    expect(by("base").documents).toBe(1);
  });

  test("the document's own fhir binding resolves it; the Lean ref is literal-only; nothing is unresolved", () => {
    expect(by("top").unresolved).toEqual([]);
    expect(by("top").literalOnly.map((l) => l.prefix)).toEqual(["qou"]);
  });

  test("unparseable and unowned documents are counted, not dropped", () => {
    expect(by("top").unparseable).toEqual(["top/bad.jsonld"]);
    expect(result.unowned).toEqual(["orphan.jsonld"]);
  });

  test("an instance with no documents gets no context", () => {
    expect(by("empty").documents).toBe(0);
    expect(by("empty").expected).toBeUndefined();
  });

  test("an instance that declares its context built at publish gets one even with no documents mounted", () => {
    expect(by("declared").documents).toBe(0);
    expect(by("declared").expected).toBeDefined();
    expect(JSON.parse(by("declared").expected!)["@context"]).toBeDefined();
  });

  test("--check does not count an absent (built-at-publish) context as drift, but does count a stale one", () => {
    expect(findings(result).drift).toEqual([]);
    const top = result.reports.find((r) => r.instance === "top")!;
    put(top.path, { "@context": { stale: "http://example.org/stale/" } });
    expect(findings(generateInstanceContexts(root, opts)).drift).toEqual([`${top.path}: stale — run gen-instance-contexts`]);
    for (const r of result.reports) if (r.expected !== undefined) put(r.path, r.expected);
    const again = generateInstanceContexts(root, opts);
    expect(findings(again)).toEqual({ drift: [], problems: [] });
    // and the written context is not itself read back as a document
    expect(again.reports.find((r) => r.instance === "top")!.documents).toBe(1);
  });

  test("an unresolved IRI-position prefix and a conflict are problems, naming file and prefix", () => {
    put("top/refs/s.jsonld", { "@type": "oa:Annotation" });
    put("top/top.json", { name: "top", needs: ["base"], jsonldPrefixes: { bibo: "http://purl.org/ontology/bibo/", dcterms: "http://example.org/other/" } });
    const { problems } = findings(generateInstanceContexts(root, opts));
    expect(problems.some((l) => l.startsWith("top/refs/s.jsonld: prefix `oa`"))).toBe(true);
    expect(problems.some((l) => l.includes("prefix `dcterms` is bound differently"))).toBe(true);
  });

  test("the path is instance-relative: ns/context/v1.jsonld", () => {
    expect(by("top").path).toBe(`top/${INSTANCE_CONTEXT_PATH}`);
  });
});

describe("an instance whose `ns` is a document gets its context BESIDE it (D1)", () => {
  // Owner, 2026-10-15: bootstrap holds its vocabulary as `ns.jsonld`, staged
  // at the extensionless `ns` (and `v<major>/ns`), so `ns/context/v1.jsonld`
  // would need `ns` to be a directory as well: ENOTDIR in
  // check:bootstrap-standalone, and the same clash on its gh-pages.
  const droot = mkdtempSync(join(tmpdir(), "gen-instance-contexts-nsdoc-"));
  afterAll(() => rmSync(droot, { recursive: true, force: true }));
  const dput = (rel: string, value: unknown): void => {
    const p = join(droot, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, JSON.stringify(value));
  };
  dput("low/low.json", {
    name: "low",
    needs: [],
    jsonldPrefixes: { skos: "http://www.w3.org/2004/02/skos/core#" },
    builtAtPublish: [{ path: NS_DOCUMENT_CONTEXT_PATH, writer: ["jsonld:contexts"], because: "checkout", reason: "test" }],
  });
  dput("low/ns.jsonld", { "@context": { skos: "http://www.w3.org/2004/02/skos/core#" }, "@id": "https://example.org/low/v0/ns", "@type": "skos:ConceptScheme" });
  dput("high/high.json", { name: "high", needs: ["low"] });
  dput("high/nodes/h.jsonld", { "@type": "skos:Concept" });

  test("the path follows what the instance holds, not its name", () => {
    expect(NS_DOCUMENT_CONTEXT_PATH).toBe("ns.context.v1.jsonld");
    expect(contextPathFor(join(droot, "low"))).toBe(NS_DOCUMENT_CONTEXT_PATH);
    expect(contextPathFor(join(droot, "high"))).toBe(INSTANCE_CONTEXT_PATH);
  });

  test("the report, and so the writer, puts it beside the vocabulary; the other instance keeps ns/context/", () => {
    const r = generateInstanceContexts(droot, opts);
    const low = r.reports.find((x) => x.instance === "low")!;
    expect(low.path).toBe(`low/${NS_DOCUMENT_CONTEXT_PATH}`);
    expect(low.expected).toBeDefined();
    expect(r.reports.find((x) => x.instance === "high")!.path).toBe(`high/${INSTANCE_CONTEXT_PATH}`);
  });

  test("declaring the beside path is declaring the context; the written file is not read back as a document", () => {
    const first = generateInstanceContexts(droot, opts).reports.find((x) => x.instance === "low")!;
    const documents = first.documents;
    writeFileSync(join(droot, first.path), first.expected!);
    const again = generateInstanceContexts(droot, opts);
    const low = again.reports.find((x) => x.instance === "low")!;
    expect(low.documents).toBe(documents);
    expect(findings(again).drift).toEqual([]);
  });
});

describe("gen-instance-contexts — remote-context terms", () => {
  const troot = mkdtempSync(join(tmpdir(), "gen-instance-contexts-terms-"));
  afterAll(() => rmSync(troot, { recursive: true, force: true }));
  const tput = (rel: string, value: unknown): void => {
    const p = join(troot, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, JSON.stringify(value));
  };
  const URL = "https://example.org/ns/content/v1.jsonld";
  const content = { dcterms: "http://purl.org/dc/terms/", title: "dcterms:title", cites: { "@id": "cito:cites", "@type": "@id" } };
  tput("harness/harness.json", { name: "harness", needs: [], jsonldPrefixes: { dcterms: "http://purl.org/dc/terms/", cito: "http://purl.org/spar/cito/" } });
  tput("leaf/leaf.json", { name: "leaf", needs: ["harness"] });
  tput("lone/lone.json", { name: "lone", needs: [] });
  tput("leaf/a.jsonld", { "@context": [URL, { "@base": "https://x/" }], "@id": "a", title: "A", cites: ["b"] });
  tput("lone/a.jsonld", { "@context": URL, "@id": "a", title: "A" });
  const topts = {
    ownNamespaceOf: () => undefined,
    remoteContexts: new Map([[URL, content as Record<string, unknown>]]),
    bindingContexts: new Map(),
    termSources: new Map([[URL, { instance: "harness", context: content as Record<string, unknown> }]]),
  };
  const result = generateInstanceContexts(troot, topts);
  const by = (n: string) => result.reports.find((r) => r.instance === n)!;

  test("the context DEFINES the terms its documents use, flattened over needs, prefixes bound alongside", () => {
    expect(by("leaf").expected).toBe(
      render({ "@version": 1.1, "@protected": true, cito: "http://purl.org/spar/cito/", dcterms: "http://purl.org/dc/terms/", cites: { "@id": "cito:cites", "@type": "@id" }, title: "dcterms:title" }),
    );
    // the harness has no documents of its own, so nothing a later layer uses lands in it
    expect(by("harness").expected).toBeUndefined();
  });

  test("a term whose context's owner is not needed is a PROBLEM naming file and term", () => {
    expect(by("lone").terms).toEqual([]);
    const { problems } = findings(result);
    expect(problems.some((l) => l.startsWith("lone/a.jsonld: term `title`") && l.includes("which lone does not need"))).toBe(true);
  });
});

describe("gen-instance-contexts — a fixed point once the emitters switch", () => {
  // A document naming its layer's OWN context (what the switched emitters
  // write) must still yield that context's terms, or the next run drops them.
  const froot = mkdtempSync(join(tmpdir(), "gen-instance-contexts-fixed-"));
  afterAll(() => rmSync(froot, { recursive: true, force: true }));
  const fput = (rel: string, value: unknown): void => {
    const p = join(froot, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, JSON.stringify(value));
  };
  fput("cat-harness/cat-harness.json", { name: "cat-harness", needs: [], jsonldPrefixes: { dcterms: "http://purl.org/dc/terms/" } });
  fput("leaf/leaf.json", { name: "leaf", needs: ["cat-harness"], iriBase: "https://example.org/leaf/" });
  fput("leaf/a.jsonld", { "@context": ["https://example.org/leaf/ns/context/v1.jsonld", { "@base": "https://x/" }], "@id": "a", title: "A" });

  test("the instance URL reads as the content context: `title` is still defined", () => {
    const r = generateInstanceContexts(froot, { ownNamespaceOf: () => undefined }).reports.find((x) => x.instance === "leaf")!;
    expect(r.terms.map((t) => t.term)).toEqual(["title"]);
    expect(JSON.parse(r.expected!)["@context"].title).toBe("dcterms:title");
  });
});
