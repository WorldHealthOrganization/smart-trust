#!/usr/bin/env bun
/**
 * qa-site-assets — the QA evidence a site build publishes, fetched from the
 * `qa-reports` branch and checked after it is copied, so the build knows what
 * it should have published and never passes a smaller set off as the whole.
 *
 * 1. **`fetch`**, before the docs generator. Reads the entry for this build's
 *    ref (`main/<sha>`, `pr/<n>/<sha>`) — and optional fallbacks — from
 *    `qa-reports` into a scratch directory, never into the checkout. Then:
 *    - an exact `main/<sha>` hit (index 0) holding a corpus: source `fetched`,
 *      materialised into the checkout's `test/results/` paths even when the
 *      checkout still holds a committed corpus, because `main/<sha>` is
 *      evidence about the exact tree being built;
 *    - otherwise, the checkout already holds the corpus: source `checkout`,
 *      and the expected counts are the checkout's;
 *    - it does not, and the fetch hit: the entry is MATERIALISED into the
 *      checkout's `test/results/` paths (`fetched`, or `fetched-fallback` when
 *      only a fallback ref hit — another commit's evidence, labelled as such);
 *    - neither: source `unavailable`. Stated, in the run log and in the
 *      published site — never a smaller set passed off as the whole.
 *    The state, with the counts the build must publish, goes to `--state`.
 * 2. **`verify`**, after the copy. Counts what landed in `_site/assets/qa/`
 *    against what the source held at fetch time, FAILS on a shortfall, and
 *    writes `_site/assets/qa/availability.json` saying which source the
 *    evidence came from — so the published site carries the answer too.
 *
 * ## Why the checkout wins on PR previews
 *
 * A PR's entry is published from the pull request's MERGE checkout, while a
 * staging preview builds the head, so the head's committed results describe
 * the tree the preview shows. On a `main` build an exact `main/<sha>` hit is
 * evidence about the very tree being built, so it wins over the checkout.
 *
 * ## A miss is never clean
 *
 * `unavailable` exits 0 by default — a docs deploy racing the job that
 * publishes its QA must not fail the site — but it is said three ways: a
 * `::warning` in the run, `availability.json` in the site, and the docs
 * generator's own "not available in this build" badges and `unknown` QA tile
 * (`qaCorpusAvailability`). `--require` makes it exit 1 for a caller that would
 * rather fail.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/qa-site-assets.ts fetch --ref <ref> [--fallback <ref>]... \
 *       --results <dir> [--state FILE] [--require]
 *   bun run cat-harness-tools/scripts/qa-site-assets.ts verify --site <dir> --results <dir> [--state FILE]
 *   bun run cat-harness-tools/scripts/qa-site-assets.ts tree-commits --site <dir> [--max N]
 *
 * 3. **`tree-commits`**, beside the copy. Writes `_site/assets/qa/tree-commits.json`:
 *    for each tree on main's own line of history (`git log --first-parent`,
 *    the newest `--max` commits, default 2000), the OLDEST commit carrying it,
 *    i.e. where that exact content first landed. QA verdicts record the tree
 *    they reviewed, not HEAD's commit (folio-assistant bean 69lr; owner card
 *    Q4, 2026-11-05: "the tree is the identity"), and the panel links a
 *    verdict's tree to that commit through this index (owner card Q5,
 *    2026-11-05, option 1: a separate index). Separate, because putting the
 *    commit into each witness would make the published pages depend on
 *    history again, so a PR run's pages could not be reused on main. A tree
 *    not in the history read (a shallow checkout, or a PR-only tree) is
 *    simply absent: the panel then shows the tree without a link. `repo` is
 *    the GitHub URL of `origin`, or `null` when there is none, so no link is
 *    built for another forge.
 *
 * Exit: 0 ok (or `unavailable`, stated) · 1 a shortfall, or `unavailable` under
 * `--require` · 2 usage, or `verify` with no fetch state to judge against.
 *
 * @module scripts/qa-site-assets
 * @covers qa
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { fetchQa, parseQaRef, QaUsageError } from "./qa-store.ts";
import { siteFetchStatePath } from "./qa-result-link.ts";
import { detectRepoUrl } from "../src/core/git-refs.ts";

export const AVAILABILITY_SCHEMA = "folio-qa-availability/v1" as const;
export const STATE_SCHEMA = "folio-qa-fetch-state/v1" as const;
/** The file `verify` writes beside the evidence it checked. */
export const AVAILABILITY_FILE = "availability.json";
/** The results subdirectory the docs generator writes witness projections into. */
export const WITNESS_SUBDIR = "witnesses";
const RESULT_SUFFIX = ".qa-results.json";
/** The tree-to-commit index `tree-commits` writes beside the evidence. */
export const TREE_COMMITS_FILE = "tree-commits.json";
export const TREE_COMMITS_SCHEMA = "folio-qa-tree-commits/v1" as const;
/** How many first-parent commits `tree-commits` reads by default. */
export const TREE_COMMITS_MAX = 2000;

