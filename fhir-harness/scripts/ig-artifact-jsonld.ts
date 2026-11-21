#!/usr/bin/env bun
/**
 * One JSON-LD node per FHIR IG artefact, from the artefact index — and the QA
 * check that the nodes a site publishes are the ones its index says.
 *
 * @module fhir-harness/scripts/ig-artifact-jsonld
 * @covers ig-artifact-jsonld, fhir-artifact-index — it reads the index and its `check` grades every node it writes
 *
 * Usage:
 *   bun run fhir-harness/scripts/ig-artifact-jsonld.ts write --index <index.json> --out <dir>
 *     [--base <site-root-url>] [--compiled-data <path from the docs root>] [--title <IG display name>] [--root-resources]
 *   bun run fhir-harness/scripts/ig-artifact-jsonld.ts check --index <index.json> --dir <dir>
 *
 * ## Why here
 *
 * The owner, 2026-10-11, option A: IG artefact pages as *"tiny html w/ dynamic
 * load from json(ld) KG"*, as the OpenAPI operation pages already are. The
 * only per-artefact JSON-LD until now was written by an overlay one layer
 * up, which is WHO's and which a non-WHO IG may not depend on.
 * Nothing here is: the vocabulary is FHIR RDF's classes, Dublin Core,
 * schema.org and PROV (`schemas/ig-artifact-jsonld.ts` says which term says
 * what), and the input is `fhir-artifact-index`, which any IG has.
 *
 * ## Where the nodes go
 *
 * Beside the pages that render them, `<docs>/artifact/<Type>-<id>.jsonld`.
 * `gen-ig-pages.ts --thin` writes them with the pages; this CLI writes them
 * alone, and checks a built site.
 *
 * ## The resource files the nodes name
 *
 * With `rootResources` (the IG site's default; owner, 2026-11-10, card "C";
 * fhir-harness#359), each node's first encoding is the resource at the site
 * root, `<Type>-<id>.json`, as the IG Publisher names it and FHIR readers
 * expect (`dcterms:source` `local`), and its second the full copy in the AST
 * cache by raw URL at the cache commit (`mirror`). The root copy is reduced
 * (no narrative, no ELM data: `ig-repo-site.ts` `reduceForSite`); the page
 * draws the mirror. The index node names each root file on its entry
 * (`schema:contentUrl`), so the whole set is found from one document.
 *
 * No `.json` twin. Each node used to have a byte-identical `<Type>-<id>.json`
 * beside it, and the index node an `index.json`, on the reasoning that GitHub
 * Pages serves no JSON-LD media type. Every reader fetches the `.jsonld` (the
 * thin pages, `ig-search.js`, the `alternate` link) and parses it with
 * `response.json()`, which does not look at the media type; nothing on a site
 * named a twin, and the twins were 2.1 MB of one IG's site (owner,
 * 2026-11-10, "do B": the artefact lists a site ships overlap). `check`
 * reports a twin it finds, so a stale one is not served.
 *
 * ## IRIs
 *
 * Each node's `@id` is extensionless, `artifact/<Type>-<id>`: its kind
 * (`artifact`) and id are its last two segments (cat-harness-tools#1830,
 * Q-THIN-2 A), the node's JSON-LD is at the IRI plus `.jsonld`, and the
 * artefact's page is at the IRI plus `.html`, which a static host serves at
 * the IRI itself. With `--base`, each `@id` is absolute under it. Without it
 * the `@id` is relative, which a JSON-LD processor
 * resolves against the document's URL — the same node wherever the site is
 * served, a staging preview included. Every `schema:contentUrl` follows the
 * same rule.
 *
 * Nothing here may know about WHO (fhir-harness/AGENTS.md).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";

import { FhirArtifactIndexSchema, type FhirArtifact, type FhirArtifactIndex } from "../schemas/fhir-artifact-index.js";
import { byCategory } from "../schemas/fhir-artifact-index.js";
import {
  FHIR_JSON,
  IG_ARTIFACT_INDEX_JSONLD_SCHEMA_TAG,
  IG_ARTIFACT_JSONLD_CONTEXT,
  IG_ARTIFACT_JSONLD_SCHEMA_TAG,
  IgArtifactIndexJsonLdSchema,
  IgArtifactJsonLdSchema,
  type IgArtifactEncoding,
  type IgDefinedTerm,
  type IgArtifactIndexJsonLd,
  type IgArtifactJsonLd,
} from "../schemas/ig-artifact-jsonld.js";

/** The directory under the docs root the artefact pages and nodes share. */
export const ARTIFACT_DIR = "artifact";
/**
 * The index node's file in that directory. No artefact's own node can take
 * the name: every one is `<Type>-<id>.jsonld`, and a type is capitalised.
 */
