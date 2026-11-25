export { isCrossPaperRef, KNOWN_LABEL_PREFIXES } from "./constraints.js";
/**
 * @module @folio-assistant/schemas
 * @description Core TypeScript type definitions for the agent skills framework.
 *
 * ALL types are inferred from Zod schemas in constraints.ts, which is the
 * single source of truth. This eliminates drift between types and validation.
 *
 * Aligned with FHIR R5 resource model (ActorDefinition, Requirements, CapabilityStatement).
 * TypeScript is the authoritative schema; JSON Schema is a generated artifact.
 *
 * @see {@link https://hl7.org/fhir/R5/actordefinition.html} FHIR R5 ActorDefinition
 * @see {@link https://hl7.org/fhir/R5/requirements.html} FHIR R5 Requirements
 * @graphNode schema
 */

import type { NarrativeSlot } from "./content/narrative.ts";

// The skill-framework vocabulary moved to `skill-package.ts` — see that
// module's header. Re-exported so existing importers are unaffected; harness
// code should import it directly, which is what keeps the edge from returning.
export type {
  ActorKind,
  Conformance,
  DegradationStrategy,
  HookEvent,
  IdentitySource,
  DependencyKind,
  LifecycleStage,
  RemoteSyncStrategy,
  CapabilityDetection,
  ActorDefinition,
  CapabilityDefinition,
  SkillCapabilityRef,
  SkillDependency,
  SkillDefinition,
  RequirementStatementRef,
  RequirementStatement,
  Requirement,
  SkillPackageRef,
  HookCommand,
  SessionHook,
  SkillRegistry,
  RoleAssignment,
  DockerRequirements,
  SkillPackageManifest,
  RemoteSyncConfig,
  RemotePackageRef,
} from "./kg/skill-package.js";


// ─── Core Types ──────────────────────────────────────────────────────────────

// ─── Requirement ─────────────────────────────────────────────────────────────

// ─── Registry ────────────────────────────────────────────────────────────────

// ─── Docker Requirements ─────────────────────────────────────────────────────

// ─── Remote Package Reference ────────────────────────────────────────────────


// ── Lean linkage ─────────────────────────────────────────────────

/**
 * Reference to a Lean 4 declaration, addressed by a package-qualified URI.
 *
 * Format of `ref`: `"<package>:<Decl.Path>"`, where:
 *   - `<package>` is the Lake package short-name as declared in the
 *     root `lakefile.toml` (see `lean-packages.ts`).  Examples: `qou`,
 *     `ugb`, `fred2005`.
 *   - `<Decl.Path>` is the fully qualified Lean 4 declaration
 *     (namespace + name), e.g. `QOU.Torsion.lifting_exists`.
 *
 * Examples:
 *   - `"qou:QOU.CategoricalTransferMatrix"`
 *   - `"ugb:UGB.GrobnerShirshov.Basis"`
 *   - `"fred2005:Fred2005.FormalGroups.FormalGroupLaw"`
 *
 * The pipeline resolves `ref` to a `.lean` source file by:
 *   1. Looking up the package in `LEAN_PACKAGES` (→ paper directory,
 *      Lake root).
 *   2. Falling back to the sibling `.lean` file next to the block's
 *      `.ts` / `.md` when present.
 *
 * Rationale: a single URI is addressable in JSON Schema, cross-paper
 * references, and Lake build commands without encoding filesystem
 * paths into content.
 */
export interface LeanRef {
  /**
   * Package-qualified Lean 4 declaration URI
   * (e.g. `"qou:QOU.QuantumUniverse"`).  See module docstring above
   * for grammar.  Parse with `parseLeanRef` from `lean-packages.ts`.
   */
  ref: string;
  /** Whether the declaration is sorry-free. */
  sorryFree?: boolean;
  /** Related mathlib4 declaration names. */
  mathlibLinks?: string[];
  /** Validation status of the Lean code. */
  validation?: LeanValidation;
  /**
   * SHA-256 hash (12-char hex prefix) of the .lean file content.
   * Computed at export time. Used for witness-based cache invalidation:
   * if a `<block>.lean.<hash>.witness` file exists, Lean validation
   * can be skipped.
   */
  leanHash?: string;
  /**
   * Whether a valid witness file exists for the current leanHash.
   * True = `.lean.<hash>.witness` file found, Lean build was cached.
   * Populated at export time; displayed in the viewer as a cache badge.
   */
  witnessed?: boolean;
}

/**
 * Detailed Lean validation status.
 *
 * Distinguishes between stub declarations, trivially-true lemmas,
 * externally-sourced proofs, and fully validated code.
 */
export type LeanValidation =
  | "not_checked"      // .lean file exists but not yet validated
  | "stub"             // declaration stated but body is `sorry` or `_`
  | "trivial"          // proof is `by trivial`, `by simp`, `by rfl`, etc.
  | "external"         // proof references external resource (mathlib, etc.)
  | "validated"        // built and type-checked successfully
  | "error"            // build error
  | "leanok"           // sorry-free, built successfully
  | "axioms_only";     // type-checks but uses axioms (no sorry)

// ── Computational verification ───────────────────────────────────

/**
 * Computation engine identifier.
 *
 * Each engine has a known reproducibility profile:
 * - snappea: SnapPy/snappy for hyperbolic 3-manifold volumes, Dehn filling
 * - sympy: Symbolic algebra (identities, polynomial evaluation)
 * - mpmath: Arbitrary-precision floating-point (Clausen functions, dilogarithms)
 * - sage: SageMath for number theory, algebraic geometry
 * - rust: The `hecke-engine` crate (Layer 1 canonical compute core)
 *
 * Keep this union in sync with `ComputationEngineSchema` in
 * `constraints.ts` — the Zod enum is what actually gates validation, so
 * a value missing here fails silently at the type level rather than at
 * validation time. That is how `rust` / `python+rust` came to be live in
 * the schema but absent from this union.
 */
export type ComputationEngine =
  | "snappea"
  | "sympy"
  | "mpmath"
  | "sage"
  | "python"
  | "numpy"
  | "scipy"
  | "closed-form"
  | "python+mpmath"
  | "python+numpy+cvxpy"
  | "rust"
  | "python+rust";

/**
 * Status of a computational verification.
 */
export type ComputationStatus =
  | "not_run"       // script exists but has not been executed
  | "verified"      // script ran, witness matches expected values within tolerance
  | "failed"        // script ran, witness does NOT match expected values
  | "error"         // script crashed or could not run
  | "stale"         // witness exists but is older than script or inputs
  | "experimental"; // exploratory probe, not yet validated against expected values

/**
 * A single assertion in a computation witness.
 *
 * Each assertion is a named claim with a computed value, an expected value,
 * and an error bound.  The CI pipeline checks `|computed - expected| ≤ tolerance`.
 */
