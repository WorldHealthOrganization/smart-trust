/**
 * Emit the docs site's own JSON-LD graph from `docs/source/`.
 *
 * STRAWPERSON — a first cut, deliberately. The shape here (page node ->
 * ordered `contains` -> one node per child) mirrors `gen-library-jsonld.ts`
 * because that is the model already proven across 576 ingested documents, but
 * every choice below is open to revision: which vocabulary a page node takes,
 * whether an asset's `@id` should be the asset or the section presenting it,
 * and whether the site graph belongs in the same index as the corpus at all.
 *
 * WHY THIS IS A SEPARATE GENERATOR, not a widening of `gen-block-jsonld.ts`.
 *
 * That generator walks `content/<paper>/` and REFUSES when it finds nothing:
 * "folio-assistant is the platform; papers live in the folio repo." That
 * refusal is load-bearing — `scripts/tests/audit-empty-corpus.test.ts`
 * enforces the same invariant from the audit side. The docs live under
 * `docs/source/`, which both `gen-block-jsonld.ts` and the section-title
 * audit skip when walking paper directories — keeping the two populations
 * (folio content vs platform documentation) apart without an out-of-tree
 * `site-content/` workaround.
 *
 * So the site gets its own emitter, its own IRI space (`site/<slug>`), and its
 * own gate. It shares the published `@context` and the `folio:` / `doco:`
 * vocabulary, which is what makes the two graphs joinable later if that turns
 * out to be wanted.
 *
 * WHAT IS NOT DONE YET, and should not be assumed:
 *   - nothing loads these into `graph-index.ts`, so `corpus_search` cannot see
 *     them. Emitting the nodes and indexing them are separate steps and only
 *     the first is here.
 *   - `uses` / `cites` edges are not extracted from the narrative. A page's
 *     cross-links are plain markdown today; turning them into typed edges is
 *     the obvious next increment and is where the graph starts earning its
 *     keep.
 *
 * Usage:
 *   bun run cat-harness-tools/pipeline/gen-site-jsonld.ts            # write
 *   bun run cat-harness-tools/pipeline/gen-site-jsonld.ts --check    # CI gate
 *
 * @covers docs
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { documentContext } from "../schemas/content/content-context.ts";
import { atInstanceContext } from "./instance-document-context.ts";
import {
  DOCS_SITE_BASE,
  siteNodeSitePath,
  SITE_PAGE_TYPES,
  SITE_NARRATIVE_TYPES,
  SITE_ASSET_TYPES,
} from "../schemas/kg/jsonld.ts";
import type { WebPage, WebPageNode } from "../schemas/ui/webpage.ts";
import { portableSegment } from "../schemas/kg/portable-path.ts";
import { docsSourceDirFor, repoRootFor, siteDirFor, sourceLinks } from "../schemas/kg/cat-harness.ts";
import { detectRepoUrl } from "../src/core/git-refs.js";
import { declaredSubgraphNode } from "../scripts/kg-export.ts";
import { memberOf } from "../scripts/subgraph-node.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { docsSources, sourceSiteNodePath, type DocsSource } from "../scripts/lib/docs-sources.ts";
import { loadManifestValue, manifestPath } from "./json-manifest.ts";

const INSTANCE_ROOT = join(HARNESS_ROOT);
const BASE_SRC_DIR = docsSourceDirFor(INSTANCE_ROOT);
const REPO_ROOT = repoRootFor(INSTANCE_ROOT);

/**
 * The docs source being projected. Every docs source in the checkout is
 * (owner, 2026-10-23, "A1" — the same set `gen-docs-pages.ts` renders): the
 * base layer's first, unchanged, then each layer above it, whose
 * documents land in ITS source and ITS docs directory's `site/`.
 */
let CUR: DocsSource;
let SRC_DIR = BASE_SRC_DIR;
// The same fallback `gen-docs-pages.ts` uses, so the two generators name one
// forge — and so the output does not depend on how this checkout was cloned.
const REPO_WEB = detectRepoUrl(REPO_ROOT) ?? "https://github.com/litlfred/folio-assistant";
let docsSubgraph = declaredSubgraphNode(INSTANCE_ROOT, "docs");

