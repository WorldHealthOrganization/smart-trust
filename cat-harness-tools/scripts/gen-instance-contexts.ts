#!/usr/bin/env bun
/**
 * Write each layer's JSON-LD `@context`, generated from the prefixes its
 * documents actually use — and, with `--check`, gate that every prefix a
 * document speaks resolves.
 *
 * No prefix is forward-declared. A layer declares the external namespaces
 * it speaks (`jsonldPrefixes`, cat-harness `schemas/kg/jsonld-prefixes.ts`);
 * its published context binds exactly the prefixes its `.jsonld` documents
 * use, resolved through its own table flattened with those of every layer
 * it `needs` (dependency order, `@protected`). A node then references ONE
 * context URL plus its own inline `@base`.
 *
 * ## Where it is written: `<instance>/ns/context/v1.jsonld`
 *
 * In the same `ns/<what>/v<major>.jsonld` shape as `ns/content/v1.jsonld` and
 * `ns/subgraph/v1.jsonld`. INSTANCE-relative, so it is served at
 * `<iriBase>ns/context/v1.jsonld`, under the layer's own base, and a
 * layer's context is published by that layer. The terms are `@protected`, so
 * a change that rebinds one is a NEW context (`v2`) published beside the old
 * one, never an edit under a cached URL.
 *
 * ## Except where the layer's `ns` is a DOCUMENT: `<instance>/ns.context.v1.jsonld`
 *
 * A layer that holds its vocabulary as `ns.jsonld` at its root
 * (bootstrap) has it staged at the extensionless `ns` and `v<major>/ns`, a
 * FILE, so `ns/context/v1.jsonld` cannot sit under it. Such a layer's
 * context goes BESIDE the vocabulary, at {@link NS_DOCUMENT_CONTEXT_PATH},
 * same `v1` rule. Decided by what the layer holds ({@link contextPathFor}),
 * never by its name.
 *
 * ## What it reads, and what it refuses to read
 *
 * - Declarations as DATA — `name`, `needs`, `stub`, `jsonldPrefixes` from each
 *   `<dir>/<dir>.json` — never by importing the layer above.
 * - A layer's OWN namespace (`<stub>` → `…/<stub>/v0/ns/`) is implicit:
 *   it comes from cat-harness's `ownPrefixTable` / `own-namespaces.json`, not from
 *   `jsonldPrefixes`, which holds EXTERNAL vocabularies only.
 * - Documents: every `.jsonld` git lists (tracked plus untracked-not-ignored,
 *   plus remote mounts — `contentDocuments` in `lib/jsonld-corpus.ts`), each
 *   assigned to its innermost layer.
 *   EXCLUDED: a context document under `ns/` (a file whose only key is
 *   `@context`): a context binding a prefix is not a document using it.
 *
 * ## Terms, not only prefixes
 *
 * A document naming the content context speaks its TERMS — `title`, `cites`,
 * `meta` — and binding `dcterms` and `cito` alone does not make `cites` an
 * `@id`-typed set or `meta` a JSON literal. So the generated context also
 * DEFINES every content- and subgraph-context term the layer's documents
 * use, copied verbatim, `@protected` with the rest, and with the prefixes those
 * definitions are written in bound alongside. A term's context must belong to
 * a layer in the flattened `needs`; only the layer's own documents'
 * terms are carried. The generated context can therefore REPLACE
 * `ns/content/v1.jsonld` in a document with no triple lost.
 *
 * ## What `--check` fails on
 *
 * drift (a context on disk differs from the generated one — an ABSENT one is
 * not drift, since the contexts are built at publish and never committed), a prefix used
 * in an IRI position that neither the flattened table nor the document's own
 * inline context binds, a prefix two layers in a flattened table bind
 * differently, a term two contexts define differently (or that a bound prefix
 * shares a name with), a term whose context or prefixes do not resolve here,
 * and a malformed `jsonldPrefixes` table. Each names the file and
 * the prefix. A prefix met only as a literal string (`leanRef: "qou:QOU.x"`) is
 * REPORTED, never failed on — see `pipeline/jsonld-contexts.ts`. Key and path
 * checks live in `check-content-keys.ts`.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/gen-instance-contexts.ts
 *   bun run cat-harness-tools/scripts/gen-instance-contexts.ts --check
 *   bun run cat-harness-tools/scripts/gen-instance-contexts.ts --json
 *   … --root <index-root>      (default: the checkout this layer sits in)
 *
 * @module scripts/gen-instance-contexts
 * @covers schemas
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { findDeclarationFile, layerRootsIn } from "../schemas/kg/cat-harness.js";
import { ancestorsOf, flattenDependencies } from "../schemas/kg/dependency-order.js";
import { JsonldPrefixTableSchema, type DeclaredPrefixes, type JsonldPrefixTable } from "../schemas/kg/jsonld-prefixes.js";
import { CONTENT_CONTEXT, CONTENT_CONTEXT_URL } from "../schemas/kg/jsonld.js";
import { ownNamespace } from "../schemas/kg/namespaces.js";
import { ownPrefixTable } from "../schemas/kg/graph-typology-registry.js";
import { heldProvJsonldContext, PROV_JSONLD_CONTEXT_URL } from "../schemas/kg/prov-jsonld.js";
import { SUBGRAPH_CONTEXT_PATH } from "../schemas/kg/subgraph-manifest.js";

import {
  buildInstanceContext,
  documentUses,
  isContextDocument,
  ownBindings,
  type InstanceContext,
  type TermSource,
  type UsedPrefixes,
  type UsedTerms,
} from "../pipeline/jsonld-contexts.ts";
import { INSTANCE_CONTEXT_PATH as BOUNDARY_INSTANCE_CONTEXT_PATH, instanceContextUrl } from "../pipeline/instance-document-context.ts";
import { contentDocuments } from "./lib/jsonld-corpus.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

/** Instance-relative, and why it is this path: see the module note. Defined once, beside the write boundary. */
export const INSTANCE_CONTEXT_PATH = BOUNDARY_INSTANCE_CONTEXT_PATH;

