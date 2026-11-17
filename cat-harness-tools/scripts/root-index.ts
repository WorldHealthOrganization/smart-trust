#!/usr/bin/env bun
/**
 * The root meta-skeleton: `<site>/index.jsonld` (and its `.json` alias) names
 * every declared layer at depth 1. Built at publish time only; there is no
 * committed copy, since a committed one would conflict whenever two PRs change
 * the set of harnesses.
 *
 * @module scripts/root-index
 * @covers cat-harness
 *
 * ## What an entry carries
 *
 * One `Harness` per declared layer ({@link layerRootsIn}),
 * read from its declaration and from the files the deploy already wrote:
 *
 * - `@id` — its export document, at the address {@link exportIdentity} gives
 *   it, the same function every exporter mints its `@id`s with;
 * - `name`, `title`, `description`, `version` — the declaration's;
 * - `dependsOn` — the declaration's `needs`, as the dependencies' `@id`s;
 * - `directory` — each declared directory's id, path and graph typologies;
 * - `subgraph` — its named-subgraph root, when the repository's subgraph
 *   index frames it, or the `seeAlso` site that publishes it;
 * - `nodes`, `bytes`, `sha256` — counted from the export document on disk.
 *
 * No node of any graph is inlined. One fetch is the whole map.
 *
 * ## Could-not-determine is a failure, never a shorter index
 *
 * A layer whose export document is not where its identity says is a
 * PROBLEM and the run exits 1 having written nothing.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/root-index.ts --site ./_site [--base-url URL] [--subgraph-index FILE]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { overlayPath } from "./lib/layer-output.ts";
import { join, resolve } from "node:path";

import { artefactStub, layerRootsIn, readDeclaration, repoRootFor } from "../schemas/kg/cat-harness.js";
import { exportIdentity } from "./kg-export.js";
import { instanceDocPath } from "./instance-exports.js";
import { isPublished } from "../schemas/kg/url-space.js";
import { readKnowledgeGraphDeclaration } from "@litlfred/bootstrap-tools/schemas/declaration.ts";
import { publicationBase } from "@litlfred/bootstrap-tools/scripts/subgraph-jsonld.ts";
import { propertyIri, termIri } from "../schemas/kg/namespaces.js";
import { SUBGRAPH_INDEX_FILE } from "../schemas/kg/subgraph-manifest.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
const REPO = repoRootFor(ROOT);

type Doc = Record<string, unknown>;
const list = (v: unknown): unknown[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

export const ROOT_INDEX_FILE = "index.jsonld";
export const ROOT_INDEX_ALIAS = "index.json";

/** One layer as the root index carries it. */
export interface HarnessEntry {
  "@id": string;
  "@type": string;
  name: string;
  stub: string;
  /** Where THIS site serves the document — `@id` may be another site's (a declared `canonicalUrl`). */
  url: string;
  title?: string;
  description?: string;
  version?: string;
  dependsOn?: string[];
  /** Each declared directory: its id as `name` — a term the context defines, unlike a bare `id`. */
  directory: Array<{ name: string; path: string; graphTypologies: string[] }>;
  subgraph?: string;
  nodes: number;
  bytes: number;
  sha256: string;
}

export interface RootIndexBuild {
  doc: Doc;
  problems: string[];
}

/**
 * Build the root index over the site directory the deploy wrote. Pure over
 * the declarations and the files under `site`; writes nothing.
 */
