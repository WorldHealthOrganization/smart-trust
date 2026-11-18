/**
 * The glossary/ page, and the SKOS JSON-LD behind it.
 *
 * Owner, 2026-09-23: *"it should be part of general pracice w/ glossary/ page.
 * check harnesses"*, and *"put glossary into folio-assistant-core"*. So this is
 * core's, and it reads every layer in the repository rather than one:
 *
 * - every `glossary` directory (core's kind): each `*.glossary.json`, validated
 *   as `folio-glossary/v1`, becomes SKOS JSON-LD at
 *   `docs/assets/glossary/<instance>--<scheme>.skos.jsonld` and rows on the page,
 *   where `<instance>` is the layer that OWNS the scheme's sources
 *   ({@link schemeOwner}), not the one declaring the directory;
 * - every `swimlane-glossary` directory (the harness's ledger): counted and
 *   linked to the page that already renders it, never copied, because a
 *   second rendering of the same terms is a second answer free to drift;
 * - every `remoteGraphs` entry with `graphTypologies: ["glossary"]`: an external
 *   SKOS scheme, listed with its link. Referenced, never held;
 * - every KG asset with a title and a description (skills, Tools, BPMN
 *   activities, DMN decisions, documented schema fields), extracted by
 *   `glossary-extract.ts` into one `candidate` scheme per asset type per
 *   layer (bean `lqo9`, piece 1 as posed). Those schemes are GENERATED:
 *   written under core's glossary directory at
 *   `generated/<instance>/<type>.glossary.json`, beside the authored files and
 *   never over them, and the page shows them apart from authored terms.
 *
 * ## Why this, and not a `auto-docs` type
 *
 * The owner framed piece 1 as one `auto-docs` auto-doc-type
 * (`cat-harness/auto-docs/glossary/<path>`), and `gen-auto-docs.ts` has that
 * mechanism. It does not fit what was asked on 2026-09-23 (*"everything
 * extracted to glosasay / skos?"*): a auto-docs type returns `AutoDocItem[]`,
 * one row per artefact FILE for one sub-graph page, and emits no SKOS. The
 * extracted terms are per ELEMENT (one diagram holds dozens of activities),
 * need IRIs in the owning layer's namespace, and must land in the SKOS
 * this page already publishes. `index/skills` and `index/processes` already
 * list the same artefacts per sub-graph, so a auto-docs glossary type over
 * them would be a third rendering. The existing auto-docs `glossary` type
 * stays what it is: the swimlane ledger per sub-graph, linked from here.
 *
 * ## One index, one page per asset type
 *
 * Owner, 2026-09-24: *"Split per asset type"*. Extraction took the one page
 * from 9 KB to 1.4 MB. `glossary/` is now the index (authored terms, counts,
 * sources, and a link to every asset type's page) and `glossary/<type>/`
 * holds that type's extracted candidates from every layer. A term is on
 * exactly one page, and each page has a size budget ({@link PAGE_BUDGET})
 * that it states and `--check` enforces. The SKOS files are unchanged.
 *
 * `--check` writes nothing and fails when a document does not validate, the
 * committed output is stale, or a page is over its budget. That is
 * `check:glossary`, and it is a gate.
 *
 * Search: the page carries a filter box over its own terms, and the site's
 * search indexes the page like any other. A cross-layer search index is
 * bean `4pm8`'s and not built here.
 *
 * Usage:  bun run folio-assistant-core/scripts/glossary-page.ts [--check]
 *
 * @module folio-assistant-core/scripts/glossary-page
 * @covers glossary, swimlane-glossary, docs — it reads every layer's glossary
 *   directory and links the harness's ledger without copying it
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import {
  instanceDirectoryForGraph,
  instanceRootsIn,
  readDeclaration,
  resolveDirectories,
  forgeLocation,
} from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.ts";
import { scopeLabel, siteScopeArg } from "./lib/site-scope.ts";
import { withInlineCode } from "@litlfred/cat-harness-tools/schemas/content/inline-code.ts";
import { instanceNamespace } from "@litlfred/cat-harness-tools/schemas/kg/instance-repositories.ts";
import { GlossarySchema, schemeIri, toSkos, termIri, type AutomatedMatch, type Glossary, type LangText } from "../schemas/glossary.ts";
import { addressBook } from "@litlfred/cat-harness-tools/schemas/kg/prov-jsonld.ts";
import { ASSET_TYPES, EXTRACTED_PREFIX, assetTypeTitle, assetTypeWhat, extract, type AssetType } from "./glossary-extract.ts";
import { perScheme, run as runTermMapping, termState, type SchemeState, type TermStateAnswer } from "@litlfred/cat-harness-tools/scripts/check-term-mapping.ts";
import { MAPPING_TARGETS } from "@litlfred/cat-harness-tools/schemas/content/term-mapping.ts";
import { GLOSSARY_SUBDIR, allTranslationDirs, potPath, sourceText, templateName } from "./glossary-pot.ts";
import { archimateDepictions, type Depiction } from "./glossary-archimate.ts";
import type { Passage } from "./term-passages.ts";
import { parsePo } from "@litlfred/cat-harness-tools/pipeline/po-inject.ts";
import { forwardingParts, pageParts, visualiserFor, visualiserPageDir } from "@litlfred/cat-harness-tools/scripts/viewer-declarations.ts";
import { ROUTE_SEGMENT, visualiserRoute, type VisualiserRouteParts } from "@litlfred/cat-harness-tools/schemas/kg/visualiser-route.ts";
import { siteArg, siteTarget } from "@litlfred/cat-harness-tools/scripts/lib/site-target.ts";
import { mountedInstances, outputTwinOf, readPathAt } from "@litlfred/cat-harness-tools/scripts/lib/layer-output.ts";
import { detectRepoUrl, ownerRepo } from "@litlfred/cat-harness-tools/src/core/git-refs.js";
import {
  ownerOfPath as sharedOwnerOfPath,
  repoPathOf as sharedRepoPathOf,
  schemeOwner as sharedSchemeOwner,
  type InstanceRoot,
  type OwnedScheme,
} from "@litlfred/cat-harness-tools/scripts/lib/scheme-owner.ts";

import { checkoutRootFor } from "./lib/checkout-root.ts";

const CORE = resolve(import.meta.dir, "..");
const REPO = checkoutRootFor(CORE);
// declared-path-literal: the platform site the page publishes to, which is
// cat-harness's `docs/`; core owns the page, the harness owns the site.
// `--site <dir>`: a site being built (a repository's own, `visualiser-writers.ts`)
// gets the same route under it; its harness docs are a pinned mount.
const SITE = siteTarget(join(REPO, "cat-harness", "docs"));
/**
 * With `--site`, only what lies under that site is written: the extracted
 * schemes under core's `glossary/generated/` are committed graph content, and
 * a site build must leave a pinned mount as its lock pins it.
 */
const INTO_SITE = siteArg() !== undefined;
/**
 * `--instance <name>` (with `--site`): write only that layer's page and its
 * schemes' SKOS. A repository's own site carries its glossary this way, at the
 * same route the platform site gives it, without the platform's other pages
 * (cat-harness-tools#1038: dth-hrh's handbook glossary). Links to pages the
 * site does not carry are left as text, so the publish link check passes.
 */
export const ONLY: string | undefined = (() => {
  // Only this script's own command line: a script that imports it (such as
  // glossary-validate.ts) has its own --instance flag, meaning something else.
  if (!import.meta.main) return undefined;
  const i = process.argv.indexOf("--instance");
  return i > 0 ? process.argv[i + 1] : undefined;
})();
if (ONLY !== undefined && !INTO_SITE) {
  console.error("glossary-page.ts: --instance needs --site <dir>");
  process.exit(2);
}
/**
 * The directories of the layers this checkout MOUNTS (its `index.lock.json`),
 * absolute. A mounted layer is read-only here (bean `cat-tools-sm8r`, item 4,
 * plan step 3; owner, 2026-11-13, "own layers only"): its extracted schemes
 * are committed in its own repository at its pin, so this run neither
 * rewrites nor deletes them, and `--check` does not judge them.
 */
const MOUNTS: readonly string[] = [...mountedInstances(REPO).values()].map((p) => resolve(REPO, p)).filter((d) => d !== resolve(REPO));
/** Whether `p` lies inside a mounted layer. */
export function inMount(p: string, mounts: readonly string[] = MOUNTS): boolean {
  const at = resolve(p);
  return mounts.some((d) => at === d || at.startsWith(d + sep));
}
/** Whether `p` is an extracted scheme this run must leave alone: one in a `glossary/generated/` directory inside a mount. */
export function isMountedScheme(p: string, generated: readonly string[], mounts: readonly string[] = MOUNTS): boolean {
  return inMount(p, mounts) && generated.some((g) => resolve(p).startsWith(resolve(g) + sep));
}
const ownSchemes = (files: Map<string, string>): Map<string, string> => {
  const generated = allGeneratedDirs();
  return new Map([...files].filter(([p]) => !isMountedScheme(p, generated)));
};
/**
 * Whether a `--site` run writes `p`. With `--instance`, that layer's page,
 * its term pages beside it (`termPagePath`, one directory per scheme under
 * the page's own directory) and its schemes' SKOS. Leaving the term pages out
 * left every "Term page" link on the instance page, and every term link in
 * the document (`glossary-term-links.ts`), a 404 on a repository's own site.
 */
export function writesIntoSite(p: string, at: { site: string; assets: string; page?: string; only?: string }): boolean {
  if (!p.startsWith(`${at.site}${sep}`)) return false;
  if (at.only === undefined || at.page === undefined) return true;
  return (
    p === at.page ||
    p.startsWith(`${dirname(at.page)}${sep}`) ||
    (p.startsWith(`${at.assets}${sep}`) && p.slice(at.assets.length + 1).startsWith(`${at.only}--`))
  );
}
const written = (files: Map<string, string>): Map<string, string> => {
  if (!INTO_SITE) return ownSchemes(files);
  const at = { site: SITE, assets: ASSETS, only: ONLY, page: ONLY === undefined ? undefined : pagePath(`@${ONLY}`) };
  return new Map([...files].filter(([p]) => writesIntoSite(p, at)));
};
/**
 * The visualiser core DECLARES for its glossary — `folio-assistant-core/glossary`
 * in `folio-assistant-core.json` `visualisers` (owner, 2026-10-09: *"Need
 * harness to declare visualizer is renderedBy"*) — as route parts, never
 * spelled here. The page used to sit at `/glossary/`, a URL nothing derived;
 * that is now the declared ALIAS, composed as a redirect.
 */
const PARTS: VisualiserRouteParts = (() => {
  try {
    const v = visualiserFor(CORE, "glossary-page");
    return { harness: v.harness, visualiser: v.id };
  } catch {
    return { harness: "folio-assistant-core", visualiser: "glossary" };
  }
})();
/**
 * The English page's ROUTE, under the page locale like every other
 * visualiser (`pageParts`): `en/folio-assistant-core/glossary` (owner,
 * 2026-10-16, "c"). It was written without the `en/` until then; that old
 * address, {@link LEGACY_ROUTE}, now holds only the forwarding pages
 * `compose-docs.ts` writes for every visualiser, and `site-coverage`
 * accepts it as `legacyRoute`.
 */
export const ROUTE = visualiserRoute(pageParts(PARTS)).replace(/\/$/, "");
/** The address the English page had before the locale segment: `folio-assistant-core/glossary`. */
export const LEGACY_ROUTE = visualiserRoute(forwardingParts(PARTS)).replace(/\/$/, "");
const PAGE = join(visualiserPageDir(SITE, pageParts(PARTS)), "index.md");
/** A route of this viewer on the host site is never committed: everything in it, this file included, is written at publish. */
export const ROUTE_IGNORE = `# Generated by ${"folio-assistant-core/scripts/glossary-page.ts"}: this viewer route is built at publish, never committed (bean folio-assistant-uldr).\n*\n`;
const ASSETS = join(SITE, "assets", "glossary");
/**
 * Where extracted schemes are written by default: `generated/` inside core's
 * own `glossary` directory, the convention `schemas/generated/` set. Resolved
 * from the declaration, never spelled as a path.
 */
function generatedDir(): string {
  const dir = instanceDirectoryForGraph(CORE, "glossary");
  if (dir === undefined) throw new Error("folio-assistant-core declares no glossary directory to write extracted schemes into");
  return join(dir, "generated");
}
/**
 * Where a layer's extracted schemes are written: `generated/` inside the
 * layer's own declared `glossary` directory when it holds `generated/` (or
 * core's `glossary/generated/` does not host `<instance>/`), else core's
 * `glossary/generated/`. Resolved from the declarations, never by naming a
 * higher layer's path here (bean rfev, owner 2026-10-20).
 */
function generatedDirFor(instance: string, repo: string = REPO): string {
  const coreGen = generatedDir();
  const root = instanceRootsIn(repo).find((r) => readDeclaration(r)?.name === instance);
  if (root !== undefined) {
    const own = instanceDirectoryForGraph(root, "glossary");
    if (own !== undefined && (existsSync(join(own, "generated")) || !existsSync(join(coreGen, instance)))) {
      return join(own, "generated");
    }
  }
  return coreGen;
}
/** Every `glossary/generated/` directory this generator owns across the checkout. */
function allGeneratedDirs(repo: string = REPO): string[] {
  const out = new Set<string>([generatedDir()]);
  for (const root of instanceRootsIn(repo)) {
    const own = instanceDirectoryForGraph(root, "glossary");
    if (own !== undefined && existsSync(join(own, "generated"))) out.add(join(own, "generated"));
  }
  return [...out];
}
/**
 * Where a reader follows a `source` to. The forge the repository is published
 * on; the same base `gen-auto-docs.ts` links with. Writing into a repository's
 * own site (`--site`), it is that repository's: `GITHUB_REPOSITORY` in CI,
 * else the checkout's `origin`, as `build-document-site.ts` finds it, so a
 * folio's sources do not link into the platform's repository.
 */
const FORGE = (() => {
  const platform = "https://github.com/litlfred/folio-assistant";
  if (!INTO_SITE) return platform;
  const origin = detectRepoUrl(REPO);
  const repo = process.env.GITHUB_REPOSITORY ?? (origin?.includes("github.com") ? ownerRepo(origin) : undefined);
  return repo ? `https://github.com/${repo}` : platform;
})();
/** A file's page on the forge — in its submodule's own repository when it sits in one. */
const blobUrl = (path: string): string => {
  const at = forgeLocation(path, FORGE);
  return `${at.repoUrl}/blob/main/${at.path}`;
};

export interface GlossarySource {
  /**
   * The layer that OWNS the scheme: the one whose root holds its source
   * assets, which is not always the one whose `glossary` directory holds the
   * file (owner, 2026-09-24; see {@link schemeOwner}).
   */
  instance: string;
  ns: string;
  file: string;
  glossary: Glossary;
  /** The layer whose declared `glossary` directory holds the file. Absent for an extracted scheme. */
  declaredBy?: string;
  /** Set for a scheme `glossary-extract.ts` generated: which asset type it holds. */
  extracted?: AssetType;
}
export interface Findings {
  invalid: string[];
}

