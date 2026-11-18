#!/usr/bin/env bun
/**
 * The processes graph → a searchable index over every executable BPMN diagram.
 *
 * @module cat-harness/scripts/gen-processes-viz
 * @covers processes, business-processes — the viewer lists both: the engine's diagrams and the descriptive ones (DAK business processes, folio blocks)
 *
 * These diagrams are executable — `workflow_start` / `workflow_next` /
 * `workflow_complete` run them, and `workflow_complete` refuses a step that is
 * not enabled — so their index is generated, not hand-kept.
 *
 * It reads them with the real parser, `loadProcessModel` (bpmn-moddle), never
 * a regex: legal markup variants (an attribute order, a wrapped line) defeat
 * one.
 *
 * ## Declared vs defaulted enforcement
 *
 * `ProcessModel.enforcement` is `"strict" | "advisory"`, never absent, because
 * `loadProcessModel` reads an undeclared policy as `strict` — right for the
 * ENGINE. For a reader, "somebody chose strict" and "nobody said" are
 * different facts, so this index reports them apart. It asks whether a policy
 * declares an **enforcement value**, not whether a policy ELEMENT is present:
 * a policy element with no `enforcement` counts as *defaulted*.
 *
 * ## What it is NOT
 *
 * Not a re-render: `render:bpmn` owns the SVGs and `render:bpmn:check` fails if
 * they are stale. Not a second store of position: workflow STATE lives in
 * committed instances under `beans/workflows/`.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/gen-processes-viz.ts
 *   bun run cat-harness-tools/scripts/gen-processes-viz.ts --check
 */
import { inScope, scopeArg, siteScope } from "./lib/site-scope.ts";
import { escapeAngles, linkProse } from "./lib/link-prose.ts";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

import { declarationPathIn } from "../schemas/kg/cat-harness.js";
import { baseDocsDir } from "./compose-docs.js";
import { forgeHrefFor, skillContractSectionMd } from "./tool-page.ts";
import { skillLinksOf, skillSourceFilesOf, skillTarget, sourceSkillPage, type SkillPages } from "./lib/skill-pages.ts";
import { wrapRaw } from "./lib/liquid-raw.ts";
import { businessProcessFiles, workflowFiles, kgRoots } from "./known-skills.js";
import { loadProcessModel, isActivity, isDecision, branchesOf, isGlobalTasksFile, type NotRunElement } from "../src/workflow/process-model.js";
import {
  laneBinding,
  readRoleGraph,
  resolveRoleSkills,
  type LaneBinding,
  type RoleGraph,
  type SkillProvenance,
} from "../schemas/process/role-graph.js";
import { ownElementPattern } from "../schemas/kg/namespaces.js";
import { processPresentations, type Presentation } from "./process-presentations.js";
import { siteRootFrom, visualiserRoute } from "../schemas/kg/visualiser-route.js";
import { pageParts, tileCountsForPages, visualiserSitePath, withRenderedByFrontMatter } from "./viewer-declarations.js";
import { tileCounts } from "../schemas/ui/tile-count.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { workflowInstanceLinks } from "./state-visualizer.ts";
import { instancesByProcess, type InstanceLink } from "./workflow-view.ts";
import { siteArg, sitePageAt } from "./lib/site-target.ts";
import {
  autoDocsRowId,
  diagramBlock,
  diagramBounds,
  markersFor,
  methodologyPageDir,
  PANEL_CLIENT,
  panelFile,
  PANEL_CSS,
  PANEL_SCRIPT,
  svgViewBox,
  taskSkillsDeclared,
  type Marker,
  type PanelData,
  type PanelLink,
  type PanelTask,
  unlinkedPanelRefs,
  panelLinksReport,
  type UnlinkedRef,
} from "./lib/task-panel.ts";
import { skillEdgeIndex } from "./lib/skill-edges.ts";
import { subjectHref, subjectIri } from "./lib/subject-pages.ts";
import { methodologyNodes } from "./check-methodology-evidence.js";
import { instanceOf, pageRelPath as methodologiesPageRel } from "./gen-methodologies-viz.js";
import { declaredRoute } from "./viewer-declarations.js";

/** This generator's Tool node (`tools/viewers.ts`), named on every page it draws. */
const VIEWER_TOOL = "processes-viewer";
/**
 * Every page this writes declares itself generated in its own front matter —
 * the `generated:` key `check:reference-direction` reads (bean `ws99`). A page
 * names the diagram it was drawn from, which may belong to a layer above
 * the one that commits the page; without the key that path read as authored
 * prose naming a higher layer.
 */
const GENERATED_FM = "generated: gen-processes-viz.ts — do not hand-edit; edit the diagram, then run `bun run cat processes:viz`";

const REPO = resolve(dirname(HARNESS_ROOT));


/** One diagram, as the index sees it. */
export interface ProcessRow {
  /** Repo-relative path — the identity, because basenames collide across layers. */
  file: string;
  /** The directory it lives under, which is the instance/methodology facet. */
  group: string;
  /**
   * The declared name of the layer whose directory holds the file: the
   * sub-graph whose page lists it (`<harness>/processes/<instance>/`).
   * Absent only on a row built by hand (a test fixture).
   */
  instance?: string;
  id: string;
  name: string;
  lanes: string[];
  /**
   * The Roles the lanes NAME — `partitionElementRef`, or the legacy
   * `<bootstrap.processes:role ref>` when that is absent: the join that does
   * not depend on spelling. A lane names a Role; it is not one (owner, 2026-10-16).
   */
  roles: string[];
  skills: string[];
  beanOps: string[];
  enforcement: "strict" | "advisory";
  /**
   * Whether the FILE declares an enforcement VALUE, as opposed to the engine
   * defaulting one. Not the same as carrying a `<cat-harness.processes:policy>` element — see
   * the module doc, and `crdm-signoff.bpmn`, which has one and no value.
   */
  enforcementDeclared: boolean;
  activities: number;
  /**
   * Activities carrying no `<bootstrap.processes:skill ref>`, with the lane and BPMN type
   * that decide whether that is a gap or a design.
   *
   * NOT a defect list, and the first version of this page made it one. See
   * `page()`'s census section: beans `luke` and `uuhu` already established
   * that a human sign-off step and a call activity are deliberately
   * skill-less, and 31 of 31 fall into categories they settled.
   */
  activitiesWithoutSkill: { id: string; lane: string; type: string; roleRef?: string }[];
  /** The rendered SVG, site-relative — or absent, which is reported rather than hidden. */
  svg?: string;
  /**
   * The ⓘ markers, one per task the drawn diagram has a shape for, in percent
   * of the diagram (`lib/task-panel.ts`). Absent when there is no SVG to put
   * them on, or no task with a shape.
   */
  markers?: Marker[];
  /** Set when the diagram would not load at all. Reported, never silently dropped. */
  loadError?: string;
  /**
   * What the diagram draws that the interpreter does not run (a boundary
   * timer, an intermediate event): read past by a VIEW load, so the page is
   * drawn, and named on it so nothing is dropped silently (owner, 2026-11-01,
   * Q-SUBG-2 B). The engine still refuses to run such a diagram.
   */
  notRun?: NotRunElement[];
  /** Basename without `.bpmn` — the page name and the SVG name. */
  stem: string;
  /** `<bpmn:documentation>` on the process element. */
  documentation?: string;
  /** Lanes with their role, that role's skills, and documentation, in document order. */
  laneDetails: LaneDetail[];
  /** Every activity, in document order — what the per-process page lists. */
  steps: ProcessStep[];
  /**
   * Every DECISION (an exclusive gateway with more than one way out), in
   * document order. Merges, forks and joins decide nothing and are omitted —
   * the same line `gateway-documented` draws.
   */
  decisions: ProcessDecision[];
}

/** One decision, as its process page shows it. */
export interface ProcessDecision {
  id: string;
  name: string;
  documentation?: string;
  /** Each way out: its label (absent when unnamed) and the step it leads to. */
  branches: { label?: string; to: string }[];
}

/**
 * Why a lane shows the skills it shows — or shows none.
 *
 * Bean `zw4a`. **The five kinds are `laneBinding`'s, not this viewer's**, and
 * that is the point: `role-graph.ts` already separates them and says why, for
 * *"the consumer that has to JUDGE the binding rather than use it"* — which is
 * exactly what a viewer is.
 *
 * This file first grew its own four-state enum. It was a worse second answer:
 * it missed `variable` (a lane whose performer varies BY DESIGN, bean `ug4r` —
 * reporting it as a defect for ever is the failure that flag exists to
 * prevent) and `contradictory` (a lane declaring both a ref and `variable`).
 * A viewer disagreeing with `kg:audit` about whether a lane is bound would be
 * two answers to one question, which is the thing this repository spends most
 * of its length preventing.
 *
 * Only the KIND is carried, not the whole `RoleDef`: this is JSON a web page
 * loads, and embedding a role per lane would ship the role graph once per
 * swimlane.
 */
