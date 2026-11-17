/**
 * A site's SCOPE: the instances whose pages a site build writes (owner,
 * 2026-11-08, Q-SZ-2 "B": scope each page writer at the source, so an IG's
 * site carries the pages of the IG and the layer it lands on, and refers to
 * every other layer's pages on that layer's own site instead of copying them).
 *
 * A writer whose Tool declares a `scope` input (flag `--scope`) is passed the
 * comma-separated instance names by `visualiser-writers.ts`; with no flag it
 * writes every instance, as before.
 *
 * @module scripts/lib/site-scope
 * @covers none — an argument helper shared by the visualiser writers
 */

/** The Tool input name a site build fills with its scope. */
export const SCOPE_INPUT = "scope";
/** The flag every scoped writer reads. */
export const SCOPE_FLAG = "--scope";

/** The scope passed in `argv`, or undefined when none was (write everything). */
export function siteScope(argv: readonly string[] = process.argv): ReadonlySet<string> | undefined {
  const i = argv.indexOf(SCOPE_FLAG);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith("--")) throw new Error(`${SCOPE_FLAG} needs a comma-separated list of instance names`);
  const names = v.split(",").map((s) => s.trim()).filter(Boolean);
  if (names.length === 0) throw new Error(`${SCOPE_FLAG} names no instance`);
  return new Set(names);
}

/** Whether `instance` is in `scope`; everything is when there is no scope. */
export function inScope(scope: ReadonlySet<string> | undefined, instance: string): boolean {
  return scope === undefined || scope.has(instance);
}

/** The scope as the flag's value. */
export function scopeArg(scope: Iterable<string>): string {
  return [...new Set(scope)].sort().join(",");
}