export interface ComputationAssertion {
  /** Human-readable name (e.g. "Vol(4_1)"). */
  name: string;
  /** Computed value from the script. */
  computed: number | string;
  /** Expected value from the paper / CODATA / etc. */
  expected: number | string;
  /** Absolute error tolerance.  Assertion passes if |computed - expected| ≤ tolerance. */
  tolerance?: number;
  /** Unit or context (e.g. "MeV", "dimensionless", "volume"). */
  unit?: string;
  /** Source of expected value (e.g. "CODATA 2022", "OEIS A091518"). */
  source?: string;
}

/**
 * Computation witness — the JSON output of a verification script.
 *
 * Stored as a `.witness.json` sibling file alongside the proof's `.py` script.
 * Committed to the repo for reproducibility.
 */
export interface ComputationWitness {
  /** Engine that produced this witness. */
  engine: ComputationEngine;
  /** Engine version string (e.g. "snappy 3.3.2", "sympy 1.13"). */
  engineVersion: string;
  /** ISO 8601 timestamp of computation. */
  computedAt: string;
  /** Git commit SHA at time of computation. */
  commitSha?: string;
  /** Assertions verified by this computation. */
  assertions: ComputationAssertion[];
  /** Whether all assertions passed. */
  allPassed: boolean;
  /** Script execution time in milliseconds. */
  durationMs?: number;
  /**
   * Optional: content-block label this witness was authored for
   * (e.g. ``"prop:foo"``).  Set by ``WitnessBuilder.set_content_block``.
   *
   * This is a **self-claim** by the script author; it does not, on its
   * own, constitute a wire — the named content block must reference the
   * witness back via ``computation.witness`` for the witness to count
   * as "wired".  See ``scripts/audit-wiring.ts``.
   */
  contentBlock?: string;
  /**
   * Optional: marks the witness as **audit-only** — produced by an
   * audit/probe whose report lives at ``docs/audits/<file>.md`` and
   * which is *not* expected to wire to a content block.
   *
   * Set by ``WitnessBuilder.set_audit_only``.  Recognised by
   * ``scripts/audit-wiring.ts``, which excludes audit-only witnesses
   * from the orphan tally.
   *
   * Value is the path to the audit report, relative to repo root
   * (e.g. ``"docs/audits/2026-05-06-path-b-evacuation.md"``).
   */
  auditOnly?: string;
  /**
   * The producer, its content hash, and the commit that last changed it —
   * written by ``WitnessBuilder`` on every witness and missing from this
   * interface until 2026-10-04 (`scripts/witness-audit.ts` recorded the
   * drift). ``scriptHash`` is what staleness keys on; ``scriptCommitSha`` is
   * provenance only, because a rebase-merge rewrites it. The runtime schema is
   * ``schemas/computation-witness.ts``.
   */
  scriptFile?: string;
  scriptHash?: string;
  scriptCommitSha?: string;
}

/**
 * Computational verification attached to a proof block.
 *
 * The proof's .md file contains the narrative proof.  The computation
 * field adds a reproducible script that independently verifies
 * numerical/algebraic claims made in the proof.
 *
 * Trust chain: Python script (reproducible) → JSON witness → Lean axiom.
 *
 * The Lean sibling uses:
 *   axiom vol_figure_eight : |Vol(4₁) - 2.02988321281931| < 1e-14
 *   -- Ref: [computation] computations/knot-volumes.py
 *   -- Witness: computations/knot-volumes.witness.json
 */
export interface Computation {
  /** Computation engine. */
  engine: ComputationEngine;
  /** Path to the Python (or other) script, relative to paper root. */
  script: string;
  /**
   * Path(s) to the witness JSON file(s) produced by the script,
   * relative to the repo root (e.g. `folio-assistant/computations/foo.witness.json`).
   *
   * A proof may legitimately depend on more than one witness (for
   * example, a derivation that combines a SnapPy volume computation
   * with a high-precision substrate-pinning registry); in that case
   * declare them as an array.  The auto-link advisory in
   * `validate-value.ts` checks `:val[…]` references against the
   * union of declared witnesses.
   */
  witness?: string | string[];
  /** Current verification status. */
  status: ComputationStatus;
  /** Python package dependencies (e.g. ["snappy>=3.3", "mpmath"]). */
  requires?: string[];
}

// ── Pre-rendered content ─────────────────────────────────────────

/**
 * Reference to a pre-rendered asset (e.g. tikzcd → SVG).
 *
 * When a .md file contains ```tex blocks that cannot be rendered
 * client-side (tikzcd, complex align environments), the build pipeline
 * renders them server-side and records the output here.
 *
 * The HTML viewer checks `rendered[]` and displays the pre-rendered
 * asset instead of attempting client-side rendering.
 */
export interface RenderedAsset {
  /** MIME type of the rendered output. */
  mime: "image/svg+xml" | "image/png" | "application/pdf" | (string & {});
  /** URL or relative path to the rendered file. */
  url: string;
  /** 0-based index of the ```tex block this replaces in the .md file. */
  blockIndex: number;
  /** Content hash for cache invalidation. */
  hash?: string;
}

// ── Companion file references ────────────────────────────────────

/**
 * References to companion files, resolved by pipeline from root name.
 *
 * For `content/objects/quantum-universe.ts`:
 *   md   → "quantum-universe.md"
 *   lean → "quantum-universe.lean"
 *   test → "quantum-universe.test.ts"
 *
 * Explicit paths override the convention.
 */
export interface Companions {
  /** Markdown content file. Resolved from sibling by default. */
  md?: string;
  /** Lean formalization file (relative to lean/ dir, or sibling). */
  lean?: string;
  /** Test report reference (e.g. test ID or file). */
  test?: string;
  /** Additional companion files by role. */
  [role: string]: string | undefined;
}

// ── Formalization constraints ────────────────────────────────────

/**
 * Formalization status — derived at build time from .lean file content.
 * NOT stored in content block .ts manifests.
 * Used only by CI scripts and proof-objects.json.
 */
export type FormalizationStatus =
  | "not_started"
  | "stated"
  | "has_sorry"
  | "proved"
  | "mathlib_ok";

export type ObjectKind =
  | "definition"
  | "theorem"
  | "lemma"
  | "proposition"
  | "corollary"
  | "conjecture"
  | "example"
  | "remark"
  | "proof"
  | "simulator";

/**
 * Author-tracking note attached to a content block. See the
 * `authorNotes?` field on `BlockBase` for the full rationale.
 *
 * Default render behavior: SKIP. Pipeline flag (`--with-author-notes`)
 * exposes these for working drafts.
 */
export interface AuthorNote {
  /** Note kind for filtering / styling. See BlockBase.authorNotes docs. */
  kind: "status" | "caveat" | "note" | "refined-framing" | "deprecated";
  /**
   * Human-readable date when the note was authored. Free-form string;
   * recommended ISO YYYY-MM-DD.
   */
  date?: string;
  /**
   * The note body, in markdown. Treat the same way as block prose
   * (math, links, lists supported). KEEP IT SHORT — author notes that
   * exceed ~5 lines should probably be a `remark` block instead.
   */
  body: string;
  /**
   * Optional cross-link to a follow-up: an audit doc, a successor
   * block, a PR, etc. Rendered as a clickable link when notes are
   * surfaced.
   */
  see?: string;
}

