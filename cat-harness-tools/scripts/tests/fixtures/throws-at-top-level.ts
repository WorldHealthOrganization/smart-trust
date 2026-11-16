/**
 * A checker module whose body aborts partway — the shape that took down a
 * whole `qa-sweep`. The counter is how the test tells "imported again" from
 * "served from the registry": a module that threw is never re-evaluated.
 *
 * @module scripts/tests/fixtures/throws-at-top-level
 */
const g = globalThis as { __throwsAtTopLevelEvaluations?: number };
g.__throwsAtTopLevelEvaluations = (g.__throwsAtTopLevelEvaluations ?? 0) + 1;

/** Initialised BEFORE the throw, so it is readable in the stale namespace. */
export const BEFORE_THE_THROW = 1;

function explode(): string {
  throw new Error("this checker module cannot load");
}
const _aborts_here = explode();

/**
 * Never initialised, so reading it from the stale namespace throws
 * `Cannot access ... before initialization` — and so does `Object.keys` over
 * the namespace that holds it.
 */
export const AFTER_THE_THROW: Record<string, () => void> = { noop: () => {} };
void _aborts_here;
