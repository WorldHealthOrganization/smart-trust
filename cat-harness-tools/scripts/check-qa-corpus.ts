#!/usr/bin/env bun
/**
 * check-qa-corpus — validate a QA results tree as a whole: every declared `qa`
 * directory and every HOSTED kg-qa home in it.
 *
 * The committed corpus lives on the `qa-reports` branch, not in a checkout, so
 * it is judged here over the tree `qa:fetch` materialises rather than by
 * tests (which would fail on absent files or pass over zero).
 *
 * ## What it walks
 *
 * The tree is laid out like the checkout (`<instance>/test/results/**`), the
 * layout every `qa-reports` entry keeps. Inside it, this walks:
 *
 * - every directory any layer DECLARES as a `qa` graph, mapped into the tree;
 * - every layer's kg-qa home as `kgQaHomeFor` resolves it — `own`,
 *   `hosted` (`cat-harness/test/results/bootstrap/`, `bootstrap-tools/`,
 *   `cat-harness-tools/`) or `convention`.
 *
 * ## What it judges
 *
 * 1. Every file is readable: no git conflict marker of any width, and every
 *    `.json` parses (`checkQaFile`, shared with `qa-graph-integrity`).
 * 2. Every `*.kg-qa.json` validates against `KgQaReportSchema`, names only
 *    registered criteria that apply to its subject kind, records no `fail`
 *    without findings, and has no CRITICAL criterion other than pass or n/a.
 * 3. Every home holding kg-qa sidecars holds a `kg-qa.manifest.json` that
 *    validates against `KgQaManifestSchema`.
 * 4. The witnesses the docs site publishes at `/assets/qa/`: every generated
 *    page's verdict index exists in the tree and holds a row for every badge
 *    on the page, every URL a badge fetches is present, and no published path
 *    is `_`-prefixed (Pages strips those without `.nojekyll`). The PAGES are
 *    this checkout's, so judge the entry of the commit you have checked out —
 *    `--github` does, and `--dir` over a `qa:fetch` of your own HEAD does.
 *
 * | exit | state | meaning |
 * |---|---|---|
 * | 0 | ok | examined at least one file, no finding |
 * | 1 | finding | a determined defect: a marker, bad JSON, a schema break, a critical criterion, a corrupt store entry |
 * | 2 | unknown | could not determine: the fetch missed or failed, or the tree held nothing to examine. **Never a pass.** |
 * | 2 | error | malformed invocation |
 *
 * `--github` (CI, the `qa-publish` job) derives the same key `qa:publish
 * --github` writes. When publishing is skipped (a fork PR, a non-main push) it
 * says so with a `::notice` and exits 0.
 *
 * Usage:
 *   bun run cat check:qa-corpus --dir <tree>      # a tree already fetched (qa:fetch --into <tree>)
 *   bun run cat check:qa-corpus --ref <ref>       # fetch main | <sha> | pr/<n>[/<sha>] into a temp dir, then judge
 *   bun run cat check:qa-corpus --github          # CI: the entry this run published
 *   ... --no-pages                            # judge the tree without this checkout's badge pages
 *
 * @module scripts/check-qa-corpus
 * @covers qa
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, type Dirent } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import { checkQaDirs } from "../pipeline/qa-graph-integrity.ts";
import { directoriesForGraph, layerRootsIn, kgQaHomeFor, repoRootFor, siteDirFor } from "../schemas/kg/cat-harness.js";
// `directoriesForGraph` reads declarations, which throw on the `folio` kind
// unless core has registered it — the same side-effect import qa-store carries.
import "../schemas/kg/folio-graph-typology.js";
import {
  criteriaFor,
  KG_CRITERIA_BY_ID,
  KgQaManifestSchema,
  KgQaReportSchema,
  type KgQaReport,
} from "../schemas/sdlc/kg-qa.ts";
import { JUDGEMENT_EXIT } from "./qa-results.ts";
import { githubPublishDecision, QaUsageError, readQaTree } from "./qa-store.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

// The HARNESS, not this layer: the script moved up in 70lx B2 and still reads cat-harness's declarations.
const HARNESS = HARNESS_ROOT;
const REPO = repoRootFor(HARNESS);

export type CorpusProblem =
  | "conflict-marker"
  | "unparseable-json"
  | "schema"
  | "unknown-criterion"
  | "fail-without-findings"
  | "critical-failing"
  | "manifest-missing"
  | "manifest-schema"
  | "witness-index-missing"
  | "witness-index-row-missing"
  | "witness-index-corpus-absent"
  | "witness-url-missing"
  | "witness-underscore-path";

export interface CorpusFinding {
  /** Tree-relative path. */
  path: string;
  problem: CorpusProblem;
  detail: string;
}

