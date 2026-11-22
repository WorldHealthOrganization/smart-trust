/**
 * The ratchet baseline for `check:derived-from`'s LAYERING GAPS: `derivedFrom`
 * edges that name a graph only a layer the declaring layer does not
 * `need` declares (a ratchet, not an error). Each entry carries why the gap is
 * real and the bean that closes it. A new gap fails the gate; a cleared one
 * leaves its entry stale until it is removed. Never add an entry to make a new
 * gap pass without the reason being a real layering fact.
 *
 * @module cat-harness/scripts/derived-from.baseline
 */
export interface DerivedFromBaselineEntry {
  instance: string;
  directory: string;
  target: string;
  reason: string;
  bean: string;
}

export const BASELINE: readonly DerivedFromBaselineEntry[] = [];
