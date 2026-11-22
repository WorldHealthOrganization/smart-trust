/**
 * Formalization Pipeline Types — Proof Objects, Glossary, and Test Reports.
 *
 * TypeScript type definitions for the paper content type's formalization
 * pipeline.  These types define the data structures for proof tracking,
 * semantic glossary, narrative-to-Lean mapping, test reporting, and proof
 * state export — consumed by CI pipelines and the published blueprint.
 *
 * Content-agnostic: nothing here is specific to a particular paper.
 *
 * @module schemas/formalization-types
 * @graphNode schema
 */

// =============================================================================
// §1  Proof Objects Manifest (replaces proof-objects.schema.json)
// =============================================================================

export type FormalizationStatus =
  | "not_started"
  | "stated"
  | "has_sorry"
  | "proved"
  | "mathlib_ok";

export type ObjectType =
  | "definition"
  | "theorem"
  | "lemma"
  | "proposition"
  | "corollary"
  | "conjecture"
  | "example"
  | "remark";

export type ReviewType =
  | "scientific-accuracy"
  | "latex-validation"
  | "readability"
  | "lean-proof-check"
  | "mathematical-rigor"
  | "general";

export type Verdict = "APPROVE" | "REQUEST_CHANGES" | "NEEDS_DISCUSSION";
export type Severity = "critical" | "major" | "minor";
export type ReviewerType = "human" | "agentic";
export type DependencyRelation = "uses" | "proves";

export interface LaTeXLocation {
  /** Path to the LaTeX source file relative to repo root. */
  file: string;
  /** Line number of the \begin{environment}. */
  line: number;
  /** Chapter number. */
  chapter?: number;
  /** Rendered theorem number (e.g., "4.12"). */
  number?: string;
}

export interface LeanReference {
  /** Fully qualified Lean declaration name. */
  decl?: string;
  /** URL to the Lean declaration on doc-gen4 or GitHub Pages. */
  url?: string;
  /** Path to .lean file relative to lean/ directory. */
  file?: string;
  /** Whether the declaration is free of sorry. */
  sorry_free?: boolean;
  /** URL to the Lean source file on GitHub (at the specific commit). */
  github_source_url?: string;
  /** URL to the Lean source file published on GitHub Pages. */
  gh_pages_url?: string;
  /** Git commit SHA at which this Lean file was last modified. */
  last_edited_commit?: string;
  /** Related mathlib4 declaration names. */
  mathlib_links?: string[];
  /**
   * SHA-256 hash (12-char hex prefix) of the .lean file content at
   * last successful build. Used for witness-based cache invalidation.
   */
  lean_hash?: string;
  /** Whether a valid witness file exists for the current lean_hash. */
  witnessed?: boolean;
}

export interface ReviewIssue {
  severity: Severity;
  message: string;
  line?: number;
  suggestion?: string;
}

export interface LeanReviewStatus {
  sorry_count?: number;
  /** Outstanding goal strings from sorry sites. */
  sorry_goals?: string[];
  type_checks?: boolean;
  build_log_url?: string;
}

export interface ReviewRecord {
  /** Identifier for the reviewer (model name, GitHub username, etc.). */
  reviewer_id: string;
  reviewer_type: ReviewerType;
  review_type: ReviewType;
  /** ISO-8601 timestamp. */
  timestamp: string;
  verdict: Verdict;
  /** Reviewer's confidence in the verdict (0–1). */
  confidence?: number;
  severity_counts?: Record<Severity, number>;
  issues?: ReviewIssue[];
  lean_status?: LeanReviewStatus;
  commit_sha?: string;
  notes?: string;
}

export interface ProofObject {
  /** LaTeX label following the project labeling convention. */
  label: string;
  object_type: ObjectType;
  title?: string | null;
  latex: LaTeXLocation;
  lean?: LeanReference;
  formalization_status?: FormalizationStatus;
  reviews?: ReviewRecord[];
  /** Labels of objects this one depends on (from \uses{}). */
  uses?: string[];
}

export interface DependencyEdge {
  /** Label of the object that uses another. */
  from: string;
  /** Label of the object being used. */
  to: string;
  relation?: DependencyRelation;
}