// ── Block types (discriminated union on `kind`) ──────────────────

/** Base fields shared by all environment blocks. */
/**
 * Shared block fields. Exported so the `dak` adapter's blocks in
 * the DAK layer's `schemas/dak-blocks.ts` extend the same base — one set of editorial fields across
 * both adapters is what lets one graph loader and one QA sweep serve both.
 */
export interface BlockBase {
  /** Label following project convention (e.g. "def:quantum-universe"). */
  label: string;
  /**
   * Labels this block was previously known by, oldest first.
   *
   * **A label is the block's identity** in the `folio/` graph: the content
   * graph, a block-level diff against `main`, a review comment and a heat
   * map all key on it. Changing a label without recording the old one reads
   * as a removal plus an addition, and orphans every comment on the old id.
   * Recording it here makes the rename a fact the pipeline can follow.
   *
   * Checked by two QA criteria (`qa-checkers-ids.ts`): `id-stable` fails a
   * label that changed since the base ref without its old value listed here,
   * and `id-unique` fails a block that takes a label another block lists
   * here, because reusing a retired id re-attaches the old block's review
   * history to an unrelated block.
   */
  renamedFrom?: string[];
  /** Optional display title. */
  title?: string;
  /**
   * Who this block is written FOR — Role ids from the layer's KG
   * (`scenarios/roles.json`, {@link RoleGraph}).
   *
   * Narrative content has an intended reader, and prose that does not know
   * who it is addressing drifts: it explains what that reader already knows
   * and assumes what they do not. Declaring the audience makes that
   * checkable instead of a matter of taste.
   *
   * **Role ids, not free text.** An open string cannot be scoped on — is
   * `implementers` the same audience as `implementer`? — so QA would degrade
   * to a grep and a typo would become an invisible new audience. The roles
   * already exist and already name the people in this system.
   *
   * Used twice: the AUTHOR writes to it, and QA reads it. A criterion whose
   * finding depends on the reader (jargon density, assumed background, how
   * much is explained) is a category error without it.
   *
   * Several are allowed — a block may genuinely address an author and an
   * editor at once. An unknown id is REFUSED by `content_validate`, not
   * accepted quietly: a mistyped audience silently scopes QA to nobody.
   */
  audience?: string[];
  /**
   * Labels of **immediate EDITORIAL dependencies** — the blocks a
   * reader must already have in hand to follow this one. Rendered as
   * `\uses{}` in the LaTeX blueprint.
   *
   * ## This is the editorial relation, not the formal one
   *
   * `uses[]` answers an **expository** question: "what does a reader
   * need to have read first?" It is **agent/human maintained** — a
   * deliberate editorial judgement about narrative order, and part of
   * the authored content.
   *
   * It is NOT the formal dependency graph. The formal relation — what
   * a proof actually depends on — is **machine-derived** from the
   * `lean.ref` sibling declaration and its Lean dependencies. It is
   * never hand-written and never stored here.
   *
   * The two relations genuinely differ, in both directions:
   *
   * - A proof may formally invoke a lemma that needs no exposition
   *   (a `simp` set, a Mathlib layer). Formal edge, no editorial
   *   edge. That is correct and must not be "fixed".
   * - A block may depend editorially on a definition it never formally
   *   cites — motivation, notation, a worked example the argument
   *   reads against. Editorial edge, no formal edge. Also correct.
   *
   * **Do not populate `uses[]` from Lean.** Copying formal dependencies
   * in here destroys the editorial signal and inflates every ordering
   * metric that reads it. Tooling that surfaces formal-vs-editorial
   * divergence (`uses-formal-coverage`) is advisory only: it flags a
   * possible *exposition gap* for a human to judge, and never edits
   * `uses[]` or fails a build.
   *
   * Consumers that want the whole picture (impact analysis, blast
   * radius, triage ordering) take the **union** of both edge sets via
   * `pipeline/content-graph.ts` — see `ContentGraph`, where
   * every edge carries an `EdgeKind` provenance tag. Read that graph
   * rather than this field directly whenever the question is "what
   * breaks if this changes?" rather than "what must a reader read
   * first?".
   *
   * ## Form
   *
   * List only direct neighbors — not the full transitive chain.
   * If A→B and B→C, then A lists only B; C is derived by walking
   * the graph. Run the tools layer's `pipeline/prune-transitive-deps.ts` to
   * enforce this. (Transitive pruning is sound on the editorial
   * relation, where reading-order is genuinely transitive; it is NOT
   * applied to formal edges.)
   *
   * Within the same paper: bare label (e.g. "def:quantum-universe").
   * Cross-paper (same folio): qualified "paper-dir:label"
   *   (e.g. "unital-groebner-bases:cor:pbw").
   * Cross-folio (external): full URL
   *   (e.g. "https://folio.example.org/papers/foo#def:bar").
   */
  uses?: string[];
  /**
   * Labels this block points DELIBERATELY forward to — a foreshadow, a
   * preview, or an explicitly deferred result the exposition promises to
   * return to (the surreal-number thread is the archetype).
   *
   * Where `uses[]` answers *"what must a reader have read first?"* and is
   * backward-looking by construction, this answers the complementary
   * question — *"what will the reader meet later, if they want more?"*
   *
   * ## Independent of `uses[]` (changed 2026-08-10)
   *
   * This field was originally a strict **subset** of `uses[]`: an annotation
   * marking one dependency edge as deliberately deferred. That could not
   * express the case it was most wanted for — a chapter overview (§0) naming
   * results it previews but does not depend on — because recording such a
   * pointer first required asserting a dependency that is not real.
   *
   * An entry may now be either:
   *
   * - **also in `uses[]`** — a genuine prerequisite the paper states later on
   *   purpose ("we will need X, proved in chapter 9"). The edge stays in the
   *   dependency graph; listing it here exempts it from the ordering-COST
   *   metrics only.
   * - **not in `uses[]`** — a pure forward pointer, asserting no dependency.
   *   It never enters the dependency graph at all.
   *
   * ## Zero cost, in both cases
   *
   * A foreshadow carries no ordering cost: it is skipped by
   * `detangler-no-forward-ref`, `detangler-graph-energy`, and both sides of
   * `detangler-block-tanglement`. Pointing a reader forward is a service, not
   * a tangle — the prose has told them the material is coming and does not ask
   * them to go now.
   *
   * ## Choosing between the two fields
   *
   * The exemption is from the ordering **cost**, not from the **edge**. A
   * foreshadow that is also in `uses[]` still counts for cycle detection,
   * dependency cones, chain depth, and PageRank — a cycle is a logical
   * impossibility rather than reader burden, so no declaration hides one.
   *
   * The authoring question is *"must the reader have this in hand to follow
   * the block?"* If yes it belongs in `uses[]`, and a forward-pointing
   * `uses[]` edge means the **block order is wrong** — the fix is the order,
   * not the field. If no, it belongs here.
   *
   * Getting that choice wrong costs reading-order accuracy, which is what
   * these fields are for; it does not affect whether anything is *true*. The
   * formal content of a block is carried by its `lean.ref` sibling and gated
   * by the Lean build, entirely independently of this graph.
   *
   * Each entry remains a claim that the prose actually frames the reference as
   * deferred. Everything not listed stays a finding.
   *
   * ## Form
   *
   * Same reference forms as `uses[]` — bare label within a paper,
   * `paper-dir:label` cross-paper, full URL cross-folio. Targets must resolve
   * (`foreshadows-resolve`), and a block may not foreshadow itself
   * (`foreshadows-not-self`). Unlike `uses[]`, this list is **not**
   * transitively pruned: pointers are individually chosen editorial gestures,
   * not a reachability relation.
   */
  foreshadows?: string[];
  /**
   * Bibliography keys cited by this block (e.g. ["kock2004", "atiyah1988"]).
   *
   * These are reference ids from content/schema/references.ts.
   * The build pipeline auto-extracts from \cite{} in .md files,
   * but explicit values here take precedence.
   */
  cites?: string[];
  /**
   * Thematic tags for filtering and grouping.
   * Examples: "archimedean", "complex", "p-adic", "su2", "representation-theory"
   */
  tags?: string[];
  /** Override companion file resolution (normally by root-name convention). */
  companions?: Companions;
  /** Pre-rendered assets for ```tex blocks that can't be rendered client-side. */
  rendered?: RenderedAsset[];
  /** Freeform metadata (chapter assignment, tags, etc.). */
  meta?: Record<string, unknown>;
  /**
   * Author-tracking notes attached to this block — status snapshots,
   * caveats, refinement-framing comments, and other meta-commentary
   * that should NOT appear in the scholarly prose body of the block.
   *
   * Per CLAUDE.md §"User accessibility" + `local/one-voice-audit`
   * conventions: status leaks (TODO, WIP, "added 2026-05-09",
   * "refined-framing", "status: open / closed / theorem", etc.) in
   * prose are a one-voice violation. Migrate them to this field
   * instead.
   *
   * Default render behavior: SKIP author notes from the final paper
   * (clean publication voice). The render pipeline (`render-latex.ts`)
   * accepts a `--with-author-notes` flag for working drafts that
   * exposes them as marginal notes or appendix sections.
   *
   * `kind` taxonomy (extend as needed):
   *   - "status"           — current state of work on this block
   *   - "caveat"           — author's caveat about scope / overshoot
   *   - "note"             — generic author note
   *   - "refined-framing"  — note added when the block was promoted
   *                          from one kind to another (remark → prop,
   *                          falsified → reduced, etc.)
   *   - "deprecated"       — block superseded by another (with link)
   *
   * EXCEPTION: `**Theorem (conditional on conj:X)**` banners required
   * by CLAUDE.md §3b-cond are STRUCTURAL parts of the theorem
   * statement, NOT author notes. They stay in the `.md` prose.
   */
  authorNotes?: AuthorNote[];
  /** Reference to an interactive simulator (opens overlay with [simulate] button). */
  simulator?: SimulatorRef;
  /**
   * Glossary terms *defined* by this block. Each entry is a slug used to
   * mint the LaTeX label `\label{term:<slug>}` and the HTML id `term-<slug>`.
   *
   * Authors mark the defining occurrence in the `.md` body with the remark
   * directive `:defterm[<slug>]`, and every subsequent reference (in any
   * block) with `:refterm[<slug>]`. Phase B validation will check that every
   * `defines[]` entry has at least one `:defterm[<slug>]` in this block's
   * markdown, and that every `:refterm[X]` resolves to some block's
   * `defines[]`.
   *
   * Slugs should be lowercase, hyphen-separated; the visible label is the
   * directive's bracket text and may differ from the slug only via the
   * long-form `:refterm[Visible]{#slug}`.
   */
  defines?: string[];
  /**
   * Optional computational verification (Python/SnapPea/sympy/etc.).
   *
   * Available on every block kind: definitions / propositions /
   * conjectures may attach a witness script that exercises the
   * construction or empirically supports the claim.  See the
   * `Computation` interface for the field shape and
   * `folio-assistant/computations/witness_base.py` for the Python
   * helper that emits matching `*.witness.json` files.
   */
  computation?: Computation;
  /**
   * BCP 47 language tag of this block's **source** content.
   *
   * Defaults to the folio's `translation.defaultLocale` (itself defaulting
   * to `"en"`) when absent. Explicitly set only when a block is authored in
   * a language other than the folio default — the common case is omission.
   *
   * This is the *source* language, not a translation. Translations of this
   * block live in `translations/<locale>/` as `.po` files alongside their
   * `.ts` manifests (TranslationNode). See `schemas/content/translation.ts` for
   * the schema and `docs/guides/translation-support.md` for the architecture.
   */
  lang?: string;
  /**
   * One or more PO file sources that carry translations for this block.
   *
   * Each entry is a path relative to the folio root, pointing to a `.po`
   * file or to a `TranslationNode` `.ts` manifest (which itself references
   * the `.po`). Multiple entries enable compositional translation — e.g. a
   * block that draws terminology from a shared glossary PO and has its own
   * block-level PO on top.
   *
   * ## Resolution order (fallback behavior)
   *
   * When `poSources` is **not declared** (the common case), the pipeline
   * resolves PO files by convention:
   *
   * 1. **Block-level:** `translations/<locale>/<block-stem>.po`
   * 2. **Chapter-level:** `translations/<locale>/<chapter-slug>.po`
   * 3. **Folio-level:** `translations/<locale>/global.po`
   * 4. **Dependency walk:** walk `harness.config.json` dependencies
   *    depth-first, looking for matching PO files in each dependency's
   *    `translations/<locale>/` directory
   *
   * When `poSources` **is declared**, only the listed files are consulted
   * (no fallback). This is useful when a block needs translations from a
   * specific non-standard location, or when the automatic resolution
   * would pick the wrong file.
   *
   * Each PO source is loaded in array order; later entries override earlier
   * ones for the same msgid, so the most specific source should be last.
   */
  poSources?: string[];
}

