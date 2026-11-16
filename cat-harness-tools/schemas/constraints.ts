/**
 * @module @folio-assistant/schemas/constraints
 * @description Zod validation schemas for all framework types.
 *
 * These schemas provide runtime validation and are used by the
 * schema generation scripts to produce JSON Schema files.
 * @graphNode schema
 */

import { z } from "zod";

import {
  formalRefPattern,
  formalRefPatternMessage,
} from "./formal-ref.js";
import type { Block } from "./types.js";
// Leaf module — importing the kind list from `types.js` would be a runtime
// cycle, and `appliesTo` is built at module init, exactly when that bites.
import { BLOCK_KIND_NODES, BLOCK_KINDS } from "./content/block-kinds.js";
import { NarrativeSlotSchema } from "./content/narrative.ts";



// The skill-framework vocabulary — actors, capabilities, skills, requirements,
// the package registry — moved to `skill-package.ts`, which is the harness's
// own and carries no content-model dependency. Re-exported here so every
// existing importer is unaffected; new harness code imports it directly.
export {
  ACTOR_KINDS,
  ActorDefinitionSchema,
  ActorKindSchema,
  CapabilityDefinitionSchema,
  CapabilityDetectionSchema,
  ConformanceSchema,
  DegradationStrategySchema,
  DependencyKindSchema,
  DockerRequirementsSchema,
  HookCommandSchema,
  HookEventSchema,
  IdentitySourceSchema,
  LifecycleStageSchema,
  RemotePackageRefSchema,
  RemoteSkillRecordSchema,
  RemoteSyncConfigSchema,
  RemoteSyncStrategySchema,
  RequirementSchema,
  RequirementStatementRefSchema,
  RequirementStatementSchema,
  RoleAssignmentSchema,
  SUT_ACTOR_KINDS,
  SessionHookSchema,
  SkillCapabilityRefSchema,
  SkillDefinitionSchema,
  SkillDependencySchema,
  SkillPackageManifestSchema,
  SkillPackageRefSchema,
  SkillRegistrySchema,
  SkillSchemaRefSchema,
  SystemUnderTestFacetSchema,
  sutRefFor,
} from "./kg/skill-package.js";
export type {
  ActorDefinition,
  ActorKind,
  CapabilityDefinition,
  CapabilityDetection,
  Conformance,
  DegradationStrategy,
  DependencyKind,
  DockerRequirements,
  HookCommand,
  HookEvent,
  IdentitySource,
  LifecycleStage,
  RemotePackageRef,
  RemoteSyncConfig,
  RemoteSyncStrategy,
  Requirement,
  RequirementStatement,
  RequirementStatementRef,
  RoleAssignment,
  SessionHook,
  SkillCapabilityRef,
  SkillDefinition,
  SkillDependency,
  SkillPackageManifest,
  SkillPackageRef,
  SkillRegistry,
  SystemUnderTestFacet,
} from "./kg/skill-package.js";



/**
 * Every recognised BUILT-IN label prefix, with its colon.
 *
 * The block kinds' prefixes, read off their discovered nodes (bean riit,
 * step 2), plus the structural ones; their agreement with
 * `KIND_PREFIXES` in `jsonld.ts` is asserted by `assertPrefixesInSync`. The
 * `dak` adapter's prefixes were spread in here until bean `1335`: they are a
 * contributed adapter's now, carried as `labelPrefix` on each contributed kind
 * (`ContributionRegistry.contributedLabelPrefixes()`).
 */
export const KNOWN_LABEL_PREFIXES: readonly string[] = [
  ...new Set(BLOCK_KIND_NODES.map((n) => `${n.labelPrefix}:`)),
  // Structural prefixes: a section, chapter, appendix or bibliography entry
  // is not a block kind, so no node carries these.
  "sec:", "chap:", "app:", "bib:",
];

/**
 * Whether `label` points outside this paper.
 *
 * `contributedPrefixes` are the label prefixes a registry's contributed kinds
 * carry (`ContributionRegistry.contributedLabelPrefixes()`, which records them
 * without the colon — `"dt"` — so one is added here before matching).
 * Without them a contributed kind's own label — a DAK `dt:` since bean `1335`
 * — reads as cross-paper, because core's list is the built-in prefixes only.
 */
