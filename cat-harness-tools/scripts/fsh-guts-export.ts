/**
 * `<base>/fsh-guts.jsonld` — the trashcan, reachable by name.
 *
 * ## A SEPARATE document
 *
 * The main export strips `fsh-guts` from every graph it publishes — the
 * kind, the directory, the skill and every edge naming them. This document
 * keeps the content reachable **by name, never by following an edge**: a
 * reader who wants it asks for it; a crawler never arrives.
 *
 * ## Logs are excluded by DECLARATION
 *
 * Logs are not published. `fsh-guts/logs/` lives inside the tree this walks,
 * and being git-ignored is not enough (an export from a working tree has
 * them), so a file is included only if it DECLARES `folio-fsh-guts/v1`.
 *
 * ## Skipped files are reported
 *
 * A file that declares nothing is data; a file that declares this schema and
 * fails it is a defect. Both are listed in `skipped` with a reason.
 *
 * Usage:  bun run cat-harness-tools/scripts/fsh-guts-export.ts [--out FILE] [--base-url URL]
 *
 * @module scripts/fsh-guts-export
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

import {
  artefactStub,
  readDeclaration,
  repoRootFor } from "../schemas/kg/cat-harness.js";
import { propertyIri, termIri } from "../schemas/kg/namespaces.js";
import { ownPrefixTable } from "../schemas/kg/graph-typology-registry.js";
import { contentSourceContext } from "../schemas/kg/subgraph-source.js";
import { fshGutsDirectories, isFrozenSubtree, readFshGutsNode } from "../schemas/kg/fsh-guts.js";
import { exitUnlessMounted } from "./branch-store.js";
import { STANDARD_PREFIXES, contextBindings, vocabMapping } from "../schemas/content/vocab-mapping.js";
import { declaredSubgraphNode } from "./kg-export.js";
import { memberOf, subgraphContainer } from "./subgraph-node.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);

export interface SkippedFile {
  path: string;
  reason: string;
}

export interface FshGutsDocument {
  "@context": Record<string, unknown>;
  "@id": string;
  "@type": string;
  name: string;
  description: string;
  nodeCount: number;
  "@graph": Record<string, unknown>[];
  /** Files looked at and not included, each with why. Never omitted. */
  skipped: SkippedFile[];
  /** Directories walked. Empty means the layer declares no trashcan. */
  scans: string[];
  [key: string]: unknown;
}

/**
 * The keys already mapped to their own term in an exported node.
 *
 * Kept beside {@link extraFields} rather than inlined, because the two must
 * agree: a common field that appears in both would be emitted twice, once
 * under its term and once inside `data`.
 */
const MAPPED_KEYS = new Set([
  "$schema",
  "title",
  "kind",
  "movedOn",
  "movedFrom",
  "issue",
  "bean",
  "summary",
]);

/**
 * A node's kind-specific fields, as `{ data: … }` or nothing at all.
 *
 * Nothing at all rather than `data: {}`, so a document of ordinary nodes is
 * byte-identical to what it was before this existed — an empty object on
 * every node would be noise that a reader has to learn to ignore.
 */
export function extraFields(node: Record<string, unknown>): { data?: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (!MAPPED_KEYS.has(k) && v !== undefined) data[k] = v;
  }
  return Object.keys(data).length > 0 ? { data } : {};
}

/** A declared trashcan directory: where it is, and what the declaration calls it. */
export interface FshGutsDir {
  /** Absolute, for walking. */
  absPath: string;
  /**
   * The DECLARED path — `fsh-guts/` — which is what every published string is
   * built from.
   *
   * Both are carried because they answer different questions and the answers
   * diverged at the move (bean `wggr`). `fsh-guts/` is declared
   * `scope: "repository"`, so its absolute path is no longer under the
   * layer root and `relative(root, absPath)` came back `../fsh-guts`. That
   * went into `scans`, into every node's `sourcePath`, and into every `@id` —
   * whose sanitiser permits `.` and would have published
   * `…/fsh-guts.jsonld#../docs/proposals/x.md`. A link-shaped value that
   * dereferences to nothing is the `blv9` shape, and it would have been minted
   * into a document whose whole job is to stay addressable.
   */
  path: string;
}

/** Every declared `fsh-guts` directory — not the literal path. */
export function fshGutsDirs(root: string): FshGutsDir[] {
  // One resolution for every reader and writer (bean 9c7h): the seam the
  // move to `cat/cat-harness/fsh-guts` changes.
  return fshGutsDirectories(root)
    .map((d) => ({ absPath: d.absPath, path: d.path.replace(/\/+$/, "") }))
    .filter((d) => existsSync(d.absPath));
}

