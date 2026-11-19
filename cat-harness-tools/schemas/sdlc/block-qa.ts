/**
 * Per-content-block QA report schema.
 *
 * Each content block (a `.ts` + `.md` + optional `.lean` triple under
 * `content/`) may have a sibling `<block>.qa.json` audit-report file.
 * The report records, per QA criterion, the result of an audit pass
 * along with the source-file hashes at audit time so staleness can
 * be detected when a sibling file is later edited.
 *
 * Multiple reviewer entries per criterion are allowed (script +
 * agent + human adjudication). The first entry whose `field_hash`
 * still matches the current source files is the "fresh" entry for
 * that criterion.
 *
 * The architecture is described by the integration-watcher skill family.
 *
 * @module schemas/block-qa
 * @graphNode schema
 */

import { CONTENT_ADAPTER_NODES, CONTENT_ADAPTERS, CONTENT_PROFILES } from "../content/block-kinds";

import type { AttributionKind } from "../content/attribution";
import type { ContentAdapter, ContentProfile } from "../content/block-kinds";
import type { ContributionRegistry } from "../content/contributions";
import { QaScriptSidecar as QaScriptSidecarSchema } from "../block-qa-schema/js/index.ts";
import { nodeKind } from "../kg/node-kind.ts";
import type { RunContextRef } from "./run-context";

/**
 * The kind of reviewer that produced this finding.
 *
 * - `script`: a deterministic CLI (e.g. `qa-sweep.ts`) ran a grep /
 *   AST check. Reproducible. `id` is the script name + version.
 * - `agent`: an LLM-driven sub-agent (Claude, Copilot, Gemini) read
 *   the block and adjudicated. Not deterministic. `id` names the
 *   model + skill that called it.
 * - `human`: the repo owner (or a human collaborator) adjudicated.
 *   Final authority. `id` is the GitHub login.
 *
 * Re-exported from {@link module:schemas/attribution}, which owns the
 * vocabulary: the same three participants author narrative content (bean
 * `iqim`), and two spellings of one set is what `rlp5` records the cost of.
 */
export { ATTRIBUTION_KINDS as QA_REVIEWER_KINDS } from "../content/attribution";
export type QaReviewerKind = AttributionKind;

/**
 * Identity + provenance of a single QA reviewer entry.
 */
export interface QaReviewer {
  kind: QaReviewerKind;
  /** Stable identifier — script path, agent name, GitHub login. */
  id: string;
  /** Optional version pin (script revision, model id). */
  version?: string;
  /**
   * The declared ACTOR this reviewer was acting as — an id in
   * `cat-harness/scenarios/actors/`.
   *
   * Separate from {@link id} because the two answer different questions and
   * measurably do not share a vocabulary. `id` says *what ran* — a script
   * path, a subagent's name. `actor` says *on whose authority*, which is what
   * decides whether the `qa-reporting` permission was held.
   *
   * **Measured 2026-09-21: 0 of 5,896 reviewer entries in this corpus resolve
   * to a declared actor.** Every `id` is a script path
   * (`pipeline/qa-checkers-voice.ts`) or an ad-hoc agent name
   * (`roundtrip-adjudicator (subagent)`); every actor id is a persona
   * (`ci-pipeline`, `qc-reviewer`). So the permission that governs emitting a
   * QA report could not be evaluated for a single verdict — not because it was
   * denied, but because nothing connected the two sides.
   *
   * Optional, and absent is the **third state**: not "permitted" and not
   * "forbidden" but *unresolved*, which `check:qa-reviewer-permission` counts
   * separately and never reports as clean.
   */
  actor?: string;
  /**
   * 12-char SHA-256 prefix of the script's source-file content at
   * the time this entry was written. Populated for `kind: "script"`.
   * On freshness check, current file hash is compared against this;
   * mismatch ⇒ entry is stale (the checker logic has changed).
   *
   * Mirrors the `scriptHash` convention used by
   * `folio-assistant/computations/witness_base.py`.
   */
  script_hash?: string;
  /**
   * Full git SHA at which the script was most recently committed at
   * audit time (`git log -n 1 --format=%H -- <source_file>`). Used
   * for audit trail and provenance — NOT used to drive staleness
   * (use `script_hash` for that; an uncommitted edit can change the
   * hash without changing the commit SHA).
   */
  script_commit_sha?: string;
  /**
   * 12-char SHA-256 prefix of the concatenated content of every
   * extra input the checker consults beyond the block under audit
   * (see `QaCriterionDefinition.extra_inputs`). Mismatch ⇒ stale.
   */
  deps_hash?: string;
  /**
   * 12-char SHA-256 prefix over the criterion DEFINITION's run-affecting
   * fields — `profiles`, `adapters`, `applies_to`, `depends_on`,
   * `default_severity`, `lean_granularity`. Mismatch ⇒ stale.
   *
   * `script_hash` covers the checker's CODE and `deps_hash` its extra INPUTS;
   * neither covers the criterion itself, so re-scoping one left every cached
   * verdict in place. Measured 2026-09-19: adding `profiles: ["paper"]` to
   * `voice-scholarly-default` and re-sweeping a `document` corpus changed
   * nothing — `qa-sweep --only` reported `fresh-skip` for every block, short-
   * circuiting before the profile gate. Same failure the registry documents
   * for Lean docstrings on that criterion (qou #4673): a verdict that can
   * fail to CLEAR is worse than one that can fail to appear.
   *
   * Deliberately NOT over `description`: for a script criterion the prose is
   * documentation, and hashing it would invalidate a whole corpus on a typo
   * fix. An agent-adjudicated criterion's description IS its meaning, but
   * agent entries are never invalidated by this field — only `kind: "script"`
   * entries are compared.
   */
  def_hash?: string;

  // ── Agent-specific provenance (populated when kind === "agent") ──

