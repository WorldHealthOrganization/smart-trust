/**
 * A bean store that a mount DETERMINED absent from this checkout, as a gate's
 * answer: not applicable here, never a pass and never "could not determine".
 *
 * @module scripts/lib/bean-store-absent
 * @graphNode none — an error type and the one exit a bean gate takes for it
 *
 * `graphReadPath` returns `refused` with `absent: true` when the `beans` graph
 * is declared for every checkout by cat-harness, kept on its branch, and this
 * checkout's remote carries no such branch (bean `x5e0`; owner, 2026-10-14:
 * "Report as absent"). A site instance such as smart-ips-pilgrimage has no bean
 * store at all, so every bean gate exited 2 there and main's own verdict was
 * red with nothing wrong (smart-ips-pilgrimage#13).
 *
 * The readers keep throwing, so a caller that has not decided what absence
 * means for it still stops. A bean GATE has decided: nothing it checks exists
 * here, so it exits {@link NOT_APPLICABLE_EXIT}, which the gate verdicts
 * (`main-verdict.py`, `compare-gates.py`) read as "does not apply in this
 * root". A store that is declared and merely NOT MOUNTED still throws a plain
 * error and the gate still exits 2: only a determined absence is excused.
 */
import { exitNotApplicable } from "./not-applicable.ts";

/** Thrown by a graph reader when a mount determined the graph (`beans`, `todos`) absent from this checkout. */
export class StoreAbsentError extends Error {
  constructor(
    readonly store: string,
    readonly reason: string,
  ) {
    super(`the ${store} store is absent from this checkout: ${reason}`);
    this.name = "StoreAbsentError";
  }
}

/** Thrown by the bean readers when the store is determined absent from this checkout. */
export class BeanStoreAbsentError extends StoreAbsentError {
  constructor(reason: string) {
    super("bean", reason);
    this.name = "BeanStoreAbsentError";
  }
}

/** In a bean gate's `catch`: exit not-applicable when `e` is a determined absence; otherwise return. */
export function exitIfBeanStoreAbsent(who: string, e: unknown): void {
  if (e instanceof BeanStoreAbsentError) exitNotApplicable(who, `this checkout has no bean store (${e.reason})`);
}
