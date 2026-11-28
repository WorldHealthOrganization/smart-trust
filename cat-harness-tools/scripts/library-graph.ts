#!/usr/bin/env bun
/**
 * Read the L1 corpus — `library/` entries, `uploads/` queues, and the relation
 * between them.
 *
 * @module scripts/library-graph
 * @graphNode none — a reader over the library graph, not a schema itself
 *
 * `library/` is L1: every knowledge-graph reference to a source resolves
 * THROUGH it, never to a loose path or a bare URL.
 *
 * ## Upload → entry is content-verified
 *
 * Every `library/<slug>/manifest.jsonld` carries `meta.source_file` AND
 * `meta.source_sha256`. The hash is recomputed here rather than trusted, so
 * an entry matches its upload by CONTENT, not by name, and the relation
 * survives a file moving between queues. That is what "N uningested" counts,
 * counting documents and not plumbing (see {@link filesIn} on dotfiles).
 *
 * An entry with no `source_file` is **`unknown`**, never silently "not from
 * an upload": the relation is only as good as the manifest.
 *
 * ## Each declared `uploads` queue is counted on its own
 *
 * Several layers may declare an `uploads/` (the repository root and
 * `cat-harness` each do). Attribution follows declaration, so every count is
 * per queue and the reader returns them separately; a merged count would
 * report a set that does not exist.
 *
 * ## Read-only
 *
 * No ingestion is triggered and nothing is written; upload, process and
 * materialise-into-a-folio are writes, and live elsewhere.
 */
import { ENDONYM, languageOfFile, slugOfLocal } from "./lib/library-languages.ts";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";

import type { LibraryRef } from "./library-refs.ts";
import { basename, dirname, extname, join, relative } from "node:path";
import { createHash } from "node:crypto";

import { checkoutRootFor, directoriesForGraph, readDeclaration, repoRootFor, sourceLinks } from "../schemas/kg/cat-harness.js";
import { detectRepoUrl } from "../src/core/git-refs.js";
import { arxivId } from "./library-readmes.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

/** The repository's URL, asked once per root. */
const repoUrls = new Map<string, string | undefined>();
const REPO_URL = (root: string): string | undefined => {
  if (!repoUrls.has(root)) repoUrls.set(root, detectRepoUrl(root));
  return repoUrls.get(root);
};
import { proseBody, type SummaryStatus } from "../schemas/content/block-summary.ts";
import { withheldEntryFor } from "./lib/withheld.ts";
import { entryItems, type SummaryTally } from "./summaries.ts";
import { ingestRungOf, placedFigures, type IngestRung } from "../pipeline/gen-library-jsonld.ts";
import { VECTOR_FIGURES_FILE } from "../schemas/content/vector-figure.ts";
import { pagesOf, readStructure, STRUCTURE_FILENAME } from "../schemas/content/document-structure.ts";
import { corpusDirectoriesForGraph, rootInstanceName } from "../schemas/kg/harness-config.js";
import { ReferencedSourceSchema } from "../schemas/library/referenced-source.ts";
import { entryGraphFiles, entryGraphSitePath, libraryEntryDirs, libraryOfEntry, nonEntryDirs } from "./lib/library-entry-graphs.ts";
import { noteAbsent, splitDeclared } from "./lib/declared-presence.ts";
import { displayNarrative } from "./lib/narrative-display.ts";
import { narrativeFor } from "../schemas/content/narrative.ts";

/**
 * Whether a library entry's source upload is still on disk, and whether it is
 * the same bytes.
 *
 * `unknown` is a determined answer for an entry whose manifest names no
 * source file at all — an entry authored rather than ingested. Rendering it
 * as "missing" would accuse the corpus of losing something it never had.
 */
export type UploadLink = "match" | "differs" | "absent" | "unknown";

