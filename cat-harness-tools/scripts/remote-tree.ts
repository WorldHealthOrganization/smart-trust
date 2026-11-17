/**
 * ONE REMOTE TREE AT ONE PIN — the fetch primitive under a remote mount and a
 * KG materialisation.
 *
 * @module scripts/remote-tree
 * @graphNode none — a library: it fetches and reads, and judges nothing
 *
 * The remote mount and the content layer's KG materialiser (which re-exports
 * `gitPartFetcher`) both read through {@link RemoteTree}: shallow, blobless,
 * one commit, sparse checkout.
 *
 * A {@link RemoteTree} fetches once per (repository, commit) and answers every
 * question about that tree from it: listing a directory and reading a small
 * file cost trees and one blob, never a checkout; {@link RemoteTree.checkout}
 * then materialises exactly the paths asked for. A gitlink (a submodule entry)
 * is reported as one — `kind: "commit"` with its pinned SHA — and never
 * followed silently: the caller decides whether that pin names another tree.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { LICENCE_NAMES, git, shallowFetch, upstreamLicence } from "./sync-remote-skills.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

/** How `owner/repo` becomes a fetch URL. Injectable, so tests serve a local bare repository. */
export type UrlFor = (repository: string) => string;

/** GitHub for `owner/repo`; anything already a URL or an absolute path is used as it stands. */
export const githubUrlFor: UrlFor = (repository) =>
  /^[a-z][a-z0-9+.-]*:\/\//i.test(repository) || repository.startsWith("/") ? repository : `https://github.com/${repository}.git`;

/** One entry of a tree listing. */
export interface TreeEntry {
  /** `blob` (a file), `tree` (a directory) or `commit` (a gitlink — a submodule's pin). */
  kind: "blob" | "tree" | "commit";
  /** The object id; for `commit`, the pinned SHA of the other repository. */
  oid: string;
  /** Repository-relative path. */
  path: string;
}

export class RemoteTree {
  /** The temporary repository holding the fetched commit. */
  readonly dir: string;
  private closed = false;

  private constructor(
    readonly repository: string,
    readonly sha: string,
    dir: string,
  ) {
    this.dir = dir;
  }

  /**
   * Fetch `sha` of `repository`, shallow and blobless. Throws when the commit
   * could not be fetched, or when the remote served a different commit — the
   * caller's could-not-determine, never an empty tree.
   */
  static open(repository: string, sha: string, opts: { urlFor?: UrlFor; prefix?: string } = {}): RemoteTree {
    const dir = shallowFetch((opts.urlFor ?? githubUrlFor)(repository), sha, { blobless: true, prefix: opts.prefix ?? "remote-tree-" });
    const tree = new RemoteTree(repository, sha, dir);
    try {
      const head = git(["rev-parse", "FETCH_HEAD"], dir).trim();
      if (head !== sha) throw new Error(`the remote served ${head} for ${sha}`);
    } catch (e) {
      tree.close();
      throw e;
    }
    return tree;
  }

  /** The entry at `path`, or `undefined` when the commit holds no such path (a determinate answer). */
  entry(path: string): TreeEntry | undefined {
    const p = path.replace(/\/+$/, "");
    if (p === "") return { kind: "tree", oid: git(["rev-parse", "FETCH_HEAD^{tree}"], this.dir).trim(), path: "" };
    const line = git(["ls-tree", "FETCH_HEAD", "--", p], this.dir).trim();
    return line ? parseLsTree(line) : undefined;
  }

