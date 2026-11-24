/**
 * The actors and roles a BPMN drawing's lanes and pools are bound to, as one
 * compact inline line under the drawing.
 *
 * @module src/workflow/diagram-actors
 *
 * Owner, 2026-11-23: *"when displaying bpmn diagrams, the linked actors/roles
 * should be listed underneath as a compact inline list in the figure
 * description"*. Every renderer that shows a BPMN drawing as a figure — the
 * processes viewer's pages, the docs pages' figure blocks, a skill's own
 * process, the journeys viewer and its presentation frame — draws that line
 * with {@link actorsLine}, over the lanes {@link diagramActorsOf} reads, so
 * the line reads and links the same everywhere.
 *
 * What a lane is bound to is not decided here: it is cat-harness's
 * `laneRoleRef` (`schemas/process/role-graph.ts`) — `partitionElementRef`
 * first, the legacy `<bootstrap.processes:role ref>` only when it is absent.
 * The ref names a harness Role or, in a DAK, the ActorDefinition a persona
 * plays; where its page is, is the caller's
 * {@link ActorResolver}, since each site publishes those pages differently.
 *
 * - A lane bound to something with a page is linked to that page.
 * - A bound lane with no page, and a lane with no binding, are listed by
 *   name, unlinked — never given a guessed link.
 * - A pool (`<participant>`) is listed only when its process has no lanes:
 *   its lanes, where it has them, are the finer answer.
 * - Repeats are listed once: two lanes bound to one actor are one actor.
 *
 * Read with the same light regex reading `diagram-links.ts`' `stepsOf` uses,
 * so a renderer holding only the XML text needs no parser and no await.
 */
import { laneRoleRef } from "../../schemas/process/role-graph.js";

/** One lane or pool as a drawing's actors line lists it. */
export interface DiagramActor {
  /** What the drawing calls it: the lane's (or pool's) `name`, whitespace folded. */
  name?: string;
  /** What it is bound to — `laneRoleRef`'s answer — when it is bound. */
  ref?: string;
}

/** What a caller knows about a bound ref: its page, and the title its page gives it. */
export interface ResolvedActor {
  href?: string;
  title?: string;
}

/** Where a ref's page is, on the caller's site; undefined when it publishes none. */
export type ActorResolver = (ref: string) => ResolvedActor | undefined;

const P = String.raw`(?:[\w.-]+:)?`;

function unescapeXml(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(?:10|13|x[aA]|x[dD]);/g, " ")
    .replace(/&amp;/g, "&");
}

const attr = (attrs: string, name: string): string | undefined => {
  const v = new RegExp(String.raw`(?:^|\s)${name}="([^"]*)"`).exec(attrs)?.[1];
  return v === undefined ? undefined : unescapeXml(v);
};

const fold = (s: string | undefined): string | undefined => {
  const t = s?.replace(/\s+/g, " ").trim();
  return t ? t : undefined;
};

/**
 * Every lane of every process in `xml`, in document order, then each pool
 * whose process has no lanes; one entry per binding (or, unbound, per name).
 * A lane with neither a name nor a binding says nothing a reader could use and
 * is left out.
 */
export function diagramActorsOf(xml: string): DiagramActor[] {
  const out: DiagramActor[] = [];
  const seen = new Set<string>();
  const add = (a: DiagramActor): void => {
    if (!a.name && !a.ref) return;
    const key = a.ref ? `ref\0${a.ref}` : `name\0${a.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(a);
  };

  const laned = new Set<string>();
  for (const p of xml.matchAll(new RegExp(String.raw`<${P}process\b([^>]*?)(?:/>|>([\s\S]*?)</${P}process>)`, "g"))) {
    const pid = attr(p[1]!, "id");
    const body = p[2] ?? "";
    // Opening tags only, so a nested lane (`childLaneSet`) is a lane of its own
    // rather than the tail of its parent's body.
    const opens = [...body.matchAll(new RegExp(String.raw`<${P}lane\b([^>]*?)(/?)>`, "g"))];
    if (opens.length && pid) laned.add(pid);
    for (const m of opens) {
      const attrs = m[1]!;
      // The lane's own extension elements: up to its first child lane or its end.
      const from = m.index! + m[0].length;
      const rest = m[2] === "/" ? "" : body.slice(from);
      const stop = rest.search(new RegExp(String.raw`<${P}lane\b|</${P}lane>|<${P}childLaneSet\b`));
      const own = stop < 0 ? rest : rest.slice(0, stop);
      const legacy = new RegExp(String.raw`<${P}role\b([^>]*)>`).exec(own)?.[1];
      const binding = laneRoleRef({
        id: attr(attrs, "id"),
        partitionElementRef: attr(attrs, "partitionElementRef"),
        extensionElements: {
          values: legacy !== undefined ? [{ $type: "role", ref: attr(legacy, "ref"), variable: attr(legacy, "variable") }] : [],
        },
      });
      add({ name: fold(attr(attrs, "name")), ...(binding.ref ? { ref: binding.ref } : {}) });
    }
  }
  for (const m of xml.matchAll(new RegExp(String.raw`<${P}participant\b([^>]*?)/?>`, "g"))) {
    const proc = attr(m[1]!, "processRef");
    if (proc && laned.has(proc)) continue;
    add({ name: fold(attr(m[1]!, "name")) });
  }
  return out;
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** How {@link actorsLine} draws its links. */
export interface ActorsLineOptions {
  /** A bare attribute every link carries (the journeys viewer's `data-jv-dak`, so its link check finds them). */
  linkAttr?: string;
}

/**
 * The actors line: `Actors: Health worker · Client · Immunization registry`,
 * each name linked to its page where `resolve` knows one. One paragraph that
 * wraps as it needs to, never a table. Empty when the drawing has no lanes or
 * pools, so a caller can append it unconditionally.
 *
 * A bound lane is shown by its own name; with none, by its page's title; with
 * neither, by the ref itself.
 */
export function actorsLine(actors: readonly DiagramActor[], resolve?: ActorResolver, opts: ActorsLineOptions = {}): string {
  const items: string[] = [];
  const shown = new Set<string>();
  for (const a of actors) {
    const r = a.ref ? resolve?.(a.ref) : undefined;
    const label = a.name ?? fold(r?.title) ?? a.ref!;
    const href = r?.href;
    const key = `${label}\0${href ?? ""}`;
    if (shown.has(key)) continue;
    shown.add(key);
    const tip = a.ref && a.ref !== label ? ` title="${esc(a.ref)}"` : "";
    const extra = opts.linkAttr ? ` ${opts.linkAttr}` : "";
    items.push(href ? `<a href="${esc(href)}"${tip}${extra}>${esc(label)}</a>` : `<span${tip}>${esc(label)}</span>`);
  }
  if (!items.length) return "";
  return `<p class="bpmn-actors"><span class="bpmn-actors-label">Actors:</span> ${items.join(" · ")}</p>`;
}

/** {@link actorsLine} over {@link diagramActorsOf}: the line for a drawing's BPMN source text. */
export function diagramActorsLine(xml: string, resolve?: ActorResolver, opts?: ActorsLineOptions): string {
  return actorsLine(diagramActorsOf(xml), resolve, opts);
}
