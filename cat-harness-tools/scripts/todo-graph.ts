/**
 * The todos as ONE published JSON-LD graph — every todo its own IRI, and its
 * attachment, people, beans and PRs as typed edges.
 *
 * @module scripts/todo-graph
 * @conformsTo w3c-rdf-calendar
 * @conformsTo schema-org
 * @conformsTo dcmi-terms
 *
 * ## What is published, and where
 *
 * | path (site-relative) | what |
 * |---|---|
 * | `todos.jsonld`, `todos.json` | the whole graph — one named graph holding every todo |
 * | `todo/<id>.jsonld`, `todo/<id>.json` | one todo — its `@id` is this address less `.jsonld` |
 * | `todo/<id>/` | the todo's RENDERING, a thin page (`todo-page.ts`), served at the todo's IRI |
 *
 * `skills/kg/kg-core/harness-requirements.md` requires the directory level
 * and the per-node level both, and does not let a harness waive either.
 * `.json` sits beside `.jsonld` because GitHub Pages serves no correct
 * Content-Type for `.jsonld`. No `.schema.json`: a todo carries no per-node
 * schema, and a missing form is not invented.
 *
 * ## The IRI is extensionless, `<site>/todo/<id>` (issue #1830)
 *
 * Owner, Q-THIN-2 = A and Q-THIN-4 = A: a node's IRI is `…/<kind>/<id>`, the
 * kind singular, its data the IRI plus `.jsonld`. The host serves the todo's
 * page directory at the IRI, and the page declares the todo (RDFa and a
 * JSON-LD stub) and links the `.jsonld` as `alternate`. The todo itself names
 * no rendering. A clean break from `<site>/todos/<id>.jsonld`.
 *
 * ## Vocabularies — borrowed, not minted
 *
 * A todo is an iCalendar `VTODO` (RFC 5545, as RDF at
 * `http://www.w3.org/2002/12/cal/ical#`): `summary`, `description`, `status`,
 * `priority` and `created` are that vocabulary's own properties. The edges are
 * schema.org and Dublin Core terms. The one term of ours is the CONTAINER's
 * class, `Subgraph` — the declared subgraph node the KG export already
 * publishes, so a todo graph names the same node rather than minting a
 * collection beside it. Its member edge, `inSubgraph`, is its own term, not
 * `dcterms:isPartOf`.
 *
 * | edge | term | object |
 * |---|---|---|
 * | `target` | `schema:about` | the content node the todo is attached to — its `site/…` IRI |
 * | `assignee` | `schema:agent` | the person (a `schema:Person`; a GitHub identity is its profile URL) |
 * | `bean` | `dcterms:isPartOf` | the bean whose work this todo is part of |
 * | `inSubgraph` | `ch:inSubgraph` (own term) | the declared `todos` Subgraph node this todo is published as a member of |
 * | `pullRequest`, `issue` | `dcterms:references` | the PR or issue it refers to |
 * | `process` | `dcterms:subject` | a BPMN process id (a literal: no process has a published IRI yet) |
 * | `source` | `dcterms:source` | the file the todo is authored in |
 *
 * ## Built from the index items, not from the files
 *
 * The input is the same `items` array `gen-docs-pages.ts` publishes as
 * `assets/todos/index.json` — already resolved: `target` in parts, `relations`
 * with their hrefs — so it cannot disagree with the index the board reads.
 */
import type { TodoIndexItem } from "../schemas/sdlc/todo-index.js";
import { DOCS_SITE_BASE, siteNodeIri } from "../schemas/kg/jsonld.ts";
import { propertyIri, termIri } from "../schemas/kg/namespaces.ts";
import { contentSourceContext } from "../schemas/kg/subgraph-source.ts";
import { memberOf, subgraphContainer } from "./subgraph-node.ts";

/**
 * A todo id as one path segment. `encodeURIComponent` plus the quote it leaves
 * alone, because the floor passes the path through a single-quoted Liquid
 * string — an id with `'` in it would otherwise end that string early.
 */
