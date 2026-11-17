/**
 * Where a library entry's own files live upstream, and the links to them.
 *
 * Owner, 2026-10-15: the "source" link of a content layer's entry
 * (`9789241511766-eng`) opened
 * `github.com/litlfred/cat-harness/blob/main/<instance>/library/…`, a 404 —
 * the entry is that layer's, and it keeps its layer directory in its own
 * repository. The viewer built every link from the HANDLER's repository
 * (cat-harness's `livesAt`) plus the path in the composed checkout, which is
 * right only for an entry of the handler itself.
 * The owner also asked, the same day, for links to the source PDF and the
 * entry's KG JSON-LD on a library assets page, a PDF opening in the PDF
 * viewer the way the IRIS layer's pages already do.
 *
 * So an entry's repository and in-repository path are asked of
 * `forgeLocation` — the one answer to "which repository holds this checkout
 * path", read from the mount lock (`index.lock.json` `repository` +
 * `upstreamRoot`) — and never composed here.
 *
 * The source PDF is linked through the site's pdf.js viewer pointed at the
 * RAW URL of the file in that repository, as the IRIS layer's page
 * generator does (its `readHere`: the raw host serves the bytes with
 * `access-control-allow-origin: *`; the build's `pdf-viewer.ts --allow`
 * admits `https://raw.githubusercontent.com/<owner>/`). Nothing large is
 * copied into the site. A non-PDF source links to the raw file directly.
 *
 * @module scripts/lib/library-source
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { forgeLocation } from "../../schemas/kg/cat-harness.ts";
import { STRUCTURE_FILENAME } from "../../schemas/content/document-structure.ts";
import { repoOf } from "../../src/core/edit-links.ts";

/** The branch every repository link names — the same one the [source] and README links use. */
export const SOURCE_BRANCH = "main";

/** A checkout path's place on the forge: `owner/repo` and the path inside it. */
export interface ForgeAt {
  repo: string;
  path: string;
}

/**
 * The repository and in-repository path of `repoRel`, a path in the checkout
 * at `repoRoot`. A path under a remote mount resolves to the mounted
 * repository (lock `repository` + `upstreamRoot`); anything else is the
 * checkout's own, `checkoutRepo`. `undefined` when neither is a GitHub
 * repository, so no link is drawn rather than a wrong one.
 */
export function forgeAt(repoRoot: string, repoRel: string, checkoutRepo: string | undefined): ForgeAt | undefined {
  const at = forgeLocation(repoRel.replace(/\/+$/, ""), checkoutRepo ? `https://github.com/${checkoutRepo}` : "", repoRoot);
  const repo = repoOf(at.repoUrl, "");
  return repo ? { repo, path: at.path } : undefined;
}

const encPath = (p: string): string => p.split("/").map(encodeURIComponent).join("/");

/** The file as GitHub shows it. */
export const blobUrl = (f: ForgeAt, branch = SOURCE_BRANCH): string => `https://github.com/${f.repo}/blob/${branch}/${encPath(f.path)}`;
/** The directory as GitHub lists it. */
export const treeUrl = (f: ForgeAt, branch = SOURCE_BRANCH): string => `https://github.com/${f.repo}/tree/${branch}/${encPath(f.path)}`;
/** The bytes themselves — what the PDF viewer reads. */
export const rawUrl = (f: ForgeAt, branch = SOURCE_BRANCH): string => `https://raw.githubusercontent.com/${f.repo}/${branch}/${encPath(f.path)}`;

/** The pdf.js viewer at `viewerHref` (page-relative), opened on `src`. The viewer's shim reads `?src=`. */
export function pdfViewerHref(viewerHref: string, src: string): string {
  return `${viewerHref}?src=${encodeURIComponent(src)}`;
}

/** What `sourceFileOf` needs of an entry. */
export interface SourceEntry {
  id: string;
  dir: string;
  sourceFile: string;
  sourceSha256: string;
}

