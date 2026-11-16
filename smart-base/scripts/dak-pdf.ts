#!/usr/bin/env bun
/**
 * DAK → PDF, first cut.
 *
 * §12.15 of `docs/proposals/rag-document-ingestion.md` states the target: the
 * content block is the source, and rendering fans out to a FHIR IG, some
 * Excels, and a PDF. §12.16 established that the PDF renderer **exists
 * nowhere** — the DAK base layer's only PDF dependency is `pdfplumber`, used to
 * *read* PDFs when extracting personas. This is the first thing that produces
 * one.
 *
 * ## What it does, and what it does not
 *
 * It assembles a DAK's narrative (`input/pagecontent/*.md`), an index of its
 * business processes, and its decision logic where DMN exists, into one HTML
 * document, and prints that to PDF with the Chromium already installed for
 * Playwright.
 *
 * It does **not** yet render:
 *
 * - **BPMN diagrams.** The processes are listed, not drawn. Drawing them needs
 *   either a BPMN layout renderer or pre-exported SVG, and `smart-dak-immz`
 *   ships neither (`input/images/` is empty).
 * - **Excel tables.** The data dictionary, indicators and requirements live in
 *   workbooks; rendering them means reading `.xlsx`, which is a separate
 *   dependency and a separate decision about which sheets belong in the PDF.
 * - **Content blocks.** The target is block → PDF. This renders the *current*
 *   hand-authored narrative, because that is what exists. When DAK blocks are
 *   authored, this is where they replace `pagecontent/`.
 *
 * Every omission is reported in the run summary rather than left implicit: a
 * PDF that silently drops the decision tables looks complete and is not.
 *
 * Usage:
 *   bun run cat smart-base:dak-pdf <dak-repo> -o out.pdf
 *   bun run cat smart-base:dak-pdf <dak-repo> --html-only -o out.html
 *
 * Moved here from the harness tools layer (wrong-direction move M12): its
 * subject is the DAK, which is this layer's. The render wait it prints
 * through stays below, in `cat-harness-tools/scripts/render-wait.ts`.
 *
 * @module smart-base/scripts/dak-pdf
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { basename, join, relative, resolve } from "path";
import { remark } from "remark";
import remarkHtml from "remark-html";

import { ownDeclaredDirectories } from "../platform/schema.js";

interface Section {
  title: string;
  html: string;
  source: string;
}

/** An SVG a caller rendered separately and wants inlined. */
export interface Diagram {
  /** The BPMN file it came from. */
  source: string;
  svg: string;
}

interface Assembly {
  title: string;
  sections: Section[];
  /** Things a complete DAK PDF would contain and this one does not. */
  omissions: string[];
  /** Whether the root is a DAK at all, and how that was decided. */
  identity: DakIdentity;
}

/**
 * The result of asking whether a directory is a WHO SMART Guidelines DAK.
 *
 * The test is the one `sgex` documents and the one WHO's own tooling relies
 * on: a repository is a DAK iff its root `sushi-config.yaml` declares a
 * dependency on `smart.who.int.base`. Verified against all three WHO
 * repositories in hand — `smart-dak-immz` and `smart-dak-bds` pin `current`,
 * one DAK IG pins `0.2.0`.
 *
 * This is a *declaration*, not an inference. Nothing here looks at directory
 * names, file counts, or whether `input/business-processes/` happens to exist:
 * a repository that has not said it is a DAK is not treated as one, and the
 * reason is reported rather than guessed around.
 */
export interface DakIdentity {
  isDak: boolean;
  /** Version pinned for `smart.who.int.base`, when it is declared. */
  baseVersion?: string;
  /** Why this root is not a recognised DAK. Present iff `!isDak`. */
  reason?: string;
}

/** SUSHI's dependency values are either a version string or `{version}`. */
function dependencyVersion(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object" && "version" in v) {
    const inner = (v as { version: unknown }).version;
    return typeof inner === "string" || typeof inner === "number" ? String(inner) : undefined;
  }
  return undefined;
}

/** Parse `sushi-config.yaml`, or explain why it could not be parsed. */
function sushiConfig(root: string): { cfg?: Record<string, unknown>; reason?: string } {
  const path = join(root, "sushi-config.yaml");
  if (!existsSync(path)) return { reason: "no sushi-config.yaml in the repository root" };
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    return { reason: `sushi-config.yaml is not valid YAML: ${String(e).slice(0, 120)}` };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { reason: "sushi-config.yaml does not parse to a mapping" };
  }
  return { cfg: parsed as Record<string, unknown> };
}

