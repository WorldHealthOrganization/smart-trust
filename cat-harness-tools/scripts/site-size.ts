#!/usr/bin/env bun
/**
 * site-size — what a built site weighs, where the weight is, and how it
 * compares with the site that is published now.
 *
 * @module scripts/site-size
 * @covers none — a REPORT on a built site: it measures and warns, and judges nothing
 *
 * ```sh
 * bun run cat site:size --site <built site dir> [--lock index.lock.json] [--self <instance>]
 *     [--against-ref origin/gh-pages [--repo <checkout>]] [--against-report <site-size.json>]
 *     [--exclude <prefix/>]... [--budget-pct 10] [--budget-mb 10] [--top 15] [--out site-size.json] [--json]
 * ```
 *
 * ## Why this exists
 *
 * Owner, 2026-11-10: *"add size review as part of authoring process"*. An IG's
 * Pages site had grown to 216 MB and was brought back to about 25 MB by hand,
 * by measuring it by folder and file type and finding what did not belong:
 * copies of other layers' pages, the same file published in several places,
 * vendored libraries the shared-assets host (`site.sharedAssets`,
 * `lib/shared-assets.ts`) already serves, and source maps. This report does
 * that measurement on every build, so the size does not creep back.
 *
 * ## What it prints
 *
 * The total; the biggest directories (one and two levels down); the size by
 * file extension; the biggest files; byte-identical files published more than
 * once (hashed, grouped, with the bytes the extra copies cost); every `.map`
 * file; the directories named after ANOTHER layer, the instance list read
 * from `index.lock.json` rather than spelled here; and the directories the
 * shared-assets host could serve but the site still carries.
 *
 * ## The comparison, and the budget
 *
 * Against the published tree (`git ls-tree -r -l <ref>`, no checkout and no
 * blob read), a published tree already laid out on disk, or an earlier
 * report's JSON. The budget is ADVISORY (owner, 2026-11-10: a soft warning,
 * not a gate): growth over `--budget-pct` percent or `--budget-mb` megabytes
 * of the published total is said as a warning, and the exit code stays 0.
 * Exit 2 when the site directory is absent: nothing was measured.
 *
 * The report is written BESIDE the build (`site-size.json` in the build's
 * output directory), never into the published site.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, posix } from "node:path";
import { PREVIEW_PREFIXES } from "./lib/preview-prefix.ts";
import { sharedDirsIn } from "./lib/shared-assets.ts";

export const SITE_SIZE_SCHEMA = "site-size/v1";
/** The report's file name, written beside the build, never inside the site. */
export const SITE_SIZE_FILE = "site-size.json";
export const DEFAULT_TOP = 15;
/** The advisory budget: growth over either bound is warned about. */
export const DEFAULT_BUDGET = { pct: 10, mb: 10 } as const;
/**
 * Root entries the published branch carries that are not the site itself:
 * the previews (`branches/`, the legacy `STAGING/`), the render log, `PC/`.
 */
export const DEFAULT_EXCLUDE: readonly string[] = [...PREVIEW_PREFIXES.map((p) => `${p}/`), "_render-log/", "PC/"];

const MB = 1024 * 1024;

export interface SizeRow {
  path: string;
  bytes: number;
  files: number;
}

export interface DuplicateGroup {
  sha256: string;
  /** The size of ONE copy. */
  bytes: number;
  copies: number;
  /** What the extra copies cost: `bytes × (copies − 1)`. */
  wasted: number;
  paths: string[];
}

export interface SiteSizeReport {
  $schema: typeof SITE_SIZE_SCHEMA;
  site: string;
  generatedAt: string;
  total: { bytes: number; files: number };
  /** Every top-level directory (files at the root are under `.`), largest first. */
  topDirs: SizeRow[];
  /** The largest directories two levels down. */
  subDirs: SizeRow[];
  /** Size by file extension (`(none)` for a file without one), largest first. */
  byExt: SizeRow[];
  biggest: { path: string; bytes: number }[];
  duplicates: { groups: DuplicateGroup[]; wasted: number; files: number };
  sourceMaps: { files: { path: string; bytes: number }[]; bytes: number };
  /** Directories named after another layer of the lock: the outermost one on each path. */
  otherLayers: (SizeRow & { instance: string })[];
  /** Directories the shared-assets host could serve that the site still carries. */
  shareable: SizeRow[];
  comparison?: SizeComparison;
}

