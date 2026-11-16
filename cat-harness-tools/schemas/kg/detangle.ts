/**
 * Detangling — is this candidate subgraph really a subgraph?
 *
 * @module schemas/detangle
 * @graphNode schema
 *
 * ## The criterion
 *
 * A candidate subgraph is a large collection of thematically related content
 * that the rest of the graph references while it references little outside
 * itself: a near-**sink**, arrows mostly one way. That is **not** a small cut:
 * ten edges in and ten out cannot be lifted, fifty in and zero out lifts
 * cleanly. A near-sink is a node set with no wrong-direction edges out of it.
 *
 * ## Four numbers
 *
 *   - **size** — |S|. A two-node candidate is a file move and does not need a
 *     declaration.
 *   - **cohesion** — internal / (internal + boundary): the evidence for
 *     "thematically related". A directory whose files never reference each
 *     other is a folder, not a subgraph.
 *   - **inbound** — edges from the rest into S. High is GOOD.
 *   - **outbound** — edges from S to the rest. **This is the one that must be
 *     near zero**, and every outbound edge is an item on the detangling
 *     worklist.
 *
 * `oneWayness = inbound / (inbound + outbound)` is reported ALONGSIDE the
 * counts, never instead: 1.0 from `5/(5+0)` and from `500/(500+0)` are very
 * different facts.
 *
 * ## The cut classification
 *
 * Every outbound edge is a module that must move, a dependency that must
 * invert, or a documented exception — only the first is free. An edge whose
 * kind cannot be determined is `unclassified` and counted separately, never
 * quietly called essential.
 *
 * ## Nothing here decides — judgement is a declared step
 *
 * This module is a **mechanical reviewer** (the severity/weight split of
 * `schemas/sdlc/qa-review.ts`). It emits {@link DetangleFinding} with a
 * `script` reviewer and a `severity`, and has no opinion about whether to
 * carve. The carve is a `Decision` by a human or agentic adjudicator, which
 * may **overrule** any finding; the numbers make that decision reviewable
 * ("carved anyway, cohesion 0.31, because X").
 *
 * So a failing clause is **never** a refusal: `failingClauses` returns the
 * clauses, not a boolean, so the adjudicator can answer them one at a time.
 */
import type { DirectionVerdict } from "./layer-direction.js";

/** A node in whatever graph is being detangled. Deliberately not a file: modules, skills, blocks and Lean declarations are all nodes. */
export interface DetangleNode {
  id: string;
  /** The candidate grouping under test — a directory, a package, a proposed repo. */
  group: string;
}

/**
 * Which way a group's boundary edges point.
 *
 * - `sink` — the rest depends on it; it depends on little. Lifts out as a
 *   DEPENDENCY: other layers declare they need it.
 * - `source` — it depends on the rest; nothing depends on it. Lifts out as a
 *   DEPENDENT: it declares what it needs. Equally separable, opposite
 *   declaration direction.
 * - `tangled` — arrows both ways in comparable numbers. This is the one that
 *   is not separable without real work, and the only one the word
 *   "entangled" should be used for.
 * - `isolated` — no boundary edges at all. Trivially separable, and NOT the
 *   same as tangled however similar the bare `oneWayness` of 0.0 looks.
 * - `undetermined` — the boundary is made of `recorded` edges, whose direction
 *   is a filing decision rather than a fact, so no role can be read off it.
 *   This is the three-state rule the rest of this repository already runs on:
 *   "could not determine" is a distinct answer from "determined to be a
 *   source", and collapsing them is how a wrong partition looks like a clean
 *   one. Under the first cut of this module `processes` and
 *   `scenarios` were both confidently `source` on 100% recorded edges.
 */
export type BoundaryRole = "sink" | "source" | "tangled" | "isolated" | "undetermined";