  /** LLM model identifier, e.g. "claude-opus-4-7", "gemini-2.5-pro". */
  agent_model?: string;
  /** Claude Code session ID or equivalent for the reviewing agent. */
  agent_session?: string;
  /** ISO date of the agent review. */
  agent_date?: string;
  /** Skill that dispatched the review, e.g. "local/one-voice-audit", "local/devils-advocate-watcher". */
  agent_skill?: string;
}

/**
 * Companion file roles a QA criterion can depend on.
 *
 * A content block is a file stem plus its siblings, and the sidecar
 * `<stem>.qa.json` is what makes it a *content block* rather than a file —
 * QA is the unit boundary. Which siblings exist depends on what kind of
 * content the folio holds:
 *
 * | Role | Content type | Carries |
 * |---|---|---|
 * | `md` | any | prose |
 * | `ts` | any | the block manifest |
 * | `lean` | paper | the formalisation |
 * | `bpmn` | WHO L2 DAK | a business process (BPMN 2.0) |
 * | `dmn` | WHO L2 DAK | decision-support logic (a DMN table) |
 * | `xlsx` | WHO L2 DAK | a data dictionary / indicator sheet |
 * | `fsh` | WHO L3 | a FHIR profile, ValueSet, PlanDefinition… |
 * | `cql` | WHO L3 | Clinical Quality Language logic |
 * | `feature` | WHO L2 | Gherkin feature file — `TestScenario.fsh` makes it `feature 1..1 uri` |
 *
 * Compiled FHIR JSON is deliberately **not** a role. SUSHI generates it from
 * the `.fsh`, so it is a build output rather than an authored companion — a
 * criterion that cares about the resource depends on the source that produced
 * it. (A `json` role would also shadow `BaseModel.json` in the Python mirror
 * of this schema, which warns at class-definition time.)
 *
 * ## Why this had to stop being `"md" | "ts" | "lean"`
 *
 * That triple is the *paper* adapter's companion set, and it was the type of
 * `depends_on` — which gates **applicability**, not just freshness. So a
 * criterion could not say "applies to blocks with a `.dmn`", and worse, every
 * L2/L3 block would take the `n/a-no-md` path and record a clean `n/a` for
 * every axis. QA would report a swept, healthy corpus it had never checked —
 * exactly the false pass the integration contract in
 * `docs/proposals/rag-document-ingestion.md` §5 exists to prevent, and
 * indistinguishable downstream from "a block with nothing wrong".
 *
 * Adding a role here does not make any existing criterion apply to it: a
 * criterion opts in by listing the role in its own `depends_on`.
 */
// Declared in the content-adapter node's leaf schema, so a node's
// `companionRoles` is validated against this same list (bean riit, step 5).
export { COMPANION_ROLES } from "../kg/content-adapter-node";
import type { COMPANION_ROLES } from "../kg/content-adapter-node";

export type CompanionRole = (typeof COMPANION_ROLES)[number];

/**
 * The companion paths handed to an automated checker.
 *
 * Every present companion, keyed by role — not the paper triple. A DAK
 * checker reads `paths.dmn` or `paths.fsh` the same way a voice checker reads
 * `paths.md`, and `qa-sweep` populates all of them from the block's resolved
 * siblings.
 */
export type CheckerPaths = Partial<Record<CompanionRole, string>>;

/**
 * One place a checker found what it was looking for.
 *
 * Moved here from `pipeline/qa-checkers-extended.ts` on 2026-09-18, to
 * sit beside {@link CheckerPaths} — a checker's input and its output belong
 * together, and `CheckerPaths` was already here. The move is what lets
 * `schemas/content/contributions.ts` type a CONTRIBUTED checker: a dependency that
 * adds QA criteria has to describe them in a shape the registry can hold, and
 * the registry cannot import the pipeline.
 */
export interface CheckerHit {
  file: string;
  line: number;
  text: string;
}


/**
 * Which companion roles each BUILT-IN adapter's blocks can actually have.
 *
 * `md` and `ts` are shared: every block has a manifest, and every kind of
 * block may carry prose. `lean` is paper-only.
 *
 * Every vocabulary, typed or contributed, declares its roles on its
 * `folio-content-adapter/v1` node (bean riit, step 5). A CONTRIBUTED one's —
 * the `dak` row that stood here until bean `1335` — reaches the registry
 * through the folio's dependency tree, and {@link incompatibleCompanions}
 * reads it from there.
 *
 * Stated here so that "a paper criterion depends on `.dmn`" is a *checkable*
 * mistake rather than one that shows up as a criterion which silently never
 * applies — `depends_on` gates applicability, so a mismatched pair produces a
 * permanent `n/a` and no error.
 */
export const ADAPTER_COMPANION_ROLES: Record<ContentAdapter, readonly CompanionRole[]> = Object.fromEntries(
  // Read from each typed vocabulary's node (bean riit, step 5): the roles a
  // `paper` block can have are a fact about the paper vocabulary, declared
  // where that vocabulary is, not restated in a table here.
  CONTENT_ADAPTER_NODES.filter((n) => n.typed).map((n) => [n.adapter, n.companionRoles]),
) as unknown as Record<ContentAdapter, readonly CompanionRole[]>;

/** {@link ADAPTER_COMPANION_ROLES}, keyed by a plain string for lookup. */
const BUILT_IN_COMPANION_ROLES: ReadonlyMap<string, readonly CompanionRole[]> = new Map(
  Object.entries(ADAPTER_COMPANION_ROLES),
);

/**
 * Companion roles a criterion declares that no adapter in its scope can
 * provide — always empty in a healthy registry.
 *
 * A contributed adapter's roles come from `contributions`. Without it, a
 * criterion scoped to an adapter core does not own has NO allowed roles, so
 * every companion it depends on is reported — the loud answer, because "could
 * not tell which roles that adapter has" must not read as "compatible".
 */
