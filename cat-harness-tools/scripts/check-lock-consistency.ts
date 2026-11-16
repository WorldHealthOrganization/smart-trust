#!/usr/bin/env bun
/**
 * Where the locks in a composition pin DIFFERENT commits of a shared lower
 * layer: a report, never a gate (owner, 2026-11-13, "3y 1y": only the
 * top-level lock decides; see "Since 2026-11-13" below).
 *
 * @module scripts/check-lock-consistency
 * @graphNode none — a check over the index's lock and the locks of the layers it mounts
 *
 * An index mounts layers that have locks of their own: cat-harness pins
 * bootstrap, an index above it pins bootstrap AND cat-harness. When the two
 * pin different commits of bootstrap, everything cat-harness computed from
 * bootstrap and committed (its glossaries, for one) is stale in the index,
 * and the index's writers rewrite those files inside the mount on every run.
 * Measured 2026-11-06 (bean `cat-tools-sm8r`): bootstrap a83ae82d in
 * cat-harness's lock against c90ef456 in the index's, and every
 * later `state:mount` in a local gate run read cat-harness as edited. The
 * owner's ruling was "align pins"; this check keeps them aligned, red
 * instead of silent.
 *
 * ## Since 2026-11-13
 *
 * A composition mounts each layer once, at the top-level index's pin; the
 * locks inside the mounted layers are not read by the mount. So a skew this
 * report lists is what a lower layer was last tested with, not a defect, and
 * it is no longer a gate to be turned on after the re-pin (the "align pins"
 * ruling below is replaced). The stale committed files it caught move to
 * build time under option 3 of the same ruling.
 *
 * ## The rule (as reported)
 *
 * For each layer A the index's lock pins at commit `a`, and each mounted
 * layer L whose OWN lock (at the commit the index pins L) pins A at `b`:
 * `a === b`, or it is a finding. A layer L pins that the index does not
 * mount is not compared.
 *
 * ## Which pairs it judges, and when it can be green
 *
 * Every pair: the index against EVERY mounted layer that has a lock, the
 * harness and the content layers alike, not only the layers below the
 * harness. Aligning the harness's own pins (cat-harness#1570, #1097) clears
 * the pairs against cat-harness; the content layers' locks hold older pins
 * that also disagree with each other today, so this check stays red until
 * the bottom-up re-pin of every layer has landed (owner: "align pins"). It
 * is run as a gate only after that.
 *
 * ## Where a layer's lock is read
 *
 * From the mount when it is on disk (`<L path>/index.lock.json`, laid down
 * when the mount holds the layer's root). Otherwise it is read from the
 * repository at the pinned commit. A lock that cannot be read is
 * could-not-determine (exit 2), never a pass; a layer with no lock pins
 * nothing and is not a finding.
 *
 *   bun run cat check:lock-consistency [--root <index>] [--gate | --strict]
 *
 * Exit 0 aligned (or skews reported without `--gate` / `--strict`), 1 a skew
 * with `--gate` / `--strict`, 2 could not determine.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readLockFile, repositoryOwner, resolveLockJson } from "../schemas/kg/repo-owner.ts";

/** The fields of a lock this check reads. */
export interface LockLike {
  instances: { instance: string; repository: string; sha: string; path: string; upstreamRoot?: string }[];
}

export interface Skew {
  /** The shared lower layer. */
  instance: string;
  /** What the index's lock pins it at. */
  index: string;
  /** The layer whose own lock pins it differently, and at what. */
  layer: string;
  layerPins: string;
}

/** Reads a layer's lock at a commit when the mount does not hold it; undefined when it has none. */
export type LockFetcher = (repository: string, sha: string, file: string) => LockLike | undefined;