/** What `sourceFileOf` needs of the uploads the graph read. */
export interface SourceUpload {
  kind: "file" | "intake";
  path: string;
  ingestedBy: string;
  docId?: string;
}

/**
 * The checkout path of the file the entry was ingested from, or `undefined`
 * when no copy is held: beside the entry, loose in an uploads queue that
 * names it, or inside an intake for it (the file its `files[]` records with
 * the entry's sha256, else the one named like the source). Only a file that
 * is on disk is returned — a link to bytes nobody holds is a 404.
 */
export function sourceFileOf(repoRoot: string, e: SourceEntry, uploads: readonly SourceUpload[]): string | undefined {
  const onDisk = (rel: string): string | undefined => (existsSync(join(repoRoot, rel)) ? rel : undefined);
  if (e.sourceFile && !e.sourceFile.includes("/")) {
    const beside = onDisk(`${e.dir}/${e.sourceFile}`);
    if (beside) return beside;
  }
  for (const u of uploads) {
    if (u.ingestedBy !== e.id && u.docId !== e.id) continue;
    if (u.kind === "file") {
      const hit = onDisk(u.path);
      if (hit) return hit;
      continue;
    }
    let files: { path?: string; sha256?: string }[] = [];
    try {
      files = (JSON.parse(readFileSync(join(repoRoot, u.path, "intake.json"), "utf-8")) as { files?: typeof files }).files ?? [];
    } catch {
      continue;
    }
    const pick =
      files.find((f) => e.sourceSha256 && f.sha256 === e.sourceSha256) ??
      files.find((f) => f.path && e.sourceFile && basename(f.path) === e.sourceFile);
    const hit = pick?.path ? onDisk(`${u.path}/${pick.path}`) : undefined;
    if (hit) return hit;
  }
  return undefined;
}

/**
 * The kinds of source a page can show inline, and so put in its view panel —
 * owner, 2026-10-16: *"primary asset should have a view panel (if that asset
 * kind has a viewer)"*. A PDF opens in the site's pdf.js viewer; an image is
 * drawn as itself. Anything else (a .docx, a spreadsheet) has no viewer, so
 * it is only linked.
 */
export type ViewKind = "pdf" | "image";

/** The {@link ViewKind} of a file, by its name; `undefined` when no viewer shows it. */
export function viewKindOf(name: string): ViewKind | undefined {
  if (/\.pdf$/i.test(name)) return "pdf";
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return "image";
  return undefined;
}

/**
 * The {@link ViewKind} of an entry's held source when its page will draw a view
 * panel for it — the condition {@link entryRepoLinks} sets `view` under: not
 * withheld, a source on disk ({@link sourceFileOf}), in a repository a link
 * can name, of a kind a viewer shows.
 */
export function viewableOf(
  repoRoot: string,
  e: SourceEntry & { withheld?: unknown },
  uploads: readonly SourceUpload[],
  checkoutRepo: string | undefined,
): ViewKind | undefined {
  if (e.withheld) return undefined;
  const source = sourceFileOf(repoRoot, e, uploads);
  if (!source || !forgeAt(repoRoot, source, checkoutRepo)) return undefined;
  return viewKindOf(basename(source));
}

/**
 * Where a reader can find a source this site does NOT hold — its DOI and arXiv
 * pages, from the entry's own identifiers. Owner, 2026-10-16: *"some of
 * sources not held b/c IP issues (but in that case we cant use viewer on CDN
 * b/c XSS)"* — so these are plain links out, never fed to the viewer. A DOI
 * still carrying a template's placeholder suffix (`10.1145/nnnnnnn`) names
 * nothing and is dropped.
 */