export function incompatibleCompanions(
  def: {
    adapters?: string[];
    depends_on: CompanionRole[];
  },
  contributions?: Pick<ContributionRegistry, "adapterCompanionRoles">,
): CompanionRole[] {
  const allowed = new Set<CompanionRole>();
  for (const a of criterionAdapters(def)) {
    const roles = BUILT_IN_COMPANION_ROLES.get(a) ?? contributions?.adapterCompanionRoles(a) ?? [];
    for (const r of roles) allowed.add(r);
  }
  return def.depends_on.filter((r) => !allowed.has(r));
}

/**
 * What each party of an untainted verification is given, and what it is not.
 *
 * Declared per criterion on {@link QaCriterionDefinition.untainted}. The
 * discipline it encodes is generic — it is the translation round trip with the
 * translation taken out, and it applies to a secret scan and to an evidence
 * appraisal with nothing changed but the vocabulary:
 *
 * | party | is given | produces |
 * |---|---|---|
 * | producer | the task | the artefact |
 * | **checker** | `checker_sees`, and nothing that would let it shortcut | an independent rendering or finding |
 * | **adjudicator** | `adjudicator_sees` — never the artefact itself | `pass` / `warn` / `fail`, each drift named |
 *
 * See `skills/process/process-core/untainted-verification.md` for the three rules and
 * the failure each one is there to stop.
 */
export interface UntaintedDispatch<A extends string = CompanionRole> {
  /**
   * Artefacts the CHECKER is given.
   *
   * Disjoint from {@link adjudicator_sees}: if both parties can read the same
   * file, one of them is grading its own input.
   */
  checker_sees: A[];
  /**
   * Artefacts deliberately WITHHELD from the checker.
   *
   * Listed rather than inferred, so that the omission is a decision somebody
   * made. Together with `checker_sees` this must cover every companion the
   * criterion depends on — see {@link untaintedPartitionDefects}.
   */
  checker_withheld: A[];
  /** Artefacts the ADJUDICATOR is given, alongside the checker's output. */
  adjudicator_sees: A[];
  /**
   * What counts as a finding for this criterion, and what does not.
   *
   * Required, and required to say both halves. Told only what to look for, an
   * adjudicator returns a style review and everything "fails"; the translation
   * round trip states it as *"synonyms, articles and re-ordering are not drift;
   * a claim added, dropped, weakened, strengthened or reversed is"*, and that
   * shape is what a useful one looks like.
   */
  drift: string;
}

/**
 * Why a criterion's untainted declaration cannot be trusted — empty when it can.
 *
 * Four defects, and each is a way the separation decays without erroring:
 *
 * - **undeclared** — no `untainted` block at all. Reported rather than skipped:
 *   "nobody said" is not "nothing to check", and a criterion silently exempt
 *   from the discipline is how the discipline stops applying to anything.
 * - **overlap** — a role in both `checker_sees` and `adjudicator_sees`. This is
 *   the one that matters: the two parties can read the same file, so the check
 *   compares a thing with its own paraphrase of itself and passes.
 * - **unpartitioned** — an artefact in the criterion's universe that appears in
 *   neither `checker_sees` nor `checker_withheld`. Usually one added later;
 *   without this it would default to invisible, which is safe, or to visible,
 *   which is not — either way nobody decided.
 * - **phantom** — an artefact named in the declaration that is not in the
 *   criterion's universe. The declaration describes some other criterion.
 *
 * ## Why `universe` is a parameter rather than read off `depends_on`
 *
 * It was `def.depends_on` until the first instantiation, and the first
 * instantiation is what showed that to be wrong. `translation-semantic-
 * roundtrip`'s central visible artefact is the **`.po`**, and `po` is
 * deliberately NOT a {@link CompanionRole} — `translation-block-qa.ts` states
 * the reason at length: a PO is a companion of a *(block, locale)* pair, not
 * of a block, so adding it to `COMPANION_ROLES` would widen applicability for
 * every criterion in every folio.
 *
 * So the discipline's own founding case could not be expressed in the type
 * generalised from it. **The abstraction was too narrow, not the case** — the
 * artefact vocabulary belongs to the criterion, and the caller is the only
 * party that knows it. For a block criterion the universe IS `depends_on`; for
 * a translation criterion it is `depends_on` plus `po`.
 *
 * Deliberately NOT checked here: whether `drift` says anything useful. A
 * non-empty string is checkable; "states what is not drift as well as what is"
 * is a reading, and a gate that pretends to measure it would be the very thing
 * this file exists to stop.
 */
export function untaintedPartitionDefects<A extends string = CompanionRole>(
  def: { id: string; untainted?: UntaintedDispatch<A> },
  universe: readonly A[],
): string[] {
  const u = def.untainted;
  if (!u) return [`${def.id}: undeclared — no \`untainted\` block, so nobody has said what the checker may see`];

  const out: string[] = [];
  const depends = new Set<A>(universe);
  const sees = new Set<A>(u.checker_sees);
  const withheld = new Set<A>(u.checker_withheld);

  for (const r of u.adjudicator_sees) {
    if (sees.has(r)) {
      out.push(
        `${def.id}: overlap — \`${r}\` is visible to BOTH the checker and the adjudicator, ` +
          `so one of them is grading its own input`,
      );
    }
  }
  for (const r of u.checker_sees) {
    if (withheld.has(r)) out.push(`${def.id}: overlap — \`${r}\` is both seen and withheld from the checker`);
  }
  for (const r of universe) {
    if (!sees.has(r) && !withheld.has(r)) {
      out.push(
        `${def.id}: unpartitioned — \`${r}\` is a companion this criterion depends on and is in ` +
          `neither \`checker_sees\` nor \`checker_withheld\`; nobody has decided whether the checker sees it`,
      );
    }
  }
  for (const r of [...u.checker_sees, ...u.checker_withheld, ...u.adjudicator_sees]) {
    if (!depends.has(r)) {
      out.push(
        `${def.id}: phantom — \`${r}\` is named in the untainted declaration but is not among this ` +
          `criterion's artefacts`,
      );
    }
  }
  if (u.drift.trim() === "") {
    out.push(`${def.id}: \`drift\` is empty — an adjudicator told only what to look for returns a style review`);
  }
  return out;
}

