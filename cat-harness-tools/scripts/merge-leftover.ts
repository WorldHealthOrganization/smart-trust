#!/usr/bin/env bun
/**
 * After a merge train landed, has this PR's INTENT landed?
 *
 * @module scripts/merge-leftover
 * @graphNode none — a read-only report over git history
 * @covers none — a merge-steward report: it judges a PR against the base, no declared graph
 *
 * A train merges a member's head into the train branch and the train into
 * `main`. Afterwards the PR is still open, and its diff against `main` is
 * whatever the train did NOT carry: new commits pushed since, generated
 * files `main` regenerated differently, or the sides of conflicts the train
 * resolved. This says which.
 *
 * ## Three verdicts, never two
 *
 * | verdict | meaning |
 * |---|---|
 * | `landed` | every path the PR still changes is generated, differs only inside generated regions, or already carries the PR's change on the base |
 * | `not-landed` | at least one AUTHORED path still differs, listed |
 * | `could-not-determine` | git could not answer for some path (or for the PR at all); **never shown as clean** |
 *
 * ## How "already carries the PR's change" is decided
 *
 * Per authored path, the PR's own patch (fork point → head) is applied IN
 * REVERSE to the base's version, in a throwaway index. If it applies, the
 * base contains the change, and the file differs only because the base has
 * moved on. If it does not, the change is not there — or the base rewrote
 * the same lines, which a person must look at. No working tree is touched.
 *
 * It only reports. Closing a PR stays a steward action.
 *
 * Usage:
 *   bun run cat merge:leftover -- 1234                 # PR head vs origin/main
 *   bun run cat merge:leftover -- 1234:<sha>           # a pinned head
 *   bun run cat merge:leftover -- origin/claude/x --base origin/main --no-fetch
 *
 * Exit 0 landed · 1 not-landed · 2 could-not-determine.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { repoRootFor } from "../schemas/kg/cat-harness.ts";
import { isAncestor } from "./git-ancestry.ts";
import { git, parseMemberSpec, resolveMember } from "./merge-pipeline-git.ts";
import { differsOnlyInRegions, pathClass } from "./merge-pipeline-paths.ts";

export type LeftoverVerdict = "landed" | "not-landed" | "could-not-determine";

/**
 * Per path the PR changes:
 * - `same` — the base's copy equals the head's;
 * - `generated` — a declared generated file (regenerated on the base);
 * - `generated-region` — differs only inside generated regions;
 * - `contained` — authored, and the base already carries the PR's change;
 * - `different` — authored, and the base does not carry it;
 * - `unknown` — git could not answer.
 */
export type PathState = "same" | "generated" | "generated-region" | "contained" | "different" | "unknown";

export interface LeftoverPath {
  path: string;
  state: PathState;
  pattern?: string;
  detail?: string;
}

export interface LeftoverReport {
  $schema: "merge-leftover/v1";
  member: string;
  head: string | null;
  base: string;
  base_sha: string | null;
  merge_base: string | null;
  verdict: LeftoverVerdict;
  reason: string;
  /** The authored paths still different: the steward's whole question when `not-landed`. */
  authored_different: string[];
  paths: LeftoverPath[];
}

/** The verdict from per-path states. `different` outranks `unknown`: one is enough to say not-landed. */
export function verdictOf(paths: readonly LeftoverPath[]): { verdict: LeftoverVerdict; reason: string } {
  const different = paths.filter((p) => p.state === "different");
  const unknown = paths.filter((p) => p.state === "unknown");
  if (different.length) return { verdict: "not-landed", reason: `${different.length} authored path(s) still differ from the base` };
  if (unknown.length) return { verdict: "could-not-determine", reason: `${unknown.length} path(s) could not be compared` };
  if (paths.length === 0) return { verdict: "landed", reason: "the PR changes nothing beyond the base" };
  return { verdict: "landed", reason: "every remaining difference is generated, a generated region, or already on the base" };
}

function blob(root: string, rev: string, path: string): { ok: true; oid: string | null } | { ok: false } {
  const r = git(root, ["ls-tree", "-z", rev, "--", path]);
  if (!r.ok) return { ok: false };
  if (!r.out) return { ok: true, oid: null };
  // "<mode> <type> <oid>\t<path>"
  const oid = r.out.split("\t")[0]!.split(" ")[2];
  return oid ? { ok: true, oid } : { ok: false };
}

function show(root: string, rev: string, path: string): string | undefined {
  const r = git(root, ["show", `${rev}:${path}`]);
  return r.ok ? r.out : undefined;
}

