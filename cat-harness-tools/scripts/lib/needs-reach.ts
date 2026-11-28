/**
 * Which layers reach a given one through `needs`, named once.
 *
 * "Below the harness" means every layer that does NOT reach the harness
 * through `needs` (itself counting as reaching itself). It is the rule
 * `libraries.ts` uses for the layers whose `software-library` nodes this
 * layer holds, and the one `declarations-retag.ts` and `bpmn-checklist.ts`
 * use for the layers that must not refer to a harness.
 *
 * It replaced "everything the harness transitively needs" (bean `w1gy`), which
 * broke when cat-harness#787 dropped `bootstrap-tools` from cat-harness's
 * `needs`: bootstrap-tools still sits below the harness (it needs only
 * bootstrap), but the harness no longer named it, so it was treated as above.
 * Asking whether a layer reaches the harness does not depend on which
 * lower layers the harness happens to name.
 *
 * @module scripts/lib/needs-reach
 */

/** `needs` by layer name. A name with no entry has no `needs` to follow. */
export type NeedsGraph = ReadonlyMap<string, readonly string[]>;

/** Does `name` reach `target` through `needs` (itself included)? */
export function reaches(needs: NeedsGraph, name: string, target: string): boolean {
  const seen = new Set<string>();
  const stack = [name];
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (n === target) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    stack.push(...(needs.get(n) ?? []));
  }
  return false;
}

/** Every name `name` transitively needs, itself excluded. */
function closureOf(needs: NeedsGraph, name: string): Set<string> {
  const seen = new Set<string>();
  const stack = [...(needs.get(name) ?? [])];
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (seen.has(n)) continue;
    seen.add(n);
    stack.push(...(needs.get(n) ?? []));
  }
  return seen;
}

/**
 * Every layer in `needs` that does not reach `harness` through `needs`.
 *
 * Only a layer whose whole `needs` closure is in `needs` is called below:
 * one that needs a layer this checkout does not declare (a content layer
 * mounted elsewhere, or a lone `--instance` run) might reach the harness
 * through it, and treating it as below would skip it silently. Such a
 * layer is left to the caller's check instead.
 */
export function belowHarness(harness: string, needs: NeedsGraph): Set<string> {
  return new Set(
    [...needs.keys()].filter((n) => !reaches(needs, n, harness) && [...closureOf(needs, n)].every((m) => needs.has(m))),
  );
}