// ── Blocks that REQUIRE Lean ─────────────────────────────────────

// ── Blocks where Lean is expected but may be WIP ─────────────────

/**
 * Base interface for provable blocks (theorems, lemmas, propositions, corollaries).
 * Lean is expected but may be WIP — missing lean triggers a warning, not an error.
 */
export interface ProvableBase extends BlockBase {
  /** Optional Lean formalization of the result. */
  lean?: LeanRef;
  /** Labels of proof blocks for this result (like examples[]). */
  proofs?: string[];
  /** Labels of example blocks illustrating this result. */
  examples?: string[];
}

/**
 * Algorithm — a specialised proposition that realises a chain of
 * propositions in executable compute.
 *
 * Algorithms are downstream of mathematics: every algorithm block
 * MUST cite at least one provable block (definition, proposition,
 * theorem, lemma, corollary, or conjecture) in its `uses[]` field.
 * The validator enforces this invariant via `AlgorithmSchema`.
 *
 * An algorithm block typically names:
 *  - the input / output contract,
 *  - the propositions whose correctness it depends on (`uses[]`),
 *  - the canonical compute entry point (`computation`),
 *  - optionally, a Lean formalisation of the correctness statement.
 *
 * Renders as a numbered theorem-like environment (`algorithmblock`)
 * to avoid colliding with the LaTeX `algorithm` float package.
 */
