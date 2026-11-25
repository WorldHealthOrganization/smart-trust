#!/usr/bin/env bun
/**
 * Which open PRs would conflict with each other — the conflict-prediction
 * input for composing merge trains.
 *
 * @module scripts/merge-overlap
 * @graphNode none — a read-only report over git and the open PRs
 * @covers none — a merge-steward report: it predicts, it judges no declared graph
 *
 * ## The rule
 *
 * Two PRs are **independent** when their AUTHORED paths do not overlap and
 * neither touches a shared declaration (`merge-pipeline-paths.ts`). Generated
 * paths are excluded, because every pair "conflicts" on them and `merge:train`
 * resolves them by regenerating. A README whose generated regions alone
 * changed is a generated region, not authored text, and is reported apart.
 *
 * ## Where the PRs come from
 *
 * - default: the open PRs over `gh api` (REST), then ONE `git fetch` of their
 *   heads; every diff is then `git diff --name-only <base>...<head>`, the
 *   same as the branch form, so the two sources cannot disagree on a PR.
 * - `--branches a,b,...` or positional refs: no `gh` at all.
 *
 * A PR whose head could not be fetched or diffed is reported with
 * `could_not_determine`, and no pair containing it is called independent
 * (`independent: null`): "could not look" is never "no overlap".
 *
 * Usage:
 *   bun run cat merge:overlap                                   # open PRs via gh
 *   bun run cat merge:overlap -- --branches origin/a,origin/b   # explicit branches
 *   bun run cat merge:overlap -- origin/a origin/b --base origin/main --no-fetch
 *
 * Exit 0 the report was written · 2 could not list the PRs or resolve the base.
 * The report is JSON on stdout; a one-line summary per conflicting pair on stderr.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { repoRootFor } from "../schemas/kg/cat-harness.ts";
import { git } from "./merge-pipeline-git.ts";
import { differsOnlyInRegions, pathClass, sharedDeclarationsOf } from "./merge-pipeline-paths.ts";

/** One open PR or branch, with the fields the queue schema computes per member. */
export interface OverlapMember {
  /** `#N` for a PR, the ref as given for a branch. */
  id: string;
  number?: number;
  branch?: string;
  title?: string;
  draft?: boolean;
  head_sha: string | null;
  files_count: number;
  /** Paths the PR authors: no declared generated pattern covers them (T3: `member.authored_paths`). */
  authored_paths: string[];
  /** READMEs etc. whose generated regions alone changed. */
  region_paths: string[];
  generated_count: number;
  /** Shared declarations the PR touches, path and declaration id (T3: `member.touches_shared`). */
  touches_shared: { path: string; declaration: string }[];
  touches_cat_harness: boolean;
  touches_cat_harness_tools: boolean;
  could_not_determine?: string;
}

export interface OverlapPair {
  a: string;
  b: string;
  authored_overlap: string[];
  region_overlap: string[];
  /** Both touch these shared-declaration ids. */
  shared_overlap: string[];
  /** Ids of the members in this pair that touch any shared declaration. */
  shared_touchers: string[];
  /** T3: false when it would conflict, null when a member could not be determined. */
  independent: boolean | null;
}

export interface OverlapReport {
  $schema: "merge-overlap/v1";
  base: string;
  base_sha: string;
  source: "gh" | "branches";
  generated_from: string;
  members: OverlapMember[];
  /** Every pair that is NOT independent (false or null). A pair absent here is independent. */
  pairs: OverlapPair[];
  summary: {
    members: number;
    undetermined: number;
    touching_shared: number;
    touching_cat_harness: number;
    touching_cat_harness_tools: number;
    conflicting_pairs: number;
  };
}

/**
 * Classify a member's changed paths. `regionOnly(path)` answers, for a
 * generated-regions path, whether ONLY its regions changed; `undefined` (could
 * not read it) counts the path as authored, the conservative side.
 */
export function classifyMember(
  base: Omit<OverlapMember, "files_count" | "authored_paths" | "region_paths" | "generated_count" | "touches_shared" | "touches_cat_harness" | "touches_cat_harness_tools">,
  files: readonly string[],
  regionOnly: (path: string) => boolean | undefined = () => true,
): OverlapMember {
  const authored: string[] = [];
  const regions: string[] = [];
  let generated = 0;
  for (const f of files) {
    const c = pathClass(f);
    if (c.class === "generated") generated++;
    else if (c.class === "generated-regions" && regionOnly(f) === true) regions.push(f);
    else authored.push(f);
  }
  const shared = files.flatMap((path) => sharedDeclarationsOf(path).map((declaration) => ({ path, declaration })));
  return {
    ...base,
    files_count: files.length,
    authored_paths: authored.sort(),
    region_paths: regions.sort(),
    generated_count: generated,
    touches_shared: shared,
    touches_cat_harness: files.some((f) => f.startsWith("cat-harness/")),
    touches_cat_harness_tools: files.some((f) => f.startsWith("cat-harness-tools/")),
  };
}

