#!/usr/bin/env bun
/**
 * Skills reviewed against the voices that judge skills — the agentic review
 * axis.
 *
 * @module scripts/skill-voice-review
 *
 * There is **no formal gate on rule content**: an agent (or a person) judges a
 * skill rule by rule, with the citation open, and records the verdicts here.
 * This module decides the question underneath, the one
 * `prose-code-pairs.ts` asks of prose and code: **is there a review, and is it
 * still about the skill and the voice as they are now?**
 *
 * ## Which voices
 *
 * The ACTIVE voices (`readActiveVoices`, the harness config's `voice.active`)
 * that carry at least one rule scoped to the `skill` artefact kind
 * (`appliesTo: ["skill"]`, read per rule through `scopeOf`, since an inherited
 * rule keeps the scope it was declared under). Activation is the only switch.
 * Three states, as `readActiveVoices` documents: nothing active is `n/a`, and
 * an unreadable config is `unknown`, never a skip.
 *
 * ## Where a review lives
 *
 * In the attestation store (`schemas/sdlc/qa-attestations.ts`), as `voice_reviews`
 * in the skill's `test/attestations/kg-qa/…attestations.json`, beside its
 * `pair_attestations` — a review is a judgement, kept on main, not a derived
 * sidecar. Each review pins the skill's content hash and the hash of the
 * voice's skill-scoped rules, so either moving makes it stale.
 *
 * ## What fails
 *
 * `skill-voice-review-current` is `minor` and so gated by nothing
 * (`kg:audit:check` fails on critical, `:strict` on major). It fails when an
 * active skill voice has no review, or its review is stale. A rule the
 * reviewer marked `fail` is recorded, printed and NOT a finding.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { loadVoices, readActiveVoices, resolveVoice, voiceKey, type ResolvedVoice, type VoiceProfile, type VoiceRef } from "../schemas/content/voices.ts";
import { layerRootsIn, readDeclaration } from "../schemas/kg/cat-harness.ts";
import type { KgCriterionEntry, KgFinding, KgQaReport } from "../schemas/sdlc/kg-qa.ts";
import {
  kgAttestationFor,
  priorKgJudgements,
  QA_ATTESTATIONS_SCHEMA,
  readAttestationFile,
  serialiseAttestations,
  type KgAttestations,
} from "../schemas/sdlc/qa-attestations.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

export const VOICE_REVIEW_CRITERION = "skill-voice-review-current";

/** The artefact kind a rule must be scoped to for this axis to review it. */
export const SKILL_TARGET = "skill";

export const VOICE_REVIEW_RESULTS = ["pass", "fail", "n/a"] as const;
export type VoiceReviewResult = (typeof VOICE_REVIEW_RESULTS)[number];

export interface VoiceRuleVerdict {
  rule: string;
  result: VoiceReviewResult;
  /** Required on `fail` and `n/a`: a verdict nobody can check is not a review. */
  note?: string;
}

export interface VoiceReview {
  voice: string;
  instance: string;
  skill_hash: string;
  voice_hash: string;
  by: "agent" | "human";
  at: string;
  verdicts: VoiceRuleVerdict[];
}