export interface Manuscript {
  /** GitHub repository (owner/name). */
  repo: string;
  /** Git commit SHA from which objects were extracted. */
  commit_sha: string;
  /** ISO-8601 timestamp of extraction. */
  generated_at: string;
  /** URL to the published PDF. */
  pdf_url?: string;
  /** Base URL for doc-gen4 Lean documentation pages. */
  lean_docs_url?: string;
}

export interface ProofObjectsManifest {
  version: "1.0";
  manuscript: Manuscript;
  objects: ProofObject[];
  dependencies?: DependencyEdge[];
}

// =============================================================================
// §2  Semantic Glossary (Ontologist output)
// =============================================================================

/** Universe assignment for Lean category-theoretic types. */
export interface UniverseLevel {
  /** Universe for objects (typically `u`). */
  objects: string;
  /** Universe for morphisms (typically `v`). */
  morphisms?: string;
}

/** How a glossary term maps into Lean's type system. */
export type LeanDeclKind = "def" | "class" | "structure" | "axiom" | "constant" | "instance";

/** A single entry in the semantic glossary. */
export interface GlossaryEntry {
  /** Narrative string as it appears in the paper. */
  narrative_term: string;
  /** Lean 4 identifier (fully qualified). */
  lean_name: string;
  /** Lean declaration kind. */
  kind: LeanDeclKind;
  /** Lean 4 type signature (the `: Type*` or `: Prop` part). */
  lean_type?: string;
  /** The original prose definition from the manuscript. */
  narrative_definition?: string;
  /** LaTeX source label where this term is defined. */
  latex_label?: string;
  /** Chapter number where this term first appears. */
  chapter?: number;
  /** Mathlib type this maps to (if any). */
  mathlib_type?: string;
  /** Mathlib module path. */
  mathlib_import?: string;
  /** Universe level requirements for category-theoretic types. */
  universes?: UniverseLevel;
  /** Other glossary entries this one depends on. */
  depends_on?: string[];
  /** Ambiguity flags — terms that could not be uniquely resolved. */
  ambiguity?: AmbiguityFlag;
}

/** Flag for terms requiring human disambiguation. */
export interface AmbiguityFlag {
  /** Whether the term is ambiguous and needs resolution. */
  is_ambiguous: boolean;
  /** Description of the ambiguity. */
  message: string;
  /** Candidate types the term could map to. */
  candidates: string[];
  /** The resolution chosen (filled in after disambiguation). */
  resolved_to?: string;
}

export interface GlossaryManifest {
  version: "1.0";
  /** ISO-8601 timestamp. */
  generated_at: string;
  commit_sha: string;
  /** Total number of entries. */
  entry_count: number;
  /** Number of unresolved ambiguities. */
  ambiguity_count: number;
  entries: GlossaryEntry[];
}

// =============================================================================
// §3  Narrative-to-Lean Mapping (mapping.json)
// =============================================================================

/** Bidirectional mapping between narrative strings and Lean identifiers. */
export interface NarrativeMapping {
  /** Narrative string (e.g., "Bring's Surface"). */
  narrative: string;
  /** Lean identifier (e.g., "QOU.BringsSurface.BringsSurface"). */
  lean_id: string;
  /** LaTeX label (e.g., "def:brings-surface"). */
  latex_label?: string;
  /** Context in which this mapping is valid. */
  context?: string;
}

export interface MappingManifest {
  version: "1.0";
  generated_at: string;
  mappings: NarrativeMapping[];
}

// =============================================================================
// §4  Proof State Export (for external analysis tools)
// =============================================================================

/** A single goal in a Lean proof state. */
export interface ProofGoal {
  /** Goal index (0-based). */
  index: number;
  /** The type to be proved (the goal). */
  target: string;
  /** Local context: hypotheses available. */
  hypotheses: ProofHypothesis[];
}

export interface ProofHypothesis {
  /** Hypothesis name. */
  name: string;
  /** Hypothesis type. */
  type: string;
  /** Whether this hypothesis was introduced by the user. */
  is_user_introduced: boolean;
}