export interface CorpusHome {
  /** Tree-relative kg-qa home, e.g. `cat-harness/test/results/bootstrap`. */
  home: string;
  by: "own" | "hosted" | "convention";
  /** `*.kg-qa.json` files found under `<home>/kg-qa/`. */
  sidecars: number;
}

export interface CorpusReport {
  /** Tree-relative directories walked. */
  dirs: string[];
  homes: CorpusHome[];
  /** Files examined. `0` is not clean: it is `unknown`. */
  examined: number;
  /** Generated pages whose badges were checked against the witness tree. */
  pages: number;
  findings: CorpusFinding[];
}

/** The tree-relative directory the docs build copies to `_site/assets/qa/`. */
// declared-path-literal: the HARNESS's witness tree, named as the repo-relative key the docs build copies from. This script moved up to cat-harness-tools in 70lx B2 and reads its implementer's tree, which is the downward direction; it was an own-instance path until the move.
export const WITNESS_TREE = "cat-harness/test/results/witnesses";

/** A generated page carrying QA badges: its path (for messages) and text. */
export interface BadgePage {
  path: string;
  text: string;
}

/**
 * Every page `gen-docs-pages.ts` writes that carries a QA badge: the site
 * root and `guides/`, the only places the generator writes.
 */
export function badgePages(instance: string = HARNESS): BadgePage[] {
  const dir = join(instance, siteDirFor(instance));
  const out: BadgePage[] = [];
  const walk = (d: string, depth: number) => {
    let entries: Dirent[];
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory() && e.name === "guides" && depth === 0) walk(p, depth + 1);
      else if (e.isFile() && e.name.endsWith(".md")) {
        const text = readFileSync(p, "utf-8");
        if (text.includes("fa-qa-badge")) out.push({ path: relative(REPO, p).split("\\").join("/"), text });
      }
    }
  };
  walk(dir, 0);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * The witness half: the tree the site publishes at `/assets/qa/`, checked
 * against the pages whose badges fetch from it. A page with no badge asks
 * nothing of the tree.
 */
