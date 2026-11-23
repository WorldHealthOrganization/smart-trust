/**
 * Assistant Workflow — Content lifecycle state machine.
 *
 * Defines the general content development lifecycle that applies
 * across repositories (qou math authoring, WHO SMART guidelines, etc.).
 * Each skill package realizes this lifecycle with domain-specific
 * skill assignments.
 *
 * ## Lifecycle stages
 *
 * ```
 * ┌──────┐     ┌────────┐     ┌──────────┐     ┌──────────┐     ┌──────┐
 * │ PLAN │────▶│ AUTHOR │────▶│ VALIDATE │────▶│  REVIEW  │────▶│ TEST │
 * └──────┘     └────────┘     └──────────┘     └──────────┘     └──────┘
 *                    ▲              │                │              │
 *                    │              ▼                ▼              ▼
 *                    └──────────────┴────────────────┴──────────────┘
 *                                    (rework)                       │
 *                                                                   ▼
 *              ┌────────┐     ┌──────────┐     ┌──────────┐
 *              │ RETIRE │◀────│ FEEDBACK │◀────│ PUBLISH  │
 *              └────────┘     └──────────┘     └──────────┘
 *                                   │
 *                                   ▼
 *                              ┌────────┐
 *                              │ AUTHOR │  (new cycle)
 *                              └────────┘
 * ```
 *
 * @module assistant-workflow
 * @graphNode schema
 */

import type { Conformance } from "../conduct/assistant-types";
import type { LifecycleStage } from "../kg/skill-package.js";

// ---------------------------------------------------------------------------
// Lifecycle stages
// ---------------------------------------------------------------------------

/**
 * The stages of the content development lifecycle.
 *
 * | Stage | Description | Key activities |
 * |-------|-------------|----------------|
 * | `plan` | Scope the work | Outlining, dependency ordering, triage |
 * | `author` | Create or modify content | Authoring, formalization, editing |
 * | `validate` | Automated checks | Schema, AST, constraint, type checking |
 * | `review` | Human or agent review | Accuracy, style, proof correctness |
 * | `test` | Integration testing | Build, CI, regression, proof compilation |
 * | `publish` | Release to audience | PDF, HTML, gh-pages, IG Publisher |
 * | `feedback` | Collect responses | Todos, issues, comments, annotations |
 * | `retire` | Withdraw content | Deprecation, supersession, archival |
 *
 * Re-exported from `./types.js`, where it is `z.infer` of
 * `LifecycleStageSchema` — not redeclared. This module used to declare its own
 * seven-member version with `develop` and `revise` in place of `plan`,
 * `author` and `retire`. Every stage value on disk (18 skill definitions and 5
 * package manifests) comes from the Zod enum: `author` alone appears 18 times,
 * `plan` 7 and `retire` 4, while `develop` and `revise` appear nowhere at all.
 * The redeclared type was unreachable from the `schemas/` barrel, which
 * exports `types.js` and not this module, so the two never met and the wrong
 * one simply sat here contradicting the published schema reference.
 */
export type { LifecycleStage };

/**
 * A transition between lifecycle stages.
 */
export interface StageTransition {
  /** Stage transitioning from. */
  from: LifecycleStage;
  /** Stage transitioning to. */
  to: LifecycleStage;
  /** What triggers this transition. */
  trigger: "auto" | "manual" | "ci";
  /** Gate conditions that must be met (requirement statement keys). */
  gates?: string[];
}

/**
 * Maps a lifecycle stage to the skills that execute during that stage.
 */
export interface StageSkillBinding {
  /** The lifecycle stage. */
  stage: LifecycleStage;
  /** Skills that run during this stage, with conformance. */
  skills: {
    skillId: string;
    conformance: Conformance;
    /** Brief description of what this skill does at this stage. */
    role: string;
  }[];
}

/**
 * A complete workflow definition: lifecycle stages, transitions,
 * and skill bindings for a specific content domain.
 *
 * @example
 * ```ts
 * const mathWorkflow: WorkflowDefinition = {
 *   id: "authoring-math",
 *   name: "Formal Mathematics Authoring",
 *   stages: ["author", "validate", "review", "test", "publish", "feedback"],
 *   transitions: [
 *     { from: "author", to: "validate", trigger: "auto" },
 *     { from: "validate", to: "review", trigger: "auto",
 *       gates: ["REQ-CCR-1"] },
 *   ],
 *   bindings: [
 *     { stage: "author", skills: [
 *       { skillId: "formalizer", conformance: "SHALL",
 *         role: "Generate Lean proofs" },
 *     ]},
 *   ],
 * };
 * ```
 */
