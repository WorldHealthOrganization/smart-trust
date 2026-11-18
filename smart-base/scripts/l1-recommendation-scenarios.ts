#!/usr/bin/env bun
/**
 * L1 recommendations + a guide's vocabulary + an authored mapping → one
 * user-scenario CANDIDATE per recommendation, as smart-kg L2 nodes and edges,
 * and a WARNINGS report. Bean `kvd2`; the skill is
 * `recommendation-extraction`.
 *
 * Owner, 2026-10-10: *"as part of extracting a recommnedation the scenario
 * (user story,role) get described … we need [a process] for a role … skill is
 * to reuse existing vocabulary if possible … the process should be chosen from
 * existint smart-immz processes if possivle. warn if not … reuse existing
 * schema."*
 *
 * ## The shape is L2's, unchanged (decision D3)
 *
 * No new L1 field. Each recommendation gets a smart-base `UserScenario`
 * (`input/fsh/models/UserScenario.fsh`: title, id, description, personas[])
 * as an L2 `user-scenario` node, joined by the three edges smart-kg's
 * `ontology/l2/l2.json` already licenses:
 *
 *   recommendation implementedBy user-scenario
 *   user-scenario  involves      persona
 *   business-process realises    user-scenario
 *
 * **An implementation-practice is accepted as input too** (owner ruling 1b,
 * 2026-10-12): implementation guidance prints practices, not recommendations,
 * and `l1-recommendation-candidates.ts` emits them as the `l1-library`
 * extension's `implementation-practice` class. It is mapped exactly as a
 * recommendation is, keyed by its `identifier`. smart-kg's L2 licenses
 * `implementedBy` from a recommendation only, so a run over practices warns
 * once (`practice-implementedBy-unlicensed`): that edge is a proposal for L2
 * until the class is upstream.
 *
 * The description is a user story — "As a <persona>, during <process>, I
 * <act> so that <outcome>". Every link records where it came from, as an
 * intake `classifications` entry does (`cat-harness/schemas/intake.ts`):
 * `declared` (a person, with `by`), `context`, or `inferred`; and every link
 * is `candidate` until a person reviews the entry.
 *
 * ## Reuse first, stop at the first hit (decision D4)
 *
 * - persona: the target guide's own personas → smart-base's generic
 *   `DAK.Persona.*` → a glossary CANDIDATE, with a WARNING;
 * - process: the target guide's own processes → a domain process catalogue
 *   (none exists: reported "catalogue absent") → `could-not-determine`, with a
 *   WARNING. A process is never invented.
 * - domain: `clinical` | `public-health` | `health-system-strengthening`,
 *   recorded per scenario with its source (glossary scheme: bean `398x`).
 *
 * ## What it REFUSES, and why each is a refusal and not a warning
 *
 * - a persona or process id the vocabulary does not hold. A typo is not a new
 *   process; a new process is a glossary candidate or `could-not-determine`,
 *   and both say so;
 * - a recommendation with no mapping entry. Coverage is 100 % or the run
 *   fails, the same target `l1:coverage` holds the extraction to;
 * - a mapping entry for a recommendation the L1 source does not hold.
 *
 * ## Where smart-kg's L2 could not hold a field
 *
 * `user-scenario` declares id, title, description, sourceKind, source and
 * resolutionStatus only, and tier 2 refuses any other node property. So the
 * per-scenario `domain`, every link's `linkSource` and the `reviewStatus` sit
 * on the EDGES' `properties`, which the graph shape leaves open ("Fields of
 * the statement itself"). That is stated, not hidden: the report names it.
 *
 *   bun run smart-base/scripts/l1-recommendation-scenarios.ts \
 *     --l1 <recommendations.yaml | l1-graph.json> --vocabulary <guide.json> \
 *     [--generic <generic-personas.json>] --mapping <mapping.yaml> --out <dir> [--check]
 *
 * @module smart-base/scripts/l1-recommendation-scenarios
 * @covers scenarios, l1-extraction — `smart-base:l1-scenarios:check` judges the handbook example's
 *   `l1-extraction/scenarios/` against the L1 graph, vocabulary and mapping beside it
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

import { RUN_CONTEXT_SCHEMA_TAG, RunContextSchema, runContextRef, type RunContext, type RunContextRef } from "../platform/schema.js";
import { L1_NAMESPACE, slug, VocabularySchema, type Vocabulary, type VocabPersona, type VocabProcess } from "./l1-scenario-vocabulary.ts";
import { kgClasses } from "./kg-classes.ts";

export const RUN_CONTEXT_FILENAME = "run-context.json";

function gitIn(cwd: string, ...args: string[]): string | undefined {
  try {
    const out = execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

const sha256File = (p: string): string | undefined => {
  try {
    return createHash("sha256").update(readFileSync(p)).digest("hex");
  } catch {
    return undefined;
  }
};

/** `test-run.ts#hashBasis`, byte for byte: sorted paths, each `path\0bytes\0`, 12-char prefix. */
export function hashBasis(root: string, paths: string[]): { hash: string; inputs: string[] } {
  const inputs = [...paths].sort();
  const h = createHash("sha256");
  for (const p of inputs) {
    let data: Buffer;
    try {
      data = readFileSync(join(root, p));
    } catch {
      return { hash: "unknown", inputs };
    }
    h.update(Buffer.concat([Buffer.from(p, "utf8"), Buffer.from([0]), data, Buffer.from([0])]));
  }
  return { hash: h.digest("hex").slice(0, 12), inputs };
}