/** Compare one PR head against a base, path by path. Pure git; no working tree is touched. */
export function leftover(root: string, head: string, base: string): Omit<LeftoverReport, "$schema" | "member" | "base"> {
  const empty = { head, base_sha: base, merge_base: null, authored_different: [] as string[], paths: [] as LeftoverPath[] };
  // NOT `git(...).ok`. That reads a non-zero exit as "the head is not
  // contained", and on a shallow clone the exit is 128 (bad object) rather
  // than 1 — so a head that HAS landed reads as unlanded, and this function
  // then reports leftover paths for work already merged. `isAncestor` deepens
  // first and says `unknown` instead of guessing; `could-not-determine` is
  // already this report's third verdict, so the honest answer has a home.
  const landed = isAncestor(root, head, base);
  if (!landed.known) {
    return { ...empty, verdict: "could-not-determine", reason: `could not tell whether the head has landed: ${landed.reason}` };
  }
  if (landed.ancestor) {
    return { ...empty, verdict: "landed", reason: "the head is contained in the base" };
  }
  const mb = git(root, ["merge-base", head, base]);
  if (!mb.ok || !mb.out) {
    return { ...empty, verdict: "could-not-determine", reason: `no merge base between head and base: ${mb.err || "unrelated histories"}` };
  }
  const forkPoint = mb.out;
  const changed = git(root, ["diff", "--name-only", "-z", "--no-renames", forkPoint, head]);
  if (!changed.ok) {
    return { ...empty, merge_base: forkPoint, verdict: "could-not-determine", reason: `git diff failed: ${changed.err}` };
  }
  const files = changed.out.split("\0").filter(Boolean);

  // One throwaway index holding the base, for the reverse-apply test.
  let indexDir: string | undefined;
  let indexEnv: Record<string, string> | undefined;
  const baseIndex = (): Record<string, string> | undefined => {
    if (indexEnv) return indexEnv;
    indexDir = mkdtempSync(join(tmpdir(), "merge-leftover-"));
    const env = { GIT_INDEX_FILE: join(indexDir, "index") };
    if (!git(root, ["read-tree", base], { env }).ok) return undefined;
    indexEnv = env;
    return indexEnv;
  };

  const paths: LeftoverPath[] = [];
  try {
    for (const path of files) {
      const h = blob(root, head, path);
      const b = blob(root, base, path);
      if (!h.ok || !b.ok) {
        paths.push({ path, state: "unknown", detail: "ls-tree failed" });
        continue;
      }
      if (h.oid === b.oid) {
        paths.push({ path, state: "same" });
        continue;
      }
      const c = pathClass(path);
      const withPattern = (p: LeftoverPath): LeftoverPath => (c.pattern ? { ...p, pattern: c.pattern } : p);
      if (c.class === "generated") {
        paths.push(withPattern({ path, state: "generated" }));
        continue;
      }
      if (c.class === "generated-regions" && h.oid !== null && b.oid !== null) {
        const ht = show(root, head, path);
        const bt = show(root, base, path);
        if (ht !== undefined && bt !== undefined && differsOnlyInRegions(ht, bt)) {
          paths.push(withPattern({ path, state: "generated-region" }));
          continue;
        }
      }
      const env = baseIndex();
      const patch = git(root, ["diff", "--binary", "--no-renames", forkPoint, head, "--", path]);
      if (!env || !patch.ok) {
        paths.push(withPattern({ path, state: "unknown", detail: !env ? "could not read the base into an index" : `git diff failed: ${patch.err}` }));
        continue;
      }
      const applied = git(root, ["apply", "--cached", "--check", "-R", "-"], { input: `${patch.out}\n`, env });
      paths.push(withPattern(applied.ok
        ? { path, state: "contained" }
        : { path, state: "different", detail: applied.err.split("\n")[0] ?? "" }));
    }
  } finally {
    if (indexDir) rmSync(indexDir, { recursive: true, force: true });
  }
  const v = verdictOf(paths);
  return {
    head,
    base_sha: base,
    merge_base: forkPoint,
    verdict: v.verdict,
    reason: v.reason,
    authored_different: paths.filter((p) => p.state === "different").map((p) => p.path),
    paths,
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string): string | undefined => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const valued = new Set(["--base", "--root", "--remote"]);
  const positional = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1] ?? ""));
  const fetch = !args.includes("--no-fetch");
  const base = opt("--base") ?? "origin/main";
  const remote = opt("--remote") ?? "origin";
  const root = opt("--root") ?? repoRootFor(join(import.meta.dir, ".."));
  if (positional.length !== 1) {
    console.error("usage: merge-leftover.ts <PR number | N:sha | branch | sha> [--base origin/main] [--root <checkout>] [--no-fetch]");
    process.exit(2);
  }
  const spec = parseMemberSpec(positional[0]!);
  const report: LeftoverReport = {
    $schema: "merge-leftover/v1", member: positional[0]!, head: null, base, base_sha: null, merge_base: null,
    verdict: "could-not-determine", reason: "", authored_different: [], paths: [],
  };
  if (fetch && base.startsWith(`${remote}/`)) git(root, ["fetch", "-q", remote, base.slice(remote.length + 1)]);
  const baseSha = git(root, ["rev-parse", "--verify", "-q", `${base}^{commit}`]);
  const m = resolveMember(root, spec, { remote, fetch });
  if (!baseSha.ok) report.reason = `no such base ${base}`;
  else if ("error" in m) report.reason = m.error;
  else Object.assign(report, leftover(root, m.sha, baseSha.out));
  console.log(JSON.stringify(report, null, 2));
  console.error(`merge-leftover: ${report.member} — ${report.verdict.toUpperCase()}: ${report.reason}`);
  for (const p of report.authored_different) console.error(`  ✗ ${p}`);
  process.exit(report.verdict === "landed" ? 0 : report.verdict === "not-landed" ? 1 : 2);
}