/** One `library/<slug>/`. */
export interface LibraryEntry {
  /** The slug — the identifier every reference resolves through. */
  id: string;
  /** The layer whose library this is, e.g. `cat-harness`. */
  instance: string;
  /** Repo-relative directory. */
  dir: string;
  /**
   * The title a reader is shown. A catalogue record's title when a catalogue
   * node names this slug (`libraryId`), else the manifest's, else the slug —
   * see `catalogueInfo` for why the order is that way round (bean `gnqa`).
   */
  title: string;
  /**
   * The manifest's own title, present ONLY when a catalogue title replaced
   * it. Kept rather than dropped: the extraction is still evidence of what
   * the ingest saw, and search still matches it.
   */
  extractedTitle?: string;
  /** From the manifest — `ingested`, `authored`, … or `""`. */
  provenance: string;
  /** Which ingest rung: `paged`, `tabular`, or a determined `none`. */
  rung: IngestRung;
  docId: string;
  sourceFile: string;
  sourceSha256: string;
  arxiv: string;
  doi: string;
  documentClass: string;
  /** Counts of what ingestion actually produced. */
  sections: number;
  blocks: number;
  /** Raster images the entry placed (`images.json`), whatever their role: scans, logos and figures alike. */
  images: number;
  /**
   * FIGURES the entry keeps — raster images and vector renders whose role is
   * `figure` (`images.json` + `vector-figures.json`). Not `images`: an entry
   * whose figures are drawn in vector ink read "images 1" with 15 figures,
   * because only the raster sidecar was counted (owner, 2026-11-14).
   */
  figures: number;
  /** OCR page files — a THIRD state: 0 may mean "never scanned", not "failed". */
  ocrPages: number;
  /** `true` when the entry has an `ocr/` directory at all. */
  hasOcr: boolean;
  hasManifest: boolean;
  hasStructure: boolean;
  hasImagesJson: boolean;
  /** The item's generated README on the repository host, when it has one. */
  readme?: string;
  /** First and last page the structure covers, or `null`. */
  pageStart: number | null;
  pageEnd: number | null;
  /** Summed over the structure's sections. */
  words: number;
  chars: number;
  /** Bytes on disk, the whole entry. */
  bytes: number;
  /** Where its source sits now, and whether it is the same bytes. */
  upload: UploadLink;
  /** The uploads queue holding it, when one does. */
  uploadInstance: string;
  /**
   * What references this slug, and from where — bean `jbx2`'s third ask.
   *
   * EMPTY IS A FINDING, not a blank: `library/` is L1 because every reference
   * to a source resolves through it, so a slug nothing names is a slug that
   * claim is not true of. Attached by the caller, because resolving which
   * directories to scan needs the declaration; absent when nobody scanned,
   * which is again not the same as empty.
   */
  referencedBy?: LibraryRef[];
  /**
   * The entry's AVATAR — the picture a reader sees for this book on a library
   * row and on the folio glass. Bean `zrvt`, issue #1006. Owner, 2026-09-23:
   * *"library items need avatar (book's) which should use the cover or
   * whatever is associated to it if there is something"*.
   *
   * In order: the rendered COVER beside the entry (`<slug>-cover.png`, the
   * file the content core's `scripts/gen-covers.ts` writes, emblem already masked),
   * then the first image `images.json` declares a `figure`. A logo is never
   * the avatar — it names who published the book, not the book.
   *
   * **ABSENT when there is nothing, or only something too big to be a
   * thumbnail** ({@link AVATAR_MAX_BYTES}). No guess, no placeholder URL: the
   * viewer draws a book glyph for an absent avatar, which says "no picture"
   * rather than a broken image saying "a picture failed".
   */
  avatar?: LibraryAvatar;
  /**
   * Why this entry is WITHHELD from publication, or absent when it is not —
   * the reason its library root's `withheld.json` gives (bean `cw35`).
   *
   * A withheld entry is still listed: its title, id and counts are metadata,
   * and hiding it would make "not ours to publish" look like "not ingested".
   * What goes is everything that reproduces the work — no avatar (its cover or
   * a figure), and no verbatim text in its block excerpts
   * ({@link readEntryBlocks} with `verbatim: false`). Our own writing about it
   * — figure descriptions and block summaries — stays (owner, 2026-09-24:
   * "Fix, keep summaries").
   */
  withheld?: string;
  /**
   * The structured half of {@link withheld}, when the list records it — issue
   * #1794. `gates` names which publication gate refused and how; `record` is
   * the catalogue record a reader is sent to instead of the text. Absent when
   * the list carries only a sentence, and the viewer then says the sentence.
   */
  withheldBy?: {
    gates?: { gate: string; verdict: string }[];
    record?: { id?: string; page?: string; uri?: string };
  };
  /**
   * The CATALOGUE RECORD behind this entry, when a node of the layer's
   * declared `catalogue` graph names the slug in `libraryId`. `record` is the
   * node's `metadataRef` (its Dublin Core record) as a repo-relative path,
   * present only when the file exists; `handle` is the node's Handle, when it
   * records one. Owner, 2026-11-10: a library entry page *"should have dublin
   * core linked at top"*. Absent when no catalogue node names the entry.
   */
  catalogue?: { record?: string; handle?: string; xml?: string; node?: string };
  /**
   * Set on an entry CATALOGUED BY REFERENCE ({@link referencedCatalogueEntries}):
   * the catalogue holds its record but this site holds no bytes, and these are
   * where its files are upstream (each `referenced` ORIGINAL bitstream's
   * `provenance.upstream`). Owner, 2026-11-10: a referenced item's title links
   * *"our ingested record in library and associated KG"*, not IRIS.
   */
  upstream?: { label: string; href: string }[];
  /**
   * The block-summary drain's counts for this entry — owner, 2026-09-24.
   *
   * Attached by the CALLER (`gen-library-viz`), for the reason `referencedBy`
   * is: counting needs every prose block's text read and hashed, and this
   * reader runs on every call of `check:l1-complete`, the narrative queue and
   * the MCP roots, none of which want that cost for a number they do not use.
   * Absent means nobody counted — never "nothing to summarise".
   */
  summaries?: SummaryTally;
  /**
   * The site-root path of the page that RENDERS this entry — attached by the
   * caller (`gen-library-viz` `entryView`), derived from the declarations and
   * never read from the asset (#1881). Absent when nobody derived it.
   */
  view?: string;
  /**
   * The kind of viewer the entry's held source opens in — attached by the
   * caller (`gen-library-viz`), set only when the page at {@link view} draws a
   * view panel for it. The folio glass reads it to show its eye (owner,
   * 2026-10-16). Absent means no viewer, or nobody derived it.
   */
  viewable?: "pdf" | "image";
  /**
   * The language of {@link title} (ISO 639-1) and the titles of the entry's
   * OFFICIAL language editions in the library, keyed by language — attached
   * by the caller (`gen-library-viz`, from `entryLanguages`). The listing
   * shows the reader's language under a title in another one (owner,
   * 2026-11-13). Never translated here: absent when no edition is held.
   */
  lang?: string;
  titles?: Record<string, string>;
  /**
   * Where else a reader can go for this entry — read from a `referenced`
   * entry's own `links` (`schemas/library/referenced-source.ts`). Owner, 2026-10-02:
   * a DAK IG is in a DAK base layer's library as an EXTERNAL reference,
   * so the row has nothing of its own to open and must say where the thing is.
   *
   * `href` is an absolute URL, or SITE-ROOT-relative with a leading `/` and no
   * base — the avatar's convention, composed by the viewer against wherever
   * the site is served. Absent when the entry records none.
   *
   * Also each JSON-LD graph of a sub-graph DECLARED inside the entry
   * (`within: "library"`, e.g. an `l1-extraction`), at the site path
   * it is published at beside the entry's manifest — bean 8pzh item 1.
   */
  links?: { label: string; href: string }[];
}

/**
 * An entry's recorded links, or `undefined` — only a `referenced.json` that
 * validates contributes any, so a malformed record adds nothing to a page
 * rather than a half-checked URL. `check:l1-complete` reports the malformation.
 */
export function referencedLinksOf(dir: string): { label: string; href: string }[] | undefined {
  const r = ReferencedSourceSchema.safeParse(readJson<unknown>(join(dir, "referenced.json")));
  if (!r.success || !r.data.links?.length) return undefined;
  return r.data.links.map((l) => ("url" in l ? { label: l.label, href: l.url } : { label: l.label, href: `/${l.site_path}` }));
}

/** Where an entry's picture came from, where it lives, and where it is published. */
export interface LibraryAvatar {
  /** Site-root-relative, leading `/`, no base — composed by the viewer. */
  href: string;
  /** The source file, REPO-relative — what `gen-library-viz` copies to {@link href}. */
  src: string;
  source: "cover" | "figure";
}

/**
 * The largest picture that becomes an avatar. Measured 2026-09-23 over every
 * library entry: covers are 6–15 KB, but a first figure runs to 1.3 MB (a
 * full-page scan). An avatar is a thumbnail's job, and the copy is committed,
 * so a picture over this has NO avatar rather than a megabyte in the site.
 */
/** An entry's rendered first page, inside its own directory — what `avatarOf` takes before any figure. */
export const COVER_FILENAME = "cover.png";

export const AVATAR_MAX_BYTES = 128 * 1024;

/**
 * The entry's avatar, or `undefined`.
 *
 * PUBLISHED AS A COPY under the site's own `assets/library/avatars/`, not at
 * the layer's mount. The mount (`/library/<instance>/`) exists only on the
 * BUILT site, so a cover linked there 404'd on every surface that serves the
 * committed tree — the e2e server, and any page read before the build. A
 * copy resolves on all of them, and `gen-library-viz --check` fails when a
 * copy's bytes differ from its source, so it cannot drift.
 */