export const ARTIFACT_INDEX_FILE = "index.jsonld";

/** A filesystem-safe page name for an artefact key (`ValueSet/Actors` → `ValueSet-Actors`) — `gen-ig-pages`' own. */
export function artifactPageName(a: Pick<FhirArtifact, "resourceType" | "id">): string {
  return `${a.resourceType}-${a.id}`.replace(/[^A-Za-z0-9._-]/g, "_");
}

export interface JsonLdOptions {
  /** The docs root's absolute URL, ending in `/`. Absent: every IRI is relative to the node's own file. */
  base?: string;
  /**
   * Where a compiled index's resource files are served, as a path from the
   * docs root (`gen-ig-pages --compiled-data`, e.g. `../ast-data`), or an
   * absolute `https://` base the AST tree is read from ({@link isRemoteData}).
   * Absent: no local copy is claimed.
   */
  compiledData?: string;
  /** The IG's display name, for the index node's `dcterms:title`. */
  title?: string;
  /**
   * Whether the site serves each compiled resource at its ROOT as
   * `<Type>-<id>.json`, the IG Publisher's name and FHIR's convention (owner,
   * 2026-11-10, card "C"; fhir-harness#359). Each node then lists that file
   * first (`local`) and the AST cache's full copy second (`mirror`), and the
   * index node names it on each entry (`schema:contentUrl`). The root copy is
   * reduced (`ig-repo-site.ts` `reduceForSite`); the mirror is the full one.
   */
  rootResources?: boolean;
}

/** The name a resource is served under at the site root: `<Type>-<id>.json`, as the IG Publisher writes it. */
export function rootResourceName(a: { resourceType: string; id: string }): string {
  return `${a.resourceType}-${a.id}.json`;
}

/**
 * The root copy of an artefact, relative to `artifact/<file>`, when the site
 * serves one ({@link JsonLdOptions.rootResources}) and the AST holds the
 * resource (a compiled, materialized artefact); else undefined.
 */
export function rootResourceHref(a: FhirArtifact, o: Pick<JsonLdOptions, "rootResources">): string | undefined {
  const m = a.materialization;
  if (!o.rootResources || m.state !== "materialized" || m.purpose !== "compiled" || !m.localPath) return undefined;
  return `../${rootResourceName(a)}`;
}

/**
 * `--compiled-data` value meaning each compiled copy is served once, at the
 * docs root under the Publisher's name `<Type>-<id>.json`, with no mirror of
 * the AST tree (owner, 2026-11-08: "we dont need ast-data/resources
 * published"). The IG site uses it; a docs root beside the AST still passes a
 * directory.
 */
export const COMPILED_BY_NAME = ".";

/**
 * Whether `--compiled-data` names an absolute base the AST tree is read from
 * rather than a path on this site: the IG's AST cache branch on
 * raw.githubusercontent.com, pinned to the commit the site was built from
 * (owner, 2026-11-10, card "A"; fhir-harness#325). The site then carries no
 * copy of the resources; each page fetches its own from that commit.
 */
