/**
 * Check an order someone WROTE, rather than compute one.
 *
 * @module bootstrap-tools/schemas/declared-order
 */

/**
 * One way an AUTHORED order breaks its own promise: an item uses one that
 * comes after it, uses itself, or uses one that is not in the list.
 */
export interface OrderViolation {
  id: string;
  uses: string;
  kind: "forward" | "self" | "missing";
}

/**
 * Does a list already in its intended order keep it? — the question a
 * glossary asks, where a harness's `flattenDependencies` asks the question a
 * pipeline asks ("give me AN order").
 *
 * A glossary's order is authored: the owner, 2026-09-29, wanted definitions
 * that are *"logically tight, non self-referential"*, so each term is defined
 * only by terms above it. That is rule 1 of a harness's `dependency-order.ts` (a node runs after
 * everything it needs) read the other way round: `steps` here is the order as written, and every `needs` must point
 * UP. Nothing is reordered — a violation names the edge, because moving a
 * term silently would publish an order nobody chose.
 */
export function checkDeclaredOrder(steps: readonly { id: string; needs?: readonly string[] }[]): OrderViolation[] {
  const at = new Map(steps.map((s, i) => [s.id, i]));
  const out: OrderViolation[] = [];
  steps.forEach((s, i) => {
    for (const u of s.needs ?? []) {
      const j = at.get(u);
      if (u === s.id) out.push({ id: s.id, uses: u, kind: "self" });
      else if (j === undefined) out.push({ id: s.id, uses: u, kind: "missing" });
      else if (j > i) out.push({ id: s.id, uses: u, kind: "forward" });
    }
  });
  return out;
}
