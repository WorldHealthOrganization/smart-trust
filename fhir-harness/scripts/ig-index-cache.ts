#!/usr/bin/env bun
/**
 * The IG's artefact index in the AST cache commit: `ig-cache.sh seed` runs
 * this over the tree it is about to commit, after the IG API
 * (`ig-api-cache.ts`), so a site reads the index by raw URL at the commit it
 * was built from and does not publish it (owner, 2026-11-10, card "A").
 *
 *   bun run fhir-harness/scripts/ig-index-cache.ts --ig <checkout> --tree <cache tree>
 *
 * It is `ast-to-artifact-index.ts` with the flags the site build's `compose`
 * gives it (`ig-repo-site.ts` `astArtefactPages`): the same instance id
 * (`siteName`), the grouping of an index the IG still commits, and the IG API
 * sidecars, here the tree's own `ig-api/sidecars/`. One difference, so the
 * index can be read where it lies: every `localPath` is a path in the cache
 * commit's tree (`--ast-path ""`; a resource at `resources/...`, a sidecar at
 * `ig-api/sidecars/...`), and no `sidecarBase` is written, since the commit
 * is not known before it is made. A reader resolves them against the raw URL
 * of the commit, which the site's pointer names (`index.ref.json`, `base`).
 *
 * Written to `<tree>/fhir-artifact-index/index.json`. A failure writes
 * nothing: the seed goes on without it, and a site built from that commit
 * serves the index it builds itself, as before.
 *
 * Nothing here may know about WHO (fhir-harness/AGENTS.md).
 *
 * @module fhir-harness/scripts/ig-index-cache
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { IG_API_WORK, INDEX_CACHED, siteName } from "./ig-repo-site.ts";

/** The arguments `ast-to-artifact-index.ts` is run with for the tree. Pure but for existence checks. */
export function indexCacheArgs(ig: string, tree: string, name: string): string[] {
  const args = ["--ast", tree, "--instance-id", name, "--ast-path", "", "--out", join(tree, INDEX_CACHED)];
  const published = join(ig, INDEX_CACHED);
  if (existsSync(published)) args.push("--compare", published, "--keep-published-grouping");
  const sidecars = join(tree, IG_API_WORK, "sidecars");
  if (existsSync(sidecars)) args.push("--sidecars", sidecars, "--sidecars-local", `${IG_API_WORK}/sidecars`);
  return args;
}

/** Write the artefact index into the cache tree. */
export function igIndexCache(o: { ig: string; tree: string }): { written: string } | { error: string } {
  const ig = resolve(o.ig);
  const tree = resolve(o.tree);
  const out = join(tree, INDEX_CACHED);
  // Always rebuilt, never carried from a restore.
  rmSync(dirname(out), { recursive: true, force: true });
  if (!existsSync(join(tree, "manifest.json"))) return { error: `${tree} holds no AST manifest` };
  mkdirSync(dirname(out), { recursive: true });
  const r = spawnSync("bun", ["run", join(import.meta.dir, "ast-to-artifact-index.ts"), ...indexCacheArgs(ig, tree, siteName(ig))], { cwd: ig, encoding: "utf-8" });
  if (r.status !== 0 || !existsSync(out)) {
    rmSync(dirname(out), { recursive: true, force: true });
    return { error: `ast-to-artifact-index.ts exited ${r.status}: ${(`${r.stderr ?? ""}${r.stdout ?? ""}`.split("\n").find((l) => /^error/i.test(l)) ?? `${r.stderr ?? ""}`.trim().split("\n").slice(-3).join(" "))}` };
  }
  return { written: out };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const tree = opt("--tree");
  if (!tree) {
    console.error("usage: ig-index-cache.ts [--ig <checkout>] --tree <cache tree>");
    process.exit(2);
  }
  const r = igIndexCache({ ig: opt("--ig") ?? ".", tree });
  if ("error" in r) {
    console.error(`✗ ig-index-cache: ${r.error}`);
    process.exit(1);
  }
  console.error(`ig-index-cache: the artefact index at ${r.written}`);
}
