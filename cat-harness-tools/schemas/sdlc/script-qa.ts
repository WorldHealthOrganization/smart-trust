/**
 * Per-script QA report schema.
 *
 * Where the block-QA schema audits **content blocks** (`.ts` + `.md` +
 * optional `.lean` triples under `content/`), this schema audits
 * **scripts** — Python files under `folio-assistant/computations/`,
 * TypeScript files under `pipeline/`, and (later) Rust files under any
 * compiled compute backend. Criteria like `does_not_default_to_float` and
 * `respects_archimedean_wall` apply to script source code and have no meaning
 * for narrative `.md` content.
 *
 * Layout:
 *
 *   folio-assistant/computations/markov_peel.py
 *   folio-assistant/computations/script-qa/markov_peel.script-qa.json
 *
 * One sidecar per script, sitting in a `script-qa/` subdirectory of
 * the script's parent dir. Mirrors the per-block `<block>.qa.json`
 * convention but stays separate from `*.witness.json` (compute outputs)
 * and `*.script.json` (per-criterion checker version pins).
 *
 * @module schemas/script-qa
 * @graphNode schema
 */

import type {
  QaCriterionEntry,
  QaCriterionDefinition,
} from "./block-qa";
import type { RunContextRef } from "./run-context";

/**
 * Source language of the audited script. Determines which checker
 * subset applies — `script-sweep` dispatches per language, returning
 * `n/a` for any (criterion, language) pair lacking a registered
 * checker.
 *
 * Currently only the `python` checker for `does_not_default_to_float`
 * is wired (see `SCRIPT_CHECKERS` in `pipeline/script-sweep.ts`).
 * Future criteria (`respects_archimedean_wall`, `variables_typed`, …)
 * will extend coverage to TypeScript and Rust as separate follow-up
 * PRs land each checker.
 */
export type ScriptLanguage = "python" | "typescript" | "rust";

/**
 * Per-script QA report. One file per script audited.
 *
 * Filename: `<script-basename-without-ext>.script-qa.json`,
 * placed in `<script-parent-dir>/script-qa/`.
 */
export interface ScriptQaReport {
  /** Schema marker — value: `script-qa/v1`. */
  $schema: "script-qa/v1";
  /** Repo-relative path to the audited script. */
  script_path: string;
  /** Source language inferred from extension. */
  language: ScriptLanguage;
  /** 12-char SHA-256 prefix of the script's content. */
  source_hash: string;
  /** ISO-8601 UTC timestamp of last write. Optional and no longer written (owner rulings 2026-11-06, cards "QA dates" and "Date source"): the date is derived on read from the entries' `reviewed_tree`. */
  updated_at?: string;
  /**
   * **Proper-metadata references** the script declares to
   * propositions, definitions, theorems, glossary entries, or
   * bibliographic keys. Mirrors the content-block convention of
   * `uses: [...]` / `meta.cites: [...]` arrays in `.ts` manifests.
   *
   * Each entry is one of:
   *   - content-block label: `"prop:foo-bar"`, `"def:carbon-valence"`,
   *     `"thm:lifting-exists"`, `"conj:foo"`, `"rem:foo"`, `"cor:foo"`,
   *     `"ex:foo"`, `"sim:foo"`, `"sec:foo"`, `"tbl:foo"`, `"fig:foo"`
   *   - bibliographic key matching an entry in
   *     `content/schema/references.ts` (e.g. `"wenzl1988"`,
   *     `"kashaev1997"`)
   *   - the literal sentinel `"manuscript"` — internal-manuscript
   *     reference (per CLAUDE.md §1 Lean-side convention) for
   *     citations whose target is the current paper itself rather
   *     than an external bibliography entry. Recognised as valid
   *     by the criterion; does NOT need a matching entry in
   *     `content/schema/references.ts`.
   *
   * This field is the **canonical metadata** that the
   * `has_references_to_paper` criterion checks. It is
   * **human-authored only** — the sweep does not auto-populate
   * this field from script source (per author direction
   * 2026-05-24: "no citation grepped from content; only proper
   * metadata"). Authors edit the sidecar directly to add,
   * remove, or override entries.
   *
   * Empty array means the script genuinely has no paper references
   * (e.g. pure infrastructure / utility code) — distinct from
   * `undefined`, which means the field has never been populated
   * and the script will fail the criterion.
   */
  references?: string[];
  /**
   * Per-criterion reviewer entries. Reuses the block-QA
   * `QaCriterionEntry` shape (script_hash / script_commit_sha /
   * deps_hash on the reviewer apply identically here).
   */
  criteria: Record<string, QaCriterionEntry[]>;
  /**
   * Content-addressed reference to the `folio-run-context/v1` record of the
   * run that wrote this report (`docs/proposals/tool-releases-2026-10-07.md`,
   * owner C1 = a).
   */
  runContext?: RunContextRef;
}

/**
 * Helper — narrows a `QaCriterionDefinition` to those whose domain
 * indicates the audit subject is a script file, not a content
 * block. Currently the convention is `domain: "script-quality"`.
 */
export function isScriptCriterion(def: QaCriterionDefinition): boolean {
  return def.domain === "script-quality";
}