/** The namespace DOCUMENT a layer may hold at its root, staged at the extensionless `ns`. */
export const NS_DOCUMENT = "ns.jsonld";

/** Where the context of a layer whose `ns` is a document goes: beside it (D1, see the module note). */
export const NS_DOCUMENT_CONTEXT_PATH = "ns.context.v1.jsonld";

/**
 * The instance-relative path of the context of the layer at `root`:
 * {@link NS_DOCUMENT_CONTEXT_PATH} when it holds its namespace as a document
 * ({@link NS_DOCUMENT}), else {@link INSTANCE_CONTEXT_PATH}.
 */
export function contextPathFor(root: string): string {
  return existsSync(join(root, NS_DOCUMENT)) ? NS_DOCUMENT_CONTEXT_PATH : INSTANCE_CONTEXT_PATH;
}

const DEFAULT_ROOT = resolve(dirname(HARNESS_ROOT));

/** One layer, read from its declaration as data. */
export interface InstanceDecl {
  root: string;
  name: string;
  stub: string;
  /** The declared `iriBase`: the layer's context is published at `<iriBase>ns/context/v1.jsonld`. */
  iriBase?: string;
  needs: string[] | undefined;
  /** The declared table, or the error that made it unreadable. */
  prefixes: JsonldPrefixTable;
  /** Instance-relative path of its context ({@link contextPathFor}). */
  contextPath: string;
  prefixError?: string;
  /**
   * The layer declares its context as built at publish (a `builtAtPublish`
   * entry for its {@link contextPathFor} path). The declaration promises the
   * file, so it is written even when no document of the layer is mounted
   * here — an index that mounts none of a layer's directories otherwise
   * fails `derive:publish` with "declared built at publish, and built nothing".
   */
  declaresContext?: boolean;
}