/**
 * `sourceDocument` as an ADDRESS, not a path — #1772. It is a link-type term
 * (`@id` in the content context), and `check:content-keys` refuses a file
 * path there: a reader resolving a relative path against the node's own IRI
 * lands somewhere that is not the file. The asset's `source` is relative to
 * this layer, and may now leave it (`../<instance>/processes/…`, since a
 * content-type process lives with its skill), so it is resolved against the
 * REPOSITORY and published as the forge's view URL — one rule for every asset,
 * moved or not.
 */
function sourceDocumentIri(source: string): string {
  return sourceLinks(REPO_WEB, sourceRepoPath(REPO_ROOT, CUR.root, source), "main")?.viewHref ?? source;
}

/**
 * The asset's path in THIS checkout, repository-relative. A source that names
 * a sibling layer (`../cat-harness/processes/…`) is written for the index
 * layout, where layers sit side by side; in a layer's own checkout that layer
 * is MOUNTED under the root (`cat-harness/…`), so the sibling path would leave
 * the repository and the link would read `…/blob/main/../cat-harness/…`. When
 * the path leaves the repository and the mounted copy exists, use the mount;
 * `sourceLinks` then names that layer's own repository.
 */
function sourceRepoPath(repoRoot: string, from: string, source: string): string {
  let repoPath = relative(repoRoot, resolve(from, source)).split("\\").join("/");
  if (repoPath.startsWith("../")) {
    const mounted = repoPath.replace(/^(\.\.\/)+/, "");
    if (existsSync(join(repoRoot, mounted))) repoPath = mounted;
  }
  return repoPath;
}

const check = process.argv.includes("--check");
let written = 0;
let unchanged = 0;
const stale: string[] = [];

function serialise(doc: Record<string, unknown>): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

function emit(path: string, doc: Record<string, unknown>): void {
  // Names the context of the layer `path` sits in (bean folio-assistant-63q4).
  const next = serialise(atInstanceContext(doc, path));
  const prev = existsSync(path) ? readFileSync(path, "utf-8") : undefined;
  if (prev === next) {
    unchanged++;
    return;
  }
  if (check) {
    stale.push(relative(REPO_ROOT, path));
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next);
  written++;
}

/**
 * The site directory, where each node is ALSO published at the path its `@id`
 * names — issue #1908. Before this the nodes lived only under `docs/source/`,
 * which the site does not serve, so every `site/…` IRI (and every todo's
 * `target` edge to one) named nothing a reader could open.
 */
let SITE_DIR = join(INSTANCE_ROOT, siteDirFor(INSTANCE_ROOT));

/**
 * A page's (or node's) IRI, relative to the site base: where the document is
 * PUBLISHED. A source above the base is composed into the site under its
 * layer's name, and so are the documents beside its pages.
 */
const pageIri = (slug: string, node?: string): string => sourceSiteNodePath(CUR, slug, node);

/** The source directory as its layer spells it — `docs/source` for the base. */
const srcRel = (): string => relative(CUR.root, SRC_DIR).split("\\").join("/");

/**
 * Write the node beside its source AND at its published path.
 *
 * The published copy is skipped, loudly, for an id that does not encode to
 * itself: a static host decodes `%3A` before looking for the file, so the
 * file a percent-encoded IRI names cannot be written portably. Every id in
 * the corpus today is a slug, so this reports nothing.
 */
function emitBoth(source: string, sitePath: string, doc: Record<string, unknown>): void {
  emit(source, doc);
  if (sitePath.includes("%")) {
    console.error(`  ! ${sitePath}: the id does not encode to itself — not published at its IRI`);
    return;
  }
  emit(join(SITE_DIR, sitePath), doc);
}

function nodeDoc(page: WebPage, node: WebPageNode, flat: string): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    "@context": documentContext(node.asset ? SITE_ASSET_TYPES : SITE_NARRATIVE_TYPES, { base: DOCS_SITE_BASE }),
    "@id": pageIri(page.slug, node.id),
    "@type": [...(node.asset ? SITE_ASSET_TYPES : SITE_NARRATIVE_TYPES)],
    label: node.id,
    provenance: "authored",
  };
  if (node.title) doc.title = node.title;

  // `text` points at the narrative file rather than copying it, the same way
  // an ingested section's prose block points at its `.md`. A node with an
  // asset and no trailing prose has no `text`, and that absence is
  // meaningful — the figure IS the content there.
  const narrative = node.block ?? node.lead;
  if (narrative) doc.text = `${narrative}.md`;

  if (node.asset) {
    // `sourceDocument` is the EDITABLE source (`.bpmn`), never the rendered
    // `.svg`. The renderer's own rule is that the SVG is never hand-edited, so
    // an edge naming it as the source would point a reader at a build product.
    doc.sourceDocument = sourceDocumentIri(node.asset.source);
    doc.meta = {
      assetKind: node.asset.kind,
      rendered: node.asset.rendered,
      alt: node.asset.alt,
    };
  }
  // Recorded so a consumer can find the file without re-deriving the
  // flattening rule from the slug.
  doc.meta = { ...((doc.meta as Record<string, unknown>) ?? {}), sourceDir: `${srcRel()}/${flat}` };
  return doc;
}

