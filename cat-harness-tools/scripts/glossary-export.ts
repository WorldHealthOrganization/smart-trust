#!/usr/bin/env bun
/**
 * The swimlane glossary — the personas a corpus's diagrams put in lanes, as SKOS.
 *
 * @module scripts/glossary-export
 * @covers glossary, swimlane-glossary, scenarios — it writes the glossary graph AND
 *   the retirement ledger that `swimlane-glossary` holds
 *
 * The input is each BPMN lane's name and `<bpmn:documentation>`
 * (`check:lane-documentation` keeps the latter present). The output is a
 * separate glossary document in the same layer namespace, not part of
 * `ns-export`'s vocabulary: a persona like `Board renderer` is a
 * `skos:Concept`, not an `rdfs:Class`. `--check` is its staleness gate.
 *
 * ## A concept is a ROLE, not a lane
 *
 * One role is named many ways across the corpus (`build-pipeline` as "CI/CD
 * Pipeline", "Build pipeline — validate · render · publish", …), so there is
 * one concept per declared role and the lane names become `skos:altLabel`:
 * *"Reviewer / SME"* is findable as the same term as *"Reviewer"*. A lane's
 * `name` arrives as `prefLabel`/`altLabel`; its `documentation` as
 * `skos:scopeNote`.
 *
 * ## `scopeNote` sits on the USAGE, and never on the concept
 *
 * A scope note answers *"what is this lane accountable for IN THIS PROCESS"*,
 * and differs per appearance. So each appearance is its own `LaneUsage` node
 * carrying the process it is in, the label the lane used there, and the note
 * verbatim. Verbatim, because the note is extracted to `.pot` as its own
 * msgid; a wrapped string would match no catalogue entry.
 *
 * ## No second name for one thing
 *
 * A concept's `@id` is the IRI `kg-export` ALREADY mints for that role —
 * `makeIri(docIri, "role", id)`, imported rather than re-spelled — so the
 * glossary joins the graph that carries `performedBy` links to those IRIs.
 *
 * ## `laneBinding`, so a definition-less term can be TRUE rather than missing
 *
 * A lane whose performer varies by design —
 * `bootstrap/workflows/log-message.bpmn`'s `Actor`, whose performer is
 * whoever called the sub-process — emits a concept with a scope note and **no
 * definition**, distinguishable from a lane nobody bound.
 *
 * ## Retirement needs a LEDGER, because a derived document has no memory
 *
 * A term whose defining lane is gone becomes `deprecated`, **reported and
 * never deleted** (`deletion-requires-confirmation`): retirement and accident
 * must not look alike. A regenerated document would simply drop it, so the one
 * non-derivable fact — *this term was once minted* — is committed, and the
 * document is rebuilt from the corpus UNION the ledger.
 *
 * The ledger keys on the IRI's local part (`role/<id>`), never the absolute
 * IRI: the publication base is a deploy-time variable (`--base-url`,
 * `KG_BASE_URL`).
 *
 * Usages are not ledgered: a usage is an occurrence, regenerated wholesale; a
 * concept is a term somebody may have cited.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/glossary-export.ts [--instance ROOT] [--out FILE]
 *   bun run cat-harness-tools/scripts/glossary-export.ts --check
 *
 * @conformsTo w3c-owl2
 * @conformsTo w3c-rdfs
 * @conformsTo w3c-skos
 */
import { LEDGER_SCHEMA, LEDGER_SCHEMA_NAME, LEGACY_LEDGER_SCHEMA } from "../schemas/library/glossary-ledger.ts";
import { tagCompatible } from "@litlfred/bootstrap-tools/schemas/release-iri.ts";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { ownElementPattern, termIri } from "../schemas/kg/namespaces.js";
import {
  declaringInstanceOf,
  defaultGraphTypologies,
  graphTypologyIri,
  graphTypologyLayer,
  kindTitle,
  ownPrefixTable,
  type GraphTypologyRegistry,
} from "../schemas/kg/graph-typology-registry.js";
import { laneBinding, readRoleGraph, type LaneBinding, type RoleDef, type RoleGraph } from "../schemas/process/role-graph.js";
import { glossaryHomeFor, readDeclaration, repoRootFor } from "../schemas/kg/cat-harness.js";
import { kgRoots } from "./known-skills.js";
import { declaredSubgraphNode, exportIdentity, makeIri } from "./kg-export.js";
import { legacyFragmentIri } from "./lib/subject-iri.ts";
import { placedOut } from "./lib/moved-document.ts";
import { codeListDirs, loadCodeLists } from "../schemas/library/code-list.js";
import { gitFiles } from "../schemas/sdlc/git-corpus.ts";
import { buildCodeListsDoc } from "./code-lists.js";
import { applyVocabMapping, vocabMapping } from "../schemas/content/vocab-mapping.js";
import { HARNESS_NAME, HARNESS_ROOT } from "./lib/roots.ts";
import { nodeKindIndex } from "../schemas/kg/node-kind-index.js";
import { isNodeKind, type NodeKind } from "../schemas/kg/node-kind.js";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";
import { exitNotApplicable } from "./lib/not-applicable.ts";
import { rootProfile } from "./lib/root-gate-set.ts";

const ROOT = resolve(HARNESS_ROOT);
const SKOS = "http://www.w3.org/2004/02/skos/core#";
const DCTERMS = "http://purl.org/dc/terms/";
const OWL = "http://www.w3.org/2002/07/owl#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";

/** The committed directory, relative to a layer root. */
export const GLOSSARY_DIR = "glossary";
/** The ledger's filename — the one non-derivable fact this module stores. */
export const LEDGER_FILENAME = "glossary-ledger.json";
/** Tagged so the file declares what it is, per the directory conventions. */
export { LEDGER_SCHEMA } from "../schemas/library/glossary-ledger.ts";

// ── The corpus ──────────────────────────────────────────────────

/** Activity elements — the same list `check-lane-documentation` scopes by. */
const ACTIVITY =
  "task|userTask|serviceTask|scriptTask|manualTask|sendTask|receiveTask|businessRuleTask|callActivity|subProcess";

/** One swimlane, in one process, in one diagram. */
export interface LaneOccurrence {
  /** Repo-relative diagram path — provenance a reader can open. */
  readonly file: string;
  /** The BPMN process the lane's laneSet belongs to. */
  readonly processId: string;
  readonly processName: string | null;
  readonly laneId: string;
  readonly laneName: string | null;
  /** `<bpmn:documentation>`, verbatim — see the header on why verbatim. */
  readonly documentation: string | null;
  readonly roleRef?: string;
  readonly performerVaries: boolean;
  /** Activities in the lane. Zero means it is not a swimlane in this sense. */
  readonly activities: number;
}

/**
 * Every `.bpmn` diagram git accounts for, outside dot directories.
 *
 * `xd1g`. Measured at the conversion: **74 before, 74 after**.
 */
function bpmnFiles(root: string): string[] {
  return gitFiles(root, (rel) => rel.endsWith(".bpmn") && !rel.split("/").some((s) => s.startsWith("."))).files;
}

