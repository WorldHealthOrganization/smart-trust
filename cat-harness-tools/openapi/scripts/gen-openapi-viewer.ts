#!/usr/bin/env bun
/**
 * The OpenAPI VIEWER: the pages of every visualiser a harness declares
 * `renderedBy: openapi-pages`, at that visualiser's route.
 *
 * @module cat-harness-tools/openapi/scripts/gen-openapi-viewer
 * @covers openapi — every directory of that kind any layer in the checkout declares
 *
 * ```sh
 * bun run cat openapi:viz [--root <checkout>] [--site <dir>] [--check]
 * ```
 *
 * ## The gap this closes
 *
 * A layer's `openapi` graph is `served`, so the main site publishes it
 * VERBATIM at `/<instance>/<path>`: the ingested document and its
 * provenance, and nothing else. The pages `gen-openapi-pages.ts` draws for it
 * (one per document and per operation) are written only on an IG repository's
 * OWN site (`ig-site-openapi.ts`). So on the main site the kind had no page,
 * and the navbar row read "no viewer yet" (owner, 2026-10-20: every kind gets
 * a viewer).
 *
 * ## What is written, at `<locale>/<harness>/<visualiser>/`
 *
 * | path under the route | what |
 * |---|---|
 * | `index.html` | the hub: every layer declaring an `openapi` directory, with the documents each holds |
 * | `<instance>/…` | that layer's graph exactly as {@link pagesFor} draws it: its index, a page per document and per operation, their JSON-LD nodes, and the shared loader |
 * | `<instance>/<file>` | each document, copied beside the pages, since a page fetches it from `../<file>`; never its provenance node, which is a materialization record and stays in the graph |
 *
 * The renderer is `gen-openapi-pages.ts`, imported, never restated: a second
 * drawing of the same graph could disagree with the IG site's. The IRIs the
 * nodes carry are unchanged, and still extend the layer's graph path. An IRI is
 * the asset's identity, and this route is a rendering of it.
 *
 * A layer that declares the directory but whose config or documents do
 * not read gets a page that says so, with the error. It is never left out:
 * leaving it out would make an unreadable graph look like an empty one.
 *
 * Built at publish (the harness's `builtAtPublish`), so `--check` judges a
 * site that was built, and nothing is committed.
 *
 * Exit: 0 written (or current, with `--check`) · 1 `--check` found a stale, missing or orphaned file.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import { checkoutRootFor, readDeclaration } from "../../schemas/kg/cat-harness.ts";
import { OpenApiProvenanceSchema } from "../schemas/openapi.ts";

import {
  checkoutInstanceRoots,
  declaredVisualisers,
  pageParts,
  siteOwnerDir,
  visualiserPageDir,
  withRenderedBy,
  withRenderedByFrontMatter,
  type DeclaredVisualiser,
} from "../../scripts/viewer-declarations.ts";
import { siteArg } from "../../scripts/lib/site-target.ts";
import { escHtml } from "../../scripts/thin-page.ts";
import { pagesFor } from "./gen-openapi-pages.ts";
import { openapiDir, readConfig } from "./ingest-openapi.ts";

/** This writer's Tool node (`cat-harness/tools/openapi-pages/`). */
export const TOOL_ID = "openapi-pages";
const KIND = "openapi";

/** One layer declaring an `openapi` directory, and what reading it gave. */
export interface OpenApiSubject {
  name: string;
  root: string;
  /** Repository-relative paths of the layer's `openapi` directories. */
  directories: string[];
  /** The documents its config names, when the graph reads. */
  documents?: Array<{ id: string; title: string; file: string }>;
  /** Why the graph does not read, when it does not. */
  error?: string;
}

