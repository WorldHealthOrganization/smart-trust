#!/usr/bin/env bun
/**
 * A viewer over every layer's declared DOCUMENT KINDS.
 *
 * @module scripts/gen-document-kinds-viz
 * @covers document-kinds
 * @graphNode none — a generator over the document-kinds graph, not a schema itself
 *
 * Placed like `gen-voices-viz.ts`: one index under
 * `<site>/<handler>/document-kinds/` and one page per SUBJECT layer under
 * it, each naming the directories it draws (`renders`) and this generator's
 * Tool (`rendered-by`). Static pages — there is nothing to filter.
 *
 * Generic: core knows that document kinds exist and never which
 * (`schemas/content/document-kind.ts`). The WHO DAK and L1 kinds are the DAK
 * base layer's DATA, drawn because that layer declares them.
 *
 * ## What each kind's card must show
 *
 * The structure (fixed or semi-fixed), every section in order with whether it
 * is required, what a section is `computedFrom`, and the sources — the kind's
 * and each section's. A section with no source of its own inherits the kind's,
 * and the card says so rather than leaving it blank.
 *
 * Usage:
 *   bun run cat document-kinds:viz          # write
 *   bun run cat document-kinds:viz:check    # fail if a page is stale or orphaned
 */
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

import {
  DOCUMENT_KIND_COVERAGE_SCHEMA_TAG,
  DocumentKindCoverageSchema,
  DocumentKindSchema,
  type DocumentKind,
  type DocumentKindCoverage,
} from "../schemas/content/document-kind.ts";
import { directoriesForGraph, layerRootsIn, readDeclaration, repoRootFor, siteDirFor } from "../schemas/kg/cat-harness.ts";
import { resolveInstanceGraph } from "../schemas/kg/harness-config.ts";
import { mountedInstanceRoots } from "../schemas/kg/remote-mount.ts";
import { orphanSubjectPages, viewerPlacement } from "./gen-schema-viz.ts";
import { makeEmit } from "./viewer-page.ts";
import { declaredPageRoute, withRenderedByFrontMatter } from "./viewer-declarations.js";
import { subjectNav, subjectNavCss, themedPage } from "./lib/themed-page.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { siteTarget } from "./lib/site-target.ts";

/** This generator's Tool node (`tools/viewers.ts`), named on every page it draws. */
const VIEWER_TOOL = "document-kinds-viewer";
const GRAPH = "document-kinds";

const ROOT = join(HARNESS_ROOT);
const check = process.argv.includes("--check");

export interface KindEntry {
  instance: string;
  /** Repo-relative path of the kind's JSON file. */
  file: string;
  kind: DocumentKind;
  /** Computed reports of how subjects realise this kind, from its own directory or a dependent's. */
  coverage: DocumentKindCoverage[];
}

/**
 * Every layer root reachable from `repoRoot`: the checkout's own layers,
 * any mounted layers (`index.lock.json`, including overrides placed deeper than
 * one level), and the dependency closure (`needs` and `dependencies.folioAssistant`)
 * of each. Deduplicated in discovery order so the checkout's own order is
 * preserved.
 */
export function documentKindInstanceRoots(repoRoot: string): string[] {
  const seen = new Set<string>();
  const roots: string[] = [];
  const add = (r: string): void => {
    const abs = resolve(r);
    if (seen.has(abs) || !existsSync(abs)) return;
    seen.add(abs);
    roots.push(abs);
  };
  for (const r of layerRootsIn(repoRoot)) add(r);
  for (const r of mountedInstanceRoots(repoRoot).values()) add(r);
  for (let i = 0; i < roots.length; i++) {
    const r = roots[i]!;
    for (const m of mountedInstanceRoots(r).values()) add(m);
    for (const d of resolveInstanceGraph(r).order) add(d.rootPath);
  }
  return roots;
}

