/**
 * Per-content-block adversarial checklists for tools, schemas, skills, and processes.
 *
 * ## Extending, not forking
 *
 * The adversarial review runs per **content block** (not per diff) so the existing
 * corpus can be backfilled. These checklists extend existing skills rather than
 * forking them:
 * - `tool`: extends `code-node-review` (fidelity, side-effects, unknown-on-failure, deletion guard)
 * - `schema`: extends `code-node-review` (reader existence, closed enums, docstring fidelity, backwards compatibility)
 * - `skill`: extends `devils-advocate-watcher` and `narrative-asserts-code` (truth of code claims, no contradiction, no prose counts, no unasked irreversible actions)
 * - `process`: extends `kg-audit` criteria (complete gateway branching including failure paths, context graph read/write discipline, diagram-to-execution fidelity)
 *
 * @module schemas/adversarial-checklist
 * @graphNode schema
 */

import { z } from "zod";
import {
  FINDING_SEVERITIES,
  RED_FLAG_CATEGORIES,
  type FindingSeverity,
  type RedFlagCategory,
} from "./red-flag";

/** Content block kinds subject to adversarial backfill review. */
export const ADVERSARIAL_CONTENT_KINDS = ["tool", "schema", "skill", "process"] as const;
export type AdversarialContentKind = (typeof ADVERSARIAL_CONTENT_KINDS)[number];

export const AdversarialContentKindSchema = z.enum(ADVERSARIAL_CONTENT_KINDS);

/** A single adversarial checklist item for a content block. */
export interface AdversarialChecklistItem {
  /** Unique stable identifier for the checklist question. */
  id: string;
  /** Content block kind this check applies to. */
  kind: AdversarialContentKind;
  /** The adversarial hypothesis/question to test against the subject. */
  question: string;
  /** Detailed guidance on how to evaluate this question adversarially. */
  guidance: string;
  /** Which skill or discipline this check extends. */
  extendsSource: "code-node-review" | "devils-advocate-watcher" | "kg-audit";
  /** Default red-flag category if a blocking finding is raised. */
  defaultCategory: RedFlagCategory;
  /** Default severity for findings under this check. */
  defaultSeverity: FindingSeverity;
  /**
   * The rules supporting this check, BY NAME — `skill:<name>` or
   * `schema:<module>` — never by path. Code, which is addressed by path on
   * purpose, is `code:<layer>/<module path>`. Paths went stale as skills moved
   * between packages (two named a skill that no longer exists); a name is
   * found wherever the declaration puts it (`check:declared-paths`, bean
   * `rmi6` follow-up). `adversarial-checklist.test.ts` resolves every one.
   */
  references: readonly string[];
}

export const AdversarialChecklistItemSchema = z.object({
  id: z.string().min(1),
  kind: AdversarialContentKindSchema,
  question: z.string().min(1),
  guidance: z.string().min(1),
  extendsSource: z.enum(["code-node-review", "devils-advocate-watcher", "kg-audit"]),
  defaultCategory: z.enum(RED_FLAG_CATEGORIES),
  defaultSeverity: z.enum(FINDING_SEVERITIES),
  references: z.array(z.string().regex(/^(?:skill:[a-z0-9][a-z0-9-]*|schema:(?:[a-z0-9][a-z0-9-]*\/)?[a-z0-9][a-z0-9-]*|code:[a-z0-9][a-z0-9-]*\/[\w./-]+\.ts)$/, "a reference is `skill:<name>`, `schema:[<group>/]<module>` or `code:<layer>/<module path>`")).default([]),
});

// ── 1. Tool Adversarial Checklist ───────────────────────────────────────────

