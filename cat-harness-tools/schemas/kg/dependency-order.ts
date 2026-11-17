/**
 * dependency-order.ts — flatten a dependency hierarchy into ONE ordered list,
 * with the failure policy attached to each step rather than to the runner.
 *
 * One implementation for every "run these in dependency order" caller (the
 * render pipeline, the layers table, the work-plan roadmap, the skill
 * graph): they differ only in what the nodes are, never in what ordering
 * MEANS.
 *
 * ## The four rules
 *
 * 1. **A node runs after everything it declares `needs`.** Nothing else
 *    implies order. A node that needs nothing is free to run first.
 * 2. **Ties break on declaration order, not on id**, so a rename does not
 *    churn the flattened list.
 * 3. **A cycle is reported, never broken.** Every node in the cycle is named.
 * 4. **A missing dependency is reported, never dropped.** `needs: ["x"]` with
 *    no `x` is a claim that failed.
 *
 * ## `fatal` is per step
 *
 * Some steps (e.g. the KG rendered as JSON/JSON-LD, the README) must stop the
 * build; dynamic parts (KG viewer, visualisers) skip, log and raise QA. So the
 * policy is declared on the STEP, visible in the flattened list.
 *
 * A `fatal` step that fails ends the run. A non-fatal one is recorded as
 * `skipped` — and so is every step that needed it, because a step whose input
 * never rendered produces output that LOOKS complete.
 *
 * @module schemas/dependency-order
 * @graphNode none — an ordering function library: it defines no schema
 */

/** One node of a dependency hierarchy, before it is flattened. */
export interface OrderedStep {
  id: string;
  /** Ids this step must run after. Absent or empty means it may run first. */
  needs?: readonly string[];
  /**
   * Does a failure here end the run?
   *
   * Required rather than defaulted: a default would let a step ship without
   * anybody deciding, and the two policies are not interchangeable — one
   * stops the build, the other leaves a gap a reader may not notice. Same
   * reason a graph typology must state `holds` rather than inherit one.
   */
  fatal: boolean;
  /** Free-text, carried through to the report so a reader is not left guessing. */
  label?: string;
}

export type OrderProblem =
  | { kind: "cycle"; ids: string[]; detail: string }
  | { kind: "missing"; id: string; needs: string; detail: string }
  | { kind: "duplicate"; id: string; detail: string };

export interface FlattenResult {
  /** The flattened run order — empty when any problem was found. */
  order: OrderedStep[];
  /**
   * Everything wrong with the graph. NON-EMPTY MEANS `order` IS EMPTY: a
   * partial order over a broken graph is the shape that gets run anyway.
   */
  problems: OrderProblem[];
}

/**
 * Flatten a hierarchy into the order its dependencies imply.
 *
 * Kahn's algorithm with a stable queue, which is rule 2: the queue is drained
 * in declaration order, so the output changes only when the DECLARATIONS
 * change.
 */
export function flattenDependencies(steps: readonly OrderedStep[]): FlattenResult {
  const problems: OrderProblem[] = [];

  const byId = new Map<string, OrderedStep>();
  for (const s of steps) {
    if (byId.has(s.id)) {
      problems.push({
        kind: "duplicate",
        id: s.id,
        detail: `\`${s.id}\` is declared twice — one of the two is being ordered and the other is not, and nothing says which`,
      });
      continue;
    }
    byId.set(s.id, s);
  }

  for (const s of byId.values()) {
    for (const n of s.needs ?? []) {
      if (!byId.has(n)) {
        problems.push({
          kind: "missing",
          id: s.id,
          needs: n,
          detail: `\`${s.id}\` needs \`${n}\`, which is not declared — the claim cannot be honoured, and running ${s.id} anyway reports a clean pass over a broken graph`,
        });
      }
    }
  }

  if (problems.length > 0) return { order: [], problems };

  // Rule 2: the frontier is a QUEUE in declaration order, never a sorted set.
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const s of byId.values()) {
    indegree.set(s.id, (s.needs ?? []).length);
    for (const n of s.needs ?? []) {
      dependents.set(n, [...(dependents.get(n) ?? []), s.id]);
    }
  }

  const order: OrderedStep[] = [];
  const queue = [...byId.values()].filter((s) => indegree.get(s.id) === 0).map((s) => s.id);
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(byId.get(id)!);
    for (const d of dependents.get(id) ?? []) {
      const left = indegree.get(d)! - 1;
      indegree.set(d, left);
      if (left === 0) queue.push(d);
    }
  }

  if (order.length !== byId.size) {
    // Rule 3: name EVERY node still held up, not the first one found.
    const stuck = [...byId.keys()].filter((id) => !order.some((s) => s.id === id)).sort();
    return {
      order: [],
      problems: [
        {
          kind: "cycle",
          ids: stuck,
          detail:
            `${stuck.length} steps cannot be ordered — each waits on another: ` +
            stuck.map((s) => `\`${s}\``).join(", ") +
            ". Breaking the cycle here would pick a winner nobody chose.",
        },
      ],
    };
  }

  return { order, problems: [] };
}

/** What happened to one step once the flattened order was run. */
export type StepOutcome = "ran" | "failed" | "skipped";