/** Every declared document kind in the checkout, validated; throws on an invalid one. */
export function readDocumentKinds(repoRoot: string): { kinds: KindEntry[]; dirs: { instance: string; dir: string }[] } {
  const kinds: KindEntry[] = [];
  const dirs: { instance: string; dir: string }[] = [];
  const reports: { instance: string; dir: string; report: DocumentKindCoverage }[] = [];
  for (const root of documentKindInstanceRoots(repoRoot)) {
    const instance = readDeclaration(root)?.name ?? basename(root);
    for (const dir of directoriesForGraph(root, GRAPH)) {
      dirs.push({ instance, dir });
      if (!existsSync(dir)) continue;
      const coverage: DocumentKindCoverage[] = [];
      for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
        const path = join(dir, f);
        const raw = JSON.parse(readFileSync(path, "utf-8")) as { $schema?: string };
        // Two families share the directory (graph-typology-registry `nodeSchemas`):
        // the file's own tag says which, never its name.
        const isCoverage = raw.$schema === DOCUMENT_KIND_COVERAGE_SCHEMA_TAG;
        const parsed = (isCoverage ? DocumentKindCoverageSchema : DocumentKindSchema).safeParse(raw);
        if (!parsed.success) {
          throw new Error(`${path} is not a valid ${isCoverage ? "coverage report" : "document kind"}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
        }
        if (isCoverage) coverage.push(parsed.data as DocumentKindCoverage);
        else kinds.push({ instance, file: relative(repoRoot, path).split(sep).join("/"), kind: parsed.data as DocumentKind, coverage: [] });
      }
      for (const c of coverage) reports.push({ instance, dir, report: c });
    }
  }
  // Attached once every kind is read: a coverage report lives with the
  // SUBJECT it is about, which is usually a layer above the one declaring the
  // kind (an IG's report on a kind its base layer declares). The kind is the
  // one of that id its own layer declares, else the one some other
  // layer in the checkout declares; a report naming no kind anywhere is
  // still refused.
  for (const { instance, dir, report: c } of reports) {
    const owner =
      kinds.find((k) => k.instance === instance && k.kind.id === c.kind) ?? kinds.find((k) => k.kind.id === c.kind);
    if (!owner) throw new Error(`${dir}: a coverage report for kind "${c.kind}" (subject ${c.subject}) names no kind any instance in the checkout declares`);
    owner.coverage.push(c);
  }
  return { kinds, dirs };
}

/**
 * Every SUBJECT page and the kinds it shows (fa#2739).
 *
 * A subject is every layer that DECLARES a document-kinds directory, not
 * only one that declares a kind: the harness tiles link `<route>/<instance>/`
 * for each declared directory, so a layer whose directory holds only a
 * coverage report (an IG realising its base layer's kind) or nothing yet
 * still gets its page. Until then two IG layers above this layer were
 * linked from the home page and never drawn. A subject's page shows the kinds
 * it declares and the kinds it reports coverage of.
 */
export function subjectEntries(
  kinds: readonly KindEntry[],
  dirs: readonly { instance: string }[],
): Map<string, KindEntry[]> {
  const subjects = [...new Set([...dirs.map((d) => d.instance), ...kinds.map((k) => k.instance)])].sort();
  return new Map(
    subjects.map((s) => [s, kinds.filter((k) => k.instance === s || k.coverage.some((c) => c.subject === s))]),
  );
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function sourceText(src: { ref: string; locator?: string; note?: string }): string {
  const ref = /^https?:\/\//.test(src.ref) ? `<a href="${esc(src.ref)}">${esc(src.ref)}</a>` : `<code>${esc(src.ref)}</code>`;
  return ref + (src.locator ? `, ${esc(src.locator)}` : "") + (src.note ? ` — ${esc(src.note)}` : "");
}

function kindCard(e: KindEntry): string {
  const k = e.kind;
  const rows = k.sections
    .map(
      (s, i) =>
        `<tr><td>${i + 1}</td><td><b>${esc(s.title)}</b><br><code>${esc(s.id)}</code></td>` +
        `<td>${s.required ? "required" : "optional"}</td><td>${esc(s.description)}` +
        (s.computedFrom ? `<br><span class="m">computed from: ${s.computedFrom.map((c) => `<code>${esc(c)}</code>`).join(", ")}</span>` : "") +
        (s.modelledBy ? `<br><span class="m">modelled by: ${s.modelledBy.map((c) => `<code>${esc(c)}</code>`).join(", ")}</span>` : "") +
        `</td><td>${s.sources ? s.sources.map(sourceText).join("<br>") : '<span class="m">the kind&#39;s sources</span>'}</td></tr>`,
    )
    .join("\n");
  return `<section class="kind" id="${esc(e.instance)}-${esc(k.id)}">
<h2>${esc(k.title)} <code>${esc(k.id)}</code></h2>
<p>${esc(k.description)}</p>
<p class="m"><b>${k.structure}</b> structure · ${k.sections.length} section(s)` +
    (k.extends ? ` · extends <a href="#${esc(e.instance)}-${esc(k.extends)}"><code>${esc(k.extends)}</code></a>` : "") +
    ` · declared by <b>${esc(e.instance)}</b> in <code>${esc(e.file)}</code>` +
    (k.generatedBy ? ` · generated by <code>${esc(k.generatedBy)}</code>` : "") +
    `</p>
<div class="clip"><table class="sec">
<thead><tr><th>#</th><th>Section</th><th></th><th>What it holds</th><th>Source</th></tr></thead>
<tbody>
${rows}
</tbody></table></div>
<p class="m">Sources: ${k.sources.map(sourceText).join("; ")}</p>
${e.coverage.length > 0 ? coverageTable(k, e.coverage) : ""}
</section>`;
}

/** How each subject realises the kind: members per section, and the unplaced remainder. */
function coverageTable(k: DocumentKind, cov: readonly DocumentKindCoverage[]): string {
  const subjects = [...cov].sort((a, b) => a.subject.localeCompare(b.subject));
  const head = subjects.map((c) => `<th>${esc(c.subject)}</th>`).join("");
  const rows = k.sections
    .map((s) => {
      const cells = subjects
        .map((c) => {
          const m = c.sections.find((x) => x.id === s.id)?.members ?? [];
          if (m.length === 0) return '<td class="m">—</td>';
          const list = m.slice(0, 12).map((x) => `<li>${esc(x.label)}</li>`).join("") + (m.length > 12 ? `<li class="m">…and ${m.length - 12} more</li>` : "");
          return `<td><details><summary>${m.length}</summary><ul>${list}</ul></details></td>`;
        })
        .join("");
      return `<tr><td>${esc(s.title)}</td>${cells}</tr>`;
    })
    .join("\n");
  const unplaced = subjects
    .map((c) => `<td>${c.unplaced.length === 0 ? "none" : c.unplaced.map((u) => `${esc(u.group)} ${u.count}`).join(", ")}</td>`)
    .join("");
  const totals = subjects.map((c) => `<td>${c.total}</td>`).join("");
  return `<h3>How each subject realises it</h3>
<p class="m">${esc(subjects[0]!.method)}</p>
<div class="clip"><table class="cov">
<thead><tr><th>Section</th>${head}</tr></thead>
<tbody>
${rows}
<tr><td><b>Unplaced</b></td>${unplaced}</tr>
<tr><td><b>Artefacts classified</b></td>${totals}</tr>
</tbody></table></div>`;
}

/**
 * The page, as a THEMED Jekyll page (2026-10-07): on the site's `default`
 * layout, so it carries the top band (search, Folio, language) that
 * `docs-ui.js` builds and only that layout delivers. Until then it was a
 * standalone document with its own palette and an injected harness rail.
 *
 * Every rule is scoped under `.dk-page`: on the layout a rule on `body`,
 * `:root` or `a` would restyle the theme. Ink comes from the theme, edges are
 * neutral and translucent, and the one muted hue is keyed on the site's own
 * scheme switch (`data-fa-scheme`) — a colour rather than an opacity, because
 * muted lines here carry LINKS, and an opacity on the line would dim the
 * theme's link colour below 4.5:1 with it.
 */
export function pageHtml(entries: readonly KindEntry[], scope?: string, subjects: readonly string[] = []): string {
  const title = scope ? `Document kinds — ${scope}` : "Document kinds";
  return themedPage({
    title,
    generator: "cat-harness-tools/scripts/gen-document-kinds-viz.ts",
    command: "bun run document-kinds:viz",
    body: `<style>
.dk-page { min-width:0; overflow-wrap:anywhere; --muted:#bcbab3; }
:root[data-fa-scheme="light"] .dk-page { --muted:#5b6168; }
.dk-page h1 { margin:0 0 .4rem; }
.dk-page h2 { margin:1.5rem 0 .4rem; }
.dk-page h3 { margin:1.1rem 0 .25rem; }
.dk-page .m { color:var(--muted); font-size:.88rem; }
.dk-page .kind { border-top:1px solid rgba(127,127,127,.4); padding-top:4px; }
.dk-page .clip { width:100%; overflow-x:auto; }
.dk-page table { display:table; width:100%; border-collapse:collapse; font-size:.9rem; }
.dk-page th, .dk-page td { text-align:left; vertical-align:top; padding:6px 8px; border:0; border-bottom:1px solid rgba(127,127,127,.4); background:transparent; }
.dk-page th { background:rgba(127,127,127,.12); }
.dk-page code { font-size:.85em; overflow-wrap:anywhere; }
/* "overflow-wrap:anywhere" above is for long codes and paths; it also broke the
   narrow number and required/optional cells mid-word ("1 0", "o pt io n al")
   once a kind's source column grew long — dth's does. Those cells never wrap,
   and the section title keeps a width it can be read at. */
.dk-page .sec td:nth-child(1), .dk-page .sec td:nth-child(3) { white-space:nowrap; overflow-wrap:normal; }
.dk-page .sec td:nth-child(2) { min-width:11rem; overflow-wrap:normal; }
/* On a phone a five-column table cannot fit: each section becomes a stacked
   card instead, header row hidden, nothing scrolls sideways. */
@media (max-width: 640px) {
  .dk-page .sec thead { display:none; }
  .dk-page .sec, .dk-page .sec tbody, .dk-page .sec tr, .dk-page .sec td { display:block; width:100%; min-width:0; }
  .dk-page .sec tr { border-bottom:1px solid rgba(127,127,127,.4); padding:6px 0; }
  .dk-page .sec td { border:0; padding:2px 0; }
}
.dk-page .cov td, .dk-page .cov th { white-space:normal; overflow-wrap:normal; }
.dk-page .cov td:first-child { min-width:9rem; width:30%; }
.dk-page .cov ul { margin:4px 0 0 1em; padding:0; font-size:.85rem; }
${subjectNavCss("dk-page")}
</style>
<div class="dk-page">
<h1 id="dk-title">${esc(title)}</h1>
${subjectNav({ subjects, current: scope, cls: "dk-page" })}
<p class="m">A document kind is a named structure of sections that a document authored with a harness follows: <b>fixed</b> (exactly these sections) or <b>semi-fixed</b> (these required, others allowed). Every kind and section names its sources.</p>
${entries.length === 0 ? `<p class="m">${scope ? `${esc(scope)} declares a document-kinds directory, and it holds no kind or coverage report yet.` : "No document kinds are declared."}</p>` : entries.map(kindCard).join("\n")}
</div>`,
  });
}

let stale = 0;

if (import.meta.main) {
  const repoRoot = repoRootFor(ROOT);
  const { kinds, dirs } = readDocumentKinds(repoRoot);
  const handler = readDeclaration(ROOT)?.name;
  if (!handler) {
    console.log("  · this instance declares no name — no handler segment to publish under");
    process.exit(0);
  }

  // THE ROUTE IS DECLARED (owner, 2026-10-09): `<locale>/<harness>/<id>/`, from the
  // visualiser this harness declares `renderedBy` this Tool — never composed
  // here from the directory's name.
  const route = declaredPageRoute(ROOT, VIEWER_TOOL);
  if (route === undefined) {
    console.log(`  · no visualiser declared rendered by ${VIEWER_TOOL} — nothing to publish`);
    process.exit(0);
  }
  const site = siteTarget(join(ROOT, siteDirFor(ROOT)));
  const { pageDir } = viewerPlacement(site, route, GRAPH);
  // No `nav`: these pages are themed, so the theme's sidebar is their
  // navigation and there is no rail to inject.
  const emitPage = makeEmit({ check, onStale: () => { stale++; } });

  const bySubject = subjectEntries(kinds, dirs);
  const subjects = [...bySubject.keys()];
  emitPage(join(pageDir, "index.html"), withRenderedByFrontMatter(pageHtml(kinds, undefined, subjects), VIEWER_TOOL));
  for (const [subject, entries] of bySubject) {
    const sub = viewerPlacement(site, `${route}/${subject}`, GRAPH);
    emitPage(join(sub.pageDir, "index.html"), withRenderedByFrontMatter(pageHtml(entries, subject, subjects), VIEWER_TOOL));
  }
  const { owned, foreign } = orphanSubjectPages(pageDir, subjects);
  for (const name of foreign) console.error(`  ! ${join(pageDir, name)} is not a subject and does not identify itself — left in place`);
  for (const name of owned) {
    const dir = join(pageDir, name);
    if (check) {
      console.error(`  ✗ ${dir} is an orphan — it serves a subject the declarations no longer describe`);
      stale++;
      continue;
    }
    rmSync(dir, { recursive: true });
    console.log(`  ✗ pruned ${dir}`);
  }
  if (!check) console.log(`  ${kinds.length} document kind(s) across ${subjects.length} instance(s)`);
  if (stale > 0) {
    console.error(`\n${stale} page(s) stale — run \`bun run cat document-kinds:viz\``);
    process.exit(1);
  }
}