/** Proof state at a specific point in a Lean proof. */
export interface ProofStateExport {
  /** Fully qualified declaration name. */
  declaration: string;
  /** File path relative to lean/. */
  file: string;
  /** Line number in the Lean file. */
  line: number;
  /** Column number. */
  column: number;
  /** Current tactic (if in tactic mode). */
  current_tactic?: string;
  /** Outstanding goals. */
  goals: ProofGoal[];
  /** Whether the proof is complete (no remaining goals). */
  is_complete: boolean;
  /** Timestamp of export. */
  exported_at: string;
}

export interface ProofStateManifest {
  version: "1.0";
  states: ProofStateExport[];
}

// =============================================================================
// §5  Category Theory Metadata
// =============================================================================

/** Category-theoretic structure classification. */
export type CategoryLevel =
  | "Category"
  | "SmallCategory"
  | "Preadditive"
  | "Abelian"
  | "Monoidal"
  | "BraidedMonoidal"
  | "SymmetricMonoidal"
  | "Rigid";

/** Extended glossary entry for category-theoretic objects. */
export interface CategoryGlossaryEntry extends GlossaryEntry {
  /** Category-theoretic classification. */
  category_level?: CategoryLevel;
  /** Required Lean typeclasses. */
  required_instances?: string[];
  /** Whether this type involves functorial operations. */
  is_functorial?: boolean;
  /** Functor-specific data. */
  functor_data?: {
    /** Source category. */
    source: string;
    /** Target category. */
    target: string;
    /** Whether this is a monoidal functor. */
    is_monoidal?: boolean;
  };
}

// =============================================================================
// §6  Tactic Mapping (Formalizer configuration)
// =============================================================================

/** Maps narrative proof phrases to Lean tactics. */
export interface TacticMapping {
  /** Narrative phrase pattern (regex or literal). */
  pattern: string;
  /** Whether the pattern is a regex. */
  is_regex: boolean;
  /** Primary Lean tactic to try. */
  primary_tactic: string;
  /** Fallback tactics if primary fails. */
  fallback_tactics: string[];
  /** Context in which this mapping applies. */
  context?: "algebra" | "topology" | "category_theory" | "analysis" | "general";
}

/** Default tactic mappings from the design spec. */
export const DEFAULT_TACTIC_MAPPINGS: TacticMapping[] = [
  {
    pattern: "by calculation",
    is_regex: false,
    primary_tactic: "ring",
    fallback_tactics: ["field_simp", "polyrith"],
    context: "algebra",
  },
  {
    pattern: "clearly follows from",
    is_regex: false,
    primary_tactic: "aesop",
    fallback_tactics: ["linarith", "omega"],
    context: "general",
  },
  {
    pattern: "by induction on (\\w+)",
    is_regex: true,
    primary_tactic: "induction $1 with",
    fallback_tactics: ["cases $1"],
    context: "general",
  },
  {
    pattern: "by the universal property",
    is_regex: false,
    primary_tactic: "exact Limits.IsLimit.lift",
    fallback_tactics: ["exact Limits.IsLimit.hom_ext"],
    context: "category_theory",
  },
  {
    pattern: "diagram commutes|naturality",
    is_regex: true,
    primary_tactic: "aesop_cat",
    fallback_tactics: ["slice_lhs 1 2 => { rw [Category.assoc] }", "simp [CategoryTheory.Category.assoc]"],
    context: "category_theory",
  },
  {
    pattern: "by contradiction",
    is_regex: false,
    primary_tactic: "by_contra",
    fallback_tactics: ["exfalso"],
    context: "general",
  },
  {
    pattern: "by definition",
    is_regex: false,
    primary_tactic: "rfl",
    fallback_tactics: ["unfold", "simp only"],
    context: "general",
  },
];

// =============================================================================
// §7  Knot Theory Types (for combinatorial representations)
// =============================================================================

/** Planar diagram crossing type. */
export type CrossingSign = "positive" | "negative";

/** A crossing in a planar diagram (PD code). */
export interface PDCrossing {
  /** Crossing index. */
  index: number;
  /** Four strand indices meeting at the crossing [i, j, k, l]. */
  strands: [number, number, number, number];
  sign: CrossingSign;
}

