#!/usr/bin/env bun
/**
 * User scenario translation templates: one `.pot` per scenario per locale.
 *
 * A user scenario (the `user-scenario` kind) is JSON, so neither the page
 * extractor nor `translate-bpmn` reaches it, and a layer's journeys were
 * the one part of its site a translator was never handed. This writes
 * `<translations>/<locale>/user-scenarios/<name>.pot` from every file in the
 * directory the layer declares for the `user-scenario` graph, with the
 * fields `pipeline/pot-for-user-scenarios.ts` lists. A translator merges it
 * into a `.po` beside it the way they do every other template.
 *
 * ## `--check`
 *
 * As `translate-bpmn:check`: a template that is absent, differs (the
 * `POT-Creation-Date` header aside) or is left from a scenario that is gone
 * fails. A locale is one the layer already translates (a directory under
 * its translations root), so adding the first template is `--extract`, not a
 * failure of every locale at once.
 *
 * Exit codes: 0 current, 1 stale, missing or orphaned, 2 nothing to examine
 * (no declared user-scenario directory, no scenario in it, or no locale).
 *
 * Usage:
 *   bun run cat translate-user-scenarios --instance . --extract
 *   bun run cat translate-user-scenarios --instance . --check
 *
 * @covers user-scenario, translation-sources
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { directoryForGraph, localeDirIn, translationsHomeFor } from "../schemas/kg/cat-harness.js";
import { formatPot, potWithoutTimestamp } from "../pipeline/pot-extract.js";
import { extractUserScenario } from "../pipeline/pot-for-user-scenarios.js";
import { knownLocales } from "./kg-locale-export.ts";

/** The subdirectory of a locale that holds these templates. */
export const SCENARIO_TEMPLATE_DIR = "user-scenarios";

export interface ScenarioTemplatePlan {
  /** Absolute path of the template. */
  pot: string;
  /** Its content, `POT-Creation-Date` included. */
  text: string;
}

/** The templates the layer at `root` should hold, per locale and scenario; `undefined` when it declares no user-scenario directory. */
export function planScenarioTemplates(root: string): { plan: ScenarioTemplatePlan[]; scenarios: number; locales: string[] } | undefined {
  const dir = directoryForGraph(root, "user-scenario");
  if (dir === undefined || !existsSync(dir)) return undefined;
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  const locales = knownLocales(root);
  const home = translationsHomeFor(root);
  const plan: ScenarioTemplatePlan[] = [];
  for (const f of files) {
    const path = join(dir, f);
    const entries = extractUserScenario(readFileSync(path, "utf-8"), relative(root, path));
    if (entries.length === 0) continue;
    for (const locale of locales) {
      plan.push({
        pot: join(localeDirIn(home, locale), SCENARIO_TEMPLATE_DIR, `${basename(f, ".json")}.pot`),
        text: formatPot(entries, { projectName: basename(f, ".json") }),
      });
    }
  }
  return { plan, scenarios: files.length, locales };
}

function main(argv: readonly string[]): number {
  const i = argv.indexOf("--instance");
  const root = resolve(i === -1 ? "." : argv[i + 1]!);
  const extract = argv.includes("--extract");
  const check = argv.includes("--check");
  if (extract === check) {
    console.error("translate-user-scenarios: pass exactly one of --extract or --check (exit 2)");
    return 2;
  }
  const r = planScenarioTemplates(root);
  if (r === undefined) {
    console.error(`translate-user-scenarios: ${root} declares no user-scenario directory — nothing to examine (exit 2)`);
    return 2;
  }
  if (r.locales.length === 0 || r.plan.length === 0) {
    console.error(`translate-user-scenarios: ${r.scenarios} scenario(s), ${r.locales.length} locale(s) — nothing to examine (exit 2)`);
    return 2;
  }
  const want = new Set(r.plan.map((p) => p.pot));
  const orphans: string[] = [];
  const home = translationsHomeFor(root);
  for (const locale of r.locales) {
    const d = join(localeDirIn(home, locale), SCENARIO_TEMPLATE_DIR);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((x) => x.endsWith(".pot"))) if (!want.has(join(d, f))) orphans.push(join(d, f));
  }
  if (extract) {
    for (const p of r.plan) {
      const old = existsSync(p.pot) ? readFileSync(p.pot, "utf-8") : undefined;
      if (old !== undefined && potWithoutTimestamp(old) === potWithoutTimestamp(p.text)) continue;
      mkdirSync(join(p.pot, ".."), { recursive: true });
      writeFileSync(p.pot, p.text);
    }
    for (const o of orphans) console.log(`· ${relative(root, o)}: its scenario is gone — delete it once its .po is no longer wanted`);
    console.log(`✓ ${r.scenarios} scenario(s) × ${r.locales.length} locale(s): templates written under ${SCENARIO_TEMPLATE_DIR}/`);
    return 0;
  }
  const stale = r.plan.filter((p) => !existsSync(p.pot) || potWithoutTimestamp(readFileSync(p.pot, "utf-8")) !== potWithoutTimestamp(p.text));
  for (const p of stale) console.log(`✗ ${relative(root, p.pot)}: ${existsSync(p.pot) ? "stale" : "missing"} — run translate-user-scenarios --extract`);
  for (const o of orphans) console.log(`✗ ${relative(root, o)}: orphaned — its scenario is gone`);
  if (stale.length + orphans.length > 0) return 1;
  console.log(`✓ ${r.scenarios} scenario(s) × ${r.locales.length} locale(s): templates current`);
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
