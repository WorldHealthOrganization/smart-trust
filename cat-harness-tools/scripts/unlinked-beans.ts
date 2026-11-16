#!/usr/bin/env bun
/**
 * Beans tied to no BPMN task — a QA report, a WARNING and never a failure,
 * with the unlinked beans grouped to find processes the graph does not hold.
 *
 * @module scripts/unlinked-beans
 * @covers beans
 *
 * ## What "tied to a task" means here
 *
 * | basis | from | certainty |
 * |---|---|---|
 * | `instance` | a workflow instance names the bean: its `bean`, its `carriedBeans`, a running or finished subprocess's, its `subject`, or a step's history note | recorded |
 * | `named-id` | the bean's file (front matter or body) names a `bpmn:process` or activity id that a declared diagram holds | **inferred** — a mention is not a run |
 * | `none` | neither | the finding |
 *
 * The instance half is the join of `workflow-view.ts` ({@link beansNamedBy}),
 * widened to the subprocesses and history notes the bean names. The diagrams
 * are found the way `gen-processes-viz` finds them: every layer root's
 * declared `processes` graphs (`workflowFiles`), `.bpmn` only
 * ({@link declaredDiagramIds}). Every id in the corpus carries a `_` or `-`,
 * so a whole-token match does not catch an English word.
 *
 * ## The grouping is lsi-epics', not a new clusterer
 *
 * `lsi-epics.ts` already places every open bean in the latent space built
 * over every bean of the store, and ranks it against each open epic's
 * centroid (the epic and all its descendants). This report asks the same
 * question of each unlinked open bean ({@link rankEpicsForBean}) and groups
 * the beans by the epic they are nearest to. A group is the work sitting in
 * one epic's neighbourhood with no process under it; its terms are read from
 * the same weighted matrix (`keywordsOf`). A bean whose best cosine is below
 * lsi-epics' {@link FIT_FLOOR} fits no epic and is listed as such, not forced
 * into a group. Nothing here writes a parent or a link (`lsi` refusal 3).
 *
 * ## Severity
 *
 * Every finding is a `warning`. The writer exits 0 whatever it finds, and
 * {@link exitNotApplicable} when the checkout has no bean store to read — a
 * missing store is not "every bean is linked".
 *
 *   bun run cat check:unlinked-beans [--out <file.md>]   # write the result; print (or write) the report
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import { buildLsi, buildTermMatrix, keywordsOf, type LsiIndex, type TermMatrix } from "../pipeline/lsi.ts";
import { layerRootsIn, declaredGraphs } from "../schemas/kg/cat-harness.ts";
import { BEAN_GRAPH_FILE } from "../schemas/sdlc/bean-graph.ts";
import type { QaResult } from "../schemas/kg/qa-record-shapes.ts";
import { beanDefsDir, readArchivedBeans, readBeans, type BeanNode } from "./beans.ts";
import { BEAN_LSI_OPTS, epicMembers, epicOf, FIT_FLOOR, MARGIN_FLOOR, OPEN, rankEpicsForBean } from "./lsi-epics.ts";
import { beansNamedBy, readInstances } from "./workflow-view.ts";
import { workflowFiles } from "./known-skills.js";
import { buildQaResult, writeQaResult } from "./qa-results.ts";
import { exitNotApplicable } from "./lib/not-applicable.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";
import type { InstanceState } from "../src/workflow/instance.js";

/**
 * A group of at least this many unlinked open beans near one epic is shown as
 * a CANDIDATE undocumented process; smaller ones are listed as small groups
 * and singletons, never dropped. **5**: the smallest process diagram in the
 * corpus has five activities, and fewer beans than a diagram's steps is not
 * yet evidence of a process — it is a handful of related tasks.
 */
export const MIN_GROUP_SIZE = 5;

/** The QA result's stem: `test/results/unlinked-beans.qa-results.json`. */
export const RESULT_STEM = "unlinked-beans";

/** The key of the beans that fit no epic (best cosine below {@link FIT_FLOOR}). */
export const NO_FIT = "(no epic fits)";

export type LinkBasis = "instance" | "named-id" | "none";

/** A process or activity id a declared diagram holds. */
export interface DiagramId {
  id: string;
  kind: "process" | "activity";
  /** The `.bpmn`, repository-relative. */
  file: string;
  /** The process it belongs to. */
  process: string;
}

/** How one instance names a bean. */
export interface InstanceMention {
  instance: string;
  processId: string;
  status: string;
  how: "bean" | "carried" | "subprocess" | "subject" | "history";
}