export function judgeWitnesses(tree: string, pages: readonly BadgePage[]): CorpusFinding[] {
  const root = resolve(tree);
  const wroot = join(root, WITNESS_TREE);
  const out: CorpusFinding[] = [];
  const exists = (p: string): boolean => existsSync(p) && statSync(p).isFile();
  for (const { path, text } of pages) {
    const slug = /assets\/qa\/([^/]+)\/qa-index\.json/.exec(text)?.[1];
    const unswept = new Set<string>();
    if (slug) {
      const idxRel = `${WITNESS_TREE}/${slug}/qa-index.json`;
      const idx = join(root, idxRel);
      if (!exists(idx)) {
        out.push({ path: idxRel, problem: "witness-index-missing", detail: `${path} paints its badges from it` });
      } else {
        let badges: Record<string, unknown> = {};
        let corpus: unknown;
        try {
          const doc = JSON.parse(readFileSync(idx, "utf-8")) as { badges?: Record<string, unknown>; unswept?: unknown; corpus?: unknown };
          badges = doc.badges ?? {};
          corpus = doc.corpus;
          // Since bean `4l4d` every badge is the same placeholder and the
          // index answers "not swept" as its own list — a key there is
          // accounted for, and has no projection to fetch.
          if (Array.isArray(doc.unswept)) for (const k of doc.unswept) if (typeof k === "string") unswept.add(k);
        } catch {
          // unparseable: already a finding of the integrity sweep
        }
        // A published entry's index must have been written WITH the corpus;
        // `absent` here means the tree was produced by a build that had none.
        if (corpus === "absent") out.push({ path: idxRel, problem: "witness-index-corpus-absent", detail: `${path} paints from an index written without the QA corpus` });
        for (const m of text.matchAll(/data-qa-key="([^"]+)"/g)) {
          if (!(m[1]! in badges) && !unswept.has(m[1]!)) out.push({ path: idxRel, problem: "witness-index-row-missing", detail: `${path}: no row for ${m[1]}` });
        }
      }
    }
    // The Liquid the generator emits, resolved the way Jekyll resolves it:
    // `relative_url` prepends the baseurl, and `assets/qa/` is the witness tree.
    // An `unswept` key's projection does not exist by definition, so its URL
    // is not asked for.
    const unsweptSrc = new Set([...unswept].map((k) => `${slug}/${k}.json`));
    const seen = new Set<string>();
    for (const m of text.matchAll(/data-qa-(?:index|src)="\{\{ '\/assets\/qa\/([^']+)' \| relative_url \}\}"/g)) {
      if (unsweptSrc.has(m[1]!)) continue;
      if (seen.has(m[1]!)) continue;
      seen.add(m[1]!);
      const target = `${WITNESS_TREE}/${m[1]}`;
      if (!exists(join(root, target))) out.push({ path: target, problem: "witness-url-missing", detail: `${path} fetches /assets/qa/${m[1]}` });
    }
  }
  // Pages strips `_`-prefixed paths without `.nojekyll`, and this tree is
  // copied into `_site` after Jekyll has run, so a strip would 404 it.
  const walk = (d: string): string[] => {
    let entries: Dirent[];
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return [];
    }
    return entries.flatMap((e) => (e.isDirectory() ? [e.name, ...walk(join(d, e.name)).map((n) => `${e.name}/${n}`)] : [e.name]));
  };
  for (const rel of walk(wroot)) {
    if (rel.split("/").some((seg) => seg.startsWith("_"))) {
      out.push({ path: `${WITNESS_TREE}/${rel}`, problem: "witness-underscore-path", detail: "GitHub Pages strips `_`-prefixed paths" });
    }
  }
  return out;
}

/** Every `*.kg-qa.json` under `dir`, recursively. */
function kgQaFilesUnder(dir: string): string[] {
  const out: string[] = [];
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...kgQaFilesUnder(p));
    else if (e.name.endsWith(".kg-qa.json")) out.push(p);
  }
  return out;
}

/**
 * The repository-relative directories to walk: every declared `qa` directory
 * and every layer's kg-qa home. Derived from THIS checkout's declarations,
 * because a fetched tree carries results, not declarations.
 */
export function corpusLayout(repoRoot: string = REPO, harness: string = join(repoRoot, "cat-harness")): {
  dirs: string[];
  homes: Array<{ home: string; by: CorpusHome["by"] }>;
} {
  const dirs = new Set<string>();
  const homes = new Map<string, CorpusHome["by"]>();
  for (const inst of layerRootsIn(repoRoot)) {
    for (const d of directoriesForGraph(inst, "qa")) dirs.add(rel(repoRoot, d));
    const h = kgQaHomeFor(inst, harness);
    const home = rel(repoRoot, h.root);
    if (!homes.has(home)) homes.set(home, h.by);
    dirs.add(home);
  }
  return {
    dirs: [...dirs].sort(),
    homes: [...homes].map(([home, by]) => ({ home, by })).sort((a, b) => a.home.localeCompare(b.home)),
  };
}

