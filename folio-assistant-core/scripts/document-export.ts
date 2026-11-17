#!/usr/bin/env bun
/**
 * document-export — the publication pipeline's file outputs for a document
 * folio: the line-numbered PUBLIC-COMMENT PDF and the OFFLINE-EDITING .docx,
 * both stamped with the commit they were built from.
 *
 *   bun run folio-assistant-core/scripts/document-export.ts <release|pdf|docx> --document <slug>
 *       [--repo <folio root>] [--out build/export] [--date YYYY-MM-DD] [--release <id>] [--allow-dirty]
 *
 * ## One source, two files that agree
 *
 *   folio/<slug>/**  →  buildDocumentMarkdown (the same assembly document_render_md writes)
 *                    →  pandoc + document-export.lua      one Word bookmark per chapter, section, block
 *                       styled from document-export-reference.docx   fixed fonts, whatever the pandoc version
 *                    →  docx-offline.py finish            Word line numbering; Track Changes on (offline copy)
 *                    →  soffice --convert-to pdf          the PDF is the .docx, laid out
 *
 * The PDF is rendered FROM the .docx rather than from the site's HTML, so
 * the two carry the same pages and the same line numbers: a comment citing
 * "p. 22, l. 618" means the same words in either, and `pdf-line-map.py`
 * reads the PDF back exactly as it reads a Word-made review PDF. No TeX, as
 * a document folio requires (skill `document-publishing`).
 *
 * ## Outputs (in --out)
 *
 *   <slug>-public-comment-<sha7>-<date>.pdf    the frozen, line-numbered review draft
 *   <slug>-public-comment-<sha7>-<date>.docx   the same draft as Word (its sha256 goes in the release references)
 *   <slug>-offline-<sha7>.docx                 the editing copy: Track Changes on, one bookmark per block
 *   <slug>-export-<sha7>.json                  `document-export/v1`: commit, date, tools, and per file
 *                                              format, filters, parameters, sha256, bytes, pages, lines, bookmarks
 *   <slug>-…-latest.{pdf,docx,json}            the same files under STABLE names (`latestNames`): a link
 *                                              to one always serves the newest export
 *   index.html                                 the Export page: every file above with its format, the
 *                                              filters and parameters it was made with, size, date and link
 *
 * Every file carries custom properties `folio-source-commit`,
 * `folio-document`, `folio-export-date` (and `folio-release`), which
 * `docx-offline.py changes` reads to merge an edited copy back.
 *
 * SVG figures are rasterised to PNG by LibreOffice first (see
 * `rasterizeSvgImages`): embedded as SVG, they vanish from the PDF.
 *
 * ## Reproducible
 *
 * The date defaults to the COMMIT's date and `SOURCE_DATE_EPOCH` to its
 * time, so two runs at one commit give the same .docx bytes. The PDF differs
 * only in the creation timestamp LibreOffice embeds. A working tree with
 * uncommitted changes under `folio/` is refused (the stamp would name a
 * commit the file does not come from) unless `--allow-dirty`, which marks the
 * stamp `-dirty`.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { folioDir } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";

const HERE = import.meta.dir;
export const LUA_FILTER = join(HERE, "document-export.lua");
/**
 * The Word template every export is styled from (pandoc --reference-doc). It
 * is pandoc 3.1.3's own default, kept here so that the pandoc version cannot
 * change the fonts: pandoc 3.7's default names Aptos, which a Linux runner
 * lacks, and the same commit's PDF came out at 169 pages instead of 143. Body
 * text is Cambria and headings Calibri, which fontconfig resolves to the
 * metric-compatible Caladea and Carlito (fonts-crosextra-*), so the page and
 * line a comment cites is the same wherever the PDF is built (bean 2akf).
 */
export const REFERENCE_DOCX = join(HERE, "document-export-reference.docx");
export const DOCX_OFFLINE = join(HERE, "docx-offline.py");

export type ExportKind = "release" | "pdf" | "docx";

export interface ExportOptions {
  repo: string;
  document: string;
  out: string;
  kind: ExportKind;
  date?: string;
  release?: string;
  allowDirty?: boolean;
  /** Override the commit (tests); defaults to `git rev-parse HEAD`. */
  commit?: string;
}