export type QaSource = "checkout" | "fetched" | "fetched-fallback" | "unavailable";

/** What one results tree holds, in the two shapes the site publishes. */
export interface QaAssetCounts {
  /** `*.json` anywhere under `<results>/witnesses/`. */
  witnesses: number;
  /** `<results>/*.qa-results.json`, top level only — what the copy step takes. */
  results: number;
  /** Every file under `<results>/`, for the "is the corpus here at all" question. */
  files: number;
}

export interface QaFetchState {
  $schema: typeof STATE_SCHEMA;
  source: QaSource;
  /** The refs asked for, in order. */
  requested: string[];
  /** The store key that hit, when one did. */
  key?: string;
  reason: string;
  /** What the build must publish — the source's counts at fetch time. */
  expected: QaAssetCounts;
  /** Each attempt, so a miss says which refs missed and why. */
  attempts: Array<{ ref: string; state: string; reason?: string }>;
}

export interface QaAvailability {
  $schema: typeof AVAILABILITY_SCHEMA;
  source: QaSource;
  requested: string[];
  key?: string;
  reason: string;
  expected: Pick<QaAssetCounts, "witnesses" | "results">;
  published: Pick<QaAssetCounts, "witnesses" | "results">;
}

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/**
 * The verdict families whose presence means "the corpus is here". NOT "any
 * file": a build writes a few results itself (`kg-export` writes
 * `kg-export.qa-results.json` during the site build), and counting those as a
 * corpus is exactly the C10 shape — measured here, when a preview run left that
 * one file behind and the next fetch called the checkout's corpus present.
 */
export const CORPUS_FAMILIES = ["kg-qa", "block-qa", "translation-qa"] as const;

/** Does this results tree hold a verdict corpus (any family), as opposed to a build's own leftovers? */
export function holdsCorpus(resultsDir: string): boolean {
  return CORPUS_FAMILIES.some((f) => existsSync(join(resultsDir, f)));
}

/** Count a results tree. An absent tree is all zeros — the caller decides what that means. */
export function countResults(resultsDir: string): QaAssetCounts {
  const files = walkFiles(resultsDir);
  const witnesses = walkFiles(join(resultsDir, WITNESS_SUBDIR)).filter((f) => f.endsWith(".json")).length;
  const results = existsSync(resultsDir)
    ? readdirSync(resultsDir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith(RESULT_SUFFIX)).length
    : 0;
  return { witnesses, results, files: files.length };
}

/**
 * Count what a built site publishes under `assets/qa/`, in the same two
 * shapes. Witness projections always sit one directory down (`<page>/<key>.json`),
 * results at the top; the top-level `index.json` is the graph projection the
 * generator writes through Jekyll, and this module's own `availability.json`,
 * and neither is evidence.
 */
/** Top-level files under `assets/qa/` that the witness tree did not put there. */
export const PUBLISHED_NOT_EVIDENCE: readonly string[] = ["index.json", "availability.json", TREE_COMMITS_FILE];