export function avatarOf(
  libDir: string,
  instance: string,
  slug: string,
  images: { images?: unknown[] } | null | undefined,
  repoRoot: string,
  sourceFile?: string,
): LibraryAvatar | undefined {
  const fits = (abs: string): boolean =>
    existsSync(abs) && statSync(abs).isFile() && statSync(abs).size <= AVATAR_MAX_BYTES;
  const make = (abs: string, source: LibraryAvatar["source"]): LibraryAvatar => {
    const ext = extname(abs).toLowerCase() || ".png";
    return {
      href: `/assets/library/avatars/${instance}/${slug}${ext}`,
      src: relative(repoRoot, abs).split("\\").join("/"),
      source,
    };
  };
  const cover = join(libDir, `${slug}-cover.png`);
  if (fits(cover)) return make(cover, "cover");
  // Page 1 rendered at ingest (`ingest-document` cover arm, or a backfill by
  // `library-covers.ts`), kept inside the entry so promotion carries it.
  const rendered = join(libDir, slug, COVER_FILENAME);
  if (fits(rendered)) return make(rendered, "cover");
  // A PDF WITH NO COVER GETS NO PICTURE -- owner, 2026-10-30 (option C). Its
  // first figure is whatever happened to come first: for arxiv-2404.04834v4 a
  // near-black game screenshot from page 11, shown as the book's face on the
  // library row and the folio glass. The book glyph says "no cover" honestly;
  // `library:covers` renders the page-1 cover and `library:covers:check`
  // fails where a held PDF lacks one.
  if (typeof sourceFile === "string" && /\.pdf$/i.test(sourceFile)) return undefined;
  for (const raw of images?.images ?? []) {
    const img = raw as { file?: unknown; role?: unknown };
    if (img.role !== "figure" || typeof img.file !== "string") continue;
    // The FIRST figure decides. A later, smaller one is not "the picture
    // associated with the book", it is whichever happened to be small.
    const abs = join(libDir, slug, img.file);
    return fits(abs) ? make(abs, "figure") : undefined;
  }
  return undefined;
}

/**
 * One QUEUED UNIT — a loose file, or a declared intake.
 *
 * ## Why a unit rather than a file, and why that is read rather than assumed
 *
 * A queue held loose files until the IRIS work landed. It now also holds
 * per-document directories carrying an `intake.json` (`"$schema":
 * "folio-intake/v1"`) whose `files[]` declares the capture — for the worked
 * example, four files that are *three different kinds of thing that a single
 * `uploads/` entry has never had to tell apart before*, in its own words.
 *
 * Counting those four as four queued documents would have made the badge say
 * 4 where one document is waiting, and counting the `.extraction.json`
 * sidecars beside them would have made it 7. Neither is a queue anybody has.
 * **The intake declares which files are the capture, so the reader asks it**
 * — the same principle `directory-conventions` states for every other graph
 * here: a directory says what to expect and the files declare what they are.
 */
export interface UploadItem {
  /** File name, or the intake directory's name. */
  file: string;
  /**
   * `file` — a loose file dropped in the queue.
   * `intake` — a directory whose `intake.json` declares a capture.
   */
  kind: "file" | "intake";
  /** The layer whose queue this is. */
  instance: string;
  /** Repo-relative path. */
  path: string;
  /** Bytes: the file, or the whole intake directory. */
  bytes: number;
  /** Lower-case extension without the dot, or `""`. `""` for an intake. */
  ext: string;
  /** The library slug that names this unit, or `""` — the badge's basis. */
  ingestedBy: string;
  /** Intake only: the `doc_id` it declares. */
  docId: string;
  /** Intake only: its declared title. */
  title: string;
  /** Intake only: how many files `files[]` declares. */
  declaredFiles: number;
}

/** One declared `uploads/` queue, counted on its own. */
export interface UploadQueue {
  instance: string;
  /** Repo-relative directory. */
  dir: string;
  total: number;
  ingested: number;
  /** `total - ingested`. The badge. */
  uningested: number;
}

/** The whole reading. */
export interface LibraryGraph {
  entries: LibraryEntry[];
  uploads: UploadItem[];
  queues: UploadQueue[];
  /**
   * How the reference scan went, when one ran.
   *
   * Carried so a reader can tell "nothing references this" from "nothing
   * looked". Absent means no scan; `unreadable` non-empty means the scan is
   * incomplete and every zero below it is provisional.
   */
  /** Bean `65oe`: no `filesRead` — it measured the checkout, not the library. */
  refScan?: { unreadable: string[] };
}

/** Parse JSON, or `undefined`. Unreadable and absent are the caller's to tell apart. */
/** A file's text, or null — the third state, never an empty string. */
function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    // Absent or unreadable. The caller renders "no content" rather than an
    // empty document, which are different facts.
    return null;
  }
}

function readJson<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return undefined;
  }
}

/**
 * Files directly in a directory, sorted; `[]` when it is not there.
 *
 * **Dot-prefixed names are not entries.** A queue's `.gitignore` is
 * repository plumbing, not a document waiting to be ingested, and counting it
 * made the first run of this reader report 23 uningested in `uploads/` when
 * 22 documents were waiting. A badge that is wrong by one is a badge nobody
 * trusts the second time, and this is the same dot-prefix rule
 * `directory-conventions` applies to every path segment.
 */
function filesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .filter((f) => !f.startsWith(".") && statSync(join(dir, f)).isFile());
}

/** Bytes of a directory tree. */
function treeBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const st = statSync(p);
    n += st.isDirectory() ? treeBytes(p) : st.size;
  }
  return n;
}

function sha256(path: string): string {
  const h = createHash("sha256");
  h.update(readFileSync(path));
  return h.digest("hex");
}

/**
 * The layer a declared directory belongs to.
 *
 * Its parent's basename — `cat-harness/library` belongs to `cat-harness`, and
 * a directory at the repository root belongs to the repository. Derived from
 * the resolved path rather than passed in, so a caller cannot label a queue
 * with a layer it did not come from, which is the mislabelling `v1hw`
 * warns about from the other direction.
 *
 * The repository root's layer is its DECLARED name, never
 * `basename(repoRoot)` (bean `t5dm`): the root's basename is wherever the
 * repository was cloned — a worktree named `pr1290` published
 * `"uploadInstance": "pr1290"` — while a sub-instance's first path segment is
 * a path INSIDE the repository and the same in every clone.
 *
 * A root that declares nothing is NOT named after its folder any more (issue
 * #1904): it belongs to the landing layer when exactly one harness is
 * decided (`rootInstanceName`), and otherwise this throws, because a queue
 * labelled with a guessed layer is the mislabelling above.
 */
export function instanceOf(absDir: string, repoRoot: string): string {
  const rel = relative(repoRoot, absDir).split("\\").join("/");
  const parts = rel.split("/");
  if (parts.length > 1) return parts[0]!;
  const name = rootInstanceName(repoRoot);
  if (name === undefined) {
    throw new Error(
      `${absDir} sits at the root of ${repoRoot}, which declares no instance and has no single landing harness ` +
        `(issue #1904) — cannot say which instance it belongs to. Declare the root, or flag one harness's site.landing.`,
    );
  }
  return name;
}

/**
 * Read every declared `library` and `uploads` directory reachable from these
 * roots.
 *
 * Returns `null` when no root declares either — not an empty graph. A folio
 * with no corpus simply has none, and a consumer rendering the two alike
 * reports a clean run over something it never opened.
 */
/**
 * One block of an entry's graph, as a viewer needs it — bean `7nvr`.
 *
 * NOT the whole `.jsonld`. The corpus holds 1715 blocks over roughly a
 * megabyte of JSON-LD against a 44 KB index, so projecting every field of
 * every block into one file is how a viewer stops loading. What a reader
 * wants of a block is what it IS, where it sits and whether anybody has
 * described it; the prose itself is a `.md` the entry already carries and the
 * viewer does not render.
 *
 * `types` keeps BOTH — a block is dual-typed
 * (`["folio-assistant-core:Figure", "doco:Figure"]`) so a DoCO reader gets
 * something meaningful without knowing our vocabulary, and collapsing that to
 * one would throw away the half this project did not invent.
 */