  /** The immediate children of directory `path` (`""` is the root). Trees only — no blob is fetched. */
  list(path: string): TreeEntry[] {
    const p = path.replace(/\/+$/, "");
    const out = git(["ls-tree", p ? `FETCH_HEAD:${p}` : "FETCH_HEAD"], this.dir);
    return out
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        const e = parseLsTree(l);
        return { ...e, path: p ? `${p}/${e.path}` : e.path };
      });
  }

  /** Every file under the commit, for a size denominator. */
  countFiles(): number {
    return git(["ls-tree", "-r", "--name-only", "FETCH_HEAD"], this.dir).split("\n").filter(Boolean).length;
  }

  private fileSet: Set<string> | undefined;

  /**
   * Every file path the commit holds (gitlinks excluded), listed once from
   * the trees — no blob is fetched. A closure walker asks "is this a file"
   * hundreds of times; one listing answers all of them (bean `mo75` G3).
   */
  files(): Set<string> {
    if (!this.fileSet) {
      // A large tree's listing (cat-harness: ~40k entries) overflows
      // spawnSync's default 1 MiB buffer, which fails with no exit status.
      // input-site: traced #4bc0be6e — lists the remote commit RemoteTree.open fetched; a run that reaches it records no hash
      inputSiteReached("remote-tree: files");
      const r = spawnSync("git", ["ls-tree", "-r", "FETCH_HEAD"], { cwd: this.dir, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
      if (r.status !== 0) throw new Error(`git ls-tree -r FETCH_HEAD failed: ${(r.stderr ?? "").trim() || r.error?.message || `exit ${r.status}`}`);
      this.fileSet = new Set(
        r.stdout
          .split("\n")
          .filter(Boolean)
          .map(parseLsTree)
          .filter((e) => e.kind === "blob")
          .map((e) => e.path),
      );
    }
    return this.fileSet;
  }

  /** A blob's bytes as text; fetches that one blob. `undefined` when `path` is not a file. */
  readText(path: string): string | undefined {
    const e = this.entry(path);
    if (e?.kind !== "blob") return undefined;
    return git(["cat-file", "blob", e.oid], this.dir);
  }

  /**
   * Check out exactly `paths` (directories end in `/`, files do not) and
   * return the working tree they are in. One sparse checkout for all of them.
   * `except` (directories, ending in `/`) are left out of what `paths` brings.
   */
  checkout(paths: readonly string[], except: readonly string[] = []): string {
    git(["sparse-checkout", "set", "--no-cone", ...paths.map((p) => `/${p}`), ...except.map((p) => `!/${p}`)], this.dir);
    git(["checkout", "-q", "FETCH_HEAD"], this.dir);
    return this.dir;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    rmSync(this.dir, { recursive: true, force: true });
  }
}

/** `<mode> SP <type> SP <oid> TAB <path>` */
function parseLsTree(line: string): TreeEntry {
  const tab = line.indexOf("\t");
  const [, type, oid] = line.slice(0, tab).split(/\s+/);
  return { kind: type as TreeEntry["kind"], oid: oid!, path: line.slice(tab + 1) };
}

// ── The KG-materialisation fetcher, moved down from core unchanged ───────────

/**
 * What a fetcher leaves behind: `part` is a directory holding the subgraph's
 * contents (`kind: "tree"`) or the one asset file under its own name
 * (`kind: "blob"`). `root` is removed by the caller.
 */
export interface FetchedPart {
  kind: "tree" | "blob" | "submodule";
  root: string;
  part: string;
  /** The upstream licence, when the part does not carry its own. */
  licence?: { name: string; file: string; upstreamPath: string };
  /** Files in the whole repository at the pin — the size gate's denominator, where it is known. */
  collectionFiles?: number;
}

/**
 * Fetch one path of a repository at a commit. `undefined`: the commit holds
 * no such path (a determinate answer). Throwing: the bytes were not read
 * (could-not-determine). Injectable, so tests need no network.
 */
export type PartFetcher = (repository: string, ref: string, path: string) => FetchedPart | undefined | Promise<FetchedPart | undefined>;

/** The real fetcher: shallow, blobless, one commit, then a sparse checkout of exactly `path` and the root licence. */
export const gitPartFetcher: PartFetcher = (repository, ref, path) => {
  const tree = RemoteTree.open(repository, ref, { prefix: "kg-materialize-" });
  try {
    // Trees only, so this costs no blob: the entry's type, and the denominator.
    const entry = tree.entry(path);
    if (!entry) return undefined;
    const collectionFiles = tree.countFiles();
    // input-site: traced #50739a0b — the scratch directory a fetched part is copied into
    inputSiteReached("remote-tree: part");
    const out = mkdtempSync(join(tmpdir(), "kg-materialize-part-"));
    if (entry.kind === "commit") return { kind: "submodule", root: out, part: out, collectionFiles };
    const kind = entry.kind === "tree" ? "tree" : "blob";
    const repo = tree.checkout([kind === "tree" ? `${path}/` : path, "LICENSE*", "LICENCE*", "COPYING*"]);
    const part = join(out, "part");
    if (kind === "tree") cpSync(join(repo, path), part, { recursive: true, verbatimSymlinks: true });
    else {
      mkdirSync(part);
      cpSync(join(repo, path), join(part, basename(path)), { verbatimSymlinks: true });
    }
    // A subgraph carrying its own licence needs no other; otherwise the
    // root's travels with the copy, as `sync-remote-skills` does for a skill.
    const own = kind === "tree" ? upstreamLicence(repo, join(repo, path)) : undefined;
    const rootName = own ? undefined : LICENCE_NAMES.find((n) => existsSync(join(repo, n)));
    let licence: FetchedPart["licence"];
    if (rootName) {
      cpSync(join(repo, rootName), join(out, rootName));
      licence = { name: rootName, file: join(out, rootName), upstreamPath: rootName };
    }
    return { kind, root: out, part, ...(licence ? { licence } : {}), collectionFiles };
  } finally {
    tree.close();
  }
};