export function countPublished(siteDir: string): Pick<QaAssetCounts, "witnesses" | "results"> {
  const qa = join(siteDir, "assets", "qa");
  if (!existsSync(qa)) return { witnesses: 0, results: 0 };
  let witnesses = 0;
  let results = 0;
  for (const e of readdirSync(qa, { withFileTypes: true })) {
    if (e.isDirectory()) witnesses += walkFiles(join(qa, e.name)).filter((f) => f.endsWith(".json")).length;
    else if (e.isFile() && e.name.endsWith(RESULT_SUFFIX)) results++;
    // A top-level file the witness tree itself carries (bean `4l4d`:
    // `translation-qa-pages.json`, the shared list the badge script fetches)
    // is copied here like the rest, and `countResults` counts it — so it is
    // counted here too, or every build reads one short. The top-level
    // files that are NOT from the tree (PUBLISHED_NOT_EVIDENCE) are excluded.
    else if (e.isFile() && e.name.endsWith(".json") && !PUBLISHED_NOT_EVIDENCE.includes(e.name)) witnesses++;
  }
  return { witnesses, results };
}

/**
 * Decide the source. Pure over its inputs so every branch is testable without
 * a network: `local` is the checkout's counts, `hits` the first fetch that
 * hit (or undefined), with its index into the requested refs.
 */
export function decideSource(
  local: QaAssetCounts & { corpus: boolean },
  hit: { index: number; key: string; counts: QaAssetCounts; exact?: boolean; corpus?: boolean } | undefined,
): { source: QaSource; expected: QaAssetCounts; reason: string } {
  // On a main build, an exact `main/<sha>` hit at index 0 is evidence about the
  // very tree being built, so it wins over a still-committed checkout corpus.
  // The merge-vs-head reason for `checkout` winning applies to PR previews
  // (`pr/...`), fallback refs (`index > 0`), and floating/skipped resolutions.
  const exactMainHit =
    hit !== undefined &&
    hit.index === 0 &&
    hit.key.startsWith("main/") &&
    hit.exact !== false &&
    hit.corpus !== false;
  if (local.corpus && !exactMainHit) {
    return {
      source: "checkout",
      expected: { witnesses: local.witnesses, results: local.results, files: local.files },
      reason:
        "the checkout holds the QA corpus (still committed), so it is published as checked out" +
        (hit ? `; qa-reports also has ${hit.key}` : "; qa-reports had no entry for this build's ref"),
    };
  }
  if (hit) {
    return {
      source: hit.index === 0 ? "fetched" : "fetched-fallback",
      expected: hit.counts,
      reason:
        hit.index === 0
          ? `fetched ${hit.key} from qa-reports` +
            (local.corpus ? " (exact main/<sha> entry for this commit wins over the checkout)" : "")
          : `no entry for the requested ref; fetched ${hit.key} instead — QA evidence from ANOTHER commit, labelled as such`,
    };
  }
  return {
    source: "unavailable",
    expected: { witnesses: 0, results: 0, files: 0 },
    reason: "QA not available for this ref: the checkout holds no QA corpus and qa-reports had no entry for any requested ref",
  };
}

/**
 * Judge a published `assets/qa/` against the state. Returns the problems
 * (empty when it is fine) and the availability document to publish.
 *
 * - `now`: what the results tree holds at verify time. Fewer published than
 *   that means the copy itself dropped files — always an error.
 * - `state.expected`: what the source held at fetch time. Fewer published
 *   than that is the C10 shrink — an error, except that a FALLBACK entry is
 *   another commit's evidence, whose counts may legitimately differ, so there
 *   a witness shortfall is a warning.
 */