export interface ExportedFile {
  kind: "pdf" | "review-docx" | "offline-docx";
  file: string;
  /** The stable copy of this file (`latestNames`), overwritten by every export. */
  latest: string;
  /** What the file is, for a reader: "PDF", "Word (.docx)". */
  format: string;
  mediaType: string;
  /** What it is for, one line. */
  purpose: string;
  /** The steps the file went through, in order (pandoc filter, rasterising, line numbering, …). */
  filters: string[];
  /** The settings it was made with, as shown on the Export page. */
  parameters: Record<string, string>;
  sha256: string;
  bytes: number;
  bookmarks?: number;
  pages?: number;
  lines?: number;
}

export interface ExportManifest {
  $schema: "document-export/v1";
  document: string;
  title: string;
  commit: string;
  dirty: boolean;
  commitDate: string;
  date: string;
  release?: string;
  blocks: number;
  tools: Record<string, string>;
  files: ExportedFile[];
}

/** The STABLE names: one per file, the same at every commit, so a link to one is always the newest export. */
export function latestNames(slug: string) {
  return {
    pdf: `${slug}-public-comment-latest.pdf`,
    reviewDocx: `${slug}-public-comment-latest.docx`,
    offlineDocx: `${slug}-offline-latest.docx`,
    manifest: `${slug}-export-latest.json`,
  };
}

const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Bytes as a reader says them: 812 KB, 3.4 MB. */
export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * The Export page: one row per exported file, saying what it is, how it was
 * made (filters, parameters), how big, from which commit and date, with a
 * link to this export's file AND to its stable "latest" copy. Self-contained
 * HTML (no script, inline style), so it works on any static host.
 */
