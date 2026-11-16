#!/usr/bin/env bun
/**
 * The `l1-extraction` viewer: one page per layer that declares an
 * `l1-extraction` directory, showing what was extracted, and a hub at the
 * visualiser's route.
 *
 * @module smart-base/scripts/gen-l1-extraction-pages
 * @covers l1-extraction — every directory of that kind any layer in the checkout declares
 *
 * ## Where the pages go, and who says so
 *
 * smart-base owns the kind (owner, 2026-10-16: *"l1-extraction is part of
 * smart-base"*), so `smart-base.json` declares the visualiser
 * (`renderedBy: l1-extraction-pages`, `subgraphs: "instance"`), and the route
 * is `visualiserRoute` of it: `<locale>/smart-base/<id>/` for the hub and
 * `…/<instance>/` per layer. With `--site <dir>` (a site being built,
 * `visualiser-writers.ts` in cat-harness-tools) the pages go under that site;
 * without it, under the checkout's site directory. The route belongs to this
 * writer alone, so a run replaces it wholesale.
 *
 * ## What a page shows
 *
 * Read from the files, never from a list of file names: each document is
 * recognised by what it declares (`$schema`, or a JSON-LD `@context` with
 * `nodes`), so the measles example's `*.l1.yaml` and `candidates/` read as
 * readily as the handbook's `l1.json` and `scenarios/`.
 *
 * - the L1 statements: every node of an L1 graph carrying a `statement`
 *   (recommendations, implementation practices), and every `recommendations`
 *   row of an authored L1 source YAML, with where each was read from: a link
 *   to the library entry's page and to the section, by core's
 *   `publish-extracted-statements` rule (`resolveSource`), when the source
 *   resolves, and the file's own note otherwise;
 * - the candidate work list (`l1-recommendation-candidates/v1`): its counts,
 *   its coverage and each candidate's decision;
 * - the curation, mapping, vocabulary, exclusions and run context, counted;
 * - each graph document's nodes by type and edges by predicate (the L2
 *   scenario candidates among them);
 * - every file, linked to its published copy when the site carries it (the
 *   library publisher, cat-harness's `library:viz`, publishes an entry's
 *   `within: "library"` sub-graphs beside its manifest) and to its source at
 *   the commit the checkout pins.
 *
 * A declared directory that is not on disk is **unknown** in this build, never
 * "0 recommendations". A file that does not parse says so and is not counted.
 * Authored text (statements, quotes) is escaped and the page is marked
 * `render_with_liquid: false`.
 *
 * Usage:
 *   bun run smart-base/scripts/gen-l1-extraction-pages.ts [--root <checkout>] [--site <dir>] [--check]
 *
 * Exit: 0 written (or current, with `--check`) · 1 `--check` found a stale, missing or orphaned page.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { parse as parseYaml } from "yaml";

import {
  checkoutDirectories,
  checkoutRootFor,
  declarationPathIn,
  declaredVisualisers,
  entryGraphSitePath,
  pageParts,
  siteArg,
  siteOwnerDir,
  sitePageAt,
  siteRootFrom,
  visualiserPageDir,
  visualiserRoute,
  withRenderedByFrontMatter,
  resolveSource,
  type DeclaredVisualiser,
} from "../platform/index.js";
import { firstPage, isL1Source, libraryIdOfL1, parseLocation } from "./l1-statement-lists.ts";

/** The Tool that draws these pages — the `renderedBy` a harness declares. */
export const TOOL_ID = "l1-extraction-pages";
/** The kind it draws. */
export const KIND = "l1-extraction";

// ── reading ────────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : typeof v === "number" ? String(v) : undefined);
const tally = (xs: readonly string[]): [string, number][] => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

/** One L1 statement: a graph node with a `statement`, or an authored source's recommendation row. */
export interface Statement {
  file: string;
  id: string;
  type: string;
  text: string;
  where?: string;
  /** The library entry and page it was read from, when the file says (`l1-statement-lists`). */
  source?: { libraryId: string; page?: number };
}

