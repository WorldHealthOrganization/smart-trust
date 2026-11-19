/**
 * Can control get to a node, and can it get out — the two structural questions
 * this audit did not ask.
 *
 * Asked 2026-09-23, after a session kept finding the same class by hand: a
 * thing declared and never reached, or reached and never read.
 * `decision-outcomes-used` covers DMN tables and `gateway-branches-named`
 * covers branch labels; neither walks the graph.
 *
 * It lives here rather than in `scripts/kg-audit.ts` because that script runs
 * at import — it ends in `process.exit` with no main guard — so a test
 * importing it would run the whole audit and exit. The same split
 * `src/docs/declaration-claims.ts` uses against its own checker.
 *
 * ## A pre-start gate is NOT unreachable, and getting that wrong was the point
 *
 * The first measurement over 69 diagrams found exactly one unreachable node —
 * `feature-staging`'s `H_Confirm` — and it is **correct**. It flows INTO
 * `Start_Dispatch`, and its lane says why:
 *
 * > *"It precedes Start_Dispatch rather than following it, so the dispatch
 * > entry point cannot fire at all until this lane has acted."*
 *
 * A human confirmation gating an entry point. A naive reachability check would
 * have reported that deliberate modelling decision as a defect for ever, which
 * is the `ug4r` shape — a check that makes a correct choice a permanent
 * finding. So a node from which a start event is reachable is its own case and
 * passes.
 *
 * ## Both read 0 on the day they were added
 *
 * Stated rather than hidden. `gateway-branches-named` set the precedent —
 * *"it holds a line the corpus already meets rather than opening a backlog"* —
 * and that is a different thing from a check reading 0 by not looking: these
 * walk every node of every diagram, and the walk is what the sidecar records.
 *
 * @module folio-assistant/src/workflow/reachability
 */
import type { ProcessModel } from "./process-model.js";

/** One node and why it is stranded. `where` is the node id, as findings elsewhere. */
export interface ReachabilityFinding {
  where: string;
  detail: string;
}

export interface ReachabilityReport {
  /** Nothing reaches it, and it gates no entry point. */
  unreachable: ReachabilityFinding[];
  /** Not an end event, and no way out. */
  noExit: ReachabilityFinding[];
  /**
   * Unreachable from a start event, but reaches one — so it GATES that entry
   * point rather than being stranded.
   *
   * Returned rather than silently excluded: a consumer that wants to show how
   * many of these a corpus has can, and the count being visible is what stops
   * a later reader "fixing" one. Never a finding.
   */
  preStart: ReachabilityFinding[];
}

/** Every node a start event can reach, following sequence flows forward. */
function reachableFromStarts(m: ProcessModel): Set<string> {
  const seen = new Set<string>(m.startNodes);
  const queue = [...m.startNodes];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const next = (m.nodes.get(id)?.outgoing ?? []).map((f) => m.flows.get(f)?.to);
    // A boundary event is reached with the activity it sits on: it has no
    // incoming flow of its own.
    for (const [bid, b] of m.nodes) if (b.attachedTo === id) next.push(bid);
    for (const to of next) {
      if (to !== undefined && !seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  return seen;
}

/**
 * Does any path forward from here arrive at a start event?
 *
 * Guarded against cycles, because a stranded loop would otherwise recurse
 * forever — and a stranded loop is exactly the shape this function is asked
 * about.
 */
function reachesAStart(m: ProcessModel, id: string, guard = new Set<string>()): boolean {
  if (guard.has(id)) return false;
  guard.add(id);
  for (const f of m.nodes.get(id)?.outgoing ?? []) {
    const to = m.flows.get(f)?.to;
    if (to === undefined) continue;
    if (m.nodes.get(to)?.kind === "start") return true;
    if (reachesAStart(m, to, guard)) return true;
  }
  return false;
}

/** Walk one process and classify every node that is not plainly in the flow. */
export function reachability(m: ProcessModel): ReachabilityReport {
  const seen = reachableFromStarts(m);
  const out: ReachabilityReport = { unreachable: [], noExit: [], preStart: [] };
  for (const [id, n] of m.nodes) {
    if (!seen.has(id)) {
      if (reachesAStart(m, id)) {
        out.preStart.push({
          where: id,
          detail: `gates an entry point: unreachable from a start event because it PRECEDES one.`,
        });
      } else {
        out.unreachable.push({
          where: id,
          detail:
            `no path from any start event reaches this ${n.kind}, and it reaches no start event either, ` +
            `so nothing can run it. A node that GATES an entry point flows into a start event and is not this.`,
        });
      }
    }
    if (n.kind !== "end" && n.outgoing.length === 0) {
      out.noExit.push({
        where: id,
        detail: `this ${n.kind} has no outgoing flow, so control arrives and the process neither continues nor ends.`,
      });
    }
  }
  return out;
}