export function isRemoteData(compiledData: string | undefined): boolean {
  return compiledData !== undefined && /^https:\/\//.test(compiledData);
}

/** The served path of a compiled copy, relative to an artefact page or node (absolute for {@link isRemoteData}), or undefined. */
export function localResourceHref(a: FhirArtifact, compiledData: string | undefined): string | undefined {
  const m = a.materialization;
  if (!compiledData || m.state !== "materialized" || m.purpose !== "compiled" || !m.localPath) return undefined;
  // The AST branch's root is the AST directory, so its own name is dropped here too.
  if (isRemoteData(compiledData)) return `${compiledData.replace(/\/+$/, "")}/${m.localPath.replace(/^[^/]+\//, "").split("/").map(encodeURIComponent).join("/")}`;
  // `artifact/X.jsonld` → the docs root is `../`.
  if (compiledData.replace(/\/+$/, "") === COMPILED_BY_NAME) return `../${a.resourceType}-${a.id}.json`;
  // The served tree mirrors the AST directory, so its own name is dropped.
  return `../${compiledData.replace(/\/+$/, "")}/${m.localPath.replace(/^[^/]+\//, "")}`;
}

/** `href`, relative to `artifact/<file>`, as an IRI: absolute under `base`, else as written. */
function iriFor(href: string, base: string | undefined): string {
  return base ? new URL(href, new URL(`${ARTIFACT_DIR}/`, base)).href : href;
}

/**
 * What an INSTANCE states about itself beyond its name: its profiles
 * (`meta.profile`) and its `code` concept, in the node's vocabulary. Read off
 * the index, which copied them from the resource; nothing is looked up.
 *
 * An instance is an artefact with no canonical URL (a `Basic` page, role or
 * task, a DocumentReference, a Bundle): it has no title or description of
 * its own, and these are what its list row can show (owner, 2026-10-12). A
 * definition (a CodeSystem, a profile, a Questionnaire) is described by its
 * own description, and its `meta.profile` is typically a core one
 * (`shareablevalueset`): drawn, it cost a column on every phone for nothing,
 * so it is not written.
 */
export function statedFacts(a: FhirArtifact): Pick<IgArtifactJsonLd, "dcterms:conformsTo" | "dcterms:subject"> {
  if (a.canonical) return {};
  const terms: IgDefinedTerm[] = [
    ...(a.code?.coding ?? []).map((c) => ({
      "@type": "schema:DefinedTerm" as const,
      ...(c.code ? { "schema:termCode": c.code } : {}),
      ...(c.display ? { "schema:name": c.display } : {}),
      ...(c.system ? { "schema:inDefinedTermSet": { "@id": c.system } } : {}),
    })),
    ...(a.code?.text ? [{ "@type": "schema:DefinedTerm" as const, "schema:name": a.code.text }] : []),
  ];
  return {
    ...(a.profiles?.length ? { "dcterms:conformsTo": a.profiles.map((p) => ({ "@id": p })) } : {}),
    ...(terms.length ? { "dcterms:subject": terms } : {}),
  };
}