/** What the classifier needs of a bean: the BeanNode, and the whole file's text. */
export interface BeanInput {
  bean: BeanNode;
  /** Front matter and body, as written. */
  text: string;
}

/** One bean's link, with its basis and the evidence for it. */
export interface BeanLink {
  id: string;
  title: string;
  status: string;
  type: string;
  parent: string;
  basis: LinkBasis;
  instances: InstanceMention[];
  /** The diagram ids its file names — inferred, and reported even when an instance also names it. */
  namedIds: DiagramId[];
}

// ── The link classifier ─────────────────────────────────────────────────────

const ID_TOKEN = /[A-Za-z][A-Za-z0-9_-]*[A-Za-z0-9]/g;

/** The diagram ids a text names, as whole tokens; each once, in id order. */
export function namedIdsIn(text: string, ids: ReadonlyMap<string, DiagramId>): DiagramId[] {
  const out = new Map<string, DiagramId>();
  for (const m of text.matchAll(ID_TOKEN)) {
    const hit = ids.get(m[0]);
    if (hit) out.set(hit.id, hit);
  }
  return [...out.values()].sort((a, b) => a.id.localeCompare(b.id));
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Every bean each instance names, and how. A history note counts when it
 * names the bean's full id as a whole token — a short id alone (`w2hn`) is
 * four characters and would match prose, so it counts only after the word
 * "bean", the form commit messages and notes use.
 */
export function instanceMentions(instances: readonly InstanceState[], beanIds: readonly string[]): Map<string, InstanceMention[]> {
  const out = new Map<string, InstanceMention[]>();
  const add = (id: string, s: InstanceState, how: InstanceMention["how"]) => {
    const list = out.get(id) ?? [];
    // One mention per instance and way; a subprocess carrying the instance's own bean adds nothing.
    if (how === "subprocess" && list.some((x) => x.instance === s.id)) return;
    if (!list.some((x) => x.instance === s.id && x.how === how)) list.push({ instance: s.id, processId: s.processId, status: s.status ?? "", how });
    out.set(id, list);
  };
  const known = new Set(beanIds);
  const patterns = beanIds.map((id) => {
    const short = id.slice(id.lastIndexOf("-") + 1);
    return { id, re: new RegExp(`(?<![A-Za-z0-9_-])(?:${escapeRe(id)}|beans? \`?${escapeRe(short)}\`?)(?![A-Za-z0-9_-])`) };
  });
  const walkChildren = (top: InstanceState, s: InstanceState) => {
    for (const c of Object.values(s.children ?? {})) {
      for (const id of beansNamedBy(c)) if (known.has(id)) add(id, top, "subprocess");
      walkChildren(top, c);
    }
  };
  const notesOf = (s: InstanceState): string[] => [
    ...(s.history ?? []).map((h) => h.note ?? ""),
    ...Object.values(s.children ?? {}).flatMap(notesOf),
  ];
  for (const s of instances) {
    if (s.bean && known.has(s.bean)) add(s.bean, s, "bean");
    for (const id of s.carriedBeans ?? []) if (known.has(id) && id !== s.bean) add(id, s, "carried");
    walkChildren(s, s);
    if (typeof s.subject === "string" && known.has(s.subject)) add(s.subject, s, "subject");
    const notes = notesOf(s).filter((n) => n !== "").join("\n");
    if (notes !== "") for (const p of patterns) if (p.re.test(notes)) add(p.id, s, "history");
  }
  return out;
}

/**
 * Each bean's basis: `instance` when an instance names it, else `named-id`
 * when its file names a diagram id, else `none`. Pure.
 */
export function classifyLinks(beans: readonly BeanInput[], instances: readonly InstanceState[], ids: ReadonlyMap<string, DiagramId>): BeanLink[] {
  const mentions = instanceMentions(instances, beans.map((b) => b.bean.id));
  return beans.map(({ bean: b, text }) => {
    const ins = mentions.get(b.id) ?? [];
    const named = namedIdsIn(text, ids);
    return {
      id: b.id,
      title: b.title,
      status: b.status,
      type: b.type,
      parent: b.parent,
      basis: ins.length > 0 ? "instance" : named.length > 0 ? "named-id" : "none",
      instances: ins,
      namedIds: named,
    };
  });
}

// ── The grouping (lsi-epics' latent epic ranking) ───────────────────────────

/** One unlinked bean's place in the latent space. */
export interface Placement {
  id: string;
  /** The epic it is nearest to, or {@link NO_FIT}. */
  group: string;
  nearestEpic?: string;
  cosine?: number;
  margin?: number;
  /** Best minus runner-up below {@link MARGIN_FLOOR}. */
  ambiguous: boolean;
}

export type SizeClass = "candidate" | "small" | "singleton" | "no-fit";

/** A group of unlinked open beans near one epic. */
export interface UnlinkedGroup {
  key: string;
  sizeClass: SizeClass;
  nearestEpic?: { id: string; title: string };
  beans: string[];
  meanCosine?: number;
  terms: string[];
  /** The epics the members are FILED under (their `parent:` chains), with how many. */
  filedUnder: Array<{ epic: string; beans: number }>;
  /** Processes already tied to OTHER beans filed under the nearest epic — a documented process the group may belong to. */
  knownProcesses: Array<{ process: string; beans: number }>;
}

/** A group's size class: {@link MIN_GROUP_SIZE} or more is a candidate. */
export function sizeClassOf(key: string, size: number): SizeClass {
  if (key === NO_FIT) return "no-fit";
  return size >= MIN_GROUP_SIZE ? "candidate" : size === 1 ? "singleton" : "small";
}

/** Each unlinked bean's nearest epic, by lsi-epics' ranking; below {@link FIT_FLOOR} it is {@link NO_FIT}. */
export function placeUnlinked(ix: LsiIndex, members: ReadonlyMap<string, readonly string[]>, ids: readonly string[]): Placement[] {
  return ids.map((id) => {
    const [best, second] = rankEpicsForBean(ix, members, id);
    if (!best) return { id, group: NO_FIT, ambiguous: false };
    const margin = best.cosine - (second?.cosine ?? 0);
    return {
      id,
      group: best.cosine >= FIT_FLOOR ? best.epic : NO_FIT,
      nearestEpic: best.epic,
      cosine: Number(best.cosine.toFixed(3)),
      margin: Number(margin.toFixed(3)),
      ambiguous: margin < MARGIN_FLOOR,
    };
  });
}

/**
 * The groups, largest first, with their terms, the epics their members are
 * filed under, and the processes already tied to the nearest epic's other
 * beans. Every placement is in exactly one group.
 */
export function groupPlacements(args: {
  placements: readonly Placement[];
  beans: readonly BeanNode[];
  links: ReadonlyMap<string, BeanLink>;
  matrix: TermMatrix;
  /** Column of each bean in `matrix`. */
  column: ReadonlyMap<string, number>;
  texts: ReadonlyMap<string, string>;
  members: ReadonlyMap<string, readonly string[]>;
  topTerms?: number;
}): UnlinkedGroup[] {
  const byId = new Map(args.beans.map((b) => [b.id, b]));
  const by = new Map<string, Placement[]>();
  for (const p of args.placements) by.set(p.group, [...(by.get(p.group) ?? []), p]);
  const groups: UnlinkedGroup[] = [];
  for (const [key, ps] of by) {
    const ids = ps.map((p) => p.id).sort();
    const cols = ids.map((id) => args.column.get(id)).filter((c): c is number => c !== undefined);
    const terms = cols.length > 0 ? keywordsOf(args.matrix, cols, ids.map((id) => args.texts.get(id) ?? ""), args.topTerms ?? 8).map((k) => k.term) : [];
    const filed = new Map<string, number>();
    for (const id of ids) {
      const b = byId.get(id);
      const e = b ? epicOf(b, byId) : undefined;
      if (e) filed.set(e, (filed.get(e) ?? 0) + 1);
    }
    const known = new Map<string, number>();
    if (key !== NO_FIT) {
      for (const m of args.members.get(key) ?? []) {
        const l = args.links.get(m);
        if (!l || l.basis === "none") continue;
        const ps2 = new Set([...l.instances.map((i) => i.processId), ...l.namedIds.map((d) => d.process)]);
        for (const p of ps2) known.set(p, (known.get(p) ?? 0) + 1);
      }
    }
    const cos = ps.map((p) => p.cosine).filter((c): c is number => c !== undefined);
    groups.push({
      key,
      sizeClass: sizeClassOf(key, ids.length),
      ...(key !== NO_FIT ? { nearestEpic: { id: key, title: byId.get(key)?.title ?? "" } } : {}),
      beans: ids,
      ...(cos.length > 0 ? { meanCosine: Number((cos.reduce((a, b) => a + b, 0) / cos.length).toFixed(3)) } : {}),
      terms,
      filedUnder: [...filed].map(([epic, n]) => ({ epic, beans: n })).sort((a, b) => b.beans - a.beans || a.epic.localeCompare(b.epic)),
      knownProcesses: [...known].map(([process, n]) => ({ process, beans: n })).sort((a, b) => b.beans - a.beans || a.process.localeCompare(b.process)),
    });
  }
  const order: Record<SizeClass, number> = { candidate: 0, small: 1, singleton: 2, "no-fit": 3 };
  return groups.sort((a, b) => order[a.sizeClass] - order[b.sizeClass] || b.beans.length - a.beans.length || a.key.localeCompare(b.key));
}

// ── The report ──────────────────────────────────────────────────────────────

export interface UnlinkedReport {
  store: string;
  /** Archived beans read, or `not-read` when the store declares none or it is absent (`readArchivedBeans` is null). */
  archive: number | "not-read";
  diagrams: { files: number; ids: number; unreadable: string[] };
  instances: number;
  open: { total: number; instance: number; namedId: number; none: number };
  /** Completed and scrapped beans, active and archived, counted only. */
  closed: Array<{ status: string; total: number; instance: number; namedId: number; none: number }>;
  /** Every open bean's link, unlinked first. */
  links: BeanLink[];
  /** Why there is no grouping, when there is none. */
  grouping: { groups: UnlinkedGroup[]; placements: Placement[]; index?: { units: number; terms: number; k: number; retained: number } } | { unknown: string };
}

function tally(list: readonly BeanLink[]) {
  return {
    total: list.length,
    instance: list.filter((l) => l.basis === "instance").length,
    namedId: list.filter((l) => l.basis === "named-id").length,
    none: list.filter((l) => l.basis === "none").length,
  };
}

/**
 * The whole report from its inputs. Pure: the writer and the beans page
 * render ONE computation. `beans` is the active store and `archived` its
 * archive view; both are classified and both feed the latent space (every
 * status teaches an epic its vocabulary, as in lsi-epics), but only open
 * beans are listed.
 */
export function unlinkedReport(args: {
  store: string;
  beans: readonly BeanInput[];
  archived: readonly BeanInput[];
  /** Whether the store declares an archive view at all; `archived` is empty either way when it does not. */
  archiveDeclared?: boolean;
  instances: readonly InstanceState[];
  ids: ReadonlyMap<string, DiagramId>;
  diagrams: { files: number; unreadable: string[] };
}): UnlinkedReport {
  const all = [...args.beans, ...args.archived];
  const links = classifyLinks(all, args.instances, args.ids);
  const linkOf = new Map(links.map((l) => [l.id, l]));
  const open = links.filter((l) => OPEN.has(l.status));
  const closed = ["completed", "scrapped"].map((status) => ({ status, ...tally(links.filter((l) => l.status === status)) }));
  const rank: Record<LinkBasis, number> = { none: 0, "named-id": 1, instance: 2 };
  const sorted = [...open].sort((a, b) => rank[a.basis] - rank[b.basis] || a.id.localeCompare(b.id));
  const unlinked = open.filter((l) => l.basis === "none").map((l) => l.id);

  let grouping: UnlinkedReport["grouping"];
  const nodes = all.map((b) => b.bean);
  // The whole file, as lsi-epics indexes it (`plainText` drops the front matter).
  const units = all.map((b) => ({ id: b.bean.id, text: b.text }));
  try {
    if (unlinked.length === 0) {
      grouping = { groups: [], placements: [] };
    } else {
      const ix = buildLsi(units, BEAN_LSI_OPTS);
      const matrix = buildTermMatrix(units, BEAN_LSI_OPTS);
      const members = epicMembers(nodes);
      const placements = placeUnlinked(ix, members, unlinked);
      const groups = groupPlacements({
        placements,
        beans: nodes,
        links: linkOf,
        matrix,
        column: new Map(units.map((u, j) => [u.id, j])),
        texts: new Map(units.map((u) => [u.id, u.text])),
        members,
      });
      grouping = { groups, placements, index: { units: ix.unitIds.length, terms: ix.terms.length, k: ix.k, retained: Number(ix.retained.toFixed(3)) } };
    }
  } catch (e) {
    // Too few beans or terms for an index: the grouping is unknown, and the
    // list above it still stands.
    grouping = { unknown: e instanceof Error ? e.message : String(e) };
  }

  return {
    store: args.store,
    archive: args.archiveDeclared === false ? "not-read" : args.archived.length,
    diagrams: { files: args.diagrams.files, ids: args.ids.size, unreadable: args.diagrams.unreadable },
    instances: args.instances.length,
    open: tally(open),
    closed,
    links: sorted,
    grouping,
  };
}

const SEVERITY = "warning";

/** The `qa-results/v1` document for a report. */
export function unlinkedResultDocument(r: UnlinkedReport): QaResult {
  const groups = "groups" in r.grouping ? r.grouping.groups : [];
  const placementOf = new Map(("placements" in r.grouping ? r.grouping.placements : []).map((p) => [p.id, p]));
  const row = (l: BeanLink) => ({
    severity: SEVERITY,
    bean: l.id,
    title: l.title,
    status: l.status,
    parent: l.parent,
    basis: l.basis,
    ...(placementOf.get(l.id) ? { group: placementOf.get(l.id)!.group, cosine: placementOf.get(l.id)!.cosine } : {}),
  });
  return buildQaResult({
    script: "scripts/unlinked-beans.ts",
    scriptAbsPath: join(TOOLS_ROOT, "scripts", "unlinked-beans.ts"),
    subject: { kind: "bean-store", id: r.store },
    families: {
      "open-bean-unlinked": {
        summary:
          `WARNING, never a failure. An open bean (todo, in-progress, draft) that no workflow instance names and whose file ` +
          `names no process or activity id of a declared diagram. It may belong to a process not yet in the graph; ` +
          `the groups say which ones cluster.`,
        entries: r.links.filter((l) => l.basis === "none").map(row),
      },
      "open-bean-linked-inferred": {
        summary:
          `Not a finding: an open bean tied to a task only because its file NAMES a diagram id (inferred — a mention is not a run). ` +
          `Listed so the inference can be checked.`,
        entries: r.links.filter((l) => l.basis === "named-id").map((l) => ({ ...row(l), severity: "info", named: l.namedIds.map((d) => d.id) })),
      },
      "open-bean-linked-instance": {
        summary: `Not a finding: an open bean a workflow instance names (recorded).`,
        entries: r.links.filter((l) => l.basis === "instance").map((l) => ({ ...row(l), severity: "info", instances: l.instances.map((i) => `${i.instance} (${i.how})`) })),
      },
      "unlinked-group": {
        summary:
          `The unlinked open beans grouped by the epic each is nearest to in the store's LSI space (lsi-epics' ranking). ` +
          `A group of ${MIN_GROUP_SIZE} or more is a CANDIDATE undocumented process; smaller groups, singletons, and the ` +
          `beans that fit no epic (cosine < ${FIT_FLOOR}) are listed as such.` +
          ("unknown" in r.grouping ? ` The grouping is UNKNOWN in this run: ${r.grouping.unknown}.` : ""),
        entries: groups.map((g) => ({
          severity: SEVERITY,
          group: g.key,
          size: g.beans.length,
          size_class: g.sizeClass,
          ...(g.nearestEpic ? { nearest_epic: g.nearestEpic.id, nearest_epic_title: g.nearestEpic.title } : {}),
          ...(g.meanCosine !== undefined ? { mean_cosine: g.meanCosine } : {}),
          terms: g.terms,
          beans: g.beans,
          filed_under: g.filedUnder,
          known_processes: g.knownProcesses,
        })),
      },
      "closed-bean-counts": {
        summary: `Completed and scrapped beans (active and archived), counted and not listed: finished work is not a warning.`,
        entries: r.closed,
      },
    },
  });
}

const cell = (s: string) => s.replace(/[\\|]/g, "\\$&").replace(/\n/g, " ");

/** The report as Markdown, for the terminal or `--out`. */
export function unlinkedMarkdown(r: UnlinkedReport): string {
  const L: string[] = [];
  const pct = (n: number) => `${((100 * n) / Math.max(1, r.open.total)).toFixed(0)}%`;
  L.push(`# Beans tied to no BPMN task — ${r.store}`, "");
  L.push(`**Severity: warning.** Never a failure: a bean may belong to a process not yet in the graph.`, "");
  L.push(
    `Read: ${r.diagrams.files} diagram(s) holding ${r.diagrams.ids} process and activity id(s)` +
      (r.diagrams.unreadable.length > 0 ? ` (${r.diagrams.unreadable.length} would not load: ${r.diagrams.unreadable.join(", ")})` : "") +
      `; ${r.instances} workflow instance(s); archive view ${r.archive === "not-read" ? "not read (none declared, or absent)" : `${r.archive} bean(s)`}.`,
    "",
  );
  L.push(`| open beans | by instance (recorded) | by named id (inferred) | unlinked |`, `|---|---|---|---|`);
  L.push(`| ${r.open.total} | ${r.open.instance} (${pct(r.open.instance)}) | ${r.open.namedId} (${pct(r.open.namedId)}) | **${r.open.none}** (${pct(r.open.none)}) |`, "");
  L.push(`Closed, counted only: ${r.closed.map((c) => `${c.status} ${c.total} (${c.instance} by instance, ${c.namedId} by named id, ${c.none} unlinked)`).join("; ")}.`, "");

  L.push(`## Candidate undocumented processes`, "");
  if ("unknown" in r.grouping) {
    L.push(`Grouping **unknown**: ${r.grouping.unknown}.`, "");
  } else {
    const g = r.grouping;
    if (g.index) L.push(`LSI over ${g.index.units} beans (every status), ${g.index.terms} terms, k=${g.index.k}, retained ${(g.index.retained * 100).toFixed(1)}%. Each unlinked open bean is placed by the epic it is nearest to (lsi-epics); a group of ${MIN_GROUP_SIZE}+ is a candidate.`, "");
    const label = (x: UnlinkedGroup) => (x.nearestEpic ? `near \`${x.nearestEpic.id}\` ${cell(x.nearestEpic.title)}` : NO_FIT);
    for (const cls of ["candidate", "small", "singleton", "no-fit"] as const) {
      const gs = g.groups.filter((x) => x.sizeClass === cls);
      if (gs.length === 0) continue;
      L.push(`### ${cls === "candidate" ? `Groups of ${MIN_GROUP_SIZE} or more` : cls === "small" ? `Small groups (2–${MIN_GROUP_SIZE - 1})` : cls === "singleton" ? "Singletons" : `Fit no epic (cosine < ${FIT_FLOOR})`} — ${gs.length}`, "");
      for (const x of gs) {
        L.push(`- **${label(x)}** — ${x.beans.length} bean(s)${x.meanCosine !== undefined ? `, mean cosine ${x.meanCosine}` : ""}`);
        L.push(`  - terms: ${x.terms.join(", ") || "—"}`);
        L.push(`  - filed under: ${x.filedUnder.map((f) => `\`${f.epic}\` (${f.beans})`).join(", ") || "no epic"}`);
        if (x.nearestEpic) L.push(`  - processes already tied to this epic's other beans: ${x.knownProcesses.map((p) => `\`${p.process}\` (${p.beans})`).join(", ") || "**none** — no documented process here"}`);
        L.push(`  - beans: ${x.beans.map((b) => `\`${b}\``).join(", ")}`);
      }
      L.push("");
    }
  }

  L.push(`## Every open bean and its link basis — ${r.links.length}`, "");
  L.push(`| bean | title | status | parent | basis | evidence |`, `|---|---|---|---|---|---|`);
  for (const l of r.links) {
    const ev =
      l.basis === "instance"
        ? l.instances.map((i) => `${i.instance} (${i.how})`).join(", ")
        : l.basis === "named-id"
          ? `inferred: ${l.namedIds.map((d) => d.id).join(", ")}`
          : "none";
    L.push(`| \`${l.id}\` | ${cell(l.title)} | ${l.status} | ${l.parent ? `\`${l.parent}\`` : "—"} | ${l.basis} | ${cell(ev)} |`);
  }
  return L.join("\n") + "\n";
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The report as a section of a bean store's page (the state visualiser),
 * beside bean `v49e`'s bean-position section. `resultHref`, when given, links
 * the published `qa-results/v1` file.
 */
export function unlinkedSectionHtml(r: UnlinkedReport, resultHref?: string): string {
  const count = (v: number, k: string) => `<li class="sv-count"><span class="sv-count-v">${v}</span><span class="sv-count-k">${esc(k)}</span></li>`;
  const code = (s: string) => `<code>${esc(s)}</code>`;
  const out: string[] = [];
  out.push(`<h2 class="sv-h2" id="unlinked-beans">Open beans tied to no BPMN task — ${r.open.none} of ${r.open.total}</h2>`);
  out.push(
    `<p class="sv-sub"><strong>Warning, never a failure</strong>: a bean may be work for a process not yet in the graph. ` +
      `Tied by <strong>instance</strong> when a workflow instance names it (recorded); by <strong>named id</strong> when its file names a ` +
      `process or activity id of one of ${r.diagrams.files} declared diagram(s) (<em>inferred</em> — a mention is not a run).` +
      (resultHref ? ` The <a href="${esc(resultHref)}">QA result</a> holds every row.` : "") +
      `</p>`,
  );
  out.push(`<ul class="sv-counts">${count(r.open.instance, "by instance")}${count(r.open.namedId, "by named id (inferred)")}${count(r.open.none, "unlinked")}</ul>`);
  out.push(`<p class="sv-sub">Closed, counted only: ${r.closed.map((c) => `${esc(c.status)} ${c.total} (${c.none} unlinked)`).join("; ")}.</p>`);
  if ("unknown" in r.grouping) {
    out.push(`<p class="sv-sub">Grouping <strong>unknown</strong>: ${esc(r.grouping.unknown)}.</p>`);
  } else if (r.grouping.groups.length > 0) {
    const g = r.grouping.groups;
    const row = (x: UnlinkedGroup) =>
      `<tr><td>${x.nearestEpic ? `${code(x.nearestEpic.id)} ${esc(x.nearestEpic.title)}` : esc(NO_FIT)}</td><td>${esc(x.sizeClass)}</td><td>${x.beans.length}</td>` +
      `<td>${esc(x.terms.join(", "))}</td><td>${x.filedUnder.map((f) => `${code(f.epic)} (${f.beans})`).join(", ") || "no epic"}</td>` +
      `<td>${x.nearestEpic ? x.knownProcesses.slice(0, 4).map((p) => `${code(p.process)} (${p.beans})`).join(", ") || "<strong>none</strong>" : ""}</td>` +
      `<td><details><summary>${x.beans.length}</summary>${x.beans.map(code).join(" ")}</details></td></tr>`;
    out.push(
      `<h3 id="unlinked-groups">Candidate undocumented processes</h3>` +
        `<p class="sv-sub">Each unlinked open bean placed by the epic it is nearest to in the store's LSI space (the ranking <code>lsi:epics</code> proposes homes with). ` +
        `A group of ${MIN_GROUP_SIZE} or more is a candidate; smaller ones and singletons are listed, and beans whose best cosine is under ${FIT_FLOOR} fit no epic.</p>` +
        `<table><thead><tr><th>nearest epic</th><th>class</th><th>beans</th><th>terms</th><th>filed under</th><th>processes its other beans tie to</th><th>members</th></tr></thead>` +
        `<tbody>${g.map(row).join("")}</tbody></table>`,
    );
  }
  const none = r.links.filter((l) => l.basis === "none");
  const inferred = r.links.filter((l) => l.basis === "named-id");
  const table = (list: readonly BeanLink[], ev: (l: BeanLink) => string) =>
    `<table><thead><tr><th>bean</th><th>title</th><th>status</th><th>parent</th><th>basis</th></tr></thead><tbody>${list
      .map((l) => `<tr><td>${code(l.id)}</td><td>${esc(l.title)}</td><td>${esc(l.status)}</td><td>${l.parent ? code(l.parent) : "—"}</td><td>${ev(l)}</td></tr>`)
      .join("")}</tbody></table>`;
  if (none.length > 0) out.push(`<details><summary>${none.length} unlinked open bean(s)</summary>${table(none, () => "none")}</details>`);
  if (inferred.length > 0) out.push(`<details><summary>${inferred.length} tied by named id (inferred)</summary>${table(inferred, (l) => `inferred: ${l.namedIds.map((d) => code(d.id)).join(", ")}`)}</details>`);
  return out.join("\n");
}

// ── Reading the checkout ────────────────────────────────────────────────────

/**
 * A `bpmn:process` or activity element's opening tag, with its id: every task
 * kind, a subprocess, a call activity, a transaction. The `bpmn:` prefix is
 * optional, as one diagram writes the BPMN namespace as its default; another
 * prefix (`folio:`, `cat-harness.processes:`) is an extension element and is
 * not matched.
 */
const ELEMENT =
  /<(?:bpmn2?:)?(process|task|userTask|serviceTask|scriptTask|manualTask|sendTask|receiveTask|businessRuleTask|subProcess|adHocSubProcess|transaction|callActivity)\b[^>]*?\sid="([^"]+)"/g;