export interface AlgorithmBlock extends ProvableBase {
  kind: "algorithm";
  /** Optional computational realisation (Python / Rust / ...). */
  computation?: Computation;
  /**
   * Optional label of an upstream definition this algorithm
   * realises (parallel to `RemarkBlock.interprets`).
   *
   * Use when the algorithm is the canonical compute for a single
   * named construction (e.g. `interprets: "def:markov-trace"`).
   * For multi-proposition algorithms, leave unset and cite all
   * propositions in `uses[]`.
   */
  interprets?: string;
}

// ── Blocks where Lean is optional ────────────────────────────────

/** Example — a concrete instance illustrating a definition or theorem. */
export interface ExampleBlock extends BlockBase {
  kind: "example";
  /** Optional Lean formalization of the example. */
  lean?: LeanRef;
  /**
   * Label of the provable block this example illustrates.
   *
   * Parallel to `RemarkBlock.interprets` — when an example concretely
   * instantiates a definition/proposition/theorem, link it here so
   * the viewer can cross-reference bidirectionally.
   */
  interprets?: string;
}

/**
 * Remark — interprets a provable block (definition, proposition, theorem, etc.).
 *
 * Every remark should either:
 * 1. Set `interprets` to the label of the block it interprets, or
 * 2. Be a glossary remark (tagged "glossary", Ch 8 only), or
 * 3. Be flagged as "dangling" by the remark-audit constraint.
 *
 * Remarks without `interprets` that make mathematical claims should be
 * promoted to propositions/lemmas with their own Lean formalization.
 */
export interface RemarkBlock extends BlockBase {
  kind: "remark";
  /** Optional Lean reference (unusual but allowed). */
  lean?: LeanRef;
  /**
   * Label of the provable block this remark interprets.
   *
   * Links the remark to its formal backing: the definition, proposition,
   * theorem, or lemma whose physical/mathematical meaning this remark
   * explains. The referenced block should have Lean formalization.
   */
  interprets?: string;
  /** Optional computational verification (Python/SnapPea/sympy/etc.). */
  computation?: Computation;
}


// ── Simulators ───────────────────────────────────────────────────

/**
 * A named parameter set for a simulator.
 *
 * Each view defines a specific configuration — e.g. "default" snapshot
 * for paper figures, or "bach-2013" matching experimental data.
 * Parameters are passed to the simulator HTML via URL query params
 * or postMessage.
 */
export interface SimulatorView {
  /** View name (e.g. "default", "bach-2013", "fullerene"). */
  name: string;
  /** Display title for this view. */
  title?: string;
  /** Parameter values for this view. */
  params: Record<string, number | string | boolean>;
}

/**
 * Reference from a block to a simulator with an optional named view.
 *
 * Multiple blocks (remarks, examples, etc.) can reference the same
 * simulator with different views. The viewer renders a [simulate]
 * button that opens the simulator overlay with the specified params.
 */
export interface SimulatorRef {
  /** Label of the simulator block (e.g. "sim:q-double-slit"). */
  ref: string;
  /** Named view to use (defaults to "default"). */
  view?: string;
}

/**
 * Simulator — an interactive HTML visualization.
 *
 * Content triple: `.ts` (manifest + params) + `.md` (documentation) + `.html` (app).
 * The `.md` explains the simulator and its default view; it is distinct from
 * the `.md` of any remark that references this simulator.
 *
 * Pipeline validates:
 *   - `html:` resolves to a file on disk — `pipeline/validate-simulator.ts`,
 *     phase 6 of `validate.ts`. Three states: present, absent (a finding), and
 *     undetermined (a remote target, or a path escaping the repository), which
 *     is reported rather than passed.
 *   - defaultView is present with at least one param
 *
 * This block said the first of those for months while it was FALSE: `validate.ts`
 * contained no reference to `simulator` or `.html`, and two of qou's eleven
 * targets were dangling through a clean `✓ Valid`. Bean `023p`. A documented
 * check that does not run is worse than an absent one, because a reader stops
 * looking — so if one of these lines stops being true, delete the line.
 */
export interface SimulatorBlock extends BlockBase {
  kind: "simulator";
  /** Path to the standalone HTML simulator file (relative to repo root). */
  html: string;
  /** Default parameter values — used for snapshot generation. */
  defaultView: SimulatorView;
  /** Additional named views with different parameter sets. */
  views?: SimulatorView[];
}

// ── Prose (non-environment content) ──────────────────────────────

/**
 * The four kinds below — `prose`, `equation`, `diagram`, `table` — differ
 * from the other eleven only in that their `label` is OPTIONAL. Everything
 * else they carry is `BlockBase`, so they extend it (minus `label`) rather
 * than restating it.
 *
 * ## They used to restate it, and restating is how they kept losing fields
 *
 * Each was a standalone interface listing its own field set, and the set was
 * always a little behind. The record is in the field comments this change
 * replaces: `EquationBlock` was the only member of the `Block` union with
 * neither `uses` nor a base supplying it; `tags` was in the Zod schema and
 * not the type; then on 2026-08-24 `authorNotes` had to be granted to all
 * four by hand (bean `folio-assistant-5nle`), after qou #5115 found five
 * real author notes being discarded.
 *
 * That grant fixed the field it was about and left the mechanism in place.
 * Measured after it, `defines` was still absent from all four, and `cites`,
 * `simulator` and `computation` from three. A Zod object is non-strict, so
 * each of those was accepted at authoring time and silently stripped.
 *
 * `defines` is the one that bites: AGENTS.md §4c requires every glossary
 * term to be declared in `defines[]`, and the `defterm-declared` rule reads
 * that array — so a `table` or `prose` block introducing a term could not
 * declare it at all, and the omission looked like an authoring choice.
 *
 * The identical defect has a scar two hundred lines down: see `BLOCK_KINDS`,
 * where `algorithm` and `table` reached the union and never reached five
 * hand-maintained copies of it, excluding 461 qou blocks — 13% of the corpus
 * — from every sweep. Restating a set that already exists is the shared
 * cause, and `_blockKindsAreExhaustive` is the fix that was applied there.
 *
 * Extending is the same fix here: a field added to `BlockBase` now reaches
 * these four, and cannot be forgotten one at a time.
 */
type OptionalLabelBlockBase = Omit<BlockBase, "label">;

/**
 * Freeform narrative text between environments.
 * Content lives entirely in the sibling .md file.
 */
