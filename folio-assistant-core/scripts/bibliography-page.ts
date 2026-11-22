/**
 * The bibliography/ pages: every reference in the KG, viewable and exportable
 * whole, per sub-graph, and per reference (bean folio-assistant-63q4).
 *
 * Owner, 2026-10-14: *"there should be a bibliography viewer that allows
 * view/export in multiple formats of bib items in the folio … also be able to
 * export biblio reference for a single asset/paper … also be able to view (and
 * later add) things in biblio not in library assets (like dublin core records,
 * they are own nodes) … biblio viewer should work similar to glossary viewer
 * … use path limit to subgraphs and specific assets"*.
 *
 * ## What it reads
 *
 * Every declared directory of every layer in the checkout, as the glossary
 * page does:
 * - a `references` directory: each `*.json` file is a `folio-reference/v1`
 *   node (`schemas/reference.ts`);
 * - a `catalogue` directory: each `records/<slug>.dc.json` Dublin Core record
 *   becomes a reference node keyed `<slug>` (`dublinCoreToReference`), with
 *   `provenance: catalogue` and `derivedFrom` its record.
 *
 * One node type for both, so an IRIS catalogue item and a qou citation are listed,
 * filtered and exported the same way.
 *
 * ## What it writes, at the declared route
 *
 * The route is the `bibliography` visualiser core declares
 * (`folio-assistant-core.json`), computed by `visualiserRoute`, never spelled
 * here. Its three levels follow the route rule:
 *
 * | route | holds |
 * |---|---|
 * | `<route>/` | every reference |
 * | `<route>/<sub-graph>/` | the references of one declared directory |
 * | `<route>/<sub-graph>/#<key>` | one reference, with its own export |
 *
 * On a site that is its own index (a layer declared at the checkout root,
 * such as smart-ra), that layer is the site's own: the whole page lists its
 * references first, then every other layer's in a closed "From dependencies"
 * section grouped by layer, so a reader sees the site's own bibliography
 * without the layers below it (owner, 2026-11-01). A sub-graph id two layers
 * share (`library`) gets one page per layer: a dependency's is
 * `<instance>-<id>`.
 *
 * Beside each page are its exports: `references.bib`, `references.csl.json`,
 * `references.ris` and `references.jsonld` (Dublin Core / BIBO). One
 * reference's export is on its entry: the page carries each entry's BibTeX,
 * RIS and CSL-JSON, and a download link saves it. There is no per-reference
 * file: qou alone would be 915 × 4 files for text the page already holds.
 *
 * `--check` writes nothing, and fails when a node does not validate, a key
 * is claimed twice in one sub-graph, or the output on disk is stale. The pages
 * are built at publish, never committed (cat-harness `builtAtPublish`, entry
 * `docs/en/folio-assistant-core/bibliography/`), so the gate is `check:bibliography`:
 * `publish-check.ts bibliography:page` builds them and then runs this check.
 *
 * Usage:  bun run folio-assistant-core/scripts/bibliography-page.ts [--check]
 *
 * @module folio-assistant-core/scripts/bibliography-page
 * @covers references, catalogue, docs — it reads every layer's references and catalogue directories
 */
import { scopeLabel, siteScopeArg } from "./lib/site-scope.ts";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { libraryEntries } from "./lib/library-entries.ts";
import { buildSearchIndex, searchHtml, type SearchRecord } from "./bibliography-search.ts";

import { instanceDirectoryForGraph, instanceRootsIn, readDeclaration, repoRootFor, resolveDirectories } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.ts";
import { safeHref } from "@litlfred/cat-harness-tools/schemas/ui/safe-url.ts";
import { declaredPageRoute } from "@litlfred/cat-harness-tools/scripts/viewer-declarations.ts";
import { siteTarget } from "@litlfred/cat-harness-tools/scripts/lib/site-target.ts";
import { DublinCoreRecordSchema } from "../schemas/dublin-core.ts";
import {
  REFERENCE_CONTEXT,
  REFERENCE_SCHEMA_TAG,
  ReferenceNodeSchema,
  buildStandaloneReference,
  dublinCoreToReference,
  jsonLdToReferenceNode,
  libraryItemToReference,
  nameText,
  newReferenceUrl,
  parseBibtexOrCsl,
  referenceIri,
  referenceSegment,
  sourcesOf,
  toBibtex,
  toCslJson,
  toDublinCoreXml,
  toJsonLdGraph,
  toRis,
  yearOf,
  type ReferenceNode,
  type StandaloneReferenceInput,
} from "../schemas/reference.ts";

export { buildStandaloneReference, newReferenceUrl, parseBibtexOrCsl, type StandaloneReferenceInput };

const CORE = resolve(import.meta.dir, "..");
const REPO = repoRootFor(CORE);
// declared-path-literal: the platform site the page publishes to, which is
// cat-harness's `docs/`; core owns the page, the harness owns the site. The
// glossary page publishes to the same place for the same reason.
// `--site <dir>`: a site being built (a repository's own, `visualiser-writers.ts`)
// gets the same route under it; its harness docs are a pinned mount.
const SITE = siteTarget(join(REPO, "cat-harness", "docs"));
/** The route of the visualiser core declares for its bibliography, from `folio-assistant-core.json`. */
const ROUTE = declaredPageRoute(CORE, "bibliography-page") ?? "en/folio-assistant-core/bibliography";
const ROOT = join(SITE, ...ROUTE.split("/"));

const GENERATED_BY = "folio-assistant-core/scripts/bibliography-page.ts";
/** A route of this viewer on the host site is never committed: everything in it, this file included, is written at publish. */
export const ROUTE_IGNORE = `# Generated by ${GENERATED_BY}: this viewer route is built at publish, never committed (bean folio-assistant-uldr).\n*\n`;
const GENERATED = `<!-- Generated by ${GENERATED_BY}. Do not hand-edit: \`check:bibliography\` fails on the difference. -->`;
const GENERATED_FM = `generated: ${GENERATED_BY} — do not hand-edit; run \`bun run cat bibliography:page\``;

/** One reference, and where it was found. */
export interface Entry {
  ref: ReferenceNode;
  /** The layer whose declaration holds the directory. */
  instance: string;
  /** The declared directory's id: the route's `<sub-graph>`. */
  subgraph: string;
  /** Repo-relative path of the file it was read from. */
  file: string;
}

export interface AssetView {
  /** The sub-graph id. */
  subgraph: string;
  /** The sub-graph's route segment (`<route>/<slug>/<asset>/`): see {@link SubgraphView.slug}. */
  slug: string;
  /** The asset slug within the sub-graph. */
  asset: string;
  /** Layer name. */
  instance: string;
  /** Repo-relative path of the asset directory or file. */
  path: string;
  /** The asset's own reference (when any) plus references derived from or extracted from it. */
  entries: Entry[];
}

/** One scanned sub-graph. */
export interface SubgraphView {
  id: string;
  instance: string;
  kind: "references" | "catalogue" | "library";
  path: string;
  /**
   * Its route segment (`<route>/<slug>/`). The id itself, unless another
   * layer declares the same id: then a dependency's is `<instance>-<id>`,
   * so each layer's `library` gets its own page instead of sharing one.
   */
  slug: string;
}

export interface Collected {
  entries: Entry[];
  /** Every sub-graph that was scanned, with its layer, so an empty one is still listed. */
  subgraphs: SubgraphView[];
  /**
   * The layer the site belongs to: the one declared at the checkout root
   * (a repository that is its own index, such as smart-ra). Every other
   * layer in the checkout is one of its dependencies. `undefined` when no
   * layer is declared at the root (the platform monorepo): then no
   * layer is singled out and the page is one list.
   */
  own?: string;
  /** Per-asset bibliography views (`<route>/<sub-graph>/<asset>/`). */
  assets: AssetView[];
  invalid: string[];
}

const rel = (repo: string, p: string) => relative(repo, p).split("\\").join("/");

/**
 * The library copy each catalogue record describes, when one is held: an item
 * node (`nodes/*.json`, `folio-catalogue-node/v1`) names its record by
 * `metadataRef` and its library asset by `libraryId`, and the copy is held
 * when the layer's declared `library` directory has that asset. Keyed by
 * the record's path relative to the catalogue directory.
 */
