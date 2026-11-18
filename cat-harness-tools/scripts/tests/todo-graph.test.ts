/**
 * Issue #1908 — the todos as one JSON-LD graph, a page per todo, and site
 * nodes published at the IRIs they carry.
 *
 * These read the COMMITTED output as well as the builders, because the claim
 * is about what is published: every todo's JSON-LD and page exist, the
 * graph names every todo, and every `target` edge names a file that is
 * really there.
 *
 * The tests here that read the aggregate repository's own root (the
 * root-declared `todos/` graph) live in
 * `test/todo-graph-repo-root.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such root to read.
 */
import { describe, expect, test } from "bun:test";
// Publish-time files are written to the layer output overlay (bean sm8r);
// these read the copy a site reader sees, falling back to the path given.
import { existsSync, readFileSync } from "../../test/support/site-fs.ts";
import { join } from "node:path";
import jsonld from "jsonld";

import { siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { DOCS_SITE_BASE, SITE_DOCUMENT_CONTEXT, ContentContextSchema, siteNodeIri } from "../../schemas/kg/jsonld.ts";
import { TodoIndexSchema, type TodoIndexItem } from "../../schemas/sdlc/todo-index.ts";
import { pageNodeOf, pageNodeProblems, thinPageConfigOf, thinPageHtml } from "../thin-page.ts";
import { propertyIri, termIri } from "../../schemas/kg/namespaces.ts";
import { subgraphPublicationFindings } from "../subgraph-node.ts";
import {
  segment,
  todoDocument,
  todoGraphDocument,
  todoIri,
  todoPageSitePath,
  todoSitePath,
} from "../todo-graph.ts";
import { isLegacyTodoPage, isTodoPage, todoPageHtml } from "../todo-page.ts";
import { renderTodoListing } from "../todo-listing.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { docsSources, siteNodeOf } from "../lib/docs-sources.ts";
import { ensureDocsPages, siteNotBuilt } from "../../test/support/checkout.ts";

const ROOT = join(HARNESS_ROOT);
const SITE = join(ROOT, siteDirFor(ROOT));
/**
 * The todo index and the todo graph are written at publish and gitignored
 * (bean w1gy F18). Not built, "what is published" has nothing to read: its
 * index is empty, so it makes no per-todo tests, and its graph test skips.
 */
ensureDocsPages(ROOT);
const NOT_BUILT = siteNotBuilt(
  "the todo index and graph `docs:pages` writes at publish (gitignored)",
  join(SITE, "assets/todos/index.json"),
  join(SITE, "todos.jsonld"),
);
const INDEX = NOT_BUILT
  ? { items: [] as TodoIndexItem[] }
  : TodoIndexSchema.parse(JSON.parse(readFileSync(join(SITE, "assets/todos/index.json"), "utf8")));

const ITEM: TodoIndexItem = {
  id: "a-todo",
  summary: "Fix the thing",
  comment: "One.\n\nTwo.",
  status: "open",
  priority: "high",
  origin: "agent",
  createdAt: "2026-10-03",
  targetLabel: "sec:p-n",
  target: { page: "p", node: "n", label: "sec:p-n" },
  tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
  relations: [
    { axis: "who", label: "github:someone", href: "https://github.com/someone" },
    { axis: "bean", label: "folio-assistant-h32d", href: "https://example.org/bean" },
    { axis: "bean", label: "folio-assistant-zzzz" },
    { axis: "PR", label: "#1", href: "https://github.com/o/r/pull/1" },
    { axis: "process", label: "Process_X" },
  ],
  viewHref: "https://github.com/o/r/blob/main/todos/items/a-todo.md",
};

describe("todo IRIs", () => {
  test("a todo's IRI is extensionless under the singular kind, its data the IRI plus .jsonld (issue #1830)", () => {
    expect(todoSitePath("a-todo")).toBe("todo/a-todo.jsonld");
    expect(todoIri("a-todo")).toBe(`${DOCS_SITE_BASE}todo/a-todo`);
    expect(DOCS_SITE_BASE).toBe("https://litlfred.github.io/folio-assistant/");
  });
  test("the rendering is the directory the IRI names, so the host serves it at the IRI", () => {
    expect(todoPageSitePath("a-todo")).toBe("todo/a-todo/");
    expect(`${DOCS_SITE_BASE}${todoPageSitePath("a-todo")}`).toBe(`${todoIri("a-todo")}/`);
  });
  test("a segment never carries a character that would end a Liquid string", () => {
    expect(segment("it's")).toBe("it%27s");
  });
});

describe("the JSON-LD", () => {
  test("typed edges: target is an IRI edge to the site node; who, bean, PR, process", async () => {
    const doc = todoDocument(ITEM);
    const [node] = (await jsonld.expand(doc as jsonld.JsonLdDocument)) as Array<Record<string, unknown>>;
    expect(node!["@id"]).toBe(todoIri("a-todo"));
    expect(node!["@type"]).toEqual(["http://www.w3.org/2002/12/cal/ical#Vtodo"]);
    const about = node!["https://schema.org/about"] as Array<Record<string, unknown>>;
    expect(about[0]!["@id"]).toBe(siteNodeIri("p", "n"));
    const agent = node!["https://schema.org/agent"] as Array<Record<string, unknown>>;
    expect(agent[0]!["@id"]).toBe("https://github.com/someone");
    const partOf = node!["http://purl.org/dc/terms/isPartOf"] as Array<Record<string, unknown>>;
    expect(partOf.map((b) => b["@id"])).toEqual(["https://example.org/bean", undefined]);
    expect(node!["http://purl.org/dc/terms/references"]).toHaveLength(1);
    expect(node!["http://purl.org/dc/terms/subject"]).toEqual([{ "@value": "Process_X" }]);
  });

  test("the todo carries no link to its rendering", () => {
    expect(JSON.stringify(todoDocument(ITEM))).not.toContain(todoPageSitePath("a-todo"));
  });

  test("an unresolved label keeps the label and gets no edge", () => {
    const { target: _t, ...rest } = ITEM;
    const doc = todoDocument(rest);
    expect(doc["target"]).toBeUndefined();
    expect(doc["label"]).toBe("sec:p-n");
  });

  const SUBGRAPH = { iri: "https://example.org/x/x.jsonld#directory/todos", contentSource: { kind: "directory", declaredIn: "default" } };

  test("the graph is the DECLARED Subgraph node, naming every todo, and each todo points back", () => {
    const g = todoGraphDocument([ITEM], SUBGRAPH);
    expect(g["@id"]).toBe(SUBGRAPH.iri);
    expect(g["@type"]).toBe("Subgraph");
    expect(g["hasPart"]).toEqual([todoIri("a-todo")]);
    expect((g["@graph"] as Array<Record<string, unknown>>)[0]!["@id"]).toBe(todoIri("a-todo"));
    expect(subgraphPublicationFindings(g, { iri: SUBGRAPH.iri })).toEqual([]);
  });

  test("a member's subgraph edge is its own term, distinct from its bean's dcterms:isPartOf", async () => {
    // Bean `3f5f`: subgraph membership is a VIEW, `bean` is containment — one
    // predicate for both made them indistinguishable once expanded.
    const [node] = (await jsonld.expand(todoDocument(ITEM, SUBGRAPH) as jsonld.JsonLdDocument)) as Array<Record<string, unknown>>;
    const ids = (k: string) => ((node![k] ?? []) as Array<Record<string, unknown>>).map((b) => b["@id"]);
    expect(ids(propertyIri("inSubgraph"))).toEqual([SUBGRAPH.iri]);
    expect(ids("http://purl.org/dc/terms/isPartOf")).toEqual(["https://example.org/bean"]);
  });

  test("the container's own node expands to the bootstrap Subgraph class", async () => {
    const expanded = (await jsonld.expand(todoGraphDocument([ITEM], SUBGRAPH) as jsonld.JsonLdDocument)) as Array<Record<string, unknown>>;
    const container = expanded.find((n) => n["@id"] === SUBGRAPH.iri)!;
    expect(container["@type"]).toEqual([termIri("Subgraph")]);
  });

  test("without a declared subgraph, no container is invented", () => {
    const g = todoGraphDocument([ITEM]);
    expect(g["@id"]).toBeUndefined();
    expect(g["@type"]).toBeUndefined();
    expect((g["@graph"] as unknown[]).length).toBe(1);
  });
});

describe("the thin page", () => {
  test("themed, JSON-LD alternate, no content written in, declares its todo (issue #1830)", () => {
    const html = todoPageHtml(ITEM, { targetHref: "../../p.html#n" });
    // On the site's layout since 2026-10-07, so it carries the top band; the
    // layout writes the alternate from the front matter.
    expect(html.startsWith("---\nlayout: default\n")).toBe(true);
    expect(html).not.toMatch(/<!doctype|<html|<head|<body/i);
    expect(html).toMatch(/^alternate_jsonld: "\.\.\/a-todo\.jsonld"$/m);
    expect(html).toContain('<h1 id="fa-todo-summary">');
    expect(html).not.toContain(ITEM.summary);
    expect(isTodoPage(html)).toBe(true);
    expect(pageNodeProblems(html)).toEqual([]);
    expect(pageNodeOf(html)!.rdfa[0]).toEqual({ iri: todoIri("a-todo"), types: ["http://www.w3.org/2002/12/cal/ical#Vtodo"] });
    expect(html).toContain(' data-kg-target-href="../../p.html#n"');
    expect(html).not.toContain('type="application/json"');
    expect(html.indexOf("assets/kg-render.js")).toBeLessThan(html.indexOf("assets/todos/todo-page.js"));
    // The orphan sweep still knows a page from before #1830 by its old block, and a new page is not one.
    expect(isLegacyTodoPage('<script type="application/json" id="fa-todo-page-config">{}</script>')).toBe(true);
    expect(isLegacyTodoPage(html)).toBe(false);
  });
  test("a config cannot close its own script element", () => {
    const html = thinPageHtml({ title: "t", jsonld: "x.jsonld", script: "s.js", configId: "c", config: { x: "</script>" }, body: "" });
    expect(html).not.toContain(`"</script>`);
    expect(thinPageConfigOf(html, "c")).toEqual({ x: "</script>" });
  });
});

describe("the no-JS floor", () => {
  test("links each todo to its own page", () => {
    const html = renderTodoListing([ITEM], { todoPageHref: (id) => `/${todoPageSitePath(id)}` });
    expect(html).toContain(`<a href="/todo/a-todo/">Open this todo</a>`);
  });
});

describe("what is published", () => {
  const graph = (NOT_BUILT ? {} : JSON.parse(readFileSync(join(SITE, "todos.jsonld"), "utf8"))) as Record<string, unknown>;

  test.skipIf(NOT_BUILT)("the graph, as .jsonld and .json, names every todo in the index", () => {
    expect(readFileSync(join(SITE, "todos.json"), "utf8")).toBe(readFileSync(join(SITE, "todos.jsonld"), "utf8"));
    expect(graph["hasPart"]).toEqual(INDEX.items.map((i) => todoIri(i.id)));
  });

  describe.each(INDEX.items.map((item) => [item.id, item] as const))("%s", (_id, item) => {
    test("its JSON-LD, its .json and its page exist", () => {
      expect(existsSync(join(SITE, todoSitePath(item.id)))).toBe(true);
      expect(existsSync(join(SITE, todoSitePath(item.id).replace(/\.jsonld$/, ".json")))).toBe(true);
      expect(isTodoPage(readFileSync(join(SITE, todoPageSitePath(item.id), "index.html"), "utf8"))).toBe(true);
    });
    if (item.target) {
      const { page, node } = item.target;
      test("its target IRI names a file the site publishes", () => {
        // The checkout's answer, as the generator asks it: a page of a source
        // above the base is published under its layer, and its JSON-LD is
        // in that layer's docs directory until compose lays it there.
        const { sitePath, file } = siteNodeOf(docsSources(ROOT), page, node);
        const iri = `${DOCS_SITE_BASE}${sitePath}`;
        expect(existsSync(file)).toBe(true);
        const doc = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
        // The site form: the shared context, or since bean `63q4` the
        // owning layer's own, always with the site as `@base`.
        expect(ContentContextSchema.safeParse(doc["@context"]).success).toBe(true);
        expect((doc["@context"] as unknown[])[1]).toEqual(SITE_DOCUMENT_CONTEXT[1]);
        expect(doc["@id"]).toBe(sitePath);
        // The published todo names that same node.
        const published = JSON.parse(readFileSync(join(SITE, todoSitePath(item.id)), "utf8")) as { target?: { "@id": string } };
        expect(published.target?.["@id"]).toBe(iri);
      });
    }
  });

  test("the site context is one a content record accepts", () => {
    expect(ContentContextSchema.safeParse([...SITE_DOCUMENT_CONTEXT]).success).toBe(true);
  });
});