export interface ProseBlock extends OptionalLabelBlockBase {
  kind: "prose";
  /**
   * Optional, and free-form: prose labels are not required to carry a
   * `kind:` prefix, unlike every other labelled block.
   */
  label?: string;
}

// ── Display math / equations ─────────────────────────────────────

/** Standalone display equation. Short TeX can live inline; complex in .md. */
export interface EquationBlock extends OptionalLabelBlockBase {
  kind: "equation";
  /** Equation label (e.g. "eq:snake-identities"). */
  label?: string;
  /** Inline TeX for the equation (short enough to live in .ts). */
  tex?: string;
}

// ── Diagrams ─────────────────────────────────────────────────────

/** Commutative diagram or figure. Source is tikzcd or other diagram TeX. */
export interface DiagramBlock extends OptionalLabelBlockBase {
  kind: "diagram";
  /** Diagram label (e.g. "fig:monoidal-structure"). */
  label?: string;
  /** tikzcd or diagram TeX source (can live inline for short diagrams). */
  tex?: string;
  /** Caption text (rendered below diagram in LaTeX). */
  caption?: string;
}

/**
 * Table block — standalone data table extracted from a remark or
 * proposition.  Tables with more than 5–6 rows MUST be their own block
 * rather than inlined in a remark or proposition, so they can be
 * labelled and cross-referenced independently.
 */
export interface TableBlock extends OptionalLabelBlockBase {
  kind: "table";
  /** Table label (e.g. "tbl:mass-predictions"). */
  label?: string;
  /** LaTeX tabular/longtable source (optional; can also live in .md). */
  tex?: string;
  /** Caption text (rendered above table in LaTeX). */
  caption?: string;
}

/**
 * Figure block — a raster image PLACED on a page of a source document, as
 * distinct from a `diagram`, which is authored.
 *
 * Bean `d5f1`. The two are genuinely different things and conflating them
 * would put a lie in the data model: `DiagramBlock` carries `tex`, meaning
 * tikzcd source somebody wrote, and a consumer reading `diagram.tex` on an
 * extracted bitmap finds nothing. A figure has a FILE and no source.
 *
 * Only images the extractor judged to be figures reach this block kind. Of
 * 164 placed images measured across this corpus on 2026-09-20, **140 are page
 * scans** — one near-full-bleed image per page, which is the page itself —
 * against 24 figures. `scripts/pdf-images.py` makes that call and records the
 * numbers it made it from; see `schemas/content/document-image.ts`.
 *
 * `narrative` is deliberately NOT a string. A description has a state and an
 * author, and only a human may confirm one — `schemas/content/narrative.ts` enforces
 * that an agent cannot accept its own draft.
 */
export interface FigureBlock extends OptionalLabelBlockBase {
  kind: "figure";
  /** Figure label (e.g. "fig:incidence-by-region"). */
  label?: string;
  /** The extracted image, relative to the library entry. NOT optional: a
   *  figure block with no file is a claim about an image nobody can see. */
  file: string;
  /** Caption text as printed in the source, where one was found. */
  caption?: string;
  /** Which page of the source document it sits on, 1-based as a reader counts. */
  page?: number;
  /** The authored description per language, or the empty slot. See `schemas/content/narrative.ts`. */
  narrative?: NarrativeSlot;
}

// ── Recommendations (document folios) ───────────────────────────

/**
 * A reference to one code in a declared code list (`folio-code-list/v1`,
 * exported as a SKOS concept scheme). The check is "resolves in the scheme":
 * the list is one the folio's dependency tree declares, and the code is an
 * active code in it.
 */
export interface CodeRef {
  /** The code list's `id`, e.g. `grade-recommendation-strength`. */
  list: string;
  /** One of that list's `codes[].code`. */
  code: string;
}

/**
 * A recommendation: the statement an L1 guidance document exists to make.
 * Bean `55ao`.
 *
 * It is the block readers cite, implementers trace to, and reviewers sign off
 * one at a time. So it has a label and a place in the `uses[]` graph, like a
 * theorem. It is NOT a theorem: nothing proves it, and its authority is the
 * issuing body's.
 *
 * The owner's rulings of 2026-09-23 and 2026-10-06:
 * - **The label prefix is the folio's to choose.** The platform reserves none
 *   (Q1), because a standards body's grammar is its own. Its node declares
 *   `prefixEnforced: false`.
 * - **`strength` names a concept in a declared scheme** (Q2). It is not a
 *   closed enum and not free text. WHO's GRADE is not IETF's RFC 2119, so each
 *   domain brings its own code list.
 * - **It links to a DAK `health-intervention`, never merges with one** (Q3).
 *   `about` carries the labels of the interventions it is about. They are
 *   cross-adapter references, so nothing in the document vocabulary depends on
 *   the DAK adapter.
 *
 * The statement itself lives in the sibling `.md`, one per block. The
 * published number is kept out of the label, because editions renumber.
 */
export interface RecommendationBlock extends BlockBase {
  kind: "recommendation";
  /** Its strength or requirement level, as a code in a declared list. */
  strength?: CodeRef;
  /** Labels of the health interventions (DAK adapter) this recommendation is about. */
  about?: string[];
}

// ── The discriminated union ──────────────────────────────────────

/**
 * The kinds cat-harness's own code types. A layer above types its own kinds in
 * its vocabulary module (`vocabulary-modules.ts`): the science layer's
 * `definition`, `theorem`, `lemma`, `proposition`, `corollary`, `conjecture`
 * and `proof` moved there on the owner's ruling of 2026-10-22.
 */
export type Block =
  | AlgorithmBlock
  | ExampleBlock
  | RemarkBlock
  | SimulatorBlock
  | ProseBlock
  | EquationBlock
  | DiagramBlock
  | TableBlock
  | FigureBlock
  | RecommendationBlock;

/**
 * `BLOCK_KINDS`, `BlockKind` and `BLOCK_KIND_ALT` now live in the leaf
 * module `./block-kinds`, so `constraints.ts` can import them without a
 * runtime cycle through this file. Re-exported here because that is
 * where every existing consumer looks for them.
 */
export { BLOCK_KINDS, BLOCK_KIND_ALT } from "./content/block-kinds.js";
export type { BlockKind } from "./content/block-kinds.js";



/** Blocks that represent theorem-like environments (the science layer's add its own). */
export type EnvironmentBlock =
  | AlgorithmBlock
  | ExampleBlock
  | RemarkBlock
  | SimulatorBlock;

// ── Cross-reference helpers ─────────────────────────────────────

/**
 * All known label prefixes used in content objects.
 *
 * Used to distinguish same-paper references (e.g. "def:foo") from
 * cross-paper qualified references (e.g. "unital-groebner-bases:def:foo").
 * A label that contains ":" but doesn't start with one of these prefixes
 * is treated as a cross-paper reference.
 */

/**
 * Test whether a label is a cross-paper qualified reference.
 *
 * Cross-paper refs use "paper-dir:label" syntax (e.g.
 * "unital-groebner-bases:def:foo"). They contain a colon but don't
 * start with a known label prefix.
 */