/** What a report is compared with: the published tree, or an earlier report. */
export interface SizeBaseline {
  source: string;
  total: { bytes: number; files: number };
  topDirs: Record<string, number>;
  byExt: Record<string, number>;
}

export interface SizeComparison {
  against: string;
  before: { bytes: number; files: number };
  after: { bytes: number; files: number };
  deltaBytes: number;
  /** Undefined when the baseline is empty. */
  deltaPct?: number;
  /** Top-level directories whose size changed most, either way. */
  dirs: { path: string; before: number; after: number; delta: number }[];
  byExt: { ext: string; before: number; after: number; delta: number }[];
  budget: { pct: number; mb: number };
  /** Advisory: said, never a failure. */
  warnings: string[];
}

interface FileEntry {
  path: string;
  bytes: number;
}

/** Every regular file under `dir`, relative and `/`-separated; `.git` and symbolic links are skipped. */
export function listFiles(dir: string): FileEntry[] {
  const out: FileEntry[] = [];
  const walk = (abs: string, rel: string): void => {
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.name === ".git") continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(abs, e.name), r);
      else if (e.isFile()) out.push({ path: r, bytes: statSync(join(abs, e.name)).size });
    }
  };
  walk(dir, "");
  return out;
}

const extOf = (p: string): string => extname(p).toLowerCase() || "(none)";
const topOf = (p: string): string => (p.includes("/") ? p.slice(0, p.indexOf("/")) : ".");

function rows(m: Map<string, { bytes: number; files: number }>): SizeRow[] {
  return [...m].map(([path, v]) => ({ path, ...v })).sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));
}

function add(m: Map<string, { bytes: number; files: number }>, k: string, bytes: number): void {
  const v = m.get(k) ?? { bytes: 0, files: 0 };
  v.bytes += bytes;
  v.files += 1;
  m.set(k, v);
}

/**
 * The layer names a lock lists: each instance's name and the last segment of
 * its mount path. Empty when the lock is absent or unreadable.
 */
export function lockInstances(lockPath: string | undefined): string[] {
  if (!lockPath || !existsSync(lockPath)) return [];
  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf-8")) as { instances?: { instance?: unknown; path?: unknown }[] };
    const names = new Set<string>();
    for (const i of lock.instances ?? []) {
      if (typeof i.instance === "string" && i.instance) names.add(i.instance);
      if (typeof i.path === "string" && i.path) names.add(posix.basename(i.path));
    }
    return [...names].sort();
  } catch {
    return [];
  }
}

/**
 * The outermost directory on `path`, within its first three segments, named
 * after one of `layers`; undefined when there is none. The file's own name
 * never counts: only a directory holds another layer's pages.
 */
export function otherLayerDir(path: string, layers: ReadonlySet<string>): { dir: string; instance: string } | undefined {
  const seg = path.split("/");
  for (let i = 0; i < Math.min(3, seg.length - 1); i++) if (layers.has(seg[i]!)) return { dir: seg.slice(0, i + 1).join("/"), instance: seg[i]! };
  return undefined;
}

function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

export interface MeasureOptions {
  /** The instance list: a path to `index.lock.json`. */
  lock?: string;
  /** Layers that are this site's own and never "another layer", besides what the lock leaves out. */
  self?: readonly string[];
  top?: number;
  /** Clock, for tests. */
  now?: () => Date;
}