/** `RunMountsSchema` for a checkout, from its `index.lock.json` — `_run_context.py#mounts_of`. */
export function mountsOf(root: string): RunContext["mounts"] {
  const lock = join(root, "index.lock.json");
  if (!existsSync(lock)) return { state: "could-not-determine", reason: `no index.lock.json at ${root}` };
  let doc: { instances?: { instance?: string; repository?: string; sha?: string }[] };
  try {
    doc = JSON.parse(readFileSync(lock, "utf8"));
  } catch (e) {
    return { state: "could-not-determine", reason: `index.lock.json will not parse: ${(e as Error).message}` };
  }
  const instances = (doc.instances ?? [])
    .filter((i) => i.instance && i.repository && i.sha)
    .map((i) => ({ instance: i.instance!, repository: i.repository!, sha: i.sha! }));
  if (!instances.length) return { state: "none" };
  return { state: "locked", lock: { file: "index.lock.json", sha256: sha256File(lock)! }, instances } as RunContext["mounts"];
}

/**
 * The context of a run of `script` over `inputs`, or `undefined` when no git
 * checkout can be named for `platform` (the schema has no state for that, so
 * the caller reports it instead of writing a context that lies).
 */
export function buildRunContext(script: string, inputs: string[], where: string): RunContext | undefined {
  const top = gitIn(existsSync(where) ? where : dirname(where), "rev-parse", "--show-toplevel") ?? gitIn(dirname(script), "rev-parse", "--show-toplevel");
  const sha = top ? gitIn(top, "rev-parse", "HEAD") : undefined;
  if (!top || !sha || !/^[0-9a-f]{40}$/.test(sha)) return undefined;
  const rel = (p: string) => relative(top, resolve(p));
  const ctx = {
    $schema: RUN_CONTEXT_SCHEMA_TAG,
    platform: { commit: sha },
    mounts: mountsOf(top),
    releases: [],
    invoker: { kind: "system" as const, id: rel(script), script_hash: sha256File(script) ?? "unknown" },
    inputs: inputs.length ? [hashBasis(top, inputs.map(rel))] : [],
  };
  return RunContextSchema.parse(ctx);
}

/** Write `<dir>/run-context.json`; return the reference a record carries. */
export function writeRunContext(ctx: RunContext, dir: string): RunContextRef {
  writeFileSync(join(dir, RUN_CONTEXT_FILENAME), JSON.stringify(ctx, null, 2) + "\n");
  return runContextRef(ctx);
}

export { runContextRef, type RunContext, type RunContextRef };

export const MAPPING_SCHEMA_TAG = "l1-scenario-mapping/v1" as const;
export const L2_CONTEXT = "http://smart.who.int/kg/l2.context.jsonld";
/** `schemaVersion` of smart-kg `ontology/l2/l2.json`; tier 2 refuses a document that disagrees. */
export const L2_ONTOLOGY_VERSION = "1.0";
export const SKILL = "smart-base/recommendation-extraction";
export const GRAPH_FILENAME = "scenario-candidates.l2.json";
export const WARNINGS_FILENAME = "scenario-warnings.md";
/** The one process value that is not an id. */
export const COULD_NOT_DETERMINE = "could-not-determine";
/** The three guideline domains (owner, 2026-10-10); the SKOS scheme is bean `398x`. */
export const DOMAINS = ["clinical", "public-health", "health-system-strengthening"] as const;
/** The L2 classes this emits; each must be in `code-lists/sgkg-l2-classes.json`. */
export const EMITTED_CLASSES = ["user-scenario", "persona", "business-process"] as const;

const sha256 = (b: string | Buffer): string => createHash("sha256").update(b).digest("hex");

// ── the mapping ────────────────────────────────────────────────────────────

export const LINK_SOURCES = ["declared", "context", "inferred"] as const;
export type LinkSource = (typeof LINK_SOURCES)[number];