/**
 * The adapters a criterion applies to, with the documented default applied.
 *
 * Strings rather than `ContentAdapter`, because a criterion may be scoped to a
 * CONTRIBUTED adapter (`dak`) that core's type does not name.
 */
export function criterionAdapters(def: {
  adapters?: string[];
}): readonly string[] {
  // Absent means every BUILT-IN vocabulary: what `["paper"]` meant while one
  // adapter held every kind (bean `bzwk`). `paper` is no longer an adapter
  // name; a scope that still says it matches nothing, so write it out.
  return def.adapters === undefined ? [...CONTENT_ADAPTERS] : [...def.adapters];
}

/**
 * The profiles a criterion applies to, with the documented default applied.
 *
 * Note the default runs the OTHER WAY from {@link criterionAdapters}: absent
 * means **every** profile, not one of them. See `QaCriterionDefinition.profiles`
 * for why the two axes default in opposite directions.
 */
export function criterionProfiles(def: {
  profiles?: ContentProfile[];
}): readonly ContentProfile[] {
  return def.profiles ?? CONTENT_PROFILES;
}

/**
 * The voices a criterion belongs to. Absent means the criterion is not
 * voice-scoped and runs regardless.
 *
 * NOTE THE ASYMMETRY WITH {@link criterionProfiles}, which is deliberate and is
 * the third time this codebase has had to choose a default direction for a
 * scoping axis:
 *
 * - `profiles` absent means EVERY profile, because narrowing silently stops a
 *   criterion running and "a wrong pass is believed where a wrong fail is
 *   argued with".
 * - `voices` absent means NOT VOICE-SCOPED — the criterion is part of the base
 *   house standard, which always applies.
 * - `voices` PRESENT means the criterion applies only while one of those voices
 *   is activated, and is `n/a` otherwise. A voice is opt-in (issue #208: "we
 *   shouldnt autmoatically apply voices"), so a voice criterion running against
 *   a folio that never asked for it produces confident findings against prose
 *   written to a different standard.
 */
export function criterionVoices(def: {
  voices?: string[];
}): readonly string[] | undefined {
  return def.voices;
}

/**
 * Should the voice axis exclude this criterion, given the folio's ACTIVE voices?
 *
 * Three cases, and the third is the one that needs saying:
 *
 * 1. The criterion names no voice → runs. Base standard.
 * 2. The criterion names voices and one is active → runs.
 * 3. The criterion names voices and NONE is active → excluded, `n/a`.
 *
 * `activeVoices` is `undefined` when the folio's configuration could not be
 * read at all, and that returns **`false`** — the criterion runs — for the same
 * reason `profileExcludesCriterion` does: "could not determine" must not be
 * spent granting a skip. An empty ARRAY is different from `undefined`: it is a
 * folio that read its config and activates nothing, which is the common case and
 * does exclude.
 */
export function voiceExcludesCriterion(
  def: { voices?: string[] },
  activeVoices: readonly string[] | undefined,
): boolean {
  const scope = criterionVoices(def);
  if (scope === undefined) return false; // not voice-scoped
  if (activeVoices === undefined) return false; // could not determine
  return !scope.some((v) => activeVoices.includes(v));
}

/**
 * Should the profile axis exclude this criterion from a folio declaring
 * `folioProfile`?
 *
 * `folioProfile` is `undefined` for a folio that does not say — no
 * `harness.config.json`, no `contentType` in it, or a config that will not
 * parse. That third state returns **`false`**: the criterion runs.
 *
 * That is the whole reason this is a named function rather than an inline
 * `!includes(...)` at the one call site. "Could not determine" is not
 * "document", and a folio whose configuration a tool cannot read must not
 * quietly lose QA coverage on the strength of a guess — the resulting clean
 * sweep is indistinguishable from a real one. `profileForContentType`
 * resolves the unknown case to `paper` because a *validator* asking "may this
 * folio contain this block?" is safest with the wider vocabulary; a *gate*
 * asking "may I skip this check?" is safest running it.
 */
export function profileExcludesCriterion(
  def: { profiles?: ContentProfile[] },
  folioProfile: ContentProfile | undefined,
): boolean {
  if (!folioProfile) return false;
  return !criterionProfiles(def).includes(folioProfile);
}

/**
 * Roles whose *content* is a text file a checker can read directly.
 *
 * `xlsx` is deliberately absent: it is a ZIP container, so hashing its bytes
 * is meaningful but grepping them is not. A criterion over a data dictionary
 * has to go through an extractor rather than reading the sibling.
 */
export const TEXTUAL_COMPANION_ROLES: readonly CompanionRole[] = [
  "md",
  "ts",
  "lean",
  "bpmn",
  "dmn",
  "fsh",
  "cql",
  "feature",
];

/**
 * Hash of the source files at the moment a criterion was audited.
 *
 * Each entry is a 12-char prefix of the SHA-256 of the file's
 * UTF-8 bytes — same convention as
 * `folio-assistant/computations/witness_staleness_tracker.py`.
 *
 * Absent fields mean the criterion's audit did not depend on that
 * file (or the file did not exist at audit time).
 *
 * Keyed by {@link CompanionRole}, plus two derived keys (`graph`,
 * `lean_statement`) that are not companion files at all.
 */
