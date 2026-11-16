/**
 * Record an UNTAINTED verification — a pair of dispatched parties, neither of
 * which can see what would let it shortcut — as witnesses on a block's QA
 * sidecar.
 *
 * This is `translation-roundtrip.ts` with the translation taken out. That
 * module is the only implementation of the pattern in the corpus (measured
 * 2026-09-21: 2 of 5,896 `reviewer` entries), and everything in it that was
 * not about French generalises: the two parties, the separation between them,
 * which one rules, what staleness means, and the refusal to call a model
 * itself.
 *
 * ## The two parties, and the separation IS the measurement
 *
 * | party | sees | produces |
 * |---|---|---|
 * | **checker** | the criterion's `checker_sees` companions, and nothing else | an independent rendering or finding |
 * | **adjudicator** | `adjudicator_sees`, plus the checker's output — never the artefact | `pass` / `warn` / `fail`, drifts named |
 *
 * The sets are declared per criterion ({@link UntaintedDispatch}) rather than
 * composed per call, because the party composing a brief by hand is the
 * producer, and rule 1 then breaks quietly. `untaintedPartitionDefects` is
 * what makes the declaration checkable.
 *
 * ## Three states, and the third one is the whole point
 *
 * 1. **verified** — the adjudicator ruled. Two entries, adjudicator first.
 * 2. **could not dispatch** — no dispatch capability was available. ONE entry,
 *    `result: "n/a"`, `metrics.dispatch: "unavailable"`, and a **required**
 *    reason. The producer may write this one and only this one.
 * 3. **not attempted** — no entry at all.
 *
 * State 2 is the owner's ruling of 2026-09-21, and it is what lets the
 * discipline gate at all: a coder that may not write a verdict would otherwise
 * have nothing to write in an environment with no subagents, leaving the gate
 * reading an absence it cannot tell from negligence. Recording it keeps "could
 * not dispatch" distinguishable from "nobody tried" — which is the same
 * three-state rule `ci-health` and `readme-sections` already apply, arrived at
 * here from the opposite direction.
 *
 * **It is never a pass.** {@link isVerified} is the predicate a gate asks, and
 * it is false for state 2. A consumer that treats `n/a` as "nothing to see"
 * turns the honest gap back into the silent one.
 *
 * ## What this module deliberately does NOT do
 *
 * It does not call a model. The payload is written by whatever ran the
 * parties, so recording works the same whether they were two subagents, two
 * API calls, or two people — inherited from `translation-roundtrip.ts`, where
 * the reasoning is stated at length and holds unchanged here.
 *
 * @module pipeline/untainted-verification
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import type { QaCriterionEntry, QaFieldHash } from "../schemas/sdlc/block-qa.ts";
import {
  attestationKeyForDerived,
  composeCriteria,
  finalizeCriteria,
  isAsciiEscaped,
  refusalLine,
  resolvePrior,
} from "../schemas/sdlc/qa-attestations.ts";

/** Who ran, and under what. `model` is meaningless without `model_source`. */
export interface UntaintedParty {
  /** Stable name of the party as a reviewer, e.g. "secret-scan-checker". */
  id: string;
  /** The skill or prompt that dispatched it. */
  skill?: string;
  /** Session identifier, so a reader can find the transcript. */
  session?: string;
  /** Model identifier, when the operator chooses to record one. */
  model?: string;
  /**
   * How `model` was established — recorded WITH it, never instead.
   *
   * A subagent's serving model is not directly observable from the session
   * that dispatched it: it inherits the parent unless the harness overrides,
   * and nothing in the hand-back says which model served the turn. A bare
   * model string is therefore an inference printed as a fact, which is the
   * defect this whole family of sidecars exists to stop. Absent both, a reader
   * gets "not recorded", which is true and acceptable.
   */
  model_source?: string;
  /**
   * Whether the party used tools, in its own words.
   *
   * Asked and RECORDED rather than assumed. The artefact is in the
   * repository; a checker with filesystem access can find what it was not
   * given, and the verdict then measures its search rather than the artefact.
   * Absent means nobody asked, which is not the same as "no".
   */
  tools_used?: string;
  /** ISO-8601; defaults to now. */
  date?: string;
  /**
   * The declared actor this party acted as.
   *
   * Defaults from the party's ROLE — {@link CHECKER_ACTOR} or
   * {@link ADJUDICATOR_ACTOR} — so the separation the discipline rests on is
   * not something a caller has to remember to get right.
   */
  actor?: string;
}

