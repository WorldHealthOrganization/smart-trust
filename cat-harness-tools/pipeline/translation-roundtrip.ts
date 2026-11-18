/**
 * Record an AGENTIC semantic round trip as witnesses on a block's translation
 * sidecar.
 *
 * `translation-block-qa.ts` measures what a script can measure — coverage,
 * preserved terms, untranslated echoes — and declares
 * `translation-semantic-roundtrip` with no entry, because the only offline
 * back-translation is the PO read backwards, which returns the source exactly
 * and would score a perfect similarity on the lookup table rather than on the
 * translation. This module is how that criterion gets a real verdict.
 *
 * ## Two agents, and the separation between them IS the measurement
 *
 * | agent | sees | produces |
 * |---|---|---|
 * | back-translator | the TARGET-language text only | an independent rendering back into the source language |
 * | adjudicator | the ORIGINAL and the back-translation | pass / warn / fail, with the drifts named |
 *
 * Neither sees what would let it shortcut. A back-translator shown the English
 * original writes the original back and the check passes vacuously; an
 * adjudicator shown the French can talk itself into any reading of the
 * back-translation. Ask the back-translator to confirm it used no tools: an
 * agent with filesystem access can find the source in the repository, and then
 * the number measures its search rather than the translation.
 *
 * One agent doing both halves is NOT this check. It compares a text with its
 * own paraphrase of itself.
 *
 * ## Both agents are recorded, and only one of them rules
 *
 * The adjudicator's entry carries the verdict and leads the criterion, because
 * the first entry per criterion is the operative one everywhere in this repo.
 * The back-translator's entry sits behind it with `result: "n/a"` and the
 * back-translation itself in `notes`: it did not rule on anything, but a reader
 * asking "on what basis?" needs the intermediate text, and a reader asking "who
 * did this?" needs both names.
 *
 * ## What staleness means here, and why it is worth more than the verdict
 *
 * The entries hash the `.md`, the `.ts` and the `.po`. Edit the source and
 * every locale's round trip goes STALE; edit the translation and that locale's
 * does. So a verdict from a pair of agents cannot quietly outlive the text it
 * was about — which matters more for an agent ruling than for a script one,
 * because nobody can cheaply re-run it.
 *
 * Usage:
 *   bun run cat-harness-tools/pipeline/translation-roundtrip.ts --payload <file.json>
 *
 * The payload is {@link RoundTripPayload}. It is written by whatever ran the
 * agents — this module does not call a model itself, deliberately: the
 * recording must work the same whether the pair was two subagents, two
 * API calls, or two people.
 *
 * @module pipeline/translation-roundtrip
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { gitHeadTree, hashFile } from "./qa-utils.ts";
import { ADJUDICATOR_ACTOR, CHECKER_ACTOR, reviewAddress } from "./untainted-verification.ts";
import type {
  TranslationBlockQaReport,
  TranslationFieldHash,
  TranslationQaEntry,
} from "./translation-block-qa.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";

const INSTANCE_ROOT = join(HARNESS_ROOT);
const CRITERION = "translation-semantic-roundtrip";

/** Who ran, and under what. `model` is optional and absent means "not recorded". */
export interface RoundTripAgent {
  /** Stable name of the agent as a reviewer, e.g. "roundtrip-back-translator". */
  id: string;
  /** The skill or prompt that dispatched it. */
  skill?: string;
  /** Session identifier, so a reader can find the transcript. */
  session?: string;
  /** Model identifier, when the operator chooses to record one. */
  model?: string;
  /**
   * How the `model` above was established — recorded WITH it, never instead.
   *
   * A subagent's serving model is not directly observable from the session
   * that dispatched it: it inherits the parent unless the harness overrides,
   * and nothing in the hand-back reports which model actually served the turn.
   * So a bare model string on an agent witness is an inference presented as a
   * fact, which is the defect this whole family of sidecars exists to stop.
   * Recording the basis alongside keeps the claim as strong as its evidence
   * and no stronger.
   */
  modelSource?: string;
  /** ISO-8601; defaults to now. */
  date?: string;
}

export interface RoundTripPayload {
  /** Repo-relative path of the block's `.md`. */
  block: string;
  locale: string;
  backTranslation: string;
  backTranslator: RoundTripAgent;
  adjudicator: RoundTripAgent;
  verdict: "pass" | "warn" | "fail";
  severity?: "critical" | "major" | "minor";
  /** Each drift, in the adjudicator's words. Empty on a clean pass. */
  findings?: string[];
  /** How the adjudicator ruled, including what it declined to count as drift. */
  reasoning?: string;
  /** Anything the back-translator flagged as ambiguous. */
  uncertainties?: string[];
  /**
   * When the review ran, and the tree of the repo HEAD it ran against, if it
   * is being re-recorded (the tree, not the commit: bean 69lr; owner card Q4,
   * 2026-11-05).
   *
   * Both default to now / current HEAD. Passing them matters when provenance
   * is added to a verdict that already exists: the review happened when it
   * happened, against the tree as it then stood. Re-stamping either to record
   * a model identifier falsifies the two fields a reader uses to place the
   * verdict in time — and `reviewed_sha` fails loudly, naming a commit that
   * did not exist when the agents ruled. Caught exactly that way: a re-record
   * put the merge commit of a later PR on a 20:32 review.
   */
  reviewedAt?: string;
  reviewedTree?: string;
  /**
   * Legacy: the review's commit, for a caller that still names it so. Written
   * through as `reviewed_sha` with no tree stamped beside it — see
   * `reviewAddress` in `untainted-verification.ts` for why.
   */
  reviewedSha?: string;
}