export interface QaFieldHash extends Partial<Record<CompanionRole, string>> {
  /**
   * Hash of the chapter's `uses[]` edge set, for criteria whose verdict is a
   * property of the GRAPH rather than of this block's own files.
   *
   * The detangler axis is the case: forward references, dependency cycles,
   * cone depth and graph energy are all computed across the whole chapter, so
   * editing block A's `uses[]` changes block B's verdict while B's own `.md` /
   * `.ts` / `.lean` are untouched. Keyed only on its own files, B stays
   * `fresh-skip` and keeps a verdict that is now wrong — observed live in qou,
   * where breaking three dependency cycles left 15 blocks still recording
   * `detangler-no-dependency-cycle: fail` for cycles that no longer existed.
   *
   * Present only on entries for graph-scoped criteria (those declaring
   * `also_invalidated_by: ["graph"]`), so ordinary criteria neither carry nor
   * compare it.
   */
  graph?: string;
  /**
   * Hash of only the **declaration signatures** in the `.lean` file —
   * everything up to each declaration's `:=` / `where`.
   *
   * Some criteria care only about what a block *claims*, not how it is
   * justified. `proof-narrative-lean-equiv` compares the narrative
   * statement to the Lean signature; `proof-statement-integrity` guards
   * against the signature changing. Rewriting a proof body cannot
   * affect either verdict, yet under the whole-file `lean` hash it
   * invalidated both — so every proof edit re-queued agent
   * adjudications that could not have changed.
   *
   * Criteria opt in via `QaCriterionDefinition.lean_granularity`.
   * Absent, a criterion keeps using the whole-file `lean` hash.
   *
   * Derived lexically (see `pipeline/lean-signature.ts`), so it
   * is approximate. It is computed to fail SAFE: if the file cannot be
   * lexed into declarations, this is left `undefined` and freshness
   * falls back to the whole-file hash — over-invalidating, never under.
   */
  lean_statement?: string;
}

/**
 * The outcome of one reviewer evaluating one criterion on one block.
 *
 * `result: "pass"` — criterion satisfied. `evidence` may be empty.
 * `result: "fail"` — criterion violated. `evidence` must cite
 *   file:line + a verbatim quote of the offending text.
 * `result: "warn"` — borderline; reviewer flags but does not block.
 * `result: "n/a"` — criterion does not apply to this block kind.
 */
export interface QaCriterionEntry {
  /** Source-file hashes captured at audit time. */
  field_hash: QaFieldHash;
  /** Outcome. */
  result: "pass" | "fail" | "warn" | "n/a";
  /** Severity if `result` is `"fail"` or `"warn"`. */
  severity?: "critical" | "major" | "minor";
  /**
   * Optional rubric score for rater-style (quality) criteria
   * (`proof-rater-*`). `value` ∈ [0, max]; `rubric` holds per-dimension
   * sub-scores. A score is a *quality* measure to improve over time, not
   * a pass/fail gate. Convention: value/max ≥ 0.66 ⇒ result "pass",
   * 0.33–0.66 ⇒ "warn", < 0.33 ⇒ "fail" (severity "minor"). Populated by
   * `kind: "agent"` reviewers; absent for binary criteria.
   */
  score?: { value: number; max: number; rubric?: Record<string, number> };
  /**
   * Evidence for fail/warn verdicts: either a free-form "file:line +
   * verbatim quote" string, or a structured list of { line, text }
   * locations. Some agent reviewers (voice axis especially) emit the
   * structured shape; the live corpus carries both.
   */
  evidence?: string | Array<{ line?: number; text?: string }>;
  /**
   * Optional structured numeric/heuristic measures a checker emits
   * alongside its verdict — e.g. the detangler axis records per-block
   * graph metrics (`fwd_emitted`, `out_degree`, `in_degree`,
   * `cone_size`, `edge_span_max`, `graph_energy`, `topic_*`). Unlike
   * `score` (a quality rubric to improve over time) these are
   * descriptive structural measures of the block's position in the
   * dependency graph. Keys are checker-defined; values are scalars or
   * short strings (e.g. a worst-offending target label). Persisted so
   * the sidecar carries the heuristic snapshot, not just pass/fail.
   */
  metrics?: Record<string, number | string>;

  // ── da-axis extension fields ──
  /** Refutation scope (AGENTS.md "Before declaring refuted"). */
  scope?: "limited" | "structural";
  /** Adjudicator ruling on a single objection. */
  ruling?: "surviving" | "rebutted" | "partial";
  /** The objection in the referee's voice (1-3 sentences). On a
   *  da-referee-verdict rollup entry, the strongest objection. */
  referee_argument?: string;
  /** What rebuts the objection, or "none — survived because …".
   *  For scope:"structural" this must name the proved invariant. */
  rebuttal?: string;
  /**
   * Block-level rollup verdict. Set ONLY on da-referee-verdict entries.
   *
   * - `clean-rebutted`: >=1 objection was raised and every one was rebutted.
   * - `no-objection-raised`: zero objections were raised (does not satisfy sidecar skip).
   * - `clean`: legacy synonym for `clean-rebutted` (historical sidecars).
   * - `survivable-objection`: >=1 partial objection, none surviving.
   * - `open-objection`: >=1 surviving objection.
   */
  verdict?: "clean-rebutted" | "no-objection-raised" | "clean" | "survivable-objection" | "open-objection";

  /** Reviewer identity + provenance. */
  reviewer: QaReviewer;
  /**
   * When the audit ran (ISO-8601 UTC). Optional, and no longer written by the
   * platform's writers (owner rulings 2026-11-06: card "QA dates", option 1,
   * derive the date; card "Date source", option 1, derive it ON READ):
   * the date a verdict is shown and ordered by is DERIVED from
   * {@link reviewed_tree} — the commit date of the commit carrying that tree
   * (`tree-commits.json`, `entryDate` in `pipeline/qa-utils.ts`) — so the
   * verdict's bytes carry no clock and a PR's QA output can be reused on main.
   * The run's own time is in its run record. Kept readable for existing
   * sidecars.
   */
  reviewed_at?: string;
  /**
   * Tree of repo HEAD at audit time (`HEAD^{tree}`, full git id, or the
   * `unknown` sentinel outside git). Producers must set this on every new
   * entry; optional in the type only because older entries carry
   * `reviewed_sha` instead. The tree, not the commit, because a PR run's HEAD
   * is GitHub's synthetic merge commit, which can vanish — the tree survives
   * onto main unchanged (bean 69lr; owner card Q4, 2026-11-05).
   */
  reviewed_tree?: string;
  /**
   * Repo HEAD at audit time (full git SHA). No longer written — superseded
   * by `reviewed_tree` (bean 69lr) — and kept readable so existing sidecars
   * validate. Legacy agent entries (pre-2026-06) omit it too.
   */
  reviewed_sha?: string;
  /** Free-form notes. */
  notes?: string;
}