export function renderExportIndex(m: ExportManifest): string {
  const short = m.commit.slice(0, 7) + (m.dirty ? "-dirty" : "");
  const latest = latestNames(m.document);
  const rows = m.files.map((f) => {
    const facts = [f.pages && plural(f.pages, "page"), f.lines && plural(f.lines, "numbered line"), f.bookmarks && plural(f.bookmarks, "bookmark")].filter(Boolean);
    const params = Object.entries(f.parameters).map(([k, v]) => `<li><b>${esc(k)}</b>: ${esc(v)}</li>`).join("");
    return `<tr>
<td data-label="File"><b>${esc(f.format)}</b><br><span class="muted">${esc(f.purpose)}</span>${facts.length ? `<br><span class="muted">${esc(facts.join(" · "))}</span>` : ""}</td>
<td data-label="Filters"><ol>${f.filters.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></td>
<td data-label="Parameters"><ul>${params}</ul></td>
<td data-label="Size" class="num">${esc(humanBytes(f.bytes))}</td>
<td data-label="Date" class="nowrap">${esc(m.date)}<br><span class="muted">commit <code>${esc(short)}</code></span></td>
<td data-label="Download"><a href="${esc(f.latest)}" download>Latest</a><br><a href="${esc(f.file)}" download class="muted">This export</a><br><span class="muted sha" title="sha256 ${esc(f.sha256)}">sha256 ${esc(f.sha256.slice(0, 12))}…</span></td>
</tr>`;
  }).join("\n");
  const tools = Object.entries(m.tools).map(([k, v]) => `<li><b>${esc(k)}</b>: ${esc(v)}</li>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Export — ${esc(m.title)}</title>
<style>
:root{--fg:#1b1f24;--muted:#57606a;--line:#d0d7de;--bg:#fff;--head:#f6f8fa;--link:#0969da}
@media (prefers-color-scheme: dark){:root{--fg:#e6edf3;--muted:#9da7b3;--line:#30363d;--bg:#0d1117;--head:#161b22;--link:#4493f8}}
body{font:16px/1.5 system-ui,sans-serif;color:var(--fg);background:var(--bg);margin:0}
main.export{box-sizing:border-box;max-width:72rem;margin:0 auto;padding:1rem 32px}@media (max-width:700px){main.export{padding:1rem 16px}}
a{color:var(--link)}.muted{color:var(--muted);font-size:.9em}.num{text-align:right;white-space:nowrap}.nowrap{white-space:nowrap}
.wrap{overflow-x:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid var(--line);padding:.5rem;vertical-align:top;text-align:left}
th{background:var(--head)}
@media (max-width:700px){thead{display:none}table,tbody,tr,td{display:block;width:auto}tr{border:1px solid var(--line);margin:0 0 1rem}td{border:0;border-top:1px solid var(--line)}td:first-child{border-top:0}td::before{content:attr(data-label);display:block;font-weight:600;color:var(--muted);font-size:.8em}.num{text-align:left}}ol,ul{margin:0;padding-left:1.2rem}code{font-size:.9em}.sha{font-family:ui-monospace,monospace;font-size:.8em}
</style></head><body><main class="export">
<h1 id="export">Export</h1>
<p><b>${esc(m.title)}</b> (<code>${esc(m.document)}</code>), ${plural(m.blocks, "block")}, exported ${esc(m.date)} from commit <code>${esc(short)}</code>${m.release ? `, release <b>${esc(m.release)}</b>` : ""}.</p>
<p>Each file below can be downloaded in two ways. <b>Latest</b> is a stable link that always gives the newest export — use it to bookmark or share. <b>This export</b> is the file from this commit only; cite it when a comment must point at an exact page and line.</p>
<div class="wrap"><table>
<thead><tr><th>File</th><th>Filters (in order)</th><th>Parameters</th><th>Size</th><th>Date</th><th>Download</th></tr></thead>
<tbody>
${rows}
</tbody></table></div>
<h2 id="details">Details</h2>
<ul>
<li>Machine-readable list of these files: <a href="${esc(latest.manifest)}">${esc(latest.manifest)}</a> (<code>document-export/v1</code>).</li>
<li>Every file carries the custom properties <code>folio-source-commit</code>, <code>folio-document</code> and <code>folio-export-date</code>, so an edited copy can be merged back.</li>
<li>Tools: <ul>${tools}</ul></li>
</ul>
</main></body></html>
`;
}

/** The file names one export writes, from the stamp alone. */
export function exportNames(slug: string, sha: string, date: string) {
  const s = sha.slice(0, 7) + (sha.endsWith("-dirty") ? "-dirty" : "");
  return {
    pdf: `${slug}-public-comment-${s}-${date}.pdf`,
    reviewDocx: `${slug}-public-comment-${s}-${date}.docx`,
    offlineDocx: `${slug}-offline-${s}.docx`,
    manifest: `${slug}-export-${s}.json`,
  };
}

function run(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {}): string {
  const r = spawnSync(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: "pipe", timeout: opts.timeout ?? 300_000 });
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.slice(0, 3).join(" ")} … failed (exit ${r.status}):\n${r.stderr.toString().slice(-2000)}`);
  }
  return r.stdout.toString();
}

function has(cmd: string): boolean {
  return spawnSync("sh", ["-c", `command -v ${cmd}`], { stdio: "pipe" }).status === 0;
}

/**
 * Every SVG image in the assembly, rasterised to PNG (at twice its size, for
 * print) and the Markdown pointed at the PNG. pandoc embeds an SVG in the
 * .docx as-is, and LibreOffice then lays the page out WITHOUT it, silently:
 * the DIIG phase figure was simply missing from the first dth-hrh PDF. Word
 * draws SVG only from 2016 on. LibreOffice is already required, so it does
 * the rasterising and no new tool is needed.
 */
export function rasterizeSvgImages(markdown: string, imageDirs: string[], work: string, env: NodeJS.ProcessEnv): { markdown: string; converted: number } {
  const refs = new Map<string, string>(); // ref as written → absolute svg
  for (const m of markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+\.svg)\)/g)) {
    const src = imageDirs.map((d) => join(d, m[1])).find(existsSync);
    if (src) refs.set(m[1], src);
  }
  if (refs.size === 0) return { markdown, converted: 0 };
  const dir = join(work, "svg");
  mkdirSync(dir, { recursive: true });
  const staged: string[] = [];
  let n = 0;
  const target = new Map<string, string>();
  const used = new Set<string>();
  for (const [ref, src] of refs) {
    // named after the figure, and referenced RELATIVE to `work` (on pandoc's
    // resource path): pandoc writes the path into the picture's `descr`, and
    // a temp-dir name there would make every export's bytes differ.
    let base = (ref.split("/").pop() ?? "figure").replace(/\.svg$/, "").replace(/[^A-Za-z0-9_-]/g, "-");
    while (used.has(base)) base = `${base}-${n++}`;
    used.add(base);
    const svg = readFileSync(src, "utf-8").replace(/<svg\b[^>]*>/, (tag) =>
      tag.replace(/\b(width|height)="(\d+(?:\.\d+)?)(px)?"/g, (_m, k: string, v: string) => `${k}="${Number(v) * 2}"`));
    writeFileSync(join(dir, `${base}.svg`), svg);
    staged.push(join(dir, `${base}.svg`));
    target.set(ref, `svg/${base}.png`);
  }
  run("soffice", [`-env:UserInstallation=file://${join(work, "lo-profile")}`, "--headless", "--convert-to", "png", "--outdir", dir, ...staged], { env, timeout: 600_000 });
  let converted = 0;
  const out = markdown.replace(/(!\[[^\]]*\]\()([^)\s]+\.svg)(\))/g, (whole, a: string, ref: string, b: string) => {
    const png = target.get(ref);
    if (!png || !existsSync(join(work, png))) return whole;
    converted++;
    return `${a}${png}${b}`;
  });
  return { markdown: out, converted };
}

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