function rel(root: string, abs: string): string {
  return relative(root, resolve(abs)).split("\\").join("/");
}

/** Judge one kg-qa sidecar's content. */
export function judgeKgQa(path: string, doc: unknown): CorpusFinding[] {
  const parsed = KgQaReportSchema.safeParse(doc);
  if (!parsed.success) return [{ path, problem: "schema", detail: parsed.error.message }];
  const r = doc as KgQaReport;
  const out: CorpusFinding[] = [];
  const allowed = new Set(criteriaFor(r.subject.kind).map((c) => c.id));
  for (const [id, e] of Object.entries(r.criteria)) {
    if (!KG_CRITERIA_BY_ID[id] || !allowed.has(id)) {
      out.push({ path, problem: "unknown-criterion", detail: `${id} is not a registered criterion for ${r.subject.kind}` });
      continue;
    }
    if (e.result === "fail" && e.findings.length === 0) {
      out.push({ path, problem: "fail-without-findings", detail: `${id} is fail with no findings — a failure a reader cannot act on` });
    }
    if (e.result !== "pass" && e.result !== "n/a" && KG_CRITERIA_BY_ID[id]!.severity === "critical") {
      out.push({ path, problem: "critical-failing", detail: `${r.subject.kind}:${r.subject.id} ${id}=${e.result}` });
    }
  }
  return out;
}

/**
 * Validate a tree laid out like the checkout. `tree` is the checkout itself or
 * a directory `qa:fetch --into` wrote.
 */
export function validateQaTree(
  tree: string,
  layout: ReturnType<typeof corpusLayout> = corpusLayout(),
  pages: readonly BadgePage[] = [],
): CorpusReport {
  const root = resolve(tree);
  const integrity = checkQaDirs(layout.dirs.map((d) => join(root, d)));
  const findings: CorpusFinding[] = integrity.findings.map((f) => ({
    path: rel(root, f.path),
    problem: f.problem,
    detail: f.detail,
  }));
  const unreadable = new Set(findings.map((f) => f.path));

  const homes: CorpusHome[] = [];
  const seen = new Set<string>();
  for (const { home, by } of layout.homes) {
    const files = kgQaFilesUnder(join(root, home, "kg-qa"));
    homes.push({ home, by, sidecars: files.length });
    for (const f of files) {
      const p = rel(root, f);
      if (seen.has(p) || unreadable.has(p)) continue;
      seen.add(p);
      findings.push(...judgeKgQa(p, JSON.parse(readFileSync(f, "utf-8"))));
    }
    if (files.length === 0) continue;
    const mPath = join(home, "kg-qa.manifest.json");
    let text: string;
    try {
      text = readFileSync(join(root, mPath), "utf-8");
    } catch {
      findings.push({ path: mPath, problem: "manifest-missing", detail: `${files.length} sidecar(s) under ${home}/kg-qa/ and no auditor manifest beside them` });
      continue;
    }
    if (unreadable.has(mPath)) continue;
    const m = KgQaManifestSchema.safeParse(JSON.parse(text));
    if (!m.success) findings.push({ path: mPath, problem: "manifest-schema", detail: m.error.message });
  }
  findings.push(...judgeWitnesses(root, pages));
  findings.sort((a, b) => a.path.localeCompare(b.path) || a.problem.localeCompare(b.problem));
  return { dirs: layout.dirs, homes, examined: integrity.examined, pages: pages.length, findings };
}

/** The judgement a report earns. `examined: 0` is unknown, never ok. */
export function judgeReport(r: CorpusReport): "ok" | "finding" | "unknown" {
  if (r.findings.length) return "finding";
  return r.examined === 0 ? "unknown" : "ok";
}

