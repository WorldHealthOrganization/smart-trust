#!/usr/bin/env bun
/**
 * The IG API in the AST cache commit: `ig-cache.sh seed` runs this before it
 * commits, so the sidecars a site binds are read by raw URL at the commit the
 * site was built from, as its resources are (fhir-harness#325), and no site
 * copies them (owner, 2026-11-10, card "A").
 *
 *   bun run fhir-harness/scripts/ig-api-cache.ts --ig <checkout> --into <dir>
 *
 * It runs the step a layer above provides for the IG's site,
 * `ig-site:sidecars` (`ig-repo-site.ts` §"What a layer above leaves for this
 * one"), over the checkout's `output-ast/`, in a work directory of its own,
 * and copies what the step left in `<work>/ig-api/` (`sidecars/`, `site/` and
 * the descriptor `ig-api.json`) to `<into>`. The generator's flags (the label,
 * the JSON-LD vocabulary base) are that layer's, as on the site: this layer
 * runs the step by its name and never knows what it writes. So the cache
 * holds the same files the site build would generate from the same AST.
 *
 * No layer provides the step: nothing is written, exit 0, and the site binds
 * none, as before. The step fails: exit 1 and nothing is written; the seed
 * goes on without an IG API, and a site built from that commit falls back to
 * the step's own output in its work directory (`siteIgApi`).
 *
 * Nothing here may know about WHO (fhir-harness/AGENTS.md).
 *
 * @module fhir-harness/scripts/ig-api-cache
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { scriptTable } from "@litlfred/cat-harness-tools/schemas/sdlc/script-table.ts";
import { IG_API_DESCRIPTOR, IG_API_SITE, IG_API_WORK } from "./ig-repo-site.ts";

/** The step name a layer above provides for the IG API sidecars (`build-ig-indexes.ts` `SIDECARS_STEP`). */
export const SIDECARS_STEP = "ig-site:sidecars";

export type IgApiCacheResult = { written: number; step: string } | { none: string } | { error: string };

/**
 * Copy the step's `ig-api/` output under `work` to `into`: `sidecars/`, `site/`
 * and the descriptor, nothing else. Returns the number of sidecar files, or
 * undefined when the step left none. Pure but for the file system.
 */
export function copyIgApi(work: string, into: string): number | undefined {
  const dir = join(work, IG_API_WORK);
  const sidecars = join(dir, "sidecars");
  if (!existsSync(sidecars) || readdirSync(sidecars).length === 0) return undefined;
  rmSync(into, { recursive: true, force: true });
  mkdirSync(into, { recursive: true });
  for (const f of ["sidecars", IG_API_SITE, IG_API_DESCRIPTOR]) if (existsSync(join(dir, f))) cpSync(join(dir, f), join(into, f), { recursive: true });
  return readdirSync(sidecars).length;
}

/** Run the layer-provided step over `ig` and write its output to `into`. */
export function igApiCache(o: { ig: string; into: string; log?: (s: string) => void }): IgApiCacheResult {
  const log = o.log ?? ((s: string) => console.error(s));
  const ig = resolve(o.ig);
  const entry = scriptTable(ig).get(SIDECARS_STEP);
  if (entry === undefined) return { none: `no mounted layer provides ${SIDECARS_STEP}` };
  const work = mkdtempSync(join(tmpdir(), "ig-api-cache-"));
  try {
    // The step's command is a shell command by design; the paths are passed as
    // positional parameters, never spliced into it.
    const r = spawnSync("sh", ["-c", `${entry.command} --ig "$1" --work "$2"`, "sh", ig, work], {
      cwd: ig,
      encoding: "utf-8",
      timeout: 900_000,
      env: { ...process.env, SITE_WORK: work, PATH: `${join(ig, "node_modules", ".bin")}:${process.env.PATH ?? ""}` },
    });
    if (r.status !== 0) return { error: `${SIDECARS_STEP} (${entry.manifest}) failed: ${`${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").slice(-3).join(" ")}` };
    const n = copyIgApi(work, resolve(o.into));
    if (n === undefined) return { none: `${SIDECARS_STEP} (${entry.manifest}) left no sidecars` };
    log(`ig-api-cache: ${n} sidecar file(s) from ${SIDECARS_STEP} (${entry.manifest}) in ${o.into}`);
    return { written: n, step: entry.manifest };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const into = opt("--into");
  if (!into) {
    console.error("usage: ig-api-cache.ts [--ig <checkout>] --into <dir>");
    process.exit(2);
  }
  const r = igApiCache({ ig: opt("--ig") ?? ".", into });
  if ("error" in r) {
    console.error(`✗ ig-api-cache: ${r.error}`);
    process.exit(1);
  }
  if ("none" in r) console.error(`ig-api-cache: ${r.none}; the cache holds no IG API`);
}