export interface LibraryBlock {
  id: string;
  /** Both of them. See above. */
  types: string[];
  kind: string;
  title: string;
  pageStart: number | null;
  pageEnd: number | null;
  /** The section `.md` or image this block points at, entry-relative. */
  target: string | null;
  /** `not-authored` | `draft` | `confirmed` | `rejected`, or null where a kind carries none. */
  narrative: string | null;
  /**
   * What the block actually SAYS — bean `lrmo`.
   *
   * A row showing only a narrative STATE tells a reader that a description
   * exists and not what it is, which is the gap the owner hit on first use:
   * *"i expected to be able to see narrative content of extracted node"*.
   *
   * Two sources, because the two kinds carry content differently. A FIGURE's
   * is `narrative.text` — an authored description, ours, short: 404 of them
   * total 128 KB, so it is carried whole. A PROSE block's is the section
   * markdown it points at, and those total **3.25 MB** with one entry at
   * 508 KB, so carrying them whole would make opening one entry cost half a
   * megabyte. Prose is excerpted.
   */
  content: string | null;
  /**
   * True when {@link content} is an excerpt rather than the whole thing.
   *
   * Stated rather than inferred from length. A reader who cannot tell a short
   * section from a truncated one is being shown a claim about the document
   * that the data does not support, and silent truncation is the same defect
   * as a silent skip everywhere else in this repository.
   */
  truncated: boolean;
  provenance: string;
  /**
   * The agent summary of a PROSE block, carried BESIDE {@link content} —
   * never instead of it. Owner, 2026-09-24: *"the extract of a node is
   * shown, but no agentic summary"*.
   *
   * Its own field because the two are different kinds of claim: `content` is
   * the source's words, `summary.text` is an agent's account of them, with a
   * state that says whether a person has agreed. Folding one into the other
   * is the defect `content` already has for figures, where a narrative
   * replaces the extract and a block cannot show both.
   *
   * `null` for a kind that is not summarised (figures). A prose block with no
   * summary yet is NOT null: it is `{status: "not-summarised"}`, which the
   * viewer says out loud.
   */
  summary: BlockSummaryView | null;
}

/**
 * What the viewer needs of a block summary — its words, its state and whose
 * they are. Every field but `status` is OMITTED when there is nothing to say:
 * 1325 prose blocks carry one of these, and a dozen nulls on each is how a
 * per-entry file grows by megabytes to say "not yet summarised".
 */
export interface BlockSummaryView {
  status: SummaryStatus;
  /** The summary's words. */
  text?: string;
  /** The narrative's own state — `rejected` stays visible although the block is back in the backlog. */
  state?: string;
  /** Who drafted it: kind, id and — for an agent — the model. */
  draftedBy?: { kind: string; id: string; model?: string };
  draftedAt?: string;
  /** Who confirmed it — always a person when present. */
  confirmedBy?: string;
  rejectionReason?: string;
}

/**
 * Read ONE entry's blocks, in page order.
 *
 * Separate from {@link readLibraryGraph} on purpose. That one runs over every
 * declared library on every call — `check:l1-complete`, the narrative queue,
 * `gen-library-jsonld` and the MCP graph roots all use it — and reading 1715
 * files to answer "how many blocks" would make every one of them slower for a
 * number they already have. The index counts; this reads, and only when
 * somebody opens an entry.
 *
 * ## The order is NOT the manifest's, because the manifest does not have one
 *
 * The obvious source is `manifest.contains`, and the first draft of this
 * function used it. Measured on `arxiv-2602.12670v4`: `contains` holds **82
 * entries, all of them sections, and names no block at all** — while the
 * entry has 85 block files. So every block fell through to the alphabetical
 * tail, which sorts `figure-img-p025-1` ahead of `prose-sec-000` and presents
 * the document opening with a colourbar from page 25.
 *
 * **A manifest links DOWN to its sections; blocks link UP to the manifest**
 * (`derivedFrom`, `sourceDocument`). There is no downward edge to a block, so
 * there is no manifest order to take. That asymmetry is a property of the
 * graph, not of this reader, and it is left as it is — bean `7nvr` reports it
 * rather than inventing the missing edge.
 *
 * So the order is `pageStart`, then id: derivable from what a block actually
 * carries, and it IS document order. A block with no page sorts last rather
 * than first, because an unplaced block is an oddity and burying it at the
 * top of the list is how it goes unnoticed.
 */
/**
 * How much of a prose section travels in the projection.
 *
 * 600 characters is a paragraph or so — enough to tell one section from
 * another while browsing, which is what this view is for. Reading the section
 * is a different act and the file is right there.
 *
 * Derived rather than picked: 1311 prose blocks at this bound add roughly
 * 790 KB across 27 entries, against 3.25 MB for the whole corpus and a 508 KB
 * worst entry. The largest single entry stays well under what one on-demand
 * fetch should cost.
 */
const PROSE_EXCERPT = 600;

export function readEntryBlocks(dir: string, opts: { verbatim?: boolean } = {}): LibraryBlock[] {
  // `verbatim: false` — the entry is WITHHELD (bean `cw35`): a prose block's
  // excerpt IS the source's words, so it goes; a figure's narrative and every
  // summary are ours, so they stay.
  const verbatim = opts.verbatim ?? true;
  const blocksDir = join(dir, "blocks");
  const files = filesIn(blocksDir).filter((f) => f.endsWith(".jsonld"));

  const byId = new Map<string, LibraryBlock>();
  // The summary drain's own reading of this entry — its statuses, including
  // STALE, come from one definition rather than a second one here. An
  // invalid sidecar yields no summaries rather than no blocks: the extract is
  // still worth showing, and `check:l1-complete` reports the sidecar.
  let items: ReturnType<typeof entryItems> = [];
  try {
    items = entryItems(dir);
  } catch {
    items = [];
  }
  const summaryOf = new Map(items.map((it) => [it.block, it]));
  for (const f of files) {
    const d = readJson<Record<string, unknown>>(join(blocksDir, f));
    if (!d) continue;
    const id = typeof d["@id"] === "string" ? (d["@id"] as string) : f.replace(/\.jsonld$/, "");
    const t = d["@type"];
    // One entry per language is possible (bean `cat-tools-e1lo`); the graph shows
    // the one `narrativeFor` picks — no locale at build time, so the first.
    const nar = displayNarrative(d.narrative);
    // A figure's description is authored and short — carried whole. A prose
    // block's is the section file, excerpted. See `content` on the interface.
    let content: string | null = typeof nar?.text === "string" ? (nar.text as string) : null;
    let truncated = false;
    if (content === null && verbatim && typeof d.text === "string") {
      const md = readText(join(blocksDir, d.text as string));
      if (md !== null) {
        const body = proseBody(md);
        truncated = body.length > PROSE_EXCERPT;
        content = truncated ? body.slice(0, PROSE_EXCERPT).trimEnd() : body;
      }
    }
    byId.set(id, {
      id,
      types: Array.isArray(t) ? (t as string[]) : typeof t === "string" ? [t] : [],
      kind: typeof d.kind === "string" ? d.kind : "",
      title: typeof d.title === "string" ? d.title : "",
      pageStart: typeof d.pageStart === "number" ? d.pageStart : null,
      pageEnd: typeof d.pageEnd === "number" ? d.pageEnd : null,
      // `text` on prose, `file` on a figure — one field for the viewer, and
      // which one it came from is already said by `kind`.
      target: typeof d.text === "string" ? d.text : typeof d.file === "string" ? d.file : null,
      narrative: typeof nar?.state === "string" ? nar.state : null,
      content,
      truncated,
      provenance: typeof d.provenance === "string" ? d.provenance : "",
      summary: (() => {
        const it = summaryOf.get(id);
        if (!it) return null;
        const n = it.record?.narrative ? narrativeFor(it.record.narrative) : undefined;
        const d = n?.drafted_by;
        return {
          status: it.status,
          ...(n?.text ? { text: n.text } : {}),
          ...(n ? { state: n.state } : {}),
          ...(d ? { draftedBy: { kind: d.kind, id: d.id, ...(d.model ? { model: d.model } : {}) } } : {}),
          ...(n?.drafted_at ? { draftedAt: n.drafted_at } : {}),
          ...(n?.confirmed_by ? { confirmedBy: n.confirmed_by.id } : {}),
          ...(n?.rejection_reason ? { rejectionReason: n.rejection_reason } : {}),
        };
      })(),
    });
  }

  // `?? Infinity` rather than `?? 0`: an unplaced block sorts LAST. See above.
  return [...byId.values()].sort(
    (a, b) => (a.pageStart ?? Infinity) - (b.pageStart ?? Infinity) || a.id.localeCompare(b.id),
  );
}