/**
 * The layer's namespace: bean `lqo9` puts a term's IRI there, never in the
 * asset. The rule is `instanceNamespace` (`schemas/instance-repositories.ts`),
 * shared with the `owner/repo → IRI` map so the two cannot disagree (bean `6rmv`).
 */
export function instanceNs(name: string, stub?: string, decl?: { iriBase?: string; version?: string }): string {
  return instanceNamespace({ name, stub, iriBase: decl?.iriBase, version: decl?.version });
}

// ── Who owns a term ─────────────────────────────────────────────
//
// Owner, 2026-09-24: *"make sure all glossary terms properly localed to ihris
// so [no] collision w/ other subgraphs. general rule/skill"*. A scheme and its
// terms live in the namespace of the layer that owns the SOURCE ASSET: in a
// folio with sub-layers that is the sub-layer, never the root, even when
// the `glossary/` directory is declared at the root. `glossary-extract.ts`
// already mints extracted terms that way; this is the same rule for authored
// schemes, checked by `glossary.test.ts` for both.

/**
 * A term or scheme `source` that names a file or directory in the repository,
 * without its anchor. `undefined` for an IRI, and for prose: a scheme's
 * `source` is dcterms:source, which may be a sentence ("Skills of
 * cat-harness"), and a sentence is held by no layer.
 */
export function repoPathOf(src: string | undefined, repo: string = REPO): string | undefined {
  return sharedRepoPathOf(src, repo);
}

/** Every layer root, longest first, so a path resolves to the MOST specific layer holding it. The repository root's layer comes last. */
export function instanceOwners(repo: string = REPO): Array<{ root: string; name: string; ns: string }> {
  const out: Array<{ root: string; name: string; ns: string }> = [];
  for (const root of instanceRootsIn(repo)) {
    const decl = readDeclaration(root);
    if (decl) out.push({ root: resolve(root), name: decl.name, ns: instanceNs(decl.name, decl.stub, decl) });
  }
  return out.sort((a, b) => b.root.length - a.root.length);
}

/** The layer whose root holds a repository path. */
export function ownerOfPath(repo: string, path: string, owners: readonly InstanceRoot[] = instanceOwners(repo)): string | undefined {
  return sharedOwnerOfPath(repo, path, owners);
}

/**
 * The layer that owns a scheme: `cat-harness-tools/scripts/lib/scheme-owner.ts`,
 * the one rule the term-mapping record keys by too (bean `q3n9`, owner ruling
 * A, 2026-10-24). Re-exported here, with this checkout's layers as the
 * default, for the callers that already import it from the page.
 */
export function schemeOwner(
  repo: string,
  g: OwnedScheme,
  declaredBy: string,
  owners: readonly InstanceRoot[] = instanceOwners(repo),
): { owner: string } | { error: string } {
  return sharedSchemeOwner(repo, g, declaredBy, owners);
}

/**
 * The terms a schema DEFINES, as an ordered glossary — or `undefined` when it
 * defines none.
 *
 * A schema defines terms when its `$defs` entries carry `uses`: the authored,
 * ordered relation bootstrap's `graph.schema.json` publishes (terms v3, owner
 * 2026-09-29). Read here, from the published schema, rather than copied into
 * a glossary file: one text, one place, and the glossary cannot drift from it.
 *
 * `authored`, not `candidate`, and that is not an extractor promoting its own
 * output: the text is a definition a person wrote and approved in the schema's
 * source, and this only reads it out. The order is kept (`ordered`) because
 * the owner asked for logical rather than alphabetical order — each term is
 * defined only by terms above it.
 */
/**
 * The concepts a layer's declared VOCABULARY already mints, by local name:
 * `Node` → `<ns>Node`. Read from the asset whose `role` is `vocabulary`
 * (bootstrap's `ns.jsonld`), each `@id` expanded through that file's own
 * `@context`. Empty when the layer declares none, or it cannot be read —
 * the glossary then mints its own IRIs, as before.
 */
export function vocabularyConcepts(root: string, decl: { assets?: unknown }): Map<string, string> {
  const out = new Map<string, string>();
  const assets = Array.isArray(decl.assets) ? (decl.assets as Array<{ role?: unknown; src?: unknown }>) : [];
  const vocab = assets.find((a) => a.role === "vocabulary" && typeof a.src === "string");
  if (!vocab) return out;
  let doc: { "@context"?: Record<string, unknown>; "@graph"?: Array<{ "@id"?: unknown }> };
  try {
    doc = JSON.parse(readFileSync(join(root, vocab.src as string), "utf-8"));
  } catch {
    return out;
  }
  const ctx = doc["@context"] ?? {};
  for (const n of doc["@graph"] ?? []) {
    const id = typeof n["@id"] === "string" ? n["@id"] : undefined;
    const m = id ? /^([A-Za-z][\w.-]*):([A-Za-z][\w]*)$/.exec(id) : null;
    const base = m ? ctx[m[1]!] : undefined;
    if (m && typeof base === "string") out.set(m[2]!, `${base}${m[2]}`);
  }
  return out;
}

export function termsOfSchema(
  abs: string,
  rel: string,
  decl: { name: string; title?: string; version?: string },
  concepts: ReadonlyMap<string, string> = new Map(),
): Glossary | undefined {
  let doc: { $id?: string; subject?: unknown; $defs?: Record<string, { description?: string; uses?: unknown; isDefinedBy?: unknown }> };
  try {
    doc = JSON.parse(readFileSync(abs, "utf-8"));
  } catch {
    return undefined;
  }
  const defs = Object.entries(doc.$defs ?? {});
  if (!defs.some(([, v]) => Array.isArray(v.uses))) return undefined;
  const id = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  const label = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2");
  const absolute = (iri: unknown): string | undefined => {
    if (typeof iri !== "string") return undefined;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(iri)) return iri;
    return doc.$id && iri.startsWith("#") ? `${doc.$id}${iri === "#" ? "" : iri}` : undefined;
  };
  return {
    $schema: "folio-glossary/v1",
    id: "terms",
    title: `${decl.title ?? decl.name} terms`,
    description:
      `The terms ${decl.title ?? decl.name} defines, in order: each is defined only by terms above it, and never itself. ` +
      `Read from the schema that defines them, ${rel}, so this glossary cannot say anything that schema does not.`,
    ...(decl.version ? { hasVersion: decl.version } : {}),
    source: rel,
    // The subject area the schema publishes beside its terms (bootstrap's
    // `graph.schema.json`: `harness-vocabulary`), read as data, never assumed
    // here (owner, 2026-11-07: "do it in the schema"). A schema that publishes
    // none leaves its terms bound to their own scheme.
    ...(typeof doc.subject === "string" ? { subject: doc.subject } : {}),
    ordered: true,
    terms: defs.map(([key, v]) => ({
      id: id(key),
      prefLabel: label(key),
      ...(v.description ? { definition: v.description } : {}),
      ...(Array.isArray(v.uses) && v.uses.length ? { requires: (v.uses as string[]).map(id) } : {}),
      ...(absolute(v.isDefinedBy) ? { isDefinedBy: absolute(v.isDefinedBy)! } : {}),
      // The vocabulary's own IRI when it defines this term, so there is one
      // concept per term (owner, 2026-09-30, "one SKOS", option A).
      ...(concepts.has(key.replace(/\s+/g, "")) ? { iri: concepts.get(key.replace(/\s+/g, ""))! } : {}),
      source: `${rel}#/$defs/${key}`,
      status: "authored" as const,
    })),
  };
}