/** The node for one artefact. Deterministic: the same index gives the same bytes. */
export function artifactJsonLd(ix: FhirArtifactIndex, a: FhirArtifact, o: JsonLdOptions = {}): IgArtifactJsonLd {
  const encodings: IgArtifactEncoding[] = [];
  // The site's root copy first (reduced), then the compiled copy the pages
  // read: the AST cache's full copy by raw URL (`mirror`), or a copy this site
  // serves (`local`) when it is not the root one already listed.
  const root = rootResourceHref(a, o);
  if (root) encodings.push({ "@type": "schema:MediaObject", "schema:contentUrl": { "@id": iriFor(root, o.base) }, "schema:encodingFormat": FHIR_JSON, "dcterms:source": "local" });
  const local = localResourceHref(a, o.compiledData);
  if (local && local !== root) {
    encodings.push({ "@type": "schema:MediaObject", "schema:contentUrl": { "@id": iriFor(local, o.base) }, "schema:encodingFormat": FHIR_JSON, "dcterms:source": isRemoteData(o.compiledData) ? "mirror" : "local" });
  }
  // The upstream JSON, where the IG publishes it. The html is the Publisher's
  // page, which this node does not point at: the page that renders this node
  // is the html, and the node names no rendering. No XML or Turtle encoding:
  // owner, 2026-10-23, "excise XML and ttl everywhere for now" (the P2
  // refusal record still counts what the IG published in those forms).
  const upstream = a.published.json;
  if (upstream) encodings.push({ "@type": "schema:MediaObject", "schema:contentUrl": { "@id": upstream.url }, "schema:encodingFormat": FHIR_JSON, "dcterms:source": "upstream" });
  const m = a.materialization;
  const inputs = m.state === "materialized" && m.purpose === "compiled" ? m.inputs : undefined;
  const node: IgArtifactJsonLd = {
    "@context": { ...IG_ARTIFACT_JSONLD_CONTEXT },
    $schema: IG_ARTIFACT_JSONLD_SCHEMA_TAG,
    "@id": iriFor(artifactPageName(a), o.base),
    "@type": `fhir:${a.resourceType}`,
    "dcterms:identifier": a.key,
    ...(a.name ? { "schema:name": a.name } : {}),
    ...(a.title ? { "dcterms:title": a.title } : {}),
    ...(a.description ? { "dcterms:description": a.description } : {}),
    ...(a.version ? { "schema:version": a.version } : {}),
    ...(a.category ? { "dcterms:type": a.category } : {}),
    ...(a.canonical ? { "schema:sameAs": { "@id": a.canonical } } : {}),
    "schema:creativeWorkStatus": m.state === "materialized" ? "materialized" : "referenced",
    "schema:encoding": encodings,
    ...(inputs ? { "prov:wasGeneratedBy": { "@type": "prov:Activity" as const, "schema:instrument": inputs.toolchain, "prov:used": inputs.sourceRevision } } : {}),
    "dcterms:isPartOf": {
      "@type": "fhir:ImplementationGuide",
      ...(ix.packageId ? { "dcterms:identifier": ix.packageId } : {}),
      ...(ix.version ? { "schema:version": ix.version } : {}),
      ...(ix.canonicalBase ? { "schema:sameAs": { "@id": ix.canonicalBase } } : {}),
    },
    ...statedFacts(a),
  };
  return node;
}

/**
 * The index node: every artefact once, in the Publisher's order (`byCategory`:
 * categories by first appearance, the uncategorised last), each entry naming
 * its node and carrying what a list row shows. Deterministic.
 */
export function artifactIndexJsonLd(ix: FhirArtifactIndex, o: JsonLdOptions = {}): IgArtifactIndexJsonLd {
  const parts = [...byCategory(ix.artifacts).values()].flat().map((a) => {
    const root = rootResourceHref(a, o);
    return {
      "@id": iriFor(artifactPageName(a), o.base),
      "@type": `fhir:${a.resourceType}`,
      "dcterms:identifier": a.key,
      "dcterms:title": a.title ?? a.name ?? a.id,
      // The computer name, for the IG's search, when neither the title nor the id says it.
      ...(a.name && a.name !== (a.title ?? a.name) && a.name !== a.id ? { "schema:name": a.name } : {}),
      ...(a.description ? { "dcterms:description": a.description } : {}),
      ...(a.category ? { "dcterms:type": a.category } : {}),
      ...(a.canonical ? { "schema:sameAs": { "@id": a.canonical } } : {}),
      ...statedFacts(a),
      ...(root ? { "schema:contentUrl": { "@id": iriFor(root, o.base) } } : {}),
    };
  });
  return {
    "@context": { ...IG_ARTIFACT_JSONLD_CONTEXT },
    $schema: IG_ARTIFACT_INDEX_JSONLD_SCHEMA_TAG,
    "@id": iriFor(ARTIFACT_INDEX_FILE, o.base),
    "@type": "fhir:ImplementationGuide",
    ...(ix.packageId ? { "dcterms:identifier": ix.packageId } : {}),
    ...(ix.version ? { "schema:version": ix.version } : {}),
    ...(ix.canonicalBase ? { "schema:sameAs": { "@id": ix.canonicalBase } } : {}),
    ...(o.title ? { "dcterms:title": o.title } : {}),
    "schema:numberOfItems": parts.length,
    "schema:hasPart": parts,
  };
}

