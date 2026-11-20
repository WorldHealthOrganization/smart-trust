/**
 * The "Provenance" section in a page's footer, built from the document's
 * `<document>.prov.jsonld` log.
 *
 * @module scripts/provenance-footer
 *
 * The docs QA moved provenance out of the narrative. Who decided, when, and
 * under which work item now goes into a log beside each document, and the
 * log says it "is rendered in its footer". This module does that rendering.
 * The owner chose it on 2026-11-05 ("2B: build it now").
 *
 * ## Two kinds of page, one route
 *
 * A page on the docs site comes from one of two places. An AUTHORED page is
 * a `.md` file under the site directory. A GENERATED page is written by a
 * script from a source somewhere else: `gen-docs-pages` from `docs/source/`,
 * `gen-skill-docs` from a skill. Only the script knows which source a
 * generated page came from, because Jekyll knows only `page.path`.
 *
 * So each generator passes a map of page key to source files to
 * {@link writeProvenanceListing}. It writes one fragment per page that has a
 * log entry, plus a site-data slice, `_data/provenance/<producer>.json`. That
 * slice maps a page key to its fragment. `footer_custom.html` looks up
 * `page.path` in every slice. The keys are the same as the todo index's, so
 * the page path minus its extension. Nothing is written for a page with no
 * entry, so the footer then shows nothing at all, never an empty section.
 *
 * Like the todo listing, everything here is generated at publish time and
 * gitignored.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { withInlineCode } from "../schemas/content/inline-code.js";
import { checkoutRoot, overlayDirs, readPathAt, writePathAt } from "./lib/layer-output.ts";
import { wrapRaw } from "./lib/liquid-raw.ts";
import { escapeHtml, todoListingFileFor } from "./todo-listing.js";

/** One entry of a provenance log, as the footer shows it. */
export interface ProvenanceEntry {
  /** The heading the passage sat under, or `(top of file)`. */
  section: string;
  /** `bean`, `owner-decision`, `issue`, `pr`, `proposal`, `history`, `date`. */
  kind: string;
  /** The passage moved out of the narrative, verbatim. */
  value: string;
  /** The work items, PRs and dates the passage named. */
  refs: string[];
}

/** The log that records a document's provenance: `x.md` → `x.prov.jsonld`. */
export function provenanceLogFor(source: string): string {
  return source.replace(/\.[^./]+$/, "") + ".prov.jsonld";
}

const asList = (v: unknown): string[] =>
  v === undefined ? [] : (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === "string");

/**
 * The entries of one log, in the order the log lists them.
 *
 * Returns `undefined` when there is no log, or when the file is not a
 * document provenance log (`docs/assets/prov/` holds PROV traces of another
 * shape). A log that does not parse throws, because a broken log must not be
 * published as a page with no provenance.
 */
export function readProvenanceLog(file: string): ProvenanceEntry[] | undefined {
  if (!existsSync(file)) return undefined;
  const doc = JSON.parse(readFileSync(file, "utf-8")) as unknown;
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return undefined;
  const graph = (doc as { "@graph"?: unknown })["@graph"];
  if (!Array.isArray(graph)) return undefined;
  const out: ProvenanceEntry[] = [];
  for (const node of graph as Array<Record<string, unknown>>) {
    const value = node["prov:value"];
    if (typeof value !== "string") continue; // the document node itself
    out.push({
      section: typeof node["cat-harness:section"] === "string" ? (node["cat-harness:section"] as string) : "(top of file)",
      kind: typeof node["cat-harness:provenanceKind"] === "string" ? (node["cat-harness:provenanceKind"] as string) : "history",
      value,
      refs: asList(node["cat-harness:refs"]),
    });
  }
  return out;
}

/** The entries of every source's log, concatenated in source order. */
export function provenanceOf(sources: readonly string[]): ProvenanceEntry[] {
  return sources.flatMap((s) => readProvenanceLog(provenanceLogFor(s)) ?? []);
}

/**
 * A passage as plain prose. Passages were cut from Markdown and sometimes
 * from inside an HTML comment, so the comment markers and the common indent
 * are removed. Nothing else changes.
 */