const Provenance = {
  source: z.enum(LINK_SOURCES),
  /** Why — the statement's words, the vocabulary row, the person's ruling. An unexplained link is a guess. */
  basis: z.string().min(1),
  by: z.string().min(1).optional(),
  at: z.string().min(1).optional(),
};
const declaredNeedsBy = (l: { source: LinkSource; by?: string }) => l.source !== "declared" || !!l.by;
const DECLARED_MSG = "a `declared` link names the person who declared it (`by`)";

const PersonaLinkSchema = z.union([
  z.object({ id: z.string().min(1), ...Provenance }).strict(),
  z.object({ candidate: z.string().min(1), definition: z.string().min(1).optional(), ...Provenance }).strict(),
]).refine(declaredNeedsBy, DECLARED_MSG);
export type PersonaLink = z.infer<typeof PersonaLinkSchema>;

const ProcessLinkSchema = z.object({ id: z.string().min(1), ...Provenance }).strict().refine(declaredNeedsBy, DECLARED_MSG);

export const MappingEntrySchema = z.object({
  personas: z.array(PersonaLinkSchema).min(1),
  process: ProcessLinkSchema,
  /** "I <act>": what the persona does, in the persona's voice, without the leading "I". */
  act: z.string().min(1),
  /** "so that <outcome>". */
  outcome: z.string().min(1),
  domain: z.object({ code: z.enum(DOMAINS), ...Provenance }).strict().refine(declaredNeedsBy, DECLARED_MSG),
  /** A person's review. Absent, every link in the entry stays `candidate`. */
  review: z.object({ by: z.string().min(1), at: z.string().min(1), note: z.string().min(1).optional() }).strict().optional(),
}).strict();
export type MappingEntry = z.infer<typeof MappingEntrySchema>;

export const MappingSchema = z.object({
  $schema: z.literal(MAPPING_SCHEMA_TAG),
  _comment: z.string().optional(),
  /** Must equal the guide vocabulary's `guide`: a mapping is authored against one guide. */
  guide: z.string().min(1),
  /** Scenario ids are `<prefix>.<recommendation key>`. */
  scenarioIdPrefix: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9.-]*$/),
  /** Where the L1 source was copied from, when it is a copy. */
  l1Origin: z.object({ repository: z.string().min(1), commit: z.string().regex(/^[0-9a-f]{40}$/), path: z.string().min(1) }).strict().optional(),
  entries: z.record(z.string().min(1), MappingEntrySchema),
}).strict();
export type Mapping = z.infer<typeof MappingSchema>;

// ── the L1 source: the measles YAML, or an L1 3.0 graph document ─────────

export interface L1Rec {
  key: string;
  iri: string;
  statement: string;
  /** Where in the source it is printed (`p220`, or the node's own evidence location). */
  location: string;
  /** Set only when the source node is not a recommendation (an `implementation-practice`). */
  nodeClass?: "implementation-practice";
}

/** The L1 node classes a mapping entry may be keyed on. */
export const L1_INPUT_CLASSES = ["recommendation", "implementation-practice"] as const;

const MeaslesYamlSchema = z.object({
  publication: z.object({ url: z.string().url() }).passthrough(),
  recommendations: z.array(z.object({ key: z.string().min(1), statement: z.string().min(1), page: z.union([z.string(), z.number()]).optional() }).passthrough()).min(1),
}).passthrough();

const L1GraphSchema = z.object({
  "@context": z.unknown(),
  nodes: z.array(z.object({
    id: z.string().min(1),
    type: z.string(),
    evidence: z.object({ location: z.string() }).passthrough().optional(),
    properties: z.record(z.string(), z.unknown()).optional(),
  }).passthrough()),
}).passthrough();

/**
 * A publication IRI from its URL, as `l1-kgid.ts` `publicationId` mints a
 * url-identified one. The measles YAML's ISSN is the Weekly Epidemiological
 * Record's — every position paper shares it — so it cannot identify one paper.
 */
const urlPublication = (url: string): string =>
  `${L1_NAMESPACE}/publication/url-${slug(url.replace(/^[a-z]+:\/\//i, "").replace(/[?#].*$/, "").replace(/\/+$/, "").replace(/^www\./i, ""))}`;