export interface LaneDetail {
  id: string;
  name: string;
  roleRef?: string;
  documentation?: string;
  /**
   * `laneBinding`'s verdict — bound / dangling / variable / contradictory /
   * unbound — or `ungraphed` when there is no role graph to ask.
   *
   * `ungraphed` is the VIEWER's word for "could not determine", not a sixth
   * `LaneBinding` kind: bean `7go7` made the graph a required parameter, so
   * with none there is no verdict to take. It is what `kg:audit` already
   * records in that state (`unknown` against `role-ref-resolves`,
   * `lane-binds-role` and five more), so the two agree — which they did NOT
   * before: the audit discarded its verdicts and this viewer published them.
   */
  binding: LaneBinding["kind"] | "ungraphed";
  /** The role actually resolved, which may have come from lane-NAME matching rather than a ref. */
  roleId?: string;
  /**
   * What the ROLE carries, closed over `inherits`, with provenance.
   *
   * From `resolveRoleSkills` rather than by reading `RoleDef.skills`. That
   * field is documented "before inheritance", so reading it directly
   * UNDER-REPORTS every role that inherits — measured here, not assumed: the
   * `Adjudicator` lane in `adjudication.bpmn` resolves 14 skills, of which
   * `content-block-review` and `content-feedback` arrive via `reviewer`.
   * `via` is kept so a reader can see which ancestor supplied each one.
   */
  roleSkills: SkillProvenance[];
  /**
   * What the ACTIVITIES IN THIS LANE name, via `<bootstrap.processes:skill ref>`.
   *
   * **A separate list on purpose — the bean's fourth done-when.** A lane's
   * skills are not the union of its activities' skills in either direction: a
   * role carries skills it may not use in this diagram, and an activity may
   * name one its lane's role does not list. Same measurement as above makes it
   * concrete — `Adjudicator` has 14 role skills and its activities name 2.
   * Folding them into one list would assert an agreement nothing checks.
   *
   * WHICH they are is `kg:audit`'s question. This renders both and grades
   * neither.
   */
  activitySkills: string[];
}

/** One activity, as its process page shows it. */
export interface ProcessStep {
  id: string;
  name: string;
  lane: string;
  type: string;
  skills: string[];
  /** For a call activity: the process id it descends into. */
  calledElement?: string;
  /** For a call to a global task: the shared step's id and kind, and the values this call gives its inputs. */
  globalTask?: { id: string; type: string; inputs?: Record<string, string> };
  documentation?: string;
  /** `<cat-harness.processes:narrative href>`, and the text of the section it names, when found. */
  narrative?: { href: string; text?: string };
}

/**
 * The text of the section `href` names: `X.md#frag`, relative to the diagram.
 * The heading matches when its text, its `{#id}`, or its slug is the
 * fragment. The text runs to the next heading of the same or a higher level.
 * Undefined when the file or the heading is missing, so the page says so
 * rather than showing nothing.
 */