const intersect = (a: readonly string[], b: readonly string[]): string[] => {
  const s = new Set(b);
  return [...new Set(a.filter((x) => s.has(x)))].sort();
};

/** Every pair, with its overlap and the T3 independence verdict. */
export function pairsOf(members: readonly OverlapMember[]): OverlapPair[] {
  const out: OverlapPair[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i]!;
      const b = members[j]!;
      const authored = intersect(a.authored_paths, b.authored_paths);
      const region = intersect(a.region_paths, b.region_paths);
      const shared = intersect(a.touches_shared.map((t) => t.declaration), b.touches_shared.map((t) => t.declaration));
      const touchers = [a, b].filter((m) => m.touches_shared.length > 0).map((m) => m.id);
      const undetermined = a.could_not_determine !== undefined || b.could_not_determine !== undefined;
      out.push({
        a: a.id,
        b: b.id,
        authored_overlap: authored,
        region_overlap: region,
        shared_overlap: shared,
        shared_touchers: touchers,
        independent: undetermined ? null : authored.length === 0 && touchers.length === 0,
      });
    }
  }
  return out;
}

/** Assemble the report: members, the non-independent pairs, and the counts. */
export function buildReport(
  members: OverlapMember[],
  meta: { base: string; base_sha: string; source: "gh" | "branches" },
): OverlapReport {
  const pairs = pairsOf(members).filter((p) => p.independent !== true);
  return {
    $schema: "merge-overlap/v1",
    ...meta,
    generated_from: "cat-harness/scripts/merge-conflict-patterns.ts PATTERNS (take-base, owned-tree: generated; generated-regions: region-only when only regions changed)",
    members,
    pairs,
    summary: {
      members: members.length,
      undetermined: members.filter((m) => m.could_not_determine !== undefined).length,
      touching_shared: members.filter((m) => m.touches_shared.length > 0).length,
      touching_cat_harness: members.filter((m) => m.touches_cat_harness).length,
      touching_cat_harness_tools: members.filter((m) => m.touches_cat_harness_tools).length,
      conflicting_pairs: pairs.length,
    },
  };
}

/** An open PR as `gh pr list --json` gives it. */
export interface GhPr {
  number: number;
  headRefName: string;
  headRefOid: string;
  isDraft: boolean;
  title: string;
}

/**
 * Parse `gh api … --jq` output: one JSON object per line. A line that does
 * not parse fails the whole listing, because a PR silently dropped from the
 * list would be a PR silently called independent of everything.
 */
export function parseGhPrLines(text: string): GhPr[] | string {
  const out: GhPr[] = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    try {
      out.push(JSON.parse(line) as GhPr);
    } catch {
      return `gh returned a line that is not JSON: ${line.slice(0, 80)}`;
    }
  }
  return out;
}

/**
 * The open PRs, over the REST API. Not `gh pr list`: that is GraphQL, which
 * some environments (agent sessions among them, measured 2026-10-02) refuse
 * with a 403 while REST works.
 */
function ghOpenPrs(root: string, baseBranch: string): GhPr[] | string {
  const jq = ".[] | {number, headRefName: .head.ref, headRefOid: .head.sha, isDraft: .draft, title}";
  const r = spawnSync("gh", ["api", "--paginate", `repos/{owner}/{repo}/pulls?state=open&per_page=100&base=${encodeURIComponent(baseBranch)}`, "--jq", jq],
    { cwd: root, encoding: "utf-8" });
  if (r.error) return `gh is not available: ${r.error.message}`;
  if (r.status !== 0) return `gh api pulls failed: ${(r.stderr ?? "").trim().split("\n")[0]}`;
  return parseGhPrLines(r.stdout);
}