/**
 * Whether an edge's DIRECTION is a fact or a filing decision.
 *
 * The owner, 2026-09-20, in four words: *"are arrows in wrong direction
 * somewhere?"* Measured the same hour: **470 of 498 cross-group edges — 94% —
 * are `recorded`.**
 *
 * - `enforced` — reverse it and something breaks. A TypeScript `import`, a
 *   BPMN `calledElement`. The direction is a property of the system.
 * - `recorded` — the direction is WHERE THE AUTHOR PUT THE POINTER.
 *   `<bootstrap.processes:skill ref="S">` is written on the diagram, so the arrow runs
 *   diagram → skill. Had the repository put `workflows: [...]` in each skill's
 *   front matter instead, the identical coupling would be stored the other way
 *   and `processes` would measure as a sink rather than a source.
 *
 * The test that settles it is **what breaks each way**. Delete a skill and
 * `roles.json` has a dangling ref; delete `roles.json` and every skill still
 * works but no lane can reach one. Both break — so the coupling is SYMMETRIC
 * and merely written down once, on one side.
 *
 * A third level sits below both. A `prose` edge is a MENTION — one skill naming
 * another in running text, with no link and no declaration. The owner,
 * 2026-09-20: *"if prose is issue, means maybe prose is in wrong place. some
 * needs to be moved (e.g. no forward referencing examples?)."* So a prose
 * mention is not evidence of dependency at all; it is evidence that a sentence
 * may be sitting in the wrong file. Measured here: **315 prose-only cross-group
 * mentions**, 144 out of `folio-core` and 90 out of `folio-paper-adapter`.
 *
 * It is counted and reported, and it enters NEITHER `role` nor the boundary
 * ratios. Letting the weakest evidence move a verdict is how a suspicion
 * becomes a finding.
 *
 * This repository already names the same failure one graph over. `AGENTS.md`:
 * *"Never populate `uses[]` from Lean — it destroys the signal every ordering
 * metric is computed from."* `uses[]` is the editorial relation and the Lean
 * graph is the formal one; they look alike and mean different things, and the
 * rule exists because where a fact is recorded determines what a metric over it
 * means. `bpmn-skill` and `ts-import` are that pair again.
 */
export type EdgeAuthority = "enforced" | "recorded" | "prose";

/** A directed edge. `from` depends on / references `to`. */
export interface DetangleEdge {
  from: string;
  to: string;
  /** How the edge was found, e.g. `md-link`, `bpmn-skill`, `ts-import`. Provenance, so a surprising edge can be re-checked rather than argued with. */
  via: string;
  /** Whether {@link EdgeAuthority the direction} may be trusted. */
  authority: EdgeAuthority;
}

/**
 * What an outbound edge would cost to remove.
 *
 * Ordered cheapest-first. The order is the review order: a candidate whose
 * outbound edges are all restatements is a rename away from being a subgraph,
 * and one whose edges are all essential needs a declared dependency before it
 * can move at all.
 */
export const CUT_KINDS = ["restatement", "wrong-direction", "essential", "unclassified"] as const;
export type CutKind = (typeof CUT_KINDS)[number];

export interface ClassifiedEdge extends DetangleEdge {
  kind: CutKind;
  /** Why it was classified so. A classification with no basis is an assertion. */
  basis: string;
}

/**
 * The cut kind a DIRECTION verdict supports — and only that.
 *
 * `wrong-direction` is mechanical: the edge leaves a layer for one its
 * declared `needs` does not reach, and `layer-direction.ts` decides it for
 * `check:partition` too, so the two tools cannot disagree about one edge
 * (bean `j79e`). Everything else stays `unclassified` with the verdict as
 * its basis. `restatement` and `essential` are judgements about what the
 * target MEANS, and this package's rule is that the carve is an
 * adjudication — a function that guessed them would turn a reason to look
 * into a finding.
 */
export function classifyByDirection(e: DetangleEdge, d: DirectionVerdict): ClassifiedEdge {
  return { ...e, kind: d.verdict === "wrong-direction" ? "wrong-direction" : "unclassified", basis: d.basis };
}