export function narrativeText(diagram: string, href: string): string | undefined {
  const [file, frag] = href.split("#", 2) as [string, string | undefined];
  if (frag === undefined || frag === "") return undefined;
  const abs = resolve(dirname(diagram), file || basename(diagram));
  if (!existsSync(abs)) return undefined;
  const lines = readFileSync(abs, "utf8").split(/\r?\n/);
  const slug = (t: string): string => t.toLowerCase().trim().replace(/[^\p{L}\p{N}\s._-]/gu, "").replace(/\s+/g, "-");
  // `<a name="frag"></a>` (or `id=`) on its own line names the heading after it.
  const anchorOf = (l: string): string | undefined => /^\s*<a\s+(?:name|id)="([^"]+)"\s*>\s*<\/a>\s*$/.exec(l)?.[1];
  const heading = (l: string): RegExpExecArray | null => /^(#{1,6})\s+(.*?)\s*$/.exec(l);
  const section = (from: number, level: number): string | undefined => {
    let end = lines.length;
    for (let j = from; j < lines.length; j++) {
      const h = heading(lines[j]!);
      if (h && h[1]!.length <= level) {
        end = j;
        break;
      }
    }
    // The next section's anchor line is not part of this one's text.
    while (end > from && (anchorOf(lines[end - 1]!) !== undefined || lines[end - 1]!.trim() === "")) end--;
    return lines.slice(from, end).join("\n").trim() || undefined;
  };
  for (let i = 0; i < lines.length; i++) {
    const m = heading(lines[i]!);
    if (!m) continue;
    const text = m[2]!;
    const id = /\{#([^}]+)\}\s*$/.exec(text)?.[1];
    const bare = text.replace(/\s*\{#[^}]+\}\s*$/, "");
    let k = i - 1;
    while (k >= 0 && lines[k]!.trim() === "") k--;
    const anchor = k >= 0 ? anchorOf(lines[k]!) : undefined;
    if (anchor === frag || id === frag || bare === frag || slug(bare) === slug(frag)) return section(i + 1, m[1]!.length);
  }
  return undefined;
}

const uniq = (xs: string[]): string[] => [...new Set(xs.filter((x) => x))].sort((a, b) => a.localeCompare(b, "en"));

/**
 * Every diagram, parsed.
 *
 * A file that will not load gets a row with `loadError` rather than being
 * omitted. Omission would shrink the denominator and make a broken diagram read
 * as one that does not exist — the `dh4f` shape, where a sweep reports a clean
 * run over what it could not see.
 */
/**
 * Every layer's diagrams, not just this one's.
 *
 * `workflowFiles` takes a LAYER root and resolves that layer's declared
 * graph plus its dependencies'. Handed the REPOSITORY root it returns nothing —
 * there is no declaration there — and the first run of this generator did
 * exactly that: it printed *"Wrote processes-index.md — 0 diagram(s)"* and
 * exited 0, over a corpus of 62.
 *
 * That is the `dh4f` shape, produced by the generator written to report it. The
 * vacuity guard in `main` is the fix for the symptom; this is the fix for the
 * cause.
 *
 * Asking each layer separately also keeps a real distinction: `bootstrap`
 * declares its own three diagrams and `cat-harness` does not reach them, so a
 * single-root index would omit them silently rather than group them.
 */
export function instanceRoots(repo: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(repo, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith(".") || e.name === "node_modules") continue;
    const dir = join(repo, e.name);
    if (declarationPathIn(dir)) out.push(dir);
  }
  out.sort();
  // A layer at the checkout ROOT (an IG repository, with
  // its layers mounted below it) holds diagrams too. Without it, the site's
  // own layer was the one layer its processes page never listed.
  if (declarationPathIn(repo)) out.unshift(repo);
  return out;
}

/** A layer root and its declared name. */
interface NamedRoot {
  readonly root: string;
  readonly name: string;
}

function namedRoots(repo: string): NamedRoot[] {
  const out: NamedRoot[] = [];
  for (const root of instanceRoots(repo)) {
    const p = declarationPathIn(root);
    let name: string | undefined;
    try {
      name = p && existsSync(p) ? (JSON.parse(readFileSync(p, "utf-8")) as { name?: string }).name : undefined;
    } catch {
      name = undefined;
    }
    out.push({ root: resolve(root), name: name || basename(root) });
  }
  return out;
}

/**
 * The layer whose directory holds `abs`: the DEEPEST root containing it,
 * so a layer mounted under the checkout root's own layer is its own
 * sub-graph rather than the root's.
 */
export function owningInstance(abs: string, roots: readonly NamedRoot[]): string | undefined {
  const f = resolve(abs);
  let best: NamedRoot | undefined;
  for (const r of roots) {
    if (f !== r.root && !f.startsWith(r.root + sep)) continue;
    if (best === undefined || r.root.length > best.root.length) best = r;
  }
  return best?.name;
}

/**
 * Every diagram file a row is drawn for (global-task files excluded, as
 * {@link processRows} excludes them), keyed by the layer that holds it.
 * Synchronous and parse-free, so `site-coverage` asks the same question the
 * writer answers: a layer owes a sub-graph page exactly when it is a key.
 */
export function processSubjects(repo = REPO): Map<string, string[]> {
  const roots = namedRoots(repo);
  const seen = new Set<string>();
  const out = new Map<string, string[]>();
  for (const r of roots) {
    for (const f of [...workflowFiles(r.root), ...businessProcessFiles(r.root)]) {
      if (!f.endsWith(".bpmn") || seen.has(f)) continue;
      seen.add(f);
      try {
        if (isGlobalTasksFile(readFileSync(f, "utf-8"))) continue;
      } catch {
        // unreadable: the row reports it as a load error, so it is a subject too
      }
      const inst = owningInstance(f, roots);
      if (inst === undefined) continue;
      out.set(inst, [...(out.get(inst) ?? []), relative(repo, f)]);
    }
  }
  return new Map([...out].sort((a, b) => a[0].localeCompare(b[0], "en")));
}

export async function processRows(repo = REPO): Promise<ProcessRow[]> {
  const rows: ProcessRow[] = [];
  const roleGraph = loadRoleGraph(repo);
  const seen = new Set<string>();
  const named = namedRoots(repo);
  const files = instanceRoots(repo)
    // The `business-processes` kind too: drawn here, never run (Q-SUBG-3).
    .flatMap((r) => [...workflowFiles(r), ...businessProcessFiles(r)])
    // `.dmn` is a DECISION TABLE, not a process — a different kind that a
    // gateway computes from. Including them would inflate every count on this
    // page with things that have no lanes, no skills and no activities.
    .filter((f) => f.endsWith(".bpmn"))
    .filter((f) => (seen.has(f) ? false : (seen.add(f), true)))
    .sort();
  for (const abs of files) {
    const file = relative(repo, abs);
    const group = dirname(file);
    const instance = owningInstance(abs, named);
    // THE SVG LIVES WHERE `render:bpmn` PUTS IT, which is the base docs layer —
    // not beside the diagram.
    //
    // The first version composed the path from the .bpmn's own location
    // (`../docs/assets/img/workflows/`), and reported **11 of 62** diagrams as
    // unrendered: all 8 CRDM and all 3 bootstrap. Every one of those SVGs
    // exists. `render:bpmn:check` was green across the whole thing, which is
    // what should have stopped me shipping it — a finding that contradicts a
    // passing gate is a finding to verify, not to publish.
    //
    // A report that claims a gap which is not there teaches its reader to
    // discount it, and this repository has paid for that once already
    // (`viewer-undiscovered.test.ts`, the same week).
    const svgRel = join(baseDocsDir(repo), "assets/img/workflows", `${basename(abs, ".bpmn")}.svg`);
    // The site copy is built at publish (cat-harness#1047), so it is absent
    // wherever render:bpmn has not run. The drawing committed beside the
    // .bpmn (bean akiq) has the same layout, so it answers "is there a
    // drawing" and gives the markers their geometry; `svg` names the file
    // that is on disk, and the page still links the site copy by stem.
    const beside = abs.replace(/\.bpmn$/, ".svg");
    const drawn = existsSync(svgRel) ? svgRel : existsSync(beside) ? beside : undefined;
    const svg = drawn !== undefined ? relative(repo, drawn) : undefined;
    // The DECLARATION, asked of the file: is there an enforcement VALUE? A
    // presence check, not a second reading of what the policy means — and a
    // presence check on the value, not on the element. See the module doc.
    const xml = readFileSync(abs, "utf-8");
    // A layer's shared global tasks hold no process (owner, 2026-10-20,
    // "a1"): no row of their own, and each shows in the steps that call it.
    if (isGlobalTasksFile(xml)) continue;
    const declared = ownElementPattern(xml, "policy", String.raw`[^>]*\benforcement\s*=`, "").test(xml);
    try {
      // A VIEW load: this page draws a process and runs nothing (Q-SUBG-2 B).
      const m = await loadProcessModel(abs, [], new Map(), { view: true });
      const nodes = [...m.nodes.values()];
      const acts = nodes.filter(isActivity);
      const markers = drawn !== undefined ? await taskMarkers(xml, readFileSync(drawn, "utf-8"), acts) : [];
      rows.push({
        file,
        group,
        ...(instance ? { instance } : {}),
        id: m.id,
        name: m.name,
        lanes: uniq(m.lanes.map((l) => (l.name ?? "").replace(/\s+/g, " ").trim())),
        roles: uniq(m.lanes.map((l) => l.roleRef ?? "")),
        skills: uniq(nodes.flatMap((n) => n.skills)),
        beanOps: uniq(nodes.map((n) => n.workPlanOp ?? "")),
        enforcement: m.enforcement,
        enforcementDeclared: declared,
        activities: acts.length,
        activitiesWithoutSkill: acts
          .filter((n) => n.skills.length === 0)
          .map((n) => ({
            id: n.id,
            lane: (n.lane ?? "").replace(/\s+/g, " ").trim(),
            type: n.type,
            ...(n.roleRef ? { roleRef: n.roleRef } : {}),
          }))
          .sort((a, b) => a.id.localeCompare(b.id, "en")),
        ...(svg ? { svg } : {}),
        ...(markers.length > 0 ? { markers } : {}),
        stem: basename(abs, ".bpmn"),
        ...(m.notRun ? { notRun: m.notRun } : {}),
        ...(m.documentation ? { documentation: m.documentation } : {}),
        laneDetails: m.lanes.map((l) => laneDetail(l, acts, roleGraph)),
        steps: acts.map((n) => ({
          id: n.id,
          name: n.name.replace(/\s+/g, " ").trim() || n.id,
          lane: (n.lane ?? "").replace(/\s+/g, " ").trim(),
          type: n.type,
          skills: n.skills,
          ...(n.calledElement ? { calledElement: n.calledElement } : {}),
          ...(n.globalTask ? { globalTask: { id: n.globalTask.id, type: n.globalTask.type, ...(n.inputs ? { inputs: n.inputs } : {}) } } : {}),
          ...(n.documentation ? { documentation: n.documentation } : {}),
          ...(n.narrative ? { narrative: { href: n.narrative, ...((t) => (t ? { text: t } : {}))(narrativeText(abs, n.narrative)) } } : {}),
        })),
        decisions: [...m.nodes.values()].filter(isDecision).map((n) => ({
          id: n.id,
          name: n.name.replace(/\s+/g, " ").trim() || n.id,
          ...(n.documentation ? { documentation: n.documentation } : {}),
          branches: branchesOf(m, n).map((b) => ({
            ...(b.label ? { label: b.label.replace(/\s+/g, " ").trim() } : {}),
            to: (m.nodes.get(b.to)?.name ?? b.to).replace(/\s+/g, " ").trim() || b.to,
          })),
        })),
      });
    } catch (e) {
      rows.push({
        file,
        group,
        ...(instance ? { instance } : {}),
        id: basename(file, ".bpmn"),
        name: basename(file, ".bpmn"),
        lanes: [],
        roles: [],
        skills: [],
        beanOps: [],
        enforcement: "strict",
        enforcementDeclared: declared,
        activities: 0,
        activitiesWithoutSkill: [],
        ...(svg ? { svg } : {}),
        stem: basename(abs, ".bpmn"),
        laneDetails: [],
        steps: [],
        decisions: [],
        loadError: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return rows.sort((a, b) => a.file.localeCompare(b.file, "en"));
}

/**
 * The role graph, merged across every declared `kg` directory.
 *
 * Read ONCE per run rather than per lane: `readRoleGraph` parses a file, and a
 * viewer over 60+ diagrams would otherwise re-read it for every swimlane.
 */
function loadRoleGraph(repo: string): RoleGraph | undefined {
  const roles = [];
  // Per LAYER root, not per repo root. `kgRoots` resolves a layer's own
  // declared `kg` directories, so handing it the repository returns nothing —
  // and nothing here is the same shape as "no role is declared anywhere",
  // which would have rendered every bound lane in the corpus as a dangling
  // reference. Caught by checking the output against the corpus rather than
  // by the types, which were happy.
  for (const inst of instanceRoots(repo)) {
    for (const kgRoot of kgRoots(inst)) roles.push(...(readRoleGraph(kgRoot)?.roles ?? []));
  }
  // `name` is required on the type and unused here; the merged graph is not
  // any one declared graph, so it is named for what it is rather than borrowing
  // the name of whichever directory happened to be read first.
  return roles.length > 0 ? { name: "merged across declared kg directories", roles } : undefined;
}

/**
 * One lane, with its role and that role's skills.
 *
 * The join AGENTS.md states in a sentence — *"An actor performs a task in a
 * process as a role, using that role's skills"* — which the graph could
 * already answer and the viewer did not show. Bean `zw4a`.
 *
 * Every resolution here is borrowed: `laneBinding` for the verdict (which
 * consults `roleForLane`, so a lane bound by NAME rather than by an explicit
 * ref resolves too) and `resolveRoleSkills` for the closure. Nothing about
 * roles is decided in this file.
 */
export function laneDetail(
  lane: { id: string; name?: string; roleRef?: string; performerVaries?: boolean; documentation?: string },
  activities: { lane?: string; skills: string[] }[],
  roleGraph: RoleGraph | undefined,
): LaneDetail {
  const name = (lane.name ?? lane.id).replace(/\s+/g, " ").trim();
  // Activities are matched on the lane NAME the model already resolved onto
  // them, which is how every other consumer in this file scopes them.
  const activitySkills = uniq(
    activities
      .filter((a) => (a.lane ?? "").replace(/\s+/g, " ").trim() === name)
      .flatMap((a) => a.skills),
  ).sort((a, b) => a.localeCompare(b, "en"));

  // No graph, no question. Before bean `7go7` this asked anyway and got
  // `dangling` for every ref-bearing lane — 44 of them in this corpus, all of
  // which bind. One unreadable file rendered as a wall of broken references.
  const b = roleGraph
    ? laneBinding(roleGraph, { name, roleRef: lane.roleRef, performerVaries: lane.performerVaries })
    : undefined;
  const role = b?.kind === "bound" ? b.role : undefined;
  return {
    id: lane.id,
    name,
    ...(lane.roleRef ? { roleRef: lane.roleRef } : {}),
    ...(lane.documentation ? { documentation: lane.documentation } : {}),
    binding: b?.kind ?? "ungraphed",
    ...(role ? { roleId: role.id } : {}),
    // A lane's binding is not a fact that exists without a role registry, so
    // with no graph this reports that it could not look rather than what it
    // would have guessed. Bean `7go7`, the owner's ruling 2026-09-23.
    roleSkills: role && roleGraph ? resolveRoleSkills(roleGraph, role.id) : [],
    activitySkills,
  };
}

/**
 * The ⓘ markers for one diagram: each task's DI shape mapped through the
 * rendered SVG's `viewBox` (`lib/task-panel.ts`). Empty when the SVG has no
 * viewBox or the diagram no DI — never a marker placed by guesswork.
 */
async function taskMarkers(xml: string, svgText: string, acts: readonly { id: string; name: string }[]): Promise<Marker[]> {
  const vb = svgViewBox(svgText);
  if (!vb) return [];
  try {
    return markersFor(
      acts.map((a) => ({ id: a.id, name: a.name.replace(/\s+/g, " ").trim() || a.id })),
      await diagramBounds(xml),
      vb,
    );
  } catch {
    return [];
  }
}


/**
 * What the ⓘ panel links to, resolved once per run. Every href is relative to
 * a process page; a name with no page has no href and is shown as code.
 */
export interface PanelContext {
  skillHref: (skill: string) => string | undefined;
  methodologyHref: (name: string) => string | undefined;
  roleHref: (roleId: string) => string | undefined;
  roleTitle: (roleId: string) => string | undefined;
  /**
   * A subject's own page — `<doc dir>/process/P`, `…/node/T`, `…/lane/L` —
   * for the subject `<kind>/<id>` declared by the repo-relative `file`
   * (`lib/subject-pages.ts`, #603). Undefined where no page is published.
   */
  subjectHref: (file: string, kind: string, id: string) => string | undefined;
  /** skill → its `uses-methodology`, when its front matter says it. */
  usesMethodology: (skill: string) => readonly string[] | undefined;
}

/** Where the pages rendered from skills' source files go, below the processes index. */
export const SOURCE_SKILLS_DIR = "skills";

/**
 * The page for a skill with no instruction page, rendered from its source
 * file (`sourceSkillPage`), with the processes that name it. It sits one
 * directory below the process pages.
 */
export function sourceSkillPageMd(
  name: string,
  text: string,
  url: string,
  file: string,
  localNames: ReadonlySet<string>,
  rows: readonly ProcessRow[],
  /** The contract section (`skillContractSectionMd`), when the caller read one. */
  contracts?: readonly string[],
): string {
  const p = sourceSkillPage(name, text, url, localNames);
  const users = rows.filter(
    (r) => r.loadError === undefined && (r.skills.includes(name) || (r.laneDetails ?? []).some((l) => l.roleSkills.some((x) => x.skill === name))),
  );
  const L: string[] = ["---", `title: '${name.replace(/'/g, "''")} (skill)'`, "nav_exclude: true", GENERATED_FM, "---", ""];
  L.push("{: .note }");
  L.push(
    `> The skill \`${name}\` as its source file [\`${file}\`](${url}) writes it, rendered by \`gen-processes-viz.ts\` because ` +
      "it has no instruction page on this site — do not edit here. [All processes](../index.html)",
  );
  L.push("");
  const rawFrom = L.length;
  // The skill's own title first, then what it is and who names it, then the rest of its body.
  const lines = p.body.trimEnd().split("\n");
  const h1 = lines.findIndex((l) => /^# /.test(l));
  if (h1 >= 0) L.push(...lines.splice(0, h1 + 1), "");
  else L.push(`# ${name}`, "");
  if (p.description) L.push(`**Skill \`${name}\`:** ${p.description}`, "");
  if (users.length) L.push(`**Named by:** ${users.map((r) => `[${esc(r.name)}](../${r.stem}.html)`).join(", ")}`, "");
  L.push(...lines);
  L.push(...wrapRaw(L.splice(rawFrom).join("\n")));
  // The skill's I/O contracts as a class diagram (bean `cat-tools-4xq6`),
  // outside the raw block so its HTML renders.
  if (contracts) L.push(...contracts);
  return `${L.join("\n")}\n`;
}

/** The QA page of panel names that link nowhere, beside the processes index. */
export const PANEL_LINKS_QA = "panel-links-qa.md";

/**
 * The anchor of a step's row in its process page's step table: where the ⓘ
 * panel's task title goes (owner, 2026-11-08: "title of task should skip to
 * description thats below"). BPMN ids are NCNames, so they need no escaping.
 */
export const stepAnchor = (id: string): string => `step-${id}`;
/** The anchor of a lane's row in the page's lanes table. */
export const laneAnchor = (id: string): string => `lane-${id}`;

/**
 * The links, from the declarations that own them:
 *
 * - skills: the instruction page where one exists, else the skill's source
 *   file on the forge (`skillTarget`), as the step
 *   table already links them;
 * - methodologies: `<methodologies route>/<instance>/<name>/`, the per-node
 *   pages of cat-harness-tools #422, from the declared `methodologies-viewer`
 *   route and the methodology graph's own nodes — a name no node declares
 *   gets no link;
 * - roles: the Role's own page, its subject IRI `<doc dir>/role/<id>`
 *   (#603), where its layer's graph publishes one; else the row on the
 *   auto-docs Roles index, from the declared `auto-docs-viewer` route and
 *   the `roles.json` that declares the role;
 * - steps, lanes and processes: their own pages, `<doc dir>/process/P…` (#603).
 */
export function panelContext(repo = REPO, skillPages: SkillPages = skillLinksOf(repo, instanceRoots(repo))): PanelContext {
  const root = up(repo);
  const harness = join(repo, "cat-harness");
  const methPage = methodologiesPageRel(repo);
  const methInstance = new Map<string, string>();
  try {
    for (const n of methodologyNodes(harness)) {
      if (n.front && !methInstance.has(n.front.name)) methInstance.set(n.front.name, instanceOf(n.node, harness, repo));
    }
  } catch {
    // No methodology graph declared: every methodology stays code.
  }
  const autoDocs = declaredRoute(harness, "auto-docs-viewer");
  const roleAt = new Map<string, { path: string; title: string; kg: string }>();
  for (const inst of instanceRoots(repo)) {
    for (const kg of kgRoots(inst)) {
      for (const r of readRoleGraph(kg)?.roles ?? []) {
        if (!roleAt.has(r.id)) roleAt.set(r.id, { path: `${relative(repo, kg).split("\\").join("/")}/roles.json#${r.id}`, title: r.title, kg });
      }
    }
  }
  const edges = skillEdgeIndex(instanceRoots(repo));
  return {
    skillHref: (s) => skillTarget(s, root, skillPages),
    methodologyHref: (name) => {
      const inst = methInstance.get(name);
      return inst && methPage ? `${root}${dirname(methPage)}/${methodologyPageDir(inst, name)}` : undefined;
    },
    roleHref: (id) => {
      const at = roleAt.get(id);
      if (at === undefined) return undefined;
      return (
        subjectHref(join(at.kg, "roles.json"), "role", id) ??
        (autoDocs ? `${root}${autoDocs}/index/roles/index.html#${autoDocsRowId(at.path)}` : undefined)
      );
    },
    subjectHref: (file, kind, id) => subjectHref(join(repo, file), kind, id),
    roleTitle: (id) => roleAt.get(id)?.title,
    usesMethodology: (s) => edges.get(s)?.usesMethodology,
  };
}

/**
 * One process's panel data: task → skills → methodologies, and the lane's
 * Role → its skills. Pure over the row and the context, so the join is
 * testable without a site.
 */
export function taskPanelData(
  row: ProcessRow,
  rows: readonly ProcessRow[],
  ctx: PanelContext,
  opts: { skills?: boolean } = {},
): PanelData {
  const skillsOn = opts.skills !== false;
  const link = (name: string, href: string | undefined): PanelLink => (href ? { name, href } : { name });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const laneByName = new Map(row.laneDetails.map((l) => [l.name, l]));
  const tasks: Record<string, PanelTask> = {};
  for (const st of row.steps) {
    const lane = laneByName.get(st.lane);
    const roleId = lane?.roleId;
    const called = st.calledElement ? byId.get(st.calledElement) : undefined;
    const href = ctx.subjectHref(row.file, "process", `${row.id}/node/${st.id}`);
    // A lane with no page of its own lands on its row in the lanes table.
    const laneHref = lane
      ? (ctx.subjectHref(row.file, "process", `${row.id}/lane/${lane.id}`) ?? `${row.stem}.html#${laneAnchor(lane.id)}`)
      : undefined;
    tasks[st.id] = {
      id: st.id,
      name: st.name,
      type: st.type,
      ...(href ? { href } : {}),
      // The step's description on its process page, which the title opens.
      stepHref: `${row.stem}.html#${stepAnchor(st.id)}`,
      ...(st.lane ? { lane: st.lane } : {}),
      ...(laneHref ? { laneHref } : {}),
      skills: (skillsOn ? st.skills : []).map((s) => {
        const ms = ctx.usesMethodology(s);
        return { ...link(s, ctx.skillHref(s)), ...(ms ? { methodologies: ms.map((m) => link(m, ctx.methodologyHref(m))) } : {}) };
      }),
      ...(st.calledElement
        ? {
            calls: called
              ? {
                  name: called.name,
                  href: ctx.subjectHref(called.file, "process", called.id) ?? `${called.stem}.html`,
                  diagram: `${called.stem}.html`,
                }
              : { name: st.calledElement },
          }
        : {}),
      ...(st.globalTask ? { shared: st.globalTask } : {}),
      ...(roleId
        ? {
            role: {
              ...link(roleId, ctx.roleHref(roleId)),
              ...(ctx.roleTitle(roleId) ? { title: ctx.roleTitle(roleId) } : {}),
              skills: (skillsOn ? lane!.roleSkills : []).map((p) => ({ ...link(p.skill, ctx.skillHref(p.skill)), ...(p.via !== roleId ? { via: p.via } : {}) })),
            },
          }
        : lane
          ? { binding: lane.binding }
          : {}),
    };
  }
  const processHref = ctx.subjectHref(row.file, "process", row.id) ?? `${row.stem}.html`;
  return {
    $schema: "process-task-panel/v1",
    process: row.id,
    ...(skillsOn ? {} : { skills: false as const }),
    ...(row.markers ? { markers: row.markers } : {}),
    ...(processHref ? { processHref } : {}),
    tasks,
  };
}

/** skill → the diagrams that run it. The join nothing else exposes. */
export function skillToProcesses(rows: readonly ProcessRow[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const r of rows) for (const s of r.skills) m.set(s, [...(m.get(s) ?? []), r.file]);
  return new Map([...m].sort((a, b) => a[0].localeCompare(b[0], "en")));
}

const esc = (s: string): string => s.replace(/[\\|]/g, "\\$&");

/**
 * `skillPages` is the set of skills with a generated instruction page, as for
 * {@link processPage}: a skill with one is a LINK, a skill without one stays
 * code rather than becoming a link that 404s (bean `qgjh` — "emit links
 * wherever the target resolves"). Empty by default, so a caller that has not
 * looked renders every skill as code, as this table did before.
 */
/** How {@link page} scopes the index it draws: the whole corpus, or one sub-graph of it. */
export interface PageScope {
  /** `undefined` for every layer's diagrams; else the layer whose diagrams the page shows. */
  readonly instance?: string;
  /** On the full index: one row per sub-graph page, to browse by layer. */
  readonly subjects?: readonly { name: string; count: number; href: string }[];
  /** A process's IRI ({@link processIri} unless given). */
  readonly iriOf?: (r: ProcessRow) => string | undefined;
}

/**
 * A process's IRI, `<doc dir>/process/<id>`, as its layer's document mints it
 * (`kg-export`; `subjectIri`), and served with its `.jsonld` wherever that
 * layer is published. Its row and its page link it (owner, 2026-11-13,
 * node-kind audit: "link existing IRIs").
 */
export function processIri(r: Pick<ProcessRow, "file" | "id">, repo: string = REPO): string | undefined {
  return subjectIri(join(repo, r.file), "process", r.id);
}

/**
 * A pipe table, or `none` when it would have no rows.
 *
 * Kramdown drops a table with no body and prints its header and delimiter as
 * a paragraph — the delimiter's `---` typeset as em dashes — so a header-only
 * table is never emitted.
 */
export function tableOrNone(header: readonly string[], rows: readonly string[], none: string): string[] {
  if (rows.length === 0) return [none];
  return [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`, ...rows];
}

/**
 * `scope.instance` draws one layer's sub-graph page, one directory below
 * the index, so every link on it is one segment deeper.
 */
export function page(
  rows: readonly ProcessRow[],
  skillPages: SkillPages = new Set(),
  instances: InstancesRead = NO_INSTANCES,
  scope: PageScope = {},
): string {
  // From a sub-graph page, the process pages and the site root are one level up.
  const base = scope.instance === undefined ? "" : "../";
  const root = `${base}${up()}`;
  const ok = rows.filter((r) => r.loadError === undefined);
  const broken = rows.filter((r) => r.loadError !== undefined);
  const byGroup = new Map<string, number>();
  for (const r of rows) byGroup.set(r.group, (byGroup.get(r.group) ?? 0) + 1);
  const lanes = new Map<string, string[]>();
  for (const r of ok) for (const l of r.lanes) lanes.set(l, [...(lanes.get(l) ?? []), r.file]);
  const ops = new Map<string, string[]>();
  for (const r of ok) for (const o of r.beanOps) ops.set(o, [...(ops.get(o) ?? []), r.file]);
  const join = skillToProcesses(ok);
  const undeclared = ok.filter((r) => !r.enforcementDeclared);
  const noSvg = rows.filter((r) => r.svg === undefined);
  const noSkill = ok.filter((r) => r.activitiesWithoutSkill.length > 0);

  const L: string[] = [];
  L.push("---");
  L.push(scope.instance === undefined ? "title: Processes" : `title: 'Processes — ${scope.instance.replace(/'/g, "''")}'`);
  L.push("nav_exclude: true");
  L.push(GENERATED_FM);
  L.push("---");
  L.push("");
  if (scope.instance === undefined) {
    L.push("# Processes — every executable diagram, searchable");
  } else {
    L.push(`# Processes — ${scope.instance}`);
    L.push("");
    L.push(
      `The diagrams **${esc(scope.instance)}** holds in its declared \`processes\` directories — one ` +
        "sub-graph's slice of [every instance's processes](../). The skills, lanes and findings below " +
        "count these diagrams only.",
    );
  }
  L.push("");
  L.push(
    "Generated by `cat-harness-tools/scripts/gen-processes-viz.ts`. **Every number here is " +
      "counted from the directory**, never carried in prose — `bpmn-processes`' own rule, " +
      "and the bean that asked for this page had two different counts in its title and its body.",
  );
  L.push("");
  L.push(`**${rows.length}** diagram(s), **${ok.length}** parsed, **${broken.length}** that would not load.`);
  L.push("");
  L.push(
    ...tableOrNone(
      ["where", "diagrams"],
      [...byGroup].sort((a, b) => b[1] - a[1]).map(([g, n]) => `| \`${esc(g)}/\` | ${n} |`),
      "_No diagrams._",
    ),
  );
  L.push("");

  if (scope.subjects !== undefined && scope.subjects.length > 0) {
    L.push("## By subgraph");
    L.push("");
    L.push("Each instance that holds diagrams has its own page, listing only its processes.");
    L.push("");
    L.push("| subgraph | diagrams |");
    L.push("|---|---|");
    for (const x of scope.subjects) L.push(`| [${esc(x.name)}](${x.href}) | ${x.count} |`);
    L.push("");
  }

  L.push("## Every process — one page each");
  L.push("");
  L.push(
    "Each page shows the diagram, what it is for, who acts in it, every step with the skill it runs, and " +
      "which processes call it. `kg:audit`'s `process-diagram-published` fails a diagram no page shows — " +
      "45 of 62 were in that state before these pages existed (bean `ooq3`).",
  );
  L.push("");
  L.push(
    "**Running instances** links each workflow instance's own page — the diagram with its token, its " +
      "stuck states, its beans and todos — for every instance running this process or calling it as a " +
      "subprocess. Links and counts only: where an instance IS lives in its file under `beans/workflows/`.",
  );
  L.push("");
  L.push(
    ...tableOrNone(
      ["process", "steps", "undocumented steps", "running instances"],
      ok.map((r) => {
        const undoc = r.steps.filter((st) => !st.documentation).length;
        const iri = (scope.iriOf ?? processIri)(r);
        const node = iri === undefined ? "" : ` · [IRI](${iri}) · [JSON-LD](${iri}.jsonld)`;
        return `| [${esc(r.name)}](${base}${r.stem}.html)${node} | ${r.activities} | ${undoc || "—"} | ${instancesCell(instances, r.id, root)} |`;
      }),
      "_No process parsed._",
    ),
  );
  L.push("");
  if (instances.unread.length > 0) {
    L.push(`Instances of ${instances.unread.map((x) => `\`${x}\``).join(", ")} could not be read in this build, so "none recorded" above does not cover them.`);
    L.push("");
  }

  L.push("## What runs this skill?");
  L.push("");
  L.push(
    "The reverse of `<bootstrap.processes:skill ref>`, which is the join nothing else exposes: a skill " +
      "says what to do, and until now nothing said which processes ask for it.",
  );
  L.push("");
  L.push(`**${join.size}** distinct skill(s) are named by an activity.`);
  L.push("");
  // A diagram in "run by" links to its own page — the one the first table
  // links — found by FILE, the key `skillToProcesses` joins on. A file with no
  // loaded row publishes no page, so it stays code.
  const pageOf = new Map(ok.map((r) => [r.file, r.stem]));
  const skillCell = (s: string): string => {
    const to = skillTarget(s, root, skillPages);
    return to ? `[\`${esc(s)}\`](${to})` : `\`${esc(s)}\``;
  };
  const runBy = (f: string): string => {
    const stem = pageOf.get(f);
    return stem === undefined ? `\`${esc(basename(f))}\`` : `[\`${esc(basename(f))}\`](${base}${stem}.html)`;
  };
  L.push(
    ...tableOrNone(
      ["skill", "run by"],
      [...join].map(([s, fs]) => `| ${skillCell(s)} | ${fs.map(runBy).join(", ")} |`),
      "_No activity names a skill._",
    ),
  );
  L.push("");
  L.push(`Names an ⓘ task panel shows without a link are listed on [Task panel links: QA](${base}${PANEL_LINKS_QA.replace(/\.md$/, ".html")}).`);
  L.push("");

  L.push("## Who appears in a process?");
  L.push("");
  L.push(
    "A lane NAMES the Role its tasks are performed in; it is not itself a Role. The NAME is free text — " +
      "`process-model.ts` notes that sixty lanes spell two dozen positions — so the lane's " +
      "`partitionElementRef` (or the legacy `<bootstrap.processes:role ref>`) is the join that does not " +
      "depend on spelling, and it is reported separately below rather than merged into the name.",
  );
  L.push("");
  L.push(`**${lanes.size}** distinct lane name(s).`);
  L.push("");
  L.push(
    ...tableOrNone(
      ["lane", "in"],
      [...lanes]
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "en"))
        .map(([l, fs]) => `| ${esc(l)} | ${fs.length} |`),
      "_No lanes._",
    ),
  );
  L.push("");

  L.push("## Which steps touch the work plan?");
  L.push("");
  L.push("`<cat-harness.processes:bean op>` — the audit trail for who reserves and resolves work.");
  L.push("");
  L.push(
    ...tableOrNone(
      ["op", "diagrams"],
      [...ops].sort((a, b) => b[1].length - a[1].length).map(([o, fs]) => `| \`${esc(o)}\` | ${fs.length} |`),
      "_No step names a bean op._",
    ),
  );
  L.push("");

  L.push("## Strict, advisory — and nobody said");
  L.push("");
  L.push(
    "Three states, not two. `loadProcessModel` reads an undeclared policy as `strict`, " +
      "which is right for the engine — *\"a process that forgot to say is governed, not " +
      "exempt\"* — and hides a fact a reader wants. **Somebody chose strict** and " +
      "**nobody said, so the engine assumed strict** are different, and the second is " +
      `**${undeclared.length}** of ${ok.length} here.`,
  );
  L.push("");
  L.push("| enforcement | declared | defaulted |");
  L.push("|---|---|---|");
  for (const e of ["strict", "advisory"] as const) {
    const d = ok.filter((r) => r.enforcement === e && r.enforcementDeclared).length;
    const f = ok.filter((r) => r.enforcement === e && !r.enforcementDeclared).length;
    L.push(`| \`${e}\` | ${d} | ${f} |`);
  }
  L.push("");

  L.push("## Findings");
  L.push("");
  const notRunRows = ok.filter((r) => r.notRun && r.notRun.length > 0);
  if (notRunRows.length > 0) {
    L.push(
      `**${notRunRows.length} diagram(s) draw elements the engine does not run.** Each has its page, with the ` +
        "elements listed; `workflow_start` refuses to run them.",
    );
    L.push("");
    for (const r of notRunRows) L.push(`- \`${esc(r.file)}\` — ${uniq(r.notRun!.map((n) => `\`${n.type}\``)).join(", ")}`);
    L.push("");
  }
  if (broken.length > 0) {
    L.push(`**${broken.length} diagram(s) would not load.** Reported rather than omitted — a`);
    L.push("dropped file shrinks every denominator above and reads as one that does not exist.");
    L.push("");
    for (const r of broken) L.push(`- \`${esc(r.file)}\` — ${esc(r.loadError ?? "")}`);
    L.push("");
  }
  if (noSvg.length > 0) {
    L.push(`**${noSvg.length} diagram(s) have no rendered SVG.** \`bun run cat render:bpmn\`.`);
    L.push("");
    for (const r of noSvg) L.push(`- \`${esc(r.file)}\``);
    L.push("");
  } else {
    // Stated rather than left silent: "all rendered" and "the check did not run"
    // are different facts and an absent section cannot tell them apart.
    L.push(`Every one of the **${rows.length}** diagrams has a rendered SVG.`);
    L.push("");
  }
  if (noSkill.length > 0) {
    const all = noSkill.flatMap((r) => r.activitiesWithoutSkill);
    const calls = all.filter((a) => a.type.endsWith("CallActivity"));
    const rest = all.filter((a) => !a.type.endsWith("CallActivity"));
    const byLane = new Map<string, number>();
    for (const a of rest) byLane.set(a.lane || "(no lane)", (byLane.get(a.lane || "(no lane)") ?? 0) + 1);

    L.push("### Activities carrying no `<bootstrap.processes:skill ref>` — a census, not a gap list");
    L.push("");
    L.push(
      `**${all.length}** across **${noSkill.length}** diagram(s). This section reported them as ` +
        "defects in its first version, and that was wrong: beans `luke` and `uuhu` worked this " +
        "corpus from 90 down to this remainder and settled what is left. `luke`: *\"coverage is " +
        "deliberately NOT gated — a human sign-off step has no skill\"*. `uuhu` added the " +
        "call-activity exemption and recorded that its own remainder *\"are not gaps\"*.",
    );
    L.push("");
    L.push(
      `**${calls.length}** are call activities, which delegate to a subprocess — the skill is ` +
        "named there, and naming it twice would be one fact in two places. The other " +
        `**${rest.length}** are listed by lane, because the lane is what says whether a person, ` +
        "a pipeline or an agent performs the step, and only the last of those has a skill to run.",
    );
    L.push("");
    L.push(
      ...tableOrNone(
        ["lane", "steps"],
        [...byLane].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en")).map(([l, n]) => `| ${esc(l)} | ${n} |`),
        "_None outside call activities._",
      ),
    );
    L.push("");
    L.push(
      "**No verdict is offered on which of these is a gap**, and that is the honest state rather " +
        "than a hedge: distinguishing a person's judgement step from an agent step somebody " +
        "forgot needs the lane's actor KIND, which a free-text lane name does not give — " +
        "`process-model.ts` notes sixty lanes spell two dozen positions. The lane's `partitionElementRef` is " +
        `the join that would answer it, and it is present on **${rest.filter((a) => a.roleRef).length}** ` +
        `of these **${rest.length}** steps — which is the measurement, not an impression. ` +
        "An earlier draft of this sentence said *few of these* and was counting whether the lane " +
        "had a NAME, a different question with a different answer.",
    );
    L.push("");
  }
  return `${L.join("\n")}\n`;
}

/** The workflow instances a page links, by process id, and the stores that could not be read. */
export interface InstancesRead {
  byProcess: ReadonlyMap<string, readonly InstanceLink[]>;
  unread: readonly string[];
}

export const NO_INSTANCES: InstancesRead = { byProcess: new Map(), unread: [] };

/** The instance links, as {@link page} and {@link processPage} take them. */
export function instancesRead(read: { links: readonly InstanceLink[]; unread: readonly string[] }): InstancesRead {
  return { byProcess: instancesByProcess(read.links), unread: read.unread };
}

/**
 * The instances running process `id` (itself, or as a subprocess), as links
 * to their pages: the not-completed ones first, the finished ones counted
 * after. Each href is the site root ({@link up}) and the declared route the
 * instance page is drawn at — never a hand-written chain of `../`.
 */
export function instancesCell(instances: InstancesRead, id: string, root: string = up()): string {
  const all = instances.byProcess.get(id) ?? [];
  if (all.length === 0) return "none recorded";
  const link = (l: InstanceLink): string => `[\`${esc(l.id)}\`](${root}${l.route})`;
  const running = all.filter((l) => l.status !== "completed");
  const finished = all.filter((l) => l.status === "completed");
  return [
    running.length > 0 ? running.map(link).join(", ") : "none running",
    ...(finished.length > 0 ? [`${finished.length} finished: ${finished.map(link).join(", ")}`] : []),
  ].join("; ");
}

/**
 * One page per process — the surface `process-diagram-published` asks for.
 *
 * Everything on it is READ from the diagram, so it cannot say anything the
 * diagram does not. The two relations a single file cannot show are computed
 * over the whole corpus: who CALLS this process (a call activity naming its
 * id), and who NAMES its skill without calling it — the second is what
 * `activity-calls-skill-process` turns into a finding.
 *
 * `skillPages` is the set of skills with a generated instruction page; a skill
 * without one is shown as code rather than as a link that 404s.
 *
 * `presentedOn` is the docs page sections whose `asset.source` names this
 * diagram — read from the PAGES, so the process names none of them (bean
 * `rdy0`). It is also where a subprocess box lands when more than one section
 * presents the process (`processTarget`), so the list is the disambiguation.
 */
export function processPage(
  row: ProcessRow,
  rows: readonly ProcessRow[],
  skillPages: SkillPages,
  presentedOn: readonly Presentation[] = [],
  instances: InstancesRead = NO_INSTANCES,
  unlinked: (ref: string) => void = () => {},
  iriOf: (r: ProcessRow) => string | undefined = processIri,
): string {
  const iri = iriOf(row);
  const byId = new Map(rows.map((r) => [r.id, r]));
  // Process ids and skill names in authored prose become links (owner, 2026-10-31).
  const prose = (t: string): string => {
    const r = linkProse(
      t,
      (id) => (byId.get(id) ? `${byId.get(id)!.stem}.html` : undefined),
      (n) => skillTarget(n, up(), skillPages),
    );
    r.unlinked.forEach(unlinked);
    return escapeAngles(r.text);
  };
  const skill = (s: string): string => {
    const to = skillTarget(s, up(), skillPages);
    return to ? `[\`${s}\`](${to})` : `\`${s}\``;
  };
  const proc = (r: ProcessRow): string => `[${esc(r.name)}](${r.stem}.html)`;
  /**
   * A `<bpmn:documentation>` body inside a MARKDOWN TABLE CELL.
   *
   * Newlines become `<br>`, and that is not cosmetic: a real newline ends the
   * table ROW, so one paragraph break in a step's documentation would corrupt
   * every column to its right and the rest of the table below it.
   *
   * Measured 2026-09-26 (bean `li5y`): `esc` handled `|` and nothing handled
   * newlines, so an author had NO WAY to put a break in documentation that
   * worked. 90 instances across 8 files were written `&amp;#10;` —
   * double-escaped — and the published page showed the five characters
   * `&#10;` as literal text. Single-escaping them without this would have
   * traded visible garbage for a corrupted table, which is worse: garbage is
   * obvious and a broken table reads as a content error.
   *
   * `\n\n` collapses to ONE `<br>` rather than two, because a cell is not a
   * place for a blank line — the author's intent there is "new line", and two
   * `<br>` renders as a gap that looks like a mistake.
   */
  const cell = (s: string | undefined): string =>
    s ? esc(prose(s)).replace(/\n+/g, "<br>") : "—";
  const callers = rows.filter((r) => r.stem !== row.stem && r.steps.some((st) => st.calledElement === row.id));
  const namers = rows.filter(
    (r) => r.stem !== row.stem && r.steps.some((st) => st.calledElement === undefined && st.skills.includes(row.stem)),
  );
  const callees = uniq(row.steps.flatMap((st) => (st.calledElement ? [st.calledElement] : [])));

  const L: string[] = [];
  L.push("---");
  L.push(`title: '${row.name.replace(/'/g, "''")}'`);
  L.push("nav_exclude: true");
  // The page renders the process; its JSON-LD is the asset (kg-viewer §"The
  // asset and its rendering are two resources"): head_custom.html writes it
  // as `rel=alternate type=application/ld+json`.
  if (iri !== undefined) L.push(`alternate_jsonld: ${JSON.stringify(`${iri}.jsonld`)}`);
  L.push(GENERATED_FM);
  L.push("---");
  L.push("");
  L.push("{: .note }");
  L.push(
    `> Generated from \`${row.file}\` by \`gen-processes-viz.ts\` — do not edit here. [All processes](index.html)` +
      (row.instance ? ` · [${row.instance} processes](${row.instance}/)` : ""),
  );
  L.push("");
  // Everything from here to the end is authored BPMN text; `wrapRaw` below
  // escapes it so a closing raw tag inside a documentation string cannot end
  // the block early (bean kjbb).
  const rawFrom = L.length;
  L.push(`# ${row.name}`);
  L.push("");
  L.push(`\`${row.id}\` · ${row.enforcement}${row.enforcementDeclared ? "" : " (defaulted)"} · ${row.activities} step(s)`);
  L.push("");
  L.push(row.documentation ? prose(row.documentation) : "_This process carries no `<bpmn:documentation>`._");
  if (row.notRun && row.notRun.length > 0) {
    L.push("");
    L.push("{: .warning }");
    L.push(
      `> **Not run by the engine.** This diagram draws ${row.notRun.length} element(s) the process interpreter does not ` +
        "implement. They are shown on the diagram and listed here, but `workflow_start` refuses to run this process until " +
        "the interpreter supports them.",
    );
    L.push("");
    L.push("| element | type | on |");
    L.push("|---|---|---|");
    const nameOf = new Map(row.steps.map((st) => [st.id, st.name]));
    for (const n of row.notRun) {
      L.push(`| ${esc(n.name ?? n.id)} | \`${n.type}\` | ${n.attachedTo ? esc(nameOf.get(n.attachedTo) ?? n.attachedTo) : "—"} |`);
    }
  }
  L.push("");
  if (row.svg) {
    // With markers, the diagram carries the ⓘ task panel (owner, 2026-10-16:
    // an info icon on each task opens a small UML object view). Without, the
    // plain image it always was.
    L.push(
      ...diagramBlock({
        img: `${up()}assets/img/workflows/${row.stem}.svg`,
        alt: `BPMN diagram: ${row.name}`,
        // A call activity's shape opens the process it calls; its ⓘ still opens the panel.
        markers: (row.markers ?? []).map((m) => {
          const ce = row.steps.find((st) => st.id === m.id)?.calledElement;
          const called = ce ? byId.get(ce) : undefined;
          return called ? { ...m, href: `${called.stem}.html` } : m;
        }),
        panelHref: panelFile(row.stem),
      }),
    );
  } else {
    L.push("_No rendered diagram — run `bun run cat render:bpmn`._");
  }
  L.push("");

  L.push("## How it connects");
  L.push("");
  L.push(`- **Called by:** ${callers.length ? callers.map(proc).join(", ") : "no call activity names this process"}`);
  L.push(
    `- **Calls:** ${callees.length ? callees.map((id) => (byId.get(id) ? proc(byId.get(id)!) : `\`${id}\` (not loadable here)`)).join(", ") : "none"}`,
  );
  if (namers.length) {
    L.push(
      `- **Names the \`${row.stem}\` skill without calling this process:** ${namers.map(proc).join(", ")} — ` +
        "`activity-calls-skill-process` asks whether each should be a call activity.",
    );
  }
  L.push(
    `- **Presented on:** ${
      presentedOn.length
        ? presentedOn
            .map((p) => `[${esc(p.pageTitle)}${p.title ? ` — ${esc(p.title)}` : ""}](${up()}${p.href}#${p.node})`)
            .join(", ")
        : "no docs page section shows this diagram"
    }`,
  );
  if (skillTarget(row.stem, up(), skillPages)) L.push(`- **Skill:** ${skill(row.stem)}`);
  L.push(`- **Running instances:** ${instancesCell(instances, row.id)}`);
  L.push("");

  L.push("## Lanes — who acts");
  L.push("");
  if (row.laneDetails.length === 0) {
    L.push("_No lanes._");
  } else {
    L.push("| lane | role | what it does here |");
    L.push("|---|---|---|");
    for (const l of row.laneDetails) L.push(`| <a id="${laneAnchor(l.id)}"></a>${esc(l.name)} | ${l.roleRef ? `\`${l.roleRef}\`` : "—"} | ${cell(l.documentation)} |`);
  }
  L.push("");

  L.push("## Steps");
  L.push("");
  const undoc = row.steps.filter((st) => !st.documentation).length;
  L.push(
    undoc === 0
      ? `Every one of the ${row.steps.length} step(s) is documented.`
      : `**${undoc}** of ${row.steps.length} step(s) carry no documentation — \`activity-documented\` lists them.`,
  );
  L.push("");
  const stepRows: string[] = [];
  for (const st of row.steps) {
    const target = st.calledElement
      ? `calls ${byId.get(st.calledElement) ? proc(byId.get(st.calledElement)!) : `\`${st.calledElement}\``}`
      : st.globalTask
        ? `shared step \`${st.globalTask.id}\`${st.globalTask.inputs ? ` (${Object.entries(st.globalTask.inputs).map(([k, v]) => `${k} = \`${v}\``).join(", ")})` : ""}`
        : "";
    const how = [target, ...st.skills.map(skill)].filter(Boolean).join("<br>") || "—";
    // A business-process task keeps its text in the `.md` beside the diagram
    // (`<cat-harness.processes:narrative>`, Q-OB-17 A): shown here, and named
    // when it cannot be found, so a broken link is visible.
    const narr = st.narrative
      ? st.narrative.text
        ? `${st.documentation ? "<br><br>" : ""}${cell(st.narrative.text)}`
        : `${st.documentation ? "<br>" : ""}_narrative \`${esc(st.narrative.href)}\` not found_`
      : "";
    stepRows.push(`| <a id="${stepAnchor(st.id)}"></a>**${esc(st.name)}**<br>\`${st.id}\` | ${cell(st.lane)} | ${how} | ${st.documentation || !st.narrative ? cell(st.documentation) : ""}${narr} |`);
  }
  L.push(...tableOrNone(["step", "lane", "skill / sub-process", "what it does"], stepRows, "_No steps._"));
  L.push("");

  // Only when there is one: a linear process has no decision to show, and an
  // empty table would read as a section somebody forgot to fill.
  if (row.decisions.length > 0) {
    L.push("## Decisions");
    L.push("");
    const undocDec = row.decisions.filter((d) => !d.documentation).length;
    L.push(
      undocDec === 0
        ? `Every one of the ${row.decisions.length} decision(s) is documented.`
        : `**${undocDec}** of ${row.decisions.length} decision(s) carry no documentation — \`gateway-documented\` lists them.`,
    );
    L.push("");
    L.push("| decision | what decides it | branches |");
    L.push("|---|---|---|");
    for (const d of row.decisions) {
      const branches = d.branches.map((b) => `${b.label ? `**${esc(b.label)}**` : "_(unnamed)_"} → ${esc(b.to)}`).join("<br>");
      L.push(`| **${esc(d.name)}**<br>\`${d.id}\` | ${cell(d.documentation)} | ${branches} |`);
    }
    L.push("");
  }
  L.push(...wrapRaw(L.splice(rawFrom).join("\n")));
  return `${L.join("\n")}\n`;
}