export interface WorkflowDefinition {
  /** Unique workflow identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Description of this workflow. */
  description: string;
  /** Ordered lifecycle stages used by this workflow. */
  stages: LifecycleStage[];
  /** Allowed transitions between stages. */
  transitions: StageTransition[];
  /** Skill assignments per stage. */
  bindings: StageSkillBinding[];
}

// ---------------------------------------------------------------------------
// QOU math authoring workflow (concrete realization)
// ---------------------------------------------------------------------------

/**
 * The formal mathematics authoring workflow for the QOU paper.
 *
 * This is the **concrete realization** of the generic lifecycle
 * for the `authoring-math` skill package.
 */
export const mathAuthoringWorkflow: WorkflowDefinition = {
  id: "authoring-math",
  name: "Formal Mathematics Authoring",
  description:
    "Content development lifecycle for formal mathematics papers: " +
    "Lean 4 formalization, LaTeX rendering, proof review, and publication.",
  // `develop` and `revise` were this workflow's own names for two stages the
  // canonical `LifecycleStage` enum does not distinguish: both are `author`
  // (first draft and rework alike). Merged rather than kept, because they
  // were only expressible while this module declared a private copy of the
  // enum. If the distinction is worth keeping, the fix is the other
  // direction — add a member to `LifecycleStageSchema` so every consumer
  // sees it — not a second vocabulary here.
  stages: ["author", "validate", "review", "test", "publish", "feedback"],
  transitions: [
    { from: "author", to: "validate", trigger: "auto" },
    { from: "validate", to: "review", trigger: "auto", gates: ["REQ-CCR-1", "REQ-CCR-2"] },
    { from: "review", to: "test", trigger: "manual" },
    { from: "test", to: "publish", trigger: "ci", gates: ["REQ-CH-1"] },
    { from: "publish", to: "feedback", trigger: "auto" },
    { from: "feedback", to: "author", trigger: "manual" },
    // Short-circuit: a failed gate sends the content back to authoring
    { from: "validate", to: "author", trigger: "auto" },
    { from: "review", to: "author", trigger: "manual" },
    { from: "test", to: "author", trigger: "auto" },
  ],
  bindings: [
    {
      stage: "author",
      skills: [
        { skillId: "editor", conformance: "SHALL", role: "Coordinate session, triage tasks" },
        { skillId: "formalizer", conformance: "SHALL", role: "Generate/complete Lean proofs" },
        { skillId: "category-theory", conformance: "SHOULD", role: "Diagram chasing, monoidal reasoning" },
        { skillId: "lean-generation", conformance: "SHOULD", role: "Extract Lean stubs from LaTeX" },
        { skillId: "ontologist", conformance: "MAY", role: "Term disambiguation, glossary" },
        { skillId: "paper-importer", conformance: "MAY", role: "Import from arXiv" },
        // Folded in from the former `revise` stage; `editor` was SHALL in
        // both and is not repeated.
        { skillId: "proof-simplifier", conformance: "MAY", role: "Streamline completed proofs" },
        { skillId: "chapter-analysis", conformance: "MAY", role: "Structural review" },
      ],
    },
    {
      stage: "validate",
      skills: [
        { skillId: "content-validation", conformance: "SHALL", role: "Schema + constraint + AST checks" },
        { skillId: "latex-validation", conformance: "SHALL", role: "LaTeX syntax verification" },
        { skillId: "scientific-accuracy", conformance: "SHOULD", role: "Mathematical intent verification" },
      ],
    },
    {
      stage: "review",
      skills: [
        { skillId: "lean-proof-review", conformance: "SHALL", role: "Proof rigor and sorry audit" },
        { skillId: "content-block-review", conformance: "SHALL", role: "Block-level consistency audit" },
        { skillId: "readability-editing", conformance: "SHOULD", role: "Prose style review" },
        { skillId: "critical-path-analysis", conformance: "MAY", role: "Dependency impact analysis" },
      ],
    },
    {
      stage: "test",
      skills: [
        { skillId: "test-engineer", conformance: "SHALL", role: "Unit tests, CI validation" },
        { skillId: "proof-status-tracking", conformance: "SHALL", role: "Update proof-objects.json" },
        { skillId: "proof-triage", conformance: "SHOULD", role: "Prioritize remaining sorrys" },
      ],
    },
    {
      stage: "publish",
      skills: [
        { skillId: "docs-generation", conformance: "SHALL", role: "TypeDoc, PDF, HTML, gh-pages" },
        { skillId: "deployment-auth", conformance: "MAY", role: "Remote MCP server update" },
      ],
    },
    {
      stage: "feedback",
      skills: [
        { skillId: "todo-review", conformance: "SHALL", role: "Process feedback into TodoItems" },
      ],
    },
  ],
};