export function readL1(path: string): L1Rec[] {
  const text = readFileSync(path, "utf8");
  if (/\.ya?ml$/i.test(path)) {
    const y = MeaslesYamlSchema.parse(parseYaml(text));
    const pub = urlPublication(y.publication.url);
    return y.recommendations.map((r) => ({
      key: r.key,
      iri: `${pub}/recommendation/${r.key}`,
      statement: r.statement,
      location: r.page !== undefined ? `p${r.page}` : r.key,
    }));
  }
  const g = L1GraphSchema.parse(JSON.parse(text));
  const recs = g.nodes.filter((n) => (L1_INPUT_CLASSES as readonly string[]).includes(n.type)).map((n) => {
    const identifier = n.properties?.identifier;
    const statement = n.properties?.statement;
    if (typeof identifier !== "string" || typeof statement !== "string") {
      throw new Error(`${n.id}: an L1 ${n.type} needs properties.identifier and properties.statement`);
    }
    const rec: L1Rec = { key: identifier, iri: n.id, statement, location: n.evidence?.location ?? identifier };
    if (n.type === "implementation-practice") rec.nodeClass = "implementation-practice";
    return rec;
  });
  if (!recs.length) throw new Error(`${path}: no recommendation or implementation-practice nodes`);
  return recs;
}

// ── resolution ─────────────────────────────────────────────────────────────

export type Tier = "guide" | "generic" | "glossary-candidate";

export interface Warning {
  code: "process-not-determined" | "persona-glossary-candidate" | "practice-implementedBy-unlicensed";
  key: string;
  message: string;
}

export class RefusalError extends Error {
  constructor(public readonly problems: string[]) {
    super(`refused:\n  ${problems.join("\n  ")}`);
  }
}

/** The reasons a run is refused, all at once, so one pass fixes them. */
export function refusals(recs: L1Rec[], mapping: Mapping, guide: Vocabulary, generic?: Vocabulary): string[] {
  const problems: string[] = [];
  if (mapping.guide !== guide.guide) problems.push(`the mapping is for "${mapping.guide}" and the vocabulary is "${guide.guide}"`);
  if (guide.tier !== "guide") problems.push(`--vocabulary must be a guide vocabulary (tier "guide"), not "${guide.tier}"`);
  if (generic && generic.tier !== "generic") problems.push(`--generic must be tier "generic", not "${generic.tier}"`);
  const known = new Set(recs.map((r) => r.key));
  const dup = recs.map((r) => r.key).filter((k, i, a) => a.indexOf(k) !== i);
  for (const k of new Set(dup)) problems.push(`the L1 source holds recommendation ${k} more than once`);
  for (const r of recs) if (!mapping.entries[r.key]) problems.push(`${r.key}: no mapping entry — coverage must be 100%`);
  for (const k of Object.keys(mapping.entries)) if (!known.has(k)) problems.push(`${k}: mapped, but the L1 source has no such recommendation`);
  const personaIds = new Set([...guide.personas, ...(generic?.personas ?? [])].map((p) => p.id));
  const processIds = new Set(guide.processes.map((p) => p.id));
  for (const [k, e] of Object.entries(mapping.entries)) {
    for (const p of e.personas) {
      if ("id" in p && !personaIds.has(p.id)) {
        problems.push(`${k}: persona "${p.id}" is neither a ${guide.guide} persona nor a generic one — a new persona is a \`candidate\`, not an id`);
      }
    }
    if (e.process.id !== COULD_NOT_DETERMINE && !processIds.has(e.process.id)) {
      problems.push(`${k}: process "${e.process.id}" is not a ${guide.guide} process (${[...processIds].join(", ")}) — a typo is not a new process; use \`${COULD_NOT_DETERMINE}\``);
    }
  }
  return problems;
}

// ── the graph ──────────────────────────────────────────────────────────────

type Derivation = "derived" | "inferred" | "decided";

