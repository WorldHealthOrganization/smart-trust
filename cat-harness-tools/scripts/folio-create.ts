#!/usr/bin/env bun
/**
 * Create a document in the reader's folio, of any DOCUMENT KIND the loaded
 * knowledge graphs describe, or LINK an external document by URL into the
 * library as a `referenced` node.
 *
 * @module scripts/folio-create
 * @covers folio
 * @graphNode none — a writer into the folio and library graphs, not a schema itself
 *
 * The kinds are not a list here. They are whatever `document-kinds`
 * directories the layers in this checkout, its mounted layers
 * (`index.lock.json`), and its dependency chain (`needs` and
 * `dependencies.folioAssistant`) declare, read by
 * `gen-document-kinds-viz.ts`'s `readDocumentKinds` (the reader the
 * document-kinds viewer uses). A layer that adds a kind makes it creatable
 * with no change here.
 *
 * ## What it writes
 *
 * - `--kind`: `<folio>/<slug>/index.md`, where `<folio>` is the target
 *   repository's DECLARED folio directory (`folioDir`), falling back to the
 *   conventional `folio/` when none is declared. The page carries the kind in
 *   its front matter as `<instance>:<id>`, and one heading per section of the
 *   kind, its parent kind's (`extends`) first, each marked required or
 *   optional, with the section's description as a comment. It writes no
 *   subject matter (see `init-folio.ts`).
 * - `--link`: `<library>/<slug>/referenced.json` (validated against
 *   `ReferencedSourceSchema`) and `<library>/<slug>/manifest.jsonld` (built by
 *   `buildEntryNodes`), holding the upstream URL and copying no text.
 *   `<library>` is the target repository's declared `library` directory
 *   (`libraryRoot`), falling back to the conventional `library/`.
 *
 * Both refuse to overwrite an existing `<slug>/`.
 *
 * Usage:
 *   bun run cat folio:create --list [--root <repo>]
 *   bun run cat folio:create --kind l1 --slug my-guideline --title "My guideline" [--root <repo>]
 *   bun run cat folio:create --link https://example.org/spec --slug my-spec --title "My spec" [--library <name>] [--root <repo>]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import type { DocumentKind } from "../schemas/content/document-kind.ts";
import { folioDir, readDeclaration } from "../schemas/kg/cat-harness.ts";
import { corpusDirectoriesForGraph } from "../schemas/kg/harness-config.ts";
import {
  REFERENCED_SOURCE_SCHEMA_ID,
  ReferencedSourceSchema,
  type ReferencedSource,
} from "../schemas/library/referenced-source.ts";
import { buildEntryNodes } from "../pipeline/gen-library-jsonld.ts";
import { readDocumentKinds, type KindEntry } from "./gen-document-kinds-viz.ts";
import { libraryRoot } from "./ingest-document.ts";
import { HARNESS_ROOT, REPO_ROOT } from "./lib/roots.ts";

/** A kind as a reader names it: `id`, or `instance:id` when two layers declare one id. */
export function qualifiedKind(e: Pick<KindEntry, "instance" | "kind">): string {
  return `${e.instance}:${e.kind.id}`;
}

/**
 * Every document kind reachable from `root` — its own layers, its mounted
 * layers (`index.lock.json`), and its dependency chain (`needs` and
 * `dependencies.folioAssistant`).
 */
export function loadedDocumentKinds(root: string = REPO_ROOT ?? HARNESS_ROOT): KindEntry[] {
  return readDocumentKinds(root).kinds;
}

/**
 * The one kind `name` means, or why it means none. An unqualified id that two
 * layers declare is refused with both names, never picked: choosing one
 * would create a document of a structure the reader did not ask for.
 */
export function resolveKind(entries: readonly KindEntry[], name: string): KindEntry | { error: string } {
  const [inst, id] = name.includes(":") ? (name.split(":", 2) as [string, string]) : [undefined, name];
  const hits = entries.filter((e) => e.kind.id === id && (inst === undefined || e.instance === inst));
  if (hits.length === 1) return hits[0]!;
  if (hits.length > 1) return { error: `kind "${name}" is declared by ${hits.map(qualifiedKind).join(" and ")}; name one of them` };
  const known = entries.map(qualifiedKind).sort();
  return { error: `no loaded knowledge graph declares a document kind "${name}". Known: ${known.length ? known.join(", ") : "none — no instance in this checkout declares a document-kinds directory"}` };
}