/**
 * Read every lane in a layer's diagrams, scoped to its own process.
 *
 * Regex rather than a parse, matching `check-lane-documentation`,
 * `check-workflow-refs` and `translate-bpmn` beside it — one generator and
 * one set of agents write this corpus, and a parser dependency for four
 * element names is a cost with no finding behind it.
 *
 * **Lanes are read INSIDE their `<bpmn:process>`** rather than from the file,
 * which the sibling checks do not need and this does: a usage node names the
 * process it is in, and a collaboration diagram holds several. Reading lanes
 * flat would attribute every lane to whichever process matched first.
 */
export function readLanes(instanceRoot: string, repoRoot: string): LaneOccurrence[] {
  const out: LaneOccurrence[] = [];
  for (const f of bpmnFiles(instanceRoot)) {
    const rel = relative(repoRoot, f);
    const xml = readFileSync(f, "utf-8");
    const procRe = /<(?:bpmn:)?process\b([^>]*)>([\s\S]*?)<\/(?:bpmn:)?process>/g;
    for (let p = procRe.exec(xml); p !== null; p = procRe.exec(xml)) {
      const pAttrs = p[1] ?? "";
      const pBody = p[2] ?? "";
      const processId = /id="([^"]+)"/.exec(pAttrs)?.[1];
      if (processId === undefined) continue;
      const processName = /name="([^"]+)"/.exec(pAttrs)?.[1] ?? null;

      const acts = new Set<string>();
      const actRe = new RegExp(`<(?:bpmn:)?(?:${ACTIVITY})\\b[^>]*id="([^"]+)"`, "g");
      for (let a = actRe.exec(pBody); a !== null; a = actRe.exec(pBody)) acts.add(a[1]!);

      const laneRe = /<(?:bpmn:)?lane\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:bpmn:)?lane>)/g;
      for (let m = laneRe.exec(pBody); m !== null; m = laneRe.exec(pBody)) {
        const attrs = m[1] ?? "";
        const body = m[2] ?? "";
        const laneId = /id="([^"]+)"/.exec(attrs)?.[1];
        if (laneId === undefined) continue;
        const members = new Set<string>();
        const refRe = /<(?:bpmn:)?flowNodeRef>([^<]+)<\/(?:bpmn:)?flowNodeRef>/g;
        for (let r = refRe.exec(body); r !== null; r = refRe.exec(body)) members.add(r[1]!.trim());
        // An EMPTY `<documentation/>` is not documentation — the same guard
        // `check-lane-documentation` applies, and for the same reason: a gate
        // satisfiable by a keystroke stops meaning anything.
        const doc = /<(?:bpmn:)?documentation[^>]*>([\s\S]*?)<\/(?:bpmn:)?documentation>/.exec(body)?.[1]?.trim();
        out.push({
          file: rel,
          processId,
          processName,
          laneId,
          laneName: /name="([^"]+)"/.exec(attrs)?.[1] ?? null,
          documentation: doc !== undefined && doc.length > 0 ? doc : null,
          // The Role the lane NAMES: standard BPMN `partitionElementRef`
          // first, the legacy `<bootstrap.processes:role ref>` only when it is
          // absent (owner, 2026-10-16 — the precedence `laneRoleBinding` in
          // `process-model.ts` applies to the parsed model).
          roleRef:
            /\bpartitionElementRef="([^"]+)"/.exec(attrs)?.[1] ??
            ownElementPattern(xml, "role", String.raw`[^>]*\bref="([^"]+)"`, "").exec(body)?.[1],
          performerVaries: ownElementPattern(xml, "role", String.raw`[^>]*\bvariable="true"`, "").test(body),
          activities: [...members].filter((x) => acts.has(x)).length,
        });
      }
    }
  }
  return out;
}

// ── The ledger ──────────────────────────────────────────────────

export interface LedgerEntry {
  /** The current label — what a retired concept keeps being shown as. */
  readonly prefLabel: string;
  /** Labels this key carried before, oldest first (#1168 B10b) — published as skos:hiddenLabel. */
  readonly formerLabels?: readonly string[];
  /** ISO date this key was first written. */
  readonly firstSeen: string;
  /** ISO date it stopped being derivable, or `null` while it still is. */
  readonly retiredOn: string | null;
}

export interface Ledger {
  readonly $schema: string;
  /** Which layer's glossary this is — the stub, never a path. */
  readonly instance: string;
  /** Keyed by the IRI's LOCAL PART, never the absolute IRI. See the header. */
  readonly concepts: Record<string, LedgerEntry>;
}

/**
 * The ledger's file: in the layer's own `swimlane-glossary` directory, or —
 * for a layer that declares none, as bootstrap does not since 2026-09-30 —
 * hosted in this harness's under the layer's stub ({@link glossaryHomeFor}).
 */
/**
 * A live key's next ledger entry. New: minted today. Known: keeps its
 * `firstSeen`, is un-retired, and — when its label changed — keeps the old
 * label in `formerLabels` rather than minting a new term (#1168 B10b, owner
 * 2026-09-30: "use SKOS for rename/alternate name"; published as
 * skos:hiddenLabel, so the old name still finds it).
 */
export function liveLedgerEntry(was: LedgerEntry | undefined, label: string, now: string): LedgerEntry {
  if (was === undefined) return { prefLabel: label, firstSeen: now, retiredOn: null };
  const former = [...(was.formerLabels ?? [])];
  if (was.prefLabel !== label && !former.includes(was.prefLabel)) former.push(was.prefLabel);
  // The current label is never also a former one (a lane renamed back).
  const kept = former.filter((f) => f !== label);
  return {
    prefLabel: label,
    ...(kept.length > 0 ? { formerLabels: kept } : {}),
    firstSeen: was.firstSeen,
    retiredOn: null,
  };
}

export function ledgerPath(instanceRoot: string): string {
  return join(glossaryHomeFor(instanceRoot, ROOT).root, LEDGER_FILENAME);
}

export function readLedger(instanceRoot: string, stub: string): Ledger {
  const p = ledgerPath(instanceRoot);
  if (!existsSync(p)) return { $schema: LEDGER_SCHEMA, instance: stub, concepts: {} };
  const raw = JSON.parse(readFileSync(p, "utf-8")) as Ledger;
  // A ledger that is not one is REFUSED rather than replaced. Overwriting it
  // would delete every retirement record in the file — the one thing this
  // module exists to keep — on the strength of a parse this code got wrong.
  if (raw.$schema !== LEGACY_LEDGER_SCHEMA && !tagCompatible(raw.$schema, LEDGER_SCHEMA_NAME, 1)) {
    throw new Error(`${p}: expected "$schema": "${LEDGER_SCHEMA}", found ${JSON.stringify(raw.$schema)}`);
  }
  return { ...raw, $schema: LEDGER_SCHEMA };
}

// ── Node kinds and harnesses ────────────────────────────────────

