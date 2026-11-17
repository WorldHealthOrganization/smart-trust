/**
 * The `CatHarness` declaration — what a layer IS, at its root.
 *
 * Named for the **harness**: `agentic-harness` is the layer that defines
 * Roles, Skills, Tools and the conventional directories, and every other
 * layer inherits from it. A layer need not be a folio-assistant to
 * have one — a Tool repo or a Test repo carries the same declaration.
 *
 * Every layer carries one at its repository root (`harness.json`). It
 * declares the directories the layer scans for content, and what **kind
 * of graph** each one holds.
 *
 * ## Directories, not a content-type field
 *
 * The general object is **a layer with directories, each holding a
 * graph**: Tool definitions under `tools/`, a knowledge graph under `kg/`,
 * the schema graph under `schemas/`. `folio` is one graph typology among
 * several — distinguished only by being renderable to a website (see
 * `BASE_GRAPH_TYPOLOGIES` in `./graph-typology-registry.ts`). A layer with no `folio/` directory is
 * ordinary.
 *
 * ## Inheritance
 *
 * A layer inherits its dependencies' directory conventions without
 * restating them, by the same depth-first walk as
 * `schemas/kg/harness-config.ts` and the same overlay order — deepest
 * dependency first, root last, so the root wins.
 *
 * Overriding is by graph **id**, not by path: a layer that wants its
 * knowledge graph somewhere other than `kg/` redeclares the `kg` id with a
 * different path, and the inherited entry is replaced rather than duplicated.
 *
 * ## Self-declarative
 *
 * Each directory is a node with an `@id` and an `@type`, so the set of
 * directories a layer scans is queryable like anything else in the
 * knowledge graph.
 *
 * @module schemas/cat-harness
 * @graphNode schema
 */

import { KindAvatarSchema, type KindAvatar } from "./graph-typology-node";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, basename, dirname } from "node:path";
import { z } from "zod";
import { acceptsSchemaTag, nodeKind } from "./node-kind";
import { RepoFullNameSchema, type RepoFullName } from "./repo-full-name.js";
import { SubscriptionKindSchema, type SubscriptionKind } from "./substrate-snapshot.js";
import {
  MountDefaultsSchema,
  RemoteMountsSchema,
  readMountLock,
  type MountDefaults,
  type RemoteMount,
  RESERVED_ROOT_AND_ROUTE_NAMES,
  isReservedRootOrRouteName,
  checkMountPathCollisions,
  canonicalVisualizerRoute,
  visualizerAliasRoute,
  visualizerUrl,
  checkVisualizerRouteCollisions,
  type MountCollisionFinding,
  type RouteCollisionFinding,
  type ReservedRootAndRouteName,
} from "./remote-mount.js";

export {
  RESERVED_ROOT_AND_ROUTE_NAMES,
  isReservedRootOrRouteName,
  checkMountPathCollisions,
  canonicalVisualizerRoute,
  visualizerAliasRoute,
  visualizerUrl,
  checkVisualizerRouteCollisions,
  type MountCollisionFinding,
  type RouteCollisionFinding,
  type ReservedRootAndRouteName,
};


import {
  KgAssetSchema,
  KgImageSchema,
  kgNodeLabelShape,
  scopeShape,
  type DeclarationScope,
  type KgAsset,
  type KgImage,
  type KgNodeLabels,
} from "./kg-node";
import { propertyIri, termIri } from "./namespaces";
import { StickyContributionSchema, type StickyContribution } from "../content/sticky-contribution";
import { BuiltAtPublishListSchema, isBuiltAtPublish, type BuiltAtPublish } from "./built-at-publish";
import { JsonldPrefixTableSchema, type JsonldPrefixTable } from "./jsonld-prefixes";
import { BranchPrefixSchema, KeyedBySchema, SubgraphSourceSchema, contentIsOffCheckout, type SubgraphSource } from "./subgraph-source";



/**
 * The CONFIG filename for a layer of this name — `<name>.config.json`.
 *
 * Defined HERE and re-exported by `schemas/kg/harness-config.ts`, which is where
 * it used to live — that module imports this one, so the dependency only runs
 * one way. The rationale was "one speller, or the config and the declaration
 * drift apart at the first rename"; that still holds, but the thing being
 * spelled once is now each filename rather than both, and the pair below is
 * what keeps them from drifting.
 */
export function layerConfigFilename(name: string): string {
  return `${name}${CONFIG_SUFFIX}`;
}

/**
 * The DECLARATION filename for a layer of this name — `<name>.json`.
 *
 * Its sibling above spells the config. Both exist so that neither is composed
 * at a call site: a literal `${name}.json` is the thing that survives a
 * suffix change and then resolves to nothing.
 */
export function instanceDeclarationFilename(name: string): string {
  return `${name}${DECLARATION_SUFFIX}`;
}


/**
 * The full path to this directory's declaration, or `undefined` if there is
 * none.
 *
 * The replacement for `join(dir, DECLARATION_FILENAME)`, which every reader
 * used to compose. It cannot be composed any more — the filename carries the
 * layer's name, so the only way to know it is to look.
 */
export function declarationPathIn(dir: string): string | undefined {
  const f = findDeclarationFile(dir);
  return f === undefined ? undefined : join(dir, f);
}

/**
 * `*.config.json` files in this directory that will not parse.
 *
 * Separate from {@link findDeclarationFile} because the two answer different
 * questions: that one says which file IS the declaration, this one says what
 * could not be read at all. A caller reporting layer health needs both, and
 * folding them would make a broken sibling look like a missing layer.
 */
export function unparseableConfigsIn(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.endsWith(DECLARATION_SUFFIX) && e.length > DECLARATION_SUFFIX.length)
    .filter((e) => {
      try {
        JSON.parse(readFileSync(join(dir, e), "utf-8"));
        return false;
      } catch {
        return true;
      }
    })
    .sort();
}
// ── Graph typologies ─────────────────────────────────────────────────
//
// MOVED to `schemas/kg/graph-typology-registry.ts`, and re-exported here so no caller
// changed. The move exists to break one cycle: `folio-graph-typology.ts` imported
// this module for `defaultGraphTypologies`, so this module could not import IT back
// to trigger core's registration — and the cost was paid by every caller, as
// an import-order dependency nobody could see. See that module's header, and
// the import at the foot of this file.
export {
  BASE_GRAPH_TYPOLOGIES,
  DECLARED_BY,
  GRAPH_TYPOLOGY_ALIASES,
  GraphTypologyConflictError,
  GraphTypologyRegistry,
  REGISTRATION_MODULE,
  contentLayerInstance,
  declaredKindNodes,
  declaredValidatorNodes,
  declaringInstanceOf,
  defaultGraphTypologies,
  defaultTypologyRoots,
  graphTypologyIri,
  graphTypologyLayer,
  kindTitle,
  ownNamespaceValues,
  ownPrefixTable,
  resolveGraphTypology,
} from "./graph-typology-registry.js";
export type {
  DeclaringInstance,
  GraphLayer,
  GraphTypology,
  GraphTypologyDef,
  NodeSchemaRef,
} from "./graph-typology-registry.js";
// ...and imported as well as re-exported, because the predicates below
// (`isRenderable`, `graphLayer`, the layer tests) stayed in this module and
// default their `registry` parameter to the shared layer. `export *`
// forwards a name; it does not bring it into local scope.
import {
  BASE_GRAPH_TYPOLOGIES,
  defaultGraphTypologies,
  graphTypologyIri,
  ownPrefixTable,
  REGISTRATION_MODULE,
  resolveGraphTypology,
  type GraphTypology,
  type GraphTypologyDef,
  type GraphTypologyRegistry,
  type GraphLayer,
} from "./graph-typology-registry.js";

/** Is a graph of this kind expected to render as a website? */
export function isRenderable(kind: string, registry: GraphTypologyRegistry = defaultGraphTypologies): boolean {
  return registry.get(kind)?.renderable === true;
}

/**
 * What a running process does with a graph of this kind, or `undefined` for a
 * kind this registry does not know.
 *
 * **`undefined` is a further state and callers must not collapse it.** An
 * unregistered kind has not said `content`; it has not said anything, and a
 * consumer that reads the absence as content will hand somebody a QA verdict
 * where they asked for a skill. The predicates below are deliberately NOT each
 * other's negations for the same reason.
 */
export function graphLayer(kind: string, registry: GraphTypologyRegistry = defaultGraphTypologies): GraphLayer | undefined {
  return registry.get(kind)?.holds;
}

/** Does this kind hold the subject matter? False for an unregistered kind. */
export function isContentGraph(kind: string, registry: GraphTypologyRegistry = defaultGraphTypologies): boolean {
  return graphLayer(kind, registry) === "content";
}

/**
 * Is this STATIC state — read during a process and never written by one?
 *
 * False for an unregistered kind, and false for `content`. There is
 * deliberately no `isNotContent` convenience: "is this the subject matter" and
 * "may a step write this" are different questions, and one predicate answering
 * both is how two call sites come to disagree about which they asked.
 */
export function isContextGraph(kind: string, registry: GraphTypologyRegistry = defaultGraphTypologies): boolean {
  return graphLayer(kind, registry) === "context";
}

/**
 * Is this LIVE state — a record a running process writes as it goes?
 *
 * **Narrowed when `context` arrived.** It previously answered for every
 * non-content kind, so a caller asking "may a step write this" got `true` for
 * a memory entry. Anything that meant "not content" must now say which of the
 * two it meant.
 */
export function isStateGraph(kind: string, registry: GraphTypologyRegistry = defaultGraphTypologies): boolean {
  return graphLayer(kind, registry) === "state";
}

/**
 * Is this DERIVED material — produced from a source, regenerable, and not the
 * working corpus?
 *
 * Owner, 2026-09-20: *"library is static (only if we materialize assets or
 * not)"* and *"can duplicate asset into a folio and work there"*. Bean `hqku`.
 *
 * **Why `context` was the wrong answer, and it was ruled out by a rule rather
 * than by taste.** `library/` is static for authoring — nobody edits a section
 * in place; the asset is duplicated into the folio and worked on there. That
 * sounds exactly like `context`. But `context` carries *"a step that writes to
 * it is a defect, not an update"*, and `document-ingestion.bpmn` WRITES
 * `library/`. Declaring it `context` would have made a declared process a
 * defect by the axis's own rule.
 *
 * **And `content` was wrong in the other direction.** The sweep rule is *"only
 * on active/working content"* (owner, 2026-09-20): a QA finding against a
 * derived section is a finding against its GENERATOR, not against the corpus,
 * and it sends a reviewer to fix the wrong file.
 *
 * The skill's two supporting questions disagree here — *"does it stand on its
 * own?"* says content (a library section still reads), *"would you regenerate
 * it or re-author it?"* says regenerate — and the skill's instruction for that
 * case is to **say so rather than picking**. This layer is saying so.
 */
export function isDerivedGraph(kind: string, registry: GraphTypologyRegistry = defaultGraphTypologies): boolean {
  return graphLayer(kind, registry) === "derived";
}

/**
 * May a running process WRITE to a graph of this kind?
 *
 * The question `isStateGraph` is usually being asked in service of, named so a
 * caller does not have to know that `state` is the only writable layer — and
 * so that adding a fourth value later is one edit here rather than a search
 * for every `=== "state"`.
 *
 * `content` is `false` on purpose even though a process certainly produces
 * content: writing content is the SUBJECT of an authoring process, governed by
 * the HCI validation gate and the commit boundary, not a bookkeeping write a
 * step performs in passing. Those are the writes this predicate is about.
 */
export function processMayWrite(kind: string, registry: GraphTypologyRegistry = defaultGraphTypologies): boolean {
  const layer = graphLayer(kind, registry);
  return layer === undefined ? false : layerIsWritable(layer);
}

/**
 * THE rule, in one place: only `state` is written by a running step.
 *
 * Extracted when declared ASSETS gained a layer (bean `7syd`), because the
 * alternative was a second `=== "state"` in {@link processMayWriteAsset} —
 * and the promise {@link processMayWrite} already made, that a fourth layer is
 * one edit rather than a search, is only true while there is one site to edit.
 *
 * It takes a {@link GraphLayer} and not a kind on purpose: a declared asset
 * has a layer and no graph typology, so a kind-shaped rule could not have been
 * reused and would have been copied instead.
 */
export function layerIsWritable(layer: GraphLayer): boolean {
  return layer === "state";
}

/** Every registered kind on one side of the line, sorted. */
export function graphTypologiesOfLayer(layer: GraphLayer, registry: GraphTypologyRegistry = defaultGraphTypologies): string[] {
  return registry.names().filter((n) => graphLayer(n, registry) === layer).sort();
}

// ── The declaration ─────────────────────────────────────────────

/**
 * One declared place to look, with no statement about inheritance.
 *
 * The base both a layer directory and a GRAPH NODE share. See
 * {@link GraphNodeDirectorySchema} for why the two are not one type.
 */
export interface GraphNodeDirectory extends KgNodeLabels {
  /**
   * Stable identifier, unique within a layer. Inheritance overrides match
   * on THIS, never on `path` — see the module note on relocation.
   */
  id: string;
  /**
   * The directory, relative to the root {@link scope} names, with or without a
   * trailing slash.
   */
  path: string;
  /**
   * Which root `path` is relative to. Absent means this layer's.
   *
   * See `DeclarationScopeSchema` in `kg-node.ts` for what `repository` means
   * and why it is a field rather than a `../` in the path.
   */
  scope?: DeclarationScope;
  /** What kind of graph lives there. */
  /**
   * Which parts of the knowledge graph this directory holds — an ARRAY,
   * because a directory is a PLACE TO LOOK and may hold more than one.
   *
   * It does not say how to tell the contents apart, and that is deliberate:
   * **the files declare what they are.** A bean carries its id, `title`,
   * `status` and `type` in front matter; a workflow instance carries
   * `"$schema": "folio-workflow-instance/v1"`. A consumer reads a file and
   * the file answers, so a declaration states what to EXPECT rather than how
   * to discriminate.
   *
   * Was singular `graph`. Made an array 2026-09-18 so that this schema and
   * the bean graph state the same fact the same way — they had diverged into
   * `graph: "kg"` here and `kinds: ["bean-defs"]` there, two spellings of one
   * concept.
   */
  graphTypologies: GraphTypology[];
}

/**
 * One declared directory of a LAYER — a place to look, plus what a
 * dependent does about it.
 *
 * The single field separating this from {@link GraphNodeDirectory} is the
 * one a graph node cannot answer: nothing resolves a node across layers,
 * so "does a dependent get its own?" has no meaning there.
 */
export interface ContentDirectory extends GraphNodeDirectory {
  /**
   * What makes this subgraph reachable — a renderer, a documentation entry,
   * and a governing skill — or the reasons it does not need one.
   *
   * OPTIONAL on purpose. An absent field is
   * exactly the finding `check:subgraph-coverage` exists to raise, so making
   * it required would both destroy the measurement and bill every concurrent
   * branch for a field they had no reason to know about — which is what
   * `dependents` did the day it landed. See {@link SubgraphCoverageSchema}.
   */
  coverage?: SubgraphCoverage;
  /** A `translation-sources` directory's catalogues, when not under `<path>/<locale>/` (e.g. `input/*\/translations/{locale}.po`). See the schema field. */
  catalogues?: string;
  /** Built into the layer's own IG site at `/<instance>/` (bean `mftp`); see `igSite` on the shape below. */
  igSite?: boolean;

  /**
   * This directory holds MATERIALIZED content: readable, and not editable here.
   *
   * **Absent means NOT DECLARED, never `false`.** See the schema field for the
   * owner's ruling, why it is declared rather than derived, and the two greys
   * a listing must keep apart.
   */
  readOnly?: boolean;

  /** Why — required whenever {@link readOnly} is declared, either value. See the schema field. */
  readOnlyBasis?: string;

  /** Whether the agent summary drain may offer a `library`'s blocks; absent means `drain`. See the schema field (bean `x80s`). */
  summaries?: "drain" | "held";

  /** Entry slugs of a `library` held back from the summary drain while the rest of it drains. See the schema field (bean `j7ql`). */
  heldEntries?: string[];

  /** Entry slugs of a `library` admitted while no methodology cites them yet; their summaries still drain. See the schema field (bean `e0jh`). */
  awaitingCitation?: string[];

  /**
   * Which theme this subgraph renders on — one answer for every surface that
   * renders it (navbar section, board panel, sticky).
   *
   * Absent means the layer's own theme. See {@link ContentDirectorySchema}
   * for why it lives on the directory and why the methodologies take
   * `analyst`.
   */
  theme?: ThemeRef;

  /**
   * Where this subgraph gets its content. Absent is `{ kind: "directory" }`.
   * Read it through `resolveSubgraphSource` (`schemas/kg/subgraph-source.ts`),
   * which applies the layer config's override by id.
   */
  source?: SubgraphSource;

  /**
   * This directory's contents are STORED on a branch, keyed by commit or tip, and the
   * checkout holds at most a working copy. See {@link DirectoryStorageSchema}.
   *
   * The LEGACY spelling of `source: { kind: "branch", branch, keyedBy }`
   * (bean `l4ay`): `resolveSubgraphSource` reads either and refuses both on
   * one entry. New declarations use `source`.
   */
  storage?: DirectoryStorage;

  /** A named sub-graph that is OFF in every layer, its own included, unless that layer enables it. See the schema field and `opt-in-subgraphs.ts`. */
  optIn?: true;

  /** Opt-in only: the other opt-in sub-graphs this one requires, qualified; switching it on switches them on. See the schema field and `opt-in-subgraphs.ts`. */
  requires?: string[];

  /**
   * What this directory's content is COMPUTED FROM: the declared directory ids
   * of the graphs whose change can invalidate it, resolved across `needs`
   * exactly as a document kind's `computedFrom` is (bean `nama`; design note
   * `docs/proposals/derived-graph-dependencies-2026-10-04.md`).
   *
   * On the DERIVED side, by the owner's ruling (2026-10-04, option 1 of 3): the
   * writer of a derived graph is what knows its inputs, and the edge points down
   * the stack (an IG's pages name its artefact index, never the reverse). Data
   * graphs only. A generator is code, and the staging cone (bean `4j86`) reaches
   * it by its import closure, so code is not declared here a second time.
   *
   * Absent means "not declared", not "derived from nothing". `check:derived-from`
   * says which directories in the `derived` layer still owe an answer.
   */
  derivedFrom?: string[];

  /**
   * The GENERATOR that writes this directory: repo-relative script files, and
   * directories ending in `/` for what a generator READS rather than imports
   * (its templates). The other half of `derivedFrom`: that names the DATA a
   * derived graph is computed from, this names the CODE (owner, 2026-10-04,
   * bean `4j86`, option 1 of 3).
   *
   * The staging cone reads it: a changed file in a writer's import closure, or
   * under a writer directory, puts this directory in the cone. Absent means the
   * cone cannot reach this directory through code, so it falls back to the
   * instance-prefix rule. `check:derived-from` refuses a writer path that does
   * not exist, because a dangling writer would silently shrink the cone.
   */
  writer?: string[];
}

/** A layer's root declaration. */
/** How a layer's values are addressed in Liquid — {@link CatHarnessDeclaration.liquid}. */
export interface LiquidPrefix {
  /** The first path segment(s); default the layer's `name`. */
  prefix?: string;
  /** Leave `{{ <prefix>.… }}` for the downstream engine (Jekyll, IG Publisher). */
  passThrough?: boolean;
}

/**
 * Where a layer sits today inside a HOST repository — the pre-split case,
 * where `cat-harness` declares `litlfred/cat-harness` but is the
 * `cat-harness/` directory of `litlfred/folio-assistant` (bean `6rmv`).
 */
export interface InstanceLocation {
  /** The repository that holds the layer today, `owner/name`. */
  repository: RepoFullName;
  /** The layer's directory within it, repository-relative, no leading `./`. */
  path: string;
}

export const InstanceLocationSchema = z
  .object({
    repository: RepoFullNameSchema,
    path: z
      .string()
      .min(1)
      .regex(/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/, "a repository-relative directory, no leading ./ or trailing /")
      .refine((p) => !p.split("/").includes(".."), "a location may not climb with `..`"),
  })
  .strict();

/**
 * Where this layer gets its upstream/source material (e.g. an IG source in Git).
 * Bean `bamf`, owner ruling 2026-10-07: declare IG source in layer declaration.
 */
export const InstanceGitSourceSchema = z
  .object({
    kind: z.literal("git"),
    repository: z.string().min(1),
    ref: z.string().min(1),
    path: z.string().optional(),
  })
  .strict();

export const InstanceSourceSchema = z.discriminatedUnion("kind", [
  InstanceGitSourceSchema,
]);
export type InstanceSource = z.infer<typeof InstanceSourceSchema>;


/**
 * One content adapter a layer ships, as its own declaration states it.
 *
 * `module` is relative to the DECLARING layer's root, and `className` is the
 * export to construct. `extends` names the `contentType` this one specialises —
 * `paper` extends `document` — and is what orders the fallback: a
 * specialisation is a superset, so falling back TO it loses nothing, while
 * falling back FROM it loses its tools. That order used to be the position of
 * a row in a table in `src/builtin-adapters.ts`; it is a fact about the
 * adapters, so it is declared beside them.
 */
export interface ContentAdapterDeclaration {
  /** The `contentType` a folio's config names to get this adapter. */
  contentType: string;
  /** Instance-relative module path. */
  module: string;
  /** The exported class. */
  className: string;
  /** The `contentType` this adapter specialises, if any. */
  extends?: string;
}

/**
 * Zod form of {@link ContentAdapterDeclaration}. Exported on its own so the
 * composition root can read this one field without parsing — and so without
 * throwing on — every other field of every declaration in the checkout.
 */
export const ContentAdapterDeclarationSchema = z
  .object({
    contentType: z.string().min(1),
    module: z
      .string()
      .min(1)
      .refine((m) => !m.startsWith("/") && !m.split("/").includes(".."), "instance-relative, never absolute or escaping"),
    className: z.string().min(1),
    extends: z.string().min(1).optional(),
  })
  .strict();

/**
 * One LSI unit provider a layer ships: the code that turns one of this
 * layer's graphs into text units for `lsi:near` (bean `ec2a` step 3,
 * proposal `lsi-cross-graph-near-2026-10-24`, owner decision A).
 *
 * `graphKind` names the graph in the output (`blocks`, `lean-decl`). `module`
 * is relative to the DECLARING layer's root, and `export` is the function
 * to call. The tools layer finds providers by reading these declarations, as
 * it finds content adapters, so it never imports a layer above it
 * (`check:import-direction`). The function's contract is the tools layer's
 * (`pipeline/lsi-near-across.ts`).
 */
export interface LsiUnitProviderDeclaration {
  /** The graph's name in `lsi:near` output and in `--graphs`. */
  graphKind: string;
  /** Instance-relative module path. */
  module: string;
  /** The exported provider function. */
  export: string;
}

/** Zod form of {@link LsiUnitProviderDeclaration}, exported on its own for the same reason as {@link ContentAdapterDeclarationSchema}. */
export const LsiUnitProviderDeclarationSchema = z
  .object({
    graphKind: z.string().regex(/^[a-z][a-z0-9-]*$/, "a lower-case kebab name"),
    module: z
      .string()
      .min(1)
      .refine((m) => !m.startsWith("/") && !m.split("/").includes(".."), "instance-relative, never absolute or escaping"),
    export: z.string().regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, "an identifier"),
  })
  .strict();

// ── Content-type translation profiles (moved from translation-tools.ts, bean `0r7u`) ───────────────────────────────────────────

/**
 * A translatable format that a content type can declare.
 *
 * Each format maps to an extraction function (source → POT entries)
 * and an injection function (PO entries → target source).
 */
export const TranslatableFormatSchema = z.object({
  /** Format identifier. */
  id: z.string(),
  /** Human-readable name. */
  name: z.string(),
  /** File extensions this format applies to. */
  extensions: z.array(z.string()),
  /** Smart-base Python script that handles this format (reference). */
  smartBaseScript: z.string().optional(),
  /** Smart-base function/line range for extraction. */
  smartBaseExtractRef: z.string().optional(),
  /** Smart-base function/line range for injection. */
  smartBaseInjectRef: z.string().optional(),
  /** TypeScript module that implements extraction (relative to repo root). */
  extractModule: z.string().optional(),
  /** TypeScript module that implements injection (relative to repo root). */
  injectModule: z.string().optional(),
  /**
   * Notes about translating THIS format specifically, as distinct from
   * `ContentTypeTranslation.notes`, which describes the content type as a
   * whole. "Lean 4 terms stay in English" and "the diagram is re-rendered
   * after injection" are properties of the format, not of the folio.
   */
  notes: z.string().optional(),
});

export type TranslatableFormat = z.infer<typeof TranslatableFormatSchema>;

/**
 * Content-type translation capability declaration.
 *
 * Each content adapter registers one of these to declare what
 * formats it can translate and what scripts handle each format.
 */
export const ContentTypeTranslationSchema = z.object({
  /** Content type identifier (matches adapter name). */
  contentType: z.string(),
  /** Human-readable name. */
  name: z.string(),
  /** Translatable formats this content type supports. */
  formats: z.array(TranslatableFormatSchema),
  /** Whether RTL rendering is supported. */
  rtlSupported: z.boolean().default(false),
  /**
   * BPMN diagrams that need re-rendering for translation: a path from the
   * declaring layer (or one it `needs`), or, for a diagram another layer
   * owns, its bare FILE NAME, found through the declared process graphs so
   * the entry survives that layer regrouping its diagrams.
   */
  bpmnDiagrams: z.array(z.string()).optional(),
  /** Additional notes about translation for this content type. */
  notes: z.string().optional(),
});

export type ContentTypeTranslation = z.infer<typeof ContentTypeTranslationSchema>;


export interface CatHarnessDeclaration extends KgNodeLabels {
  /** `cat-harness-declaration/1.0.0` — see {@link CAT_HARNESS_DECLARATION_SCHEMA_TAG} (bean `ujiv`). */
  $schema?: string;
  /** A reader's one line — see {@link CatHarnessDeclarationSchema}'s `summary` (`ob3m` 4/5). */
  summary?: string;
  /** Other spellings of the name, listed on the landing (`ob3m` 5). */
  alsoWritten?: string[];
  /** The prefix this harness's skills get when installed into an agent host — see {@link CatHarnessDeclarationSchema}'s `skillPrefix` (bean `x4mt`). */
  skillPrefix?: string;
  /** The layer's own avatar (sod4 #4); the table in avatars.ts covers only the layers below the harness. */
  avatar?: KindAvatar;
  /**
   * Images this layer names — its marks, in the graph rather than beside it.
   *
   * See {@link KgImage}: the docs site, the README and the browser tab all want
   * the same picture, and a node is what stops each of them hardcoding its own
   * path to it.
   */
  images?: KgImage[];
  /**
   * Non-image artefacts this layer names — `AGENTS.md` first among them.
   *
   * See {@link KgAsset}. Declared for the same reason {@link images} is: a
   * file nobody declares is a file nobody checks, and `AGENTS.md` was the only
   * root artefact in neither list.
   */
  assets?: KgAsset[];
  /**
   * The id of the {@link images} entry to use as the browser icon.
   *
   * An id and not a path, so moving the file is one edit in one place. A
   * dangling reference is reported by `readDeclaration` rather than silently
   * rendering no icon — a missing favicon looks exactly like a slow one.
   */
  icon?: string;
  /**
   * Which icons this layer's navbar row shows — see `NavbarIconsSchema`.
   *
   * Three states: absent inherits, `[]` shows none, a list decides. The two
   * empty-looking answers are deliberately different and must not be read
   * through a truthiness test.
   */
  navbarIcons?: NavbarIcon[];
  /** Which tiles the glass's bottom strip pins, in order — see `GlassStripSchema`. Absent inherits. */
  glassStrip?: GlassStripPin[];
  /** The layer's name, e.g. `"agentic-harness"`. */
  name: string;
  /**
   * The repository's short name, used as the **filename stem of every artefact
   * this layer publishes** — `<stub>.jsonld` for the knowledge graph,
   * `<stub>.schema.json` for its schema. Defaults to `name`.
   *
   * WHO's SMART Base IG derives its stub by stripping the `smart-` prefix from
   * the repository name (`smart-<stub>` → `<stub>` → `https://smart.who.int/<stub>`),
   * so the stub, the directory and the published path are one word. The same
   * convention holds here without the prefix rule: the artefact is named after
   * the repository, so a reader who knows the repo knows the filename.
   *
   * Note the declaration file itself is **not** stub-named — it stays
   * `harness.json`. (The analogy here was the WHO SMART Base IG's config "staying"
   * `dak.json`; that config is ours and became `dak.config.json` on
   * 2026-09-22, so it argues nothing either way now.) A
   * consumer must be able to find the config without already knowing the
   * repository's name; the artefacts it *describes* are free to be named.
   */
  /**
   * The repository this layer IS — `owner/name`, its PLANNED home once the
   * pre-split repository is broken apart (owner, 2026-09-30, bean `6rmv`).
   *
   * The identity every cross-instance reference resolves through: a bare
   * `name` says nothing about which forge or owner, and two owners may both
   * publish a layer of the same name. Planned rather than current so that an IRI keyed
   * by it survives the split — where the layer sits TODAY is {@link livesAt}.
   * `instanceRepositories` in `schemas/kg/instance-repositories.ts` derives the
   * `owner/repo ↔ name ↔ root` map from these; nothing keeps a list by hand.
   */
  repository?: RepoFullName;
  /**
   * Where the layer lives TODAY when that is not the root of
   * {@link repository} — the host repository and the directory within it.
   * Absent means it already lives at the root of its own repository.
   */
  livesAt?: InstanceLocation;
  /**
   * Where this whole layer gets its upstream/source material (e.g. an IG source in Git).
   * Bean `bamf`, owner ruling 2026-10-07: declare IG source in layer declaration.
   */
  source?: InstanceSource;
  /**
   * Which half of a kg-separation pair the planned {@link repository} is —
   * see `separation` on {@link CatHarnessDeclarationSchema}. Absent is "has
   * not said". Bean `eayu`.
   */
  separation?: "content" | "tools";
  /**
   * Layers this one is seeded together with — see `seedsWith` on
   * {@link CatHarnessDeclarationSchema}. Absent is "seeds alone".
   */
  seedsWith?: string[];
  stub?: string;
  /**
   * Whether this layer is published on the site. Defaults to enabled; only
   * `false` disables it. Read through `isPublished` (`schemas/kg/url-space.ts`,
   * bean `nbal`).
   */
  enabled?: boolean;
  /**
   * Where this layer's artefacts are published — the base every `@id` in
   * the exported graph is minted against.
   *
   * Absent means **no absolute IRIs can be minted**, which the exporter reports
   * rather than papering over with a plausible-looking guess: an `@id` that
   * resolves to nothing is worse than an obviously relative one, because it
   * looks dereferenceable and is not.
   */
  canonicalUrl?: string;
  /** Where CI previews are served, when that differs from `canonicalUrl`. */
  previewUrl?: string;
  /**
   * WHAT KIND of host serves this layer's renderings.
   *
   * The `publication host` axis of
   * `docs/proposals/deployment-topologies.md`, accepted 2026-09-19. Four
   * topologies in issue #363 — local git only, private repo, developer and
   * self-sovereign — do not publish to GitHub Pages, and before this nothing
   * could say so.
   *
   * **Distinct from `canonicalUrl`, and from `readme.linkStyle`.** Three
   * different questions that are easy to run together:
   *
   * | field | question | lives in |
   * |---|---|---|
   * | `canonicalUrl` | what base are `@id`s minted against? | `harness.json` |
   * | `publication.host` | what kind of thing serves the rendering? | `harness.json` |
   * | `readme.linkStyle` | how is a link to a published artefact written? | `harness.config.json` |
   *
   * **Absent is a third state and must stay one.** It means the deployment
   * has not said, NOT that it is `github-pages`. Defaulting to Pages is
   * exactly how a local-server deployment gets told it publishes somewhere it
   * does not — the failure this field exists to end.
   *
   * **No `url` here, deliberately.** `canonicalUrl` already holds that fact,
   * and a second URL field is two places to disagree. A local server's
   * address is a `--port` at run time, not a property of the layer.
   */
  publication?: Publication;
  /**
   * The topology axes this deployment declares about itself. See
   * {@link Topology} — every field optional, absent meaning "has not said".
   */
  topology?: Topology;
  /** Directories this layer scans, before inheritance. */
  directories: ContentDirectory[];
  /** The visualisers this harness declares, each at `<base>/<name>/<id>/` — {@link HarnessVisualiser}. Owner, 2026-10-09. */
  visualisers?: HarnessVisualiser[];
  /**
   * Artefacts this layer serves and must never commit, each built at publish
   * by the package scripts it names — {@link BuiltAtPublish}. Owner, 2026-10-14
   * ("B1"): a page computed over the checkout's other layers, or from a
   * branch-kept graph, cannot be current in a commit of this one.
   */
  builtAtPublish?: BuiltAtPublish[];
  /**
   * The external vocabularies this layer's JSON-LD speaks, prefix →
   * namespace IRI — {@link JsonldPrefixTable}. Owner, 2026-10-14 (bean 63q4):
   * the published context is generated from what documents use, flattened over
   * `needs`, so a vocabulary is declared by the layer that owns it.
   */
  jsonldPrefixes?: JsonldPrefixTable;
  /** Graphs known but not held — {@link RemoteGraph}. */
  remoteGraphs?: RemoteGraph[];
  /** Harnesses this one is associated with and does not hold — {@link AssociatedHarness}. Issue #1146. */
  associatedHarnesses?: AssociatedHarness[];
  /** External Knowledge Graphs this one CONSUMES, and which of their parts it chose to hold — {@link Subscription}. Issue #1719. */
  subscriptions?: Subscription[];
  /** Substrates known to exist or planned that NO declaration here names — {@link KnownSubstrate}. Issue #1719. */
  knownSubstrates?: KnownSubstrate[];
  /** What a downstream remote-mounts of this layer by default — `schemas/kg/remote-mount.ts`, bean `0mpw`. */
  mountDefaults?: MountDefaults;
  /** Harnesses this layer remote-mounts at a pin, transitively — `schemas/kg/remote-mount.ts`, bean `0mpw`. */
  remoteMounts?: RemoteMount[];
  /** Who may consent to a remote mount here — `schemas/kg/mount-trust.ts`, roast `1ygp` L4.2. */
  mountApprovers?: string[];
  /**
   * Sticky notes this layer contributes to the landing board.
   *
   * **A contribution, not a list somebody else owns.** The owner's ask was
   * *"each intiator should create its own sticky"*, and this is the seam that
   * makes it true: the board is composed from whatever the layers present
   * declare, so a new layer adds its card by declaring one rather than by
   * editing a constant in the layer above. See
   * {@link StickyContribution} for why this is a declaration rather than a
   * code registry — bootstrap holds no TypeScript and may not import the
   * layer composed on top of it, so a registry is a seam it cannot reach.
   *
   * Optional, and absent means **this layer contributes none** rather than
   * "unmigrated". That is the honest reading and the useful one: a bare
   * bootstrap layer with no cat is the owner's ruling, and a default here
   * would hand one back.
   */
  stickies?: StickyContribution[];
  /**
   * What this layer is excused from rendering, and what it carries instead.
   *
   * See {@link RenderExemption}. **Absent is the normal case** — every
   * layer owes a visualiser per declared subgraph, which is the `2krx` QA
   * axis. Present means a layer has traded that obligation for another one it
   * names, and it is refused without a `reason` and an `owes`.
   */
  renderExemption?: RenderExemption;

  /**
   * The layers this one is BUILT ON — its layer stack, foundation first.
   *
   * The owner, 2026-09-20: *"So bootsteap, cat harness, fa-core, f-a, from
   * bottom to top."*
   *
   * **Absent is UNDETERMINED, `[]` is the floor**, and a consumer that
   * treated them as the same would place every unlabelled layer beside
   * the bootstrap. See the schema field for why this is declared rather
   * than computed, and why it is optional.
   */
  needs?: string[];
  /**
   * The opt-in sub-graphs this layer switches on FOR ITSELF, qualified
   * `<instance>.<directory id>` — see the schema field and
   * `schemas/kg/opt-in-subgraphs.ts`. Not inherited by the layers above.
   */
  enableSubgraphs?: string[];
  /**
   * Paths this layer moved and still answers for, during the window of the
   * two-phase move rule (sdlc skill `two-phase-move`). See the schema field.
   */
  moves?: DeclaredMove[];
  /**
   * What this layer's own package tasks read and write, keyed by task name
   * — the same {@link ScriptIO}-shaped facts `cat-harness-tools/scripts/task-io.ts`
   * holds for the harness's own tasks: `outputs: []` (measured to write
   * nothing, so it may run in the pool) and `inputs` (what can change the
   * answer, so `regen` may skip it on an unchanged tree; `"{tracked}"` is the
   * whole working tree). `because` keeps the measurement that justified it.
   *
   * Declared by the layer that OWNS the task, so the harness collects it
   * instead of naming a layer above itself (owner ruling 2026-10-06: "each
   * instance declares its own tasks", bean `0r7u` step 0). Absent declares
   * nothing: those tasks run alone and are never skipped, the safe default.
   */
  taskIo?: Record<
    string,
    {
      inputs?: string[];
      outputs?: string[];
      /** The task that REPAIRS this check when the `X` / `X:check` naming does not give it. */
      writer?: string;
      /** Run after a merge train even when `regen` is not (merge-train step 3). Requires `writer`. */
      afterMerge?: boolean;
      because?: string;
    }
  >;
  /**
   * The CI steps and check scripts of THIS layer that the local gate set
   * deliberately does not run, each with its reason — the rows
   * `cat-harness-tools/scripts/gates.ts` holds as `STEP_EXEMPTIONS` and
   * `SCRIPT_EXEMPTIONS` for the harness's own. Same contract: a reason is
   * required, a step `match` is a substring of the workflow command, a script
   * name is matched exactly. Declared by the owner so the harness need not
   * name a layer above itself (bean `0r7u` step 0).
   */
  gateExemptions?: {
    steps?: Array<{ match: string; kind: "covered-by" | "ci-only" | "no-folio"; reason: string }>;
    scripts?: Array<{
      script: string;
      kind: "report" | "covered-by" | "no-folio" | "scheduled" | "pending-baseline";
      reason: string;
      /** `pending-baseline` only: the script that writes the baseline, which CI must run. */
      writer?: string;
      /** `pending-baseline` only: the change that wires the check once the baseline exists. */
      followUp?: string;
    }>;
    /**
     * Files of THIS layer that one named gate's allowlist admits, each with
     * its reason — `gate` is the check's script name (`check:structure-accessor`),
     * `file` is relative to the declaring layer's root. Declared by the
     * layer that owns the file, so the gate below it reads the entry
     * instead of naming a file of a layer above (owner, 2026-10-16, item 6b
     * of the folio-assistant#2598 wrong-direction triage). The gate decides
     * what an entry admits; a stale entry is the gate's finding, as for its
     * own allowlist.
     */
    files?: Array<{ gate: string; file: string; reason: string }>;
  };
  /**
   * The content adapters this layer SHIPS, which the harness's composition
   * root discovers rather than names. See {@link ContentAdapterDeclaration}.
   */
  contentAdapters?: ContentAdapterDeclaration[];
  /**
   * The LSI unit providers this layer SHIPS, which `lsi:near` discovers
   * rather than names. See {@link LsiUnitProviderDeclaration}.
   */
  lsiUnitProviders?: LsiUnitProviderDeclaration[];
  /**
   * The translation profile of each content type THIS layer owns: which
   * formats it can extract and inject, and which diagrams need re-rendering.
   * Collected by `schemas/library/translation-tools.ts` from every present layer
   * (bean `0r7u`, step 0 part 3), so cat-harness names no content type above
   * it. Module and diagram paths resolve from the declaring layer, then
   * down its `needs` chain.
   */
  contentTranslations?: ContentTypeTranslation[];
  /**
   * The Liquid prefix this layer's VALUES are addressed by in authored
   * text — `{{ <prefix>.<directory-id>.<entry>.<path> }}` — and whether the
   * platform resolves it or passes it through.
   *
   * Owner, 2026-09-30 (bean `kott`, issue #1564), paraphrased: `{{ site.data... }}`
   * is the prefix the IG-pipeline layer declares for itself, every layer
   * declares its own site prefix (bootstrap's is `{{ bootstrap.... }}`), so the
   * existing IG Publisher works as is.
   *
   * **Absent means the default: the prefix is the layer's `name`, resolved
   * by the platform.** `passThrough: true` hands the prefix to the downstream
   * engine untouched — the FHIR IG layer declares `site.data`, which Jekyll and the
   * IG Publisher resolve themselves.
   */
  liquid?: LiquidPrefix;


  /**
   * The package identity — reverse-DNS, stable forever, never reused.
   *
   * `instance-versioning.md` §3.2. SEPARATE FROM {@link name}, which is the
   * handle this repository resolves against, and from {@link stub}, which
   * names published FILES. An id is what an EXTERNAL consumer depends on, and
   * FHIR rule 1 is that the id is the identity and never changes while the
   * version distinguishes snapshots of it.
   *
   * **HELD, pending the ONE-reference design.** The owner ruled on 2026-09-23
   * that every asset carries an id, under
   * `io.github.litlfred.folio-assistant.<name>`. It was minted into all 17
   * declarations and then REMOVED, because the owner's next ruling contradicts
   * writing it there at all:
   *
   * > i want simplest so if someone wants to bootstrap a different harness,
   * > there is only one place to change. ONE PLACE.
   * > fork would only edit bootstrap/README.md and change ONE reference there.
   *
   * A namespace written into 17 files is 17 places. So the id must be DERIVED
   * from that single reference, and the reference does not exist yet —
   * `bootstrap/README.md` today has zero outward references and its own tests
   * enforce that. Bean `iwtn` owns creating it.
   *
   * Minting ids before then would bake the wrong scheme into artefacts the
   * schema itself calls *stable forever, never reused*.
   *
   * `skills/kg/kg-core/instance-publication.md` carries the namespace rule and
   * why a mirror never takes its subject's identity.
   */
  id?: string;

  /**
   * The version, and it is an EXACT semver triple.
   *
   * No range syntax, ever (`instance-versioning.md` §2 rule 2). FHIR pins exact
   * versions and `dependsOn` has no field a range fits, and aligning downstream
   * is the owner's hard constraint rather than a preference — some layers
   * here are consumed from outside this monorepo.
   *
   * `current` and `dev` are FHIR's pseudo-versions for "the latest CI build"
   * (rule 3). Accepted here and barred from the published tier by
   * `check:published-refs`, which is the same line §3.3 draws for a SHA.
   *
   * {@link canonicalUrl} already plays the `uri` role (rule 6) and the version
   * deliberately does not appear in it: the canonical URL is stable ACROSS
   * versions.
   *
   * **Universal, and enforced by the GATE rather than by this type.** Owner's
   * ruling, 2026-09-23: *"all assets get a version"*. All 17 carry one, and
   * `check:publishable` fails a layer without one.
   *
   * It is not `required` HERE because making it so breaks **376 tests across
   * 20+ files** — every fixture that builds a declaration without it. A sweep
   * that size hides a real regression among the noise, and the property asked
   * for is delivered either way: the corpus is complete, and a new layer
   * with no version does not pass.
   *
   * §3.1 originally REFUSED one unless `publishable: true`, on the premise
   * that a version reads as a publication claim. It does not — a version
   * distinguishes snapshots; whether anyone outside may depend on them is
   * {@link publication}, a separate question.
   * `skills/kg/kg-core/instance-publication.md`.
   */
  version?: string;
}

/**
 * RETIRED 2026-09-30 (option A). A per-entry `dependents: "reproduce" |
 * "skip"` said whether an instance inheriting a directory got its own copy.
 * The owner: "make dependents: reproduce automatic behaviour so [we] don't
 * need it." Every declared subgraph is now inherited automatically — each
 * layer in the chain whose same-named directory exists is a MEMBER of it
 * ({@link ResolvedDirectory.member}) — and whether an inherited directory is
 * CREATED is a fact about its graph typology, `GraphTypologyDef.perInstance`, stated
 * once rather than per entry (the per-entry field disagreed with itself:
 * `docs` was `reproduce` once and `skip` four times). A legacy `dependents`
 * key still parses and is dropped, so a folio written before the change keeps
 * loading.
 */

/**
 * A place to look, with no statement about inheritance.
 *
 * ## Why this is separate from {@link ContentDirectorySchema}
 *
 * One schema served two jobs that differ in exactly one respect. A LAYER
 * directory can be inherited by a dependent, so "does a dependent get its own?"
 * is a real question about it. A GRAPH NODE — `beans/defs`, `todos/feedback` —
 * lives inside a graph that is inherited or not as a whole; nothing ever
 * resolves a node across layers, so the question has no answer there.
 *
 * Making `dependents` required on the shared schema forced every graph node to
 * state something meaningless, and a required field that is sometimes noise is
 * a required field people learn to fill in without reading. That is the
 * failure mode the requirement exists to prevent, arriving by the back door.
 *
 * **This is a split, not a restatement.** `ContentDirectorySchema` extends this
 * one, so the shape is still declared once — which is the property
 * `bean-graph.ts` and `todo-graph.ts` were reusing it for.
 */
/**
 * Accept the pre-2026-09-21 spelling `graphs` where `graphTypologies` is absent.
 *
 * An in-tree declaration is migrated by the same commit that renames the
 * field; a DOWNSTREAM one is not, and `readDeclaration` throws on a
 * present-but-unreadable declaration rather than falling back. Without this an
 * unmigrated folio would stop resolving its own directories — the breakage
 * `GRAPH_TYPOLOGY_ALIASES` exists to prevent one layer down, for exactly the same
 * kind of rename.
 *
 * Deliberately NOT a merge: if a declaration carries both, `graphTypologies` wins
 * and the legacy key is ignored, because two spellings that disagree is the
 * one case where guessing which is current would be worse than either answer.
 */
function acceptLegacyGraphsKey(v: unknown): unknown {
  if (typeof v !== "object" || v === null) return v;
  const o = v as Record<string, unknown>;
  if (o.graphTypologies !== undefined || o.graphs === undefined) return v;
  const { graphs, ...rest } = o;
  return { ...rest, graphTypologies: graphs };
}

export const GraphNodeDirectoryShape = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  ...scopeShape,
  // Open string here, checked against the registry in `readDeclaration`.
  // A closed enum would have to be built at module load, which is before core
  // has registered `folio` — so the enum would reject the one kind the whole
  // rendering pipeline depends on.
  //
  // NAMED `graphTypologies` SINCE 2026-09-21, AND THE OLD NAME WAS THE CONFLATION.
  // The field lists KINDS, never graphs: `{ path: "voices/", graphTypologies: ["voices"] }`
  // says the graph here is OF KIND `voices`, but read literally it asserts the
  // directory IS the voices graph — and `cat-harness` is declared by 22
  // directories, so twenty-two of them each claimed to be the one cat-harness
  // graph. That is why `GraphTypology` read as redundant beside it: the type was
  // honest and the data was not.
  graphTypologies: z.array(z.string().min(1)).min(1),
  /**
   * This directory is DECLARED and deliberately not on disk, with the reason.
   *
   * ## Why a declared-but-absent directory needs saying out loud
   *
   * `resolveDirectories` is **existence-filtered**: a declared directory that
   * is not there is dropped, silently, before any consumer sees it. That is
   * the right behaviour for a consumer — scanning a path that does not exist
   * is not useful — and it is exactly why nothing reported one. A declaration
   * is an assertion that this directory is ours; when the assertion is false,
   * every consumer reports a clean run over nothing. The `dh4f` shape, in the
   * resolver they all depend on (bean `8mbk`).
   *
   * So `check:declared-dirs` fails on an absent directory unless the
   * declaration says it is meant to be absent, HERE, in a field a reader sees
   * in the diff.
   *
   * ## The reason is required, and that is the whole design
   *
   * Same rule as `folio:no-skill`, `folio:fulfilment` and `folio:judgement`:
   * an exemption whose justification is `""` is one somebody adds to get to
   * green. `library/` is the worked example — its description already argues
   * the cost at length and says outright that the shape is known rather than
   * overlooked. That argument belongs in a field a checker can read, not only
   * in prose a checker cannot.
   *
   * **It is checked in both directions.** A directory that declares `absent`
   * and then EXISTS is also a finding: an exemption that outlived its cause
   * reads as a live decision and is not one. That direction is the one that
   * rots quietly, because nothing goes wrong when it does.
   */
  absent: z
    .object({ reason: z.string().min(1, "an absent directory's reason cannot be empty") })
    .optional(),
  /**
   * This entry is a layer SUBGRAPH, not a part of its parent's graph.
   *
   * Bean `cmsl`: `resolveDirectories` lists a `"subgraph": true` entry exactly
   * as if `<instance>.json` had declared it (`skills.json`'s `voices`,
   * `beans.json`'s `queue`), while an entry without the marker — `beans.json`'s
   * `defs`, `docs.json`'s `proposals` — is one graph's interior and stays out
   * of the layer list.
   *
   * Declared here because `promoteFromWithin` has read it off the raw JSON
   * since `cmsl` and this schema did not carry it, so every consumer going
   * through `parseBeanGraph` lost it. `z.object` STRIPS an unknown key rather
   * than refusing it, which is why the loss was silent.
   */
  subgraph: z.literal(true).optional(),
  /**
   * Where this entry's content comes from, when it is not the checkout.
   *
   * The same field `ContentDirectory` carries, for the same reason and read by
   * the same resolver: a from-within entry can be kept on a branch too. Bean
   * `najo` cut `beans/queue/` over to `cat/cat-harness/merge-queue`, and
   * before this field existed here `parseBeanGraph` dropped the `source` —
   * so `contentIsOffCheckout` answered `false` for a graph that is not in the
   * checkout at all, and a reader of the parsed graph demanded a directory on
   * disk that is deliberately absent.
   *
   * `storage` is the legacy spelling (#1764) and is accepted for the reason
   * `resolveSubgraphSource` accepts it: a consumer must not get a different
   * answer because of which field an author wrote. `z.lazy` because
   * `DirectoryStorageSchema` is declared further down this module.
   */
  source: SubgraphSourceSchema.optional(),
  storage: z.lazy(() => DirectoryStorageSchema).optional(),
  ...kgNodeLabelShape,
});

/** The directory schema callers use — legacy `graphs` accepted, `graphTypologies` canonical. */
export const GraphNodeDirectorySchema = z.preprocess(acceptLegacyGraphsKey, GraphNodeDirectoryShape);

/**
 * What makes a declared subgraph REACHABLE — and the reasons it may not need
 * to be.
 *
 * The owner, 2026-09-20: *"everytime an instance names a directory as a
 * subgraph, it needs (QA valduation) to have visualizer, documenationentry. QA
 * if no skill, no tools."* Three obligations that fail differently, so they are
 * three fields rather than one flag:
 *
 * - `visualiser` — something renders it. Without one, a reader cannot LOOK.
 * - `docs` — something says what it is FOR. Without one, a reader who finds it
 *   cannot tell what belongs in it.
 * - `skill` — a skill governs it. Without one there is nothing for an agent to
 *   invoke, so the graph is agent-unreachable even where a human can read it.
 *   This is the sharpest of the three and the easiest to miss, because the
 *   directory looks perfectly fine.
 *
 * ## Every field is OPTIONAL, and that is deliberate
 *
 * `dependents` was made REQUIRED four hours before this was written, and the
 * bill landed on a sibling branch within the hour: `main` added two directory
 * entries without it, and CI on the merged tree reported 166 failures and 35
 * errors. Nothing was wrong with either side. **A required field is a change
 * every concurrent branch pays for**, and this one does not need to be
 * required to do its job — an absent field is exactly the finding the axis
 * exists to raise.
 *
 * ## `exempt` carries a REASON, never a bare true
 *
 * Not every subgraph wants a viewer: `interaction/` is read by an agent at
 * session start and a human page for it may be pointless. But an opt-out with
 * no reason is a silence list, and the next person cannot tell a considered
 * waiver from a shrug. So the value is the reason, and the axis prints it.
 */
/**
 * ONE visualisation of a subgraph — where it is rendered, and what to call it.
 *
 * The owner, 2026-09-20, correcting the framing of the question put to them:
 *
 * > its not a function of nodes, its a function of a harness watching a
 * > directort in repo root/ … if harness declares visaluzers, those should
 * > have tile. defaults to theme, but new can be changed. harness can declare
 * > >= 1 visualiztion (which then has a title)
 *
 * So a directory may be rendered more than once — a library as a shelf and as
 * a map are two visualisations of one graph — and each needs a name, because a
 * tile that says only "library" cannot say which of the two it opens.
 *
 * ## Every field but `ref` is optional, and that is the inheritance rule
 *
 * A visualisation that states only where it is rendered is **complete rather
 * than invalid** — the same rule `semantic-zoom.ts` encodes and for the same
 * reason. `title` falls back to the directory's id, `surfaces` to every surface, `theme`
 * to the directory's, `hidden` to false. Requiring any of them would make every
 * existing declaration in this repository invalid on the commit that added the
 * field, which is the cost `dependents` already charged once.
 */
/**
 * The surfaces a tile can appear on.
 *
 * `glass` joined 2026-09-23 (bean `zrvt`, issue #1006) on the owner's words:
 * *"where are the todo, fsh guts etc tiles on bottom of glass?"* That
 * overrides `v0jv`'s earlier *"the tiles must NOT be projected onto the
 * glass"*, and it is a SURFACE on the one declaration rather than a second
 * list of glass tiles — `harness-tiles`: one declaration, per-surface
 * visibility, never two registries.
 *
 * `board` is still a legal value and NOTHING RENDERS IT. Owner, 2026-10-02
 * (issue #1905, bean `t6ht`): *"stickies panel shouldnt have all those
 * icons"* — the sticky board's tile strip is gone. The value stays so no
 * existing declaration naming it turns invalid; a declaration whose only
 * surface is `board` parses and yields no tile.
 */
export const TILE_SURFACES = ["navbar", "board", "glass"] as const;
export type TileSurface = (typeof TILE_SURFACES)[number];

export const VisualisationSchema = z.object({
  /** The page that renders it, **relative to the REPOSITORY root** — see {@link SubgraphCoverageSchema.visualiser}. */
  ref: z.string().min(1),
  /**
   * What a tile calls it. Absent, the tile takes the display name of the
   * directory's first graph typology (`kindTitle`, via `scripts/lib/nav-label.ts`),
   * which is what every other surface calls that page. Declare one only when
   * the page is not simply "the kind's viewer". Never add the harness as a
   * suffix ("Docs — cat-harness"): the qualifier is appended by the surface
   * (bean `ob3m` finding 6, "One name everywhere").
   */
  title: z.string().min(1).optional(),
  /**
   * Where its tile appears. Absent means EVERY surface in {@link TILE_SURFACES}.
   *
   * Q11, 2026-09-20: *one declaration, per-surface visibility.* A tile is
   * declared once and says where it shows — never two registries free to
   * disagree about what a tile is.
   */
  surfaces: z.array(z.enum(TILE_SURFACES)).nonempty().optional(),
  /**
   * Whether this tile starts out of frame. Absent means shown.
   *
   * Q9: *declared default, reader may override.* The folio says which tiles
   * start hidden; a reader's own hiding is theirs alone and is committed
   * nowhere — which is `reader-filter.ts`'s rule on another surface.
   */
  hidden: z.boolean().optional(),
  /** The tile's theme, by reference (#1168 B8). Absent means the directory's, then the layer's. */
  theme: ThemeRefSchema.optional(),
  /**
   * WHICH GLYPH the tile wears, by NAME. Absent falls back to the generic
   * node-graph glyph every tile shared before this field existed.
   *
   * ## A name, and emphatically not markup
   *
   * `tileLink` assigns its glyph with `innerHTML`. A field carrying SVG would
   * therefore make a DECLARATION an HTML injection site — and a declaration is
   * inherited: a dependency's `<instance>.json` reaches this layer through
   * `resolveSkillDirs`, so the markup would not even have to be written by
   * somebody with commit access here.
   *
   * So this names a glyph in the client's own registry and default-denies
   * anything it does not know, which is R17's rule (*"skill tool hints for
   * XSSrsiction"*) applied one surface along: an allow-list is wrong only
   * about things it refuses, and a refusal is visible.
   *
   * ## Why an unknown name is a FALLBACK and not a failure
   *
   * The registry lives in `docs-ui.js` and the declaration lives here, so the
   * two are deployed together but AUTHORED apart — a folio may declare a glyph
   * against a newer platform than the one rendering it. A tile that vanished
   * or threw on an unrecognised name would turn a cosmetic mismatch into a
   * missing navigation entry. It renders the generic glyph instead, which is
   * exactly what it rendered before anybody declared one.
   */
  icon: z.string().min(1).optional(),
  /**
   * WHERE this visualisation may be published. Absent means everywhere, which
   * is what every visualisation did before this field existed.
   *
   * `"staging-only"` renders the page and keeps it OUT of the canonical
   * deploy: visible in a local build and in a `branches/<slug>/` preview,
   * absent from the published site.
   *
   * ## Why a graph would want that
   *
   * `fsh-guts` is the worked case and the owner's ruling of 2026-09-21. Its
   * declaration calls it *"the trashcan that is kept"* — deprecated content
   * relocated rather than deleted, because a scrapped item stops the next
   * agent re-entering a dead end while a deleted one cannot be told from an
   * accident. It was DELIBERATELY unrendered so that something could be kept
   * without being published, and the owner then asked to see it. Both things
   * are wanted: a reader here can browse it, a reader of the published site
   * does not meet it.
   *
   * ## The default is the SAFE direction, and that is the whole design
   *
   * Composition hides a staging-only visualisation unless it is positively
   * told otherwise (`compose-docs --staging`). So a forgotten flag HIDES TOO
   * MUCH — a missing page in a preview, immediately visible to whoever is
   * looking at the preview, and fixed by re-running with the flag.
   *
   * The opposite default fails the other way: a canonical build that forgets
   * its flag PUBLISHES content somebody chose not to publish, which is not
   * visible from the build at all and is not undone by deleting the page
   * afterwards. When the two error directions are that asymmetric, the
   * default belongs on the recoverable side.
   *
   * This is deliberately NOT expressed as `hidden`. That field says where a
   * tile appears among tiles; this says whether the page may be deployed, and
   * a reader who can reach a page by typing its URL is not helped by a tile
   * that declined to mention it.
   */
  publish: z.enum(["staging-only"]).optional(),
  /**
   * The GENERATOR that writes this page: repo-relative script files, run with
   * `bun run <file>` — the same field, with the same meaning, as a directory's
   * `writer`. Bean `0b8c` (#2230).
   *
   * ## Why a page names its writer
   *
   * A visualisation is a DERIVED artefact: it is computed from the directory
   * it visualises, and through that directory's `derivedFrom`, from every
   * graph upstream of it. Where it may be kept follows from where those
   * inputs are kept:
   *
   * - every input versioned with the checkout → the page may be committed,
   *   and a `:check` gate holds it current at every commit;
   * - any input kept on a BRANCH (a `source` or `storage` that is not the
   *   checkout) → the page cannot be current in a commit, because its input
   *   moves without one. It is BUILT AT PUBLISH by `derive:publish`, never
   *   committed, and this field is what that step runs.
   *
   * The measured failure: the fsh-guts viewer was committed on main while
   * `fsh-guts/` lives on `cat/cat-harness/fsh-guts`. One `state:push`
   * (2026-10-05, bean `rva2`) made `fsh-guts:viz:check` red on main and on
   * every open PR at once. `check:derived-from` now refuses that shape, and
   * refuses a publish-time page with no writer, since nothing would build it.
   */
  writer: z
    .array(z.string().min(1))
    .min(1)
    .refine((ps) => new Set(ps).size === ps.length, { message: "writer names a path twice" })
    .optional(),
  /**
   * Opt-in top-level route alias: `<base>/<alias>/` (bean folio-assistant-t4xb).
   * Canonical route is always `<base>/<harness>/<visualizer>/`.
   * When true, uses the visualizer's name as the alias; when string, uses the specified alias.
   * Refused if it collides with another alias, a harness route, or a reserved site route.
   */
  alias: z.union([z.string().min(1), z.boolean()]).optional(),
});
export type Visualisation = z.infer<typeof VisualisationSchema>;

/**
 * What `coverage.visualiser` accepts: one path, or several visualisations.
 *
 * **A bare string still parses**, and that is the whole shape of this change.
 * 27 declared paths in this repository are bare strings today; a widening that
 * cost each of them an edit would be a required-field change wearing an
 * optional one's clothes, and every concurrent branch would pay for it.
 */
export const VisualiserDeclarationSchema = z.union([
  z.string().min(1),
  z.array(VisualisationSchema).nonempty(),
]);
export type VisualiserDeclaration = z.infer<typeof VisualiserDeclarationSchema>;

/**
 * Every visualisation a directory declares, normalised.
 *
 * The ONE place a bare string becomes a list, so no consumer has to know that
 * the field has two shapes — which is this repository's standing rule: *a
 * downstream consumer must never have to string-manipulate, re-derive, or
 * assume a rule in order to use what we publish.*
 *
 * `[]` for a directory that declares none. That is a real answer and a
 * different one from "declares a visualiser that does not resolve", which is
 * `flh4`'s distinction and is checked elsewhere.
 */
export function visualisationsOf(
  coverage: SubgraphCoverage | undefined,
  directoryId: string,
): Array<Visualisation & { title: string }> {
  const v = coverage?.visualiser;
  if (v === undefined) return [];
  const list: Visualisation[] = typeof v === "string" ? [{ ref: v }] : v;
  return list.map((entry) => ({ ...entry, title: entry.title ?? directoryId }));
}

/**
 * Does this visualisation RESOLVE — is there, or will there be, a page?
 *
 * Its page on disk, or — for a page BUILT AT PUBLISH (bean `0b8c`, #2230) —
 * a declared `writer` whose every script exists. Such a page is derived from
 * a graph kept on a branch, so it is never committed, and whether a checkout
 * happens to hold a locally built copy must not change any answer: a reader
 * that asked the disk alone would emit one `docs/_data/harness.json` locally and another
 * in CI. `check:derived-from` is what holds the other half: that a page with
 * a writer and no committed copy really is built at publish.
 *
 * The one place this rule lives, so the readers (subgraph coverage, harness
 * tiles, viewer declarations) cannot disagree about it.
 */
export function visualisationResolves(v: Visualisation, exists: (repoRelative: string) => boolean): boolean {
  if (exists(v.ref)) return true;
  return v.writer !== undefined && v.writer.every((w) => exists(w));
}

/** Does this visualisation's tile appear on this surface? Absent means every surface. */
export function showsOn(v: Visualisation, surface: TileSurface): boolean {
  return v.surfaces === undefined || v.surfaces.includes(surface);
}

export const SubgraphCoverageSchema = z.object({
  /**
   * The page that renders this subgraph, **relative to the REPOSITORY root**
   * — not to the layer, which is what the sibling `path` on
   * {@link ContentDirectorySchema} is relative to.
   *
   * The two bases differ and nothing said so until 2026-09-20. Measured then
   * across both declarations in this repository: of 27 coverage paths, **25
   * resolve only from the repo root**, 2 from both (the root declaration's
   * own, where the two roots coincide) and **none** from the layer root
   * alone.
   *
   * It is worth stating here rather than leaving to be rediscovered, because
   * a consumer whose layer root is a subdirectory gets a plausible wrong
   * answer rather than an error: `state-visualizer.ts` runs with
   * `ROOT = cat-harness/`, so `join(ROOT, cov)` finds nothing and reports
   * every declared visualiser as absent. That very nearly shipped as a page
   * of false "the declared visualiser is not there" findings (bean `flh4`),
   * and it was caught only because the corpus was measured first.
   *
   * Whether the asymmetry should stay is bean `yt7j` and is the owner's call:
   * 27 declared paths resolve against it today, so this comment records the
   * behaviour rather than changing it.
   */
  visualiser: VisualiserDeclarationSchema.optional(),
  // NO `docs`: the documentation page says what it documents — a
  // `documents:` list in its front matter (generated pages get it from their
  // WebPage manifest) or `<meta name="documents">` — #1168 B7c,
  // `scripts/docs-declarations.ts`. A waiver is still `exempt.docs` below.
  // NO `skill`: the governing skill is read from the SKILLS, whose front
  // matter names the kinds (`graph-typologies:`) or the directory (`governs:`)
  // they govern — #1168 B7b, `scripts/skill-governance.ts`. The directory
  // named its skill until then, pointing at what depends on it. A waiver for
  // a directory nobody governs on purpose is still `exempt.skill` below.
  /**
   * What produces this directory's SERIALISATIONS — `json`, `jsonld` and
   * `schema.json` at the directory's own URL.
   *
   * The owner, 2026-09-20: *"all dir urls should have json, jsonld,
   * schema.json like `<base-url>/beans.jsonld`"*, narrowed 2026-11-12
   * (Q-SER-1 C / Q-SER-2 A, *"not all directories need to be harnessed"*) to
   * the directories of a NODE-GRAPH kind: {@link owesSerialisations}. A kind
   * says so itself, in its `serialised` flag (`false` on code, built pages
   * and fixtures), and absent the flag a kind owes unless it `holds: "state"`.
   * A directory owes when ANY of its kinds owes.
   *
   * **This is the one obligation with no WAIVER, and `hfkl` is why.**
   * `bootstrap` is excused a visualiser — *"it is exception to
   * harness/layer not having visualtion/workflow visualizer. but it must have
   * its json/jsonld… that is its existence."* The thing it is excused INTO is
   * this. So a directory may be exempt from being LOOKED at and is never
   * exempt from being READABLE BY A MACHINE: the visualiser is the courtesy,
   * the serialisation is the existence claim.
   *
   * ## It is NOT WAIVABLE, and that is the one asymmetry in this object
   *
   * Whether a directory owes at all is its KIND's answer, above; what no
   * directory can do is waive it. Every other criterion here takes an
   * `exempt.<criterion>` reason, because a
   * waiver with a reason is how this repository records a considered exception
   * rather than a silence. This one does not, on the owner's ruling,
   * 2026-09-20: *"harnesses cannot override there being in the KG."*
   *
   * A layer may decide nothing renders a directory, nothing documents it
   * and nothing governs it — those are choices about EFFORT. Whether its nodes
   * are addressable is not a choice about effort, it is the claim that they
   * are in the graph at all. A harness that could waive it could declare a
   * directory into the knowledge graph and then make its contents
   * unreachable, which is the `dh4f` defect with a signature on it.
   *
   * So `exempt` below carries three keys and not four, deliberately. If this
   * ever grows a fourth, that ruling has been reversed and the reversal
   * belongs here.
   */
  serialisations: z.string().min(1).optional(),
  /**
   * The BPMN process that GOVERNS this directory — a diagram's basename,
   * without `.bpmn`, as `document-ingestion`.
   *
   * Owner, 2026-09-29: *"show highlevel (sub)process bpmn on the uploads
   * page."* The uploads page is the generated subgraph README, and this is the
   * field that tells it which diagram to draw.
   *
   * ## DECLARED, and the temptation not to is the whole reason it exists
   *
   * `document-ingestion.bpmn` opens on a start event named *"A file lands in
   * uploads/"*. The directory is right there in the prose, so the link could
   * be inferred by matching the path against every start event's name — and
   * that is exactly the inference this repository keeps paying for. An event's
   * name is EDITORIAL text: rewording it to *"a source is dropped"* would be
   * an improvement to the diagram and would silently unlink the page, with no
   * gate able to tell the unlinking from a directory that never had a process.
   * The same argument `check-subgraph-coverage`'s header already makes about
   * `visualiser`: *a declaration inside the file is the contract*.
   *
   * It is also many-to-one in the direction inference cannot see. A diagram
   * may touch several directories (`document-ingestion` reads `uploads/` and
   * writes `library/`) while only ONE of them is the directory the process is
   * *about*. Name-matching would give `library/` the same claim.
   *
   * ## Absent means NOT DECLARED, never "no process"
   *
   * The standing rule, and the same one `readOnly` states two fields down.
   * A directory that says nothing has not asserted that no process governs it;
   * it has not answered. So a directory declaring none gets no process section
   * on its README and is **not** a finding — unlike `visualiser`, this is not
   * an obligation every directory owes, and treating silence as a gap would
   * put 20-odd rows in a report that means nothing by them.
   *
   * What IS a finding is a declared name that resolves to no diagram:
   * somebody said, and what they said points at nothing.
   * `check:subgraph-coverage` reports that as `unresolvable`, naming the
   * directory and the process, and the generated README says *could not
   * determine* rather than quietly dropping the section — a printed absence
   * and a real absence must not look alike.
   *
   * ## No `exempt.process`
   *
   * A waiver records a considered "we are not doing this" against an
   * obligation. There is no obligation here, so there is nothing to waive:
   * declaring nothing already IS the silence, and an `exempt` entry would be a
   * second spelling of it, free to disagree.
   */
  process: z.string().min(1).optional(),
  exempt: z
    .object({
      visualiser: z.string().min(1).optional(),
      docs: z.string().min(1).optional(),
      skill: z.string().min(1).optional(),
      // NO `serialisations` — see the field above. Not an omission.
      // NO `process` either, and for the opposite reason: there is no
      // obligation to waive. Declaring nothing already means "not declared".
    })
    .optional(),
});
export type SubgraphCoverage = z.infer<typeof SubgraphCoverageSchema>;

/**
 * How a graph is shown, and what can be done to it.
 *
 * Owner, 2026-09-21: *"folio is the only visualizer provided by cat-harness,
 * document is its own object. they have semantic different meanings =>
 * different visaluzation/operations/etc."*
 *
 * ONE MEMBER, and the count is the claim rather than an accident. A folio is
 * a board: nodes start closed as avatars, stickies can be added, sub-graphs
 * are held, and a layout layer is a diagram OF it rather than part of it
 * (issue #764 §3, F1–F6). Nothing else cat-harness ships answers that
 * description, and a second member added without that argument would make
 * the axis a synonym for "renderer".
 *
 * DECLARED HERE, in the HARNESS layer, rather than beside the content axes
 * in `block-kinds.ts` where the first draft put it. The owner's sentence is
 * *"folio is the only visualizer provided by CAT-HARNESS"*: a visualiser is
 * something the harness provides, while an adapter, a profile and an
 * interactivity are facts about content. `check:partition` is what settled
 * it — it refused `cat-harness.ts` [agentic-harness] importing
 * `block-kinds.ts` [folio-assist-core], and reading that refusal as a
 * misclassification rather than an obstacle produced the better placement.
 *
 * WHERE IT ATTACHES is per graph — issue #764, O2, settled 2026-09-22 — on
 * {@link ContentDirectorySchema}, beside `graphTypologies`. Per layer
 * cannot distinguish the two graphs one folio shows (F2: the library and the
 * working documents, and which one a node came from must stay visible); per
 * node kind inverts F1, where a folio renders nodes of OTHER objects and a
 * node kind does not choose its own chrome.
 *
 * NOT `coverage.visualiser`, which is a different question wearing a similar
 * word: that names the PAGE THAT RENDERS a graph, while this classifies the
 * graph. One field answering two questions is the defect this repository
 * names most often, and half the reason `where-does-this-go` was written.
 */
export const VISUALISER_KINDS = ["folio"] as const;
export type VisualiserKind = (typeof VISUALISER_KINDS)[number];

/**
 * How a directory's tile looks — everything a {@link Visualisation} carries
 * except the page it opens.
 *
 * #1168 B7a-2b, owner 2026-09-24 (*"split: page derived"*): the PAGE is read
 * from the viewer pages, each of which names the directories it draws
 * (`scripts/viewer-declarations.ts`); a directory no longer points at its
 * viewer. What stays with the directory is presentation, which is the
 * directory's own business.
 */
export const TileSchema = VisualisationSchema.omit({ ref: true });
export type Tile = z.infer<typeof TileSchema>;

/**
 * ONE VISUALISER, declared by the HARNESS at its own level — the only place a
 * visualiser is declared.
 *
 * The owner, 2026-10-09: *"I still want the harness to be where specific
 * visualizers/pages are declared for the harness at the level … Why
 * `renders: [fsh-guts]` in visualizer? Could have multiple visualizers
 * contending for same url... so not good. Need harness to declare visualizer
 * is renderedBy ...."*
 *
 * It replaces BOTH earlier answers: the directory naming its page
 * (`coverage.visualiser`, until #1168 B7a-2b) and the page naming the
 * directories it drew (`renders:` / `<meta name="renders">`, since). Neither
 * could stop two pages answering at one URL, because neither said where the
 * URL came from. Here it comes from the declaration and nothing else:
 * `visualiserRoute({ harness: <this instance's name>, visualiser: id })`
 * (`schemas/kg/visualiser-route.ts`), so two claims on one URL are two
 * declarations of one `(harness, id)` pair — refused by
 * `check:visualiser-routes` before anything is drawn.
 *
 * ## What it covers
 *
 * - `covers` — directory ids THIS layer declares. A harness names its own
 *   directories, never another layer's: that would be a lower layer naming
 *   a higher one.
 * - `coversKinds` — graph typologies, over every declared directory of those
 *   kinds in the checkout: the "full KG" a corpus-wide viewer draws. That is
 *   how cat-harness's library viewer covers the IRIS replica's library without
 *   naming it — a kind is vocabulary, not another layer's directory.
 *
 * At least one is required: a visualiser covering nothing is a page nothing
 * can open.
 *
 * ## `subgraphs` — what `<visualiser>/<sub-graph>/` names
 *
 * `instance` — one page per covered layer (`cat-harness/library/<instance>/`);
 * `directory` — one per covered directory id. Absent: the visualiser draws
 * the full view only. Readers use it to send a directory's tile to its
 * sub-graph page rather than the full one.
 *
 * ## `renderedBy` — a Tool node, by id
 *
 * The Tool is a KG node (`tools/`); its implementation may live anywhere.
 * `check:visualiser-routes` resolves the id against every declared `tools`
 * graph and checks that every kind the visualiser covers is one the Tool
 * declares it `renders`.
 *
 * ## `alias` — bean `t4xb`, opt-in
 *
 * `<base>/<alias>/` redirects to the canonical route. Never where the page is
 * drawn, and refused when it collides with another alias, a harness name or
 * anything the site already carries at its top level.
 *
 * The rest — title, icon, surfaces, hidden, theme, publish, writer — is the
 * tile and publishing vocabulary every visualisation already had
 * ({@link TileSchema}), so `publish: "staging-only"` keeps working unchanged.
 */
export const HarnessVisualiserSchema = TileSchema.extend({
  /** The URL segment under `<base>/<harness>/`, unique within this harness. */
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "a URL segment: lower-case letters, digits, hyphens"),
  /** The Tool node that draws it. */
  renderedBy: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "a Tool node id"),
  /** This layer's directory ids it covers. */
  covers: z.array(z.string().min(1)).nonempty().optional(),
  /** Graph typologies it covers, over every declared directory of them in the checkout. */
  coversKinds: z.array(z.string().min(1)).nonempty().optional(),
  /** What a `<sub-graph>` segment names, when the visualiser draws per-sub-graph views. */
  subgraphs: z.enum(["instance", "directory"]).optional(),
  /**
   * For `subgraphs: "directory"`: the sub-graph PATH a covered kind's
   * directories sit under, by kind — `{ "skills": "index/skills" }` puts the
   * `core-skills` directory's view at `<harness>/<id>/index/skills/core-skills/`.
   * Absent for a kind: the directory id alone. Declared because the nesting is
   * the visualiser's own declared structure (auto-docs' `auto-docs.json`), not
   * something a reader may infer from the pages.
   */
  subgraphUnder: z.record(z.string().min(1), z.string().regex(/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/, "a /-separated path of URL segments")).optional(),
  /** Opt-in `<base>/<alias>/` redirect to the canonical route (bean `t4xb`). */
  alias: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "a URL segment").optional(),
  /**
   * Its pages are built at publish on the HOST site (the site owner's, e.g.
   * cat-harness's), at `<site>/<locale>/<harness>/<id>/`, so the publish plan
   * derives those routes from this entry and the host lists none of them
   * (bean folio-assistant-uldr, owner option "1", 2026-11-06). `translated`:
   * it also writes one route per locale the checkout's translation sources
   * hold, besides the page locale. The writer is the `renderedBy` Tool's
   * `invoke.shell` script, and it marks each route it writes with a
   * self-ignoring `.gitignore` (`*`), which keeps the route out of git and out
   * of the mount digest.
   */
  builtOnHostSite: z.object({ translated: z.literal(true).optional() }).strict().optional(),
}).refine((v) => v.covers !== undefined || v.coversKinds !== undefined, {
  message: "a visualiser covers something: declare `covers` (directory ids) or `coversKinds` (graph typologies)",
});
export type HarnessVisualiser = z.infer<typeof HarnessVisualiserSchema>;

/**
 * A directory whose contents live on a BRANCH — one tree per commit, or one
 * live copy at the tip — with the
 * checkout holding at most a working copy.
 *
 * Bean `16ei`, arc `3fva`, proposal
 * `docs/proposals/qa-reports-branch-and-test-process-2026-10-01.md` §2.4. The
 * owner, 2026-10-01: *"do not pollute main with the QA subgraph; publish it on
 * a dedicated branch, as caching is"* — ruling D1 (a), an orphan `qa-reports`
 * branch keyed `main/<sha>/` and `pr/<n>/<head-sha>/`.
 *
 * ## What it changes, and for whom
 *
 * - **Writers** still write the declared path. It is the working copy, and
 *   `qa:publish` (`scripts/qa-store.ts`) carries it to the branch.
 * - **Readers** go through `qa-store`'s `readQa` / `readQaTree`, which answer
 *   hit / miss / corrupt / unknown — never "the directory is empty, so clean".
 * - **Presence checks** stop expecting the files in the checkout:
 *   `check:declared-dirs` and `harness:dirs --check` do not report the
 *   directory missing, `harness:dirs` does not create it empty (an empty
 *   working copy is the `dh4f` shape, a scan of nothing reading as clean),
 *   and `audit:coverage` reports the kind as `stored` rather than counting a
 *   working copy whose size depends on whether somebody ran `qa:fetch`.
 *
 * ## `keyedBy` — four keyings, and a fifth is a schema change
 *
 * - `commit` — one entry per commit (`main/<sha>/`, `pr/<n>/<sha>/`), read
 *   against a baseline. The QA branch (`scripts/qa-store.ts`).
 * - `tip` — ONE live copy: the branch tip IS the current state, with paths
 *   mirroring the checkout and a root `manifest.json` (`state-manifest/v1`).
 *   Beans and todos, each on its own named-subgraph branch
 *   (`cat/cat-harness/beans`, `cat/cat-harness/todos`; owner ruling
 *   2026-10-02). Read and written through `scripts/branch-store.ts`, whose
 *   writes splice onto the tip and never force-push.
 * - `route` — one entry per published SITE ROUTE, each replaced wholesale by
 *   the single generator that owns it. For REGENERABLE rendered output: the
 *   auto-doc page families, whose content is a pure function of the source
 *   tree. Bean `1j3q`, owner 2026-10-03 (*"Add route-keyed storage, then move
 *   it off main"*).
 *
 *   **It is not a synonym for `tip`, and the difference is the write.** A
 *   tip-keyed change carries `expect` (the blob id its author read), so two
 *   sessions editing one bean is a `conflict` the caller must settle — a bean
 *   is somebody's decision and a lost write is lost work. A generated page
 *   authored by nobody has nothing to settle: the newer generation wins, the
 *   unit replaced is the route, and a lost write costs a rerun. So a
 *   route-keyed write carries NO `expect`, deliberately, and
 *   `scripts/branch-store.ts` refuses one that does rather than honouring it
 *   — an `expect` here would mean a page has two writers, which is the premise
 *   failing rather than a collision to resolve.
 *
 *   The layer is `derived`, not `state`: the distinction §3.1 of
 *   `docs/proposals/state-branch-2026-10-02.md` draws is **regenerability**,
 *   and it is exactly what separates these two keyings.
 *
 * - `route-family` — one entry per MEMBER of a family under the directory's
 *   path, the member supplied at publish time rather than declared. Bean
 *   `xp5j`. **Its reasoning lives with the enum**, in
 *   `schemas/kg/subgraph-source.ts`: a keying is documented where its one
 *   definition is, which is the same rule that put the enum there (`1j3q`).
 *   {@link RouteMemberSchema} there validates the untrusted member key.
 *
 * The field is an enum, not a string, so a FIFTH keying is a schema change
 * somebody has to make rather than a reinterpretation of an existing value. The
 * enum itself is `KeyedBySchema` in `schemas/kg/subgraph-source.ts`, IMPORTED and
 * not restated: this field held its own `z.enum([...])` until the two drifted —
 * `route` was added here with bean `1j3q` and not there, so a route-keyed
 * declaration parsed and then threw a ZodError inside `resolveSubgraphSource`.
 * **A schema change somebody has to make is only a guard if there is ONE schema
 * to change**, and `route-family` was added to `KeyedBySchema` for exactly that
 * reason — this branch first restated the enum here and reproduced `1j3q` one
 * keying later.
 * Not every named subgraph gets a branch — semi-static KG content (skills,
 * schemas, processes) stays on `main` (owner, 2026-10-02).
 *
 * ## Set on every `qa` directory since bean `5hox`
 *
 * It was flipped only after every reader had migrated (proposal §4 Phase 3):
 * setting it earlier would have told the presence checks to stop looking while
 * the readers still read the checkout. Each stored working copy is ignored by
 * version control, and `directory-storage.test.ts` keeps the two equal.
 */
export const DirectoryStorageSchema = z
  .object({
    /** The branch, e.g. `qa-reports`. A plain branch name: no `refs/`, no `..`, no leading `-`. */
    branch: z
      .string()
      .regex(/^(?!-)(?!refs\/)[A-Za-z0-9._/-]+$/, "a plain branch name, e.g. qa-reports")
      .refine(
        (b) => !b.includes("..") && !b.includes("//") && !b.endsWith("/") && !b.endsWith(".lock") && !b.startsWith("/"),
        "not a valid branch name",
      )
      .optional(),
    /**
     * How entries are keyed on the branch: one entry per `commit`, one live
     * copy at the `tip`, or one entry per published `route`. See
     * {@link DirectoryStorageSchema}'s docblock for why `route` is not a
     * synonym for `tip`.
     */
    keyedBy: KeyedBySchema,
    /**
     * `keyedBy: "family"` only (bean `lehh`, owner 2026-10-04): a FAMILY of
     * branches, one per key — the branch-only graphs fhir-ast (one branch per
     * IG package) and lake-cache (one per Lean package and toolchain). `path`
     * is where a mount of ONE member lands, as fsh-guts' is. Resolved to
     * `kind: "family"`, never to a single branch.
     */
    branchPrefix: BranchPrefixSchema.optional(),
    /** `family` only: what the key is, in words — "the IG's package id". */
    keyFrom: z.string().min(1).optional(),
    /**
     * `family` only: where the family is. Absent = this repository, a copy
     * materialised here; `owner/repo` = read from that remote (owner,
     * 2026-10-04: a remote AST may be read or materialised locally, "similar
     * for lean cache").
     */
    repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "owner/repo").optional(),
    /**
     * The declared Tool that puts content on this store, or mounts it from
     * there: `gh-pages` deploys a site, `ig-cache` restores an AST family
     * (bean j9cs, owner 2026-10-04: *"there should not be a central registry
     * for declaring mount tools"*). A Tool node's `id`, which
     * `check:storage-tools` resolves against every declared `tools` graph.
     */
    tool: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "a Tool node id").optional(),
  })
  .strict()
  // ONE object carrying the ONE enum (`route-member.test.ts` checks identity),
  // with the family form told apart by its keying rather than by a second arm.
  .superRefine((s, ctx) => {
    const family = s.keyedBy === "family";
    if (family && (s.branch !== undefined || s.branchPrefix === undefined || s.keyFrom === undefined)) {
      ctx.addIssue({ code: "custom", path: ["keyedBy"], message: '`keyedBy: "family"` takes `branchPrefix` and `keyFrom`, and no `branch`' });
    }
    if (!family && (s.branch === undefined || s.branchPrefix !== undefined || s.keyFrom !== undefined || s.repository !== undefined)) {
      ctx.addIssue({ code: "custom", path: ["keyedBy"], message: "a single-branch keying takes `branch`, and no `branchPrefix`, `keyFrom` or `repository`" });
    }
  });
export type DirectoryStorage = z.infer<typeof DirectoryStorageSchema>;

const ContentDirectoryShape = GraphNodeDirectoryShape.extend({
  coverage: SubgraphCoverageSchema.optional(),
  /**
   * For a `translation-sources` directory: where the layer's `.po` catalogues
   * are when they are NOT under `<this directory>/<locale>/`. A path relative
   * to the layer root, with `{locale}` standing for the locale and `*` for any
   * one path segment's name, e.g. `input/*\/translations/{locale}.po`.
   *
   * The case it exists for is a FHIR IG built on a DAK base layer: that layer's
   * injector reads exactly one catalogue per locale per source directory,
   * `input/<area>/translations/<locale>.po`, so those files cannot move into
   * the harness layout without breaking the published translations. The
   * declared directory still holds what the harness keeps per layer (its
   * `glossary-sense.json`, any `<locale>/glossary/` schemes); the catalogues
   * this pattern matches are read beside it, and the locales they name count
   * as the layer's locales.
   */
  catalogues: z.string().min(1).optional(),
  /**
   * A named sub-graph that is OFF in every layer — including the one that
   * declares it — unless that layer enables it, by listing
   * `<instance>.<id>` in its own `enableSubgraphs` (cat-harness#991 step
   * 23.1; owner, 2026-11-03: `sdlc` and `work-plan` are off in every layer
   * above cat-harness unless it enables them). Switched off, it and
   * everything declared from within it are invisible to the resolved
   * directories, the skill overlay, the served Tools and a mount's default
   * list. `true` or absent: an entry that is on everywhere says nothing.
   * See `schemas/kg/opt-in-subgraphs.ts`.
   */
  optIn: z.literal(true).optional(),
  /**
   * Opt-in entries only: the other opt-in sub-graphs this one cannot work
   * without, each qualified `<instance>.<directory id>` — of this layer or its
   * `needs` closure (owner, 2026-11-13: cat-harness's `sdlc` requires
   * `cat-harness.work-plan`, whose skills and processes it uses). IMPLIED:
   * wherever this sub-graph is switched on, everything it requires is
   * switched on too, transitively, and a reference from inside it into one it
   * requires is not dangling (`check:optin-refs`). A from-within entry
   * (`L2/graph.json`'s `L2-collab`) may carry it too, read raw like its
   * `optIn` (`requiresDeclared`).
   * Checked by `check:declaration-resolution` (`requiresProblems`).
   */
  requires: z.array(z.string().min(1)).min(1).optional(),
  /** How this directory's tile looks. See {@link TileSchema}. */
  tile: TileSchema.optional(),
  /**
   * Whether the agent summary drain may draft summaries for a `library`
   * directory's prose blocks (bean `x80s`). Absent means `drain`.
   *
   * `held` keeps every entry out of `summaries:next` and out of the backlog,
   * and the listing names it as held rather than dropping it — "never
   * offered" must not read as "nothing to do". A property of the directory,
   * declared by the layer that OWNS it: the owner held agent-skills'
   * library back on 2026-09-24, and while that lived only as prose on the
   * bean, `summaries:next` handed its blocks out FIRST.
   */
  summaries: z.enum(["drain", "held"]).optional(),
  /**
   * Entry slugs (`<library>/<slug>/`) held back from the summary drain while
   * the rest of this `library` drains — the per-entry form of
   * `summaries: "held"`. It exists because a hold is the OWNER's decision
   * about a set of documents, and a set can outlive the directory it was
   * stated on: agent-skills' library was held on 2026-09-24 (bean `x80s`)
   * and dissolved into cat-harness's on 2026-10-01 (bean `j7ql`), where the
   * other entries drain. Folding the hold into the directory's would either
   * drop it or extend it to documents the owner never held. Listed, never
   * derived, so a move cannot release it silently.
   */
  heldEntries: z.array(z.string().min(1)).optional(),
  /**
   * Entry slugs of a `library` the owner asked to hold that no methodology
   * cites YET. The platform library holds only sources its methodologies cite
   * (`library-ref.test.ts` in the content core); a source ingested ahead
   * of the methodology text that will cite it is listed here, by name, until
   * it is cited and leaves the list. Unlike {@link heldEntries} this does NOT
   * hold the entry's summaries back: its blocks still drain. Listed, never
   * derived, so a source cannot become admitted by accident (bean `e0jh`).
   */
  awaitingCitation: z.array(z.string().min(1)).optional(),
  /**
   * HOW this graph is shown, and what can be done to it.
   *
   * The visualiser axis, declared PER GRAPH — issue #764, O2, settled by the
   * owner 2026-09-22. The vocabulary is `VISUALISER_KINDS` and the argument
   * for its single member is there; this is where it attaches.
   *
   * ## Why here rather than on the layer or on a node kind
   *
   * Per layer cannot answer it. F2 of the spec: a folio shows the LIBRARY
   * (static) and the WORKING documents, assets and artefacts (dynamic), and
   * which of the two a node came from must stay visible — so the graph is
   * already the unit carrying that provenance, and one answer per layer
   * would flatten exactly the distinction the folio has to draw.
   *
   * Per node kind inverts F1, where a folio renders nodes of OTHER objects.
   * A node kind choosing its own chrome would mean the thing being shown
   * decides how, which is the relationship the spec exists to reverse.
   *
   * ## NOT `coverage.visualiser`, which is a different question
   *
   * That field names the PAGE THAT RENDERS this graph. This one says which
   * visualiser's semantics and operations apply. They travel together and
   * are not the same fact: a graph can have a published page and no folio
   * semantics, and — once more than one visualiser exists — folio semantics
   * and no page yet. One field answering two questions is the defect this
   * repository names most often.
   *
   * ## ONE VALUE PER DIRECTORY, and what would change that
   *
   * A directory may list several `graphTypologies`, so this is strictly coarser
   * than "per graph" wherever that happens. It is one value today because
   * `folio` is the only member, which makes the coarseness unobservable. The
   * day two kinds in one directory need different visualisers, this becomes
   * a map from graph typology to visualiser — a schema change with a migration,
   * not a field to quietly reinterpret.
   *
   * ABSENT means not declared, never a default. A consumer that reads an
   * absent value as `folio` is inventing a declaration.
   */
  visualisedAs: z.enum(VISUALISER_KINDS).optional(),
  /**
   * This directory holds MATERIALIZED content: readable, and not editable here.
   *
   * Owner, 2026-09-21: *"if we have a materialized `<stub>/<sub-graph>`, the
   * contents of it should be immutable … you would need to copy/materialize it
   * to your own `folio/` in order to mess around with it."* And 2026-09-22,
   * choosing between advising and enforcing: **enforce from the start.**
   *
   * ## It is DECLARED, and `check:read-only-graphs` checks it against the bytes
   *
   * The owner chose declare-plus-gate over deriving it from the content. The
   * declaration is what a listing reads — cheaply, without scanning a corpus —
   * and the gate is what stops it drifting from the nodes, which is the failure
   * this repository keeps paying for: a declaration nothing checks reads as
   * coverage while the content says otherwise.
   *
   * ## Absent is not `false`
   *
   * It is **not declared**, and the gate reports the two apart. A directory
   * whose nodes are materialized and which says nothing has not asserted that
   * it is writable; it has failed to answer. Rendering that as `false` would
   * be the third-state collapse this schema spends most of its length
   * preventing — and it is the same distinction `dependents` is required for,
   * arrived at the same way.
   *
   * ## What a listing does with it — the two greys
   *
   * A graph with no viewer and a graph that is read-only both render inert, and
   * they are different facts. The first has nothing to open. The second opens
   * fine and refuses an edit, and it is the one that offers the copy-out.
   * Collapsing them tells a reader "there is nothing here" about content that
   * is present, complete and deliberately frozen.
   */
  readOnly: z.boolean().optional(),
  /**
   * WHY, and required whenever `readOnly` is declared — either value.
   *
   * Same discipline as {@link GateSchema}'s `basis`: *"we checked and it is
   * fine"* and *"nobody looked"* must not share a spelling. Here the second
   * value is the one that needs it most, and the corpus proved it within
   * minutes of the gate existing.
   *
   * An L1 library's `uploads/` is the ingestion DROP ZONE — `adapters/document/paths.ts`
   * creates it on a first ingest precisely so somebody can write there — and it
   * holds a materialized node. So it is declared writable OVER materialized
   * content, which is exactly the shape of the finding the gate raises, and is
   * correct. The bytes are materialized; the directory is a write target; those
   * are different questions. Without a stated basis that case is
   * indistinguishable from a directory whose declaration is simply wrong, and
   * the gate would have to either fail on it or stop checking the class.
   */
  readOnlyBasis: z.string().min(1).optional(),
  /**
   * This directory is what answers at the layer's own route, `/<instance>/`.
   *
   * `mount-instance-docs.ts` publishes a layer's content twice: at
   * `/<kind>/<instance>/` for every renderable kind it declares, and once at
   * `/<instance>/` — the layer's themed root, per the owner's 2026-09-20
   * ruling (paraphrased) that `/docs/<instance>/` is the cat-harness handler's
   * default for a layer's docs, and the layer's own themed site is at
   * `/<instance>/`.
   *
   * **Until this field existed, the second route went to whichever kind sorted
   * first alphabetically** — and the comment doing the sorting said, in as many
   * words, that the choice "is the instance's own business". It was not: it was
   * the alphabet's. The IRIS replica declaring both `docs` and `library` made that
   * concrete, because `docs` sorts first and the themed root would have served
   * the documentation, contradicting the ruling it was implementing.
   *
   * Optional, because a layer declaring ONE renderable kind has nothing to
   * choose. With several and none marked, the mount reports the root as
   * UNDETERMINED and keeps the deterministic order rather than silently
   * picking — a site must serve something there, and a quiet pick is how the
   * wrong page became the front door in the first place.
   */
  instanceRoot: z.boolean().optional(),
  /**
   * `/<kind>/<instance>/` for this directory is a ONE-FILE REDIRECT to the
   * directory's declared viewer, because the directory itself is not mounted.
   *
   * The case it exists for is a directory that WAS mounted and stopped being:
   * its kind route was a live URL, somebody may have linked it, and a route
   * that simply vanishes turns every such link into a 404. Bean `2b5s`: a
   * layer's `library/` held both its rendered pages and its corpus, the
   * mount copied the corpus to two routes, and moving the pages out left
   * `/library/<instance>/` with nothing to serve.
   *
   * **Declared, not inferred.** "Was this route ever published" is a fact
   * about history, which a checkout does not hold; deriving the redirect from
   * "has a published viewer and no index" instead would emit one stub per
   * such directory in every layer — 38 declared entries on 2026-09-30, several at routes
   * Jekyll already serves. `mount-instance-docs.ts` refuses the redirect,
   * naming it, when the directory IS mountable (a route cannot be both a
   * mount and a redirect) or declares no published viewer (a redirect to
   * nowhere).
   */
  kindRouteRedirect: z.boolean().optional(),
  /**
   * Where this directory's contents are KEPT, when that is not the checkout.
   * See {@link DirectoryStorageSchema} — bean `16ei`, arc `3fva`.
   */
  storage: DirectoryStorageSchema.optional(),
  /**
   * What this directory's content is COMPUTED FROM: the declared directory ids
   * of the graphs whose change can invalidate it, resolved across `needs`
   * exactly as a document kind's `computedFrom` is (bean `nama`; design note
   * `docs/proposals/derived-graph-dependencies-2026-10-04.md`).
   *
   * On the DERIVED side, by the owner's ruling (2026-10-04, option 1 of 3): the
   * writer of a derived graph is what knows its inputs, and the edge points down
   * the stack (an IG's pages name its artefact index, never the reverse). Data
   * graphs only. A generator is code, and the staging cone (bean `4j86`) reaches
   * it by its import closure, so code is not declared here a second time.
   *
   * Absent means "not declared", not "derived from nothing". `check:derived-from`
   * says which directories in the `derived` layer still owe an answer.
   * At least one id when present, each non-empty, and no id twice: an empty or
   * duplicated list says nothing a reader can act on.
   */
  derivedFrom: z
    .array(z.string().min(1))
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, { message: "derivedFrom names an id twice" })
    .optional(),
  /**
   * The generator that writes this directory: repo-relative script files, and
   * directories ending in `/` for what it reads rather than imports. See the
   * interface field. At least one path, none twice.
   */
  writer: z
    .array(z.string().min(1))
    .min(1)
    .refine((ps) => new Set(ps).size === ps.length, { message: "writer names a path twice" })
    .optional(),
  /**
   * This directory is AUTHORED FOR THE SITE'S PIPELINE, so compose it into the
   * Jekyll source instead of mounting its built output.
   *
   * Two ways a layer's content can reach the site, and they are not
   * interchangeable:
   *
   * | | when | what it gets |
   * |---|---|---|
   * | **mounted** (default) | after Jekyll, copied into `_site` | nothing — no layout, no sidebar, no front matter |
   * | **composed** (`true`) | before Jekyll, into `_docs/<instance>/` | the real just-the-docs page: sidebar, nav, language bar, QA badges |
   *
   * The owner's ruling on `n0nf` has both readings in one sentence — *"harness
   * can have docs/ which then get listed under `cat-harness/docs/<harness>`,
   * there is also docs/ dir in repo root … other harness augment or overlay
   * ontop of that"*. `compose-docs.ts` read the second clause and
   * `mount-instance-docs.ts` the first, and neither implemented *listed under*
   * as composition. This field is that clause.
   *
   * **Opt-in, and it must stay opt-in.** The IRIS layer is a REPLICA of IRIS:
   * just-the-docs' layout would replace IRIS's chrome with folio-assistant's,
   * which is the opposite of what a replica is for, and
   * `mount-instance-docs.ts` says exactly that where it declines to run Jekyll
   * over these directories. A composed default would silently restyle it.
   *
   * A composed directory holds **markdown with front matter**, not finished
   * HTML — Jekyll renders it. Declaring `composed` over a directory of
   * `<!doctype html>` files publishes them as page BODIES inside a layout,
   * which is a nested document rather than an error, so nothing downstream can
   * catch it for you.
   */
  composed: z.boolean().optional(),
  /**
   * This directory is built INTO the layer's own IG site, which is served
   * at `/<instance>/` — never composed into the main site.
   *
   * A layer that mirrors a FHIR IG and records its source
   * (`fhir-artifact-index/menu.json`) gets one Jekyll site of its own, built
   * by the FHIR IG layer's `scripts/stage-ig-sites.ts` from the IG's narrative pages
   * (bean `bamf`). Without this field that site sits at `/<instance>/ig/`
   * BESIDE the layer's composed pages: two sites, two menus, and the
   * reader at `/<instance>/` sees only the artefact index. With it, the IG
   * site IS `/<instance>/` and this directory's pages (the artefact pages and
   * their assets) build inside it, under the IG's own menu — one site, as the
   * IG Publisher builds one.
   *
   * Owner, 2026-10-05 (bean `mftp`), choosing the merged site for the trust IG
   * with *"clean break on old beahviour, no redirect needed"*.
   *
   * **Opt-in, never inferred from `menu.json`.** The DAK layer holds a menu too,
   * but its root is a harness landing page (bean `n3ni`); inferring
   * would silently replace it. Refused together with `composed`: a directory
   * built into two different sites has two answers for one URL.
   */
  igSite: z.boolean().optional(),
  /**
   * This directory's BYTES are published verbatim, at `/<instance>/<path>`, for
   * the site's own pages to fetch.
   *
   * Owner, 2026-10-01: *"other goals of justthedocs rendering is to reduce the
   * .html bloat.... lots of it can be loaded client side from the KG"*, then
   * choosing to publish the graph directory itself rather than copy its files
   * into `docs/` beside the pages that fetch them (bean `680p`,
   * [`visualizer-loading`]). A copy is a second answer free to drift from the
   * first; a served directory is the one answer, at a stable URL.
   *
   * **Served is not rendered.** `composed` puts markdown through Jekyll and a
   * mount publishes a directory with its own front door; this publishes DATA,
   * untouched — no Liquid, no layout, no index page — after Jekyll, by
   * `mount-instance-docs.ts`. Nothing about the directory becomes navigable;
   * a page that wants it fetches it.
   *
   * **Declared, never inferred**, and opt-in: publishing is outward-facing, so
   * a directory's bytes reach the site only because its declaration says so.
   * `withheld.json` still governs, as it does for every mount. Absent means
   * not served.
   */
  served: z.boolean().optional(),
  /**
   * Which theme this subgraph renders on.
   *
   * The owner, 2026-09-20: *"theme for analyst apply to the methodlogies
   * (CRDM, MADR, SDLC, etc.)"*, with *"use judgement"* on how.
   *
   * ## Why the DIRECTORY carries it
   *
   * A theme was previously declarable in two places — a sticky
   * (`StickyContribution.theme`) and, since bean `5y4b`, a todo. Neither
   * answers "what does this SUBGRAPH look like", which is the question a
   * per-instance navbar section and a board panel both ask (`603s`, `6lb8`).
   * Putting it on the directory means one methodology declares its theme once
   * and every surface that renders the methodology agrees, instead of each
   * surface deciding separately and drifting.
   *
   * ## Judgement applied: the methodologies take `analyst`, and nothing else does
   *
   * `methodologies` and `folio-assistant-core-methodologies` — the
   * directories that hold a methodology and carry a theme. (`methodology-crdm`
   * and `methodology-raci` went 2026-09-22; `smart-kg-methodologies` went
   * 2026-09-24, bean `wg7r`, when GRADE became a skill plus code lists.) MADR and SDLC are named in the instruction and do not exist
   * yet; they inherit the answer when they are declared, which is the point of
   * writing it on the directory rather than per page.
   *
   * Not applied to the rest. A theme on every directory would make the field
   * mean nothing, and this repository's own rule is that a distinction which
   * fires on every subject is not a distinction.
   *
   * ## Open string, like every other theme reference here
   *
   * Closing the enum means importing the theme table into the declaration
   * reader, and that reader is what the site build, the gates and every
   * consumer of a `harness.json` go through. An unknown theme is a rendering
   * finding, not a parse error.
   *
   * A `ThemeRef` since #1168 B8 (owner, 2026-09-30: *"migrate to ThemeRef"*):
   * still open — the shape is `{instance?, themeId}`, not an enum — but a
   * cross-instance theme now says whose theme it is.
   */
  theme: ThemeRefSchema.optional(),
  /**
   * Where this subgraph gets its CONTENT — the checkout's own directory (the
   * default, so absent means `{ kind: "directory" }`) or a declared repository
   * branch, with room for a later kind. The layer config may override it
   * by id. Resolve it with `resolveSubgraphSource`, never by reading this
   * field: the override and #1764's `storage` are folded in there, once.
   * See `schemas/kg/subgraph-source.ts` — bean `l4ay`, owner 2026-10-03.
   */
  source: SubgraphSourceSchema.optional(),
});

/** As {@link GraphNodeDirectorySchema}, for a layer's own directories. */
export const ContentDirectorySchema = z.preprocess(
  acceptLegacyGraphsKey,
  // A `qa` directory is commit-keyed by construction: its readers compare one
  // commit's verdicts against a baseline, and `qa-store.ts` implements only
  // that layout. A tip-keyed `qa` store would be read as if it were keyed by
  // commit, so it is refused here rather than at its first read (bean `2h76`).
  //
  // `route` is refused on the same directory for the same reason and a second
  // one (bean `1j3q`): a QA verdict is addressed by the commit it judges, and
  // there is no route to key it by. Checking the two values together rather
  // than only `tip` is the point — a guard that named one keying would have
  // admitted every keying added after it, which is how the next third value
  // passes a test written for the second.
  ContentDirectoryShape.refine(
    (d) =>
      !(
        (d.storage?.keyedBy === "tip" || d.storage?.keyedBy === "route" || d.storage?.keyedBy === "route-family") &&
        (d.graphTypologies as readonly string[] | undefined)?.includes("qa")
      ),
    {
      message:
        'a `qa` directory is keyed by commit; `keyedBy: "tip"` is for one-live-copy state (beans, todos), `keyedBy: "route"` for regenerable rendered pages, and `keyedBy: "route-family"` for a family of them named at publish time',
      path: ["storage", "keyedBy"],
    },
  ).refine((d) => !(d.igSite === true && d.composed === true), {
    message: "`igSite` and `composed` name two different sites for one directory; declare one",
    path: ["igSite"],
  }),
);

// THERE IS NO `locale` FIELD HERE, and that is a decision rather than an
// omission. A first draft of PR #351 added one, required on a
// `translated-content` directory and refused elsewhere. It worked and it was
// the wrong axis: a translated page already declares `lang` and
// `translation_source` in its own front matter, so the directory entry
// restated what every file inside it already said — one fact in two places,
// free to drift, and growing as O(locales x subtrees).
//
// The rule this repository keeps returning to: a declaration states what to
// EXPECT in a directory, and THE FILES DECLARE WHAT THEY ARE. `beans/` is one
// entry whose contents are told apart by a bean's front matter and a workflow
// instance's `$schema`; `docs/assets/qa/` is one entry holding three witness
// families, told apart by the documents. Translated pages are the same shape:
// one declaration for the content, and `lang` on the file.

/**
 * The conventional directories every layer gets without declaring them.
 *
 * ## Why defaults live in the CONTAINER SCHEMA
 *
 * The owner, 2026-09-19: *"inherit, set default dirs/graphs in container
 * schema definitions."* A layer that follows the convention should declare
 * NOTHING — the friction of a new topical directory ought to be a line, and
 * the friction of a conventional one ought to be zero. Before this, every
 * layer restated the same seven entries, which is seven chances to disagree
 * with the platform about what `beans/` is.
 *
 * `resolveDirectories` seeds from these and the declaration chain overrides
 * **by `id`**, exactly as a dependency's entries are overridden — so a default
 * is not a special case in the resolution rules, it is the outermost link of
 * the chain.
 *
 * ## A default is only real if the directory EXISTS
 *
 * They are filtered by existence at resolve time, and that is not an
 * optimisation. `AGENTS.md`: *"Declare only what exists — a declared-but-absent
 * directory is the bean `dh4f` defect, where a consumer scans nothing and
 * reports a clean run over it."* Seeding a default for `voices/` into a
 * layer with no voices would manufacture exactly that, at scale, in every
 * layer at once.
 *
 * An EXPLICIT declaration is honoured whether or not the directory is there:
 * that is the layer asserting something, and `readDeclaration` already
 * refuses a declaration it cannot read. A default is the platform guessing,
 * and a guess has to be checked.
 *
 * ## What is not here
 *
 * `folio` — the one renderable kind — is registered by CORE, not the harness,
 * and the harness cannot default a directory to a kind it does not know. Any
 * topical directory (`bootstrap/`, `crdm/`, …) is declared, one line each: the
 * platform cannot guess names it has never met, and guessing would re-create
 * the `dh4f` shape for every name it guessed wrong.
 */
// declared-path-literal: THE BASE CASE. These ARE the defaults every other
// site reads through `resolveDirectories`; reading a declaration to learn the
// fallback for a layer that has none is not a thing that can be done.
export const DEFAULT_DIRECTORIES: readonly ContentDirectory[] = [
  // `dependents` on the CONVENTIONAL set, classified by the same question as
  // every declared entry: would a folio depending on this one want its own?
  //
  // The four `skip` entries are the platform's own machinery — a folio reads
  // this layer's schemas, tools and skills through the overlay and has no
  // use for four empty directories bearing those names. The four `reproduce`
  // entries are the shape a folio HAS: its own work plan, its own todos, its
  // own ingestion queue, its own L1 library.
  //
  // `beans/` and `todos/` are marked `reproduce` and it costs nothing, because
  // both are repository-scoped and `resolveDirectories` never inherits a
  // repository-scoped entry in the first place. Classifying them anyway keeps
  // the rule "every entry carries one" free of an exception nobody would
  // remember — and if either ever loses that scope, the classification it
  // already has is the right one.
  { id: "tools", path: "tools/", graphTypologies: ["tools"] },
  { id: "schemas", path: "schemas/", graphTypologies: ["schemas", "cat-harness"] },
  { id: "skills", path: "skills/", graphTypologies: ["skills"] },
  // THE CONVENTION, as of 2026-09-21: a layer's Knowledge Graph is five sibling
  // directories rather than one with subdirectories. `scenarios/` and
  // `processes/` were `skills/roles/` and `skills/workflows/`, found by
  // walking down from the skills root.
  //
  // They are listed here and not only in the declarations because
  // `DEFAULT_DIRECTORIES` is what a layer with NO declaration resolves
  // against — AGENTS.md: "an unmigrated instance falls back to today's
  // conventions". Leaving them out made that fallback describe yesterday's,
  // which is how the workflow-coverage fixtures went blind: they write a
  // temp root with no declaration, so every diagram they create resolved
  // through this list or not at all.
  //
  // Existence-filtered like every other entry, so a layer that has no
  // `processes/` is not claimed to have an empty one — the `dh4f` defect.
  { id: "scenarios", path: "scenarios/", graphTypologies: ["scenarios"] },
  { id: "processes", path: "processes/", graphTypologies: ["processes"] },
  { id: "beans", path: "beans/", graphTypologies: ["beans"] },
  { id: "todos", path: "todos/", graphTypologies: ["todos"] },
  { id: "uploads", path: "uploads/", graphTypologies: ["uploads"] },
  { id: "library", path: "library/", graphTypologies: ["library"] },
  // `skills/voices/`, not `voices/`, since 2026-09-21 — a voice IS a skill, and
  // the four this repository ships moved under `skills/` with the rest of the
  // `kg` graph (bean `btuv`). The convention stated here and the fallback
  // `VOICES_DIR` in `schemas/content/voices.ts` are ONE fact, and they disagreed for a
  // day: this said `voices/` while that said `skills/voices`.
  //
  // The disagreement was harmless only by accident — `resolveDirectories`
  // drops an entry whose directory is absent, so an undeclared layer with
  // voices under `skills/` got `undefined` here and fell through to
  // `VOICES_DIR`. An accident is not a mechanism, and the next reader would
  // have had to rediscover it to know which of the two was right.
  //
  // The LEGACY path is not dropped: `loadVoices` probes `voices/` when the new
  // one is absent, for the same reason `voiceFilesIn` reads both file layouts
  // — a downstream folio must not be broken by an upgrade it did not ask for.
  { id: "voices", path: "skills/voices/", graphTypologies: ["voices"] },
];

/**
 * The kinds of host that can serve a layer's renderings.
 *
 * The values are the `publication host` axis of
 * `docs/proposals/deployment-topologies.md` verbatim. Keep them in step: the
 * proposal is what a reader reasons with, this is what a machine reads, and a
 * fifth value invented here without a row there is a vocabulary nobody agreed.
 *
 * `none` is a real answer, not a missing one — a developer checkout that
 * renders nothing publishes nowhere, and saying so is different from not
 * saying.
 */
export const PUBLICATION_HOSTS = [
  "github-pages",
  "local-server",
  "jurisdiction-endpoint",
  "none",
] as const;

export type PublicationHost = (typeof PUBLICATION_HOSTS)[number];

export interface Publication {
  /**
   * WHAT KIND of host serves the renderings. Optional: absent is a third
   * state — the deployment has not said, NOT `github-pages`.
   */
  host?: PublicationHost;
  /**
   * WHAT STATE this layer's publication is in. `draft`, always, today.
   *
   * **The discipline is in the skill, not here** —
   * `skills/kg/kg-core/instance-publication.md`. Owner's ruling, 2026-09-23:
   * *"all assets get a version and are in 'draft' publication. formal
   * publication process needs to be deinfed/neeeds tools/depends on
   * instance."*
   *
   * A sibling of {@link host} rather than a field of its own, because they are
   * two facets of ONE question — what serves this, and how far along it is.
   * This field's own docblock already lists `canonicalUrl`, `publication.host`
   * and `readme.linkStyle` as three questions that are easy to run together;
   * a fourth top-level name would have been a fourth.
   *
   * A LITERAL UNION OF ONE, and that is the point: `"published"` fails to
   * PARSE. Not accepted-and-reported — refused, because the process that would
   * back it does not exist, and a gate that merely grumbles about an unbacked
   * flag is a gate somebody switches off. Absent means `draft`.
   *
   * It replaced the top-level `publishable?: boolean`, whose three states
   * could not express what was true: all 17 layers reported `undecided`
   * while the answer was known for every one of them. A third state that
   * cannot say what is the case is a missing value, not a third state.
   */
  state?: "draft";
}

export const PublicationSchema = z.object({
  host: z.enum(PUBLICATION_HOSTS).optional(),
  state: z.literal("draft").optional(),
});

/**
 * The **forge** axis — where change proposals live.
 *
 * `deployment-topologies.md` §1 axis 1. `none` is local git with no service
 * at all, and is a real answer rather than a missing one.
 */
export const FORGES = ["none", "github", "self-hosted", "jurisdiction-hosted"] as const;
export type Forge = (typeof FORGES)[number];

/**
 * The **network reach** axis — what the harness may call out to.
 *
 * §1 axis 5. The distinction between `egress-restricted` and `air-gapped`
 * carries real weight: they were ONE value in the proposal's first draft, and
 * splitting them is what exposed the hosted-inference contradiction below. A
 * deployment that wants closed hosted models is, by that choice, not
 * air-gapped.
 */
export const NETWORK_REACHES = ["internet", "egress-restricted", "air-gapped"] as const;
export type NetworkReach = (typeof NETWORK_REACHES)[number];

/**
 * The **model provenance** axis — where inference happens and under whose terms.
 *
 * §1 axis 8. Deliberately separate from model *cardinality* (how many): a
 * stack of open-weight local models and a single closed hosted one are both
 * real configurations, and collapsing the two axes is what made the
 * air-gapped contradiction invisible.
 */
export const MODEL_PROVENANCES = ["open-weight-local", "hosted", "mixed"] as const;
export type ModelProvenance = (typeof MODEL_PROVENANCES)[number];

/**
 * The **compute** axis — whose hardware runs the harness.
 * §1 axis 4.
 */
export const COMPUTES = ["workstation", "vendor-cloud", "jurisdiction-cloud", "own-infrastructure"] as const;
export type Compute = (typeof COMPUTES)[number];

/**
 * The **tool surface** axis — how capabilities are invoked.
 * §1 axis 6.
 */
export const TOOL_SURFACES = ["mcp", "cli", "both"] as const;
export type ToolSurface = (typeof TOOL_SURFACES)[number];

/**
 * The **model cardinality** axis — one model for every workflow, or a stack.
 * §1 axis 7.
 */
export const MODEL_CARDINALITIES = ["single", "stack"] as const;
export type ModelCardinality = (typeof MODEL_CARDINALITIES)[number];

/**
 * The **data stores** axis — what live external systems exist beside the deployment.
 * §1 axis 9.
 */
export const DATA_STORES = ["none", "hapi-fhir", "national-portal", "emr", "wallet"] as const;
export type DataStore = (typeof DATA_STORES)[number];

/**
 * The **repository visibility** axis — who can reach the repository.
 * §1 axis 2.
 */
export const VISIBILITIES = ["public", "private", "internal"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/**
 * The topology axes a layer declares about ITSELF.
 *
 * ## The ten axes from deployment-topologies.md
 *
 * Ten axes model WHERE the layer and its artefacts live. Each field is
 * optional, and absent means "has not said", never a default.
 *
 * **`publication.host` is axis 3 and lives on {@link Publication}** rather than
 * here, because it answers a publication question and has two other fields
 * it must be told apart from.
 */
export interface Topology {
  forge?: Forge;
  network?: NetworkReach;
  modelProvenance?: ModelProvenance;
  /** Whether the deployment serves people outside the operator. §1 axis 10. */
  outwardFacing?: boolean;
  compute?: Compute;
  toolSurface?: ToolSurface;
  modelCardinality?: ModelCardinality;
  dataStores?: DataStore[];
  visibility?: Visibility;
}

export const TopologySchema = z.object({
  forge: z.enum(FORGES).optional(),
  network: z.enum(NETWORK_REACHES).optional(),
  modelProvenance: z.enum(MODEL_PROVENANCES).optional(),
  outwardFacing: z.boolean().optional(),
  compute: z.enum(COMPUTES).optional(),
  toolSurface: z.enum(TOOL_SURFACES).optional(),
  modelCardinality: z.enum(MODEL_CARDINALITIES).optional(),
  dataStores: z.array(z.enum(DATA_STORES)).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
});

/**
 * A named deployment profile representing a point in the topology product.
 */
export interface DeploymentProfile {
  name: string;
  description: string;
  topology: Topology;
  publicationHost?: PublicationHost;
}

/**
 * Developer mode topology point in the product (bean `folio-assistant-2ngl`):
 * - forge: none (local git only)
 * - publication host: local-server
 * - compute: workstation (the developer's own machine)
 * - tool surface: cli
 * - model cardinality: single (one model, every workflow)
 * - data stores: [none]
 * - outward facing: false
 */
export const DEVELOPER_MODE_TOPOLOGY: Topology = {
  forge: "none",
  compute: "workstation",
  toolSurface: "cli",
  modelCardinality: "single",
  dataStores: ["none"],
  outwardFacing: false,
};

export const DEVELOPER_MODE_PROFILE: DeploymentProfile = {
  name: "developer",
  description:
    "Developer workstation mode: local git repository, local HTTP server, single model supply, CLI tool surface, workstation compute, no external data stores.",
  topology: DEVELOPER_MODE_TOPOLOGY,
  publicationHost: "local-server",
};

export const DEPLOYMENT_PROFILES: Record<string, DeploymentProfile> = {
  developer: DEVELOPER_MODE_PROFILE,
};

/** One refused combination, with the reason a reader can argue with. */
export interface TopologyConflict {
  /** The two declared values that cannot co-occur, as `axis: value`. */
  pair: [string, string];
  /** Why the mechanism forbids it — an entailment, never a report. */
  reason: string;
}

/**
 * Every incompatible pair a declaration names. Empty is the normal answer.
 *
 * ## The bar for a rule here
 *
 * Each of these is an **entailment of the mechanism**, which is the standard
 * `deployment-topologies.md` §3 sets and the reason the table is short:
 *
 * | encode it | do not encode it |
 * |---|---|
 * | Pages has no per-file media-type configuration; air-gapped compute cannot reach hosted inference | someone said so, however authoritative |
 * | measured, with the command and the date | true of one account, one plan, one version |
 *
 * The operative test is **not how certain the claim feels — it is whether a
 * counter-example is conceivable.**
 *
 * ## Two things deliberately absent
 *
 * **`visibility: private` with `github-pages` is NOT a conflict.** Settled by
 * the owner 2026-09-19: Pages on a private repository exists on some plans,
 * so a deployment may legitimately declare both. It is a *reason to reach for
 * the local server*, not a property of the mechanism. Do not re-litigate it;
 * `visibility` is not even declared, so there is nothing to trip over.
 *
 * **`air-gapped` with `modelProvenance: "mixed"` is NOT refused**, although
 * `hosted` is. **Settled by the owner 2026-09-20**, and for a better reason
 * than the one this comment used to give:
 *
 * > "no air-gapped-mixed. that is mixed already. its a spectrum, based on
 * > the deployment archicutectur of each machine actor."
 *
 * At deployment level `mixed` MEANS THE ACTORS DIFFER FROM EACH OTHER.
 * Refusing it would refuse the normal case — a site where some machine
 * actors reach out and some do not. There is no contradiction to catch,
 * because the deployment value is an aggregate over participants that are
 * individually consistent.
 *
 * That also says what this axis is and is not. Reach is a property of each
 * MACHINE ACTOR; the deployment value describes the population. So a rule
 * pairing `network` with `modelProvenance` can only be sound where the
 * deployment value is UNIFORM — `air-gapped` × `hosted` is refused because
 * `hosted` admits no local participant, and `mixed` is refused by nothing
 * because it asserts variety.
 *
 * The earlier reasoning here — "a counter-example is conceivable" — reached
 * the right answer by a weaker route, and is kept only in the test that
 * records the decision. See `folio-assistant-r0rq` for the per-actor model.
 */
export function topologyConflicts(
  topology: Topology | undefined,
  host: PublicationHost | undefined,
): TopologyConflict[] {
  const t = topology ?? {};
  const out: TopologyConflict[] = [];

  // Every guard below tests for a DECLARED value on both sides. An undeclared
  // axis contributes to no conflict, which is the third state doing its job.
  if (host === "github-pages" && t.forge !== undefined && t.forge !== "github") {
    out.push({
      pair: ["publication.host: github-pages", `topology.forge: ${t.forge}`],
      reason:
        "GitHub Pages is a GitHub product and publishes from a GitHub repository. " +
        "With any other forge there is nothing for it to publish from.",
    });
  }

  if (t.network === "air-gapped" && t.forge === "github") {
    out.push({
      pair: ["topology.network: air-gapped", "topology.forge: github"],
      reason: "An air-gapped deployment cannot reach github.com, so the forge is unreachable.",
    });
  }

  if (t.network === "air-gapped" && t.modelProvenance === "hosted") {
    out.push({
      pair: ["topology.network: air-gapped", "topology.modelProvenance: hosted"],
      reason:
        "Inference cannot leave the airlock. A deployment that wants hosted models " +
        'is, by that choice, `egress-restricted` rather than `air-gapped`.',
    });
  }

  // NOT redundant with the two above, though the proposal calls it a
  // consequence of them. It follows only when `forge` is also declared — and
  // `forge` is optional, so on a declaration that names the network and the
  // host and nothing else, this is the only rule that fires.
  if (t.network === "air-gapped" && host === "github-pages") {
    out.push({
      pair: ["topology.network: air-gapped", "publication.host: github-pages"],
      reason: "An air-gapped deployment cannot reach GitHub Pages to publish to it.",
    });
  }

  if (t.outwardFacing === true && host === "none") {
    out.push({
      pair: ["topology.outwardFacing: true", "publication.host: none"],
      reason:
        "Nothing is served, so nobody outside the operator can reach it. " +
        "Declare a host, or say the deployment is not outward-facing.",
    });
  }

  return out;
}

/** Thrown when a declaration names a combination that cannot exist. */
export class TopologyConflictError extends Error {
  constructor(
    readonly path: string,
    readonly conflicts: TopologyConflict[],
  ) {
    super(
      `${path} declares ${conflicts.length} incompatible ` +
        `combination${conflicts.length === 1 ? "" : "s"}:\n` +
        conflicts.map((c) => `  - ${c.pair[0]} with ${c.pair[1]}\n      ${c.reason}`).join("\n"),
    );
    this.name = "TopologyConflictError";
  }
}

/**
 * A graph this layer KNOWS ABOUT but does not hold.
 *
 * The owner, 2026-09-20: *"any top level repos or KGs in the repo, or
 * navigable if external/remote pointed to in the core harness schema (need to
 * extend so graphs can be url of remote graph)"*.
 *
 * ## A remote graph is NOT a directory, and that is the whole modelling
 *
 * The first cut made `ContentDirectory.path` optional and added a `url` beside
 * it. That is wrong twice over. `bean-graph.ts` and `todo-graph.ts` REUSE
 * `ContentDirectorySchema` for their own nodes — AGENTS.md says so outright,
 * *"a bean-graph entry IS a ContentDirectory"* — and a bean store is never
 * remote, so relaxing the shared schema weakened two graphs that had nothing
 * to do with the change. And a field that is sometimes a path and sometimes an
 * address is one field with two meanings, which every consumer then has to
 * guess between.
 *
 * So this is its own node kind. It has an `id` and `graphs` like a directory,
 * because those are what make it addressable and filterable; it has no `path`,
 * because there is nothing here.
 *
 * ## It is `materialization` at the graph level
 *
 * `schemas/kg/materialization-state.ts` already names the states a
 * body of content is in, and a declared graph is in the same ones: a
 * `ContentDirectory` is **materialized** (bytes here), a `RemoteGraph` is
 * **referenced** (we know it exists and where, we hold none of it).
 *
 * A reader may FOLLOW a remote graph — the KG viewer does, to keep a hierarchy
 * of named subgraphs navigable across layers that are not in this checkout.
 * Anything that wants the CONTENTS goes through `materialize-remote`: the five
 * gates and a declared purpose, rather than fetching it merely because it has
 * an address.
 */
export interface RemoteGraph extends KgNodeLabels {
  /** Stable identifier, unique within a layer — as on a directory, and for the same reason. */
  id: string;
  /** Where it is. A reader may follow this; a consumer wanting its bytes may not, without the gates. */
  url: string;
  /** Which parts of the knowledge graph live there. */
  graphTypologies: GraphTypology[];
}

/**
 * A HARNESS this layer is associated with: another layer, with its own
 * declaration, properties and graphs, that lives ELSEWHERE — its own repository
 * and its own site. Issue #1146. Owner, 2026-09-23: *"we need a good mechanism for
 * 'associated' harnessed KGs. it should be an optional list property of any
 * harness inheriting cat-harness (including itself)"*, and **not** a
 * `/folio-assistant/<name>/` publish: *"certainly not a materialized publish"*.
 *
 * ## Not a remote graph, not a dependency
 *
 * - {@link RemoteGraph} is a GRAPH known but not held: graph typologies at a URL. An
 *   associated harness is a LAYER — a declaration of its own — so it is a
 *   separate list, not a `RemoteGraph` with more fields.
 * - It is **not** `needs`: it fixes no build order, adds nothing to the overlay,
 *   resolves no skills, and nothing here is materialized. It is the fourth
 *   relation beside depends (`needs`), references (`remoteGraphs`) and utilizes
 *   (`dependencies`): **associated** — "this harness knows that one, and where".
 *
 * Rendering one needs no network: the config panel draws these fields as
 * declared, marked remote. `url` is where a reader goes; `repository` is where
 * its ✎ points (never this checkout's `origin`).
 */
export interface AssociatedHarness {
  /** The associated harness's layer name, as ITS declaration gives it. Unique within this list. */
  name: string;
  /** Human title, as its declaration gives it. */
  title?: string;
  /** Where a reader goes: the harness's own published site. */
  url: string;
  /** Its source repository, where edits to it are made. */
  repository?: string;
  /** Its declaration file, when published at a stable URL. */
  declarationUrl?: string;
  /** How it relates to this harness, in a few words: e.g. `folio-of` (a folio on this platform). */
  relation?: string;
  /** One sentence a reader of the panel sees. */
  note?: string;
}

/** The `name` grammar layer names already follow: lowercase, digits, hyphens. */
const INSTANCE_NAME = /^[a-z0-9][a-z0-9-]*$/;

export const AssociatedHarnessSchema = z
  .object({
    name: z.string().regex(INSTANCE_NAME),
    title: z.string().min(1).optional(),
    url: z.string().url(),
    repository: z.string().url().optional(),
    declarationUrl: z.string().url().optional(),
    relation: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
  })
  // STRICT for the reason RemoteGraphSchema is: the declaration is parsed by a
  // plain z.object that drops unknown keys, and a misspelt `repo` would vanish
  // without a word and leave ✎ pointing nowhere.
  .strict();

/**
 * A SUBSCRIPTION to an external Knowledge Graph — a **substrate**: a repository
 * whose root declaration meets bootstrap's schema requirements and declares at
 * least one harness. Issue #1719; the design is
 * `docs/proposals/kg-subscriptions.md`.
 *
 * ## Between `associatedHarnesses` and `needs`, and it MOVES
 *
 * `needs` is fully loaded, with order, overlay and skill resolution.
 * `associatedHarnesses` is never loaded. A subscription starts referenced and
 * becomes materialised one part at a time, as the subscriber chooses. So this
 * entry holds only the CHOICE and the PIN. Whether a chosen part is actually
 * held is answered by that part's `MaterializationSchema` record, the one
 * place that already answers "do we hold these bytes". Recording state here
 * too would give two answers to that question.
 *
 * `ref` is a 40-character SHA and required, the rule `sync-remote-skills`
 * already enforces. An unpinned subscription is how two subscribers see two
 * graphs under one name. A subgraph not listed is REFERENCED, not absent.
 */
export interface Subscription {
  /** Local name for the subscription; unique within this list. The substrate's own name, unless two pins of one substrate are ever needed. */
  id: string;
  /** Where the substrate lives, `owner/repo` (#1652). */
  repository: RepoFullName;
  /** The pinned commit, a full 40-character SHA. A tag replaces it once the substrate publishes releases. */
  ref: string;
  /** The repository-relative directory holding the substrate's declaration; absent: the root. See {@link SubscriptionSchema}. */
  upstreamPath?: string;
  /** `content` for a Knowledge Graph with Subgraphs and no harness (owner, 2026-10-06); absent: `substrate`. See {@link SubscriptionSchema}. */
  kind?: SubscriptionKind;
  /** Subgraph ids (the substrate's `directories[].id`) CHOSEN for materialisation. Everything else stays referenced. */
  subgraphs?: string[];
  /** How referenced binary assets are materialised. Each copy still passes `Process_MaterializeRemote`'s gates. */
  assets?: { policy: "none" | "on-demand" | "all" };
  /** Harness names from the substrate CHOSEN for instantiation. Instantiating writes `<name>.config.json`, which is what puts it in the navbar. */
  harnesses?: string[];
  /** One sentence a reader of the visualizer sees. */
  note?: string;
}

const uniqueStrings = (label: string) =>
  z
    .array(z.string().min(1))
    .refine((xs) => new Set(xs).size === xs.length, { message: `${label}: a value appears twice` });

export const SubscriptionSchema = z
  .object({
    id: z.string().regex(INSTANCE_NAME),
    repository: RepoFullNameSchema,
    // A full SHA, and only that. A branch name moves under the subscriber;
    // an abbreviated SHA is ambiguous by definition.
    ref: z.string().regex(/^[0-9a-f]{40}$/, "ref must be a full 40-character commit SHA — pin, never follow a branch"),
    /**
     * The repository-relative DIRECTORY holding the substrate's declaration,
     * when that is not the root — `shared` for a fork whose declaration
     * is `shared/<name>.json` (bean `437w`). Absent: the root. The
     * same name and meaning as `upstreamPath` on a remote subgraph source
     * (`schemas/kg/subgraph-source.ts`, PR #2326), so one word means one thing
     * across both, and the same pattern (a trailing slash is admitted and
     * means nothing). Recorded so `kg:subscribe:check` and a re-subscribe judge
     * the same subtree that was judged the first time.
     */
    upstreamPath: z
      .string()
      .regex(/^[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*\/?$/, "a repository-relative path, no dot-prefixed segment")
      .refine((p) => !p.split("/").includes(".."), "may not climb with `..`")
      .optional(),
    /**
     * What kind of Knowledge Graph this subscribes to — `substrate` (absent)
     * or `content` (owner, 2026-10-06): a declaration with Subgraphs and NO
     * harness, such as a FHIR IG. Bootstrap's definition of a substrate is
     * unchanged; a content subscription is a separate kind, written
     * explicitly, and contributes no skills, processes or roles — so it may
     * choose no `harnesses`. `SUBSCRIPTION_KINDS` in
     * `schemas/kg/substrate-snapshot.ts` carries the rule once.
     */
    kind: SubscriptionKindSchema.optional(),
    subgraphs: uniqueStrings("subgraphs").optional(),
    assets: z.object({ policy: z.enum(["none", "on-demand", "all"]) }).strict().optional(),
    harnesses: z.array(z.string().regex(INSTANCE_NAME)).refine((xs) => new Set(xs).size === xs.length, { message: "harnesses: a name appears twice" }).optional(),
    note: z.string().min(1).optional(),
  })
  // STRICT for the reason AssociatedHarnessSchema is: a misspelt `subgraph`
  // would be dropped without a word, and the subscriber would believe it had
  // chosen something it had not.
  .strict()
  .superRefine((s, ctx) => {
    if (s.kind === "content" && s.harnesses?.length) {
      ctx.addIssue({
        code: "custom",
        path: ["harnesses"],
        message: "a `content` subscription chooses no harness: a content Knowledge Graph declares none, and contributes no skills, processes or roles",
      });
    }
  });

/**
 * A substrate this harness knows of that NO declaration in the checkout names.
 * Issue #1719, owner: *"cat-harness should list known substrates now and as
 * part of separation plans."*
 *
 * **Hand-entered only where no fact already exists.** Every staged layer
 * already declares its planned `repository` (#1652), and every associated
 * harness its `repository`, so the registry DERIVES those rows. Listing them
 * again here would be a second copy of a fact, free to drift. This list is for
 * the rest: a proposed substrate with no layer yet (the WHO World Health
 * Data Hub), or a status only a person knows (a repository created today).
 * `scripts/subscriptions-viz.ts` merges the two, and a hand row overrides a
 * derived one by `name`.
 */
export interface KnownSubstrate {
  /** The substrate's layer name, as its declaration gives it or will. */
  name: string;
  /** Human title. */
  title?: string;
  /** `owner/repo`, when one exists or is planned. */
  repository?: RepoFullName;
  /** Where it stands: proposed (an idea), planned (a staged layer), exists (a repository), published (a release). */
  status: "proposed" | "planned" | "exists" | "published";
  /** Its paired tools repository, when the `kg-separation` pattern gives it one. */
  toolsRepository?: RepoFullName;
  /** One sentence a reader of the visualizer sees. */
  note?: string;
}

export const KnownSubstrateSchema = z
  .object({
    name: z.string().regex(INSTANCE_NAME),
    title: z.string().min(1).optional(),
    repository: RepoFullNameSchema.optional(),
    status: z.enum(["proposed", "planned", "exists", "published"]),
    toolsRepository: RepoFullNameSchema.optional(),
    note: z.string().min(1).optional(),
  })
  .strict();

export const RemoteGraphSchema = z
  .object({
    id: z.string().min(1),
    url: z.string().url(),
    graphTypologies: z.array(z.string().min(1)).min(1),
    ...kgNodeLabelShape,
  })
  // STRICT, and that is the point rather than tidiness: without it a stray
  // `path` on a remote graph is silently accepted, and the declaration then
  // carries two answers to where the graph is — the exact confusion this node
  // kind exists to prevent. Caught by its own test on the hour it was written.
  .strict();

/**
 * The local path of a declared directory, or `undefined` when the graph is
 * REMOTE.
 *
 * Every consumer that needs bytes on disk goes through this, so "this graph is
 * not in this checkout" is a case each one has to answer rather than a
 * `string` it can assume. When `url` landed on 2026-09-20 the compiler named
 * the whole set in nine errors across six files — which is the set that had
 * been assuming a local path all along, and the reason `path` was made
 * optional rather than widened to hold a URL. A field that is sometimes a path
 * and sometimes an address is one field with two meanings, and every consumer
 * then has to guess which it got.
 */

/**
 * What a {@link RenderExemption} may excuse a layer from.
 *
 * Two entries, because the owner named two and they fail differently: a
 * subgraph nobody can look at, and a process nobody can look at. Closed, so a
 * declaration cannot excuse itself from an obligation nobody has defined.
 */
export const RENDER_OBLIGATIONS = [
  "visualiser",
  "workflow-visualiser",
  /**
   * The layer's OWN `docs/` — its source documentation, at
   * `<instance>/docs/`, as against a handler's rendering of it.
   *
   * Added 2026-09-21 for bean `op30`, and it reuses this mechanism rather than
   * minting a second opt-out because the requirements are identical: an
   * exemption needs a REASON, and a reason with no substitute is a hole. The
   * `owes` field already refuses the hole.
   */
  "own-docs",
] as const;
export type RenderObligation = (typeof RENDER_OBLIGATIONS)[number];

/**
 * A layer's declared exemption from the rendering obligations, with a
 * reason and a substitute.
 *
 * ## The rule this encodes is a FLOOR THAT RISES, not a flat requirement
 *
 * [`cat-harness-minimum`](../docs/architecture/cat-harness-minimum.md) carries
 * *"if it produces something a human looks at, it is not the harness"*, and
 * the same architecture states that a layer renders by default. Read
 * flatly the two cannot both hold. The owner settled it on 2026-09-20: the
 * requirement **starts** at `cat-harness` rather than applying uniformly.
 *
 * | layer | visualiser | its own `.json` / `.jsonld` |
 * |---|---|---|
 * | `bootstrap` | **exempt** — it is the navbar FOOTER | **required** |
 * | `cat-harness` | required | required |
 * | everything above | required | required |
 *
 * `cat-harness` is where the rest begins to apply for an obligation rather
 * than a convention: it is what supplies the layers above with `folio/`, and a
 * layer that hands its dependents a folio and renders nothing itself is asking
 * of them what it did not do.
 *
 * ## Why `owes` is REQUIRED, when it could have been prose in a doc
 *
 * Because an exemption with no substitute is a hole, and a list of holes with
 * no substitutes is a silence list — which is exactly what `2krx` says an
 * opt-out must not become: *"an opt-out needs a REASON per entry … or it
 * becomes a silence list."* bootstrap does not simply drop out of the
 * requirement; in the owner's words its `.json`/`.jsonld` *"is its
 * existence"*, so it trades a criterion it could fail quietly for one it
 * cannot. `owes` is where that trade is written down, and
 * {@link renderExemptionProblems} refuses an empty one.
 *
 * ## Declared locally, validated globally
 *
 * The declaration is local because only the layer knows why. The guard
 * against the exemption SPREADING is not — {@link renderExemptionProblems}
 * takes the count of claimants across the repository, because "only the bottom
 * layer may claim this" is a fact about the stack and cannot be seen from one
 * file. A second claimant is a finding rather than a silent widening: that is
 * the failure mode a self-declared exemption otherwise has, and it is the
 * reason this is not simply a boolean.
 */
export interface RenderExemption {
  /** Which obligations are excused. Non-empty. */
  of: RenderObligation[];
  /** Why this layer is the exception. Prose, and required. */
  reason: string;
  /**
   * What it carries INSTEAD — the criterion it cannot fail quietly.
   *
   * Required. An exemption whose substitute is unstated is indistinguishable
   * from a layer that simply never got round to rendering.
   */
  owes: string;
  /**
   * Where the layer IS reachable, since it renders nothing of its own.
   *
   * One of the layer's OWN files, relative to its own directory and
   * inside it — e.g. `README.md`. The site build publishes the layer's
   * files at `<base>/<stub>/` (`publish-instance-files.ts`), rendering `.md`
   * as `.html`, and the tab links there.
   *
   * It was repository-relative, under the site-owning harness's site
   * directory, until 2026-09-23. That made bootstrap, the floor of the stack,
   * point at a page in the layer above it. Owner (bean iwtn): *"bootstrap is
   * bootstrap"*.
   *
   * ## Why an exemption needs this at all
   *
   * `owes` says what the layer carries instead; it does not say where a
   * READER goes. Those came apart on the navbar: bootstrap is instantiated
   * and correctly has no viewer, so `harness-tiles` found no href and
   * `nav_footer_custom.html` rendered its tab as a greyed `<span>`. The
   * owner, 2026-09-21: *"Boostrap should be clicable. even though it doesnt
   * render itself, cat-bootrap does take over ... render responsibles of
   * bootrstraps json(ld) and documentation."*
   *
   * So the exemption said "I do not render myself" without saying "so go
   * here instead", and `pb04`'s rule — a tab with nowhere to go is not a
   * link — correctly produced a dead tab from a correct declaration. This
   * field is the missing half.
   *
   * ## Optional, and absent is a real state
   *
   * An exempt layer with nothing published about it anywhere has no
   * honest target, and a link invented for it would 404. Absent leaves the
   * tab unlinked, which is what it should be in that case.
   *
   * Consumers MUST check the file exists before linking — a declared path
   * that does not resolve is `flh4`'s defect, and it is a different finding
   * from "nothing is published".
   */
  reachableAt?: string;
}

export const RenderExemptionSchema = z.object({
  of: z.array(z.enum(RENDER_OBLIGATIONS)).min(1),
  reason: z.string().min(1),
  owes: z.string().min(1),
  reachableAt: z.string().min(1).optional(),
});

/**
 * Is this layer excused from `obligation`?
 *
 * The predicate the `2krx` axis calls before raising a no-visualiser finding,
 * so the exemption is read from the declaration rather than from a hardcoded
 * layer name in the checker. A name literal would make the rule true only
 * for the one layer somebody remembered.
 */
export function isExemptFrom(
  d: Pick<CatHarnessDeclaration, "renderExemption">,
  obligation: RenderObligation,
): boolean {
  return d.renderExemption?.of.includes(obligation) ?? false;
}

/**
 * Everything wrong with the exemptions declared across a repository.
 *
 * Empty means every claim is well-formed AND there is at most one claimant.
 * Takes the whole set rather than one declaration for the reason
 * {@link RenderExemption} gives: the shape being guarded is a stack, and a
 * second claimant cannot be seen from the first one's file.
 *
 * **At most one, not exactly one.** A repository that vendors no bootstrap
 * has nothing to exempt, and failing it for that would be asking it to declare
 * something to stay green — which is how a declaration stops meaning anything.
 */
export function renderExemptionProblems(
  claimants: ReadonlyArray<{ name: string; renderExemption?: RenderExemption }>,
): string[] {
  const problems: string[] = [];
  const claiming = claimants.filter((c) => c.renderExemption !== undefined);
  for (const c of claiming) {
    const parsed = RenderExemptionSchema.safeParse(c.renderExemption);
    if (!parsed.success) {
      problems.push(
        `${c.name}: renderExemption is malformed — ${parsed.error.issues
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ")}`,
      );
    }
  }
  if (claiming.length > 1) {
    problems.push(
      `${claiming.length} instances claim a renderExemption (${claiming
        .map((c) => c.name)
        .sort()
        .join(", ")}) — the exemption is the BOTTOM of the stack and there is ` +
        `one bottom. A second claimant is the requirement spreading upward, ` +
        `which is what this refuses to do quietly.`,
    );
  }
  return problems;
}

/**
 * The navbar icon row — WHICH icons, declared per layer.
 *
 * Owner, 2026-09-22: *"[x] should be on the navbar w/ other icons, can make
 * two lines avatar+name of harness/catalogue/sub-grrraph as approrirate, the
 * second line are the icons. max is 6"*, and then, on where the list lives:
 * *"should be in each harness config which are shown (so some could show
 * none, but make this default in cat-harness that is inherited)."*
 *
 * ## A CLOSED set, not free strings
 *
 * Each id is an affordance the navbar knows how to render and where to point.
 * A free string would let a layer name an icon nothing draws, and the
 * failure would be a silent gap in a row capped at six — `pb04` one layer up
 * from a dead link: a slot that renders nothing reads as a navbar that lost
 * something.
 *
 * ## SEVEN, and the cap is the owner's
 *
 * It was six until 2026-10-02, when the owner added fsh-guts to the row
 * rather than in place of anything: *"i wanted fsh guts icon here with the
 * others"* (#1925). The cap moved with the ruling; it is still a cap.
 *
 * 2026-10-05: cat-harness's own row dropped `processes` and `kg` (owner). A
 * row globe was tried and taken out the same day: the owner kept ONE globe,
 * the locale toggle in the glass band (#2211).
 *
 * Refused rather than truncated. Truncating drops whichever the layer
 * listed last, silently, and a layer that declared seven has made a
 * decision the navbar would then be overruling without saying so.
 */
export const NAVBAR_ICONS = ["close", "todos", "beans", "processes", "kg", "fsh-guts", "launcher", "qr"] as const;

export type NavbarIcon = (typeof NAVBAR_ICONS)[number];

export const NavbarIconsSchema = z
  .array(z.enum(NAVBAR_ICONS))
  .max(8, { message: "the navbar icon row holds at most 8 — the owner's cap" })
  .refine((xs) => new Set(xs).size === xs.length, {
    message: "an icon listed twice is two slots doing one job",
  });

/**
 * The glass's bottom strip — WHICH tiles are pinned to it, and in what order.
 *
 * Owner, 2026-10-01, ruling on bean `ob3m` finding 10, option 1 of 4:
 * **"Pinned tiles first, plus '+N more'"** — the strip shows Todos, Settings
 * and a few key kinds (library, processes, tools, skills), then one "+N more"
 * tile that opens the full grid. *No tile may be silently off-screen.*
 *
 * ## Declared here, not hard-coded per surface
 *
 * The pinned set is a property of the layer, inherited like
 * {@link NavbarIconsSchema} (absent inherits, `[]` pins nothing), so a folio
 * that wants a different strip says so in its own declaration rather than in
 * `docs-ui.js`.
 *
 * ## Two kinds of pin, because there are two kinds of tile
 *
 * - `{ "chrome": … }` — one of the glass's OWN controls ({@link GLASS_CHROME}),
 *   which belong to no graph. A closed set: a free string could name a control
 *   nothing draws.
 * - `{ "kind": … }` — a graph TYPOLOGY. It resolves to ONE tile, the first glass
 *   tile whose directory holds that kind (`resolveGlassStrip` in
 *   `scripts/graph-tiles.ts`), so a kind several harnesses publish gets one
 *   slot on the strip and the rest wait in More with their qualifiers.
 *   A kind is pinned rather than a tile id because ids are per-instance and a
 *   kind is what the owner named.
 *
 * Neither is an ORDER the strip must fit. The strip shows as many as fit, in
 * this order, and the "+N more" tile counts the rest.
 */
export const GLASS_CHROME = ["todos", "filter", "settings"] as const;

export type GlassChrome = (typeof GLASS_CHROME)[number];

export const GlassStripPinSchema = z.union([
  z.object({ chrome: z.enum(GLASS_CHROME) }).strict(),
  z.object({ kind: z.string().min(1) }).strict(),
]);

export type GlassStripPin = z.infer<typeof GlassStripPinSchema>;

export const GlassStripSchema = z
  .array(GlassStripPinSchema)
  .refine((xs) => new Set(xs.map((x) => JSON.stringify(x))).size === xs.length, {
    message: "a pin listed twice is two slots doing one job",
  });

/**
 * Which icons a layer's navbar row shows, after inheritance.
 *
 * Owner: *"should be in each harness config which are shown (so some could
 * show none, but make this default in cat-harness that is inherited)."*
 *
 * ## The walk is `needs`, because that is the inheritance this repo already has
 *
 * Nearest declaration wins: the layer itself, then its `needs` chain toward
 * the foundation, breadth-first so a nearer layer beats a deeper one. It is
 * the same direction `resolveSkillDirs` composes and the same spine `builtOn`
 * documents — a second traversal would be a second answer to "what is this
 * instance built on", free to disagree with the first.
 *
 * ## `[]` STOPS the walk; absent continues it
 *
 * A layer that declares `[]` has said "show none", and inheriting over
 * that would overrule a decision it made. A layer that declares nothing
 * has said nothing. The two are different answers and this function must not
 * turn one into the other — which is why the guard is `!== undefined` rather
 * than a truthiness test, the shape that collapses exactly this distinction.
 *
 * ## `undefined` is the THIRD state and callers must not render it as none
 *
 * Returned when neither the layer nor anything it needs has decided, and
 * `floor` has not either. "Nobody has said" is not "nothing to show": a caller
 * that draws an empty row for it reports an un-migrated layer as a
 * deliberate one. Report it.
 *
 * @param name the layer to resolve
 * @param declared every layer's own value, keyed by name — absent key and
 *   `undefined` value both mean "did not declare"
 * @param needs each layer's dependency names
 * @param floor the layer whose list is the default when nothing else has
 *   decided; `cat-harness` here, passed rather than named so this function
 *   does not know which repository it is in
 */
export function resolveNavbarIcons(
  name: string,
  declared: ReadonlyMap<string, readonly NavbarIcon[] | undefined>,
  needs: ReadonlyMap<string, readonly string[] | undefined>,
  floor?: string,
): readonly NavbarIcon[] | undefined {
  return resolveInherited(name, declared, needs, floor);
}

/**
 * The walk {@link resolveNavbarIcons} documents, for ANY inherited list.
 *
 * Split out when `glassStrip` became the second property inherited the same
 * way (bean `ob3m` finding 10). A second copy of the walk would be a second
 * answer to "what is this instance built on", which is the drift the doc
 * above warns about.
 */
export function resolveInherited<T>(
  name: string,
  declared: ReadonlyMap<string, T | undefined>,
  needs: ReadonlyMap<string, readonly string[] | undefined>,
  floor?: string,
): T | undefined {
  const seen = new Set<string>();
  const queue: string[] = [name];
  while (queue.length > 0) {
    const at = queue.shift()!;
    // A `needs` cycle is somebody else's finding — `check:harness-dirs` and the
    // dependency order own it. Here it must simply not hang.
    if (seen.has(at)) continue;
    seen.add(at);
    const own = declared.get(at);
    if (own !== undefined) return own;
    for (const n of needs.get(at) ?? []) queue.push(n);
  }
  if (floor !== undefined && !seen.has(floor)) {
    const f = declared.get(floor);
    if (f !== undefined) return f;
  }
  return undefined;
}

/**
 * An EXACT semver version. Ranges are refused.
 *
 * Rule 2 of `cat-harness/docs/proposals/instance-versioning.md` §2, and the one that
 * matters most: **FHIR pins exact versions and has no way to express a range**,
 * so a downstream that must align to FHIR cannot be handed `^1.2.0`. The
 * constraint is alignment, and alignment is not a preference here — the owner
 * called it a hard constraint on 2026-09-20 because some layers are
 * consumed from outside this monorepo.
 *
 * `current` and `dev` are FHIR's pseudo-versions for "the latest CI build"
 * (rule 3). They are deliberately accepted HERE and barred from the published
 * tier by `check:published-refs`, which is the same line §3.3 draws for a SHA:
 * a staging reference is fine in a checkout and unresolvable to an external
 * consumer.
 *
 * ## It lives HERE, and is re-exported from `harness-config`
 *
 * Two fields carry this rule — a declaration's own `version` (§3.2) and a
 * dependency's `version` (§3.3) — and they are in two modules. `harness-config`
 * imports this one, so the constraint is defined in the lower of the two and
 * re-exported from the upper. Defining it twice would make "no ranges" a rule
 * that holds on whichever half somebody remembered.
 */
export const ExactVersionSchema = z
  .string()
  .min(1)
  .refine(
    (v) =>
      v === "current" ||
      v === "dev" ||
      /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(v),
    {
      message:
        "an exact semver version, `current` or `dev` — ranges (^, ~, >=, *, ||, x) cannot be expressed in FHIR's dependsOn and are refused",
    },
  );


/**
 * The `$schema` a layer declaration carries: `cat-harness-declaration/1.0.0`.
 *
 * Bean `ujiv` (issue #88). A declaration is a node kind like any other file
 * that says what it is, but it sits in no typology directory — it is found by
 * its NAME, `<instance>/<instance>.json` — so the node-kind index reaches it
 * through a name rule rather than a typology (`node-kind-index.ts`).
 */
export const CAT_HARNESS_DECLARATION_SCHEMA_TAG = "cat-harness-declaration/1.0.0" as const;

/** The declaration's fields, shared by {@link CatHarnessDeclarationSchema} and {@link CatHarnessDeclarationKind}. */
/**
 * The steps and check scripts a repository's CI runs that the local gate set
 * does not, each with its reason — read by the tools layer's `gates.ts`
 * (beans `0r7u`, `ot9a`).
 *
 * Declared by whoever OWNS what is exempted: a layer for its own scripts
 * and steps (`gateExemptions` on its declaration), and an index for the steps
 * of its own workflows (`gateExemptions` in `index.config.json`). An index
 * declares no layer, so before this its workflow steps were exempted from
 * a layer's declaration instead, AHEAD of the workflow change — and a layer
 * re-pinned before the workflow landed carried an exemption that matched
 * nothing CI ran (`qa:publish --add`, 2026-10-14).
 */
export const GateExemptionsSchema = z
  .object({
    steps: z
      .array(
        z
          .object({
            match: z.string().min(1),
            kind: z.enum(["covered-by", "ci-only", "no-folio"]),
            reason: z.string().trim().min(1),
          })
          .strict(),
      )
      .optional(),
    scripts: z
      .array(
        z
          .object({
            script: z.string().min(1),
            kind: z.enum(["report", "covered-by", "no-folio", "scheduled", "pending-baseline"]),
            reason: z.string().trim().min(1),
            // `pending-baseline` only (owner, 2026-11-07, "A. Two steps"): the
            // writer CI runs now, and the follow-up that wires the check.
            writer: z.string().min(1).optional(),
            followUp: z.string().trim().min(1).optional(),
          })
          .strict()
          .refine(
            (e) =>
              e.kind === "pending-baseline"
                ? e.writer !== undefined && e.followUp !== undefined
                : e.writer === undefined && e.followUp === undefined,
            { message: "a `pending-baseline` exemption names its `writer` and its `followUp`, and no other kind does" },
          ),
      )
      .optional(),
    files: z
      .array(
        z
          .object({
            gate: z.string().min(1),
            file: z
              .string()
              .min(1)
              .refine((f) => !f.startsWith("/") && !f.split("/").includes(".."), "relative to the declaring instance's root, inside it"),
            reason: z.string().trim().min(1),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

/** One entry of a declaration's `moves` — see that field. */
export const DeclaredMoveSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "a date, `YYYY-MM-DD`"),
    because: z.string().min(1).optional(),
  })
  .strict();
export type DeclaredMove = z.infer<typeof DeclaredMoveSchema>;

const catHarnessDeclarationShape = {
  name: z.string().min(1),
  ...kgNodeLabelShape,
  /**
   * One line for a READER, where `description` is written for an author.
   *
   * `ob3m` findings 4 and 5: the landing's harness sections printed the
   * declaration's `description`, which here is authoring text — a naming
   * rationale in one layer, a run of alternative spellings in another.
   * The landing shows this instead when it is present, and the description
   * when it is not, so an undeclared summary is today's behaviour.
   */
  summary: z.string().min(1).optional(),
  /**
   * Other ways the layer's name is written, shown on the landing as a small
   * "also written" list rather than run into the description as one line.
   * Owner's choice, 2026-10-01: keep the spellings visible, as a list.
   */
  alsoWritten: z.array(z.string().min(1)).nonempty().optional(),
  /**
   * The namespace this layer's skills take when they are INSTALLED into an
   * agent host (Claude Code, Antigravity, …): a skill `todo-manager` installs
   * as `<skillPrefix>-todo-manager`, so two harnesses' skills, or a harness's
   * and the host's own, cannot collide.
   *
   * Owner ruling 2026-10-10 (bean `x4mt`, issue #247): the prefix is applied
   * **at install** — nothing in the repository is renamed, so manifests, BPMN
   * `folio:skill` refs and cross-references keep the bare name — and it is
   * **per harness**, declared here (`cat` for cat-harness, `fa` for
   * folio-assistant), not one global `fa-`. The install layer reads it; a
   * layer that declares none takes the prefix of the harness it is
   * installed from.
   *
   * Lowercase letters and digits, starting with a letter: it becomes part of
   * a directory name and a skill `name`, which hosts restrict to that set.
   */
  skillPrefix: z.string().regex(/^[a-z][a-z0-9]*$/).optional(),
  /**
   * The layer's mark — the same shape a kind node carries (bean sod4 #4).
   * It sat in `schemas/content/avatars.ts`'s AVATARS beside the kinds' until
   * 2026-10-05, so a new layer needed an edit to cat-harness to get a face;
   * declared here, it brings its own. `avatarFor(name)` reads it.
   */
  avatar: KindAvatarSchema.optional(),
  images: z.array(KgImageSchema).optional(),
  /**
   * Declared non-image artefacts — `AGENTS.md` first among them.
   *
   * Optional, and absent is the unmigrated case rather than "this instance
   * has none": every layer has an `AGENTS.md`, and until one declares it
   * nothing can check it. See {@link KgAssetSchema}.
   */
  assets: z.array(KgAssetSchema).optional(),
  icon: z.string().min(1).optional(),
  /**
   * Which icons this layer's navbar row shows.
   *
   * THREE STATES, and the third is the point. **Absent** means *inherit* —
   * this layer has not decided, and the answer comes from its dependency
   * stack with `cat-harness`'s list as the floor. **`[]`** means *show none*,
   * which the owner asked for by name (*"some could show none"*). **A list**
   * is this layer's own answer and overrides what it inherits.
   *
   * Absent and `[]` must not collapse into each other. They are the same
   * failure `renderExemption` and the graph-typology declarations already guard:
   * "nobody has said" rendered as "nothing to show" is a decision nobody made,
   * and here it would make an un-migrated layer indistinguishable from one
   * that deliberately wants a bare navbar.
   */
  navbarIcons: NavbarIconsSchema.optional(),
  /**
   * Which tiles the glass's bottom strip pins, in order — see
   * {@link GlassStripSchema}. Same three states as `navbarIcons`: absent
   * inherits, `[]` pins nothing, a list is this layer's own answer.
   */
  glassStrip: GlassStripSchema.optional(),
  repository: RepoFullNameSchema.optional(),
  livesAt: InstanceLocationSchema.optional(),
  /**
   * Where this whole layer gets its upstream/source material (e.g. an IG source in Git).
   * Bean `bamf`, owner ruling 2026-10-07: declare IG source in layer declaration.
   */
  source: InstanceSourceSchema.optional(),
  /**
   * Which half of a kg-separation pair this layer's planned `repository`
   * is: `content` (files to read — no code, bootstrap FR-7) or `tools` (the
   * code that writes and checks a content repository).
   *
   * Optional, and absent is "has not said", never "not content": most staged
   * layers here have not been through the split, and a default would claim
   * a decision nobody made. Added 2026-09-30 (bean `eayu`) because the IRIS replica is
   * staged as a CONTENT repository with no tools repository authorised, so
   * nothing else in the tree says it must hold no code; kg:audit's
   * `content-instance-holds-code` reads it. A layer a declared tools
   * layer `supports` is content too, and is read as such without this.
   */
  separation: z.enum(["content", "tools"]).optional(),
  /**
   * Layers this one is SEEDED TOGETHER with: the same seeding step creates
   * both repositories, so neither ever stands alone in a checkout (bean
   * `smbc` seeds `cat-harness` and its tools layer at once).
   *
   * Declared by the HIGHER layer, naming the lower one, because a lower
   * layer naming one above it is the wrong direction
   * (`check:reference-direction`). `seed:ready` reads it: a path declared in
   * a lower layer that resolves only into a layer seeding with it is
   * not "upward" — it cannot break on a seeding day that creates both.
   * Owner, 2026-10-04: cat-harness's Tool nodes resolving into
   * the tools layer are a seeding pair, not a seeding risk.
   *
   * Absent means "seeds alone", which is the strict reading.
   */
  seedsWith: z.array(z.string().min(1)).optional(),
  stub: z.string().min(1).optional(),
  /**
   * Whether this layer is PUBLISHED on the site — served at
   * `<base>/<name>/…` (`schemas/kg/url-space.ts`, bean `nbal`). Defaults to
   * enabled (owner, 2026-09-20: *"instantiated and enabled (by default
   * enabled)"*), so not publishing is a declaration, `false`, never an
   * absence. Read it through `isPublished`.
   */
  enabled: z.boolean().optional(),
  canonicalUrl: z.string().url().optional(),
  /**
   * The address this layer's IRIs are minted under, BEFORE the version —
   * bootstrap's `iriBase` (see `graph.ts`), and the one place a fork edits.
   *
   * Not `canonicalUrl`, and the difference is the version. `canonicalUrl`
   * says where documents are PUBLISHED, and `kg-export` mints a document's
   * `@id` from it; `iriBase` says what the vocabulary's identifiers ARE, and
   * those carry the release's MAJOR: `<iriBase>v<major>/…`, for anything an
   * agent reads (namespaces, schema `$id`s) and for pages a person reads alike
   * (owner, 2026-10-23; the exact release is the pin's). `releaseIris` in
   * `bootstrap-tools/schemas/release-iri.ts` composes it; `iri:sync` keeps
   * every literal copy at the declared major.
   */
  iriBase: z.string().url().optional(),
  /**
   * The layer's Node Kinds, declared: each `$schema` tag its files may
   * carry → the JSON Schema that defines it (an IRI, or a path relative to
   * the declaration). Bootstrap's field (`graph.ts`, owner 2026-09-29: the
   * schema-reference table "should be in bootstrap"), inherited here because
   * this declaration is a Subkind of bootstrap's. The graph-typology registry's
   * `nodeSchemas` keeps the harness's TypeScript-backed forms (`validator`,
   * `shape`); this one names only published schemas, which is all a reader
   * with nothing installed can follow.
   */
  nodeSchemas: z.record(z.string().min(1), z.string().min(1)).optional(),
  previewUrl: z.string().url().optional(),
  publication: PublicationSchema.optional(),
  topology: TopologySchema.optional(),
  directories: z.array(ContentDirectorySchema).default([]),
  /**
   * The visualisers this harness declares — see {@link HarnessVisualiserSchema}.
   * Each is published at `<base>/<name>/<id>/` and nowhere else; ids are unique
   * and every `covers` entry names a directory declared above (refined below).
   * `.optional()`: absent means this layer declares none.
   */
  visualisers: z.array(HarnessVisualiserSchema).optional(),
  /** See {@link CatHarnessDeclaration.builtAtPublish} and `schemas/kg/built-at-publish.ts`. Absent: this layer builds nothing at publish. */
  builtAtPublish: BuiltAtPublishListSchema.optional(),
  /** See {@link CatHarnessDeclaration.jsonldPrefixes} and `schemas/kg/jsonld-prefixes.ts`. Absent: this layer speaks no external vocabulary of its own. */
  jsonldPrefixes: JsonldPrefixTableSchema.optional(),
  /**
   * Graphs this layer knows about and does not hold — see {@link RemoteGraph}.
   * A SEPARATE array from `directories`, not a variant of one, because a remote
   * graph has no directory.
   */
  remoteGraphs: z.array(RemoteGraphSchema).default([]),
  /**
   * Harnesses this one is associated with — see {@link AssociatedHarness}.
   * `.optional()`, not `.default([])`: absent is "has not said", and a default
   * would make the field required in the output type of every declaration.
   * Names are unique, never also in `needs`, and never a harness in this
   * checkout (that would be local, not associated) — refined below.
   */
  associatedHarnesses: z
    .array(AssociatedHarnessSchema)
    .refine((xs) => new Set(xs.map((x) => x.name)).size === xs.length, { message: "associatedHarnesses: a name appears twice" })
    .optional(),
  /**
   * External Knowledge Graphs this one subscribes to — see {@link Subscription}.
   * `.optional()` for the reason `associatedHarnesses` is. Ids are unique, and
   * never also in `needs` or `associatedHarnesses` — refined below.
   */
  subscriptions: z
    .array(SubscriptionSchema)
    .refine((xs) => new Set(xs.map((x) => x.id)).size === xs.length, { message: "subscriptions: an id appears twice" })
    .optional(),
  /**
   * What a DOWNSTREAM mounts of this layer by default, and where — see
   * `schemas/kg/remote-mount.ts` (bean `0mpw`). Owner, 2026-10-06: the defaults
   * live in the harness's own declaration, so a downstream names only the
   * harness and its pin and never restates the paths. Absent is the stated
   * default (home path, every in-checkout directory), not "unmountable".
   */
  mountDefaults: MountDefaultsSchema.optional(),
  /**
   * Harnesses this layer REMOTE-MOUNTS — each a repository and a 40-char
   * pin, resolved transitively through the harness's `needs` (bean `0mpw`).
   * Not a submodule and not `.deps/`: the mounted directories are declared,
   * locked by tree digest, and checked by `mount:remote:check`.
   */
  remoteMounts: RemoteMountsSchema.optional(),
  /**
   * The people whose consent may authorise a remote mount of this layer's
   * `remoteMounts` (roast `1ygp` L4.2). Declared: a `trust.consent.by` not on
   * the list is refused. Absent: consent still mounts, but every such mount
   * is reported as `unverified-approver`, never as clean.
   */
  mountApprovers: z
    .array(z.string().min(1))
    .min(1)
    .refine((xs) => new Set(xs).size === xs.length, { message: "mountApprovers: a name appears twice" })
    .optional(),
  /** See {@link KnownSubstrate}. Names are unique. */
  knownSubstrates: z
    .array(KnownSubstrateSchema)
    .refine((xs) => new Set(xs.map((x) => x.name)).size === xs.length, { message: "knownSubstrates: a name appears twice" })
    .optional(),
  stickies: z.array(StickyContributionSchema).optional(),
  renderExemption: RenderExemptionSchema.optional(),
  /**
   * The layers this one is BUILT ON — its layer stack, foundation first.
   *
   * The owner, 2026-09-20, giving the spine in one sentence:
   *
   * > So bootsteap, cat harness, fa-core, f-a, from bottom to top.
   *
   * ## Why this is declared rather than computed
   *
   * The layering was real before it was written down — `bootstrap`'s
   * `renderExemption` already argues from it (*"a floor that RISES … it starts
   * at cat-harness, which is obliged because it supplies the layers above with
   * `folio/`"*) — but it lived only in prose, so every consumer that needed the
   * order had to know it. The navbar needed it and would otherwise have
   * hardcoded four names, which is the failure `hfkl` put the exemption in the
   * declaration to avoid: a rule true only for the layers somebody
   * remembered.
   *
   * ## OPTIONAL, and an absent value is UNDETERMINED rather than "needs nothing"
   *
   * Required would be a change every concurrent branch pays for — `dependents`
   * cost a sibling branch 166 failures on the merged tree four hours after it
   * was made required. And the two states are genuinely different: `[]` is a
   * layer asserting it sits on nothing, which is true of exactly one
   * layer here, while absent is nobody having said. A consumer that treated
   * absent as `[]` would place every unlabelled layer on the floor beside
   * the bootstrap.
   *
   * Names, not paths: a layer is identified by its `name` everywhere else
   * in this schema, and a path would break the moment a directory moved.
   */
  needs: z.array(z.string().min(1)).optional(),
  /**
   * The opt-in sub-graphs (`optIn: true` directory entries) this layer
   * switches on FOR ITSELF, each qualified `<instance>.<directory id>`
   * (`cat-harness.sdlc`) and naming an entry declared by this layer or
   * one in its `needs` closure. Not inherited: a layer above that wants one
   * lists it too (owner, 2026-11-03, cat-harness#991 step 23.1). The
   * development override `CAT_SUBGRAPHS` adjusts it per process.
   *
   * An id that names nothing opt-in is REFUSED, never ignored: the shape and
   * this layer's own top-level entries here, the `needs` closure and the
   * entries declared from within by `check:declaration-resolution`.
   */
  enableSubgraphs: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]*\.[^\s]+$/, "`<instance>.<directory id>`, e.g. `cat-harness.sdlc`")).optional(),
  /**
   * Paths this layer moved, each still answered for at its old place until
   * `until` (sdlc skill `two-phase-move`). A link from any layer into `from`
   * resolves as the same path under `to`, so the layers that link here can
   * switch to the new path in any order, after this layer is re-pinned.
   * Both are directory paths relative to this layer's root. Past `until`
   * the entry is no longer honoured and `check:subgraphs --check` fails on it:
   * remove it once nothing links to `from` (the report names the inbound
   * links still left).
   */
  moves: z.array(DeclaredMoveSchema).optional(),
  /**
   * What this layer's own package tasks read and write, keyed by task name
   * — the same {@link ScriptIO}-shaped facts `cat-harness-tools/scripts/task-io.ts`
   * holds for the harness's own tasks: `outputs: []` (measured to write
   * nothing, so it may run in the pool) and `inputs` (what can change the
   * answer, so `regen` may skip it on an unchanged tree; `"{tracked}"` is the
   * whole working tree). `because` keeps the measurement that justified it.
   *
   * Declared by the layer that OWNS the task, so the harness collects it
   * instead of naming a layer above itself (owner ruling 2026-10-06: "each
   * instance declares its own tasks", bean `0r7u` step 0). Absent declares
   * nothing: those tasks run alone and are never skipped, the safe default.
   */
  taskIo: z
    .record(
      z.string().min(1),
      z
        .object({
          inputs: z.array(z.string().min(1)).optional(),
          outputs: z.array(z.string().min(1)).optional(),
          writer: z.string().min(1).optional(),
          afterMerge: z.boolean().optional(),
          /**
           * The COMMITTED files this task writes, as globs: bare, relative to
           * the declaring layer, or `<instance>:<glob>` for a file in
           * another layer (a writer in a tools layer writing into the
           * content layer below it). `check:generated-writers` warns on every
           * file a glob matches that carries no generated marker
           * (litlfred/cat-harness#693, owner 2026-10-29). Unrelated to
           * `outputs`, which says only whether a CHECK writes at all.
           */
          writes: z.array(z.string().min(1)).nonempty().optional(),
          because: z.string().min(1).optional(),
        })
        .strict()
        .refine((t) => t.afterMerge !== true || t.writer !== undefined, {
          message: "`afterMerge` needs a `writer`: a repair step with nothing to run repairs nothing",
        }),
    )
    .optional(),
  gateExemptions: GateExemptionsSchema.optional(),
  /**
   * The content adapters this layer ships — see {@link ContentAdapterDeclaration}.
   *
   * Declared by the layer that OWNS the adapter, so the harness below it
   * finds them by reading declarations instead of naming a directory above
   * itself. `src/builtin-adapters.ts` held a `../<instance>/adapters/…` path
   * for each until 2026-09-30 — a variable import no static gate could see,
   * and the edge that kept this layer from lifting out on its own
   * (`check:import-direction`, bean `p11x`).
   */
  contentAdapters: z.array(ContentAdapterDeclarationSchema).optional(),
  /** See {@link CatHarnessDeclaration.lsiUnitProviders}. */
  lsiUnitProviders: z.array(LsiUnitProviderDeclarationSchema).optional(),
  contentTranslations: z.array(ContentTypeTranslationSchema).optional(),
  /** See {@link CatHarnessDeclaration.liquid}. */
  liquid: z
    .object({
      prefix: z.string().regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/, "a dotted, lower-case Liquid path").optional(),
      passThrough: z.boolean().optional(),
    })
    .strict()
    .optional(),
  /**
   * The package identity an EXTERNAL consumer depends on — reverse-DNS.
   *
   * §3.2, separate from `name` (the handle this repository resolves against)
   * and from `stub` (which names published FILES). FHIR rule 1: the id IS the
   * identity, stable forever and never reused, while the version distinguishes
   * snapshots of it.
   *
   * **HELD** pending `iwtn`'s ONE-reference design — see the interface field.
   * An id derived from one place cannot be written into 17.
   */
  id: z.string().min(1).optional(),
  /**
   * The version — an exact semver triple, `current` or `dev`. Never a range.
   *
   * §3.2, constrained by {@link ExactVersionSchema}. `canonicalUrl` already
   * plays FHIR's `uri` role and deliberately carries no version: the canonical
   * URL is stable ACROSS versions.
   *
   * **Universal, gate-enforced** — see the interface field for why this is not
   * required here: 376 fixtures. `check:publishable` is what fails a layer
   * without one.
   */
  version: ExactVersionSchema.optional(),
};

/**
 * What the refinement still checks, now that `id` and `version` are required
 * by the type and `publication` is a one-value union.
 *
 * The old refinement carried §3.1's conditional obligations in both
 * directions — id and version REQUIRED under `publishable: true` and REFUSED
 * otherwise. Both are gone: the owner's 2026-09-23 ruling makes them
 * universal, so there is nothing conditional left to express, and
 * `"published"` is refused by the literal union rather than by a check
 * somebody could relax.
 */
function refineCatHarnessDeclaration(
  d: z.infer<z.ZodObject<typeof catHarnessDeclarationShape>>,
  ctx: z.RefinementCtx,
): void {
  // The owner, 2026-10-09: one route per `(harness, visualiser)`. Two
  // entries with one id would be two pages contending for one URL, which is
  // the defect the harness-level declaration exists to make impossible; and
  // `covers` names THIS layer's directories, so an id it does not
  // declare points at nothing.
  const visIds = new Set<string>();
  const dirIds = new Set((d.directories ?? []).map((x) => x.id));
  (d.visualisers ?? []).forEach((v, i) => {
    if (visIds.has(v.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["visualisers", i, "id"],
        message: `visualiser \`${v.id}\` is declared twice: two pages would contend for <base>/${d.name}/${v.id}/`,
      });
    }
    visIds.add(v.id);
    (v.covers ?? []).forEach((c, j) => {
      if (!dirIds.has(c)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["visualisers", i, "covers", j],
          message: `visualiser \`${v.id}\` covers \`${c}\`, which this instance does not declare as a directory`,
        });
      }
    });
  });
  // cat-harness#991 step 23.1: an enable id names an opt-in sub-graph. Of
  // this layer's OWN top-level entries that is decidable here; the rest
  // (the `needs` closure, entries declared from within) is
  // `check:declaration-resolution`'s, which reads the other declarations.
  const enabled = new Set<string>();
  (d.enableSubgraphs ?? []).forEach((q, i) => {
    if (enabled.has(q)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["enableSubgraphs", i], message: `\`${q}\` is listed twice` });
    }
    enabled.add(q);
    const dot = q.indexOf(".");
    if (q.slice(0, dot) !== d.name) return;
    const own = (d.directories ?? []).find((x) => x.id === q.slice(dot + 1));
    if (own !== undefined && own.optIn !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["enableSubgraphs", i],
        message: `\`${q}\` names this instance's \`${own.id}\`, which is not an opt-in sub-graph (\`optIn: true\`): it is on everywhere and needs no enabling`,
      });
    }
  });
  // Issue #1146: an associated harness is referenced, never held. A name that
  // is also in `needs` would make it both, and the overlay would load it.
  const needs = new Set(d.needs ?? []);
  (d.associatedHarnesses ?? []).forEach((a, i) => {
    if (needs.has(a.name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["associatedHarnesses", i, "name"],
        message: `\`${a.name}\` is in \`needs\`: an associated harness is referenced, not loaded (issue #1146)`,
      });
    }
  });
  // Issue #1719: one relation per remote thing. A subscription that is also
  // in `needs` would be both loaded and chosen part by part; one that is
  // also an associated harness would be both referenced-only and consumed.
  const associated = new Set((d.associatedHarnesses ?? []).map((a) => a.name));
  (d.subscriptions ?? []).forEach((sub, i) => {
    if (needs.has(sub.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subscriptions", i, "id"],
        message: `\`${sub.id}\` is in \`needs\`: a subscription is consumed part by part, not loaded whole (issue #1719)`,
      });
    }
    if (associated.has(sub.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subscriptions", i, "id"],
        message: `\`${sub.id}\` is also in \`associatedHarnesses\`: subscribe to it OR associate it, not both (issue #1719)`,
      });
    }
  });
  // `id` and `version` are REQUIRED BY THE TYPE now, so there is nothing
  // conditional left to check about them. What replaced the old branches:
  // §3.1 refused both unless `publishable: true`, and the owner's ruling of
  // 2026-09-23 makes them universal. See
  // `skills/kg/kg-core/instance-publication.md`.
  //
  // `publication` is a literal union of one value, so `"published"` is
  // refused by the type rather than here — deliberately, because a refusal
  // in the schema cannot be switched off the way a gate can.
}

export const CatHarnessDeclarationSchema = z
  .object({
    ...catHarnessDeclarationShape,
    /**
     * What this file is: {@link CAT_HARNESS_DECLARATION_SCHEMA_TAG}, or an
     * earlier minor/patch of its major. Optional here so a declaration read
     * before it was tagged still parses; `declarations:retag:check` is what
     * fails an untagged one. Declared so a parse-and-write KEEPS it — an
     * undeclared key is dropped by the parse, which is how a tag is lost.
     */
    $schema: z
      .string()
      .refine((t) => acceptsSchemaTag({ id: "cat-harness-declaration", version: "1.0.0" }, t), {
        message: `expected \`${CAT_HARNESS_DECLARATION_SCHEMA_TAG}\`, or an earlier minor/patch of major 1`,
      })
      .optional(),
  })
  .superRefine(refineCatHarnessDeclaration);

/**
 * A layer declaration as a node kind (bean `ujiv`, issue #88): the same
 * fields and the same cross-field checks as {@link CatHarnessDeclarationSchema},
 * with `$schema` required, as every tagged kind's is.
 */
export const CatHarnessDeclarationKind = nodeKind(CAT_HARNESS_DECLARATION_SCHEMA_TAG, [], catHarnessDeclarationShape, {
  refine: refineCatHarnessDeclaration,
});

/**
 * The stem every published artefact is named with: `stub` when declared,
 * otherwise `name`.
 *
 * One function so the KG export, the schema export and any future artefact
 * cannot disagree about what this layer is called — the naming convention
 * is only worth having if it is computed in one place.
 */
export function artefactStub(d: Pick<CatHarnessDeclaration, "name" | "stub">): string {
  return d.stub ?? d.name;
}

/**
 * Where this layer's renderable site lives in the working tree:
 * `docs/<stub>/`.
 *
 * **The stub segment is the packaging for the repo split (issue #223).** Every
 * layer's pages sit under their own layer's stub, so splitting a layer out
 * is a directory move rather than a sift through a shared tree — and two
 * layers' docs can be checked out side by side without colliding, which is the
 * same job the stub already does for `<base>/<stub>.jsonld` and
 * `<base>/<stub>/` in `publishedAt` below.
 *
 * **It does not change a single published URL.** Jekyll is pointed at this
 * directory as its source root (`docs-site.yml`, `feature-staging.yml`), so
 * the site's internal layout is untouched and every
 * `litlfred.github.io/folio-assistant/...` link resolves exactly as before.
 *
 * **This is NOT the `folio` graph-typology declaration**, and it deliberately
 * stops short of it. `docs/` cannot be declared a directory of this layer
 * yet: `folio` is registered by CORE, and re-measured 2026-09-19 with the
 * entry added, `harness:dirs`, `kg:schema:check` and `docs:harness:check` all
 * throw `unknown graph typology "folio"` and 5 tests fail. What this function does
 * fix is the OTHER half of bean `x4a6` — the site root was spelled out
 * separately in `translation-index.ts`, `gen-docs-pages.ts`,
 * `gen-skill-docs.ts`, `gen-schema-docs.ts` and `translation-qa-sweep.ts`,
 * five copies free to disagree. Now one, and when the split lands it becomes
 * one line reading the declared directory instead of composing it.
 */
export function siteDir(_d: Pick<CatHarnessDeclaration, "name" | "stub">): string {
  // **Relative to the LAYER root, and that is the whole of it: `docs`.**
  //
  // This returned `docs/<stub>`, then `<stub>/docs`, and both were composing a
  // stub level into a path because the layer had no directory of its own —
  // every layer artefact and every repository artefact shared one root, so
  // the stub was the only thing keeping two layers apart.
  //
  // The move (bean `wggr`) gave the layer its own directory, and the stub
  // level stopped being something to compose: it IS the layer root. So this
  // function got SHORTER, which is the honest outcome — the layout now
  // expresses directly what the string used to encode.
  //
  // ## It takes the declaration anyway, and the parameter is deliberate
  //
  // Every caller already holds one, the signature is what ~20 call sites are
  // written against, and a layer is free to declare its site elsewhere
  // later. Dropping the parameter would make that a breaking change for a
  // saving of nothing.
  //
  // ## Both ends are measured from the SAME root now, which they were not
  //
  // `siteDirFor` reads `<root>/harness.json`, so its input is the layer
  // root; its output was `<stub>/docs`, measured from the REPOSITORY root.
  // While those were one directory nobody could see the difference. The move
  // separated them and every `join(ROOT, siteDirFor(ROOT), …)` — the shape of
  // every call site here — started composing `cat-harness/cat-harness/docs`.
  // Eighteen failures, all of them that.
  //
  // A caller that genuinely wants the repository-relative form composes it and
  // says so: `join(artefactStub(d), siteDir(d))`. There is exactly one, the
  // `.gitignore` guard, because `git check-ignore` runs at the repository root.
  return "docs";
}

/**
 * The REPOSITORY root, given a layer root.
 *
 * ## Two roots stopped being one directory
 *
 * Until the stub move (bean `wggr`) every layer artefact and every
 * repository artefact sat side by side, so `resolve(import.meta.dir, "../../..")`
 * answered both questions and nobody had to ask which one they meant. Moving
 * the layer under `<stub>/` separated them, and **every consumer that had
 * conflated the two now resolves the wrong one** — silently, because the join
 * still produces a plausible path.
 *
 * Measured on the move: 97 test failures and 11 load errors, one cause. Every
 * ENOENT named something correctly at the repository root and looked for it
 * under the layer: `.github/workflows/`, `.gitignore`, `package.json`,
 * `AGENTS.md`, `beans/`, `todos/`, `fsh-guts/`.
 *
 * ## What lives at which root, and why the split is not arbitrary
 *
 * The repository root holds what belongs to the REPOSITORY rather than to any
 * layer in it: the CI configuration that builds it, the package manifest
 * and lockfile that install it, `.gitignore`, and the stores that are never
 * overlaid — `beans/`, `todos/`, `fsh-guts/`, `bootstrap/`. That set is closed
 * by a test rather than by this comment; a repository holding two layers
 * has one of each of those and two of everything else, which is the property
 * that decides membership.
 *
 * Everything else — `skills/`, `schemas/`, `src/`, `content/`, `docs/`,
 * `tools/` — is the layer's and travels with it when the repository splits.
 *
 * ## It is `dirname`, and it is a function anyway
 *
 * One line, and worth a name for two reasons. It makes the QUESTION visible at
 * the call site: `repoRootFor(ROOT)` says "I mean the repository" where
 * `join(ROOT, "..")` says only "up one", and up-one is what the broken callers
 * were already doing by accident. And it is the single place to change if a
 * layer is ever nested deeper than one level, which `siteDir` already
 * anticipates by composing rather than hardcoding.
 *
 * It does NOT verify that the result is a repository. A caller that needs to
 * know asks for the artefact it wants and handles its absence; a check here
 * would turn "this path is not what you think" into a throw at import time in
 * tools that had nothing to do with the question.
 */
export function repoRootFor(instanceRoot: string): string {
  const abs = resolve(instanceRoot);
  const parent = join(abs, "..");
  if (basename(parent) === "worktrees" && basename(join(parent, "..")) === ".claude") {
    return resolve(parent, "../..");
  }
  return parent;
}

/**
 * The CHECKOUT a layer's repository-level files live in — `.gitmodules`,
 * `.github/`, `.claude/skills/`, the root declaration, a `scope: "repository"`
 * path — answered for the root layer too (bean `g43f`).
 *
 * ## Why {@link repoRootFor} cannot be used for these reads
 *
 * `repoRootFor` is `dirname`, so for the layer declared AT the checkout root
 * it climbs out. In the main checkout that is `/home/user`; in a Claude Code
 * worktree it is `.claude/worktrees/`, whose every child is ANOTHER session's
 * checkout. Measured 2026-10-03: twenty-odd readers composed
 * `join(repoRootFor(root), …)` and were safe only because their callers passed
 * a nested layer. Given the root layer they read a directory that is not
 * there — `.claude/skills` read as empty, a root declaration read as absent —
 * which is `dh4f`: a clean run over nothing.
 *
 * ## The rule is git's own marker, read from the filesystem
 *
 * - `instanceRoot` holds its own `.git` (a directory for a clone, a FILE for a
 *   worktree) and its parent's `.gitmodules` does not name it — it IS a
 *   checkout ({@link isForeignCheckout} from the parent's side): answer itself.
 * - otherwise it is nested — a plain subdirectory, or a declared submodule such
 *   as `bootstrap/` — and its repository is one level up, which is
 *   `repoRootFor`'s contract and is unchanged.
 *
 * Read from the filesystem rather than by spawning `git rev-parse
 * --show-toplevel` for two measured reasons: `rootForScope` is on the hot path
 * of every declared-directory resolution, and a fixture built under a checkout
 * would get the ENCLOSING repository's toplevel, which is the wrong answer
 * delivered confidently. A non-git fixture has no `.git` anywhere and keeps the
 * `dirname` answer every existing fixture was written against.
 *
 * ## It reports rather than guessing
 *
 * A nested checkout (a submodule) whose parent holds no `.git` is a tree whose
 * repository cannot be determined: the `.gitmodules` says one thing and the
 * parent's git state another. That throws, because returning `dirname` there
 * is the silent escape this function exists to end.
 */
export function checkoutRootFor(instanceRoot: string): string {
  const abs = resolve(instanceRoot);
  if (isForeignCheckout(abs)) return abs;
  // A git-less tree whose root AGGREGATES other layers (`init-folio` before
  // `git init`, a cross-instance fixture) is its own checkout too — the
  // container rule {@link siblingScopeFor} states, and the whole of what
  // `harness-config`'s `checkoutRootFor` was before this (it now delegates
  // here, so there is one answer rather than two that disagree on a leaf).
  const up = siblingScopeFor(abs);
  if (up === abs) return abs;
  if (existsSync(join(abs, ".git")) && !existsSync(join(up, ".git"))) {
    throw new Error(
      `cannot determine the checkout of ${abs}: it is a declared submodule of ${up}, ` +
        `which holds no \`.git\` — refusing to read repository-level files from outside a checkout`,
    );
  }
  return up;
}

/**
 * The scope to resolve a layer's SIBLINGS in — `repoRootFor`, except when
 * the layer root IS the repository root.
 *
 * ## Why {@link repoRootFor} is not enough, and is not wrong either
 *
 * `repoRootFor` is `dirname`, and says so. Its contract assumes a layer
 * nested one level under the repository, which every layer here satisfies
 * but one: **`folio-assistant` is declared AT the repository root.** For that
 * one, `dirname` climbs out of the checkout, and a name lookup built on it
 * sees no siblings at all.
 *
 * Measured on `main` at `80c18ac`, before this existed:
 *
 * ```
 * repoRootFor("/home/user/folio-assistant")  -> "/home/user"
 * layerRootsIn("/home/user")              -> 1   (only folio-assistant)
 * ```
 *
 * so the root layer's `needs` on the content core derived **nothing**,
 * and its overlay held one directory — the authored config edge, which does not
 * go through the derivation. A broken resolver that returns one plausible entry
 * is worse than one that returns none: it reads as a working overlay.
 *
 * ## The discriminator is "does this directory CONTAIN other instances"
 *
 * Asked in this module's own vocabulary rather than by probing for `.git`, for
 * two reasons. A `.git` probe answers a question about version control when
 * the question is about layer scope — a repository is not the only thing
 * that can hold layers, and `init-folio` already builds trees that have no
 * `.git` yet. And it keeps this testable over the throwaway trees the
 * cross-instance tests use, which is where the sibling rules are falsified.
 *
 * So: if scanning `instanceRoot` finds a layer OTHER than itself, it is a
 * container and it is the scope. Otherwise it is a leaf and its siblings live
 * one level up, which is exactly {@link repoRootFor}'s assumption.
 *
 * **This does NOT replace `repoRootFor`.** That function answers "where does
 * the REPOSITORY's own furniture live" — `.github/`, `package.json`, `beans/`
 * — and for a nested layer the two agree. This one answers "where do I look
 * up a sibling by name", and they differ only for the layer that is also
 * the root. Collapsing them would make the repository-furniture question
 * wrong for that same layer, in the other direction.
 */
export function siblingScopeFor(instanceRoot: string): string {
  const abs = resolve(instanceRoot);
  for (const found of layerRootsIn(abs)) {
    if (resolve(found) !== abs) return abs;
  }
  // NEVER outside the checkout (owner ruling 2026-10-11, bean `68k7`): a
  // layer that IS its own checkout — its own `.git`, not a declared
  // submodule of its parent — is the root layer, and its parent is not a
  // place to look for siblings. A checkout cloned straight into `/tmp` would
  // otherwise treat every directory in `/tmp` as a candidate layer, which is
  // how 163 malformed fixtures once failed two unrelated tests (`8zsb`).
  // Nested layers, submodules and lock mounts (no `.git`) are unchanged.
  if (isForeignCheckout(abs)) return abs;
  return repoRootFor(abs);
}

/**
 * Resolve a `coverage.visualiser` / `coverage.docs` value to an absolute path.
 *
 * **The base is the REPOSITORY root, and the owner ruled it so on 2026-09-21**
 * (bean `yt7j`, issue #619). This function is that ruling, and it is the only
 * place the base is written down as code rather than as prose.
 *
 * ## Why this exists rather than a `resolve()` at each call site
 *
 * A declared `path` states its own base — instance-relative by default,
 * repository-relative when the entry carries `scope: "repository"`. **A
 * coverage value states nothing.** So the asymmetry `yt7j` records is not
 * "two fields use two bases"; it is *one field declares its base and the other
 * does not*, and a consumer holding a bare string has no way to ask.
 *
 * The cost of leaving that to each caller was measured, not imagined:
 * `state-visualizer.ts` has `ROOT = cat-harness/`, so the obvious
 * `join(ROOT, cov)` reported EVERY declared visualiser as absent. That very
 * nearly shipped as a page of false "the declared visualiser is not there"
 * findings, and it was caught only because the corpus happened to be measured
 * first. The next consumer has no such luck — which is the whole argument for
 * one named answer, the same one {@link siteDirFor} makes about the site root.
 *
 * ## Resolving against "whichever root happens to work" is not a kindness
 *
 * `check-subgraph-coverage.ts` tried the layer root and then the repository
 * root, accepting either. That is worse than picking wrong: a path that is
 * incorrect in its declared base passes anyway via the other, so the check
 * cannot enforce the convention it documents, and the corpus is free to drift
 * into a mix nobody can read. Measured 2026-09-21 before tightening it: of
 * **45** coverage paths in this repository, **45 resolve from the repository
 * root** and the fallback was load-bearing for none.
 *
 * ## Take the repository root; do not derive it here
 *
 * The parameter is the REPOSITORY root, not a layer root, because
 * {@link repoRootFor} overshoots for the one layer where it matters: the
 * root declaration's layer root IS the repository, so going up one lands
 * outside the checkout entirely. A caller that holds a layer root and
 * knows it is nested composes `repoRootFor` itself, at a call site where that
 * assumption is visible.
 *
 * It does not check that the result exists. A caller asking "does this
 * resolve" wants {@link existsSync} on the answer and a three-state verdict
 * around it; folding the question in here would give every consumer a boolean
 * where some of them need to say *where* they looked.
 */
export function resolveCoveragePath(repoRoot: string, coveragePath: string): string {
  return resolve(repoRoot, coveragePath);
}

/**
 * The root a declared `path` or `src` is relative to.
 *
 * The ONE place a declared scope turns into a directory. Every consumer of a
 * declared path goes through `resolveDirectories` or `declaredAssets`, and
 * both go through here, so relocating a layer within its repository is a
 * change to this function rather than a sweep over six declarations.
 */
export function rootForScope(instanceRoot: string, scope?: DeclarationScope): string {
  // `checkoutRootFor`, not `repoRootFor`: a `scope: "repository"` entry on the
  // ROOT declaration otherwise resolved against the checkout's parent (g43f).
  return scope === "repository" ? checkoutRootFor(instanceRoot) : instanceRoot;
}

/**
 * The layer directory a module inside it belongs to — the nearest enclosing
 * directory carrying a declaration — see {@link findDeclarationFile}.
 *
 * ## Why a walk rather than `process.cwd()`
 *
 * Nine scripts under `scripts/` and `pipeline/` read this layer's
 * declaration and got the root from the working directory. That was never a
 * claim about the layer; it was true only because a gate is run from the
 * repository root and the two were one directory. After the move (bean
 * `wggr`) seven CI gates threw `ENOENT: …/harness.json` — which was at least
 * loud. `check-declared-assets` did not throw: it read a declaration that was
 * not there, got no assets, and reported a clean run.
 *
 * A layer's own tooling belongs to exactly one layer — **the one it
 * lives in** — so the honest question is "where am I", and every such script
 * passes `import.meta.dir`.
 *
 * ## Why a walk rather than `resolve(import.meta.dir, "..", "..")`
 *
 * Counting `..` pins the caller's depth: a script moved one directory down
 * starts reading a declaration from somewhere else, and nothing says so. The
 * walk finds the DECLARATION, which is the thing being asked for.
 *
 * Returns `undefined` rather than guessing — a site root guessed wrong writes
 * hundreds of pages into a directory nothing serves. {@link instanceRootFor}
 * is the throwing form for callers that cannot continue without one.
 */
export function findInstanceRoot(start: string): string | undefined {
  let dir = resolve(start);
  for (;;) {
    if (findDeclarationFile(dir) !== undefined) return dir;
    const up = resolve(dir, "..");
    if (up === dir) return undefined;
    dir = up;
  }
}

/**
 * Whether a declaration is the layer a reference names — by its planned
 * repository (`owner/name`, the form references take since bean `6rmv`) or
 * by its machine `name`, which internal callers and `needs` edges still use.
 * One predicate so every resolver answers "which instance is this" alike.
 */
export function declaresInstance(
  decl: { name?: string; repository?: string } | undefined,
  ref: string,
): boolean {
  return decl !== undefined && (decl.name === ref || (decl.repository !== undefined && decl.repository === ref));
}


/** {@link findInstanceRoot}, throwing rather than returning `undefined`. */
export function instanceRootFor(start: string): string {
  const root = findInstanceRoot(start);
  if (root === undefined) {
    throw new Error(
      `no \`<name>${DECLARATION_SUFFIX}\` in ${resolve(start)} or any parent — ` +
        `cannot determine which instance this belongs to`,
    );
  }
  return root;
}

/**
 * `siteDir` for the layer rooted at `root`, read from its declaration.
 *
 * Deliberately a RAW read of `name`/`stub` rather than `readDeclaration`:
 * those two fields are all this needs, and going through the full reader
 * would make every consumer of the site root — four generators and the
 * translation sweep — fail the moment some unrelated directory declares a
 * kind the harness layer has not registered. That is exactly the `folio`
 * situation bean `x4a6` is blocked on, and it must not take the site root
 * down with it.
 *
 * It **throws** rather than defaulting when the declaration is missing or
 * nameless. A site root guessed wrong writes 278 pages into a directory
 * nothing serves, and "could not determine" is never rendered as an answer.
 */
/**
 * Where a layer publishes the instructions for BOOTSTRAPPING INTO IT,
 * relative to that layer's own docs root.
 *
 * ## Why a fixed convention rather than a lookup
 *
 * §5 of the bootstrap proposal has the agent obtain exactly ONE reference —
 * `litlfred/f-a-sci` — and read everything else from that layer's own
 * declaration. That answers *which* layer. It does not answer *where in it*
 * the initialization steps are, and without a fixed answer the agent needs
 * per-instance knowledge of every harness it might be pointed at, which is
 * precisely what one reference was meant to remove.
 *
 * So every cat-harness layer, and every layer that depends on one,
 * publishes them at the SAME place. CatBootstrap then needs no special case per
 * target: `f-a-sci`, a DAK layer and a specialised harness nobody has written
 * yet are all read the same way. That is what lets bootstrap initialise into a
 * *specialised* kind rather than only into the one it was written against.
 *
 * ## Composed, never spelled
 *
 * Built from {@link siteDir} rather than written as `docs/bootstrap/...`,
 * because the stub pattern INVERTED on 2026-09-19 — `docs/<stub>` became
 * `<stub>/docs` (bean `wggr`) — and every literal spelling of the old layout
 * had to be found and changed. A convention composed from the one function
 * that knows the site root survives the next relocation; a literal does not.
 */
export const CAT_BOOTSTRAP_INIT_DOC = "bootstrap/initialization.md";

/**
 * The path to a layer's initialization instructions, relative to that
 * LAYER's root — `docs/bootstrap/initialization.md`.
 *
 * THE one answer, so the README that tells an agent where to look and the
 * check that verifies the file is there cannot disagree about the spelling.
 *
 * ## It was repo-relative, and the move narrowed it
 *
 * This arrived composing `<stub>/docs/...` and its docstring said "full
 * repo-relative path", which was true while {@link siteDir} returned
 * `<stub>/docs`. It returns plain `docs` now, because the layer has a
 * directory of its own and the stub level inside it would repeat the name.
 *
 * So the suffix is IDENTICAL for every layer, which is a stronger version
 * of the property bootstrap relies on than "differs only by site root".
 *
 * ## The open half, stated rather than papered over
 *
 * CatBootstrap is handed ONE reference and must reach this file, so it needs the
 * layer's DIRECTORY, and this function no longer supplies it. On this
 * repository the directory is `cat-harness/` while the stub is
 * `folio-assistant` — deliberately different, since the stub names published
 * artefacts and the directory is a filesystem fact — so `<stub>/` would name
 * nothing.
 *
 * Resolving it by scanning the top level for a `harness.json` is the
 * declaration-driven answer and is what {@link findInstanceRoot} already does
 * in the other direction, but it is NOT implemented and is not assumed here.
 * Recorded on bean `wggr`; until then bootstrap can compose this suffix and
 * still needs told which directory to hang it off.
 */
export function initializationDoc(d: Pick<CatHarnessDeclaration, "name" | "stub">): string {
  return `${siteDir(d)}/${CAT_BOOTSTRAP_INIT_DOC}`;
}

export function siteDirFor(root: string): string {
  const file = findDeclarationFile(root);
  // Named as a DIRECTORY when there is none: under `<name>.config.json` there
  // is no single filename to report as missing, and "no declaration in <dir>"
  // is the fact anyway.
  const p = file === undefined ? resolve(root) : join(root, file);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(p, "utf-8"));
  } catch (e) {
    throw new Error(
      `cannot determine the site root: ${p} is unreadable or not valid JSON ` +
        `(${e instanceof Error ? e.message : String(e)})`,
    );
  }
  const d = raw as { name?: unknown; stub?: unknown };
  const stub = typeof d.stub === "string" && d.stub ? d.stub : d.name;
  if (typeof stub !== "string" || !stub) {
    throw new Error(`cannot determine the site root: ${p} declares neither \`stub\` nor \`name\``);
  }
  return siteDir({ name: stub, stub });
}

/**
 * Where the docs graph's own SOURCE lives — the authored blocks and manifests
 * `gen-docs-pages.ts` renders into the pages beside them — read from its
 * declaration (`docs-source` in the docs graph's `docs.json`), never spelled.
 * Moved from `content/docs/` on 2026-10-09 (owner: "move content/docs into
 * docs/"), so the docs subgraph carries its own source. The site directory is
 * {@link siteDirFor}'s answer, for the same reason that function exists: one
 * question, one answer.
 */
export function docsSourceDirFor(root: string): string {
  const site = join(root, siteDirFor(root));
  let path = "source";
  try {
    const raw = JSON.parse(readFileSync(join(site, "docs.json"), "utf-8")) as { directories?: { id?: string; path?: string }[] };
    const entry = (raw.directories ?? []).find((d) => d.id === "docs-source");
    if (entry?.path) path = entry.path.replace(/\/+$/, "");
  } catch {
    // No readable docs.json: the declared default. `check:declared-dirs` owns an unreadable one.
  }
  return join(site, path);
}

/**
 * The layer's SITE LAYERS: every directory it declares with graph typology
 * `docs`, relative to `root`, in DECLARATION order — base first, the layer
 * that overlays it last. This is the order `compose-docs` lays them down in.
 *
 * Read RAW, like {@link siteDirFor}: a validating read throws on any
 * unregistered typology, and the site layers are needed by tools that must
 * work on a declaration they are not the authority for.
 *
 * On cat-harness it is `["site-chrome", "docs"]` (proposal
 * semantic-subgraphs-2026-10-09, slice 1; owner, 2026-10-09: *"go ahead with
 * the cat-harness chrome subgraph"*): the just-the-docs CHROME is the base and
 * the harness's own pages overlay it. A layer that declares one docs
 * directory has one layer, and every answer below collapses to
 * {@link siteDirFor}'s.
 */
export function siteLayersFor(root: string): string[] {
  const file = findDeclarationFile(root);
  if (file === undefined) return [siteDirFor(root)];
  let raw: { directories?: { path?: unknown; graphTypologies?: unknown; scope?: unknown }[] };
  try {
    raw = JSON.parse(readFileSync(join(root, file), "utf-8"));
  } catch {
    return [siteDirFor(root)];
  }
  const layers = (raw.directories ?? [])
    .filter(
      (d) =>
        typeof d.path === "string" &&
        d.scope !== "repository" &&
        Array.isArray(d.graphTypologies) &&
        d.graphTypologies.includes("docs"),
    )
    .map((d) => (d.path as string).replace(/\/+$/, ""));
  const site = siteDirFor(root);
  // The site directory is always a layer: it is where the layer's pages are
  // generated, whether or not the declaration happens to name it.
  return layers.includes(site) ? layers : [...layers, site];
}

/**
 * Where a file of the COMPOSED site comes from: the top-most site layer
 * ({@link siteLayersFor}) that holds `rel`, relative to `root` — the same
 * later-wins answer `compose-docs` gives. A file no layer holds resolves into
 * the BASE layer, so a generator writing a chrome file it has not written yet
 * writes it where the chrome lives.
 *
 * A reader of `assets/css/docs-ui.css` or `_includes/head_custom.html` asks
 * this rather than joining {@link siteDirFor}: since slice 1 those files are
 * the site chrome's, not the pages'.
 */
export function siteFileFor(root: string, rel: string): string {
  const layers = siteLayersFor(root);
  for (let i = layers.length - 1; i >= 0; i--) {
    if (existsSync(join(root, layers[i]!, rel))) return join(layers[i]!, rel);
  }
  return join(layers[0]!, rel);
}

/** The BASE site layer — the site chrome where one is declared, else {@link siteDirFor}. */
export function siteChromeDirFor(root: string): string {
  return siteLayersFor(root)[0]!;
}

/**
 * {@link artefactStub} for the layer rooted at `root`, read from its
 * declaration — the RAW read, for the same reason {@link siteDirFor} takes one.
 *
 * `readDeclaration` validates the whole declaration, which means it throws
 * when ANY directory in it names a graph typology the harness layer has not
 * registered. `siteDirFor` documents that hazard above and avoids it; this is
 * the missing half, and its absence was a real cost rather than a tidiness
 * point: the 2026-09-21 stub rename (issue #649) needed the published artefact
 * name in two Playwright suites, and `readDeclaration` threw there on exactly
 * the unregistered-kind path `siteDirFor` warns about — in a browser job,
 * where the failure reads as "no tests found" rather than as a bad read.
 *
 * Throws rather than defaulting, like its sibling. A guessed artefact name
 * sends a consumer to a document nothing publishes, and "could not determine"
 * is never rendered as an answer.
 */
export function artefactStubFor(root: string): string {
  // Named as a DIRECTORY when there is no declaration, the same way
  // `siteDirFor` is: under `<name>.json` there is no single filename to
  // report as missing, and "no declaration in <dir>" is the fact anyway.
  const file = findDeclarationFile(root);
  const p = file === undefined ? resolve(root) : join(root, file);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(p, "utf-8"));
  } catch (e) {
    throw new Error(
      `cannot determine the artefact stub: ${p} is unreadable or not valid JSON ` +
        `(${e instanceof Error ? e.message : String(e)})`,
    );
  }
  const d = raw as { name?: unknown; stub?: unknown };
  const stub = typeof d.stub === "string" && d.stub ? d.stub : d.name;
  if (typeof stub !== "string" || !stub) {
    throw new Error(`cannot determine the artefact stub: ${p} declares neither \`stub\` nor \`name\``);
  }
  return stub;
}

/**
 * A declared asset's path, as the PUBLISHED site serves it.
 *
 * `docs/assets/img/x.webp` → `/assets/img/x.webp`. A layer declares an
 * image by its repo-relative path, and the site build copies the site
 * directory's CONTENTS to the site root — so the declared prefix is exactly
 * what a published URL does not carry.
 *
 * **Derived from {@link siteDirFor}, never from the literal `docs/`.** Two
 * consumers needed this and the first wrote the literal; the second would have
 * copied it, and a layer that moves its site directory would then serve
 * two different answers — one correct, one a 404 that looks like a missing
 * image. `site-dir-single-answer.test.ts` exists for exactly this class of
 * duplicate.
 *
 * A path that does not start with the site directory is **passed through
 * unchanged**: it is either already site-relative or points somewhere this
 * function has no business rewriting, and guessing would turn a working
 * external URL into a broken local one.
 */
export function publishedAssetPath(root: string, src: string): string {
  const prefix = `${siteDirFor(root)}/`;
  return src.startsWith(prefix) ? `/${src.slice(prefix.length)}` : src;
}

/**
 * Where this sticky's declaration can be read and edited, on the forge.
 *
 * ## Both, because they are different acts
 *
 * The owner: *"edit tool = link to github pages edit directrly ... rendeding
 * shows edit src icon (and also need view icon)"*. `/blob/` is reading and
 * `/edit/` opens the editor; a reader who wants to check what a card says
 * should not be taken to a text box, and one who wants to fix it should not
 * have to find the button themselves.
 *
 * ## Absent, not broken, when there is no forge
 *
 * *"if github tools avaialable in rendering pipeline"* — so this is a real
 * probe rather than a hardcoded address. `detectRepoUrl` reads `origin` and
 * `upload-url.ts` already refuses a non-github.com remote for the same reason:
 * the `/edit/<branch>/<path>` form is GitHub's, and emitting it for another
 * forge is a guess wearing a URL's clothes.
 *
 * Returning `undefined` is what makes the control ABSENT rather than dead. A
 * link that 404s is worse than no link: it invites a click, and on a private
 * repository it 404s for exactly the reader who cannot edit, which reads as
 * "this page is broken" rather than "you cannot do this".
 *
 * `declaredIn` is repo-relative and comes from the SUBJECT itself, so a card
 * contributed by `bootstrap` links to `bootstrap/harness.json` rather
 * than to whichever declaration happened to be read first — and a todo links
 * to its own file.
 *
 * ## It lives HERE, below both callers
 *
 * It was in `landing-sticky.ts` until bean `pb04` gave the todo index the
 * same two controls. The owner, 2026-09-20: *"notes exist lower down than
 * folio. make sure arrows correct."* This is not about stickies — it is
 * "where is this file on the forge" — and leaving it up there made a
 * note-layer generator reach sideways into the folio-facing module.
 * `repo-partition` allowed it, because both are `core`; the layer arrow was
 * still wrong. Beside {@link publishedAssetPath}, which is the same shape of
 * transform, both callers point DOWN at one answer instead of at each other.
 */
export function sourceLinks(
  repoUrl: string | undefined,
  declaredIn: string,
  branch: string,
): { viewHref: string; editHref: string } | undefined {
  if (repoUrl === undefined) return undefined;
  const at = forgeLocation(declaredIn, repoUrl);
  repoUrl = at.repoUrl;
  const path = at.path.split("/").map(encodeURIComponent).join("/");
  return {
    viewHref: `${repoUrl}/blob/${branch}/${path}`,
    editHref: `${repoUrl}/edit/${branch}/${path}`,
  };
}

/** The submodules this checkout carries, from `.gitmodules` at its root. */
export function gitSubmodules(repoRoot: string = join(import.meta.dir, "..", "..", "..")): Array<{ path: string; url: string }> {
  let text: string;
  try {
    text = readFileSync(join(repoRoot, ".gitmodules"), "utf-8");
  } catch {
    return [];
  }
  const out: Array<{ path: string; url: string }> = [];
  for (const block of text.split(/^\[submodule /m).slice(1)) {
    const path = /^\s*path\s*=\s*(.+)$/m.exec(block)?.[1]?.trim();
    const url = /^\s*url\s*=\s*(.+)$/m.exec(block)?.[1]?.trim();
    if (path && url) out.push({ path, url: url.replace(/\.git$/, "") });
  }
  return out;
}

/**
 * The repository that HOLDS `path` (repository-relative), and the path inside
 * it. A file in a submodule lives in the submodule's own repository — since
 * 2026-09-30 `bootstrap/` and `bootstrap-tools/` are `litlfred/bootstrap` and
 * `litlfred/bootstrap-tools` (bean `xsqm`) — so a "view source" link to it
 * must name that repository; this checkout's forge shows only a pointer
 * there. Anything else is this repository's, at `repoUrl`.
 */
export function forgeLocation(path: string, repoUrl: string, repoRoot?: string): { repoUrl: string; path: string } {
  for (const s of gitSubmodules(repoRoot)) {
    if (path === s.path || path.startsWith(`${s.path}/`)) return { repoUrl: s.url, path: path.slice(s.path.length + 1) };
  }
  // Since bean `nn8e` (#2462) those layers are REMOTE MOUNTS, and the lock is
  // what says where each came from: this checkout's forge holds no copy, so a
  // link there 404s.
  for (const m of mountedLocations(repoRoot)) {
    if (path === m.path || path.startsWith(`${m.path}/`)) {
      const rest = path.slice(m.path.length + 1);
      return { repoUrl: m.url, path: [m.upstreamRoot, rest].filter((x) => x.length > 0).join("/") };
    }
  }
  return { repoUrl, path };
}

/**
 * Each remote-mounted layer's checkout path, forge URL and path in its own
 * repository, from the root's lock: `index.lock.json`, else the legacy
 * `*.mount-lock.json` (`lockFilesIn`; both present contributes nothing, and
 * `mount:lock:check` reports it).
 */
export function mountedLocations(repoRoot: string = join(import.meta.dir, "..", "..", "..")): Array<{ path: string; url: string; upstreamRoot: string }> {
  const names = lockFilesIn(repoRoot).files;
  const out: Array<{ path: string; url: string; upstreamRoot: string }> = [];
  for (const f of names) {
    const r = readMountLock(join(repoRoot, f));
    if (!r.ok) continue;
    for (const i of r.lock.instances) out.push({ path: i.path.replace(/\/+$/, ""), url: `https://github.com/${i.repository}`, upstreamRoot: i.upstreamRoot.replace(/^\/+|\/+$/g, "") });
  }
  return out;
}

/**
 * Where a layer's renderings are published, given the site they are
 * published to.
 *
 * **They sit at the base, not in a subdirectory.** A cat-harness layer's
 * repository IS its declaration that it is a graph — `harness.json` at the
 * root says which graphs are here — so there is nothing for a `kg/` segment to
 * distinguish it from. The stub is what separates one layer's renderings
 * from another's in a tree that overlays several, which is the job a directory
 * would otherwise have been doing.
 *
 * ```
 * <base>/<stub>.jsonld          the knowledge graph
 * <base>/<stub>.json            the same bytes, servable as application/json
 * <base>/<stub>.schema.json     the declaration's schema
 * <base>/<stub>/                the viewer
 * ```
 *
 * **One function so nothing hand-writes a path again.** It was written out in
 * seven template literals across two exporters and two workflows — five of them
 * minting an `$id`, which is an identity, not a link. Relocating the renderings
 * from `kg/` to the base meant editing all seven, and a missed one publishes a
 * document whose own `$id` names a URL that 404s. `skillSchemaId` in
 * `harness-schema-export.ts` already carried this argument for its own corner;
 * this generalises it.
 *
 * A trailing slash on `base` is dropped, and an EMPTY base yields a
 * document-relative path rather than one rooted at `/` — a leading slash would
 * silently retarget every reference at the domain root, which is a different
 * site.
 */
export function renderingPath(base: string, ...segments: string[]): string {
  const b = base.replace(/\/+$/, "");
  const tail = segments.filter((s) => s.length > 0).join("/");
  return b ? `${b}/${tail}` : tail;
}

/**
 * The kinds whose definition satisfies `test`, in registry order (sod4 #5).
 * The per-kind lists below were hand-kept arrays of kind names beside the
 * registry; each is now a FIELD on the kind (`published`, `skillBearing`,
 * `kgContent`), so a kind's properties are stated once, where the kind is.
 * Read from cat-harness's own kinds: a kind another harness declares as a
 * node carries the same fields, and the predicates below ask the registry.
 */
function kindsWith(test: (d: GraphTypologyDef) => boolean): string[] {
  return Object.entries(BASE_GRAPH_TYPOLOGIES)
    .filter(([, d]) => test(d as GraphTypologyDef))
    .map(([k]) => k);
}

/**
 * Graph typologies that must NEVER reach a published knowledge graph.
 *
 * Owner, 2026-09-19: *"NEVER include fsh-guts, references to fsh-guts
 * stripped out of KG before sending to publication."*
 *
 * **Keeping the CONTENT out of the render pipeline is not the same as keeping
 * the REFERENCE out of the graph, and the first was shipped believing it
 * covered the second.** A layer's declared directories become nodes in
 * `<stub>.jsonld`, so declaring `fsh-guts/` locally — which is required, or
 * no tool can find it and the never-delete rule has no destination — put its
 * id, path and description into the published graph.
 *
 * **This is not a contradiction of `<base>/fsh-guts.jsonld`.** They are
 * different documents: that one IS the trashcan's graph and is asked for by
 * name; every other published artefact must contain no path to it. A consumer
 * may go there deliberately and must never arrive by following an edge.
 *
 * One list, read by every emitter, so two filters cannot disagree about what
 * is excluded.
 */
export const UNPUBLISHED_GRAPH_TYPOLOGIES: readonly string[] = kindsWith((d) => d.published === false);

/** Is this graph typology allowed into a published graph? */
export function isPublishedGraphTypology(name: string): boolean {
  return !UNPUBLISHED_GRAPH_TYPOLOGIES.includes(name);
}

/**
 * Does a layer declaring a directory of this kind owe a **visualiser**?
 *
 * The owner, 2026-09-20: *"if there is active state directory in repo root/
 * (**not part of the static KG**) like `beans/`, `todos/`, `fsh-guts/` those
 * have their vuisalizers too as requiement of handler.... needs to render
 * sometihng for each 'state' dir it declares/inits."*
 *
 * So the discriminator is the owner's own parenthetical: **is this the static
 * knowledge graph, or is it active material about the work?** Authored
 * subject matter you can read as itself; a record of where something got to
 * you cannot, which is why it needs something that renders it.
 *
 * That is exactly `holds !== "content"`, and the phrasing is not a
 * coincidence — `content` is defined on {@link GraphLayer} as *"authored
 * nodes a reader or a tool consumes as the subject matter… It stands on its
 * own"*. A graph that stands on its own does not need a viewer to be
 * legible. Everything else does.
 *
 * ## The rule this is NOT, and why that matters
 *
 * The first derivation was `holds === "state"`, and it was falsified inside
 * ten minutes: it covers `beans` and `todos` and **misses `fsh-guts`**, which
 * the owner names in the same sentence. `mhh9` reclassified `fsh-guts` from
 * `state` to `context` earlier the SAME DAY, on the ground that no running
 * step writes it — relocating something there is a human-directed act.
 *
 * `holds !== "content"` survives that move, because both `state` and
 * `context` are on the same side of it. That is the test a rule over this
 * axis has to pass: a kind changing category within the non-content layers
 * must not silently change what it owes.
 *
 * ## `renderable` is the one structural exemption
 *
 * A `renderable` kind is its own view — `docs` and `folio` render to pages,
 * so demanding a separate viewer would be asking for a second rendering of
 * the same thing. Both are already `holds: "content"`, so this is belt and
 * braces rather than a second rule; it is stated because a future renderable
 * kind that is not content would otherwise acquire an obligation it meets by
 * construction.
 *
 * ## Bootstrap is exempt by LAYER, not by kind
 *
 * `hfkl` carries the owner's ruling that `bootstrap` has no visualiser
 * *"but it must have its json/jsonld... that is its existence"*. That
 * exemption lives in the checker as `VISUALISER_EXEMPT_INSTANCES`, keyed on
 * the layer name, so every other layer declaring the same kind keeps
 * the obligation. An axis that dropped bootstrap by KIND would stop checking
 * the one thing bootstrap must have.
 */
export function owesVisualiser(
  kind: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): boolean {
  const def = registry.get(kind);
  // An UNKNOWN kind owes one, and that is deliberate rather than a fallback.
  //
  // `graphLayer` returns `undefined` here and its doc comment is explicit
  // that callers must not collapse that into `content`. This one does not:
  // it collapses the unknown into OWING, which is the opposite direction and
  // the safe one. A kind nobody has classified must not escape an obligation
  // by being unmentioned — the same reason `DOCUMENT_BLOCK_KINDS` is a
  // derived complement rather than a list.
  if (!def) return true;
  if (def.renderable) return false;
  return def.holds !== "content";
}

/**
 * Does a directory of this kind owe json, jsonld and schema.json at its URL?
 *
 * Owner, Q-SER-1 C / Q-SER-2 A, 2026-11-12: *"not all directories need to be
 * harnessed"*. This narrows the 2026-09-20 ruling ("all dir urls should have
 * json, jsonld, schema.json") to the kinds whose files are graph nodes. A
 * directory of code, built pages or fixtures holds no node a serialisation
 * could address, and a `state` directory is the running record of a store
 * rather than a declared graph.
 *
 * - An UNREGISTERED kind owes, for the reason {@link owesVisualiser} gives: a
 *   kind nobody has classified must not escape an obligation by being
 *   unmentioned.
 * - The kind's own `serialised` flag, when it sets one, is the answer.
 * - Otherwise a kind owes unless it `holds: "state"`.
 *
 * Still no waiver: whether a kind owes is the kind's declaration, never a
 * directory's `exempt`, so a harness still cannot declare a node-graph
 * directory into the KG and then make its nodes unreachable.
 */
export function owesSerialisations(
  kind: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): boolean {
  const def = registry.get(kind);
  if (!def) return true;
  if (def.serialised !== undefined) return def.serialised;
  return def.holds !== "state";
}

/** A directory owes serialisations when ANY of its kinds does ({@link owesSerialisations}). */
export function directoryOwesSerialisations(
  kinds: readonly string[],
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): boolean {
  return kinds.some((k) => owesSerialisations(k, registry));
}

/**
 * Is this SKILL allowed into a published graph?
 *
 * The skill that documents an unpublished kind is itself unpublished, and it
 * carries the kind's name. Leaving it in was the second leak found while
 * building this: the graph-typology and directory nodes were filtered, and
 * `skill/fsh-guts` plus the `declaresSkill` edge from `package/folio-core`
 * still named the trashcan, its purpose and its path.
 *
 * That is the right outcome on the merits as well as the letter. The skill's
 * subject IS where to put SDLC churn, so publishing it advertises the
 * trashcan to every consumer of the folio's graph — the precise thing the
 * owner's instruction forbids.
 *
 * Same list, because the skill and the kind share a name by construction.
 * If that ever stops being true this needs its own list, not a cleverer
 * derivation.
 */
export function isPublishedSkill(name: string): boolean {
  return !UNPUBLISHED_GRAPH_TYPOLOGIES.includes(name);
}

/**
 * Is this schema module allowed into a published graph?
 *
 * The FOURTH emitter, and it was not exercised until a `schemas/kg/fsh-guts.ts`
 * existed — which is to say the gap was latent from the day the strip was
 * written and only became visible when somebody added the module. The
 * blanket test in `fsh-guts-unpublished.test.ts` caught it on the first run,
 * which is the whole reason that test asserts a string rather than a list of
 * emitters: a new emitter cannot be added to a list nobody remembers to
 * update.
 *
 * Matched on the module's BASENAME, since that is the node's `name` and what
 * a consumer reads. `schemas/sdlc/log-entry.ts` stays published: it is named
 * after the log, not after the trashcan, and the rule is about naming the
 * trashcan rather than about anything that mentions it. By the same token a
 * schema whose subject is fsh-guts advertises it to every consumer of the
 * folio's graph, which is the precise thing the owner's instruction forbids
 * — the identical argument `isPublishedSkill` records.
 */
export function isPublishedSchemaModule(modulePath: string): boolean {
  const basename = modulePath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? modulePath;
  return isPublishedGraphTypology(basename);
}

/**
 * Is this declared directory allowed into a published graph?
 *
 * A directory is excluded when ANY graph it holds is excluded — not when all
 * of them are. `graphs` is an array and a directory may hold more than one
 * part of the graph, so an "all" test would publish a directory that holds
 * both `kg` and `fsh-guts`, naming the trashcan's path in the process.
 */
export function isPublishedDirectory(d: { graphTypologies?: readonly string[] }): boolean {
  return (d.graphTypologies ?? []).every(isPublishedGraphTypology);
}

/**
 * The declared publication host for the layer rooted at `root`, or
 * `undefined` when it has not said.
 *
 * **`undefined` is never to be read as `github-pages`.** A caller that wants
 * to tell somebody where a thing rendered must report "not declared" as its
 * own answer — that is the whole defect this field closes, and defaulting
 * here would reintroduce it one layer down where nobody would see it.
 *
 * A RAW read of the one field, like `siteDirFor` and for the same reason: a
 * consumer asking where the site publishes must not fail because some
 * unrelated directory declares a graph typology this layer has not registered.
 */
export function publicationHost(root: string): PublicationHost | undefined {
  const file = findDeclarationFile(root);
  if (file === undefined) return undefined;
  const p = join(root, file);
  try {
    const raw = JSON.parse(readFileSync(p, "utf-8")) as { publication?: { host?: unknown } };
    const host = raw.publication?.host;
    return PUBLICATION_HOSTS.includes(host as PublicationHost)
      ? (host as PublicationHost)
      : undefined;
  } catch {
    // Unreadable is "has not said", not an error to throw at a caller whose
    // question was only "where does this publish". `readDeclaration` throws
    // for the callers that need a valid declaration.
    return undefined;
  }
}

/**
 * The one conflict decidable from `publication.host` and `readme.linkStyle`
 * together, or `undefined` when there is none.
 *
 * Two facts in two files — the host in `harness.json`, the link style in
 * `harness.config.json` — can now disagree, and that is the cost of making
 * the host its own axis rather than overloading `linkStyle`. This is the
 * check that pays it.
 *
 * **Exactly one rule, and it is an entailment.** `linkStyle: "pages"` writes
 * every published-artefact link under `pagesBaseUrl`, i.e. against a GitHub
 * Pages site. A deployment that declares any other host is saying that site
 * is not where it publishes, so those links point at nothing.
 *
 * **`raw` is deliberately NOT ruled on.** It resolves through
 * `raw.githubusercontent.com` and therefore depends on the FORGE and on
 * repository VISIBILITY — and measured 2026-09-19, this schema declares
 * neither. A rule needing a fact the harness does not have would be a guess
 * wearing a gate's authority, which is the trap
 * `do-not-encode-a-rule-against-a-working-setup` records. When visibility
 * becomes declarable, revisit; until then this returns nothing for `raw`,
 * which is "could not determine", not "fine".
 */
export function publicationLinkStyleConflict(
  host: PublicationHost | undefined,
  linkStyle: string | undefined,
): string | undefined {
  if (host === undefined || linkStyle !== "pages") return undefined;
  if (host === "github-pages") return undefined;
  return (
    `the declaration declares \`publication.host: "${host}"\`, but ` +
    `the config sets \`readme.linkStyle: "pages"\`, which writes every ` +
    `published-artefact link against a GitHub Pages site this deployment says ` +
    `it does not publish to. Set \`linkStyle\` to \`blob\`, or correct the host.`
  );
}

/**
 * The media type each rendering extension declares, longest extension first.
 *
 * The companion to `renderingPath`: that says WHERE an artefact is, this says
 * WHAT it is. Both were prose in `skills/ui/ui-core/serving-renderings.md` and
 * only one of them was code, so every consumer that served a rendering had to
 * re-derive the type — and `grep` for `ld+json` across this repository's
 * TypeScript returned **nothing** before this existed (measured 2026-09-19).
 *
 * **Order is load-bearing, and it is the whole reason a table is needed.**
 * `.schema.json` must be tried before `.json`, because the second is a suffix
 * of the first.
 *
 * That single row is the entire gap against an ordinary static server, and it
 * is narrower than it is tempting to claim. Measured the same day, both
 * Python's `mimetypes` and `Bun.file().type` already resolve `.jsonld` to
 * `application/ld+json` correctly — so "a general-purpose server cannot serve
 * a rendering" is FALSE and must not be written down as a rule. What no OS
 * table carries is the compound extension: `.schema.json` infers as
 * `application/json`, which parses but loses that the document is a schema.
 */
export const RENDERING_MEDIA_TYPES: readonly (readonly [string, string])[] = [
  [".schema.json", "application/schema+json"],
  [".jsonld", "application/ld+json"],
  [".json", "application/json"],
  [".html", "text/html"],
] as const;

/**
 * The declared media type for a rendering path, or `undefined` when this is
 * not a rendering whose type the declaration fixes.
 *
 * **`undefined` is a third state and callers must keep it one.** It means
 * "this table says nothing", not "serve it as bytes": a server should fall
 * back to its own inference for an ordinary asset rather than forcing a type
 * onto a file the declaration never claimed. Same discipline as
 * `readme-sections`' `skip` and `ci-health`'s "could not check".
 */
export function renderingMediaType(path: string): string | undefined {
  const lower = path.toLowerCase();
  return RENDERING_MEDIA_TYPES.find(([ext]) => lower.endsWith(ext))?.[1];
}

// ── Reading ─────────────────────────────────────────────────────

/**
 * Read one layer's declaration.
 *
 * Returns `undefined` when the file is absent — a layer that has not been
 * migrated yet is not an error, and callers fall back to today's conventions.
 * A file that is present but malformed **throws**: a declaration nobody can
 * read leaves every consumer scanning the wrong directories, which is worse
 * than not having one.
 */
export function readDeclaration(
  instanceRoot: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): CatHarnessDeclaration | undefined {
  const file = findDeclarationFile(instanceRoot);
  if (file === undefined) return undefined;
  const p = join(instanceRoot, file);
  let text: string;
  try {
    text = readFileSync(p, "utf-8");
  } catch (e) {
    throw new Error(`${p} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  // MEMOISED ON THE FILE'S TEXT, not its path or mtime: the checkout overlay
  // (placement PR0) resolves every staged layer through its own chain and
  // reads each declaration a dozen times per process, and the Zod parse is
  // the cost (measured: a CLI run went from 0.2 s to 2 s). Keyed on the bytes,
  // so a test that rewrites a fixture is re-parsed, and on the registry's
  // size, since kinds are registered at runtime. A clone is returned, so a
  // caller that mutates its copy cannot poison the next one.
  const hit = declarationCache.get(p);
  if (hit !== undefined && hit.text === text && hit.registry === registry && hit.kinds === registry.names().length) {
    return structuredClone(hit.value);
  }
  const value = parseDeclarationText(p, text, registry);
  declarationCache.set(p, { text, registry, kinds: registry.names().length, value });
  return structuredClone(value);
}

const declarationCache = new Map<
  string,
  { text: string; registry: GraphTypologyRegistry; kinds: number; value: CatHarnessDeclaration }
>();

function parseDeclarationText(p: string, text: string, registry: GraphTypologyRegistry): CatHarnessDeclaration {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`${p} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  const parsed = CatHarnessDeclarationSchema.safeParse(stripJsonLd(raw, registry, dirname(p)));
  if (!parsed.success) {
    // ── The one failure worth naming, because it is the one that arrives by
    //    MERGE rather than by editing ───────────────────────────────────────
    //
    // `dependents` is required, so any branch that adds a directory entry
    // while this field exists — and any branch cut before it existed —
    // produces a declaration that will not parse the moment the two meet. That
    // is not hypothetical: main added `methodology-crdm` and `methodology-raci`
    // while the field was in review, and CI on the merged tree reported **166
    // failures and 35 errors** whose only visible cause was a raw Zod dump
    // repeated across every test that reads a declaration.
    //
    // Nothing was wrong with either side. The author of the other branch did
    // not know the field existed, and 166 red tests are a terrible way to find
    // out. So the missing-field case says which entries, and what to write.
    throw new Error(`${p} is not a valid CatHarness declaration: ${parsed.error.message}`);
  }
  // Kind validation is here rather than in the Zod schema because the
  // vocabulary is open: the set of valid kinds is whatever has been registered
  // by the time the declaration is read, not what existed at module load.
  for (const dir of parsed.data.directories) {
    for (const g of dir.graphTypologies) {
      if (!registry.has(g)) {
        // Register kinds from every discovered layer's `typologies/` in the
        // declaration's checkout before refusing an unknown kind (bean
        // `cat-tools-g7ls`, owner card 2026-10-31 "A. Fix the loader"). Done
        // lazily on `!registry.has(g)` so reading a fixture declaration whose
        // kinds are already registered does not scan temporary test directories
        // into `defaultGraphTypologies`.
        registry.ensureCheckout(checkoutRootFor(dirname(p)));
      }
      if (!registry.has(g)) {
        throw new Error(
          `${p}: directory "${dir.id}" declares unknown graph typology "${g}". ` +
            `Known kinds: ${registry.names().join(", ")}. ` +
            `A kind contributed by a dependency must be registered before the ` +
            `declaration is read.` +
            (REGISTRATION_MODULE[g] === undefined
              ? ""
              : ` Add \`import "${REGISTRATION_MODULE[g]}";\` to the module that ` +
                `reads this declaration — the import is for its SIDE EFFECT, so it ` +
                `takes no binding and must not be elided.`),
        );
      }
    }
  }
  // Same reasoning one level down: an `icon` naming an image the declaration
  // does not carry renders nothing, and a missing favicon looks exactly like a
  // slow one — so it is reported rather than left to be noticed.
  if (parsed.data.icon) {
    const ids = (parsed.data.images ?? []).map((i) => i.id);
    if (!ids.includes(parsed.data.icon)) {
      throw new Error(
        `${p}: icon "${parsed.data.icon}" names no declared image. ` +
          (ids.length ? `Declared: ${ids.join(", ")}.` : `No images are declared.`),
      );
    }
  }
  const seen = new Set<string>();
  for (const i of parsed.data.images ?? []) {
    if (seen.has(i.id)) throw new Error(`${p}: image "${i.id}" is declared twice.`);
    seen.add(i.id);
  }
  // A self-contradictory topology is REFUSED rather than reported, which is
  // the one thing bean `folio-assistant-g7vb` asks for that a table of prose
  // cannot do. Refusing here, on the same path as an unregistered graph typology
  // and an icon naming no image, is deliberate: those are also declarations
  // that parse and cannot be true, and a consumer that got a valid-looking
  // object back would carry the contradiction onward.
  //
  // Safe to add because every axis is optional and absent is a third state:
  // no declaration that exists today names either side of any pair, so this
  // throws for nobody until somebody opts in. See {@link topologyConflicts}.
  const conflicts = topologyConflicts(parsed.data.topology, parsed.data.publication?.host);
  if (conflicts.length) throw new TopologyConflictError(p, conflicts);
  return parsed.data;
}

/**
 * Drop JSON-LD keywords before Zod sees the object.
 *
 * The published form carries `@context` and per-node `@id` / `@type`, which
 * are projections of `id` and `graphs` rather than extra data. Keeping them out
 * of the validated shape means the schema describes the authored object and
 * the graph projection stays derivable — the same split as
 * `schemas/kg/jsonld.ts` draws for blocks.
 */
function stripJsonLd(raw: unknown, registry: GraphTypologyRegistry, instanceRoot?: string): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const o = { ...(raw as Record<string, unknown>) };
  delete o["@context"];
  delete o["@type"];
  delete o["@id"];
  if (Array.isArray(o.directories)) {
    o.directories = o.directories.map((d) => {
      if (typeof d !== "object" || d === null) return d;
      const e = { ...(d as Record<string, unknown>) };
      // `holdsGraph` recovers `graphTypologies`, in both projected forms: one stays
      // a string, several become a list. An individual the registry does not
      // know is DROPPED rather than guessed — recovering the wrong kind is
      // worse than recovering none, because the reader has no way to tell.
      if (e.graphTypologies === undefined && e.holdsGraph !== undefined) {
        const iris = Array.isArray(e.holdsGraph) ? e.holdsGraph : [e.holdsGraph];
        const kinds = iris
          .filter((t): t is string => typeof t === "string")
          .map((t) => {
            const hit = registry.forIri(t);
            if (hit !== undefined || instanceRoot === undefined) return hit;
            registry.ensureCheckout(checkoutRootFor(instanceRoot));
            return registry.forIri(t);
          })
          .filter((k): k is string => k !== undefined);
        if (kinds.length > 0) e.graphTypologies = kinds;
      }
      delete e["@type"];
      delete e.holdsGraph;
      if (typeof e["@id"] === "string" && e.id === undefined) e.id = (e["@id"] as string).replace(/^#/, "");
      delete e["@id"];
      return e;
    });
  }
  return o;
}

// ── Subgraphs ───────────────────────────────────────────────────

/**
 * A FOLDER CORRESPONDS TO A SUBGRAPH, and subgraphs should be DISCONNECTED.
 *
 * The owner, 2026-09-20, settling bean `x4v4`: *"`cat-harness/methodologies/`
 * is a subgraph. should be disconnected. convention folder corresponds to
 * subgraph (but may be in process of being disentangled). use schema
 * declaration/definition."*
 *
 * The question it settles is not cosmetic. `methodologies/` is declared as a
 * `methodology` graph, and `methodologies/crdm/` and `methodologies/raci/`
 * are declared as `cat-harness` graphs INSIDE it. Nothing said whether the
 * inner graphs' nodes were also the outer one's, and the two readings differ
 * by every node underneath — a consumer scanning `methodologies/` either
 * sees two methodologies or sees two methodologies plus three skills and
 * eight diagrams.
 *
 * **They are not.** A subgraph's nodes are its own. `methodologies/` holds
 * two nodes, and each of those is a graph in its own right.
 *
 * ## Containment is DERIVED, never declared
 *
 * A `parent` or `contains` field would restate what the paths already say,
 * and this repository has paid for one fact in two places often enough to
 * stop writing the second one: the retired skill `roles:` field cost 260
 * dangling values, and `fallbackRole` was removed (bean `85e8`) for exactly
 * this shape — two statements with nothing asserting they agree.
 *
 * So containment is computed from the declaration that already exists. The
 * one thing a reader must know is that **`id` still governs overrides** —
 * path governs only containment. Matching an override on path makes two
 * graphs out of one relocation, which is the rule `resolveDirectories`
 * already states and this does not weaken.
 *
 * ## "Should be" is an intent, and the corpus does not meet it yet
 *
 * Measured 2026-09-20: CRDM's skills reference **seven** skills in
 * `folio-core` (`staging-review`, `interaction-modality`, `todo-manager`,
 * `theme-ui-review`, `directory-conventions`, `decision-comparison`,
 * `data-modelling`). So the methodology subgraphs are entangled today, which
 * is what the owner's *"may be in process of being disentangled"*
 * anticipates.
 *
 * That is why `check:subgraphs` REPORTS and does not gate. A gate that fails
 * on seven edges nobody has yet decided about is the *"check that cries wolf
 * is a check somebody switches off"* failure `known-skills.ts` names — and
 * this session already reached it once by a different route, counting test
 * literals in `check-declared-paths` (bean `dhol`).
 */
export interface SubgraphRelation {
  /** The containing directory's `id`. */
  parent: string;
  /** Directories nested immediately inside it, by `id`. */
  children: string[];
}

/** `a/b/` contains `a/b/c/`; a path never contains itself. */
function pathContains(outer: string, inner: string): boolean {
  const o = `${outer.replace(/\/+$/, "")}/`;
  const i = inner.replace(/\/+$/, "");
  return i !== o.replace(/\/$/, "") && `${i}/`.startsWith(o);
}

/**
 * The subgraph tree, derived from declared paths.
 *
 * Only IMMEDIATE containment: with `a/`, `a/b/` and `a/b/c/` all declared,
 * `a` has one child and not two. A transitive answer would make a node's
 * owner ambiguous, which is the question this whole function exists to give
 * one answer to.
 *
 * Scope matters and is honoured: a `repository`-scoped entry and an
 * instance-relative one resolve against different roots, so they are
 * compared by ABSOLUTE path where one is available. A DAK layer's `methodologies/`
 * is repository-scoped precisely so it lifts out whole, and reading it as a
 * child of an instance-relative `methodologies/` would be wrong on both the
 * path and the intent.
 */
export function subgraphTree(
  dirs: ReadonlyArray<{ id: string; path: string; absPath?: string }>,
): SubgraphRelation[] {
  const key = (d: { path: string; absPath?: string }): string => d.absPath ?? d.path;
  const out: SubgraphRelation[] = [];
  for (const parent of dirs) {
    const children = dirs
      .filter((c) => c.id !== parent.id && pathContains(key(parent), key(c)))
      // Immediate only: drop any child that is itself inside another child.
      .filter((c, _i, all) => !all.some((m) => m.id !== c.id && pathContains(key(m), key(c))))
      .map((c) => c.id)
      .sort();
    if (children.length > 0) out.push({ parent: parent.id, children });
  }
  return out.sort((a, b) => a.parent.localeCompare(b.parent));
}

/**
 * The directory that owns a node at `path`, which is the DEEPEST containing
 * declaration rather than the first one found.
 *
 * This is the function a consumer actually needs, and getting it wrong is the
 * `x4v4` defect in its concrete form: a sweep over `methodologies/` that
 * collects `methodologies/crdm/crdm-detect.md` has attributed a CRDM node to
 * the methodology graph, and every count computed from it is then wrong in a
 * way nothing reports.
 */
export function owningDirectory<T extends { id: string; path: string; absPath?: string }>(
  dirs: readonly T[],
  path: string,
): T | undefined {
  // Compare in the SPACE OF THE PATH GIVEN. `resolveDirectories` populates
  // `absPath`, so keying on it unconditionally makes every relative query
  // return `undefined` — measured on the first run of this function, where
  // all four probes answered "no declaration contains it" over a corpus in
  // which all four are declared.
  //
  // That failure mode is the reason this comment exists rather than a tidier
  // one-liner: `undefined` is a LEGITIMATE answer (a node in no declared
  // directory), so a mismatch does not look like a bug, it looks like a
  // finding. A sweep built on it would have reported a clean, empty result
  // over the whole corpus.
  const absolute = path.startsWith("/");
  const keyOf = (d: T): string | undefined => (absolute ? d.absPath : d.path);
  const containing = dirs.filter((d) => {
    const k = keyOf(d);
    return k !== undefined && pathContains(k, path);
  });
  if (containing.length === 0) return undefined;
  return containing.reduce((deep, d) => ((keyOf(d) ?? "").length > (keyOf(deep) ?? "").length ? d : deep));
}

// ── Inheritance ─────────────────────────────────────────────────

/** A directory after inheritance, with the layer that declared it. */
export interface ResolvedDirectory extends ContentDirectory {
  /** Name of the layer whose declaration contributed this entry. */
  declaredBy: string;
  /** Absolute path, resolved against the layer that declared it. */
  absPath: string;
  /**
   * True when this entry is the ROOT layer's — its own declaration, or its
   * own member of an inherited subgraph.
   */
  own: boolean;
  /**
   * The layer whose directory this is. A declared subgraph is inherited as
   * one MEMBER per layer in the chain whose same-named directory exists
   * (owner, 2026-09-30, bean `3r47`/`xsqm` follow-up, option A: "if f-a-core
   * … has a docs/ … and depends on cat-harness where docs/ is declared …
   * the viewer should detect f-a-core/docs", "a named (sub-)subgraph of
   * docs"). The declarer's own member comes first; `member` names each.
   */
  member?: string;
  /**
   * The id of the directory that declared this one FROM WITHIN (bean `cmsl`,
   * owner 2026-09-30): an entry of its kind's declaration file, e.g.
   * `skills/skills.json` naming `voices/`. Absent for an instance-level entry.
   * `check:layout-norms` reads it: nesting declared this way is the sanctioned
   * shape, not a root declaration reaching down.
   */
  within?: string;
  /**
   * The nearest opt-in sub-graph this entry is, or sits within, qualified
   * `<instance>.<id>` (`opt-in-subgraphs.ts`). Absent for an entry outside
   * every opt-in sub-graph — which, while nothing is opt-in, is every entry.
   * Only entries of sub-graphs switched ON are ever resolved at all.
   */
  optInSubgraph?: string;
  /**
   * The CONVENTION of an inherited opt-in sub-graph the root has not switched
   * on, for a kind every layer holds its own of ({@link isPerInstance}):
   * the root's own directory at the entry's path, and nothing of the
   * declarer's. Owner, 2026-11-13, card "library/" option A: core's corpus
   * became opt-in (Q-SG-3 A), and a dependent of core still has a `library/`
   * of its own. No other layer's directory is a member of it.
   */
  conventionOnly?: boolean;
}

/** What {@link resolveDirectories} is asked to resolve FOR. */
export interface ResolveOptions {
  /**
   * The opt-in sub-graphs switched on. Absent: the chain ROOT's own
   * `enableSubgraphs`, adjusted by `CAT_SUBGRAPHS` — the root is who the
   * resolution is for. `"all"` for a reader enumerating what is declared.
   */
  enabledSubgraphs?: EnabledSubgraphs;
}

/**
 * Resolve the directories a layer scans, including inherited ones.
 *
 * `chain` runs deepest dependency first and the root last, so a root
 * redeclaring an inherited id wins. Callers usually get this from
 * `orderedDependencies(root)` plus the root itself;
 * it is taken as a parameter rather than walked here so this module does not
 * depend on the dependency resolver, and so tests can state a chain directly.
 */
/**
 * Directory ids that were renamed, read as their new id so that a declaration
 * written before the rename still overrides the entry it always meant.
 *
 * `cat-harness` → `skills`, 2026-09-23 (bean iwtn): a Subgraph's id is its own
 * name within its Harness, and the Harness name is the qualifier
 * (`bootstrap.skills`, `cat-harness.skills`), so a Subgraph named after a
 * Harness named the wrong thing.
 */
export const RENAMED_DIRECTORY_IDS: Readonly<Record<string, string>> = { "cat-harness": "skills" };

/**
 * The absolute path of a directory this layer declares by `id`, or the
 * convention fallback joined to `root`.
 *
 * **`scope: "repository"` entries are excluded on purpose.** A layer may
 * declare two entries with the same `path` and different scopes — this
 * repository declares `docs` (instance-scoped, resolving under
 * `cat-harness/`) and `root-docs` (`scope: "repository"`, resolving under the
 * REPOSITORY root). They are different directories wearing one path, so a
 * caller asking for "this instance's own `docs`" must not be handed the
 * repository's.
 *
 * Lifted out of `scripts/kg-audit.ts` (2026-09-30) when a second caller
 * appeared. Its reasoning there is kept because it is the reason the lookup is
 * BY ID rather than by kind: *"a by-kind lookup that happens to work while one
 * directory exists is a call that starts throwing the day a second is
 * declared, and it would be asking the wrong question even while it worked."*
 * The `docs`/`root-docs` pair is that second directory, and it exists now.
 *
 * @param root the layer root to resolve against
 * @param id the declared entry's `id`
 * @param fallback a path relative to `root`, used when nothing is declared
 */
export function ownDirectoryById(root: string, id: string, fallback: string): string {
  const found = resolveDirectories([{ name: "(local)", root, own: true }]).find(
    (d) => d.id === id && d.own && d.scope !== "repository",
  );
  return found?.absPath ?? join(root, fallback);
}

/**
 * The opt-in sub-graphs a resolution rooted at `root` sees when its caller
 * names none.
 *
 * - A layer no mount placed (the checkout's own, or the checkout root):
 *   its own `enableSubgraphs`, adjusted by `CAT_SUBGRAPHS`.
 * - A layer a MOUNT placed: the list of the root that mounted it
 *   (`mountScopeFor`), never the mounted layer's own. Owner, 2026-11-12, card
 *   Q-OPTIN-DIRS A: *"CI checks should align on opt in/out"*. The mount laid
 *   the layer down with that root's list (`defaultMountDirectoryIds`,
 *   `switchedOffOptInPaths`), so a check resolving the mounted layer by the
 *   layer's own list judged groups the consumer had switched off — and
 *   missed ones the consumer had switched on and the layer had not.
 *
 * The mounting root's list is read structurally (`declaredEnableSubgraphs`):
 * its declaration may name kinds only its own layers register.
 */
export function defaultEnabledSubgraphs(root: string, registry: GraphTypologyRegistry = defaultGraphTypologies): EnabledSubgraphs {
  const mounting = mountScopeFor(root);
  if (mounting !== undefined) return closeOverRequires(enabledSubgraphsFrom(declaredEnableSubgraphs(mounting)), declaredOptInRequires(mounting));
  return closeOverRequires(enabledSubgraphsFrom(readDeclaration(root, registry)?.enableSubgraphs ?? declaredEnableSubgraphs(root)), declaredOptInRequires(root));
}

export function resolveDirectories(
  chain: Array<{ name: string; root: string; own?: boolean }>,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
  opts: ResolveOptions = {},
): ResolvedDirectory[] {
  const byId = new Map<string, ResolvedDirectory>();

  // The outermost link: the conventional set, for the root of the chain.
  //
  // Existence-filtered — see DEFAULT_DIRECTORIES on why a default that is not
  // there is the `dh4f` defect rather than a harmless extra. `declaredBy` says
  // `(default)` so a consumer can tell an inherited convention from something
  // a layer chose, and `own` is false: a default is not the layer's own
  // declaration, it is what it did not have to write.
  const rootLink = chain.find((l) => l.own === true) ?? chain[chain.length - 1];
  // OPT-IN SUB-GRAPHS (cat-harness#991 step 23.1): the ROOT decides — and
  // for a root a mount placed, the root that MOUNTED it ({@link defaultEnabledSubgraphs}).
  const enabled: EnabledSubgraphs = opts.enabledSubgraphs ?? (rootLink ? defaultEnabledSubgraphs(rootLink.root, registry) : enabledSubgraphsFrom(undefined));
  // Each layer's root by the name its entries carry in `declaredBy`, for
  // `optInLeftOutByMount`. Filled as the chain is read below.
  const layerRoots = new Map<string, string>();
  if (rootLink) layerRoots.set(rootLink.name, rootLink.root);
  /**
   * LEFT OUT BY THE MOUNT: the opt-in sub-graph is not on disk, and the lock
   * that placed its layer did not take it (`mountChoiceOf`). The downstream
   * that mounted the layer had it switched off, so the whole mount left it
   * out (`switchedOffOptInPaths`, the lock's `except`); the mounted layer's
   * own `enableSubgraphs` still names it, because that list is the layer's,
   * for itself. The folio decided, and its decision is the lock: read as
   * switched off here, not as a declared directory gone missing.
   *
   * Only for the default resolution. A caller that passes `enabledSubgraphs`
   * has said what is on (a folio's set, or `"all"` for what is declared).
   * A directory the mount DID take, or one no lock placed, that is absent
   * stays exactly what it was: a declared directory that is not there.
   */
  const optInLeftOutByMount = (e: ResolvedDirectory): boolean => {
    if (opts.enabledSubgraphs !== undefined) return false;
    const layerRoot = e.declaredBy === undefined ? undefined : layerRoots.get(e.declaredBy);
    return layerRoot !== undefined && leftOutByMount(layerRoot, e.absPath);
  };
  /** The entry's nearest opt-in sub-graph, given its parent's; `null` when that one is switched off. */
  const optInOf = (e: ResolvedDirectory, parent?: string): string | undefined | null => {
    const own = ownOptInId(e);
    const q = own ?? parent;
    if (q !== undefined && !isSubgraphEnabled(enabled, q)) return null;
    if (own !== undefined && optInLeftOutByMount(e)) return null;
    return q;
  };
  /**
   * What is left of a switched-off entry for the root: nothing, unless it is
   * INHERITED and of a kind each layer holds its own of. Then the root keeps
   * the convention (its own directory at that path), never the declarer's
   * content, which is what being switched off withholds.
   */
  const conventionOf = (e: ResolvedDirectory): ResolvedDirectory | undefined => {
    if (!rootLink || e.own === true || e.scope === "repository" || !isPerInstance(e, registry)) return undefined;
    const { optInSubgraph: _q, optIn: _o, ...rest } = e as ResolvedDirectory & { optIn?: unknown };
    return { ...rest, absPath: resolve(rootForScope(rootLink.root, e.scope), e.path), own: false, conventionOnly: true };
  };
  if (rootLink) {
    for (const dir of DEFAULT_DIRECTORIES) {
      const absPath = resolve(rootLink.root, dir.path);
      if (!existsSync(absPath)) continue;
      byId.set(dir.id, { ...dir, declaredBy: "(default)", absPath, own: false });
    }
  }

  for (const link of chain) {
    const decl = readDeclaration(link.root, registry);
    if (!decl) continue;
    if (!layerRoots.has(decl.name)) layerRoots.set(decl.name, link.root);
    for (const dir of decl.directories) {
      // A REPOSITORY-scoped entry is not inherited. `beans/` and `todos/` are
      // this repository's work plan and this person's outstanding items; a
      // dependency's repository is a different checkout, so inheriting its
      // entry would point every consumer at somebody else's store. The
      // never-overlaid property of those two directories was a rule an agent
      // had to remember until this line; now the resolver holds it.
      if (dir.scope === "repository" && link.own !== true) continue;
      // Override by id, replacing in place so the inherited ORDER is kept: a
      // relocation should not reshuffle what a consumer scans first.
      const id = RENAMED_DIRECTORY_IDS[dir.id] ?? dir.id;
      byId.set(id, {
        ...dir,
        id,
        declaredBy: decl.name,
        absPath: resolve(rootForScope(link.root, dir.scope), dir.path),
        own: link.own === true,
      });
    }
    }

  // A switched-off opt-in sub-graph is left out here, before anything is
  // promoted from within it or gets a member: invisible, with everything in it.
  for (const [id, d] of [...byId]) {
    const q = optInOf(d);
    if (q === null) {
      const c = conventionOf(d);
      if (c) byId.set(id, c);
      else byId.delete(id);
    } else if (q !== undefined) byId.set(id, { ...d, optInSubgraph: q });
  }

  // Directories declared FROM WITHIN (bean `cmsl`, owner 2026-09-30, round 4):
  // an entry in a resolved directory's declaration file (`skills/skills.json`)
  // that answers the `dependents` question is a LAYER directory, declared
  // where the owner's #980 ruling says nesting must be. Entries that do not
  // answer it (`beans/beans.json`'s `defs`, `docs/docs.json`'s `proposals`,
  // `voices/voices.json`'s `vendors`) are parts of one graph rather than
  // layer directories, and stay out of this list exactly as before.
  // An instance-level entry with the same id wins, so a declaration can move
  // inward without two answers existing at once.
  for (const d of [...byId.values()]) promoteFromWithin(d, byId, registry, new Set(), rootLink, optInOf, conventionOf);

  // MEMBERS (option A, owner 2026-09-30). A subgraph declared once is
  // inherited by every layer in the chain: each whose `<root>/<path>`
  // exists contributes its own member, a named sub-subgraph of the declared
  // one — "if f-a-core … has a docs/ … and depends on cat-harness where docs/
  // is declared …, the viewer should detect f-a-core/docs". The declarer's
  // member comes first, so a consumer looking a subgraph up by id is handed
  // the same directory as before. Existence-filtered (the `dh4f` rule); a
  // repository-scoped entry has one location by definition; a path another
  // entry already covers is not listed twice.
  //
  // NESTED MEMBERS (placement PR0c, bean `ejye`). The same rule one level
  // down, for a sub-subgraph declared FROM WITHIN: the harness declares a
  // group once (`skills/skills.json` naming `library/`), and each layer's
  // same-named `skills/library/` is a member of it. And a MEMBER's own
  // declaration file is read as well as the declarer's — before this, sci's
  // `skills/skills.json` (naming `lean/`, `data/`, `voices/`) was read only
  // when sci was resolved ALONE, because in sci's chain `skills` is
  // cat-harness's entry and only cat-harness's `skills.json` was opened. A
  // worklist, so a member's from-within entry gets members of its own.
  const out: ResolvedDirectory[] = [...byId.values()].map((d) => ({ ...d, member: d.member ?? d.declaredBy }));
  const seen = new Set(out.map((d) => d.absPath));
  const nameOf = new Map(chain.map((l) => [l.root, readDeclaration(l.root, registry)?.name ?? l.name]));
  const work = [...out];
  while (work.length > 0) {
    const d = work.shift()!;
    if (d.scope === "repository" || d.conventionOnly) continue;
    for (const link of chain) {
      const abs = resolve(link.root, d.path);
      if (seen.has(abs) || !existsSync(abs)) continue;
      seen.add(abs);
      const member = nameOf.get(link.root) ?? link.name;
      const m = { ...d, absPath: abs, own: link.own === true, member };
      out.push(m);
      work.push(m);
      for (const nd of declaredFromWithin(m.absPath, m.graphTypologies, registry)) {
        const nAbs = join(m.absPath, nd.sub);
        if (seen.has(nAbs)) continue;
        seen.add(nAbs);
        const e = {
          ...nd.entry,
          path: `${d.path.replace(/\/+$/, "")}/${nd.sub}/`,
          declaredBy: member,
          absPath: nAbs,
          own: m.own,
          member,
          within: d.id,
        } as ResolvedDirectory;
        const q = optInOf(e, d.optInSubgraph);
        if (q === null) continue;
        if (q !== undefined) e.optInSubgraph = q;
        else delete e.optInSubgraph;
        out.push(e);
        work.push(e);
      }
    }
  }
  return out;
}

/**
 * The layer directories a directory's kind-declaration file names FROM
 * WITHIN (`"subgraph": true` entries), unresolved: each with its single path
 * segment `sub`. Unparseable or absent files yield nothing —
 * `check:harness-dirs` owns that finding.
 */
function declaredFromWithin(
  absPath: string,
  graphTypologies: readonly string[],
  registry: GraphTypologyRegistry,
): Array<{ sub: string; entry: ContentDirectory }> {
  const files = graphTypologies
    .map((g) => registry.get(g)?.declarationFile)
    .filter((f): f is string => typeof f === "string");
  const out: Array<{ sub: string; entry: ContentDirectory }> = [];
  for (const f of [...new Set(files)]) {
    const p = join(absPath, f);
    if (!existsSync(p)) continue;
    let nested: { directories?: Array<Record<string, unknown>> };
    try {
      projectedRead(p, "nested-directories"); // only `directories` is used below
      nested = JSON.parse(readFileSync(p, "utf-8"));
    } catch {
      continue;
    }
    for (const nd of nested.directories ?? []) {
      // `nd.subgraph !== true` was a third condition here until 2026-10-04.
      // It withheld 29 directories from EVERY store-side consumer —
      // `branch-store`, `graph-read`, `audit-coverage`, `state-mount` — while
      // `nestedDirectories` (the other walk over the same declaration files,
      // read by `check:declared-dirs` and `check:requirements`) ignored it. One
      // fact, two readers, opposite answers: the shape of #2069's enum drift.
      //
      // It was never in the schema. No `subgraph: z.boolean()`, no `subgraph?:`
      // field — it was read off an untyped object here and nowhere else, so
      // nothing validated it and nothing required it. It appeared in 5 files,
      // all `skills/skills.json`, and was absent from `beans/beans.json`,
      // `docs/docs.json` and `auto-docs.json`. Removing it resolved 144 -> 173
      // directories, including `auto-docs.json`'s ten sub-sub-graphs: the
      // owner's 2026-10-03 ruling was implemented and unreachable.
      //
      // Measured consequences, all repaired in the same change because an
      // exposed finding is still a finding: `check:layout-norms` saw
      // `beans/defs contains beans/defs/archive` (siblings in one declaration
      // file, now sanctioned there) and `check:subgraphs` saw one genuinely
      // broken link in `docs/proposals/` that it could not previously reach.
      if (typeof nd.id !== "string" || typeof nd.path !== "string") continue;
      const sub = nd.path.replace(/^\.\//, "").replace(/\/+$/, "");
      out.push({ sub, entry: nd as unknown as ContentDirectory });
    }
  }
  return out;
}

/**
 * A layer's OWN sub-graphs: its declaration's entries as authored, then
 * the ones it declares FROM WITHIN them (bean `cmsl`: `skills/skills.json`
 * declaring `voices/`), with paths relative to the layer root.
 *
 * For a consumer that enumerates "the sub-graphs this instance has" — one
 * diagram, one page, one visualiser per entry. Reading `decl.directories`
 * alone silently drops every entry that moved inward: measured 2026-09-30,
 * the UML overview deleted five voices diagrams and `check:wireframes`
 * reported five voices pages as undeclared, with nothing else red.
 *
 * Unlike {@link nestedDirectories} this also reaches a nested declaration
 * under a DEFAULT parent (agent-skills never declares `skills/`), and it
 * returns only entries that answer `dependents` — the layer directories,
 * not the parts of one graph (`voices.json`'s `vendors`).
 */
export function instanceDirectories(
  root: string,
  decl: CatHarnessDeclaration | undefined = readDeclaration(root),
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): Array<ContentDirectory & { within?: string }> {
  if (!decl) return [];
  const authored = decl.directories ?? [];
  const ids = new Set(authored.map((d) => d.id));
  // `"all"`: what the layer DECLARES, opt-in sub-graphs included — this
  // enumerates sub-graphs, it does not decide what a folio is given.
  const inward = resolveDirectories([{ name: decl.name, root, own: true }], registry, { enabledSubgraphs: "all" })
    .filter((d) => d.own && d.within !== undefined && !ids.has(d.id))
    .map(({ declaredBy: _b, absPath: _a, own: _o, ...rest }) => rest as ContentDirectory & { within?: string });
  return [...authored, ...inward];
}

/**
 * Whether a repository-scoped entry's store belongs to the layer that
 * declared it: the repository root is that layer, or declares none.
 */
function repositoryIsUnowned(
  d: ResolvedDirectory,
  rootLink: { root?: string } | undefined,
  registry: GraphTypologyRegistry,
): boolean {
  const depth = d.path.split("/").filter((s) => s !== "" && s !== ".").length;
  const repoRoot = resolve(d.absPath, ...Array<string>(depth).fill(".."));
  if (rootLink?.root !== undefined && resolve(rootLink.root) === repoRoot) return true;
  try {
    return readDeclaration(repoRoot, registry) === undefined;
  } catch {
    return false; // unreadable is `check:harness-dirs`'s to report, and is not "undeclared"
  }
}

/** Add `d`'s from-within layer directories to `byId`, recursively. */
function promoteFromWithin(
  d: ResolvedDirectory,
  byId: Map<string, ResolvedDirectory>,
  registry: GraphTypologyRegistry,
  seen: Set<string>,
  rootLink: { name: string; root?: string; own?: boolean } | undefined,
  optInOf: (e: ResolvedDirectory, parent?: string) => string | undefined | null = () => undefined,
  conventionOf: (e: ResolvedDirectory) => ResolvedDirectory | undefined = () => undefined,
): void {
  if (seen.has(d.absPath)) return;
  seen.add(d.absPath);
  // Never through a MIRROR. A `scope: "repository"` entry is this layer
  // pointing at another layer's directory (cmsl's group 2, the wrong-way
  // arrow), and what that directory declares from within belongs to ITS owner.
  // Following it made cat-harness resolve core's `voices/` as its own the
  // moment core declared it from within (measured 2026-09-30).
  //
  // Unless nobody else owns it. When the repository's root IS this layer,
  // or declares no layer at all (the index checkout, owner 2026-10-08:
  // "folio-asst should not need folio-assistant declared at all"), the store
  // this entry names has no other owner to defer to. Returning here then left
  // `todos/todos.json`'s `items` and `beans/beans.json`'s `defs` attributed to
  // `(root)` — a layer that does not exist (measured 2026-10-09).
  if (d.scope === "repository" && !(d.own === true && repositoryIsUnowned(d, rootLink, registry))) return;
  const files = d.graphTypologies
    .map((g) => registry.get(g)?.declarationFile)
    .filter((f): f is string => typeof f === "string");
  for (const f of [...new Set(files)]) {
    const p = join(d.absPath, f);
    if (!existsSync(p)) continue;
    let nested: { directories?: Array<Record<string, unknown>> };
    try {
      projectedRead(p, "nested-directories"); // only `directories` is used below
      nested = JSON.parse(readFileSync(p, "utf-8"));
    } catch {
      continue; // `check:harness-dirs` owns an unparseable declaration and says so
    }
    for (const nd of nested.directories ?? []) {
      // `"subgraph": true` marks an entry that is a subgraph of the LAYER
      // (skills.json's `voices`), not a part of its parent's graph
      // (beans.json's `defs`, docs.json's `proposals`). It answered the retired
      // `dependents` question until 2026-09-30 (option A); the fact it carried
      // here was never about dependents, so it is now stated as what it is.
      if (typeof nd.id !== "string" || typeof nd.path !== "string") continue;
      // An instance-level DECLARATION with this id wins; a built-in DEFAULT
      // (`declaredBy: "(default)"`, e.g. `skills/voices`) is a convention, and
      // a from-within declaration is stronger than a convention.
      const existing = byId.get(nd.id);
      // A convention left by a switched-off sub-graph is overridden like a
      // default: a later layer's declaration of the same id wins, as it does
      // at the top level.
      if (existing !== undefined && existing.declaredBy !== "(default)" && existing.conventionOnly !== true) continue;
      const sub = nd.path.replace(/^\.\//, "").replace(/\/+$/, "");
      // A DEFAULT parent (`skills/` that the layer never declared) is still
      // a directory in the root link's own tree — the defaults are seeded
      // against it — so the file that declares from within it was written by
      // that layer. Inheriting `(default)`/`own: false` from the parent made
      // agent-skills' and sci's `voices/` look like nobody's, and the UML
      // overview dropped both (measured 2026-09-30).
      const fromDefault = d.declaredBy === "(default)" && rootLink !== undefined;
      const entry = {
        ...(nd as unknown as ContentDirectory),
        // A from-within entry's `path` is spelled from its PARENT's path, so it
        // resolves against the parent's root: it inherits the parent's `scope`
        // unless it states its own. Without this, `beans/beans.json`'s `defs`
        // under the repository-scoped `beans/` resolved against the LAYER,
        // and `materialiseDirectories` refused (`harness:dirs:check`).
        ...(d.scope !== undefined && (nd as { scope?: unknown }).scope === undefined ? { scope: d.scope } : {}),
        path: `${d.path.replace(/\/+$/, "")}/${sub}/`,
        declaredBy: fromDefault ? rootLink.name : d.declaredBy,
        absPath: join(d.absPath, sub),
        own: fromDefault ? rootLink.own === true : d.own,
        within: d.id,
      } as ResolvedDirectory;
      // Within a switched-off opt-in sub-graph: not promoted, nor anything below it.
      const q = optInOf(entry, d.optInSubgraph);
      if (q === null) {
        // Switched off: nothing below it is promoted, but an inherited
        // per-instance kind leaves the root its convention.
        const c = conventionOf(entry);
        if (c) byId.set(nd.id, c);
        continue;
      }
      if (q !== undefined) entry.optInSubgraph = q;
      else delete entry.optInSubgraph;
      byId.set(nd.id, entry);
      promoteFromWithin(entry, byId, registry, seen, rootLink, optInOf, conventionOf);
    }
  }
}

/**
 * The graph typology that holds skills, workflows and roles.
 *
 * Named once because two different resolvers ask for it, and a second spelling
 * is how one of them goes missing when the layout moves.
 */
/**
 * The role a layer's agent-instruction file declares.
 *
 * One constant because the declaration writes it and every checker reads it,
 * and a role spelled twice is a role one side stops finding.
 */
export const AGENT_INSTRUCTIONS_ROLE = "agent-instructions";

/** The role a layer's reader-facing README declares. */
export const INSTANCE_README_ROLE = "instance-readme";

/**
 * The role of a layer's node-kind ratchet baseline: the families IT owns
 * that may stay unkinded (`schemas/kg/node-kind-index.ts`, {@link UnkindedBaselineKind}
 * there). Owner, 2026-10-15: one baseline per layer, so a layer's own families
 * are judged by its own commit, and the cross-layer table is built at publish.
 */
export const UNKINDED_BASELINE_ROLE = "unkinded-baseline";

/**
 * How a declared asset REACHES the agent that needs it.
 *
 * Two values, and the line between them is mechanical rather than a matter of
 * taste. **`injected`** is spliced into a prompt, so it pays the harness's
 * budget — `MEMORY.md`'s first 200 lines, *with the overflow dropped
 * silently*. **`file`** is opened by a reader, so nothing truncates it.
 *
 * That is why `AGENTS.md` may be long and a memory entry may not, and it is
 * the reason the rule is worth declaring rather than describing: a rule in
 * prose cannot be asked, and `agent-memory.md` carried this one as a table for
 * a day with nothing able to check it.
 */
export type AssetDelivery = "file" | "injected";

/** What a declared asset ROLE means — asked once, for every layer. */
export interface AssetRoleDef {
  /** What this artefact is FOR — one line. */
  purpose: string;
  /**
   * Which {@link GraphLayer} the role's file belongs to.
   *
   * **REQUIRED, for {@link GraphTypologyDef.holds}'s reason.** An optional field
   * would make "did not say" indistinguishable from `content`, and the whole
   * point of declaring it is that a step writing to a `context` asset is a
   * DEFECT rather than an update. `tsc` refuses a role that does not say.
   */
  layer: GraphLayer;
  /** {@link AssetDelivery} — and required, so a new role decides it at the keyboard. */
  delivery: AssetDelivery;
}

/**
 * What each asset role is, declared once — purpose, layer and delivery.
 *
 * ## Why this lives on the ROLE and not on the asset
 *
 * The owner, 2026-09-20, on `AGENTS.md`:
 *
 * > it is an asset and has a defined purpose (that is part of skills of
 * > mantiaing agent memroies)
 *
 * A `purpose` field beside `role` on every asset would be a second answer to
 * one question, free to disagree with the first: eleven layers would each
 * spell out what `instance-readme` is for, and the eleventh would say
 * something slightly different. The role already IS the purpose — this is
 * where the role says so, once, for every layer that declares it.
 *
 * It was tried the other way first. A `purpose` key was written into
 * `cat-harness/harness.json` and {@link KgAssetSchema} silently stripped it,
 * which is worse than absent: the declaration read as if it carried a purpose
 * and no consumer ever saw one. {@link strayAssetRoleKeys} is what now catches
 * that, because the stripping is silent by design and will stay that way.
 *
 * ## Why one table and not three maps
 *
 * `purpose`, `layer` and `delivery` were nearly added as three
 * `Record<string, …>` constants side by side. Three maps keyed on the same
 * thing is a shape where one gains a key the others lack and nothing says so —
 * a role with a purpose and no layer would read as governed, and
 * `assetRoleLayer` would return `undefined` for a role this layer plainly
 * owns. One record of objects makes that state unrepresentable.
 *
 * ## Both are `context`, and the owner said so in those words
 *
 * > its static content at process runtime and treated as an asset like
 * > memories
 *
 * That is {@link GraphLayer | `context`} word for word — READ at session
 * start, never written by a running process — and it is the same layer agent
 * memory holds, which is what *"like memories"* asks for. Bean `7syd`.
 *
 * ## The two that matter, and the line between them
 *
 * `instance-readme` says what the layer IS; `agent-instructions` says what
 * to DO. The second **augments and never restates** the first — the owner
 * again, on the same day:
 *
 * > agents.md should give good coldstart instructions (dont duplicatae
 * > readme.md) but augment.
 *
 * That is checkable rather than a matter of taste, and it is why both are
 * required of every layer: a reader arriving with either question is
 * entitled to a file that answers only theirs.
 *
 * Absent from this map means the role is one this layer does not govern —
 * `bootstrap-initialization` is bootstrap's, and a purpose invented
 * for it here would be the platform speaking for a layer it does not own.
 */
export const ASSET_ROLES: Readonly<Record<string, AssetRoleDef>> = {
  [INSTANCE_README_ROLE]: {
    purpose:
      "What this instance IS, for a reader — its entry point, and the human half of the pair.",
    layer: "context",
    delivery: "file",
  },
  [AGENT_INSTRUCTIONS_ROLE]: {
    purpose:
      "What a cold agent DOES here, in order — augmenting the README rather than restating it, and read as a file so no injection budget truncates it.",
    layer: "context",
    delivery: "file",
  },
  // `context`: no process writes it. It shrinks when an author runs
  // `node-kinds` after kinding a family, and grows only by the deliberate
  // `--accept-unkinded` — both authoring acts, outside any process.
  [UNKINDED_BASELINE_ROLE]: {
    purpose:
      "The families THIS instance owns that may stay without a node kind — the ratchet `node-kinds:check` holds them to, so a new unkinded family fails.",
    layer: "context",
    delivery: "file",
  },
};

/**
 * What a role's asset is for, or `undefined` for a role this layer does not
 * govern. The accessor exists so a caller reads {@link ASSET_ROLES} through
 * one door, as the graph-typology registry is read through `get`.
 */
export function assetRolePurpose(role: string): string | undefined {
  return ASSET_ROLES[role]?.purpose;
}

/**
 * Which layer a role's asset belongs to, or `undefined` for an ungoverned role.
 *
 * `undefined` is the THIRD STATE and is never to be read as a permissive
 * default: it means nobody here has classified this role, not that the file is
 * free for a process to rewrite. {@link processMayWriteAsset} preserves it for
 * exactly that reason.
 */
export function assetRoleLayer(role: string): GraphLayer | undefined {
  return ASSET_ROLES[role]?.layer;
}

/** How a role's asset reaches its reader, or `undefined` for an ungoverned role. */
export function assetRoleDelivery(role: string): AssetDelivery | undefined {
  return ASSET_ROLES[role]?.delivery;
}

/**
 * May a running process WRITE a declared asset of this role?
 *
 * `undefined` when the role is not one this layer governs — *could not
 * determine*, which a caller must not render as either answer. A gate treats
 * it as a finding; a consumer that needs a decision asks the layer that owns
 * the role.
 *
 * The rule itself is {@link layerIsWritable}, shared with
 * {@link processMayWrite} so that assets and graphs cannot come to disagree
 * about what `context` permits. Two predicates spelling `=== "state"`
 * separately is how one of them survives a fourth layer being added.
 */
export function processMayWriteAsset(role: string): boolean | undefined {
  const layer = assetRoleLayer(role);
  return layer === undefined ? undefined : layerIsWritable(layer);
}

/**
 * Asset declarations carrying a key that the ROLE already answers.
 *
 * {@link KgAssetSchema} is a non-strict `z.object`, so an unknown key is
 * dropped without a word — and that is not a defect to fix here, because the
 * schema is also how a downstream layer carries a key this layer has not
 * learned about yet. What it costs is recorded above: a `purpose` written into
 * `cat-harness/harness.json` read as if it carried one, and no consumer ever
 * saw it.
 *
 * So the finding is raised against the RAW declaration rather than the parsed
 * one — after parsing, the evidence is gone. Returns one entry per offending
 * key, with the layer root and the asset id, because "some instance has a
 * stray key" is not something anybody can act on.
 */
export function strayAssetRoleKeys(
  root: string,
): Array<{ root: string; asset: string; key: string }> {
  const file = findDeclarationFile(root);
  if (file === undefined) return [];
  const p = join(root, file);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    // A declaration that will not parse is a finding somebody else already
    // raises loudly; reporting it a second time here would send a reader to
    // the wrong check. It is NOT silently clean either — `readDeclaration`
    // throws on it, so no caller reaches a verdict through this path.
    return [];
  }
  const assets = (raw as { assets?: unknown })?.assets;
  if (!Array.isArray(assets)) return [];
  const out: Array<{ root: string; asset: string; key: string }> = [];
  for (const a of assets) {
    if (typeof a !== "object" || a === null) continue;
    const rec = a as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id : typeof rec.src === "string" ? rec.src : "<unnamed>";
    for (const key of ROLE_OWNED_ASSET_KEYS) {
      if (key in rec) out.push({ root, asset: id, key });
    }
  }
  return out;
}

/**
 * The keys an asset may NOT restate, because {@link ASSET_ROLES} answers them.
 *
 * Derived from the interface rather than typed out, so adding a field to
 * {@link AssetRoleDef} cannot leave this list behind — the failure this whole
 * mechanism exists to catch, reproduced one level up.
 */
export const ROLE_OWNED_ASSET_KEYS = [
  "purpose",
  "layer",
  "delivery",
] as const satisfies readonly (keyof AssetRoleDef)[];

export const REQUIRED_ASSET_ROLES = [INSTANCE_README_ROLE, AGENT_INSTRUCTIONS_ROLE] as const;

/**
 * Is this checkout an ACTIVE knowledge graph, or a static one?
 *
 * The question an arriving agent asks before anything else, and the owner's
 * own framing (2026-09-20):
 *
 * > tell them to determine if active KG (beans/tods) or static (point to
 * > process on determining context)
 *
 * **ACTIVE** means somebody has work recorded here that an arriving agent
 * could pick up: beans, todos, or a BPMN instance mid-flight. **STATIC**
 * means the graph is there to be read.
 *
 * ## Asked of the REPOSITORY, not of one layer
 *
 * Measured 2026-09-21: the root layer declares no work-plan graph and
 * `cat-harness` declares `beans` and `todos` at `scope: "repository"`. So a
 * person standing at the repository root plainly has a work plan while the
 * root layer alone scores static. The question is about the checkout —
 * "is there work recorded anywhere I can see" — and answering it per layer
 * gets it wrong for the one place a reader actually stands.
 *
 * ## Derived, never listed
 *
 * The set is read from {@link GraphTypologyDef.recordsWork}, so adding a graph
 * kind forces the decision at the kind rather than requiring somebody to
 * remember a list here. A hardcoded set would be a list pretending to be a
 * rule — the shape this repository keeps paying for.
 */
export function workPlanGraphsIn(
  repoRoot: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): { plan: Array<{ instance: string; kinds: string[] }>; unreadable: string[] } {
  const plan: Array<{ instance: string; kinds: string[] }> = [];
  const unreadable: string[] = [];
  for (const root of layerRootsIn(repoRoot)) {
    let decl;
    try {
      decl = readDeclaration(root, registry);
    } catch {
      // REPORTED, never skipped. An unreadable declaration is "could not
      // determine", and swallowing it renders STATIC — which would send an
      // agent past a work plan nobody could parse, telling it there is
      // nothing here. The first draft of this function did exactly that.
      unreadable.push(root);
      continue;
    }
    if (decl === undefined) continue;
    const kinds = [
      ...new Set((decl.directories ?? []).flatMap((d) => d.graphTypologies ?? [])),
    ].filter((k) => registry.get(k)?.recordsWork === true);
    if (kinds.length > 0) plan.push({ instance: decl.name ?? root, kinds: kinds.sort() });
  }
  return { plan, unreadable };
}

/**
 * {@link workPlanGraphsIn} as the answer an arriving agent needs — and it has
 * THREE values, not two.
 *
 * `undefined` is "could not determine": some declaration in this checkout did
 * not parse, so the absence of a work plan is unproven. A boolean would
 * collapse that into `false` and tell the agent there is nothing here.
 */
export function isActiveKg(
  repoRoot: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): boolean | undefined {
  const { plan, unreadable } = workPlanGraphsIn(repoRoot, registry);
  if (plan.length > 0) return true;
  return unreadable.length > 0 ? undefined : false;
}

/**
 * State kinds that have not said whether they record work.
 *
 * Empty is the contract, enforced by `check:graph-typology-work`. The field is
 * optional in the TYPE because it is meaningless for `content`, `context` and
 * `derived` — a required field would force three layers to answer a question
 * that does not apply to them — so the "cannot ship undecided" property lives
 * in a gate instead, which is how this repository handles the same shape
 * elsewhere.
 */
export function undecidedWorkKinds(
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): string[] {
  // `names()` then `get()`, because the registry is not iterable — it exposes
  // `has`/`get`/`names` so that a deprecated kind spelling resolves in exactly
  // one place. Iterating its private map would bypass that.
  return registry
    .names()
    .filter((name) => {
      const def = registry.get(name);
      return def?.holds === "state" && def.recordsWork === undefined;
    })
    .sort();
}

/**
 * Where a declared asset of this role actually is, or `undefined` if the
 * layer declares none.
 *
 * The point of asking rather than composing `join(root, "README.md")`: an
 * asset carries a {@link DeclarationScope}, and this layer's README and
 * `AGENTS.md` are the REPOSITORY's — one of each per checkout, however many
 * layers it holds. `readme:sync` and `readme:audit` composed the path and
 * so looked inside the layer, where `readme:sync:check` reported "No
 * README" and failed the gate on a file that was one directory up.
 *
 * Existence is NOT filtered here, for the same reason {@link declaredAssets}
 * does not filter it: a declared asset that is missing is a finding, and a
 * caller that silently fell back to a composed path would turn that finding
 * into a different file being checked.
 *
 * The first declared entry when a role has several — the same rule as
 * `assetsForRole`, which callers wanting all of them should use instead.
 */
export function declaredAssetPath(
  root: string,
  role: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): string | undefined {
  return declaredAssets(root, registry).find((a) => a.role === role)?.absPath;
}

/**
 * This layer's declared assets, resolved to absolute paths.
 *
 * Existence is reported rather than filtered, unlike the directory defaults:
 * a declared asset that is missing is a FINDING — somebody said this file is
 * ours and it is not there — whereas a conventional directory that is absent
 * is simply a convention this layer did not take up. Silently dropping the
 * first would reproduce `dh4f` in the one place the declaration is an
 * assertion rather than a guess.
 */
export function declaredAssets(
  root: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): Array<KgAsset & { absPath: string; exists: boolean }> {
  const decl = readDeclaration(root, registry);
  return (decl?.assets ?? []).map((a) => {
    const absPath = resolve(rootForScope(root, a.scope), a.src);
    return { ...a, absPath, exists: existsSync(absPath) };
  });
}

export const KG_GRAPH_TYPOLOGY = "cat-harness";

/**
 * The kinds whose directories hold SKILL BODIES, and may be scanned for them.
 *
 * `cat-harness` is here because a downstream declaration that has not migrated
 * still spells a skill directory that way, and dropping it would make every
 * unmigrated layer's skills unreachable rather than merely unclassified.
 *
 * `processes` and `scenarios` are NOT here, and that is the split doing its
 * job: `processes/` holds only `.bpmn` and `scenarios/` only `roles.json`, so
 * neither ever contributed a skill body — they were scanned only because they
 * sat inside a directory that did.
 *
 * No count on purpose. This said "51 `.bpmn` files" and the directory holds
 * 50 — a number that was either wrong when written or true for an afternoon,
 * and AGENTS.md's rule for exactly this is to count the directory rather than
 * quote the paragraph. It also still said `workflows` after that kind was
 * renamed to `processes`.
 */
export const SKILL_BEARING_GRAPH_TYPOLOGIES: readonly string[] = kindsWith((d) => d.skillBearing === true);

/**
 * Every kind that IS harness knowledge-graph content — the umbrella and the
 * three kinds split out of it.
 *
 * Distinct from {@link SKILL_BEARING_GRAPH_TYPOLOGIES}, and the difference is the
 * whole point of the split: a consumer asking "is this the Knowledge Graph?" wants all
 * four, while one asking "may I scan this for skill bodies?" wants two. One
 * list serving both questions is what made `cat-harness` ambiguous.
 */
export const KG_CONTENT_GRAPH_TYPOLOGIES: readonly string[] = kindsWith((d) => d.kgContent === true);

/**
 * Does this directory hold ONLY the knowledge graph?
 *
 * **Exactly one skill-bearing kind, not merely including one.** `schemas/` declares
 * `["schemas", "cat-harness"]` — a schema IS a knowledge-graph node, which is
 * why it carries the kind at all — but its `.md` files are READMEs and its
 * nodes are `.ts`. Measured 2026-09-19: including it added `schemas/README.md`
 * and `schemas/block-qa-schema/README.md` to the skill set, giving 150 where
 * the corpus has 149.
 *
 * Requiring YAML front matter instead would have been the principled rule and
 * is measurably wrong here — only 117 of 147 skill bodies carry any, so it
 * would have dropped 30 real skills. A directory holding one kind can be
 * scanned for it; one holding several has to say which file is which.
 */
export function isKgOnlyDirectory(d: ContentDirectory): boolean {
  return d.graphTypologies.length === 1 && SKILL_BEARING_GRAPH_TYPOLOGIES.includes(d.graphTypologies[0]!);
}

/**
 * Does this directory hold ONLY harness knowledge-graph content, of any of its
 * kinds?
 *
 * **Wider than {@link isKgOnlyDirectory}, and the two must not be merged.**
 * This one answers "is there a Knowledge Graph node in here at all" — which is what a
 * consumer looking for roles, BPMN or requirements needs. The narrow one
 * answers "may I read every `.md` in here as a Skill body", which is false for
 * `workflows/` (51 `.bpmn`) and `scenarios/` (one `roles.json`).
 *
 * Before the 2026-09-21 split those directories declared `["cat-harness"]` and
 * so satisfied BOTH questions by accident. Restoring their reachability is
 * what this function is for: without it the split would have silently removed
 * every `bootstrap` process from the exported graph, which is precisely
 * the `dh4f` shape — a consumer reporting a clean run over what it never
 * visited.
 *
 * `schemas/` is excluded by the same `length === 1` test and for the same
 * measured reason given on the narrow one.
 */
export function isKgContentDirectory(d: ContentDirectory): boolean {
  return d.graphTypologies.length === 1 && KG_CONTENT_GRAPH_TYPOLOGIES.includes(d.graphTypologies[0]!);
}

/**
 * One layer's OWN declared directories — no inheritance, no override.
 *
 * ## Why this is not {@link resolveDirectories}
 *
 * `resolveDirectories` answers *"which directory does id X mean for this
 * instance"*, and it answers it **once**: entries override by id, so when a
 * dependency and the root both declare `cat-harness`, the root replaces the
 * dependency's entry and one path comes back. That is correct for its question
 * and is the documented rule — overrides match on `id`, never on `path`.
 *
 * **Overlay is the opposite question.** Loading skills needs EVERY layer's
 * contribution, in order, because a dependency's skills and the root's are both
 * real and the root's merely win *per skill name*. Collapsing them by id
 * discards the dependency entirely.
 *
 * That mismatch is why {@link resolveDirectories} could not be the primitive
 * here, and why the overlay resolver that predates this hardcoded
 * `join(root, "skills")` instead — it needed per-instance paths and reached for
 * a literal to get them. A literal is how a skill goes missing the moment the
 * layout moves; this reads the layer's own declaration instead.
 *
 * ## An undeclared layer still gets the conventions
 *
 * `AGENTS.md`: *"Absent declaration is fine — an unmigrated instance falls
 * back to today's conventions."* So a dependency with a `skills/` directory
 * and no `harness.json` resolves through {@link DEFAULT_DIRECTORIES}, which is
 * where that convention is written down once.
 *
 * **This was a regression before it was a feature.** The first version of this
 * function returned `[]` for an undeclared layer, which silently dropped
 * every unmigrated dependency's skills — caught by
 * `harness-config.test.ts`'s existing overlay test, whose fixture declares
 * nothing. Reading a declaration is the improvement; requiring one would have
 * been a breaking change wearing its clothes.
 *
 * Defaults are existence-filtered, for the same reason `resolveDirectories`
 * filters them: a default that is not there is the `dh4f` defect, where a
 * consumer scans nothing and reports a clean run over it. `declaredBy` says
 * `(default)` so a caller can tell a convention from a choice.
 */
export function ownDirectories(
  link: { name: string; root: string; own?: boolean },
  registry: GraphTypologyRegistry = defaultGraphTypologies,
  /**
   * The opt-in sub-graphs switched on. Absent: this layer's own list (and
   * `CAT_SUBGRAPHS`). A caller resolving a DEPENDENCY for a folio passes the
   * folio's, since the folio decides (`opt-in-subgraphs.ts`).
   */
  opts: ResolveOptions = {},
): ResolvedDirectory[] {
  const decl = readDeclaration(link.root, registry);
  const enabled: EnabledSubgraphs = opts.enabledSubgraphs ?? defaultEnabledSubgraphs(link.root, registry);

  // The conventional set FIRST, existence-filtered, and then declared entries
  // override it by id — which is `resolveDirectories`' order, and now this
  // function's too.
  //
  // ## The disagreement this closes (bean `rday`)
  //
  // These were the same declaration read by two resolvers that answered
  // differently. `resolveDirectories` seeded `DEFAULT_DIRECTORIES` at the root
  // link whatever the declaration said; this one applied them ONLY to a root
  // with no declaration at all. So a declaration's mere EXISTENCE withdrew
  // every convention from this function's callers, and `directories` defaults
  // to `[]` in the schema — meaning the minimal honest declaration,
  // `{ "name": "x" }`, silently emptied the result.
  //
  // Measured 2026-09-20: `resolveSkillDirs` over a fixture with a `skills/`
  // directory on disk went from 3 to 0 the moment the fixture was given a
  // name. Nothing failed except the tests that happened to assert an overlay;
  // a consumer would have read it as "this instance has no skills".
  //
  // Seeding unconditionally is the smaller of the two fixes the bean named
  // (the other was teaching the schema to tell an ABSENT `directories` from an
  // empty one, which is a migration). It is also the one that makes the rule
  // sayable in a sentence: **a declaration adds and overrides; it does not
  // withdraw.** A layer that genuinely owns none of the conventional
  // directories says so by not having them on disk — the existence filter is
  // what makes that the same answer either way, and it is the same reason
  // `DEFAULT_DIRECTORIES` carries: a declared-but-absent directory is `dh4f`,
  // where a consumer scans nothing and reports a clean run over it.
  const byId = new Map<string, ResolvedDirectory>();
  for (const dir of DEFAULT_DIRECTORIES) {
    const absPath = resolve(link.root, dir.path);
    if (!existsSync(absPath)) continue;
    byId.set(dir.id, { ...dir, declaredBy: "(default)", absPath, own: false });
  }
  if (!decl) return [...byId.values()];

  for (const dir of decl.directories
    // A REPOSITORY-scoped entry is not inherited, for the reason
    // `resolveDirectories` gives: a dependency's repository is a different
    // checkout, so inheriting its entry points every consumer at somebody
    // else's store. Stated in both resolvers because both are entry points.
    .filter((dir) => dir.scope !== "repository" || link.own === true)
    // A switched-off opt-in sub-graph is not this layer's to offer.
    .filter((dir) => !switchedOff({ ...dir, declaredBy: decl.name }, enabled))
    .map((dir) => ({
      ...dir,
      // Read a renamed id as its new one, as `resolveDirectories` does, or the
      // two resolvers disagree about which default an old declaration overrides.
      id: RENAMED_DIRECTORY_IDS[dir.id] ?? dir.id,
      declaredBy: decl.name,
      // THROUGH `rootForScope`, not `resolve(link.root, …)`. This function was
      // the third consumer of a declared path and the one that did not go
      // through the one place a scope turns into a directory — which made
      // `rootForScope`'s own doc comment ("every consumer … goes through
      // here") false from the day this was written.
      //
      // The consequence was silent and it was `dh4f`. `cat-harness/harness.json`
      // declares `bootstrap/skills/` at `scope: "repository"`; resolving it
      // against the LAYER gave `cat-harness/bootstrap/skills`, which is not
      // there, and `resolveSkillDirs` drops a directory that does not exist.
      // So `skill_fetch` answered "package not found" for every bootstrap
      // skill while the declaration naming them was correct and present, and
      // nothing reported a problem: a clean pass over an empty set. Eight
      // entries here carry `scope: "repository"`; `bootstrap` is the one that
      // was harmed, because it is the only kg-only one among them.
      absPath: resolve(rootForScope(link.root, dir.scope), dir.path),
      own: link.own === true,
    }))) {
    // Override by id, replacing IN PLACE so the conventional order survives a
    // relocation — the same rule and the same reason as `resolveDirectories`:
    // a consumer should not have its scan order reshuffled because a
    // declaration moved one directory.
    byId.set(dir.id, dir);
  }
  return [...byId.values()];
}

// ── Materialisation ─────────────────────────────────────────────

/**
 * What the keep-marker in a materialised directory says.
 *
 * It is a `.gitignore` because that is the one filename whose presence in an
 * otherwise-empty directory is unremarkable, and it **ignores nothing**. The
 * comment is the payload: git tracks files rather than directories, so a
 * declared-but-empty directory vanishes from the next clone without a file in
 * it, and the next person deletes it as debris.
 *
 * Deliberately no `*` / `!.gitignore` pair. Ignoring the contents of
 * `uploads/` would reproduce the defect the two-stage pipeline exists to
 * prevent — a source on disk that every consumer reads as absent — and
 * `library/` is L1 corpus that MUST be committed and greppable. What a folio
 * chooses to ignore is the folio's policy; this file only keeps the directory
 * alive, and is never overwritten once it exists.
 */
export function keepMarker(dir: Pick<ContentDirectory, "id" | "description">): string {
  const what = dir.description?.trim();
  return [
    "# do not delete me",
    "#",
    "# Git tracks files, not directories, so this directory would vanish from",
    "# the next clone without a file in it. This is that file. It ignores",
    "# nothing on purpose — see `keepMarker` in schemas/kg/cat-harness.ts.",
    "#",
    `# ${dir.id}/`,
    ...(what ? wrapComment(what) : []),
    "",
  ].join("\n");
}

/** Wrap a description into `# `-prefixed lines at 76 columns. */
function wrapComment(text: string, width = 74): string[] {
  const words = text.replace(/\s+/g, " ").split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > width) {
      lines.push(`# ${line}`);
      line = w;
    } else {
      line = line ? line + " " + w : w;
    }
  }
  if (line) lines.push(`# ${line}`);
  return lines;
}

/** One directory's outcome from {@link materialiseDirectories}. */
export interface MaterialisedDirectory {
  id: string;
  /**
   * Path the directory was (or would be) created at — inside the layer, or
   * at the repository root for a `repository`-scoped entry.
   */
  absPath: string;
  /** The DECLARED path, as written. Reported so a caller need not recover it
   * from `absPath` — `relative(instanceRoot, absPath)` gives `../beans` for a
   * repository-scoped entry, which is a traversal rather than a name. */
  path: string;
  /** Which root `path` was resolved against; absent means the layer's. */
  scope?: DeclarationScope;
  /** The layer whose declaration contributed the entry — may be a dependency. */
  declaredBy: string;
  /** True when this call created the directory; false when it already existed. */
  created: boolean;
  /** True when this call wrote the keep-marker; false when one was already there. */
  markerWritten: boolean;
}

/**
 * Does each layer have its own directory of every kind this one holds
 * ({@link GraphTypologyDef.perInstance})? Such a directory is reproduced in each
 * dependent by {@link materialiseDirectories}; an unregistered kind has said
 * nothing, so it is not.
 */
export function isPerInstance(
  dir: Pick<ContentDirectory, "graphTypologies">,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): boolean {
  const kinds = dir.graphTypologies ?? [];
  return kinds.length > 0 && kinds.every((k) => registry.get(resolveGraphTypology(k).kind)?.perInstance === true);
}

/**
 * Create every declared directory that does not exist yet, in the layer
 * being set up.
 *
 * WHY THIS EXISTS, and why it must land in the same change as any new
 * declaration: `AGENTS.md` says "declare only what exists — a declared-but-
 * absent directory is the bean `dh4f` defect, where a consumer scans nothing
 * and reports a clean run over it". Absent and empty are indistinguishable to
 * a consumer, so declaring a directory you have not created converts a real
 * gap into a clean run. Materialising is what makes "empty" a DETERMINED
 * empty rather than an unanswered question — the same third-state discipline
 * the README sections and the CI-health report follow.
 *
 * PATHS RESOLVE AGAINST THE LAYER, NOT THE DECLARER. A layer inherits
 * its dependencies' directory conventions, so what it inherits is the
 * CONVENTION — an id and a relative path — and it needs that directory in
 * ITSELF. `ResolvedDirectory.absPath` points into the declaring checkout,
 * which for a dependency is somebody else's tree; writing there would be the
 * equivalent of creating folders inside `node_modules`.
 *
 * A path that escapes the root its SCOPE names is REFUSED rather than created,
 * the same rule `schemas/sdlc/bean-graph.ts` applies to its node paths: a directory
 * outside that root is not a directory of it. A `repository`-scoped entry is
 * materialised at the repository root — `beans/` and `todos/` belong to the
 * checkout rather than to any layer in it, so creating them inside the
 * layer would give the work plan a second home and leave the real one
 * reported MISSING, which is what `harness:dirs:check` said about four
 * directories that were all sitting there.
 *
 * Idempotent. Running it twice creates nothing and overwrites nothing — an
 * existing keep-marker is left exactly as it is, because a folio may have
 * added real ignore rules to it. A directory that already holds files gets no
 * marker: it is not at risk of vanishing, so a file explaining that it might
 * would be both redundant and wrong.
 */
/** The layer's declared publish-time artefacts; none when it declares none or cannot be read. */
function publishTimeOf(instanceRoot: string): BuiltAtPublish[] {
  try {
    return readDeclaration(instanceRoot)?.builtAtPublish ?? [];
  } catch {
    return [];
  }
}

export function materialiseDirectories(
  dirs: ResolvedDirectory[],
  instanceRoot: string,
  opts: { dryRun?: boolean } = {},
): MaterialisedDirectory[] {
  const rootAbs = resolve(instanceRoot);
  const out: MaterialisedDirectory[] = [];
  for (const dir of dirs) {
    // ── What a DEPENDENT gets, and what it does not ───────────────────
    //
    // A layer always materialises what it DECLARED ITSELF; `dependents`
    // governs only what an INHERITED entry does here. `skip` means the entry
    // names where the declaring layer's own content lives — `schemas/`,
    // `tools/`, `src/skills/` — and a dependent has no use for an empty
    // directory of that name.
    //
    // Measured before this existed: a fresh folio depending on this layer
    // inherits 12 directories, four of them the platform's own, and every one
    // was created with a committed keep marker. That is the `dh4f` shape —
    // a consumer scanning a directory that exists and is empty, reporting a
    // clean run over it — manufactured for every downstream folio by the tool
    // written to prevent it.
    //
    // RESOLUTION IS UNTOUCHED. A `skip` entry stays in the resolved list, so
    // the cross-instance overlay still serves the dependency's skills through
    // `skill_list` and `skill_fetch`. The only thing suppressed here is
    // `mkdirSync`.
    // Option A (owner 2026-09-30): "make dependents: reproduce automatic
    // behaviour so [we] don't need it." Whether an inherited entry is created
    // here is now read from its graph TYPOLOGY ({@link GraphTypologyDef.perInstance}):
    // a folio has its own `uploads/`, `library/`, `docs/`, work plan; it has
    // no use for an empty `schemas/` or `tools/`. Anything else is a MEMBER of
    // the inherited subgraph exactly where it already exists, never created
    // empty (the `dh4f` rule); a repository-scoped entry has one location.
    if (dir.own !== true && (dir.scope === "repository" || !isPerInstance(dir))) continue;
    // A STORED directory (`storage`, bean `16ei`) lives on its branch; the
    // checkout holds at most a working copy that `qa:fetch` or a writer makes.
    // Creating it empty here would manufacture the `dh4f` shape — a reader
    // scanning an empty directory and reporting a clean run — and its absence
    // is not "missing", so `--check` does not list it either.
    // Any source off the checkout, not only `storage` (bean `l4ay`).
    if (contentIsOffCheckout(dir)) continue;
    // BUILT AT PUBLISH (owner, 2026-10-14, "B1"): the layer declares it
    // never commits this directory, and `derive:publish` writes it. Creating
    // it here would commit a keep marker into a path the layer's own
    // `.gitignore` keeps out, and its absence before a publish build is its
    // correct state, so `--check` does not list it as missing either.
    if (dir.own === true && dir.scope !== "repository" && isBuiltAtPublish(publishTimeOf(rootAbs), dir.path.replace(/\/*$/, "/"))) continue;
    const base = rootForScope(rootAbs, dir.scope);
    const abs = resolve(base, dir.path);
    const rel = relative(base, abs);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      const where = dir.scope === "repository" ? "repository" : "instance";
      throw new Error(
        `declared directory "${dir.id}" resolves outside the ${where} ` +
          `(${dir.path} -> ${abs}); a directory outside the ${where} is not a directory of it`,
      );
    }
    // ── The scope trap ────────────────────────────────────────────────
    //
    // `scope` is optional and its ABSENCE is meaningful: the path resolves
    // against the layer rather than the repository. Omit it on an entry
    // that meant `repository` and the declaration silently names a different
    // directory — and this function then CREATES that directory, with a keep
    // marker, turning declared-but-absent into declared-and-empty. The
    // `dh4f` false pass, wearing a tidier face, manufactured by the tool
    // written to prevent it.
    //
    // That is not hypothetical: it happened here on 2026-09-20, to the two
    // entries (`interaction`, `issue-marks`) added the same day, and stood
    // for about an hour with every gate green.
    //
    // So: before creating anything, look at the OTHER root. A directory of
    // this name already sitting there, with content, is overwhelmingly a
    // missing or wrong `scope` rather than a coincidence — and creating an
    // empty twin beside it is the one outcome that helps nobody.
    const otherBase = rootForScope(rootAbs, dir.scope === "repository" ? undefined : "repository");
    const twinPath = resolve(otherBase, dir.path);
    // A twin that is ITSELF a declared entry of this list is no scope mistake
    // but a second directory on purpose: cat-harness declares `uploads`
    // (its own queue) and `checkout-uploads` (the checkout's, `scope:
    // "repository"`) at the same relative path. In a checkout whose root holds
    // no `uploads/` yet (an IG repository that is its own index), the guard
    // read the declared `cat-harness/uploads` as the misplaced content
    // (cat-harness-tools#1701). An undeclared twin is still refused, and so
    // is one only the existence-filtered `(default)` convention names: that
    // entry exists BECAUSE the directory does, so it declares nothing.
    const twinDeclared = dirs.some(
      (o) => o !== dir && o.declaredBy !== "(default)" && resolve(rootForScope(rootAbs, o.scope), o.path) === twinPath,
    );
    if (otherBase !== base && !twinDeclared) {
      const twin = twinPath;
      // The condition is "this one is EMPTY and the twin has content", not
      // "this one is absent" — so it DETECTS the mistake already standing as
      // well as preventing a new one. A first draft tested absence only, and
      // would have refused to create the empty twin while saying nothing
      // about the empty twin already sitting there from an hour earlier.
      // A guard that cannot see the case that motivated it is half a guard.
      const emptyish = !existsSync(abs) || readdirSync(abs).every((f) => f === ".gitignore");
      if (emptyish && existsSync(twin) && readdirSync(twin).length > 0) {
        throw new Error(
          `declared directory "${dir.id}" is empty at ${abs}, ` +
            `while ${twin} already holds content. That is what a missing or wrong ` +
            `\`scope\` looks like: ${dir.scope === "repository" ? "the entry says `repository` and the content is in the instance" : "the entry omits `scope`, so it resolves against the instance, and the content is at the repository root"}. ` +
            `A consumer following the declaration scans the empty one and reports a clean run. ` +
            `Fix \`scope\` on the declaration rather than materialising both.`,
        );
      }
    }

    const existed = existsSync(abs);
    const markerPath = join(abs, ".gitignore");
    const markerExisted = existed && existsSync(markerPath);
    // The marker earns its place ONLY in a directory that would otherwise be
    // empty — that is the whole failure it addresses. Writing one into a
    // directory that already holds files (this layer's `skills/` holds
    // hundreds) adds a file nobody asked for and says something untrue about
    // why it is there.
    const needsMarker =
      !markerExisted && (!existed || readdirSync(abs).length === 0);
    if (!opts.dryRun) {
      if (!existed) mkdirSync(abs, { recursive: true });
      if (needsMarker) writeFileSync(markerPath, keepMarker(dir), "utf-8");
    }
    out.push({
      id: dir.id,
      path: dir.path,
      ...(dir.scope ? { scope: dir.scope } : {}),
      absPath: abs,
      declaredBy: dir.declaredBy,
      created: !existed,
      markerWritten: needsMarker,
    });
  }
  return out;
}

/** The resolved directories holding renderable (website) graphs. */
export function renderableDirectories(
  dirs: ResolvedDirectory[],
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): ResolvedDirectory[] {
  // Renderable if ANY declared graph is: a directory holding a folio plus
  // something else still renders.
  return dirs.filter((d) => d.graphTypologies.some((g) => isRenderable(g, registry)));
}

/**
 * The absolute path of the directory holding a given graph, read from the
 * layer's declaration.
 *
 * ## The literal this exists to replace
 *
 * `check:declared-paths` found **114** places where a directory
 * `harness.json` already declares is written out in code instead —
 * `join(root, "skills")`, `join(root, "translations", loc)`,
 * `join(root, "uploads")`. Every one of them is a place a topical or
 * relocated layout breaks silently, which is the whole defect the
 * declaration exists to remove.
 *
 * `resolveDirectories` already answered this; what was missing was a call
 * short enough that nobody reaches for the literal instead. One line, one
 * argument, and the caller does not have to build a chain.
 *
 * ## Three states, and the third is why this returns `undefined`
 *
 * A graph the layer does not declare is NOT the same as one declared at
 * the conventional path. `DEFAULT_DIRECTORIES` is existence-filtered, so a
 * layer with no `uploads/` genuinely has no `uploads` graph — and
 * defaulting here would hand a caller a path to a directory that is not
 * there, which is precisely the `dh4f` defect (a consumer scans nothing and
 * reports a clean run over it). Callers that legitimately want the
 * convention as a fallback say so at their own call site, where the choice
 * is visible.
 *
 * ## Ambiguity REFUSES rather than picking, and that is the point
 *
 * A graph declared by two directories is legal — `cat-harness` is declared by
 * four (`schemas/`, `skills/`, `bootstrap/skills/`, `src/skills/`) and
 * `methodology` by two. This used to return the FIRST of them, under a comment
 * saying it was "the accessor for the single-home case". That precondition was
 * stated and enforced by nothing, which is this repository's own rule broken
 * in one line: an unavoidable duplicate is fine, an UNCHECKED one is not.
 *
 * The cost is on the record. Bean `wggr`: a by-graph lookup for `cat-harness`
 * resolves to `schemas/`, not `skills/`, because `schemas/` declares
 * `["schemas", "cat-harness"]` and comes first. An audit walked `schemas/`,
 * wrote **37** sidecars against the wrong subjects, and exited **0**. Nothing
 * threw, because the wrong answer is indistinguishable from the right one at
 * the call site — *"a by-graph lookup is not a weaker version of a by-id
 * lookup; for `cat-harness` it resolves to a DIFFERENT DIRECTORY."*
 *
 * So an ambiguous kind now throws, naming every candidate. Measured before the
 * change: **none of the 34 call sites in this repository asks for either
 * ambiguous kind** — every one passed `library`, `translation-sources`,
 * `uploads`, `schemas`, `fsh-guts`, `todos` or `memory`, all single-homed at
 * the time. The throw was therefore unreachable, and existed for the caller
 * who had not been written yet, which is the one `wggr` was.
 *
 * **That caller arrived the same day.** Bean `frs5` moved the corpus out of
 * the platform into the IRIS replica's `library/` and the science layer's `library/`, so
 * `library` has TWO homes and `schemas` has FOUR (`cat-harness/`,
 * the content core's, `large-datasets/`, `detangle/`). The paragraph
 * above is kept as written and corrected here rather than edited, because
 * what it records — a throw added for a caller nobody had written — is worth
 * more beside the date it stopped being true than it is silently updated.
 *
 * Every site that wanted one was migrated: scanners fan out through
 * {@link directoriesForGraph}, write targets refuse through this, and the four
 * that wanted THEIR OWN layer's directory ask
 * {@link instanceDirectoryForGraph}, which is a third question neither of the
 * other two answers. `scripts/tests/no-silent-first-directory.test.ts` fails
 * on a new `directoriesForGraph(…)[0]`, since the last fix of this shape was
 * one site at a time and left thirty-one.
 *
 * {@link directoriesForGraph} is the honest accessor when several homes are
 * what you want; a by-ID lookup through {@link resolveDirectories} is the
 * answer when you want a particular one.
 */
export function directoryForGraph(
  root: string,
  graph: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): string | undefined {
  const all = matchingDirectories(root, graph, registry);
  if (all.length > 1) {
    throw new Error(
      `graph "${graph}" is declared by ${all.length} directories, so there is no single ` +
        `directory for it: ${all.map((d) => `${d.id} (${d.path})`).join(", ")}. ` +
        `Returning the first silently is bean \`wggr\` — it resolved \`cat-harness\` to ` +
        `\`schemas/\` and wrote 37 sidecars against the wrong subjects on a run that exited 0. ` +
        `Use \`directoriesForGraph\` if you want all of them, or look the directory up by its ` +
        `\`id\` through \`resolveDirectories\` if you want a particular one.`,
    );
  }
  return all[0]?.absPath;
}

/**
 * Where a layer's `.pot` / `.po` sources actually live — its own declared
 * directory, or a HOST's, namespaced by the layer's stub.
 *
 * ## The third case, and why it had to exist
 *
 * Two answers were assumed for years and both are about the layer itself:
 * it declares `translation-sources`, or it does not and the convention
 * `<root>/translations` applies. Ten readers spell the second as
 * `directoryForGraph(root, "translation-sources") ?? join(root, "translations")`.
 *
 * A third case is real and neither covers it. `bootstrap` is a floor an agent
 * READS — no TypeScript, `needs: []` — and a `.pot` is tooling OUTPUT that
 * nobody reads. So on the owner's instruction its 15 templates moved to
 * `cat-harness/translations/<locale>/bootstrap/processes/`: the files that
 * describe one layer's diagrams, kept in the translation corpus of the
 * layer that PUBLISHES them.
 *
 * Both assumed answers then compose a path that does not exist, and this is
 * not hypothetical — it took three CI jobs red on 2026-09-27, twice, in two
 * different readers.
 *
 * ## The host is a DEPENDENT, not a dependency
 *
 * Worth stating because the natural guess is wrong and costs an afternoon.
 * `bootstrap` declares `needs: []`; it depends on nothing, so no dependency of
 * bootstrap's could be hosting anything. `cat-harness` is what declares
 * `needs: ['bootstrap']`. The host is the layer that DEPENDS on this one,
 * which is also the one whose build publishes it — so the host cannot be found
 * by walking this layer's own dependencies, and `hostRoot` is supplied by
 * the caller rather than derived. A tool shipping inside cat-harness passes
 * its own layer root, which is the only host it could sensibly mean.
 *
 * ## Three states, reported rather than collapsed
 *
 * `by` says WHICH question answered, because the three are not equally good
 * news and a caller that cannot tell them apart makes the mistake this
 * function exists to stop. `own` is a declaration. `hosted` is a declaration
 * one level out plus a directory that exists. `convention` is a guess, and a
 * reader deciding whether an empty result is a determined empty or a defect
 * needs to know it was a guess.
 *
 * @param instanceRoot the layer whose translations are wanted
 * @param hostRoot a layer that may host them; omit when there is none
 */
export function translationsHomeFor(
  instanceRoot: string,
  hostRoot?: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): { root: string; scope: readonly string[]; by: "own" | "hosted" | "convention" } {
  const own = matchingDirectories(instanceRoot, "translation-sources", registry);
  if (own.length > 0 && own[0] !== undefined) {
    return { root: own[0].absPath, scope: [], by: "own" };
  }

  if (hostRoot !== undefined && resolve(hostRoot) !== resolve(instanceRoot)) {
    const hosts = matchingDirectories(hostRoot, "translation-sources", registry);
    const host = hosts[0];
    // `readDeclaration`, NOT `artefactStubFor`. The latter throws EISDIR on a
    // directory with no declaration file: `findDeclarationFile` returns
    // undefined, so it reads the DIRECTORY and node refuses. Found by this
    // function's own tests, which pass exactly such a directory — and by two
    // OLDER tests in the same file that had been passing temp dirs to
    // `catalogueFor` for months. A layer with no declaration has no stub,
    // so it cannot be hosted under one; that is the convention case below.
    const decl = readDeclaration(instanceRoot);
    if (host !== undefined && decl !== undefined && decl !== null) {
      const stub = artefactStub(decl);
      // Existence is REQUIRED, not assumed. Composing `<host>/<locale>/<stub>`
      // and reporting `hosted` without looking would hand every caller a path
      // that may be nothing, and the whole point of this function is that a
      // caller can tell an empty answer apart from a wrong one.
      const hosted = existsSync(host.absPath)
        ? readdirSync(host.absPath, { withFileTypes: true }).some(
            (e) => e.isDirectory() && existsSync(join(host.absPath, e.name, stub)),
          )
        : false;
      if (hosted) return { root: host.absPath, scope: [stub], by: "hosted" };
    }
  }

  // declared-path-literal: the base case for a layer that declares nothing
  // and is hosted by nobody. Reading a declaration to learn the fallback for
  // having no declaration cannot be done; `DEFAULT_DIRECTORIES` supplies this
  // same convention, and `by: "convention"` tells the caller it was a guess.
  return { root: join(instanceRoot, "translations"), scope: [], by: "convention" };
}

/**
 * The directory holding one locale's files for a layer, hosted or not:
 * `<root>/<locale>` when it owns its corpus, `<root>/<locale>/<stub>` when a
 * host carries it.
 *
 * One function rather than a join at each site, for the reason `potPathFor`
 * gives about its own sibling: two copies of a path is how a check passes over
 * a file the extractor never wrote.
 */
export function localeDirIn(
  home: { root: string; scope: readonly string[] },
  locale: string,
): string {
  return join(home.root, locale, ...home.scope);
}

/** Every directory this layer declares as holding `graph`, in declaration order. */
/**
 * Where a layer's `kg-audit` results live: the directory holding its
 * `kg-qa/` tree and its `kg-qa.manifest.json`.
 *
 * Three answers, and the caller is told which, as {@link translationsHomeFor}
 * does for translations:
 *
 * - **own** — the layer declares a `qa` directory; its results live there.
 * - **hosted** — it declares none, and `hostRoot` (the auditor's layer)
 *   does; the results live in the host's `qa` directory under the layer's
 *   stub, e.g. `cat-harness/test/results/bootstrap/`. This is how bootstrap
 *   keeps its QA sidecars out of its own tree (owner, 2026-09-29, decision 2 of
 *   bean `r3gy`): a verdict ABOUT bootstrap is harness output, and bootstrap is
 *   the layer that must read cleanly with no harness present.
 * - **convention** — neither declares one; `<instance>/test/results/`.
 *
 * A hosted home sits BESIDE the host's own `kg-qa/` tree, never inside it, so
 * the host's orphan sweep cannot claim another layer's sidecars as its own.
 */
export function kgQaHomeFor(
  instanceRoot: string,
  hostRoot?: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): { root: string; by: "own" | "hosted" | "convention" } {
  const own = matchingDirectories(instanceRoot, "qa", registry)[0];
  if (own !== undefined) return { root: own.absPath, by: "own" };
  if (hostRoot !== undefined && resolve(hostRoot) !== resolve(instanceRoot)) {
    const host = matchingDirectories(hostRoot, "qa", registry)[0];
    const decl = readDeclaration(instanceRoot);
    if (host !== undefined && decl !== undefined && decl !== null) {
      return { root: join(host.absPath, artefactStub(decl)), by: "hosted" };
    }
  }
  // declared-path-literal: the base case for a layer that declares no `qa`
  // directory and is hosted by nobody — the same convention KG_QA_RESULTS_DIR names.
  return { root: join(instanceRoot, "test", "results"), by: "convention" };
}

/**
 * Where a layer's swimlane-glossary retirement LEDGER lives — the same
 * three answers as {@link kgQaHomeFor}, for the same reason.
 *
 * - **own** — the layer declares a `swimlane-glossary` directory.
 * - **hosted** — it declares none, and `hostRoot` (the layer running the
 *   export) does; the ledger lives in the host's directory under the
 *   layer's stub, e.g. `cat-harness/glossary/bootstrap/`. The ledger is
 *   harness state ABOUT bootstrap — `glossary-export` writes it, nothing in
 *   bootstrap reads it — so it is hosted like the QA verdicts (owner,
 *   2026-09-30, Q2 of bean `xsqm`).
 * - **convention** — neither declares one; `<instance>/glossary/`.
 *
 * A hosted ledger sits in a stub-named subdirectory, so the host's own
 * `glossary-ledger.json` and a guest's never share a path, and each file
 * carries its `instance`, so a walker over the host's directory attributes it.
 */
export function glossaryHomeFor(
  instanceRoot: string,
  hostRoot?: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): { root: string; by: "own" | "hosted" | "convention" } {
  const own = matchingDirectories(instanceRoot, "swimlane-glossary", registry)[0];
  if (own !== undefined) return { root: own.absPath, by: "own" };
  if (hostRoot !== undefined && resolve(hostRoot) !== resolve(instanceRoot)) {
    const host = matchingDirectories(hostRoot, "swimlane-glossary", registry)[0];
    const decl = readDeclaration(instanceRoot);
    if (host !== undefined && decl !== undefined && decl !== null) {
      return { root: join(host.absPath, artefactStub(decl)), by: "hosted" };
    }
  }
  // declared-path-literal: the base case for a layer that declares no
  // `swimlane-glossary` directory and is hosted by nobody — `GLOSSARY_DIR`'s convention.
  return { root: join(instanceRoot, "glossary"), by: "convention" };
}

function matchingDirectories(
  root: string,
  graph: string,
  registry: GraphTypologyRegistry,
): ResolvedDirectory[] {
  return resolveDirectories([{ name: "(local)", root, own: true }], registry).filter((d) =>
    d.graphTypologies.includes(graph as GraphTypology),
  );
}

/**
 * Every directory holding `graph`, for the callers {@link directoryForGraph}
 * now refuses.
 *
 * Empty means the layer declares the graph nowhere — the same third state
 * its sibling documents, and for the same reason: a caller that wants the
 * convention as a fallback says so at its own call site, where the choice is
 * visible, rather than being handed a path to a directory that is not there.
 */
export function directoriesForGraph(
  root: string,
  graph: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): string[] {
  return matchingDirectories(root, graph, registry).map((d) => d.absPath);
}

/**
 * {@link directoriesForGraph}, with the fields a path alone cannot carry — the
 * entry's `id` and its declared `source`.
 *
 * Both are needed the moment a graph's content can be somewhere other than the
 * checkout. A consumer holding only `absPath` cannot ask `graphReadPath` where
 * to READ (that is keyed on the id), and cannot tell an empty directory from a
 * graph kept at a branch tip that this checkout has not mounted. Measured on
 * bean `najo`: `check:kind-validators` reported *"EXAMINED NOTHING"* over the
 * merge queue in all three states — absent, unmounted, and mounted-and-empty —
 * because a path is the same path in each.
 *
 * The same resolution as its sibling, so the two cannot answer differently.
 */
export function directoryEntriesForGraph(
  root: string,
  graph: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): ResolvedDirectory[] {
  return matchingDirectories(root, graph, registry);
}

/**
 * The CONVENTIONAL folio directory, `<root>/folio` — the answer when a
 * layer declares no `folio` graph, and the only place outside a test where
 * the string is spelled.
 *
 * Bean `hs08` concentrated 162 spellings of `join(root, "folio")` into
 * {@link folioDir}; `folio-root-is-asked.test.ts` keeps it that way. What it
 * could not reach were the callers that need the CONVENTION ITSELF rather than
 * the declared answer: a legacy path that was only ever written at the
 * convention, or a fallback taken because the declaration could not be read
 * and reported as such. They spelled the literal and were the test's last two
 * offenders. This names the fact, so they ask for it.
 *
 * **Not a substitute for {@link folioDir}.** A caller that wants the folio
 * asks {@link folioDir}, which reads the declaration and FAILS when it cannot
 * (`ot9a`): a folio that declares `content/` must never be answered with
 * `folio/` by accident. Call this only where the convention is what you mean,
 * and say why beside the call.
 *
 * @param root repository root to resolve against
 * @returns `<root>/folio`
 */
export function conventionalFolioDir(root: string): string {
  // declared-path-literal: the base case. This IS where the convention is
  // written down; resolving it through a declaration would be circular.
  return join(root, "folio");
}

/**
 * Where a folio's authored content lives — **asked, not assumed**.
 *
 * Bean `hs08`. The owner's ruling, 2026-09-20: *"content/ shouldnt be expected
 * anymore. folio/ was renamed as default/convention"*, then *"no content/
 * fallback. excise!!!!!"* — and then the part that makes this function
 * necessary rather than tidy:
 *
 * > *"qou can declare a new folio at content/"*
 *
 * That is the whole point of a declaration. A folio is not obliged to put its
 * content under `folio/`; it says where its `folio` graph is, and consumers
 * read the declaration. `litlfred/qou` keeps `content/` and stays readable by
 * declaring it — **but only if the platform asks.**
 *
 * It did not. After the excision, 162 sites spelled `join(root, "folio")` as a
 * literal, so a declaration naming anything else was ignored and the folio was
 * invisible. The rename was done; the *mechanism* the rename exists to serve
 * was not wired up. This is that wiring, in one place.
 *
 * ## Why `"folio"` is named HERE, in the harness
 *
 * `ot9a` set the falsifier: *"if the harness still has to know the string
 * `folio` anywhere for the declaration to validate, the re-siting is
 * cosmetic."* The harness does still know it — this module is `harness` by
 * `repo-partition`, as are `pipeline/repo-root.ts` and `scripts/`.
 *
 * That is not this function reintroducing the problem; it is this function
 * CONCENTRATING it. The harness knew the string in 162 places before and knows
 * it in one now, which is the difference between a fact you can audit and one
 * you can only grep for. Only a `harness` module can serve every caller —
 * `allowed` gives `core: ["core", "harness"]` and `harness: ["harness"]`, so
 * a core home would be unreachable from the harness half.
 *
 * ## The fallback is the CONVENTION, not `content/`
 *
 * A layer that declares nothing gets `folio/`. It never gets `content/`:
 * that root is excised, and a folio keeping it must SAY so. Silence means the
 * convention, and the convention is `folio/`.
 *
 * @param root repository root to resolve against
 * @returns the declared folio directory, else {@link conventionalFolioDir}
 */
export function folioDir(root: string): string {
  try {
    return directoryForGraph(root, "folio") ?? conventionalFolioDir(root);
  } catch (e) {
    // A layer whose declaration does not KNOW the `folio` kind — core
    // registers it by load-time side effect (`schemas/kg/folio-graph-typology.ts`)
    // and a harness-only process may not have reached it. That is `ot9a`'s
    // fragility, and the convention is the right answer for it.
    //
    // Narrow deliberately: any OTHER failure is a malformed declaration, and
    // swallowing it would report a guess as an answer. "Could not determine"
    // is never rendered as a clean result.
    if (e instanceof Error && /unknown graph typology "folio"/.test(e.message)) {
      // DO NOT fall back here. This was the first version and it was wrong in
      // the one way that matters: with the kind unregistered, the declaration
      // cannot be READ, so returning the convention answers a question nobody
      // could answer. A folio declaring `content/` — which the owner has said
      // qou will do — would be silently invisible, and the caller would get a
      // plausible path instead of a fault.
      //
      // "Could not determine" is never rendered as a clean result. Fail, and
      // say what to import.
      throw new Error(
        `folioDir(${root}): the \`folio\` graph typology is not registered, so the ` +
          `instance's declaration cannot be read and its folio directory is ` +
          `UNKNOWN — not "folio/". Import \`schemas/kg/folio-graph-typology.js\` for ` +
          `its load-time registration before calling this. Falling back to the ` +
          `convention here would silently ignore a folio that declares another ` +
          `path (bean hs08; the fragility is ot9a).`,
      );
    }
    throw e;
  }
}

/**
 * {@link folioDir} resolved AT LOAD, but whose FAILURE is raised AT USE.
 *
 * ## Why both halves matter, and why neither can move
 *
 * Twenty modules open with `const FOLIO_DIR = folioDir(REPO_ROOT)`. That
 * throws on a malformed declaration, and a throw at module scope **aborts
 * evaluation** — so every export below the failing line is left unbound, and
 * `await import()` can hand back the half-built namespace rather than
 * re-throwing. Bean `95s1` spent an afternoon on the result: an error 3,186
 * lines from its cause, resembling a circular import closely enough that the
 * bean was opened as one.
 *
 * **Resolution stays at load, and that is not inertia.** `findContentRepoRoot`
 * reads `process.cwd()`, so moving resolution to first use would let a
 * `process.chdir` change the answer. `checker-missing-evidence.test.ts` says
 * so in its own words — it uses ABSOLUTE fixture paths *because*
 * `qa-checkers-extended` captures the root at module load, so a test's chdir
 * changes nothing. Memoising on first use would be worse still: whichever
 * caller ran first would win, making the value test-order dependent.
 *
 * So only the THROW moves. The value is computed now, under the cwd the module
 * was loaded with; the error waits until somebody asks for it, and arrives
 * naming the module that could not resolve.
 *
 * ## What the caller sees
 *
 * A function rather than a string, which is the whole cost of this: use sites
 * call it. In exchange the failure reaches them with a cause attached instead
 * of surfacing as an unrelated binding's dead zone three thousand lines away.
 */
export function folioDirDeferred(root: string, moduleUrl: string): () => string {
  return deferResolution(() => folioDir(root), {
    moduleUrl,
    what: "its folio directory",
    under: resolve(root),
  });
}

/**
 * The same deferral, for any module-scope value whose computation can throw on
 * a declaration.
 *
 * ## Why this exists beside {@link folioDirDeferred} rather than instead of it
 *
 * `folioDir` was the whole hazard until 2026-09-21, and the gate was written
 * to match a call in FIRST position — `const X = folioDir(...)`. Widening it
 * found twelve more sites the anchored pattern could not see, and they are not
 * a different defect:
 *
 * ```ts
 * const LEDGER_PATH = join(folioDir(REPO_ROOT), "bib-qa-verifications.json");
 * const UPLOADS_DIR = directoryForGraph(REPO_ROOT, "uploads") ?? join(REPO_ROOT, "uploads");
 * ```
 *
 * The throwing call is nested, so no wrapper around `folioDir` alone reaches
 * it. What has to be deferred is the WHOLE expression. And two more resolvers
 * throw for the same reason — `directoryForGraph` and `directoriesForGraph`,
 * measured against a directory holding `{ not json` — so a second
 * function-specific wrapper would already be a third.
 *
 * `folioDirDeferred` keeps its name and its message: it is called from twenty
 * modules, and its wording is the thing a reader meets when the failure
 * arrives. It is now a thin call to this.
 *
 * ## Same contract, one generalisation
 *
 * Resolution stays at LOAD, for the reason on `folioDirDeferred`: several
 * resolvers read `process.cwd()` transitively, and moving the computation to
 * first use would let a `process.chdir` change the answer — while memoising on
 * first use would be worse, making the value depend on whichever caller ran
 * first. Only the throw moves.
 *
 * Generic in the value because not every one is a string:
 * `q-usage-audit.ts` resolves `string[]`.
 */
export function deferResolution<T>(
  compute: () => T,
  context: { moduleUrl: string; what: string; under: string },
): () => T {
  let value: T | undefined;
  let ok = false;
  let failure: unknown;
  try {
    value = compute();
    ok = true;
  } catch (e) {
    failure = e;
  }
  return () => {
    // `ok` rather than `value !== undefined`: a resolver may legitimately
    // return `undefined`, and treating that as a failure would raise this
    // error over a value that resolved perfectly well.
    if (ok) return value as T;
    throw new Error(
      `${context.moduleUrl} could not resolve ${context.what} when it loaded, and this is ` +
        `the first use of that value. The declaration under ${context.under} is what ` +
        `failed: ${failure instanceof Error ? failure.message : String(failure)}`,
      { cause: failure },
    );
  };
}

/**
 * The directory a graph has AT THIS LAYER'S OWN ROOT — repository-scoped
 * entries pointing at sibling layers excluded.
 *
 * ## A third question, found by reading the callers rather than by design
 *
 * `a02m` began with two shapes in mind: scan every home, or expect exactly
 * one (`directoryForGraph`, reinstated on `main` the same day with the
 * refusing semantics this branch had built separately as
 * `directoryForGraph` — two names for one question, resolved in favour of
 * main's). Both were wrong for the four `schemas` call sites, which is how this
 * one was found. `check-tools`, `harness-schema-export`, `gen-schema-docs` and
 * `fsh-guts/generate-docs` all compose `join(schemasRoot(root), "skills")` or
 * `"generated"` — a path INSIDE the directory. They are not asking "who
 * declares schemas", they are asking "where is MY schemas directory".
 *
 * ## `own` is NOT the discriminator, and assuming it was is a correction
 *
 * The first version of this filtered on `ResolvedDirectory.own`. Measured:
 * from the `cat-harness` root all FOUR `schemas` directories are `own` —
 * `cat-harness/schemas` plus the content core's, `large-datasets/` and
 * `detangle/`, each declared by cat-harness's own `harness.json` with
 * `scope: "repository"` because this repository stages three future layers
 * as sibling top-level directories. `own` distinguishes the root from a
 * DEPENDENCY, which is a different question and not the one being asked.
 *
 * The discriminator is `scope`, and `rootForScope` above is where it already
 * means exactly this: a repository-scoped entry resolves against the
 * REPOSITORY root, everything else against the layer root. So this asks for
 * the entries that resolve against `root` itself — the directory that is
 * genuinely this layer's, not one it points at from across the repository.
 *
 * ## Why `[0]` was not already wrong here
 *
 * `resolveDirectories` happens to order the root's instance-scoped
 * declarations first, so `[0]` landed on the intended one. A reordering, or a
 * staged sibling declared earlier, would have moved it silently — and the
 * symptom would be a generator writing its output into another layer's
 * tree, with a clean exit code.
 */
/**
 * Every directory of `graph` that is genuinely THIS layer's — the plural of
 * {@link instanceDirectoryForGraph}, with the identical `scope` filter.
 *
 * It exists because the singular THROWS when a layer declares more than one,
 * deliberately: taking `[0]` is the `dh4f` shape, where a second declared
 * directory is scanned by nobody and the run reports clean. That refusal is
 * right, and it makes the singular the wrong accessor for a caller whose
 * question is plural — which is how `kg:audit --instance ./large-datasets`
 * CRASHED rather than auditing (measured 2026-09-27):
 *
 *     layer at .../large-datasets declares 2 directories for graph "schemas"
 *     at its own root, and this call site expects one:
 *       large-datasets-schemas → .../large-datasets/schemas
 *       large-datasets-sources → .../large-datasets/sources
 *
 * Both are legal — a kind may be declared by several directories, and
 * `cat-harness.json` does exactly that for `schemas` — so the caller had to stop
 * asking for one. `unclaimedSkillContracts` in `kg-audit.ts` is that caller.
 *
 * Filtered on `scope` and not on `own`, for the reason spelled out on the
 * singular: from a root that stages sibling layers, all of them are `own`,
 * and `scope` is the discriminator that actually asks "resolves against THIS
 * root".
 */
export function instanceDirectoriesForGraph(
  root: string,
  graph: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): string[] {
  return matchingDirectories(root, graph, registry)
    .filter((d) => d.own && d.scope !== "repository")
    .map((d) => d.absPath);
}

export function instanceDirectoryForGraph(
  root: string,
  graph: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): string | undefined {
  // Not one inside an opt-in sub-graph: that is an ADDITIONAL graph of its
  // kind, found by `optInDirectoriesForGraph`, and a switched-on `work-plan`
  // holding a `tools` graph must not make the layer's one `tools` two.
  const here = matchingDirectories(root, graph, registry).filter(
    (d) => d.own && d.scope !== "repository" && d.optInSubgraph === undefined,
  );
  if (here.length > 1) {
    throw new Error(
      `instance at ${root} declares ${here.length} directories for graph "${graph}" at its own root, ` +
        `and this call site expects one: ${here.map((d) => `${d.id} → ${d.absPath}`).join("; ")}.`,
    );
  }
  return here[0]?.absPath;
}

/**
 * The `graph` directories a layer holds INSIDE its switched-on opt-in
 * sub-graphs — the ones {@link instanceDirectoryForGraph} leaves out. Empty
 * while nothing is opt-in, or while every opt-in sub-graph is off.
 *
 * @param enabled what is switched on; absent, the layer's own list. A
 *   reader serving a FOLIO passes the folio's (`opt-in-subgraphs.ts`).
 */
export function optInDirectoriesForGraph(
  root: string,
  graph: string,
  enabled?: EnabledSubgraphs,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): string[] {
  return resolveDirectories([{ name: "(local)", root, own: true }], registry, enabled === undefined ? {} : { enabledSubgraphs: enabled })
    .filter((d) => d.own && d.scope !== "repository" && d.optInSubgraph !== undefined && d.graphTypologies.includes(graph as GraphTypology))
    .map((d) => d.absPath);
}

/**
 * EVERY declared directory, remote entries included — the navigable set.
 *
 * The complement of {@link resolveDirectories}, which answers "where do I
 * scan" and therefore drops remote graphs because there is nothing on disk to
 * walk. This one answers **"what is declared"**, which is the question the KG
 * viewer asks: the owner, 2026-09-20, wants the hierarchy of named subgraphs
 * filterable *"or navigable if external/remote pointed to in the core harness
 * schema"*, and a graph whose bytes are elsewhere is still a node in that
 * hierarchy.
 *
 * Two functions rather than a flag, because the two questions have different
 * right answers and a caller that passed the wrong flag would get a plausible
 * list either way.
 */
export interface DeclaredGraph extends KgNodeLabels {
  id: string;
  graphTypologies: GraphTypology[];
  declaredBy: string;
  /** Set iff the graph is HERE. */
  absPath?: string;
  /** Set iff the graph is elsewhere. Exactly one of the two, always. */
  url?: string;
}

export function declaredGraphs(
  root: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): DeclaredGraph[] {
  const decl = readDeclaration(root, registry);
  if (!decl) return [];
  return [
    ...decl.directories.map((d) => ({
      ...d,
      declaredBy: decl.name,
      absPath: resolve(rootForScope(root, d.scope), d.path),
    })),
    ...(decl.remoteGraphs ?? []).map((g) => ({ ...g, declaredBy: decl.name })),
  ];
}
/**
 * The local path of a declared directory, or `undefined` when the graph is
 * REMOTE.
 *
 * Every consumer that needs bytes on disk goes through this, so "this graph is
 * not in this checkout" is a case each one has to answer rather than a
 * `string` it can assume. When `url` landed on 2026-09-20 the compiler named
 * the whole set in nine errors across six files — which is the set that had
 * been assuming a local path all along, and the reason `path` was made
 * optional rather than widened to hold a URL. A field that is sometimes a path
 * and sometimes an address is one field with two meanings, and every consumer
 * then has to guess which it got.
 */
export function localPathOf(d: { path?: string; url?: string }): string | undefined {
  return d.path;
}

// ── Graph projection ────────────────────────────────────────────

/**
 * Project a declaration to its JSON-LD form — the "very simple graph schema
 * instance" the directories are meant to be.
 *
 * Kept as a function rather than as the stored form so there is one authored
 * shape and one derived shape, not two truths.
 */
export function toJsonLd(
  decl: CatHarnessDeclaration,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): Record<string, unknown> {
  return {
    "@context": {
      ...ownPrefixTable(registry),
      path: termIri("path"),
      directories: termIri("scans"),
      scope: termIri("scope"),
      // What a directory holds, as the kinds' own individuals — the same
      // property kg-export writes (`dcterms:type`, via `propertyIri`).
      holdsGraph: { "@id": propertyIri("holdsGraph"), "@type": "@id" },
    },
    "@type": termIri("Harness"),
    name: decl.name,
    ...(decl.title ? { title: decl.title } : {}),
    ...(decl.description ? { description: decl.description } : {}),
    ...(decl.icon ? { icon: { "@id": `#${decl.icon}` } } : {}),
    ...(decl.images?.length
      ? {
          images: decl.images.map((i) => ({
            "@id": `#${i.id}`,
            "@type": termIri("Image"),
            src: i.src,
            ...(i.role ? { role: i.role } : {}),
            ...(i.title ? { title: i.title } : {}),
            ...(i.description ? { description: i.description } : {}),
          })),
        }
      : {}),
    directories: decl.directories.map((d) => {
      // A directory is a Subgraph, and says what it holds only through
      // `holdsGraph` → each kind's individual (owner, 2026-09-30, bean `3r47`:
      // "Drop per-kind classes"). A kind the registry does not know still
      // gets an individual in the harness's namespace rather than vanishing.
      const kinds = d.graphTypologies.map((g) => graphTypologyIri(resolveGraphTypology(g).kind, registry.get(g)));
      return {
        "@id": `#${d.id}`,
        "@type": termIri("Subgraph"),
        // One stays a string, several become a list — JSON-LD permits both.
        holdsGraph: kinds.length === 1 ? kinds[0] : kinds,
        path: d.path,
        // ...and `scope` was ALREADY being dropped, silently, because it is
        // optional: a declaration round-tripped through JSON-LD came back
        // saying every path resolves against the layer. `beans/`, `todos/`
        // and six others are repository-scoped, so the projection was lossy
        // about the one field that decides WHERE they are. Found while adding
        // the line above; nothing had caught it because an absent optional
        // field parses cleanly and means something else.
        ...(d.scope ? { scope: d.scope } : {}),
        ...(d.title ? { title: d.title } : {}),
        ...(d.description ? { description: d.description } : {}),
      };
    }),
  };
}

/**
 * The graph typologies a layer DECLARES — its own, not the universal registry's.
 *
 * Moved here from `scripts/check-instance-render.ts` (bean `3jj9`) so the two
 * exporters can read one fact. `kg-export` needs it to stop emitting every
 * kind any layer defines into every layer's graph: `bootstrap` published
 * 16 GraphTypology nodes while declaring exactly one. The render check already
 * imports `kg-export`, so importing back would have been a cycle — and a
 * declaration's own contents belong beside the declaration reader anyway.
 *
 * Follows NESTED declarations, which is the part a plain read of
 * `directories[].graphTypologies` misses: `beans/beans.json` is what says `bean-defs`
 * and `workflow-state` exist, and a layer that owns them would otherwise
 * be reported as not owning them.
 */
export function declaredKinds(
  root: string,
  decl: CatHarnessDeclaration,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): Set<string> {
  const kinds = new Set<string>();
  for (const d of decl.directories ?? []) {
    for (const g of d.graphTypologies ?? []) kinds.add(g);
    // The nested declaration, if the directory carries one — how `beans/` says
    // what its inner nodes are without `harness.json` restating them.
    //
    // ASKED OF THE KIND FIRST, and that is the fix rather than the tidy-up.
    // This computed `${basename(path)}.json` and nothing else, while
    // `bean-graph.ts` held that moving `beans/` to `work/` must rename nothing
    // inside it. Both true of today's layout, contradictory on the first
    // relocation: the walk would look for `work/work.json`, the file would
    // still be `work/beans.json`, and the nested kinds would drop out of
    // `declared` silently — under-counting, which manufactures an `undeclared`
    // finding somewhere else. `declarationFile` on the kind is where that fact
    // now lives, once.
    //
    // The directory-name convention stays as a FALLBACK, after it: a graph
    // whose kind declares no filename is unmigrated, not broken, and a
    // layer that never relocates behaves exactly as before.
    const dirName = basename(d.path.replace(/\/+$/, ""));
    const declared = (d.graphTypologies ?? [])
      .map((g) => registry.get(g)?.declarationFile)
      .filter((f): f is string => typeof f === "string");
    for (const candidate of [...declared, `${dirName}.json`, "graph.json"]) {
      const p = join(declaredKindsEntryRoot(root, d), candidate);
      if (!existsSync(p)) continue;
      try {
        projectedRead(p, "nested-directories"); // only `directories` is used below
        const nested = JSON.parse(readFileSync(p, "utf-8")) as {
          directories?: Array<{ graphTypologies?: string[]; kinds?: string[] }>;
        };
        for (const nd of nested.directories ?? []) {
          for (const g of [...(nd.graphTypologies ?? []), ...(nd.kinds ?? [])]) kinds.add(g);
        }
      } catch {
        // A nested file that will not parse is not this check's finding to
        // make — `check:harness-dirs` owns that and says so loudly. Skipping
        // here would understate `declared` and manufacture an `undeclared`,
        // so the kinds it would have contributed are simply not added and the
        // reason is recorded by the caller if it matters.
      }
    }
  }
  // Deeper levels: a nested entry whose own kind names a declaration file
  // (`voices/vendors/vendors.json`, bean `rkqp`). The loop above reads one
  // level only.
  for (const n of nestedDirectories(root, decl, registry)) for (const g of n.graphTypologies) kinds.add(g);
  return kinds;
}


/**
 * One entry a declaration names FROM WITHIN another — {@link nestedDirectories}'s row.
 *
 * `id` is COMPOSED (`beans/queue`), so a reader can see which declaration holds
 * it; `ownId` is the id the entry gives itself, which is the id every OTHER
 * mechanism keys on — `promoteFromWithin` lists a `subgraph: true` entry under
 * `nd.id` verbatim, so that is what `resolveDirectories`, `tipLocations` and a
 * mount marker spell. Both are carried because conflating them is silent and
 * wrong in both directions.
 *
 * Measured 2026-10-04 (bean `najo`), on the first nested entry ever to carry a
 * branch `source`: `check:declared-dirs` asked `readMarker(root, "beans/queue")`
 * for a graph mounted under the id `queue`, and `markerPath` refuses an id with
 * a slash — so the gate reported a MOUNTED graph as `unmounted`, with "could
 * not determine" as the reason. A from-within graph could therefore never read
 * as mounted, which is the state the whole cutover produces.
 *
 * `subgraph` says whether the entry is a layer subgraph at all
 * (bean `cmsl`). Without it a consumer cannot tell "mounted under its own id"
 * from "no mount can reach this entry, because nothing lists it".
 */
export interface NestedDirectory {
  /** `<parent id>/<own id>` — unique across the layer, and says who declares it. */
  id: string;
  /** The entry's OWN id, as `resolveDirectories` and a mount marker spell it. */
  ownId: string;
  path: string;
  graphTypologies: string[];
  description?: string;
  absent?: { reason: string };
  storage?: unknown;
  source?: unknown;
  /** `true` when the entry declares itself a layer subgraph (bean `cmsl`). */
  subgraph?: boolean;
  parentId: string;
}

/** Where a declared directory actually is, honouring `scope`. */
function declaredKindsEntryRoot(root: string, d: { path: string; scope?: string }): string {
  return resolve(rootForScope(root, d.scope as DeclarationScope | undefined), d.path);
}

/**
 * The sub-graphs a declared directory names FROM WITHIN — its nested
 * declaration's entries, with paths rebased onto the layer root.
 *
 * Issue #1164, under the owner's #980 ruling: nesting is sanctioned when a
 * node inside the outer directory labels what it holds (`docs/docs.json`,
 * `beans/beans.json`). {@link declaredKinds} already reads those files for
 * KINDS; this returns the ENTRIES, for a consumer that needs a sub-graph's
 * path — the navbar's folders, `check:requirements`.
 *
 * Only the file the kind names (`declarationFile`) is read, not the
 * directory-name fallbacks `declaredKinds` tries: a consumer taking a PATH
 * from here must not take it from a file nobody declared. A file that does
 * not parse is skipped here and reported by the check that owns it.
 */
export function nestedDirectories(
  root: string,
  decl: CatHarnessDeclaration,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): NestedDirectory[] {
  const out: NestedDirectory[] = [];
  for (const d of decl.directories ?? []) {
    const parent = d.path.replace(/\/+$/, "");
    walkNested(declaredKindsEntryRoot(root, d), parent, d.id, d.graphTypologies ?? [], registry, out, new Set());
  }
  return out;
}

/**
 * One level of {@link nestedDirectories}, then the next: a nested entry whose
 * OWN kind names a `declarationFile` is read in turn. Bean `rkqp` (owner
 * 2026-09-30): `voices/voices.json` declares `vendors/`, and
 * `vendors/vendors.json` declares each `vendors/<id>/`. That is two levels, and
 * the one-level read stopped at the first. The chain ends where a directory
 * carries no declaration, which is the "structure is inherited" of the #980
 * ruling. `seen` guards a declaration that names its own directory.
 */
function walkNested(
  abs: string,
  rel: string,
  id: string,
  kinds: readonly string[],
  registry: GraphTypologyRegistry,
  out: NestedDirectory[],
  seen: Set<string>,
): void {
  if (seen.has(abs)) return;
  seen.add(abs);
  const files = kinds.map((g) => registry.get(g)?.declarationFile).filter((f): f is string => typeof f === "string");
  for (const f of [...new Set(files)]) {
    const p = join(abs, f);
    if (!existsSync(p)) continue;
    let nested: {
      directories?: Array<{
        id?: string;
        path?: string;
        graphTypologies?: string[];
        description?: string;
        absent?: { reason: string };
        storage?: unknown;
        source?: unknown;
        subgraph?: unknown;
      }>;
    };
    try {
      projectedRead(p, "nested-directories"); // only `directories` is used below
      nested = JSON.parse(readFileSync(p, "utf-8"));
    } catch {
      continue;
    }
    for (const nd of nested.directories ?? []) {
      if (!nd.id || !nd.path) continue;
      const sub = nd.path.replace(/^\.\//, "").replace(/\/+$/, "");
      const entry: NestedDirectory = {
        id: `${id}/${nd.id}`,
        // The id every OTHER mechanism keys on — see {@link NestedDirectory}.
        ownId: nd.id,
        path: `${rel}/${sub}/`,
        graphTypologies: nd.graphTypologies ?? [],
        ...(nd.description ? { description: nd.description } : {}),
        // Carried through, not dropped. `absent`, `storage` and `source` each
        // say that the directory is NOT where its path says, or is not meant
        // to be there at all — so a consumer that loses them asks "is it on
        // disk?" and gets the wrong answer with no way to tell. Measured
        // 2026-10-03 (bean `xsrv`): `check:declared-dirs`, extended to reach
        // these entries, reported a nested entry carrying `absent.reason` as
        // an unexplained absence, because the reason never arrived. The same
        // loss would make an eventual `storage: { keyedBy: "route" }` on a
        // nested entry read as a missing directory — `contentIsOffCheckout`
        // cannot see a field it was not given. Latent until bean `najo`, which
        // gave the `queue` entry a branch `source` and found the next loss one
        // field over: `subgraph`, without which a consumer cannot tell a graph
        // mounted under its own id from one no mount can reach.
        ...(nd.absent ? { absent: nd.absent } : {}),
        ...(nd.storage ? { storage: nd.storage } : {}),
        ...(nd.source ? { source: nd.source } : {}),
        ...(nd.subgraph === true ? { subgraph: true as const } : {}),
        parentId: id,
      };
      out.push(entry);
      walkNested(join(abs, sub), `${rel}/${sub}`, entry.id, entry.graphTypologies, registry, out, seen);
    }
  }
}

// ── Core's kinds, registered ────────────────────────────────────
//
// THE WHOLE POINT OF THE LEAF, and the line that closes the `#464` class.
//
// `folio` is core's kind and stays core's kind. What changes is that nothing
// has to REMEMBER to trigger the registration: a reader lives in this module,
// so loading this module is a precondition of calling one, and this import
// makes the registration part of that load. The failure mode it replaces —
// `unknown graph typology "folio"`, thrown on a perfectly valid declaration
// because of what the process happened to import first — is now unreachable
// rather than merely unlikely.
//
// LAST in the file on purpose. `folio-graph-typology.ts` imports the registry
// leaf and nothing here, so there is no cycle at any position; placing it at
// the foot keeps it visibly a side effect of loading this module rather than
// something the declarations above depend on.
//
// `@ts-expect-error` is not needed and no binding is taken: the import is for
// its side effect, which is also why it must not be elided.
//
// WHAT THIS ONE IMPORT REPLACED, kept here because it was the evidence and
// this is now its only home. Before the trigger moved here, every module that
// resolved a declared directory had to carry its own copy. Measured
// 2026-09-20 across the 20 modules that do: **10 of them threw** `unknown
// graph typology "folio"` on a valid declaration — including `narratives.ts` and
// the `translation` MCP tool — **while every gate and all 3298 tests
// passed.** Nothing covered the path. That is the #464 class, and the reason
// the fix had to be a precondition of loading a reader rather than a rule
// each caller remembers.
//
// The 74 redundant copies were removed by bean `z9ax` once this made them
// no-ops. Two were NOT removed and are the mechanism rather than instances of
// the problem: this import, and `schemas/test-preload.ts`.
import "./folio-graph-typology.js";
// The `glossary` kind was registered here too until folio-assistant#2598: it
// is now a node in the content layer's own `typologies/` graph (owner
// 2026-09-23, "put glossary into" the content layer).
import { ThemeRefSchema, type ThemeRef } from "../ui/theme";
import { CONFIG_SUFFIX, DECLARATION_SUFFIX, findDeclarationFile, layerRootsIn, isForeignCheckout, lockFilesIn } from "./instance-roots";
import { projectedRead } from "../sdlc/read-projections";
import { closeOverRequires, declaredEnableSubgraphs, declaredOptInRequires, enabledSubgraphsFrom, isSubgraphEnabled, ownOptInId, switchedOff, type EnabledSubgraphs } from "./opt-in-subgraphs";
import { leftOutByMount, mountScopeFor } from "./remote-mount";
// Layer DISCOVERY lives in a leaf module (bean dmx1), so the graph-typology
// registry can find each harness's declared `kinds/` without importing this
// file, which imports the registry. Re-exported here so no caller moves.
export { CONFIG_SUFFIX, DECLARATION_SUFFIX, findDeclarationFile, layerRootsIn, instanceRootsIn, isForeignCheckout } from "./instance-roots";

// Old names, kept so callers in other layers keep working while they move to
// the layer names (cat-harness#1138 P4). Remove once no layer imports them.
/** @deprecated Use {@link layerConfigFilename}. */
export const instanceConfigFilename = layerConfigFilename;