export function isCrossPaperRef(label: string, contributedPrefixes: readonly string[] = []): boolean {
  if (!label.includes(":")) return false;
  const contributed = contributedPrefixes.map(p => (p.endsWith(":") ? p : `${p}:`));
  return ![...KNOWN_LABEL_PREFIXES, ...contributed].some(p => label.startsWith(p));
}

// ── Label patterns ───────────────────────────────────────────────

/**
 * Label prefix must match object kind.
 *
 * Exported because the ingest writer mints block ids for extracted content and
 * must use the same prefixes an author would — a fourth hand-written copy is
 * how `alg:` came to be missing from `KNOWN_LABEL_PREFIXES` for as long as it
 * was.
 */
export const LABEL_PREFIXES: Record<string, string> = Object.fromEntries(
  BLOCK_KIND_NODES.filter((n) => n.prefixEnforced).map((n) => [n.kind, `${n.labelPrefix}:`]),
);

/**
 * Provable-label prefixes — used by AlgorithmSchema to enforce that
 * every `algorithm` block cites at least one upstream provable in
 * `uses[]`. Algorithms are downstream of math: an algorithm without
 * a citation to a definition / proposition / theorem / lemma /
 * corollary / conjecture cannot be justified.
 */
const PROVABLE_LABEL_PREFIXES: readonly string[] = [
  ...new Set(BLOCK_KIND_NODES.filter((n) => n.provable).map((n) => `${n.labelPrefix}:`)),
];

/**
 * The label schema for a block of `kind`: its node's prefix when the node
 * enforces one. Exported for a vocabulary module (`vocabulary-modules.ts`),
 * whose kinds' schemas are built the same way.
 */
export function labelForKind(kind: string) {
  const prefix = LABEL_PREFIXES[kind];
  if (!prefix) return z.string().min(1);
  return z.string().startsWith(prefix, {
    message: `Label for ${kind} must start with "${prefix}"`,
  });
}

// ── Lean reference ───────────────────────────────────────────────

const LeanValidationSchema = z.enum([
  "not_checked", "stub", "trivial", "external", "validated", "error",
  "leanok",        // sorry-free, built successfully
  "axioms_only",   // type-checks but uses axioms (no sorry)
]);

export const LeanRefSchema = z.object({
  // The shape is the FORMALISM LAYER's, injected through `formal-ref.ts` on the
  // owner ruling of 2026-09-27 that the `lean.ref` grammar is science
  // vocabulary. Core validates that the field holds a reference; it does not
  // know what one looks like.
  //
  // `superRefine`, NOT `.regex()`, and this is load-bearing rather than
  // stylistic: a `z.object({...})` literal is evaluated at MODULE INIT, which
  // is strictly before any layer can install itself, so `.regex(pattern)`
  // would freeze whatever pattern existed during import — i.e. the
  // unconfigured fallback, forever. The refinement callback runs per
  // `parse()`, so the injected pattern is in place by then. The error message
  // comes from the layer too, since it doubles as migration guidance in that
  // layer's own vocabulary.
  ref: z
    .string()
    .min(1, "Lean ref is required")
    .superRefine((value, ctx) => {
      if (formalRefPattern().test(value)) return;
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: formalRefPatternMessage() });
    }),
  sorryFree: z.boolean().optional(),
  mathlibLinks: z.array(z.string()).optional(),
  validation: LeanValidationSchema.optional(),
  leanHash: z.string().optional(),
  witnessed: z.boolean().optional(),
});

// ── Companions ───────────────────────────────────────────────────

export const CompanionsSchema = z.record(z.string(), z.string().optional());

// ── Todo schema ──────────────────────────────────────────────

export const TodoItemSchema = z.object({
  id: z.string().min(1),
  summary: z.string().min(1),
  comment: z.string(),
  status: z.enum(["open", "in_progress", "blocked", "resolved", "wontfix"]),
  priority: z.enum(["critical", "high", "medium", "low"]),
  origin: z.enum(["agent", "human", "qc", "extracted"]),
  targetLabel: z.string().optional(),
  assignee: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  related: z.array(z.string()).optional(),
  /**
   * Which theme's art backs this todo's sticky.
   *
   * The owner, 2026-09-20: *"todos need grump cat themeing based on content
   * too. used jugement"*. Bean `5y4b`.
   *
   * ## Declared, never inferred at render time
   *
   * The obvious implementation is to keyword-match the summary in the renderer
   * — "ingest" takes `library`, "deploy" takes `operations`. That is a rule
   * nobody can see, review or override, and it **changes silently when
   * somebody rewords a todo**. A theme is a claim about what the todo IS, so it
   * belongs on the todo as data.
   *
   * ## Why a bare string rather than an enum of theme ids
   *
   * Same reason `GraphNodeDirectorySchema.graphTypologies` is an open string checked
   * against the registry later: a closed enum has to be built at module load,
   * and this module is the CONTENT model — importing the theme table here
   * would drag rendering into the content schema and give every consumer of a
   * todo a dependency on the palette. Unknown values are a rendering finding,
   * not a parse error.
   *
   * ## Absent means the layer's own theme, and that is the safe default
   *
   * A wrong theme is worse than no theme: a plain card says nothing, while a
   * card themed `operations` asserts the todo is operations work. So the
   * default is inherited rather than guessed, and a theme here is something
   * somebody chose.
   */
  theme: z.string().min(1).optional(),
});

