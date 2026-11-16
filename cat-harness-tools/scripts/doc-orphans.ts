/**
 * Pages a docs generator's output directory holds that its run did not
 * produce: shared by `gen-skill-docs.ts` and `gen-schema-docs.ts`, so the two
 * generators answer "is this page an orphan?" the same way.
 *
 * @module scripts/doc-orphans
 * @covers none — a pure helper of two generators
 */

/**
 * Pages sitting in the output directory that THIS RUN did not produce.
 *
 * `index.md` is the generator's own, so it is never an orphan.
 *
 * Pure and exported so the guard can be falsified without a corpus: on the real
 * tree the answer is now the empty set, and an empty set is exactly what a
 * guard that computes nothing also returns.
 */
export function orphanPages(onDisk: readonly string[], produced: Iterable<string>): string[] {
  const made = new Set(produced);
  return onDisk
    .filter((f) => f.endsWith(".md") && f !== "index.md" && !made.has(f.slice(0, -".md".length)))
    .sort();
}
