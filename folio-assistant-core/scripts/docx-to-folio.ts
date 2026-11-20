#!/usr/bin/env bun
/**
 * docx-to-folio — a `docx-structure/v1` extraction, aligned to its review
 * PDF by `pdf-line-map.py`, written out as an editable DOCUMENT folio:
 * chapters, nested sections, and one block per paragraph, list, table,
 * figure or call-out. Beans `xtpc` and `v26p`, issue #197.
 *
 * ## What each block carries, and why
 *
 * `meta.source` records where the block came from in the FROZEN review
 * version: the PDF page (and printed page), the first and last line number,
 * and how the place was found (`method`). That is the provenance #197 asks
 * for, "not just back to the bibliographic item, but the page and line
 * number of the rendered version", and it is what a public comment citing
 * "p.22, l.618–624" is resolved against.
 *
 * The same facts are also written ONCE, as `review-anchors.json` beside the
 * document manifest (`folio-review-anchors/v1`). A comment importer needs
 * the whole index at once; loading a thousand block manifests to build it
 * would make the importer depend on the TypeScript loader for no reason.
 *
 * ## Ids are content-derived, never positional
 *
 * A block's label is `<prefix><section key>-<hash>`, where the hash is of the
 * block's normalised text (bean `xtpc`: "heading path plus a normalised text
 * hash, with a collision suffix"). Inserting a paragraph therefore renames
 * nothing else. On a re-run over an existing folio, a block whose text hash
 * is already in the old `review-anchors.json` KEEPS its old label, so
 * comments already anchored to it stay anchored.
 *
 * ## What it does not do
 *
 * It writes a folio once from a source. After that the folio is the
 * document, edited by people, and the source is the library's frozen record.
 * Re-running it over an edited folio would overwrite their edits, so it
 * refuses to write into a non-empty document directory without `--force`.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const ANCHORS_SCHEMA = "folio-review-anchors/v1" as const;

// ── Input shapes ─────────────────────────────────────────────────

export interface ListEntry {
  level: number;
  md: string;
  text: string;
}
export interface StructureItem {
  seq: number;
  type: "heading" | "paragraph" | "list" | "table" | "image" | "callout" | "caption";
  level?: number;
  style?: string;
  md?: string;
  text?: string;
  items?: ListEntry[];
  ordered?: boolean;
  rows?: string[][];
  media?: string;
  /** Clockwise degrees Word rotates the picture; `media` is already the rotated copy. */
  rot?: number;
  target?: string;
  number?: string;
}
export interface Structure {
  source: { file: string; sha256: string };
  items: StructureItem[];
  footnotes: Record<string, string>;
  media: string[];
  /** Rotated copies `docx-structure.py --media-dir` writes: path → source and angle. */
  rotations?: Record<string, { source: string; rot: number }>;
  warnings?: string[];
}
export interface Alignment {
  seq: number;
  page: number;
  pageEnd?: number;
  lineStart?: number;
  lineEnd?: number;
  method: string;
}
export interface LineMap {
  source: { file: string; sha256: string; pages: number };
  pages: Record<string, { printed: string | null }>;
  alignment: Alignment[];
}

// ── Output shapes ────────────────────────────────────────────────

export interface AnchorSource {
  page: number;
  pageEnd?: number;
  printedPage?: string;
  lineStart?: number;
  lineEnd?: number;
  method: string;
}
export interface AnchorBlock extends AnchorSource {
  label: string;
  kind: "prose" | "table" | "figure";
  chapter: string;
  /** The block's file root name in its chapter directory. */
  root: string;
  /** Section label path, outermost first. */
  sections: string[];
  /** "Table 3.1" / "Figure 2.2", when the block carries a caption. */
  caption?: string;
  /** sha256 of the normalised text, first 12 hex: the re-ingest key. */
  hash: string;
  /** First 160 characters, for a person scanning the index. */
  excerpt: string;
}
export interface AnchorSection {
  label: string;
  /** "3.4.5", "C", "D.1": as printed. Absent for an unnumbered section. */
  number?: string;
  title: string;
  chapter: string;
  page?: number;
  lineStart?: number;
  parent?: string;
}
export interface ReviewAnchors {
  $schema: typeof ANCHORS_SCHEMA;
  document: string;
  library: string;
  source: { docx: { file: string; sha256: string }; pdf: { file: string; sha256: string; pages: number } };
  chapters: Array<{ dir: string; title: string; number?: number; label: string }>;
  sections: AnchorSection[];
  blocks: AnchorBlock[];
}

