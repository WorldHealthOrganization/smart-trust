/**
 * Does every arrow point from the dependent to the general node?
 *
 * The rule is data-modelling step 8: when two nodes are related, the one that
 * depends on the other holds the pointer, and the general node names none of
 * its dependents.
 *
 * Which nodes are general is declared, never inferred: a schema declaration
 * whose doc comment carries `@general` (`schema-graph.ts` reads it). Two
 * sources are checked:
 *
 * - **Schemas.** A `@general` declaration may `@ref` only another `@general`
 *   one. A field pointing from a general node at anything else is the
 *   general node naming a dependent.
 * - **Processes.** A BPMN diagram is the authored form of a Process, which is
 *   general, so each `<folio:…>` element that points at another artefact
 *   must point at a general one. {@link PROCESS_POINTERS} lists the elements
 *   that do; any other element carrying a pointer attribute is a finding.
 *
 * Not seen: a bare string field with no `@ref` (no arrow to follow), and a
 * general node's prose naming its dependents.
 *
 * @module scripts/arrow-direction
 */
/**
 * The part of `schema-graph.ts`'s reading this check uses, declared here
 * rather than imported: the reader is a core module and this one is harness,
 * which may not depend on core. A `SchemaGraph` satisfies it structurally,
 * so the composition root that owns both (`kg-audit`) passes one straight in.
 */
export interface ArrowGraph {
  decls: ReadonlyArray<{ id: string; name: string; module: string; general?: true }>;
  edges: ReadonlyArray<{ from: string; to: string; via: string; kind: string }>;
}

export interface ArrowFinding {
  where: string;
  detail: string;
}

/**
 * The `<folio:…>` elements in a BPMN diagram that may carry a pointer, and
 * the general node each points at. Anything else carrying one of
 * {@link POINTER_ATTRS} is a process naming something that depends on it.
 */
export const PROCESS_POINTERS: Readonly<Record<string, string>> = {
  skill: "the skill a task implements",
  role: "the role a lane binds",
  raci: "the role a task involves",
  decision: "the process's own decision table",
  convention: "a convention the process follows",
  precondition: "a precondition the process requires",
};

/** Attributes that name another artefact, as against describing this one. */
export const POINTER_ATTRS = ["ref", "href", "workflow"] as const;

/** A `@general` schema that `@ref`s a declaration which is not `@general`. */
export function schemaArrowFindings(graph: ArrowGraph): ArrowFinding[] {
  const byId = new Map(graph.decls.map((d) => [d.id, d]));
  const out: ArrowFinding[] = [];
  for (const e of graph.edges) {
    if (e.kind !== "id-ref") continue;
    const from = byId.get(e.from);
    const to = byId.get(e.to);
    if (!from?.general || !to || to.general) continue;
    out.push({
      where: `${from.module}#${from.name}.${e.via}`,
      detail:
        `general node ${from.name} points at ${to.name}, which is not general — the dependent should ` +
        `hold this pointer (data-modelling step 8). Either move it, or mark ${to.name} @general if it is one.`,
    });
  }
  return out;
}

/**
 * The extension-element prefixes a diagram declares: every `xmlns:<prefix>`
 * bound to a namespace that is not OMG's (BPMN, DI, DC) or XML Schema's.
 *
 * Read from the file, never hard-coded. This check first matched `folio:` and
 * went silently vacuous the day the diagrams moved to per-layer namespaces
 * (`bootstrap.processes:`, `cat-harness.processes:`, 12s9) — it reported a
 * clean run over zero elements, which is why the caller also receives the
 * count examined.
 */
export function extensionPrefixes(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/xmlns:([A-Za-z_][\w.-]*)="([^"]*)"/g)) {
    const uri = m[2]!;
    if (/^https?:\/\/www\.omg\.org\//.test(uri) || /XMLSchema/.test(uri)) continue;
    out.push(m[1]!);
  }
  return out;
}

/**
 * The extension pointers in one diagram that name a non-general node, and how
 * many extension elements were examined — zero across a whole corpus is
 * could-not-determine, never a pass.
 */
export function processArrowFindings(file: string, text: string): { findings: ArrowFinding[]; examined: number } {
  const findings: ArrowFinding[] = [];
  let examined = 0;
  const attrs = POINTER_ATTRS.join("|");
  for (const prefix of extensionPrefixes(text)) {
    const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const m of text.matchAll(new RegExp(`<${esc}:([A-Za-z-]+)\\b([^>]*)>`, "g"))) {
      examined++;
      const element = m[1]!;
      if (element in PROCESS_POINTERS) continue;
      const a = new RegExp(`\\b(${attrs})="([^"]*)"`).exec(m[2]!);
      if (!a) continue;
      findings.push({
        where: file,
        detail:
          `<${prefix}:${element} ${a[1]}="${a[2]}"> — the process names ${a[1] === "href" ? "a page about it" : "something that implements or depends on it"}. ` +
          `A process is general; the ${a[1] === "href" ? "page" : "implementation"} should point at the process instead.`,
      });
    }
  }
  return { findings, examined };
}