/** Measure a built site. Reads every file; hashes only files whose size another file shares. */
export function measureSite(site: string, o: MeasureOptions = {}): SiteSizeReport {
  const top = o.top ?? DEFAULT_TOP;
  const files = listFiles(site);
  const topDirs = new Map<string, { bytes: number; files: number }>();
  const subDirs = new Map<string, { bytes: number; files: number }>();
  const byExt = new Map<string, { bytes: number; files: number }>();
  const others = new Map<string, { bytes: number; files: number; instance: string }>();
  const self = new Set(o.self ?? []);
  const layers = new Set(lockInstances(o.lock).filter((n) => !self.has(n)));
  let total = 0;
  for (const f of files) {
    total += f.bytes;
    add(topDirs, topOf(f.path), f.bytes);
    const seg = f.path.split("/");
    if (seg.length > 2) add(subDirs, `${seg[0]}/${seg[1]}`, f.bytes);
    add(byExt, extOf(f.path), f.bytes);
    const o2 = otherLayerDir(f.path, layers);
    if (o2) {
      const v = others.get(o2.dir) ?? { bytes: 0, files: 0, instance: o2.instance };
      v.bytes += f.bytes;
      v.files += 1;
      others.set(o2.dir, v);
    }
  }

  // Duplicates: only files whose size collides are hashed. Empty files are not duplicates of anything worth saying.
  const bySize = new Map<number, FileEntry[]>();
  for (const f of files) if (f.bytes > 0) (bySize.get(f.bytes) ?? bySize.set(f.bytes, []).get(f.bytes)!).push(f);
  const groups: DuplicateGroup[] = [];
  for (const same of bySize.values()) {
    if (same.length < 2) continue;
    const byHash = new Map<string, string[]>();
    for (const f of same) {
      const h = sha256(join(site, f.path));
      (byHash.get(h) ?? byHash.set(h, []).get(h)!).push(f.path);
    }
    for (const [h, paths] of byHash) {
      if (paths.length < 2) continue;
      const bytes = same[0]!.bytes;
      groups.push({ sha256: h, bytes, copies: paths.length, wasted: bytes * (paths.length - 1), paths: paths.sort() });
    }
  }
  groups.sort((a, b) => b.wasted - a.wasted || a.paths[0]!.localeCompare(b.paths[0]!));

  const maps = files.filter((f) => f.path.toLowerCase().endsWith(".map")).sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));
  const sizeUnder = (prefix: string): SizeRow => {
    const under = files.filter((f) => f.path.startsWith(prefix));
    return { path: prefix, bytes: under.reduce((s, f) => s + f.bytes, 0), files: under.length };
  };

  return {
    $schema: SITE_SIZE_SCHEMA,
    site,
    generatedAt: (o.now ?? (() => new Date()))().toISOString(),
    total: { bytes: total, files: files.length },
    topDirs: rows(topDirs),
    subDirs: rows(subDirs).slice(0, top),
    byExt: rows(byExt),
    biggest: [...files].sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path)).slice(0, top),
    duplicates: { groups, wasted: groups.reduce((s, g) => s + g.wasted, 0), files: groups.reduce((s, g) => s + g.copies, 0) },
    sourceMaps: { files: maps, bytes: maps.reduce((s, f) => s + f.bytes, 0) },
    otherLayers: [...others].map(([path, v]) => ({ path, ...v })).sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path)),
    shareable: sharedDirsIn(site).map(sizeUnder).filter((r) => r.files > 0).sort((a, b) => b.bytes - a.bytes),
  };
}

// ── Baselines ───────────────────────────────────────────────────────────────

const excluded = (p: string, exclude: readonly string[]): boolean => exclude.some((e) => p === e.replace(/\/$/, "") || p.startsWith(e.endsWith("/") ? e : `${e}/`));

function baselineOf(source: string, files: Iterable<FileEntry>, exclude: readonly string[]): SizeBaseline {
  const b: SizeBaseline = { source, total: { bytes: 0, files: 0 }, topDirs: {}, byExt: {} };
  for (const f of files) {
    if (excluded(f.path, exclude)) continue;
    b.total.bytes += f.bytes;
    b.total.files += 1;
    b.topDirs[topOf(f.path)] = (b.topDirs[topOf(f.path)] ?? 0) + f.bytes;
    b.byExt[extOf(f.path)] = (b.byExt[extOf(f.path)] ?? 0) + f.bytes;
  }
  return b;
}

/**
 * Parse `git ls-tree -r -l` output: `<mode> <type> <sha> <size>\t<path>`.
 * Only blobs count; a submodule (`commit`) or a size of `-` is skipped.
 * A quoted path (git's C-style quoting) is unquoted for the common escapes.
 */