/** The process and activity ids one diagram's XML declares, each under the process it sits in. */
export function diagramIdsOf(xml: string, file: string): DiagramId[] {
  const out: DiagramId[] = [];
  let process = "";
  for (const m of xml.matchAll(ELEMENT)) {
    if (m[1] === "process") {
      process = m[2]!;
      out.push({ id: process, kind: "process", file, process });
    } else {
      out.push({ id: m[2]!, kind: "activity", file, process });
    }
  }
  return out;
}

/**
 * Every process and activity id the declared diagrams hold, from the files
 * `gen-processes-viz` and the workflow tools resolve: each layer root's
 * `workflowFiles`, `.bpmn` only. Read from the XML rather than through
 * `loadProcessModel`, which keeps only a file's FIRST process (measured
 * 2026-10-24: the DAK lifecycle diagram's other five processes, 60 ids, were
 * invisible to it) and re-loads every called subprocess, 8 s of a 14 s run.
 * An unreadable file is NAMED, never dropped silently.
 */
export function declaredDiagramIds(repo: string): { ids: Map<string, DiagramId>; files: number; unreadable: string[] } {
  const files = [...new Set(layerRootsIn(repo).flatMap((r) => workflowFiles(r)).filter((f) => f.endsWith(".bpmn")))].sort();
  const ids = new Map<string, DiagramId>();
  const unreadable: string[] = [];
  let read = 0;
  for (const f of files) {
    const rel = relative(repo, f).split("\\").join("/");
    let xml: string;
    try {
      xml = readFileSync(f, "utf-8");
    } catch {
      unreadable.push(rel);
      continue;
    }
    read++;
    for (const d of diagramIdsOf(xml, rel)) if (!ids.has(d.id)) ids.set(d.id, d);
  }
  return { ids, files: read, unreadable };
}