/**
 * Where the page goes: the route of the visualiser cat-harness DECLARES this
 * Tool draws — `cat-harness/processes/index.md` (owner, 2026-10-09:
 * `<base>/<harness>/<visualizer>`). Never a literal — `site-dir-single-answer`
 * refuses one, and the declaration is the only thing that names it.
 */
export function pageRelPath(repo = REPO, subgraph?: string): string | undefined {
  // A sub-graph page is `<locale>/<harness>/processes/<instance>/index.md`,
  // as the tools viewer draws its own (bean `folio-assistant-1nu0`).
  try {
    const { rel, visualiser: v } = visualiserSitePath(join(repo, "cat-harness"), VIEWER_TOOL);
    if (subgraph === undefined) return rel;
    return visualiserRoute({ ...pageParts({ harness: v.harness, visualiser: v.id }), subgraph, asset: "index.md" });
  } catch {
    return undefined;
  }
}

/** The sub-graph pages: one per layer holding diagrams, in layer order. */
export function subgraphPages(rows: readonly ProcessRow[]): { name: string; rows: ProcessRow[] }[] {
  const by = new Map<string, ProcessRow[]>();
  for (const r of rows) if (r.instance) by.set(r.instance, [...(by.get(r.instance) ?? []), r]);
  return [...by].sort((a, b) => a[0].localeCompare(b[0], "en")).map(([name, rs]) => ({ name, rows: rs }));
}