// ── Feedback schema ──────────────────────────────────────────

export const FeedbackItemSchema = TodoItemSchema.extend({
  author: z.string().optional(),
  authorEmail: z.string().optional(),
});

// ── Block schemas ────────────────────────────────────────────────

const RenderedAssetSchema = z.object({
  mime: z.string(),
  url: z.string(),
  blockIndex: z.number().int().nonnegative(),
  hash: z.string().optional(),
});

const SimulatorRefSchema = z.object({
  ref: z.string().startsWith("sim:", { message: "Simulator ref must start with 'sim:'" }),
  view: z.string().optional(),
});

const SimulatorViewSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
});

/**
 * Author-tracking notes attached to a content block (see
 * `BlockBase.authorNotes` in folio-assistant/schemas/types.ts +
 * CLAUDE.md §4d). Validates the shape of `authorNotes` entries
 * with the 5 allowed `kind` values.
 */
export const AuthorNoteSchema = z.object({
  kind: z.enum(["status", "caveat", "note", "refined-framing", "deprecated"]),
  date: z.string().optional(),
  body: z.string(),
  see: z.string().optional(),
});

/**
 * Shared block fields, exported so the `dak` adapter's schemas in
 * the DAK layer's `schemas/dak-blocks.ts` extend the same base rather than restating it.
 */
export const BlockBaseSchema = z.object({
  title: z.string().optional(),
  /**
   * Role ids from the layer's KG — see `BlockBase.audience` in
   * `schemas/types.ts`. Declared HERE as well as there because Zod strips
   * what it does not know: a field TypeScript accepts and Zod drops is
   * written by an author, type-checks, and vanishes (bean `zdrf`).
   */
  audience: z.array(z.string()).optional(),
  uses: z.array(z.string()).optional(),
  /**
   * Former labels — see `BlockBase.renamedFrom` in `schemas/types.ts`.
   * Declared here too because Zod strips what it does not know (bean `zdrf`).
   */
  renamedFrom: z.array(z.string().min(1)).optional(),
  foreshadows: z.array(z.string()).optional(),
  cites: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  companions: CompanionsSchema.optional(),
  rendered: z.array(RenderedAssetSchema).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  simulator: SimulatorRefSchema.optional(),
  authorNotes: z.array(AuthorNoteSchema).optional(),
  /**
   * Glossary term slugs introduced by this block. See `BlockBase.defines`
   * in folio-assistant/schemas/types.ts for the authoring contract. Slugs
   * must be lowercase, hyphen-separated identifiers (no spaces, no `:`).
   */
  defines: z
    .array(z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "term slug must be lowercase, hyphen-separated"))
    .optional(),
  // Forward reference: ComputationSchema is declared further down in the
  // same module.  z.lazy keeps the cyclic reference safe.
  computation: z.lazy(() => ComputationSchema).optional(),
  /**
   * BCP 47 language tag of this block's **source** content. See
   * `BlockBase.lang` in folio-assistant/schemas/types.ts for the authoring
   * contract and the defaulting rule (absent means the folio's
   * `translation.defaultLocale`).
   */
  lang: z.string().optional(),
  /**
   * PO sources carrying translations for this block, in load order. See
   * `BlockBase.poSources` in folio-assistant/schemas/types.ts for the
   * resolution order and why declaring it disables the convention walk.
   */
  poSources: z.array(z.string()).optional(),
});

