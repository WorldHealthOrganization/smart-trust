#!/usr/bin/env bun
/**
 * export-graph.ts — bootstrap's own Knowledge Graph as JSON-LD,
 * `bootstrap.jsonld`: the document bootstrap owes in place of a visualiser
 * (`renderExemption.owes` in `bootstrap.json`).
 *
 * @module bootstrap-tools/scripts/export-graph
 * @covers code
 * @conformsTo w3c-prov-o
 *
 * ## Vocabulary — pre-existing standards first
 *
 * Classes are
 * bootstrap's (`bootstrap/ns.jsonld`, exactly its defined terms). Every
 * property is a published standard's, or one of bootstrap's own diagram
 * extensions; none is minted for this document:
 *
 * | fact | property | standard |
 * |---|---|---|
 * | a node's name | `rdfs:label` | RDF Schema 1.1 |
 * | title, description | `dcterms:title`, `dcterms:description` | DCMI Metadata Terms |
 * | node ⊂ process, flow ⊂ process, anything ⊂ subgraph, subgraph ⊂ graph | `dcterms:isPartOf` | DCMI |
 * | a subgraph's kinds; a process node's BPMN element | `dcterms:type` | DCMI |
 * | the file a node is | `dcterms:source` | DCMI |
 * | a flow's ends | `bpmn:sourceRef`, `bpmn:targetRef` | BPMN 2.0 |
 * | the process, or global task, a call activity calls | `bpmn:calledElement` | BPMN 2.0 |
 * | a process's documentation: whole, and its first sentence | `dcterms:description`, `dcterms:abstract` | DCMI |
 * | the processes a process calls; the Skills a task requires | `dcterms:requires` | DCMI |
 * | the drawing of a process | `foaf:depiction` | FOAF |
 * | the nodes a role's lanes hold | `bpmn:flowNodeRef` | BPMN 2.0 |
 * | the Role a lane names | `bpmn:partitionElementRef` → a `bpmn:resource` whose id is the Role's | BPMN 2.0 |
 * | provenance | `prov:wasDerivedFrom`, `prov:generatedAtTime` | PROV-O |
 *
 * Harness-only facts about a node (enforcement, whether a step touches a work
 * plan, …) are the harness's to state, in the harness's export.
 *
 * ## A process says what it is for
 *
 * A Process node carries its diagram's own `<bpmn:documentation>` (the one
 * directly inside `<bpmn:process>`, not a task's): the whole text as
 * `description` and its first sentence as `summary` (`dcterms:abstract`). A
 * reader listing processes shows the sentence and links the rest, so a
 * sentence about a process is written once, in the process. Its `requires`
 * are the processes its call activities call, each also on the call activity
 * as `calledElement`; a call to a process the graph does not hold is a
 * problem, never a dangling link. Its `depiction` is the SVG drawn beside the
 * `.bpmn` (`render-bpmn.ts`), when there is one.
 *
 * ## A step several processes share is a global task
 *
 * BPMN 2.0's reusable task (`globalTask`, `globalUserTask`,
 * `globalScriptTask`, `globalManualTask`, `globalBusinessRuleTask`) is a root
 * element of `<bpmn:definitions>`, outside every process, which a call
 * activity names by its bare id in `calledElement` exactly as it names a
 * process (one shared `.bpmn` per layer that holds no process; a bare id;
 * shared only within its layer). Each is a
 * `bootstrap:Task` node, `#globalTask/<id>`, whose `type` is its BPMN kind
 * and whose `requires` is the Skill its extension names, so the Skill is
 * named once, on the task, and never copied onto its callers. A call
 * resolves to a process first, then to a global task; a call to neither is
 * a problem.
 *
 * ## The vocabulary is always bootstrap's
 *
 * Every class here is bootstrap's, so the `bootstrap:` prefix is bootstrap's
 * namespace whatever layer is exported: read from `root` when `root` IS
 * bootstrap, else from the bootstrap checkout beside it (`--bootstrap`,
 * default `../bootstrap`), the one a layer that `needs` bootstrap sits
 * beside. A layer cannot rename bootstrap's terms by declaring an
 * `iriBase` of its own.
 *
 * ## Subjects are paths beside the document, and each one loads
 *
 * A subject is `<doc dir>/<kind>/<id>`, not a `#fragment` of this document:
 * `skill/<name>`, `process/<id>`, `process/<id>/node/<id>`, `globalTask/<id>`,
 * `role/<id>`, `directory/<id>`, `asset/<id>`. A sequence flow stays a
 * fragment of its process's page, `process/<id>#flow/<id>`.
 *
 * {@link subjectDocuments} gives each subject its own `<kind>/<id>.jsonld` and
 * `<kind>/<id>.html` beside the document, so the bare IRI dereferences on
 * GitHub Pages. No `<doc>#<kind>/<id>` fragment is forwarded.
 *
 * ## Pure unless asked
 *
 * Built at publish time and not committed. `--provenance` adds the commit and
 * the build time; without it two builds of one tree are byte-identical, which
 * is what the tests rely on.
 *
 * ```sh
 * bun run bootstrap-tools/scripts/export-graph.ts --base-url <url> --out <file> [--root <instance>] [--bootstrap <dir>] [--provenance]
 * ```
 */
