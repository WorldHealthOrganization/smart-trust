#!/usr/bin/env bun
/**
 * Writer records in a git ref (cat-harness-tools#1702): the page-build skip
 * records and the outputs they put back, published to
 * `refs/cat/writer-records/<commit>` (and the moving `refs/cat/writer-records/main`)
 * of the repository they were built for, instead of the Actions cache.
 *
 * @module cat-harness-tools/scripts/writer-records-ref
 * @graphNode none — moves `build/writer-cone/` to and from a ref; it judges nothing
 *
 * ## Who writes, who reads, what checks
 *
 * The owner's rule (2026-11-08): a cache is published by whoever changes what
 * it is built from (the re-pinner, as for `refs/cat/layers/*`), and CI only
 * reads it and checks it. So:
 *
 * - `publish` runs where the re-pin was made, over the composed root, after
 *   `derive:publish` recorded the writers (`--build` runs it, incrementally
 *   against the fetched records). It refuses records that are not of the
 *   commit it names, or that name an outputs entry the directory does not hold.
 * - `fetch` lays a published ref down at `build/writer-cone/`: the first of the
 *   `--want` commits that has one, else `main`. Nothing found is no records:
 *   every writer runs.
 * - The check is twofold. A skip restores a writer's outputs only when they
 *   hash to what its record says (`derive-at-publish.ts`), so a damaged entry
 *   is a rerun. And main's full build judges every published record with
 *   `writer-cone-verify.ts --gate`, red on any writer whose skip would have
 *   served stale pages.
 *
 * Usage (from the root the records are for):
 *   bun run cat-harness-tools/scripts/writer-records-ref.ts fetch   --git <repo> [--remote origin] [--want <sha>]... [--dir build/writer-cone]
 *   bun run cat-harness-tools/scripts/writer-records-ref.ts publish --git <repo> --sha <commit> [--remote origin] [--main] [--build] [--dir build/writer-cone] [--keep 20]
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { hasEntry } from "./derive-cache.ts";
import { entryShaOf, loadWriterRecords, WRITER_CONE_DIR, WRITER_RECORD_ENV, WRITER_RECORD_FILE, WRITER_SKIP_ENV, type WriterRecords } from "./writer-cone.ts";

/** Where the refs live in the repository the records are for. */
export const WRITER_REFS = "refs/cat/writer-records";
/** The moving ref: the newest records published from main. */
export const WRITER_MAIN_REF = `${WRITER_REFS}/main`;
/** How many per-commit refs `publish` keeps (plus `main`). */
export const KEEP_REFS = 20;

const IDENTITY = { GIT_AUTHOR_NAME: "cat writer records", GIT_AUTHOR_EMAIL: "noreply@users.noreply.github.com", GIT_COMMITTER_NAME: "cat writer records", GIT_COMMITTER_EMAIL: "noreply@users.noreply.github.com" };

