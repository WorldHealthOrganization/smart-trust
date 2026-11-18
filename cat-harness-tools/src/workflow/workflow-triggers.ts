/**
 * What a workflow's `on:` block says, and what it explains about a silence.
 *
 * A separate module from `ci-health.ts` on that module's own boundary:
 * *"reading YAML is not this module's business"* — which is why `hasSchedule`
 * and `noRunReason` reach it as callbacks. This is where the reading lives, so
 * the predicates are testable without executing a CLI that asks GitHub for a
 * hundred runs. An earlier draft exported them from the script and the test
 * file ran the whole report on import.
 *
 * @module folio-assistant/src/workflow/workflow-triggers
 */
import type { NoRunReason } from "./ci-health.js";

/**
 * WHY a workflow produced no run — read from the file, never asserted.
 *
 * The report printed *"(dispatch-only, or vendored for a folio)"* over a count
 * of 31. Both halves are plausible and **neither was measured**: a reader
 * cannot tell from it whether the 31 are 31 workflows that cannot fire, or 30
 * that cannot and one that should have. That is `1xhc`'s complaint at the level
 * of the report rather than the gate — a summary asserting a cause. Bean `kpcl`.
 *
 * ## The class that nearly shipped wrong
 *
 * The first draft asked *can this workflow fire at all*, by testing whether any
 * `paths:` pattern names something in the checkout. It promoted
 * `atomic-mass-gen-check.yml` to `auto-triggered` — the defect class — because
 * one of its four patterns is **its own workflow file**, which of course
 * exists. The workflow is real and can fire; it simply gates a folio's
 * generated Lean file and nobody touched those paths in the window. Naming it
 * as a defect would have been a false fire in the report written to stop the
 * report asserting things it had not measured.
 *
 * So the question is not *can it ever fire* but **is no-run EXPLAINED**:
 *
 * | verdict | meaning |
 * |---|---|
 * | `dispatch-only` | no automatic trigger at all — no run is the design |
 * | `path-filtered` | every automatic trigger is `paths:`-restricted, so no run means those paths did not change |
 * | `auto-triggered` | an automatic trigger with NO path restriction, and still no run. **Named, not counted.** |
 * | `undetermined` | no readable top-level `on:` — never folded into the benign two |
 *
 * Measured 2026-09-22 over the 39 files here: **30 `dispatch-only`**, **1
 * `path-filtered`**, **0 `auto-triggered`**, and the 8 unrestricted automatic
 * workflows all produced runs and are the report's green rows. Nothing was
 * hiding in the 31 — a result rather than a reassurance, because it is now
 * re-derived every run instead of assumed.
 *
 * `path-filtered` is **not green**. It says the silence is explained, not that
 * the workflow works; the last time it ran is a different question and this
 * report does not answer it.
 *
 * The parse is deliberately shallow — a top-level `on:` block and its two-space
 * keys, or the inline `on: push` / `on: [push, …]` forms. A shape it does not
 * recognise is `undetermined`.
 */
export function triggersOf(text: string): string[] | undefined {
  const block = /^on:\s*$\n((?:[ \t].*\n|\n)*?)(?=^\S)/m.exec(text);
  if (block) {
    const keys = [...block[1]!.matchAll(/^ {2}([a-z_]+):/gm)].map((m) => m[1]!);
    return keys.length ? [...new Set(keys)] : undefined;
  }
  const inline = /^on:[ \t]+(.+)$/m.exec(text);
  if (!inline) return undefined;
  const keys = [...inline[1]!.matchAll(/[a-z_]+/g)].map((m) => m[0]!);
  return keys.length ? [...new Set(keys)] : undefined;
}

/**
 * The automatic triggers that carry no `paths:` restriction.
 *
 * `paths-ignore` counts as unrestricted: it subtracts from everything rather
 * than restricting to something, so such a trigger fires on any push it does
 * not exclude. Treating it as a restriction would explain away a silence that
 * nothing explains.
 */
export function unrestrictedTriggers(text: string): string[] {
  const block = /^on:\s*$\n((?:[ \t].*\n|\n)*?)(?=^\S)/m.exec(text)?.[1];
  const automatic = (triggersOf(text) ?? []).filter(
    (t) => t !== "workflow_dispatch" && t !== "workflow_call",
  );
  // No block form means no per-trigger filters can have been written.
  if (!block) return automatic;
  return automatic.filter((t) => {
    const own = new RegExp(`^ {2}${t}:\\s*$\\n((?: {3,}.*\\n|\\n)*)`, "m").exec(block)?.[1];
    return own === undefined || !/^\s+paths:/m.test(own);
  });
}

/** {@link NoRunReason} for one workflow's text. */
export function whyNoRun(text: string | undefined): NoRunReason {
  if (text === undefined) return "undetermined";
  const triggers = triggersOf(text);
  if (!triggers) return "undetermined";
  const automatic = triggers.filter((t) => t !== "workflow_dispatch" && t !== "workflow_call");
  if (automatic.length === 0) return "dispatch-only";
  return unrestrictedTriggers(text).length > 0 ? "auto-triggered" : "path-filtered";
}