if (!existsSync(BASE_SRC_DIR)) {
  console.log(`gen-site-jsonld: no ${BASE_SRC_DIR} — nothing to generate.`);
  process.exit(0);
}

let pages = 0;
let nodes = 0;

for (const src of docsSources(INSTANCE_ROOT)) {
CUR = src;
SRC_DIR = src.srcDir;
SITE_DIR = src.outDir;
docsSubgraph = src.base ? declaredSubgraphNode(INSTANCE_ROOT, "docs") : declaredSubgraphNode(src.root, "docs");

const flats = readdirSync(SRC_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

if (flats.length === 0) {
  // Deliberately an ERROR, not a quiet success. The rule this corpus settled
  // on (bean `vald`, and the empty-corpus audit test) is that generating over
  // nothing is a failure: a clean run on an empty tree is indistinguishable
  // from a clean run on a healthy one, and that is exactly how a broken path
  // survives a gate.
  console.error(`gen-site-jsonld: ${relative(REPO_ROOT, SRC_DIR)} exists but holds no pages — refusing to report success.`);
  process.exit(1);
}

for (const flat of flats) {
  const manifest = manifestPath(join(SRC_DIR, flat), flat);
  if (!existsSync(manifest)) {
    console.error(`  ! ${flat}/ has no ${flat}.ts or ${flat}.json manifest — skipped`);
    continue;
  }
  const page = (await loadManifestValue(manifest)) as WebPage;

  emitBoth(join(SRC_DIR, flat, `${flat}.jsonld`), siteNodeSitePath(page.slug), {
    "@context": documentContext(SITE_PAGE_TYPES, { base: DOCS_SITE_BASE }),
    "@id": pageIri(page.slug),
    "@type": [...SITE_PAGE_TYPES],
    label: page.slug,
    title: page.title,
    // Ordered, and that order IS the page. `contains` maps to
    // `dcterms:hasPart` in the published context.
    contains: page.nodes.map((n) => pageIri(page.slug, n.id)),
    provenance: "authored",
    ...(docsSubgraph ? memberOf(docsSubgraph.iri) : {}),
    meta: {
      publishedAt: `${CUR.base ? "" : `${CUR.instance}/`}${page.slug}.html`,
      sourceDir: `${srcRel()}/${flat}`,
      ...(page.navOrder !== undefined ? { navOrder: page.navOrder } : {}),
      ...(page.parent ? { navParent: page.parent } : {}),
    },
  });
  pages++;

  for (const node of page.nodes) {
    // `portableSegment`: a node id is an identifier, not a filename. Every id
    // in the corpus today is a slug and encodes to itself, so no emitted path
    // moves — but the knowledge graph this reads also holds `req:*` ids, and
    // one reaching here would write a name NTFS cannot create.
    emitBoth(
      join(SRC_DIR, flat, "nodes", `${portableSegment(node.id)}.jsonld`),
      siteNodeSitePath(page.slug, node.id),
      nodeDoc(page, node, flat),
    );
    nodes++;
  }
}
}

if (check) {
  if (stale.length) {
    console.error(
      `\n${stale.length} site .jsonld file(s) are stale or missing:\n` +
        stale.slice(0, 40).map((s) => `  ${s}`).join("\n") +
        (stale.length > 40 ? `\n  … and ${stale.length - 40} more` : "") +
        `\n\nRun: bun run cat-harness-tools/pipeline/gen-site-jsonld.ts`,
    );
    process.exit(1);
  }
  console.log(`gen-site-jsonld --check: ${unchanged} file(s) up to date (${pages} pages, ${nodes} nodes).`);
} else {
  console.log(
    `gen-site-jsonld: ${written} written, ${unchanged} unchanged (${pages} pages, ${nodes} nodes).`,
  );
}