export function elsewhereLinks(e: { doi?: unknown; arxiv?: unknown }): { label: string; href: string }[] {
  const out: { label: string; href: string }[] = [];
  const doi = typeof e.doi === "string" ? e.doi.trim() : "";
  if (/^10\.\d{4,9}\/\S+$/.test(doi) && !/\/n{3,}$/i.test(doi)) out.push({ label: `doi:${doi}`, href: `https://doi.org/${encodeURI(doi)}` });
  const arxiv = typeof e.arxiv === "string" ? e.arxiv.trim() : "";
  if (/^(\d{4}\.\d{4,5}|[a-z-]+(\.[A-Z]{2})?\/\d{7})(v\d+)?$/i.test(arxiv)) out.push({ label: `arXiv:${arxiv}`, href: `https://arxiv.org/abs/${arxiv}` });
  return out;
}

/** What the view panel needs: the kind, the bytes, and for a PDF the pdf.js viewer's page-relative href. */
export interface ViewSource {
  kind: ViewKind;
  src: string;
  viewer?: string;
}

/** One link on an entry page's sources list. */
export interface RepoLink {
  label: string;
  href: string;
  what: string;
  /** Set on the link to the entry's primary asset when a viewer shows it — the page draws it in its view panel. */
  view?: ViewSource;
}

/**
 * The entry's source file and its KG files, in the repository that holds the
 * entry. A withheld entry gets none: its text is not published, and a link
 * to the PDF is the text.
 *
 * - the source: a PDF through the viewer (`viewerHref`, page-relative to the
 *   site's `assets/vendor/pdfjs/web/viewer.html`) and as the raw file; any
 *   other file raw;
 * - `structure.json`, and the `sections/` and `blocks/` JSON-LD directories,
 *   on GitHub. They are not copied into the site: an entry holds hundreds of
 *   them, and the manifest that names them is published already.
 */
export function entryRepoLinks(o: {
  repoRoot: string;
  /** The entry's directory in the checkout. */
  dir: string;
  /** The entry's source file in the checkout ({@link sourceFileOf}), when one is held. */
  source?: string;
  checkoutRepo: string | undefined;
  viewerHref: string;
  withheld?: boolean;
}): RepoLink[] {
  if (o.withheld) return [];
  const out: RepoLink[] = [];
  const src = o.source ? forgeAt(o.repoRoot, o.source, o.checkoutRepo) : undefined;
  if (src && o.source) {
    const name = basename(o.source);
    const raw = rawUrl(src);
    const kind = viewKindOf(name);
    if (kind === "pdf") {
      out.push({ label: name, href: pdfViewerHref(o.viewerHref, raw), what: `source PDF, in the PDF viewer (${src.repo})`, view: { kind, src: raw, viewer: o.viewerHref } });
      out.push({ label: `${name} (raw)`, href: raw, what: "source PDF, the file itself" });
    } else if (kind === "image") {
      out.push({ label: name, href: raw, what: `source image (${src.repo})`, view: { kind, src: raw } });
    } else {
      out.push({ label: name, href: raw, what: `source file (${src.repo})` });
    }
  }
  const dir = forgeAt(o.repoRoot, o.dir, o.checkoutRepo);
  if (dir) {
    const at = (rel: string): ForgeAt => ({ repo: dir.repo, path: `${dir.path}/${rel}` });
    // Existence and a link only: the file is never parsed here, so its variant is not read.
    if (existsSync(join(o.repoRoot, o.dir, STRUCTURE_FILENAME)))
      out.push({ label: STRUCTURE_FILENAME, href: blobUrl(at(STRUCTURE_FILENAME)), what: "ingestion structure (JSON), on GitHub" });
    if (existsSync(join(o.repoRoot, o.dir, "sections")))
      out.push({ label: "sections/", href: treeUrl(at("sections")), what: "section nodes (JSON-LD) and their text, on GitHub" });
    if (existsSync(join(o.repoRoot, o.dir, "blocks")))
      out.push({ label: "blocks/", href: treeUrl(at("blocks")), what: "block nodes (JSON-LD), on GitHub" });
  }
  return out;
}