export const ProvableBaseSchema = BlockBaseSchema.extend({
  // TS `ProvableBase` declares `lean?: LeanRef`; only `DefinitionSchema` (now the science layer's)
  // declared it here, so a theorem / lemma / proposition / corollary /
  // algorithm writing `lean: { ref: … }` had it SILENTLY STRIPPED at the
  // validation boundary — the link into Lean, on exactly the kinds whose
  // whole point is to carry one. Optional, matching TS: `DefinitionSchema`
  // keeps its own required override.
  lean: LeanRefSchema.optional(),
  proofs: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
});

/**
 * Algorithm — specialised proposition, must cite at least one
 * upstream provable in `uses[]`. The "downstream of math"
 * invariant is enforced by `BlockSchema.superRefine` below (kept
 * out of the per-kind schema so the discriminated union sees a
 * ZodObject, which is required by `z.discriminatedUnion`).
 */
export const AlgorithmSchema = ProvableBaseSchema.extend({
  kind: z.literal("algorithm"),
  label: labelForKind("algorithm"),
  // Forward reference: ComputationSchema is declared further down in
  // the same module (mirrors BlockBaseSchema's `computation` field).
  computation: z.lazy(() => ComputationSchema).optional(),
  interprets: z.string().min(1).optional(),
});

/**
 * Returns true iff at least one entry in `uses` references a
 * provable block — accepts both same-paper labels (e.g.
 * `"prop:foo"`) and cross-paper qualified labels (e.g.
 * `"unital-groebner-bases:thm:bar"`).
 */
export function citesProvable(uses: string[] | undefined): boolean {
  if (!uses || uses.length === 0) return false;
  return uses.some((u) => {
    if (u.startsWith("http")) return false;
    return PROVABLE_LABEL_PREFIXES.some((prefix) => {
      // Accept same-paper labels ("prop:foo") and any cross-paper /
      // namespaced qualifier ("paper-dir:prop:foo",
      // "namespace:paper-dir:prop:foo"). Per Gemini review on
      // PR #1724: scan for the prefix anywhere after a colon, not
      // just after the first colon, to handle nested namespaces.
      return u.startsWith(prefix) || u.includes(":" + prefix);
    });
  });
}


export const ExampleSchema = BlockBaseSchema.extend({
  kind: z.literal("example"),
  label: labelForKind("example"),
  /** Label of the provable block this example interprets. Declared on TS
   *  `ExampleBlock` and missing here, unlike its `algorithm` and `remark`
   *  siblings — so it was silently stripped. `.min(1)` matches theirs. */
  interprets: z.string().min(1).optional(),
  lean: LeanRefSchema.optional(),
});

export const RemarkSchema = BlockBaseSchema.extend({
  kind: z.literal("remark"),
  label: labelForKind("remark"),
  lean: LeanRefSchema.optional(),
  /** Label of the provable block this remark interprets. */
  interprets: z.string().min(1).optional(),
});

// Keep in sync with the `ComputationEngine` union in `types.ts`.
const ComputationEngineSchema = z.enum([
  "snappea", "sympy", "mpmath", "sage", "python", "numpy", "scipy",
  "closed-form", "python+mpmath", "python+numpy+cvxpy",
  "rust", "python+rust",
]);

const ComputationStatusSchema = z.enum([
  "not_run", "verified", "failed", "error", "stale", "experimental",
]);

export const ComputationSchema = z.object({
  engine: ComputationEngineSchema,
  script: z.string().min(1, "Script path is required"),
  witness: z.union([z.string(), z.array(z.string()).min(1)]).optional(),
  status: ComputationStatusSchema,
  requires: z.array(z.string()).optional(),
});


export const SimulatorSchema = BlockBaseSchema.extend({
  kind: z.literal("simulator"),
  label: labelForKind("simulator"),
  html: z.string().min(1, "Path to simulator HTML file is required"),
  defaultView: SimulatorViewSchema,
  views: z.array(SimulatorViewSchema).optional(),
});