/** Page count and highest gutter line number of a line-numbered PDF. */
export function pdfFacts(pdf: string): { pages: number; lines: number } {
  const info = run("pdfinfo", [pdf]);
  const pages = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1] ?? 0);
  const text = run("pdftotext", ["-layout", pdf, "-"]);
  let lines = 0;
  for (const m of text.matchAll(/^\s{0,12}(\d{1,6})\s{2,}\S/gm)) lines = Math.max(lines, Number(m[1]));
  return { pages, lines };
}

export async function exportDocument(o: ExportOptions): Promise<ExportManifest> {
  const repo = resolve(o.repo);
  const manifestPath = join(folioDir(repo), o.document, `${o.document}.ts`);
  if (!/^[A-Za-z0-9_-]+$/.test(o.document) || !existsSync(manifestPath)) {
    throw new Error(`no document manifest folio/${o.document}/${o.document}.ts in ${repo}`);
  }
  for (const tool of ["pandoc", "python3", ...(o.kind === "docx" ? [] : ["soffice", "pdfinfo", "pdftotext"])]) {
    if (!has(tool)) throw new Error(`${tool} is not installed (needed for '${o.kind}'). No fallback: a document folio publishes without TeX.`);
  }

  // ── the stamp ──
  let commit = o.commit ?? run("git", ["-C", repo, "rev-parse", "HEAD"]).trim();
  const dirtyFiles = o.commit ? "" : run("git", ["-C", repo, "status", "--porcelain", "--", "folio"]).trim();
  const dirty = dirtyFiles !== "";
  if (dirty && !o.allowDirty) {
    throw new Error(`uncommitted changes under folio/ — the export would be stamped ${commit.slice(0, 7)} without coming from it. Commit first, or pass --allow-dirty.\n${dirtyFiles}`);
  }
  if (dirty) commit += "-dirty";
  const epoch = o.commit ? "315532800" : run("git", ["-C", repo, "log", "-1", "--format=%ct", "HEAD"]).trim();
  const commitDate = new Date(Number(epoch) * 1000).toISOString().slice(0, 10);
  const date = o.date ?? commitDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`--date ${date}: expected YYYY-MM-DD`);
  const names = exportNames(o.document, commit, date);

  // ── assemble ──
  const { buildDocumentMarkdown } = await import("@litlfred/cat-harness-tools/pipeline/render-markdown.js");
  const assembled = await buildDocumentMarkdown(manifestPath);
  const errors = assembled.issues.filter((i: { level: string }) => i.level === "error");
  if (errors.length) throw new Error(`assembly failed:\n${errors.map((e: { message: string }) => `  ${e.message}`).join("\n")}`);
  const title = /^#\s+(.+)$/m.exec(assembled.markdown)?.[1]?.trim() ?? o.document;

  mkdirSync(o.out, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), "document-export-"));
  const env = { ...process.env, SOURCE_DATE_EPOCH: epoch };
  const files: ExportedFile[] = [];
  try {
    const md = join(work, `${o.document}.md`);
    const images = has("soffice")
      ? rasterizeSvgImages(assembled.markdown, [join(folioDir(repo), o.document), repo], work, env)
      : { markdown: assembled.markdown, converted: 0 };
    writeFileSync(md, images.markdown, "utf-8");
    const short = commit.slice(0, 7) + (dirty ? "-dirty" : "");
    const latest = latestNames(o.document);
    const referenceSha = createHash("sha256").update(readFileSync(REFERENCE_DOCX)).digest("hex");
    // What every file went through, and the settings every file shares — the Export page lists both.
    const common = [
      "assembled from folio/" + o.document + " (one Markdown, as document_render_md writes it)",
      ...(images.converted ? [`${images.converted} SVG figure(s) rasterised to PNG at 2×`] : []),
      "pandoc with document-export.lua: one Word bookmark per chapter, section and block",
      `styled from document-export-reference.docx (sha256 ${referenceSha.slice(0, 12)}…: Cambria body, Calibri headings)`,
    ];
    const params: Record<string, string> = {
      document: o.document,
      "export kind": o.kind,
      "source commit": short,
      date,
      ...(o.release ? { release: o.release } : {}),
      ...(dirty ? { "uncommitted changes": "included (--allow-dirty)" } : {}),
    };
    // Metadata through a UTF-8 file, not -M: pandoc decodes arguments in the
    // process locale, and a C locale turns "—" into mojibake.
    let metaFiles = 0;
    const meta = (subtitle: string) => {
      const path = join(work, `meta-${metaFiles++}.json`);
      writeFileSync(path, JSON.stringify({
        subtitle, date,
        "folio-source-commit": commit,
        "folio-document": o.document,
        "folio-export-date": date,
        ...(o.release ? { "folio-release": o.release } : {}),
      }), "utf-8");
      return ["--metadata-file", path];
    };
    const pandoc = (out: string, subtitle: string) => run("pandoc", [
      md, "-o", out,
      "--from", "gfm-gfm_auto_identifiers+raw_html",
      "--shift-heading-level-by=-1",
      "--lua-filter", LUA_FILTER,
      "--reference-doc", REFERENCE_DOCX,
      `--resource-path=${work}:${join(repo, "folio", o.document)}:${repo}`,
      ...meta(subtitle),
    ], { cwd: repo, env });
    const finish = (src: string, out: string, flags: string[]) =>
      JSON.parse(run("python3", ["-I", DOCX_OFFLINE, "finish", src, "--out", out, "--epoch", epoch, ...flags], { env }));

    if (o.kind !== "docx") {
      const raw = join(work, "review.raw.docx");
      pandoc(raw, `Draft for public comment${o.release ? ` (${o.release})` : ""} — source ${short}, ${date}. Cite page and line numbers.`);
      const reviewDocx = join(o.out, names.reviewDocx);
      const f = finish(raw, reviewDocx, ["--line-numbers"]);
      files.push({
        kind: "review-docx", file: names.reviewDocx, latest: latest.reviewDocx,
        format: "Word (.docx)", mediaType: DOCX_TYPE,
        purpose: "The public-comment draft as Word, with the same pages and line numbers as the PDF.",
        filters: [...common, "Word line numbering"],
        parameters: { ...params, "line numbers": "on", "track changes": "off" },
        sha256: f.sha256, bytes: readFileSync(reviewDocx).length, bookmarks: f.bookmarks,
      });

      // LibreOffice lays the .docx out; a private profile so parallel runs do not lock each other.
      const profile = join(work, "lo-profile");
      run("soffice", [`-env:UserInstallation=file://${profile}`, "--headless", "--convert-to", "pdf", "--outdir", work, reviewDocx], { env, timeout: 600_000 });
      const produced = join(work, names.reviewDocx.replace(/\.docx$/, ".pdf"));
      if (!existsSync(produced)) throw new Error("soffice reported success but wrote no PDF");
      const pdf = join(o.out, names.pdf);
      renameSync(produced, pdf);
      files.push({
        kind: "pdf", file: names.pdf, latest: latest.pdf,
        format: "PDF", mediaType: "application/pdf",
        purpose: "The frozen, line-numbered draft for public comment. Cite page and line.",
        filters: [...common, "Word line numbering", "LibreOffice: .docx laid out as PDF"],
        parameters: { ...params, "line numbers": "on", "laid out from": names.reviewDocx },
        sha256: sha256(pdf), bytes: readFileSync(pdf).length, ...pdfFacts(pdf),
      });
    }
    if (o.kind !== "pdf") {
      const raw = join(work, "offline.raw.docx");
      pandoc(raw, `Offline editing copy — source ${short}, ${date}. Keep Track Changes on, and return the file with every change still pending (do not accept or reject).`);
      const offline = join(o.out, names.offlineDocx);
      const f = finish(raw, offline, ["--line-numbers", "--track-changes"]);
      files.push({
        kind: "offline-docx", file: names.offlineDocx, latest: latest.offlineDocx,
        format: "Word (.docx)", mediaType: DOCX_TYPE,
        purpose: "The offline editing copy. Edit with Track Changes on and send it back; the changes merge into the source.",
        filters: [...common, "Word line numbering", "Track Changes switched on"],
        parameters: { ...params, "line numbers": "on", "track changes": "on" },
        sha256: f.sha256, bytes: readFileSync(offline).length, bookmarks: f.bookmarks,
      });
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  const tools: Record<string, string> = { pandoc: run("pandoc", ["--version"]).split("\n")[0] };
  if (o.kind !== "docx") tools.soffice = run("soffice", ["--version"]).trim().split("\n")[0];
  const manifest: ExportManifest = {
    $schema: "document-export/v1",
    document: o.document, title, commit, dirty, commitDate, date,
    ...(o.release ? { release: o.release } : {}),
    blocks: assembled.blockCount,
    tools, files,
  };
  const json = JSON.stringify(manifest, null, 2) + "\n";
  writeFileSync(join(o.out, names.manifest), json);
  // The stable copies: a link to `<slug>-…-latest.*` always serves the newest export.
  for (const f of files) copyFileSync(join(o.out, f.file), join(o.out, f.latest));
  writeFileSync(join(o.out, latestNames(o.document).manifest), json);
  writeFileSync(join(o.out, "index.html"), renderExportIndex(manifest));
  return manifest;
}

function opt(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const kind = args[0] as ExportKind;
  const document = opt(args, "document");
  if (!["release", "pdf", "docx"].includes(kind) || !document) {
    console.error("usage: document-export.ts <release|pdf|docx> --document <slug> [--repo .] [--out build/export] [--date YYYY-MM-DD] [--release <id>] [--allow-dirty]");
    process.exit(2);
  }
  const repo = resolve(opt(args, "repo") ?? process.cwd());
  try {
    const m = await exportDocument({
      repo, document, kind,
      out: resolve(opt(args, "out") ?? join(repo, "build", "export")),
      date: opt(args, "date"), release: opt(args, "release"),
      allowDirty: args.includes("--allow-dirty"),
    });
    console.log(`${m.title} @ ${m.commit.slice(0, 12)} (${m.date}), ${m.blocks} blocks`);
    for (const f of m.files) {
      const facts = [f.pages && `${f.pages} pages`, f.lines && `${f.lines} lines`, f.bookmarks && `${f.bookmarks} bookmarks`].filter(Boolean).join(", ");
      console.log(`  ${f.kind.padEnd(13)} ${f.file}  ${(f.bytes / 1024).toFixed(0)} KB  ${facts}  sha256 ${f.sha256.slice(0, 12)}`);
      console.log(`  ${"".padEnd(13)} → ${f.latest}`);
    }
    console.log(`  Export page: index.html`);
  } catch (e) {
    console.error(`document-export: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
