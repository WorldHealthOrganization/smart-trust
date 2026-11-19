#!/usr/bin/env bun
/**
 * Replace the locked mounts of a layer's dependency harness with those
 * layers at `main`, for `layer-publish-context.yml`.
 *
 * A context published from the caller's `main` is built from the prefix tables
 * of every layer it transitively `needs` (`gen-instance-contexts`
 * flattens them), and by the generator itself, which lives in
 * cat-harness-tools. The folio-assistant index's lock may pin any of those
 * before the tables or the generator existed (it did on 2026-10-15: the locked
 * cat-harness-tools had no `gen-instance-contexts.ts`), so they are taken at
 * `main`, the state the caller's own `main` is published against.
 *
 * The closure is read from the declarations AT MAIN: a layer's `needs` may
 * have changed since the lock, so each layer is fetched before its `needs`
 * are followed. cat-harness-tools is always taken, with its own needs, because
 * it holds the generator. The caller itself is never replaced.
 *
 * Imports only `node:*`: it runs before `bun install`.
 *
 * Usage: bun needs-at-main.ts <index-root> <instance> [--always cat-harness-tools] [--owner <owner>]
 *
 * `--owner` (default `HARNESS_OWNER`, else litlfred) is used only for a layer
 * the lock does not name; a locked layer is fetched from the lock's `repository`.
 *
 * @module .github/scripts/layer-publish-context/needs-at-main
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

export interface LockedInstance {
  repository: string;
  /** Where the layer sits in its repository; '' or '.' for the root. */
  upstreamRoot: string;
}

/**
 * `instance → where to fetch it`, from the index lock when present: its
 * `mounts` (`harness`, cat-harness-mount-lock/v1) and the older `instances`
 * (`instance`). The lock's `repository` carries the owner, so a layer that
 * lives under another owner is fetched from there.
 */
export function lockedInstances(root: string): Map<string, LockedInstance> {
  const out = new Map<string, LockedInstance>();
  const file = join(root, "index.lock.json");
  if (!existsSync(file)) return out;
  type Entry = { instance?: string; harness?: string; repository?: string; upstreamRoot?: string };
  const lock = JSON.parse(readFileSync(file, "utf-8")) as { instances?: Entry[]; mounts?: Entry[] };
  let owner: string | undefined;
  for (const i of [...(lock.instances ?? []), ...(lock.mounts ?? [])]) {
    const name = i.instance ?? i.harness;
    if (typeof name !== "string" || typeof i.repository !== "string" || out.has(name)) continue;
    // A bare name is same-owner: the owner of the checkout holding the lock
    // (cat-harness-tools#2337, schemas/kg/repo-owner.ts).
    const repository = i.repository.includes("/") ? i.repository : `${(owner ??= rootOwner(root))}/${i.repository}`;
    out.set(name, { repository, upstreamRoot: i.upstreamRoot ?? "" });
  }
  return out;
}

/** The owner of the checkout at `root`: CAT_REPO_OWNER, origin's, GITHUB_REPOSITORY_OWNER, else {@link DEFAULT_OWNER}. */
export function rootOwner(root: string): string {
  if (process.env.CAT_REPO_OWNER?.trim()) return process.env.CAT_REPO_OWNER.trim();
  try {
    const url = execFileSync("git", ["-C", root, "remote", "get-url", "origin"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const o = url.replace(/\/+$/, "").replace(/\.git$/, "").match(/[/:]([A-Za-z0-9][A-Za-z0-9._-]*)\/[A-Za-z0-9][A-Za-z0-9._-]*$/)?.[1];
    if (o) return o;
  } catch {
    /* no origin */
  }
  return process.env.GITHUB_REPOSITORY_OWNER?.trim() || DEFAULT_OWNER;
}

/** The owner for a layer the lock does not name: `HARNESS_OWNER`, else litlfred (where the harness lives). */
export const DEFAULT_OWNER = process.env.HARNESS_OWNER || "litlfred";

/** The `needs` a declaration names, or none. */
export function needsOf(root: string, name: string): string[] {
  const file = join(root, name, `${name}.json`);
  if (!existsSync(file)) return [];
  try {
    const n = (JSON.parse(readFileSync(file, "utf-8")) as { needs?: unknown }).needs;
    return Array.isArray(n) ? n.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Walk the closure: `take(name)` lays the layer down at main (so its
 * declaration is the one read next). Returns the layers taken, in order.
 */
export function takeClosure(root: string, instance: string, always: readonly string[], take: (name: string) => void): string[] {
  const taken: string[] = [];
  const queue = [...needsOf(root, instance), ...always];
  const seen = new Set<string>([instance]);
  while (queue.length > 0) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    take(name);
    taken.push(name);
    queue.push(...needsOf(root, name));
  }
  return taken;
}

/** Lay `name` down at `root/name` from its repository's `main`, without `.git`. */
export function cloneAtMain(root: string, name: string, locked: Map<string, LockedInstance>, owner: string): void {
  const where = locked.get(name) ?? { repository: `${owner}/${name}`, upstreamRoot: "" };
  // Inside the root, dot-prefixed: a rename across filesystems (the runner's
  // /tmp and its workspace) fails with EXDEV, and a dot directory is never
  // read as a layer.
  const tmp = mkdtempSync(join(root, `.needs-at-main-${name}-`));
  try {
    execFileSync("git", ["clone", "-q", "--depth", "1", `https://github.com/${where.repository}`, join(tmp, "repo")], { stdio: "inherit" });
    const sub = where.upstreamRoot && where.upstreamRoot !== "." ? join(tmp, "repo", where.upstreamRoot) : join(tmp, "repo");
    rmSync(join(sub, ".git"), { recursive: true, force: true });
    rmSync(join(root, name), { recursive: true, force: true });
    renameSync(sub, join(root, name));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const [root, instance, ...rest] = process.argv.slice(2);
  if (!root || !instance) {
    console.error("usage: needs-at-main.ts <index-root> <instance> [--always <layer>]… [--owner <owner>]");
    process.exit(2);
  }
  const always: string[] = [];
  let owner = DEFAULT_OWNER;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--always") always.push(rest[++i]!);
    else if (rest[i] === "--owner") owner = rest[++i]!;
  }
  const locked = lockedInstances(root);
  const taken = takeClosure(root, instance, always, (name) => cloneAtMain(root, name, locked, owner));
  console.log(`taken at main for ${instance}: ${taken.join(" ") || "none"}`);
}