export interface DetangleMetrics {
  group: string;
  size: number;
  /** Edges with both ends inside the group. */
  internal: number;
  /** Edges from outside INTO the group. High is good. */
  inbound: number;
  /** Edges from the group OUT. Must be near zero; each is a worklist item. */
  outbound: number;
  /** internal / (internal + inbound + outbound). Zero when the group has no edges at all — which is a folder, not a subgraph. */
  cohesion: number;
  /** inbound / (inbound + outbound). Reported with the raw counts, never instead of them. */
  oneWayness: number;
  /**
   * How one-way the boundary is, REGARDLESS of which way it points:
   * `|2 * oneWayness - 1|`. 1.0 is perfectly one-way, 0.0 is perfectly balanced.
   *
   * This is the correction of a real defect. The owner's clause is *"arrows
   * mostly one way"*, and `oneWayness` alone scores `0.0` both for a group with
   * fifty edges each way (genuinely tangled) and for one with zero in and 334
   * out (perfectly one-way, pointing outward). Measured 2026-09-20,
   * `processes` scored 0.00 on `oneWayness` while being the single most
   * one-way group in the repository.
   */
  directionality: number;
  /** Which way the arrows point. See {@link BoundaryRole}. */
  role: BoundaryRole;
  /** Boundary edges whose direction is a fact. `role` is read off these ALONE. */
  enforcedBoundary: number;
  /**
   * Boundary edges whose direction is a filing decision. Reported as SYMMETRIC
   * COUPLING — a real finding about how tied together two groups are — never as
   * directed dependency.
   */
  recordedBoundary: number;
  /**
   * Cross-group PROSE MENTIONS. Not a dependency and not a coupling: a count of
   * sentences that name something living elsewhere. High means "look at whether
   * this prose is in the right file", not "this group is entangled".
   */
  proseMentions: number;
  /** Distinct nodes outside the group that are referenced. The DEPENDENCY count, as against the reference count. */
  distinctTargets: number;
  /** Distinct groups outside that are referenced. What a declared dependency list would actually hold. */
  distinctTargetGroups: number;
  /** The outbound edges themselves — the detangling worklist. */
  worklist: DetangleEdge[];
  /**
   * The INTERNAL edges themselves, not just their count.
   *
   * Added 2026-09-27 because the `maxSize` clause shipped advice nobody could
   * act on: it tells a reader *"the internal clusters are the seam; splitting
   * along them cuts few edges"* while `internal` was a bare number and the
   * edges existed nowhere — not in the committed sidecar, not in `--json`.
   * `worklist` looks like it would hold them and does not; it is the OUTBOUND
   * list, 15 entries where `internal` was 154.
   *
   * A finding whose remedy names evidence the tool does not emit is a finding
   * that cannot be adjudicated, and §"taste is a declared step" makes the carve
   * an adjudication — so the adjudicator has to be handed the seam.
   *
   * Not projected into the committed sidecar: 154 edges across 29 groups is a
   * query, not a measurement, and the sidecar already omits `worklist` for the
   * same reason.
   */
  internalEdges: DetangleEdge[];
}