/**
 * Extract the label from a Block, regardless of block kind.
 *
 * Environment blocks (definition, theorem, etc.) always have `label`.
 * Non-environment blocks (prose, equation, diagram, table) may have
 * an optional `label`. Returns `undefined` if no label is set.
 */
export function extractBlockLabel(block: Block): string | undefined {
  return "label" in block ? block.label : undefined;
}

// ── Document structure ───────────────────────────────────────────

export interface Section {
  title: string;
  label?: string;
  /**
   * A chapter's LEAD: the text between the chapter heading and its first
   * section (an executive summary has nothing else). It keeps a title, for
   * outlines and the review page, but renders without a heading of its own,
   * because the chapter heading directly above already says it.
   */
  lead?: boolean;
  /** Ordered list of block root names (resolved to .ts files in section/chapter dir). */
  blocks: string[];
  /** Subsections (inline or referenced). */
  subsections?: (Section | SectionRef)[];
}

/**
 * Section reference — used by chapter .ts to locate section .ts files.
 *
 * Sections can be:
 *   - Inline (Section object directly in the chapter)
 *   - Referenced by name (resolved to `<name>/<name>.ts` in chapter dir)
 *   - Referenced by explicit URI
 */
export interface SectionRef {
  /** Root name of the section dir/file. */
  name: string;
  /** URI override (defaults to `./<name>/<name>.ts`). */
  uri?: string;
}

/**
 * Chapter reference — used by the paper manifest to locate chapter .ts files.
 *
 * The `uri` defaults to a relative local path based on directory convention:
 *   `./<chapter-dir>/<chapter-dir>.ts`
 *
 * Can be overridden to point to a remote URI for multi-repo setups.
 */
export interface ChapterRef {
  /** URI to the chapter .ts manifest (default: relative local). */
  uri?: string;
  /** Directory name under the paper root (e.g. "quantum-universes"). */
  dir: string;
  /**
   * Optional Part banner emitted before this chapter in the rendered
   * paper.  When set, the LaTeX renderer emits `\part{<partTitle>}`
   * immediately before this chapter's `\input{}` line, grouping it
   * with subsequent chapters until the next chapterRef with its own
   * `partTitle` (or end of paper).
   *
   * LaTeX supplies the "Part N" prefix automatically — `partTitle`
   * should contain only the title text (e.g. "Knots, Braids, and
   * Particles"), not "Part II: ...". The renderer escapes the value
   * via `escapeLatex()`, so inline `$...$` math is preserved but
   * raw control characters (`\`, `{`, `}`, `^`, `~`) are escaped.
   */
  partTitle?: string;
}

export interface Chapter {
  /** Chapter number. Omit for unnumbered chapters (e.g. Introduction). */
  number?: number;
  /**
   * Short label shown in collapsed sidebar tab (e.g. "I" for Introduction,
   * "G" for Glossary). Defaults to `String(number)` when omitted.
   */
  tabLabel?: string;
  title: string;
  label?: string;
  /** Sections can be inline Section objects or SectionRef references. */
  sections: (Section | SectionRef)[];
  meta?: Record<string, unknown>;
}

/**
 * Paper manifest — top-level document.
 *
 * The paper .ts is authoritative for where chapter .ts files live.
 * Each entry in `chapters` is either:
 *   - A ChapterRef (with optional URI override)
 *   - An inline Chapter (for simple cases)
 */
/**
 * A custom macro defined at the paper level.
 *
 * Used by all renderers: KaTeX (viewer), LaTeX (PDF), and plain-text (search).
 */
export interface PaperMacro {
  /** LaTeX expansion (e.g. "\\mathfrak{p}"). Used by KaTeX and LaTeX. */
  tex: string;
  /** UTF-8 display string for plain-text contexts (e.g. "𝔭"). */
  unicode?: string;
}

export interface Paper {
  title: string;
  authors: string[];
  affiliations?: string[];
  /** Author email addresses (parallel to authors array). */
  emails?: string[];
  /** Author URLs / homepages (parallel to authors array). */
  urls?: string[];
  date?: string;
  /** Paper abstract (plain text or markdown). */
  abstract?: string;
  /** Chapter references — URIs to chapter .ts manifests. */
  chapters: ChapterRef[];
  /**
   * Custom LaTeX macros for this paper.
   *
   * Keys are macro names WITHOUT backslash (e.g. "pp" for \pp).
   * Values define the TeX expansion and optional Unicode fallback.
   *
   * All renderers consume these:
   * - KaTeX: passed as `macros` option
   * - LaTeX pipeline: emitted as \newcommand in preamble
   * - Plain-text/search: uses `unicode` field
   */
  macros?: Record<string, PaperMacro>;
  meta?: Record<string, unknown>;
}

/**
 * @deprecated Use Paper instead. Kept for backward compatibility.
 */
export interface Document {
  title: string;
  authors: string[];
  date?: string;
  chapters: Chapter[];
  meta?: Record<string, unknown>;
}

// ── Todo items ───────────────────────────────────────────────

/**
 * Priority level for a todo item.
 * Agents and humans use these to triage work.
 */
export type TodoPriority = "critical" | "high" | "medium" | "low";

/**
 * Status of a todo item through its lifecycle.
 */
export type TodoStatus =
  | "open"          // newly created, awaiting triage
  | "in_progress"   // actively being worked on
  | "blocked"       // waiting on external input (author, upstream change)
  | "resolved"      // completed successfully
  | "wontfix";      // closed without resolution

/**
 * Origin of a todo — who/what created it.
 */
export type TodoOrigin =
  | "agent"         // created by an editor/proof agent
  | "human"         // created by author via feedback UI
  | "qc"            // created by QC/validation pipeline
  | "extracted";    // extracted from existing proof-objects/comments

/**
 * A todo item — one person's outstanding work, attached to a block or section.
 *
 * The `comment` field is a quick markdown narrative. The optional `data` field
 * carries structured context at the discretion of the creating agent or user.
 *
 * **Corrected 2026-09-18.** This comment previously read "Each todo lives in
 * the `todos` field of a block manifest (.ts) or in a standalone todos
 * manifest". **No block manifest has ever carried a `todos` field** —
 * `BlockBase` does not declare one and nothing reads one. The claim was
 * load-bearing in the wrong direction: it was cited, in this session, as
 * evidence that the todo vocabulary is part of the block content model, and
 * the conclusion happened to be right for an entirely different reason (a todo
 * is a human actor's state, which is content) while the stated premise was
 * false. A doc comment describing a field that does not exist is worse than no
 * comment, because it is quoted.
 *
 * Where todos actually live: the `todos` graph
 * (`schemas/sdlc/todo-graph.ts`), declared by a folio's `todos/todos.json`. The
 * feedback store is one of its nodes; see `FeedbackItem` below.
 *
 * **This is not the agent work plan.** That is `beans/`, and `AGENTS.md`
 * forbids standing up a second one. A todo records what a PERSON has
 * outstanding — the content-review feedback workflow that document already
 * carves out beside beans.
 *
 * Knowledge-graph tagging — by role, process, task and identity — is
 * `TodoTags` in `schemas/sdlc/todo.ts`, kept there rather than added here so this
 * shape stays what the existing store and the `todo-review` skill already read.
 */