export function readInstanceDecls(repoRoot: string): InstanceDecl[] {
  return layerRootsIn(repoRoot).flatMap((root) => {
    const file = findDeclarationFile(root);
    if (file === undefined) return [];
    let raw: { name?: unknown; stub?: unknown; iriBase?: unknown; needs?: unknown; jsonldPrefixes?: unknown; builtAtPublish?: unknown };
    try {
      raw = JSON.parse(readFileSync(join(root, file), "utf-8"));
    } catch {
      return []; // `check:declaration-filename`'s finding, not this one's.
    }
    if (typeof raw.name !== "string") return [];
    const contextPath = contextPathFor(root);
    const parsed = raw.jsonldPrefixes === undefined ? undefined : JsonldPrefixTableSchema.safeParse(raw.jsonldPrefixes);
    return [
      {
        root,
        name: raw.name,
        stub: typeof raw.stub === "string" ? raw.stub : raw.name,
        ...(typeof raw.iriBase === "string" ? { iriBase: raw.iriBase } : {}),
        needs: Array.isArray(raw.needs) ? raw.needs.filter((n): n is string => typeof n === "string") : undefined,
        prefixes: parsed?.success ? parsed.data : {},
        contextPath,
        declaresContext:
          Array.isArray(raw.builtAtPublish) &&
          raw.builtAtPublish.some((e) => typeof e === "object" && e !== null && (e as { path?: unknown }).path === contextPath),
        ...(parsed && !parsed.success
          ? { prefixError: `${relative(repoRoot, join(root, file))}: jsonldPrefixes — ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` }
          : {}),
      },
    ];
  });
}

/**
 * A layer's own namespace, if it has one: the own-prefix table first
 * (`ownPrefixTable`: the harness's stub spellings — it is how `bootstrap`
 * reaches `cat-bootstrap`'s namespace — and the content layer's, derived from
 * its declaration since folio-assistant#2598), then the `own-namespaces` code
 * list by code.
 */
export function defaultOwnNamespace(stub: string): string | undefined {
  const known = ownPrefixTable()[stub];
  if (known !== undefined) return known;
  try {
    return ownNamespace(stub);
  } catch {
    return undefined;
  }
}

export interface InstanceReport extends InstanceContext {
  instance: string;
  /** Repo-relative path of the generated context. */
  path: string;
  /** Documents read for this layer. Zero means no context is written. */
  documents: number;
  /** Documents that did not parse — `kg:schema:check`'s finding, counted here so a skipped file is visible. */
  unparseable: string[];
  /** The tables, in the dependency order they were flattened in. */
  flattenedFrom: string[];
  prefixError?: string;
  /** The file to write: `undefined` when the layer has no documents and does not declare its context built at publish. */
  expected: string | undefined;
  /** What is on disk now, `undefined` when absent. */
  current: string | undefined;
}

export interface GenerateOptions {
  ownNamespaceOf?: (stub: string) => string | undefined;
  /** Readable remote contexts, for aliases and for documents' own bindings. Defaults to the platform's. */
  remoteContexts?: ReadonlyMap<string, Record<string, unknown>>;
  /** Remote contexts whose prefixes count as the DOCUMENT's own binding — third-party contexts only. */
  bindingContexts?: ReadonlyMap<string, Record<string, unknown>>;
  /** Remote contexts whose TERMS an instance context carries, with their owning layer. Defaults to the platform's. */
  termSources?: ReadonlyMap<string, TermSource>;
  /** Override the corpus (tests). */
  documents?: string[];
}