/**
 * Every file a run writes, keyed by its path under the docs root: `<page>.jsonld`
 * per artefact, and the index node (`index.jsonld`). No `.json` twin (see the
 * module's head).
 */
export function artifactJsonLdFiles(ix: FhirArtifactIndex, o: JsonLdOptions = {}): Map<string, string> {
  const out = new Map<string, string>();
  for (const a of ix.artifacts) {
    const text = `${JSON.stringify(artifactJsonLd(ix, a, o), null, 2)}\n`;
    const stem = posix.join(ARTIFACT_DIR, artifactPageName(a));
    out.set(`${stem}.jsonld`, text);
  }
  const index = `${JSON.stringify(artifactIndexJsonLd(ix, o), null, 2)}\n`;
  out.set(posix.join(ARTIFACT_DIR, ARTIFACT_INDEX_FILE), index);
  return out;
}

/** The terms an index entry repeats from its node, beyond key and class, which `check` holds equal. */
const SUMMARISED = ["schema:sameAs", "dcterms:conformsTo", "dcterms:subject"] as const;

/** The path from a node's directory to an IRI it names, as `check` resolves both kinds of IRI. */
function relFrom(nodeId: string, url: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) && /^[a-z][a-z0-9+.-]*:/i.test(nodeId)
    ? posix.relative(posix.dirname(new URL(nodeId).pathname), new URL(url).pathname)
    : url;
}

/**
 * QA over the index node of a BUILT docs root (part of `check`): it parses as
 * its family, lists every artefact of the index exactly once and nothing else,
 * names itself, and each entry's `@id` is a node on the site whose key and
 * class are the entry's. Empty is a pass.
 */