export interface UntaintedPayload {
  /** Repo-relative path of the subject block's `.md`. */
  subject: string;
  /** The criterion being verified. */
  criterion: string;
  /** The checker's output — the intermediate the adjudicator ruled on. */
  intermediate: string;
  checker: UntaintedParty;
  adjudicator: UntaintedParty;
  verdict: "pass" | "warn" | "fail";
  severity?: "critical" | "major" | "minor";
  /** Each drift, in the adjudicator's words. Empty on a clean pass. */
  findings?: string[];
  /** How the adjudicator ruled, including what it declined to count as drift. */
  reasoning?: string;
  /** Anything the checker flagged as ambiguous. */
  uncertainties?: string[];
  /** Defaults to now / current HEAD's tree; pass them when re-recording an older review. */
  reviewed_at?: string;
  reviewed_tree?: string;
  /** Legacy re-record address; see {@link reviewAddress}. */
  reviewed_sha?: string;
}

/**
 * State 2: the dispatch could not happen.
 *
 * `reason` is required by the type and non-empty by
 * {@link couldNotDispatchEntry}, because a bare "could not dispatch" is
 * indistinguishable from a party that declined to try.
 */
export interface CouldNotDispatchPayload {
  subject: string;
  criterion: string;
  /** Why no dispatch was possible — an environment fact, not an excuse. */
  reason: string;
  /** Who recorded the absence. May be the producer; that is the point. */
  recorded_by: UntaintedParty;
  reviewed_at?: string;
  reviewed_tree?: string;
  /** Legacy re-record address; see {@link reviewAddress}. */
  reviewed_sha?: string;
}

/**
 * Where a review is addressed: `reviewed_tree`, the tree of HEAD (bean 69lr;
 * owner card Q4, 2026-11-05: a PR run's HEAD commit can vanish, its tree
 * cannot).
 *
 * A caller re-recording an older review may still name it by commit
 * (`reviewed_sha`). That is written through verbatim and NO tree is stamped:
 * the current tree would place the review against a tree it never saw — the
 * lie a re-stamped commit once told — and the commit's own tree is not known
 * here without a git read this module does not make. An explicit
 * `reviewed_tree` wins over both.
 */
export function reviewAddress(
  p: { reviewed_tree?: string; reviewed_sha?: string },
  headTree: string | undefined,
): Pick<QaCriterionEntry, "reviewed_tree" | "reviewed_sha"> {
  if (p.reviewed_tree === undefined && p.reviewed_sha !== undefined) return { reviewed_sha: p.reviewed_sha };
  return { reviewed_tree: p.reviewed_tree ?? headTree };
}

/**
 * The declared actors the two dispatched parties act as.
 *
 * Stamped as a DEFAULT rather than required on the payload, because the actor
 * follows from the role and a caller that had to supply it could supply the
 * wrong one — which is how the separation stops being structural.
 * `UntaintedParty.actor` overrides it for a party that is genuinely something
 * else.
 */
export const CHECKER_ACTOR = "untainted-checker";
/** @see {@link CHECKER_ACTOR} — and note this one holds `qa-reporting` while the checker does not. */
export const ADJUDICATOR_ACTOR = "untainted-adjudicator";

function partyFields(p: UntaintedParty) {
  return {
    agent_model: p.model,
    agent_session: p.session,
    agent_skill: p.skill,
    agent_date: p.date ?? new Date().toISOString(),
  };
}

/**
 * Metrics an entry carries about HOW it was produced.
 *
 * `model_source` and `tools_used` ride here rather than in `notes`, which hold
 * the adjudicator's reasoning in its own voice; the panel renders metrics as
 * labelled rows, so the basis shows up beside the claim rather than buried in
 * a paragraph.
 */
function provenanceMetrics(
  p: UntaintedParty,
  extra: Record<string, string> = {},
): Record<string, string> | undefined {
  const m: Record<string, string> = { ...extra };
  if (p.model_source) m.model_source = p.model_source;
  if (p.tools_used) m.tools_used = p.tools_used;
  return Object.keys(m).length > 0 ? m : undefined;
}