/** The kind's sections with its ancestors' first, nearest parent last. A cycle or a missing parent stops the walk. */
export function sectionsOf(entry: KindEntry, entries: readonly KindEntry[]): DocumentKind["sections"] {
  const chain: KindEntry[] = [];
  const seen = new Set<string>();
  let cur: KindEntry | undefined = entry;
  while (cur && !seen.has(qualifiedKind(cur))) {
    seen.add(qualifiedKind(cur));
    chain.unshift(cur);
    const parent: string | undefined = cur.kind.extends;
    if (!parent) break;
    // The parent its own layer declares, else the one other layer that does.
    const here: string = cur.instance;
    const own: KindEntry | undefined = entries.find((e) => e.instance === here && e.kind.id === parent);
    const r: KindEntry | { error: string } = own ?? resolveKind(entries, parent);
    cur = "error" in r ? undefined : r;
  }
  const out: DocumentKind["sections"] = [];
  const ids = new Set<string>();
  for (const k of chain) for (const s of k.kind.sections) if (!ids.has(s.id)) { ids.add(s.id); out.push(s); }
  return out;
}

const yamlString = (s: string): string => JSON.stringify(s);
const commentSafe = (s: string): string => s.replace(/--/g, "‐‐");

/** The page this writes, as text. */
export function documentPage(entry: KindEntry, entries: readonly KindEntry[], title: string): string {
  const lines = [
    "---",
    `title: ${yamlString(title)}`,
    `documentKind: ${yamlString(qualifiedKind(entry))}`,
    "---",
    "",
    `# ${title}`,
    "",
    `<!-- A ${commentSafe(entry.kind.title)} (${qualifiedKind(entry)}, ${entry.kind.structure}). Created by folio-create; write the content under each heading. -->`,
    "",
  ];
  for (const s of sectionsOf(entry, entries)) {
    lines.push(`## ${s.title}`, "", `<!-- ${s.required ? "Required" : "Optional"}. ${commentSafe(s.description)} -->`, "");
  }
  return lines.join("\n");
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Write the document; returns the path written, or why nothing was. */
export function createDocument(opts: {
  root: string;
  kinds?: readonly KindEntry[];
  kind: string;
  slug: string;
  title: string;
}): { path: string } | { error: string } {
  if (!SLUG.test(opts.slug)) return { error: `slug "${opts.slug}" must be lower-case letters, digits and hyphens` };
  if (!opts.title.trim()) return { error: "title must not be empty" };
  const kinds = opts.kinds ?? loadedDocumentKinds(opts.root);
  const entry = resolveKind(kinds, opts.kind);
  if ("error" in entry) return entry;
  const dir = join(folioDir(opts.root), opts.slug);
  if (existsSync(dir)) return { error: `${relative(opts.root, dir) || dir} already exists; it is somebody's document, so nothing was written` };
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "index.md");
  writeFileSync(path, documentPage(entry, kinds, opts.title));
  return { path };
}