// ── Helpers ──────────────────────────────────────────────────────

export const slugify = (s: string, max = 48) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "") || "untitled";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const textHash = (s: string) => createHash("sha256").update(norm(s)).digest("hex").slice(0, 12);

/** "3.4.5 Governance", "5.1 Emerging", "D.1  Illustrative", "Appendix C: Foo". */
export function splitNumber(text: string): { number?: string; title: string } {
  const t = text.replace(/\s+/g, " ").trim();
  const app = /^Appendix\s+([A-Z])\b\s*[:.\-—–]?\s*(.*)$/.exec(t);
  if (app) return { number: app[1], title: app[2] ? `Appendix ${app[1]}: ${app[2]}` : `Appendix ${app[1]}` };
  const m = /^((?:[A-Z]\.)?\d+(?:\.\d+)*)\.?\s+(\S.*)$/.exec(t);
  if (m) return { number: m[1], title: m[2] };
  return { title: t };
}

const keyOf = (n: string) => n.replace(/\./g, "-").toLowerCase();

function listMd(item: StructureItem): string {
  return (item.items ?? [])
    .map((e) => `${"  ".repeat(e.level)}${item.ordered ? "1." : "-"} ${e.md}`)
    .join("\n");
}

function tableMd(rows: string[][]): string {
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill("")].map((c) => c.replace(/\n/g, " ").trim() || " ");
  const head = pad(rows[0]);
  const out = [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`];
  for (const r of rows.slice(1)) out.push(`| ${pad(r).join(" | ")} |`);
  return out.join("\n");
}

/** A 1×1 table is a box (a definition, a call-out), not tabular data. */
const isBox = (rows: string[][]) => rows.length === 1 && rows[0].filter((c) => c.trim()).length === 1;

const quote = (md: string) =>
  md
    .split(/<br>|\n/)
    .map((l) => `> ${l}`.trimEnd())
    .join("\n>\n");

const footnoteRefs = (md: string) => [...md.matchAll(/\[\^(\d+)\]/g)].map((m) => m[1]);

const ts = (s: string) => JSON.stringify(s);

// ── The transform ────────────────────────────────────────────────

export interface ConvertOptions {
  slug: string;
  library: string;
  title?: string;
  authors?: string[];
  date?: string;
  /** The previous anchors, for label reuse on re-ingest. */
  previous?: ReviewAnchors;
}

interface SecNode {
  title: string;
  lead?: boolean;
  label: string;
  number?: string;
  blocks: string[];
  subsections: SecNode[];
  level: number;
}
interface ChapterNode {
  dir: string;
  title: string;
  number?: number;
  label: string;
  sections: SecNode[];
}
export interface FileOut {
  path: string;
  content: string;
}
export interface ConvertResult {
  files: FileOut[];
  anchors: ReviewAnchors;
  /** Media paths (as in the .docx, `media/imageN.png`) the folio references. */
  media: string[];
  stats: Record<string, number>;
}

export function convert(structure: Structure, map: LineMap, opts: ConvertOptions): ConvertResult {
  const align = new Map(map.alignment.map((a) => [a.seq, a]));
  const previousByHash = new Map<string, string>();
  for (const b of opts.previous?.blocks ?? []) previousByHash.set(`${b.kind}:${b.hash}`, b.label);

  const items = structure.items;
  const titleItem = items.find((i) => i.type === "heading" && i.level === 0);
  const docTitle = opts.title ?? titleItem?.text ?? opts.slug;
  // A Subtitle-styled paragraph before the first chapter belongs to the cover.
  const firstChapterSeq = items.find((i) => i !== titleItem && i.type === "heading" && i.level === 0)?.seq ?? Infinity;
  const subtitleItem = items.find((i) => i.style === "Subtitle" && i.seq < firstChapterSeq);

  const chapters: ChapterNode[] = [];
  const anchors: ReviewAnchors = {
    $schema: ANCHORS_SCHEMA,
    document: opts.slug,
    library: opts.library,
    source: { docx: structure.source, pdf: map.source },
    chapters: [],
    sections: [],
    blocks: [],
  };
  const files: FileOut[] = [];
  const usedLabels = new Set<string>();
  const usedDirs = new Set<string>();
  const usedRoots = new Map<string, Set<string>>();
  const media: string[] = [];
  const stats: Record<string, number> = { prose: 0, table: 0, figure: 0, sections: 0, chapters: 0, reused: 0 };

  let chapter: ChapterNode | null = null;
  /** The open section path: index k holds the innermost section at heading depth k. */
  let path: SecNode[] = [];
  let h1count = 0;
  let pendingCaption: StructureItem | null = null;
  let lead = false;

  const uniq = (set: Set<string>, base: string) => {
    let v = base;
    for (let n = 2; set.has(v); n++) v = `${base}-${n}`;
    set.add(v);
    return v;
  };

  const src = (seq: number): AnchorSource => {
    const a = align.get(seq);
    if (!a) return { page: 0, method: "none" };
    const printed = map.pages[String(a.page)]?.printed ?? undefined;
    return {
      page: a.page,
      ...(a.pageEnd ? { pageEnd: a.pageEnd } : {}),
      ...(printed ? { printedPage: printed } : {}),
      ...(a.lineStart !== undefined ? { lineStart: a.lineStart } : {}),
      ...(a.lineEnd !== undefined ? { lineEnd: a.lineEnd } : {}),
      method: a.method,
    };
  };

  const startChapter = (title: string, seq: number) => {
    // A chapter's number is the leading component of the first numbered
    // heading inside it; looked ahead, because Word numbers Heading 1
    // automatically and the text of "Introduction" says nothing.
    let number: number | undefined;
    for (const it of items.slice(seq + 1)) {
      if (it.type === "heading" && it.level === 0) break;
      if (it.type === "heading") {
        const n = splitNumber(it.text ?? "").number;
        if (n && /^\d/.test(n)) {
          number = Number(n.split(".")[0]);
          break;
        }
      }
    }
    const base = number ? `ch${number}-${slugify(title, 32)}` : slugify(title, 40);
    chapter = { dir: uniq(usedDirs, base), title, ...(number ? { number } : {}), label: "", sections: [] };
    chapter.label = uniq(usedLabels, `chap:${chapter.dir}`);
    usedRoots.set(chapter.dir, new Set());
    chapters.push(chapter);
    stats.chapters++;
    path = [];
    h1count = 0;
    lead = false;
  };

  const currentSection = (): SecNode => {
    if (!chapter) startChapter(docTitle, -1);
    if (path.length === 0) {
      // Text before the chapter's first heading: an untitled lead section.
      const sec: SecNode = { title: chapter!.title, lead: true, label: uniq(usedLabels, `sec:${chapter!.dir}-lead`), blocks: [], subsections: [], level: 1 };
      chapter!.sections.push(sec);
      path = [sec];
      lead = true;
      anchors.sections.push({ label: sec.label, title: chapter!.title, chapter: chapter!.dir });
    }
    return path[path.length - 1];
  };

  const openSection = (it: StructureItem) => {
    if (!chapter) startChapter(docTitle, -1);
    const depth = Math.max(1, Math.min(4, it.level ?? 1));
    const split = splitNumber(it.text ?? "");
    const title = split.title;
    let number = split.number;
    if (depth === 1 && !number && chapter!.number) {
      h1count++;
      number = `${chapter!.number}.${h1count}`;
    } else if (depth === 1 && number && /^\d/.test(number)) {
      h1count = Number(number.split(".")[1] ?? h1count);
    }
    // Close deeper (or equal) sections; the lead section closes on any heading.
    if (lead) {
      path = [];
      lead = false;
    }
    while (path.length > 0 && path[path.length - 1].level >= depth) path.pop();
    const parent = path[path.length - 1];
    const key = number ? keyOf(number) : `${parent ? parent.label.replace(/^sec:/, "") + "-" : `${chapter!.dir}-`}${slugify(title, 32)}`;
    const sec: SecNode = {
      title: number ? `${number} ${title}` : title,
      label: uniq(usedLabels, `sec:${key}`),
      ...(number ? { number } : {}),
      blocks: [],
      subsections: [],
      level: depth,
    };
    if (parent) parent.subsections.push(sec);
    else chapter!.sections.push(sec);
    path.push(sec);
    stats.sections++;
    const s = src(it.seq);
    anchors.sections.push({
      label: sec.label,
      ...(number ? { number } : {}),
      title,
      chapter: chapter!.dir,
      ...(s.page ? { page: s.page } : {}),
      ...(s.lineStart !== undefined ? { lineStart: s.lineStart } : {}),
      ...(parent ? { parent: parent.label } : {}),
    });
  };

  const addBlock = (
    kind: "prose" | "table" | "figure",
    it: StructureItem,
    body: string,
    text: string,
    extra: { caption?: string; captionNumber?: string; file?: string; captionSeq?: number },
  ) => {
    const sec = currentSection();
    const ch = chapter!;
    const hash = textHash(`${kind} ${text} ${extra.file ?? ""}`);
    const secKey = sec.label.replace(/^sec:/, "");
    const prefix = kind === "prose" ? "prose:" : kind === "table" ? "tbl:" : "fig:";
    const reused = previousByHash.get(`${kind}:${hash}`);
    const base = reused ?? (extra.captionNumber ? `${prefix}${keyOf(extra.captionNumber)}` : `${prefix}${secKey}-${hash.slice(0, 6)}`);
    if (reused) stats.reused++;
    const label = uniq(usedLabels, base);
    const root = uniq(usedRoots.get(ch.dir)!, label.replace(/^[a-z]+:/, `${prefix[0]}-`).replace(/[^a-z0-9-]/gi, "-").toLowerCase());
    sec.blocks.push(root);
    // A caption's place is the block's place when the block itself has none
    // (tables and figures are not line-numbered).
    let s = src(it.seq);
    if (s.lineStart === undefined && extra.captionSeq !== undefined) {
      const c = src(extra.captionSeq);
      if (c.lineStart !== undefined) s = { ...c, method: `caption-${c.method}` };
    }
    // Footnotes travel with the block that cites them, so the assembled
    // document defines each one once, beside its first use.
    const notes = footnoteRefs(body)
      .filter((n) => structure.footnotes[n] !== undefined)
      .map((n) => `[^${n}]: ${structure.footnotes[n]}`);
    const md = [body.trim(), ...(notes.length ? ["", ...notes] : [])].join("\n") + "\n";
    const meta = { source: { library: opts.library, seq: it.seq, ...s } };
    const builder = kind;
    const fields = [
      `  label: ${ts(label)},`,
      ...(extra.caption ? [`  caption: ${ts(extra.caption)},`] : []),
      ...(kind === "figure" ? [`  file: ${ts(extra.file!)},`, ...(s.page ? [`  page: ${s.page},`] : [])] : []),
      `  meta: ${JSON.stringify(meta)},`,
    ];
    files.push({
      path: join(ch.dir, `${root}.ts`),
      content: `import { ${builder} } from "../../schema/builders";\n\nexport default ${builder}({\n${fields.join("\n")}\n});\n`,
    });
    files.push({ path: join(ch.dir, `${root}.md`), content: md });
    stats[kind]++;
    anchors.blocks.push({
      label,
      kind,
      chapter: ch.dir,
      root,
      sections: path.map((p) => p.label),
      ...(extra.captionNumber ? { caption: `${kind === "table" ? "Table" : "Figure"} ${extra.captionNumber}` } : {}),
      hash,
      excerpt: text.slice(0, 160),
      ...s,
    });
  };

  for (const it of items) {
    if (it === titleItem || it === subtitleItem) continue;
    if (it.type === "heading" && it.level === 0) {
      startChapter(splitNumber(it.text ?? "").title, it.seq);
      continue;
    }
    if (it.type === "heading") {
      openSection(it);
      continue;
    }
    if (it.type === "caption") {
      if (pendingCaption) addBlock("prose", pendingCaption, pendingCaption.md ?? "", pendingCaption.text ?? "", {});
      pendingCaption = it;
      continue;
    }
    const cap = pendingCaption;
    pendingCaption = null;
    const capExtra = cap ? { caption: cap.text, captionNumber: cap.number, captionSeq: cap.seq } : {};
    if (it.type === "image") {
      const file = `media/${it.media!.split("/").pop()}`;
      if (!media.includes(it.media!)) media.push(it.media!);
      const alt = cap?.text ?? "Figure";
      const body = `![${alt.replace(/[[\]]/g, "")}](${file})${cap ? `\n\n*${cap.md ?? cap.text}*` : ""}`;
      addBlock("figure", it, body, `${alt} ${file}`, { ...capExtra, file });
      continue;
    }
    if (it.type === "table") {
      const rows = it.rows ?? [];
      // Pictures inside cells (icon legends) stay in the cell; copy their files.
      for (const cell of rows.flat())
        for (const m of cell.matchAll(/!\[[^\]]*\]\((media\/[^)\s]+)\)/g)) if (!media.includes(m[1])) media.push(m[1]);
      if (isBox(rows) && !cap) {
        addBlock("prose", it, quote(rows[0].find((c) => c.trim()) ?? ""), it.text ?? "", {});
      } else {
        const body = `${cap ? `*${cap.md ?? cap.text}*\n\n` : ""}${tableMd(rows)}`;
        addBlock("table", it, body, it.text ?? "", capExtra);
      }
      continue;
    }
    if (cap) addBlock("prose", cap, cap.md ?? "", cap.text ?? "", {});
    if (it.type === "list") addBlock("prose", it, listMd(it), it.text ?? "", {});
    else if (it.type === "callout") addBlock("prose", it, quote(it.md ?? ""), it.text ?? "", {});
    else addBlock("prose", it, it.md ?? "", it.text ?? "", {});
  }
  if (pendingCaption) addBlock("prose", pendingCaption, pendingCaption.md ?? "", pendingCaption.text ?? "", {});

  // ── Manifests ──────────────────────────────────────────────────
  const secTs = (s: SecNode, indent: string): string => {
    const parts = [
      `${indent}section({`,
      `${indent}  title: ${ts(s.title)},`,
      `${indent}  label: ${ts(s.label)},`,
      ...(s.lead ? [`${indent}  lead: true,`] : []),
      `${indent}  blocks: [${s.blocks.map(ts).join(", ")}],`,
    ];
    if (s.subsections.length) {
      parts.push(`${indent}  subsections: [`);
      for (const sub of s.subsections) parts.push(secTs(sub, indent + "    ") + ",");
      parts.push(`${indent}  ],`);
    }
    parts.push(`${indent}})`);
    return parts.join("\n");
  };
  for (const ch of chapters) {
    anchors.chapters.push({ dir: ch.dir, title: ch.title, ...(ch.number ? { number: ch.number } : {}), label: ch.label });
    files.push({
      path: join(ch.dir, `${ch.dir}.ts`),
      content: `import { chapter, section } from "../../schema/builders";\n\nexport default chapter({\n${
        ch.number ? `  number: ${ch.number},\n` : ""
      }  title: ${ts(ch.title)},\n  label: ${ts(ch.label)},\n  sections: [\n${ch.sections.map((s) => secTs(s, "    ") + ",").join("\n")}\n  ],\n});\n`,
    });
  }
  files.push({
    path: `${opts.slug}.ts`,
    content: `import { chapterRef, paper } from "../schema/builders";

/**
 * ${docTitle}
 *
 * Extracted from the frozen review version in the library
 * (\`library/${opts.library}/\`) by folio-assistant's docx-to-folio. From
 * here on this folio IS the document: edit the blocks, not the source.
 * Every block's \`meta.source\` keeps its page and line in the review PDF, so
 * public comments citing the review version still resolve after edits.
 */
export default paper({
  title: ${ts(docTitle)},${subtitleItem?.text ? `\n  meta: { subtitle: ${ts(subtitleItem.text)} },` : ""}
  authors: ${JSON.stringify(opts.authors ?? ["World Health Organization", "International Telecommunication Union"])},
  ${opts.date ? `date: ${ts(opts.date)},\n  ` : ""}chapters: [
${chapters.map((c) => `    chapterRef({ dir: ${ts(c.dir)} }),`).join("\n")}
  ],
});
`,
  });
  files.push({ path: "review-anchors.json", content: JSON.stringify(anchors, null, 1) + "\n" });
  return { files, anchors, media, stats };
}

// ── CLI ──────────────────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  if (args.includes("--help") || !opt("structure") || !opt("line-map") || !opt("out") || !opt("slug") || !opt("library")) {
    console.log(`usage: bun run folio-assistant-core/scripts/docx-to-folio.ts \\
  --structure <docx-structure.json> --line-map <pdf-line-map.json> \\
  --out <folio/<slug> directory> --slug <slug> --library <library entry id> \\
  [--media <dir of extracted images>] [--title "..."] [--date YYYY-MM-DD] [--force]

Writes an editable document folio from a .docx extraction aligned to its
line-numbered review PDF. See the module docblock.`);
    process.exit(args.includes("--help") ? 0 : 2);
  }
  const out = resolve(opt("out")!);
  const anchorsPath = join(out, "review-anchors.json");
  const previous = existsSync(anchorsPath) ? (JSON.parse(readFileSync(anchorsPath, "utf-8")) as ReviewAnchors) : undefined;
  if (existsSync(out) && readdirSync(out).length > 0 && !args.includes("--force")) {
    console.error(`✗ ${out} is not empty. The folio is the edited document now; pass --force to regenerate it from the source (labels are kept by text hash).`);
    process.exit(1);
  }
  const r = convert(
    JSON.parse(readFileSync(resolve(opt("structure")!), "utf-8")),
    JSON.parse(readFileSync(resolve(opt("line-map")!), "utf-8")),
    { slug: opt("slug")!, library: opt("library")!, title: opt("title"), date: opt("date"), previous },
  );
  if (args.includes("--force")) for (const d of readdirSync(out)) if (d !== "media") rmSync(join(out, d), { recursive: true, force: true });
  for (const f of r.files) {
    const p = join(out, f.path);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, f.content);
  }
  const mediaDir = opt("media");
  if (mediaDir) {
    mkdirSync(join(out, "media"), { recursive: true });
    for (const m of r.media) copyFileSync(join(resolve(mediaDir), m.split("/").pop()!), join(out, "media", m.split("/").pop()!));
  }
  console.error(`✓ ${r.stats.chapters} chapters, ${r.stats.sections} sections, ${r.stats.prose} prose / ${r.stats.table} table / ${r.stats.figure} figure blocks${r.stats.reused ? `, ${r.stats.reused} labels kept from the previous run` : ""} → ${out}`);
}