/** The file types a node can be carried in: YAML front matter, or a top-level JSON `$schema`. */
const NODE_CARRIERS: ReadonlySet<string> = new Set([".md", ".json"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    // A FROZEN subtree (sub-kg-lifecycle stage 13) is one item, exported as
    // its sibling note — never thousands of `skipped` entries for another
    // repository's files, none of which is a node of this graph.
    if (statSync(path).isDirectory()) {
      if (!isFrozenSubtree(path)) walk(path, out);
    } else out.push(path);
  }
  return out;
}

/**
 * Build the document.
 *
 * `baseUrl` overrides the declaration's canonical URL, for a staging preview
 * whose `@id` must name where it is actually served rather than where main
 * publishes.
 */
export function buildFshGutsExport(root: string = ROOT, baseUrl?: string): FshGutsDocument {
  const decl = readDeclaration(root);
  const stub = decl ? artefactStub(decl) : "instance";
  const base = (baseUrl ?? decl?.canonicalUrl ?? "").replace(/\/+$/, "");
  const docIri = `${base}/fsh-guts.jsonld`;
  const subgraph = declaredSubgraphNode(root, "fsh-guts", { baseUrl });

  const scans = fshGutsDirs(root);
  const graph: Record<string, unknown>[] = [];
  const skipped: SkippedFile[] = [];

  for (const dir of scans) {
    for (const path of walk(dir.absPath)) {
      // Relative to the DECLARED directory, not to `root`: see `FshGutsDir`.
      const rel = join(dir.path, relative(dir.absPath, path));
      // A node is carried by markdown front matter or a top-level JSON
      // `$schema` (`readFshGutsNode`), so nothing else is READ: since the
      // separation the trashcan holds each separated layer's in-tree copy
      // as a `.tar.gz` (272 MB with the uploaded PDFs), and decoding all of
      // it as UTF-8 to learn that it declares nothing took ~6 s a build.
      // Still listed as skipped, with the reason, so nothing vanishes.
      if (!NODE_CARRIERS.has(extname(path).toLowerCase())) {
        skipped.push({ path: rel, reason: `not a node carrier (${extname(path) || "no extension"}): a node is markdown or JSON` });
        continue;
      }
      let text: string;
      try {
        text = readFileSync(path, "utf8");
      } catch (e) {
        skipped.push({ path: rel, reason: `unreadable: ${e instanceof Error ? e.message : String(e)}` });
        continue;
      }
      const read = readFshGutsNode(text);
      if (!read.node) {
        skipped.push({ path: rel, reason: read.reason });
        continue;
      }
      const n = read.node;
      graph.push({
        "@id": `${docIri}#${rel.replace(/[^A-Za-z0-9/_.-]/g, "-")}`,
        "@type": termIri("FshGutsNode"),
        name: n.title,
        nodeKind: n.kind,
        sourcePath: rel,
        ...(subgraph ? memberOf(subgraph.iri) : {}),
        ...(n.movedOn ? { movedOn: n.movedOn } : {}),
        ...(n.movedFrom ? { movedFrom: n.movedFrom } : {}),
        ...(n.issue !== undefined ? { issue: String(n.issue) } : {}),
        ...(n.bean ? { bean: n.bean } : {}),
        ...(n.summary ? { description: n.summary } : {}),
        // THE BODY, so the viewer has something to display.
        //
        // Without it a reader who selects a node gets its metadata and no
        // content, and `fsh-guts/` is not in the render pipeline — there is
        // no page to link to instead. Keeping something addressable while
        // making its text unreachable would be most of the way to deleting
        // it.
        //
        // Measured 2026-09-19: 59 KB of bodies against a 5 KB document. That
        // is why the viewer fetches this lazily, when Settings is opened,
        // rather than on every page load for a badge number.
        body: read.body.trim(),
        // Whatever this KIND carries that the common fields do not.
        //
        // The schema's `kind` is open, so the fields cannot be closed — and
        // an allowlist here would close them again one level out. `bean` is
        // the evidence: declaring it in the schema was necessary and not
        // sufficient, because a node's extra field still has to be emitted.
        //
        // Nested under `data` rather than spread, so a node kind can never
        // shadow `@id`, `@type` or a common term by choosing that name.
        ...extraFields(n),
      });
    }
  }

  graph.sort((a, b) => String(a["@id"]).localeCompare(String(b["@id"])));
  skipped.sort((a, b) => a.path.localeCompare(b.path));

  return {
    "@context": {
      ...ownPrefixTable(),
      // `name` and `description` exactly as the main export maps them, and
      // now structurally so: both bindings are DERIVED from the row
      // kg-export's own context is derived from, table `kg-node-naming`
      // (bean `lodp`, finding D2). This said "exactly as the main export"
      // while writing `rdfs:comment` for a `description` kg-export had
      // moved to `dcterms:description` (bean `xsqm`). Minting `fac:name`
      // here would have been a second term for a concept RDF already names
      // — and `ns:check` caught it, which is the gate doing precisely its
      // job twice in one session.
      //
      // Expanded to full IRIs because this context declares no `rdfs` or
      // `dcterms` prefix: the literal `"rdfs:label"` it carried until then
      // expanded to an absolute IRI with the scheme `rdfs`, not to RDFS's
      // label (measured with the `jsonld` processor).
      ...contextBindings([vocabMapping(ROOT, "kg-node-naming")], {
        inContext: ownPrefixTable(),
        prefixes: { ...STANDARD_PREFIXES, ...ownPrefixTable() },
        only: ["name", "description"],
      }),
      Subgraph: termIri("Subgraph"),
      hasPart: { "@id": "dcterms:hasPart", "@type": "@id" },
      inSubgraph: { "@id": propertyIri("inSubgraph"), "@type": "@id" },
      contentSource: contentSourceContext(),
      dcterms: "http://purl.org/dc/terms/",
      nodeKind: termIri("nodeKind"),
      sourcePath: termIri("sourcePath"),
      movedOn: termIri("movedOn"),
      movedFrom: termIri("movedFrom"),
      issue: termIri("issue"),
      bean: termIri("bean"),
      // A node kind's own fields (`extraFields`), kept whole as a JSON
      // literal. Undeclared, a processor dropped it with "invalid property"
      // the first time a node carried one — the stage-13 notes' `repository`
      // and `matchesCommit` (bean 61t6). `@json` rather than a nested context,
      // because `kind` is open: the keys inside are not known here, and a
      // context listing them would close the field set one level out.
      data: { "@id": termIri("data"), "@type": "@json" },
      // `schema:text` rather than a minted `fac:body`: schema.org already
      // names "the textual content of this thing", and a second term for it
      // is the drift `ns:check` caught twice on this branch already.
      body: "schema:text",
      nodeCount: termIri("nodeCount"),
      scans: termIri("scans"),
      // Declared, with its entries' two keys: a processor dropped the whole
      // list when it was bare (bean vigi, found by expanding).
      skipped: {
        "@id": termIri("skipped"),
        "@context": { path: termIri("sourcePath"), reason: "rdfs:comment" },
      },
    },
    ...(subgraph
      ? subgraphContainer({
          iri: subgraph.iri,
          members: graph.map((m) => String(m["@id"])),
          ...(subgraph.contentSource ? { contentSource: subgraph.contentSource } : {}),
        })
      : {
          "@id": docIri,
          "@type": termIri("FshGutsGraph"),
        }),
    name: `${stub} — fsh-guts`,
    description:
      "The trashcan that is kept: deprecated and throwaway structured content, " +
      "addressable and exported and deliberately absent from the rendered site. " +
      "Reachable BY NAME only — every other published graph has its references " +
      "stripped, so nothing links here. Activity logs live under this tree and " +
      "are excluded: a file is included only if it declares itself folio-fsh-guts/v1.",
    nodeCount: graph.length,
    "@graph": graph,
    skipped,
    scans: scans.map((d) => d.path),
  };
}