export function judgePublished(
  state: QaFetchState,
  now: QaAssetCounts,
  published: Pick<QaAssetCounts, "witnesses" | "results">,
): { errors: string[]; warnings: string[]; availability: QaAvailability } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (published.results < now.results) {
    errors.push(`the copy published ${published.results} *.qa-results.json of the ${now.results} in the results tree`);
  }
  if (published.witnesses < now.witnesses) {
    errors.push(`the copy published ${published.witnesses} witness file(s) of the ${now.witnesses} in the results tree`);
  }
  if (state.source !== "unavailable") {
    if (published.results < state.expected.results) {
      errors.push(
        `SHRINK: ${published.results} *.qa-results.json published, but the ${state.source} source held ` +
          `${state.expected.results} when the build started (C10)`,
      );
    }
    if (published.witnesses < state.expected.witnesses) {
      const msg =
        `${published.witnesses} witness file(s) published, but the ${state.source} source held ` +
        `${state.expected.witnesses} when the build started`;
      if (state.source === "fetched-fallback") warnings.push(`${msg} (a fallback entry is another commit's evidence)`);
      else errors.push(`SHRINK: ${msg} (C10)`);
    }
  } else {
    warnings.push(state.reason);
  }
  return {
    errors,
    warnings,
    availability: {
      $schema: AVAILABILITY_SCHEMA,
      source: state.source,
      requested: state.requested,
      ...(state.key ? { key: state.key } : {}),
      reason: state.reason,
      expected: { witnesses: state.expected.witnesses, results: state.expected.results },
      published,
    },
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────

function args(argv: string[]) {
  const pos: string[] = [];
  const vals = new Map<string, string[]>();
  const bools = new Set<string>();
  const VALUED = new Set(["ref", "fallback", "results", "state", "site", "max"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) {
      pos.push(a);
      continue;
    }
    const k = a.slice(2);
    if (VALUED.has(k)) {
      const v = argv[++i];
      if (v === undefined) throw new QaUsageError(`--${k} needs a value`);
      vals.set(k, [...(vals.get(k) ?? []), v]);
    } else bools.add(k);
  }
  return { pos, one: (n: string) => vals.get(n)?.at(-1), many: (n: string) => vals.get(n) ?? [], has: (n: string) => bools.has(n) };
}

function repoRoot(): string {
  const r = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" });
  if (r.status !== 0) throw new QaUsageError(`not inside a git checkout: ${process.cwd()}`);
  return r.stdout.trim();
}

// One answer for this writer and for `gen-docs-pages.ts`, which reads the state
// to name the entry its result links point at (bean `bejf`).
const defaultState = () => siteFetchStatePath();

function annotate(level: "notice" | "warning" | "error", msg: string): void {
  // A GitHub annotation in CI, a plain line elsewhere; the text is the same.
  console.log(process.env.GITHUB_ACTIONS ? `::${level} title=qa-site-assets::${msg}` : `${level}: ${msg}`);
}

function cmdFetch(a: ReturnType<typeof args>): number {
  const ref = a.one("ref");
  const resultsRel = a.one("results");
  if (!ref || !resultsRel) throw new QaUsageError("fetch needs --ref <ref> and --results <dir>");
  const root = repoRoot();
  const results = resolve(root, resultsRel);
  const requested = [ref, ...a.many("fallback")];
  const local = { ...countResults(results), corpus: holdsCorpus(results) };

  const scratch = mkdtempSync(join(tmpdir(), "qa-site-assets-"));
  const attempts: QaFetchState["attempts"] = [];
  let hit: { index: number; key: string; counts: QaAssetCounts; exact: boolean; corpus: boolean } | undefined;
  try {
    for (const [index, r] of requested.entries()) {
      const into = join(scratch, String(index));
      const f = fetchQa({ ref: r, into }, { repoRoot: root });
      attempts.push({ ref: r, state: f.state, ...(f.reason ? { reason: f.reason } : {}) });
      if (f.state === "hit") {
        const intoResults = join(into, resultsRel);
        const spec = parseQaRef(r);
        hit = {
          index,
          key: f.key!,
          counts: countResults(intoResults),
          exact: spec.kind === "main" && f.key!.startsWith(`main/${spec.sha}`),
          corpus: holdsCorpus(intoResults),
        };
        break;
      }
    }
    const d = decideSource(local, hit);
    if (hit && d.source !== "checkout") {
      const hitDir = join(scratch, String(hit.index));
      if (local.corpus && existsSync(join(hitDir, resultsRel))) {
        rmSync(results, { recursive: true, force: true });
      }
      // Materialise the WHOLE entry: the generator reads block, translation
      // and kg sidecars across every layer's results tree, not only the
      // tree this build publishes from.
      cpSync(hitDir, root, { recursive: true });
    }
    const state: QaFetchState = {
      $schema: STATE_SCHEMA,
      source: d.source,
      requested,
      ...(hit ? { key: hit.key } : {}),
      reason: d.reason,
      expected: d.expected,
      attempts,
    };
    const out = a.one("state") ?? defaultState();
    mkdirSync(resolve(out, ".."), { recursive: true });
    writeFileSync(out, JSON.stringify(state, null, 2) + "\n");

    for (const t of attempts) console.log(`  ${t.state === "hit" ? "✓" : "·"} ${t.ref}: ${t.state}${t.reason ? ` — ${t.reason}` : ""}`);
    console.log(
      `qa-site-assets: source ${d.source.toUpperCase()} — ${d.reason}\n` +
        `  expected: ${d.expected.witnesses} witness file(s), ${d.expected.results} *.qa-results.json (state → ${out})`,
    );
    if (d.source === "unavailable") {
      annotate("warning", d.reason);
      return a.has("require") ? 1 : 0;
    }
    if (d.source === "fetched-fallback") annotate("warning", d.reason);
    return 0;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function cmdVerify(a: ReturnType<typeof args>): number {
  const site = a.one("site");
  const resultsRel = a.one("results");
  if (!site || !resultsRel) throw new QaUsageError("verify needs --site <dir> and --results <dir>");
  const statePath = a.one("state") ?? defaultState();
  if (!existsSync(statePath)) {
    console.error(
      `qa-site-assets: no fetch state at ${statePath} — run \`fetch\` before the docs generator. ` +
        "Without it this step cannot say what the build SHOULD have published, which is the defect it exists for. NOT a pass.",
    );
    return 2;
  }
  const state = JSON.parse(readFileSync(statePath, "utf-8")) as QaFetchState;
  const now = countResults(resolve(repoRoot(), resultsRel));
  const published = countPublished(site);
  const j = judgePublished(state, now, published);
  const qaDir = join(site, "assets", "qa");
  mkdirSync(qaDir, { recursive: true });
  writeFileSync(join(qaDir, AVAILABILITY_FILE), JSON.stringify(j.availability, null, 2) + "\n");
  console.log(
    `qa-site-assets: published ${published.witnesses} witness file(s) and ${published.results} *.qa-results.json ` +
      `from source ${state.source.toUpperCase()}${state.key ? ` (${state.key})` : ""}; ` +
      `expected ${state.expected.witnesses} and ${state.expected.results} → ${join(qaDir, AVAILABILITY_FILE)}`,
  );
  for (const w of j.warnings) annotate("warning", w);
  for (const e of j.errors) annotate("error", e);
  return j.errors.length ? 1 : 0;
}

export interface TreeCommitIndex {
  $schema: typeof TREE_COMMITS_SCHEMA;
  /** `https://github.com/<owner>/<repo>`, or null when `origin` is not GitHub. */
  repo: string | null;
  /** How many first-parent commits were read; trees older than that are absent. */
  depth: number;
  /** Tree id → the oldest first-parent commit carrying it. */
  commits: Record<string, string>;
  /**
   * Tree id → that commit's committer date (ISO 8601), for each tree the log
   * gave a date for. The date a verdict on that tree is shown and ordered by
   * (owner rulings 2026-11-06: card "QA dates", option 1, and card "Date
   * source", option 1: a QA date is DERIVED on read
   * from the reviewed tree, so the verdict's bytes carry no clock). Additive:
   * a reader of an index without it falls back to the verdict's own date.
   */
  dates?: Record<string, string>;
}

/**
 * The index from `git log --first-parent --format='%T %H %cI'` output, NEWEST
 * first as git prints it: a later (older) line overwrites an earlier one, so
 * each tree keeps the oldest commit carrying it, and that commit's date. A
 * line is two 40-hex ids, optionally followed by an ISO 8601 date (so a
 * `%T %H` log still reads); anything else is skipped.
 */
export function treeCommitIndex(log: string, repoUrl: string | undefined): TreeCommitIndex {
  const commits: Record<string, string> = {};
  const dates: Record<string, string> = {};
  let depth = 0;
  for (const line of log.split("\n")) {
    const m = /^([0-9a-f]{40}) ([0-9a-f]{40})(?: (\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:Z|[+-]\d\d:\d\d)))?$/.exec(line.trim());
    if (!m) continue;
    depth++;
    commits[m[1]!] = m[2]!;
    if (m[3]) dates[m[1]!] = m[3];
    else delete dates[m[1]!];
  }
  const repo = repoUrl && /^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(repoUrl) ? repoUrl : null;
  return { $schema: TREE_COMMITS_SCHEMA, repo, depth, commits, ...(Object.keys(dates).length > 0 ? { dates } : {}) };
}

/**
 * The tree-to-commit index of `root`'s first-parent history, read from git.
 * The one reader for every consumer: the deploy's `tree-commits` step, and a
 * build that dates verdicts before the deploy has written the file (core's
 * `folio-site-blocks.ts`).
 */
export function readTreeCommitIndex(root: string, max: number = TREE_COMMITS_MAX): TreeCommitIndex {
  const log = spawnSync("git", ["-C", root, "log", "--first-parent", `-n${max}`, "--format=%T %H %cI", "HEAD"], {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (log.status !== 0) throw new Error(`git log failed: ${log.stderr.trim()}`);
  return treeCommitIndex(log.stdout, detectRepoUrl(root));
}

function cmdTreeCommits(a: ReturnType<typeof args>): number {
  const site = a.one("site");
  if (!site) throw new QaUsageError("tree-commits needs --site <dir>");
  const max = Number(a.one("max") ?? TREE_COMMITS_MAX);
  if (!Number.isInteger(max) || max < 1) throw new QaUsageError(`--max must be a positive integer, got ${a.one("max")}`);
  const index = readTreeCommitIndex(repoRoot(), max);
  const qaDir = join(resolve(site), "assets", "qa");
  mkdirSync(qaDir, { recursive: true });
  writeFileSync(join(qaDir, TREE_COMMITS_FILE), `${JSON.stringify(index)}\n`);
  console.log(
    `qa-site-assets tree-commits: ${Object.keys(index.commits).length} tree(s) from ${index.depth} first-parent commit(s)` +
      `${index.repo ? ` of ${index.repo}` : " (no GitHub origin: no links)"} → ${join(qaDir, TREE_COMMITS_FILE)}`,
  );
  return 0;
}

export function main(argv: string[]): number {
  const a = args(argv);
  switch (a.pos[0]) {
    case "fetch":
      return cmdFetch(a);
    case "verify":
      return cmdVerify(a);
    case "tree-commits":
      return cmdTreeCommits(a);
    default:
      throw new QaUsageError(`unknown command "${a.pos[0] ?? ""}" — fetch | verify | tree-commits`);
  }
}

if (import.meta.main) {
  let code: number;
  try {
    code = main(process.argv.slice(2));
  } catch (e) {
    if (e instanceof QaUsageError) {
      console.error(`qa-site-assets: ${e.message}`);
      code = 2;
    } else {
      console.error(`qa-site-assets: could not determine — ${(e as Error).message}. This is NOT a pass.`);
      code = 2;
    }
  }
  process.exit(code);
}