/** A JSON-LD graph document (`@context`, `nodes`, `edges`). */
export interface GraphDoc {
  file: string;
  context: string;
  id?: string;
  nodesByType: [string, number][];
  edgesByPredicate: [string, number][];
}

/** `l1-recommendation-candidates/v1`: the work list and how it was decided. */
export interface CandidateDoc {
  file: string;
  publication?: string;
  counts: [string, string][];
  coverage: [string, string][];
  decisions: [string, number][];
  rows: { location: string; decision: string; keys: string[]; text: string }[];
}

/** One file of the directory, and what it was read as. */
export interface FileRow {
  /** Path under the declared directory. */
  rel: string;
  bytes: number;
  /** What the file is, in a few words: its `$schema`, "JSON-LD graph", … */
  what: string;
  /** One line on what it holds, when counted. */
  holds?: string;
  /** Why it was not read, when it was not. */
  error?: string;
}

/** Everything a declared directory holds, as the page shows it. */
export interface Extraction {
  files: FileRow[];
  statements: Statement[];
  graphs: GraphDoc[];
  candidates: CandidateDoc[];
}

function filesIn(dir: string): string[] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .map((f) => f.split(sep).join("/"))
    .filter((f) => !f.split("/").some((s) => s.startsWith(".")) && statSync(join(dir, f)).isFile())
    .sort();
}

const clip = (t: string, n = 400): string => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const oneLine = (t: string): string => t.replace(/\s+/g, " ").trim();