/** Decide whether `root` is a DAK, per the declared-dependency rule. */
export function dakIdentity(root: string): DakIdentity {
  const { cfg, reason } = sushiConfig(root);
  if (!cfg) return { isDak: false, reason };

  const deps = cfg.dependencies;
  if (!deps || typeof deps !== "object" || Array.isArray(deps)) {
    return { isDak: false, reason: "sushi-config.yaml declares no dependencies" };
  }
  const raw = (deps as Record<string, unknown>)[DAK_BASE_DEPENDENCY];
  if (raw === undefined) {
    return {
      isDak: false,
      reason: `sushi-config.yaml dependencies do not include ${DAK_BASE_DEPENDENCY}`,
    };
  }
  return { isDak: true, baseVersion: dependencyVersion(raw) };
}

/** The IG dependency whose presence *is* the definition of a DAK. */
export const DAK_BASE_DEPENDENCY = "smart.who.int.base";

function mdToHtml(md: string): string {
  return String(remark().use(remarkHtml, { sanitize: false }).processSync(md));
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

/**
 * Title from sushi-config.yaml, falling back to the directory name.
 *
 * Parsed as YAML rather than matched with `/^title:/m`. On all three WHO
 * repositories in hand the two agree, so this is not a bug fix — it is that
 * the same parse is already needed for {@link dakIdentity}, making the regex
 * a second, weaker reader of a file already being read properly.
 */
function dakTitle(root: string): string {
  const { cfg } = sushiConfig(root);
  const t = cfg?.title;
  if (typeof t === "string" && t.trim()) return t.trim();
  return basename(root);
}

export function assemble(root: string, diagrams: Diagram[] = []): Assembly {
  const sections: Section[] = [];
  const omissions: string[] = [];

  // 1. Narrative.
  const pageDir = join(root, "input", "pagecontent");
  if (existsSync(pageDir)) {
    for (const f of readdirSync(pageDir).filter((f) => f.endsWith(".md")).sort()) {
      const md = readFileSync(join(pageDir, f), "utf-8");
      if (!md.trim()) continue;
      sections.push({
        title: basename(f, ".md").replace(/[-_]/g, " "),
        html: mdToHtml(md),
        source: `input/pagecontent/${f}`,
      });
    }
  } else {
    omissions.push("no input/pagecontent/ — the DAK has no narrative to render");
  }

  // 2. Business processes. Listed, not drawn — see the module docstring.
  const bpDir = businessProcessesDir(root);
  if (existsSync(bpDir)) {
    const files = readdirSync(bpDir).filter((f) => f.endsWith(".bpmn")).sort();
    if (files.length) {
      // Drawn where a diagram was rendered; listed where it was not. The two
      // must not look alike in the output — a process that failed to render is
      // not a process without a diagram.
      const drawn = new Map(diagrams.map((d) => [basename(d.source), d]));
      const parts: string[] = [];
      const undrawn: string[] = [];
      for (const f of files) {
        const d = drawn.get(f);
        if (d) {
          parts.push(`<figure><figcaption>${esc(f)}</figcaption>\n${d.svg}\n</figure>`);
        } else {
          undrawn.push(f);
        }
      }
      if (undrawn.length) {
        parts.push(
          `<p>Not drawn:</p><ul>${undrawn.map((f) => `<li><code>${esc(f)}</code></li>`).join("")}</ul>`,
        );
        omissions.push(
          `${undrawn.length} of ${files.length} BPMN process(es) listed but not drawn`,
        );
      }
      sections.push({
        title: "Business processes",
        html: parts.join("\n"),
        source: `${relative(root, bpDir)}/`,
      });
    }
  }

  // 3. Decision logic, where DMN exists at all.
  const dmn = findByExt(root, ".dmn");
  if (dmn.length) {
    sections.push({
      title: "Decision logic",
      html: `<ul>\n${dmn.map((f) => `<li><code>${esc(f)}</code></li>`).join("\n")}\n</ul>`,
      source: "*.dmn",
    });
    omissions.push(
      `${dmn.length} DMN file(s) listed but not rendered — run smart-base-transform.py dmn2html and inline the result`,
    );
  }

  // 4. The workbooks, which carry most of a DAK's substance.
  const xlsx = findByExt(root, ".xlsx");
  if (xlsx.length) {
    omissions.push(
      `${xlsx.length} workbook(s) not rendered (data dictionary, indicators, requirements) — needs an .xlsx reader and a decision about which sheets belong in the PDF`,
    );
  }

  return { title: dakTitle(root), sections, omissions, identity: dakIdentity(root) };
}

/**
 * Where the DAK at `root` keeps its BPMN: the directory its declaration names
 * for the `business-processes` graph, when it is a layer that declares one;
 * otherwise the IG Publisher's own layout.
 *
 * A WHO DAK repository (`smart-dak-immz`) declares nothing, so the fallback is
 * needed; a layer may keep its processes elsewhere, so it comes second.
 */
export function businessProcessesDir(root: string): string {
  // declared-path-literal: the IG Publisher's layout, the fallback for a DAK
  // repository that declares no business-processes graph; tried only after its
  // declaration, and it names that repository's own input/, nobody else's
  const declared = ownDeclaredDirectories(root, "business-processes")[0];
  return declared !== undefined ? resolve(declared) : join(root, "input", "business-processes");
}

function findByExt(root: string, ext: string, depth = 4): string[] {
  const out: string[] = [];
  (function walk(dir: string, d: number) {
    if (d > depth) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.startsWith(".") || e === "node_modules") continue;
      const p = join(dir, e);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(p, d + 1);
      else if (e.endsWith(ext)) out.push(p.slice(root.length + 1));
    }
  })(root, 0);
  return out.sort();
}

