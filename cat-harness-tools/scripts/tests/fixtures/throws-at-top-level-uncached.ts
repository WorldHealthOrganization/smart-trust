/**
 * The same broken module as `throws-at-top-level.ts`, for the test that must
 * reach `loadCheckerModule` FIRST.
 *
 * A second file rather than a parameter, because a module registry is keyed by
 * path: once any test in this process has imported the other fixture twice,
 * every later `import()` of it RESOLVES with the stale namespace, and a cache
 * test sharing it would be testing the registry rather than the cache.
 *
 * @module scripts/tests/fixtures/throws-at-top-level-uncached
 */
const g = globalThis as { __throwsAtTopLevelEvaluations2?: number };
g.__throwsAtTopLevelEvaluations2 = (g.__throwsAtTopLevelEvaluations2 ?? 0) + 1;

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