// ── prose / equation / diagram / table ───────────────────────────
//
// These four RESTATED the base fields instead of extending
// `BlockBaseSchema`, and restating is how they kept losing fields. The
// 2026-08-24 grant (bean `folio-assistant-5nle`) added `authorNotes` to all
// four by hand and stopped there; `defines` was still missing from all four,
// and `cites` / `simulator` / `computation` from three of them. A zod object
// is non-strict, so every one of those was accepted at authoring time and
// silently stripped — no error, no warning from the schema itself.
//
// `defines` is the one that bites. AGENTS.md §4c REQUIRES every glossary
// term to be declared in `defines[]`, and the `defterm-declared` rule reads
// that array; on these four kinds it was being discarded before the rule ever
// saw it, so a `table` or `prose` block introducing a term could not be
// declared at all.
//
// The same defect has a scar in this file's neighbour: see `BLOCK_KINDS` in
// schemas/types.ts, where `algorithm` and `table` were added to the union and
// never propagated to five hand-maintained lists, excluding 461 qou blocks
// from every sweep. Restating a set that already exists is the shared cause.
//
// So: extend the base, and add only what is genuinely kind-specific. A field
// added to `BlockBaseSchema` from now on reaches these four automatically.
export const ProseSchema = BlockBaseSchema.extend({
  kind: z.literal("prose"),
  // Deliberately NOT `labelForKind("prose")` — prose blocks carry free-form
  // labels (`intro-...`, `rem:...`), so the prefix rule does not apply.
  label: z.string().optional(),
});

export const EquationSchema = BlockBaseSchema.extend({
  kind: z.literal("equation"),
  label: labelForKind("equation").optional(),
  tex: z.string().optional(),
});

export const DiagramSchema = BlockBaseSchema.extend({
  kind: z.literal("diagram"),
  label: labelForKind("diagram").optional(),
  tex: z.string().optional(),
  caption: z.string().optional(),
});

export const TableSchema = BlockBaseSchema.extend({
  kind: z.literal("table"),
  label: labelForKind("table").optional(),
  tex: z.string().optional(),
  caption: z.string().optional(),
});

/**
 * A figure EXTRACTED from a source document — bean `d5f1`.
 *
 * `file` is required and there is no `tex`, which is the whole distinction
 * from {@link DiagramSchema}: a diagram is authored tikzcd source, a figure is
 * an image somebody's document already contained. A figure block with no file
 * is a claim about an image nobody can look at.
 *
 * `narrative` is a state machine rather than a string, so that who wrote a
 * description and whether a human accepted it travel with it.
 */
export const FigureSchema = BlockBaseSchema.extend({
  kind: z.literal("figure"),
  label: labelForKind("figure").optional(),
  file: z.string().min(1),
  caption: z.string().optional(),
  page: z.number().int().min(1).optional(),
  // A slot like every other narrative record (bean `cat-tools-e1lo`, owner
  // ruling 2026-10-22, 3A): one entry per language, or the empty slot.
  narrative: NarrativeSlotSchema.optional(),
});

/** A code in a declared code list; see `CodeRef` in `types.ts`. */
export const CodeRefSchema = z.object({ list: z.string().min(1), code: z.string().min(1) }).strict();

export const RecommendationSchema = BlockBaseSchema.extend({
  kind: z.literal("recommendation"),
  // The folio chooses the prefix (owner, Q1), so its node sets
  // `prefixEnforced: false` and this resolves to a non-empty string.
  label: labelForKind("recommendation"),
  strength: CodeRefSchema.optional(),
  about: z.array(z.string().min(1)).optional(),
});

/** Discriminated union — validates any Block. */
export const BlockSchema = z
  .discriminatedUnion("kind", [
    AlgorithmSchema,
    ExampleSchema,
    RemarkSchema,
    SimulatorSchema,
    ProseSchema,
    EquationSchema,
    DiagramSchema,
    TableSchema,
    FigureSchema,
    RecommendationSchema,
  ])
  .superRefine((block, ctx) => {
    // Cross-kind invariant: an `algorithm` block must cite at least
    // one upstream provable in `uses[]` (algorithms are downstream
    // of math). Encoded here rather than inside `AlgorithmSchema`
    // so the discriminated union still sees ZodObjects.
    if (block.kind === "algorithm" && !citesProvable(block.uses)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["uses"],
        message:
          "An `algorithm` block must cite at least one provable " +
          "(def:/prop:/thm:/lem:/cor:/conj:) in `uses[]` — " +
          "algorithms are downstream of math.",
      });
    }
  });

// ── Chapter / Document schemas ───────────────────────────────────

export const SectionSchema = z.object({
  title: z.string().min(1),
  label: z.string().optional(),
  blocks: z.array(z.string().min(1)),
  lead: z.boolean().optional(),
}).passthrough();

export const SectionRefSchema = z.object({
  name: z.string().min(1),
  uri: z.string().optional(),
});

