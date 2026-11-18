/**
 * The role graph's IS-A closure as a predicate, for the deployment resolver
 * (bean `v3zw`). Kept free of imports so it can be tested without a corpus.
 *
 * @module scripts/lib/role-isa
 */

/** The shape it reads: each role and the roles it `inherits`. */
export interface RolesLike {
  roles: readonly { id: string; inherits?: readonly string[] }[];
}

/** `a` IS-A `b` through `inherits`, transitively. The graph is acyclic (`readRoleGraph` refuses a cycle). */
export function isAFrom(graph: RolesLike | undefined): (a: string, b: string) => boolean {
  const parents = new Map((graph?.roles ?? []).map((r) => [r.id, r.inherits ?? []]));
  const memo = new Map<string, Set<string>>();
  const ancestors = (id: string): Set<string> => {
    const hit = memo.get(id);
    if (hit) return hit;
    const out = new Set<string>();
    memo.set(id, out);
    for (const p of parents.get(id) ?? []) {
      out.add(p);
      for (const q of ancestors(p)) out.add(q);
    }
    return out;
  };
  return (a, b) => ancestors(a).has(b);
}