/** Metrics for one candidate group. */
export function measure(group: string, nodes: DetangleNode[], edges: DetangleEdge[]): DetangleMetrics {
  const inGroup = new Set(nodes.filter((n) => n.group === group).map((n) => n.id));
  const known = new Map(nodes.map((n) => [n.id, n.group]));
  const internalEdges: DetangleEdge[] = [];
  let inbound = 0;
  const worklist: DetangleEdge[] = [];
  /** Every boundary edge, either direction — needed to weigh enforced against recorded. */
  const boundary: DetangleEdge[] = [];
  let prose = 0;
  for (const e of edges) {
    // An edge to a node we do not know about is not an edge out of the group —
    // it is an unresolved reference, and counting it as outbound would make
    // every group with a broken link look tangled. It is reported by the
    // scanner as a dangling reference instead, which is a different finding.
    if (!known.has(e.from) || !known.has(e.to)) continue;
    if (e.authority === "prose") {
      // Counted, never weighed. See EdgeAuthority: the weakest evidence in the
      // graph must not be able to move a verdict.
      if (inGroup.has(e.from) && !inGroup.has(e.to)) prose += 1;
      continue;
    }
    const f = inGroup.has(e.from);
    const t = inGroup.has(e.to);
    if (f && t) internalEdges.push(e);
    else if (!f && t) { inbound += 1; boundary.push(e); }
    else if (f && !t) { worklist.push(e); boundary.push(e); }
  }
  const outbound = worklist.length;
  const internal = internalEdges.length;
  const total = internal + inbound + outbound;
  const oneWayness = inbound + outbound === 0 ? 0 : inbound / (inbound + outbound);
  // The role is read off ENFORCED edges only. A boundary made of recorded ones
  // is undetermined, however lopsided it looks: the lopsidedness is then a fact
  // about where pointers are filed, not about which side depends on the other.
  const enforcedBoundary = boundary.filter((e) => e.authority === "enforced").length;
  const recordedBoundary = boundary.length - enforcedBoundary;
  const eIn = boundary.filter((e) => e.authority === "enforced" && !inGroup.has(e.from)).length;
  const eRatio = enforcedBoundary === 0 ? 0 : eIn / enforcedBoundary;
  const role: BoundaryRole =
    inbound + outbound === 0 ? "isolated"
    : enforcedBoundary === 0 ? "undetermined"
    : eRatio >= 0.8 ? "sink"
    : eRatio <= 0.2 ? "source"
    : "tangled";
  const targets = new Set(worklist.map((e) => e.to));
  const targetGroups = new Set(worklist.map((e) => known.get(e.to)!));
  return {
    group,
    size: inGroup.size,
    internal,
    internalEdges,
    inbound,
    outbound,
    // Measured against the boundary only. Dividing by `total` made cohesion and
    // one-wayness both dominated by `outbound`, so a source-like group failed
    // two clauses for ONE underlying reason and read as twice as bad as it was.
    // `processes` has 41 internal edges among 41 diagrams — a well
    // connected family — and scored 0.11 because 334 outward references swamped
    // them.
    cohesion: total === 0 ? 0 : internal / total,
    oneWayness,
    directionality: inbound + outbound === 0 ? 1 : Math.abs(2 * oneWayness - 1),
    role,
    enforcedBoundary,
    recordedBoundary,
    proseMentions: prose,
    distinctTargets: targets.size,
    distinctTargetGroups: targetGroups.size,
    worklist,
  };
}

/**
 * Whether a group is a candidate, and if not, which clause it fails.
 *
 * Returns the FAILING CLAUSES rather than a boolean, for the reason
 * `freshness()` in `materialization.ts` returns four verdicts: "too small",
 * "not actually related" and "still wired into everything" call for three
 * different responses, and a boolean sends all three down one branch.
 */
export const DEFAULT_THRESHOLDS = {
  /** "large collection" — below this it is a file move. */
  minSize: 5,
  /**
   * Above this, one subgraph is too many things — the BREAK-APART bound, added
   * 2026-09-27 on the owner's *"call out if subgraph gets too large… sign to
   * break apart"*.
   *
   * ## The size criterion existed in one direction only
   *
   * `minSize` asks "is this big enough to BE a subgraph?" and nothing asked
   * whether it had stopped being one. So a directory could grow without limit
   * and every clause stayed green.
   *
   * ## The basis, because a bare number would be rejected here
   *
   * `uml:overview` renders each of these groups as ONE diagram. The bound is
   * where that diagram stops being readable by a person, which is a property of
   * the artefact rather than of today's corpus — so it does not drift when the
   * corpus grows, and growing everything cannot hide the finding. A percentile
   * of the measured set was the alternative and was rejected for exactly that:
   * a recorded value that moves on every commit is the `do70` defect.
   *
   * 70 rather than 60 or 80 because those are the same judgement to one
   * significant figure, and pretending otherwise would dress a round number as
   * a measurement.
   */
  maxSize: 70,
  /** "thematically related" — the files must actually reference each other. */
  minCohesion: 0.5,
  /** "arrows mostly one way" — the owner's clause, as a number, and DIRECTION-BLIND. */
  minDirectionality: 0.8,
  /**
   * "maybe some light detangling" — counted in DISTINCT groups referenced, not
   * in raw references. 334 references from `processes` resolve to 57
   * files in 6 packages; the thing a declared dependency list would hold is
   * SIX. Counting multiplicity made one dependency stated 36 times
   * (`document-intake.md`, from the ingestion diagrams) look like 36 problems.
   */
  maxTargetGroups: 3,
} as const;