import { TOOLS_REPOSITORY, generatedNote } from "./generated-by.ts";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import { readKnowledgeGraphDeclaration } from "../schemas/declaration.ts";
import { releaseIri, bootstrapRelease } from "../schemas/release-iri.ts";

const BPMN_MODEL = "http://www.omg.org/spec/BPMN/20100524/MODEL#";

/**
 * The first sentence of a text: whitespace collapsed, cut after the first
 * full stop that ends the text or is followed by a space. The whole text when
 * it has none. A Process's `summary`.
 */
export function firstSentence(text: string): string {
  const one = text.replace(/\s+/g, " ").trim();
  const stop = one.search(/\.(\s|$)/);
  return stop > 0 ? one.slice(0, stop + 1) : one;
}

/** One XML element, as far as a BPMN reader needs: name, attributes, children, text. */
export interface El {
  name: string;
  attrs: Record<string, string>;
  children: El[];
  text: string;
}

/**
 * A small XML reader for authored BPMN: elements, attributes, text. No
 * DTDs, no entities beyond the five predefined — the diagrams here have
 * neither, and bootstrap-tools may not depend on an XML package.
 */
export function parseXml(src: string): El {
  const root: El = { name: "#root", attrs: {}, children: [], text: "" };
  const stack: El[] = [root];
  const unescape = (t: string) =>
    t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const body = src.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_m, t: string) => t.replace(/</g, "&lt;"));
  const re = /<(\/?)([\w.:-]+)((?:\s+[\w.:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  for (const m of body.matchAll(re)) {
    const top = stack[stack.length - 1]!;
    if (m[5] !== undefined) {
      top.text += unescape(m[5]);
      continue;
    }
    const [, close, name, attrText, selfClose] = m;
    if (close) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of attrText!.matchAll(/([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]!] = unescape(a[2] ?? a[3] ?? "");
    const el: El = { name: name!, attrs, children: [], text: "" };
    top.children.push(el);
    if (!selfClose) stack.push(el);
  }
  return root;
}

const local = (name: string) => name.slice(name.indexOf(":") + 1);
const walk = (el: El, f: (e: El) => void) => {
  f(el);
  for (const c of el.children) walk(c, f);
};

/** BPMN element local names that are flow nodes (a process node), never a flow or a container. */
const FLOW_NODE = /^(task|userTask|serviceTask|scriptTask|manualTask|businessRuleTask|sendTask|receiveTask|callActivity|subProcess|startEvent|endEvent|intermediateCatchEvent|intermediateThrowEvent|boundaryEvent|exclusiveGateway|parallelGateway|inclusiveGateway|eventBasedGateway|complexGateway)$/;

/**
 * BPMN 2.0's global task kinds: root elements a call activity may call by id
 * in place of a process. There is no global service, send or receive task in
 * the standard.
 */
export const GLOBAL_TASK = /^global(User|Script|Manual|BusinessRule)?Task$/;

/** The extension element `<prefix:skill …>` / `<prefix:role …>` inside an element, whatever the prefix. */
function extension(el: El, what: "skill" | "role"): El | undefined {
  let found: El | undefined;
  walk(el, (e) => {
    if (found === undefined && local(e.name) === what && e.name.includes(":") && !e.name.startsWith("bpmn")) found = e;
  });
  return found;
}

/** Its `ref`, when it names one. */
function extensionRef(el: El, what: "skill" | "role"): string | undefined {
  return extension(el, what)?.attrs["ref"];
}

/** Front matter `name`, `description`, and the first heading, of a markdown file. */
function markdownFacts(md: string): { name?: string; description?: string; heading?: string } {
  const fm = /^---\n([\s\S]*?)\n---/.exec(md)?.[1] ?? "";
  const name = /^name:\s*(.+)$/m.exec(fm)?.[1]?.trim();
  const folded = /^description:\s*>-?\s*\n((?:[ \t]+.*\n?)+)/m.exec(fm)?.[1];
  const inline = /^description:\s*([^>\n].*)$/m.exec(fm)?.[1];
  const description = (folded ?? inline)?.replace(/\s+/g, " ").trim();
  const heading = /^#\s+(.+)$/m.exec(md.slice(fm.length))?.[1]?.trim();
  return { name, description, heading };
}

function filesIn(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...filesIn(p, ext));
    else if (e.name.endsWith(ext) && e.name !== "README.md") out.push(p);
  }
  return out.sort();
}

export interface ExportOptions {
  /** Where the document is published; its `@id`. */
  docIri: string;
  /** Add `prov:wasDerivedFrom` (the commit) and `prov:generatedAtTime`. */
  provenance?: boolean;
  /** Where the source files are browsed, for `dcterms:source`; relative paths when absent. */
  sourceBase?: string;
  /** The bootstrap checkout whose vocabulary names the classes, when `root` is not bootstrap; default `<root>/../bootstrap`. */
  bootstrapRoot?: string;
}

/** The bootstrap checkout whose namespace an export of `root` uses: `root` itself when it is bootstrap. */
export function vocabularyRoot(root: string, bootstrapRoot?: string): string {
  if (readKnowledgeGraphDeclaration(root)?.name === "bootstrap") return root;
  return bootstrapRoot ?? join(root, "..", "bootstrap");
}

/** The directory a document is served from, with its trailing `/`; `""` for a bare file name. */
export function subjectBase(docIri: string): string {
  const i = docIri.lastIndexOf("/");
  return i === -1 ? "" : docIri.slice(0, i + 1);
}

/** Escape what would end or re-delimit a path segment; `/` stays, as the nested form uses it. */
function escapeId(id: string): string {
  return id.replace(/[%#?\s]/g, (c) => encodeURIComponent(c));
}

const escapeHtml = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Every subject's own files, beside the graph document, keyed by path relative
 * to the document's directory: `<kind>/<id>.jsonld`, `<kind>/<id>.html` (which
 * GitHub Pages serves at the bare `<kind>/<id>`), `<kind>/<id>/index.html` when
 * another subject sits under it (`process/P` under `process/P/node/T`), and one
 * shared `<stub>.context.jsonld`. A flow (`process/P#flow/F`) has no file: it
 * is listed on its process's document and page.
 */
export function subjectDocuments(graph: Record<string, unknown>, docFile: string): Map<string, string> {
  const docIri = String(graph["@id"]);
  const base = subjectBase(docIri);
  const out = new Map<string, string>();
  const subjects: Array<{ node: Record<string, unknown>; iri: string; stem: string }> = [];
  const flowsOf = new Map<string, Record<string, unknown>[]>();
  // A relative `source` or `depiction` is relative to the graph document; a
  // subject's document sits deeper, so it carries them resolved.
  const absolute = (n: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(n).map(([k, v]) => [k, (k === "source" || k === "depiction") && typeof v === "string" && !/^[a-z][a-z0-9+.-]*:/i.test(v) ? `${base}${v}` : v]));
  for (const node of (graph["@graph"] ?? []) as Record<string, unknown>[]) {
    const iri = String(node["@id"]);
    if (node["@type"] === undefined || !iri.startsWith(base)) continue;
    const path = iri.slice(base.length);
    const hash = path.indexOf("#");
    if (hash !== -1) {
      const owner = iri.slice(0, base.length + hash);
      flowsOf.set(owner, [...(flowsOf.get(owner) ?? []), node]);
      continue;
    }
    const segments = path.split("/").map((x) => decodeURIComponent(x));
    if (segments.length < 2 || segments.some((x) => x === "" || x === "." || x === ".." || x.includes("\\"))) continue;
    subjects.push({ node: absolute(node), iri, stem: segments.join("/") });
  }
  if (subjects.length === 0) return out;
  const contextName = `${docFile.replace(/\.jsonld$/, "")}.context.jsonld`;
  out.set(contextName, `${JSON.stringify({ "@context": graph["@context"] }, null, 2)}\n`);
  const parents = new Set<string>();
  for (const { stem } of subjects) {
    const parts = stem.split("/");
    for (let i = 2; i < parts.length; i++) parents.add(parts.slice(0, i).join("/"));
  }
  const link = (v: string, depth: number) =>
    v.startsWith(base) && !v.includes("#") && subjects.some((x) => x.iri === v) ? `${"../".repeat(depth)}${v.slice(base.length)}` : v;
  for (const { node, iri, stem } of subjects) {
    const depth = stem.split("/").length - 1;
    const flows = (flowsOf.get(iri) ?? []).sort((a, b) => (String(a["@id"]) < String(b["@id"]) ? -1 : 1));
    const name = stem.split("/").pop()!;
    const doc = {
      "@context": /^https?:\/\//.test(docIri) ? `${base}${contextName}` : `${"../".repeat(depth)}${contextName}`,
      "@id": `${iri}.jsonld`,
      isPartOf: docIri,
      "@graph": [node, ...flows],
    };
    out.set(`${stem}.jsonld`, `${JSON.stringify(doc, null, 2)}\n`);
    const page = (up: number, self: string) => {
      const rows = Object.entries(node)
        .filter(([k]) => !k.startsWith("@"))
        .map(([k, v]) => {
          const vals = ([] as unknown[]).concat(v).map((x) => {
            const t = String(x);
            return /^(https?:|\.\.?\/|[a-z]+\/)/.test(t) && !/\s/.test(t) ? `<a href="${escapeHtml(link(t, up))}">${escapeHtml(t)}</a>` : escapeHtml(t);
          });
          return `<tr><th>${escapeHtml(k)}</th><td>${vals.join("<br>")}</td></tr>`;
        });
      const flowRows = flows.map((f) => `<li id="${escapeHtml(String(f["@id"]).slice(iri.length + 1))}">${escapeHtml(String(f["label"] ?? String(f["@id"]).slice(iri.length + 1)))}</li>`);
      const title = String(node["title"] ?? node["label"] ?? name);
      return [
        "<!doctype html>",
        '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
        `<title>${escapeHtml(title)}</title>`,
        `<link rel="alternate" type="application/ld+json" href="${escapeHtml(self)}">`,
        "</head><body>",
        `<h1>${escapeHtml(title)}</h1>`,
        `<p><code>${escapeHtml(iri)}</code> · ${escapeHtml(String(node["@type"]))} · <a href="${escapeHtml(self)}">JSON-LD</a> · part of <a href="${escapeHtml(docIri)}">${escapeHtml(docFile)}</a></p>`,
        `<table>${rows.join("")}</table>`,
        ...(flowRows.length ? ["<h2>Sequence flows</h2>", `<ul>${flowRows.join("")}</ul>`] : []),
        "</body></html>",
        "",
      ].join("\n");
    };
    out.set(`${stem}.html`, page(depth, `${name}.jsonld`));
    if (parents.has(stem)) out.set(`${stem}/index.html`, page(depth + 1, `../${name}.jsonld`));
  }
  return out;
}

/** The Graph Typologies whose Subgraphs' contents this exporter reads. */
export const COLLECTED_KINDS: readonly string[] = ["skills", "scenarios", "processes"];

/** bootstrap's graph. `root` is a bootstrap checkout. */
export function exportGraph(root: string, opts: ExportOptions): Record<string, unknown> {
  const decl = readKnowledgeGraphDeclaration(root);
  if (!decl) throw new Error(`${root} carries no Knowledge Graph declaration`);
  const r = bootstrapRelease(vocabularyRoot(root, opts.bootstrapRoot));
  const ns = releaseIri(r, "ns/", "agent");
  const processesNs = releaseIri(r, "processes/ns/", "agent");
  const doc = opts.docIri;
  const base = subjectBase(doc);
  const id = (kind: string, rest: string) => `${base}${kind}/${escapeId(rest)}`;
  const src = (rel: string) => (opts.sourceBase ? `${opts.sourceBase.replace(/\/?$/, "/")}${rel}` : rel);
  const nodes: Record<string, unknown>[] = [];
  const problems: string[] = [];

  const dirs = decl.directories ?? [];

  for (const d of dirs) {
    nodes.push({
      "@id": id("directory", d.id),
      "@type": "bootstrap:Subgraph",
      label: d.id,
      ...(d.title ? { title: d.title } : {}),
      ...(d.description ? { description: d.description } : {}),
      type: d.graphTypologies.map((k) => `bootstrap:graphTypology/${k}`),
      source: src(d.path),
      isPartOf: doc,
    });
  }
  for (const a of decl.assets ?? []) {
    nodes.push({
      "@id": id("asset", a.id),
      "@type": "bootstrap:Asset",
      label: a.id,
      ...(typeof a["title"] === "string" ? { title: a["title"] } : {}),
      ...(typeof a["description"] === "string" ? { description: a["description"] } : {}),
      source: src(a.src),
      isPartOf: doc,
    });
  }

  // Skills: every markdown file in a `skills` subgraph.
  for (const d of dirs.filter((x) => x.graphTypologies.includes("skills"))) {
    for (const f of filesIn(join(root, d.path), ".md")) {
      const rel = relative(root, f);
      const m = markdownFacts(readFileSync(f, "utf-8"));
      const name = m.name ?? rel.replace(/^.*\//, "").replace(/\.md$/, "");
      nodes.push({
        "@id": id("skill", name),
        "@type": "bootstrap:Skill",
        label: name,
        ...(m.heading ? { title: m.heading } : {}),
        ...(m.description ? { description: m.description } : {}),
        source: src(rel),
        isPartOf: id("directory", d.id),
      });
    }
  }

  // Roles: `roles.json` in each `scenarios` subgraph.
  const roleIds = new Set<string>();
  const roleNodes = new Map<string, Record<string, unknown>>();
  for (const d of dirs.filter((x) => x.graphTypologies.includes("scenarios"))) {
    const f = join(root, d.path, "roles.json");
    if (!existsSync(f)) continue;
    const roles = (JSON.parse(readFileSync(f, "utf-8")) as { roles?: { id: string; title: string; description?: string }[] }).roles ?? [];
    for (const role of roles) {
      roleIds.add(role.id);
      const n: Record<string, unknown> = {
        "@id": id("role", role.id),
        "@type": "bootstrap:Role",
        label: role.title,
        ...(role.description ? { description: role.description } : {}),
        source: src(relative(root, f)),
        isPartOf: id("directory", d.id),
      };
      roleNodes.set(role.id, n);
      nodes.push(n);
    }
  }

  // Processes, their nodes and flows. Process nodes are held apart until every
  // diagram is read, because a call may name a process in a file read later.
  const processNodes: Record<string, unknown>[] = [];
  const globalTaskNodes: Record<string, unknown>[] = [];
  for (const d of dirs.filter((x) => x.graphTypologies.includes("processes"))) {
    for (const f of filesIn(join(root, d.path), ".bpmn")) {
      const rel = relative(root, f);
      const xml = parseXml(readFileSync(f, "utf-8"));
      // The `<bpmn:resource>`s a lane's `partitionElementRef` may name.
      const resourceIds = new Set<string>();
      walk(xml, (e) => {
        if (local(e.name) === "resource" && e.name.startsWith("bpmn") && e.attrs["id"]) resourceIds.add(e.attrs["id"]);
      });
      // Global tasks: root elements of `<bpmn:definitions>`, outside every process.
      for (const defs of xml.children.filter((c) => local(c.name) === "definitions")) {
        for (const g of defs.children) {
          const kind = local(g.name);
          if (!GLOBAL_TASK.test(kind) || !g.attrs["id"]) continue;
          const skill = extensionRef(g, "skill");
          const documentation = g.children.find((c) => local(c.name) === "documentation")?.text.trim();
          globalTaskNodes.push({
            "@id": id("globalTask", g.attrs["id"]),
            "@type": "bootstrap:Task",
            label: g.attrs["name"] ?? g.attrs["id"],
            type: `bpmn:${kind}`,
            ...(documentation ? { description: documentation } : {}),
            ...(skill ? { requires: id("skill", skill) } : {}),
            source: src(rel),
            isPartOf: id("directory", d.id),
          });
        }
      }
      walk(xml, (p) => {
        if (local(p.name) !== "process" || !p.attrs["id"]) return;
        const pid = p.attrs["id"]!;
        const pIri = id("process", pid);
        // The diagram's OWN documentation — a direct child of the process,
        // never a task's or a lane's.
        const documentation = p.children.find((c) => local(c.name) === "documentation")?.text.trim();
        const calls = [
          ...new Set(
            p.children.filter((c) => local(c.name) === "callActivity" && c.attrs["calledElement"]).map((c) => id("process", c.attrs["calledElement"]!)),
          ),
        ].sort();
        const svg = rel.replace(/\.bpmn$/, ".svg");
        processNodes.push({
          "@id": pIri,
          "@type": "bootstrap:Process",
          label: p.attrs["name"] ?? pid,
          ...(documentation ? { summary: firstSentence(documentation), description: documentation } : {}),
          ...(calls.length ? { requires: calls } : {}),
          source: src(rel),
          ...(existsSync(join(root, svg)) ? { depiction: src(svg) } : {}),
          isPartOf: id("directory", d.id),
        });
        const nodeIri = (nid: string) => `${pIri}/node/${nid}`;
        for (const c of p.children) {
          const kind = local(c.name);
          if (FLOW_NODE.test(kind) && c.attrs["id"]) {
            // The task names the Skill it requires; the Skill names no task
            // (owner, 2026-10-16: "Skills are defined independent of
            // Tasks/Processes. Skills used to complete Tasks").
            const skill = extensionRef(c, "skill");
            const called = kind === "callActivity" ? c.attrs["calledElement"] : undefined;
            nodes.push({
              "@id": nodeIri(c.attrs["id"]),
              "@type": "bootstrap:ProcessNode",
              ...(c.attrs["name"] ? { label: c.attrs["name"] } : {}),
              type: `bpmn:${kind}`,
              isPartOf: pIri,
              ...(skill ? { requires: id("skill", skill) } : {}),
              ...(called ? { calledElement: id("process", called) } : {}),
            });
          } else if (kind === "sequenceFlow" && c.attrs["id"]) {
            nodes.push({
              "@id": `${pIri}#flow/${escapeId(c.attrs["id"])}`,
              "@type": "bootstrap:SequenceFlow",
              ...(c.attrs["name"] ? { label: c.attrs["name"] } : {}),
              sourceRef: nodeIri(c.attrs["sourceRef"] ?? ""),
              targetRef: nodeIri(c.attrs["targetRef"] ?? ""),
              isPartOf: pIri,
            });
          }
        }
        // Lanes: a lane NAMES a Role — it is not one (owner, 2026-10-16:
        // "Lane names Role") — and the Role holds the lane's nodes. The name
        // is standard BPMN: `partitionElementRef` on the lane, pointing at a
        // top-level `<bpmn:resource>` whose id is the Role's id.
        walk(p, (lane) => {
          if (local(lane.name) !== "lane") return;
          const role = extension(lane, "role");
          // `variable="true"`: the lane DECLARES that its performer is whoever
          // invoked the process — bootstrap's own diagram term, so not a gap.
          if (role?.attrs["variable"] === "true") return;
          const partition = lane.attrs["partitionElementRef"];
          const legacy = role?.attrs["ref"];
          const ref = partition ?? legacy;
          const held = lane.children.filter((c) => local(c.name) === "flowNodeRef").map((c) => nodeIri(c.text.trim()));
          if (!ref) {
            problems.push(`${rel}#${lane.attrs["id"] ?? "?"}: a lane that names no Role`);
            return;
          }
          if (partition === undefined) {
            problems.push(`${rel}#${lane.attrs["id"] ?? "?"}: names Role "${legacy}" with the retired <processes:role ref>; use partitionElementRef`);
          } else if (!resourceIds.has(partition)) {
            problems.push(`${rel}#${lane.attrs["id"] ?? "?"}: partitionElementRef "${partition}" names no <bpmn:resource> in this file`);
          }
          const n = roleNodes.get(ref);
          if (!n) {
            problems.push(`${rel}#${lane.attrs["id"] ?? "?"}: binds Role "${ref}", which roles.json does not declare`);
            return;
          }
          n["flowNodeRef"] = [...new Set([...((n["flowNodeRef"] as string[] | undefined) ?? []), ...held])].sort();
        });
      });
    }
  }

  // A call to a process no diagram defines is a problem, and the link is not
  // written: a dangling link is a link minted for a node nobody emitted. A
  // call that names no process but a global task is a call to that task.
  const processIris = new Set(processNodes.map((n) => String(n["@id"])));
  const globalTaskIris = new Set(globalTaskNodes.map((n) => String(n["@id"])));
  const skillIris = new Set(nodes.filter((n) => n["@type"] === "bootstrap:Skill").map((n) => String(n["@id"])));
  const processPrefix = `${base}process/`;
  const asGlobalTask = (iri: string): string | undefined => {
    if (processIris.has(iri) || !iri.startsWith(processPrefix) || iri.slice(processPrefix.length).includes("/")) return undefined;
    const g = id("globalTask", iri.slice(processPrefix.length));
    return globalTaskIris.has(g) ? g : undefined;
  };
  for (const n of [...processNodes, ...nodes, ...globalTaskNodes]) {
    for (const k of ["requires", "calledElement"] as const) {
      const v = n[k];
      if (v === undefined) continue;
      const resolved = [...new Set(([] as string[]).concat(v as string | string[]).map((iri) => asGlobalTask(iri) ?? iri))].sort();
      const kept = resolved.filter((iri) => {
        if (processIris.has(iri) || skillIris.has(iri) || globalTaskIris.has(iri)) return true;
        const isSkill = iri.startsWith(`${base}skill/`);
        problems.push(
          isSkill
            ? `${String(n["@id"]).slice(base.length)}: requires ${iri.slice(base.length)}, which no skills Subgraph here holds`
            : `${String(n["@id"]).slice(base.length)}: calls ${iri.slice(base.length)}, which no diagram here defines`,
        );
        return false;
      });
      if (kept.length === 0) delete n[k];
      else n[k] = Array.isArray(v) ? kept : kept[0];
    }
  }
  nodes.push(...processNodes, ...globalTaskNodes);

  // A Subgraph whose kinds none of the collectors above reads is declared (it
  // has its own node) but its contents are not: said, so "holds nothing" and
  // "nobody looked" are never the same empty answer.
  const omitted = dirs
    .filter((d) => !d.graphTypologies.some((k) => COLLECTED_KINDS.includes(k)))
    .map((d) => d.id)
    .sort();

  const byType = new Map<string, number>();
  for (const n of nodes) byType.set(String(n["@type"]), (byType.get(String(n["@type"])) ?? 0) + 1);


  let prov: Record<string, unknown> = {};
  if (opts.provenance) {
    // input-site: inert #a2a2ce83 — `git rev-parse HEAD` only under `--provenance`, stamped into the graph as prov:wasDerivedFrom; it never reaches the exit code, and no check passes `--provenance`
    const git = (...a: string[]) => spawnSync("git", a, { cwd: root, encoding: "utf-8" });
    const sha = git("rev-parse", "HEAD");
    prov = {
      // input-site: inert #9c02f284 — the publish timestamp is written into the graph and never reaches the exit code; no check passes `--provenance`
      generatedAtTime: new Date().toISOString(),
      ...(sha.status === 0 ? { wasDerivedFrom: `git:${sha.stdout.trim()}` } : {}),
    };
  }

  return {
    "@context": {
      bootstrap: ns,
      processes: processesNs,
      bpmn: BPMN_MODEL,
      rdfs: "http://www.w3.org/2000/01/rdf-schema#",
      dcterms: "http://purl.org/dc/terms/",
      prov: "http://www.w3.org/ns/prov#",
      owl: "http://www.w3.org/2002/07/owl#",
      xsd: "http://www.w3.org/2001/XMLSchema#",
      foaf: "http://xmlns.com/foaf/0.1/",
      label: "rdfs:label",
      comment: "rdfs:comment",
      wasAttributedTo: { "@id": "prov:wasAttributedTo", "@type": "@id" },
      title: "dcterms:title",
      description: "dcterms:description",
      summary: "dcterms:abstract",
      requires: { "@id": "dcterms:requires", "@type": "@id" },
      depiction: { "@id": "foaf:depiction", "@type": "@id" },
      calledElement: { "@id": "bpmn:calledElement", "@type": "@id" },
      isPartOf: { "@id": "dcterms:isPartOf", "@type": "@id" },
      type: { "@id": "dcterms:type", "@type": "@id" },
      source: { "@id": "dcterms:source", "@type": "@id" },
      sourceRef: { "@id": "bpmn:sourceRef", "@type": "@id" },
      targetRef: { "@id": "bpmn:targetRef", "@type": "@id" },
      flowNodeRef: { "@id": "bpmn:flowNodeRef", "@type": "@id" },
      versionInfo: "owl:versionInfo",
      generatedAtTime: { "@id": "prov:generatedAtTime", "@type": "http://www.w3.org/2001/XMLSchema#dateTime" },
      wasDerivedFrom: { "@id": "prov:wasDerivedFrom", "@type": "@id" },
      // What the build saw, kept as opaque JSON literals (`@json`) rather than
      // left undeclared: a strict processor — `publish:verify`'s — rejects an
      // undeclared key as an "invalid property", and that failed every preview
      // build. The values are byte-for-byte what they were.
      omitted: { "@id": "bootstrap:buildOmitted", "@type": "@json" },
      counts: { "@id": "bootstrap:buildCounts", "@type": "@json" },
      problems: { "@id": "bootstrap:buildProblems", "@type": "@json" },
    },
    "@id": doc,
    "@type": ["bootstrap:KnowledgeGraph", "prov:Entity"],
    label: decl.name,
    // Said in the document itself, as every generated file of bootstrap's
    // says it (owner, 2026-09-30): generated, by what, and so not to be edited.
    comment: generatedNote("scripts/export-graph.ts", "bootstrap's own files", "change the files it describes"),
    wasAttributedTo: TOOLS_REPOSITORY,
    ...(decl.title ? { title: decl.title } : {}),
    ...(decl.description ? { description: decl.description } : {}),
    versionInfo: decl.version ?? "",
    ...prov,
    // Sorted by `@id`, by code unit rather than locale, so directory order on
    // the machine that built it never reaches the file (bootstrap-graph-emission).
    "@graph": [...nodes].sort((a, b) => (String(a["@id"]) < String(b["@id"]) ? -1 : String(a["@id"]) > String(b["@id"]) ? 1 : 0)),
    // Not RDF facts about bootstrap, but what the build saw: counted, never
    // silently dropped. Declared in the context as `@json` literals, so an RDF
    // reader carries them as opaque values and a person or a check reads them.
    omitted,
    counts: Object.fromEntries([...byType].sort(([a], [b]) => a.localeCompare(b))),
    problems,
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const arg = (f: string) => {
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const root = arg("--root") ?? join(import.meta.dir, "..", "..", "bootstrap");
  const out = arg("--out");
  const base = arg("--base-url");
  if (!out || !base) {
    console.error("usage: export-graph.ts --base-url <site url of bootstrap/> --out <file> [--root <instance>] [--bootstrap <dir>] [--provenance] [--source-base <url>]");
    process.exit(2);
  }
  const doc = exportGraph(root, {
    // Named by the file it is written to, so the `@id` IS the served path
    // whatever the stub: `--base-url <site>/<stub>/ --out _site/<stub>/<file>`.
    docIri: `${base.replace(/\/?$/, "/")}${basename(out)}`,
    provenance: args.includes("--provenance"),
    sourceBase: arg("--source-base"),
    bootstrapRoot: arg("--bootstrap"),
  });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
  // Each subject's own document and page, beside the graph, so its IRI loads.
  const subjects = subjectDocuments(doc, basename(out));
  for (const [rel, body] of subjects) {
    const file = join(dirname(out), rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
  }
  const problems = doc["problems"] as string[];
  console.log(`✓ ${out}: ${(doc["@graph"] as unknown[]).length} nodes ${JSON.stringify(doc["counts"])}, ${subjects.size} subject files`);
  for (const p of problems) console.log(`  · ${p}`);
}