/** Materialise a store entry into a fresh temp dir. Never writes into the checkout. */
function fetchInto(ref: string): { state: "hit"; dir: string; key: string } | { state: "miss" | "unknown" | "corrupt"; reason: string; bad?: string[] } {
  const t = readQaTree(ref, "");
  if (t.state !== "hit") return t;
  const dir = mkdtempSync(join(tmpdir(), "qa-corpus-"));
  for (const [p, text] of t.files) {
    const dest = join(dir, p);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, text);
  }
  return { state: "hit", dir, key: t.key };
}

function print(r: CorpusReport, from: string): void {
  console.log(`check:qa-corpus — ${from}`);
  console.log(`  ${r.dirs.length} director(ies) walked, ${r.examined} file(s) examined, ${r.pages} badge page(s) checked against ${WITNESS_TREE}`);
  for (const h of r.homes) console.log(`  ${h.by.padEnd(10)} ${h.home}/kg-qa  ${h.sidecars} sidecar(s)`);
  for (const f of r.findings) console.log(`  ✗ ${f.path} — ${f.problem}: ${f.detail}`);
}

export function main(argv: string[]): number {
  const one = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    if (i < 0) return undefined;
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new QaUsageError(`${flag} needs a value`);
    return v;
  };
  const dir = one("--dir");
  let ref = one("--ref");
  const github = argv.includes("--github");
  if ([dir, ref, github ? "x" : undefined].filter(Boolean).length !== 1) {
    throw new QaUsageError("give exactly one of --dir <tree>, --ref <ref>, --github");
  }
  // `--no-pages`: judge the tree alone, without checking this checkout's
  // generated pages against its witnesses — for another commit's entry, or a
  // fixture.
  const pages = argv.includes("--no-pages") ? [] : badgePages();

  if (dir !== undefined) {
    const r = validateQaTree(dir, corpusLayout(), pages);
    print(r, `tree ${dir}`);
    return finish(r);
  }

  if (github) {
    let event: unknown;
    try {
      event = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf-8")) : undefined;
    } catch {
      event = undefined;
    }
    const d = githubPublishDecision(process.env, event);
    if (!d.publish) {
      // The publish made the same decision and said so; there is no entry
      // for this run to judge. Stated, never silent.
      console.log(`::notice title=check:qa-corpus skipped::no qa-reports entry for this run — ${d.reason}`);
      return 0;
    }
    ref = d.ref;
  }

  const f = fetchInto(ref!);
  if (f.state === "corrupt") {
    // A determined defect in the stored record: present and unusable.
    console.log(`check:qa-corpus — qa-reports ${ref}: CORRUPT — ${f.reason}`);
    for (const b of f.bad ?? []) console.log(`  ✗ ${b} — unparseable-json`);
    return JUDGEMENT_EXIT.finding;
  }
  if (f.state !== "hit") {
    console.log(`? check:qa-corpus — qa-reports ${ref}: ${f.state.toUpperCase()} — ${f.reason}`);
    console.log("  Could not determine. A miss is not a clean corpus. Exit 2.");
    return JUDGEMENT_EXIT.unknown;
  }
  try {
    const r = validateQaTree(f.dir, corpusLayout(), pages);
    print(r, `qa-reports ${f.key}`);
    return finish(r);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
}

function finish(r: CorpusReport): number {
  const j = judgeReport(r);
  if (j === "unknown") console.log("? nothing examined — an empty tree is not a clean corpus. Exit 2.");
  else if (j === "ok") console.log(`✓ ${r.examined} file(s) readable; every kg-qa sidecar and manifest validates`);
  else console.log(`✗ ${r.findings.length} finding(s)`);
  return JUDGEMENT_EXIT[j];
}

if (import.meta.main) {
  let code: number;
  try {
    code = main(process.argv.slice(2));
  } catch (e) {
    if (e instanceof QaUsageError) {
      console.error(`check:qa-corpus: ${e.message}`);
      code = JUDGEMENT_EXIT.error;
    } else {
      console.error(`check:qa-corpus: could not determine — ${(e as Error).message}. This is NOT a pass.`);
      code = JUDGEMENT_EXIT.unknown;
    }
  }
  process.exit(code);
}
