#!/usr/bin/env bun
/**
 * ingest-ig-menu.ts — read a FHIR IG's navigation out of its `sushi-config.yaml`.
 *
 * Sibling of the retired `ingest-ig-artifacts.ts` (#124), and deliberately a SEPARATE ingest: that
 * one reads the IG's OUTPUT (a gh-pages tree), this one reads its SOURCE (the
 * config, in a git repository, at a commit). Two sources, two provenance
 * blocks. Folding the menu into `index.json` would give one file two answers
 * to "where did this come from".
 *
 * ```sh
 * bun run cat-harness/scripts/ingest-ig-menu.ts \
 *   --source /path/to/<ig> --out <ig>/fhir-artifact-index
 * bun run cat-harness/scripts/ingest-ig-menu.ts --out … --check
 * ```
 *
 * ## Why an ingest rather than a hand-written file
 *
 * The owner supplied the menu as a screenshot first. Typing it out was refused
 * for reasons recorded on `schemas/ig-menu.ts`: a picture carries no hrefs, and
 * a closed dropdown is indistinguishable from an empty one. The config carries
 * both, so this reads the config.
 *
 * ## Three states, and `--check` without `--source` is the third
 *
 * `--check` with no `--source` cannot compare anything: the upstream checkout
 * may not exist on this machine, which is the normal case in CI. It reports
 * that it could not determine and exits **2**, never 0 — the same line
 * `ingest-ig-artifacts.ts` draws, and for the same reason: a check that
 * silently passes over a comparison it never made is this repository's most
 * expensive recurring defect.
 *
 * @module scripts/ingest-ig-menu
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { parse as parseYaml } from "yaml";

import { igReadScope } from "./ig-read-scope.ts";

import {
  IG_MENU_SCHEMA_TAG,
  IgMenuSchema,
  type IgMenu,
  type IgMenuGroup,
  menuItemCount,
} from "../schemas/ig-menu.js";

const MENU_FILENAME = "menu.json";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith("--")
    ? process.argv[i + 1]
    : fallback;
}

/**
 * SUSHI's `menu:` is a nested MAP, not a list, and order is the file's order.
 *
 * `{Label: {Child: href}}` for a group, `{Label: href}` for a top-level page.
 * Both forms appear in one config — WHO SMART Trust's `Home` is a group while
 * a smaller IG's `Home` is often a bare page — so a parser that assumed either
 * one would silently drop the other's entries. `yaml` preserves insertion
 * order, and the top bar's order IS the config's order, so nothing is sorted
 * here.
 */
export function groupsFromSushiMenu(menu: unknown): IgMenuGroup[] {
  if (menu === null || typeof menu !== "object" || Array.isArray(menu)) return [];
  const out: IgMenuGroup[] = [];
  for (const [label, value] of Object.entries(menu as Record<string, unknown>)) {
    if (typeof value === "string") {
      // A top-level entry that is itself a page: it has an href and no
      // children. `items: []` rather than omitted — an empty group and an
      // absent one must not be the same shape downstream.
      out.push({ label, href: value, items: [] });
      continue;
    }
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const items = Object.entries(value as Record<string, unknown>)
        .filter(([, href]) => typeof href === "string")
        .map(([childLabel, href]) => ({ label: childLabel, href: href as string }));
      out.push({ label, items });
      continue;
    }
    // Neither a page nor a group. Kept with no children rather than dropped:
    // a label the IG shows is a label this file should carry, and an entry
    // that vanished here would read downstream as an IG that never had it.
    out.push({ label, items: [] });
  }
  return out;
}

function gitRef(repo: string): string | undefined {
  const r = spawnSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf-8" });
  return r.status === 0 ? r.stdout.trim() : undefined;
}

function gitRemote(repo: string): string | undefined {
  const r = spawnSync("git", ["-C", repo, "remote", "get-url", "origin"], { encoding: "utf-8" });
  return r.status === 0 ? r.stdout.trim().replace(/\.git$/, "") : undefined;
}

export function buildMenu(sourceRepo: string, readAt: string): IgMenu {
  // Refused when the repository's contentTypes.ig.include does not declare it.
  const configPath = igReadScope(sourceRepo).path("sushi-config.yaml");
  const raw = parseYaml(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
  const ref = gitRef(sourceRepo);
  const of = gitRemote(sourceRepo);
  if (ref === undefined || of === undefined) {
    throw new Error(
      `${sourceRepo} is not a git checkout — a menu with no commit is a menu with no provenance, and this refuses to write one`,
    );
  }
  const menu: IgMenu = {
    $schema: IG_MENU_SCHEMA_TAG,
    id: String(raw.id ?? ""),
    canonical: String(raw.canonical ?? ""),
    ...(raw.version ? { version: String(raw.version) } : {}),
    source: { kind: "sushi-config", of, ref, path: "sushi-config.yaml", readAt },
    groups: groupsFromSushiMenu(raw.menu),
  };
  const parsed = IgMenuSchema.safeParse(menu);
  if (!parsed.success) {
    throw new Error(
      `the menu read from ${configPath} does not validate:\n` +
        parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n"),
    );
  }
  return parsed.data;
}

if (import.meta.main) {
  const source = arg("source");
  const out = arg("out");
  const check = process.argv.includes("--check");
  if (!out) {
    console.error("usage: ingest-ig-menu.ts --source <ig-repo> --out <dir> [--check]");
    process.exit(2);
  }
  const target = join(resolve(out), MENU_FILENAME);

  if (!source) {
    // THE THIRD STATE. The upstream checkout is not on this machine, which is
    // the normal case in CI, so nothing can be compared. Exits 2 — not 0, and
    // not 1: this is "could not determine", which is neither a pass nor a
    // finding, and rendering it as either would be a lie about coverage.
    console.error("could not determine: no --source, so there is nothing to read the menu from.");
    console.error(`  ${existsSync(target) ? "The committed menu was NOT verified." : "No menu is committed either."}`);
    console.error("  Clone the IG's source repository and pass it with --source.");
    process.exit(2);
  }

  const menu = buildMenu(resolve(source), new Date().toISOString().slice(0, 10));
  const serialised = `${JSON.stringify(menu, null, 2)}\n`;

  if (check) {
    if (!existsSync(target)) {
      console.error(`✗ no ${relative(process.cwd(), target)} — the menu has never been ingested`);
      process.exit(1);
    }
    const committed = readFileSync(target, "utf-8");
    // `readAt` moves on every run and says nothing about the CONTENT, so it is
    // excluded from the comparison. `ref` is NOT: a different commit is a
    // different menu even when the labels happen to match, and hiding that
    // would make the gate pass over an upstream change.
    const strip = (t: string): string => t.replace(/"readAt": "[^"]*"/, '"readAt": "-"');
    if (strip(committed) !== strip(serialised)) {
      console.error(`✗ ${relative(process.cwd(), target)} is stale against ${source}`);
      process.exit(1);
    }
    console.log(`✓ menu current — ${menu.groups.length} group(s), ${menuItemCount(menu)} item(s)`);
    process.exit(0);
  }

  mkdirSync(resolve(out), { recursive: true });
  writeFileSync(target, serialised);
  console.log(`${relative(process.cwd(), target)}: ${menu.groups.length} group(s), ${menuItemCount(menu)} item(s)`);
  for (const g of menu.groups) console.log(`  ${g.label} — ${g.items.length}`);
}
