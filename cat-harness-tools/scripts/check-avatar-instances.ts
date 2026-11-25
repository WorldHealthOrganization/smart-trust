#!/usr/bin/env bun
/**
 * Every INSTANTIATED harness has an avatar of its own — the instance axis.
 *
 * @module scripts/check-avatar-instances
 * @covers cat-harness — the instance axis: it enumerates the layers each declaration names
 *   and asks which has no avatar of its own
 *
 * `harness-tiles.ts` gives a layer with no avatar of its own `GENERIC`,
 * which is to be **reported as a finding** rather than rendered as a blank;
 * this is that report.
 *
 * `check-avatar-coverage` asks whether every declared graph TYPOLOGY has
 * art; this asks whether every INSTANTIATED harness does. The table serves
 * both key spaces.
 *
 * ## Instantiated, not merely declared
 *
 * The subject is a `<name>.config.json` at the repository root — the same
 * fact the navbar's harness tiles filter on, and the one `harness-tiles.ts`
 * calls `instantiated`. A dependency that is present but not instantiated
 * renders no tile, so it owes no mark.
 *
 * ## EXEMPT carries a reason, and a stale entry is itself a finding
 *
 * A layer that replicates someone else's identity (an organisation's
 * own mark) may be exempted in `EXEMPT`, WITH a reason, printed on every
 * clean run (as `check-invocation-parity` does). An exemption naming a
 * layer that no longer exists, or one that has since declared an avatar,
 * fails.
 *
 * Exit codes: 0 clean · 1 an instantiated harness has no avatar, or an
 * exemption is stale.
 */

import { hasAvatar } from "../schemas/content/avatars.js";
import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { instantiatedHarnessNames } from "../schemas/kg/harness-config.js";
// The HARNESS, not this layer: these scripts moved up in 70lx B2b and read cat-harness.
import { HARNESS_ROOT } from "./lib/roots.ts";

/**
 * The repository root, from THIS FILE rather than from `process.cwd()`.
 *
 * `repoRootFor(process.cwd())` was the first attempt and it walks up from
 * wherever it is handed: run from the repository root it returned the
 * PARENT, found no `*.config.json`, and reported 0 instantiated harnesses.
 * Resolving from `import.meta.dir` — `cat-harness/scripts` — gives the same
 * answer wherever the command is run from, which is what every sibling check
 * here does.
 *
 * It surfaced as the exemptions reading stale, not as a silent pass: with no
 * layers found, both were "gone", which is a
 * finding. The guard caught the check's own misconfiguration before the
 * check could report a clean run over nothing — `dh4f`, avoided rather than
 * repeated.
 */
const REPO = repoRootFor(HARNESS_ROOT);

/**
 * Why an instantiated harness may carry no mark of its own.
 *
 * The IRIS replica LEFT THIS LIST on 2026-09-23, and the exemption's own rule is
 * what removed it: an entry naming a layer that has since declared an
 * avatar fails, and this check reported exactly that before anyone noticed.
 *
 * The reason it carried — *"its mark is not this repository's to choose"* —
 * was about the LOGO, and the owner has now separated the two (paraphrased):
 * no logo on the IRIS replica's icon for now, only its organisation's blue. Using an organisation's published
 * colour with a neutral glyph is not inventing its identity, which is what the
 * exemption existed to prevent.
 *
 * The DAK IG LEFT IT on 2026-10-04 (bean `2vpn`), on the same line. Its
 * entry was an agent's call, not a ruling, and the "art of its own" it
 * pointed at was the platform owner's shared operations card. Offered the
 * choice, the owner picked a WHO-blue glyph, so the list is empty — and a
 * layer that needs to join it now needs a stated reason, as before.
 */
export const EXEMPT: Readonly<Record<string, string>> = {};

/**
 * Every instantiated harness: `index.config.json`'s layers when the root
 * has one, else each root `<name>.config.json` — `instantiatedHarnessNames`,
 * the one answer, rather than a sixth copy of the scan (which, re-implemented
 * here, would have read `index.config.json` as a harness called `index`).
 */
export function instantiatedNames(root: string): string[] {
  return instantiatedHarnessNames(root);
}

export interface Report {
  missing: string[];
  exemptUsed: string[];
  /** An exemption for a layer that is gone, or that now declares art. */
  staleExemptions: string[];
}

export function report(names: string[]): Report {
  const missing: string[] = [];
  const exemptUsed: string[] = [];
  for (const n of names) {
    if (hasAvatar(n)) continue;
    if (n in EXEMPT) exemptUsed.push(n);
    else missing.push(n);
  }
  // A STALE EXEMPTION IS A FINDING, not a tidy-up: it means somebody declared
  // art and the note saying they had not is still being printed as fact.
  const staleExemptions = Object.keys(EXEMPT)
    .filter((n) => !names.includes(n) || hasAvatar(n))
    .sort();
  return { missing, exemptUsed: exemptUsed.sort(), staleExemptions };
}

export function format(r: Report, total: number): string {
  const lines: string[] = [`Instance avatars (${total} instantiated harness(es))`];
  for (const n of r.exemptUsed) lines.push(`  · exempt  ${n} — ${EXEMPT[n]}`);
  for (const n of r.missing) {
    lines.push(`  ✗ ${n}: no avatar of its own — renders the GENERIC question mark`);
  }
  for (const n of r.staleExemptions) {
    lines.push(`  ✗ EXEMPT names ${n}, which is gone or now declares an avatar — the note is no longer true`);
  }
  if (!r.missing.length && !r.staleExemptions.length) {
    lines.push("  ✓ every instantiated harness has a mark, or an exemption that still holds");
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const names = instantiatedNames(REPO);
  const r = report(names);
  console.log(format(r, names.length));
  if (r.missing.length || r.staleExemptions.length) process.exit(1);
}
