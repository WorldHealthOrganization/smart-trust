/**
 * The text rung — one or more text files into a library entry's
 * `structure.json` (`text-structure/v1`) and `sections/*.md`.
 *
 * @module scripts/text-structure
 * @covers none — a WRITER an ingest step calls, not an audit.
 *
 * Many sources (specifications, READMEs) are published as Markdown or XML in
 * git repositories, not as PDFs. The other rungs read pages, cells or slides;
 * printing a text file to PDF first would make the recorded sha256 identify a
 * rendering nobody published.
 *
 * What this rung decides:
 *
 * - **A Markdown file is divided by its own ATX headings**, outside fenced
 *   code (a `# comment` inside a ```gherkin block is not a heading). Lines
 *   before the first heading form a section titled by the file's front-matter
 *   `title:` when it has one — an `.mdx` page's title IS its front matter —
 *   and by its path otherwise.
 * - **Any other text file is ONE section, kept verbatim** in a fenced block;
 *   no division is inferred.
 * - **Nothing is rendered.** Shortcodes, JSX components and HTML stay as the
 *   author wrote them, and `structure_note` says so.
 * - **Images are recorded, never sectioned.** The caller names them with
 *   `--image`; each gets its digest in `source.files`, and `images.json` says
 *   `null` with the count, because which of them are figures is not
 *   established by this rung.
 * - **Several files are one source** when the publisher ships them as one
 *   (a specification version is a directory of pages). Each file keeps its own
 *   sha256, and the source's sha256 is that of the `sha256sum` listing, so
 *   anyone can recompute it from a checkout without this code.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/text-structure.ts -o <library-dir> --doc-id <id> \
 *     --base <dir> [--title <t>] [--name <display>] [--upstream <upstream.json>] \
 *     [--image <file>]... <file>...
 *
 * Paths are recorded relative to `--base`, in the order given.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { libraryEntryDir } from "./lib/library-entry-graphs.ts";

import {
  STRUCTURE_FILENAME,
  TEXT_STRUCTURE_SCHEMA_ID,
  TextStructureSchema,
  TextUpstreamSchema,
  type TextStructure,
} from "../schemas/content/document-structure.ts";

export interface InputFile {
  /** Path as recorded — relative to the base. */
  path: string;
  bytes: Buffer;
  image?: boolean;
}

export interface RungOutput {
  structure: TextStructure;
  images: { $schema: "folio-document-images/v1"; doc_id: string; images: [] | null; undetermined_reason?: string };
  /** Section id → the markdown file body, front matter included. */
  sections: Map<string, string>;
}

const ATX = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "section"
  );
}

const words = (s: string): number => s.split(/\s+/).filter(Boolean).length;
const sha = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");

/** Lines of a text, without a phantom empty line after a final newline. */
export function linesOf(text: string): string[] {
  const l = text.split(/\r?\n/);
  if (l.length > 1 && l[l.length - 1] === "") l.pop();
  return l;
}

/** The one-based index of the line closing a YAML front-matter block, or 0 when there is none. */
export function frontMatterEnd(lines: string[]): number {
  if (lines[0]?.trim() !== "---") return 0;
  for (let i = 1; i < lines.length; i++) if (lines[i]!.trim() === "---") return i + 1;
  return 0;
}