/** Build the two entries a verification contributes, adjudicator first. */
export function untaintedEntries(
  payload: UntaintedPayload,
  fieldHash: QaFieldHash,
  headTree?: string,
): QaCriterionEntry[] {
  // A caller re-recording an earlier review keeps its date; otherwise none is
  // stamped (owner rulings 2026-11-06, "QA dates" / "Date source"): the date
  // is derived on read from reviewed_tree.
  const at = payload.reviewed_at;
  const address = reviewAddress(payload, headTree);
  const findings = payload.findings?.filter((f) => f.trim() && f.trim().toLowerCase() !== "none");

  const verdict: QaCriterionEntry = {
    field_hash: fieldHash,
    result: payload.verdict,
    severity: payload.verdict === "pass" ? undefined : (payload.severity ?? "minor"),
    evidence: findings && findings.length > 0 ? findings.map((t) => ({ text: t })) : undefined,
    reviewer: {
      kind: "agent",
      id: payload.adjudicator.id,
      actor: payload.adjudicator.actor ?? ADJUDICATOR_ACTOR,
      ...partyFields(payload.adjudicator),
    },
    ...(at ? { reviewed_at: at } : {}),
    ...address,
    metrics: provenanceMetrics(payload.adjudicator, { role: "adjudicator" }),
    notes: payload.reasoning,
  };

  const checker: QaCriterionEntry = {
    field_hash: fieldHash,
    // It ruled on nothing and must not read as a verdict. What it contributes
    // is the intermediate the adjudicator ruled on.
    result: "n/a",
    reviewer: {
      kind: "agent",
      id: payload.checker.id,
      actor: payload.checker.actor ?? CHECKER_ACTOR,
      ...partyFields(payload.checker),
    },
    ...(at ? { reviewed_at: at } : {}),
    ...address,
    metrics: provenanceMetrics(payload.checker, { role: "checker" }),
    notes:
      `Checker output: ${payload.intermediate}` +
      (payload.uncertainties && payload.uncertainties.length > 0
        ? `\n\nFlagged as ambiguous: ${payload.uncertainties.join(" · ")}`
        : ""),
  };

  return [verdict, checker];
}

/**
 * Build the single entry for state 2 — the dispatch that could not happen.
 *
 * Throws on an empty reason rather than writing a blank one. The entry exists
 * to be *readable* by somebody deciding whether the gap is acceptable, and a
 * reasonless record answers none of what they need to know.
 */
export function couldNotDispatchEntry(
  payload: CouldNotDispatchPayload,
  fieldHash: QaFieldHash,
  headTree?: string,
): QaCriterionEntry {
  if (payload.reason.trim() === "") {
    throw new Error(
      `${payload.criterion} on ${payload.subject}: a "could not dispatch" record needs a reason — ` +
        `without one it cannot be told from a party that declined to try`,
    );
  }
  return {
    field_hash: fieldHash,
    result: "n/a",
    reviewer: { kind: "agent", id: payload.recorded_by.id, ...partyFields(payload.recorded_by) },
    ...(payload.reviewed_at ? { reviewed_at: payload.reviewed_at } : {}),
    ...reviewAddress(payload, headTree),
    metrics: provenanceMetrics(payload.recorded_by, { dispatch: "unavailable" }),
    notes: `Could not dispatch: ${payload.reason.trim()}`,
  };
}

/**
 * True when an entry is a CHECKER's witness — the intermediate, not a verdict.
 *
 * Identified by `metrics.role`, which {@link untaintedEntries} stamps, never by
 * reviewer name: an exemption claimable by asserting it is not an exemption.
 *
 * It exists because `untainted-checker` deliberately does **not** hold
 * `qa-reporting` — the checker rules on nothing, and a checker that emits a
 * verdict is comparing a thing with its own paraphrase of itself. Without this
 * predicate its legitimate `result: "n/a"` witness would read as a permission
 * breach, and the honest half of the mechanism would fail the gate built to
 * protect it.
 */
export function isCheckerWitness(entry: QaCriterionEntry): boolean {
  return entry.result === "n/a" && entry.metrics?.role === "checker";
}

/** True when an entry is the record of a dispatch that never happened. */
export function isCouldNotDispatch(entry: QaCriterionEntry): boolean {
  return entry.result === "n/a" && entry.metrics?.dispatch === "unavailable";
}

/**
 * Did an untainted verification actually rule here?
 *
 * The predicate a GATE asks, and the reason it is a named function: state 2
 * records `n/a`, and a consumer reading `n/a` as "nothing to see" turns the
 * honest gap straight back into the silent one this module exists to end.
 * Neither a `could not dispatch` record nor a checker's `n/a` is a pass.
 */
export function isVerified(entries: readonly QaCriterionEntry[] | undefined): boolean {
  if (!entries || entries.length === 0) return false;
  return entries.some(
    (e) => !isCouldNotDispatch(e) && (e.result === "pass" || e.result === "warn" || e.result === "fail"),
  );
}