/**
 * Catalogue titles by library slug, for one layer root (bean `gnqa`,
 * finding 5).
 *
 * A manifest's `title` is whatever the extractor found on the first page, and
 * for a scanned or designed cover that is often not the title at all —
 * measured 2026-10-02: `who-pub-tps-931` read "Abies", `wpr-rdo-2020-003-eng`
 * read "PUBLICATION AND INFORMATION", and `9789241548960-eng` read "Handbook
 * forGuideline Development 2nd edition". Each of the three already has a
 * catalogue node that names the slug in `libraryId` and carries the
 * publisher's own title. A record somebody catalogued outranks a string an
 * extractor guessed, so the catalogue answers first and the manifest only
 * where no catalogue node names the entry.
 *
 * Read from the layer's DECLARED `catalogue` graph, the same lookup
 * `intakeTitle` uses — never a hardcoded `catalogue/nodes` path.
 */
/** What a catalogue node says about the library entry it names. */
interface CatalogueEntryInfo {
  title?: string;
  /** Absolute path of the node's Dublin Core record, when the file exists. */
  record?: string;
  handle?: string;
  /**
   * The record's Dublin Core XML rendering, SITE-relative
   * (`<instance>/dublin-core/<stem>.dc.xml`), when the layer's published root
   * holds it. Owner, 2026-11-10: *"dublic core sould be the XML"*.
   */
  xml?: string;
  /** Absolute path of the catalogue node itself — the item's node in the KG. */
  node?: string;
}

/**
 * The directory a layer serves at `/<instance>/` — the one its declaration
 * marks `instanceRoot` (what `mount-instance-docs` publishes there), or
 * undefined when it marks none.
 */
function publishedRootOf(instanceRoot: string): string | undefined {
  const decl = readDeclaration(instanceRoot) as { directories?: { path?: string; instanceRoot?: boolean }[] } | undefined;
  const dir = decl?.directories?.find((d) => d.instanceRoot === true && typeof d.path === "string")?.path;
  return dir === undefined || dir.includes("..") ? undefined : join(instanceRoot, dir);
}

/**
 * The site path of a record's Dublin Core XML rendering, when the layer's
 * published root holds one: `<published root>/dublin-core/<stem>.dc.xml`
 * (the content core's `dc-render`) is served at `<instance>/dublin-core/…`.
 */
function dcXmlSitePath(instanceRoot: string, record: string): string | undefined {
  const root = publishedRootOf(instanceRoot);
  const stem = basename(record).replace(/\.dc\.json$/, "");
  if (root === undefined || stem === basename(record)) return undefined;
  const file = `${stem}.dc.xml`;
  // The site serves the layer at its DECLARED name, not at whatever the
  // checkout directory is called (a clone at `who-iris-217/` is still `/who-iris/`).
  const name = (readDeclaration(instanceRoot) as { name?: unknown } | undefined)?.name;
  const served = typeof name === "string" && name ? name : basename(instanceRoot);
  return existsSync(join(root, "dublin-core", file)) ? `${served}/dublin-core/${file}` : undefined;
}
const catalogueInfoCache = new Map<string, Map<string, CatalogueEntryInfo>>();
function catalogueInfo(instanceRoot: string): Map<string, CatalogueEntryInfo> {
  const hit = catalogueInfoCache.get(instanceRoot);
  if (hit) return hit;
  const out = new Map<string, CatalogueEntryInfo>();
  for (const cat of directoriesForGraph(instanceRoot, "catalogue")) {
    const nodes = join(cat, "nodes");
    if (!existsSync(nodes)) continue;
    for (const f of readdirSync(nodes).filter((n) => n.endsWith(".json")).sort()) {
      const node = readJson<{
        libraryId?: unknown; title?: unknown; metadataRef?: unknown; handle?: unknown;
        bitstreams?: { name?: unknown; bundle?: unknown; materialization?: { provenance?: { local?: unknown } } }[];
      }>(join(nodes, f));
      if (typeof node?.libraryId !== "string") continue;
      const langOf = new Map<string, string>();
      for (const b of node.bitstreams ?? []) {
        const sl = slugOfLocal(b.materialization?.provenance?.local);
        const lg = typeof b.name === "string" ? languageOfFile(b.name) : undefined;
        if (sl && lg) langOf.set(sl, lg);
      }
      // The entry it names, and every entry one of its ORIGINAL bitstreams was
      // derived into (`provenance.local` = `library/<slug>/structure.json#source`):
      // the other language editions IRIS keeps on the same item (who-iris#217).
      const slugs = [node.libraryId, ...(node.bitstreams ?? [])
        .filter((b) => b.bundle === "ORIGINAL")
        .map((b) => slugOfLocal(b.materialization?.provenance?.local))
        .filter((x): x is string => !!x)].filter((x) => !out.has(x));
      if (slugs.length === 0) continue;
      // `metadataRef` is relative to the layer root (`catalogue/records/<x>.dc.json`).
      const record = typeof node.metadataRef === "string" && node.metadataRef && !node.metadataRef.includes("..")
        ? join(instanceRoot, node.metadataRef)
        : undefined;
      const xml = record && existsSync(record) ? dcXmlSitePath(instanceRoot, record) : undefined;
      for (const slug of new Set(slugs)) out.set(slug, {
        // Another edition of the item is titled as the item, with its language.
        ...(typeof node.title === "string" && node.title.trim()
          ? { title: slug !== node.libraryId && langOf.has(slug) ? `${node.title.trim()} (${ENDONYM[langOf.get(slug)!] ?? langOf.get(slug)})` : node.title.trim() }
          : {}),
        ...(record && existsSync(record) ? { record } : {}),
        ...(xml ? { xml } : {}),
        node: join(nodes, f),
        ...(typeof node.handle === "string" && node.handle.trim() ? { handle: node.handle.trim() } : {}),
      });
    }
  }
  catalogueInfoCache.set(instanceRoot, out);
  return out;
}