export type Thresholds = typeof DEFAULT_THRESHOLDS;

/**
 * The connected components of a group's INTERNAL edge graph, largest first —
 * the seam a carve would cut along, computed rather than guessed.
 *
 * ## Why components, and what they are not
 *
 * This is the cheapest honest answer to *"where would this split?"*. Two files
 * in different components do not reference each other at all, directly or
 * transitively, so separating them cuts **zero** internal edges. That makes a
 * component boundary the one split with no coupling cost, and it is a fact
 * rather than a preference.
 *
 * It is NOT the carve. A component may still be several subjects, and two
 * components may belong together for reasons no edge records — which is exactly
 * what §"taste is a declared step" reserves for an adjudicator. Components are
 * the evidence put in front of that decision, and singletons are the loudest
 * part of it: a file in a component of one is referenced by nothing in its own
 * group, so its membership rests entirely on which directory it sits in.
 *
 * Union-find rather than a traversal, because the input is an edge list and
 * this keeps it one pass with no adjacency map to build.
 */
export function internalClusters(m: Pick<DetangleMetrics, "internalEdges">, members: readonly string[]): string[][] {
  const parent = new Map<string, string>(members.map((id) => [id, id]));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r) ?? r;
    // Path compression, so a long chain does not make the next lookup walk it.
    let c = x;
    while (parent.get(c) !== r) {
      const next = parent.get(c) ?? r;
      parent.set(c, r);
      c = next;
    }
    return r;
  };
  for (const e of m.internalEdges) {
    if (!parent.has(e.from) || !parent.has(e.to)) continue;
    const a = find(e.from);
    const b = find(e.to);
    if (a !== b) parent.set(a, b);
  }
  const byRoot = new Map<string, string[]>();
  for (const id of members) {
    const r = find(id);
    const list = byRoot.get(r) ?? [];
    list.push(id);
    byRoot.set(r, list);
  }
  return [...byRoot.values()]
    .map((c) => c.sort())
    .sort((a, b) => b.length - a.length || (a[0] ?? "").localeCompare(b[0] ?? ""));
}

