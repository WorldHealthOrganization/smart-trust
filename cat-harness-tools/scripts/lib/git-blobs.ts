/**
 * Read a `gh-pages` checkout's files from git OBJECTS where the working tree
 * does not hold them: a sparse checkout, a blobless (`--filter=blob:none`)
 * clone, or a clone with no checkout at all.
 *
 * @module cat-harness-tools/scripts/lib/git-blobs
 *
 * The staging deploy writes only `STAGING/<slug>/` and `_render-log/`, yet
 * the scripts it runs compare against the live site and read every other
 * preview. A full checkout of the publish branch serves both and costs every
 * blob of it. These helpers serve the same reads from the tree and from the
 * few blobs that are actually needed:
 *
 * - **which files exist, and their blob ids** — the tree, always local in a
 *   blobless clone ({@link sparseEntries}, {@link treeEntries});
 * - **whether two files are byte-identical** — the blob id of the local file
 *   ({@link blobId}) against the tree's, with no blob fetched;
 * - **a blob's content** — fetched only for the ids asked for, in ONE fetch
 *   ({@link prefetchBlobs}), then read in batches ({@link forEachBlob}).
 *
 * Each caller consults these only for a path the working tree does not hold,
 * so a full checkout reads exactly what it read before.
 *
 * ## Why sizes are not read from the tree
 *
 * `git ls-tree -l` and `cat-file --batch-check` need the object's header, and
 * in a blobless clone that LAZILY FETCHES the blob, one round trip per object
 * (measured with git 2.43: `ls-tree -l` on an absent blob runs
 * `git fetch … --filter=blob:none --stdin`). A size of a file outside the
 * checkout is therefore as dear as its content; {@link blobSizes} prefetches
 * the whole set in one fetch first, and a caller that can should record the
 * size it needs instead (`staging-rotate.ts`'s `.staged-size.json`).
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

export interface GitEntry {
  /** `100644`, `100755`, `120000` (symlink) or `160000` (gitlink). */
  mode: string;
  oid: string;
  /** Path from the repository root, `/`-separated. */
  path: string;
}

/** A regular file's mode — what a checkout writes as a file, not a link. */
export function isRegular(mode: string): boolean {
  return mode === "100644" || mode === "100755";
}