/**
 * What an intake is a capture OF, as a title (bean `d4lb`).
 *
 * `folio-intake/v1` no longer repeats what another record says: it names a
 * catalogue `item`, or a Dublin Core `record`, and carries its own `title`
 * only when neither exists. So the title is looked up in that order — the
 * intake's own, then the catalogue node (in the layer's declared
 * `catalogue` graph), then the record's `dc.title` — and is `""` when none
 * answers, which the uploads view already renders as untitled.
 */
function intakeTitle(intake: { title?: string; item?: string; record?: string }, dir: string): string {
  if (intake.title) return intake.title;
  if (intake.item) {
    // entry → its library (past a concern group, bean `6fez`) → the layer.
    const instanceRoot = dirname(libraryOfEntry(dir));
    for (const cat of directoriesForGraph(instanceRoot, "catalogue")) {
      const nodes = join(cat, "nodes");
      if (!existsSync(nodes)) continue;
      for (const f of readdirSync(nodes).filter((n) => n.endsWith(".json"))) {
        const node = readJson<{ id?: string; title?: string }>(join(nodes, f));
        if (node?.id === intake.item && node.title) return node.title;
      }
    }
  }
  if (intake.record) {
    const rec = readJson<{ fields?: { element?: string; qualifier?: string; values?: { value?: string }[] }[] }>(
      join(dir, intake.record),
    );
    const t = rec?.fields?.find((f) => f.element === "title" && !f.qualifier)?.values?.[0]?.value;
    if (t) return t;
  }
  return "";
}