function git(cwd: string, args: string[], env: Record<string, string> = {}): { ok: boolean; out: string; err: string } {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8", env: { ...process.env, ...env }, maxBuffer: 1 << 28 });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

/** The per-commit ref for `sha`. */
export function refFor(sha: string): string {
  return `${WRITER_REFS}/${sha}`;
}

/**
 * Why `records` may not be published as the records of `sha`, or `undefined`.
 * Every writer it holds a record for, and every index it kept, must have its
 * outputs entry in `outputsDir` under the commit the record names: a skip puts
 * back exactly that entry.
 */
export function publishRefusal(records: WriterRecords | undefined, sha: string, outputsDir: string): string | undefined {
  if (records === undefined) return `no records of this version at ${WRITER_RECORD_FILE} (run derive:publish with ${WRITER_RECORD_ENV}=1 first)`;
  if (records.sha !== sha) return `the records are of ${records.sha.slice(0, 12)}, not of ${sha.slice(0, 12)}`;
  const writers = [...Object.keys(records.writers), ...Object.keys(records.kept ?? {})];
  const missing = writers.filter((w) => !hasEntry(outputsDir, w, entryShaOf(records, w)));
  if (missing.length > 0) return `no outputs entry for ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ` and ${missing.length - 5} more` : ""}`;
  if (Object.keys(records.writers).length === 0) return "the records hold no writer";
  return undefined;
}

/** Lay the first published ref of `want` (else `main`) down at `dir`. Returns the ref, or why none. */
export function fetchRecords(o: { git: string; remote?: string; want: readonly string[]; dir: string }): { ref: string; commit: string } | { none: string } {
  const remote = o.remote ?? "origin";
  for (const ref of [...o.want.filter(Boolean).map(refFor), WRITER_MAIN_REF]) {
    const f = git(o.git, ["fetch", "--quiet", "--no-tags", remote, `+${ref}:${ref}`]);
    if (!f.ok) continue;
    const commit = git(o.git, ["rev-parse", "--verify", `${ref}^{commit}`]).out;
    if (!commit) continue;
    rmSync(o.dir, { recursive: true, force: true });
    mkdirSync(o.dir, { recursive: true });
    const scratch = mkdtempSync(join(tmpdir(), "writer-records-fetch-"));
    try {
      const r = git(o.git, ["--work-tree", resolve(o.dir), "checkout", commit, "--", "."], { GIT_INDEX_FILE: join(scratch, "index") });
      if (!r.ok) return { none: `could not lay ${ref} down: ${r.err}` };
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
    return { ref, commit };
  }
  return { none: `no ${WRITER_REFS}/<commit> for ${o.want.filter(Boolean).map((s) => s.slice(0, 12)).join(", ") || "(none asked)"} and no ${WRITER_MAIN_REF} at ${remote}` };
}

/** Commit `dir` as a parentless commit (its tree is the directory as it stands). */
export function commitDir(gitDir: string, dir: string, message: string): { commit: string } | { failed: string } {
  const scratch = mkdtempSync(join(tmpdir(), "writer-records-publish-"));
  try {
    const env = { ...IDENTITY, GIT_INDEX_FILE: join(scratch, "index") };
    const add = git(gitDir, ["--work-tree", resolve(dir), "add", "--all", "--force", "."], env);
    if (!add.ok) return { failed: `git add: ${add.err}` };
    const tree = git(gitDir, ["write-tree"], env);
    if (!tree.ok) return { failed: `git write-tree: ${tree.err}` };
    const commit = git(gitDir, ["commit-tree", tree.out, "-m", message], env);
    if (!commit.ok) return { failed: `git commit-tree: ${commit.err}` };
    return { commit: commit.out };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** The per-commit refs in `present` to delete: all but `main` and the refs of the first `keep` of `keepShas` (newest first). */
export function refsToPrune(present: readonly string[], keepShas: readonly string[], keep: number): string[] {
  const kept = new Set(keepShas.slice(0, keep).map(refFor));
  return present.filter((r) => r !== WRITER_MAIN_REF && !kept.has(r));
}

function publish(o: { git: string; remote: string; sha: string; dir: string; main: boolean; keep: number }): { ok: true; detail: string } | { ok: false; detail: string } {
  const records = loadWriterRecords(".", join(o.dir, "records.json"));
  const why = publishRefusal(records, o.sha, join(o.dir, "outputs"));
  if (why !== undefined) return { ok: false, detail: `refused: ${why}` };
  const c = commitDir(o.git, o.dir, `writer records of ${o.sha}\n\n${Object.keys(records!.writers).length} writer(s) recorded, ${Object.keys(records!.unrecorded).length} not.`);
  if ("failed" in c) return { ok: false, detail: c.failed };
  const refspecs = [`+${c.commit}:${refFor(o.sha)}`, ...(o.main ? [`+${c.commit}:${WRITER_MAIN_REF}`] : [])];
  const push = git(o.git, ["push", "--quiet", o.remote, ...refspecs]);
  if (!push.ok) return { ok: false, detail: `git push: ${push.err}` };
  // Prune: keep the refs of the newest `keep` commits of the remote's main.
  const ls = git(o.git, ["ls-remote", o.remote, `${WRITER_REFS}/*`]);
  const present = ls.ok ? ls.out.split("\n").map((l) => l.split("\t")[1]).filter((r): r is string => !!r) : [];
  // The refs are parentless, so this is the only history read: main's, as the publisher's clone holds it.
  git(o.git, ["fetch", "--quiet", "--no-tags", o.remote, "main"]);
  const order = git(o.git, ["rev-list", `--max-count=${o.keep * 5}`, "FETCH_HEAD"]).out.split("\n").filter(Boolean);
  const keepShas = [o.sha, ...order.filter((s) => present.includes(refFor(s)) && s !== o.sha)];
  const stale = refsToPrune(present, keepShas, o.keep);
  if (stale.length > 0) git(o.git, ["push", "--quiet", o.remote, ...stale.map((r) => `:${r}`)]);
  return { ok: true, detail: `published ${refFor(o.sha)}${o.main ? ` and ${WRITER_MAIN_REF}` : ""} (${c.commit.slice(0, 12)}); pruned ${stale.length}` };
}

if (import.meta.main) {
  const [cmd, ...argv] = process.argv.slice(2);
  const arg = (k: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const all = (k: string) => argv.flatMap((a, i) => (a === k && argv[i + 1] ? [argv[i + 1]!] : []));
  const gitDir = resolve(arg("--git") ?? ".");
  const remote = arg("--remote") ?? "origin";
  const dir = resolve(arg("--dir") ?? WRITER_CONE_DIR);
  if (cmd === "fetch") {
    const r = fetchRecords({ git: gitDir, remote, want: all("--want"), dir });
    console.log("none" in r ? `writer records: none fetched (${r.none}); every writer runs` : `writer records: ${r.ref} (${r.commit.slice(0, 12)}) laid down at ${dir}`);
    process.exit(0);
  }
  if (cmd === "publish") {
    const sha = arg("--sha") ?? git(gitDir, ["rev-parse", "HEAD"]).out;
    if (argv.includes("--build")) {
      // Incremental against the newest published records: a writer whose reads all match keeps its record; the rest run traced.
      const prev = fetchRecords({ git: gitDir, remote, want: [], dir });
      console.log("none" in prev ? `writer records: a full record (${prev.none})` : `writer records: incremental against ${prev.ref}`);
      const env = { ...process.env, GITHUB_SHA: sha, [WRITER_RECORD_ENV]: "1", ...("none" in prev ? {} : { [WRITER_SKIP_ENV]: "1" }) };
      const b = spawnSync("bun", ["run", "cat", "derive:publish"], { stdio: "inherit", env });
      if (b.status !== 0) {
        console.error(`::error::writer-records: derive:publish exited ${b.status}; nothing published`);
        process.exit(1);
      }
    }
    if (!existsSync(join(dir, "records.json"))) {
      console.error(`::error::writer-records: no ${join(dir, "records.json")}`);
      process.exit(1);
    }
    const r = publish({ git: gitDir, remote, sha, dir, main: argv.includes("--main"), keep: Number(arg("--keep") ?? KEEP_REFS) });
    console.log(`writer records: ${r.detail}`);
    process.exit(r.ok ? 0 : 1);
  }
  console.error("usage: writer-records-ref.ts fetch|publish --git <repo> … (see the module comment)");
  process.exit(2);
}