/** Every glossary document, swimlane ledger and external scheme in the repository. */
export function collect(repo: string = REPO): {
  glossaries: GlossarySource[];
  ledgers: { instance: string; path: string; terms: number }[];
  external: { instance: string; id: string; url: string; title?: string }[];
  /**
   * Every layer that DECLARES a `glossary` directory of its own, whether or
   * not it holds an authored scheme yet. Each gets its own page (owner,
   * 2026-10-15, "3a"), because the layer's Glossary tile opens it.
   */
  declaring: string[];
  findings: Findings;
} {
  const glossaries: GlossarySource[] = [];
  const ledgers: { instance: string; path: string; terms: number }[] = [];
  const external: { instance: string; id: string; url: string; title?: string }[] = [];
  const findings: Findings = { invalid: [] };
  const declaring = new Set<string>();
  const owners = instanceOwners(repo);
  const nsOf = new Map(owners.map((o) => [o.name, o.ns] as const));
  // No two layers may resolve to one namespace: every IRI minted in it
  // would be ambiguous about which sub-graph it belongs to.
  const byNs = new Map<string, string[]>();
  for (const o of owners) byNs.set(o.ns, [...(byNs.get(o.ns) ?? []), o.name]);
  for (const [ns, names] of byNs) {
    if (names.length > 1) findings.invalid.push(`namespace collision: ${names.sort().join(", ")} all resolve to ${ns}`);
  }
  for (const root of instanceRootsIn(repo)) {
    const decl = readDeclaration(root);
    if (!decl) continue;
    const dirs = resolveDirectories([{ name: decl.name, root, own: true }]).filter((d) => d.own);
    for (const d of dirs) {
      if (!existsSync(d.absPath)) continue;
      const kinds = d.graphTypologies ?? [];
      if (kinds.includes("glossary")) {
        declaring.add(decl.name);
        for (const f of readdirSync(d.absPath).filter((f) => f.endsWith(".glossary.json")).sort()) {
          const p = join(d.absPath, f);
          const rel = relative(repo, p).split("\\").join("/");
          let raw: unknown;
          try {
            raw = JSON.parse(readFileSync(p, "utf-8"));
          } catch (e) {
            findings.invalid.push(`${rel}: not valid JSON (${e instanceof Error ? e.message : String(e)})`);
            continue;
          }
          const r = GlossarySchema.safeParse(raw);
          if (!r.success) {
            findings.invalid.push(`${rel}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
            continue;
          }
          if (r.data.id.startsWith(EXTRACTED_PREFIX)) {
            findings.invalid.push(`${rel}: scheme id "${r.data.id}" uses the "${EXTRACTED_PREFIX}" prefix, which is reserved for extracted schemes`);
            continue;
          }
          const own = schemeOwner(repo, r.data, decl.name, owners);
          if ("error" in own) {
            findings.invalid.push(`${rel}: scheme "${r.data.id}" has no one owning instance: ${own.error}`);
            continue;
          }
          glossaries.push({ instance: own.owner, ns: nsOf.get(own.owner)!, file: rel, glossary: r.data, declaredBy: decl.name });
        }
      }
      if (kinds.includes("schemas")) {
        for (const f of readdirSync(d.absPath).filter((f) => f.endsWith(".schema.json")).sort()) {
          const p = join(d.absPath, f);
          const rel = relative(repo, p).split("\\").join("/");
          const g = termsOfSchema(p, rel, decl, vocabularyConcepts(root, decl));
          if (!g) continue;
          const r = GlossarySchema.safeParse(g);
          if (!r.success) {
            findings.invalid.push(`${rel}: its terms do not form a glossary: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
            continue;
          }
          const owner = ownerOfPath(repo, rel, owners) ?? decl.name;
          glossaries.push({ instance: owner, ns: nsOf.get(owner)!, file: rel, glossary: r.data, declaredBy: decl.name });
        }
      }
      if (kinds.includes("swimlane-glossary")) {
        // The directory's own ledger, and any it HOSTS one level down under a
        // guest's stub (`cat-harness/glossary/bootstrap/` since 2026-09-30,
        // bean `xsqm`). Each file names its `instance`, so a hosted ledger is
        // credited to its subject, not to the directory's declarer.
        const found = [join(d.absPath, "glossary-ledger.json")];
        if (existsSync(d.absPath)) {
          for (const e of readdirSync(d.absPath, { withFileTypes: true })) {
            if (e.isDirectory()) found.push(join(d.absPath, e.name, "glossary-ledger.json"));
          }
        }
        for (const ledger of found.filter((f) => existsSync(f))) {
          const l = JSON.parse(readFileSync(ledger, "utf-8")) as { instance?: string; concepts?: Record<string, unknown> };
          ledgers.push({ instance: l.instance ?? decl.name, path: relative(repo, ledger), terms: Object.keys(l.concepts ?? {}).length });
        }
      }
    }
    for (const g of decl.remoteGraphs ?? []) {
      if (g.graphTypologies.includes("glossary")) external.push({ instance: decl.name, id: g.id, url: g.url, title: g.title });
    }
  }
  // Extracted schemes, in the OWNING layer's namespace. Derived here on
  // every run rather than read back from the committed files, so the page,
  // the SKOS and the scheme files are one derivation and `--check` compares
  // all three against it.
  const ex = extract(repo);
  findings.invalid.push(...ex.collisions.map((c) => `extracted IRI collision: ${c}`));
  for (const s of ex.schemes) {
    const gen = relative(repo, generatedDirFor(s.instance, repo)).split("\\").join("/");
    glossaries.push({
      instance: s.instance,
      ns: nsOf.get(s.instance) ?? instanceNs(s.instance),
      file: `${gen}/${s.instance}/${s.glossary.id}.glossary.json`,
      glossary: s.glossary,
      extracted: s.type,
    });
  }
  // No two schemes, in any layer, may mint one scheme IRI.
  const bySchemeIri = new Map<string, string[]>();
  for (const s of glossaries) {
    const iri = schemeIri(s.ns, s.glossary);
    bySchemeIri.set(iri, [...(bySchemeIri.get(iri) ?? []), s.file]);
  }
  for (const [iri, files] of bySchemeIri) {
    if (files.length > 1) findings.invalid.push(`scheme IRI collision: ${files.join(", ")} all mint ${iri}`);
  }
  return { glossaries, ledgers, external, declaring: [...declaring].sort(), findings };
}

// `{` too: the page is Jekyll source, and a `{{` or `{%` in an extracted
// description would be read as Liquid and break the site build.
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/{/g, "&#123;");
const first = (t: LangText): string => (typeof t === "string" ? t : (t.en ?? Object.values(t)[0]!));

/** The asset file a scheme's SKOS is published at, under the site. */
export function skosAsset(s: GlossarySource): string {
  return `assets/glossary/${s.instance}--${s.glossary.id}.skos.jsonld`;
}


/** The generated scheme file an extracted scheme is written to. */
export function extractedFile(s: GlossarySource): string {
  return join(generatedDirFor(s.instance), s.instance, `${s.glossary.id}.glossary.json`);
}

/** Terms by state, for the page's counts. `extracted` is every term of an extracted scheme. */
export function counts(c: ReturnType<typeof collect>): { authored: number; extracted: number; couldNotExtract: number; candidate: number } {
  const all = c.glossaries.flatMap((s) => s.glossary.terms.map((t) => ({ s, t })));
  return {
    authored: all.filter(({ t }) => t.status === "authored").length,
    extracted: all.filter(({ s }) => s.extracted).length,
    candidate: all.filter(({ t }) => t.status === "candidate").length,
    couldNotExtract: all.filter(({ t }) => t.status === "could-not-extract").length,
  };
}

/** A size, rounded so that stating it does not move it. */
function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// ── The pages ──────────────────────────────────────────────────
//
// Owner, 2026-09-24: *"Split per asset type"*. Extraction (bean `lqo9`) took
// the page from 9 KB to 1.4 MB in one request. So the index keeps the
// authored terms, the counts and the sources, and every extracted term moves
// to the page of its asset type. A term is on exactly one page: authored on
// the index, extracted on its type's. The SKOS files do not change.

/**
 * An asset type whose page outgrew its budget is split by the FIRST LETTER of
 * each term's label into fixed ranges, one page each.
 *
 * Measured 2026-10-02: `kg-schema-fields` was 1,042,497 bytes against its
 * 1 MiB budget on `main`, and every PR adding schema fields tipped it over.
 * Splitting by layer does not help, because one layer (cat-harness)
 * holds 1,613 of 1,841 terms. The ranges are FIXED rather than balanced, so
 * a term's URL does not move when other terms are added. The type's own URL
 * stays and becomes a landing page linking its parts.
 *
 * Measured 2026-10-30, at cat-harness-tools cbcc5b0: `s-z` was 1.0 MB and
 * over budget, refusing the smart-ra staging publish, with `a-e` (1,010,094 B)
 * and `m-r` (1,034,911 B) one PR behind it. Split again, to 7 ranges, each
 * 300-730 KB. The parts' addresses move once here; a range is never split
 * again for less than a refusal.
 */
export const LETTER_PARTS: Readonly<Partial<Record<AssetType, readonly string[]>>> = {
  "kg-schema-fields": ["a-c", "d-e", "f-l", "m-o", "p-r", "s", "t-z"],
  // Measured 2026-10-31 on dth-pc's staging build (cat-harness-tools 490ea15,
  // core 1ca59c8): `kg-bpmn-activities` was 1.1 MB, over its 1 MB budget,
  // refusing the publish. 1,140 labels: a-d 308 (with digits), e-q 327,
  // r-z 363, so each part is about 0.35 MB.
  "kg-bpmn-activities": ["a-d", "e-q", "r-z"],
};

/** A label's first letter, upper-case, or `#` for a label that starts with no letter. */
export function letterOf(label: string): string {
  const L = label.normalize("NFD")[0]!.toUpperCase();
  return /[A-Z]/.test(L) ? L : "#";
}

/** The part of a split type a label belongs to. A label with no leading letter goes to the first part. */
export function partOfLabel(type: AssetType, label: string): string {
  const parts = LETTER_PARTS[type]!;
  const L = letterOf(label).toLowerCase();
  return parts.find((r) => L >= r[0]! && L <= r[r.length - 1]!) ?? parts[0]!;
}

/** One part of a split asset type's page: `<type>/<range>`. */
export type PartKey = `${AssetType}/${string}`;
/**
 * One layer's authored terms: `@<instance>`.
 *
 * Owner, 2026-10-15 (option 1 of four): the authored terms leave the index
 * for one page per OWNING layer. The index had held every authored term
 * since 2026-09-24, and a folio's site composes its own glossary with its
 * needs': dth-hrh's three schemes (177 terms) put the index at 224 KB against
 * its 64 KB budget, so the writer refused it. The address is the owner, a
 * fact of the scheme ({@link schemeOwner}), so a term's page moves only when
 * its owner does — never because a scheme grew, which a size-triggered split
 * would do.
 */
export type AuthoredKey = `@${string}`;
/** Which page a term is on: its owning layer's for an authored scheme's, else its asset type, or a part of it. */
export type PageKey = "index" | AuthoredKey | AssetType | PartKey;
export function isAuthored(k: PageKey): k is AuthoredKey {
  return k.startsWith("@");
}
export function isPart(k: PageKey): k is PartKey {
  return !isAuthored(k) && k.includes("/");
}
function splitPart(k: PartKey): [AssetType, string] {
  const i = k.indexOf("/");
  return [k.slice(0, i) as AssetType, k.slice(i + 1)];
}
/** Every page that does not depend on what is collected: the index, then each asset type followed by its parts. A page exists for every asset type even when it holds no term, so the index can link each one. */
export const PAGE_KEYS: readonly PageKey[] = [
  "index",
  ...ASSET_TYPES.flatMap((t): PageKey[] => [t, ...(LETTER_PARTS[t] ?? []).map((r) => `${t}/${r}` as PartKey)]),
];

/**
 * One page per layer that owns an authored scheme OR declares a glossary
 * directory, by layer name. The second half is what lets every layer's
 * Glossary tile open a page of its own: the tile resolves
 * `glossary/instance/<instance>/` from the declaration, so the page must exist
 * for every layer the declaration covers, even before it authors a term.
 */
export function authoredKeys(c: Pick<ReturnType<typeof collect>, "glossaries"> & { declaring?: readonly string[] }): AuthoredKey[] {
  return [...new Set([...c.glossaries.filter((s) => !s.extracted).map((s) => s.instance), ...(c.declaring ?? [])])]
    .sort()
    .map((i) => `@${i}` as const);
}

/** Every page: the index, each layer's authored terms, then {@link PAGE_KEYS}' asset types. */
export function pageKeysOf(c: ReturnType<typeof collect>): PageKey[] {
  return ["index", ...authoredKeys(c), ...PAGE_KEYS.slice(1)];
}

/**
 * The most a page may weigh before compression, in bytes. A budget, stated on
 * the page and pinned by `glossary.test.ts`: when a page outgrows it, the
 * answer is a finer split, not a larger number.
 */
export const PAGE_BUDGET: Readonly<Record<"index" | "type", number>> = { index: 64 * 1024, type: 1024 * 1024 };
export function budgetOf(k: PageKey): number {
  return k === "index" ? PAGE_BUDGET.index : PAGE_BUDGET.type;
}

/** The URL segment of an asset type's page: its scheme id without the extracted prefix. */
export function typeSlug(t: AssetType): string {
  return t.slice(EXTRACTED_PREFIX.length);
}
export function pageOf(s: GlossarySource): PageKey {
  return s.extracted ?? `@${s.instance}`;
}
/**
 * The directory every layer's page sits under, so a layer name cannot
 * meet an asset type's slug (`skills/`, `tools/`, …). Owner, 2026-10-15
 * ("3a"): `glossary/instance/<instance>/`, the sub-graph path the glossary
 * visualiser declares (`subgraphUnder: { glossary: "instance" }` in
 * `folio-assistant-core.json`), which `viewersOf` composes into each
 * layer's tile. It was `authored/` for the same day it existed.
 */
export const AUTHORED_DIR = "instance";
export function pagePath(k: PageKey): string {
  if (k === "index") return PAGE;
  if (isAuthored(k)) return join(dirname(PAGE), AUTHORED_DIR, k.slice(1), "index.md");
  if (isPart(k)) {
    const [t, r] = splitPart(k);
    return join(dirname(PAGE), typeSlug(t), r, "index.md");
  }
  return join(dirname(PAGE), typeSlug(k), "index.md");
}
export function permalinkOf(k: PageKey): string {
  if (k === "index") return `/${ROUTE}/`;
  if (isAuthored(k)) return `/${ROUTE}/${AUTHORED_DIR}/${k.slice(1)}/`;
  if (isPart(k)) {
    const [t, r] = splitPart(k);
    return `/${ROUTE}/${typeSlug(t)}/${r}/`;
  }
  return `/${ROUTE}/${typeSlug(k)}/`;
}
export function pageTitle(k: PageKey): string {
  if (k === "index") return "Glossary";
  if (isAuthored(k)) return `Glossary: ${k.slice(1)}`;
  if (isPart(k)) {
    const [t, r] = splitPart(k);
    return `Glossary: ${assetTypeTitle(t)}, ${r.toUpperCase().replace("-", "–")}`;
  }
  return `Glossary: ${assetTypeTitle(k)}`;
}

type Row = { s: GlossarySource; t: Glossary["terms"][number]; label: string; related?: Row[] };

/** Every term by its IRI, once per collection, so a `related` IRI resolves to the term it names. */
const termsByIri = new WeakMap<readonly GlossarySource[], Map<string, Row>>();
function termIndex(glossaries: readonly GlossarySource[]): Map<string, Row> {
  let m = termsByIri.get(glossaries);
  if (!m) {
    m = new Map();
    for (const s of glossaries) for (const t of s.glossary.terms) m.set(t.iri ?? termIri(s.ns, s.glossary, t.id), { s, t, label: first(t.prefLabel) });
    termsByIri.set(glossaries, m);
  }
  return m;
}

/**
 * The terms a term's `related` names, resolved: a local id in its own scheme,
 * or an IRI of any collected term. One that names nothing collected is left
 * out here; it is still in the SKOS.
 */
function relatedRows(glossaries: readonly GlossarySource[], s: GlossarySource, t: Glossary["terms"][number]): Row[] {
  const index = termIndex(glossaries);
  return (t.related ?? [])
    .map((r) => {
      const local = s.glossary.terms.find((x) => x.id === r);
      return local ? { s, t: local, label: first(local.prefLabel) } : index.get(r);
    })
    .filter((r): r is Row => r !== undefined);
}

/** The terms on one page, sorted by label. */
export function rowsOn(c: ReturnType<typeof collect>, k: PageKey): Row[] {
  if (isPart(k)) {
    const [t, r] = splitPart(k);
    return rowsOn(c, t).filter((row) => partOfLabel(t, row.label) === r);
  }
  return c.glossaries
    .filter((s) => pageOf(s) === k)
    .flatMap((s) => s.glossary.terms.map((t) => ({ s, t, label: first(t.prefLabel), related: relatedRows(c.glossaries, s, t) })))
    .sort(
      (a, b) =>
        a.label.localeCompare(b.label, "en", { sensitivity: "base" }) ||
        (a.label < b.label ? -1 : a.label > b.label ? 1 : 0) ||
        `${a.s.instance}/${a.s.glossary.id}/${a.t.id}`.localeCompare(`${b.s.instance}/${b.s.glossary.id}/${b.t.id}`, "en"),
    );
}

const link = (u: string) => `<a href="${esc(u)}">${esc(u.replace(/^https?:\/\//, ""))}</a>`;
const sourceLink = (src: string) => {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(src)) return link(src);
  const path = src.split("#", 2)[0]!;
  return `<a href="${esc(blobUrl(path))}"><code>${esc(src)}</code></a>`;
};
const pageLink = (k: PageKey, text: string) =>
  ONLY !== undefined && k !== `@${ONLY}` ? esc(text) : `<a href="{{ '${permalinkOf(k)}' | relative_url }}">${esc(text)}</a>`;
const skosLink = (s: GlossarySource) => `<a href="{{ '/${skosAsset(s)}' | relative_url }}">SKOS</a>`;

/** A term's anchor on its page, which is also its key for a per-term mapping mark. */
export function anchorOf(s: GlossarySource, id: string): string {
  return `${s.instance}--${s.glossary.id}--${id}`;
}

/**
 * The ArchiMate elements and views that depict each term, keyed by anchor
 * (`glossary-archimate.ts`). Set once by {@link loadDepictions} before the
 * pages are rendered; empty, the entries say nothing about ArchiMate.
 */
let DEPICTIONS: ReadonlyMap<string, Depiction> = new Map();

/** Read the depictions of every authored term in `c` from the mounted ArchiMate models. */
export async function loadDepictions(repo: string, c: ReturnType<typeof collect>): Promise<ReadonlyMap<string, Depiction>> {
  const terms = c.glossaries
    .filter((s) => !s.extracted)
    .flatMap((s) =>
      s.glossary.terms.map((t) => ({ anchor: anchorOf(s, t.id), iri: t.iri ?? termIri(s.ns, s.glossary, t.id), scheme: s.glossary.id, id: t.id, label: first(t.prefLabel) })),
    );
  DEPICTIONS = await archimateDepictions(repo, terms);
  return DEPICTIONS;
}

/** One entry's "Depicted in ArchiMate" line, or nothing. */
function depictionLine(anchor: string): string[] {
  const d = DEPICTIONS.get(anchor);
  if (!d) return [];
  const a = (x: { name: string; page: string }) => `<a href="{{ '${x.page}' | relative_url }}">${esc(x.name)}</a>`;
  const els = d.elements.map((e) => `${a(e)} <span class="fa-gloss-meta">(${esc(e.type)})</span>`).join(", ");
  const views = d.views.length ? `; views: ${d.views.map(a).join(", ")}` : "";
  return [`<p class="fa-gloss-archimate">Depicted in ArchiMate ${esc(d.instance)} ${esc(d.model)}: ${els}${views}</p>`];
}

// ── Term pages (folio-assistant-core#498) ──────────────────────
//
// Owner, 2026-11-01, card Q-GLO-2 A: a term link takes the reader to a page
// for the term. Q-GLO-3 C: the term's defining site is its glossary row (the
// SKOS `source`), which keeps one node-kind structure for every term, and the
// page links the narrative passages that explain or use the term as its
// PROVENANCE ("term should link to narrative as provenance"). One page per
// AUTHORED-scheme term; an extracted candidate keeps its row only.

/** Where an authored term's page is written. */
export function termPagePath(s: Pick<GlossarySource, "instance" | "glossary">, id: string): string {
  return join(dirname(pagePath(`@${s.instance}`)), s.glossary.id, id, "index.md");
}
/** An authored term's page, site-root path with a leading slash: `/<glossary route>/instance/<instance>/<scheme>/<term>/`. */
export function termPermalink(s: Pick<GlossarySource, "instance" | "glossary">, id: string): string {
  return `${permalinkOf(`@${s.instance}`)}${s.glossary.id}/${id}/`;
}

/**
 * The narrative passages of each authored term, keyed by anchor
 * (`term-passages.ts`), and the document anchor of each block by source file,
 * so a term's `source` links to its glossary row in the rendered document.
 * Set once by {@link loadProvenance}; empty, term pages list no passages.
 */
let PASSAGES: ReadonlyMap<string, Passage[]> = new Map();
let BLOCK_HREF: ReadonlyMap<string, string> = new Map();