export function passageText(value: string): string {
  const lines = value
    .replace(/^\s*<!--/, "")
    .replace(/--!?>\s*$/, "")
    .split("\n");
  const indents = lines.filter((l) => l.trim() !== "").map((l) => l.match(/^ */)![0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  // A passage cut from a `.bpmn` is XML text, so its `<` arrive as `&lt;`;
  // Markdown shows those entities as characters too. Decoded here, escaped
  // once on output, so a reader never sees `&lt;`.
  return lines
    .map((l) => l.slice(cut))
    .join("\n")
    .trim()
    .replace(/&(lt|gt|quot|apos|amp);/g, (_, e: string) => ({ lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" })[e]!);
}

/**
 * Inline Markdown emphasis outside code spans: `**x**` → strong, `*x*` → em.
 * Runs on text that is already escaped, so it adds tags and nothing else.
 */
export function withEmphasis(html: string): string {
  return html
    .split(/(<code>[\s\S]*?<\/code>)/)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>")
            .replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?![*\w])/g, "$1<em>$2</em>"),
    )
    .join("");
}

/**
 * The footer section: a collapsed `<details>`, with entries grouped under the
 * section they came from, in first-seen order. Every interpolated value is
 * escaped. The whole fragment is wrapped in a Liquid raw block, because a
 * passage may contain `{{` and the fragment is read through `include`.
 */
/**
 * How a section is shown. A page's own footer takes the defaults. A page that
 * lists several logs (the tools page) names each one: `item` drops the lead
 * and the rule, `summary` replaces the heading text, and `id` makes each one
 * its own anchor.
 */
export interface ProvenanceRenderOptions {
  liquid?: boolean;
  item?: boolean;
  /** Plain text: escaped, with inline code. */
  summary?: string;
  id?: string;
}

export function renderProvenanceFooter(entries: readonly ProvenanceEntry[], opts: ProvenanceRenderOptions = {}): string {
  const bySection = new Map<string, ProvenanceEntry[]>();
  for (const e of entries) bySection.set(e.section, [...(bySection.get(e.section) ?? []), e]);
  const summary = opts.summary === undefined ? "Provenance" : withInlineCode(opts.summary, escapeHtml);
  const html: string[] = [
    `<details class="fa-provenance${opts.item ? " fa-provenance-item" : ""}" id="${escapeHtml(opts.id ?? "fa-provenance")}" ` +
      `data-fa-provenance-count="${entries.length}">`,
    `  <summary class="fa-provenance-summary">${summary} (${entries.length})</summary>`,
    ...(opts.item
      ? []
      : [
          `  <p class="fa-provenance-lead">Who decided, when, and under which work item. ` +
            `This record was moved out of the text of the page.</p>`,
        ]),
  ];
  for (const [section, items] of bySection) {
    // The extraction's marker for "before the first heading" reads as a
    // reader's label here.
    const label = section === "(top of file)" ? "About this page" : section;
    html.push(`  <h3 class="fa-provenance-section">${withInlineCode(label, escapeHtml)}</h3>`);
    html.push(`  <ul class="fa-provenance-list">`);
    for (const e of items) {
      const refs = e.refs.length
        ? ` <span class="fa-provenance-refs">${e.refs.map((r) => `<code>${escapeHtml(r.replace(/`/g, ""))}</code>`).join(" ")}</span>`
        : "";
      const text = passageText(e.value)
        .split(/\n{2,}/)
        .map((p) => withEmphasis(withInlineCode(p.replace(/\s*\n\s*/g, " "), escapeHtml)))
        .join("<br><br>");
      html.push(
        `    <li class="fa-provenance-entry" data-fa-provenance-kind="${escapeHtml(e.kind)}">` +
          `<span class="fa-provenance-kind">${escapeHtml(e.kind)}</span>${refs}` +
          `<div class="fa-provenance-text">${text}</div></li>`,
      );
    }
    html.push(`  </ul>`);
  }
  html.push(`</details>`);
  // A page Jekyll never reads must not carry the raw tags, which would show.
  if (opts.liquid === false) return html.join("\n") + "\n";
  return wrapRaw(html.join("\n")).join("\n") + "\n";
}

/**
 * The section for ONE source file, for a page that is not a Jekyll page and
 * so never reaches `footer_custom.html`. `kg-export`'s process pages and the
 * node-kind node pages put it inline after their fields. Empty when the file
 * has no log or the log has no entry.
 *
 * `liquid` is true only when Jekyll will read the page (a themed node page),
 * so a passage containing `{{` is not evaluated there.
 */
export function provenanceSectionFor(source: string, opts: ProvenanceRenderOptions & { liquid: boolean }): string {
  const entries = readProvenanceLog(provenanceLogFor(source)) ?? [];
  return entries.length === 0 ? "" : renderProvenanceFooter(entries, opts);
}

/**
 * The section's styles, for a page that does not load `docs-ui.css` (a process
 * page, a standalone node page). The same rules as `docs-ui.css`, kept short.
 */
export const PROVENANCE_INLINE_STYLE = `
.fa-provenance { margin: 2rem 0 0; padding-top: 1rem; border-top: 1px solid rgba(128,128,128,.35); font-size: .8125rem; }
.fa-provenance-summary { cursor: pointer; font-weight: 600; }
.fa-provenance.fa-provenance-item { margin: 0; padding: .375rem 0; border-top: 0; }
.fa-provenance-lead { opacity: .8; margin: .5rem 0 1rem; }
.fa-provenance .fa-provenance-section { font-size: .875rem; font-weight: 600; margin: 1rem 0 .25rem; }
.fa-provenance-list { margin: 0; padding-left: 1.25rem; }
.fa-provenance-entry { margin: 0 0 .5rem; }
.fa-provenance-kind { display: inline-block; font-size: .6875rem; text-transform: uppercase; letter-spacing: .04em; opacity: .75; margin-right: .375rem; }
.fa-provenance-refs code { font-size: .75rem; margin-right: .25rem; }
.fa-provenance-text { margin-top: .125rem; overflow-wrap: anywhere; }
`;

/** What {@link writeProvenanceListing} did, for the generator's log line. */
export interface ProvenanceListingResult {
  pages: number;
  entries: number;
  /** Fragments that are stale: reported under `check`, deleted otherwise. */
  stale: string[];
}

/**
 * Write one generator's slice: a fragment per page with log entries, under
 * `_includes/generated/provenance/<producer>/`, and the index
 * `_data/provenance/<producer>.json`.
 *
 * `emit` is the generator's own writer, so `--check` compares instead of
 * writing. A fragment no page needs any more is deleted, or reported when
 * `check` is set.
 */
export function writeProvenanceListing(opts: {
  siteDir: string;
  producer: string;
  pages: ReadonlyMap<string, readonly string[]>;
  check: boolean;
  emit?: (path: string, content: string) => void;
  banner?: string;
}): ProvenanceListingResult {
  // Where the site's layer is MOUNTED (bean `cat-tools-sm8r`, item 4), the
  // slice is computed output and goes to the layer's output root; the pinned
  // mount is never written. In the layer's own checkout both are the site.
  // A caller's own `emit` gets the resolved path too: a check compares the
  // copy a reader would see (output root, else the site), a write goes to the
  // output root.
  const root = checkoutRoot();
  const writeAt = (abs: string): string => (root === undefined ? abs : writePathAt(root, abs));
  const at = (abs: string): string => (root === undefined ? abs : opts.check ? readPathAt(root, abs) : writePathAt(root, abs));
  const sink =
    opts.emit ??
    ((path: string, content: string) => {
      if (!opts.check) writeFileSync(path, content);
    });
  const emit = (path: string, content: string): void => sink(at(path), content);
  const fragDir = join(opts.siteDir, "_includes", "generated", "provenance", opts.producer);
  const fragOut = writeAt(fragDir);
  const indexFile = join(opts.siteDir, "_data", "provenance", `${opts.producer}.json`);
  const index: { pages: Record<string, string> } = { pages: {} };
  const written = new Set<string>();
  let entries = 0;
  if (!opts.check) mkdirSync(fragOut, { recursive: true });
  for (const [page, sources] of [...opts.pages].sort(([a], [b]) => a.localeCompare(b))) {
    const found = provenanceOf(sources);
    if (found.length === 0) continue;
    const file = todoListingFileFor(page);
    written.add(file);
    entries += found.length;
    index.pages[page] = `generated/provenance/${opts.producer}/${file}`;
    emit(join(fragDir, file), (opts.banner ?? "") + renderProvenanceFooter(found));
  }
  // Stale fragments in the overlay (output root, then the site): reported
  // from both, deleted only where this run may write.
  const stale = new Set<string>();
  for (const dir of overlayDirs(fragDir, root)) {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".html") || written.has(f)) continue;
      stale.add(f);
      if (!opts.check && dir === fragOut) unlinkSync(join(dir, f));
    }
  }
  if (!opts.check) mkdirSync(dirname(writeAt(indexFile)), { recursive: true });
  emit(indexFile, JSON.stringify(index, null, 2) + "\n");
  return { pages: written.size, entries, stale: [...stale].sort() };
}
