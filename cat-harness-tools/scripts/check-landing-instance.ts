#!/usr/bin/env bun
/**
 * The site's landing page (the layer published at `/`) is decided, not
 * guessed.
 *
 * @module scripts/check-landing-instance
 * @covers cat-harness — the instance axis: which instantiated harness the published site puts at `/`
 *
 * Rule: the chosen layer's `<name>.config.json` carries
 * `"site": { "landing": true }`. If exactly one harness is instantiated it is
 * the landing page and needs no flag. Several and none flagged fails; more
 * than one flagged gives a neutral hub listing the harnesses.
 *
 * The resolution is `resolveLandingInstance` in `schemas/kg/harness-config.ts`,
 * the only reader of the flag; this script reports its answer and fails on
 * `ambiguous`. `none` (nothing instantiated) passes.
 *
 * It also reports every legacy `<name>.config.json` an index entry still
 * imports ({@link legacyImports}): a pending migration is reported, a file
 * that disagrees with its entry fails.
 *
 * Exit codes: 0 decided (a layer, a hub, or nothing instantiated) · 1
 * several harnesses and none flagged, a config that cannot be read, or a
 * legacy config that disagrees with its index entry.
 */
import { join, resolve } from "node:path";

import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { indexAgreement, resolveLandingInstance, type IndexAgreement, type LandingInstance } from "../schemas/kg/harness-config.js";
import { importedConfigFilename, inlineOverrides, readIndexConfig } from "../schemas/kg/index-config.js";

import { readRawConfigFile } from "./instance-config.ts";

/**
 * Resolved from this file, not `process.cwd()` (`check-folio-mount` says why:
 * run from the root, `repoRootFor(cwd)` walked up to the parent and reported a
 * clean run over nothing, `dh4f`).
 */
const REPO = repoRootFor(resolve(import.meta.dir, ".."));

/** The report, and whether it fails. Pure, so the tests need no process. */
export function formatLanding(r: LandingInstance): { text: string; ok: boolean } {
  const head = `Site landing instance (${r.names.length} instantiated harness(es))`;
  switch (r.kind) {
    case "none":
      return { text: `${head}\n  · nothing is instantiated here: no \`<name>.config.json\` at the root, so there is no landing to decide`, ok: true };
    case "instance":
      return {
        text: `${head}\n  ✓ / is ${r.name}'s landing — ${
          r.by === "sole" ? "the only instantiated harness, so no flag is needed" : r.by === "index" ? "index.config.json `site.landing`" : "flagged \"site\": { \"landing\": true }"
        }`,
        ok: true,
      };
    case "hub":
      return {
        text:
          r.flagged.length === 0
            ? `${head}\n  ✓ / is the neutral hub — index.config.json says \`site.landing: "hub"\`, so it lists the harnesses and the todos`
            : `${head}\n  ✓ / is the neutral hub — ${r.flagged.length} harnesses are flagged (${r.flagged.join(", ")}), so it lists the harnesses and the todos`,
        ok: true,
      };
    case "invalid":
      return { text: `${head}\n  ✗ ${r.file} cannot decide the landing: ${r.reason}. It is authoritative, so the per-config flags are NOT consulted instead.`, ok: false };
    case "ambiguous":
      return {
        text:
          r.reason === "unreadable"
            ? `${head}\n  ✗ cannot decide: ${r.unreadable.map((n) => `${n}.config.json`).join(", ")} cannot be read (invalid JSON, or a \`site\` that is not { "landing": boolean }), and its flag decides the answer`
            : `${head}\n  ✗ ${r.names.length} harnesses are instantiated (${r.names.join(", ")}) and none is flagged.\n` +
              `    Add "site": { "landing": true } to the landing harness's own <name>.config.json — or to two or more, for a neutral hub (issue #1904).`,
        ok: false,
      };
  }
}

/**
 * Whether `index.config.json` and the root `<name>.config.json` files agree.
 * `undefined` (no index) is fine — the file scan is then the answer. A root
 * config the index does not import is a FAILURE: under the index it is not
 * instantiated, and under the old rule it was, so the two rules disagree about
 * this checkout and nothing should pick silently. An `import` naming a file
 * that is not there fails too. A layer with no config at all is fine.
 */