/** Every layer in the checkout declaring a directory of `kinds`, sorted by name. */
export function openapiSubjects(repoRoot: string, kinds: readonly string[] = [KIND]): OpenApiSubject[] {
  const out: OpenApiSubject[] = [];
  for (const root of checkoutInstanceRoots(repoRoot)) {
    const decl = readDeclaration(root);
    if (decl === undefined) continue;
    const dirs = (decl.directories ?? []).filter((d) => (d.graphTypologies ?? []).some((k) => kinds.includes(k)) && typeof d.path === "string");
    if (dirs.length === 0) continue;
    if (out.some((s) => s.name === decl.name)) continue;
    const subject: OpenApiSubject = {
      name: decl.name,
      root,
      directories: dirs.map((d) => relative(repoRoot, join(root, d.path!)).split("\\").join("/")),
    };
    try {
      const config = readConfig(root);
      const dir = openapiDir(root, config);
      subject.documents = config.documents.map((d) => {
        const prov = OpenApiProvenanceSchema.parse(JSON.parse(readFileSync(join(dir, `${d.id}.source.json`), "utf8")));
        return { id: d.id, title: d.title ?? d.id, file: prov.file };
      });
    } catch (e) {
      subject.error = e instanceof Error ? e.message.replace(resolve(repoRoot) + "/", "") : String(e);
    }
    out.push(subject);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "en"));
}

const CSS = `.oav-page table{width:100%;border-collapse:collapse}.oav-page th,.oav-page td{text-align:left;padding:.45rem .5rem;border-bottom:1px solid rgba(127,127,127,.35);vertical-align:top}
.oav-page code{overflow-wrap:anywhere}.oav-page .oav-err{border-left:4px solid #a8200f;padding:.5rem .8rem}`;

function jekyllPage(title: string, body: string): string {
  return withRenderedByFrontMatter(
    `---\nlayout: default\ntitle: ${JSON.stringify(title)}\nnav_exclude: true\nrender_with_liquid: false\n---\n` +
      `<!-- Generated by cat-harness-tools/openapi/scripts/gen-openapi-viewer.ts; built at publish, never edited. -->\n` +
      `<style>\n${CSS}\n</style>\n<div class="oav-page">\n${body}\n</div>\n`,
    TOOL_ID,
  );
}

/** `<route>/`: every layer holding an `openapi` graph, and its documents. */
export function hubPage(v: Pick<DeclaredVisualiser, "title">, all: readonly OpenApiSubject[]): string {
  const title = v.title ?? "OpenAPI documents";
  const holds = (s: OpenApiSubject): string =>
    s.error !== undefined
      ? `<strong>unknown</strong>: the graph does not read`
      : s.documents!.length === 0
        ? "no document configured"
        : s.documents!.map((d) => `<a href="${encodeURI(s.name)}/${encodeURI(d.id)}/">${escHtml(d.title)}</a>`).join(", ");
  const rows = all
    .map((s) => `<tr><td><a href="${encodeURI(s.name)}/">${escHtml(s.name)}</a></td><td>${s.directories.map((d) => `<code>${escHtml(d)}</code>`).join(" ")}</td><td>${holds(s)}</td></tr>`)
    .join("");
  const body = all.length
    ? `<table><thead><tr><th>instance</th><th>directory</th><th>documents</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<p>No instance in this checkout declares an <code>openapi</code> directory.</p>`;
  return jekyllPage(
    title,
    `<h1>${escHtml(title)}</h1>\n<p>The API descriptions each instance holds, ingested verbatim with their provenance. Each one has a page, and so does each of its operations. The documents are copies, and the authority is the source each one names.</p>\n${body}`,
  );
}

/** `<route>/<instance>/` for a graph that does not read: say so, with why. */
export function unreadablePage(v: Pick<DeclaredVisualiser, "title">, s: OpenApiSubject): string {
  const title = `${v.title ?? "OpenAPI documents"} — ${s.name}`;
  return jekyllPage(
    title,
    `<h1>${escHtml(title)}</h1>\n<p class="oav-err">This instance declares ${s.directories.map((d) => `<code>${escHtml(d)}</code>`).join(", ")} as an <code>openapi</code> graph, and it does not read, so what it holds is <strong>unknown</strong>, not none: ${escHtml(s.error ?? "")}</p>\n<p><a href="../">Every instance</a></p>`,
  );
}