/** Read every document folio in the checkout and match each authored term against it. */
export async function loadProvenance(repo: string, c: ReturnType<typeof collect>): Promise<ReadonlyMap<string, Passage[]>> {
  const { narrativeBlocks, passagesIn } = await import("./term-passages.ts");
  const roots = [...new Set([repo, ...instanceOwners(repo).map((o) => o.root)])];
  const terms = c.glossaries
    .filter((s) => !s.extracted)
    .flatMap((s) =>
      s.glossary.terms.map((t) => ({
        key: anchorOf(s, t.id),
        id: t.id,
        labels: [first(t.prefLabel), ...(t.altLabel ?? [])],
        ...(t.notation ? { notation: t.notation } : {}),
        ...(t.source ? { source: t.source } : {}),
      })),
    );
  const merged = new Map<string, Passage[]>();
  const hrefs = new Map<string, string>();
  const seen = new Set<string>();
  for (const root of roots) {
    let blocks: Awaited<ReturnType<typeof narrativeBlocks>>;
    try {
      blocks = await narrativeBlocks(root);
    } catch {
      continue; // a root whose document manifests do not load here contributes nothing
    }
    blocks = blocks.filter((b) => !seen.has(`${b.document}#${b.label}`));
    for (const b of blocks) {
      seen.add(`${b.document}#${b.label}`);
      hrefs.set(b.source.replace(/\.(md|ts)$/, ""), `${b.page}#${b.label}`);
    }
    for (const [k, v] of passagesIn(blocks, terms)) merged.set(k, [...(merged.get(k) ?? []), ...v]);
  }
  PASSAGES = merged;
  BLOCK_HREF = hrefs;
  return merged;
}

/** Set the provenance directly (tests). */
export function setProvenance(passages: ReadonlyMap<string, Passage[]>, blockHref: ReadonlyMap<string, string> = new Map()): void {
  PASSAGES = passages;
  BLOCK_HREF = blockHref;
}

/** A note's text with its web addresses as links. */
function noteHtml(note: string): string {
  return esc(note).replace(/https?:\/\/[^\s<>"]+[^\s<>".,;)]/g, (u) => `<a href="${u}">${u.replace(/^https?:\/\//, "")}</a>`);
}

/**
 * The terms a term is `skos:related` to, under it. A handbook's consolidated
 * term relates to the candidate definitions a working group is choosing
 * between, so those are listed with their sources, open until the term is
 * authored (cat-harness-tools#1038; it was dth-hrh's own page until then).
 */
function relatedBlock({ t, related }: Row): string {
  if (!related?.length) return "";
  const candidates = related.every((r) => r.t.status === "candidate");
  const items = related
    .map(
      (r) =>
        `<li><a href="#${esc(anchorOf(r.s, r.t.id))}">${withInlineCode(r.label, esc)}</a>${r.s.glossary.title ? ` <span class="fa-gloss-meta">(${esc(r.s.glossary.title)})</span>` : ""}` +
        `${r.t.definition ? `<p>${withInlineCode(first(r.t.definition), esc)}</p>` : ""}` +
        `${r.t.scopeNote ? `<p class="fa-gloss-meta">${noteHtml(r.t.scopeNote)}</p>` : ""}</li>`,
    )
    .join("");
  return `<details class="fa-gloss-related"${t.status === "authored" ? "" : " open"}><summary>${candidates ? "Candidate definitions" : "Related terms"} (${related.length})</summary><ol>${items}</ol></details>`;
}

function termEntry(row: Row, marks?: ReadonlyMap<string, string>): string {
  const { s, t, label } = row;
  const iri = t.iri ?? termIri(s.ns, s.glossary, t.id);
  const matches = (["exactMatch", "closeMatch", "broadMatch", "narrowMatch"] as const).flatMap((m) =>
    (t[m] ?? []).map((u) => `<li>${m}: ${link(u)}</li>`),
  );
  // Extracted is said in words, not only by colour: a candidate is never
  // presented as a definition (bean `lqo9`).
  const status =
    t.status === "authored"
      ? ""
      : ` <span class="fa-gloss-status">${s.extracted ? `${t.status}, extracted` : t.status}</span>`;
  // The code is shown when it tells the reader something the label and the
  // source anchor do not; a skill's code IS its label, and a diagram
  // element's code is the anchor already on the source.
  const frag = t.source?.split("#", 2)[1];
  const code = t.notation && t.notation !== label && t.notation !== frag ? ` <code>${esc(t.notation)}</code>` : "";
  const definition = t.definition
    ? `<p>${linkTermCodes(s, t.id, withInlineCode(first(t.definition), esc))}</p>`
    : t.reason
      ? `<p>${linkTermCodes(s, t.id, withInlineCode(t.reason, esc))}</p>`
      : s.extracted
        ? `<p><em>The asset carries no description.</em></p>`
        : `<p><em>No definition yet.</em></p>`;
  // The filter reads the term row and its definition ({@link FILTER_SCRIPT});
  // this attribute carries only what is searchable and NOT shown (alternative
  // labels, a code the row hides), so a page of a thousand terms does not say
  // every label twice.
  const hidden = [...(t.altLabel ?? []), ...(t.notation && !code && t.notation !== label && t.notation !== frag ? [t.notation] : [])]
    .join(" ")
    .toLowerCase();
  // An extracted term's IRI is in its scheme's SKOS and not repeated here:
  // it was the largest single cost per row, and the row's own anchor is the
  // link a reader shares. An authored term shows it, because that is the IRI
  // somebody will cite.
  const meta = s.extracted
    ? `${esc(assetTypeTitle(s.extracted))} of ${esc(s.instance)}`
    : `${esc(s.glossary.title)} · <code>${esc(iri)}</code>`;
  return [
    `<dt id="${esc(`${s.instance}--${s.glossary.id}--${t.id}`)}" data-fa-state="${s.extracted ? "extracted" : t.status}" data-fa-gloss="${esc(hidden)}">`,
    `${withInlineCode(label, esc)}${code}${status}`,
    `</dt>`,
    `<dd>`,
    definition,
    ...(t.scopeNote && !s.extracted ? [`<p class="fa-gloss-note">${noteHtml(t.scopeNote)}</p>`] : []),
    ...(row.related?.length ? [relatedBlock(row)] : []),
    ...(t.requires?.length
      ? [
          `<p class="fa-gloss-uses">Uses: ${t.requires
            .map((r) => `<a href="#${esc(`${s.instance}--${s.glossary.id}--${r}`)}">${esc(labelOf(s, r))}</a>`)
            .join(", ")}</p>`,
        ]
      : []),
    `<p class="fa-gloss-meta">${s.extracted ? "" : `<a href="{{ '${termPermalink(s, t.id)}' | relative_url }}">Term page</a> · `}${meta}${t.isDefinedBy ? ` · defined by ${link(t.isDefinedBy)}` : ""}${t.source ? ` · source ${sourceLink(t.source)}` : ""}</p>`,
    ...(matches.length ? [`<ul class="fa-gloss-matches">${matches.join("")}</ul>`] : []),
    ...depictionLine(anchorOf(s, t.id)),
    ...(marks?.has(anchorOf(s, t.id)) ? [marks.get(anchorOf(s, t.id))!] : []),
    `</dd>`,
  ].join("\n");
}

/**
 * What `check:term-mapping` finds, COMPUTED by the gate's own functions.
 *
 * Bean `7wou`. The page SHOWS the three states; it does not have its own idea
 * of them — a second implementation of "is this term already somebody's
 * concept" would be free to disagree with the gate's, and the reader would
 * have no way to tell which was right. So it calls the gate's `run` and
 * `perScheme`: one implementation, two callers.
 *
 * ## It used to READ the gate's committed sidecar, and that is bean `0dav`
 *
 * Until 2026-10-01 this read `cat-harness/test/results/term-mapping.qa-results.json`.
 * QA results leave `main` for the `qa-reports` branch (owner rulings D1/D4),
 * and measured with `test/results/` moved aside the page rendered "Not
 * checked" on six glossary pages and `check:glossary` failed on all six. A
 * committed page cannot depend on a file that is not committed, and reading
 * the branch from a page renderer would make `glossary:page` a network call.
 * The computation is offline (`check-term-mapping`'s FHIR snapshot is pinned
 * in the checkout), so computing it is both possible and cheaper than
 * fetching it.
 *
 * **`undefined` still means "could not determine"**, and the page then says
 * the check has not run: no `cat-harness` layer to compute from, or a run
 * that threw. Rendering "0 mapped" over that would be `dh4f` exactly. A run
 * whose TARGET could not be consulted is not undefined — each such row
 * carries its `reason`, and the page shows it.
 */
export function mappingStates(repo: string = REPO): SchemeState[] | undefined {
  const harness = instanceOwners(repo).find((o) => o.name === "cat-harness");
  if (!harness) return undefined;
  try {
    const { mappings, scope } = runTermMapping(repo);
    const rows = MAPPING_TARGETS.flatMap((t) => perScheme(mappings, t, scope));
    return rows.length ? rows : undefined;
  } catch {
    // A run that throws is `check:term-mapping`'s finding, not this page's.
    // Saying it twice would make one defect look like two.
    return undefined;
  }
}

/**
 * `\`x\`` in prose written for a terminal, rendered as `<code>` in HTML.
 *
 * The reason strings come from `check-term-mapping`, which writes for a
 * console. Dropped into a raw `<td>`, kramdown leaves markdown alone inside
 * block HTML, so the backticks would appear literally on the page — bean
 * `mylx`, "raw markdown backticks show in rendered text", already open
 * against six pages. Escaped FIRST, so the conversion cannot smuggle markup
 * in from a reason string.
 */
export function codeSpans(text: string): string {
  return esc(text).replace(/`([^`]+)`/g, "<code>$1</code>");
}

/**
 * The mapping block for one scheme, or for every scheme on the index.
 *
 * Says all three states with their counts, and the REASON whenever a target
 * is undetermined — that reason is the whole difference between "checked,
 * no match" and "nobody asked", and it is stated once per target rather than
 * repeated on 2 605 identical rows.
 */
export function mappingBlock(states: SchemeState[] | undefined, schemes: readonly string[]): string {
  if (!states) {
    return [
      `<p class="fa-gloss-mapping fa-gloss-mapping--unrun">`,
      `<strong>Not checked.</strong> The <code>term-mapping</code> check could not be run here, so whether `,
      `these terms already exist in an authoritative vocabulary is <em>unknown</em> — which is not `,
      `the same as “none do”. Run <code>bun run cat term:mapping</code> to see why.`,
      `</p>`,
    ].join("");
  }
  const mine = states.filter((s) => schemes.includes(s.scheme));
  if (!mine.length) return "";
  const byTarget = new Map<string, SchemeState[]>();
  for (const s of mine) byTarget.set(s.target, [...(byTarget.get(s.target) ?? []), s]);
  const rows = [...byTarget.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([target, list]) => {
      const sum = (k: "mapped" | "unmapped" | "undetermined") =>
        list.reduce((n, s) => n + s[k], 0);
      const reason = list.find((s) => s.reason)?.reason;
      return [
        `<tr>`,
        `<td><code>${esc(target)}</code></td>`,
        `<td>${sum("mapped")}</td>`,
        `<td>${sum("unmapped")}</td>`,
        `<td>${sum("undetermined")}</td>`,
        `<td>${reason ? codeSpans(reason) : "—"}</td>`,
        `</tr>`,
      ].join("");
    });
  return [
    `<table class="fa-gloss-mapping">`,
    `<caption>Already somebody else's concept? — <code>check:term-mapping</code>, bean <code>7wou</code></caption>`,
    `<thead><tr><th>target</th><th>mapped</th><th>unmapped</th><th>undetermined</th><th>why undetermined</th></tr></thead>`,
    `<tbody>${rows.join("")}</tbody>`,
    `</table>`,
    `<p class="fa-gloss-mapping-note"><strong>Undetermined is never “no match”.</strong> `,
    `A vocabulary that could not be reached has said nothing, and the column above keeps that `,
    `apart from a checked miss. The counts are reported and not graded: an unmapped candidate may `,
    `be a term this corpus is right to coin.</p>`,
  ].join("\n");
}

/** A term on a page, as the per-term mapping marks need it. */
export interface TermKey {
  /** The entry's anchor, which keys its mark. */
  anchor: string;
  /** The layer that owns the scheme: with `scheme`, the key the record's rows have too (bean `q3n9`). */
  instance: string;
  scheme: string;
  term: string;
}

/** One target's part of a term's mark. Never a grade: a state, and what it matched. */
function markPart(target: string, a: TermStateAnswer): string {
  const t = `<code>${esc(target)}</code>`;
  switch (a.state) {
    case "mapped": {
      const to = a.concepts.length ? `, to ${a.concepts.map((u) => `<code>${esc(u)}</code>`).join(", ")}` : "";
      return a.exact
        ? `${t} mapped, exact${to}`
        : `${t} mapped by concept only (the same concept under a label that is not its authorised one)${to}`;
    }
    case "unmapped":
      return `${t} unmapped`;
    case "undetermined":
      return `${t} undetermined (the reason is in the table above)`;
    case "unknown":
      return `${t} cannot be told from the committed result: ${codeSpans(a.why)}`;
  }
}

/**
 * Each term's mapping state on a page: a stated default per target, and a
 * mark on every term that differs from it.
 *
 * Bean `5yhm`, Done-when "the glossary page reports mapped / unmapped /
 * undetermined per term, and grades none of them". A mark on EVERY entry
 * does not fit: the schema-fields page was 1,019,726 bytes against its
 * 1 MiB budget when this was written, about 15 bytes of room per term, and
 * the generator refuses to raise a budget. So the page says once what holds
 * for every unmarked term, and marks only the terms for which it does not
 * hold. That still states every term's state, which is what the bean asks.
 *
 * A default is stated ONLY when every term not mapped on that target is in
 * one state, and only when that state is `unmapped` or `undetermined`. With
 * no such state, every entry carries its own mark for that target. `unknown`
 * is never a default, because a default for "the record cannot say" would
 * read as a finding.
 *
 * Absent states (no committed result) give no note and no marks. The mapping
 * table already says "Not checked", and marking terms against a result
 * nobody wrote would be `dh4f`.
 */
export function perTermMapping(
  states: readonly SchemeState[] | undefined,
  terms: readonly TermKey[],
): { note: string; marks: Map<string, string> } {
  const marks = new Map<string, string>();
  if (!states || !terms.length) return { note: "", marks };
  const targets = [...new Set(states.map((s) => s.target))].sort();
  const parts = new Map<string, string[]>();
  const said: string[] = [];
  const seen = new Set<string>();
  const shared = new Set<string>();
  const keyOf = (k: TermKey) => `${k.instance}\0${k.scheme}\0${k.term}`;
  for (const k of terms) {
    const key = keyOf(k);
    if (seen.has(key)) shared.add(key);
    seen.add(key);
  }
  for (const target of targets) {
    // The record keys a row by (layer, scheme) (beans `wvzp`, `q3n9`),
    // because a scheme id such as `kg-tools` is shared by every layer's
    // extraction. Two entries on one page that still share layer, scheme
    // and id cannot be told apart, so both are `unknown` rather than both badged.
    const answers = terms.map((k): TermStateAnswer =>
      shared.has(keyOf(k))
        ? { state: "unknown", why: `two entries share the id \`${k.term}\` in scheme \`${k.scheme}\`` }
        : termState(states, k, target, k.term),
    );
    const rest = new Set(answers.filter((a) => a.state !== "mapped").map((a) => a.state));
    const only = rest.size === 1 ? [...rest][0] : undefined;
    const dflt = only === "unmapped" || only === "undetermined" ? only : undefined;
    said.push(
      dflt
        ? `<strong>${dflt}</strong> on <code>${esc(target)}</code>`
        : rest.size
          ? `in no single state on <code>${esc(target)}</code>, so each entry states its own`
          : `<strong>mapped</strong> on <code>${esc(target)}</code>, and each entry says to what`,
    );
    answers.forEach((a, i) => {
      if (a.state === dflt) return;
      const key = terms[i]!.anchor;
      parts.set(key, [...(parts.get(key) ?? []), markPart(target, a)]);
    });
  }
  for (const [key, p] of parts) marks.set(key, `<p class="fa-gloss-mapstate">Mapping: ${p.join(" · ")}</p>`);
  const n = marks.size;
  const note = [
    `<p class="fa-gloss-mapping-perterm"><strong>Per term.</strong> `,
    `Every term on this page is ${said.join(", and ")}, unless its entry says otherwise. `,
    `${n === 0 ? "No entry says otherwise." : n === 1 ? "1 entry says otherwise." : `${n} entries say otherwise.`}`,
    `</p>`,
  ].join("");
  return { note, marks };
}