/**
 * The full per-block QA report file shape.
 *
 * Filename: `<block-root>.qa.json`, under `test/results/block-qa/` in a tree
 * that MIRRORS the block's own directory — never composed by hand. The one
 * answer is `blockQaPath` / `existingBlockQaPath` in
 * `pipeline/qa-paths.ts`.
 *
 * It WAS a sibling of `<block-root>.md`, one member of the block's companion
 * family alongside `.ts` and `.lean`, until bean `2634` moved it: placement
 * follows provenance, and a verdict is a QA reviewer's output. A reader who
 * still finds one beside a block is looking at a folio that has not migrated —
 * that location is read as a fallback and never written to.
 *
 * `criteria` maps each named criterion to an **array** of reviewer
 * entries. Multiple entries are allowed; the criterion's "current
 * verdict" is the most recent entry whose `field_hash` matches the
 * present source files. If no entry matches, the criterion is
 * stale and requires re-audit.
 */
export interface BlockQaReport {
  /** Schema marker — value: `block-qa/v1`. */
  $schema: "block-qa/v1";
  /** Block label (e.g. `def:carbon-valence`, `rem:carbon-valence`). */
  label: string;
  /** Block kind (mirror of the .ts manifest's discriminator). */
  kind: string;
  /** Paths to source files, relative to repo root. */
  paths: {
    ts: string;
    md?: string;
    lean?: string;
  };
  /** Hashes of present source files (refreshed on every write). */
  source_hashes: QaFieldHash;
  /**
   * Per-criterion reviewer entries. Multiple reviewers (script +
   * agent + human) may co-exist; they are NOT deduplicated.
   */
  criteria: Record<string, QaCriterionEntry[]>;
  /** Report creation / last-update timestamp (ISO-8601 UTC). Optional and no longer written, as {@link QaCriterionEntry.reviewed_at}. */
  updated_at?: string;
  /**
   * Content-addressed reference to the `folio-run-context/v1` record of the
   * run that wrote this report (`docs/proposals/tool-releases-2026-10-07.md`,
   * owner C1 = a).
   */
  runContext?: RunContextRef;
}

/**
 * Definition of a single QA criterion — registered ahead of time
 * by the watcher's criterion catalog.
 */
/**
 * What a criterion audits. See {@link QaCriterionDefinition.subject}.
 */
export type QaCriterionSubject = "block" | "script";