/** The platform's readable remote contexts, each loaded only if present. */
export function platformContexts(repoRoot: string): {
  aliases: Map<string, Record<string, unknown>>;
  bindings: Map<string, Record<string, unknown>>;
  /** The contexts an instance context stands in for — content and subgraph, both `cat-harness`'s. */
  terms: Map<string, TermSource>;
} {
  const aliases = new Map<string, Record<string, unknown>>([[CONTENT_CONTEXT_URL, CONTENT_CONTEXT as Record<string, unknown>]]);
  const bindings = new Map<string, Record<string, unknown>>();
  // Both live in cat-harness (`schemas/kg/jsonld.ts`, `ns/subgraph/v1.jsonld`):
  // the owner is a fact about where they are published, so it is named here
  // once rather than inferred from a path.
  const terms = new Map<string, TermSource>([[CONTENT_CONTEXT_URL, { instance: "cat-harness", context: CONTENT_CONTEXT as Record<string, unknown> }]]);
  // The subgraph context is the harness's own, generated beside the content
  // one: read for its term aliases, NOT as a resolver, for the same reason the
  // content context is not — both are what per-instance contexts replace.
  const subgraphUrl = CONTENT_CONTEXT_URL.replace(/ns\/content\/v1\.jsonld$/, SUBGRAPH_CONTEXT_PATH);
  const subgraphFile = join(repoRoot, "cat-harness", SUBGRAPH_CONTEXT_PATH);
  if (existsSync(subgraphFile)) {
    const subgraph = (JSON.parse(readFileSync(subgraphFile, "utf-8")) as { "@context": Record<string, unknown> })["@context"];
    aliases.set(subgraphUrl, subgraph);
    terms.set(subgraphUrl, { instance: "cat-harness", context: subgraph });
  }
  // PROV-JSONLD is a THIRD-PARTY context, held sha-pinned: what it binds, a
  // document naming it binds itself.
  try {
    const prov = (heldProvJsonldContext(repoRoot) as { "@context": Record<string, unknown> })["@context"];
    aliases.set(PROV_JSONLD_CONTEXT_URL, prov);
    bindings.set(PROV_JSONLD_CONTEXT_URL, prov);
  } catch {
    // Not held here (a fixture, or a checkout without the library copy): a
    // document naming it then reports what it cannot resolve, never a pass.
  }
  return { aliases, bindings, terms };
}

/** Innermost layer root containing `abs`. */
function ownerOf(abs: string, decls: readonly InstanceDecl[]): InstanceDecl | undefined {
  let best: InstanceDecl | undefined;
  for (const d of decls) {
    if ((abs.startsWith(d.root + sep) || abs === d.root) && (best === undefined || d.root.length > best.root.length)) best = d;
  }
  return best;
}

/** Excluded from the corpus: the generated contexts, and any context document under `ns/`. */
function isExcluded(abs: string, owner: InstanceDecl, doc: unknown): boolean {
  const rel = relative(owner.root, abs).split(sep).join("/");
  if (rel === owner.contextPath) return true;
  // declared-path-literal: `ns/` relative to ANY layer's own root (this tests every layer's context files); cat-harness's `ns/` declaration names one layer's directory, not this convention.
  return rel.startsWith("ns/") && isContextDocument(doc);
}

export function render(context: Record<string, unknown>): string {
  return `${JSON.stringify({ "@context": context }, null, 2)}\n`;
}

export interface GenerateResult {
  reports: InstanceReport[];
  /** `.jsonld` documents no layer owns — counted, never silently dropped. */
  unowned: string[];
}

