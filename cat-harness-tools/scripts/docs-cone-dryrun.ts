#!/usr/bin/env bun
/**
 * The docs site's DEPENDENCY-CONE DEPLOY, as a dry run. It decides nothing
 * and skips nothing: beside the full build it says whether a cone-only deploy
 * WOULD have been chosen, and checks that choice against what the full build
 * actually changed — a cone that under-carries serves a stale page as fresh.
 * Per deploy it logs:
 *
 * 1. **eligible** — whether the cone, computed before the build, is fully
 *    determined: a readable deployed stamp to diff from, every re-pinned mount
 *    expanded, every moved branch mount diffed, and NO `undetermined` input in
 *    the docs renderer's prediction (`docs-rendered-impact.ts`). Not eligible
 *    means the real switch would fall back to the full build; the reasons are
 *    listed.
 * 2. **measured** — what the full build changed against the site it replaces
 *    (the `gh-pages` root, other previews left out), with the per-deploy
 *    stamps blanked (`DEPLOY_STAMPS`).
 * 3. **verdict** — `cone-safe` (eligible, and every measured file was
 *    predicted), `cone-unsafe` (eligible, and the build changed a file the
 *    cone did not name), or `full` (not eligible: the fallback).
 *
 * `cone-unsafe` must stay at zero before the switch is turned on; `full` with
 * a small measured set is where the cone is too cautious.
 *
 * ## The base is the DEPLOYED site, not the previous push
 *
 * The cone is computed from the commit the live site was built from (its
 * `build.json`), never from `github.event.before`, since a failed run leaves
 * the live site older than the previous push. The stamp also records the tip
 * of each branch-mounted subgraph (`state:mount`'s markers), so a bean edit is
 * an input like a code change. A stamp that records no tip makes the run
 * ineligible, never "nothing moved".
 *
 * Usage (both from the index root, after the build, before the publish):
 *   bun run cat-harness-tools/scripts/docs-cone-dryrun.ts inputs --stamp pages/build.json \
 *     --out-changed changed.txt --out-doubts doubts.json [--remote origin]
 *   bun run cat-harness-tools/scripts/docs-cone-dryrun.ts judge --before pages --after _site \
 *     [--predicted rendered-impact.json] [--sources sources.json] [--doubts doubts.json] \
 *     --out dryrun.json [--summary "$GITHUB_STEP_SUMMARY"]
 *
 * @module cat-harness-tools/scripts/docs-cone-dryrun
 * @covers none — a measurement logged beside the deploy; it gates nothing and
 * its logic is covered by `scripts/tests/docs-cone-dryrun.test.ts`
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { gunzipSync } from "node:zlib";

import {
  BUILD_STAMPS,
  comparePrediction,
  isGenericIndex,
  RenderedImpactSchema,
  type RenderedFile,
  type RenderedImpact,
} from "../schemas/ui/rendered-impact.ts";
import { BranchStore, type BranchStoreOptions, storeOptionsFor } from "./branch-store.ts";
import { PREVIEW_PREFIX_ALT } from "./lib/preview-prefix.ts";

export const DOCS_CONE_DRYRUN_TAG = "docs-cone-dryrun/v1" as const;

// ─── The base: what the live site was built from ───────────────────────────

/** `build.json` as `docs-site.yml` writes it; `mounts` since this dry run. */
export interface DeployStamp {
  sha?: string;
  /** Branch-mount key (`<instance>.<id>` or `<id>`) → the tip the deploy mounted. */
  mounts?: Record<string, string>;
}

/** `state:mount`'s marker for one branch-mounted subgraph (`<git-dir>/branch-mounts/<key>.json`). */
export interface MountMarker {
  id: string;
  /** `locationKey`: `<instance>.<id>` when a layer owns the mount (`state:mount`). */
  key?: string;
  branch: string;
  /** The checkout path declared on the directory. */
  path: string;
  /** The subtree on the branch when it differs from `path` (`source.branchPath`). */
  branchPath?: string;
  /** The `owner/repo` the branch lives in when it is not this checkout's origin (`source.repository`). */
  repository?: string;
  /** Where it is mounted in this checkout. */
  into: string;
  tip: string;
}