export interface QaCriterionDefinition {
  /** Stable identifier (e.g. `voice-status-leak`). */
  id: string;
  /** Domain bucket — `voice`, `fit`, `framework`, `wall`, etc. */
  domain: string;
  /** Human-readable one-liner. */
  description: string;
  /** Default severity when the criterion fails. */
  default_severity: "critical" | "major" | "minor";
  /**
   * Which source files this criterion depends on.
   *
   * This field carries TWO meanings, and they are not the same thing:
   *
   * 1. **Applicability.** A block missing a listed file gets an `n/a`
   *    verdict and the checker never runs (`qa-sweep`'s `n/a-no-md` /
   *    `n/a-no-lean` paths).
   * 2. **Freshness.** A cached verdict is stale once a listed file's
   *    hash moves away from the entry's `field_hash`.
   *
   * When a criterion *reads* a file but must still apply to blocks that
   * lack it, listing the file here is wrong — it would `n/a` exactly the
   * blocks the criterion exists to check. Use `also_invalidated_by`
   * instead, which buys freshness without the applicability gate.
   */
  /**
   * Which content adapters this criterion applies to.
   *
   * **Absent means `["paper"]`**, not "all". Every criterion in the registry
   * today was written for the paper adapter — its axes are about scholarly
   * voice, proof structure, Lean formalisation and reading order — so an
   * absent field must not silently widen them over WHO L2/L3 blocks. A
   * `voice-scholarly-default` verdict on a FHIR ValueSet is not a finding,
   * it is a category error, and one that would arrive as a `fail` rather
   * than as an obviously wrong `n/a`.
   *
   * Defaulting to `all` was the alternative, and it is the trap: it needs
   * every one of the ~47 existing criteria edited to stay correct, and any
   * that were missed would misfire silently. Defaulting to the adapter they
   * were all written for needs none, and a new DAK criterion opts in by
   * saying so.
   *
   * A plain string, not `ContentAdapter`: the value may name a CONTRIBUTED
   * adapter — `dak` is contributed since bean `1335` — and a content type is
   * data rather than an import. Whether a named adapter actually exists is a
   * runtime question for the contribution registry.
   *
   * Resolve with `criterionAdapters()` rather than reading this directly.
   */
  adapters?: string[];
  /**
   * Which content **profiles** this criterion applies to.
   *
   * **Absent means every profile**, not one of them — the exact opposite of
   * `adapters` directly above, and deliberately so. The two fields look alike
   * and read alike, so the reason they default in opposite directions is
   * worth stating rather than inferring:
   *
   * | | `adapters` | `profiles` |
   * |---|---|---|
   * | members are | disjoint namespaces | nested restrictions |
   * | absent means | `["paper"]` — narrow | all of them — wide |
   * | a wrong default produces | a criterion that never runs | a criterion that misfires |
   *
   * Adapters partition. A criterion written for the paper vocabulary has
   * *nothing* to say about a FHIR ValueSet, so widening by default would have
   * pointed ~47 existing criteria at a corpus none of them was written for.
   *
   * Profiles nest: every `document` kind is also a `paper` kind, and every
   * criterion in the registry predating this field was written against
   * `prose`, `remark`, `example` and the rest — which is to say, against the
   * document vocabulary — with the paper-only kinds as an *addition*.
   * Narrowing by default would therefore stop those criteria running on
   * document folios and report the result as a clean sweep. That is a **false
   * pass**, and a false pass is strictly worse than a false fail here: a
   * wrong `fail` is read by a reviewer and argued with, while a wrong `pass`
   * is read by nobody and silently becomes the folio's QA record.
   *
   * So the field is an **opt-out for the genuinely paper-only**, declared one
   * criterion at a time with its reason written beside it: a criterion whose
   * verdict rests on a TeX toolchain the document render path does not have
   * (`document_render_*` goes through pandoc and never falls back to
   * `latexmk`), or on Lean formalization that {@link DOCUMENT_FORBIDS_LEAN}
   * bars a document folio from carrying at all.
   *
   * Two things this field is **not** for, because both are easy to mistake
   * for it:
   *
   * - **Folio-specific axes.** A criterion that assumes one folio's subject
   *   matter — CODATA calibration anchors, a q-deformation regime, a named
   *   chapter directory — is not paper-only, it is *that folio*-only, and a
   *   paper folio about anything else is equally miscategorised by it. That
   *   is what `folioOptionalAxes()` in the registry exists for.
   * - **Kind scoping.** A criterion that only makes sense on a `theorem`
   *   already says so in `applies_to`, and a document folio cannot hold one.
   *   Restating it here adds a second answer to the same question.
   *
   * Resolve with `criterionProfiles()` rather than reading this directly.
   */
  profiles?: ContentProfile[];
  /**
   * Named editorial voices this criterion belongs to.
   *
   * Absent means the criterion is part of the base house standard and always
   * applies. Present means it applies only while one of those voices is
   * ACTIVATED in `harness.config.json` — the opposite default from `profiles`,
   * and for the opposite reason. Narrowing a profile silently stops a check
   * running, so `profiles` defaults open; applying an editorial register nobody
   * asked for produces confident findings against prose written to a different
   * standard, so a voice defaults closed. Issue #208: "we shouldnt autmoatically
   * apply voices. not all authors will want to use the who voice (e.g. a
   * mministry of health)".
   *
   * Resolve with `voiceExcludesCriterion()` rather than reading this directly:
   * a folio whose configuration could not be READ is a third state and must not
   * be granted the skip.
   */
  voices?: string[];
  depends_on: CompanionRole[];
  /**
   * Extra files that invalidate a cached verdict WITHOUT gating
   * applicability — the freshness half of `depends_on` on its own.
   *
   * Exists because the two meanings above genuinely come apart.
   * `voice-scholarly-default` is the motivating case: it scans Lean
   * docstrings as well as `.md`, but must keep running on prose-only
   * blocks that have no `.lean` sibling at all. Listing `"lean"` in
   * `depends_on` would `n/a` every such block; omitting it entirely
   * meant a Lean-only edit could neither raise a finding nor CLEAR one,
   * so a fixed docstring kept serving a stale `fail` until the sidecar
   * entry was deleted by hand.
   *
   * Consulted by `entryIsFresh` via `freshnessKeys()`; ignored by the
   * applicability gates.
   */
  also_invalidated_by?: Array<CompanionRole | "graph">;
  /**
   * How an UNTAINTED verification of this criterion is dispatched — and, more
   * to the point, what each dispatched party is NOT allowed to see.
   *
   * Absent means the criterion has no untainted form declared. That is a third
   * state, not a permission: {@link untaintedPartitionDefects} reports it as
   * undeclared rather than as clean, because "nobody said" and "nothing to
   * check" are the two readings this field exists to keep apart.
   *
   * ## Why a declaration rather than a convention
   *
   * The separation IS the measurement, and it is the half that decays
   * silently. A checker shown the thing the adjudicator is ruling against
   * writes that thing back and the check passes vacuously; an adjudicator
   * shown the artefact can talk itself into any reading of the checker's
   * output. Neither failure produces an error — both produce a green verdict
   * that measured nothing, which is the one outcome worse than a red one.
   *
   * So the visible sets are declared and **checked for totality**: every
   * companion the criterion depends on is in exactly one of `checker_sees`
   * and `checker_withheld`. A companion role added to a criterion later
   * therefore cannot drift into the checker's view by default — it lands in
   * neither set and the partition stops being total, which is a defect with a
   * name rather than a quiet widening.
   *
   * `checker_sees` and `adjudicator_sees` must be **disjoint**. That single
   * constraint is the whole discipline in one line: if the two parties can see
   * the same file, one of them is grading its own input.
   */
  untainted?: UntaintedDispatch;
  /**
   * Whether a deterministic script can run this criterion (true) or
   * it requires agent / human adjudication (false).
   */
  automated: boolean;
  /**
   * What the criterion is evaluated **against** — and therefore what shape
   * its checker takes.
   *
   * - omitted / `"block"` — a content block. The checker takes
   *   {@link CheckerPaths}. This is every criterion on the block sweep.
   * - `"script"` — a source script. The checker takes its path as a string,
   *   and the criterion belongs to `script-sweep`, not `qa-sweep`.
   *
   * **This exists so discovery does not have to guess from the domain name.**
   * The two subjects were told apart by `domain === "script-quality"`, which
   * is a bucket label rather than a contract: a second script axis under any
   * other name would have been handed to the block sweep, where its checker
   * would receive a `CheckerPaths` object as its `scriptPath` and read
   * `[object Object]` off disk. `pipeline/qa-checker-discovery.ts`
   * partitions on this field, so the mismatch is impossible rather than
   * merely unlikely.
   *
   * Absent means `"block"` because every criterion predating the field was
   * one, and a wrong default here is a checker invoked with the wrong
   * argument type — which fails loudly, unlike the silent misfires the
   * `adapters` / `profiles` defaults above are guarding.
   */
  subject?: QaCriterionSubject;
  /**
   * How finely this criterion depends on its `.lean` file.
   *
   * - omitted / `"file"` — any byte change invalidates. The default,
   *   and correct for anything that reads the proof.
   * - `"statement"` — only the declaration SIGNATURES matter, so a
   *   proof-body rewrite leaves the verdict fresh. Set this only when
   *   the criterion genuinely cannot be affected by a proof body;
   *   getting it wrong presents a stale verdict as current.
   *
   * Ignored unless `depends_on` includes `"lean"`.
   */
  lean_granularity?: "file" | "statement";
  /**
   * Optional gating: block kinds the criterion applies to.
   * Empty / undefined means "all kinds".
   */
  applies_to?: string[];
  /**
   * Path (repo-relative) to the source file containing this
   * criterion's checker function. Required for `automated: true`
   * criteria; ignored otherwise. Used to compute the entry's
   * `script_hash` so a checker-logic change auto-invalidates
   * downstream sidecar entries.
   *
   * If omitted, the registry's `getCriterionSourceFile()` helper
   * resolves a default based on the criterion id prefix.
   */
  source_file?: string;
  /**
   * This criterion is declared here, but its checker belongs to a dependency.
   *
   * Core owns the RULE — what the criterion asserts about content — while the
   * tooling that answers it may live in the layer whose subject it is;
   * elaboration cost is a Lean measurement, so its checkers are
   * the science layer's. The owner's cut: *"f-a-core has high level
   * processes only, no tooling"*.
   *
   * It is a flag rather than an absent `source_file` because absence is not
   * distinguishable from "never declared one": `getCriterionSourceFile` ends
   * in a DEFAULT, so a criterion whose checker moved out of core would
   * silently resolve to `qa-checkers-extended.ts` — and `script_hash` is
   * computed over the resolved path, so it would never invalidate again.
   * Eleven criteria were measured in that state on 2026-09-18. With the flag,
   * `resolveCriterionSource` refuses the cascade for this criterion and
   * reports an unsupplied checker as unresolved, which is a third state rather
   * than a wrong path.
   *
   * Setting both this and `source_file` is a collision and throws: two answers
   * to "where is this checker" are two answers free to disagree.
   */
  checker_contributed?: boolean;
  /**
   * Repo-relative paths to extra inputs the checker consults beyond
   * the block under audit — for example, cached audit witnesses
   * (`docs/audits/*.json`), the bibliography database
   * (`content/schema/references.ts`), or cross-block manifests.
   * Concatenated content of these files is hashed into `deps_hash`
   * on the entry. Changes invalidate the entry.
   */
  extra_inputs?: string[];
}