export interface TodoItem {
  /** Unique ID (e.g. "todo-001" or a nanoid). */
  id: string;
  /** Short summary (one line). */
  summary: string;
  /** Markdown narrative with context, rationale, questions. */
  comment: string;
  /** Current lifecycle status. */
  status: TodoStatus;
  /** Triage priority. */
  priority: TodoPriority;
  /** Who/what created this todo. */
  origin: TodoOrigin;
  /** Label of the block this todo is attached to (e.g. "def:rigid-monoidal-category"). */
  targetLabel?: string;
  /** Who this is assigned to (agent name or "author"). */
  assignee?: string;
  /** ISO 8601 timestamp of creation. */
  createdAt: string;
  /** ISO 8601 timestamp of last update. */
  updatedAt?: string;
  /** Agent/user who last updated. */
  updatedBy?: string;
  /** Structured data — schema is at agent/user discretion. */
  data?: Record<string, unknown>;
  /** Labels of related todos (for threading). */
  related?: string[];
  /**
   * Which theme's art backs this todo's sticky — declared, never inferred.
   *
   * Absent means the layer's own theme. See {@link TodoItemSchema} in
   * `constraints.ts` for why this is a bare string rather than an enum, and
   * why the default is inherited rather than guessed (bean `5y4b`).
   */
  theme?: string;
}

// ── Feedback (committed to main via worktree) ────────────────

/**
 * A feedback item submitted by a user or agent against a content block.
 *
 * Feedback lives in `feedback/<paper-dir>/<rootName>.ts` and is committed
 * to main immediately via a git worktree, so it persists across branches.
 *
 * Extends TodoItem with authorship fields from the feedback UI.
 */
export interface FeedbackItem extends TodoItem {
  /** Display name of the submitter (from OAuth or local config). */
  author?: string;
  /** Email of the submitter (from OAuth or local config). */
  authorEmail?: string;
}

// ── Folio (collection of papers) ─────────────────────────────

/**
 * Reference to a paper within the folio.
 *
 * The `dir` is the paper's directory name under content/.
 * The pipeline resolves `<dir>/<dir>.ts` by convention.
 */
export interface PaperRef {
  /** Directory name under folio/ (e.g. "quantum-observable-universe"). */
  dir: string;
  /** Optional display title override (otherwise read from paper manifest). */
  title?: string;
  /** Optional description shown on the landing page. */
  description?: string;
  /** Tags for filtering on the landing page. */
  tags?: string[];
  /**
   * Folio viewer URL for this paper.  Used for:
   * - Cross-paper dependency resolution (qualified `uses` refs)
   * - BibTeX `folio-url` field for folio-hosted citations
   * - Read-only import of external papers for commenting/referencing
   *
   * Local papers use the viewer hash route: "/viewer/#/view/{paper-id}".
   * To link to a specific block: append the label fragment
   *   (e.g. "/viewer/#/view/unital-groebner-bases" then "#cor:pbw").
   * External folios use full URLs:
   *   "https://folio.example.org/viewer/#/view/paper-id".
   */
  url?: string;
}

/**
 * Folio — a collection of papers in this repository.
 *
 * Lives at `content/folio.ts` by convention.  The assistant landing
 * page reads this to discover all papers and render the folio view.
 */
export interface Folio {
  /** Display name for the folio (e.g. "litlfred's Papers"). */
  title: string;
  /** Papers in the folio, ordered by display preference. */
  papers: PaperRef[];
  meta?: Record<string, unknown>;
}

// ── Print modes ──────────────────────────────────────────────────

/**
 * Print mode controls document rendering density.
 *
 * - `"formal"` — Full academic layout with author affiliations,
 *   page breaks between chapters, and expanded headings.
 * - `"compact"` — Dense layout (current default): no page breaks,
 *   normal-size headings, affiliations omitted. Referenced examples
 *   and remarks are included unless `compactInlineRefs` is false.
 */
export type PrintMode = "formal" | "compact";

/**
 * Options that control what the rendering pipeline includes.
 *
 * Passed through build → renderChapter → renderSection.
 */
export interface RenderOptions {
  /** Print mode (default: "compact"). */
  printMode?: PrintMode;
  /**
   * In compact mode, include example/remark blocks that are directly
   * referenced via `examples[]` on definitions/theorems in the same view.
   * Default: true.  Set to false for a minimal compact output.
   */
  compactInlineRefs?: boolean;
  /**
   * Document-wide set of `term:<slug>` labels that some block refers to
   * via `:refterm[…]{#slug}` / `\refterm{slug}`.
   *
   * Chapters render independently, so a chapter-local scan cannot see
   * that (say) `appendix-surreals` refterms a term defined in the
   * glossary chapter. Without this, compact mode drops the glossary
   * entry, its `term:` anchor — which lives in the block BODY, not in
   * its label — is never emitted, and the link dangles in the built PDF.
   *
   * The builder computes this once over every loaded block and passes it
   * down. Only terms actually referred to are pulled in, so compact mode
   * stays compact.
   */
  referencedTerms?: Set<string>;
}

// ── Validation result ────────────────────────────────────────────

export interface ValidationIssue {
  level: "error" | "warning" | "info";
  block: string;
  message: string;
  file?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Collapse a block's Lean status into the three buckets the PDF ∀ mark
 * colour-codes (see `\leanstatusmark` / `\proofstatuslegend` in
 * latex/preamble.tex):
 *
 *   - "compiled"  green  — built sorry-free.
 *   - "stubbed"   red    — a `: True`/placeholder or vacuous/trivial goal
 *                          flagged by machine QA (`validation: stub/trivial/
 *                          error`): NOT a genuine formalisation.
 *   - "drafted"   purple — a genuine statement stated in Lean that is neither
 *                          a stub nor yet sorry-free-compiled — including a
 *                          block whose `.lean` carries a (cited) `sorry`
 *                          (`validation: not_checked`). A referenced `sorry`
 *                          is a deliberate deferral, not a vacuous stub.
 *
 * `sorryFree` wins outright; otherwise we map the `validation` enum. An
 * unknown/absent validation on a block that *does* carry a Lean ref defaults
 * to "drafted" (it is stated, just not yet checked).
 */
export function leanStatusBucket(
  lean: { sorryFree?: boolean; validation?: string } | undefined,
): "stubbed" | "drafted" | "compiled" {
  if (!lean) return "stubbed";
  if (lean.sorryFree === true) return "compiled";
  switch (lean.validation) {
    case "leanok":
    case "validated":
      return "compiled";
    case "stub":
    case "trivial":
    case "error":
      return "stubbed";
    default:
      // not_checked / external / axioms_only / undefined
      return "drafted";
  }
}