/** The actor that runs `check:term-mapping`: kind `system`, "exercises no judgement". */
export const MATCHING_AGENT = "ci-pipeline";

/** `scheme\0term`, the key the mapping record uses. */
const recordKey = (instance: string, scheme: string, term: string) => `${instance}\0${scheme}\0${term}`;
/** `instance\0scheme`, the key one SKOS document is written under. */
export const sourceKey = (s: Pick<GlossarySource, "instance" | "glossary">) => `${s.instance}\0${s.glossary.id}`;

/**
 * Every mapped candidate's automated matches, resolved to absolute IRIs and
 * grouped by the SKOS document they go into. Owner ruling 2026-10-02.
 *
 * The record names a concept by its external URI where it has one, and
 * otherwise as `<scheme>:<id>`. That second form is not an IRI: `platform:`
 * would expand as a URI scheme nobody owns. So it is resolved to the authored
 * term's own IRI. If the scheme id is held by more than one layer (today
 * `platform` is held by two), the value is left OUT and reported. The
 * `linked-data` voice's rule is that an invented address is worse than none
 * (`ld-link-is-the-node-release-address`).
 *
 * The same holds for the candidate itself. The record keys it by
 * (layer, scheme, id) (bean `q3n9`), so the same id in two layers'
 * schemes is two keys. A key that two schemes of ONE layer still share
 * cannot be placed. It is reported, never published into both.
 *
 * `exactMatch` goes only to the record's `exactConcepts`. Every other
 * matched concept is `closeMatch`.
 */
export function automatedMatches(
  states: readonly SchemeState[] | undefined,
  glossaries: readonly GlossarySource[],
): { bySource: Map<string, AutomatedMatch[]>; unresolved: string[] } {
  const bySource = new Map<string, AutomatedMatch[]>();
  const unresolved: string[] = [];
  if (!states) return { bySource, unresolved };

  const candidatesAt = new Map<string, GlossarySource[]>();
  const authoredIri = new Map<string, string[]>();
  for (const s of glossaries) {
    for (const t of s.glossary.terms) {
      if (t.status === "authored") {
        const k = `${s.glossary.id}:${t.id}`;
        authoredIri.set(k, [...(authoredIri.get(k) ?? []), t.iri ?? termIri(s.ns, s.glossary, t.id)]);
      } else {
        const k = recordKey(s.instance, s.glossary.id, t.id);
        candidatesAt.set(k, [...(candidatesAt.get(k) ?? []), s]);
      }
    }
  }
  const absolute = (u: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(u);
  const resolveConcept = (u: string, where: string): string | undefined => {
    if (absolute(u)) return u;
    const hits = [...new Set(authoredIri.get(u) ?? [])];
    if (hits.length === 1) return hits[0];
    unresolved.push(
      `${where}: concept \`${u}\` ${hits.length ? `names ${hits.length} authored terms` : "names no authored term"}, so it has no single IRI`,
    );
    return undefined;
  };

  // Merged across targets: one candidate may match on `skos` and on `fhir`.
  const merged = new Map<string, { source: GlossarySource; m: AutomatedMatch }>();
  for (const row of states) {
    for (const mt of row.mappedTerms) {
      const where = `\`${row.instance}\` \`${row.scheme}\`/\`${mt.term}\` on \`${row.target}\``;
      const sources = candidatesAt.get(recordKey(row.instance, row.scheme, mt.term)) ?? [];
      if (sources.length !== 1) {
        unresolved.push(`${where}: ${sources.length} candidate entries carry this key, so the record cannot place it`);
        continue;
      }
      const source = sources[0]!;
      const exactSet = new Set(mt.exactConcepts ?? []);
      const k = `${sourceKey(source)}\0${mt.term}`;
      const entry = merged.get(k) ?? { source, m: { term: mt.term, exactMatch: [], closeMatch: [] } };
      for (const u of mt.concepts) {
        const iri = resolveConcept(u, where);
        if (iri) (exactSet.has(u) ? entry.m.exactMatch : entry.m.closeMatch).push(iri);
      }
      merged.set(k, entry);
    }
  }
  for (const { source, m } of merged.values()) {
    if (!m.exactMatch.length && !m.closeMatch.length) continue;
    bySource.set(sourceKey(source), [...(bySource.get(sourceKey(source)) ?? []), m]);
  }
  return { bySource, unresolved };
}

/**
 * The matching agent's release address, or `undefined` when it has none.
 * Asked only when there is something to publish, because the address book
 * walks every diagram in the checkout.
 */
export function matchingAgentIri(repo: string = REPO): string | undefined {
  const a = addressBook(repo).resolve("agent", MATCHING_AGENT);
  return "iri" in a ? a.iri : undefined;
}

/**
 * A description's inline code that names ANOTHER term of the same scheme
 * becomes a link to that term's entry (bean `qgjh`). Role descriptions say
 * "Inherits `reviewer`" — the reviewer is on the page, with an anchor, and the
 * relation the sentence states could not be followed.
 *
 * Exact id only, and the same scheme only: the anchor is
 * `instance--scheme--id`, so a word that merely looks like a term in another
 * scheme (`adjudication` is a PERMISSION, not a role) has no anchor it could
 * honestly point at, and stays code. A term never links to itself.
 */
export function linkTermCodes(s: GlossarySource, self: string, html: string): string {
  const ids = new Set(s.glossary.terms.map((x) => x.id));
  return html.replace(/<code>([^<]+)<\/code>/g, (whole, text: string) => {
    const id = text.replace(/&amp;/g, "&");
    if (id === self || !ids.has(id)) return whole;
    const anchor = esc(`${s.instance}--${s.glossary.id}--${id}`);
    // On a split type the target may be on another part, so the link names
    // its page; on any other page it stays a same-page anchor.
    if (s.extracted && LETTER_PARTS[s.extracted]) {
      const page = permalinkOf(`${s.extracted}/${partOfLabel(s.extracted, labelOf(s, id))}`);
      return `<a href="{{ '${page}' | relative_url }}#${anchor}">${whole}</a>`;
    }
    return `<a href="#${anchor}">${whole}</a>`;
  });
}

/** A term's label, by its local id within its scheme. */
function labelOf(s: GlossarySource, id: string): string {
  const t = s.glossary.terms.find((x) => x.id === id);
  return t ? first(t.prefLabel) : id;
}

/**
 * An ORDERED scheme, in its own order: a numbered list where the reader meets
 * each term after the terms its definition uses (owner, 2026-09-29: "logical
 * rather than alphabetical order"). Its terms are not repeated under the A–Z
 * bar — a term is on the page once.
 */
function orderedBlock(s: GlossarySource): string {
  const rows: Row[] = s.glossary.terms.map((t) => ({ s, t, label: first(t.prefLabel) }));
  return `### ${esc(s.glossary.title)}

${esc(s.glossary.description ?? "")} ${skosLink(s)}.

<dl class="fa-gloss fa-gloss-ordered">
${rows.map((r, i) => termEntry(r).replace(/^(<dt [^>]*>\n)/, `$1<span class="fa-gloss-n">${i + 1}.</span> `)).join("\n")}
</dl>`;
}

/** The filter box, the A–Z bar and the terms under their letters: the same on every page. */
function termsBlock(rows: Row[], marks?: ReadonlyMap<string, string>): string {
  // A label that does not start with a letter (a digit, a quote) goes under
  // one heading of its own rather than inventing a letter for it (`letterOf`).
  const byLetter = new Map<string, Row[]>();
  for (const r of rows) {
    const L = letterOf(r.label);
    byLetter.set(L, [...(byLetter.get(L) ?? []), r]);
  }
  const letters = [...byLetter.keys()].sort((a, b) => (a === "#" ? -1 : b === "#" ? 1 : a.localeCompare(b, "en")));
  const anchor = (L: string) => (L === "#" ? "letter-0-9" : `letter-${L}`);
  const shown = (L: string) => (L === "#" ? "0–9" : L);
  if (!rows.length) return "<p>No terms on this page.</p>";
  return `${filterBox(rows.length)}

<nav aria-label="Letters">${letters.map((L) => `<a href="#${anchor(L)}">${shown(L)}</a>`).join(" ")}</nav>

${letters
  .map((L) => `<h2 id="${anchor(L)}">${shown(L)}</h2>\n<dl class="fa-gloss">\n${byLetter.get(L)!.map((r) => termEntry(r, marks)).join("\n")}\n</dl>`)
  .join("\n\n")}`;
}

/** The filter box over a page's terms, which {@link FILTER_SCRIPT} drives; `n` is how many it starts by showing. */
function filterBox(n: number): string {
  return `<label for="fa-gloss-q">Filter terms</label>
<input id="fa-gloss-q" type="search" autocomplete="off" style="min-height:44px;width:100%;max-width:32rem">
<p aria-live="polite"><span id="fa-gloss-n">${n}</span> shown</p>`;
}

/**
 * The filter: a term matches on its row (label, code, state), its hidden
 * alternative labels, and its definition, the `<dd>`'s first paragraph
 * ({@link termEntry}). Not the scheme, IRI and source line under it: every
 * term of one scheme shares those, so a query that names its source file
 * (dth-hrh's `HWF_registry_DTH_Glossary_DRAFT.xlsx`, for "registry") matched
 * all 177 terms and filtered nothing (owner, 2026-10-15).
 */
const FILTER_SCRIPT = `<script>
(function(){var q=document.getElementById("fa-gloss-q"),n=document.getElementById("fa-gloss-n");if(!q)return;
function run(){var v=q.value.trim().toLowerCase(),k=0;
document.querySelectorAll("dt[data-fa-gloss]").forEach(function(dt){var dd=dt.nextElementSibling,def=dd&&dd.firstElementChild;
var ok=!v||(dt.textContent+" "+dt.getAttribute("data-fa-gloss")+" "+(def?def.textContent:"")).toLowerCase().indexOf(v)>=0;
dt.hidden=!ok;if(dd)dd.hidden=!ok;if(ok)k++;});n.textContent=k;}
q.addEventListener("input",run);})();
</script>`;

/**
 * The writer, named once, for every file this generator owns.
 *
 * It is emitted in THREE forms because three readers ask the question three
 * ways, and none of them reads the other two: {@link GENERATED} is the HTML
 * comment a person sees in the page source, {@link GENERATED_FM} is the
 * `generated:` front-matter key `check:reference-direction` reads, and
 * `_generated` in {@link outputs} is the JSON form of the same fact. The
 * comment was the only one until bean `ws99`, and it sits BELOW the front
 * matter — correct information in the one place the checker cannot read, so
 * every page and every JSON file this writes was being graded as authored
 * prose. No count here on purpose: {@link outputs} is what says how many
 * there are, and a number restated in a comment is a claim that goes stale
 * the next time a scheme is added.
 */
const GENERATED_BY = "folio-assistant-core/scripts/glossary-page.ts";

const GENERATED = `<!-- Generated by ${GENERATED_BY}. Do not hand-edit: \`check:glossary\` fails on the difference. -->`;

/** The same fact as a front-matter key, in the form the docs mirrors already use. */
const GENERATED_FM = `generated: ${GENERATED_BY} — do not hand-edit; run \`bun run cat glossary:page\``;

/** The same fact for a JSON file, as a top-level `_generated`. */
const GENERATED_JSON = `${GENERATED_BY} — do not hand-edit; run \`bun run cat glossary:page\``;

/**
 * Render with the page's own size in it. Two passes: the page states its own
 * size, so it is rendered once to measure and once to say so. The size is
 * rounded, which the few bytes of the statement itself cannot move.
 */
function sized(render: (size: string) => string): string {
  return render(sizeLabel(Buffer.byteLength(render("…"), "utf-8")));
}

/**
 * A split asset type's own URL: what the type is, where it comes from, and a
 * link to each part with its term count. It holds no terms itself.
 */
export function renderLandingPage(c: ReturnType<typeof collect>, type: AssetType): string {
  const parts = LETTER_PARTS[type]!;
  const schemes = c.glossaries.filter((s) => s.extracted === type);
  const from = schemes.length
    ? schemes.map((s) => `${esc(s.instance)} ${s.glossary.terms.length} (${skosLink(s)})`).join(" · ")
    : "no instance";
  const total = rowsOn(c, type).length;
  const items = parts.map((r) => {
    const k = `${type}/${r}` as PartKey;
    return `<li>${pageLink(k, r.toUpperCase().replace("-", "–"))}: ${rowsOn(c, k).length} terms</li>`;
  });
  return `---
layout: default
${GENERATED_FM}
title: "${pageTitle(type)}"
parent: Glossary
has_children: true
nav_order: ${ASSET_TYPES.indexOf(type) + 1}
permalink: ${permalinkOf(type)}
---
${GENERATED}

# ${pageTitle(type)}

Candidate terms extracted from ${assetTypeWhat(type)}. Each is the asset's own text, verbatim and not curated, and carries the badge "candidate, extracted". A person promotes one by authoring it. Authored terms are on their owning instance's page, and those pages, the counts and the sources are linked from the ${pageLink("index", "glossary index")}.

From: ${from}.

**Split by first letter.** ${total} terms are too many for one page within its budget of ${sizeLabel(PAGE_BUDGET.type)}, so they are on ${parts.length} pages by the first letter of the label. The ranges are fixed, so a term's address does not move as terms are added. A label that does not start with a letter is on the first page.

<ul>
${items.join("\n")}
</ul>
`;
}

/** One asset type's page, or one part of a split type: its extracted terms, from every layer. */
export function renderTypePage(c: ReturnType<typeof collect>, key: AssetType | PartKey): string {
  if (!isPart(key) && LETTER_PARTS[key]) return renderLandingPage(c, key);
  const type = isPart(key) ? splitPart(key)[0] : key;
  const rows = rowsOn(c, key);
  const schemes = c.glossaries.filter((s) => s.extracted === type);
  const from = schemes.length
    ? schemes.map((s) => `${esc(s.instance)} ${s.glossary.terms.length} (${skosLink(s)})`).join(" · ")
    : "no instance";
  const states = mappingStates();
  const perTerm = perTermMapping(
    states,
    rows.map((r) => ({ anchor: anchorOf(r.s, r.t.id), instance: r.s.instance, scheme: r.s.glossary.id, term: r.t.id })),
  );
  return sized(
    (size) => `---
layout: default
${GENERATED_FM}
title: "${pageTitle(key)}"
${isPart(key) ? `parent: "${pageTitle(type)}"\ngrand_parent: Glossary\nnav_order: ${LETTER_PARTS[type]!.indexOf(splitPart(key)[1]) + 1}` : `parent: Glossary\nnav_order: ${ASSET_TYPES.indexOf(type) + 1}`}
permalink: ${permalinkOf(key)}
---
${GENERATED}

# ${pageTitle(key)}

Candidate terms extracted from ${assetTypeWhat(type)}. Each is the asset's own text, verbatim and not curated, and carries the badge "candidate, extracted". A person promotes one by authoring it. Authored terms are on their owning instance's page, and those pages, the counts and the sources are linked from the ${pageLink("index", "glossary index")}.

From: ${from}.

${isPart(key) ? `One of ${LETTER_PARTS[type]!.length} pages of this type, split by the first letter of the label: ${pageLink(type, "all parts")}.\n\n` : ""}**Size:** this page holds ${rows.length} terms and is ${size} before compression, fetched in one request, within its budget of ${sizeLabel(budgetOf(key))}. There is no search index: the filter below runs over this page, and the A–Z bar jumps within it.

${mappingBlock(states, [...new Set(rows.map((r) => r.s.glossary.id))])}
${perTerm.note}

${termsBlock(rows, perTerm.marks)}

${FILTER_SCRIPT}
`,
  );
}

/**
 * One layer's authored terms: its ordered schemes in their own order, then
 * every other term A–Z. The terms the index held until 2026-10-15
 * ({@link AuthoredKey}), with the schema.org `DefinedTermSet` that went with them.
 */
export function renderAuthoredPage(c: ReturnType<typeof collect>, key: AuthoredKey): string {
  const instance = key.slice(1);
  const rows = rowsOn(c, key);
  // Ordered schemes are shown in their own order, ahead of the A–Z list.
  const ordered = c.glossaries.filter((s) => pageOf(s) === key && s.glossary.ordered);
  const schemes = c.glossaries.filter((s) => pageOf(s) === key);
  // schema.org's DefinedTermSet carries the AUTHORED terms only. It is what a
  // search engine reads as "this site defines X", and an extracted candidate
  // is not a definition anybody curated. Every term, candidates included, is
  // in the SKOS files, whose `skos:note` says which is which.
  const ld = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: pageTitle(key),
    hasDefinedTerm: rows
      .filter(({ t }) => t.status === "authored")
      .map(({ s, t, label }) => ({
        "@type": "DefinedTerm",
        "@id": t.iri ?? termIri(s.ns, s.glossary, t.id),
        name: label,
        ...(t.definition ? { description: first(t.definition) } : {}),
        ...(t.notation ? { termCode: t.notation } : {}),
      })),
  };
  return sized(
    (size) => `---
layout: default
${GENERATED_FM}
title: "${pageTitle(key)}"
${ONLY === undefined ? "parent: Glossary\n" : ""}nav_order: 0
permalink: ${permalinkOf(key)}
---
${GENERATED}

# ${pageTitle(key)}

${
  schemes.length > 0
    ? `The glossaries **${esc(instance)}** owns: ${schemes.map((s) => `${esc(s.glossary.title)} (${s.glossary.terms.length} term${s.glossary.terms.length === 1 ? "" : "s"}, ${skosLink(s)})`).join(" · ")}.`
    : `**${esc(instance)}** declares a glossary directory and owns no authored glossary yet.`
}${(() => {
  // The layer's EXTRACTED terms stay on their asset type's page (a term is
  // on exactly one page); this page names them so it is the layer's whole
  // glossary to a reader who arrived from its tile.
  const ex = c.glossaries.filter((s) => s.extracted && s.instance === instance);
  return ex.length > 0
    ? ` Terms extracted from its assets: ${ex.map((s) => `${pageLink(s.extracted!, assetTypeTitle(s.extracted!))} (${s.glossary.terms.length})`).join(" · ")}.`
    : "";
})()} Every other instance's terms, the counts and the sources are on the ${pageLink("index", "glossary index")}.

**Size:** this page holds ${rows.length} terms and is ${size} before compression, within its budget of ${sizeLabel(budgetOf(key))}. There is no search index: the filter below runs over this page${rows.some((r) => !r.s.glossary.ordered) ? ", and the A–Z bar jumps within it" : ""}.

${(() => {
  // A layer whose every scheme is ordered (bootstrap's) has no A–Z list;
  // its page still gets the filter, over the ordered lists.
  const az = rows.filter((r) => !r.s.glossary.ordered);
  const lists = ordered.map(orderedBlock).join("\n\n");
  if (!ordered.length) return termsBlock(az);
  return az.length ? `${lists}\n\n### Every other term, A–Z\n\n${termsBlock(az)}` : `${filterBox(rows.length)}\n\n${lists}`;
})()}