/**
 * WHO's own decision-table stylesheet, from a checkout of the DAK base layer.
 *
 * `local-template/package/content/assets/css/dmn.css` carries the WHO palette
 * (`--dmn-who-blue: #0093d0`), light/dark theming and DMN table rules, and the
 * IG template injects it via `_append.fragment-css.html`. An earlier version of
 * this renderer invented its own generic serif CSS instead — a second, weaker
 * copy of presentation WHO already maintains, which is the mistake this work
 * keeps finding elsewhere.
 *
 * Absent a checkout it returns undefined and the caller falls back, reporting
 * the fallback rather than quietly producing differently-styled output.
 */
export function whoStylesheet(): { css: string; source: string } | undefined {
  const home = process.env.SMART_BASE_HOME ?? "/opt/smart-base";
  const rel = "local-template/package/content/assets/css/dmn.css";
  const p = join(home, rel);
  if (!existsSync(p)) return undefined;
  try {
    return { css: readFileSync(p, "utf-8"), source: rel };
  } catch {
    return undefined;
  }
}

/**
 * Print rules ported from `sgex`'s DAK publication generator.
 *
 * `litlfred/sgex/scripts/generate-dak-publication-poc.js` (dead code, so its
 * scripts move here rather than being loaded) carries 486 lines of
 * WHO-compliant CSS. Only the print-relevant and branding parts are taken:
 * most of the rest styles that generator's own card-and-grid markup
 * (`.actors-grid`, `.metrics-grid`, `.component-card`), which this document
 * does not have, and copying selectors nothing matches is how a stylesheet
 * becomes unmaintainable.
 *
 * ## The margin boxes do not survive the port
 *
 * The POC declares `@page { @top-center { … } @bottom-center { content: "Page "
 * counter(page) } }`. Those are CSS Paged Media margin boxes, implemented by
 * PrinceXML and WeasyPrint and **not by Chromium**, which is what prints here —
 * copied verbatim they would silently produce no header and no page numbers.
 * The equivalent is Playwright's `headerTemplate`/`footerTemplate`, so the
 * running header and page numbering move there and the `@page` rule keeps only
 * what Chromium honours: size and margin.
 */
function printCss(): string {
  return `
/* Ported from sgex generate-dak-publication-poc.js — WHO DAK publication styles. */
@page { size: A4; margin: 2.2cm 2cm; }

body { font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333; font-size: 11pt; }
h1, h2, h3 { color: #0078d4; }
.page-break { page-break-before: always; }

@media print {
  body { font-size: 10pt; }
  .page-break { page-break-before: always; }
  .component-section, figure { page-break-inside: avoid; }
  a { color: #0078d4 !important; text-decoration: none; }
  /* A printed link is useless without its target. */
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 8pt; color: #666; }
}
`;
}

