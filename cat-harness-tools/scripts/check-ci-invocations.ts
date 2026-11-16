#!/usr/bin/env bun
/**
 * Every `--check` CI runs that is NOT a `package.json` script.
 *
 * Sweeping `package.json`'s `check:*` and `*:check` entries says nothing
 * about the workflows, which also invoke generators DIRECTLY:
 *
 *     run: bun run cat-harness-tools/scripts/gen-skill-docs.ts --check
 *
 * This runs those, so a local sweep covers what CI will run.
 *
 * The invocations are DISCOVERED in the workflow YAML, not listed here, so a
 * new one is covered the day it is added.
 *
 * Usage:  bun run cat-harness-tools/scripts/check-ci-invocations.ts [--list]
 * Exit:   0 all pass · 1 one failed · 2 nothing found, which is not a pass.
 *
 * @module scripts/check-ci-invocations
 * @covers none — .github/workflows/ is not a declared graph typology
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { gateOwnsFile } from "./lib/gate-own.ts";

const REPO = resolve(import.meta.dir, "../..");
const WORKFLOWS = join(REPO, ".github", "workflows");

/**
 * `bun run <script>.ts --check [flags]`, as a workflow spells it, or
 * `bun <script>.ts --check [flags]`, which bun runs the same way.
 *
 * cat-harness-tools#1701: smart-ips-pilgrimage's `translations.yml` runs
 * `bun input/scripts/translation-pot.ts --check` with no `run`, so the gate
 * found nothing in that root and exited 2 ("could not determine") although
 * the root's CI does run a direct `--check`. The bare form must END after its
 * flags (end of line, or a shell operator), so a call that takes a positional
 * or valued argument the gate cannot reproduce (`--check --repo "$own"`) is
 * not run with that argument cut off; the `bun run` form is matched exactly as
 * before.
 */
const INVOCATION =
  /bun run ([\w/.-]+\.ts)((?:\s+--[\w-]+)*\s+--check(?:\s+--[\w-]+)*)|bun ([\w/.-]+\.ts)((?:[ \t]+--[\w-]+)*[ \t]+--check(?:[ \t]+--[\w-]+)*)(?=[ \t]*(?:$|[|;&)#]))/gm;

export interface CiInvocation {
  script: string;
  args: string[];
  workflow: string;
}

/** Read them out of the YAML. Deduplicated on script + args, not on file. */
export function ciInvocations(dir = WORKFLOWS): CiInvocation[] {
  if (!existsSync(dir)) return [];
  const seen = new Map<string, CiInvocation>();
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))) {
    const text = readFileSync(join(dir, f), "utf-8");
    for (const m of text.matchAll(INVOCATION)) {
      const script = (m[1] ?? m[3])!;
      // A workflow may run it from a subdirectory; only what exists from the
      // repository root is runnable here, and anything else is reported
      // rather than silently dropped.
      const args = (m[2] ?? m[4])!.trim().split(/\s+/);
      seen.set(`${script} ${args.join(" ")}`, { script, args, workflow: f });
    }
  }
  return [...seen.values()].sort((a, b) => a.script.localeCompare(b.script));
}

if (import.meta.main) {
  // In a layer's PR checks, only the caller's own workflows (owner ruling
  // 2026-11-05, "Move the checks"; `lib/gate-own.ts`). In a layer root the
  // workflows are the index's, so a layer is not judged on them.
  const all = ciInvocations();
  const found = all.filter((i) => gateOwnsFile(`.github/workflows/${i.workflow}`) !== false);
  if (found.length === 0 && all.length > 0) {
    console.log(`✓ check:ci-invocations: none of the ${all.length} invocation(s) is in a workflow the caller commits; the root's own CI judges them.`);
    process.exit(0);
  }
  if (found.length === 0) {
    console.error("no `--check` invocation found in .github/workflows/.");
    console.error("  Nothing was checked. That is `could not determine`, not a pass.");
    process.exit(2);
  }
  if (process.argv.includes("--list")) {
    for (const i of found) console.log(`${i.script} ${i.args.join(" ")}   (${i.workflow})`);
    process.exit(0);
  }

  let failed = 0;
  let skipped = 0;
  for (const i of found) {
    if (!existsSync(join(REPO, i.script))) {
      // REPORTED, and deliberately not a failure.
      //
      // A folio-side script is absent here BY DESIGN: `AGENTS.md` says so in
      // as many words — *"`qa-sweep` and `witness-refresh` fail by design in
      // this repo ... the platform carries no folio."* Failing on it would
      // make this gate red forever in the one repository it lives in, and a
      // gate that always fails is a gate somebody switches off.
      //
      // It is still PRINTED, because "this checkout cannot run it" and "it
      // passed" are different facts, and the count below keeps them apart.
      console.log(`·   ${i.script} — named by ${i.workflow}, not in this checkout (folio-side)`);
      skipped += 1;
      continue;
    }
    const r = Bun.spawnSync(["bun", "run", i.script, ...i.args], { cwd: REPO });
    const ok = r.exitCode === 0;
    if (!ok) failed += 1;
    console.log(`${ok ? "✓" : "✗"}   ${i.script} ${i.args.join(" ")}`);
    if (!ok) {
      const out = new TextDecoder().decode(r.stdout).trim().split("\n").slice(-6);
      for (const l of out) console.log(`      ${l}`);
    }
  }
  console.log(
    `\n${found.length} CI invocation(s): ${found.length - failed - skipped} passed, ` +
      `${failed} failed, ${skipped} not in this checkout.`,
  );
  // Only a real failure is a failure; see the `·` branch above.
  process.exit(failed > 0 ? 1 : 0);
}