<script type="application/ld+json">
${JSON.stringify(ld, null, 1)}
</script>
${FILTER_SCRIPT}
`,
  );
}

/** A term named by `ref` (a local id in `s`, or any collected term's IRI), resolved, or undefined. */
function resolveRef(c: ReturnType<typeof collect>, s: GlossarySource, ref: string): Row | undefined {
  const local = s.glossary.terms.find((x) => x.id === ref);
  return local ? { s, t: local, label: first(local.prefLabel) } : termIndex(c.glossaries).get(ref);
}

/** A link to a term: its page when it is authored, else its row. */
function termLink(r: Row): string {
  const href = r.s.extracted ? `${permalinkOf(pageOf(r.s))}#${anchorOf(r.s, r.t.id)}` : termPermalink(r.s, r.t.id);
  return `<a href="{{ '${href}' | relative_url }}">${withInlineCode(r.label, esc)}</a>`;
}

/** The terms whose `broader` names `row`: its narrower terms, computed, so nobody writes the inverse by hand. */
function narrowerOf(c: ReturnType<typeof collect>, row: Row): Row[] {
  const iri = row.t.iri ?? termIri(row.s.ns, row.s.glossary, row.t.id);
  return c.glossaries
    .filter((s) => !s.extracted)
    .flatMap((s) => s.glossary.terms.filter((t) => (t.broader ?? []).some((b) => (s === row.s && b === row.t.id) || b === iri)).map((t) => ({ s, t, label: first(t.prefLabel) })));
}

/** One passage as a list item: section, then the words around the term. */
function passageItem(p: Passage): string {
  return `<li><a href="{{ '/${esc(p.href)}' | relative_url }}">${esc(p.section || p.label)}</a> <span class="fa-gloss-meta">(${esc(p.document)})</span><br><span class="fa-gloss-excerpt">${esc(p.excerpt)}</span></li>`;
}

/**
 * One authored term's page (Q-GLO-2 A): what it means, where it is defined,
 * what it relates to, and where the narrative explains and uses it.
 */
export function renderTermPage(c: ReturnType<typeof collect>, s: GlossarySource, t: Glossary["terms"][number]): string {
  const label = first(t.prefLabel);
  const row: Row = { s, t, label };
  const iri = t.iri ?? termIri(s.ns, s.glossary, t.id);
  const refs = (xs: readonly string[] | undefined) => (xs ?? []).map((r) => resolveRef(c, s, r)).filter((r): r is Row => r !== undefined);
  const broader = refs(t.broader);
  const narrower = narrowerOf(c, row);
  const related = refs(t.related);
  const list = (title: string, rows: Row[]) => (rows.length ? [`<h2>${title}</h2>`, `<ul>${rows.map((r) => `<li>${termLink(r)}</li>`).join("")}</ul>`] : []);
  const matches = (["exactMatch", "closeMatch", "broadMatch", "narrowMatch"] as const).flatMap((m) => (t[m] ?? []).map((u) => `<li>${m}: ${link(u)}</li>`));
  const passages = PASSAGES.get(anchorOf(s, t.id)) ?? [];
  const explains = passages.filter((p) => p.kind === "explains");
  const mentions = passages.filter((p) => p.kind === "mentions");
  const rowHref = t.source ? BLOCK_HREF.get(t.source.split("#", 1)[0]!.replace(/\.(md|ts)$/, "")) : undefined;
  const entry = `${permalinkOf(`@${s.instance}`)}#${anchorOf(s, t.id)}`;
  // Absolute, so the JSON-LD's IRIs do not resolve against the term page itself.
  const abs = (href: string) => `{{ '/${href.replace(/'/g, "%27")}' | absolute_url }}`;
  // The defining site is the glossary row (Q-GLO-3 C); the passages are
  // provenance, so the JSON-LD names them as what the concept was derived
  // from and where it is used, not as definitions.
  const ld = {
    "@context": { skos: "http://www.w3.org/2004/02/skos/core#", dcterms: "http://purl.org/dc/terms/", prov: "http://www.w3.org/ns/prov#" },
    "@id": iri,
    "@type": "skos:Concept",
    "skos:prefLabel": label,
    ...(t.notation ? { "skos:notation": t.notation } : {}),
    ...(t.definition ? { "skos:definition": first(t.definition) } : {}),
    "skos:inScheme": { "@id": schemeIri(s.ns, s.glossary) },
    ...(rowHref ? { "dcterms:source": { "@id": abs(rowHref) } } : t.source ? { "dcterms:source": t.source } : {}),
    ...(explains.length ? { "prov:wasDerivedFrom": explains.map((p) => ({ "@id": abs(p.href) })) } : {}),
    ...(mentions.length ? { "dcterms:isReferencedBy": mentions.map((p) => ({ "@id": abs(p.href) })) } : {}),
  };
  const status = t.status === "authored" ? "" : ` <span class="fa-gloss-status">${esc(t.status)}</span>`;
  return `---
layout: default
${GENERATED_FM}
title: "${label.replace(/"/g, '\\"')}"
nav_exclude: true
permalink: ${termPermalink(s, t.id)}
---
${GENERATED}

# ${withInlineCode(label, esc)}${t.notation && t.notation !== label ? ` (${esc(t.notation)})` : ""}${status}

${t.definition ? `<p>${withInlineCode(first(t.definition), esc)}</p>` : "<p><em>No definition yet.</em></p>"}
${t.altLabel?.length ? `<p class="fa-gloss-meta">Also called: ${t.altLabel.map((a) => esc(a)).join(", ")}</p>` : ""}
${t.scopeNote ? `<p class="fa-gloss-note">${noteHtml(t.scopeNote)}</p>` : ""}

<h2>Defined in</h2>
<ul>
<li>${pageLink(`@${s.instance}`, `${s.glossary.title}`)}: <a href="{{ '${entry}' | relative_url }}">glossary entry</a>${rowHref ? ` · <a href="{{ '/${esc(rowHref)}' | relative_url }}">glossary row in the document</a>` : t.source ? ` · source ${sourceLink(t.source)}` : ""}</li>
${t.isDefinedBy ? `<li>defined by ${link(t.isDefinedBy)}</li>` : ""}
</ul>

${[...list("Broader", broader), ...list("Narrower", narrower), ...list("Related", related)].join("\n")}
${matches.length ? `<h2>Matches</h2>\n<ul class="fa-gloss-matches">${matches.join("")}</ul>` : ""}
${depictionLine(anchorOf(s, t.id)).join("\n")}

<h2>In the narrative</h2>
${explains.length ? `<p>Explained in:</p>\n<ol>${explains.map(passageItem).join("")}</ol>` : ""}
${mentions.length ? `<p>Used in:</p>\n<ol>${mentions.map(passageItem).join("")}</ol>` : ""}
${passages.length ? "" : "<p><em>No passage of a document in this folio names this term.</em></p>"}

<p class="fa-gloss-meta">IRI <code>${esc(iri)}</code> · ${skosLink(s)}</p>

<script type="application/ld+json">
${JSON.stringify(ld, null, 1)}
</script>
`;
}

/** Every authored term's page, path → content. */
export function termPagesOf(c: ReturnType<typeof collect>): Map<string, string> {
  const keys = new Set<string>(authoredKeys(c));
  const out = new Map<string, string>();
  for (const s of c.glossaries) {
    if (s.extracted || !keys.has(`@${s.instance}`)) continue;
    if (ONLY !== undefined && s.instance !== ONLY) continue;
    for (const t of s.glossary.terms) out.set(termPagePath(s, t.id), renderTermPage(c, s, t));
  }
  return out;
}

/**
 * The index's "Authored terms" section: where each layer's terms are. It
 * keeps the headings the terms had here — each ordered scheme's, then "every
 * other" — because each locale page mirrors this page's heading order and
 * `translation-drift` compares it; each heading now says where its terms are.
 */
function authoredList(c: ReturnType<typeof collect>, keys: readonly AuthoredKey[], ordered: readonly GlossarySource[]): string {
  const list = keys
    .map((k) => {
      const schemes = c.glossaries.filter((s) => pageOf(s) === k);
      return `<li>${pageLink(k, k.slice(1))}: ${rowsOn(c, k).length} terms in ${schemes.map((s) => esc(s.glossary.title)).join(", ")}</li>`;
    })
    .join("\n");
  const at = (s: GlossarySource) => `In its own order on ${pageLink(pageOf(s), s.instance)}.`;
  if (!keys.length) return "<p>No instance owns an authored glossary.</p>";
  return ordered.length
    ? `${ordered.map((s) => `### ${esc(s.glossary.title)}\n\n${at(s)}`).join("\n\n")}\n\n### Every other authored term, A–Z\n\n<ul>\n${list}\n</ul>`
    : `<ul>\n${list}\n</ul>`;
}

