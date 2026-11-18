/**
 * The three questions L1 exists to answer (docs/SCOPE.md), as functions over a
 * set of graph documents: a port of WHO smart-kg's `tools/l1-queries.mjs`
 * (3f5e477). They are the consumers the ontology is justified by, so they are
 * code rather than prose: `test/goal.test.ts` runs them, and a model change
 * that stops one of them answering fails the tests instead of being noticed
 * later.
 *
 *   impact(graph, id)          a recommendation changed: what is affected?
 *   coverage(graph)            which recommendations have no DAK representation, which DAK rules
 *                              cite nothing, and which citations are placeholders?
 *   resolveCitation(graph, id) where does this citation string lead, and how sure is each step?
 *
 * A graph is several documents read as one: L1 holds WHO content, and every
 * higher layer points down into it, so no single document answers any of these.
 */

export interface QueryNode {
  id: string;
  type: string;
  properties?: Record<string, unknown>;
}
export interface QueryEdge {
  predicate: string;
  source: string;
  target: string;
  derivation?: string;
}
export interface Graph {
  nodes: Map<string, QueryNode>;
  edges: QueryEdge[];
}

/** Several documents read as one graph. The first document to define a node wins. */
export function graphOf(docs: { nodes?: QueryNode[]; edges?: QueryEdge[] }[]): Graph {
  const nodes = new Map<string, QueryNode>();
  const edges: QueryEdge[] = [];
  for (const d of docs) {
    for (const n of d.nodes ?? []) if (!nodes.has(n.id)) nodes.set(n.id, n);
    edges.push(...(d.edges ?? []));
  }
  return { nodes, edges };
}

const out = (g: Graph, id: string, p?: string) => g.edges.filter((e) => e.source === id && (!p || e.predicate === p));
const into = (g: Graph, id: string, p?: string) => g.edges.filter((e) => e.target === id && (!p || e.predicate === p));
const typeOf = (g: Graph, id: string) => g.nodes.get(id)?.type;

/** Edges a DAK uses to point down at an L1 recommendation. All are declared above L1. */
const IMPLEMENTS = new Set(["implementedBy"]);

export interface Impact {
  recommendations: string[];
  supersededBy: string[];
  presentedIn: string[];
  evidence: string[];
  outcomes: string[];
  remarks: string[];
  indicators: string[];
  implementedBy: string[];
  citedBy: string[];
}

/**
 * Everything affected when recommendation `id` changes: what replaces it, where
 * it is printed, what it rests on, the indicators justified by or measuring it,
 * the DAK artefacts implementing it, and the citations that resolve to it.
 * Follows supersedes forward, so asking about a superseded recommendation
 * reaches its replacement and everything hanging off that too.
 */
export function impact(g: Graph, id: string): Impact {
  const result: Impact = { recommendations: [], supersededBy: [], presentedIn: [], evidence: [], outcomes: [], remarks: [], indicators: [], implementedBy: [], citedBy: [] };
  const queue = [id];
  const seen = new Set<string>();
  while (queue.length) {
    const r = queue.shift()!;
    if (seen.has(r)) continue;
    seen.add(r);
    result.recommendations.push(r);
    for (const e of into(g, r, "supersedes")) {
      result.supersededBy.push(e.source);
      queue.push(e.source);
    }
    result.presentedIn.push(...out(g, r, "presentedIn").map((e) => e.target));
    result.remarks.push(...out(g, r, "hasRemark").map((e) => e.target));
    for (const s of out(g, r, "supportedBy")) {
      result.evidence.push(s.target);
      result.outcomes.push(...out(g, s.target, "forOutcome").map((e) => e.target));
    }
    result.indicators.push(...into(g, r, "justifiedBy").map((e) => e.source), ...into(g, r, "measures").map((e) => e.source));
    result.implementedBy.push(...out(g, r).filter((e) => IMPLEMENTS.has(e.predicate)).map((e) => e.target));
    for (const c of into(g, r, "resolvesTo")) {
      result.citedBy.push(c.source);
      for (const n of into(g, c.source, "numberedAs")) result.citedBy.push(n.source);
    }
  }
  for (const k of Object.keys(result) as (keyof Impact)[]) result[k] = [...new Set(result[k])];
  return result;
}

export interface Coverage {
  recommendations: number;
  unrepresented: string[];
  rules: { total: number; cited: string[]; placeholder: string[]; none: string[] };
}

/**
 * Coverage over everything loaded. A recommendation is represented in a DAK
 * when something above L1 points at it. A DMN rule is sourced when it cites a
 * citation that is not a placeholder; a placeholder is counted apart, because
 * "[Add appropriate reference]" is the author saying a source is missing, a
 * different finding from a blank cell.
 */
export function coverage(g: Graph): Coverage {
  const recs = [...g.nodes.values()].filter((n) => n.type === "recommendation").map((n) => n.id);
  const represented = (id: string) => out(g, id).some((e) => IMPLEMENTS.has(e.predicate));
  const rules = [...g.nodes.values()].filter((n) => n.type === "dmn-rule").map((n) => n.id);
  const ruleCitations = (id: string) =>
    out(g, id, "citesSource")
      .map((e) => g.nodes.get(e.target))
      .filter((n): n is QueryNode => n !== undefined);
  const cited: string[] = [];
  const placeholder: string[] = [];
  const none: string[] = [];
  for (const r of rules) {
    const cs = ruleCitations(r);
    if (cs.some((c) => c.properties?.citationKind !== "placeholder")) cited.push(r);
    else if (cs.length) placeholder.push(r);
    else none.push(r);
  }
  return { recommendations: recs.length, unrepresented: recs.filter((id) => !represented(id)), rules: { total: rules.length, cited, placeholder, none } };
}

export interface CitationStep {
  from: string;
  predicate: "resolvesTo" | "numberedAs";
  to: string;
  derivation?: string;
}

/**
 * The path a citation string takes to WHO content, step by step, with how each
 * step was made, so a reader can see which step was mechanical and which was
 * somebody's judgement. `target` is null when the path stops short of content.
 */
export function resolveCitation(g: Graph, id: string): { steps: CitationStep[]; target: string | null } {
  const steps: CitationStep[] = [];
  let at: string | undefined = id;
  const seen = new Set<string>();
  while (at && !seen.has(at)) {
    seen.add(at);
    const direct: QueryEdge | undefined = out(g, at, "resolvesTo")[0];
    if (direct) {
      steps.push({ from: at, predicate: "resolvesTo", to: direct.target, derivation: direct.derivation });
      break;
    }
    const numbered: QueryEdge | undefined = out(g, at, "numberedAs")[0];
    if (!numbered) break;
    steps.push({ from: at, predicate: "numberedAs", to: numbered.target, derivation: numbered.derivation });
    at = numbered.target;
  }
  const end = steps.length ? steps[steps.length - 1]!.to : null;
  return { steps, target: end && typeOf(g, end) !== "reference-entry" && typeOf(g, end) !== "citation" ? end : null };
}