/**
 * The node kinds a layer DECLARES — the ones its glossary defines.
 *
 * Work item folio-assistant-dkqd (2026-11-04): the glossary held roles only,
 * so "Work item", "Skills", "Library" and the rest of the words a reader meets
 * for what a harness keeps were defined nowhere a reader looks a word up.
 *
 * One glossary per layer, as for roles (`7u3g`): a kind is defined by the
 * layer that declares it, never by every layer that can see it. A kind
 * read from a `typologies/` graph carries its declarer; a base kind belongs to
 * the layer whose namespace names it ({@link graphTypologyLayer}): bootstrap's
 * to `bootstrap`, the harness's to this harness. A `core` kind with no
 * declarer belongs to nobody here, and is left for the layer that declares it.
 */
export function kindsDeclaredBy(
  instanceRoot: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): string[] {
  const root = resolve(instanceRoot);
  const name = readDeclaration(root)?.name;
  if (name === undefined) return [];
  const own: string[] = [];
  for (const kind of registry.names()) {
    const def = registry.get(kind);
    const by = declaringInstanceOf(def);
    if (by !== undefined) {
      if (resolve(by.root) === root) own.push(kind);
      continue;
    }
    const layer = graphTypologyLayer(kind, def);
    if ((layer === "harness" && name === HARNESS_NAME) || (layer === "bootstrap" && name === "bootstrap")) own.push(kind);
  }
  return own.sort((a, b) => a.localeCompare(b, "en"));
}

/** One node kind, as the glossary defines it. */
export interface NodeKindTerm {
  /** `nodeKind()`'s id: `bean`, `memory-record-core`. */
  readonly id: string;
  /** The `$schema` a node carries, for a kind whose nodes are files. */
  readonly tag?: string;
  /** {@link NodeKind.term}: what one node is called. */
  readonly term?: string;
  /** {@link NodeKind.summary}: what a node is. */
  readonly summary?: string;
  /** Direct parents, by id, in declared order. */
  readonly parents: readonly string[];
}

/**
 * The node kinds a layer declares, with the ancestors nothing else
 * declares, read from the node-kind index (`schemas/kg/node-kind-index.ts`).
 *
 * A node kind is the schema a FILE is written against (`bean/1.0.0`), as a
 * graph kind is the schema of a directory. The index already finds them and
 * their parents; the label and definition are read off the kind itself, by
 * importing the module the index names, so the index file's format is
 * unchanged. An ancestor that no typology names (`memory-record-core`, a
 * mixin) has no declarer, and is defined by the layer whose kind inherits
 * it, so "Work item" has a broader term to point at.
 *
 * Async because the index imports the validator modules; {@link buildGlossary}
 * stays synchronous and takes the result.
 */