export function buildRootIndex(site: string, opts: { baseUrl?: string; repo?: string; subgraphIndex?: string } = {}): RootIndexBuild {
  const repo = opts.repo ?? REPO;
  const problems: string[] = [];
  // The repository's subgraph index: the site's own copy by default. A layer
  // site that does not publish the subgraph tree (it is served at the
  // harness's canonical site, whose IRIs it carries) names the file it
  // framed instead (`publish-root-index.ts`).
  const subgraphIndex = opts.subgraphIndex ?? join(site, "subgraph", SUBGRAPH_INDEX_FILE);
  // Read over the layer overlay: a mounted layer's subgraph tree is at its output root (bean `cat-tools-sm8r`, item 4).
  const indexAt = overlayPath(subgraphIndex);
  const repoIndex = existsSync(indexAt) ? (JSON.parse(readFileSync(indexAt, "utf-8")) as Doc) : undefined;
  if (!repoIndex) problems.push(`${subgraphIndex} is missing — the subgraph roots cannot be named`);
  const roots = list(repoIndex?.hasSubgraph).map(String);
  const seeAlso = list(repoIndex?.seeAlso).map(String);

  const byName = new Map<string, string>();
  const entries: HarnessEntry[] = [];
  // The site this index is published at: the host layer's base, which is
  // where `_site/` is served (`exportIdentity`'s `base` for the host).
  const siteBase = exportIdentity({ baseUrl: opts.baseUrl }).base;
  for (const inst of layerRootsIn(repo)) {
    const decl = readDeclaration(inst);
    // `"enabled": false` is a declaration that it is not published, so it has
    // no entry — the same answer the deploy's plan gives (`isPublished`).
    if (!decl || !isPublished(decl)) continue;
    const id = exportIdentity({ instanceRoot: inst, baseUrl: opts.baseUrl });
    // WHERE ON THIS SITE, which is not always `docPath`: a layer that
    // declares its own `canonicalUrl` mints `@id`s against that, so its
    // `docPath` is `<stub>.jsonld` under ITS base, while `instance-exports.ts`
    // writes the copy this site serves at `<stub>/<stub>.jsonld` (measured
    // 2026-10-04 for cat-harness-tools, cat-openapi, the FHIR IG harness, the DAK base layer).
    // Both are looked for, the foreign path first; the entry records which.
    const stub = artefactStub(decl);
    const foreign = instanceDocPath({ name: decl.name, stub });
    const served = [foreign, id.docPath].find((p) => existsSync(join(site, p)));
    if (served === undefined) {
      problems.push(`${decl.name}: no export at ${foreign} or ${id.docPath} — the deploy did not publish it`);
      continue;
    }
    const file = join(site, served);
    const bytes = readFileSync(file);
    let nodes = 0;
    try {
      nodes = list((JSON.parse(bytes.toString("utf-8")) as Doc)["@graph"]).length;
    } catch (e) {
      problems.push(`${decl.name}: ${id.docPath} does not parse — ${String(e)}`);
      continue;
    }
    // A framed layer's root is in the repository index's `hasSubgraph`; an
    // unframed one publishes its own, which the index links with `seeAlso`
    // (bean `t8c4`) at the address bootstrap-tools' `publicationBase` gives
    // it — the same rule `gen-subgraph-jsonld.ts` wrote the link with.
    const ownBase = publicationBase(readKnowledgeGraphDeclaration(inst));
    const subgraph =
      roots.find((r) => r.replace(/\/$/, "").endsWith(`/subgraph/${decl.name}`)) ??
      (ownBase ? seeAlso.find((s) => s === `${ownBase}subgraph/`) : undefined);
    byName.set(decl.name, id.docIri);
    entries.push({
      "@id": id.docIri,
      "@type": termIri("Harness"),
      name: decl.name,
      stub,
      url: `${siteBase}/${served}`,
      ...(decl.title ? { title: decl.title } : {}),
      ...(decl.description ? { description: decl.description } : {}),
      ...(decl.version ? { version: decl.version } : {}),
      ...(decl.needs?.length ? { dependsOn: [...decl.needs] } : {}),
      directory: (decl.directories ?? []).map((d) => ({ name: d.id, path: d.path, graphTypologies: [...(d.graphTypologies ?? [])] })),
      ...(subgraph ? { subgraph } : {}),
      nodes,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  // `needs` names layers; the index names their documents.
  for (const e of entries) {
    if (!e.dependsOn) continue;
    e.dependsOn = e.dependsOn.map((n) => {
      const iri = byName.get(n);
      if (!iri) problems.push(`${e.name}: needs \`${n}\`, which no entry in this index is`);
      return iri ?? n;
    });
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (entries.length === 0) problems.push("no declared instance has an export — an index of nothing has mapped nothing");

  const doc: Doc = {
    // Every term minted by `propertyIri` / `termIri`, never written here:
    // a namespace spelt by hand is the second name `namespaces.ts` exists to
    // stop (it replaced 93 such literals).
    "@context": {
      ...Object.fromEntries(["name", "stub", "title", "description", "version", "path", "nodes", "bytes", "sha256"].map((t) => [t, propertyIri(t)])),
      dependsOn: { "@id": propertyIri("dependsOn"), "@type": "@id", "@container": "@set" },
      directory: { "@id": propertyIri("directory"), "@container": "@set" },
      graphTypologies: { "@id": propertyIri("holdsGraph"), "@container": "@set" },
      subgraph: { "@id": propertyIri("hasSubgraph"), "@type": "@id" },
      url: { "@id": propertyIri("contentUrl"), "@type": "@id" },
      hasHarness: { "@id": propertyIri("hasMember"), "@container": "@set" },
    },
    "@id": `${siteBase}/${ROOT_INDEX_FILE}`,
    "@type": termIri("KnowledgeGraph"),
    hasHarness: entries,
  };
  return { doc, problems };
}

if (import.meta.main) {
  const arg = (flag: string): string | undefined => {
    const i = process.argv.indexOf(flag);
    return i !== -1 ? process.argv[i + 1] : undefined;
  };
  const site = arg("--site");
  if (!site) {
    console.error("usage: root-index.ts --site <dir> [--base-url <url>] [--subgraph-index <file>]");
    process.exit(2);
  }
  const subgraphIndex = arg("--subgraph-index");
  const { doc, problems } = buildRootIndex(resolve(site), { baseUrl: arg("--base-url"), ...(subgraphIndex ? { subgraphIndex: resolve(subgraphIndex) } : {}) });
  if (problems.length) {
    console.error("root-index: not written —");
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
  const text = `${JSON.stringify(doc, null, 2)}\n`;
  writeFileSync(join(site, ROOT_INDEX_FILE), text);
  writeFileSync(join(site, ROOT_INDEX_ALIAS), text);
  console.log(`root-index: ${list(doc.hasHarness).length} instance(s) → ${join(site, ROOT_INDEX_FILE)} (+ ${ROOT_INDEX_ALIAS})`);
}