/** The key a branch mount is recorded under in `build.json`: its disambiguated `key` (`<instance>.<id>`), else `id`. */
export function markerKey(m: Pick<MountMarker, "id" | "key">): string {
  return m.key ?? m.id;
}

/** The `mounts` map a `build.json` stamp should record for the checkout's active branch mounts. */
export function mountsForStamp(markers: readonly Pick<MountMarker, "id" | "key" | "tip">[]): Record<string, string> {
  const idCounts = new Map<string, number>();
  for (const m of markers) idCounts.set(m.id, (idCounts.get(m.id) ?? 0) + 1);
  const out: Record<string, string> = {};
  for (const m of markers) {
    out[markerKey(m)] = m.tip;
    if ((idCounts.get(m.id) ?? 0) === 1) out[m.id] = m.tip;
  }
  return out;
}

/** Changed paths, as `staging-changes.ts expand` reads them: `status<TAB>path[<TAB>from]`. */
export interface ChangedEntry {
  status: "added" | "removed" | "modified" | "renamed";
  path: string;
  from?: string;
}

/** `git diff --name-status` lines, as REST-style statuses. */
export function nameStatus(text: string): ChangedEntry[] {
  const out: ChangedEntry[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const [code, p1, p2] = line.split("\t");
    const c = code![0];
    if (c === "R" && p2) out.push({ status: "renamed", path: p2, from: p1! });
    else if (c === "A" || (c === "C" && p2)) out.push({ status: "added", path: (p2 ?? p1)! });
    else if (c === "D") out.push({ status: "removed", path: p1! });
    else out.push({ status: "modified", path: p1! });
  }
  return out;
}

/** A branch path under the mount's subtree on the branch (`branchPath ?? path`), at its place in the checkout; undefined when outside it. */
export function intoCheckout(branchPath: string, m: Pick<MountMarker, "path" | "branchPath" | "into">): string | undefined {
  const from = (m.branchPath ?? m.path).replace(/^\/+|\/+$/g, "");
  const to = m.into.replace(/\/+$/, "");
  if (from === "" || from === ".") return `${to}/${branchPath}`;
  if (!branchPath.startsWith(`${from}/`)) return undefined;
  return `${to}/${branchPath.slice(from.length + 1)}`;
}

/**
 * `git diff --name-status` between two tips of a branch mount, read from the
 * bare `BranchStore` that `state:mount` fetched the branch into (which may
 * point at `m.repository` rather than `origin`).
 */
export function diffBranchMount(root: string, m: MountMarker, from: string, to: string, storeOpts?: BranchStoreOptions): string {
  const store = BranchStore.open(m.branch, { repoRoot: root, ...storeOptionsFor(m, root, storeOpts) });
  for (const sha of [from, to]) {
    if (store.git(["cat-file", "-e", `${sha}^{commit}`]).status === 0) continue;
    const bySha = store.git(["fetch", "-q", "--no-tags", "--depth=1", "--filter=blob:none", "origin", sha]);
    if (bySha.status !== 0 && store.git(["cat-file", "-e", `${sha}^{commit}`]).status !== 0) {
      store.must(["fetch", "-q", "--no-tags", "--filter=blob:none", "origin", `+refs/heads/${m.branch}:${store.privateRef("diff")}`]);
    }
    if (store.git(["cat-file", "-e", `${sha}^{commit}`]).status !== 0) {
      throw new Error(`commit ${sha} is not in ${m.branch}`);
    }
  }
  return store.must(["diff", "--name-status", "--no-renames", from, to]);
}

/**
 * Every input since the deployed stamp: the checkout's own diff, and each
 * moved branch mount's diff at its mount path. A doubt is said, never
 * dropped: an unreadable stamp, a mount with no recorded tip, a diff that
 * could not be read.
 */