export function readLibraryGraph(roots: string[], repoRoot: string = checkoutRootFor(roots[0] ?? ".")): LibraryGraph | null {
  // `repoRoot` is passed by a caller whose first root IS the repository root:
  // `repoRootFor` of that is its parent, which put every upload queue under
  // one wrong layer with a path one level too long (#1168 B7a-2).
  const libDirs = new Set<string>();
  const upDirs = new Set<string>();
  for (const r of roots) {
    for (const d of corpusDirectoriesForGraph(r, "library")) libDirs.add(d);
    for (const d of directoriesForGraph(r, "uploads")) upDirs.add(d);
  }
  // A layer that declares a library declares its own queue, and that
  // declaration does not always reach the roots passed in: measured
  // 2026-09-20, `directoriesForGraph(cat-harness, "library")` resolves
  // the IRIS replica's `library` while `…(cat-harness, "uploads")` does NOT
  // resolve its `uploads`. Reading the entries of a queue this reader then
  // omitted would report a layer's corpus as though it arrived from
  // nowhere. So each library's own layer root is asked for its queue.
  for (const lib of [...libDirs]) {
    for (const d of directoriesForGraph(dirname(lib), "uploads")) upDirs.add(d);
  }
  if (libDirs.size === 0 && upDirs.size === 0) return null;

  // Entries first: the uploads pass needs to know which files are named.
  const entries: LibraryEntry[] = [];
  /** `source_file` → the slug naming it, and the sha it claims. */
  const named = new Map<string, { slug: string; sha: string }>();

  // Declared-but-absent is REPORTED, not read (bean `95ir`; the owner's ruling
  // of 2026-09-23: fail in CI for the declaration, `check:declared-dirs`, and
  // never in a scanner). Reading one threw ENOENT and took the whole graph
  // with it (a DAK IG declares library/ and is mounted without it).
  const presence = splitDeclared([...libDirs]);
  noteAbsent(presence.absent, "a library");
  for (const libDir of presence.present.sort()) {
    const instance = instanceOf(libDir, repoRoot);
    const notEntries = nonEntryDirs(libDir);
    // Flat or filed in a concern group (`library/<group>/<slug>/`, bean `6fez`).
    for (const { slug, dir } of libraryEntryDirs(libDir)) {
      // Another kind's directory kept in the library is not an entry.
      if (notEntries.has(dir.replace(/[/\\]+$/, ""))) continue;
      const has = (f: string): boolean => existsSync(join(dir, f));
      const manifest = readJson<{
        title?: string;
        provenance?: string;
        meta?: Record<string, unknown>;
      }>(join(dir, "manifest.jsonld"));
      const meta = (manifest?.meta ?? {}) as Record<string, unknown>;
      const str = (k: string): string => (typeof meta[k] === "string" ? (meta[k] as string) : "");
      // Through the shared accessor (bean rkqp). A file that conforms to no
      // declared variant contributes no sections, as an absent one always has;
      // the per-field number guards below stay, as a second line. Pages come
      // only from a format that has them: `pagesOf` is undefined for a
      // notebook, never a cell index read as a page.
      const read = readStructure(dir);
      const secs: Array<{ page_start?: number; page_end?: number; n_words?: number; n_chars?: number }> =
        "reason" in read
          ? []
          : read.sections.map((s) => ({
              page_start: pagesOf(s)?.start,
              page_end: pagesOf(s)?.end,
              n_words: s.n_words,
              n_chars: s.n_chars,
            }));
      /**
       * Sum a section field, keeping only the values that are actually numbers.
       *
       * The guard is not defensive tidiness — it is the difference between a
       * count and a script. `structure.json` comes from an ingested corpus
       * this repository did not author, and `reduce((n, s) => n + s.n_words)`
       * is string CONCATENATION the moment one `n_words` is a string. The
       * result then flows to `gen-library-viz`, which renders `words` through
       * `toLocaleString()` — one of only two fields it does NOT pass through
       * `esc()`, because both were assumed numeric — and straight into
       * `innerHTML`.
       *
       * Measured 2026-09-22 with `n_words: '<img src=x onerror="alert(1)">'`:
       * `words` came out as the string `0<img src=x onerror="alert(1)">` and
       * rendered unescaped. Bean `1wef`, surface 2.
       *
       * The `pages` line directly below already guards this exact class with
       * `typeof n === "number"`. That guard was the one `words` and `chars`
       * needed, four lines away.
       */
      const sumSections = (pick: (s: (typeof secs)[number]) => unknown): number =>
        secs.reduce((n, s) => {
          const v = pick(s);
          return typeof v === "number" && Number.isFinite(v) ? n + v : n;
        }, 0);
      const pages = secs.flatMap((s) => [s.page_start, s.page_end]).filter((n): n is number => typeof n === "number");
      const images = readJson<{ images?: unknown[] }>(join(dir, "images.json"));
      const sourceFile = str("source_file");
      const sourceSha = str("source_sha256");
      if (sourceFile) named.set(sourceFile, { slug, sha: sourceSha });

      entries.push({
        id: slug,
        instance,
        dir: relative(repoRoot, dir).split("\\").join("/"),
        ...(() => {
          const extracted = manifest?.title ?? slug;
          const catalogued = catalogueInfo(dirname(libDir)).get(slug)?.title;
          return catalogued && catalogued !== extracted
            ? { title: catalogued, extractedTitle: extracted }
            : { title: extracted };
        })(),
        ...(() => {
          const info = catalogueInfo(dirname(libDir)).get(slug);
          const record = info?.record ? relative(repoRoot, info.record).split("\\").join("/") : undefined;
          return info && (record || info.handle)
            ? { catalogue: { ...(record ? { record } : {}), ...(info.handle ? { handle: info.handle } : {}), ...(info.xml ? { xml: info.xml } : {}), ...(info.node ? { node: relative(repoRoot, info.node).split("\\").join("/") } : {}) } }
            : {};
        })(),
        provenance: manifest?.provenance ?? "",
        rung: ingestRungOf(has),
        docId: str("doc_id"),
        sourceFile,
        sourceSha256: sourceSha,
        // The manifest records arXiv as `{ id, version }`; `str` flattened that
        // to "" for every item (bean `qgjh`). Read as the item's README reads it.
        arxiv: arxivId(meta.arxiv),
        doi: str("doi"),
        documentClass: str("document_class"),
        sections: filesIn(join(dir, "sections")).filter((f) => f.endsWith(".md")).length,
        blocks: filesIn(join(dir, "blocks")).filter((f) => f.endsWith(".jsonld")).length,
        images: images?.images?.length ?? filesIn(join(dir, "images")).length,
        figures: placedFigures(
          images as Parameters<typeof placedFigures>[0],
          readJson<{ figures?: unknown[] | null }>(join(dir, VECTOR_FIGURES_FILE)),
        ).length,
        ocrPages: filesIn(join(dir, "ocr")).length,
        hasOcr: existsSync(join(dir, "ocr")),
        hasManifest: has("manifest.jsonld"),
        hasStructure: has(STRUCTURE_FILENAME),
        hasImagesJson: has("images.json"),
        pageStart: pages.length ? Math.min(...pages) : null,
        pageEnd: pages.length ? Math.max(...pages) : null,
        words: sumSections((s) => s.n_words),
        chars: sumSections((s) => s.n_chars),
        bytes: treeBytes(dir),
        // Filled in by the uploads pass: the link is a fact about both ends,
        // and deciding it here would mean deciding it without the file.
        upload: sourceFile ? "absent" : "unknown",
        uploadInstance: "",
        // The item's own page (bean `qgjh`): its generated README, on the
        // repository host, only when that README exists.
        ...(existsSync(join(dir, "README.md"))
          ? { readme: sourceLinks(REPO_URL(repoRoot), `${relative(repoRoot, dir).split("\\").join("/")}/README.md`, "main")?.viewHref }
          : {}),
        ...(() => {
          // The entry's declared sub-graphs (bean 8pzh item 1): each JSON-LD
          // document in one is published beside the manifest by
          // `gen-library-viz`, and linked from the entry here. A withheld
          // entry publishes none, so it links none.
          const graphs = withheldEntryFor(dir)
            ? []
            : entryGraphFiles(dir)
                .filter((f) => f.jsonld)
                .map((f) => ({ label: f.rel, href: `/${entryGraphSitePath(instance, slug, f.rel)}` }));
          const links = [...((has("referenced.json") ? referencedLinksOf(dir) : undefined) ?? []), ...graphs];
          return links.length ? { links } : {};
        })(),
        ...(() => {
          const w = withheldEntryFor(dir);
          if (w) {
            const by = { ...(w.gates ? { gates: w.gates } : {}), ...(w.record ? { record: w.record } : {}) };
            return { withheld: w.reason, ...(Object.keys(by).length ? { withheldBy: by } : {}) };
          }
          const avatar = avatarOf(dirname(dir), instance, slug, images, repoRoot, sourceFile);
          return avatar ? { avatar } : {};
        })(),
      });
    }
  }

  const uploads: UploadItem[] = [];
  const queues: UploadQueue[] = [];
  const byId = new Map(entries.map((e) => [e.id, e]));

  for (const upDir of [...upDirs].sort()) {
    const instance = instanceOf(upDir, repoRoot);
    let ingested = 0;

    // Declared intakes first. A directory carrying `intake.json` is ONE
    // queued document, whatever it holds — see the note on `UploadItem`.
    for (const name of existsSync(upDir) ? readdirSync(upDir).sort() : []) {
      const sub = join(upDir, name);
      if (name.startsWith(".") || !statSync(sub).isDirectory()) continue;
      const intake = readJson<{
        doc_id?: string;
        title?: string;
        item?: string;
        record?: string;
        files?: unknown[];
      }>(join(sub, "intake.json"));
      // A subdirectory with no intake is not a queued unit and not an error
      // either: it is something this reader does not model, and saying so is
      // better than counting it as a document.
      if (!intake) continue;
      const docId = intake.doc_id ?? name;
      const hit = byId.has(docId) ? docId : "";
      if (hit) ingested++;
      uploads.push({
        file: name,
        kind: "intake",
        instance,
        path: relative(repoRoot, sub).split("\\").join("/"),
        bytes: treeBytes(sub),
        ext: "",
        ingestedBy: hit,
        docId,
        title: intakeTitle(intake, sub),
        declaredFiles: intake.files?.length ?? 0,
      });
      const e = byId.get(docId);
      // An intake IS the source, so an entry reached through one is linked
      // even when no single `source_file` sits loose in the queue.
      if (e && e.upload === "absent") {
        e.upload = "match";
        e.uploadInstance = instance;
      }
    }

    const loose = filesIn(upDir);
    // A SIDECAR IS NOT A QUEUED DOCUMENT.
    //
    // `<source>.extraction.json` describes the capture of `<source>`; counting
    // it as a unit of its own is the same error `UploadItem`'s own note records
    // for an intake's declared files, and that note names THIS case in the same
    // breath: *"counting the `.extraction.json` sidecars beside them would have
    // made it 7."* The intake half was handled when it was written; the loose
    // half was not, so a queue of fifteen sources counted as thirty and the
    // uploads view's headline — the number the whole page exists to state —
    // was inflated by its own metadata. Found by rendering it (issue #836).
    //
    // Keyed on the SOURCE being present, so an ORPHAN sidecar whose source has
    // gone stays visible as a unit rather than vanishing. A file nothing
    // accounts for is precisely what a queue view exists to surface, and
    // silently dropping it would be this defect with the sign flipped.
    const present = new Set(loose);
    const files = loose.filter((f) => {
      const source = f.endsWith(".extraction.json")
        ? f.slice(0, -".extraction.json".length)
        : "";
      return source === "" || !present.has(source);
    });
    for (const file of files) {
      const hit = named.get(file);
      if (hit) {
        ingested++;
        const e = byId.get(hit.slug);
        if (e) {
          // Recomputed, never trusted. A name match says somebody dropped a
          // file with the right name; a hash match says it is the same
          // document. Only the second is evidence, and the difference is
          // exactly the one a queue badge would otherwise paper over.
          e.upload = hit.sha ? (sha256(join(upDir, file)) === hit.sha ? "match" : "differs") : "unknown";
          e.uploadInstance = instance;
        }
      }
      uploads.push({
        file,
        kind: "file",
        instance,
        path: relative(repoRoot, join(upDir, file)).split("\\").join("/"),
        bytes: statSync(join(upDir, file)).size,
        ext: (file.split(".").pop() ?? "").toLowerCase() === file ? "" : (file.split(".").pop() ?? "").toLowerCase(),
        ingestedBy: hit?.slug ?? "",
        docId: "",
        title: "",
        declaredFiles: 0,
      });
    }
    const dirRel = relative(repoRoot, upDir).split("\\").join("/");
    const units = uploads.filter((u) => u.instance === instance && u.path.startsWith(`${dirRel}/`));
    queues.push({
      instance,
      dir: dirRel,
      total: units.length,
      ingested,
      uningested: units.length - ingested,
    });
  }

  // Sorted: the projection built from this is committed, and an artefact
  // reproducible only where it was generated is a snapshot, not a generated
  // file.
  entries.sort((a, b) => a.dir.localeCompare(b.dir));
  uploads.sort((a, b) => a.path.localeCompare(b.path));
  queues.sort((a, b) => a.dir.localeCompare(b.dir));
  return { entries, uploads, queues };
}