export function generateInstanceContexts(repoRoot = DEFAULT_ROOT, options: GenerateOptions = {}): GenerateResult {
  const root = resolve(repoRoot);
  const decls = readInstanceDecls(root);
  const byName = new Map(decls.map((d) => [d.name, d]));
  const flat = flattenDependencies(decls.map((d) => ({ id: d.name, needs: (d.needs ?? []).filter((n) => byName.has(n)), fatal: false })));
  if (flat.problems.length > 0) {
    throw new Error(`gen-instance-contexts: the instance needs graph is broken — ${flat.problems.map((p) => p.detail).join("; ")}`);
  }
  const ancestors = ancestorsOf(flat.order);
  const order = flat.order.map((s) => s.id);
  const own = options.ownNamespaceOf ?? defaultOwnNamespace;
  const platform =
    options.remoteContexts === undefined || options.bindingContexts === undefined || options.termSources === undefined ? platformContexts(root) : undefined;
  const aliases = options.remoteContexts ?? platform!.aliases;
  const bindings = options.bindingContexts ?? platform!.bindings;
  const termSources = options.termSources ?? platform!.terms;
  // A document already switched to its layer's OWN context (cat-harness
  // `atInstanceContext`) names `<iriBase>ns/context/v1.jsonld`, not the
  // content context. Its terms are still the content context's — the layer
  // context is generated from them — so that URL reads as the content context
  // here, and the generated file stays a FIXED POINT of what it generates:
  // without this, switching the emitters would make the next run see no terms
  // and drop them all. Only with the platform defaults; a caller passing its
  // own contexts (a test) says exactly what is readable.
  if (platform !== undefined) {
    const content = CONTENT_CONTEXT as Record<string, unknown>;
    for (const d of decls) {
      if (d.iriBase === undefined) continue;
      const url = instanceContextUrl(d.iriBase);
      if (options.remoteContexts === undefined) (aliases as Map<string, Record<string, unknown>>).set(url, content);
      if (options.termSources === undefined) (termSources as Map<string, TermSource>).set(url, { instance: "cat-harness", context: content });
    }
  }

  const tableOf = (d: InstanceDecl): DeclaredPrefixes => {
    const ns = own(d.stub);
    return { instance: d.name, prefixes: { ...(ns !== undefined ? { [d.stub]: ns } : {}), ...d.prefixes } };
  };
  const tablesFor = (d: InstanceDecl): DeclaredPrefixes[] => {
    const reach = ancestors.get(d.name) ?? new Set<string>();
    return order.filter((n) => n === d.name || reach.has(n)).map((n) => tableOf(byName.get(n)!));
  };

  const perInstance = new Map<string, { docs: Map<string, { used: UsedPrefixes; own: Map<string, string>; terms: UsedTerms }>; unparseable: string[] }>();
  for (const d of decls) perInstance.set(d.name, { docs: new Map(), unparseable: [] });
  const unowned: string[] = [];
  const namespaceMaps = new Map<string, Map<string, string>>();

  for (const abs of options.documents ?? contentDocuments(root)) {
    const rel = relative(root, abs).split(sep).join("/");
    const owner = ownerOf(abs, decls);
    if (owner === undefined) {
      unowned.push(rel);
      continue;
    }
    const slot = perInstance.get(owner.name)!;
    let doc: unknown;
    try {
      doc = JSON.parse(readFileSync(abs, "utf-8"));
    } catch {
      slot.unparseable.push(rel);
      continue;
    }
    if (isExcluded(abs, owner, doc)) continue;
    let ns = namespaceMaps.get(owner.name);
    if (ns === undefined) {
      ns = new Map();
      for (const t of tablesFor(owner)) for (const [p, iri] of Object.entries(t.prefixes)) if (!ns.has(iri)) ns.set(iri, p);
      namespaceMaps.set(owner.name, ns);
    }
    const uses = documentUses(doc, { remoteContexts: aliases, namespacePrefixes: ns });
    slot.docs.set(rel, {
      used: uses.prefixes,
      own: ownBindings(doc, { remoteContexts: bindings }),
      terms: uses.terms,
    });
  }

  const reports: InstanceReport[] = order.map((name) => {
    const d = byName.get(name)!;
    const slot = perInstance.get(name)!;
    const tables = tablesFor(d);
    const built = buildInstanceContext({ instance: name, tables, documents: slot.docs, termSources });
    const out = join(d.root, d.contextPath);
    return {
      instance: name,
      ...built,
      path: relative(root, out).split(sep).join("/"),
      documents: slot.docs.size,
      unparseable: slot.unparseable.sort(),
      flattenedFrom: tables.map((t) => t.instance),
      ...(d.prefixError !== undefined ? { prefixError: d.prefixError } : {}),
      expected: slot.docs.size === 0 && !d.declaresContext ? undefined : render(built.context),
      current: existsSync(out) ? readFileSync(out, "utf-8") : undefined,
    };
  });
  return { reports, unowned: unowned.sort() };
}

/**
 * Every failing finding, one line each, naming file and prefix: `drift` (the
 * file on disk is not what would be written) and `problems` (what writing
 * cannot fix). Both empty means `--check` passes.
 */