if (import.meta.main) {
  exitUnlessMounted("fsh-guts", "fsh-guts-export", resolve(ROOT, ".."));
  const argv = process.argv.slice(2);
  const arg = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const doc = buildFshGutsExport(ROOT, arg("--base-url"));
  // `_kg/` is a REPOSITORY build output — gitignored at the repository root,
  // beside `node_modules/`, `_site/` and `test-results/`, and read from there
  // by the e2e specs and `test-server.mjs`, both of which run at that root.
  // `ROOT` became the LAYER root with the move (bean `wggr`), so this
  // default started writing `cat-harness/_kg/` while every reader still looked
  // one level up — and the stale pre-move copy at the old path made it look
  // fine locally.
const out = arg("--out") ?? join(repoRootFor(ROOT), "_kg", "fsh-guts.jsonld");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`, "utf-8");

  console.log(`fsh-guts export → ${relative(ROOT, out)}`);
  console.log(`  @id  ${doc["@id"]}`);
  if (doc.scans.length === 0) {
    // A determined empty and a missing declaration are different answers.
    console.log("  NO fsh-guts directory is declared — this is not an empty trashcan,");
    console.log("  it is an instance that has not declared one.");
  } else {
    console.log(`  ${doc.nodeCount} node(s) from ${doc.scans.join(", ")}`);
  }
  if (doc.skipped.length) {
    console.log(`  ${doc.skipped.length} file(s) skipped:`);
    for (const s of doc.skipped) console.log(`    · ${s.path} — ${s.reason}`);
  }
}