/** The index: the counts, the sources, and a link to every layer's authored page and every asset type's page. */
export function renderIndex(
  c: ReturnType<typeof collect>,
  typePages: ReadonlyMap<AssetType | PartKey, string> = typePagesOf(c),
  authoredPages: ReadonlyMap<AuthoredKey, string> = authoredPagesOf(c),
): string {
  const typeBytes = (t: AssetType) =>
    [t, ...(LETTER_PARTS[t] ?? []).map((r) => `${t}/${r}` as PartKey)].reduce((n, k) => n + Buffer.byteLength(typePages.get(k) ?? "", "utf-8"), 0);
  const ordered = c.glossaries.filter((s) => !s.extracted && s.glossary.ordered);
  const n = counts(c);
  const total = c.glossaries.reduce((k, s) => k + s.glossary.terms.length, 0);
  const authoredSchemes = c.glossaries.filter((s) => !s.extracted);
  const extractedSchemes = c.glossaries.filter((s) => s.extracted);
  const typeTotal = (type: AssetType) => extractedSchemes.filter((s) => s.extracted === type).reduce((k, s) => k + s.glossary.terms.length, 0);
  const pagesTable = (indexSize: string) =>
    [
      `<div style="overflow-x:auto"><table>`,
      `<thead><tr><th>page</th><th>holds</th><th>terms</th><th>size</th></tr></thead>`,
      `<tbody>`,
      `<tr><td>this page</td><td>counts and sources</td><td>—</td><td>${indexSize}</td></tr>`,
      ...[...authoredPages].map(
        ([k, page]) =>
          `<tr><td>${pageLink(k, k.slice(1))}</td><td>authored terms of ${esc(k.slice(1))}</td><td>${rowsOn(c, k).length}</td><td>${sizeLabel(Buffer.byteLength(page, "utf-8"))}</td></tr>`,
      ),
      ...ASSET_TYPES.map(
        (t) =>
          `<tr><td>${pageLink(t, assetTypeTitle(t))}</td><td>candidates, extracted</td><td>${typeTotal(t)}</td><td>${sizeLabel(typeBytes(t))}</td></tr>`,
      ),
      `</tbody></table></div>`,
    ].join("\n");
  const extractedTable = (() => {
    if (!extractedSchemes.length) return "<p>No KG asset carried an extractable term.</p>";
    const instances = [...new Set(extractedSchemes.map((s) => s.instance))];
    const cell = (inst: string, type: AssetType) => {
      const s = extractedSchemes.find((x) => x.instance === inst && x.extracted === type);
      return s ? `<td>${s.glossary.terms.length} · ${skosLink(s)}</td>` : "<td>—</td>";
    };
    return [
      `<div style="overflow-x:auto"><table>`,
      `<thead><tr><th>instance</th>${ASSET_TYPES.map((t) => `<th>${pageLink(t, assetTypeTitle(t))}</th>`).join("")}</tr></thead>`,
      `<tbody>`,
      ...instances.map((i) => `<tr><td>${esc(i)}</td>${ASSET_TYPES.map((t) => cell(i, t)).join("")}</tr>`),
      `<tr><td><strong>total</strong></td>${ASSET_TYPES.map((t) => `<td><strong>${typeTotal(t)}</strong></td>`).join("")}</tr>`,
      `</tbody></table></div>`,
    ].join("\n");
  })();
  const sources = [
    ...authoredSchemes.map(
      (s) =>
        `<li><strong>${esc(s.glossary.title)}</strong> (${s.instance}, ${s.glossary.terms.length} term${s.glossary.terms.length === 1 ? "" : "s"}${s.glossary.members?.length ? `, ${s.glossary.members.length} external members` : ""}) · <a href="{{ '/${skosAsset(s)}' | relative_url }}">SKOS JSON-LD</a> · <code>${esc(s.file)}</code></li>`,
    ),
    // `swimlane-glossary`, not `glossary`. `auto-docs` names its sub-page
    // after the DECLARED ID, and this href carried the wrong one — a third
    // instance of `bsay`'s class, found because repointing the declaration
    // made `check:wireframes` name it. A composed path is not resolved by
    // anything, so the link 404ed on the published glossary the whole time.
    ...c.ledgers.map(
      (l) =>
        `<li><strong>Swimlane roles</strong> (${l.instance}, ${l.terms} terms) · <a href="{{ '/cat-harness/auto-docs/glossary/swimlane-glossary/' | relative_url }}">rendered here</a> · <code>${esc(l.path)}</code></li>`,
    ),
    ...c.external.map((e) => `<li><strong>${esc(e.title ?? e.id)}</strong> (external SKOS, referenced by ${e.instance}) · ${link(e.url)}</li>`),
  ];
  const ledgerTerms = c.ledgers.reduce((k, l) => k + l.terms, 0);
  return sized(
    (size) => `---
layout: default
${GENERATED_FM}
title: Glossary
nav_order: 90
has_children: true
permalink: /${ROUTE}/
---
${GENERATED}

# Glossary

Every term the instances in this repository define or carry, as W3C SKOS. Terms link to the external concepts they match rather than copying them. ${total} terms: **${n.authored} authored** in ${authoredSchemes.length} glossar${authoredSchemes.length === 1 ? "y" : "ies"}, one page per instance that owns them, and **${n.extracted} extracted** from knowledge-graph assets in ${extractedSchemes.length} generated schemes, one page per asset type, plus the sources below.

<table>
<thead><tr><th>state</th><th>what it means</th><th>terms</th></tr></thead>
<tbody>
<tr><td>authored</td><td>A person wrote or approved the definition.</td><td>${n.authored}</td></tr>
<tr><td>candidate, extracted</td><td>Lifted from a knowledge-graph asset's own title and description, verbatim, and not curated. The definition is the asset's text, the source links to the asset, and an asset with no description gives a term with none. A person promotes one by authoring it.</td><td>${n.extracted}</td></tr>
<tr><td>could-not-extract</td><td>The source names a term the extractor could not read, and says why.</td><td>${n.couldNotExtract}</td></tr>
</tbody>
</table>

## Already somebody else's concept?

Extracted candidates are minted from this repository's own assets and are not, by themselves, checked against any vocabulary. \`check:term-mapping\` asks whether each already exists as a concept somebody is authoritative for — SKOS for what a term MEANS, FHIR for a clinical code's operational semantics — and the two are separate questions with separate answers.

${mappingBlock(mappingStates(), [...new Set(c.glossaries.map((g) => g.glossary.id))])}

## Pages

Each term is on exactly one page. Authored terms are on the page of the instance that owns their scheme (owner, 2026-10-15), and extracted candidates are split by asset type (owner, 2026-09-24), so that no page is fetched at the size of all of them.

${pagesTable(size)}

**Size:** this page is ${size} before compression, within its budget of ${sizeLabel(PAGE_BUDGET.index)}; each instance's and each asset type's page has a budget of ${sizeLabel(PAGE_BUDGET.type)}. There is no search index: the filter on each page runs over that page, and its A–Z bar jumps within it. The SKOS files in the sources are the machine-readable form.

## Authored terms

${authoredList(c, [...authoredPages.keys()], ordered)}

## Sources

### Authored

<ul>
${sources.join("\n")}
</ul>

### Extracted from knowledge-graph assets

Generated by \`folio-assistant-core/scripts/glossary-extract.ts\` into \`${esc(relative(REPO, generatedDir()).split("\\").join("/"))}/<instance>/<type>.glossary.json\`, one scheme per asset type per instance, each term's IRI in the namespace of the instance that holds the asset. BPMN lanes and roles are not extracted again: the ${ledgerTerms} swimlane-role terms above already carry them, with every lane name as an alternative label.

${extractedTable}
`,
  );
}

// ── Per-locale pages — bean `c592` ───────────────────────────────
//
// Owner, 2026-09-30: *"do full translation, show it all works, do the builds,
// all machinery/tools/skills/assets."* The templates (`glossary-pot.ts`) sit in
// the declared translation-sources directory, one per scheme per locale; a
// translator's `.po` beside a template is what this reads. Nothing is
// translated until a `.po` exists, and an entry with no translation renders
// its SOURCE text marked untranslated — never silently English, and never
// omitted, which would make a partial translation read as a complete one.
//
// Every `.po` here is UNOFFICIAL until a person signs it off (issue #206), so
// every page says so in its front matter (`translation_status: unverified`),
// as the other translated pages do.

/** A locale's translations for one scheme: source text → translation. */
export type SchemeTranslations = ReadonlyMap<string, string>;

/**
 * Every locale that has at least one glossary `.po`, with its translations
 * per template name. Reads the SAME paths `glossary-pot.ts` writes, through
 * its own `potPath`, so the reader cannot look somewhere the writer does not.
 */
export function readGlossaryTranslations(dirs: readonly string[] = allTranslationDirs()): Map<string, Map<string, SchemeTranslations>> {
  const out = new Map<string, Map<string, SchemeTranslations>>();
  // Every declared translation-sources directory (bean riit): a scheme's
  // catalogues sit with the layer that owns it, not in one platform tree.
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const locale of readdirSync(dir).sort()) {
      const sub = join(dir, locale, GLOSSARY_SUBDIR);
      if (!existsSync(sub)) continue;
      for (const f of readdirSync(sub).filter((x) => x.endsWith(".po")).sort()) {
        const name = f.slice(0, -".po".length);
        // Only a .po beside its template counts: an orphan .po translates
        // nothing the page shows, and `glossary:pot:check` reports it.
        if (!existsSync(potPath(dir, locale, name))) continue;
        const m = parsePo(readFileSync(join(sub, f), "utf-8"));
        const byScheme = out.get(locale) ?? new Map<string, SchemeTranslations>();
        byScheme.set(name, m);
        out.set(locale, byScheme);
      }
    }
  }
  return out;
}

/** Where a locale's glossary page is written. */
export function localePagePath(locale: string): string {
  return join(visualiserPageDir(SITE, pageParts({ ...PARTS, locale })), "index.md");
}

/** The text in a locale, or the source marked untranslated. */
function inLocale(src: string, t: SchemeTranslations | undefined): { text: string; translated: boolean } {
  const v = t?.get(src);
  return v ? { text: v, translated: true } : { text: src, translated: false };
}

/**
 * The locale page's own words — headings, table labels, the status line — as
 * gettext msgids (`ui-string` entries in the `glossary-page` template), the
 * pattern `kg-viewer-strings.ts` set for the KG viewer. The page is translated
 * chrome and all, or it marks what is not.
 */
export const LOCALE_PAGE_STRINGS = {
  // Bean `7wou`. The source page gained this section on 2026-09-30 and the
  // five locale pages did not, which `translation:drift:check` caught as
  // 9 headings against 8 — correctly, and it is reader-visible: a section
  // a reader in that language could not reach. Added as msgids rather than
  // recorded in KNOWN_DRIFT, because these pages are GENERATED from this
  // file and a generated page's missing section is a generator gap, not a
  // translator's backlog.
  mapping: "Already somebody else's concept?",
  mappingIntro:
    "Extracted candidates are minted from this repository's own assets and are not, by themselves, checked against any vocabulary. `check:term-mapping` asks whether each already exists as a concept somebody is authoritative for — SKOS for what a term MEANS, FHIR for a clinical code's operational semantics — and the two are separate questions with separate answers.",
  // The same shape as `pagesNote`: the table below is counts, scheme ids and
  // column labels the generator writes in the source language. Saying so is
  // the policy this page already follows for the extracted pages — never
  // silently English, never omitted.
  mappingTableNote: "The table's labels are in the source language: it reports counts per scheme, computed by the gate rather than authored here.",
  pages: "Pages",
  pagesNote: "Extracted candidates are not translated: they are lifted verbatim from knowledge-graph assets and uncurated. Their pages are in the source language.",
  authored: "Authored terms",
  everyOther: "Every other authored term, A–Z",
  sources: "Sources",
  sourcesAuthored: "Authored",
  sourcesExtracted: "Extracted from knowledge-graph assets",
  term: "term",
  altLabels: "alternative labels",
  definition: "definition",
  untranslated: "untranslated",
  status: "These translations are unofficial: drafted by an agent and not yet signed off by a person (issue #206). Text marked untranslated is the source, shown rather than hidden.",
  fullyTranslated: "authored terms fully translated",
  sourcePage: "The glossary in the source language, with every extracted term",
} as const;

/** The template the locale page's strings live in, beside the schemes' templates. */
export const LOCALE_PAGE_TEMPLATE = "glossary-page";

/** One locale's glossary page: the SOURCE page's structure, every authored term translated where a .po says so. */
export function renderLocalePage(
  c: ReturnType<typeof collect>,
  locale: string,
  byScheme: ReadonlyMap<string, SchemeTranslations>,
  locales: readonly string[],
): string {
  const esc = (x: string) => x.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const ui = byScheme.get(LOCALE_PAGE_TEMPLATE);
  const u = (k: keyof typeof LOCALE_PAGE_STRINGS) => inLocale(LOCALE_PAGE_STRINGS[k], ui);
  const untr = u("untranslated").text;
  const mark = (x: { text: string; translated: boolean }) => (x.translated ? esc(x.text) : `${esc(x.text)} _(${untr})_`);
  const rawTitle = [...byScheme.values()].map((m) => m.get("glossary")).find((v) => v) ?? "Glossary";
  // The term is lower-case in running text; as a title its first letter is
  // capitalised in the locale's own rules (a no-op for scripts without case).
  const titleTerm = rawTitle.charAt(0).toLocaleUpperCase(locale) + rawTitle.slice(1);
  let terms = 0;
  let translated = 0;
  const table = (s: GlossarySource): string[] => {
    const t = byScheme.get(templateName(s));
    const out = [`| ${mark(u("term"))} | ${mark(u("altLabels"))} | ${mark(u("definition"))} |`, "|---|---|---|"];
    for (const term of s.glossary.terms.filter((x) => x.status === "authored")) {
      const label = inLocale(sourceText(term.prefLabel), t);
      const alts = (term.altLabel ?? []).map((x) => inLocale(x, t));
      const def = term.definition ? inLocale(sourceText(term.definition), t) : undefined;
      terms++;
      if (label.translated && (!def || def.translated) && alts.every((x) => x.translated)) translated++;
      out.push(`| **${mark(label)}** | ${alts.map(mark).join("; ") || "—"} | ${def ? mark(def) : "—"} |`);
    }
    return out;
  };
  const schemes = [...c.glossaries]
    .filter((g) => !g.extracted && g.glossary.terms.some((t) => t.status === "authored"))
    .sort((x, y) => templateName(x).localeCompare(templateName(y)));
  // The SOURCE page's structure (translation-drift compares it): ordered
  // schemes each under their own ###, then every other authored term together.
  const ordered = schemes.filter((s) => s.glossary.ordered);
  const rest = schemes.filter((s) => !s.glossary.ordered);
  const body: string[] = [];
  for (const s of ordered) body.push(`### ${esc(s.glossary.title)}`, "", ...table(s), "");
  if (ordered.length) body.push(`### ${mark(u("everyOther"))}`, "");
  for (const s of rest) body.push(`**${esc(s.glossary.title)}**`, "", ...table(s), "");
  const L = [
    "---",
    "layout: default",
    `title: "${titleTerm.replace(/"/g, '\\"')}"`,
    `lang: ${locale}`,
    "nav_exclude: true",
    GENERATED_FM,
    "translation_status: unverified",
    `translation_source: ${ROUTE}/index.md`,
    `available_locales: [${["en", ...locales].map((l) => `"${l}"`).join(", ")}]`,
    `description: "${locale}: ${translated}/${terms} — ${u("fullyTranslated").text.replace(/"/g, "'")}"`,
    "---",
    "",
    GENERATED,
    "",
    `# ${esc(titleTerm)}`,
    "",
    `**${translated} / ${terms}** ${mark(u("fullyTranslated"))}. ${mark(u("status"))}`,
    "",
    // Before `## Pages`, because `translation-drift` compares the ORDER of
    // headings and not merely their number: re-levelling or re-ordering one
    // keeps the count identical and is still drift (measured on this gate,
    // twice, which is why it records the full shape).
    `## ${mark(u("mapping"))}`,
    "",
    `${mark(u("mappingIntro"))}`,
    "",
    `${mark(u("mappingTableNote"))}`,
    "",
    mappingBlock(mappingStates(), [...new Set(c.glossaries.map((g) => g.glossary.id))]),
    "",
    `## ${mark(u("pages"))}`,
    "",
    `${mark(u("pagesNote"))} [${mark(u("sourcePage"))}]({{ '/${ROUTE}/' | relative_url }}).`,
    "",
    `## ${mark(u("authored"))}`,
    "",
    ...body,
    `## ${mark(u("sources"))}`,
    "",
    `### ${mark(u("sourcesAuthored"))}`,
    "",
    ...schemes.map((s) => `- \`${templateName(s)}\` — ${esc(s.file)}`),
    "",
    `### ${mark(u("sourcesExtracted"))}`,
    "",
    `[${mark(u("sourcePage"))}]({{ '/${ROUTE}/' | relative_url }})`,
    "",
  ];
  return L.join("\n") + "\n";
}