/** Planar Diagram representation of a knot. */
export interface PlanarDiagram {
  /** Knot name (e.g., "4_1" for figure-eight). */
  name: string;
  /** Number of crossings. */
  crossing_count: number;
  crossings: PDCrossing[];
  /** Hyperbolic volume (if known). */
  hyperbolic_volume?: number;
  /** Error bound on the volume. */
  volume_error_bound?: number;
}

/** Physical constants used in QOU mass derivations. */
export interface CODATAConstants {
  /** Source (e.g., "CODATA 2026"). */
  source: string;
  values: Record<string, { value: number; uncertainty?: number; unit: string }>;
}

// =============================================================================
// §8  Test Infrastructure — Definitions, Results, and Reports
// =============================================================================

/**
 * Test category — groups tests by what they validate.
 * Used for filtering and report sections.
 */
export type TestCategory =
  | "lean-compile"       // Does each .lean file compile?
  | "lean-library"       // Are required libraries (mathlib, etc.) present?
  | "lean-sorry"         // Sorry audit per declaration
  | "latex-lean-coverage" // Does every \lean{} in LaTeX have a Lean decl?
  | "latex-structure"    // LaTeX labels, cross-refs, environments
  | "schema-validity"   // Do JSON manifests match their schemas?
  | "infrastructure"    // MCP, scripts, config files
  | "custom";           // User-defined tests

/** Severity of a test — controls build-breaking behavior. */
export type TestSeverity = "error" | "warning" | "info";

/** Outcome of a single test. */
export type TestOutcome = "pass" | "fail" | "skip" | "error";

/**
 * A single test definition — what to check.
 * Tests are declarative: the runner interprets them.
 */
export interface TestDefinition {
  /** Unique test ID (e.g., "lean-compile:QOU.Torsion"). */
  id: string;
  /** Human-readable description. */
  description: string;
  category: TestCategory;
  severity: TestSeverity;
  /** Lean project this test applies to (e.g., "QOU", "Fred2005"). Null = repo-wide. */
  lean_project?: string;
  /** File path relevant to this test (relative to repo root). */
  file?: string;
  /** LaTeX label (for coverage tests). */
  latex_label?: string;
  /** Lean declaration name (for compile/sorry tests). */
  lean_decl?: string;
  /** Tags for filtering (e.g., ["braids-and-knots", "torsion", "blocking"]). */
  tags?: string[];
}

/**
 * Result of running a single test.
 */
export interface TestResult {
  /** References TestDefinition.id. */
  test_id: string;
  outcome: TestOutcome;
  /** Duration in milliseconds. */
  duration_ms?: number;
  /** Human-readable message (especially on failure). */
  message?: string;
  /** Structured details (compiler output, diff, etc.). */
  details?: Record<string, unknown>;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

/**
 * Summary statistics for a test run.
 */
export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  errored: number;
  /** Duration of entire run in milliseconds. */
  duration_ms: number;
  /** Breakdown by category. */
  by_category: Record<TestCategory, { total: number; passed: number; failed: number }>;
}

/**
 * A complete test report — output of a test run.
 * Consumed by CI, publication pipeline, and coverage rendering.
 */
export interface TestReport {
  version: "1.0";
  /** ISO-8601 timestamp of the run. */
  generated_at: string;
  /** Git commit SHA. */
  commit_sha: string;
  /** Lean project(s) tested (e.g., ["QOU", "Fred2005"]). */
  lean_projects: string[];
  summary: TestSummary;
  results: TestResult[];
}

// =============================================================================
// §9  Proof Coverage — Publication Metadata
// =============================================================================

/** Coverage status for a single proof object, used in PDF/HTML rendering. */
export type CoverageStatus =
  | "fully-formalized"   // sorry-free, \leanok
  | "stated"             // \lean{} present, has sorry
  | "not-formalized"     // no \lean{} tag
  | "not-applicable";    // remark, example — no formalization expected

/**
 * Per-object coverage entry consumed by the publication pipeline.
 * The ∀ symbol in PDF/HTML links to the lean_docs_url.
 */
export interface CoverageEntry {
  /** LaTeX label (e.g., "thm:lifting-exists"). */
  label: string;
  object_type: ObjectType;
  status: CoverageStatus;
  /** Lean declaration name (if any). */
  lean_decl?: string;
  /** URL to pretty-printed Lean documentation (doc-gen4). */
  lean_docs_url?: string;
  /** URL to source on GitHub Pages. */
  lean_source_url?: string;
  /** Chapter number. */
  chapter?: number;
  /** Rendered theorem number (e.g., "4.12"). */
  number?: string;
}