/** From a page of this viewer back to the site root — the route's depth, never a literal `../`. */
function up(repo = REPO): string {
  try {
    return visualiserSitePath(join(repo, "cat-harness"), VIEWER_TOOL).up;
  } catch {
    // No declaration (a fixture checkout): the depth the declared route has.
    return siteRootFrom(pageParts({ harness: "cat-harness", visualiser: "processes" }));
  }
}

/**
 * The index as committed: {@link page} plus the directories it draws
 * (#1168 B7a-2) — every layer's declared processes directories, because
 * every layer's diagrams are on it.
 */
/** The scope of the top index page: one "By subgraph" row per sub-graph page. */
export function indexScope(rows: readonly ProcessRow[]): PageScope {
  return { subjects: subgraphPages(rows).map((x) => ({ name: x.name, count: x.rows.length, href: `${x.name}/` })) };
}

export function defaultSkillPages(
  rows: readonly ProcessRow[],
  repo = REPO,
  rel = pageRelPath(repo),
): SkillPages {
  const roots = instanceRoots(repo);
  const sourceFiles = skillSourceFilesOf(repo, roots);
  const linked = skillLinksOf(repo, roots);
  const named = new Set(rows.flatMap((r) => [...r.skills, ...(r.laneDetails ?? []).flatMap((l) => l.roleSkills.map((x) => x.skill))]));
  const localSkills = [...named].filter((n) => !linked.has(n) && sourceFiles.has(n)).sort();
  return Object.assign(new Set(linked), {
    sources: linked.sources ?? new Map<string, string>(),
    ...(rel !== undefined
      ? { local: new Map(localSkills.map((n) => [n, `${dirname(rel)}/${SOURCE_SKILLS_DIR}/${n}.html`])) }
      : {}),
  });
}