/** `git fetch --depth 1` of the one commit, then `git show <sha>:<file>`. Throws when the commit cannot be read. */
export const fetchLockFromGit: LockFetcher = (repository, sha, file) => {
  const dir = mkdtempSync(join(tmpdir(), "lock-consistency-"));
  try {
    const git = (...a: string[]) => spawnSync("git", a, { cwd: dir, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
    git("init", "-q");
    const f = git("fetch", "-q", "--depth", "1", `https://github.com/${repository}`, sha);
    if (f.status !== 0) throw new Error(`cannot fetch ${repository}@${sha.slice(0, 12)}: ${(f.stderr ?? "").trim().split("\n")[0]}`);
    const show = git("show", `${sha}:${file}`);
    if (show.status !== 0) return undefined; // the layer has no lock at that commit
    return resolveLockJson(JSON.parse(show.stdout) as LockLike, repositoryOwner(repository));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

/** The index's lock and the skews between it and each mounted layer's own lock. */
export function lockSkews(root: string, fetch: LockFetcher = fetchLockFromGit): { skews: Skew[]; undetermined: string[]; compared: number } {
  const index = readLockFile<LockLike>(join(root, "index.lock.json"));
  const pinned = new Map(index.instances.map((i) => [i.instance, i.sha]));
  const skews: Skew[] = [];
  const undetermined: string[] = [];
  let compared = 0;
  for (const layer of index.instances) {
    let own: LockLike | undefined;
    const onDisk = join(root, layer.path, "index.lock.json");
    try {
      // A mounted layer's own lock: its same-owner names are its own owner's.
      if (existsSync(onDisk)) own = resolveLockJson(JSON.parse(readFileSync(onDisk, "utf-8")) as LockLike, repositoryOwner(layer.repository));
      else own = fetch(layer.repository, layer.sha, "index.lock.json");
    } catch (e) {
      undetermined.push(`${layer.instance}: ${(e as Error).message}`);
      continue;
    }
    if (own === undefined) continue;
    for (const dep of own.instances ?? []) {
      const at = pinned.get(dep.instance);
      if (at === undefined || dep.instance === layer.instance) continue;
      compared++;
      if (at !== dep.sha) skews.push({ instance: dep.instance, index: at, layer: layer.instance, layerPins: dep.sha });
    }
  }
  return { skews, undetermined, compared };
}

/**
 * Exit code for a lock-consistency reading: `2` when any layer lock is
 * unreadable, `1` when skews exist and `--gate` / `--strict` is active, and
 * `0` otherwise (owner, 2026-11-13, "3y 1y": only the top-level lock decides;
 * agreement skews are reported, not a gate).
 */
export function exitCodeOf(
  reading: { skews: readonly Skew[]; undetermined: readonly string[] },
  opts: { gate?: boolean } = {},
): 0 | 1 | 2 {
  if (reading.undetermined.length > 0) return 2;
  if (opts.gate && reading.skews.length > 0) return 1;
  return 0;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--root");
  const root = resolve(i >= 0 ? argv[i + 1]! : process.cwd());
  const gate = argv.includes("--gate") || argv.includes("--strict");
  if (!existsSync(join(root, "index.lock.json"))) {
    console.log(`check:lock-consistency: ${root} has no index.lock.json — nothing is mounted, so nothing can be skewed`);
    process.exit(0);
  }
  const { skews, undetermined, compared } = lockSkews(root);
  for (const s of skews) {
    const mark = gate ? "✗" : "·";
    console.log(`${mark} ${s.instance}: the index pins ${s.index.slice(0, 12)}, ${s.layer}'s own lock pins ${s.layerPins.slice(0, 12)} — what ${s.layer} was last tested with`);
  }
  for (const u of undetermined) console.log(`? ${u}`);
  const code = exitCodeOf({ skews, undetermined }, { gate });
  if (code === 2) {
    console.log(`check:lock-consistency: could not determine (${undetermined.length} layer lock(s) unreadable) — not a pass`);
    process.exit(2);
  }
  if (code === 1) process.exit(1);
  console.log(
    skews.length > 0
      ? `check:lock-consistency: ${compared} shared pin(s) compared, ${skews.length} skew(s) reported (not a gate; only the top-level lock decides)`
      : `check:lock-consistency: ${compared} shared pin(s) compared, all aligned`,
  );
}
