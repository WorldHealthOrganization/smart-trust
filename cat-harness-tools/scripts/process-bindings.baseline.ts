/**
 * The wrong-direction process bindings `check-process-bindings` tolerates.
 * Each entry says why it is here and which bean clears it. The baseline only
 * shrinks: lower it with `--shrink` after a fix, and never add an entry to
 * admit a new binding.
 *
 * Keyed by file, activity id and ref, which are stable across unrelated edits.
 *
 * @module scripts/process-bindings.baseline
 */
export interface BindingBaselineEntry {
  file: string;
  node: string;
  ref: string;
  reason: string;
  bean: string;
}

// declared-path-literal: baseline entries key wrong-direction bindings by the repo-relative file that holds them
export const BASELINE: readonly BindingBaselineEntry[] = [];
