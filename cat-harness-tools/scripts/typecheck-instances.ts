#!/usr/bin/env bun
/**
 * typecheck-instances.ts — `tsc --noEmit` against every layer in the
 * checkout that carries a `tsconfig.json`, with TypeScript 7.
 *
 * ## Why a script and not a loop in the workflow
 *
 * In the index checkout the root owns no code and has no `tsconfig.json`, so
 * the typecheck runs per layer, each against its own config. `bun run cat gates`
 * keeps only a step's `bun …` lines and cannot run a shell loop, so one
 * command is what both CI and the local gate set can run
 * (`gates-workflows.test.ts`).
 *
 * ## Why the launcher is named by path
 *
 * TypeScript 6 stays installed as `typescript` because typescript-eslint
 * requires its JS API, so `node_modules/.bin/tsc` is TS 6 and `bunx tsc`
 * would typecheck with the wrong compiler while reading green. The TS7
 * launcher at `node_modules/typescript7/bin/tsc` can only be TS 7.
 *
 * ## Exit codes
 *
 * 0 every layer typechecks · 1 any layer fails · 2 could not determine
 * (no layer carries a `tsconfig.json`, or the TS7 launcher is missing) —
 * never 0, because a typecheck over nothing is not a pass.
 *
 * @module scripts/typecheck-instances
 * @covers none — runs the compiler; judges no graph typology
 */
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { spawn } from "node:child_process";

import { layerRootsIn, repoRootFor } from "../schemas/kg/cat-harness.js";

/** The layers under `repoRoot` that carry a `tsconfig.json`, as config paths. */
export function instanceConfigs(repoRoot: string): string[] {
  return layerRootsIn(repoRoot)
    .map((r) => join(r, "tsconfig.json"))
    .filter((p) => existsSync(p))
    .sort();
}

/** Run `tsc --noEmit -p <cfg>` across all `configs` in parallel, returning each outcome in `configs` order. */
export async function runTypechecks(
  repoRoot: string,
  tsc: string,
  configs: readonly string[],
): Promise<Array<{ rel: string; status: number; output: string }>> {
  return Promise.all(
    configs.map(
      (cfg) =>
        new Promise<{ rel: string; status: number; output: string }>((resolve) => {
          const rel = relative(repoRoot, cfg);
          const child = spawn("bun", [tsc, "--noEmit", "-p", cfg], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
          const chunks: Buffer[] = [];
          child.stdout.on("data", (d: Buffer) => chunks.push(d));
          child.stderr.on("data", (d: Buffer) => chunks.push(d));
          child.on("error", (err) => resolve({ rel, status: 1, output: `${err.message}\n` }));
          child.on("close", (code) => resolve({ rel, status: code ?? 1, output: Buffer.concat(chunks).toString("utf8") }));
        }),
    ),
  );
}

if (import.meta.main) {
  const repoRoot = repoRootFor(join(import.meta.dir, ".."));
  const tsc = join(repoRoot, "node_modules", "typescript7", "bin", "tsc");
  if (!existsSync(tsc)) {
    console.error(`typecheck:instances: no TypeScript 7 launcher at ${relative(repoRoot, tsc)} — could not determine. NOT a pass.`);
    process.exit(2);
  }
  const configs = instanceConfigs(repoRoot);
  if (configs.length === 0) {
    console.error("typecheck:instances: no instance carries a tsconfig.json — nothing was typechecked. NOT a pass.");
    process.exit(2);
  }
  const results = await runTypechecks(repoRoot, tsc, configs);
  const failed: string[] = [];
  for (const r of results) {
    if (process.env.GITHUB_ACTIONS) console.log(`::group::tsc --noEmit -p ${r.rel}`);
    else console.log(`── tsc --noEmit -p ${r.rel}`);
    if (r.output) process.stdout.write(r.output);
    if (process.env.GITHUB_ACTIONS) console.log("::endgroup::");
    if (r.status !== 0) failed.push(r.rel);
  }
  if (failed.length > 0) {
    console.error(`${failed.length} of ${configs.length} instance typecheck(s) failed: ${failed.join(", ")}`);
    process.exit(1);
  }
  console.log(`✓ ${configs.length} instance typecheck(s) passed`);
}