/**
 * Per-script audit sidecar — mirrors the Python-pipeline
 * `*.witness.json` convention from
 * `folio-assistant/computations/witness_base.py`.
 *
 * One sidecar per automated criterion, recording the canonical
 * `(script_hash, script_commit_sha, deps_hash)` triple captured at
 * the most recent qa-sweep run. Block-level `QaCriterionEntry`
 * records snapshot the same triple inline so per-entry freshness
 * is checkable without a sidecar lookup; this script-level sidecar
 * is the single-source-of-truth view "is checker X currently
 * stale globally?".
 *
 * Filename: `<criterion-id>.script.json` under
 * `pipeline/script-sidecars/`.
 */
export interface QaScriptSidecar {
  /** Schema marker — value: `qa-script/v1`. */
  $schema: "qa-script/v1";
  /** Criterion id this sidecar tracks (e.g. `proof-no-bare-sorries`). */
  criterion_id: string;
  /** Path (repo-relative) to the checker's source file. */
  source_file: string;
  /** 12-char SHA-256 prefix of the source file's content. */
  script_hash: string;
  /** Full git SHA of the most recent commit touching `source_file`. */
  script_commit_sha: string;
  /** Optional repo-relative paths to extra-input files. */
  extra_inputs?: string[];
  /** 12-char SHA-256 of concatenated extra_inputs (omitted if none). */
  deps_hash?: string;
  /** ISO-8601 UTC timestamp of the most recent qa-sweep run. Optional and no longer written: the run's time is in its run record. */
  last_run_at?: string;
  /** Repo HEAD at the most recent sweep (full git SHA). */
  last_run_sha: string;
  /** Engine fingerprint — e.g. `bun-1.3.11+node-22`. */
  engine_version?: string;
}

/**
 * `qa-script/v1` as a node kind (issue #2195): the block-QA schema package's
 * Zod shape, so `validators/qa-script.json` names a kind rather than a bare
 * schema and `node-kinds:check` files the family under it. Unversioned: the
 * family's tag is `qa-script/v1`, not SemVer, so the `$schema` literal stays a
 * field of the shape rather than one `nodeKind()` generates. Not strict: the
 * package's schema passes unknown keys through, and a kind that stripped them
 * accepts exactly the same files.
 */
export const QaScriptKind = nodeKind("qa-script", [], QaScriptSidecarSchema.shape);

/**
 * What a checker concluded.
 */
export interface CheckerResult {
  /**
   * Outcome. `warn` is preserved end-to-end (matches block-qa/v1's
   * `QaCriterionEntry.result` union) so a soft finding lands in the
   * sidecar without being silently coerced to `pass`.
   */
  result: "pass" | "fail" | "warn" | "n/a";
  hits: CheckerHit[];
  /**
   * Optional human-readable context threaded into the sidecar entry's
   * `notes` field. Used by cache-backed checkers (e.g.
   * `proof-lean-compiles`) to record WHY a result is `n/a` — for
   * instance "cached diagnostics are stale relative to current .lean".
   */
  notes?: string;
  /**
   * Optional structured numeric/heuristic measures persisted into the
   * sidecar entry's `metrics` field (see `QaCriterionEntry.metrics`).
   * Used by the detangler axis to record per-block graph measures
   * (degree, dependency-cone size, edge span, graph energy, topic
   * coherence) alongside the pass/fail verdict.
   */
  metrics?: Record<string, number | string>;
}