/** Every file the declared visualisers rendered by this Tool owe: absolute path → content, or a file to copy. */
export function plannedFiles(root: string, site: string): { files: Map<string, string | { copy: string }>; routes: string[] } {
  const files = new Map<string, string | { copy: string }>();
  const routes: string[] = [];
  const vis = declaredVisualisers(root).filter((v) => v.renderedBy === TOOL_ID);
  for (const v of vis) {
    const subjects = openapiSubjects(root, v.coversKinds?.length ? v.coversKinds : [KIND]);
    const full = pageParts({ harness: v.harness, visualiser: v.id });
    const dir = visualiserPageDir(site, full);
    routes.push(dir);
    files.set(join(dir, "index.html"), hubPage(v, subjects));
    if (v.subgraphs !== "instance") continue;
    for (const s of subjects) {
      const at = visualiserPageDir(site, { ...full, subgraph: s.name });
      if (s.error !== undefined) {
        files.set(join(at, "index.html"), unreadablePage(v, s));
        continue;
      }
      for (const w of pagesFor(s.root)) {
        files.set(join(at, w.path), w.path.endsWith(".html") ? withRenderedBy(w.content, TOOL_ID) : w.content);
      }
      const src = openapiDir(s.root, readConfig(s.root));
      for (const d of s.documents ?? []) {
        // The document only. Its provenance node stays in the graph: it is a
        // materialization record (`folio-materialization/v1`), and a copy of it
        // here would make the site's docs a directory holding materialized
        // nodes that no declaration answers for (`check:read-only-graphs`).
        files.set(join(at, d.file), { copy: join(src, d.file) });
      }
    }
  }
  return { files, routes };
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return (readdirSync(dir, { recursive: true }) as string[]).map((f) => join(dir, f)).filter((p) => statSync(p).isFile());
}

const bytesOf = (c: string | { copy: string }): string => (typeof c === "string" ? c : readFileSync(c.copy, "utf8"));

function main(): number {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--root");
  const root = checkoutRootFor(resolve(at >= 0 && argv[at + 1] ? argv[at + 1]! : process.cwd()));
  const site = siteArg(argv) ?? siteOwnerDir(root);
  const check = argv.includes("--check");
  const { files, routes } = plannedFiles(root, site);
  if (routes.length === 0) {
    console.log(`${TOOL_ID}: no instance in this checkout declares a visualiser rendered by ${TOOL_ID} — nothing to write`);
    return 0;
  }
  if (check) {
    const stale = [...files].filter(([p, c]) => !existsSync(p) || readFileSync(p, "utf-8") !== bytesOf(c)).map(([p]) => p);
    const orphans = routes.flatMap(filesUnder).filter((p) => !files.has(p));
    for (const p of stale) console.error(`✗ ${relative(site, p)} is stale or missing`);
    for (const p of orphans) console.error(`✗ ${relative(site, p)} is an orphan — no declared subject produces it`);
    if (stale.length || orphans.length) return 1;
    console.log(`✓ ${files.size} ${KIND} viewer file(s) current under ${site}`);
    return 0;
  }
  for (const r of routes) rmSync(r, { recursive: true, force: true });
  for (const [p, c] of files) {
    mkdirSync(join(p, ".."), { recursive: true });
    if (typeof c === "string") writeFileSync(p, c);
    else copyFileSync(c.copy, p);
  }
  console.log(`${TOOL_ID}: ${files.size} file(s) written under ${relative(process.cwd(), site) || basename(site)} (${routes.map((r) => relative(site, r)).join(", ")})`);
  return 0;
}

if (import.meta.main) process.exit(main());