/** Read one document into the extraction; returns what the file row says it is. */
function readDoc(rel: string, doc: unknown, out: Extraction): Pick<FileRow, "what" | "holds"> {
  if (Array.isArray(doc)) {
    // `exclusions.proposed.json`: rows that each carry a location and a reason.
    if (doc.every((r) => isObj(r) && typeof r["location"] === "string" && typeof r["reason"] === "string")) {
      const reasons = tally(doc.map((r) => (r as Obj)["reason"] as string));
      return { what: "proposed exclusions", holds: `${doc.length} exclusion(s): ${reasons.map(([k, v]) => `${v} ${k}`).join(", ")}` };
    }
    return { what: "JSON array", holds: `${doc.length} item(s)` };
  }
  if (!isObj(doc)) return { what: "scalar" };
  const schema = str(doc["$schema"]);
  if (doc["@context"] !== undefined && Array.isArray(doc["nodes"])) {
    const nodes = doc["nodes"].filter(isObj);
    const edges = Array.isArray(doc["edges"]) ? doc["edges"].filter(isObj) : [];
    const context = typeof doc["@context"] === "string" ? doc["@context"] : "(inline context)";
    out.graphs.push({
      file: rel,
      context,
      ...(str(doc["id"]) ? { id: str(doc["id"]) } : {}),
      nodesByType: tally(nodes.map((x) => str(x["type"]) ?? "(untyped)")),
      edgesByPredicate: tally(edges.map((x) => str(x["predicate"]) ?? "(none)")),
    });
    for (const x of nodes) {
      const p = isObj(x["properties"]) ? x["properties"] : {};
      const text = str(p["statement"]);
      if (text === undefined) continue;
      const ev = isObj(x["evidence"]) ? x["evidence"] : {};
      out.statements.push({
        file: rel,
        id: str(p["identifier"]) ?? str(x["label"]) ?? str(x["id"]) ?? "?",
        type: str(x["type"]) ?? "(untyped)",
        text: oneLine(text),
        ...(str(ev["location"]) ? { where: str(ev["location"]) } : {}),
      });
    }
    return { what: "JSON-LD graph", holds: `${nodes.length} node(s), ${edges.length} edge(s)` };
  }
  if (schema === "l1-recommendation-candidates/v1") {
    const cands = Array.isArray(doc["candidates"]) ? doc["candidates"].filter(isObj) : [];
    const pub = isObj(doc["publication"]) ? str(doc["publication"]["title"]) : undefined;
    const pairs = (o: unknown): [string, string][] =>
      isObj(o) ? Object.entries(o).filter(([, v]) => str(v) !== undefined).map(([k, v]) => [k, str(v)!]) : [];
    out.candidates.push({
      file: rel,
      ...(pub ? { publication: pub } : {}),
      counts: pairs(doc["counts"]),
      coverage: pairs(doc["coverage"]),
      decisions: tally(cands.map((c) => str(c["decision"]) ?? "undecided")),
      rows: cands.map((c) => ({
        location: str(c["location"]) ?? "?",
        decision: str(c["decision"]) ?? "undecided",
        keys: Array.isArray(c["keys"]) ? c["keys"].map(String) : [],
        text: oneLine(str(c["text"]) ?? ""),
      })),
    });
    return { what: schema, holds: `${cands.length} candidate sentence(s)` };
  }
  if (schema === "l1-recommendation-curation/v1") {
    const ds = isObj(doc["decisions"]) ? Object.values(doc["decisions"]).filter(isObj) : [];
    return { what: schema, holds: `${ds.length} decision(s): ${tally(ds.map((d) => str(d["as"]) ?? "?")).map(([k, v]) => `${v} ${k}`).join(", ")}` };
  }
  if (schema === "l1-scenario-vocabulary/v1") {
    const len = (k: string): number => (Array.isArray(doc[k]) ? (doc[k] as unknown[]).length : 0);
    return { what: schema, holds: `${len("personas")} persona(s), ${len("processes")} process(es)` };
  }
  if (schema === "l1-scenario-mapping/v1") {
    return { what: schema, holds: `${isObj(doc["entries"]) ? Object.keys(doc["entries"]).length : 0} mapped statement(s)` };
  }
  if (schema === "folio-run-context/v1") {
    const inv = isObj(doc["invoker"]) ? str(doc["invoker"]["id"]) : undefined;
    const commit = isObj(doc["platform"]) ? str(doc["platform"]["commit"]) : undefined;
    return { what: schema, holds: [inv ? `written by ${inv}` : undefined, commit ? `platform at ${commit.slice(0, 12)}` : undefined].filter(Boolean).join(", ") || undefined };
  }
  // An authored L1 source: a YAML document whose `recommendations` are rows with a statement.
  if (Array.isArray(doc["recommendations"])) {
    const recs = doc["recommendations"].filter(isObj).filter((r) => str(r["statement"]) !== undefined);
    const title = isObj(doc["publication"]) ? str(doc["publication"]["title"]) : undefined;
    const libraryId = libraryIdOfL1(doc);
    for (const r of recs) {
      const page = str(r["page"]);
      const section = str(r["section"]);
      const first = firstPage(r["page"]);
      out.statements.push({
        file: rel,
        id: str(r["key"]) ?? "?",
        type: "recommendation",
        text: oneLine(str(r["statement"])!),
        ...(page || section ? { where: [section ? `§${section}` : undefined, page ? `p. ${page}` : undefined].filter(Boolean).join(", ") } : {}),
        ...(libraryId ? { source: { libraryId, ...(first !== undefined ? { page: first } : {}) } } : {}),
      });
    }
    return { what: schema ?? "authored L1 source", holds: `${recs.length} recommendation(s)${title ? ` of ${title}` : ""}` };
  }
  return { what: schema ?? "JSON/YAML document" };
}

/** What a declared directory holds. `null` when it is not on disk: unknown, not empty. */
export function readExtraction(absPath: string): Extraction | null {
  if (!existsSync(absPath)) return null;
  const out: Extraction = { files: [], statements: [], graphs: [], candidates: [] };
  for (const rel of filesIn(absPath)) {
    const abs = join(absPath, rel);
    const bytes = statSync(abs).size;
    if (/\.md$/i.test(rel)) {
      out.files.push({ rel, bytes, what: "Markdown" });
      continue;
    }
    if (!/\.(json|jsonld|ya?ml)$/i.test(rel)) {
      out.files.push({ rel, bytes, what: "file" });
      continue;
    }
    let doc: unknown;
    try {
      const text = readFileSync(abs, "utf-8");
      doc = /\.ya?ml$/i.test(rel) ? parseYaml(text) : JSON.parse(text);
    } catch (e) {
      out.files.push({ rel, bytes, what: /\.ya?ml$/i.test(rel) ? "YAML" : "JSON", error: `does not parse: ${(e as Error).message.split("\n")[0]}` });
      continue;
    }
    out.files.push({ rel, bytes, ...readDoc(rel, doc, out) });
  }
  return out;
}