/** A voice this axis reviews skills against, reduced to its skill-scoped rules. */
export interface SkillVoice {
  id: string;
  instance: string;
  rules: ResolvedVoice["rules"];
  hash: string;
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** A file's content hash, or `undefined` when it is not there to hash. */
export function fileHash(abs: string): string | undefined {
  return existsSync(abs) ? sha256(readFileSync(abs, "utf-8")) : undefined;
}

/**
 * The active voices whose rules judge skills. `undefined` when the harness
 * config could not be read, which the criterion reports as `unknown`.
 */
export function skillVoices(
  repoRoot: string,
  // An option OBJECT, tested with `in`, rather than a default parameter:
  // JavaScript applies a default to an explicit `undefined` as well, and
  // `undefined` ("the config could not be read") is a real answer here.
  opts: { active?: string[] | undefined } = {},
): SkillVoice[] | undefined {
  // In an index checkout the root declares no layer, and the checkout's
  // skill-authoring voice activation lives on `cat-harness`'s entry in
  // `index.config.json` (moved from the retired root config on 2026-10-09;
  // see `voice-gate-checkout.test.ts`).
  const active = "active" in opts ? opts.active : (readActiveVoices(repoRoot) ?? readActiveVoices(HARNESS_ROOT));
  if (active === undefined) return undefined;
  if (active.length === 0) return [];

  const shipped = new Map<string, { instance: string; voice: VoiceProfile }>();
  for (const root of layerRootsIn(repoRoot)) {
    const name = readDeclaration(root)?.name;
    if (name === undefined) continue;
    for (const voice of loadVoices(root)) shipped.set(voiceKey(name, voice.id), { instance: name, voice });
  }
  const byId = (id: string) => [...shipped.values()].filter((s) => s.voice.id === id);
  const lookup = (ref: VoiceRef, citing: string) =>
    shipped.get(voiceKey(ref.instance ?? citing, ref.voiceId)) ?? byId(ref.voiceId)[0];

  const out: SkillVoice[] = [];
  for (const id of active) {
    const start = byId(id)[0];
    if (!start) continue; // `activeVoices` owns "activated but not shipped", and throws there
    const r = resolveVoice(start, lookup);
    if (!r.ok) continue; // `check:voices` owns an unresolvable chain
    const rules = r.voice.rules.filter((rule) => r.voice.scopeOf.get(rule.id)?.appliesTo?.includes(SKILL_TARGET));
    if (rules.length === 0) continue;
    out.push({ id, instance: start.instance, rules, hash: sha256(JSON.stringify(rules)) });
  }
  return out;
}

/**
 * The recorded reviews, in the states of `readAttestationFile`. As with
 * `readAttestations` in `prose-code-pairs.ts`, a `corrupt` or `unknown` read
 * carries NO list: it used to answer `[]`, which reads as "never reviewed"
 * (the `de9k` leftover). On `miss` or `absent` the list is what a PRIOR
 * sidecar still carries, which `kg-audit` moves into the store as it saves
 * (owner ruling 2, 2026-10-01).
 */
export type VoiceReviewsRead =
  | { state: "hit"; reviews: VoiceReview[] }
  | { state: "miss" | "absent"; reviews: VoiceReview[]; moved: number }
  | { state: "corrupt" | "unknown"; reason: string };

/** Reviews recorded for one skill: the store file's, or — when it has none — the prior sidecar's. */
export function readVoiceReviews(storeFile: string, storeRoot: string, priorSidecar?: string): VoiceReviewsRead {
  const r = readAttestationFile(storeFile, storeRoot);
  if (r.state === "hit") return { state: "hit", reviews: ((r.file as KgAttestations).voice_reviews ?? []) as VoiceReview[] };
  if (r.state === "miss" || r.state === "absent") {
    const prior = priorKgJudgements(priorSidecar);
    if (prior.state === "unknown") return { state: "unknown", reason: prior.reason };
    const list = prior.state === "found" ? (prior.voice_reviews as VoiceReview[]) : [];
    return { state: r.state, reviews: list, moved: list.length };
  }
  return { state: r.state, reason: r.reason };
}

/**
 * {@link evaluateVoiceReviews} over a read that may not have answered: a
 * `corrupt` or `unknown` store is an `unknown` criterion and `reviews` is
 * `undefined`, so the caller writes nothing back.
 */
export function evaluateVoiceReviewsFrom(
  skillAbs: string,
  read: VoiceReviewsRead,
  voices: SkillVoice[] | undefined,
): { entry: KgCriterionEntry; reviews: VoiceReview[] | undefined } {
  if (voices !== undefined && voices.length === 0) return { entry: { result: "n/a", findings: [] }, reviews: "reviews" in read ? read.reviews : undefined };
  if (!("reviews" in read)) {
    return {
      entry: { result: "unknown", findings: [{ where: "attestations", detail: `recorded voice reviews are ${read.state}: ${read.reason}` }] },
      reviews: undefined,
    };
  }
  return evaluateVoiceReviews(skillAbs, read.reviews, voices);
}

/**
 * Judge one skill's reviews against the voices in force. The reviews are
 * returned unchanged: a stale review is evidence of what was once checked, and
 * only a new review replaces it.
 */
export function evaluateVoiceReviews(
  skillAbs: string,
  reviews: VoiceReview[],
  voices: SkillVoice[] | undefined,
): { entry: KgCriterionEntry; reviews: VoiceReview[] } {
  if (voices === undefined) {
    return {
      entry: { result: "unknown", findings: [{ where: "voice.active", detail: "the harness config could not be read, so which voices judge skills is undetermined" }] },
      reviews,
    };
  }
  if (voices.length === 0) return { entry: { result: "n/a", findings: [] }, reviews };
  const skillHash = fileHash(skillAbs);
  if (skillHash === undefined) {
    return { entry: { result: "unknown", findings: [{ where: skillAbs, detail: "the skill file is not there to hash" }] }, reviews };
  }
  const findings: KgFinding[] = [];
  for (const v of voices) {
    const r = reviews.find((x) => x.voice === v.id);
    if (!r) {
      findings.push({ where: v.id, detail: `never reviewed against the ${v.id} voice (${v.rules.length} skill rule(s)) — \`bun run cat voice:review\`` });
    } else if (r.skill_hash !== skillHash) {
      findings.push({ where: v.id, detail: `the skill changed since its ${v.id} review (${r.at}, by ${r.by}); re-review it` });
    } else if (r.voice_hash !== v.hash) {
      findings.push({ where: v.id, detail: `the ${v.id} voice's skill rules changed since this skill was reviewed (${r.at}); re-review it` });
    }
  }
  return { entry: { result: findings.length ? "fail" : "pass", findings }, reviews };
}

/**
 * Check a proposed set of verdicts against the voice: exactly one per
 * skill-scoped rule, and a note wherever the verdict is not a plain pass.
 * Returns the problems; empty means it can be recorded.
 */
export function verdictProblems(voice: SkillVoice, verdicts: VoiceRuleVerdict[]): string[] {
  const problems: string[] = [];
  const want = new Set(voice.rules.map((r) => r.id));
  const seen = new Set<string>();
  for (const v of verdicts) {
    if (!want.has(v.rule)) problems.push(`${v.rule}: not a skill rule of ${voice.id}`);
    if (seen.has(v.rule)) problems.push(`${v.rule}: judged twice`);
    seen.add(v.rule);
    if (!(VOICE_REVIEW_RESULTS as readonly string[]).includes(v.result)) problems.push(`${v.rule}: result must be one of ${VOICE_REVIEW_RESULTS.join(", ")}`);
    if (v.result !== "pass" && !v.note?.trim()) problems.push(`${v.rule}: a ${v.result} verdict needs a note saying why`);
  }
  for (const id of want) if (!seen.has(id)) problems.push(`${id}: no verdict`);
  return problems;
}

/**
 * Record a review in the store, replacing any earlier one for the same voice.
 *
 * A missing file is created for `subject`; a corrupt or unreadable one is
 * REFUSED rather than overwritten, since it may hold reviews nobody has read.
 */
export function recordReview(
  storeFile: string,
  storeRoot: string,
  subject: KgAttestations["subject"],
  review: VoiceReview,
  priorSidecar?: string,
): void {
  const r = readAttestationFile(storeFile, storeRoot);
  let json: KgAttestations;
  if (r.state === "hit") json = r.file as KgAttestations;
  else if (r.state === "miss" || r.state === "absent") {
    // No store entry for this skill (or no store yet): a NEW file, seeded with
    // whatever judgements the prior sidecar still carries, so this first save
    // moves them too (owner ruling 2) rather than writing a file that would
    // hide them from every later read.
    json = { $schema: QA_ATTESTATIONS_SCHEMA, family: "kg-qa", subject };
    const prior = priorKgJudgements(priorSidecar);
    if (prior.state === "unknown") throw new Error(`cannot record a review in ${storeFile}: ${prior.reason}`);
    if (prior.state === "found") {
      if (prior.pair_attestations.length) json.pair_attestations = prior.pair_attestations as KgAttestations["pair_attestations"];
      if (prior.voice_reviews.length) json.voice_reviews = prior.voice_reviews as KgAttestations["voice_reviews"];
    }
  } else throw new Error(`cannot record a review in ${storeFile}: ${r.state} (${r.reason})`);
  json.voice_reviews = [...(json.voice_reviews ?? []).filter((x) => x.voice !== review.voice), review].sort((a, b) =>
    a.voice.localeCompare(b.voice),
  );
  mkdirSync(dirname(storeFile), { recursive: true });
  writeFileSync(storeFile, serialiseAttestations(json));
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const opt = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const usage =
    "usage: bun run cat voice:review -- --sidecar <skill's kg-qa sidecar> --voice <id> --by agent|human --verdicts <file.json>\n" +
    "       bun run cat voice:review -- --rules <voice id>     (print the rules to judge, with their citations)\n" +
    "verdicts: [{ \"rule\": \"<id>\", \"result\": \"pass\"|\"fail\"|\"n/a\", \"note\": \"…\" }] — one per rule; a note on every fail and n/a.";
  const repoRoot = resolve(dirname(HARNESS_ROOT));
  const voices = skillVoices(repoRoot);
  if (voices === undefined) {
    console.error("the harness config could not be read, so which voices judge skills is undetermined");
    process.exit(2);
  }

  const rulesOf = opt("--rules");
  if (rulesOf !== undefined) {
    const v = voices.find((x) => x.id === rulesOf);
    if (!v) {
      console.error(`${rulesOf} is not an active voice with skill rules. Active: ${voices.map((x) => x.id).join(", ") || "(none)"}`);
      process.exit(2);
    }
    for (const r of v.rules) console.log(`${r.id} [${r.severity}] ${r.title}\n  ${r.description}\n  source: ${JSON.stringify(r.source)}\n`);
    process.exit(0);
  }

  const sidecar = opt("--sidecar");
  const voiceId = opt("--voice");
  const by = opt("--by");
  const verdictsFile = opt("--verdicts");
  if (!sidecar || !voiceId || (by !== "agent" && by !== "human") || !verdictsFile) {
    console.error(usage);
    process.exit(2);
  }
  const abs = resolve(process.cwd(), sidecar);
  if (!existsSync(abs)) {
    console.error(`no sidecar at ${sidecar}`);
    process.exit(2);
  }
  const report = JSON.parse(readFileSync(abs, "utf-8")) as KgQaReport;
  const where = kgAttestationFor(abs, repoRoot, resolve(HARNESS_ROOT));
  if (where === undefined) {
    console.error(`${sidecar} is under no instance's kg-qa tree`);
    process.exit(2);
  }
  if (report.subject.kind !== "skill" || !report.subject.path) {
    console.error(`${sidecar} is not a skill's sidecar`);
    process.exit(2);
  }
  const v = voices.find((x) => x.id === voiceId);
  if (!v) {
    console.error(`${voiceId} is not an active voice with skill rules. Active: ${voices.map((x) => x.id).join(", ") || "(none)"}`);
    process.exit(2);
  }
  const verdicts = JSON.parse(readFileSync(resolve(process.cwd(), verdictsFile), "utf-8")) as VoiceRuleVerdict[];
  const problems = verdictProblems(v, verdicts);
  if (problems.length > 0) {
    for (const p of problems) console.error(`✗ ${p}`);
    process.exit(1);
  }
  // The sidecar mirrors the subject's path under the layer's results tree;
  // the subject path is relative to that layer root.
  const instanceRoot = resolve(abs.slice(0, abs.lastIndexOf("/test/results/kg-qa/")));
  const skillHash = fileHash(resolve(instanceRoot, report.subject.path));
  if (!skillHash) {
    console.error(`the skill ${report.subject.path} is not there to hash`);
    process.exit(2);
  }
  recordReview(where.file, where.storeRoot, report.subject, {
    voice: v.id,
    instance: v.instance,
    skill_hash: skillHash,
    voice_hash: v.hash,
    by,
    at: new Date().toISOString(),
    verdicts: [...verdicts].sort((a, b) => a.rule.localeCompare(b.rule)),
  }, abs);
  const failed = verdicts.filter((x) => x.result === "fail");
  console.log(
    `recorded ${verdicts.length} verdict(s) for ${report.subject.path} against ${v.id}` +
      (failed.length ? ` — ${failed.length} rule(s) judged fail, recorded and not gated` : "") +
      ` in ${relative(repoRoot, where.file)} — now run \`bun run cat kg:audit\``,
  );
}
