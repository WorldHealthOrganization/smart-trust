/**
 * Every layer's config is named after the layer, and no retired name
 * survives.
 *
 * The config is `<instance>.config.json`. A retired name is not read at all,
 * so a checkout still on one silently loses its settings unless something
 * says so; this does.
 *
 * ## What it checks, and the third state
 *
 * For every layer in the checkout:
 *
 *   - a config named after the layer, or none at all — both fine;
 *   - a config under the RETIRED global name — a finding, with the `git mv`
 *     to run, because nothing reads it and nothing else would say so;
 *   - a `*.config.json` at the instantiation root matching no declared
 *     layer, and no harness a subscription chose — a finding, because
 *     it is either a rename half-done or a config for a layer that is
 *     not here, and the two are worth telling apart by hand.
 *
 * COULD-NOT-DETERMINE is its own exit. An unreadable declaration means the
 * layer's name is unknown, so its filename is unknowable — reported, never
 * folded into "no finding".
 *
 * @module scripts/check-instance-config
 * @covers cat-harness
 */
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { findDeclarationFile, readDeclaration } from "../schemas/kg/cat-harness.js";
import { layerConfigFilename, LEGACY_HARNESS_CONFIG } from "../schemas/kg/harness-config.js";
import { rootConfigStems } from "../schemas/kg/instance-roots.js";

const CHECKOUT = resolve(import.meta.dir, "..", "..");

interface Finding {
  kind: "legacy" | "orphan" | "unknown";
  detail: string;
  fix?: string;
}

/** Layer roots: the checkout itself, and each immediate subdirectory that declares. */
function instanceRoots(checkout: string): string[] {
  const out: string[] = [];
  if (findDeclarationFile(checkout) !== undefined) out.push(checkout);
  for (const entry of readdirSync(checkout, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const d = join(checkout, entry.name);
    if (findDeclarationFile(d) !== undefined) out.push(d);
  }
  return out;
}

export function sweep(checkout: string): { findings: Finding[]; expected: Set<string> } {
  const findings: Finding[] = [];
  const expected = new Set<string>();

  for (const root of instanceRoots(checkout)) {
    let name: string | undefined;
    try {
      name = readDeclaration(root)?.name;
    } catch (e) {
      findings.push({
        kind: "unknown",
        detail: `${root}: declaration unreadable, so this instance's config filename is UNKNOWN — ${e instanceof Error ? e.message : String(e)}`,
      });
      continue;
    }
    if (name === undefined) {
      findings.push({ kind: "unknown", detail: `${root}: declaration names no instance` });
      continue;
    }
    expected.add(layerConfigFilename(name));
    // A harness a SUBSCRIPTION chose is instantiated by a config of its name
    // with no local declaration (`kg-instantiate.ts`, issue #1719): claimed,
    // not orphaned.
    for (const s of readDeclaration(root)?.subscriptions ?? []) {
      for (const h of s.harnesses ?? []) expected.add(layerConfigFilename(h));
    }

    // The retired name, wherever it sits: beside the declaration or at the
    // checkout root. Both are places a migration would leave one.
    for (const d of new Set([root, checkout])) {
      const legacy = join(d, LEGACY_HARNESS_CONFIG);
      if (existsSync(legacy)) {
        findings.push({
          kind: "legacy",
          detail: `${legacy} is the RETIRED global name — nothing reads it`,
          fix: `git mv ${legacy} ${join(checkout, layerConfigFilename(name))}`,
        });
      }
    }
  }

  // A `*.config.json` at the instantiation root that no layer claims.
  // `rootConfigStems` — the one scan, which excludes the retired name and the
  // reserved `index.config.json` (not a layer's config, so never an orphan).
  for (const f of rootConfigStems(checkout).map(layerConfigFilename)) {
    if (expected.has(f)) continue;
    findings.push({
      kind: "orphan",
      detail: `${join(checkout, f)} matches no declared instance in this checkout`,
      fix: "rename it to match an instance's `name`, or remove it if its instance has gone",
    });
  }

  return { findings, expected };
}

if (import.meta.main) {
  const { findings, expected } = sweep(CHECKOUT);
  console.log(`Instance configs — ${expected.size} instance(s) declared:`);
  for (const f of [...expected].sort()) {
    console.log(`  ${existsSync(join(CHECKOUT, f)) ? "✓" : "·"} ${f}`);
  }
  console.log("\n  (· = declared but no config written; a legitimate state.)");

  if (findings.length === 0) {
    console.log("\n✓ every config is named after its instance, and no retired name survives");
    process.exit(0);
  }
  console.error(`\n✗ ${findings.length} finding(s):`);
  for (const f of findings) {
    console.error(`  [${f.kind}] ${f.detail}`);
    if (f.fix) console.error(`      ${f.fix}`);
  }
  // `unknown` fails too, and says so: a sweep that could not read a
  // declaration has not established that the others are fine either.
  process.exit(1);
}