/** The front matter's `title:`, unquoted, when it has one. */
export function frontMatterTitle(lines: string[]): string | undefined {
  const end = frontMatterEnd(lines);
  for (let i = 1; i < end - 1; i++) {
    const m = lines[i]!.match(/^title:\s*(.+?)\s*$/);
    if (m) return m[1]!.replace(/^(["'])(.*)\1$/, "$2");
  }
  return undefined;
}

/** ATX headings outside fenced code and front matter, one-based line numbers. */
export function headingsOf(lines: string[]): Array<{ line: number; level: number; title: string }> {
  const out: Array<{ line: number; level: number; title: string }> = [];
  let fence: string | null = null;
  for (let i = frontMatterEnd(lines); i < lines.length; i++) {
    const l = lines[i]!;
    const f = l.match(FENCE);
    if (f) {
      const mark = f[1]!;
      if (fence === null) fence = mark;
      else if (mark[0] === fence[0] && mark.length >= fence.length && l.trim() === mark) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const h = l.match(ATX);
    if (h) out.push({ line: i + 1, level: h[1]!.length, title: h[2]!.trim() });
  }
  return out;
}

/**
 * Extensions of text formats that are never Markdown. A Python, shell or YAML
 * file has lines that look like ATX headings (`# a comment`), so deciding by
 * content alone cut generate_dvc_qr.py into 24 "sections" at its comments
 * (observed 2026-10-20). A file with one of these is verbatim, whatever it holds.
 */
const NOT_MARKDOWN = new Set([
  "py", "sh", "bash", "zsh", "ps1", "rb", "pl", "r", "yaml", "yml", "toml", "ini", "cfg", "conf",
  "json", "jsonld", "xml", "html", "htm", "svg", "csv", "tsv", "pem", "crt", "cer", "txt",
  "ts", "js", "mjs", "cjs", "kt", "kts", "java", "rs", "go", "c", "h", "cpp", "fsh", "cddl", "wit", "ttl", "sql",
]);

/**
 * Decided by the file's extension when it names a non-Markdown format, and
 * otherwise by content: an ATX heading outside fences, and not markup that
 * opens with `<`.
 */
export function formatOf(text: string, path?: string): "markdown" | "verbatim" {
  const ext = path?.match(/\.([A-Za-z0-9]+)$/)?.[1]?.toLowerCase();
  if (ext !== undefined && NOT_MARKDOWN.has(ext)) return "verbatim";
  if (text.trimStart().startsWith("<")) return "verbatim";
  return headingsOf(linesOf(text)).length > 0 ? "markdown" : "verbatim";
}

/** Count the image references a Markdown text carries — `![](…)` and `<img`. */
function imageRefs(text: string): number {
  return (text.match(/!\[[^\]]*\]\(|<img\s/g) ?? []).length;
}

/** Build the entry from files already read. Pure, so the tests need no disk. */
export function buildEntry(
  files: InputFile[],
  docId: string,
  opts: { title?: string; name?: string; upstream?: unknown; mtime?: string | null } = {},
): RungOutput {
  if (files.filter((f) => !f.image).length === 0) throw new Error("no text file to ingest");
  const upstream = opts.upstream === undefined || opts.upstream === null ? null : TextUpstreamSchema.parse(opts.upstream);

  const recorded = files.map((f) => {
    const text = f.image ? null : f.bytes.toString("utf-8");
    return {
      path: f.path,
      sha256: sha(f.bytes),
      bytes: f.bytes.length,
      lines: text === null ? null : linesOf(text).length,
      format: f.image ? ("image" as const) : formatOf(text!, f.path),
      text,
    };
  });

  const single = recorded.length === 1;
  const listing = recorded.map((f) => `${f.sha256}  ${f.path}\n`).join("");

  const used = new Set<string>();
  const sections: TextStructure["sections"] = [];
  const pending: Array<{ id: string; file: string; title: string; start: number; end: number; unit: "heading" | "file"; body: string }> = [];
  let k = 0;
  let firstTitle: string | undefined;
  let inlineImages = 0;

  const add = (file: string, title: string, level: number, start: number, end: number, unit: "heading" | "file", body: string) => {
    k += 1;
    let id = `s${String(k).padStart(3, "0")}-${slug(title)}`;
    while (used.has(id)) id += "-x";
    used.add(id);
    sections.push({ id, number: null, title, level, file, line_start: start, line_end: end, unit, n_chars: body.length, n_words: words(body) });
    pending.push({ id, file, title, start, end, unit, body });
  };

  for (const f of recorded) {
    if (f.text === null) continue;
    const lines = linesOf(f.text);
    const last = Math.max(1, lines.length);
    if (f.format === "verbatim") {
      const lang = f.text.trimStart().startsWith("<") ? "xml" : "text";
      add(f.path, f.path, 1, 1, last, "file", "```" + lang + "\n" + f.text.replace(/\s+$/, "") + "\n```");
      continue;
    }
    inlineImages += imageRefs(f.text);
    const hs = headingsOf(lines);
    const fmTitle = frontMatterTitle(lines);
    firstTitle ??= fmTitle ?? hs.find((h) => h.level === 1)?.title;
    const first = hs[0]!.line;
    const pre = lines.slice(0, first - 1).join("\n");
    // The preamble keeps the front matter verbatim: it is part of what the author wrote.
    if (pre.trim() !== "") add(f.path, fmTitle ?? f.path, 1, 1, first - 1, "heading", pre.replace(/\s+$/, ""));
    hs.forEach((h, i) => {
      const end = (hs[i + 1]?.line ?? lines.length + 1) - 1;
      const body = lines.slice(h.line - 1, end).join("\n").replace(/\s+$/, "");
      add(f.path, h.title, h.level, h.line, Math.max(h.line, end), "heading", body);
    });
  }

  const title = opts.title ?? firstTitle ?? docId;
  const files2: Map<string, string> = new Map();
  for (const s of pending) {
    const id = s.id;
    const fsha = recorded.find((r) => r.path === s.file)!.sha256;
    const fm = [
      "---",
      `doc_id: ${docId}`,
      `doc_title: ${JSON.stringify(title)}`,
      `section_id: ${id}`,
      `section_title: ${JSON.stringify(s.title)}`,
      `file: ${JSON.stringify(s.file)}`,
      `lines: ${s.start}-${s.end}`,
      `source_sha256: ${fsha.slice(0, 16)}`,
      `granularity: ${s.unit}`,
      "---",
    ].join("\n");
    files2.set(id, `${fm}\n${s.body}\n`);
  }

  const images = recorded.filter((f) => f.format === "image");
  const anyHeadings = recorded.some((f) => f.format === "markdown");
  const notes = [
    "Text is kept verbatim and NOT rendered: shortcodes, JSX components, HTML and link targets stay as the author wrote them.",
    "A Markdown file is divided by its own ATX headings outside fenced code; any other text file is one section, fenced verbatim. No division was inferred.",
  ];
  if (!single) notes.push(`${recorded.length} files form this one source; source.sha256 is the sha256 of their sha256sum listing, in files order.`);
  if (images.length > 0) notes.push(`${images.length} image file(s) are recorded with their digests and not ingested.`);

  const structure = TextStructureSchema.parse({
    _schema: TEXT_STRUCTURE_SCHEMA_ID,
    doc_id: docId,
    source: {
      file: opts.name ?? (single ? basename(recorded[0]!.path) : docId),
      sha256: single ? recorded[0]!.sha256 : sha(listing),
      digest: single ? "file" : "listing",
      bytes: recorded.reduce((n, f) => n + f.bytes, 0),
      mtime: opts.mtime ?? upstream?.committed ?? null,
      mimetype_sniffed: "text/plain",
      mimetype_source: "content",
      files: recorded.map(({ text: _t, ...r }) => r),
      upstream,
    },
    metadata: { title },
    toc_source: anyHeadings ? "headings" : "files",
    sections,
    structure_note: notes.join(" "),
  });

  const total = images.length + inlineImages;
  const imagesOut: RungOutput["images"] =
    total === 0
      ? { $schema: "folio-document-images/v1", doc_id: docId, images: [] }
      : {
          $schema: "folio-document-images/v1",
          doc_id: docId,
          images: null,
          undetermined_reason:
            `the source carries ${images.length} image file(s) and ${inlineImages} inline image reference(s); ` +
            "the text rung keeps text only and extracts no images, so which are figures is not established",
        };
  return { structure, sections: files2, images: imagesOut };
}

/** Read the files, build the entry, and write it under `<lib>/<docId>/`. */
export function runRung(
  paths: string[],
  imagePaths: string[],
  lib: string,
  docId: string,
  base: string,
  opts: { title?: string; name?: string; upstream?: unknown } = {},
): string {
  const rel = (p: string) => relative(resolve(base), resolve(p));
  const files: InputFile[] = [
    ...paths.map((p) => ({ path: rel(p), bytes: readFileSync(p) })),
    ...imagePaths.map((p) => ({ path: rel(p), bytes: readFileSync(p), image: true })),
  ];
  const o = buildEntry(files, docId, opts);
  // Re-ingest writes over the entry where it is filed (`library/<group>/<slug>/`,
  // bean `6fez`); a new entry lands unfiled at `library/<slug>/`.
  const dir = libraryEntryDir(lib, docId) ?? join(lib, docId);
  mkdirSync(join(dir, "sections"), { recursive: true });
  writeFileSync(join(dir, STRUCTURE_FILENAME), JSON.stringify(o.structure, null, 2) + "\n");
  for (const [sid, body] of o.sections) writeFileSync(join(dir, "sections", `${sid}.md`), body);
  writeFileSync(join(dir, "images.json"), JSON.stringify(o.images, null, 2) + "\n");
  return dir;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const flags: Record<string, string> = {};
  const images: string[] = [];
  const files: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--image") images.push(argv[++i]!);
    else if (a === "-o" || a.startsWith("--")) flags[a] = argv[++i]!;
    else files.push(a);
  }
  const lib = flags["-o"];
  const docId = flags["--doc-id"];
  const base = flags["--base"];
  if (!lib || !docId || !base || files.length === 0) {
    console.error(
      "usage: text-structure.ts -o <library-dir> --doc-id <id> --base <dir> [--title t] [--name n] [--upstream upstream.json] [--image f]... <file>...",
    );
    process.exit(2);
  }
  const upstream = flags["--upstream"] ? JSON.parse(readFileSync(flags["--upstream"], "utf-8")) : undefined;
  const dir = runRung(files, images, lib, docId, base, { title: flags["--title"], name: flags["--name"], upstream });
  console.log(`text-structure: wrote ${dir}`);
}