export function checkArtifactIndexJsonLd(ix: FhirArtifactIndex, docsRoot: string): string[] {
  const dir = join(docsRoot, ARTIFACT_DIR);
  const at = `${ARTIFACT_DIR}/${ARTIFACT_INDEX_FILE}`;
  const p = join(dir, ARTIFACT_INDEX_FILE);
  if (!existsSync(p)) return [`${at}: missing — the thin artifacts and toc pages have nothing to draw`];
  const text = readFileSync(p, "utf8");
  const findings: string[] = [];
  if (existsSync(p.replace(/\.jsonld$/, ".json"))) findings.push(`${at}: a .json twin is served beside it — a second copy of the node no reader fetches`);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return [...findings, `${at}: not JSON (${(e as Error).message})`];
  }
  const parsed = IgArtifactIndexJsonLdSchema.safeParse(raw);
  if (!parsed.success) return [...findings, `${at}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`];
  const n = parsed.data;
  if (!n["@id"].endsWith(`/${ARTIFACT_INDEX_FILE}`) && n["@id"] !== ARTIFACT_INDEX_FILE) findings.push(`${at}: its @id ${n["@id"]} is not its own address`);
  const want = new Set(ix.artifacts.map((a) => a.key));
  const seen = new Set<string>();
  for (const e of n["schema:hasPart"]) {
    const key = e["dcterms:identifier"];
    if (seen.has(key)) findings.push(`${at}: lists ${key} twice`);
    seen.add(key);
    if (!want.has(key)) findings.push(`${at}: lists ${key}, which the artefact index does not hold`);
    const nodePath = `${resolve(dir, decodeURI(relFrom(n["@id"], e["@id"])))}.jsonld`;
    if (!existsSync(nodePath)) {
      findings.push(`${at}: ${key}'s node ${e["@id"]} is not on the site`);
      continue;
    }
    try {
      const node = JSON.parse(readFileSync(nodePath, "utf8")) as Record<string, unknown> & { "dcterms:identifier"?: string; "@type"?: string };
      if (node["dcterms:identifier"] !== key || node["@type"] !== e["@type"]) {
        findings.push(`${at}: the entry for ${key} (${e["@type"]}) names a node that is ${node["dcterms:identifier"]} (${node["@type"]})`);
        continue;
      }
      // A summary, never a second home: what the entry repeats is the node's.
      for (const term of SUMMARISED) {
        if (JSON.stringify(e[term] ?? null) !== JSON.stringify(node[term] ?? null)) {
          findings.push(`${at}: the entry for ${key} says ${term} ${JSON.stringify(e[term] ?? null)}, its node ${JSON.stringify(node[term] ?? null)}`);
        }
      }
      // The root file the entry names is the node's first local copy, and is on the site.
      const first = (node["schema:encoding"] as IgArtifactEncoding[] | undefined)?.find((x) => x["dcterms:source"] === "local")?.["schema:contentUrl"]["@id"];
      const named = e["schema:contentUrl"]?.["@id"];
      if (named !== undefined) {
        if (named !== first) findings.push(`${at}: the entry for ${key} names ${named}, its node's local copy is ${first ?? "none"}`);
        else if (!existsSync(resolve(dir, decodeURI(relFrom(n["@id"], named))))) findings.push(`${at}: the entry for ${key} names ${named}, which is not on the site`);
      }
      // Stated only when the title does not say it, so held equal only when stated.
      if (e["schema:name"] !== undefined && e["schema:name"] !== node["schema:name"]) {
        findings.push(`${at}: the entry for ${key} says schema:name ${JSON.stringify(e["schema:name"])}, its node ${JSON.stringify(node["schema:name"] ?? null)}`);
      }
    } catch {
      findings.push(`${at}: ${key}'s node ${e["@id"]} is not JSON`);
    }
  }
  for (const k of want) if (!seen.has(k)) findings.push(`${at}: does not list ${k}`);
  return findings;
}

/**
 * QA over a BUILT docs root: what a reader's browser will fetch, judged
 * against the index it was written from. Beyond shape:
 *
 * - every artefact has its node, and no node names an artefact the index lacks;
 * - each node's key, type and `@id` are its own file's (a node copied to the
 *   wrong name would render another artefact's page);
 * - no `.json` twin is served beside it (a second copy no reader fetches);
 * - every LOCAL `schema:contentUrl` resolves to a file under the site — the
 *   root `<Type>-<id>.json` a harvester reads, or the copy the page draws. A
 *   mirror or upstream URL is not fetched: this check runs without the
 *   network, and says so.
 *
 * Returns the findings; empty is a pass.
 */