export function parseLsTree(text: string): FileEntry[] {
  const out: FileEntry[] = [];
  for (const line of text.split("\n")) {
    const m = /^\d+ blob [0-9a-f]+\s+(\d+)\t(.+)$/.exec(line);
    if (!m) continue;
    let p = m[2]!;
    if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1).replace(/\\(["\\])/g, "$1").replace(/\\t/g, "\t").replace(/\\n/g, "\n");
    out.push({ path: p, bytes: Number(m[1]) });
  }
  return out;
}

export function baselineFromLsTree(text: string, source: string, exclude: readonly string[] = DEFAULT_EXCLUDE): SizeBaseline {
  return baselineOf(source, parseLsTree(text), exclude);
}

/**
 * The published tree at `ref` in `repo`, read with `git ls-tree -r -l` (no
 * checkout, no fetch). Undefined when the ref is not there; fetch it first
 * (`git fetch origin gh-pages`) for a current comparison.
 */
export function baselineFromGit(repo: string, ref: string, exclude: readonly string[] = DEFAULT_EXCLUDE): SizeBaseline | undefined {
  const r = spawnSync("git", ["-C", repo, "ls-tree", "-r", "-l", ref], { encoding: "utf-8", maxBuffer: 512 * MB });
  if (r.status !== 0) return undefined;
  const when = spawnSync("git", ["-C", repo, "log", "-1", "--format=%h %cs", ref], { encoding: "utf-8" });
  return baselineFromLsTree(r.stdout, `${ref}${when.status === 0 && when.stdout.trim() ? ` (${when.stdout.trim()})` : ""}`, exclude);
}

/** A published tree already laid out on disk (the parity guard's copy of the root). */
export function baselineFromDir(dir: string, source: string, exclude: readonly string[] = DEFAULT_EXCLUDE): SizeBaseline {
  return baselineOf(source, listFiles(dir), exclude);
}

/** An earlier report. Undefined when the file is absent or not a report. */
export function baselineFromReport(file: string): SizeBaseline | undefined {
  if (!existsSync(file)) return undefined;
  try {
    const r = JSON.parse(readFileSync(file, "utf-8")) as SiteSizeReport;
    if (r.$schema !== SITE_SIZE_SCHEMA) return undefined;
    return {
      source: `${file} (${r.generatedAt})`,
      total: r.total,
      topDirs: Object.fromEntries(r.topDirs.map((d) => [d.path, d.bytes])),
      byExt: Object.fromEntries(r.byExt.map((d) => [d.path, d.bytes])),
    };
  } catch {
    return undefined;
  }
}

function deltas(before: Record<string, number>, after: Record<string, number>, top: number): { key: string; before: number; after: number; delta: number }[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .map((key) => ({ key, before: before[key] ?? 0, after: after[key] ?? 0, delta: (after[key] ?? 0) - (before[key] ?? 0) }))
    .filter((d) => d.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.key.localeCompare(b.key))
    .slice(0, top);
}

/** Compare a report with a baseline, and say (never refuse) growth over the budget. */
export function compareSize(r: SiteSizeReport, b: SizeBaseline, budget: { pct: number; mb: number } = DEFAULT_BUDGET, top = DEFAULT_TOP): SizeComparison {
  const deltaBytes = r.total.bytes - b.total.bytes;
  const deltaPct = b.total.bytes > 0 ? (deltaBytes / b.total.bytes) * 100 : undefined;
  const warnings: string[] = [];
  const over = [
    ...(deltaPct !== undefined && deltaPct > budget.pct ? [`${deltaPct.toFixed(1)}% > ${budget.pct}%`] : []),
    ...(deltaBytes > budget.mb * MB ? [`${mb(deltaBytes)} > ${budget.mb} MB`] : []),
  ];
  if (over.length) warnings.push(`the site grew ${mb(deltaBytes)} over ${b.source} (${over.join("; ")}): review it before publishing (advisory)`);
  if (r.sourceMaps.files.length) warnings.push(`${r.sourceMaps.files.length} source map(s), ${mb(r.sourceMaps.bytes)}: a published site carries none`);
  if (r.otherLayers.length) warnings.push(`${r.otherLayers.length} director(ies) named after another layer, ${mb(r.otherLayers.reduce((s, d) => s + d.bytes, 0))}: link that layer's own site rather than copy it`);
  return {
    against: b.source,
    before: b.total,
    after: r.total,
    deltaBytes,
    ...(deltaPct !== undefined ? { deltaPct } : {}),
    dirs: deltas(b.topDirs, Object.fromEntries(r.topDirs.map((d) => [d.path, d.bytes])), top).map(({ key, ...d }) => ({ path: key, ...d })),
    byExt: deltas(b.byExt, Object.fromEntries(r.byExt.map((d) => [d.path, d.bytes])), top).map(({ key, ...d }) => ({ ext: key, ...d })),
    budget,
    warnings,
  };
}

// ── Text ────────────────────────────────────────────────────────────────────

export function mb(bytes: number): string {
  const sign = bytes < 0 ? "-" : "";
  const a = Math.abs(bytes);
  return a >= MB ? `${sign}${(a / MB).toFixed(1)} MB` : `${sign}${(a / 1024).toFixed(1)} KB`;
}

const signed = (n: number): string => (n > 0 ? `+${mb(n)}` : mb(n));
const pct = (part: number, whole: number): string => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "-");

/** The report as lines, the shape every build prints. */
export function formatReport(r: SiteSizeReport, top = DEFAULT_TOP): string[] {
  const t = r.total.bytes;
  const out = [`size: ${mb(t)} in ${r.total.files} files (${r.site})`];
  const table = (title: string, list: { path: string; bytes: number; files?: number }[]): void => {
    if (!list.length) return;
    out.push(`size: ${title}`);
    for (const x of list.slice(0, top)) out.push(`  ${mb(x.bytes).padStart(10)}  ${pct(x.bytes, t).padStart(6)}  ${x.files !== undefined ? `${String(x.files).padStart(6)} files  ` : ""}${x.path}`);
  };
  table("top directories", r.topDirs);
  table("directories two levels down", r.subDirs);
  table("by extension", r.byExt);
  table("biggest files", r.biggest);
  if (r.duplicates.groups.length) {
    out.push(`size: byte-identical files: ${r.duplicates.groups.length} group(s), ${r.duplicates.files} files, ${mb(r.duplicates.wasted)} in the extra copies`);
    for (const g of r.duplicates.groups.slice(0, top)) out.push(`  ${mb(g.wasted).padStart(10)}  ${g.copies}× ${mb(g.bytes)}  ${g.paths.slice(0, 3).join("  ")}${g.paths.length > 3 ? `  … ${g.paths.length - 3} more` : ""}`);
  } else out.push("size: byte-identical files: none");
  if (r.sourceMaps.files.length) table(`source maps: ${r.sourceMaps.files.length} file(s), ${mb(r.sourceMaps.bytes)}`, r.sourceMaps.files);
  else out.push("size: source maps: none");
  if (r.otherLayers.length) table("directories named after another layer (index.lock.json)", r.otherLayers.map((d) => ({ ...d, path: `${d.path}/  (${d.instance})` })));
  else out.push("size: directories named after another layer: none");
  if (r.shareable.length) table("carried here, but the shared-assets host could serve them (site.sharedAssets)", r.shareable);
  const c = r.comparison;
  if (c) {
    out.push(`size: against ${c.against}: ${mb(c.before.bytes)} → ${mb(c.after.bytes)} (${signed(c.deltaBytes)}${c.deltaPct !== undefined ? `, ${c.deltaPct >= 0 ? "+" : ""}${c.deltaPct.toFixed(1)}%` : ""}); files ${c.before.files} → ${c.after.files}`);
    for (const d of c.dirs) out.push(`  ${signed(d.delta).padStart(10)}  ${d.path}  (${mb(d.before)} → ${mb(d.after)})`);
    if (c.byExt.length) out.push(`  by extension: ${c.byExt.map((d) => `${d.ext} ${signed(d.delta)}`).join(", ")}`);
    out.push(`size: budget (advisory): +${c.budget.pct}% or +${c.budget.mb} MB over the published site`);
  } else out.push("size: no published site or earlier report to compare with");
  for (const w of c?.warnings ?? []) out.push(`size: ⚠ ${w}`);
  return out;
}

// ── The build step ──────────────────────────────────────────────────────────

export interface SizeReviewOptions {
  site: string;
  /** Where the report goes: beside the build, never inside `site`. */
  out: string;
  /** The checkout: its `index.lock.json` and its `ref`. */
  repo: string;
  self?: readonly string[];
  /** A published tree already on disk; preferred over `ref`. */
  againstDir?: string;
  /** Default `origin/gh-pages`, read locally (never fetched here). */
  ref?: string;
  exclude?: readonly string[];
  budget?: { pct: number; mb: number };
  log: (line: string) => void;
}

/**
 * The size review every local or preview build runs: measure, compare with
 * the published tree (on disk, else the local `origin/gh-pages`, else the
 * last report at `out`), print, and write the report to `out`. Never throws:
 * a size review that cannot run says so and the build goes on.
 */
export function reviewSiteSize(o: SizeReviewOptions): SiteSizeReport | undefined {
  try {
    if (!existsSync(o.site)) {
      o.log(`size: ${o.site} is not there; nothing measured`);
      return undefined;
    }
    const exclude = o.exclude ?? DEFAULT_EXCLUDE;
    const lock = join(o.repo, "index.lock.json");
    const r = measureSite(o.site, { lock, ...(o.self ? { self: o.self } : {}) });
    const b =
      (o.againstDir && existsSync(o.againstDir) ? baselineFromDir(o.againstDir, "the published root", exclude) : undefined) ??
      baselineFromGit(o.repo, o.ref ?? "origin/gh-pages", exclude) ??
      baselineFromReport(o.out);
    if (b) r.comparison = compareSize(r, b, o.budget ?? DEFAULT_BUDGET);
    for (const l of formatReport(r)) o.log(l);
    writeFileSync(o.out, JSON.stringify(r, null, 1) + "\n");
    o.log(`size: report → ${o.out} (beside the build, not published)`);
    return r;
  } catch (e) {
    o.log(`size: could not measure the site (${(e as Error).message}); the build goes on`);
    return undefined;
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const a = process.argv.slice(2);
  const one = (k: string): string | undefined => {
    const i = a.indexOf(k);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const many = (k: string): string[] => a.flatMap((x, i) => (x === k && a[i + 1] !== undefined ? [a[i + 1]!] : []));
  const site = one("--site");
  if (!site) {
    console.error(
      "usage: site-size.ts --site <dir> [--lock index.lock.json] [--self <instance>]... [--against-ref <ref> [--repo <checkout>]]\n" +
        "         [--against-report <site-size.json>] [--exclude <prefix/>]... [--budget-pct N] [--budget-mb N] [--top N] [--out <file>] [--json]",
    );
    process.exit(2);
  }
  if (!existsSync(site) || !statSync(site).isDirectory()) {
    console.error(`site-size: ${site} is not a directory; nothing measured`);
    process.exit(2);
  }
  const top = Number(one("--top") ?? DEFAULT_TOP);
  const exclude = many("--exclude").length ? many("--exclude") : DEFAULT_EXCLUDE;
  const budget = { pct: Number(one("--budget-pct") ?? DEFAULT_BUDGET.pct), mb: Number(one("--budget-mb") ?? DEFAULT_BUDGET.mb) };
  const r = measureSite(site, { lock: one("--lock") ?? (existsSync("index.lock.json") ? "index.lock.json" : undefined), self: many("--self"), top });
  const ref = one("--against-ref");
  const report = one("--against-report");
  const b = ref ? baselineFromGit(one("--repo") ?? ".", ref, exclude) : report ? baselineFromReport(report) : undefined;
  if (ref && !b) console.error(`site-size: ${ref} could not be read with git ls-tree; no comparison (fetch it first)`);
  if (report && !b) console.error(`site-size: ${report} is not a ${SITE_SIZE_SCHEMA} report; no comparison`);
  if (b) r.comparison = compareSize(r, b, budget, top);
  const out = one("--out");
  if (out) writeFileSync(out, JSON.stringify(r, null, 1) + "\n");
  if (a.includes("--json")) console.log(JSON.stringify(r, null, 1));
  else for (const l of formatReport(r, top)) console.log(l);
}