export const TOOL_ADVERSARIAL_CHECKLIST: readonly AdversarialChecklistItem[] = [
  {
    id: "tool-description-fidelity",
    kind: "tool",
    question: "Does the mechanism do what its description says?",
    guidance:
      "A tool describing an aspiration or obsolete CLI/binary is worse than no tool: it answers 'how is this done here?' wrongly and with authority. Verify that the command, arguments, and behavior match the published description. Extends `code-node-review` §Tool nodes rule 2.",
    extendsSource: "code-node-review",
    defaultCategory: "correctness",
    defaultSeverity: "critical",
    references: ["skill:code-node-review", "schema:tools/tool"],
  },
  {
    id: "tool-unknown-on-failure",
    kind: "tool",
    question: "Does every failure return 'unknown' rather than pass?",
    guidance:
      "A check that could not run (e.g. unreadable path, missing tool, bad dependency) must never exit 0 or report clean pass. Vacuous pass and third-state collapse are critical false-green hazards. Extends `code-node-review` and `AGENTS.md` third-state rule.",
    extendsSource: "code-node-review",
    defaultCategory: "false-green",
    defaultSeverity: "critical",
    references: ["skill:code-node-review", "skill:ci-health"],
  },
  {
    id: "tool-side-effects-declared",
    kind: "tool",
    question: "Are side effects declared?",
    guidance:
      "A tool must declare what files, stores, or branches it mutates. Undeclared writes outside declared output boundaries constitute a scope breach. Extends `code-node-review` and task I/O discipline.",
    extendsSource: "code-node-review",
    defaultCategory: "scope-breach",
    defaultSeverity: "major",
    references: ["skill:code-node-review", "code:cat-harness-tools/scripts/task-io.ts"],
  },
  {
    id: "tool-deletion-guarded",
    kind: "tool",
    question: "Is deletion guarded (deletion-requires-confirmation)?",
    guidance:
      "An automated tool must never delete or permanently overwrite durable history, beans, or branches without explicit human confirmation. Extends `deletion-requires-confirmation`.",
    extendsSource: "code-node-review",
    defaultCategory: "irreversible-action",
    defaultSeverity: "critical",
    references: ["skill:deletion-requires-confirmation"],
  },
] as const;

// ── 2. Schema Adversarial Checklist ─────────────────────────────────────────

export const SCHEMA_ADVERSARIAL_CHECKLIST: readonly AdversarialChecklistItem[] = [
  {
    id: "schema-field-readers",
    kind: "schema",
    question: "Does every field have a reader?",
    guidance:
      "A schema field without a reader is an unverified write contract. If data is accepted by Zod but never used by any reader or downstream consumer, it is either dead design or an incomplete pipeline join. Extends `code-node-review` §Schema definition nodes.",
    extendsSource: "code-node-review",
    defaultCategory: "correctness",
    defaultSeverity: "major",
    references: ["skill:code-node-review"],
  },
  {
    id: "schema-enums-closed",
    kind: "schema",
    question: "Are enums closed?",
    guidance:
      "Closed vocabularies prevent typos and silent divergence. Check whether strings that represent discrete state spaces use closed `as const` / `z.enum` arrays rather than loose `string` types. Extends `code-node-review`.",
    extendsSource: "code-node-review",
    defaultCategory: "correctness",
    defaultSeverity: "major",
    references: ["skill:code-node-review", "schema:content/vocabulary"],
  },
  {
    id: "schema-docstring-fidelity",
    kind: "schema",
    question: "Does the docstring's claim match the code?",
    guidance:
      "A module docblock that documents one invariant while the Zod validator enforces another misleads both human maintainers and agents. In particular, check `@module` declaration, JSDoc examples, and field descriptions against schema invariants. Extends `code-node-review`.",
    extendsSource: "code-node-review",
    defaultCategory: "provenance",
    defaultSeverity: "major",
    references: ["skill:code-node-review"],
  },
  {
    id: "schema-backwards-compatible",
    kind: "schema",
    question: "Can an old document still parse?",
    guidance:
      "A widened schema is a widened contract; a narrowed schema or newly required field breaks existing committed nodes and sidecars. Verify that legacy records still parse or migrations exist. Extends `code-node-review`.",
    extendsSource: "code-node-review",
    defaultCategory: "data-loss",
    defaultSeverity: "critical",
    references: ["skill:code-node-review"],
  },
] as const;

// ── 3. Skill Adversarial Checklist ──────────────────────────────────────────