export const ChapterSchema = z.object({
  number: z.number().int().positive().optional(),
  tabLabel: z.string().max(3).optional(),
  title: z.string().min(1),
  label: z.string().optional(),
  sections: z.array(z.union([SectionSchema, SectionRefSchema])),
  meta: z.record(z.string(), z.unknown()).optional(),

});

export const ChapterRefSchema = z.object({
  uri: z.string().optional(),
  dir: z.string().min(1),
  partTitle: z.string().trim().min(1).optional(),
});

const PaperMacroSchema = z.object({
  tex: z.string().min(1),
  unicode: z.string().optional(),
});

export const PaperSchema = z.object({
  title: z.string().min(1),
  authors: z.array(z.string().min(1)).min(1),
  affiliations: z.array(z.string()).optional(),
  emails: z.array(z.string().email()).optional(),
  urls: z.array(z.string().url()).optional(),
  date: z.string().optional(),
  abstract: z.string().optional(),
  chapters: z.array(ChapterRefSchema),
  macros: z.record(z.string(), PaperMacroSchema).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

/** @deprecated Use PaperSchema. */
export const DocumentSchema = z.object({
  title: z.string().min(1),
  authors: z.array(z.string().min(1)).min(1),
  date: z.string().optional(),
  chapters: z.array(ChapterSchema),
  meta: z.record(z.string(), z.unknown()).optional(),
});

// ── Folio schemas ─────────────────────────────────────────────

export const PaperRefSchema = z.object({
  dir: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const FolioSchema = z.object({
  title: z.string().min(1),
  papers: z.array(PaperRefSchema).min(1),
  meta: z.record(z.string(), z.unknown()).optional(),
});

// ── Constraint rules (beyond schema shape) ───────────────────────

export interface ConstraintRule {
  id: string;
  description: string;
  /** Which block kinds this rule applies to. */
  appliesTo: string[];
  /** Check function — returns error message or null. */
  check: (block: Block, context: ConstraintContext) => string | null;
}

export interface ConstraintContext {
  /** Root name of the .ts file. */
  rootName: string;
  /** Directory containing the object files. */
  dir: string;
  /** Set of all labels in the document (for cross-ref validation). */
  allLabels: Set<string>;
  /** Set of all bibliography keys (for citation validation). */
  allRefIds?: Set<string>;
  /** File existence checker. */
  fileExists: (path: string) => boolean;
  /** Markdown content of the companion .md file (for cross-ref scanning). */
  mdContent?: string;
  // A vocabulary module's rules may read more than this: whatever its
  // `constraintContext` contributes (below), typed in that module's own layer
  // by extending this interface — the science layer's sibling `.lean` and
  // Lake-tree lookup, for one (bean `saqd`). They are not this layer's to name.
}

/**
 * A vocabulary module's contribution to every block's {@link ConstraintContext}:
 * called once per validation run with the folio's content root, then once per
 * block; what the inner call returns is merged into that block's context
 * before the rules run. Fields the generic context already has are not
 * overridden.
 */
export type ConstraintContextContributor = (run: {
  repoRoot: string;
}) => (block: { rootName: string; dir: string }) => Readonly<Record<string, unknown>>;

/**
 * Built-in constraint rules.
 *
 * Pipeline runs these after Zod schema validation.
 * Add custom rules by appending to this array.
 */
export const CONSTRAINT_RULES: ConstraintRule[] = [
  {
    id: "foreshadows-resolve",
    description:
      "All labels in foreshadows[] must exist in the document (or be " +
      "qualified cross-paper refs)",
    // Universal: any block that can carry `uses[]` can carry a foreshadow, so
    // this must not narrow as new kinds appear.
    appliesTo: [...BLOCK_KINDS],
    // Replaces `foreshadows-subset-of-uses` (removed 2026-08-10, owner
    // ruling). That rule required every foreshadow to also appear in `uses[]`,
    // which made the field an ANNOTATION ON an edge and nothing more. It
    // therefore could not express the case it was most wanted for: a chapter
    // overview (§0) naming results it previews but does not depend on. Under
    // the old rule, recording such a pointer meant first asserting a
    // dependency that is not real — see the eight `overview-source` rows in
    // qou's `docs/audits/uses-edge-rejections.json`.
    //
    // `foreshadows[]` is now INDEPENDENT of `uses[]`. An entry may be:
    //   - also in `uses[]` → a real prerequisite the paper states later on
    //     purpose ("we will need X, proved in chapter 9"). Exempt from the
    //     ordering-COST metrics; still counted for cycles, cones and depth.
    //   - not in `uses[]` → a pure forward pointer. Never enters the
    //     dependency graph at all, so it is zero-cost by construction.
    //
    // The old rule was also carrying referential integrity: it caught a
    // foreshadow whose target had been renamed or deleted, because `uses[]`
    // validation rejected the same label. With the subset requirement gone
    // that protection would vanish too, so this rule takes it over directly.
    // Same reference forms as `uses-resolve`.
    check: (block, ctx) => {
      const fs = (block as { foreshadows?: string[] }).foreshadows;
      if (!fs?.length) return null;
      const missing = fs.filter((f: string) => {
        // Cross-paper qualified ref ("paper-dir:label") — resolved at folio
        // level, not here. Mirrors uses-resolve.
        if (/^([a-z0-9-]+):([a-z]+:.+)$/.test(f)) return false;
        if (f.startsWith("https://") || f.startsWith("http://")) return false;
        return !ctx.allLabels.has(f);
      });
      return missing.length === 0 ? null
        : `Unresolved foreshadows: ${missing.join(", ")}`;
    },
  },
  {
    id: "foreshadows-not-self",
    description: "A block may not foreshadow itself",
    appliesTo: [...BLOCK_KINDS],
    // Cheap, but worth stating: with the subset rule gone nothing else
    // rejects it. A self-reference would be silently zero-cost and would read
    // as a deliberate pointer.
    check: (block) => {
      const fs = (block as { foreshadows?: string[] }).foreshadows;
      if (!fs?.length) return null;
      const self = (block as { label?: string }).label;
      if (!self) return null;
      return fs.includes(self)
        ? `foreshadows[] contains the block's own label: ${self}`
        : null;
    },
  },
  {
    id: "md-exists",
    description: "Every block must have a companion .md file",
    // cat-harness's own kinds; the science layer's vocabulary module carries
    // the same check for its kinds (`mathpaper-md-exists`).
    appliesTo: ["example", "remark", "simulator", "prose", "recommendation"],
    check: (_block, ctx) => {
      const mdPath = `${ctx.dir}/${ctx.rootName}.md`;
      return ctx.fileExists(mdPath) ? null : `Missing companion: ${mdPath}`;
    },
  },
  {
    id: "simulator-html-exists",
    description: "Simulators must have a companion .html file",
    appliesTo: ["simulator"],
    check: (block, _ctx) => {
      if ("html" in block && block.html) return null;
      return `Simulator "${block.label}" requires an html field pointing to the simulator HTML file`;
    },
  },
  {
    id: "simulator-ref-resolve",
    description: "Blocks with simulator refs must reference an existing simulator label",
    appliesTo: [
      // `simulator` is a BlockBase field, so ANY kind can carry one. The
      // check below returns null when the field is absent, so listing
      // fewer kinds only creates blind spots — `validate.ts` skips an
      // unlisted kind without a word.
      ...BLOCK_KINDS,
    ],
    check: (block, ctx) => {
      if (!("simulator" in block) || !block.simulator) return null;
      const ref = (block.simulator as { ref: string }).ref;
      if (!ctx.allLabels.has(ref)) {
        return `Simulator ref "${ref}" not found in document labels`;
      }
      return null;
    },
  },
  {
    id: "uses-resolve",
    description: "All labels in uses[] must exist in the document (or be qualified cross-paper refs)",
    appliesTo: [
      // `uses` is a BlockBase field, so ANY kind can carry one — the same
      // reason `cites-resolve` and `simulator-ref-resolve` derive theirs.
      // This list was written out by hand and happened to name all fifteen
      // kinds of the day, which is indistinguishable from a derived list
      // right up to the moment a kind is added: `figure` (bean `d5f1`) was
      // then silently unchecked, and `validate.ts` skips an unlisted kind
      // without a word. Derived now, so that cannot recur.
      ...BLOCK_KINDS,
    ],
    check: (block, ctx) => {
      if (!("uses" in block) || !block.uses) return null;
      const missing = block.uses.filter((u: string) => {
        // An empty entry is never resolvable and must be reported as one —
        // not skipped. Ten `*-table-data` blocks in qou carry `uses: [""]`
        // beside `title: "Data table N from "`, an extraction generator that
        // failed to substitute its source label.
        if (u.trim() === "") return true;
        // Cross-paper qualified ref: "paper-dir:label" (contains exactly
        // one colon-delimited paper prefix before the label-kind prefix).
        // Pattern: non-label chars, colon, then a standard label.
        // e.g. "unital-groebner-bases:cor:pbw"
        const crossPaperMatch = u.match(/^([a-z0-9-]+):([a-z]+:.+)$/);
        if (crossPaperMatch) return false;  // skip — resolved at folio level
        // Full URL cross-folio ref
        if (u.startsWith("https://") || u.startsWith("http://")) return false;
        // Same-paper ref — must exist in allLabels
        return !ctx.allLabels.has(u);
      });
      // Quote each label: an empty entry rendered bare produced
      // "Unresolved uses: " with nothing after it, which reads as a checker
      // bug rather than as the content defect it is.
      return missing.length === 0 ? null
        : `Unresolved uses: ${missing.map((u: string) => JSON.stringify(u)).join(", ")}`;
    },
  },
  {
    id: "cites-resolve",
    description: "All citation keys in cites[] must exist in references.ts",
    appliesTo: [
      // `cites` is a BlockBase field — every kind can carry one. An
      // `algorithm` or `table` block citing a key absent from
      // references.ts used to pass by never being looked at.
      ...BLOCK_KINDS,
    ],
    check: (block, ctx) => {
      if (!("cites" in block) || !block.cites || !ctx.allRefIds) return null;
      const missing = (block.cites as string[]).filter((c: string) => !ctx.allRefIds!.has(c));
      return missing.length === 0 ? null
        : `Unresolved citations: ${missing.join(", ")}`;
    },
  },
  {
    id: "remark-interprets",
    description: "Remarks should have an `interprets` field linking to a provable block, or be glossary entries",
    appliesTo: ["remark"],
    check: (block, _ctx) => {
      // Glossary remarks (Ch 8) are exempt — they wrap Mathlib types
      if ("tags" in block && Array.isArray(block.tags) && block.tags.includes("glossary")) {
        return null;
      }
      if ("interprets" in block && block.interprets) return null;
      return `[warning] ${block.label}: remark has no \`interprets\` field — dangling remark (no formal backing)`;
    },
  },
  {
    id: "interprets-resolve",
    description: "The `interprets` label must exist in the document",
    appliesTo: ["remark"],
    check: (block, ctx) => {
      if (!("interprets" in block) || !block.interprets) return null;
      const target = block.interprets as string;
      // Allow cross-paper refs
      if (target.includes(":") && !target.startsWith("rem:") && !target.startsWith("def:") &&
          !target.startsWith("thm:") && !target.startsWith("lem:") && !target.startsWith("prop:") &&
          !target.startsWith("cor:") && !target.startsWith("conj:") && !target.startsWith("ex:")) {
        return null;
      }
      if (target.startsWith("https://") || target.startsWith("http://")) return null;
      return ctx.allLabels.has(target) ? null
        : `interprets label "${target}" not found in document`;
    },
  },
  {
    id: "md-crossref-resolve",
    description: "All [text](#label) cross-references in .md content must resolve to existing labels",
    appliesTo: [
      // Guarded on `ctx.mdContent` below, so kinds without an .md are
      // already no-ops. A `proof` block's .md with a broken
      // `[text](#label)` was simply never checked.
      ...BLOCK_KINDS,
    ],
    check: (_block, ctx) => {
      if (!ctx.mdContent) return null;
      const matches = ctx.mdContent.matchAll(/\[([^\]]*)\]\(#([^)]+)\)/g);
      const missing: string[] = [];
      for (const match of matches) {
        const label = match[2];
        // Skip cross-paper references and URLs
        if (isCrossPaperRef(label)) continue;
        if (label.startsWith("https://") || label.startsWith("http://")) continue;
        if (!ctx.allLabels.has(label)) {
          missing.push(label);
        }
      }
      return missing.length === 0 ? null
        : `[warning] Undefined cross-reference(s) in .md: ${missing.join(", ")}`;
    },
  },
];

/**
 * The `kind` literal of each member of {@link BlockSchema}'s union: the block
 * kinds the CODE types. Block kinds themselves are discovered from nodes (bean
 * riit, step 2), so `check:kind-validators` and `block-kind-nodes.test.ts`
 * compare this against the discovered set in both directions.
 */
export function typedBlockKinds(): string[] {
  const options = (BlockSchema as unknown as { options: { shape: { kind: { value: string } } }[] }).options;
  return options.map((o) => o.shape.kind.value);
}