// ── subjects ───────────────────────────────────────────────────────────────

/** One declared `l1-extraction` directory. */
export interface ExtractionDir {
  id: string;
  path: string;
  absPath: string;
  /** The library entry it sits inside, when it does (`library/<entry>/…`). */
  entry?: { id: string; rel: string };
  extraction: Extraction | null;
}

/** One layer holding `l1-extraction` directories: a page's subject. */
export interface Subject {
  name: string;
  instanceRoot: string;
  directories: ExtractionDir[];
}

interface DirLike {
  id: string;
  path: string;
  absPath: string;
  declaredBy: string;
  member?: string;
  graphTypologies?: readonly string[];
}

/** A layer's declaration read raw: a page must not fail on a field a newer schema refuses. */
function rawDeclaration(instanceRoot: string): Obj | undefined {
  try {
    const p = declarationPathIn(instanceRoot);
    return p === undefined ? undefined : (JSON.parse(readFileSync(p, "utf-8")) as Obj);
  } catch {
    return undefined;
  }
}

/** The library entry a directory sits inside, from the layer's own `library` declaration. */
function entryOf(instanceRoot: string, dirPath: string): ExtractionDir["entry"] {
  const dirs = rawDeclaration(instanceRoot)?.["directories"];
  const libs = (Array.isArray(dirs) ? dirs.filter(isObj) : [])
    .filter((d) => Array.isArray(d["graphTypologies"]) && (d["graphTypologies"] as unknown[]).includes("library"))
    .map((d) => String(d["path"] ?? "").replace(/\/+$/, ""))
    .filter((p) => p.length > 0);
  const path = dirPath.replace(/\/+$/, "");
  for (const lib of libs) {
    const m = new RegExp(`^${lib.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/([^/]+)/(.+)$`).exec(path);
    if (m) return { id: m[1]!, rel: m[2]! };
  }
  return undefined;
}

