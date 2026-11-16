/**
 * The hits `check-fhir-harness-exclusions` found on 2026-10-03, when the gate
 * was turned on over a layer that was not yet clean. Owner ruling that day:
 * gate now, baseline these, clear them in a second stream. Each entry says why
 * it is here and which bean clears it. The baseline only shrinks: lower it
 * with `--shrink` after a fix, and never add an entry to admit a new hit —
 * move the WHO-specific part into smart-base instead.
 *
 * Keyed by file and rule with a COUNT, not a line, because line numbers move
 * on every unrelated edit.
 *
 * @module smart-base/scripts/fhir-harness-exclusions.baseline
 */
export interface BaselineEntry {
  file: string;
  rule: string;
  count: number;
  reason: string;
  bean: string;
}

export const BASELINE: readonly BaselineEntry[] = [];