export function collectInputs(o: {
  stamp: DeployStamp | undefined;
  head: string;
  markers: readonly MountMarker[];
  /** `git diff --name-status from to`, or throws. */
  diff: (from: string, to: string) => string;
  /** `git diff --name-status from to` for a branch mount; defaults to `diff(from, to)`. */
  diffMount?: (m: MountMarker, from: string, to: string) => string;
}): { changed: ChangedEntry[]; doubts: string[] } {
  const doubts: string[] = [];
  const changed: ChangedEntry[] = [];
  if (!o.stamp?.sha) return { changed, doubts: ["the deployed site's build.json names no commit: there is no base to compute a cone from"] };
  try {
    changed.push(...nameStatus(o.diff(o.stamp.sha, o.head)));
  } catch (e) {
    doubts.push(`the diff ${o.stamp.sha.slice(0, 7)}..${o.head.slice(0, 7)} could not be read: ${(e as Error).message.split("\n")[0]}`);
  }
  const idCounts = new Map<string, number>();
  for (const m of o.markers) idCounts.set(m.id, (idCounts.get(m.id) ?? 0) + 1);
  const diffMount = o.diffMount ?? ((_m, from, to) => o.diff(from, to));
  for (const m of o.markers) {
    const key = markerKey(m);
    const was = o.stamp.mounts?.[key] ?? ((idCounts.get(m.id) ?? 0) > 1 ? undefined : o.stamp.mounts?.[m.id]);
    if (!was) {
      doubts.push(`the deployed stamp records no tip for the branch mount '${key}' (${m.branch}): its changes since the deploy are unknown`);
      continue;
    }
    if (was === m.tip) continue;
    try {
      for (const e of nameStatus(diffMount(m, was, m.tip))) {
        const path = intoCheckout(e.path, m);
        if (path === undefined) continue;
        const from = e.from === undefined ? undefined : intoCheckout(e.from, m);
        changed.push({ status: e.status, path, ...(from ? { from } : {}) });
      }
    } catch (e) {
      doubts.push(`the branch mount '${key}' moved ${was.slice(0, 7)}..${m.tip.slice(0, 7)} and its diff could not be read: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  return { changed, doubts };
}

// ─── The measurement: the full build against the site it replaces ─────────

/**
 * Bytes every deploy rewrites on every page, which say nothing about the
 * page: the shared build stamps (`?v=<build time>`, `generatedAt`), the
 * footer's "deployed <sha> · <time>" line (`footer_custom.html`), and the
 * `staging` provenance block of each published schema and tool. Blanked, so
 * an untouched page measures as untouched. A cone deploy leaves those bytes as
 * the page's last full build wrote them: that is a fact for the switch to
 * settle (the stamp read client-side from `build.json`, as bean `g196` does
 * for previews), recorded here, not hidden.
 */
export const DEPLOY_STAMPS: ReadonlyArray<readonly [RegExp, string]> = [
  ...BUILD_STAMPS,
  [/(<p\b[^>]*\bfa-build-stamp\b[^>]*>)[\s\S]*?(<\/p>)/g, "$1$2"],
  // The build provenance every published schema and tool document carries:
  // `"staging": {"branch", "sha", "pr", "run"}` — the run that wrote it.
  [/"staging":\s*\{[^{}]*"run":[^{}]*\}/g, '"staging":{}'],
  // `jekyll-remote-theme` unpacks the theme into `/tmp/jekyll-remote-theme-YYYYMMDD-PID-RAND`
  // on each build, and Sass writes that temp directory into `.css.map` `sources`.
  [/(jekyll-remote-theme)-\d{8}-\d+-[a-z0-9]+/g, "$1"],
  // `qa:working-copy` runs live checkers on each build and stamps `"at":"<ISO>","sha":"<head>"`
  // into their witness entries, and `qa-site-assets` links the sidecars under `main/<head>`.
  [/("at":\s*)"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z"(,\s*"sha":\s*)"[0-9a-f]{40}"/g, '$1""$2""'],
  [/\bmain\/[0-9a-f]{40}\b/g, "main/<sha>"],
  // Instance graph exports (`instance-exports.ts`, `kg-export.ts`, and
  // `bootstrap-tools/scripts/export-graph.ts`) stamp the index checkout's
  // HEAD commit on every deploy even for instances whose own pin and files
  // did not move.
  [/"sourceCommit":\s*"[^"]*\/commit\/[0-9a-f]{40}"/g, '"sourceCommit":""'],
  [/"sourceCommitSha":\s*"[0-9a-f]{40}"/g, '"sourceCommitSha":""'],
  [/"sourceCommitAt":\s*"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})"/g, '"sourceCommitAt":""'],
  [/"wasDerivedFrom":\s*"git:[0-9a-f]{40}"/g, '"wasDerivedFrom":"git:"'],
  // `state-visualizer.ts` stamps the build's wall-clock `now` into each
  // workflow page's stuck-age lead and `data-wv-built` attribute.
  [/\b([Mm]easured at )\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z((?:,\s+|\s+)\(?when this page was built\)?)/g, "$1<built>$2"],
  [/(&quot;at&quot;:&quot;)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z(&quot;)/g, "$1$2"],
  // `pins.json` (`scripts/lib/pin-links.ts`) records `".": "<head-sha>"` for
  // the index checkout itself alongside each layer's pin; the index's own SHA
  // moves on every commit while layer pins only move on a re-pin.
  [/("\.":\s*)"[0-9a-f]{40}"/g, '$1""'],
  // `root-index.ts` hashes the raw bytes of each `<instance>/<stub>.jsonld`
  // (including its per-deploy `generatedAt` / `sourceCommit` / `staging` stamps)
  // into `index.json` and `index.jsonld` alongside `"nodes"`.
  [/("nodes":\s*\d+,\s*"bytes":\s*)\d+(,\s*"sha256":\s*)"[0-9a-f]{64}"/g, '$10$2""'],
  // `gen-site-viz.ts` renders the pre-deploy `gh-pages` tip SHA, `_render-log/`
  // count and `branches/` preview table into `en/cat-harness/site/index.html`.
  [/(<p class="m">Tip <code>)[0-9a-f]{12}(<\/code>[^<]*?·\s*)\d+( staging preview\(s\))/g, "$1$20$3"],
  [/(<tr><td><code>_render-log\/<\/code><\/td><td>\d+<\/td><td>)\d+(<\/td><\/tr>)/g, "$10$2"],
  [/(<table><thead><tr><th>Preview<\/th><th>Pages<\/th><th>Files<\/th><\/tr><\/thead><tbody>)[\s\S]*?(<\/tbody><\/table>)/g, "$1$2"],
  // `qa-site-assets.ts` writes `assets/qa/availability.json`, where `source`
  // (`checkout` vs `fetched`), `key` and `reason` depend on whether the
  // `qa-reports` branch already held `main/<sha>` when the deploy started,
  // while `expected` and `published` record the corpus counts that landed.
  [/("source":\s*)"(?:checkout|fetched(?:-fallback)?)"(,\s*"requested":\s*\[[^\]]*\])(?:,\s*"key":\s*"[^"]*")?(,\s*"reason":\s*)"[^"]*"/g, '$1"present"$2$3""'],
  // `ig-index:build` packs `fhir-artifact-index/package.tgz` with tar/gzip
  // (whose mtime header varies compressed size by a few bytes across runs)
  // and records that archive's byte length in `fhir-artifact-index/index.json`.
  [/("localPath":\s*"fhir-artifact-index\/package\.tgz",\s*"bytes":\s*)\d+/g, "$10"],
];

/** Files every deploy rewrites whole: compared by neither side (the writer records of bean fwtz option B among them). */
export const ALWAYS_REWRITTEN = /^(build\.json|\.nojekyll|writer-cone\/records\.json)$/;

/** On the publish root, not the main site: other previews, the render log, git. */
export const NOT_THE_MAIN_SITE = new RegExp(`^(${PREVIEW_PREFIX_ALT}|_render-log|\\.git)(/|$)`);

const SPLIT_SEARCH_INDEX = /^assets\/js\/search\/[^/]+\.json$/;
const TEXTUAL = /\.(html?|css|js|json|jsonld|xml|txt|svg|md|map)$/i;
const TARBALL = /\.(tgz|tar\.gz)$/i;

/**
 * Strip the per-build `mtime` (bytes 136..148) and header `chksum` (148..156)
 * from each 512-byte POSIX `ustar` header inside a gzipped tar archive while
 * keeping every member's name, mode, size and payload bytes intact.
 */
function untimedTar(gz: Buffer): Buffer {
  try {
    const tar = Buffer.from(gunzipSync(gz));
    if (tar.length === 0 || tar.length % 512 !== 0) return gz;
    for (let off = 0; off + 512 <= tar.length; ) {
      if (tar.subarray(off + 257, off + 262).toString("ascii") !== "ustar") {
        off += 512;
        continue;
      }
      const size = parseInt(tar.subarray(off + 124, off + 136).toString("ascii").replace(/\0.*$/, "").trim(), 8) || 0;
      tar.fill(0, off + 136, off + 156);
      off += 512 + Math.ceil(size / 512) * 512;
    }
    return tar;
  } catch {
    return gz;
  }
}

export function stampedHash(path: string, bytes: Buffer): string {
  if (TARBALL.test(path)) return createHash("sha256").update(untimedTar(bytes)).digest("hex");
  if (!TEXTUAL.test(path)) return createHash("sha256").update(bytes).digest("hex");
  let text = bytes.toString("utf-8");
  for (const [re, blank] of DEPLOY_STAMPS) text = text.replace(re, blank);
  return createHash("sha256").update(text).digest("hex");
}

function walk(root: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(root)) return out;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const rel = relative(root, p).split("\\").join("/");
      if (NOT_THE_MAIN_SITE.test(rel) || ALWAYS_REWRITTEN.test(rel)) continue;
      const st = statSync(p);
      if (st.isDirectory()) stack.push(p);
      else if (st.isFile()) out.set(rel, stampedHash(rel, readFileSync(p)));
    }
  }
  return out;
}

/** Every file the build changed against the publish root, stamps blanked. */
export function measureDeploy(before: string, after: string): RenderedFile[] {
  const a = walk(before);
  const b = walk(after);
  const role = (p: string): RenderedFile["role"] => (isGenericIndex(p) || SPLIT_SEARCH_INDEX.test(p) ? "index" : p.endsWith(".html") ? "content" : "data");
  const files: RenderedFile[] = [];
  for (const [p, h] of b) {
    const old = a.get(p);
    if (old === undefined) files.push({ path: p, change: "added", role: role(p), via: [] });
    else if (old !== h) files.push({ path: p, change: "changed", role: role(p), via: [] });
  }
  for (const p of a.keys()) if (!b.has(p)) files.push({ path: p, change: "removed", role: role(p), via: [] });
  return files.sort((x, y) => x.path.localeCompare(y.path));
}

// ─── The verdict ────────────────────────────────────────────────────────────

export type Verdict = "cone-safe" | "cone-unsafe" | "full";

export interface DryRun {
  $schema: typeof DOCS_CONE_DRYRUN_TAG;
  verdict: Verdict;
  /** Why the switch would fall back to the full build; empty when eligible. */
  fallback: string[];
  predicted: number;
  measured: number;
  /** Measured and not predicted: under an eligible cone, each is a page the switch would have served stale. */
  missed: { path: string; change: RenderedFile["change"] }[];
  /** Predicted and not measured: the cone's over-carry (cheap, but worth sharpening). */
  unconfirmed: number;
  /** Predicted Jekyll-rendered pages: a cone that names any still needs Jekyll. */
  pages: number;
}

/** Sources' re-pins that could not be expanded (`staging-changes.ts expand`). */
export interface RepinDoubts {
  repins?: { instance: string; doubt?: string; files?: unknown }[];
}

export function judge(o: {
  predicted: RenderedImpact | undefined;
  sources: RepinDoubts | undefined;
  doubts: readonly string[];
  measured: readonly RenderedFile[];
  /** No input at all since the deploy: an empty cone, not an unknown one. */
  noInputs?: boolean;
}): DryRun {
  const fallback = [...o.doubts];
  for (const r of o.sources?.repins ?? []) if (r.doubt || r.files === null) fallback.push(`re-pinned mount ${r.instance}: ${r.doubt ?? "not expanded"}`);
  if (!o.predicted && !o.noInputs) fallback.push("no docs prediction (rendered-impact.json) was written");
  for (const u of o.predicted?.undetermined ?? []) fallback.push(`${u.input}: ${u.reason}`);
  const basePredicted = o.predicted ?? RenderedImpactSchema.parse({ $schema: "rendered-impact/v1", renderer: "none", method: "cone", files: [] });
  // `search-split.ts` cuts `assets/js/search-data.json` into `assets/js/search/*.json` after Jekyll runs:
  // when the whole search index is in the cone, the scopes it splits into are covered by it.
  const hasSearchIndex = basePredicted.files.some((f) => f.path === "assets/js/search-data.json");
  const splitSearch = hasSearchIndex
    ? o.measured.filter((f) => SPLIT_SEARCH_INDEX.test(f.path)).map((f) => ({ path: f.path, change: f.change, role: "index" as const, via: ["assets/js/search-data.json"] }))
    : [];
  const predicted = splitSearch.length ? { ...basePredicted, files: [...basePredicted.files, ...splitSearch] } : basePredicted;
  const measured = RenderedImpactSchema.parse({ $schema: "rendered-impact/v1", renderer: "build-diff", method: "build-diff", files: o.measured });
  const check = comparePrediction(predicted, measured);
  const byPath = new Map(o.measured.map((f) => [f.path, f]));
  const missed = check.missed.map((p) => ({ path: p, change: byPath.get(p)!.change }));
  const verdict: Verdict = fallback.length ? "full" : missed.length ? "cone-unsafe" : "cone-safe";
  return {
    $schema: DOCS_CONE_DRYRUN_TAG,
    verdict,
    fallback,
    predicted: basePredicted.files.length,
    measured: o.measured.length,
    missed,
    unconfirmed: check.unconfirmed.length,
    pages: basePredicted.files.filter((f) => f.role === "content" && /\.html$/.test(f.path)).length,
  };
}

/** The step summary: the verdict first, then the reasons and the misses, bounded. */
export function summary(d: DryRun, head?: string, base?: string): string {
  const lines = [
    `### Dependency-cone deploy — dry run (bean \`fwtz\`)`,
    "",
    `**${d.verdict}**${base && head ? ` · ${base.slice(0, 7)}..${head.slice(0, 7)}` : ""} · predicted ${d.predicted} · measured ${d.measured} · missed ${d.missed.length} · over-carried ${d.unconfirmed} · Jekyll pages in the cone ${d.pages}`,
    "",
    d.verdict === "cone-unsafe"
      ? "The cone was fully determined and still missed files the build changed: a cone deploy would have served these stale. Nothing was skipped — the full build deployed."
      : d.verdict === "cone-safe"
        ? "A cone deploy of the predicted files would have produced this site."
        : "Not eligible: the switch would fall back to the full build, as this run did.",
  ];
  if (d.fallback.length) lines.push("", "Fallback reasons:", ...d.fallback.slice(0, 15).map((r) => `- ${r}`), ...(d.fallback.length > 15 ? [`- … ${d.fallback.length - 15} more`] : []));
  if (d.missed.length) lines.push("", "Measured, not predicted:", ...d.missed.slice(0, 25).map((m) => `- \`${m.path}\` (${m.change})`), ...(d.missed.length > 25 ? [`- … ${d.missed.length - 25} more`] : []));
  return lines.join("\n") + "\n";
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function readJson<T>(path: string | undefined): T | undefined {
  if (!path || !existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return undefined;
  }
}

/** `state:mount`'s markers in this checkout. */
export function readMarkers(root: string): MountMarker[] {
  let dir: string;
  try {
    dir = execFileSync("git", ["-C", root, "rev-parse", "--path-format=absolute", "--git-path", "branch-mounts"], { encoding: "utf-8" }).trim();
  } catch {
    return [];
  }
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".json"))
    .map((n) => readJson<MountMarker>(join(dir, n)))
    .filter((m): m is MountMarker => !!m && typeof m.tip === "string" && typeof m.id === "string");
}

if (import.meta.main) {
  const [cmd, ...argv] = process.argv.slice(2);
  const arg = (k: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const root = arg("--root") ?? ".";
  if (cmd === "inputs") {
    const remote = arg("--remote") ?? "origin";
    const git = (...a: string[]) => execFileSync("git", ["-C", root, ...a], { encoding: "utf-8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"] });
    const head = git("rev-parse", "HEAD").trim();
    const stamp = readJson<DeployStamp>(arg("--stamp"));
    const { changed, doubts } = collectInputs({
      stamp,
      head,
      markers: readMarkers(root),
      diff: (from, to) => {
        // Shallow checkouts: fetch both ends by sha, then compare the trees (two dots, no merge base needed).
        for (const sha of [from, to]) {
          try {
            git("cat-file", "-e", `${sha}^{commit}`);
          } catch {
            git("fetch", "-q", "--depth=1", "--filter=blob:none", remote, sha);
          }
        }
        return git("diff", "--name-status", "-M", "-l0", from, to);
      },
      diffMount: (m, from, to) => diffBranchMount(root, m, from, to),
    });
    const lines = changed.map((c) => [c.status, c.path, ...(c.from ? [c.from] : [])].join("\t"));
    writeFileSync(arg("--out-changed") ?? "changed.txt", lines.join("\n") + (lines.length ? "\n" : ""));
    writeFileSync(arg("--out-doubts") ?? "doubts.json", JSON.stringify({ base: stamp?.sha ?? null, head, doubts }, null, 2) + "\n");
    console.error(`docs-cone-dryrun: ${changed.length} input(s) since ${stamp?.sha?.slice(0, 7) ?? "?"}, ${doubts.length} doubt(s)`);
    for (const d of doubts) console.error(`  · ${d}`);
  } else if (cmd === "judge") {
    const [before, after, out] = [arg("--before"), arg("--after"), arg("--out")];
    if (!before || !after || !out) {
      console.error("usage: docs-cone-dryrun.ts judge --before <publish root> --after <built site> --out <json> [--predicted f] [--sources f] [--doubts f] [--summary f]");
      process.exit(2);
    }
    const buildStampPath = join(after, "build.json");
    const markers = readMarkers(root);
    if (markers.length && existsSync(buildStampPath)) {
      const existing = readJson<Record<string, unknown>>(buildStampPath);
      if (existing) {
        const prevMounts = typeof existing.mounts === "object" && existing.mounts !== null ? (existing.mounts as Record<string, string>) : {};
        writeFileSync(buildStampPath, JSON.stringify({ ...existing, mounts: { ...prevMounts, ...mountsForStamp(markers) } }, null, 2) + "\n");
      }
    }
    const raw = readJson<unknown>(arg("--predicted"));
    const predicted = raw === undefined ? undefined : RenderedImpactSchema.parse(raw);
    const d = readJson<{ base?: string | null; head?: string; doubts?: string[] }>(arg("--doubts"));
    const sources = readJson<RepinDoubts & { changes?: unknown[] }>(arg("--sources"));
    const doubts = d?.doubts ?? [`no inputs file (${arg("--doubts") ?? "--doubts not given"}): the cone's inputs are unknown`];
    const noInputs = !!d && doubts.length === 0 && (sources?.changes?.length ?? 0) === 0;
    const result = judge({ predicted, sources, doubts, measured: measureDeploy(before, after), noInputs });
    writeFileSync(out, JSON.stringify({ ...result, base: d?.base ?? null, head: d?.head ?? null }, null, 2) + "\n");
    const text = summary(result, d?.head, d?.base ?? undefined);
    process.stderr.write(text);
    const s = arg("--summary");
    if (s) appendFileSync(s, text);
  } else {
    console.error("usage: docs-cone-dryrun.ts inputs|judge …  (see the module header)");
    process.exit(2);
  }
}