export function publishedIndex(
  rows: Parameters<typeof page>[0],
  repo = REPO,
  skillPages: SkillPages = defaultSkillPages(rows, repo),
  // Read by default, as `skillPages` is: the committed instances are an input
  // of the page, so a caller that omits them gets the page the generator writes.
  instances: InstancesRead = instancesRead(workflowInstanceLinks()),
  // Defaults to the index page, with its "By subgraph" table, so a caller that
  // omits it gets the page the generator writes (the committed-page check).
  scope: PageScope = indexScope(rows),
): string {
  return withRenderedByFrontMatter(page(rows, skillPages, instances, scope), VIEWER_TOOL);
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const rel = pageRelPath();
  if (rel === undefined) {
    console.error("no visualiser declared for the `processes` graph — nothing to write");
    process.exit(1);
  }
  const into = siteArg();
  const out = join(into ?? baseDocsDir(REPO), rel);
  // A scoped site (`--scope`, owner 2026-11-08 Q-SZ-2 "B") writes the pages of
  // its scope's diagrams only. Every diagram still resolves the links a page
  // makes; one out of scope is linked on its own layer's site.
  const scope = siteScope();
  const all = await processRows();
  const rows = all.filter((r) => inScope(scope, r.instance ?? ""));
  if (scope !== undefined) console.log(`  scope ${scopeArg(scope)}: ${rows.length} of ${all.length} diagram(s)`);
  // VACUITY GUARD. A sweep that found nothing reports a clean corpus, which is
  // the `dh4f` shape this page's own Findings section exists to raise — and the
  // first run of this generator did it: 0 diagrams, exit 0, over a corpus of 62.
  // An empty result is never a pass here; if the corpus is genuinely empty this
  // page has no reason to exist.
  if (rows.length === 0) {
    console.error("✗ no BPMN diagrams found — refusing to write an index over nothing");
    process.exit(1);
  }
  // A skill the diagrams name with no instruction page gets a page rendered
  // from its source, in this viewer's `skills/` (owner, 2026-11-08: "fill in
  // missing"); one with no source either stays code.
  const sourceFiles = skillSourceFilesOf(REPO, instanceRoots(REPO));
  const linked = skillLinksOf(REPO, instanceRoots(REPO));
  const named = new Set(rows.flatMap((r) => [...r.skills, ...(r.laneDetails ?? []).flatMap((l) => l.roleSkills.map((x) => x.skill))]));
  const localSkills = [...named].filter((n) => !linked.has(n) && sourceFiles.has(n)).sort();
  const skillPages = defaultSkillPages(rows, REPO, rel);
  // The workflow instances each diagram runs in (bean `v49e`): links to their
  // pages, read from the committed instance files the state visualiser draws.
  const instances = instancesRead(workflowInstanceLinks());
  const subs = subgraphPages(rows);
  const html = publishedIndex(rows, REPO, skillPages, instances, indexScope(rows));
  // Which page sections present each diagram, keyed repository-relative so it
  // matches `row.file` — a page spells its source relative to its OWN layer.
  const presented = new Map<string, Presentation[]>();
  for (const root of instanceRoots(REPO)) {
    for (const [source, list] of await processPresentations(root)) {
      // Into a site being built, only the presenting pages that site carries are linked.
      presented.set(relative(REPO, join(root, source)), into === undefined ? list : list.filter((p) => sitePageAt(into, p.href)));
    }
  }
  const pages = new Map<string, string>([[out, html]]);
  // One page per sub-graph (owner, 2026-11-01: show a sub-graph's processes
  // on its own page), as `tools`, `library` and `beans` already have.
  for (const x of subs) {
    const sub = pageRelPath(REPO, x.name);
    if (sub !== undefined) pages.set(join(into ?? baseDocsDir(REPO), sub), publishedIndex(x.rows, REPO, skillPages, instances, { instance: x.name }));
  }
  const ctx = panelContext(REPO, skillPages);
  const localSet = new Set(localSkills);
  const contractRoots = instanceRoots(REPO);
  const contractHref = forgeHrefFor(REPO);
  for (const n of localSkills) {
    const src = sourceFiles.get(n)!;
    pages.set(
      join(dirname(out), SOURCE_SKILLS_DIR, `${n}.md`),
      sourceSkillPageMd(n, readFileSync(src.file, "utf-8"), src.url, relative(REPO, src.file), localSet, rows, skillContractSectionMd(n, contractRoots, REPO, contractHref)),
    );
  }
  // Whether the ⓘ panel shows skills: the site's declaration, on unless it
  // says `site.taskSkills: false` (`taskSkillsDeclared`).
  const skills = taskSkillsDeclared(REPO);
  const unlinked = new Map<string, { title: string; refs: UnlinkedRef[] }>();
  for (const r of rows.filter((x) => x.loadError === undefined)) {
    const refs = new Set<string>();
    pages.set(join(dirname(out), `${r.stem}.md`), processPage(r, all, skillPages, presented.get(r.file), instances, (x) => refs.add(x)));
    // QA (owner, 2026-10-31): a reference the prose makes that no page can
    // answer is reported, never left as silent plain text.
    for (const x of refs) {
      console.error(`⚠ ${r.file}: documentation names ${x.startsWith("skill:") ? `skill \`${x.slice(6)}\`, which has no instruction page` : `\`${x}\`, which no loaded diagram declares`}`);
    }
    // The ⓘ panel's data, fetched by the page only when a marker is opened.
    if (r.markers) {
      const data = taskPanelData(r, all, ctx, { skills });
      pages.set(join(dirname(out), panelFile(r.stem)), `${JSON.stringify(data, null, 1)}\n`);
      unlinked.set(r.stem, { title: r.name, refs: unlinkedPanelRefs(data) });
    }
  }
  // QA (owner, 2026-11-08: "need QA report"): every name a panel shows as
  // "no page for this one", on a page of its own and here, once per name.
  pages.set(join(dirname(out), PANEL_LINKS_QA), panelLinksReport(unlinked, GENERATED_FM));
  const seenRef = new Set<string>();
  for (const [stem, p] of unlinked) {
    for (const x of p.refs) {
      const key = `${x.kind}\0${x.name}`;
      if (seenRef.has(key)) continue;
      seenRef.add(key);
      console.error(`⚠ task panel: ${x.kind} \`${x.name}\` links nowhere (first on ${stem}${x.task ? ` at ${x.task}` : ""}) — see ${PANEL_LINKS_QA}`);
    }
  }
  // The panel's client and styles as files beside the sidecars, the same text
  // each process page carries inline, so any page of the site that shows a
  // drawing (a guide's business-processes page) gives it the same ⓘ panel:
  // `<div class="pt-diagram" data-panel="<route>/<stem>.tasks.json">` around
  // the drawing's <img>, and these two files.
  pages.set(join(dirname(out), PANEL_CLIENT.script), `${PANEL_SCRIPT}\n`);
  pages.set(join(dirname(out), PANEL_CLIENT.style), `${PANEL_CSS}\n`);
  // A page whose diagram is gone is REPORTED, never deleted — the
  // deletion-requires-confirmation rule, applied to generated output too.
  const orphans = (existsSync(dirname(out)) ? readdirSync(dirname(out)) : [])
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(dirname(out), f))
    .filter((f) => !pages.has(f));
  for (const o of orphans) console.error(`! ${relative(REPO, o)} matches no diagram — remove it if the diagram is gone`);
  if (check) {
    const stale = [...pages].filter(([f, body]) => (existsSync(f) ? readFileSync(f, "utf-8") : "") !== body);
    if (stale.length) {
      for (const [f] of stale) console.error(`✗ ${relative(REPO, f)} is stale — run \`bun run cat processes:viz\``);
      process.exit(1);
    }
    console.log(`✓ ${rel} and ${pages.size - 1} process page(s) are current (${rows.length} diagram(s))`);
  } else {
    for (const [f, body] of pages) {
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, body);
    }
    // THE DRAWING EACH PAGE LINKS. A page links the site copy by stem
    // (`assets/img/workflows/<stem>.svg`), which `render:bpmn` writes into
    // the harness's own site — but a folio's site build composes the chrome
    // and never runs it, and since the drawings moved beside their .bpmn
    // (#1504) no mount carries the site copy either. dth-hrh's publish then
    // refused 137 dead links (run 42192237981). Into a site being built, a
    // drawing the site lacks is copied from beside its source: the same
    // layout, its step links reaching sibling diagrams rather than this
    // site's pages, which is a lesser drawing but never a dead one.
    if (into !== undefined) {
      let copied = 0;
      for (const r of rows) {
        if (r.svg === undefined) continue;
        const site = join(into, "assets/img/workflows", `${r.stem}.svg`);
        if (existsSync(site)) continue;
        mkdirSync(dirname(site), { recursive: true });
        copyFileSync(join(REPO, r.svg), site);
        copied++;
      }
      if (copied > 0) console.log(`  copied ${copied} drawing(s) from beside their .bpmn into the site's assets/img/workflows/`);
    }
    // THE TILE COUNT (folio-assistant#931, owner's ruling 2026-10-29): the
    // index's own diagram count, keyed by the tile that opens the index.
    // Build-time data like every projection `scanTileCounts` reads, so
    // `--check` does not compare it.
    const counted = tileCountsForPages(
      [{ page: relative(REPO, out), count: rows.length, unit: ["diagram", "diagrams"] }],
      REPO,
      resolve(HARNESS_ROOT),
    );
    const countFile = join(into ?? baseDocsDir(REPO), "assets", "processes", "index.json");
    mkdirSync(dirname(countFile), { recursive: true });
    writeFileSync(countFile, JSON.stringify(tileCounts(counted), null, 2) + "\n");
    console.log(`Wrote ${rel} + ${pages.size - 1} process page(s) — ${skillToProcesses(rows).size} skill(s) joined`);
  }
}