/**
 * Proof coverage manifest — generated during build,
 * consumed by LaTeX \lean{} macro and HTML renderer.
 */
export interface CoverageManifest {
  version: "1.0";
  generated_at: string;
  commit_sha: string;
  /** Overall coverage statistics. */
  stats: {
    total_objects: number;
    fully_formalized: number;
    stated: number;
    not_formalized: number;
    not_applicable: number;
    /** Percentage of formalizable objects that are fully formalized. */
    coverage_pct: number;
  };
  entries: CoverageEntry[];
}

// =============================================================================
// §10  Visualizer State (replaces schema/viz.json)
// =============================================================================

/** Rendering mode for the Bring's surface visualizer. */
export type VizMode = "CP1" | "cone";

/** 3D point coordinates. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Spherical-coordinate camera orbit. */
export interface VizCamera {
  /** Azimuthal angle in radians. */
  theta: number;
  /** Polar angle in radians. */
  phi: number;
  /** Distance from target point. */
  r: number;
  /** Camera look-at target (world coords). Defaults to origin. */
  target?: Vec3;
}

/** Tube / tile visibility and opacity. */
export interface VizTubes {
  visible?: boolean;
  opacity?: number;
}

/** Parameters for cone-tube mode. Ignored when mode='CP1'. */
export interface VizCone {
  /** Start of tube segment in Planck lengths. */
  N_min?: number;
  /** End of tube segment in Planck lengths. */
  N_max?: number;
  /** Cone half-angle (σ in ρ(s)=s·ℓ_P·σ·Ξ_q). */
  sigma?: number;
  /** Pitch scale (γ in ψᵢ(s)=2πi/3+q·2πs·Q·γ). */
  gamma?: number;
}

/** Scene element visibility flags. */
export interface VizVisibility {
  /** Show brane sphere S³. */
  brane?: boolean;
  /** Show xyz axes helper. */
  axes?: boolean;
  /** Show background star field. */
  stars?: boolean;
  /** Show colour tubes at ±axis poles. */
  axispts?: boolean;
}

/**
 * Serialised state of the Bring's surface visualizer.
 *
 * Pass as URL hash or embed in Markdown to reproduce a specific view.
 * Used by the build process to generate static figures.
 */
export interface VizState {
  /** Torsion / chirality parameter (substrate parameter). q=0 is classical. */
  q: number;
  /** Rendering mode. */
  mode: VizMode;
  /** When true, renders the exceptional divisor E_p as an opaque ℂP¹ surface. */
  blowup?: boolean;
  /** Pre-normalisation (x,y,z) of the selected point p on the brane S³. */
  brane_point: Vec3;
  /** Spherical-coordinate camera orbit. */
  camera: VizCamera;
  /** Tube / tile visibility and opacity. */
  tubes?: VizTubes;
  /** Parameters for cone-tube mode. */
  cone?: VizCone;
  /** Scene element visibility flags. */
  visibility?: VizVisibility;
}

// =============================================================================
// §11  Skills Config (replaces skills-config-schema.json)
// =============================================================================

/** A single skill package subscription. */
export interface SkillPackage {
  /** Local directory name under .claude/skills/. */
  name: string;
  /** GitHub repository in owner/repo format. */
  repo: string;
  /** Path within the repository where skill directories live. */
  path: string;
  /** Git ref (branch, tag, or SHA) to sync from. Defaults to "main". */
  ref?: string;
  /** List of skill directory names to sync from the package. */
  skills: string[];
  /**
   * Package mode. Defaults to "sync".
   * - "sync": Files are copied into .claude/skills/<name>/ by the nightly workflow.
   * - "reference": Package is registered but NOT synced. Skills are fetched
   *   on demand at runtime via the skill_fetch MCP tool.
   */
  mode?: "sync" | "reference";
}

/** Skills configuration — defines external skill package subscriptions. */
export interface SkillsConfig {
  description?: string;
  packages: SkillPackage[];
}