export function failingClauses(m: DetangleMetrics, t: Thresholds = DEFAULT_THRESHOLDS): string[] {
  const out: string[] = [];
  if (m.size < t.minSize) out.push(`size ${m.size} < ${t.minSize} — a file move, not a subgraph`);
  // Size RAISES the finding; cohesion decides what the finding SAYS. It does
  // not decide whether there is one.
  //
  // A first draft required both — `size > maxSize && cohesion < minCohesion` —
  // and the owner caught it: *"cat-harness/schemas semantic categorification by
  // judgment?"*. That conjunction is this module deciding that a large cohesive
  // group is FINE, which is precisely the judgement §"taste is a declared step"
  // says it may not make. It also meant the largest directory in the repository
  // (234 nodes) could never be reported at all.
  //
  // Cohesion cannot settle the question because of what it measures. Schemas
  // import schemas; `cat-harness/schemas` scores 0.82 because its members are
  // the same KIND, which is not evidence that they are one SUBJECT. A semantic
  // carve is a different axis from a coupling metric, and only an adjudicator
  // reads it.
  //
  // So both branches fire, with different evidence and different remedies:
  if (m.size > t.maxSize)
    out.push(
      m.cohesion < t.minCohesion
        ? `size ${m.size} > ${t.maxSize} with cohesion ${m.cohesion.toFixed(2)} < ${t.minCohesion} — too ` +
          `large to review as one diagram AND its members barely reference each other, so it is several ` +
          `subgraphs filed as one. Ask \`internalClusters\` for the seam BEFORE assuming there is one — ` +
          `measured 2026-09-27, the two lowest-cohesion groups here are each a SINGLE connected component, ` +
          `so their low score comes from boundary traffic and not from internal fragmentation, and no split ` +
          `of them is free.`
        : `size ${m.size} > ${t.maxSize} with cohesion ${m.cohesion.toFixed(2)} — too large to review as ` +
          `one diagram, and cohesion does NOT settle it: members of one KIND reference each other whether ` +
          `or not they are one SUBJECT. Whether to carve semantically is an adjudication, not a ` +
          `measurement — this clause reports the size and says nothing about the answer. Splitting here ` +
          `would turn ${m.internal} internal edges into boundary edges, so a carve needs a reason beyond ` +
          `the count. Note that cohesion says nothing about PARTICIPATION: measured 2026-09-27, ` +
          `\`cat-harness/schemas\` scored 0.82 while 129 of its 235 members had no internal edge at all, ` +
          `because the ratio is taken over the members that do. Count the isolated nodes before reading a ` +
          `high score as "one thing".`,
    );
  if (m.role === "undetermined")
    out.push(
      `role undetermined — all ${m.recordedBoundary} boundary edges are RECORDED, so their direction is ` +
        `where the author filed the pointer, not which side depends on the other. ${m.inbound} in / ` +
        `${m.outbound} out describes the filing, not the coupling.`,
    );
  else if (m.directionality < t.minDirectionality)
    out.push(
      `directionality ${m.directionality.toFixed(2)} < ${t.minDirectionality} — arrows run both ways in ` +
        `comparable numbers (${m.inbound} in, ${m.outbound} out), so it is genuinely TANGLED. This is the ` +
        `only clause for which the word is warranted.`,
    );
  if (m.distinctTargetGroups > t.maxTargetGroups)
    out.push(
      `references ${m.distinctTargetGroups} groups outside itself > ${t.maxTargetGroups} — more than ` +
        `"light detangling" (${m.outbound} raw references to ${m.distinctTargets} distinct nodes)`,
    );
  return out;
}

/**
 * A finding this scanner raises, in the shape `schemas/sdlc/qa-review.ts` defines.
 *
 * Deliberately NOT a bespoke verdict type. The review model already has a
 * reviewer kind for a script, a machine severity axis, and a `Decision` by
 * which an adjudicator may overrule — inventing a second vocabulary here would
 * give this repository two answers to "what did the check say and what did we
 * do about it", free to disagree.
 */
export interface DetangleFinding {
  /** Unique within the sweep. */
  id: string;
  /** The candidate group. */
  subject: string;
  /** Which clause of the criterion produced it. */
  criterion: "size" | "cohesion" | "directionality" | "reach";
  /** Always `script` here: this module computes and never judges. */
  reviewer: { kind: "script"; id: string };
  /** The machine axis. `major` throughout: a failing clause is a reason to look, not a reason to stop. */
  severity: "major";
  detail: string;
  /** The numbers behind it, so an adjudicator argues with evidence rather than with a verdict. */
  metrics: DetangleMetrics;
}

/**
 * Raise one finding per failing clause. An empty result means every clause
 * passed — it does NOT mean the group should be carved, which is not this
 * module's call to make.
 */
export function findings(
  m: DetangleMetrics,
  t: Thresholds = DEFAULT_THRESHOLDS,
  scannerId = "schemas/kg/detangle.ts",
): DetangleFinding[] {
  const clauseOf = (d: string): DetangleFinding["criterion"] =>
    d.startsWith("size") ? "size"
    : d.startsWith("cohesion") ? "cohesion"
    : d.startsWith("directionality") ? "directionality"
    : "reach";
  return failingClauses(m, t).map((detail, i) => ({
    id: `${m.group}#${i}`,
    subject: m.group,
    criterion: clauseOf(detail),
    reviewer: { kind: "script", id: scannerId },
    severity: "major",
    detail,
    metrics: m,
  }));
}