export function heldCopies(instanceRoot: string, catalogueDir: string): Map<string, string> {
  const out = new Map<string, string>();
  const nodes = join(catalogueDir, "nodes");
  const library = instanceDirectoryForGraph(instanceRoot, "library");
  if (!existsSync(nodes) || library === undefined) return out;
  for (const f of readdirSync(nodes).filter((f) => f.endsWith(".json"))) {
    const n = JSON.parse(readFileSync(join(nodes, f), "utf-8")) as { metadataRef?: string; libraryId?: string };
    if (!n.metadataRef || !n.libraryId) continue;
    const asset = join(library, n.libraryId);
    if (existsSync(asset)) out.set(n.metadataRef.replace(/^catalogue\//, ""), asset);
  }
  return out;
}

/** Every reference in the checkout. */
export function collect(repo: string = REPO): Collected {
  const out: Collected = { entries: [], subgraphs: [], assets: [], invalid: [] };
  const scanned: Omit<SubgraphView, "slug">[] = [];
  const rawLibraryAssets: { subgraph: string; asset: string; instance: string; path: string; ownEntry: Entry; catalogued?: boolean }[] = [];
  for (const root of instanceRootsIn(repo)) {
    const decl = readDeclaration(root);
    if (!decl) continue;
    if (resolve(root) === resolve(repo)) out.own = decl.name;
    const dirs = resolveDirectories([{ name: decl.name, root, own: true }]).filter((d) => d.own);
    const heldByCatalogue = new Set<string>();
    for (const d of dirs) {
      if (existsSync(d.absPath) && (d.graphTypologies ?? []).includes("catalogue")) {
        for (const heldPath of heldCopies(root, d.absPath).values()) {
          heldByCatalogue.add(heldPath);
        }
      }
    }
    for (const d of dirs) {
      if (!existsSync(d.absPath)) continue;
      const kinds = d.graphTypologies ?? [];
      const push = (ref: ReferenceNode, file: string): Entry => {
        const entry: Entry = { ref, instance: decl.name, subgraph: d.id, file };
        out.entries.push(entry);
        return entry;
      };
      if (kinds.includes("references")) {
        scanned.push({ id: d.id, instance: decl.name, kind: "references", path: rel(repo, d.absPath) });
        const jsonFiles = readdirSync(d.absPath).filter((f) => f.endsWith(".json")).sort();
        const jsonBases = new Set(jsonFiles.map((f) => f.slice(0, -5)));
        for (const f of jsonFiles) {
          const p = join(d.absPath, f);
          let raw: unknown;
          try {
            raw = JSON.parse(readFileSync(p, "utf-8"));
          } catch (e) {
            out.invalid.push(`${rel(repo, p)}: not valid JSON (${e instanceof Error ? e.message : String(e)})`);
            continue;
          }
          const r = ReferenceNodeSchema.safeParse(raw);
          if (!r.success) {
            out.invalid.push(`${rel(repo, p)}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
            continue;
          }
          if (`${r.data.id}.json` !== f) {
            out.invalid.push(`${rel(repo, p)}: the file is named for "${f.slice(0, -5)}" but its key is "${r.data.id}"`);
            continue;
          }
          push(r.data, rel(repo, p));
        }
        const jsonldFiles = readdirSync(d.absPath)
          .filter((f) => f.endsWith(".jsonld") && !jsonBases.has(f.slice(0, -7)))
          .sort();
        for (const f of jsonldFiles) {
          const p = join(d.absPath, f);
          let raw: unknown;
          try {
            raw = JSON.parse(readFileSync(p, "utf-8"));
          } catch (e) {
            out.invalid.push(`${rel(repo, p)}: not valid JSON (${e instanceof Error ? e.message : String(e)})`);
            continue;
          }
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            out.invalid.push(`${rel(repo, p)}: expected a JSON-LD object`);
            continue;
          }
          let node: ReferenceNode;
          try {
            node = jsonLdToReferenceNode(raw as Record<string, unknown>);
          } catch (e) {
            out.invalid.push(`${rel(repo, p)}: ${e instanceof Error ? e.message : String(e)}`);
            continue;
          }
          if (`${node.id}.jsonld` !== f) {
            out.invalid.push(`${rel(repo, p)}: the file is named for "${f.slice(0, -7)}" but its key is "${node.id}"`);
            continue;
          }
          push(node, rel(repo, p));
        }
      }
      if (kinds.includes("catalogue")) {
        const records = join(d.absPath, "records");
        if (!existsSync(records)) continue;
        scanned.push({ id: d.id, instance: decl.name, kind: "catalogue", path: rel(repo, d.absPath) });
        const held = heldCopies(root, d.absPath);
        // A held copy is a document too: its extracted reference lists are its
        // own bibliography, at `<route>/<library sub-graph>/<asset>/`, with the
        // catalogue record as the document's own reference (owner, 2026-11-11).
        const libraryDir = dirs.find((x) => (x.graphTypologies ?? []).includes("library"));
        for (const f of readdirSync(records).filter((f) => f.endsWith(".dc.json")).sort()) {
          const p = join(records, f);
          const raw = JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown>;
          // Top-level `_` keys are notes for a person reading the file, not
          // metadata; check-catalogue.ts and dc-render.ts strip them the same way.
          for (const k of Object.keys(raw)) if (k.startsWith("_")) delete raw[k];
          const r = DublinCoreRecordSchema.safeParse(raw);
          if (!r.success) {
            out.invalid.push(`${rel(repo, p)}: not a folio-dublin-core/v1 record: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
            continue;
          }
          const key = basename(f, ".dc.json");
          const heldAt = held.get(`records/${f}`);
          try {
            const own = push(dublinCoreToReference(r.data, { key, derivedFrom: rel(repo, p), ...(heldAt ? { heldAt: rel(repo, heldAt) } : {}) }), rel(repo, p));
            if (heldAt && libraryDir) {
              rawLibraryAssets.push({ subgraph: libraryDir.id, asset: basename(heldAt), instance: decl.name, path: rel(repo, heldAt), ownEntry: own, catalogued: true });
            }
          } catch (e) {
            out.invalid.push(`${rel(repo, p)}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }
      if (kinds.includes("library")) {
        // Flat or filed in a concern group (bean `6fez`): the slug is the key either way.
        const standaloneAssets = libraryEntries(d.absPath).filter(
          ({ dir }) => existsSync(join(dir, "manifest.jsonld")) && !heldByCatalogue.has(dir),
        );
        if (standaloneAssets.length > 0) {
          scanned.push({ id: d.id, instance: decl.name, kind: "library", path: rel(repo, d.absPath) });
          for (const { slug, dir: assetDir } of standaloneAssets) {
            const manifestRel = rel(repo, join(assetDir, "manifest.jsonld"));
            const assetRel = rel(repo, assetDir);
            try {
              const ref = libraryItemToReference(assetDir, { key: slug, derivedFrom: manifestRel, heldAt: assetRel });
              const ownEntry = push(ref, manifestRel);
              rawLibraryAssets.push({ subgraph: d.id, asset: slug, instance: decl.name, path: assetRel, ownEntry });
            } catch (e) {
              out.invalid.push(`${manifestRel}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        }
      }
    }
  }
  // A key is the citation's whole identity within its sub-graph.
  const seen = new Map<string, string>();
  for (const e of out.entries) {
    const k = `${e.subgraph}\0${e.ref.id}`;
    const prior = seen.get(k);
    if (prior) out.invalid.push(`${e.file}: key "${e.ref.id}" is already ${prior}'s in sub-graph ${e.subgraph}`);
    else seen.set(k, e.file);
  }
  out.entries.sort(byCitation);
  const instancesOf = new Map<string, Set<string>>();
  for (const s of scanned) instancesOf.set(s.id, (instancesOf.get(s.id) ?? new Set()).add(s.instance));
  const slugOf = (id: string, instance: string) => ((instancesOf.get(id)?.size ?? 0) > 1 && instance !== out.own ? `${instance}-${id}` : id);
  out.subgraphs = scanned.map((s) => ({ ...s, slug: slugOf(s.id, s.instance) }));
  out.subgraphs.sort((a, b) => a.slug.localeCompare(b.slug, "en"));

  // Build per-asset bibliography views (`<route>/<sub-graph>/<asset>/`):
  // each standalone library asset holds its own reference plus any references
  // extracted or derived from that asset.
  for (const la of rawLibraryAssets) {
    const extracted = out.entries.filter(
      (e) =>
        e !== la.ownEntry &&
        ((e.ref.derivedFrom !== undefined && (e.ref.derivedFrom === la.path || e.ref.derivedFrom.startsWith(`${la.path}/`))) ||
          // A catalogued copy's page is its own reference list: an entry that
          // only CITES it (heldAt) belongs to the document that printed it.
          (!la.catalogued && e.ref.heldAt !== undefined && (e.ref.heldAt === la.path || e.ref.heldAt.startsWith(`${la.path}/`)))),
    );
    // A catalogued copy gets a page only when something was extracted from it.
    if (la.catalogued && !extracted.some((e) => e.ref.provenance === "extracted")) continue;
    if (la.catalogued && !scanned.some((s) => s.id === la.subgraph && s.instance === la.instance)) {
      scanned.push({ id: la.subgraph, instance: la.instance, kind: "library", path: dirname(la.path) });
      out.subgraphs.push({ id: la.subgraph, instance: la.instance, kind: "library", path: dirname(la.path), slug: slugOf(la.subgraph, la.instance) });
      out.subgraphs.sort((a, b) => a.slug.localeCompare(b.slug, "en"));
    }
    // The document's own reference first, then its reference list in the order the document prints it.
    const assetEntries = la.catalogued ? [la.ownEntry, ...extracted.sort(byPrintedOrder)] : [la.ownEntry, ...extracted].sort(byCitation);
    out.assets.push({
      subgraph: la.subgraph,
      slug: slugOf(la.subgraph, la.instance),
      asset: la.asset,
      instance: la.instance,
      path: la.path,
      entries: assetEntries,
    });
  }
  out.assets.sort((a, b) => a.slug.localeCompare(b.slug, "en") || a.asset.localeCompare(b.asset, "en"));
  return out;
}

/** An extracted list in the document's order: by section, then the entry's number in it (`<doc>.<section>.<n>`). */
export function byPrintedOrder(a: Entry, b: Entry): number {
  const k = (e: Entry) => {
    const m = /^(.*)\.(\d+)$/.exec(e.ref.id);
    return m ? ([m[1]!, Number(m[2])] as const) : ([e.ref.id, 0] as const);
  };
  const [x, y] = [k(a), k(b)];
  return x[0].localeCompare(y[0], "en", { numeric: true }) || x[1] - y[1];
}

/** First author's name, then year, then title, then key: how a reference list is read. */
export function byCitation(a: Entry, b: Entry): number {
  const k = (e: Entry) => [e.ref.author?.[0] ? nameText(e.ref.author[0]) : e.ref.title ?? e.ref.id, yearOf(e.ref) ?? "", e.ref.title ?? "", e.ref.id];
  const [x, y] = [k(a), k(b)];
  for (let i = 0; i < x.length; i++) {
    const c = x[i]!.localeCompare(y[i]!, "en", { sensitivity: "base" });
    if (c) return c;
  }
  return 0;
}

// ── Rendering ────────────────────────────────────────────────────────────────

const esc = (s: string) =>
  s
    .replace(/\s*\r?\n\s*/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** The path segment of one reference's own page (`referenceSegment`, shared with the links to it). */
export const segmentOf = referenceSegment;

/** One reference as a readable citation: authors (year). Title. Container, vol(issue), pages. Publisher. */
export function citationHtml(r: ReferenceNode): string {
  // An entry with no title, which an extracted reference often is (its parser
  // sets a field only when the style says which it is), keeps the citation as
  // the source printed it: say that text rather than a bare "(2025).".
  if (!r.title) {
    const asPrinted = r.printed ?? (typeof r.note === "string" ? r.note : undefined);
    if (asPrinted?.trim()) return `<span class="as-printed">${esc(asPrinted.trim())}</span>`;
  }
  const parts: string[] = [];
  const authors = (r.author ?? []).map(nameText);
  if (authors.length) parts.push(esc(authors.length > 3 ? `${authors.slice(0, 3).join("; ")}; et al.` : authors.join("; ")));
  const y = yearOf(r);
  if (y) parts.push(`(${esc(y)})`);
  let s = parts.join(" ");
  if (r.title) s += `${s ? ". " : ""}<cite>${esc(r.title)}</cite>`;
  const where = [
    r["container-title"] ? `<i>${esc(r["container-title"])}</i>` : "",
    r.volume !== undefined ? `${esc(String(r.volume))}${r.issue !== undefined ? `(${esc(String(r.issue))})` : ""}` : "",
    r.page ? esc(r.page) : "",
  ].filter(Boolean);
  if (where.length) s += `. ${where.join(", ")}`;
  if (r.publisher) s += `. ${esc(r.publisher)}`;
  return `${s}.`;
}

/** The links an entry carries: DOI, URL (checked via `safeHref`), its source, the library copy. */
export function linksHtml(e: Entry): string {
  const r = e.ref;
  const l: string[] = sourcesOf(r).map((src) => sourceLinkHtml(src, src.kind === "canonical" ? "link" : undefined));
  if (r.ISBN) l.push(`ISBN ${esc(r.ISBN)}`);
  l.push(`source: <code>${esc(e.file)}</code>`);
  if (r.heldAt) l.push(`held: <code>${esc(r.heldAt)}</code>`);
  return l.join(" · ");
}

/** One source as a link, or as code when its address is no safe link. */
function sourceLinkHtml(src: { url: string; label?: string; kind?: string }, text?: string): string {
  const href = safeHref(src.url);
  const shown = esc(text ?? src.label ?? src.url.replace(/^https?:\/\//, ""));
  return href ? `<a href="${esc(href)}" rel="noopener">${shown}</a>` : `<code>${esc(src.url)}</code>`;
}

/** The href, from the page being written, of an entry's own page. */
export type HrefOf = (e: Entry) => string;

/** One reference's own export, as download links carrying the text. */
function exportLinksHtml(r: ReferenceNode): string {
  const dl = (fmt: string, text: string, mime: string, ext: string) =>
    `<a download="${esc(r.id)}.${ext}" href="data:${mime};charset=utf-8,${encodeURIComponent(text)}">${fmt}</a>`;
  return `${dl("BibTeX", toBibtex([r]), "application/x-bibtex", "bib")} · ${dl("RIS", toRis([r]), "application/x-research-info-systems", "ris")} · ${dl("CSL-JSON", toCslJson([r]), "application/vnd.citationstyles.csl+json", "csl.json")} · ${dl("DC XML", toDublinCoreXml([r]), "application/xml", "dc.xml")}`;
}

/**
 * One entry of a list: the citation, its key (a link to the entry's own page,
 * which the side panel loads), its provenance and links, and its own export.
 * No `id`: an entry is addressed by its page, never by an anchor (owner,
 * 2026-11-08, "clean break old IRIs").
 */
export function entryHtml(e: Entry, hrefOf: HrefOf = (x) => `${referenceSegment(x.ref.id)}/`): string {
  const r = e.ref;
  const href = esc(hrefOf(e));
  const words = esc([r.id, r.title ?? r.printed ?? "", ...(r.author ?? []).map(nameText), yearOf(r) ?? ""].join(" "));
  // An entry with no page of its own (an extracted reference, see `hasOwnPage`)
  // carries its detail inline, and the side panel shows that; its own export
  // is there too, not repeated in the list.
  const open = href
    ? `<a class="fa-bib-open" href="${href}"><code>${esc(r.id)}</code></a>`
    : `<button type="button" class="fa-bib-open"><code>${esc(r.id)}</code></button>`;
  return `<li data-fa-bib-key="${esc(r.id)}" ${href ? `data-fa-bib-href="${href}"` : "data-fa-bib-inline"} data-fa-bib="${words}">
  ${citationHtml(r)}<br>
  <small>${open} · ${esc(r.provenance ?? "authored")} · ${linksHtml(e)}${href ? `<br>
  export: ${exportLinksHtml(r)}` : ""}</small>${href ? "" : `\n  <template class="fa-bib-inline">${detailHtml(e)}</template>`}
</li>`;
}

/**
 * Whether a reference gets a page of its own. A reference EXTRACTED from a
 * document's reference list does not: it is read on its document's page, in
 * the side panel. At IRIS scale they were 7,219 pages of the 8,576 in the
 * route (owner, 2026-11-15, card Q-BIBSCALE-2: "A. Summaries, panel, no lunr").
 */
export const hasOwnPage = (e: Entry) => e.ref.provenance !== "extracted";

/**
 * A list longer than this is not written out on a page: the page summarises
 * it (counts, and links to the sub-graphs and documents that hold it), and
 * the exports beside the page still carry every reference. The whole IRIS
 * list was a 24 MB page (Q-BIBSCALE-2).
 */
export const LIST_LIMIT = 500;

const nameList = (ns: ReferenceNode["author"]) => (ns ?? []).map(nameText).join("; ");
const dateText = (d: unknown): string | undefined => {
  const v = d as { "date-parts"?: unknown[][]; raw?: string; literal?: string } | undefined;
  if (!v) return undefined;
  if (Array.isArray(v["date-parts"]) && Array.isArray(v["date-parts"][0])) return v["date-parts"][0].join("-");
  return v.raw ?? v.literal;
};

/**
 * Everything one reference holds, as its own page shows it and the side
 * panel loads it (`.fa-bib-detail`): the citation, every bibliographic field,
 * every place the work can be read, where it sits in the KG, and its export.
 */
export function detailHtml(e: Entry, opts: { listHref?: string; listLabel?: string } = {}): string {
  const r = e.ref as ReferenceNode & Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === "string" || typeof r[k] === "number" ? String(r[k]) : undefined);
  const rows: [string, string | undefined][] = [
    ["Title", r.title],
    ["Authors", nameList(r.author) || undefined],
    ["Editors", nameList(r.editor) || undefined],
    ["Issued", dateText(r.issued)],
    ["Type", r.type],
    ["In", r["container-title"]],
    ["Volume", str("volume")],
    ["Issue", str("issue")],
    ["Pages", r.page],
    ["Publisher", r.publisher],
    ["Place", str("publisher-place")],
    ["Version", str("version")],
    ["ISBN", r.ISBN],
    ["DOI", r.DOI],
    ["Language", r.language],
    ["Accessed", dateText(r.accessed)],
    ["As printed", r.printed],
    ["Note", str("note")],
    ["Abstract", r.abstract],
  ];
  const fields = rows
    .filter((x): x is [string, string] => typeof x[1] === "string" && x[1].trim() !== "")
    .map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`)
    .join("\n");
  const sources = sourcesOf(r);
  const sourceList = sources.length
    ? `<ul class="fa-bib-sources">\n${sources.map((src) => `<li>${sourceLinkHtml(src)}${src.kind ? ` <small>(${esc(src.kind)})</small>` : ""}</li>`).join("\n")}\n</ul>`
    : "<p>No link to the work is recorded for this reference.</p>";
  const kg = [
    `IRI <code>${esc(referenceIri(r.id))}</code>`,
    `provenance: ${esc(r.provenance ?? "authored")}`,
    `read from <code>${esc(e.file)}</code> (${esc(e.instance)}, sub-graph ${esc(e.subgraph)})`,
    r.derivedFrom && r.derivedFrom !== e.file ? `derived from <code>${esc(r.derivedFrom)}</code>` : "",
    r.heldAt ? `library copy: <code>${esc(r.heldAt)}</code>` : "",
  ].filter(Boolean);
  return `<section class="fa-bib-detail" data-fa-bib-key="${esc(r.id)}">
<p class="fa-bib-cite">${citationHtml(r)}</p>
<dl class="fa-bib-fields">
${fields}
</dl>
<h3>Sources</h3>
${sourceList}
<h3>In the knowledge graph</h3>
<ul>
${kg.map((x) => `<li>${x}</li>`).join("\n")}
</ul>
<p><strong>Export:</strong> ${exportLinksHtml(r)}</p>
${opts.listHref ? `<p><a href="${esc(opts.listHref)}">${esc(opts.listLabel ?? "All references")}</a></p>` : ""}
</section>`;
}

/** A plain-text title for a reference's own page. */
export function entryTitle(r: ReferenceNode): string {
  const t = r.title ?? r.printed ?? (typeof r.note === "string" ? r.note : undefined) ?? r.id;
  const one = t.replace(/\s+/g, " ").trim();
  return one.length > 120 ? `${one.slice(0, 117)}…` : one;
}

/** A YAML double-quoted string. */
function yamlQuoted(s: string): string {
  // Control characters are escaped, never written raw: YAML refuses them even
  // inside a double-quoted scalar, and one such title stops the whole build.
  return `"${s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`)}"`;
}

/**
 * Where a page sits in the site's Pages list: just-the-docs' `parent` and
 * `grand_parent`, by title. Every page of the route nests under the
 * `Bibliography` page: a sub-graph page under it, and a reference's own page
 * or a library asset's page under its sub-graph's page (owner, 2026-11-10:
 * entry pages were listed at the top level of the Pages list).
 */
export interface NavParent {
  parent: string;
  grandParent?: string;
}

function navParentFm(u: NavParent | undefined): string {
  if (u === undefined) return "";
  return `parent: ${yamlQuoted(u.parent)}\n${u.grandParent !== undefined ? `grand_parent: ${yamlQuoted(u.grandParent)}\n` : ""}`;
}

/**
 * The title of the route's page, and of one sub-graph's page. just-the-docs
 * finds a page's children by TITLE across the whole composed site, so a
 * layer's own bibliography composed at `/<layer>/` (`--instance`) names its
 * layer: with five trees all titled `Bibliography` / `Bibliography: <slug>`,
 * every copy adopted every other copy's children, the nav grew multiplicatively
 * and the docs-site Jekyll build ran the hosted runner out of resources
 * (folio-assistant run 42942756201).
 */
const BIB_TITLE = "Bibliography";
const bibTitle = (layer?: string) => (layer ? `${BIB_TITLE} (${layer})` : BIB_TITLE);
const subgraphTitle = (slug: string, layer?: string) => `${bibTitle(layer)}: ${slug}`;
/** A page under one sub-graph's page. */
const underSubgraph = (slug: string, layer?: string): NavParent => ({ parent: subgraphTitle(slug, layer), grandParent: bibTitle(layer) });

/**
 * A reference's own page: `<route>/<sub-graph>/<key>/`, under its sub-graph's
 * page. It is kept out of the sidebar (`nav_exclude`), as glossary term pages
 * are: just-the-docs writes the whole nav into every page, so 7,219 reference
 * pages in it made every one of the site's ~8,600 pages carry them, and the
 * site's Jekyll build ran out of memory (14 GB; 1.1 GB without them). The
 * sub-graph's page lists them, and `parent` still gives the breadcrumb.
 */
export function renderEntryPage(opts: { permalink: string; entry: Entry; listHref: string; listLabel: string; under?: NavParent }): string {
  const title = entryTitle(opts.entry.ref);
  return `---
title: ${yamlQuoted(title)}
permalink: ${opts.permalink}
nav_exclude: true
search_exclude: true
${navParentFm(opts.under)}${GENERATED_FM}
---
${GENERATED}

# ${esc(title)}

${detailHtml(opts.entry, { listHref: opts.listHref, listLabel: opts.listLabel })}
`;
}

/**
 * The `✍ + Add reference` panel on a bibliography page: lets a reader or author
 * enter reference fields (`id`/`key`, `title`, `type`, `authors`, `issued`,
 * `containerTitle`, `DOI`, `URL`, `arXiv`, `abstract`) or paste BibTeX/CSL-JSON,
 * builds a standalone `folio-reference/v1` JSON-LD node (`references/<key>.jsonld`)
 * and CSL-JSON entry, and offers both download/copy and `safeHref`-checked
 * creation at `<targetDir>/<key>.jsonld` (bean folio-assistant-63q4).
 */
export function addReferenceHtml(opts: { targetDir?: string; repoUrl?: string; branch?: string } = {}): string {
  const targetDir = (opts.targetDir ?? "references").replace(/^\/+|\/+$/g, "") || "references";
  const repoUrl = (opts.repoUrl ?? "https://github.com/litlfred/folio-assistant").replace(/\/+$/, "");
  const branch = opts.branch ?? "main";
  const ghHref = safeHref(newReferenceUrl({ repoUrl, branch, dir: targetDir, key: "reference" }));
  const ghLink = ghHref
    ? `<a id="fa-bib-add-gh" href="${esc(ghHref)}" target="_blank" rel="noopener">✍ Create standalone node on GitHub</a>`
    : `<span id="fa-bib-add-gh-disabled">✍ Create standalone node on GitHub (unavailable)</span>`;
  return `<details id="fa-bib-add" class="fa-bib-add">
<summary class="fa-bib-add-toggle">✍ + Add reference (standalone node)</summary>
<form id="fa-bib-add-form" class="fa-bib-add-form" data-target-dir="${esc(targetDir)}" data-repo-url="${esc(safeHref(repoUrl) ?? "")}" data-branch="${esc(branch)}" autocomplete="off">
<p>Build a standalone <code>${esc(REFERENCE_SCHEMA_TAG)}</code> node at <code id="fa-bib-add-path">${esc(targetDir)}/reference.jsonld</code> from fields or pasted BibTeX / CSL-JSON.</p>
<div class="fa-bib-add-paste">
  <label for="fa-bib-add-raw">Paste BibTeX or CSL-JSON (optional)</label><br>
  <textarea id="fa-bib-add-raw" name="raw" rows="3" style="width:100%;max-width:40rem" placeholder="@article{smith2024, title={...}, author={Smith, Jane}, year={2024}, doi={10.1000/xyz}}"></textarea><br>
  <button type="button" id="fa-bib-add-parse">Parse BibTeX / CSL-JSON</button>
</div>
<div class="fa-bib-add-grid">
  <label for="fa-bib-add-key">Key (<code>id</code>)</label>
  <input id="fa-bib-add-key" name="id" type="text" required pattern="[A-Za-z0-9][A-Za-z0-9._:+-]*" placeholder="smith2024">
  <label for="fa-bib-add-type">Type</label>
  <select id="fa-bib-add-type" name="type"><option value="article-journal">article-journal</option><option value="book">book</option><option value="report">report</option><option value="webpage">webpage</option><option value="paper-conference">paper-conference</option><option value="chapter">chapter</option><option value="thesis">thesis</option><option value="manuscript">manuscript</option><option value="standard">standard</option><option value="document">document</option></select>
  <label for="fa-bib-add-title">Title</label>
  <input id="fa-bib-add-title" name="title" type="text" placeholder="Title of the work">
  <label for="fa-bib-add-authors">Authors</label>
  <input id="fa-bib-add-authors" name="authors" type="text" placeholder="Family, Given; Second, Author">
  <label for="fa-bib-add-issued">Issued (year or YYYY-MM-DD)</label>
  <input id="fa-bib-add-issued" name="issued" type="text" placeholder="2024">
  <label for="fa-bib-add-container">Container title</label>
  <input id="fa-bib-add-container" name="containerTitle" type="text" placeholder="Journal, book or proceedings">
  <label for="fa-bib-add-doi">DOI</label>
  <input id="fa-bib-add-doi" name="DOI" type="text" placeholder="10.1000/xyz">
  <label for="fa-bib-add-url">URL</label>
  <input id="fa-bib-add-url" name="URL" type="url" placeholder="https://example.org/paper">
  <label for="fa-bib-add-arxiv">arXiv</label>
  <input id="fa-bib-add-arxiv" name="arXiv" type="text" placeholder="2401.00001">
  <label for="fa-bib-add-abstract">Abstract</label>
  <textarea id="fa-bib-add-abstract" name="abstract" rows="2" style="width:100%;max-width:40rem" placeholder="Abstract or summary"></textarea>
</div>
<p class="fa-bib-add-actions">
  <button type="submit" id="fa-bib-add-submit">✍ Add reference</button> ·
  ${ghLink} ·
  <a id="fa-bib-add-dl-jsonld" download="reference.jsonld" href="data:application/ld+json;charset=utf-8,%7B%7D">Download .jsonld</a> ·
  <a id="fa-bib-add-dl-csl" download="reference.csl.json" href="data:application/vnd.citationstyles.csl+json;charset=utf-8,%5B%5D">Download .csl.json</a> ·
  <button type="button" id="fa-bib-add-copy">Copy .jsonld</button>
  <span id="fa-bib-add-status" aria-live="polite"></span>
</p>
<pre id="fa-bib-add-preview"><code id="fa-bib-add-code"></code></pre>
</form>
</details>`;
}

const FILTER_SCRIPT = `<script>
(function(){var q=document.getElementById("fa-bib-q"),n=document.getElementById("fa-bib-n");if(q){
function run(){var v=q.value.trim().toLowerCase(),k=0;
document.querySelectorAll("li[data-fa-bib]").forEach(function(li){var ok=!v||(li.textContent+" "+li.getAttribute("data-fa-bib")).toLowerCase().indexOf(v)>=0;li.hidden=!ok;if(ok)k++;});n.textContent=k;}
q.addEventListener("input",run);}
document.querySelectorAll("details.fa-bib-deps").forEach(function(d){if(q)q.addEventListener("input",function(){if(q.value.trim())d.open=true;});});
var ALLOWED_URL_SCHEMES=["http:","https:","mailto:","tel:"];
function safeHref(u){if(!u)return undefined;var s=String(u).replace(/[\\u0009\\u000A\\u000D]/g,"").trim();if(!s||s.indexOf("//")===0)return undefined;if(/^[#?./]/.test(s)||!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s))return s;var sc=s.slice(0,s.indexOf(":")+1).toLowerCase();return ALLOWED_URL_SCHEMES.indexOf(sc)>=0?s:undefined;}
var form=document.getElementById("fa-bib-add-form");if(!form)return;
var val=function(id){var el=document.getElementById(id);return el?el.value.trim():"";};
var setVal=function(id,v){var el=document.getElementById(id);if(el&&v!==undefined)el.value=v;};
function parseAuthors(s){if(!s)return undefined;return s.split(/;|\\s+and\\s+/i).map(function(p){p=p.trim();if(!p)return null;var i=p.indexOf(",");if(i>=0)return{family:p.slice(0,i).trim(),given:p.slice(i+1).trim()};var t=p.split(/\\s+/);return t.length>1?{family:t[t.length-1],given:t.slice(0,-1).join(" ")}:{literal:p};}).filter(Boolean);}
function parseRaw(){var raw=val("fa-bib-add-raw");if(!raw)return;if(raw[0]==="{"||raw[0]==="["){try{var j=JSON.parse(raw);var it=Array.isArray(j)?j[0]:j;if(!it)return;setVal("fa-bib-add-key",it.id||(it["@id"]||"").replace(/^references\\//,""));setVal("fa-bib-add-type",it.type||"article-journal");setVal("fa-bib-add-title",it.title||it["dcterms:title"]||"");if(Array.isArray(it.author))setVal("fa-bib-add-authors",it.author.map(function(a){return a.literal||[a.family,a.given].filter(Boolean).join(", ");}).join("; "));if(it.issued&&it.issued["date-parts"]&&it.issued["date-parts"][0])setVal("fa-bib-add-issued",it.issued["date-parts"][0].join("-"));setVal("fa-bib-add-container",it["container-title"]||it.containerTitle||"");setVal("fa-bib-add-doi",it.DOI||"");setVal("fa-bib-add-url",it.URL||"");setVal("fa-bib-add-abstract",it.abstract||"");}catch(_e){}return;}
var m=/^@([A-Za-z]+)\\s*\\{\\s*([^,\\s]+)\\s*,([\\s\\S]*)\\}\\s*$/.exec(raw);if(!m)return;setVal("fa-bib-add-key",m[2]);var tm={article:"article-journal",book:"book",techreport:"report",report:"report",inproceedings:"paper-conference",phdthesis:"thesis",mastersthesis:"thesis",online:"webpage",webpage:"webpage"};setVal("fa-bib-add-type",tm[m[1].toLowerCase()]||"document");var re=/([A-Za-z_][A-Za-z0-9_-]*)\\s*=\\s*(\\{(?:[^{}]|\\{[^{}]*\\})*\\}|"[^"]*"|[^,\\n}]+)/g,fm;while((fm=re.exec(m[3]))!==null){var fk=fm[1].toLowerCase(),fv=fm[2].trim().replace(/^\\{([\\s\\S]*)\\}$|^"([\\s\\S]*)"$/,"$1$2").replace(/[{}]/g,"").trim();if(fk==="title")setVal("fa-bib-add-title",fv);else if(fk==="author")setVal("fa-bib-add-authors",fv);else if(fk==="year"||fk==="date")setVal("fa-bib-add-issued",fv);else if(fk==="journal"||fk==="booktitle")setVal("fa-bib-add-container",fv);else if(fk==="doi")setVal("fa-bib-add-doi",fv);else if(fk==="url")setVal("fa-bib-add-url",fv);else if(fk==="eprint"||fk==="arxiv")setVal("fa-bib-add-arxiv",fv);else if(fk==="abstract")setVal("fa-bib-add-abstract",fv);}}
function build(){var rawKey=val("fa-bib-add-key").replace(/[^A-Za-z0-9._:+-]+/g,"-").replace(/^[^A-Za-z0-9]+/,"")||"reference";var tp=val("fa-bib-add-type")||"article-journal";var ti=val("fa-bib-add-title");var au=parseAuthors(val("fa-bib-add-authors"));var is=val("fa-bib-add-issued");var ct=val("fa-bib-add-container");var doi=val("fa-bib-add-doi").replace(/^https?:\\/\\/(?:dx\\.)?doi\\.org\\//i,"");var arx=val("fa-bib-add-arxiv").replace(/^arxiv:/i,"");var u=safeHref(val("fa-bib-add-url")||(arx?"https://arxiv.org/abs/"+arx:doi?"https://doi.org/"+doi:undefined));var ab=val("fa-bib-add-abstract");
var bibo={book:"bibo:Book",report:"bibo:Report",webpage:"bibo:Webpage",thesis:"bibo:Thesis",chapter:"bibo:Chapter",manuscript:"bibo:Manuscript",standard:"bibo:Standard"}[tp]||"bibo:AcademicArticle";
var node={"@context":${JSON.stringify(REFERENCE_CONTEXT)},"@id":${JSON.stringify(referenceIri(""))}+rawKey,"@type":["fabio:Work",bibo],$schema:"folio-reference/v1",id:rawKey,type:tp,provenance:"authored"};
if(ti){node["dcterms:title"]=ti;node.title=ti;}if(au&&au.length){node["dcterms:creator"]=au.map(function(a){return a.literal||[a.family,a.given].filter(Boolean).join(", ");});node.author=au;}if(is){var ym=/^(\\d{4})(?:-(\\d{2})(?:-(\\d{2}))?)?/.exec(is);node.issued=ym?{"date-parts":[[ym[1],ym[2],ym[3]].filter(Boolean).map(Number)]}:{raw:is};node["dcterms:issued"]=is;}if(ct){node["dcterms:isPartOf"]=ct;node["container-title"]=ct;}if(doi){node["bibo:doi"]=doi;node.DOI=doi;}if(u){node["dcterms:identifier"]=u;node.URL=u;}if(ab){node["dcterms:abstract"]=ab;node.abstract=ab;}if(arx)node.note="arXiv:"+arx;
var csl={id:rawKey,type:tp};if(ti)csl.title=ti;if(au&&au.length)csl.author=au;if(node.issued)csl.issued=node.issued;if(ct)csl["container-title"]=ct;if(doi)csl.DOI=doi;if(u)csl.URL=u;if(ab)csl.abstract=ab;if(arx)csl.note="arXiv:"+arx;
var dir=form.getAttribute("data-target-dir")||"references";var pathEl=document.getElementById("fa-bib-add-path");if(pathEl)pathEl.textContent=dir+"/"+rawKey+".jsonld";
var jsonldText=JSON.stringify(node,null,2)+"\\n",cslText=JSON.stringify([csl],null,2)+"\\n";
var codeEl=document.getElementById("fa-bib-add-code");if(codeEl)codeEl.textContent=jsonldText;
var dlLd=document.getElementById("fa-bib-add-dl-jsonld");if(dlLd){dlLd.setAttribute("download",rawKey+".jsonld");dlLd.setAttribute("href","data:application/ld+json;charset=utf-8,"+encodeURIComponent(jsonldText));}
var dlCsl=document.getElementById("fa-bib-add-dl-csl");if(dlCsl){dlCsl.setAttribute("download",rawKey+".csl.json");dlCsl.setAttribute("href","data:application/vnd.citationstyles.csl+json;charset=utf-8,"+encodeURIComponent(cslText));}
var repoUrl=safeHref(form.getAttribute("data-repo-url")||"https://github.com/litlfred/folio-assistant");var branch=form.getAttribute("data-branch")||"main";
var ghUrl=repoUrl?safeHref(repoUrl+"/new/"+encodeURIComponent(branch)+"/"+dir.split("/").map(encodeURIComponent).join("/")+"?filename="+encodeURIComponent(rawKey+".jsonld")+"&value="+encodeURIComponent(jsonldText)):undefined;
var ghEl=document.getElementById("fa-bib-add-gh");if(ghEl&&ghUrl)ghEl.setAttribute("href",ghUrl);
return{key:rawKey,dir:dir,node:node,jsonldText:jsonldText,ghUrl:ghUrl};}
var pb=document.getElementById("fa-bib-add-parse");if(pb)pb.addEventListener("click",function(){parseRaw();build();});
form.addEventListener("input",build);
var cb=document.getElementById("fa-bib-add-copy");if(cb)cb.addEventListener("click",function(){var b=build();if(navigator.clipboard)navigator.clipboard.writeText(b.jsonldText);var st=document.getElementById("fa-bib-add-status");if(st)st.textContent="Copied "+b.dir+"/"+b.key+".jsonld";});
form.addEventListener("submit",function(ev){ev.preventDefault();var b=build();var st=document.getElementById("fa-bib-add-status");if(b.ghUrl)window.open(b.ghUrl,"_blank","noopener");if(st)st.textContent="Ready at "+b.dir+"/"+b.key+".jsonld";});
build();})();
</script>`;

/**
 * The detail panel: a click on an entry (or its key) loads the entry's own
 * page and shows its \`.fa-bib-detail\` in the right-side panel, the same
 * \`.fa-block-panel\` the section actions open (feedback, QA, TR). A modified
 * click, or a page the fetch cannot read, goes to the entry's page instead.
 */
const PANEL_STYLE = `<style>
.fa-bib-panel{position:fixed;top:0;right:0;bottom:0;z-index:2147482000;width:min(420px,92vw);overflow-y:auto;box-sizing:border-box;padding:14px 18px;background:var(--body-background-color,Canvas);color:var(--body-text-color,CanvasText);box-shadow:-4px 0 16px #0003;transform:translateX(105%);transition:transform .18s ease}
.fa-bib-panel.open{transform:none}
@media (prefers-reduced-motion:reduce){.fa-bib-panel{transition:none}}
.fa-bib-panel .bp-x{position:absolute;top:10px;right:12px;border:0;background:none;color:inherit;font-size:18px;cursor:pointer;opacity:.7;min-width:44px;min-height:44px}
.fa-bib-panel h3{font-size:1rem}
.fa-bib-fields{display:grid;grid-template-columns:max-content 1fr;gap:.2rem .8rem;margin:.6rem 0}
.fa-bib-fields dt{font-weight:600}.fa-bib-fields dd{margin:0;overflow-wrap:anywhere}
li[data-fa-bib-href],li[data-fa-bib-inline]{cursor:pointer}
button.fa-bib-open{background:none;border:0;padding:0;color:inherit;cursor:pointer;min-height:24px}
</style>`;

const PANEL_SCRIPT = `<script>
(function(){var panel,from;
function close(){if(panel)panel.classList.remove("open");if(from&&from.focus)from.focus();from=null;}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x)e.textContent=x;return e;}
function ensure(){if(panel)return panel;panel=el("aside","fa-block-panel fa-bib-panel");panel.tabIndex=-1;panel.setAttribute("aria-label","Reference details");document.body.appendChild(panel);document.addEventListener("keydown",function(e){if(e.key==="Escape")close();});return panel;}
function show(href,origin){if(window.faBlockPanel&&window.faBlockPanel.close)window.faBlockPanel.close();from=origin;var p=ensure();var x=el("button","bp-x","\u2715");x.type="button";x.title="Close (Esc)";x.onclick=close;
var body=el("div","bp-body","Loading\u2026");var tpl=origin&&origin.closest&&origin.closest("li")?origin.closest("li").querySelector("template.fa-bib-inline"):null;
if(tpl){p.replaceChildren(x,el("h3","","Reference"),body);body.replaceChildren(document.importNode(tpl.content,true));p.classList.add("open");p.focus();return;}
var page=el("a","",  "Open its own page");page.href=href;p.replaceChildren(x,el("h3","","Reference"),page,body);p.classList.add("open");p.focus();
fetch(href).then(function(r){if(!r.ok)throw r.status;return r.text();}).then(function(t){var d=new DOMParser().parseFromString(t,"text/html");var sec=d.querySelector(".fa-bib-detail");if(!sec)throw 0;body.replaceChildren(document.importNode(sec,true));}).catch(function(){location.href=href;});}
document.addEventListener("click",function(e){if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;var t=e.target;if(!t.closest)return;var li=t.closest("li[data-fa-bib-href],li[data-fa-bib-inline]");if(!li||(t.closest("a,button,input,summary,select,textarea")&&!t.closest(".fa-bib-open")))return;e.preventDefault();show(li.getAttribute("data-fa-bib-href"),li.querySelector(".fa-bib-open")||li);});
})();
</script>`;

/** The export files beside a page, by name. */
export const EXPORTS = [
  ["references.bib", "BibTeX", toBibtex],
  ["references.csl.json", "CSL-JSON", toCslJson],
  ["references.ris", "RIS", toRis],
  ["references.dc.xml", "Dublin Core XML", toDublinCoreXml],
  ["references.jsonld", "Dublin Core / BIBO JSON-LD", toJsonLdGraph],
] as const;

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * The list when a site has an own layer: its references first, then every
 * dependency's, grouped by layer, in a closed `From dependencies` section so
 * the page opens on the site's own bibliography. The filter and a link to an
 * entry's anchor open the section.
 */
export function ownAndDependenciesHtml(own: string, entries: Entry[], anchor?: HrefOf): string {
  const mine = entries.filter((e) => e.instance === own);
  const layers = [...new Set(entries.filter((e) => e.instance !== own).map((e) => e.instance))].sort((a, b) => a.localeCompare(b, "en"));
  const ownList = mine.length ? `<ol class="fa-bib">\n${mine.map((e) => entryHtml(e, anchor)).join("\n")}\n</ol>` : `<p>${esc(own)} has no references of its own yet.</p>`;
  const deps = layers.length
    ? `<details class="fa-bib-deps" id="fa-bib-deps">
<summary><strong>From dependencies</strong>: ${plural(entries.length - mine.length, "reference")} from ${plural(layers.length, "layer")} that ${esc(own)} builds on. They are not part of ${esc(own)}.</summary>
${layers
  .map((l) => {
    const ls = entries.filter((e) => e.instance === l);
    return `<h3 id="fa-bib-dep-${esc(segmentOf(l))}">${esc(l)} <small>(dependency, ${plural(ls.length, "reference")})</small></h3>
<ol class="fa-bib fa-bib-dep" data-fa-bib-layer="${esc(l)}">
${ls.map((e) => entryHtml(e, anchor)).join("\n")}
</ol>`;
  })
  .join("\n")}
</details>`
    : "";
  return `<h2 id="fa-bib-own">${esc(own)} <small>(this site, ${plural(mine.length, "reference")})</small></h2>
${ownList}
${deps}`;
}

/** A page: front matter, what it holds, its exports, the `+ Add reference` panel, the filter and the list. */
export function renderPage(opts: {
  title: string;
  permalink: string;
  intro: string;
  entries: Entry[];
  nav?: string;
  targetDir?: string;
  own?: string;
  /** Each entry's own page, from this page. Default: `<key>/` beside it. */
  hrefOf?: HrefOf;
  /** A reference this page is also the own page of (a library asset's): its detail, above the list. */
  detail?: string;
  /** The page it sits under in the site's Pages list (`parent`, `grand_parent`). */
  under?: NavParent;
  /** What the page shows in place of a list longer than `LIST_LIMIT`. Unset: the whole list. */
  summary?: string;
  /** On a summarised page, the few references no sub-graph or document page below it lists: listed here. */
  listed?: Entry[];
  /** On a summarised page, the search box over the route's index (`searchHtml`). */
  search?: string;
}): string {
  const { title, permalink, intro, entries, nav, targetDir, own, detail } = opts;
  const summarised = opts.summary !== undefined && entries.length > LIST_LIMIT;
  const exports = EXPORTS.map(([f, label]) => `<a href="${f}">${label}</a>`).join(" · ");
  const addPanel = addReferenceHtml({ targetDir });
  const grouped = own !== undefined && entries.some((e) => e.instance !== own);
  const anchor = opts.hrefOf;
  const listed = opts.listed ?? [];
  const shown = !summarised ? entries : listed.length <= LIST_LIMIT ? listed : [];
  const filtered = (es: Entry[], body: string) => `<label for="fa-bib-q">Filter references</label>
<input id="fa-bib-q" type="search" autocomplete="off" style="min-height:44px;width:100%;max-width:32rem">
<p aria-live="polite"><span id="fa-bib-n">${es.length}</span> shown</p>

${body}`;
  const plainList = (es: Entry[]) => `<ol class="fa-bib">\n${es.map((e) => entryHtml(e, anchor)).join("\n")}\n</ol>`;
  const list = summarised
    ? `<p class="fa-bib-summary">${plural(entries.length, "reference")}: too many to list on one page. ${opts.search ? `Search them below, or ${opts.summary}` : `${opts.summary!.charAt(0).toUpperCase()}${opts.summary!.slice(1)}`}</p>${opts.search ? `\n\n${opts.search}` : ""}${
        shown.length ? `\n\nListed here: the ${plural(shown.length, "reference")} that no page below lists.\n\n${filtered(shown, plainList(shown))}` : ""
      }`
    : entries.length
      ? filtered(entries, grouped && own !== undefined ? ownAndDependenciesHtml(own, entries, anchor) : plainList(entries))
      : "<p>No references here yet.</p>";
  const ownCount = grouped ? entries.filter((e) => e.instance === own).length : entries.length;
  const exportLead = grouped
    ? `**Export all ${plural(entries.length, "reference")}** (${ownCount} of ${own}'s own and ${entries.length - ownCount} from dependencies):`
    : `**Export these ${plural(entries.length, "reference")}:**`;
  return `---
title: ${yamlQuoted(title)}
permalink: ${permalink}
search_exclude: true
${navParentFm(opts.under)}${GENERATED_FM}
---
${GENERATED}

# ${title}

${intro}
${detail ? `\n${detail}\n` : ""}
${exportLead} ${exports}
${nav ? `\n${nav}\n` : ""}
${addPanel}

${list}

${PANEL_STYLE}
${FILTER_SCRIPT}
${shown.length ? PANEL_SCRIPT : ""}
`;
}

/** Every file this generator owns, path → content. */
/**
 * One layer's bibliography, as its own site lists it (owner, 2026-11-03:
 * a page per IG, bean djj5): its own references and those of the layers it
 * `needs`, transitively, with `own` set to it. Everything else in the
 * checkout belongs to other sites.
 */
export function forInstance(c: Collected, instance: string, needsOf: (name: string) => readonly string[]): Collected {
  const keep = new Set<string>();
  const visit = (n: string) => {
    if (keep.has(n)) return;
    keep.add(n);
    for (const d of needsOf(n)) visit(d);
  };
  visit(instance);
  // A layer below lends its references, but not the reference lists EXTRACTED
  // from the documents it holds (`provenance: extracted`, e.g. a document
  // library's `references/`): those belong to that layer's documents and are listed on
  // its own and the platform's bibliography. Rendered inside every composed
  // IG they were ~7.5k pages per IG and ran the staging Jekyll build past its
  // 45-minute limit (owner, 2026-11-12, card: "A. IGs list own refs only").
  const lent = (e: Entry) => keep.has(e.instance) && !(e.instance !== instance && e.ref.provenance === "extracted");
  const entries = c.entries.filter(lent);
  const listed = new Set(entries.map((e) => `${e.instance}\0${e.subgraph}`));
  const emptied = new Set(
    c.entries.filter((e) => keep.has(e.instance) && !lent(e)).map((e) => `${e.instance}\0${e.subgraph}`).filter((k) => !listed.has(k)),
  );
  const assets: AssetView[] = [];
  for (const a of c.assets ?? []) {
    if (!keep.has(a.instance)) continue;
    const kept = a.entries.filter(lent);
    // A held document's page that existed only for its extracted list goes with it.
    if (kept.length < a.entries.length && kept.length <= 1) continue;
    assets.push(kept.length === a.entries.length ? a : { ...a, entries: kept });
  }
  return {
    ...c,
    own: instance,
    entries,
    subgraphs: c.subgraphs.filter((s) => keep.has(s.instance) && !emptied.has(`${s.instance}\0${s.id}`)),
    assets,
  };
}

/**
 * The pages and exports. `prefix` is the site path a layer's own site is
 * served under inside a composed site (`/<instance>` for `--instance
 * <instance>`), so each page's permalink lands where its links point.
 */
export function outputs(c: Collected, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  // The layer a prefixed site belongs to: its titles name it (see BIB_TITLE).
  const layer = prefix.replace(/^\/+|\/+$/g, "") || undefined;
  // Each entry's own page, `<route>/<sub-graph slug>/<segment>/`: the slash
  // address the list links and the side panel loads (owner, 2026-11-08).
  const slugOfSub = new Map(c.subgraphs.map((s) => [`${s.instance}\0${s.id}`, s.slug]));
  const place = new Map<Entry, { slug: string; seg: string }>();
  const taken = new Set<string>();
  for (const e of c.entries) {
    const slug = slugOfSub.get(`${e.instance}\0${e.subgraph}`);
    if (slug === undefined) continue;
    const base = referenceSegment(e.ref.id) || "reference";
    let seg = base;
    for (let n = 2; taken.has(`${slug}/${seg}`); n++) seg = `${base}-${n}`;
    taken.add(`${slug}/${seg}`);
    place.set(e, { slug, seg });
  }
  /** Hrefs from a page `depth` directories below the route. */
  const hrefsAt = (depth: number, here?: string): HrefOf => (e) => {
    const at = place.get(e);
    if (!at || !hasOwnPage(e)) return "";
    return depth === 1 && at.slug === here ? `${at.seg}/` : `${"../".repeat(depth)}${at.slug}/${at.seg}/`;
  };
  // The search index over every reference (`bibliography-search.ts`), at
  // `<route>/search/`: what a page too long to list offers instead.
  const assetOf = new Map<Entry, AssetView>();
  for (const a of c.assets ?? []) for (const e of a.entries) if (!assetOf.has(e)) assetOf.set(e, a);
  const pageOf = (e: Entry): string => {
    const at = place.get(e);
    if (at && hasOwnPage(e)) return `${at.slug}/${at.seg}/`;
    const a = assetOf.get(e);
    if (a) return `${a.slug}/${a.asset}/`;
    return at ? `${at.slug}/` : "";
  };
  const searchSlugs = [...new Set(c.subgraphs.map((s) => s.slug))];
  const sgOf = new Map(searchSlugs.map((slug, i) => [slug, i]));
  const plainCite = (r: ReferenceNode) => {
    const authors = (r.author ?? []).map(nameText);
    const who = authors.length > 3 ? `${authors.slice(0, 3).join("; ")}; et al.` : authors.join("; ");
    return [who, (r.title ?? r.printed ?? (typeof r.note === "string" ? r.note : undefined) ?? r.id).replace(/\s+/g, " ").trim()].filter(Boolean).join(". ");
  };
  const placed = c.entries.filter((e) => place.has(e));
  const records: SearchRecord[] = placed.map((e) => ({
    k: e.ref.id,
    c: plainCite(e.ref),
    y: Number(yearOf(e.ref)) || 0,
    s: sgOf.get(place.get(e)!.slug) ?? 0,
    h: pageOf(e),
  }));
  for (const [f, text] of buildSearchIndex(records, searchSlugs, (r, i) => {
    const ref = placed[i]!.ref;
    return [r.c, r.k, r.y || "", ref["container-title"] ?? "", ref.publisher ?? "", ref.DOI ?? "", ref.printed ?? ""].join(" ");
  }))
    out.set(join(ROOT, "search", f), text);
  const write = (dir: string, page: string, entries: Entry[]) => {
    out.set(join(dir, "index.md"), page);
    const refs = entries.map((e) => e.ref);
    for (const [f, , fn] of EXPORTS) out.set(join(dir, f), fn(refs));
  };
  const inSub = (s: { id: string; instance: string }) => c.entries.filter((e) => e.subgraph === s.id && e.instance === s.instance);
  // A directory declaring two kinds (references and catalogue) is scanned twice: one link, one page.
  const pages = [...new Map(c.subgraphs.map((s) => [s.slug, s])).values()];
  const link = (s: SubgraphView, layer: boolean) => `<a href="${s.slug}/">${s.id}</a> (${inSub(s).length}${layer ? `, ${s.instance}` : ""})`;
  const own = c.own !== undefined && c.subgraphs.some((s) => s.instance !== c.own) ? c.own : undefined;
  const nav = !pages.length
    ? undefined
    : own === undefined
      ? `**By sub-graph:** ${pages.map((s) => link(s, false)).join(" · ")}`
      : [
          `**${own} (this site), by sub-graph:** ${pages.filter((s) => s.instance === own).map((s) => link(s, false)).join(" · ") || "none"}`,
          `**Dependencies, by sub-graph:** ${pages.filter((s) => s.instance !== own).map((s) => link(s, true)).join(" · ")}`,
        ].join("<br>\n");
  const defaultTargetDir =
    c.subgraphs.find((s) => s.kind === "references" && s.instance === c.own)?.path ?? c.subgraphs.find((s) => s.kind === "references")?.path ?? "references";
  write(
    ROOT,
    renderPage({
      title: bibTitle(layer),
      permalink: `${prefix}/${ROUTE}/`,
      intro:
        (own === undefined
          ? "Every reference in the knowledge graph: the bibliographies folios declare (`references` directories, one `folio-reference/v1` node each), the Dublin Core records of catalogues (`catalogue` directories), and the ingested items of libraries (`library` directories), as one list."
          : `The references of ${own}, this site, come first: its bibliography (\`references\` directories, one \`folio-reference/v1\` node each), its catalogue records and its library items. The references of the layers ${own} depends on follow, under **From dependencies**, grouped by layer; they are not part of ${own}.`) +
        " Each reference sits at `references/<key>`, the IRI a `\\cite{key}` resolves to.",
      entries: c.entries,
      nav,
      targetDir: defaultTargetDir,
      own,
      hrefOf: hrefsAt(0),
      summary: "open a sub-graph above to read its references, or take all of them in an export.",
      search: searchHtml({ index: "search/", root: "" }),
    }),
    c.entries,
  );
  for (const s of pages) {
    const entries = inSub(s);
    // The documents whose pages list this sub-graph's references: its own
    // assets, and the documents its extracted references were read from.
    const mine = new Set(entries);
    const subAssets = (c.assets ?? []).filter((a) => a.slug === s.slug || a.entries.some((e) => mine.has(e)));
    const onAssetPage = new Set(subAssets.flatMap((a) => a.entries));
    const assetNav = subAssets.length
      ? `**By asset:** ${subAssets.map((a) => `<a href="${a.slug === s.slug ? "" : `../${a.slug}/`}${a.asset}/">${a.asset}</a> (${a.entries.length})`).join(" · ")}`
      : undefined;
    write(
      join(ROOT, s.slug),
      renderPage({
        title: subgraphTitle(s.slug, layer),
        under: { parent: bibTitle(layer) },
        permalink: `${prefix}/${ROUTE}/${s.slug}/`,
        intro: `The references of \`${s.path}/\` (${s.instance}${own !== undefined && s.instance !== own ? `, a dependency of ${own}` : ""}, a \`${s.kind}\` directory). [All references](../).`,
        entries,
        nav: assetNav,
        targetDir: s.kind === "references" ? s.path : defaultTargetDir,
        hrefOf: hrefsAt(1, s.slug),
        summary: subAssets.length ? "open a document above to read the references it holds, or take all of them in an export." : "take all of them in an export.",
        search: searchHtml({ index: "../search/", root: "../", scope: sgOf.get(s.slug) }),
        listed: entries.filter((e) => !onAssetPage.has(e)),
      }),
      entries,
    );
  }
  const assetDirs = new Set((c.assets ?? []).map((a) => `${a.slug}/${a.asset}`));
  for (const a of c.assets ?? []) {
    // A library asset's page is its own reference's page too: the asset's
    // slug is its key, so both live at `<sub-graph>/<asset>/`.
    const assetRef = a.entries.find((e) => place.get(e)?.slug === a.slug && place.get(e)?.seg === a.asset);
    write(
      join(ROOT, a.slug, a.asset),
      renderPage({
        title: `${subgraphTitle(a.slug, layer)}/${a.asset}`,
        under: underSubgraph(a.slug, layer),
        permalink: `${prefix}/${ROUTE}/${a.slug}/${a.asset}/`,
        intro: `The reference for \`${a.path}\` (${a.instance}${own !== undefined && a.instance !== own ? `, a dependency of ${own}` : ""}) and any references extracted from it. [${a.slug}](../) · [All references](../../).`,
        entries: a.entries,
        hrefOf: hrefsAt(2),
        ...(assetRef ? { detail: detailHtml(assetRef) } : {}),
      }),
      a.entries,
    );
  }
  for (const [e, at] of place) {
    if (assetDirs.has(`${at.slug}/${at.seg}`) || !hasOwnPage(e)) continue;
    out.set(
      join(ROOT, at.slug, at.seg, "index.md"),
      renderEntryPage({ permalink: `${prefix}/${ROUTE}/${at.slug}/${at.seg}/`, entry: e, listHref: "../", listLabel: `All references of ${at.slug}`, under: underSubgraph(at.slug, layer) }),
    );
  }
  // The route marks itself as built at publish, as the glossary's do (bean
  // folio-assistant-uldr, owner option "1", 2026-11-06): the host site lists
  // none of it, and the marker keeps it out of git and the mount digest.
  out.set(join(ROOT, ".gitignore"), ROUTE_IGNORE);
  return out;
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)]));
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  // `--instance <name>`: that layer's own bibliography, written under
  // `--site` with permalinks under `/<name>/`, for a site that composes the
  // layer's pages inside its own (an index staging an IG at `/<name>/`).
  const ii = process.argv.indexOf("--instance");
  const instance = ii >= 0 ? process.argv[ii + 1] : undefined;
  if (ii >= 0 && !instance) {
    console.error("✗ --instance needs an instance name");
    process.exit(2);
  }
  const all = collect();
  let c = all;
  if (instance !== undefined) {
    const needs = new Map<string, readonly string[]>();
    for (const root of instanceRootsIn(REPO)) {
      const d = readDeclaration(root) as { name?: string; needs?: string[] } | undefined;
      if (d?.name) needs.set(d.name, d.needs ?? []);
    }
    if (!needs.has(instance)) {
      console.error(`✗ --instance ${instance}: no instance of that name in this checkout`);
      process.exit(2);
    }
    c = forInstance(all, instance, (n) => needs.get(n) ?? []);
  }
  // A scoped site (`--scope`, owner 2026-11-08 Q-SZ-2 "B") lists its scope's
  // references only; every other layer's bibliography is on that layer's site.
  const scope = siteScopeArg();
  if (scope !== undefined) {
    const before = c.entries.length;
    c = { ...c, entries: c.entries.filter((e) => scope.has(e.instance)), subgraphs: c.subgraphs.filter((s) => scope.has(s.instance)), assets: (c.assets ?? []).filter((a) => scope.has(a.instance)) };
    console.log(`  scope ${scopeLabel(scope)}: ${c.entries.length} of ${before} reference(s)`);
  }
  if (c.invalid.length) {
    console.error(`✗ ${c.invalid.length} reference(s) do not validate:`);
    for (const f of c.invalid) console.error(`  ${f}`);
    process.exit(1);
  }
  const files = outputs(c, instance !== undefined ? `/${instance}` : "");
  const orphans = filesUnder(ROOT).filter((p) => !files.has(p));
  const stale = [...files].filter(([p, s]) => !existsSync(p) || readFileSync(p, "utf-8") !== s).map(([p]) => p);
  const summary = `${c.entries.length} reference(s) in ${c.subgraphs.length} sub-graph(s)`;
  if (check) {
    if (stale.length || orphans.length) {
      for (const p of stale) console.error(`✗ stale: ${relative(REPO, p)}`);
      for (const p of orphans) console.error(`✗ orphan: ${relative(REPO, p)}`);
      console.error("Run `bun run cat bibliography:page`. The pages are built at publish and never committed.");
      process.exit(1);
    }
    console.log(`✓ bibliography current: ${summary}`);
    process.exit(0);
  }
  for (const [p, s] of files) {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, s);
  }
  for (const p of orphans) rmSync(p);
  console.log(`Wrote ${files.size} file(s) under ${relative(REPO, ROOT)}: ${summary}.`);
}