function git(dir: string, args: string[], input?: string): { status: number; stdout: Buffer; stderr: string } {
  const r = spawnSync("git", ["-C", dir, ...args], {
    input,
    maxBuffer: 1 << 30,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return { status: r.status ?? 1, stdout: (r.stdout as Buffer | null) ?? Buffer.alloc(0), stderr: String(r.stderr ?? "") };
}

function ok(dir: string, args: string[], input?: string): Buffer {
  const r = git(dir, args, input);
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${dir}: ${r.stderr.trim()}`);
  return r.stdout;
}

/** `dir` is the top of a git working tree — not a plain directory, and not a subdirectory of some other repository. */
export function isRepoTop(dir: string): boolean {
  const r = git(dir, ["rev-parse", "--show-toplevel"]);
  if (r.status !== 0) return false;
  try {
    return realpathSync(r.stdout.toString("utf-8").trim()) === realpathSync(resolve(dir));
  } catch {
    return false;
  }
}

/** Whether `dir` is a repository whose working tree is sparse. */
export function isSparse(dir: string): boolean {
  if (!isRepoTop(dir)) return false;
  const r = git(dir, ["config", "--bool", "core.sparseCheckout"]);
  return r.status === 0 && r.stdout.toString("utf-8").trim() === "true";
}

export interface IndexEntry extends GitEntry {
  /** Outside the sparse checkout's cone, whatever is on disk at its path. */
  outside: boolean;
}

/**
 * Whether a path is inside a cone-mode sparse checkout of `dirs`: a file at
 * the root, a file directly in a directory that leads to a cone directory, or
 * anything under one — git's own cone rule.
 */
export function inCone(path: string, dirs: readonly string[]): boolean {
  const slash = path.lastIndexOf("/");
  if (slash < 0) return true;
  const parent = path.slice(0, slash);
  return dirs.some((d) => path.startsWith(`${d}/`) || d.startsWith(`${parent}/`));
}

/** The cone's directories, when the checkout is cone-mode sparse. */
export function coneDirs(dir: string): string[] | undefined {
  const r = git(dir, ["config", "--bool", "core.sparseCheckoutCone"]);
  if (r.status !== 0 || r.stdout.toString("utf-8").trim() !== "true") return undefined;
  return ok(dir, ["sparse-checkout", "list"])
    .toString("utf-8")
    .split("\n")
    .map((l) => l.trim().replace(/^\/+|\/+$/g, ""))
    .filter((l) => l !== "");
}

/**
 * Every index entry of a SPARSE checkout, each marked whether it is outside
 * the cone. `undefined` when `dir` is not a sparse checkout at its top — the
 * caller then reads only the working tree, as it always did.
 *
 * The CONE, not the disk, is what says a path is outside. A file written on
 * disk outside the cone (an earlier write, a leftover `reset --hard` does not
 * remove) is not what the next commit holds: `git add -A` does not stage it.
 * Nor is the skip-worktree bit enough, since git (2.37 on) clears it for a
 * file present on disk while `git add` still leaves that file alone. In cone
 * mode the cone's own rule ({@link inCone}) decides; in non-cone mode, whose
 * patterns git alone evaluates, the skip-worktree bit does.
 */
export function indexEntries(dir: string): Map<string, IndexEntry> | undefined {
  if (!isSparse(dir)) return undefined;
  const out = new Map<string, IndexEntry>();
  const cone = coneDirs(dir);
  for (const rec of ok(dir, ["ls-files", "-z", "-t", "-s"]).toString("utf-8").split("\0")) {
    // `S 100644 <oid> 0\t<path>`
    const m = /^(\S) (\d{6}) ([0-9a-f]+) \d\t([\s\S]*)$/.exec(rec);
    if (m === null) continue;
    const outside = cone === undefined ? m[1] === "S" : !inCone(m[4], cone);
    out.set(m[4], { mode: m[2], oid: m[3], path: m[4], outside });
  }
  return out;
}

/** The entries of {@link indexEntries} outside the cone, by path. */
export function sparseEntries(dir: string): Map<string, GitEntry> | undefined {
  const all = indexEntries(dir);
  if (all === undefined) return undefined;
  return new Map([...all].filter(([, e]) => e.outside));
}

/** Every file entry of `rev`'s tree (`git ls-tree -r`): no blob is read. */
export function treeEntries(dir: string, rev = "HEAD"): GitEntry[] {
  const out: GitEntry[] = [];
  for (const rec of ok(dir, ["ls-tree", "-r", "-z", rev]).toString("utf-8").split("\0")) {
    // `100644 blob <oid>\t<path>`
    const m = /^(\d{6}) (\w+) ([0-9a-f]+)\t([\s\S]*)$/.exec(rec);
    if (m !== null) out.push({ mode: m[1], oid: m[3], path: m[4] });
  }
  return out;
}

/** The repository's object format, which a blob id is computed in. */
export function objectFormat(dir: string): "sha1" | "sha256" {
  const r = git(dir, ["rev-parse", "--show-object-format"]);
  return r.status === 0 && r.stdout.toString("utf-8").trim() === "sha256" ? "sha256" : "sha1";
}

/**
 * The blob id git gives these bytes, computed here rather than by
 * `git hash-object`: one process per file would cost more than the read.
 * Raw bytes, as `git hash-object --no-filters`.
 */
export function blobId(bytes: Buffer, format: "sha1" | "sha256" = "sha1"): string {
  return createHash(format).update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

/** The name of the remote a partial clone fetches absent objects from, if any. */
function promisorRemote(dir: string): string | undefined {
  const r = git(dir, ["config", "--get-regexp", "^remote\\..*\\.promisor$"]);
  if (r.status !== 0) return undefined;
  for (const line of r.stdout.toString("utf-8").split("\n")) {
    const m = /^remote\.(.+)\.promisor (\S+)$/.exec(line.trim());
    if (m && m[2] === "true") return m[1];
  }
  return undefined;
}

/**
 * The objects present in a clone, as reachable from `rev`, read once per
 * repository and commit: a scan walks the whole tree, and a run asks many
 * times. Blobs a fetch brings are added as it brings them.
 */
const presentCache = new Map<string, Set<string>>();

function presentObjects(dir: string, rev: string): Set<string> {
  const commit = git(dir, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]).stdout.toString("utf-8").trim();
  const key = `${realpathSync(resolve(dir))}\0${commit}`;
  const hit = presentCache.get(key);
  if (hit !== undefined) return hit;
  const present = new Set<string>();
  const r = git(dir, ["rev-list", "--objects", "--missing=print", rev]);
  if (r.status === 0) {
    for (const line of r.stdout.toString("utf-8").split("\n")) {
      if (line === "" || line.startsWith("?")) continue;
      present.add(line.slice(0, line.indexOf(" ") < 0 ? undefined : line.indexOf(" ")));
    }
  }
  presentCache.set(key, present);
  return present;
}

/**
 * Fetch the absent blobs among `oids` in ONE request, and throw when the fetch
 * fails. A no-op in a clone that has every object. Absence is read with
 * `rev-list --missing=print`, which never fetches (asking `cat-file` would
 * fetch each one on its own), once per run ({@link presentObjects}).
 */
export function prefetchBlobs(dir: string, oids: Iterable<string>, rev = "HEAD"): number {
  const remote = promisorRemote(dir);
  if (remote === undefined) return 0;
  const want = new Set(oids);
  if (want.size === 0) return 0;
  const present = presentObjects(dir, rev);
  const missing = [...want].filter((o) => !present.has(o));
  if (missing.length === 0) return 0;
  // The same command git runs for one lazily fetched object, given them all.
  const f = git(
    dir,
    ["-c", "fetch.negotiationAlgorithm=noop", "fetch", remote, "--no-tags", "--no-write-fetch-head", "--recurse-submodules=no", "--filter=blob:none", "--stdin"],
    missing.join("\n") + "\n",
  );
  if (f.status !== 0) throw new Error(`could not fetch ${missing.length} blob(s) from ${remote}: ${f.stderr.trim()}`);
  for (const o of missing) present.add(o);
  return missing.length;
}

/** Each blob's bytes, in batches, via one `git cat-file --batch` per batch. Prefetch first. */
export function forEachBlob(dir: string, oids: readonly string[], each: (oid: string, bytes: Buffer) => void, batch = 500): void {
  for (let i = 0; i < oids.length; i += batch) {
    const chunk = oids.slice(i, i + batch);
    const out = ok(dir, ["cat-file", "--batch"], chunk.join("\n") + "\n");
    let at = 0;
    for (const want of chunk) {
      const nl = out.indexOf(10, at);
      const head = out.subarray(at, nl).toString("utf-8");
      const m = /^([0-9a-f]+) (\w+) (\d+)$/.exec(head);
      if (m === null) throw new Error(`git cat-file: ${want} is not readable (${head})`);
      const size = Number(m[3]);
      each(want, out.subarray(nl + 1, nl + 1 + size));
      at = nl + 1 + size + 1;
    }
  }
}

/** Each blob's size. Prefetches the absent ones in one request, since a size costs the blob. */
export function blobSizes(dir: string, oids: readonly string[], rev = "HEAD"): Map<string, number> {
  const sizes = new Map<string, number>();
  if (oids.length === 0) return sizes;
  prefetchBlobs(dir, oids, rev);
  const out = ok(dir, ["cat-file", "--batch-check"], oids.join("\n") + "\n").toString("utf-8");
  for (const line of out.split("\n")) {
    const m = /^([0-9a-f]+) \w+ (\d+)$/.exec(line);
    if (m) sizes.set(m[1], Number(m[2]));
  }
  return sizes;
}

/** Take `paths` out of the index of a sparse checkout, so a removal outside the working tree is committed. */
export function removeFromIndex(dir: string, paths: readonly string[]): void {
  if (paths.length === 0) return;
  ok(dir, ["rm", "-r", "-q", "--cached", "--sparse", "--ignore-unmatch", "--", ...paths]);
}
