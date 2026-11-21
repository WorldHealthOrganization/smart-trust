#!/usr/bin/env bun
/**
 * check-asset-roles.ts — every required asset role has decided its layer, and
 * no layer restates on an asset what the ROLE already answers.
 *
 * Two halves of one rule: `ASSET_ROLES` is the single place a role says what
 * it is for, which layer it belongs to and how it reaches its reader. This
 * gate keeps that place SINGLE.
 *
 * ## Stray keys
 *
 * `KgAssetSchema` is a non-strict `z.object` (so a downstream layer can
 * carry a key this layer does not know), which drops an unknown key without
 * a word. A key restated on an asset would vanish silently, so the RAW
 * declaration is what gets asked.
 *
 * ## Layers
 *
 * `AssetRoleDef.layer` is required, and `tsc` refuses a role that does not
 * say. This half catches the other direction: a role in
 * `REQUIRED_ASSET_ROLES` that `ASSET_ROLES` does not govern at all. The two
 * lists are separate (what every layer must declare; what a role means),
 * and only this gate makes them agree.
 *
 * @module scripts/check-asset-roles
 * @covers cat-harness — `ASSET_ROLES` against what each layer's declaration restates on an
 *   asset
 */

import {
  ASSET_ROLES,
  REQUIRED_ASSET_ROLES,
  ROLE_OWNED_ASSET_KEYS,
  assetRoleLayer,
  layerRootsIn,
  processMayWriteAsset,
  strayAssetRoleKeys,
} from "../schemas/kg/cat-harness.js";

export interface AssetRoleReport {
  /** Roles every layer must declare that `ASSET_ROLES` does not govern. */
  ungoverned: string[];
  /** Governed roles a running process would be permitted to write. */
  writable: string[];
  /** Asset declarations restating a role-owned key. */
  stray: Array<{ root: string; asset: string; key: string }>;
  /** How many layer declarations were read. */
  instances: number;
}

export function formatReport(r: AssetRoleReport): string {
  const out: string[] = ["Asset roles — one place says what a role is, and only one", ""];
  // Counts printed even at zero findings: a gate that says nothing when it
  // passes cannot be told from a gate that examined nothing.
  out.push(
    `  ${Object.keys(ASSET_ROLES).length} governed role(s); ` +
      `${REQUIRED_ASSET_ROLES.length} required of every instance; ` +
      `${r.instances} declaration(s) read; ` +
      `${ROLE_OWNED_ASSET_KEYS.length} key(s) an asset may not restate.`,
  );
  out.push(
    `  ${r.ungoverned.length} required role(s) ungoverned; ` +
      `${r.writable.length} writable by a running process; ` +
      `${r.stray.length} stray key(s) on an asset.`,
  );
  for (const role of r.ungoverned) {
    out.push(
      `      ✗ \`${role}\` — required of every instance and \`ASSET_ROLES\` does not say ` +
        "what it is for, which layer it holds, or how it is delivered",
    );
  }
  for (const role of r.writable) {
    out.push(
      `      ✗ \`${role}\` — declares \`layer: "${assetRoleLayer(role)}"\`, so a running step ` +
        "may rewrite it. Both required roles are read at session start and authored by a human.",
    );
  }
  for (const s of r.stray) {
    out.push(
      `      ✗ ${s.root}: asset \`${s.asset}\` carries \`${s.key}\` — the ROLE answers that, ` +
        "and the schema strips this key without a word, so it reads as declared and is not",
    );
  }
  if (r.instances === 0) {
    out.push("NOTHING WAS EXAMINED — no instance declaration was read. That is not a pass.");
  }
  return out.join("\n");
}

export function collect(repoRoot: string): AssetRoleReport {
  const roots = layerRootsIn(repoRoot);
  return {
    ungoverned: REQUIRED_ASSET_ROLES.filter((r) => assetRoleLayer(r) === undefined),
    // `=== true` and not truthiness: `undefined` is the third state and an
    // ungoverned role is reported above, not a second time as writable.
    writable: Object.keys(ASSET_ROLES).filter((r) => processMayWriteAsset(r) === true),
    stray: roots.flatMap((r) => strayAssetRoleKeys(r)),
    instances: roots.length,
  };
}

export function isClean(r: AssetRoleReport): boolean {
  return (
    r.instances > 0 && r.ungoverned.length === 0 && r.writable.length === 0 && r.stray.length === 0
  );
}

if (import.meta.main) {
  const report = collect(process.cwd());
  const text = formatReport(report);
  (isClean(report) ? console.log : console.error)(text);
  process.exit(isClean(report) ? 0 : 1);
}