/**
 * Every asset type's pages, rendered: the type's own page, then its parts if
 * it is split. The index reads their sizes, a split type's being its parts'
 * total.
 */
export function typePagesOf(c: ReturnType<typeof collect>): Map<AssetType | PartKey, string> {
  return new Map(PAGE_KEYS.filter((k): k is AssetType | PartKey => k !== "index").map((k) => [k, renderTypePage(c, k)] as const));
}

/** Every layer's authored page, rendered. */
export function authoredPagesOf(c: ReturnType<typeof collect>): Map<AuthoredKey, string> {
  return new Map(authoredKeys(c).map((k) => [k, renderAuthoredPage(c, k)] as const));
}

/** Every glossary page, keyed by page, in {@link pageKeysOf}'s order. */
export function renderPages(c: ReturnType<typeof collect>): Map<PageKey, string> {
  const types = typePagesOf(c);
  const authored = authoredPagesOf(c);
  return new Map<PageKey, string>([["index", renderIndex(c, types, authored)], ...authored, ...types]);
}
/**
 * A scheme with every translated label and definition folded in as
 * per-language text (`{ en: source, fr: … }`), which `toSkos` already emits as
 * language-tagged `skos:prefLabel` / `skos:definition` (bean c592). Only what
 * a `.po` translates is added; the source stays `en`. Alternative labels stay
 * source-only: `altLabel` is a plain string list in `folio-glossary/v1`.
 */
export function withTranslations(
  s: GlossarySource,
  translations: ReadonlyMap<string, ReadonlyMap<string, SchemeTranslations>>,
): Glossary {
  const name = templateName(s);
  const per = [...translations].map(([loc, m]) => [loc, m.get(name)] as const).filter(([, m]) => m !== undefined) as [string, SchemeTranslations][];
  if (per.length === 0) return s.glossary;
  const lang = (t: LangText): LangText => {
    const src = sourceText(t);
    const extra = Object.fromEntries(per.map(([loc, m]) => [loc, m.get(src)]).filter(([, v]) => v));
    return Object.keys(extra).length ? { en: src, ...extra } : t;
  };
  return {
    ...s.glossary,
    terms: s.glossary.terms.map((t) =>
      t.status !== "authored" ? t : { ...t, prefLabel: lang(t.prefLabel), ...(t.definition ? { definition: lang(t.definition) } : {}) },
    ),
  };
}

/** Every file this generator owns, path → content. */
export function outputs(
  c: ReturnType<typeof collect>,
  translations: ReadonlyMap<string, ReadonlyMap<string, SchemeTranslations>> = readGlossaryTranslations(),
  mapping: { states: readonly SchemeState[] | undefined; agent: () => string | undefined } = {
    states: mappingStates(),
    agent: () => matchingAgentIri(),
  },
  unresolved: string[] = [],
): Map<string, string> {
  const out = new Map<string, string>([...renderPages(c)].map(([k, page]) => [pagePath(k), page] as const));
  for (const [p, page] of termPagesOf(c)) out.set(p, page);
  // Automated matches go into each scheme's SKOS (owner, 2026-10-02), in a
  // named graph marked as a program's work. See `toSkos`.
  const auto = automatedMatches(mapping.states, c.glossaries);
  unresolved.push(...auto.unresolved);
  const agent = auto.bySource.size ? mapping.agent() : undefined;
  // One page per locale that has a translation (bean c592).
  const locales = [...translations.keys()];
  for (const [locale, byScheme] of translations) out.set(localePagePath(locale), renderLocalePage(c, locale, byScheme, locales));
  // Each route this viewer writes on the host site marks itself as built at
  // publish (bean folio-assistant-uldr, owner option A, 2026-11-06): the host
  // names no route of a layer above it, and git, publish-check and the
  // mount's fixity all read this file instead of a hand-written host line.
  for (const route of [dirname(PAGE), ...locales.map((l) => dirname(localePagePath(l)))]) {
    out.set(join(route, ".gitignore"), ROUTE_IGNORE);
  }
  for (const s of c.glossaries) {
    // `_generated` SECOND, not first: `@context` and `$schema` each have a
    // reader that looks for them at the head — a JSON-LD processor and every
    // validator of `folio-glossary/v1` — so the declaration goes after them.
    // `declaresGenerated` parses rather than matching the first key (`ws99`),
    // which is what makes that free. On the SKOS side `_generated` is an
    // UNMAPPED term: the `@context` declares `skos` and `dcterms` and no
    // `@vocab`, so a JSON-LD processor drops it and the graph is unchanged.
    const matches = auto.bySource.get(sourceKey(s));
    const skos = toSkos(
      s.extracted ? s.glossary : withTranslations(s, translations),
      s.ns,
      matches ? { matches, agent } : undefined,
    );
    const { "@context": context, ...skosRest } = skos;
    out.set(join(SITE, skosAsset(s)), `${JSON.stringify({ "@context": context, _generated: GENERATED_JSON, ...skosRest }, null, 2)}\n`);
    if (s.extracted) {
      const { $schema, ...rest } = s.glossary;
      out.set(extractedFile(s), `${JSON.stringify({ $schema, _generated: GENERATED_JSON, ...rest }, null, 2)}\n`);
    }
  }
  return out;
}

/** Files under a directory, recursively. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/**
 * The SITE is cat-harness's `docs/`. Where the checkout MOUNTS cat-harness,
 * the pages and SKOS this writes are computed output and go to the layer's
 * output root (`build/layers/cat-harness/…`), never into the pinned mount;
 * `compose-docs` lays that twin over the mount (bean `cat-tools-sm8r`,
 * item 4). A path in no mount, such as a `--site` being built, is written
 * where it is.
 */
const MOUNTED = mountedInstances(REPO);
/** Where this run writes the file a reader finds at `p`. */
export function writeAt(p: string, root: string = REPO, mounted: Map<string, string> = MOUNTED): string {
  return outputTwinOf(root, p, mounted) ?? p;
}
/** Whether the file a reader finds at `p` (the output root, else the mount) is not `s`. */
function differs(p: string, s: string): boolean {
  const at = readPathAt(REPO, p, MOUNTED);
  return !existsSync(at) || readFileSync(at, "utf-8") !== s;
}
/**
 * The files this run owns under `dir`, named by their logical path (as a
 * reader finds them under `dir`). A mounted directory is judged at its output
 * root once one exists: the run writes its whole output there, and the pinned
 * bytes are not this run's to delete. Else the directory itself.
 */
export function ownedFilesUnder(dir: string, root: string = REPO, mounted: Map<string, string> = MOUNTED): string[] {
  const twin = writeAt(dir, root, mounted);
  if (twin === dir || !existsSync(twin)) return filesUnder(dir);
  return filesUnder(twin).map((f) => join(dir, relative(twin, f)));
}

/** What {@link collect} found, kept to the instances in `scope` (all of it with none). */
export function scoped<C extends Pick<ReturnType<typeof collect>, "glossaries" | "ledgers" | "external" | "declaring">>(c: C, scope: ReadonlySet<string> | undefined): C {
  if (scope === undefined) return c;
  const before = c.glossaries.length;
  const out = {
    ...c,
    glossaries: c.glossaries.filter((s) => scope.has(s.instance)),
    ledgers: c.ledgers.filter((l) => scope.has(l.instance)),
    external: c.external.filter((e) => scope.has(e.instance)),
    declaring: c.declaring.filter((d) => scope.has(d)),
  };
  console.log(`  scope ${scopeLabel(scope)}: ${out.glossaries.length} of ${before} scheme(s)`);
  return out;
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const c = scoped(collect(), siteScopeArg());
  if (c.findings.invalid.length) {
    console.error(`✗ ${c.findings.invalid.length} glossary document(s) do not validate as folio-glossary/v1:`);
    for (const f of c.findings.invalid) console.error(`  ${f}`);
    process.exit(1);
  }
  await loadDepictions(REPO, c);
  await loadProvenance(REPO, c);
  const unresolved: string[] = [];
  const files = written(outputs(c, undefined, undefined, unresolved));
  // Reported, never fatal: a match the record cannot place is left out of the
  // SKOS rather than invented, and this says which and why.
  for (const u of unresolved) console.warn(`! automated match not published: ${u}`);
  // Stale output: a scheme removed or renamed leaves its old SKOS behind, and
  // an asset type or layer that stops contributing leaves its generated
  // scheme. Both directories are this generator's alone.
  // The glossary's own pages directory is this generator's too: a page for
  // an asset type that is no longer extracted is an orphan.
  // Each locale's glossary directory is this generator's own too (bean c592):
  // a locale whose last .po is removed leaves an orphan page.
  const siteTwin = outputTwinOf(REPO, SITE, MOUNTED);
  const localeDirs = [...new Set([SITE, writeAt(SITE)].filter((d) => existsSync(d)).flatMap((d) => readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)))]
    .map((name) => (ROUTE_SEGMENT.test(name) ? dirname(localePagePath(name)) : undefined))
    .filter((d): d is string => d !== undefined && existsSync(readPathAt(REPO, join(d, "index.md"), MOUNTED)));
  // The pages this generator wrote at the address before the `en/` segment
  // (owner, 2026-10-16, "c") are its own orphans now: the move deletes them,
  // and the composed site forwards that address to the page under `en/`.
  const legacyDir = visualiserPageDir(SITE, forwardingParts(PARTS));
  const orphans = [...new Set([...ownedFilesUnder(ASSETS), ...(INTO_SITE ? [] : allGeneratedDirs().filter((g) => !inMount(g)).flatMap(filesUnder)), ...ownedFilesUnder(dirname(PAGE)), ...localeDirs.flatMap((d) => ownedFilesUnder(d)), ...ownedFilesUnder(legacyDir)])]
    .filter((p) => !files.has(p));
  const computedHere = siteTwin !== undefined && existsSync(siteTwin);
  const pinnedOrphans = computedHere
    ? [...new Set([...filesUnder(ASSETS), ...filesUnder(dirname(PAGE)), ...localeDirs.flatMap(filesUnder), ...filesUnder(legacyDir)])]
        .filter((p) => !files.has(p) && writeAt(p) !== p && !existsSync(writeAt(p)))
    : [];
  const stale = [...files].filter(([p, s]) => differs(p, s)).map(([p]) => p);
  const n = counts(c);
  const summary = `${n.authored} authored + ${n.extracted} extracted terms, ${c.glossaries.length} scheme(s), ${c.ledgers.length} swimlane ledger(s), ${c.external.length} external scheme(s)`;
  const keys = pageKeysOf(c).filter((k) => files.has(pagePath(k)));
  const over = keys.filter((k) => Buffer.byteLength(files.get(pagePath(k))!, "utf-8") > budgetOf(k));
  for (const k of over) {
    console.error(`✗ over budget: ${relative(REPO, pagePath(k))} is ${sizeLabel(Buffer.byteLength(files.get(pagePath(k))!, "utf-8"))}, budget ${sizeLabel(budgetOf(k))}. Split it further; do not raise the budget.`);
  }
  if (over.length) process.exit(1);
  if (check) {
    // Once this checkout has computed the site at the mounted layer's output
    // root, an orphan left only in the pinned mount is that layer's to drop
    // at its next pin, which no run here can do: reported, never charged.
    for (const p of pinnedOrphans) console.log(`! orphan in the pinned mount, left until the layer is re-pinned: ${relative(REPO, p)}`);
    if (stale.length || orphans.length) {
      for (const p of stale) console.error(`✗ stale: ${relative(REPO, p)}`);
      for (const p of orphans) console.error(`✗ orphan: ${relative(REPO, p)}`);
      console.error("Run `bun run cat glossary:page` and commit the result.");
      process.exit(1);
    }
    console.log(`✓ glossary page current: ${summary}`);
    process.exit(0);
  }
  for (const [p, s] of files) {
    const at = writeAt(p);
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, s);
  }
  // An orphan is this generator's own output for a scheme that is gone. It is
  // removed where this run writes; one in a pinned mount stays until re-pin.
  for (const p of orphans) rmSync(writeAt(p), { force: true });
  for (const p of pinnedOrphans) console.log(`! ${relative(REPO, p)} is an orphan in the pinned mount — left until the layer is re-pinned`);
  // ONE WRITE IS NOT A FIXED POINT, so render again until nothing moves.
  //
  // `mappingStates` runs `check:term-mapping`, which reads every
  // `*.glossary.json` FROM DISK — including the extracted schemes this run has
  // just rewritten under `generatedDir()`. So the pages and SKOS rendered
  // above carry the mapping counts of the PREVIOUS extraction: measured on
  // 2026-10-14 (core main 82b6eba, cat-harness main ce2e9c61, the
  // folio-assistant#2529 pins), one `glossary:page` wrote the five locale
  // pages with `fhir … 3731` while the extraction it had just written held
  // 3748 terms, and the `--check` that followed failed them as stale — the
  // command the failure message tells you to run did not clear it. Rendering
  // again against what was written settles in one more pass; the bound turns
  // a generator that never settles into a loud failure rather than a loop.
  for (let pass = 2; ; pass++) {
    const again = written(outputs(c));
    const moved = [...again].filter(([p, s]) => differs(p, s));
    if (!moved.length) break;
    if (pass > 3) {
      console.error(`✗ glossary:page did not settle after ${pass - 1} passes; still moving: ${moved.map(([p]) => relative(REPO, p)).join(", ")}`);
      process.exit(1);
    }
    for (const [p, s] of moved) {
      const at = writeAt(p);
      mkdirSync(dirname(at), { recursive: true });
      writeFileSync(at, s);
    }
  }
  const sizes = keys.map((k) => `${relative(REPO, pagePath(k))} ${sizeLabel(Buffer.byteLength(files.get(pagePath(k))!, "utf-8"))}`).join(", ");
  console.log(`Wrote ${keys.length} page(s) (${sizes}), ${c.glossaries.length} SKOS file(s) and ${c.glossaries.filter((s) => s.extracted).length} extracted scheme(s): ${summary}.`);
}