export interface GraphNode {
  id: string;
  type: (typeof EMITTED_CLASSES)[number];
  label: string;
  derivation: Derivation;
  note?: string;
  evidence?: { location: string; quote?: string };
  skill: string;
  properties: Record<string, unknown>;
}
export interface GraphEdge {
  type: "Statement";
  predicate: "implementedBy" | "involves" | "realises";
  source: string;
  target: string;
  derivation: Derivation;
  note: string;
  evidence: { location: string; quote?: string };
  skill: string;
  properties: Record<string, unknown>;
}
export interface ScenarioDocument {
  "@context": string;
  id: string;
  type: "Entity";
  ontologyVersion: string;
  generatedAt: string;
  wasDerivedFrom: { path: string; sha256: string; repository?: string; commit?: string; note?: string }[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** declared → decided (a person chose), as `dak-l1-library` maps intake sources onto smart-kg derivations. */
export const derivationOf = (s: LinkSource): Derivation => (s === "declared" ? "decided" : "inferred");

const personaIri = (ns: string, title: string): string => `${ns}/persona/${slug(title)}`;
const processIri = (ns: string, id: string): string => `${ns}/business-process/${slug(id)}`;

/** `IMMZ.A`…`IMMZ.I` → `IMMZ.A–IMMZ.I`; three or fewer are listed. */
const idRange = (ids: string[]): string => (ids.length > 3 ? `${ids[0]}–${ids[ids.length - 1]}` : ids.join(", "));

/** "a" or "an" before a persona title — the user story reads aloud. */
const article = (s: string): string => (/^[aeiou]/i.test(s) ? "an" : "a");

export function userStory(personas: string[], process: string | undefined, act: string, outcome: string): string {
  const who = personas.join(" or ");
  const during = process ? `during ${process}` : "during [process not determined]";
  return `As ${article(who)} ${who}, ${during}, I ${act.replace(/\.$/, "")} so that ${outcome.replace(/\.$/, "")}.`;
}

export interface Inputs {
  recs: L1Rec[];
  guide: Vocabulary;
  generic?: Vocabulary;
  mapping: Mapping;
  /** Display paths and hashes of the four inputs, for `wasDerivedFrom`. */
  sources: { l1: { path: string; sha256: string }; vocabulary: { path: string; sha256: string }; generic?: { path: string; sha256: string }; mapping: { path: string; sha256: string } };
}

export interface Result {
  document: ScenarioDocument;
  warnings: Warning[];
  counts: { recommendations: number; byProcess: Record<string, number>; byDomain: Record<string, number>; byTier: Record<Tier, number>; reviewed: number };
}

export function buildScenarios(inp: Inputs, generatedAt: string): Result {
  const { recs, guide, generic, mapping, sources } = inp;
  const problems = refusals(recs, mapping, guide, generic);
  if (problems.length) throw new RefusalError(problems);

  const ns = guide.namespace;
  const guidePersonas = new Map(guide.personas.map((p) => [p.id, p]));
  const genericPersonas = new Map((generic?.personas ?? []).map((p) => [p.id, p]));
  const processes = new Map(guide.processes.map((p) => [p.id, p]));
  const where = (v: Vocabulary, s: { path: string; locator: string }) => `${v.source.repository}@${v.source.commit.slice(0, 7)}:${s.path} (${s.locator})`;

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const warnings: Warning[] = [];
  const counts: Result["counts"] = {
    recommendations: recs.length, byProcess: {}, byDomain: {}, byTier: { guide: 0, generic: 0, "glossary-candidate": 0 }, reviewed: 0,
  };

  const personaNode = (v: Vocabulary, p: VocabPersona): string => {
    const iri = personaIri(v.namespace, p.title);
    if (!nodes.has(iri)) {
      nodes.set(iri, {
        id: iri, type: "persona", label: p.title, derivation: "derived", skill: SKILL,
        properties: {
          id: p.id, title: p.title,
          ...(p.description ? { description: p.description } : {}),
          ...(p.otherNames ? { otherNames: p.otherNames } : {}),
          ...(p.iscoCode ? { iscoCode: p.iscoCode } : {}),
          ...(p.personaType ? { personaType: p.personaType } : {}),
          source: where(v, p.source),
          resolutionStatus: "resolved",
        },
      });
    }
    return iri;
  };
  const processNode = (p: VocabProcess): string => {
    const iri = processIri(ns, p.id);
    if (!nodes.has(iri)) {
      nodes.set(iri, {
        id: iri, type: "business-process", label: `${p.id} ${p.title}`, derivation: "derived", skill: SKILL,
        properties: {
          id: p.id, description: p.title,
          ...(p.objectives ? { objectives: p.objectives } : {}),
          source: where(guide, p.source),
          resolutionStatus: "resolved",
        },
      });
    }
    return iri;
  };

  const practices = recs.filter((r) => r.nodeClass === "implementation-practice").length;
  if (practices) {
    warnings.push({
      code: "practice-implementedBy-unlicensed", key: `x${practices}`,
      message: "the L1 source holds implementation-practice nodes (the l1-library extension; owner ruling 1b, 2026-10-12). smart-kg's L2 licenses implementedBy from a recommendation only, so these edges are a proposal for L2 until the class is upstream",
    });
  }
  for (const rec of recs) {
    const e = mapping.entries[rec.key];
    const status = e.review ? "reviewed" : "candidate";
    if (e.review) counts.reviewed++;
    const at = (suffix: string) => ({ location: `${sources.mapping.path}#entries.${rec.key}${suffix}` });

    // personas — guide, then generic, then a glossary candidate
    const personaTitles: string[] = [];
    const involves: { iri: string; link: PersonaLink; tier: Tier; i: number }[] = [];
    e.personas.forEach((link, i) => {
      if ("id" in link) {
        const g = guidePersonas.get(link.id);
        const tier: Tier = g ? "guide" : "generic";
        const p = g ?? genericPersonas.get(link.id)!;
        personaTitles.push(p.title);
        involves.push({ iri: personaNode(g ? guide : generic!, p), link, tier, i });
      } else {
        const iri = personaIri(ns, link.candidate);
        if (!nodes.has(iri)) {
          nodes.set(iri, {
            id: iri, type: "persona", label: link.candidate, derivation: "inferred", skill: SKILL,
            note: `Glossary CANDIDATE: no persona in ${guide.guide} or smart-base's generic DAK.Persona.* fits. Not a definition until a person curates it. ${link.basis}`,
            evidence: at(`.personas[${i}]`),
            properties: { id: slug(link.candidate), title: link.candidate, ...(link.definition ? { description: link.definition } : {}), resolutionStatus: "unresolved" },
          });
        }
        personaTitles.push(link.candidate);
        involves.push({ iri, link, tier: "glossary-candidate", i });
        warnings.push({ code: "persona-glossary-candidate", key: rec.key, message: `persona "${link.candidate}" is a glossary candidate — not among the personas of ${guide.guide} or smart-base's generic DAK.Persona.*. ${link.basis}` });
      }
    });

    // process — the guide's own, or could-not-determine
    const proc = e.process.id === COULD_NOT_DETERMINE ? undefined : processes.get(e.process.id)!;
    counts.byProcess[e.process.id] = (counts.byProcess[e.process.id] ?? 0) + 1;
    counts.byDomain[e.domain.code] = (counts.byDomain[e.domain.code] ?? 0) + 1;
    if (!proc) {
      warnings.push({
        code: "process-not-determined", key: rec.key,
        message: `${processes.size ? `no ${guide.guide} process (${idRange([...processes.keys()])}) realises this` : `${guide.guide} prints no process`}; domain process catalogue absent. ${e.process.basis}`,
      });
    }

    // the scenario
    const scenarioId = `${mapping.scenarioIdPrefix}.${rec.key}`;
    const scenarioIri = `${ns}/user-scenario/${slug(scenarioId)}`;
    const description = userStory(personaTitles, proc ? `${proc.id} ${proc.title}` : undefined, e.act, e.outcome);
    nodes.set(scenarioIri, {
      id: scenarioIri, type: "user-scenario", label: `${scenarioId}: ${e.act}`, derivation: "inferred", skill: SKILL,
      note: `User-scenario ${status.toUpperCase()} for ${rec.nodeClass === "implementation-practice" ? "implementation practice" : "recommendation"} ${rec.key}, authored from its statement against the ${guide.guide} vocabulary. Domain ${e.domain.code} (${e.domain.source}).`,
      evidence: { location: `${sources.l1.path}#${rec.key} (${rec.location})`, quote: rec.statement },
      properties: { id: scenarioId, title: `${scenarioId}: ${e.act}`, description, source: `${sources.mapping.path}#entries.${rec.key}` },
    });

    edges.push({
      type: "Statement", predicate: "implementedBy", source: rec.iri, target: scenarioIri,
      derivation: "inferred", skill: SKILL,
      note: `${rec.nodeClass === "implementation-practice" ? "Implementation practice" : "Recommendation"} ${rec.key} is implemented by scenario ${scenarioId} — a ${status}, never derived: deciding that a scenario realises a recommendation is adaptation.`,
      evidence: at(""),
      properties: { reviewStatus: status, domain: e.domain.code, domainSource: e.domain.source, domainBasis: e.domain.basis, ...(e.review ? { reviewedBy: e.review.by, reviewedAt: e.review.at } : {}) },
    });
    for (const { iri, link, tier, i } of involves) {
      counts.byTier[tier]++;
      edges.push({
        type: "Statement", predicate: "involves", source: scenarioIri, target: iri,
        derivation: derivationOf(link.source), skill: SKILL, note: link.basis, evidence: at(`.personas[${i}]`),
        properties: { linkSource: link.source, tier, reviewStatus: status, resolutionStatus: tier === "glossary-candidate" ? "unresolved" : "resolved", ...(link.by ? { declaredBy: link.by } : {}), ...(link.at ? { declaredAt: link.at } : {}) },
      });
    }
    if (proc) {
      edges.push({
        type: "Statement", predicate: "realises", source: processNode(proc), target: scenarioIri,
        derivation: derivationOf(e.process.source), skill: SKILL, note: e.process.basis, evidence: at(".process"),
        properties: { linkSource: e.process.source, tier: "guide", reviewStatus: status, resolutionStatus: "resolved", ...(e.process.by ? { declaredBy: e.process.by } : {}), ...(e.process.at ? { declaredAt: e.process.at } : {}) },
      });
    }
  }

  const derived = (s: { path: string; sha256: string }, note: string, extra: object = {}) => ({ path: s.path, sha256: s.sha256, ...extra, note });
  const document: ScenarioDocument = {
    "@context": L2_CONTEXT,
    id: `${ns}/graph/l1-scenarios/${slug(mapping.scenarioIdPrefix)}`,
    type: "Entity",
    ontologyVersion: L2_ONTOLOGY_VERSION,
    generatedAt,
    wasDerivedFrom: [
      derived(sources.l1, "The L1 recommendations, each the source of one implementedBy edge.", mapping.l1Origin ? { repository: mapping.l1Origin.repository, commit: mapping.l1Origin.commit } : {}),
      derived(sources.vocabulary, `The personas and processes of ${guide.guide}, read at ${guide.source.repository}@${guide.source.commit}.`),
      ...(sources.generic && generic ? [derived(sources.generic, `smart-base's generic personas, read at ${generic.source.repository}@${generic.source.commit}.`)] : []),
      derived(sources.mapping, "The authored mapping: per recommendation, its personas, process, act, outcome and domain, each with a source and a basis."),
    ],
    nodes: [...nodes.values()].sort((a, b) => (a.type === b.type ? a.id.localeCompare(b.id) : EMITTED_CLASSES.indexOf(a.type) - EMITTED_CLASSES.indexOf(b.type))),
    edges,
  };
  return { document, warnings, counts };
}

// ── the report ─────────────────────────────────────────────────────────────

/** One greppable line per warning: `WARNING <code> <key>: <message>`. */
export const warningLine = (w: Warning): string => `WARNING ${w.code} ${w.key}: ${w.message}`;

export function warningsReport(r: Result, inp: Inputs): string {
  const { guide, mapping } = inp;
  const procTitle = new Map(guide.processes.map((p) => [p.id, p.title]));
  const lines = [
    `# Scenario candidates — ${mapping.scenarioIdPrefix}`,
    "",
    `GENERATED by \`smart-base/scripts/l1-recommendation-scenarios.ts\` from \`${inp.sources.mapping.path}\`. Never hand-edit: change the mapping and re-run.`,
    "",
    `Every scenario is a **candidate** until a person reviews its entry (${r.counts.reviewed} of ${r.counts.recommendations} reviewed).`,
    "",
    "## Coverage",
    "",
    `${r.counts.recommendations} recommendations, ${r.counts.recommendations} mapped (100%).`,
    "",
    "| process | recommendations |",
    "|---|---|",
    ...Object.entries(r.counts.byProcess).sort(([a], [b]) => a.localeCompare(b))
      .map(([id, n]) => `| ${id === COULD_NOT_DETERMINE ? "`could-not-determine`" : `${id} ${procTitle.get(id)}`} | ${n} |`),
    "",
    "| domain | recommendations |",
    "|---|---|",
    ...Object.entries(r.counts.byDomain).sort(([a], [b]) => a.localeCompare(b)).map(([d, n]) => `| ${d} | ${n} |`),
    "",
    "| persona links resolved from | links |",
    "|---|---|",
    `| ${guide.guide} (target guide) | ${r.counts.byTier.guide} |`,
    `| smart-base generic DAK.Persona.* | ${r.counts.byTier.generic} |`,
    `| glossary candidate | ${r.counts.byTier["glossary-candidate"]} |`,
    "",
    `## Warnings (${r.warnings.length})`,
    "",
  ];
  if (!r.warnings.length) lines.push("None.");
  else lines.push("```", ...r.warnings.map(warningLine), "```");
  lines.push(
    "",
    "## What L2 could not hold",
    "",
    "smart-kg L2 `user-scenario` declares only id, title, description, sourceKind, source and resolutionStatus, and tier 2 refuses any other node property. So each scenario's `domain` (with `domainSource`, `domainBasis`) and its `reviewStatus` are on its `implementedBy` edge, and each link's `linkSource` and `reviewStatus` on its `involves` / `realises` edge — edge `properties` are open by the graph shape. The act and outcome live only inside `description`.",
    "",
  );
  return lines.join("\n");
}

// ── CLI ────────────────────────────────────────────────────────────────────

const PLACEHOLDER_AT = "1970-01-01T00:00:00Z";

export const serialise = (d: ScenarioDocument): string => JSON.stringify(d, null, 2) + "\n";

/** Equal but for `generatedAt`, which a re-run moves and nothing else should. */
export function isCurrent(onDisk: string, fresh: ScenarioDocument): boolean {
  try {
    const old = JSON.parse(onDisk) as ScenarioDocument;
    return serialise({ ...old, generatedAt: PLACEHOLDER_AT }) === serialise({ ...fresh, generatedAt: PLACEHOLDER_AT });
  } catch {
    return false;
  }
}

/** Every class this emits is in the KG class lists, or nothing is written. */
export function unpinnedClasses(classes: ReadonlySet<string> = kgClasses()): string[] {
  return EMITTED_CLASSES.filter((c) => !classes.has(`sgkg-l2#${c}`));
}

/** A path as a reader of the repository sees it: from the git top level when there is one. */
function displayPath(p: string): string {
  try {
    const top = execFileSync("git", ["-C", dirname(p), "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return relative(top, p);
  } catch {
    return relative(process.cwd(), p);
  }
}

export function readInputs(paths: { l1: string; vocabulary: string; generic?: string; mapping: string }): Inputs {
  const src = (p: string) => ({ path: displayPath(resolve(p)), sha256: sha256(readFileSync(p)) });
  return {
    recs: readL1(paths.l1),
    guide: VocabularySchema.parse(JSON.parse(readFileSync(paths.vocabulary, "utf8"))),
    generic: paths.generic ? VocabularySchema.parse(JSON.parse(readFileSync(paths.generic, "utf8"))) : undefined,
    mapping: MappingSchema.parse(parseYaml(readFileSync(paths.mapping, "utf8"))),
    sources: { l1: src(paths.l1), vocabulary: src(paths.vocabulary), ...(paths.generic ? { generic: src(paths.generic) } : {}), mapping: src(paths.mapping) },
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string): string | undefined => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const l1 = opt("--l1"), vocabulary = opt("--vocabulary"), mappingPath = opt("--mapping"), out = opt("--out");
  if (!l1 || !vocabulary || !mappingPath || !out) {
    console.error("usage: l1-recommendation-scenarios.ts --l1 <yaml|json> --vocabulary <guide.json> [--generic <generic.json>] --mapping <mapping.yaml> --out <dir> [--check]");
    process.exit(2);
  }
  const unpinned = unpinnedClasses();
  if (unpinned.length) {
    console.error(`✗ not in the KG class lists: ${unpinned.join(", ")}`);
    process.exit(1);
  }
  let inp: Inputs, result: Result;
  try {
    inp = readInputs({ l1, vocabulary, generic: opt("--generic"), mapping: mappingPath });
    result = buildScenarios(inp, new Date().toISOString().replace(/\.\d{3}Z$/, "Z"));
  } catch (err) {
    if (err instanceof RefusalError) {
      console.error(`✗ ${err.problems.length} refusal(s):\n  ${err.problems.join("\n  ")}`);
      process.exit(1);
    }
    if (err instanceof z.ZodError) {
      console.error(`✗ invalid input:\n${err.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
      process.exit(1);
    }
    throw err;
  }
  const graphPath = join(out, GRAPH_FILENAME);
  const reportPath = join(out, WARNINGS_FILENAME);
  const report = warningsReport(result, inp);
  const summary = `${result.counts.recommendations} scenario candidates, ${result.warnings.length} warning(s); by process: ${Object.entries(result.counts.byProcess).map(([k, v]) => `${k} ${v}`).join(", ")}`;
  if (args.includes("--check")) {
    const stale = [
      ...(!existsSync(graphPath) || !isCurrent(readFileSync(graphPath, "utf8"), result.document) ? [graphPath] : []),
      ...(!existsSync(reportPath) || readFileSync(reportPath, "utf8") !== report ? [reportPath] : []),
    ];
    if (stale.length) {
      console.error(`✗ stale — re-run without --check: ${stale.join(", ")}`);
      process.exit(1);
    }
    console.log(`✓ current — ${summary}`);
    process.exit(0);
  }
  mkdirSync(out, { recursive: true });
  // The run's provenance, as cat-harness's folio-run-context/v1, beside the output. Not part of `--check`:
  // its platform commit moves with every commit, as generatedAt moves with every run.
  const ctx = buildRunContext(process.argv[1]!, [l1, vocabulary, mappingPath, ...(opt("--generic") ? [opt("--generic")!] : [])], out);
  if (ctx) writeRunContext(ctx, out);
  else console.error("WARNING run-context: no git checkout to name as the platform; run-context.json not written");
  for (const w of result.warnings) console.error(warningLine(w));
  if (!existsSync(graphPath) || !isCurrent(readFileSync(graphPath, "utf8"), result.document)) writeFileSync(graphPath, serialise(result.document));
  writeFileSync(reportPath, report);
  console.log(`wrote ${graphPath} and ${reportPath} — ${summary}`);
}