export interface RunRecord {
  step: OrderedStep;
  outcome: StepOutcome;
  /** Why it was skipped: the id whose failure reached it. */
  blockedBy?: string;
  detail?: string;
}

/**
 * Run a flattened order, honouring each step's own `fatal`.
 *
 * `run` returns an error message for a failure and `undefined` for success —
 * rather than throwing — so that a non-fatal failure is an ordinary value and
 * a caller cannot forget to catch it.
 *
 * A failure, fatal or not, **skips everything downstream of it**. Recomputed
 * transitively from `needs` rather than from what happens to be later in the
 * list: two steps can be adjacent in the flattened order and unrelated, and
 * skipping an unrelated step would lose a rendering for no reason.
 */
export function runInOrder(
  order: readonly OrderedStep[],
  run: (step: OrderedStep) => string | undefined,
): { records: RunRecord[]; stopped?: string } {
  const records: RunRecord[] = [];
  const blocked = new Map<string, string>();

  for (const step of order) {
    const upstream = (step.needs ?? []).find((n) => blocked.has(n));
    if (upstream !== undefined) {
      // The ORIGIN of the failure, not the nearest blocked neighbour — a
      // reader wants the step that broke, not the chain that carried it.
      const origin = blocked.get(upstream)!;
      blocked.set(step.id, origin);
      records.push({
        step,
        outcome: "skipped",
        blockedBy: origin,
        detail: `needs \`${upstream}\`, which did not render`,
      });
      continue;
    }

    const failure = run(step);
    if (failure === undefined) {
      records.push({ step, outcome: "ran" });
      continue;
    }

    records.push({ step, outcome: "failed", detail: failure });
    if (step.fatal) return { records, stopped: step.id };
    blocked.set(step.id, step.id);
  }

  return { records };
}

// ── Multiple inheritance: who reaches whom, and who may win (bean `a1lq`) ──

/**
 * For every id, every id it reaches through `needs`, transitively.
 *
 * Computed over a flattened `order`, never over a raw list, so it inherits
 * the flattener's refusals: there is no ancestor set for a graph with a cycle
 * or a missing node, because there is no order to compute it from.
 */
export function ancestorsOf(order: readonly Pick<OrderedStep, "id" | "needs">[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  // Foundation-first, so every need's own set is complete before it is read.
  for (const s of order) {
    const set = new Set<string>();
    for (const n of s.needs ?? []) {
      set.add(n);
      for (const a of out.get(n) ?? []) set.add(a);
    }
    out.set(s.id, set);
  }
  return out;
}

/** Two layers define one key and neither reaches the other. */
export interface InheritanceConflict {
  key: string;
  /** Every definer none of the others reaches. Always two or more. */
  ids: string[];
  detail: string;
}

/**
 * The keys that more than one UNRELATED layer defines.
 *
 * The owner, 2026-09-23: *"once depedencies of (orderd) dependecy tree are
 * full resolve, walk tree in order starting w/ deepest depenencies"*. A later
 * layer overrides an earlier one, and that is intended — but only a layer that
 * REACHES the one it overrides. Two layers that do not reach each other have
 * no order that means anything; the flattened list puts one first, and
 * letting that decide a value would be last-writer-wins by accident.
 *
 * **Incomparable, not same-depth.** The root needs A and B, B needs D; A and D
 * both define `k`. Their depths differ, deepest-first puts D before A, and a
 * same-depth rule would let A win silently. They are unrelated, so it is a
 * conflict.
 *
 * **A child settles it.** A layer that reaches every other definer of a key is
 * the key's unique winner, which is how a conflict between two parents is
 * resolved on purpose: the child redefines the key. So the rule is one line —
 * a key is a conflict when its definers have more than one MAXIMAL member.
 */
export function findConflicts(
  order: readonly Pick<OrderedStep, "id" | "needs">[],
  keysOf: (id: string) => Iterable<string>,
): InheritanceConflict[] {
  const anc = ancestorsOf(order);
  const definers = new Map<string, string[]>();
  for (const s of order) {
    for (const k of new Set(keysOf(s.id))) definers.set(k, [...(definers.get(k) ?? []), s.id]);
  }
  const conflicts: InheritanceConflict[] = [];
  for (const [key, ids] of definers) {
    if (ids.length < 2) continue;
    const maximal = ids.filter((a) => !ids.some((b) => b !== a && anc.get(b)?.has(a)));
    if (maximal.length > 1) {
      conflicts.push({
        key,
        ids: maximal,
        detail:
          `\`${key}\` is defined by ${maximal.map((i) => `\`${i}\``).join(" and ")}, and none of them reaches the others — ` +
          `the flattened order would pick a winner nobody chose. Redefine it in a layer that needs all of them.`,
      });
    }
  }
  return conflicts;
}

/**
 * `checkDeclaredOrder` — does an AUTHORED order keep its promise? — lives in
 * bootstrap-tools, because bootstrap's own term list is the first thing that
 * needs it and bootstrap-tools may import nothing above bootstrap. Re-exported
 * here so a harness caller asks one module about order either way.
 */
export { checkDeclaredOrder, type OrderViolation } from "@litlfred/bootstrap-tools/schemas/declared-order.ts";