export function toHtml(a: Assembly): string {
  const toc = a.sections
    .map((s, i) => `<li><a href="#s${i}">${esc(s.title)}</a></li>`)
    .join("\n");
  const body = a.sections
    .map(
      (s, i) =>
        `<section id="s${i}"><h1>${esc(s.title)}</h1>\n${s.html}\n` +
        `<p class="src">source: ${esc(s.source)}</p></section>`,
    )
    .join("\n");

  // The omissions are printed *in the document*, not only in the run log. A
  // PDF that silently drops the decision tables looks complete and is not, and
  // whoever reads the PDF is the one who needs to know.
  const gaps = a.omissions.length
    ? `<section class="gaps"><h1>Not included in this rendering</h1><ul>${a.omissions
        .map((o) => `<li>${esc(o)}</li>`)
        .join("")}</ul></section>`
    : "";

  // A directory that never declared itself a DAK can still be rendered — but
  // the reader is told, on the cover, rather than handed a document whose
  // title page calls it a Digital Adaptation Kit on this tool's say-so.
  const notDak = a.identity.isDak
    ? ""
    : `<p class="notdak">Not a recognised DAK: ${esc(a.identity.reason ?? "unknown")}. ` +
      `Rendered anyway; treat the structure below as this tool's reading, not a WHO declaration.</p>`;

  const who = whoStylesheet();
  const print = printCss();
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(a.title)}</title>
${who ? `<!-- WHO styling from ${who.source} -->\n<style>\n${who.css}\n</style>` : "<!-- no DAK base checkout (SMART_BASE_HOME): WHO styling unavailable -->"}
<style>${print}</style>
<style>
  body { margin: 0; }
  section { padding: 0; page-break-before: always; }
  section:first-of-type { page-break-before: avoid; }
  h1 { font-size: 18pt; border-bottom: 1px solid #cfe6f7; padding-bottom: .2em; }
  h2 { font-size: 14pt; } h3 { font-size: 12pt; }
  code { font: 10pt monospace; background: #f4f4f4; padding: .1em .3em; }
  pre { background: #f4f4f4; padding: .6em; overflow-x: auto; }
  table { border-collapse: collapse; } td, th { border: 1px solid #bbb; padding: .3em .5em; }
  .cover { padding: 6cm 0 0; page-break-after: always; }
  .cover h1 { font-size: 26pt; border: 0; }
  .src { color: #777; font-size: 8pt; font-style: italic; }
  .gaps { background: #fff8e1; }
  .notdak { background: #fdecea; border-left: 4px solid #c0392b; padding: .6em .8em;
            font-size: 10pt; margin-top: 1.5em; }
  .gaps li { margin: .3em 0; }
  figure { margin: 1.2em 0; }
  figure svg { max-width: 100%; height: auto; }
  figcaption { font-size: 9pt; color: #555; margin-bottom: .4em; }
</style></head><body>
<div class="cover"><h1>${esc(a.title)}</h1><p>${
    a.identity.isDak
      ? `Digital Adaptation Kit${a.identity.baseVersion ? ` — <code>${esc(DAK_BASE_DEPENDENCY)}</code> ${esc(a.identity.baseVersion)}` : ""}`
      : "Rendered by folio-assistant"
  } — rendered by folio-assistant</p>${notDak}</div>
<section id="toc"><h1>Contents</h1><ol>${toc}</ol></section>
${body}
${gaps}
</body></html>`;
}

/**
 * Chromium's location, when the bundled download is not what is installed.
 *
 * This container ships Chromium under `PLAYWRIGHT_BROWSERS_PATH` at a
 * different build number than the installed `playwright` expects, so the
 * default launch looks for `chromium_headless_shell-1228` and finds `-1194`.
 * Probing for the real binary is what makes this work without re-downloading a
 * browser, which the environment deliberately blocks.
 */
function chromiumExecutable(): string | undefined {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !existsSync(base)) return undefined;
  for (const dir of readdirSync(base).sort().reverse()) {
    for (const rel of ["chrome-linux/chrome", "chrome-linux/headless_shell", "chrome-linux64/chrome"]) {
      const p = join(base, dir, rel);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

/**
 * Running header and page numbering.
 *
 * Chromium ignores the `@top-center` / `@bottom-center` margin boxes the sgex
 * POC uses, so its running header and `counter(page)` are reproduced here,
 * where Chromium does implement them. Playwright requires an explicit
 * `font-size` in these templates — inherited styles do not apply, and without
 * one the text renders too small to read.
 */
function headerFooter(title: string): { header: string; footer: string } {
  const style = "font-size:8pt;color:#666;width:100%;padding:0 2cm;font-family:Arial,sans-serif;";
  return {
    header: `<div style="${style}text-align:center;">${title.replace(/[<>&]/g, "")}</div>`,
    footer:
      `<div style="${style}text-align:center;">Page <span class="pageNumber"></span>` +
      ` of <span class="totalPages"></span></div>`,
  };
}

async function renderPdf(html: string, out: string, title: string): Promise<void> {
  const { chromium } = await import("playwright");
  const executablePath = chromiumExecutable();
  const browser = await chromium.launch(
    executablePath ? { executablePath, args: ["--no-sandbox"] } : { args: ["--no-sandbox"] },
  );
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    // AFTER `load` and before `pdf()` — `load` is necessary and not sufficient.
    // The wait is the platform's (print waits for render, and refuses over a
    // pending or failed region); imported here, at print time, so assembling
    // the HTML needs nothing from the tools layer.
    const { waitForRender } = await import("../../cat-harness-tools/scripts/render-wait.ts");
    await waitForRender(page);
    const { header, footer } = headerFooter(title);
    await page.pdf({
      path: out,
      format: "A4",
      // Margins here rather than in `@page`: Chromium's PDF path takes its box
      // from these, and a header/footer needs room reserved for it.
      margin: { top: "2.0cm", bottom: "1.8cm", left: "2cm", right: "2cm" },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: header,
      footerTemplate: footer,
    });
  } finally {
    await browser.close();
  }
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const root = argv.find((a) => !a.startsWith("-"));
  const outIdx = argv.findIndex((a) => a === "-o" || a === "--out");
  const out = outIdx >= 0 ? argv[outIdx + 1] : undefined;
  const htmlOnly = argv.includes("--html-only");

  if (!root || !out) {
    console.error("usage: dak-pdf.ts <dak-repo> -o <out.pdf> [--html-only] [--no-diagrams]");
    return 2;
  }
  if (!existsSync(root)) {
    console.error(`no such directory: ${root}`);
    return 2;
  }

  const diagrams: Diagram[] = [];
  if (!argv.includes("--no-diagrams")) {
    try {
      const { renderBpmn } = await import("../../cat-harness-tools/scripts/bpmn-render.ts");
      const bpDir = businessProcessesDir(root);
      const files = existsSync(bpDir)
        ? readdirSync(bpDir).filter((f) => f.endsWith(".bpmn")).map((f) => join(bpDir, f)).sort()
        : [];
      if (files.length) {
        const rendered = await renderBpmn(files, process.cwd());
        for (const r of rendered) {
          // A file that failed to render must not be silently absent: it falls
          // through to the "Not drawn" list, and its error is printed.
          if (r.error) console.error(`  diagram FAILED ${basename(r.source)}: ${r.error.slice(0, 120)}`);
          for (const d of r.diagrams) diagrams.push({ source: r.source, svg: d.svg });
        }
      }
    } catch (e) {
      console.error(`  diagram rendering unavailable: ${String(e).slice(0, 120)}`);
    }
  }

  const a = assemble(root, diagrams);
  if (a.sections.length === 0) {
    console.error(`nothing to render under ${root} — not a DAK repository?`);
    return 1;
  }
  const html = toHtml(a);

  if (htmlOnly) {
    writeFileSync(out, html);
  } else {
    try {
      await renderPdf(html, out, a.title);
    } catch (e) {
      console.error(`PDF rendering failed (${String(e).slice(0, 140)})`);
      console.error("Chromium is required. Re-run with --html-only to get the assembled HTML.");
      return 3;
    }
  }

  console.log(`${a.title}\n  ${a.sections.length} section(s) → ${out}`);
  console.log(
    a.identity.isDak
      ? `  DAK: ${DAK_BASE_DEPENDENCY} ${a.identity.baseVersion ?? "(unversioned)"}`
      : `  NOT a recognised DAK: ${a.identity.reason}`,
  );
  if (a.omissions.length) {
    console.log(`\n  not included (${a.omissions.length}):`);
    for (const o of a.omissions) console.log(`    - ${o}`);
  }
  return 0;
}

if (import.meta.main) {
  main()
    .then((c) => process.exit(c))
    .catch((e) => {
      console.error(e);
      process.exit(2);
    });
}