export function formatAgreement(a: IndexAgreement | undefined): { text: string; ok: boolean } {
  if (a === undefined) return { text: "index.config.json: absent — the root *.config.json files are the instantiated set", ok: true };
  const lines = ["index.config.json against the root *.config.json files:"];
  for (const n of a.unlisted) lines.push(`  ✗ ${n}.config.json is at the root and index.config.json does not list \`${n}\` — list it, or remove the stray config (an inherited fork file?)`);
  for (const m of a.missingImport) lines.push(`  ✗ \`${m.name}\` imports ${m.file}, which does not exist`);
  if (a.withoutConfig.length) lines.push(`  · listed with no config to import (fine): ${a.withoutConfig.join(", ")}`);
  const ok = a.unlisted.length === 0 && a.missingImport.length === 0;
  if (ok) lines.push("  ✓ every root config is listed, and every import exists");
  return { text: lines.join("\n"), ok };
}

/**
 * A root `<name>.config.json` an index entry still IMPORTS (bean `ymvt`).
 *
 * Owner, 2026-10-14: *"i thought ONLY index.config.json"* — the file is
 * imported only as a migration step, then retired. So it is reported every
 * time, and it is one of two things:
 *
 * - `pending`: a migration not yet run. Every key it holds either is not
 *   inline or is inline with the SAME value, so `index-config:migrate
 *   --inline --write` moves it with no change to the effective config. Said,
 *   not failed: the repository has one command left to run.
 * - `diverged`: NOT merely a pending migration. The entry sets a key inline to
 *   a different value, so the file's value is dead text that a reader of the
 *   file alone (a person, a stale tool) takes for the config. Fails: two
 *   places disagree about one layer, and nothing should pick silently.
 */
export interface LegacyImport {
  name: string;
  file: string;
  /** Dotted paths the entry overrides with a different value. Empty: a pending migration. */
  shadowed: string[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Leaf paths of `base` that `top` sets to something else. Objects recurse; anything else compares as JSON. */
export function shadowedPaths(base: Record<string, unknown>, top: Record<string, unknown>, at = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(top)) {
    if (!(k in base)) continue;
    const path = at ? `${at}.${k}` : k;
    const b = base[k];
    if (isObj(b) && isObj(v)) out.push(...shadowedPaths(b, v, path));
    else if (JSON.stringify(b) !== JSON.stringify(v)) out.push(path);
  }
  return out;
}

/** Every legacy config an index entry imports at `root`; `undefined` when there is no readable index. */
export function legacyImports(root: string): LegacyImport[] | undefined {
  const idx = readIndexConfig(root);
  if (idx.state !== "ok") return undefined;
  const out: LegacyImport[] = [];
  for (const entry of idx.config.instances) {
    const file = importedConfigFilename(entry);
    const raw = readRawConfigFile(join(root, file));
    if (raw === undefined) continue;
    out.push({ name: entry.name, file, shadowed: shadowedPaths(raw, inlineOverrides(entry)) });
  }
  return out;
}

/** The report on {@link legacyImports}: pending ones are said, diverged ones fail. */
export function formatLegacy(l: LegacyImport[] | undefined): { text: string; ok: boolean } {
  if (l === undefined) return { text: "", ok: true };
  if (l.length === 0) return { text: "legacy <name>.config.json: none — every instance is configured inline in index.config.json", ok: true };
  const lines = ["legacy <name>.config.json still imported by index.config.json (bean ymvt — the index is the one config):"];
  for (const x of l) {
    lines.push(
      x.shadowed.length === 0
        ? `  · ${x.file} (\`${x.name}\`): a pending migration — \`bun run cat index-config:migrate --inline --write\` moves it inline and deletes it`
        : `  ✗ ${x.file} (\`${x.name}\`) disagrees with its index entry at ${x.shadowed.join(", ")}: the entry wins, so the file's value is dead — reconcile, then \`index-config:migrate --inline --write\``,
    );
  }
  return { text: lines.join("\n"), ok: l.every((x) => x.shadowed.length === 0) };
}

if (import.meta.main) {
  const landing = formatLanding(resolveLandingInstance(REPO));
  console.log(landing.text);
  let agreement: { text: string; ok: boolean };
  try {
    agreement = formatAgreement(indexAgreement(REPO));
  } catch (e) {
    agreement = { text: `  ✗ ${(e as Error).message}`, ok: false };
  }
  console.log(agreement.text);
  let legacy: { text: string; ok: boolean };
  try {
    legacy = formatLegacy(legacyImports(REPO));
  } catch (e) {
    legacy = { text: `  ✗ ${(e as Error).message}`, ok: false };
  }
  if (legacy.text) console.log(legacy.text);
  if (!landing.ok || !agreement.ok || !legacy.ok) process.exit(1);
}