/** The layers holding a directory of `kinds`, one subject each, sorted by name. */
export function subjectsOf(dirs: readonly DirLike[], kinds: readonly string[]): Subject[] {
  const out = new Map<string, Subject>();
  for (const d of dirs) {
    if (!(d.graphTypologies ?? []).some((k) => kinds.includes(k))) continue;
    const name = d.member ?? d.declaredBy;
    const up = d.path.split("/").filter((x) => x.length > 0 && x !== ".").length;
    const instanceRoot = resolve(d.absPath, ...Array.from({ length: up }, () => ".."));
    const s = out.get(name) ?? { name, instanceRoot, directories: [] };
    const entry = entryOf(instanceRoot, d.path);
    s.directories.push({ id: d.id, path: d.path, absPath: d.absPath, ...(entry ? { entry } : {}), extraction: readExtraction(d.absPath) });
    out.set(name, s);
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Where a layer's files open on GitHub: at the commit the checkout's lock
 * pins it (`index.lock.json`), or — the checkout's own layer — at the
 * checkout's HEAD. `undefined` when neither can be said, and the files are
 * then listed without a source link.
 */
export function sourceBase(checkoutRoot: string, subject: Pick<Subject, "name" | "instanceRoot">): string | undefined {
  const ok = (repo: unknown, sha: unknown): boolean =>
    typeof repo === "string" && /^[\w.-]+\/[\w.-]+$/.test(repo) && typeof sha === "string" && /^[0-9a-f]{7,40}$/.test(sha);
  try {
    const lock = JSON.parse(readFileSync(join(checkoutRoot, "index.lock.json"), "utf-8")) as Obj;
    const inst = (Array.isArray(lock["instances"]) ? lock["instances"].filter(isObj) : []).find((i) => i["instance"] === subject.name);
    if (inst && ok(inst["repository"], inst["sha"])) {
      const up = str(inst["upstreamRoot"])?.replace(/^\/+|\/+$/g, "");
      return `https://github.com/${inst["repository"]}/blob/${inst["sha"]}/${up ? `${up}/` : ""}`;
    }
  } catch {
    // no lock: the checkout's own layer, below
  }
  const repo = rawDeclaration(subject.instanceRoot)?.["repository"];
  const git = (...a: string[]): string | undefined => {
    const r = spawnSync("git", ["-C", subject.instanceRoot, ...a], { encoding: "utf-8" });
    return r.status === 0 ? r.stdout.trim() : undefined;
  };
  const sha = git("rev-parse", "HEAD");
  const top = git("rev-parse", "--show-toplevel");
  if (!ok(repo, sha) || top === undefined) return undefined;
  const up = relative(top, subject.instanceRoot).split(sep).join("/");
  if (up.startsWith("..")) return undefined;
  return `https://github.com/${repo}/blob/${sha}/${up ? `${up}/` : ""}`;
}

/** A scenario node's `evidence.location` (`<l1 yaml>#<KEY> (p<N>)`) → the L1 source's entry and the page. */
function sourceOfLocation(instanceRoot: string, where: string | undefined): Statement["source"] {
  const loc = where ? parseLocation(where) : undefined;
  if (!loc) return undefined;
  const abs = resolve(instanceRoot, loc.file);
  if (!existsSync(abs)) return undefined;
  try {
    const doc = parseYaml(readFileSync(abs, "utf-8"));
    const libraryId = isL1Source(doc) ? libraryIdOfL1(doc) : undefined;
    return libraryId ? { libraryId, ...(loc.page !== undefined ? { page: loc.page } : {}) } : undefined;
  } catch {
    return undefined;
  }
}

// ── rendering ──────────────────────────────────────────────────────────────

const esc = (v: string): string => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const enc = (p: string): string => p.split("/").map(encodeURIComponent).join("/");

const CSS = `.l1x-page table{border-collapse:collapse;margin:.5rem 0 1rem}
.l1x-page th,.l1x-page td{border:1px solid var(--border-color,#ccc);padding:.2rem .5rem;text-align:left;vertical-align:top}
.l1x-page td.num{text-align:right}
.l1x-mark{border-left:4px solid #0093d5;padding:.4rem .7rem;margin:.5rem 0 1rem}
.l1x-sub{opacity:.8}`;

/** The page shell: Jekyll front matter, no Liquid, provenance in `rendered-by`. */
function page(title: string, body: string): string {
  return withRenderedByFrontMatter(
    `---\nlayout: default\ntitle: ${JSON.stringify(title)}\nnav_exclude: true\nrender_with_liquid: false\n---\n` +
      `<!-- Generated by smart-base/scripts/gen-l1-extraction-pages.ts; built at publish, never edited. -->\n` +
      `<style>\n${CSS}\n</style>\n<div class="l1x-page">\n${body}\n</div>\n`,
    TOOL_ID,
  );
}

const MARK = `<p class="l1x-mark">Everything an L1 extraction holds is a <strong>candidate</strong>: an agent decided it, and a person signs exclusions and reviews links. Counts here are what the files hold, not a reviewed result.</p>`;

/** One line for the hub: what a directory holds, or that it is unknown. */
export function directoryVerdict(d: ExtractionDir): string {
  const x = d.extraction;
  if (x === null) return "unknown — not in this build";
  const parts = [`${x.files.length} file(s)`, `${x.statements.length} L1 statement(s)`];
  const c = x.candidates[0];
  if (c) parts.push(`${c.rows.length} candidate sentence(s)`);
  const scen = x.graphs.flatMap((g) => g.nodesByType).filter(([t]) => t === "user-scenario").reduce((s, [, k]) => s + k, 0);
  if (scen) parts.push(`${scen} user-scenario candidate(s)`);
  return parts.join(", ");
}

function countTable(head: [string, string], rows: readonly [string, number | string][]): string {
  if (rows.length === 0) return "<p>none</p>";
  return `<table><thead><tr><th>${esc(head[0])}</th><th>${esc(head[1])}</th></tr></thead><tbody>${rows
    .map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td class="num">${esc(String(v))}</td></tr>`)
    .join("")}</tbody></table>`;
}

interface Links {
  /** Site-relative path of a file's published copy, when the site holds one. */
  published(d: ExtractionDir, rel: string): string | undefined;
  /** Absolute URL of a file's source, when known. */
  source(d: ExtractionDir, rel: string): string | undefined;
  /** Relative path from the page to the site root. */
  up: string;
  /** Site-relative path of the library viewer's entry page, when the site holds one. */
  entryPage(d: ExtractionDir): string | undefined;
  /**
   * Where a statement came from, as links: the library entry's page and the
   * section's source, resolved by core's `statements:pages` rule. Undefined
   * when the statement names no source, or it does not resolve.
   */
  statementSource?(s: Statement): { entry?: string; section?: string; label: string; libraryId: string } | undefined;
}

function fileLink(d: ExtractionDir, rel: string, links: Links): string {
  const pub = links.published(d, rel);
  const src = links.source(d, rel);
  return [pub ? `<a href="${esc(links.up + enc(pub))}">published</a>` : "", src ? `<a href="${esc(src)}">source</a>` : ""].filter(Boolean).join(" · ");
}

/** The "read from" cell: the entry and section as links when they resolve, else where the file says. */
function readFrom(s: Statement, links: Links): string {
  const r = links.statementSource?.(s);
  if (!r) return s.where ? `<code>${esc(s.where)}</code>` : "";
  const entry = r.entry ? `<a href="${esc(links.up + enc(r.entry))}">${esc(r.libraryId)}</a>` : `<code>${esc(r.libraryId)}</code>`;
  const section = r.label ? (r.section ? `<a href="${esc(r.section)}">${esc(r.label)}</a>` : esc(r.label)) : "";
  return section ? `${entry}: ${section}` : entry;
}

function directorySection(d: ExtractionDir, links: Links): string {
  const entryPage = links.entryPage(d);
  const head =
    `<h2><code>${esc(d.path)}</code> <span class="l1x-sub">(${esc(d.id)})</span></h2>` +
    (d.entry
      ? `<p class="l1x-sub">Inside the library entry <code>${esc(d.entry.id)}</code>${entryPage ? ` — <a href="${esc(links.up + enc(entryPage))}">its library page</a>` : ""}.</p>`
      : `<p class="l1x-sub">Not inside a library entry.</p>`);
  const x = d.extraction;
  if (x === null) return `${head}<p>Not in this build, so what it holds is <strong>unknown</strong>, not none.</p>`;
  const statements = x.statements.length
    ? `<h3>L1 statements (${x.statements.length})</h3>` +
      `<p class="l1x-sub">${tally(x.statements.map((s) => s.type)).map(([t, k]) => `${k} ${esc(t)}`).join(", ")}</p>` +
      `<table><thead><tr><th>id</th><th>type</th><th>statement</th><th>read from</th><th>file</th></tr></thead><tbody>${x.statements
        .map((s) => `<tr><td><code>${esc(s.id)}</code></td><td>${esc(s.type)}</td><td>${esc(clip(s.text))}</td><td>${readFrom(s, links)}</td><td><code>${esc(s.file)}</code></td></tr>`)
        .join("")}</tbody></table>`
    : `<h3>L1 statements</h3><p>No file here carries an L1 statement.</p>`;
  const candidates = x.candidates
    .map(
      (c) =>
        `<h3>Candidate sentences — <code>${esc(c.file)}</code></h3>` +
        (c.publication ? `<p>${esc(c.publication)}</p>` : "") +
        `<div style="display:flex;gap:1.5rem;flex-wrap:wrap"><div><h4>Counts</h4>${countTable(["count", "value"], c.counts)}</div>` +
        `<div><h4>Coverage</h4>${countTable(["measure", "value"], c.coverage)}</div>` +
        `<div><h4>Decisions</h4>${countTable(["decision", "sentences"], c.decisions)}</div></div>` +
        `<details><summary>Every candidate (${c.rows.length})</summary><table><thead><tr><th>location</th><th>decision</th><th>keys</th><th>sentence</th></tr></thead><tbody>${c.rows
          .map((r) => `<tr><td><code>${esc(r.location)}</code></td><td>${esc(r.decision)}</td><td>${r.keys.map((k) => `<code>${esc(k)}</code>`).join(" ")}</td><td>${esc(clip(r.text))}</td></tr>`)
          .join("")}</tbody></table></details>`,
    )
    .join("\n");
  const graphs = x.graphs.length
    ? `<h3>Graph documents (${x.graphs.length})</h3>` +
      x.graphs
        .map(
          (g) =>
            `<h4><code>${esc(g.file)}</code></h4><p class="l1x-sub">Context <code>${esc(g.context)}</code>${g.id ? `; graph <code>${esc(g.id)}</code>` : ""}.</p>` +
            `<div style="display:flex;gap:1.5rem;flex-wrap:wrap"><div>${countTable(["node type", "nodes"], g.nodesByType)}</div><div>${countTable(["edge predicate", "edges"], g.edgesByPredicate)}</div></div>`,
        )
        .join("")
    : "";
  const files =
    `<h3>Files (${x.files.length})</h3><table><thead><tr><th>file</th><th>what it is</th><th>holds</th><th>bytes</th><th>open</th></tr></thead><tbody>${x.files
      .map(
        (f) =>
          `<tr><td><code>${esc(f.rel)}</code></td><td>${f.what.includes("/") ? `<code>${esc(f.what)}</code>` : esc(f.what)}</td>` +
          `<td>${f.error ? `<strong>not read</strong>: ${esc(f.error)}` : esc(f.holds ?? "")}</td><td class="num">${f.bytes.toLocaleString("en-US")}</td><td>${fileLink(d, f.rel, links)}</td></tr>`,
      )
      .join("")}</tbody></table>`;
  return `${head}${statements}${candidates}${graphs}${files}`;
}

/** `<route>/<instance>/`: one layer's L1 extractions. */
export function subjectPage(v: Pick<DeclaredVisualiser, "id" | "title">, s: Subject, all: readonly Subject[], links: Links): string {
  const title = `${v.title ?? "L1 extraction"} — ${s.name}`;
  const others = all.map((o) => (o.name === s.name ? `<li><strong>${esc(o.name)}</strong></li>` : `<li><a href="../${esc(o.name)}/">${esc(o.name)}</a></li>`)).join("");
  return page(
    title,
    `<h1>${esc(title)}</h1>\n${MARK}\n${s.directories.map((d) => directorySection(d, links)).join("\n")}\n` +
      `<h2>Every instance</h2><p><a href="../">All L1 extractions</a></p><ul>${others}</ul>`,
  );
}

/** `<route>/`: every layer holding an `l1-extraction` directory. */
export function hubPage(v: Pick<DeclaredVisualiser, "id" | "title">, all: readonly Subject[]): string {
  const title = v.title ?? "L1 extraction";
  const rows = all
    .flatMap((s) =>
      s.directories.map(
        (d) =>
          `<tr><td><a href="${esc(s.name)}/">${esc(s.name)}</a></td><td><code>${esc(d.path)}</code></td>` +
          `<td>${d.entry ? `<code>${esc(d.entry.id)}</code>` : ""}</td><td>${esc(directoryVerdict(d))}</td></tr>`,
      ),
    )
    .join("");
  const body = all.length
    ? `<table><thead><tr><th>instance</th><th>directory</th><th>library entry</th><th>holds</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<p>No instance in this checkout declares an <code>l1-extraction</code> directory.</p>`;
  return page(title, `<h1>${esc(title)}</h1>\n${MARK}\n<p>One page per instance in this checkout that declares a directory of kind <code>l1-extraction</code>.</p>\n${body}`);
}

// ── writing ────────────────────────────────────────────────────────────────

/** Every page the declared visualisers rendered by this Tool owe, absolute path → content. */
export function plannedPages(root: string, site: string): { pages: Map<string, string>; routes: string[] } {
  const pages = new Map<string, string>();
  const routes: string[] = [];
  const all = declaredVisualisers(root);
  const vis = all.filter((v) => v.renderedBy === TOOL_ID);
  if (vis.length === 0) return { pages, routes };
  const dirs = checkoutDirectories(root);
  const libraryViewer = all.find((v) => v.renderedBy === "library-viewer" && v.subgraphs === "instance");
  for (const v of vis) {
    const kinds = v.coversKinds?.length ? v.coversKinds : [KIND];
    const subjects = subjectsOf(dirs, kinds);
    const full = pageParts({ harness: v.harness, visualiser: v.id });
    const dir = visualiserPageDir(site, full);
    routes.push(dir);
    pages.set(join(dir, "index.html"), hubPage(v, subjects));
    if (v.subgraphs !== "instance") continue;
    for (const s of subjects) {
      const parts = { ...full, subgraph: s.name };
      const base = sourceBase(root, s);
      const links: Links = {
        up: siteRootFrom(parts),
        published: (d, rel) => {
          if (d.entry === undefined) return undefined;
          const p = entryGraphSitePath(s.name, d.entry.id, `${d.entry.rel}/${rel}`);
          return sitePageAt(site, p) ? p : undefined;
        },
        source: (d, rel) => (base === undefined ? undefined : `${base}${enc(`${d.path.replace(/^\.\//, "").replace(/\/+$/, "")}/${rel}`)}`),
        entryPage: (d) => {
          if (d.entry === undefined || libraryViewer === undefined) return undefined;
          const p = `${visualiserRoute(pageParts({ harness: libraryViewer.harness, visualiser: libraryViewer.id, subgraph: s.name }))}${encodeURIComponent(d.entry.id)}/`;
          return sitePageAt(site, p) ? p : undefined;
        },
        statementSource: (st) => {
          const src = st.source ?? sourceOfLocation(s.instanceRoot, st.where);
          if (!src) return undefined;
          const r = resolveSource({ id: st.id, statement: st.text, source: src }, s.instanceRoot, root);
          if (!r.ok) return undefined;
          const entry =
            libraryViewer === undefined
              ? undefined
              : `${visualiserRoute(pageParts({ harness: libraryViewer.harness, visualiser: libraryViewer.id, subgraph: s.name }))}${encodeURIComponent(src.libraryId)}/`;
          const rel = r.source.sectionPath ? relative(s.instanceRoot, join(root, r.source.sectionPath)).split(sep).join("/") : undefined;
          return {
            libraryId: src.libraryId,
            label: r.source.label,
            ...(entry && sitePageAt(site, entry) ? { entry } : {}),
            ...(rel && !rel.startsWith("..") && base !== undefined ? { section: `${base}${enc(rel)}` } : {}),
          };
        },
      };
      pages.set(join(visualiserPageDir(site, parts), "index.html"), subjectPage(v, s, subjects, links));
    }
  }
  return { pages, routes };
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return (readdirSync(dir, { recursive: true }) as string[]).map((f) => join(dir, f)).filter((p) => statSync(p).isFile());
}

function main(): number {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--root");
  const root = checkoutRootFor(resolve(at >= 0 && argv[at + 1] ? argv[at + 1]! : process.cwd()));
  const site = siteArg(argv) ?? siteOwnerDir(root);
  const check = argv.includes("--check");
  const { pages, routes } = plannedPages(root, site);
  if (routes.length === 0) {
    console.log(`${TOOL_ID}: no instance in this checkout declares a visualiser rendered by ${TOOL_ID} — nothing to write`);
    return 0;
  }
  if (check) {
    const stale = [...pages].filter(([p, html]) => !existsSync(p) || readFileSync(p, "utf-8") !== html).map(([p]) => p);
    const orphans = routes.flatMap(filesUnder).filter((p) => !pages.has(p));
    for (const p of stale) console.error(`✗ ${relative(site, p)} is stale or missing`);
    for (const p of orphans) console.error(`✗ ${relative(site, p)} is an orphan — no declared subject produces it`);
    if (stale.length || orphans.length) return 1;
    console.log(`✓ ${pages.size} ${KIND} page(s) current under ${site}`);
    return 0;
  }
  for (const r of routes) rmSync(r, { recursive: true, force: true });
  for (const [p, html] of pages) {
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, html);
  }
  console.log(`${TOOL_ID}: ${pages.size} page(s) written (${routes.map((r) => relative(site, r)).join(", ")})`);
  return 0;
}

if (import.meta.main) process.exit(main());