export async function nodeKindTerms(instanceRoot: string, repoRoot: string): Promise<NodeKindTerm[]> {
  const root = resolve(instanceRoot);
  const name = readDeclaration(root)?.name;
  if (name === undefined) return [];
  const index = await nodeKindIndex(defaultGraphTypologies, root, repoRoot);
  const byId = new Map(index.kinds.map((k) => [k.id, k]));
  const kinds = new Map<string, NodeKind>();
  const walk = (k: NodeKind): void => {
    if (kinds.has(k.id)) return;
    kinds.set(k.id, k);
    for (const p of k.parents) walk(p);
  };
  const own = index.kinds.filter((k) => k.declaredBy === name && k.module !== undefined && k.exportName !== undefined);
  for (const e of own) {
    try {
      // input-site: imports */schemas/**/*.ts,schemas/**/*.ts #20fa4b57 — the validator modules the node-kind index already named
      const mod = (await import(resolve(repoRoot, e.module!))) as Record<string, unknown>;
      const k = mod[e.exportName!];
      if (isNodeKind(k)) walk(k);
    } catch {
      // The index resolved this module a moment ago; a failure here is the
      // index's to report (`unkinded: unresolvable`), not a missing term.
    }
  }
  const ownIds = new Set(own.map((e) => e.id));
  const out: NodeKindTerm[] = [];
  for (const [id, k] of kinds) {
    // An ancestor another layer declares is THAT layer's term.
    if (!ownIds.has(id) && byId.get(id)?.declaredBy !== undefined) continue;
    out.push({
      id,
      ...(k.tag !== undefined ? { tag: k.tag } : {}),
      ...(k.term !== undefined ? { term: k.term } : {}),
      ...(k.summary !== undefined ? { summary: k.summary } : {}),
      parents: k.parents.map((p) => p.id),
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id, "en"));
}

/** `memory-record-core` → "Memory record core": a label for a kind that declares no term. */
function humanise(id: string): string {
  const w = id.replace(/-/g, " ").trim();
  return w === "" ? id : w.charAt(0).toUpperCase() + w.slice(1);
}

/** The first sentence of a declaration's free text, for a definition. */
function firstParagraph(s: string | undefined): string | undefined {
  const t = s?.split(/\n\s*\n/)[0]?.trim();
  return t === undefined || t === "" ? undefined : t;
}

// ── The document ────────────────────────────────────────────────

export interface GlossaryReport {
  /** Concepts emitted, live and retired together. */
  readonly concepts: number;
  /** ...of those, deprecated. */
  readonly retired: string[];
  /** Newly retired by THIS run — the finding a reader acts on. */
  readonly newlyRetired: string[];
  /** Retired keys that became derivable again, so the flag was cleared. */
  readonly restored: string[];
  /** Lane occurrences that became usage nodes. */
  readonly usages: number;
  /** Mapping tables absent from the harness, so their family was not built — reported, never read as empty. */
  readonly notBuilt: readonly string[];
  /** Live concepts by family: roles (with the varying lanes), graph kinds, node kinds, harnesses. */
  readonly families: { readonly roles: number; readonly kinds: number; readonly nodeKinds: number; readonly harnesses: number };
  /** Declared roles no task-containing lane in this layer draws. */
  readonly undrawn: string[];
  /**
   * ...of those, the ones a lane OUTSIDE this layer binds by
   * `<folio:role ref>`, with the diagrams that draw them. Bean `nafz`: the
   * walk is scoped to one layer (a glossary is published per layer), so
   * "no swimlane draws" is a fact about the WALK, and a role drawn in a
   * dependent's diagram must not read like one drawn nowhere. Informational —
   * it does not change the glossary, only what the report claims.
   */
  readonly drawnElsewhere: ReadonlyArray<{ role: string; files: string[] }>;
  /** Lanes whose binding is dangling or contradictory — reported, not gated. */
  readonly problems: string[];
  /**
   * Graph-kind terms this run derives that the committed ledger does not hold
   * YET, for kinds defined in the registry's code rather than by a node of
   * the layer's own ({@link pendingKind}). Minted on the build day, written
   * by the next `glossary:export`, and reported; not stale on their own.
   */
  readonly pending: string[];
  /**
   * True when the ledger on disk differs from the one this run computed, the
   * {@link pending} terms aside: a recorded term changed, was retired or came
   * back, the ledger names another layer, or a term of any other family is
   * missing.
   */
  readonly ledgerStale: boolean;
}

/**
 * Whether a graph kind's term may be PENDING in the ledger: the kind is defined
 * by the registry's code (`BASE_GRAPH_TYPOLOGIES`, in cat-harness-tools), not by
 * a `typologies/` node of the layer whose ledger records it.
 *
 * The ledger is committed in cat-harness (`glossary/`), a layer BELOW the code
 * that defines these kinds, and each layer's pull request is judged against
 * the other's main. A kind added to the registry therefore makes the ledger
 * lack its term on the registry's own pull request, and adding the term first
 * makes the ledger name a kind that main does not define; with an equality
 * check, one of the two mains is red until the other merges. So the term may
 * lag: it is minted on the build day, reported as pending, and recorded by the
 * ledger's writer in a cat-harness pull request after the kind lands. It is
 * the ONLY lag allowed: a recorded term whose label changed, a term retired or
 * restored, and every term of a family the layer derives from its own
 * files (roles, the harness, node kinds) are still stale.
 */
export function pendingKind(def: object | undefined): boolean {
  return def !== undefined && declaringInstanceOf(def) === undefined;
}

export interface GlossaryBuild {
  readonly doc: Record<string, unknown>;
  readonly ledger: Ledger;
  readonly report: GlossaryReport;
}

/** Today, as an ISO date — injectable so a test is not a clock. */
export type Today = () => string;
const isoToday: Today = () => {
  // input-site: traced #ced8684a — today, when the caller gives no date: a run that reaches it records no hash
  inputSiteReached("glossary-export: today");
  return new Date().toISOString().slice(0, 10);
};

/**
 * The glossary document's own IRI, derived from the graph document's PATH.
 *
 * `docPath` rather than `<stub>.jsonld` recomposed from the stub: the host
 * layer publishes at `<stub>.jsonld` and a foreign one at
 * `<stub>/<stub>.jsonld` (bean `dyd3`), and a caller that rebuilds the path
 * gets the host's answer for every layer.
 */
export function glossaryIri(base: string, docPath: string): string {
  return `${base.replace(/\/$/, "")}/${docPath.replace(/\.jsonld$/, "-glossary.jsonld")}`;
}

/**
 * Build the glossary for one layer.
 *
 * `laneBinding` is asked once per occurrence and its answer is the only route
 * from a lane to a concept, so a `variable` lane cannot accidentally be read
 * as `unbound` — the distinction bean `ug4r` exists to preserve.
 */
export function buildGlossary(opts: {
  instanceRoot?: string;
  baseUrl?: string;
  today?: Today;
  /**
   * The node kinds to define ({@link nodeKindTerms}). Absent: none, and the
   * ledger keeps any `node-kind/…` keys it already holds as they are rather
   * than retiring them, because a caller that did not ask is not evidence the
   * kinds are gone. {@link buildFullGlossary} asks.
   */
  nodeKinds?: readonly NodeKindTerm[];
  /** The committed ledger to judge against. Absent: the one on disk ({@link readLedger}). */
  ledger?: Ledger;
} = {}): GlossaryBuild {
  const instanceRoot = resolve(opts.instanceRoot ?? ROOT);
  const repoRoot =
    [repoRootFor(ROOT), join(repoRootFor(ROOT), "..", "..")].find((d) => existsSync(join(d, ".git"))) ??
    repoRootFor(ROOT);
  const decl = readDeclaration(instanceRoot);
  const hasGlossary = decl?.directories.some((d) => d.id === "swimlane-glossary");
  const subgraph = hasGlossary ? declaredSubgraphNode(instanceRoot, "swimlane-glossary", { baseUrl: opts.baseUrl }) : undefined;
  const id = exportIdentity({ baseUrl: opts.baseUrl, instanceRoot: opts.instanceRoot });
  const now = (opts.today ?? isoToday)();

  // EVERY declared `kg` root of this layer, not the literal `skills/`.
  // `kgRoots` is explicit that taking the first is `dh4f` arriving through the
  // helper written to prevent it — and bootstrap's roles live under its own.
  const graphs: RoleGraph[] = [];
  for (const kgRoot of kgRoots(instanceRoot)) {
    const g = readRoleGraph(kgRoot);
    if (g) graphs.push(g);
  }
  const roles: RoleDef[] = [];
  const byId = new Map<string, RoleDef>();
  for (const g of graphs) {
    for (const r of g.roles) {
      if (byId.has(r.id)) continue;
      byId.set(r.id, r);
      roles.push(r);
    }
  }
  const merged: RoleGraph | undefined = graphs.length > 0 ? { name: id.stub, roles } : undefined;

  // THIS layer's diagrams only — not the dependency overlay
  // `translate-bpmn` walks (bean `nafz`). A glossary is published per
  // layer and each dependent builds its own, so a role drawn only in a
  // dependent's diagram is reported in `drawnElsewhere`, not bound here.
  // Never widen this walk: skill `swimlane-glossary` §"Run it once per
  // instance", and `instance-graph-isolation.test.ts` (`7u3g`).
  const lanes = readLanes(instanceRoot, repoRoot);
  const swimlanes = lanes.filter((l) => l.activities > 0);

  // role id -> occurrences; plus the lanes that resolve to no role.
  const occurrences = new Map<string, LaneOccurrence[]>();
  const varying: LaneOccurrence[] = [];
  const problems: string[] = [];
  // ONE problem, not one per lane. Bean `7go7`: `laneBinding` used to take an
  // undefined graph and answer `dangling` for every lane carrying a ref, so a
  // layer with swimlanes and no role registry failed this gate with N false
  // symptoms instead of its one real cause — and `problems` is fatal here
  // (`exit(1)`), so that wall was a red gate, not a report. The graph is now a
  // required parameter and the question is not asked.
  if (merged === undefined && swimlanes.length > 0) {
    problems.push(
      `${id.stub}: ${swimlanes.length} swimlane(s) but no role graph declared, so no lane's binding can be judged`,
    );
  }
  for (const l of swimlanes) {
    // `break` rather than a cast: it narrows `merged` for the rest of the body.
    if (merged === undefined) break;
    const b: LaneBinding = laneBinding(merged, {
      name: l.laneName ?? undefined,
      roleRef: l.roleRef,
      performerVaries: l.performerVaries,
    });
    switch (b.kind) {
      case "bound": {
        const list = occurrences.get(b.role.id) ?? [];
        list.push(l);
        occurrences.set(b.role.id, list);
        break;
      }
      case "variable":
        varying.push(l);
        break;
      case "dangling":
        problems.push(`${l.file}#${l.laneId}: <bootstrap.processes:role ref="${b.ref}"/> names no declared role`);
        break;
      case "contradictory":
        problems.push(`${l.file}#${l.laneId}: declares both ref="${b.ref}" and variable="true"`);
        break;
      case "unbound":
        problems.push(`${l.file}#${l.laneId}: lane ${JSON.stringify(l.laneName ?? "")} binds no role`);
        break;
    }
  }

  const nodes: Record<string, unknown>[] = [];
  const schemeIri = glossaryIri(id.base, id.docPath);
  const live = new Map<string, string>(); // local part -> prefLabel

  // ONE token for the kind, with the structure in the id — the shape
  // `makeIri(doc, "process", `${m.id}/node/${n.id}`)` already uses. A
  // `"glossary/usage"` kind also reads as a directory path to
  // `check:declared-paths`, which flagged it: a literal that looks like a path
  // and names nothing that resolves is exactly what that gate is for.
  //
  // A usage is a node of the SKOS glossary, and the glossary keeps `#`
  // (#603: vocabularies and the glossary are the exception to path IRIs), so
  // it is a fragment — of the GLOSSARY document, which holds it
  // (litlfred/cat-harness-tools#961). Until then it was a fragment of the
  // graph document, which holds no such node, so no usage IRI resolved.
  // Spelled by the one minter (`legacyFragmentIri` of `makeIri`), never a
  // second spelling. The concepts it links (roles, lanes) are graph subjects
  // and take paths.
  const usageIri = (l: LaneOccurrence): string => {
    const iri = makeIri(schemeIri, "glossary-usage", `${l.processId}/${l.laneId}`);
    return legacyFragmentIri(iri, schemeIri) ?? iri;
  };

  // Which field becomes which predicate is DECLARED, in the `vocab-mapping`
  // tables under `vocab-mappings/` (bean `k74z`, owner 2026-10-02), and
  // applied here by the `vocab-map` Tool. What stays in this file is identity
  // (`@id`, `@type`) and the values that need preparing first, each of which
  // its table row marks `transform: "code"`. The tables are this harness's,
  // read from ROOT whichever layer is being exported.
  const table = (tableId: string) => vocabMapping(ROOT, tableId);
  const usageMap = table("glossary-lane-usage");
  // `role-naming` and `concept-scheme-naming` are SHARED (bean `lodp`):
  // kg-export names the same role IRI with the first (finding D3), and the
  // second declares the `sl9u` condition every scheme emitter must answer (D1).
  const roleNaming = table("role-naming");
  const roleMap = table("glossary-role-concept");
  const variableMap = table("glossary-variable-lane-concept");
  const retiredMap = table("glossary-retired-concept");
  const schemeNaming = table("concept-scheme-naming");
  const schemeMap = table("glossary-concept-scheme");
  // The three newer families (work item folio-assistant-dkqd) are built only
  // where their table exists. The tables are authored in the harness and this
  // code in the tools layer, so for one merge the code is ahead of the tables:
  // a family with no table is REPORTED as not built (`notBuilt`), never
  // silently empty, and its ledger keys are kept as they are rather than
  // retired, because a missing table is not evidence the terms are gone.
  const notBuilt: string[] = [];
  const optionalTable = (tableId: string) => {
    try {
      return table(tableId);
    } catch {
      notBuilt.push(tableId);
      return undefined;
    }
  };
  const kindMap = optionalTable("glossary-kind-concept");
  const harnessMap = optionalTable("glossary-harness-concept");
  const nodeKindMap = optionalTable("glossary-node-kind-concept");
  const familyOff = (key: string): boolean =>
    (key.startsWith("kind/") && kindMap === undefined) ||
    (key.startsWith("harness/") && harnessMap === undefined) ||
    (key.startsWith("node-kind/") && (nodeKindMap === undefined || opts.nodeKinds === undefined));

  const emitUsages = (conceptIri: string, ls: readonly LaneOccurrence[]): number => {
    let n = 0;
    for (const l of ls) {
      nodes.push({
        "@id": usageIri(l),
        "@type": termIri("LaneUsage"),
        // An unnamed lane or an undocumented one writes NO label or note,
        // never `null` (in JSON-LD a null VALUE means "remove this"). The
        // applier omits an absent value, which is that rule, applied once.
        ...applyVocabMapping(usageMap, {
          concept: conceptIri,
          process: makeIri(id.docIri, "process", l.processId),
          name: l.laneName,
          documentation: l.documentation,
          file: l.file,
        }),
      });
      n += 1;
    }
    return n;
  };

  let usages = 0;
  for (const r of roles) {
    const ls = occurrences.get(r.id) ?? [];
    const localPart = `role/${r.id}`;
    const iri = makeIri(id.docIri, "role", r.id);
    // A declared role with no lane in THIS layer is still a declared term
    // — omitting it would be `dh4f`, a glossary silently short of the
    // vocabulary it claims to index. It is reported in `undrawn` instead.
    // Alternative labels from two sources, merged: the names the role's lanes
    // are drawn with, and the role's own authored `otherNames` (the DAK base layer's
    // Generic Persona field, owner 2026-09-30). Retired names are NOT here —
    // `formerNames` become `hiddenLabel`: findable, never offered as current.
    const altLabels = [
      ...new Set(
        [...ls.map((l) => l.laneName), ...(r.otherNames ?? [])].filter(
          (n): n is string => typeof n === "string" && n !== r.title,
        ),
      ),
    ].sort();
    const hiddenLabels = [...new Set((r.formerNames ?? []).map((f) => f.name))].sort();
    live.set(localPart, r.title);
    nodes.push({
      "@id": iri,
      "@type": "skos:Concept",
      // The NAME, from the row kg-export reads for the same IRI: prefLabel,
      // a derived dcterms:title (the `sl9u` precedent), and the id as notation.
      ...applyVocabMapping(roleNaming, { title: r.title, id: r.id }),
      ...applyVocabMapping(roleMap, {
        description: r.description,
        altLabels,
        hiddenLabels,
        scheme: schemeIri,
        usages: ls.map(usageIri),
      }),
    });
    usages += emitUsages(iri, ls);
  }

  // The lanes whose performer VARIES: a concept with a scope note and no
  // definition, which is TRUE. There is no role to key by — that is the whole
  // content of the `variable` answer — so the key is the LANE's own identity,
  // `process/<process id>/lane/<lane id>`, the same local part kg-export mints
  // for the Lane node (#1168 B10b). It was the display name until then, so
  // renaming a lane minted a new term; now the old name is a former label.
  const varyingByLane = new Map<string, LaneOccurrence[]>();
  for (const l of varying) {
    const k = `${l.processId}/lane/${l.laneId}`;
    varyingByLane.set(k, [...(varyingByLane.get(k) ?? []), l]);
  }
  for (const [laneKey, ls] of [...varyingByLane].sort(([a], [b]) => a.localeCompare(b))) {
    const name = ls[0]!.laneName ?? ls[0]!.laneId;
    const localPart = `process/${laneKey}`;
    const iri = makeIri(id.docIri, "process", laneKey);
    live.set(localPart, name);
    nodes.push({
      "@id": iri,
      "@type": "skos:Concept",
      // NO `definition`, and its absence is an assertion rather than a gap —
      // `performerVaries` says the diagram declined to name a persona because
      // the performer is whoever called the sub-process.
      ...applyVocabMapping(variableMap, { name, performerVaries: true, scheme: schemeIri, usages: ls.map(usageIri) }),
    });
    usages += emitUsages(iri, ls);
  }

  // The IRI a ledger key names. A role and a lane are minted by `makeIri`, as
  // kg-export mints them; a kind and a harness already HAVE an IRI, so the
  // glossary uses it rather than minting a second name for one thing.
  const iriOfKey = new Map<string, string>();
  const keyIri = (key: string): string => {
    const known = iriOfKey.get(key);
    if (known !== undefined) return known;
    const [family, ...rest] = key.split("/");
    if (family === "kind") {
      try {
        return graphTypologyIri(rest.join("/"));
      } catch {
        // A retired `core` kind has no declarer left to name its namespace.
      }
    }
    if (family === "node-kind") return `${schemeIri}#${key}`;
    return makeIri(id.docIri, family!, rest.join("/"));
  };
  const roleConcepts = live.size;

  // Node kinds: one concept per kind this layer declares.
  let kinds = 0;
  const mayLag = new Set<string>();
  for (const kind of kindMap === undefined ? [] : kindsDeclaredBy(instanceRoot)) {
    const def = defaultGraphTypologies.get(kind);
    if (def === undefined) continue;
    const localPart = `kind/${kind}`;
    if (pendingKind(def)) mayLag.add(localPart);
    const iri = graphTypologyIri(kind, def);
    // The kind's display name ("Work items"). The word for ONE node ("Work
    // item") is the node kind's term, defined below; two concepts with one
    // label would break SKOS's one-prefLabel-per-scheme rule.
    const label = kindTitle(kind);
    const definition = def.summary?.trim() || def.description?.trim() || undefined;
    iriOfKey.set(localPart, iri);
    live.set(localPart, label);
    nodes.push({
      "@id": iri,
      "@type": "skos:Concept",
      ...applyVocabMapping(kindMap!, {
        label,
        id: localPart,
        definition,
        altLabels: [],
        scheme: schemeIri,
      }),
    });
    kinds += 1;
  }

  // Node kinds: the schemas files are written against, with their parents as
  // broader terms, so "Work item" reads as a narrower "Memory record".
  let nodeKinds = 0;
  // A node kind has no published address of its own: no export mints one and
  // no page serves one. So, like a lane usage, it is a fragment of the
  // GLOSSARY document, which is the document that holds it and so resolves.
  const nodeKindIri = (k: string) => `${schemeIri}#node-kind/${k}`;
  for (const k of nodeKindMap === undefined ? [] : (opts.nodeKinds ?? [])) {
    const localPart = `node-kind/${k.id}`;
    const iri = nodeKindIri(k.id);
    // A node kind with no term is read off its id, which can be the very
    // label a graph kind of the same word already carries ("Basic cdn site").
    // SKOS allows one prefLabel per scheme, so the node kind says what it is.
    const plain = k.term?.trim() || humanise(k.id);
    const taken = [...live.values()].some((l) => l.toLowerCase() === plain.toLowerCase());
    const label = taken ? `${plain} (node kind)` : plain;
    iriOfKey.set(localPart, iri);
    live.set(localPart, label);
    nodes.push({
      "@id": iri,
      "@type": "skos:Concept",
      ...applyVocabMapping(nodeKindMap!, {
        label,
        id: localPart,
        definition: k.summary?.trim() || undefined,
        altLabels: [...new Set([humanise(k.id), ...(k.tag !== undefined ? [k.tag] : [])])]
          .filter((a) => a !== label && !(taken && a === plain))
          .sort(),
        broader: k.parents.map(nodeKindIri),
        scheme: schemeIri,
      }),
    });
    nodeKinds += 1;
  }

  // The harness itself: one concept, from its own declaration.
  let harnesses = 0;
  if (decl !== undefined && harnessMap !== undefined) {
    const raw = decl as { name: string; title?: string; summary?: string; description?: string; iriBase?: string; alsoWritten?: string[] };
    const localPart = `harness/${raw.name}`;
    const label = raw.title?.trim() || raw.name;
    const iri = raw.iriBase ?? makeIri(id.docIri, "harness", raw.name);
    const altLabels = [...new Set([raw.name, ...(raw.alsoWritten ?? [])])].filter((n) => n !== label).sort();
    iriOfKey.set(localPart, iri);
    live.set(localPart, label);
    nodes.push({
      "@id": iri,
      "@type": "skos:Concept",
      ...applyVocabMapping(harnessMap!, {
        label,
        id: localPart,
        definition: raw.summary?.trim() || firstParagraph(raw.description),
        altLabels,
        scheme: schemeIri,
      }),
    });
    harnesses += 1;
  }

  // ── Retirement ────────────────────────────────────────────────
  // A retired name a role now lists among its `formerNames` was RENAMED, not
  // dropped: its deprecated concept says which role replaced it, so a reader
  // holding the old name from old text is sent to the current one.
  const renamedTo = new Map<string, { iri: string; title: string }>();
  for (const r of roles) {
    for (const f of r.formerNames ?? []) {
      renamedTo.set(f.name.trim().toLowerCase(), { iri: makeIri(id.docIri, "role", r.id), title: r.title });
    }
  }
  const prior = opts.ledger ?? readLedger(instanceRoot, id.stub);
  const concepts: Record<string, LedgerEntry> = {};
  const retired: string[] = [];
  const newlyRetired: string[] = [];
  const restored: string[] = [];
  for (const [key, label] of [...live].sort(([a], [b]) => a.localeCompare(b))) {
    const was = prior.concepts[key];
    // A term that comes BACK is un-retired and said so. Leaving the flag on
    // would report a live term as gone for ever, which is the mirror of the
    // defect this ledger exists to prevent.
    if (was !== undefined && was.retiredOn !== null) restored.push(key);
    concepts[key] = liveLedgerEntry(was, label, now);
  }
  for (const [key, was] of Object.entries(prior.concepts).sort(([a], [b]) => a.localeCompare(b))) {
    if (live.has(key)) continue;
    if (familyOff(key)) {
      concepts[key] = was;
      continue;
    }
    const retiredOn = was.retiredOn ?? now;
    if (was.retiredOn === null) newlyRetired.push(key);
    retired.push(key);
    concepts[key] = { ...was, retiredOn };
    const [family, ...rest] = key.split("/");
    // REPORTED, NEVER DELETED. `owl:deprecated` is the machine-readable
    // half; the change note is the half a person reads.
    const to = family === "role" ? renamedTo.get(was.prefLabel.trim().toLowerCase()) : undefined;
    const gone =
      family === "kind"
        ? "this instance no longer declares this graph kind"
        : family === "node-kind"
          ? "this instance no longer declares this node kind"
        : family === "harness"
          ? "this instance no longer declares this harness"
          : "no swimlane in this instance derives this term";
    nodes.push({
      "@id": keyIri(key),
      "@type": "skos:Concept",
      ...applyVocabMapping(retiredMap, {
        prefLabel: was.prefLabel,
        notation: rest.join("/"),
        scheme: schemeIri,
        retired: true,
        changeNote:
          to === undefined
            ? `Retired ${retiredOn}: ${gone}.`
            : `Retired ${retiredOn}: renamed ${to.title}.`,
        replacedBy: to?.iri,
      }),
    });
  }

  // A renamed live term carries its former labels as skos:hiddenLabel —
  // findable under the old name, never offered as current — beside any the
  // role declared itself (`formerNames`).
  for (const [key, entry] of Object.entries(concepts)) {
    if (entry.retiredOn !== null || !entry.formerLabels?.length) continue;
    const node = nodes.find((n) => n["@id"] === keyIri(key));
    if (node === undefined) continue;
    const hidden = new Set([...((node["hiddenLabel"] as string[] | undefined) ?? []), ...entry.formerLabels]);
    node["hiddenLabel"] = [...hidden].sort();
  }

  // Keys in one order whichever families this run built, so a run that kept a
  // family's keys untouched (`familyOff`) does not read as a changed ledger.
  const sortedConcepts = Object.fromEntries(Object.entries(concepts).sort(([a], [b]) => a.localeCompare(b)));
  const ledger: Ledger = { $schema: LEDGER_SCHEMA, instance: id.stub, concepts: sortedConcepts };
  // Order-insensitive: a committed ledger written before the keys were sorted
  // (retired terms last) holds the same facts and is not stale for that.
  const canonical = (c: Record<string, LedgerEntry>) =>
    JSON.stringify(Object.entries(c).sort(([a], [b]) => a.localeCompare(b)));
  // A pending term (`pendingKind`) is written to the ledger like any other,
  // but its absence from the committed one is not, by itself, staleness.
  const pending = Object.keys(sortedConcepts).filter((k) => mayLag.has(k) && prior.concepts[k] === undefined);
  const recorded = Object.fromEntries(Object.entries(sortedConcepts).filter(([k]) => !pending.includes(k)));
  const ledgerStale = canonical(prior.concepts) !== canonical(recorded) || prior.instance !== id.stub;

  // Declared but undrawn. A role no longer lists lanes (data-modelling step 8,
  // #1168), so a "role names a lane no diagram contains" (`fd6i`) cannot occur
  // any more: a lane names its role, and a lane naming no declared role is a
  // dangling `ref`, reported with the other problems.
  const undrawn: string[] = [];
  for (const r of roles) {
    if (!occurrences.has(r.id)) undrawn.push(r.id);
  }
  // Which of those another layer draws (bean `nafz`). Read the whole
  // repository's diagrams, drop this layer's own, and match only an
  // explicit `<folio:role ref>` — a lane NAME that happens to equal a role's
  // is not a binding, and claiming one would be the report inventing a fact.
  const drawnElsewhere: Array<{ role: string; files: string[] }> = [];
  if (undrawn.length > 0) {
    const own = relative(repoRoot, instanceRoot);
    const inOwn = (f: string) => own === "" || f === own || f.startsWith(own + "/");
    const outside = readLanes(repoRoot, repoRoot).filter((l) => l.activities > 0 && !inOwn(l.file));
    for (const role of undrawn) {
      const files = [...new Set(outside.filter((l) => l.roleRef === role).map((l) => l.file))].sort();
      if (files.length > 0) drawnElsewhere.push({ role, files });
    }
  }

  const schemeLabel = `${id.stub} glossary`;
  const doc = {
    "@context": {
      skos: SKOS,
      dcterms: DCTERMS,
      owl: OWL,
      rdfs: RDFS,
      ...ownPrefixTable(),
      label: "rdfs:label",
      prefLabel: "skos:prefLabel",
      altLabel: "skos:altLabel",
      hiddenLabel: "skos:hiddenLabel",
      isReplacedBy: { "@id": "dcterms:isReplacedBy", "@type": "@id" },
      definition: "skos:definition",
      scopeNote: "skos:scopeNote",
      changeNote: "skos:changeNote",
      notation: "skos:notation",
      title: "dcterms:title",
      source: "dcterms:source",
      isPartOf: { "@id": "dcterms:isPartOf", "@type": "@id" },
      deprecated: "owl:deprecated",
      inScheme: { "@id": "skos:inScheme", "@type": "@id" },
      broader: { "@id": "skos:broader", "@type": "@id" },
      usage: { "@id": termIri("hasLaneUsage"), "@type": "@id" },
      ofConcept: { "@id": termIri("ofConcept"), "@type": "@id" },
      inProcess: { "@id": termIri("inProcess"), "@type": "@id" },
      performerVaries: termIri("performerVaries"),
    },
    "@id": schemeIri,
    // The DOCUMENT is the scheme — the same decision `ns-export` makes in
    // `--exact` mode, and for the same reason: a separate `…#scheme` IRI
    // would name a set that already has a name and would not dereference
    // (`blv9`).
    "@type": "skos:ConceptScheme",
    ...(subgraph ? { isPartOf: subgraph.iri } : {}),
    // ONE SOURCE, TWO VOCABULARIES (bean `sl9u`, owner 2026-09-23: keep
    // both). `skos:prefLabel` is what a SKOS reader looks for and
    // `dcterms:title` what a catalogue reader does. Since bean `k74z` a
    // table DECLARES `title` as derived from `prefLabel`, so the applier
    // copies it and the two cannot drift; since bean `lodp` (finding D1)
    // that table is the shared `concept-scheme-naming`, whose row carries
    // the condition itself — a scheme that is ALSO A DOCUMENT gets the title
    // — and refuses a record that does not answer it. This one does: the
    // scheme's IRI is the document's, as the `@id` above says.
    ...applyVocabMapping(schemeNaming, { label: schemeLabel, isDocument: true }),
    ...applyVocabMapping(schemeMap, {
      definition:
        "The words this instance defines: every persona its BPMN diagrams place in a swimlane, " +
        "every graph kind and node kind it declares, and the harness itself, one concept each. A persona's labels " +
        "come from the lanes, its definition from the role registry and its scope notes from each " +
        "lane's own <bpmn:documentation>; a graph kind's label and definition from its graph typology; " +
        "a node kind's from the kind, with its parents as broader terms; " +
        "the harness's from its declaration. Generated by scripts/glossary-export.ts.",
    }),
    "@graph": nodes,
  };

  return {
    doc,
    ledger,
    report: {
      concepts: live.size + retired.length,
      retired,
      newlyRetired,
      restored,
      usages,
      families: { roles: roleConcepts, kinds, nodeKinds, harnesses },
      notBuilt,
      undrawn,
      drawnElsewhere,
      problems,
      pending,
      ledgerStale,
    },
  };
}

/** The repository root this module reads diagrams from — `buildGlossary`'s own answer. */
function glossaryRepoRoot(): string {
  return [repoRootFor(ROOT), join(repoRootFor(ROOT), "..", "..")].find((d) => existsSync(join(d, ".git"))) ?? repoRootFor(ROOT);
}

/**
 * Why the committed ledger of `instanceDir` is not `repoRoot`'s to judge
 * stale, or null when it is (cat-harness-tools#1701).
 *
 * The ledger is derived from every role, kind and diagram the CHECKOUT holds,
 * so its expected bytes depend on what is mounted. It is kept by the harness
 * index (the root carrying the gates workflow, `rootProfile` "harness"). In a
 * CONTENT root judging a MOUNTED layer's ledger (cat-harness's, from an IG such
 * as smart-ips-pilgrimage#13), the difference is that root's own roles minted
 * into a file it cannot commit, and the harness's unmounted layers' roles
 * "retired"; neither is a defect of the ledger. A content root's OWN ledger
 * (`--instance` at the root) and every harness root are judged as before.
 */
export function ledgerNotOursReason(instanceDir: string, repoRoot: string): string | null {
  if (rootProfile(repoRoot) !== "content" || resolve(instanceDir) === resolve(repoRoot)) return null;
  return (
    `${relative(repoRoot, ledgerPath(instanceDir))} is a mounted layer's ledger and this is a content root ` +
    `(no .github/workflows/code-quality-gates.yml); its terms are derived from what the harness index mounts, ` +
    `so this checkout's differing roles and kinds say nothing about whether it is stale`
  );
}

/** {@link buildGlossary} with the node kinds asked for: what the CLI writes and `--check` compares. */
export async function buildFullGlossary(opts: Omit<Parameters<typeof buildGlossary>[0] & object, "nodeKinds"> = {}): Promise<GlossaryBuild> {
  const instanceRoot = resolve(opts.instanceRoot ?? ROOT);
  return buildGlossary({ ...opts, nodeKinds: await nodeKindTerms(instanceRoot, glossaryRepoRoot()) });
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const check = argv.includes("--check");
  const instanceRoot = arg("--instance");
  const baseUrl = arg("--base-url") ?? process.env.KG_BASE_URL;

  const { doc, ledger, report } = await buildFullGlossary({ instanceRoot, baseUrl });
  const instanceDir = resolve(instanceRoot ?? ROOT);
  // `_kg/` stands for the site root: the glossary sits beside its graph
  // document, `<name>/<stub>-glossary.jsonld` (#603 decision 1b).
  const gid = exportIdentity({ baseUrl, instanceRoot });
  const glossaryPathOf = (p: string): string => p.replace(/\.jsonld$/, "-glossary.jsonld");
  const asked = arg("--out") ?? join(repoRootFor(ROOT), "_kg", glossaryPathOf(gid.docPath));
  // An old-layout deploy step is read as naming the same site (#603
  // decision 1b, `placedOut`), so the re-pins can land in either order.
  const { out, moved: outMoved } = placedOut(
    asked,
    glossaryPathOf(gid.docPath),
    gid.legacyDocPath === undefined ? undefined : glossaryPathOf(gid.legacyDocPath),
  );
  if (outMoved) console.log(`--out ${asked} is the old root address; writing the glossary at ${out}`);

  console.log(`${ledger.instance} glossary`);
  console.log(`  ${report.concepts} concept(s), ${report.usages} lane usage(s)`);
  console.log(
    `  live: ${report.families.roles} role(s), ${report.families.kinds} graph kind(s), ${report.families.nodeKinds} node kind(s), ${report.families.harnesses} harness(es)`,
  );
  for (const t of report.notBuilt) console.log(`  NOT BUILT: no vocab-mapping table "${t}" in the harness, so that family is absent from this run (not empty)`);
  if (report.restored.length > 0) console.log(`  ${report.restored.length} restored: ${report.restored.join(", ")}`);
  if (report.retired.length > 0) console.log(`  ${report.retired.length} retired (kept, never deleted)`);
  for (const k of report.newlyRetired) console.log(`    NEWLY RETIRED: ${k}`);
  if (report.undrawn.length > 0) {
    // Scoped wording (bean `nafz`): the walk covers THIS layer's diagrams
    // only, so say so, and separate a role drawn in another layer from one
    // no diagram in the repository draws.
    const where = relative(repoRootFor(ROOT), instanceDir) || ".";
    const elsewhere = new Map(report.drawnElsewhere.map((d) => [d.role, d.files]));
    const nowhere = report.undrawn.filter((r) => !elsewhere.has(r));
    console.log(`  ${report.undrawn.length} declared role(s) no swimlane in ${where}/ draws:`);
    for (const [role, files] of elsewhere) console.log(`    ${role} — drawn in another instance: ${files.join(", ")}`);
    if (nowhere.length > 0) console.log(`    drawn by no diagram in the repository: ${nowhere.join(", ")}`);
  }
  for (const p of report.problems) console.log(`  PROBLEM: ${p}`);

  // An EMPTY corpus is `6tkl`: every assertion below is vacuously satisfied
  // over nothing, and a glossary of no terms would report a clean run.
  if (report.concepts === 0) {
    console.error(`\nNo concepts derived from ${relative(repoRootFor(ROOT), instanceDir)} — refusing to call that clean.`);
    process.exit(2);
  }

  if (report.pending.length > 0) {
    console.log(
      `\n  ${report.pending.length} graph-kind term(s) PENDING — defined by the registry's code and not in ` +
        `${relative(repoRootFor(ROOT), ledgerPath(instanceDir))} yet; \`glossary:export\` records them: ${report.pending.join(", ")}`,
    );
  }

  if (check) {
    if (report.ledgerStale) {
      // cat-harness-tools#1701: a mounted layer's ledger, judged from a content
      // root, is not applicable rather than stale — see ledgerNotOursReason. A
      // PROBLEM above is still this run's finding and still fails.
      const notOurs = ledgerNotOursReason(instanceDir, repoRootFor(ROOT));
      if (notOurs !== null && report.problems.length === 0) exitNotApplicable("glossary:check", notOurs);
      console.error(`\n${relative(repoRootFor(ROOT), ledgerPath(instanceDir))} is stale — run the generator and commit it.`);
      process.exit(1);
    }
    console.log(`\nglossary ledger is current`);
    process.exit(report.problems.length === 0 ? 0 : 1);
  }

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);

  // The layer's CODE LISTS, as SKOS, beside the glossary — the same run and
  // the same predicates (owner, 2026-09-23: use the existing SKOS tooling).
  // A separate document because this one IS the swimlane scheme; code lists
  // are schemes of their own. Written only when the layer can see a list.
  const lists = [...loadCodeLists(await codeListDirs(instanceDir)).values()];
  if (lists.length > 0) {
    // Named and addressed BESIDE the glossary — derived from its path and
    // `@id`, so wherever a workflow's `--out` puts one, the other follows.
    const sibling = (s: string) => s.replace(/-glossary\.jsonld$/, "-code-lists.jsonld");
    const clOut = out.endsWith("-glossary.jsonld") ? sibling(out) : join(dirname(out), `${ledger.instance}-code-lists.jsonld`);
    const clIri = sibling(doc["@id"] as string);
    const clDoc = buildCodeListsDoc(lists, clIri);
    writeFileSync(clOut, `${JSON.stringify(clDoc, null, 2)}\n`);
    console.log(`  code lists → ${relative(repoRootFor(ROOT), clOut)} (${lists.length})`);
  }
  const lp = ledgerPath(instanceDir);
  mkdirSync(dirname(lp), { recursive: true });
  writeFileSync(lp, `${JSON.stringify(ledger, null, 2)}\n`);
  console.log(`\n  document → ${relative(repoRootFor(ROOT), out)}`);
  console.log(`  ledger   → ${relative(repoRootFor(ROOT), lp)}`);
  console.log(`  @id      ${doc["@id"] as string}`);
}