/** Resolve the target library directory: declared `library` graph(s), else the `library/` convention (R27/R28). */
function resolveTargetLibraryDir(root: string, library?: string): { dir: string } | { error: string } {
  try {
    if (readDeclaration(root) !== undefined || library !== undefined) {
      const declared = corpusDirectoriesForGraph(root, "library");
      if (declared.length > 0 || library !== undefined) {
        return { dir: resolve(root, libraryRoot(root, library)) };
      }
    }
    // declared-path-literal: the convention fallback when no declaration names
    // a library graph (R27/R28 — the folio on any harness, by convention).
    return { dir: join(root, "library") };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Link an external document by URL into the library as a `referenced` node
 * (`<library>/<slug>/referenced.json` + `<library>/<slug>/manifest.jsonld`).
 * Copies no text; records the upstream URL and provenance under
 * `ReferencedSourceSchema`.
 */
export function linkDocument(opts: {
  root: string;
  slug: string;
  title: string;
  url: string;
  library?: string;
  date?: string;
  publisher?: string;
  version?: string;
}): { path: string; manifestPath: string } | { error: string } {
  if (!SLUG.test(opts.slug)) return { error: `slug "${opts.slug}" must be lower-case letters, digits and hyphens` };
  const title = opts.title.trim();
  if (!title) return { error: "title must not be empty" };
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(opts.url);
  } catch {
    return { error: `url "${opts.url}" is not a valid URL` };
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return { error: `url "${opts.url}" must use http:// or https://` };
  }
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  if (!ISO_DATE.test(date)) return { error: `date "${date}" must be YYYY-MM-DD` };

  const targetLib = resolveTargetLibraryDir(opts.root, opts.library);
  if ("error" in targetLib) return targetLib;
  const dir = join(targetLib.dir, opts.slug);
  if (existsSync(dir)) {
    return { error: `${relative(opts.root, dir) || dir} already exists; it is somebody's library entry, so nothing was written` };
  }

  const version = (opts.version ?? "linked").trim() || "linked";
  const publisher = (opts.publisher ?? parsedUrl.hostname).trim() || parsedUrl.hostname;
  const record: ReferencedSource = ReferencedSourceSchema.parse({
    $schema: REFERENCED_SOURCE_SCHEMA_ID,
    identity: {
      title,
      version,
      document_number: opts.slug,
      date,
      publisher,
    },
    source: {
      kind: "published",
      url: parsedUrl.href,
      canonical: parsedUrl.href,
      package_id: opts.slug,
      version,
      read_from: "folio:create --link",
      read_at: date,
    },
    outline: [],
    outline_source: "none",
    materialization: {
      $schema: "folio-materialization/v1",
      state: "referenced",
      provenance: { upstream: { url: parsedUrl.href } },
      note: `Linked external document (${parsedUrl.href}) recorded by folio-create; no bytes copied.`,
    },
    withheld: {
      what: "Document body and full text",
      why: "Linked by URL into the library as a referenced source; content remains at the upstream address.",
    },
    links: [{ label: "upstream document", url: parsedUrl.href }],
  });

  mkdirSync(dir, { recursive: true });
  const path = join(dir, "referenced.json");
  writeFileSync(path, JSON.stringify(record, null, 2) + "\n");

  const nodes = buildEntryNodes(opts.slug, dir, dir);
  if (nodes.state !== "built") {
    return { error: `manifest generation failed for ${opts.slug}: ${nodes.state}` };
  }
  for (const f of nodes.files) {
    const outPath = join(dir, f.path);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, f.content);
  }
  return { path, manifestPath: join(dir, "manifest.jsonld") };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (import.meta.main) {
  const root = arg("--root") ?? process.cwd();
  const link = arg("--link");
  if (link !== undefined) {
    const slug = arg("--slug"), title = arg("--title");
    if (!slug || !title) {
      console.error("usage: folio:create --link <url> --slug <slug> --title <title> [--library <name>] [--root <repo>]");
      process.exit(2);
    }
    const r = linkDocument({
      root,
      slug,
      title,
      url: link,
      library: arg("--library"),
      date: arg("--date"),
      publisher: arg("--publisher"),
      version: arg("--version"),
    });
    if ("error" in r) {
      console.error(`folio:create: ${r.error}`);
      process.exit(1);
    }
    console.log(`wrote ${relative(root, r.path)}`);
    process.exit(0);
  }

  // The target repository and its mounted / dependency layers, plus the ambient checkout.
  const kinds = loadedDocumentKinds(root);
  const checkoutRoot = REPO_ROOT ?? HARNESS_ROOT;
  if (resolve(root) !== resolve(checkoutRoot)) {
    const seen = new Set(kinds.map(qualifiedKind));
    for (const k of loadedDocumentKinds(checkoutRoot)) {
      if (!seen.has(qualifiedKind(k))) {
        seen.add(qualifiedKind(k));
        kinds.push(k);
      }
    }
  }
  if (process.argv.includes("--list")) {
    for (const e of [...kinds].sort((a, b) => qualifiedKind(a).localeCompare(qualifiedKind(b)))) {
      console.log(`${qualifiedKind(e).padEnd(32)} ${e.kind.title}`);
    }
    if (kinds.length === 0) console.log("No instance in this checkout declares a document kind.");
    process.exit(0);
  }
  const kind = arg("--kind"), slug = arg("--slug"), title = arg("--title");
  if (!kind || !slug || !title) {
    console.error(
      "usage: folio:create --kind <id|instance:id> --slug <slug> --title <title> [--root <repo>]   |   " +
        "folio:create --link <url> --slug <slug> --title <title> [--library <name>] [--root <repo>]   |   " +
        "folio:create --list [--root <repo>]",
    );
    process.exit(2);
  }
  const r = createDocument({ root, kinds, kind, slug, title });
  if ("error" in r) {
    console.error(`folio:create: ${r.error}`);
    process.exit(1);
  }
  console.log(`wrote ${relative(root, r.path)}`);
}