export function segment(id: string): string {
  return encodeURIComponent(id).replace(/'/g, "%27");
}

/** The whole graph, site-relative. */
export const TODO_GRAPH_SITE_PATH = "todos.jsonld";

/** A todo's JSON-LD, site-relative. One function names both the file and the `@id`. */
export function todoSitePath(id: string): string {
  return `${TODO_SITE_DIR}/${segment(id)}.jsonld`;
}

/**
 * The directory one todo's files are published in, site-relative: the
 * singular kind, `todo/<id>` (owner, Q-THIN-4 = A, issue #1830). The board
 * page stays at `todos/`.
 */
export const TODO_SITE_DIR = "todo";

/**
 * A todo's IRI — absolute and extensionless, `<site>/todo/<id>` (owner,
 * Q-THIN-2 = A): the host serves the todo's page directory there, and its
 * data is the IRI plus `.jsonld` ({@link todoSitePath}).
 */
export function todoIri(id: string): string {
  return `${DOCS_SITE_BASE}${TODO_SITE_DIR}/${segment(id)}`;
}

/** The todo's rendering, site-relative — a directory, served as `index.html`, at the todo's IRI. */
export function todoPageSitePath(id: string): string {
  return `${TODO_SITE_DIR}/${segment(id)}/`;
}

/**
 * The declared `todos` Subgraph node a todo graph is published as — its IRI
 * and resolved content source, from `kg-export`'s `declaredSubgraphNode`.
 * There is no `TODO_GRAPH_IRI` any more: the container is the DECLARED node,
 * not one this module mints (bean `l4ay`, `scripts/subgraph-node.ts`).
 */
export interface TodoSubgraph {
  iri: string;
  contentSource?: Record<string, unknown>;
}

/**
 * The inline `@context`. Inline rather than published at a URL of its own:
 * every term maps to an external vocabulary, so there is nothing of ours a
 * consumer would need to fetch, and a remote context is one more URL that
 * has to stay alive.
 */
export const TODO_CONTEXT = {
  "@version": 1.1,
  ical: "http://www.w3.org/2002/12/cal/ical#",
  schema: "https://schema.org/",
  dcterms: "http://purl.org/dc/terms/",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  Todo: "ical:Vtodo",
  // The CONTAINER is the declared Subgraph node (bootstrap's class), and each
  // todo's edge to it is `inSubgraph` — the term `kg-export` uses for the same
  // edge, its own term since bean `3f5f` (not `dcterms:isPartOf`). `TodoGraph` → `schema:Collection` was
  // here: a second node for one subgraph (bean `l4ay`).
  Subgraph: termIri("Subgraph"),
  inSubgraph: { "@id": propertyIri("inSubgraph"), "@type": "@id" },
  contentSource: contentSourceContext(),
  Person: "schema:Person",
  identifier: "schema:identifier",
  name: "schema:name",
  summary: "ical:summary",
  description: "ical:description",
  status: "ical:status",
  priority: "ical:priority",
  created: { "@id": "ical:created", "@type": "xsd:date" },
  origin: "dcterms:creator",
  label: "schema:alternateName",
  target: { "@id": "schema:about", "@type": "@id" },
  assignee: { "@id": "schema:agent", "@type": "@id" },
  bean: { "@id": "dcterms:isPartOf", "@type": "@id" },
  pullRequest: { "@id": "dcterms:references", "@type": "@id" },
  issue: { "@id": "dcterms:references", "@type": "@id" },
  process: "dcterms:subject",
  source: { "@id": "dcterms:source", "@type": "@id" },
  hasPart: { "@id": "dcterms:hasPart", "@type": "@id" },
} as const;

/** A linked node: an IRI when the edge resolved, else a blank node carrying only what is known. */
type Linked = { "@id"?: string; "@type"?: string; identifier: string; name?: string };

function linked(href: string | undefined, identifier: string, type?: string, name?: string): Linked {
  return {
    ...(href ? { "@id": href } : {}),
    ...(type ? { "@type": type } : {}),
    identifier,
    ...(name ? { name } : {}),
  };
}

/**
 * A site node's IRI from a todo's `target` parts: the page's QUALIFIED key
 * and the node id. The default suits a page of the base layer; the
 * generator passes the checkout's answer (`siteNodeOf` in
 * `lib/docs-sources.ts`), which also places a page of a source above the base
 * under its layer, where `gen-site-jsonld.ts` publishes it.
 */
export type TargetIri = (page: string, node: string) => string;

/** One todo, as a JSON-LD node (no `@context` — the caller wraps it). */
export function todoNode(item: TodoIndexItem, targetIri: TargetIri = siteNodeIri): Record<string, unknown> {
  const node: Record<string, unknown> = {
    "@id": todoIri(item.id),
    "@type": "Todo",
    identifier: item.id,
    summary: item.summary,
  };
  if (item.comment.trim() !== "") node["description"] = item.comment;
  node["status"] = item.status;
  node["priority"] = item.priority;
  node["created"] = item.createdAt;
  if (item.origin !== undefined) node["origin"] = item.origin;

  // THE ATTACHMENT, as an IRI edge. The parts (`target`) resolve to the site
  // node's published JSON-LD, which dereferences since #1908 moved the site
  // graph onto the site's own base. A label resolving to no block keeps its
  // label and gets no edge — the third state, reported rather than guessed.
  if (item.target !== undefined) {
    node["target"] = { "@id": targetIri(item.target.page, item.target.node), label: item.target.label };
  } else if (item.targetLabel !== undefined) {
    node["label"] = item.targetLabel;
  }

  const of = (axis: string) => item.relations.filter((r) => r.axis === axis);
  const assignees = of("who").map((r) => linked(r.href, r.label, "Person"));
  const beans = of("bean").map((r) => linked(r.href, r.label));
  const prs = of("PR").map((r) => linked(r.href, r.label, undefined, `pull request ${r.label}`));
  const issues = of("issue").map((r) => linked(r.href, r.label, undefined, `issue ${r.label}`));
  const processes = of("process").map((r) => r.label);
  if (assignees.length) node["assignee"] = assignees;
  if (beans.length) node["bean"] = beans;
  if (prs.length) node["pullRequest"] = prs;
  if (issues.length) node["issue"] = issues;
  if (processes.length) node["process"] = processes;
  if (item.viewHref !== undefined) node["source"] = item.viewHref;
  return node;
}

/** A todo as a member of its declared subgraph: the node plus `inSubgraph`. */
function memberNode(item: TodoIndexItem, subgraph: TodoSubgraph | undefined, targetIri?: TargetIri): Record<string, unknown> {
  return { ...todoNode(item, targetIri), ...(subgraph ? memberOf(subgraph.iri) : {}) };
}

/**
 * One todo's own document: `<site>/todos/<id>.jsonld`. With the subgraph, the
 * todo says which declared subgraph it is part of — the same node, with the
 * same edges, as inside the whole graph.
 */
export function todoDocument(item: TodoIndexItem, subgraph?: TodoSubgraph, targetIri?: TargetIri): Record<string, unknown> {
  return { "@context": TODO_CONTEXT, ...memberNode(item, subgraph, targetIri) };
}

/**
 * The whole graph: `<site>/todos.jsonld`.
 *
 * A NAMED graph — `@id` plus `@graph` — whose name is the DECLARED `todos`
 * Subgraph node (`<instance>.jsonld#directory/todos`), with `hasPart` to each
 * todo and each todo `inSubgraph` back to it. The `@graph` array and every
 * todo's `@id` are as before, so a reader that walks `@graph` (the board's
 * `fetchTodoGraph`, #1953) sees the same todos. Order is the input's, which
 * `readTodoFiles` makes deterministic.
 *
 * Without a subgraph — a layer that declares no `todos` — the document is
 * the bare `@graph`: no container is invented to stand in for the missing
 * declaration.
 */
export function todoGraphDocument(items: readonly TodoIndexItem[], subgraph?: TodoSubgraph, targetIri?: TargetIri): Record<string, unknown> {
  return {
    "@context": TODO_CONTEXT,
    ...(subgraph
      ? subgraphContainer({
          iri: subgraph.iri,
          // NO `name`. The node's name is the declaration's, published by
          // kg-export; restating it here as `"todos"` made `docs/todos.json`
          // a file whose `name` equals its stem — which `findDeclarationFile`
          // reads as a LAYER declaration, turning the site directory into
          // a layer root and hiding the checkout from every resolver.
          members: items.map((i) => todoIri(i.id)),
          ...(subgraph.contentSource ? { contentSource: subgraph.contentSource } : {}),
        })
      : {}),
    "@graph": items.map((i) => memberNode(i, subgraph, targetIri)),
  };
}

/** Serialise as the generators do: indented, newline-terminated, so a merge works line by line. */
export function serialiseJsonld(doc: Record<string, unknown>): string {
  return JSON.stringify(doc, null, 2) + "\n";
}