export function checkArtifactJsonLd(ix: FhirArtifactIndex, docsRoot: string): string[] {
  const dir = join(docsRoot, ARTIFACT_DIR);
  const findings: string[] = [];
  if (!existsSync(dir)) return [`${dir} does not exist — no node was written, and that is not a pass`];
  const want = new Map(ix.artifacts.map((a) => [`${artifactPageName(a)}.jsonld`, a]));
  const have = readdirSync(dir).filter((f) => f.endsWith(".jsonld") && f !== ARTIFACT_INDEX_FILE);
  for (const f of have) if (!want.has(f)) findings.push(`${ARTIFACT_DIR}/${f}: an orphan — no artefact in the index has this name`);
  for (const [f, a] of want) {
    const p = join(dir, f);
    if (!existsSync(p)) {
      findings.push(`${ARTIFACT_DIR}/${f}: missing — ${a.key} has no node`);
      continue;
    }
    const text = readFileSync(p, "utf8");
    if (existsSync(p.replace(/\.jsonld$/, ".json"))) findings.push(`${ARTIFACT_DIR}/${f}: a .json twin is served beside it — a second copy of the node no reader fetches`);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      findings.push(`${ARTIFACT_DIR}/${f}: not JSON (${(e as Error).message})`);
      continue;
    }
    const parsed = IgArtifactJsonLdSchema.safeParse(raw);
    if (!parsed.success) {
      findings.push(`${ARTIFACT_DIR}/${f}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      continue;
    }
    const n = parsed.data;
    if (n["dcterms:identifier"] !== a.key) findings.push(`${ARTIFACT_DIR}/${f}: names ${n["dcterms:identifier"]}, but the file is ${a.key}'s`);
    const iri = f.replace(/\.jsonld$/, "");
    if (!n["@id"].endsWith(`/${iri}`) && n["@id"] !== iri) findings.push(`${ARTIFACT_DIR}/${f}: its @id ${n["@id"]} is not its own address`);
    for (const e of n["schema:encoding"]) {
      if (e["dcterms:source"] !== "local") continue;
      const url = e["schema:contentUrl"]["@id"];
      // Relative to the node, or absolute under the node's own @id's base:
      // either way the path from the node's directory decides.
      const target = resolve(dir, decodeURI(relFrom(n["@id"], url)));
      if (!existsSync(target)) findings.push(`${ARTIFACT_DIR}/${f}: its resource ${url} is not on the site (${target})`);
    }
  }
  return [...findings, ...checkArtifactIndexJsonLd(ix, docsRoot)];
}

function readIndex(path: string): FhirArtifactIndex {
  const parsed = FhirArtifactIndexSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!parsed.success) {
    throw new Error(`${path} is not a valid artefact index: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  return parsed.data;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const at = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const cmd = argv[0];
  const index = at("--index");
  if ((cmd !== "write" && cmd !== "check") || !index) {
    console.error("usage: ig-artifact-jsonld.ts write --index <index.json> --out <docs-root> [--base <url>] [--compiled-data <path>]\n       ig-artifact-jsonld.ts check --index <index.json> --dir <docs-root>");
    process.exit(2);
  }
  const ix = readIndex(resolve(index));
  if (cmd === "write") {
    const out = at("--out");
    if (!out) {
      console.error("write needs --out <docs-root>");
      process.exit(2);
    }
    const base = at("--base");
    const files = artifactJsonLdFiles(ix, { ...(base ? { base: base.endsWith("/") ? base : `${base}/` } : {}), ...(at("--compiled-data") ? { compiledData: at("--compiled-data")! } : {}), ...(at("--title") ? { title: at("--title")! } : {}), ...(argv.includes("--root-resources") ? { rootResources: true } : {}) });
    for (const [rel, text] of files) {
      const p = join(resolve(out), rel);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, text);
    }
    console.log(`wrote ${files.size - 1} artefact node(s) and the index node (.jsonld) under ${join(out, ARTIFACT_DIR)}/`);
  } else {
    const dir = at("--dir");
    if (!dir) {
      console.error("check needs --dir <docs-root>");
      process.exit(2);
    }
    const findings = checkArtifactJsonLd(ix, resolve(dir));
    if (findings.length) {
      console.error(`✗ ${findings.length} finding(s) over ${ix.count} artefact node(s):`);
      for (const f of findings.slice(0, 20)) console.error(`    ${f}`);
      if (findings.length > 20) console.error(`    …and ${findings.length - 20} more`);
      process.exit(1);
    }
    console.log(`✓ ${ix.count} artefact node(s) current, each with its resource on the site, and the index node lists each once (upstream URLs not fetched)`);
  }
}
