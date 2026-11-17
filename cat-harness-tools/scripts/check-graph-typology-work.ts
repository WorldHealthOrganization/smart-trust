#!/usr/bin/env bun
/**
 * check-graph-typology-work.ts — every `state` graph typology has said whether it
 * records WORK.
 *
 * `recordsWork` answers the question an arriving agent asks first: is there
 * something here somebody is partway through, that I could pick up? The
 * root README's cold-start section computes its ACTIVE/STATIC verdict from
 * it, so a kind that has not decided makes that verdict quietly wrong. Not
 * all live state is work: an ingestion queue such as `uploads` is state
 * nobody is partway through.
 *
 * ## Why a gate rather than a required field
 *
 * `renderable` and `holds` are required on {@link GraphTypologyDef}, so a kind
 * cannot compile without deciding them. `recordsWork` is **optional in the
 * type on purpose**: it is meaningless for `content`, `context` and
 * `derived` — a record of what the layer IS records no position. So the
 * "cannot ship undecided" property lives here, narrowed to the `state` layer.
 *
 * @module scripts/check-graph-typology-work
 * @covers cat-harness
 */

import { defaultGraphTypologies, undecidedWorkKinds } from "../schemas/kg/cat-harness.js";

export function formatReport(undecided: readonly string[], stateKinds: number): string {
  const out: string[] = ["Graph typologies — every `state` kind says whether it records work", ""];
  // The count is printed even at zero findings: a gate that says nothing when
  // it passes cannot be told from a gate that examined nothing.
  out.push(`  ${stateKinds} kind(s) hold \`state\`; ${undecided.length} have not decided \`recordsWork\`.`);
  for (const k of undecided) {
    out.push(`      ✗ \`${k}\` — is this work somebody is partway through, or live state that is not?`);
  }
  if (stateKinds === 0) {
    out.push("NOTHING WAS EXAMINED — no kind holds `state`. That is not a pass.");
  }
  return out.join("\n");
}

if (import.meta.main) {
  const stateKinds = defaultGraphTypologies
    .names()
    .filter((n) => defaultGraphTypologies.get(n)?.holds === "state").length;
  const undecided = undecidedWorkKinds();
  const text = formatReport(undecided, stateKinds);
  (undecided.length === 0 && stateKinds > 0 ? console.log : console.error)(text);
  process.exit(undecided.length === 0 && stateKinds > 0 ? 0 : 1);
}
