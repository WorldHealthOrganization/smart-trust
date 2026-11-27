#!/usr/bin/env bun
/**
 * Stage a layer's site for GitHub Pages: its files as they sit, the
 * one-page book of its READMEs as the index, and — for bootstrap — its own
 * Knowledge Graph at the address its `@id` names.
 *
 * @module bootstrap-tools/scripts/site
 * @covers code
 *
 * This is the one command that stages a site, run by a Pages workflow or an
 * agent; `publish-site.ts` then commits the staged directory onto `gh-pages`,
 * and GitHub Pages builds the branch with Jekyll, which renders every `.md` to
 * `.html` and rewrites `.md` links to match — so this toolset carries no
 * Markdown renderer (`check-closure.ts`).
 *
 * What lands in `--out`, in the order it is written — first writer wins,
 * because nothing already in `--out` is overwritten (`publish-files.ts`):
 *
 * 1. for bootstrap only, its graph (`export-graph.ts`) at
 *    `<base-url>bootstrap.jsonld`, and its `.json` copy at `bootstrap.json`.
 *    That copy shares its address with the declaration, and the graph keeps
 *    it, as `bootstrap-graph-publication` says. The declaration is still
 *    served, at `v<major>/bootstrap.json`, and the skip is reported;
 * 1a. its NAMED SUBGRAPHS (`subgraph-jsonld.ts`), framed from that same graph:
 *    `subgraph/index.jsonld` (the repository), `subgraph/<name>/index.jsonld`
 *    (the layer) and, for each directory of a kind the graph reads,
 *    `subgraph/<name>/<path>/index.jsonld` and `index.hydrated.jsonld`, with
 *    the one context they name at `subgraph/v<major>/context.jsonld`. For bootstrap,
 *    and for any layer that `needs` bootstrap — whose graph is written in
 *    bootstrap's classes, so it is built with bootstrap's checkout beside it
 *    and is a problem, never silently absent, when that checkout is not
 *    there. Such a layer's graph document is written too, at
 *    `<name>.jsonld`. The
 *    publication root is `--base-url`, else `iriBase`, else the declaration's
 *    GitHub Pages address;
 * 2. every DOCUMENT the layer publishes at the address it names — each
 *    JSON Schema's `$id` and each JSON-LD document's `@id` under `iriBase`
 *    ({@link publishedDocuments}). An `@id` with no extension (`…/v0/ns`,
 *    the namespace a vocabulary is) gets the document at that extensionless
 *    path (`processes/ns.jsonld` also at `processes/ns`); every `.jsonld` also gets a `.json` copy, because Pages
 *    serves `.jsonld` as a download and `.json` as JSON. The `.jsonld` stays
 *    the real one;
 * 3. every file of the layer, as it sits (`publish-files.ts`), so every
 *    relative link in them still resolves — and again under `v<major>/`,
 *    because an IRI a program reads is `<iriBase>v<major>/…`;
 * 3a. `README.md`, the book (`readme-book.ts`), with its links checked,
 *    ending in a "Published documents" section that links every address
 *    above — rendered at `<root>/README.html`. Written BEFORE the files, so it
 *    takes the root README's place: the book opens with that README;
 * 4. `index.html`, a redirect to `README.html` — the DEFAULT landing page,
 *    and only that. To change it, an
 *    layer (or the harness staging it) puts its own `index.html` or
 *    `index.md` at its root: that file is staged as it sits and the redirect
 *    is not written, reported as skipped. A file rather than a declaration
 *    field, because it is what Pages itself serves first and what anybody
 *    looking at the branch would look for;
 * 5. `_config.yml`, when the layer has none: the title, the theme, and a
 *    `defaults:` entry per page saying what its footer links to; and
 *    `_layouts/default.html` (`templates/site/default.html`), the theme's
 *    layout with that footer. The theme's own footer links GitHub's editor
 *    for the file on `gh-pages` — a staged copy — and for a generated page
 *    any edit is overwritten. A generated page's
 *    footer names bootstrap-tools, the script, and its source; an authored
 *    page's links the editor for its SOURCE on the layer's branch.
 *
 * Every `@context` bootstrap writes is inline in its document (no file names
 * an external context), so publishing each document
 * publishes its context. The one exception is built, not authored: every
 * named-subgraph file names `subgraph/v<major>/context.jsonld` by URL, and it is
 * staged with them.
 *
 * `--check` stages into a temporary directory, lists every document address
 * and fails on any problem: an address nothing is staged at, a link on the
 * README page that would not land, an address taken by a different file.
 *
 * `--subgraph <id>` (repeatable) renders only the named Subgraphs — the
 * directories the declaration lists under those ids — plus the files at the
 * layer root (its declaration, README and assets), which say what the
 * Subgraphs are part of. Absent, the whole Knowledge Graph is rendered. An id
 * the declaration does not list is a problem, never silently an empty site
 * (`processes/render-kg-to-github-pages.bpmn`, the process this is a step of).
 *
 * Usage: bun run bootstrap-tools/scripts/site.ts --root ../bootstrap (--out ../_site-src | --check) [--base-url <url>] [--subgraph <id>]… [--provenance] [--branch <source branch, default main>] [--bootstrap <dir>]
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix, relative } from "node:path";

import { readKnowledgeGraphDeclaration } from "../schemas/declaration.ts";
import { SEMVER } from "../schemas/release-iri.ts";
import { TOOLS_REPOSITORY, generatedScripts, wholeFileGenerated } from "./generated-by.ts";
import { exportGraph, subjectDocuments } from "./export-graph.ts";
import { frameSubgraphs, publicationBase } from "./subgraph-jsonld.ts";
import { publishFiles } from "./publish-files.ts";
import { gitFiles } from "./git-files.ts";
import { buildBook, danglingFragments, readReadmes } from "./readme-book.ts";

/** `owner/repo` from a declaration's `repository`, in either the short or the URL form. */
export function ownerRepo(repository: unknown): { owner: string; repo: string } | undefined {
  if (typeof repository !== "string") return undefined;
  const m = /^(?:https:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(repository.trim());
  return m ? { owner: m[1]!, repo: m[2]! } : undefined;
}

/** The README page's path in the site: rendered at `<root>/README.html`. */
export const BOOK = "README.md";

/** The layout staged beside the pages: the theme's, with a footer that never links an edit page for a generated file. */
export const LAYOUT = join(import.meta.dir, "templates", "site", "default.html");

/** A page at the root that is the layer's own landing page; any one of them stops the default redirect. */
export const LANDING = ["index.html", "index.md", "index.markdown", "index.htm"];

/** The default landing page: a redirect to the README page, with nothing to run. */
export function redirectPage(target: string = "README.html"): string {
  return [
    "<!DOCTYPE html>",
    `<!-- The default landing page of a site staged by bootstrap-tools (scripts/site.ts): a redirect to ${target}. To land somewhere else, put your own index.html or index.md at the instance's root; it is staged instead of this. -->`,
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="refresh" content="0; url=${target}">`,
    `<link rel="canonical" href="${target}">`,
    "<title>Redirecting…</title>",
    "</head>",
    "<body>",
    `<p>This page has moved to <a href="${target}">${target}</a>.</p>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

/** What one page's footer links to, as its `defaults:` entry carries it. */
export interface PageFooter {
  generated_by?: string[];
  generated_from?: string;
  source_url?: string;
  edit_url?: string;
  generated_sections?: string[];
}

/**
 * The footer facts for a page staged from `rel` (its source, relative to the
 * layer root): wholly generated → the scripts and the source, no edit link;
 * authored → the editor for its source on `branch`, and any generated regions.
 * `repo` is `https://github.com/<owner>/<repo>`, or `undefined` when the
 * declaration names none — then no link is composed at all.
 */
export function pageFooter(rel: string, text: string, repo: string | undefined, branch: string): PageFooter {
  const notes = generatedScripts(text);
  const scripts = [...new Set(notes.map((n) => n.script))];
  const dir = posix.dirname(rel);
  if (wholeFileGenerated(text)) {
    return {
      generated_by: scripts,
      generated_from: notes.map((n) => n.from).join("; "),
      ...(repo ? { source_url: `${repo}/tree/${branch}/${dir === "." ? "" : dir}`.replace(/\/$/, "") } : {}),
    };
  }
  return {
    ...(repo ? { edit_url: `${repo}/edit/${branch}/${rel}` } : {}),
    ...(scripts.length ? { generated_sections: scripts } : {}),
  };
}

/** `_config.yml`: title, theme, the tools' address, and a `defaults:` entry per page with a footer. */
export function siteConfig(decl: { name: string; title?: string; description?: string }, footers: ReadonlyMap<string, PageFooter>): string {
  const out = [
    `title: ${JSON.stringify(decl.title ?? decl.name)}`,
    `description: ${JSON.stringify(decl.description ?? "")}`,
    "theme: jekyll-theme-primer",
    `generated_by_tools: ${JSON.stringify(TOOLS_REPOSITORY)}`,
  ];
  const entries = [...footers].filter(([, f]) => Object.keys(f).length > 0);
  if (entries.length) {
    out.push("# What each page's footer links to (scripts/site.ts, templates/site/default.html).", "defaults:");
    for (const [path, f] of entries) {
      out.push(`  - scope: { path: ${JSON.stringify(path)} }`, "    values:");
      for (const [k, v] of Object.entries(f)) out.push(`      ${k}: ${JSON.stringify(v)}`);
    }
  }
  return `${out.join("\n")}\n`;
}

/** A document the layer publishes at an address it names itself. */
export interface PublishedDocument {
  /** The address, as the document names it (no fragment). */
  iri: string;
  /** Where it is staged: the address with `iriBase` removed. */
  path: string;
  /** The file it comes from, relative to the layer root; `undefined` for a document built at publish time. */
  source?: string;
  kind: "json-schema" | "json-ld";
}

/**
 * Every document `root` publishes at an address it names: each JSON file git
 * accounts for whose top-level `$id` (a JSON Schema) or `@id` (a JSON-LD
 * document) lies under the declaration's `iriBase`, and — for bootstrap —
 * the graph export. Read from the files, never from a list kept here, so a
 * schema added tomorrow is published tomorrow. Empty when there is no
 * `iriBase`: an address nobody declared is not one to publish at.
 */
export function publishedDocuments(root: string, baseUrl?: string): PublishedDocument[] {
  const decl = readKnowledgeGraphDeclaration(root);
  const base = (baseUrl ?? decl?.iriBase)?.replace(/\/?$/, "/");
  if (!decl || !base) return [];
  const out: PublishedDocument[] = [];
  for (const abs of gitFiles(root) ?? []) {
    if (!/\.(json|jsonld)$/.test(abs) || !existsSync(abs)) continue;
    let doc: Record<string, unknown>;
    try {
      doc = JSON.parse(readFileSync(abs, "utf-8")) as Record<string, unknown>;
    } catch {
      continue;
    }
    const id = typeof doc["$id"] === "string" ? (doc["$id"] as string) : typeof doc["@id"] === "string" ? (doc["@id"] as string) : undefined;
    const iri = id?.split("#")[0];
    if (!iri || !iri.startsWith(base) || iri === base) continue;
    out.push({ iri, path: iri.slice(base.length), source: relative(root, abs).split("\\").join("/"), kind: "$id" in doc ? "json-schema" : "json-ld" });
  }
  if (decl.name === "bootstrap") out.push({ iri: `${base}bootstrap.jsonld`, path: "bootstrap.jsonld", kind: "json-ld" });
  return out.sort((a, b) => (a.iri < b.iri ? -1 : a.iri > b.iri ? 1 : 0));
}

/** The paths a published document is staged at: its own, and the `.json` copy of a `.jsonld` or of an extensionless JSON-LD address. */
export function stagedPaths(d: PublishedDocument): string[] {
  if (d.kind !== "json-ld") return [d.path];
  // A slash namespace (`…/v0/ns/`, the slash-IRI decision, owner 2026-11-02) is a directory, so
  // the document is its index: the terms below it are paths of their own.
  if (d.path.endsWith("/")) return [`${d.path}index.jsonld`, `${d.path}index.json`];
  if (d.path.endsWith(".jsonld")) return [d.path, d.path.replace(/\.jsonld$/, ".json")];
  if (!posix.extname(d.path)) return [d.path, `${d.path}.json`];
  return [d.path];
}

/** The "Published documents" section of the README page: every address, linked. */
export function documentsSection(docs: readonly PublishedDocument[]): string {
  if (docs.length === 0) return "";
  const rows = docs.map((d) => {
    const alias = stagedPaths(d).slice(1).map((p) => ` ([\`.json\`](${p}))`).join("");
    return `| [\`${d.iri}\`](${d.path})${alias} | ${d.kind === "json-schema" ? "JSON Schema" : "JSON-LD"} | ${d.source ? `\`${d.source}\`` : "built when the site is published"} |`;
  });
  return [
    "Every document this repository publishes at an address it names itself: each JSON Schema at its `$id`, each JSON-LD document at its `@id`. A program following one of these addresses gets that document. Where a host would serve `.jsonld` as a download, a `.json` copy with the same bytes sits beside it.",
    "",
    "| address | what | from |",
    "|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}

/**
 * Which of `root`'s files a selection of Subgraphs keeps: every file directly
 * at the root, and every file under the path of a directory the declaration
 * lists under one of `ids`. `undefined` or empty `ids` keeps everything — the
 * whole Knowledge Graph. An id the declaration does not list is returned in
 * `unknown` so the caller reports it rather than rendering less than asked.
 */
export function subgraphSelection(
  decl: { directories?: { id: string; path: string }[] },
  ids: readonly string[] | undefined,
): { keep?: (rel: string) => boolean; unknown: string[] } {
  if (!ids || ids.length === 0) return { unknown: [] };
  const dirs = decl.directories ?? [];
  const unknown = ids.filter((id) => !dirs.some((d) => d.id === id));
  const prefixes = dirs.filter((d) => ids.includes(d.id)).map((d) => d.path.replace(/^\.\//, "").replace(/\/?$/, "/"));
  return { keep: (rel) => !rel.includes("/") || prefixes.some((p) => rel.startsWith(p)), unknown };
}

export interface SiteReport {
  written: string[];
  skipped: string[];
  problems: string[];
}

/** Stage `root`'s site in `out`. Throws when there is no declaration to read. */
export function stageSite(
  root: string,
  out: string,
  opts: { baseUrl?: string; provenance?: boolean; subgraphs?: readonly string[]; branch?: string; bootstrapRoot?: string } = {},
): SiteReport {
  const decl = readKnowledgeGraphDeclaration(root);
  if (!decl) throw new Error(`${root} carries no Knowledge Graph declaration — there is no instance to publish`);
  mkdirSync(out, { recursive: true });
  const report: SiteReport = { written: [], skipped: [], problems: [] };
  const selection = subgraphSelection(decl, opts.subgraphs);
  for (const id of selection.unknown) report.problems.push(`--subgraph ${id}: ${decl.name}.json declares no directory with that id`);
  const keep = selection.keep ?? (() => true);
  const put = (rel: string, content: string) => {
    const p = join(out, rel);
    mkdirSync(dirname(p), { recursive: true });
    if (existsSync(p)) {
      report.skipped.push(rel);
      return;
    }
    writeFileSync(p, content);
    report.written.push(rel);
  };

  // The graph first: its `.json` copy keeps the address it shares with the
  // declaration (bootstrap-graph-publication), and nothing written after it
  // may take that address.
  //
  // ONE graph, built once: the document, and every subgraph file framed from
  // it. Each `source` is a link under the publication root, which is where
  // the file sits on the site — the same IRI the relative path resolved to.
  const base = (opts.baseUrl ?? decl.iriBase)?.replace(/\/?$/, "/");
  const needs = Array.isArray(decl["needs"]) ? (decl["needs"] as unknown[]) : [];
  if (decl.name === "bootstrap" || needs.includes("bootstrap")) {
    const graphBase = decl.name === "bootstrap" ? base : publicationBase(decl, opts.baseUrl);
    if (!graphBase) report.problems.push(`no --base-url, no iriBase and no repository: ${decl.name}.jsonld and its subgraphs not written, because their @id would be a guess`);
    else {
      let graph: Record<string, unknown> | undefined;
      try {
        graph = exportGraph(root, { docIri: `${graphBase}${decl.name}.jsonld`, provenance: opts.provenance ?? false, sourceBase: graphBase, bootstrapRoot: opts.bootstrapRoot });
      } catch (e) {
        report.problems.push(`${decl.name}.jsonld and its subgraphs not written: ${(e as Error).message} (its classes are bootstrap's, so bootstrap's checkout must sit beside it, or be named with --bootstrap)`);
      }
      if (graph) {
        const doc = `${JSON.stringify(graph, null, 2)}\n`;
        put(`${decl.name}.jsonld`, doc);
        // The `.json` copy shares bootstrap's declaration's address, and the
        // graph keeps it (bootstrap-graph-publication); another layer's
        // declaration has no versioned copy to fall back on, so it keeps its own.
        if (decl.name === "bootstrap") put("bootstrap.json", doc);
        for (const [rel, body] of subjectDocuments(graph, `${decl.name}.jsonld`)) put(rel, body);
        const sub = frameSubgraphs(root, graph, graphBase);
        report.problems.push(...sub.problems.map((p) => `subgraph: ${p}`));
        if (sub.problems.length === 0) for (const [path, text] of sub.files) put(path, text);
      }
    }
  }

  // Each document at the address it names, and its `.json` copy.
  const docs = publishedDocuments(root, opts.baseUrl).filter((d) => !d.source || keep(d.source));
  for (const d of docs) {
    if (!d.source) continue;
    const bytes = readFileSync(join(root, d.source), "utf-8");
    for (const p of stagedPaths(d)) {
      const at = join(out, p);
      if (existsSync(at)) {
        if (readFileSync(at, "utf-8") !== bytes) report.problems.push(`${p}: ${d.iri} names this address, and a different file is already there`);
        continue;
      }
      mkdirSync(dirname(at), { recursive: true });
      copyFileSync(join(root, d.source), at);
      report.written.push(p);
    }
  }

  // The README page, before the files: it takes the root README's place,
  // and opens with it.
  const all = readReadmes(root);
  const readmes = all && new Map([...all].filter(([rel]) => keep(rel)));
  if (!readmes) report.problems.push("git could not say which READMEs there are, so there is no README page");
  else {
    const book = buildBook(root, readmes, {
      title: decl.title ?? decl.name,
      description: decl.description,
      jekyll: true,
      appendix: docs.length ? { id: "published-documents", title: "Published documents", body: documentsSection(docs) } : undefined,
    });
    report.problems.push(...book.problems, ...danglingFragments(book.markdown).map((f) => `${BOOK} links to ${f}, which no anchor carries`));
    put(BOOK, book.markdown);
  }


  // Then every file as it sits. An authored index.html or index.md is the
  // layer's own landing page, and the default redirect is not written.
  // A skip is reported only where the file there DIFFERS: a document already
  // staged at its own address is the same bytes, not a collision.
  const differs = (dir: string, f: string) => readFileSync(join(dir, f)).compare(readFileSync(join(root, f))) !== 0;
  const files = publishFiles(root, out, selection.keep);
  report.written.push(...files.written);
  report.skipped.push(...files.skipped.filter((f) => f !== BOOK && differs(out, f)));
  // Again under the release address's own segment, `v<major>` — what every
  // identifier of this release names (`release-iri.ts`; owner, 2026-10-23).
  const seg = releaseSegment(decl);
  if (seg) {
    const v = publishFiles(root, join(out, seg), selection.keep);
    report.written.push(...v.written.map((f) => `${seg}/${f}`));
    report.skipped.push(...v.skipped.filter((f) => differs(join(out, seg), f)).map((f) => `${seg}/${f}`));
  }

  // A document whose address is taken by something else is a broken IRI.
  for (const d of docs) if (!existsSync(join(out, d.path))) report.problems.push(`${d.iri} is not staged at ${d.path}`);

  // The default landing page, unless the layer brought its own.
  if (!LANDING.some((f) => existsSync(join(out, f)))) put("index.html", redirectPage());
  else report.skipped.push("index.html (the instance's own landing page is staged instead of the redirect)");

  // Each page's footer: a generated page links its generator and source,
  // never an edit page; an authored one links the editor for its source.
  const o = ownerRepo(decl.repository);
  const repo = o ? `https://github.com/${o.owner}/${o.repo}` : undefined;
  const branch = opts.branch ?? "main";
  const footers = new Map<string, PageFooter>();
  const pages = files.written.filter((f) => /\.(md|markdown)$/.test(f));
  for (const rel of pages) {
    const f = pageFooter(rel, readFileSync(join(root, rel), "utf-8"), repo, branch);
    footers.set(rel, f);
    if (seg) footers.set(`${seg}/${rel}`, f);
  }
  if (existsSync(join(out, BOOK)) && report.written.includes(BOOK)) {
    // The book is ONE generator's page, whatever notes the READMEs it gathers carry.
    footers.set(BOOK, { generated_by: ["scripts/readme-book.ts"], generated_from: "every README in this repository", ...(repo ? { source_url: `${repo}/tree/${branch}` } : {}) });
    if (seg && existsSync(join(root, BOOK))) footers.set(`${seg}/${BOOK}`, pageFooter(BOOK, readFileSync(join(root, BOOK), "utf-8"), repo, branch));
  }
  put("_config.yml", siteConfig(decl, footers));
  put("_layouts/default.html", readFileSync(LAYOUT, "utf-8"));
  return report;
}

/**
 * The directory a release's files are staged under: `v<major>`, the segment
 * every address of that release carries (`release-iri.ts`), or none when the
 * layer declares no `iriBase` or no semver `version`.
 */
export function releaseSegment(decl: { iriBase?: string; version?: string }): string | undefined {
  const m = decl.iriBase && decl.version ? SEMVER.exec(decl.version) : null;
  return m ? `v${Number(m[1])}` : undefined;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const arg = (f: string) => {
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const root = arg("--root") ?? join(import.meta.dir, "..", "..", "bootstrap");
  const check = args.includes("--check");
  const out = arg("--out") ?? (check ? mkdtempSync(join(tmpdir(), "site-check-")) : undefined);
  if (!out) {
    console.error("usage: site.ts --root <instance> (--out <dir> | --check) [--base-url <url>] [--subgraph <id>]… [--provenance]");
    process.exit(2);
  }
  const subgraphs = args.flatMap((a, i) => (a === "--subgraph" && args[i + 1] ? [args[i + 1]!] : []));
  const r = stageSite(root, out, { baseUrl: arg("--base-url"), provenance: args.includes("--provenance"), subgraphs, branch: arg("--branch"), bootstrapRoot: arg("--bootstrap") });
  const decl = readKnowledgeGraphDeclaration(root);
  const keep = (decl && subgraphSelection(decl, subgraphs).keep) ?? (() => true);
  const docs = publishedDocuments(root, arg("--base-url")).filter((d) => !d.source || keep(d.source));
  console.log(`Staged ${r.written.length} file(s) from ${root} in ${out}.`);
  console.log(`${docs.length} document(s) at the address each names:`);
  for (const d of docs) console.log(`  ${existsSync(join(out, d.path)) ? "✓" : "✗"} ${d.iri}  ←  ${d.source ?? "built"}`);
  const subgraphFiles = r.written.filter((f) => f.startsWith("subgraph/"));
  if (subgraphFiles.length) console.log(`${subgraphFiles.length} named-subgraph file(s), from subgraph/index.jsonld.`);
  for (const s of r.skipped) console.log(`  not written, already there: ${s}`);
  for (const p of r.problems) console.error(`  ✗ ${p}`);
  if (check) rmSync(out, { recursive: true, force: true });
  if (r.problems.length) process.exit(1);
}