export function findings(result: GenerateResult): { drift: string[]; problems: string[] } {
  const drift: string[] = [];
  const out: string[] = [];
  for (const r of result.reports) {
    if (r.prefixError !== undefined) out.push(`${r.instance}: malformed ${r.prefixError}`);
    // A context that is ABSENT is not drift: it is built at publish
    // (`builtAtPublish`, writer `jsonld:contexts`) and never committed, so a
    // fresh checkout has none, and `publish-check jsonld:contexts` runs this
    // check after the writer has built it. Only a file that IS on disk and
    // differs from what would be written is drift.
    if (r.current !== undefined && r.current !== r.expected) {
      drift.push(
        r.expected === undefined
          ? `${r.path}: present, but ${r.instance} has no .jsonld documents — remove it`
          : `${r.path}: stale — run gen-instance-contexts`,
      );
    }
    for (const u of r.unresolved) {
      out.push(`${u.documents[0]}: prefix \`${u.prefix}\` is used (${u.positions.join("+")}) and bound by neither ${r.instance}'s flattened table nor the document (${u.documents.length} document(s))`);
    }
    for (const c of r.conflicts) {
      out.push(`${r.instance}: prefix \`${c.prefix}\` is bound differently by ${c.bindings.map((b) => `${b.instance} → ${b.iri}`).join(" and ")}`);
    }
    for (const t of r.termConflicts) {
      const docs = t.definitions.flatMap((d) => d.documents);
      out.push(`${docs[0] ?? r.instance}: term \`${t.term}\` — ${t.reason} (${docs.length} document(s)); left out of ${r.instance}'s context`);
    }
    for (const t of r.unresolvedTerms) {
      out.push(`${t.documents[0]}: term \`${t.term}\` from ${t.context} — ${t.reason} (${t.documents.length} document(s)); left out of ${r.instance}'s context`);
    }
  }
  return { drift, problems: out };
}

function main(argv: readonly string[]): number {
  const at = argv.indexOf("--root");
  const repoRoot = at === -1 ? DEFAULT_ROOT : resolve(argv[at + 1] ?? ".");
  const result = generateInstanceContexts(repoRoot);
  const total = result.reports.reduce((n, r) => n + r.documents, 0);

  if (argv.includes("--json")) {
    const strip = result.reports.map(({ expected: _e, current: _c, ...r }) => r);
    console.log(JSON.stringify({ reports: strip, unowned: result.unowned }, null, 2));
  } else {
    console.log(`gen-instance-contexts — ${result.reports.length} instance(s), ${total} document(s)`);
    for (const r of result.reports) {
      const bound = r.bound.map((b) => `${b.prefix}(${b.documents})`).join(" ") || "—";
      console.log(`  ${r.instance.padEnd(22)} ${String(r.documents).padStart(5)} doc(s)  flattened: ${r.flattenedFrom.join(" → ")}`);
      console.log(`  ${"".padEnd(22)}       bound: ${bound}`);
      if (r.terms.length > 0) console.log(`  ${"".padEnd(22)}       terms: ${r.terms.length} (${r.terms.map((t) => t.term).join(" ")})`);
      for (const l of r.literalOnly) console.log(`  ${"".padEnd(22)}       · literal only, unbound: ${l.prefix} ×${l.documents.length} e.g. ${l.documents[0]}`);
      if (r.unparseable.length > 0) console.log(`  ${"".padEnd(22)}       ? ${r.unparseable.length} unparseable, e.g. ${r.unparseable[0]}`);
    }
    if (result.unowned.length > 0) console.log(`  ? ${result.unowned.length} document(s) belong to no instance, e.g. ${result.unowned[0]}`);
  }

  if (total === 0) {
    console.error("::error::gen-instance-contexts: no .jsonld documents read — a clean run over nothing is not clean");
    return 1;
  }

  if (argv.includes("--check")) {
    const { drift, problems } = findings(result);
    const f = [...drift, ...problems];
    if (f.length === 0) {
      console.log("✓ every instance context is current, and every prefix used in an IRI position and every term used resolves");
      return 0;
    }
    for (const l of f) console.error(`  ✗ ${l}`);
    return 1;
  }
  if (argv.includes("--json")) return 0;

  // Write mode writes what it can and still exits 1 on a problem it cannot
  // fix: a context that leaves out an unresolved or conflicted prefix is
  // written WITHOUT it, and saying nothing would make that a quiet loss.
  const blocking = findings(result).problems;
  for (const r of result.reports) {
    const out = join(repoRoot, r.path);
    if (r.expected === undefined) continue;
    if (r.current === r.expected) continue;
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, r.expected);
    console.log(`wrote: ${r.path}`);
  }
  for (const l of blocking) console.error(`  ✗ ${l}`);
  return blocking.length > 0 ? 1 : 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