function agentFields(a: RoundTripAgent) {
  return {
    agent_model: a.model,
    agent_session: a.session,
    agent_skill: a.skill,
    agent_date: a.date ?? new Date().toISOString(),
  };
}

/**
 * Metrics an entry carries about HOW it was produced.
 *
 * `model_source` rides here rather than in `notes`, which hold the
 * adjudicator's reasoning in its own voice; the panel renders metrics as
 * labelled rows, so the basis shows up next to the model rather than buried in
 * a paragraph.
 */
function provenanceMetrics(
  a: RoundTripAgent,
  extra: Record<string, string> = {},
): Record<string, string> | undefined {
  const m: Record<string, string> = { ...extra };
  if (a.modelSource) m.model_source = a.modelSource;
  return Object.keys(m).length > 0 ? m : undefined;
}

/** Build the two entries a round trip contributes, adjudicator first. */
export function roundTripEntries(
  payload: RoundTripPayload,
  fieldHash: TranslationFieldHash,
): TranslationQaEntry[] {
  // A caller re-recording an earlier review keeps its date; otherwise none is
  // stamped (owner rulings 2026-11-06, "QA dates" / "Date source"): the date
  // is derived on read from reviewed_tree.
  const at = payload.reviewedAt;
  const address = reviewAddress(
    { reviewed_tree: payload.reviewedTree, reviewed_sha: payload.reviewedSha },
    gitHeadTree(INSTANCE_ROOT),
  );
  const findings = payload.findings?.filter((f) => f.trim() && f.trim().toLowerCase() !== "none");

  const verdict: TranslationQaEntry = {
    field_hash: fieldHash,
    result: payload.verdict,
    severity: payload.verdict === "pass" ? undefined : (payload.severity ?? "minor"),
    evidence: findings && findings.length > 0 ? findings.map((t) => ({ text: t })) : undefined,
    reviewer: {
      kind: "agent",
      id: payload.adjudicator.id,
      actor: ADJUDICATOR_ACTOR,
      ...agentFields(payload.adjudicator),
    },
    ...(at ? { reviewed_at: at } : {}),
    ...address,
    metrics: provenanceMetrics(payload.adjudicator, { role: "adjudicator" }),
    notes: payload.reasoning,
  };

  const backTranslation: TranslationQaEntry = {
    field_hash: fieldHash,
    // It measured nothing and must not read as a verdict. What it contributes
    // is the intermediate text the adjudicator ruled on.
    result: "n/a",
    reviewer: {
      kind: "agent",
      id: payload.backTranslator.id,
      actor: CHECKER_ACTOR,
      ...agentFields(payload.backTranslator),
    },
    ...(at ? { reviewed_at: at } : {}),
    ...address,
    metrics: provenanceMetrics(payload.backTranslator, {
      // `role` is what `isCheckerWitness` reads. Without it this entry — which
      // rules on nothing — reads as `untainted-checker` emitting a verdict and
      // fails the permission gate built to protect exactly this separation.
      role: "checker",
      method: "independent agentic back-translation",
    }),
    notes:
      `Back-translation: ${payload.backTranslation}` +
      (payload.uncertainties && payload.uncertainties.length > 0
        ? `\n\nFlagged as ambiguous while rendering: ${payload.uncertainties.join(" · ")}`
        : ""),
  };

  return [verdict, backTranslation];
}

/**
 * Write the round trip into the block's sidecar for that locale.
 *
 * Refuses when the sidecar does not exist. The script sweep establishes what
 * the block and its PO are; a round-trip recorder that invents a sidecar could
 * record a verdict for a locale nothing has ever been translated into.
 */
export function recordRoundTrip(payload: RoundTripPayload): string {
  const mdAbs = join(INSTANCE_ROOT, payload.block);
  const sidecar = mdAbs.replace(/\.md$/, `.${payload.locale}.translation-qa.json`);
  if (!existsSync(sidecar)) {
    throw new Error(
      `no ${relative(INSTANCE_ROOT, sidecar)} — run translation-block-qa.ts first; ` +
        `a round trip cannot be the thing that decides this block is translated`,
    );
  }
  const doc = JSON.parse(readFileSync(sidecar, "utf-8")) as TranslationBlockQaReport;
  const tsAbs = mdAbs.replace(/\.md$/, ".ts");
  const fieldHash: TranslationFieldHash = {
    md: hashFile(mdAbs),
    ts: existsSync(tsAbs) ? hashFile(tsAbs) : undefined,
    po: hashFile(join(INSTANCE_ROOT, doc.po)),
  };

  const fresh = roundTripEntries(payload, fieldHash);
  const kept = (doc.criteria[CRITERION] ?? []).filter((e) => e.reviewer?.kind !== "agent");
  // Agent entries are REPLACED, not appended: a re-run is a re-measurement of
  // the same pair on the same text, and stacking them would make the criterion
  // a log of every time someone re-ran it. A human ruling, if one is ever
  // recorded here, is kept — it is not this process's to supersede.
  doc.criteria[CRITERION] = [...fresh, ...kept];
  delete doc.updated_at;
  writeFileSync(sidecar, JSON.stringify(doc, null, 2) + "\n");
  return relative(INSTANCE_ROOT, sidecar);
}

if (import.meta.main) {
  const i = process.argv.indexOf("--payload");
  const file = i !== -1 ? process.argv[i + 1] : undefined;
  if (!file) {
    console.error("usage: translation-roundtrip.ts --payload <file.json>");
    process.exit(2);
  }
  const payload = JSON.parse(readFileSync(file, "utf-8")) as RoundTripPayload;
  const written = recordRoundTrip(payload);
  console.log(`  ✓ ${written} — ${CRITERION}: ${payload.verdict}`);
}