if (import.meta.main) {
  const here = join(HARNESS_ROOT);
  const g = readLibraryGraph([here, repoRootFor(here)]);
  if (g === null) {
    console.error("no library or uploads directory is declared — nothing to read");
    process.exit(2);
  }
  console.log(`entries  ${g.entries.length}`);
  for (const e of g.entries) {
    console.log(
      `  ${e.id.padEnd(24)} ${e.rung.padEnd(8)} sections=${String(e.sections).padStart(4)} ` +
        `blocks=${String(e.blocks).padStart(4)} ocr=${String(e.ocrPages).padStart(4)} upload=${e.upload}`,
    );
  }
  console.log(`queues`);
  for (const q of g.queues) {
    console.log(`  ${q.dir.padEnd(22)} ${q.total} file(s), ${q.ingested} ingested, ${q.uningested} UNINGESTED`);
  }
}

/**
 * Library entries for the items a layer's catalogue holds BY REFERENCE —
 * owner, 2026-11-10: *"i dont wnat this this link to go to iris, but our
 * ingested record in linbrary and associated KG"*.
 *
 * A `referenced` catalogue item has a Dublin Core record here and its files
 * upstream; it has no `<library>/<slug>/` directory, and the catalogue schema
 * forbids it a `libraryId` (that names materialized bytes). So it is listed
 * from the catalogue instead: one entry per `referenced` item whose
 * `metadataRef` resolves, id the record's stem (`10665-360869`, the name its
 * Dublin Core renderings carry), counts zero, and `upstream` naming its files.
 *
 * NOT part of {@link readLibraryGraph}: the L1 checks, the narrative queue and
 * the MCP roots read that graph as "what was ingested", and an entry with no
 * structure would read to them as a failed ingest. Only the library's pages
 * add these. An id a held entry already uses, in any layer, is skipped, and
 * an id two layers' catalogues both hold is listed once (first layer by path).
 */
export function referencedCatalogueEntries(roots: string[], repoRoot: string, taken: ReadonlySet<string>): LibraryEntry[] {
  const libDirs = new Set<string>();
  for (const r of roots) for (const d of corpusDirectoriesForGraph(r, "library")) libDirs.add(d);
  const out: LibraryEntry[] = [];
  const seen = new Set<string>();
  // `taken` is keyed `<instance>/<id>`; an id held in ANY layer is taken.
  const takenIds = new Set([...taken].map((k) => k.slice(k.lastIndexOf("/") + 1)));
  for (const libDir of [...libDirs].sort()) {
    if (!existsSync(libDir)) continue;
    const instanceRoot = dirname(libDir);
    const instance = instanceOf(libDir, repoRoot);
    for (const cat of directoriesForGraph(instanceRoot, "catalogue")) {
      const nodes = join(cat, "nodes");
      if (!existsSync(nodes)) continue;
      for (const f of readdirSync(nodes).filter((n) => n.endsWith(".json")).sort()) {
        const node = readJson<{
          flavour?: unknown; title?: unknown; handle?: unknown; libraryId?: unknown; metadataRef?: unknown;
          materialization?: { state?: unknown };
          bitstreams?: { name?: unknown; bundle?: unknown; materialization?: { state?: unknown; provenance?: { upstream?: unknown } } }[];
        }>(join(nodes, f));
        if (!node || node.flavour !== "item" || node.libraryId !== undefined) continue;
        if (node.materialization?.state !== "referenced") continue;
        if (typeof node.metadataRef !== "string" || node.metadataRef.includes("..") || !node.metadataRef.endsWith(".dc.json")) continue;
        const record = join(instanceRoot, node.metadataRef);
        if (!existsSync(record)) continue;
        const id = basename(record).replace(/\.dc\.json$/, "");
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) continue;
        // By id alone: the site publishes one `entries/<id>.json` per id and
        // the library slice keys on it, and several layers' catalogues hold the
        // same record (each smart-* layer cites `who-smart-guidelines`).
        if (takenIds.has(id) || seen.has(id)) continue;
        seen.add(id);
        const files = (node.bitstreams ?? []).filter(
          (b) => b.bundle === "ORIGINAL" && b.materialization?.state === "referenced" &&
            typeof b.materialization.provenance?.upstream === "string" && /^https:\/\//.test(b.materialization.provenance.upstream as string),
        );
        const upstream = files.map((b) => ({
          label: typeof b.name === "string" && b.name ? b.name : "the file",
          href: b.materialization!.provenance!.upstream as string,
        }));
        const handle = typeof node.handle === "string" && node.handle.trim() ? node.handle.trim() : undefined;
        const xml = dcXmlSitePath(instanceRoot, record);
        const title = typeof node.title === "string" && node.title.trim() ? node.title.trim() : id;
        const sourceFile = typeof files[0]?.name === "string" ? (files[0].name as string) : "";
        out.push({
          id, instance,
          dir: relative(repoRoot, join(libDir, id)).split("\\").join("/"),
          title,
          provenance: "catalogued",
          rung: "none",
          docId: id, sourceFile, sourceSha256: "", arxiv: "", doi: "", documentClass: "",
          sections: 0, blocks: 0, images: 0, figures: 0, ocrPages: 0,
          hasOcr: false, hasManifest: false, hasStructure: false, hasImagesJson: false,
          pageStart: null, pageEnd: null, words: 0, chars: 0, bytes: 0,
          upload: "unknown", uploadInstance: "",
          catalogue: { record: relative(repoRoot, record).split("\\").join("/"), ...(handle ? { handle } : {}), ...(xml ? { xml } : {}), node: relative(repoRoot, join(nodes, f)).split("\\").join("/") },
          ...(upstream.length ? { upstream } : {}),
          ...(() => {
            const avatar = avatarOf(libDir, instance, id, null, repoRoot, sourceFile);
            return avatar ? { avatar } : {};
          })(),
        } as LibraryEntry);
      }
    }
  }
  return out;
}
