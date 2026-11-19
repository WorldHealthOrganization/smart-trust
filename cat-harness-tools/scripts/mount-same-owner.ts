#!/usr/bin/env bun
/**
 * Turn a checkout's content-layer mounts into SAME-OWNER mounts, without
 * moving a single pin.
 *
 * @module scripts/mount-same-owner
 * @graphNode none — a one-time converter over index.config.json and index.lock.json
 *
 * WHO migration, plan step T3/T4 (owner decision Q-WP-1 = A, 2026-11-15;
 * cat-harness-tools#2337). A content repository that pins
 * another content repository under its OWN owner names it without the owner,
 * so the same commit resolves to `<fork owner>/<name>` in the fork and
 * `<new owner>/<name>` upstream (`schemas/kg/repo-owner.ts`).
 *
 * A mount is converted when all hold:
 *  - it is not a harness layer (`HARNESS_REPOSITORIES`: those stay absolute
 *    under `HARNESS_OWNER`);
 *  - its owner is this checkout's owner (a deliberate cross-owner pin stays);
 *  - it is not named in `--keep`.
 *
 * Both files are rewritten: `index.config.json` through `writeDeclaredMounts`
 * (the one writer of declared mounts) and `index.lock.json` by writing each
 * converted repository as its bare name. Refs, digests and trust are not
 * touched, so `mount:remote:check` stays as it was.
 *
 * It refuses to run in a harness repository (any of
 * `HARNESS_REPOSITORIES`): those stay put while the content moves, so their
 * pins on content layers name the owner. A layer that has ALREADY moved
 * is re-pinned to its new owner first; it then names
 * another owner and is kept.
 *
 * Do NOT run it in a repository that stays behind while the layers it pins
 * move: its pins must name the new owner
 * explicitly instead.
 *
 *   bun run cat mount:same-owner                 # report what would change
 *   bun run cat mount:same-owner --write         # change it
 *   bun run cat mount:same-owner --keep a,b      # leave a and b absolute
 *
 * Exit codes: 0 done or nothing to do · 2 unreadable input or unknown owner.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { readDeclaredMounts, writeDeclaredMounts } from "../schemas/kg/index-config.ts";
import type { RemoteMount } from "../schemas/kg/remote-mount.ts";
import {
  checkoutOwner,
  isHarnessRepository,
  relativizeLockRepositories,
  repositoryOwner,
  sameOwner,
} from "../schemas/kg/repo-owner.ts";
import { checkoutName } from "./workflow-pins.ts";

export interface SameOwnerPlan {
  owner: string;
  /** Mounts that become same-owner, as `harness = owner/name`. */
  convert: string[];
  /** Mounts already same-owner. */
  already: string[];
  /** Mounts left absolute, with why. */
  kept: Array<{ harness: string; repository: string; why: string }>;
  /** The mounts as they will be written. */
  mounts: RemoteMount[];
}

/** What {@link convertSameOwner} would do at `root`, changing nothing. */
export function planSameOwner(root: string, keep: readonly string[] = [], owner = checkoutOwner(root), self = checkoutName(root)): SameOwnerPlan {
  if (!owner) throw new Error(`cannot tell who owns ${root}: no CAT_REPO_OWNER, no origin, no GITHUB_REPOSITORY_OWNER`);
  // A harness checkout stays under HARNESS_OWNER while
  // the content layers it mounts move: its pins on them must name their
  // owner, so it is never converted.
  if (isHarnessRepository(self)) throw new Error(`${self} is a harness repository: its content-layer pins stay owner-qualified (re-pin them to the new owner instead)`);
  const plan: SameOwnerPlan = { owner, convert: [], already: [], kept: [], mounts: [] };
  for (const m of readDeclaredMounts(root).mounts) {
    let why: string | undefined;
    if (m.sameOwner === true) plan.already.push(m.harness);
    else if (keep.includes(m.harness)) why = "named in --keep";
    else if (isHarnessRepository(m.repository)) why = "a harness layer: stays under HARNESS_OWNER";
    else if (!sameOwner(repositoryOwner(m.repository), owner)) why = `another owner's (${repositoryOwner(m.repository)}), not ${owner}'s`;
    if (why !== undefined) {
      plan.kept.push({ harness: m.harness, repository: m.repository, why });
      plan.mounts.push(m);
    } else if (m.sameOwner === true) {
      plan.mounts.push(m);
    } else {
      plan.convert.push(`${m.harness} = ${m.repository}`);
      plan.mounts.push({ ...m, sameOwner: true });
    }
  }
  return plan;
}

/** Apply {@link planSameOwner}: rewrite index.config.json and index.lock.json at `root`. */
export function convertSameOwner(root: string, keep: readonly string[] = [], owner?: string): SameOwnerPlan & { lockChanged: boolean } {
  const plan = planSameOwner(root, keep, owner);
  if (plan.convert.length === 0) return { ...plan, lockChanged: false };
  writeDeclaredMounts(root, plan.mounts);
  const lockFile = join(root, "index.lock.json");
  let lockChanged = false;
  if (existsSync(lockFile)) {
    const text = readFileSync(lockFile, "utf-8");
    const repos = plan.mounts.filter((m) => m.sameOwner === true).map((m) => m.repository);
    const next = JSON.stringify(relativizeLockRepositories(JSON.parse(text), repos), null, 2) + "\n";
    if (next !== text) {
      writeFileSync(lockFile, next);
      lockChanged = true;
    }
  }
  return { ...plan, lockChanged };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const at = (f: string) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const root = resolve(at("--root") ?? process.cwd());
  const keep = (at("--keep") ?? "").split(",").filter(Boolean);
  const write = argv.includes("--write");
  try {
    const r = write ? convertSameOwner(root, keep) : { ...planSameOwner(root, keep), lockChanged: false };
    console.log(`mount:same-owner: ${root} (owner ${r.owner})`);
    for (const c of r.convert) console.log(`  ${write ? "converted" : "would convert"}  ${c}`);
    for (const a of r.already) console.log(`  already same-owner  ${a}`);
    for (const k of r.kept) console.log(`  kept  ${k.harness} = ${k.repository}: ${k.why}`);
    if (write && r.lockChanged) console.log("  index.lock.json rewritten (names only; no pin moved)");
    if (!write && r.convert.length) console.log("  run again with --write to apply");
  } catch (e) {
    console.error(`mount:same-owner: ${(e as Error).message}`);
    process.exit(2);
  }
}
