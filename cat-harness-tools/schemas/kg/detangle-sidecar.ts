/**
 * The durable record of a detangle measurement — what is pinned, and what is not.
 *
 * @module schemas/detangle-sidecar
 * @graphNode schema
 *
 * `kg-detangle` writes its measurement to a committed sidecar, so a
 * regression in the authority map, the boundary arithmetic or the cohesion
 * computation shows as a diff against the last recorded value.
 *
 * ## What is pinned
 *
 * Size, cohesion, the authority and direction counts — not the verdict.
 *
 * | field | pinned | why |
 * |---|---|---|
 * | `size` | yes | a derived fact about the node set |
 * | `internal`, `inbound`, `outbound` | yes | see below — a ratio never travels alone |
 * | `cohesion` | yes | a derived fact |
 * | `enforcedBoundary`, `recordedBoundary`, `proseMentions` | yes | the authority counts |
 * | `wrongDirection`, `undeterminedDirection` | yes | the DIRECTION counts — see below |
 * | `role` | **no** | derived from the counts above; pinning it duplicates them |
 * | `verdict`, `clauses` | **no** | a threshold comparison that flips on unrelated edits |
 *
 * **`verdict` is excluded** because a group near a threshold flips on a change
 * that moved nothing about it, and a sidecar that churns stops being read.
 *
 * **The direction counts are pinned** because they are not thresholds:
 * `wrongDirection` counts edges whose `directionOf` said `wrong-direction`,
 * which changes only when an edge or a declaration changes — the event worth
 * failing on. `undeterminedDirection` (an edge whose layer declares no
 * `needs`) rides with it, so an edge moving from `wrong-direction` to
 * `undetermined` does not read as a fix.
 *
 * **The raw counts ride with `cohesion`**, per `detangle.ts`'s rule for
 * `oneWayness`: *"Reported with the raw counts, never instead of them."*
 * `cohesion` is `internal / (internal + inbound + outbound)`, so pinning the
 * ratio alone would let three edges becoming thirty pass unrecorded.
 */

import { join } from "node:path";

import { resolveDirectories } from "./cat-harness.js";

/** The pinned measurement for one candidate group. */
export interface DetangleSidecar {
  /** The schema tag, so the file declares what it is rather than being identified by shape. */
  readonly $schema: "folio-detangle-sidecar/v1";
  /** The group this measures — the same string `measure()` takes. */
  readonly group: string;
  /** Node count. */
  readonly size: number;
  /** Edges with both ends inside. */
  readonly internal: number;
  /** Edges from outside in. */
  readonly inbound: number;
  /** Edges from inside out. */
  readonly outbound: number;
  /** `internal / (internal + inbound + outbound)`, rounded — see {@link COHESION_DP}. */
  readonly cohesion: number;
  /** Boundary edges whose direction is a FACT. */
  readonly enforcedBoundary: number;
  /** Boundary edges whose direction is a FILING DECISION — symmetric coupling. */
  readonly recordedBoundary: number;
  /** Cross-group prose mentions. Neither a dependency nor a coupling. */
  readonly proseMentions: number;
  /** Outbound edges `directionOf` called `wrong-direction` — the layering is inverted. */
  readonly wrongDirection: number;
  /** Outbound edges whose direction cannot be decided, because the source layer declares no `needs`. Not clean. */
  readonly undeterminedDirection: number;
}

/**
 * Decimal places `cohesion` is pinned at.
 *
 * A float compared exactly would make the check fail on the last bit of a
 * division that nothing about the graph changed. Two places is the precision
 * the report already prints (`coh` column, `toFixed(2)`), so the pinned value
 * and the displayed one cannot disagree — which is its own small defect class.
 */
export const COHESION_DP = 2;

/** The fields, in the order they are written. One list, so the writer and the comparer cannot drift. */
export const PINNED_FIELDS = [
  "group",
  "size",
  "internal",
  "inbound",
  "outbound",
  "cohesion",
  "enforcedBoundary",
  "recordedBoundary",
  "proseMentions",
  "wrongDirection",
  "undeterminedDirection",
] as const;

/**
 * Build the sidecar for a measurement.
 *
 * Takes the whole `DetangleMetrics` and picks, rather than being handed the
 * subset: the picking IS the ruling, and putting it here means a field added
 * to `DetangleMetrics` later is excluded by default rather than silently
 * pinned because somebody spread an object.
 */
export function sidecarFor(m: {
  group: string;
  size: number;
  internal: number;
  inbound: number;
  outbound: number;
  cohesion: number;
  enforcedBoundary: number;
  recordedBoundary: number;
  proseMentions: number;
  wrongDirection: number;
  undeterminedDirection: number;
}): DetangleSidecar {
  return {
    $schema: "folio-detangle-sidecar/v1",
    group: m.group,
    size: m.size,
    internal: m.internal,
    inbound: m.inbound,
    outbound: m.outbound,
    cohesion: Number(m.cohesion.toFixed(COHESION_DP)),
    enforcedBoundary: m.enforcedBoundary,
    recordedBoundary: m.recordedBoundary,
    proseMentions: m.proseMentions,
    wrongDirection: m.wrongDirection,
    undeterminedDirection: m.undeterminedDirection,
  };
}

/**
 * The directory the sidecars live in: `detangle/` under the harness's declared
 * `qa` directory, looked up BY ID (bean `byql`: a by-kind lookup throws the
 * day a second `qa` directory is declared). One function, so the writer
 * (`kg-detangle.ts`) and every reader (`gen-uml-overview.ts`) cannot disagree
 * when the directory moves, which it did when detangle was folded into
 * cat-harness.
 */
export function detangleResultsDir(harness: string): string {
  const qaDir =
    resolveDirectories([{ name: "(local)", root: harness, own: true }]).find(
      (d) => d.id === "qa" && d.own && d.scope !== "repository",
    )?.absPath ??
    // declared-path-literal: the convention fallback, at the call site — a
    // layer declaring no `qa` directory still needs a home for the sidecars.
    join(harness, "test", "results");
  return join(qaDir, "detangle");
}

/** Where a group's sidecar lives, relative to the results directory. */
export function sidecarPathFor(group: string): string {
  return `${group}.detangle.json`;
}

/**
 * The fields that differ between a fresh measurement and a committed one.
 *
 * Returns field names rather than a boolean, because "it is stale" is not a
 * useful thing to tell somebody: the question they have next is WHICH number
 * moved, and a diff of two JSON blobs makes them find it themselves.
 */
export function staleFields(committed: unknown, fresh: DetangleSidecar): string[] {
  const c = committed as Record<string, unknown> | null;
  if (c === null || typeof c !== "object") return [...PINNED_FIELDS];
  return PINNED_FIELDS.filter((f) => c[f] !== (fresh as unknown as Record<string, unknown>)[f]);
}