/** Every bean store the checkout declares (`beans` graph typology), by absolute path. */
export function beanStores(repo: string): string[] {
  const roots = [repo, ...layerRootsIn(repo), join(repo, "cat-harness")];
  const out = new Set<string>();
  for (const r of roots) {
    for (const g of declaredGraphs(r)) if (g.graphTypologies.includes("beans") && g.absPath) out.add(g.absPath);
  }
  return [...out].sort();
}

/** Every workflow instance in every store, read through `workflow-view`'s reader. */
export function allInstances(stores: readonly string[]): InstanceState[] {
  const files: string[] = [];
  for (const store of stores) {
    let decl: { directories?: Array<{ path?: string; graphTypologies?: string[] }> };
    try {
      decl = JSON.parse(readFileSync(join(store, BEAN_GRAPH_FILE), "utf-8"));
    } catch {
      continue;
    }
    for (const d of decl.directories ?? []) {
      if (typeof d.path !== "string" || !(d.graphTypologies ?? []).includes("workflow-state")) continue;
      const dir = join(store, d.path);
      try {
        for (const f of readdirSync(dir)) if (f.endsWith(".json")) files.push(join(dir, f));
      } catch {
        // an absent directory holds no instance
      }
    }
  }
  return readInstances(files.sort()).flatMap((r) => ("state" in r ? [r.state] : []));
}