export const SKILL_ADVERSARIAL_CHECKLIST: readonly AdversarialChecklistItem[] = [
  {
    id: "skill-narrative-asserts-code",
    kind: "skill",
    question: "Is each claim about the code still true (narrative-asserts-code)?",
    guidance:
      "Prose asserting commands, paths, or code behavior must reflect the actual codebase. A command in a skill that exits non-zero (like `beans <id> --status in-progress`) breaks agents relying on it. Extends `narrative-asserts-code` and `devils-advocate-watcher`.",
    extendsSource: "devils-advocate-watcher",
    defaultCategory: "provenance",
    defaultSeverity: "critical",
    references: ["skill:narrative-asserts-code", "skill:devils-advocate-watcher"],
  },
  {
    id: "skill-no-contradiction",
    kind: "skill",
    question: "Does it contradict another skill?",
    guidance:
      "Conflicting instructions between skills create agent thrashing and non-determinism. Check whether this skill's rules conflict with higher-order governance (e.g. `AGENTS.md`, `user_rules`, `conduct-core`). Extends `devils-advocate-watcher`.",
    extendsSource: "devils-advocate-watcher",
    defaultCategory: "correctness",
    defaultSeverity: "major",
    references: ["skill:devils-advocate-watcher"],
  },
  {
    id: "skill-no-prose-counts",
    kind: "skill",
    question: "Does it quote a count in prose?",
    guidance:
      "Hardcoding numbers in prose (e.g. 'all 22 section headings', '17 gates') inevitably rots when the corpus changes. Re-measure commands or dynamic queries must be used instead. Extends `conduct-core/unverified-constraints.md` and `devils-advocate-watcher`.",
    extendsSource: "devils-advocate-watcher",
    defaultCategory: "provenance",
    defaultSeverity: "minor",
    references: ["skill:unverified-constraints", "skill:devils-advocate-watcher"],
  },
  {
    id: "skill-no-unasked-irreversible-action",
    kind: "skill",
    question: "Would following it take an irreversible action unasked?",
    guidance:
      "Instructions directing an agent to delete branches, scrub history, or permanently discard artifacts without explicit user permission violate fundamental conduct guardrails. Extends `deletion-requires-confirmation`.",
    extendsSource: "devils-advocate-watcher",
    defaultCategory: "irreversible-action",
    defaultSeverity: "critical",
    references: ["skill:deletion-requires-confirmation"],
  },
] as const;

// ── 4. Process Adversarial Checklist ────────────────────────────────────────

export const PROCESS_ADVERSARIAL_CHECKLIST: readonly AdversarialChecklistItem[] = [
  {
    id: "process-gateway-branches",
    kind: "process",
    question: "Does every gateway branch, including failure, have a path?",
    guidance:
      "An exclusive or inclusive gateway with missing out-edges for error/rejection paths leaves workflow instances dangling in dead states. Every condition, especially negative outcomes, must route to an end event or recovery task. Extends `kg-audit` criteria.",
    extendsSource: "kg-audit",
    defaultCategory: "correctness",
    defaultSeverity: "critical",
    references: ["skill:bpmn-processes", "schema:sdlc/kg-qa"],
  },
  {
    id: "process-no-context-write",
    kind: "process",
    question: "Does a step write to a 'context' graph?",
    guidance:
      "A process may only mutate 'state' graphs (`workflow-state`, `issue-marks`, etc.). A step writing to a 'context' graph (`context: read at session start, never written by a process`) violates graph discipline and corrupts immutable context. Extends `directory-conventions` and `kg-audit`.",
    extendsSource: "kg-audit",
    defaultCategory: "scope-breach",
    defaultSeverity: "critical",
    references: ["skill:directory-conventions", "schema:kg/cat-harness"],
  },
  {
    id: "process-diagram-workflow-fidelity",
    kind: "process",
    question: "Does the diagram match the workflow that runs?",
    guidance:
      "The BPMN/DMN diagram represents the normative process. If the underlying runner executes steps, tasks, or transitions that diverge from the drawn model, the diagram is deceptive documentation. Extends `kg-audit`.",
    extendsSource: "kg-audit",
    defaultCategory: "provenance",
    defaultSeverity: "major",
    references: ["skill:bpmn-processes", "schema:sdlc/kg-qa"],
  },
] as const;

// ── Registry & Helpers ──────────────────────────────────────────────────────

export const ADVERSARIAL_CHECKLISTS: Readonly<Record<AdversarialContentKind, readonly AdversarialChecklistItem[]>> = {
  tool: TOOL_ADVERSARIAL_CHECKLIST,
  schema: SCHEMA_ADVERSARIAL_CHECKLIST,
  skill: SKILL_ADVERSARIAL_CHECKLIST,
  process: PROCESS_ADVERSARIAL_CHECKLIST,
};

export const ALL_ADVERSARIAL_CHECKLIST_ITEMS: readonly AdversarialChecklistItem[] = [
  ...TOOL_ADVERSARIAL_CHECKLIST,
  ...SCHEMA_ADVERSARIAL_CHECKLIST,
  ...SKILL_ADVERSARIAL_CHECKLIST,
  ...PROCESS_ADVERSARIAL_CHECKLIST,
];

/** Retrieve the adversarial checklist for a given content block kind. */
export function getChecklistForKind(kind: AdversarialContentKind): readonly AdversarialChecklistItem[] {
  return ADVERSARIAL_CHECKLISTS[kind] ?? [];
}

/** Check whether an unknown string is a recognized AdversarialContentKind. */
export function isAdversarialContentKind(value: unknown): value is AdversarialContentKind {
  return typeof value === "string" && (ADVERSARIAL_CONTENT_KINDS as readonly string[]).includes(value);
}