/** Measure one member against the base: its changed paths, with READMEs read to tell region-only from authored. */
export function measure(
  root: string,
  baseSha: string,
  head: string,
  meta: Omit<OverlapMember, "files_count" | "authored_paths" | "region_paths" | "generated_count" | "touches_shared" | "touches_cat_harness" | "touches_cat_harness_tools">,
): OverlapMember {
  const mb = git(root, ["merge-base", baseSha, head]);
  const diff = mb.ok ? git(root, ["diff", "--name-only", "-z", "--no-renames", mb.out, head]) : mb;
  if (!mb.ok || !diff.ok) {
    return { ...classifyMember(meta, []), could_not_determine: `git could not diff ${head} against the base: ${diff.err || "no merge base"}` };
  }
  const files = diff.out.split("\0").filter(Boolean);
  const regionOnly = (path: string): boolean | undefined => {
    const a = git(root, ["show", `${mb.out}:${path}`]);
    const b = git(root, ["show", `${head}:${path}`]);
    if (!a.ok || !b.ok) return undefined; // added or deleted: the whole file changed
    return differsOnlyInRegions(a.out, b.out);
  };
  return classifyMember(meta, files, regionOnly);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string): string | undefined => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const valued = new Set(["--base", "--root", "--remote", "--branches"]);
  const positional = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1] ?? ""));
  const fetch = !args.includes("--no-fetch");
  const base = opt("--base") ?? "origin/main";
  const remote = opt("--remote") ?? "origin";
  const root = opt("--root") ?? repoRootFor(join(import.meta.dir, ".."));
  const branches = [...(opt("--branches")?.split(",").map((s) => s.trim()).filter(Boolean) ?? []), ...positional];

  const baseBranch = base.startsWith(`${remote}/`) ? base.slice(remote.length + 1) : base;
  if (fetch && base.startsWith(`${remote}/`)) git(root, ["fetch", "-q", remote, baseBranch]);
  const baseSha = git(root, ["rev-parse", "--verify", "-q", `${base}^{commit}`]);
  if (!baseSha.ok) {
    console.error(`merge-overlap: no such base ${base}`);
    process.exit(2);
  }

  const members: OverlapMember[] = [];
  let source: "gh" | "branches";
  if (branches.length) {
    source = "branches";
    for (const b of branches) {
      const ref = b;
      let sha = git(root, ["rev-parse", "--verify", "-q", `${ref}^{commit}`]);
      if (!sha.ok && fetch) {
        const name = ref.startsWith(`${remote}/`) ? ref.slice(remote.length + 1) : ref;
        git(root, ["fetch", "-q", remote, name]);
        sha = git(root, ["rev-parse", "--verify", "-q", `${remote}/${name}^{commit}`]);
      }
      const meta = { id: ref, branch: ref, head_sha: sha.ok ? sha.out : null };
      members.push(sha.ok ? measure(root, baseSha.out, sha.out, meta) : { ...classifyMember(meta, []), could_not_determine: `no such ref ${ref}` });
    }
  } else {
    source = "gh";
    const prs = ghOpenPrs(root, baseBranch);
    if (typeof prs === "string") {
      console.error(`merge-overlap: ${prs}. Pass --branches a,b,... to work without gh.`);
      process.exit(2);
    }
    // ONE fetch for every head; a PR whose head is still missing is undetermined.
    if (fetch && prs.length) git(root, ["fetch", "-q", remote, ...prs.map((p) => `pull/${p.number}/head`)]);
    for (const p of prs) {
      const meta = { id: `#${p.number}`, number: p.number, branch: p.headRefName, title: p.title, draft: p.isDraft, head_sha: p.headRefOid };
      const present = git(root, ["cat-file", "-e", `${p.headRefOid}^{commit}`]).ok;
      members.push(present
        ? measure(root, baseSha.out, p.headRefOid, meta)
        : { ...classifyMember(meta, []), could_not_determine: `head ${p.headRefOid} is not present locally (fetch failed or --no-fetch)` });
    }
  }

  const report = buildReport(members, { base, base_sha: baseSha.out, source });
  console.log(JSON.stringify(report, null, 2));
  const s = report.summary;
  console.error(`merge-overlap: ${s.members} member(s), ${s.undetermined} undetermined, ${s.touching_shared} touch shared declarations, ` +
    `${s.touching_cat_harness} touch cat-harness/, ${s.touching_cat_harness_tools} touch cat-harness-tools/, ${s.conflicting_pairs} pair(s) not independent`);
  for (const p of report.pairs.filter((x) => x.authored_overlap.length)) {
    console.error(`  ${p.a} × ${p.b}: ${p.authored_overlap.length} authored path(s) — ${p.authored_overlap.slice(0, 3).join(", ")}${p.authored_overlap.length > 3 ? ", …" : ""}`);
  }
}