/** The store's declared name (`beans.json` `name`), else its directory's. */
export function storeName(repo: string): string {
  const defs = beanDefsDir(repo);
  if (defs === null) return basename(repo);
  const graphRoot = dirname(defs);
  try {
    const name = (JSON.parse(readFileSync(join(graphRoot, BEAN_GRAPH_FILE), "utf-8")) as { name?: unknown }).name;
    return typeof name === "string" && name !== "" ? name : basename(graphRoot);
  } catch {
    return basename(graphRoot);
  }
}

/** A store's beans with their whole files, read through `beans.ts`. */
export function beanInputs(root: string, beans: readonly BeanNode[]): BeanInput[] {
  return beans.map((b) => {
    let text = `${b.title}\n${b.body}`;
    try {
      text = readFileSync(resolve(root, b.file), "utf-8");
    } catch {
      // the parsed fields stand in for an unreadable file
    }
    return { bean: b, text };
  });
}

if (import.meta.main) {
  const REPO = resolve(dirname(HARNESS_ROOT));
  const outIdx = process.argv.indexOf("--out");
  let active: BeanNode[] | null;
  try {
    active = readBeans(REPO);
  } catch (e) {
    exitNotApplicable("check:unlinked-beans", `the bean store could not be read (${e instanceof Error ? e.message : String(e)})`);
  }
  if (active === null) exitNotApplicable("check:unlinked-beans", "this checkout has no bean store");
  const archivedOrNull = readArchivedBeans(REPO);
  const archived = archivedOrNull ?? [];
  const diagrams = declaredDiagramIds(REPO);
  const stores = beanStores(REPO);
  const report = unlinkedReport({
    store: storeName(REPO),
    beans: beanInputs(REPO, active),
    archived: beanInputs(REPO, archived),
    archiveDeclared: archivedOrNull !== null,
    instances: allInstances(stores),
    ids: diagrams.ids,
    diagrams,
  });
  const written = writeQaResult(HARNESS_ROOT, RESULT_STEM, unlinkedResultDocument(report));
  const md = unlinkedMarkdown(report);
  if (outIdx > 0) writeFileSync(resolve(process.argv[outIdx + 1]!), md);
  else process.stdout.write(md);
  console.error(
    `unlinked-beans: ${report.open.total} open — ${report.open.instance} by instance, ${report.open.namedId} by named id (inferred), ` +
      `${report.open.none} unlinked (warning). Wrote ${relative(REPO, written)}.`,
  );
  process.exit(0);
}