/**
 * Merge fresh entries into a sidecar's criterion, replacing this process's own
 * and carrying everything else through.
 *
 * **A sweep replaces only entries whose reviewer is itself.** Stated in
 * `translation-manager.md` after `translation-block-qa` silently deleted a
 * round trip a pair of agents had produced, on an unrelated re-run, with
 * nothing in the output to say so. A human ruling is never superseded here: it
 * is not this process's to overwrite.
 */
export function mergeUntainted(
  existing: readonly QaCriterionEntry[] | undefined,
  fresh: readonly QaCriterionEntry[],
): QaCriterionEntry[] {
  const kept = (existing ?? []).filter((e) => e.reviewer?.kind !== "agent");
  return [...fresh, ...kept];
}

/**
 * Record a verification in the attestation store — a judgement's durable
 * home — and refresh the derived report's projection only if one exists.
 *
 * Both entries are judgements (`reviewer.kind` agent or human), so since
 * `8wj1`/`2gst` they belong in the declared `attestations` graph
 * (`qa-attestations/v1`), not in the derived block-qa report, which is a
 * working copy whose record lives on the `qa-reports` branch (bean `8iqt`).
 * This writer goes through the same API as the nine writers `8wj1` fixed:
 * `resolvePrior`, then `finalizeCriteria` in `"attesting"` mode, which writes
 * the store FIRST, reads it back, and only then composes the projection.
 *
 * `sidecarPath` names the subject by its derived report's path (under
 * `test/results/block-qa/` or the legacy sibling) whether or not that file
 * exists: once derived files leave `main` (bean `5hox`) it usually will not,
 * and the verdict must still land.
 *
 * Refuses — throws, having written nothing — when:
 * - the path names no block-qa / translation-qa subject;
 * - the SUBJECT does not exist (neither `<subject>.md` nor `<subject>.ts`).
 *   This used to be "the sidecar does not exist — run the sweep first", but
 *   the derived report is no longer kept beside the subject, so its absence
 *   says nothing about scope; the subject's absence still does;
 * - the derived report exists and does not parse;
 * - the store is `corrupt` or `unknown`, or `conflict`s with the report:
 *   UNKNOWN, nothing written.
 *
 * Returns the store path written, relative to `root`.
 */
export function recordUntainted(
  sidecarPath: string,
  criterion: string,
  fresh: readonly QaCriterionEntry[],
  root: string,
): string {
  const key = attestationKeyForDerived(root, sidecarPath);
  if (key === undefined) {
    throw new Error(`${relative(root, sidecarPath)} names no block-qa or translation-qa subject under ${root}`);
  }
  const subjectAbs = join(root, key.subject);
  if (!existsSync(`${subjectAbs}.md`) && !existsSync(`${subjectAbs}.ts`)) {
    throw new Error(
      `no ${key.subject}.md or ${key.subject}.ts — an untainted verification cannot be filed ` +
        `against a subject that does not exist`,
    );
  }
  type Report = { criteria?: Record<string, QaCriterionEntry[]>; updated_at?: string; [k: string]: unknown };
  let prior: Report | undefined;
  let priorText: string | undefined;
  if (existsSync(sidecarPath)) {
    priorText = readFileSync(sidecarPath, "utf-8");
    try {
      prior = JSON.parse(priorText) as Report;
    } catch (e) {
      throw new Error(
        `${relative(root, sidecarPath)} does not parse (${e instanceof Error ? e.message : String(e)}) — ` +
          `fix it by hand first; nothing was written`,
      );
    }
  }
  const res = resolvePrior(root, key, prior);
  if (!res.ok) throw new Error(refusalLine("recordUntainted", key.subject, res));

  const criteria: Record<string, QaCriterionEntry[]> = {
    ...((res.prior?.criteria ?? composeCriteria({}, res.attestations)) as Record<string, QaCriterionEntry[]>),
  };
  criteria[criterion] = mergeUntainted(criteria[criterion], fresh);
  let finalised: Record<string, QaCriterionEntry[]>;
  try {
    finalised = finalizeCriteria(res, criteria, "attesting", {
      asciiEscape: priorText !== undefined && isAsciiEscaped(priorText),
    });
  } catch (err) {
    throw new Error(
      refusalLine("recordUntainted", key.subject, {
        state: "unknown",
        path: res.path,
        reason: err instanceof Error ? err.message : String(err),
      }),
    );
  }
  // The projection is refreshed only where it already exists: the derived
  // report is the sweep's to create, and its record lives on `qa-reports`.
  if (prior !== undefined) {
    prior.criteria = finalised;
    delete prior.updated_at;
    writeFileSync(sidecarPath, JSON.stringify(prior, null, 2) + "\n");
  }
  return relative(root, res.path);
}
