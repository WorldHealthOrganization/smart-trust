/**
 * A site's SCOPE (owner, 2026-11-08, Q-SZ-2 "B"): the instances whose pages a
 * site build writes. The tools layer's `visualiser-writers.ts` passes them as
 * `--scope a,b` to a writer whose Tool declares a `scope` input: an IG's site
 * carries the pages of the IG and the layer it lands on, and links every other
 * layer's pages on that layer's own site instead of copying them.
 *
 * @module folio-assistant-core/scripts/lib/site-scope
 */

/** The scope passed in `argv`, or undefined when none was (write every instance). */
export function siteScopeArg(argv: readonly string[] = process.argv): ReadonlySet<string> | undefined {
  const i = argv.indexOf("--scope");
  if (i < 0) return undefined;
  const names = (argv[i + 1] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (names.length === 0) throw new Error("--scope needs a comma-separated list of instance names");
  return new Set(names);
}

/** The scope as it is printed in a log line. */
export function scopeLabel(scope: ReadonlySet<string>): string {
  return [...scope].sort().join(",");
}
