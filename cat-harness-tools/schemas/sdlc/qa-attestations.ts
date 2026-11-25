/**
 * QA ATTESTATIONS — the judgement half of a QA verdict, kept on `main` where a
 * `git rm` of derived results cannot reach it.
 *
 * Every non-script verdict stays on main; derived script verdicts live on the
 * `qa-reports` branch. `baseline` pair attestations count as judgements,
 * because a regenerated baseline forgets the drift it recorded. Split by
 * provenance, the derived half can be deleted without touching the
 * judgements.
 *
 * ## Layout — ONE convention for every QA family
 *
 * ```
 * <instance>/test/attestations/            the declared `attestations` directory
 * └── <family>/<mirrored subject path>/<stem>.attestations.json
 * ```
 *
 * `<family>` is the derived family the judgements sit beside — `kg-qa`,
 * `block-qa` or `translation-qa` — and the mirror below it is EXACTLY the one
 * that family's derived tree uses, so the attestation for a subject is found
 * by swapping the tree root and the suffix. A hosted layer (one with no
 * `attestations` directory of its own, audited from a host) lives under
 * `<host>/test/attestations/<stub>/`, the same three answers
 * {@link attestationsHomeFor} shares with `kgQaHomeFor`.
 *
 * ## The envelope — `qa-attestations/v1`
 *
 * ```json
 * { "$schema": "qa-attestations/v1",
 *   "family": "kg-qa",
 *   "subject": { "kind": "skill", "id": "…", "path": "…" },
 *   "pair_attestations": [ … ],      // kg-qa
 *   "voice_reviews": [ … ] }         // kg-qa
 * ```
 *
 * A family adds its own judgement arrays; the envelope (`$schema`, `family`,
 * `subject`) is shared. Each judgement is keyed by the subject plus what it
 * attests and the HASH it attested, so a stale one is detectable by
 * recomputing the hash: a pair attestation carries `prose_hash` and
 * `code_hash`, a voice review `skill_hash` and `voice_hash`.
 *
 * Entries are stored byte-for-byte as their writer produced them (same keys,
 * same order); `scripts/migrate-qa-attestations.ts` verifies that against the corpus.
 *
 * ## Five read states
 *
 * {@link readAttestationFile} answers `hit` / `miss` / `absent` / `corrupt` /
 * `unknown`, the vocabulary `scripts/qa-store.ts` uses plus `absent`:
 *
 * - `miss` — the store is there and this subject has no file. A hosted
 *   layer's subtree that does not exist yet is a `miss` too.
 * - `absent` — the store directory itself is not there: a folio that has never
 *   had one.
 * - `unknown` — the store path is there and could not be read.
 * - `corrupt` — the file is there and does not parse or validate. Never `[]`,
 *   and never overwritten: the next writer refuses it.
 *
 * ## Auto-move on first save
 *
 * On `miss` or `absent`, a WRITER looks at the prior derived file before it
 * treats the subject as first sight. Judgements still inside that file are
 * MOVED into the store as it saves. The store file is written before the
 * derived one, and on `kg-qa` the derived sidecar it then writes carries no
 * judgement.
 *
 * What still refuses (writes nothing, exits non-zero): `corrupt` and
 * `unknown`, and a prior derived file that cannot be parsed while the store
 * has no entry. On a `hit` the store is the source: the prior derived file is
 * never read for judgements. If a store and a prior derived file are BOTH
 * gone, nothing can say a judgement existed; the store is committed on main,
 * so its deletion is a diff a reviewer sees.
 *
 * ## `block-qa` and `translation-qa`
 *
 * Their judgements are `criteria` entries whose `reviewer.kind` is not
 * `script` — an agent's adjudication or a human ruling. Their member of the
 * union carries a `criteria` map with the derived report's own shape and
 * ONLY those entries ({@link CriteriaAttestationsSchema} refuses a script
 * one), so an entry moves between the two files without being rewritten. The
 * subject is `{kind: "block", id, path}` with `id` and `path` both the
 * instance-relative subject root (the `.ts`/`.md` stem the derived mirror is
 * built from); `translation-qa` adds `locale`.
 *
 * Unlike `kg-qa`, a derived block or translation report still carries a
 * PROJECTION of its judgements, because readers (and the published site)
 * take `criteria[id][0]` as the operative verdict. A writer composes that
 * projection from the store ({@link resolvePrior}, {@link finalizeCriteria});
 * it is never the source once the store holds the subject.
 *
 * @module schemas/qa-attestations
 * @graphNode schema
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { z } from "zod";

import { SignOffSchema } from "@litlfred/bootstrap-tools/schemas/requirement-set.ts";

import { AdversarialReviewSchema } from "./red-flag";
import { nodeKind } from "../kg/node-kind.ts";

import {
  artefactStub,
  defaultGraphTypologies,
  layerRootsIn,
  kgQaHomeFor,
  readDeclaration,
  resolveDirectories,
  type GraphTypologyRegistry,
} from "../kg/cat-harness";

/** The `$schema` tag every attestation file carries. */
export const QA_ATTESTATIONS_SCHEMA = "qa-attestations/v1" as const;

/** The graph typology (and the declared directory id) that holds them. */
export const ATTESTATIONS_GRAPH_TYPOLOGY = "attestations" as const;

/** The file suffix, one place. */
export const ATTESTATIONS_SUFFIX = ".attestations.json";

/**
 * The derived families a judgement may sit beside. `kg-qa` is this bean's;
 * the other two are named so bean `8wj1` extends one list rather than adding
 * a second.
 */
export const ATTESTATION_FAMILIES = [
  "kg-qa",
  "block-qa",
  "translation-qa",
  "bib-verification",
  "bib-human-review",
  "requirement-signoff",
  "certification",
  "section-title",
  "adversarial-review",
] as const;
export type AttestationFamily = (typeof ATTESTATION_FAMILIES)[number];

/** One declared prose ↔ code pair's accepted state. Paths are repo-relative. */
export const PairAttestationSchema = z.object({
  kind: z.enum(["implements", "co-located"]),
  prose: z.string().min(1),
  code: z.string().min(1),
  prose_hash: z.string().min(1),
  code_hash: z.string().min(1),
  /** `baseline` counts as a judgement (owner, 2026-10-01): it records the state the drift is measured from. */
  by: z.enum(["baseline", "agent", "human"]),
  reason: z.string().min(1).optional(),
});
export type PairAttestationEntry = z.infer<typeof PairAttestationSchema>;

/** One review of a skill against one voice. Hashes pin what was reviewed. */
export const VoiceReviewSchema = z.object({
  voice: z.string().min(1),
  instance: z.string().min(1),
  skill_hash: z.string().min(1),
  voice_hash: z.string().min(1),
  by: z.enum(["agent", "human"]),
  at: z.string().min(1),
  verdicts: z.array(
    z.object({
      rule: z.string().min(1),
      result: z.enum(["pass", "fail", "n/a"]),
      note: z.string().min(1).optional(),
    }),
  ),
});
export type VoiceReviewEntry = z.infer<typeof VoiceReviewSchema>;

/** The subject, exactly as the derived report beside it names it. */
export const AttestationSubjectSchema = z.object({
  kind: z.string().min(1),
  id: z.string().min(1),
  path: z.string().nullable(),
});

/** The envelope every family shares. A family's own arrays are added by `.extend`. */
export const QaAttestationsBaseSchema = z.object({
  $schema: z.literal(QA_ATTESTATIONS_SCHEMA),
  family: z.enum(ATTESTATION_FAMILIES),
  subject: AttestationSubjectSchema,
});

/**
 * The NODE KIND of an attestation file (owner, 2026-11-13, node-kind audit:
 * every listed node kind gets per-node pages, no waivers). Built from the
 * envelope every family shares, so each family's file is one node of it: the
 * family's own judgement arrays are extra keys the kind does not refuse, and
 * the family's strict schema stays what a writer is held to. With a kind, the
 * `attestations` typology names `qa-attestations/v1` in its `nodeSchemas`, its
 * nodes get a page each (`gen-node-kind-pages`), and it leaves cat-harness's
 * `node-kinds.baseline.json`.
 */
export const QaAttestationsKind = nodeKind(
  // Unversioned, as `qa-script` is: the files carry `qa-attestations/v1`, the
  // family its validator node names, which is how their nodes are found.
  "qa-attestations",
  [],
  { family: z.enum(ATTESTATION_FAMILIES), subject: AttestationSubjectSchema },
  {
    summary:
      "One subject's QA judgements — pair attestations, voice reviews, agent and human verdicts, bibliography " +
      "verifications — kept on main, each pinned to the hash it attested.",
  },
);

/** The `kg-qa` family: pair attestations and voice reviews. */
export const KgAttestationsSchema = QaAttestationsBaseSchema.extend({
  family: z.literal("kg-qa"),
  pair_attestations: z.array(PairAttestationSchema).optional(),
  voice_reviews: z.array(VoiceReviewSchema).optional(),
}).strict();
export type KgAttestations = z.infer<typeof KgAttestationsSchema>;

/**
 * Is this criterion entry a judgement? Anything that is not recognisably a
 * script entry — including a malformed one with no reviewer — counts as one:
 * that is `preserveNonScriptEntries`' rule in `qa-utils.ts`, for its reason
 * (dropping a malformed human entry would break "human always preserved").
 */
export function isAttestation(e: unknown): boolean {
  return (e as { reviewer?: { kind?: unknown } | null } | null)?.reviewer?.kind !== "script";
}

/** One block or translation judgement, kept opaque: the store never rewrites an entry. */
export const AttestedEntrySchema = z
  .record(z.string(), z.unknown())
  .refine(isAttestation, { message: "a script entry is derived: the attestation store holds judgements only" });

/** Criterion id → its judgements, the derived report's own `criteria` shape. */
export const CriteriaAttestationsSchema = z.record(z.string(), z.array(AttestedEntrySchema));

/** The `block-qa` family (bean `8wj1`): a block's agent and human verdicts. */
export const BlockAttestationsSchema = QaAttestationsBaseSchema.extend({
  family: z.literal("block-qa"),
  criteria: CriteriaAttestationsSchema,
}).strict();

/** The `translation-qa` family (bean `8wj1`): one (subject, locale) pair's agent and human verdicts. */
export const TranslationAttestationsSchema = QaAttestationsBaseSchema.extend({
  family: z.literal("translation-qa"),
  locale: z.string().min(1),
  criteria: CriteriaAttestationsSchema,
}).strict();

/**
 * ## The bibliography families: `bib-verification` and `bib-human-review` (C9 stories B3, B4)
 *
 * The two bibliography judgement ledgers a folio used to keep as single
 * files beside its bibliography — `<folio>/bib-qa-verifications.json` (the
 * source ledger: was each reference checked against a source, and is the
 * source relevant) and `<folio>/schema/references.review.json` (the HUMAN
 * review of a reference, pinned to the hash of its entry). Both are
 * judgements, so both are `attestations`. One file per subject:
 *
 * ```
 * <attestations>/bib-verification/reference/<ref id>.attestations.json
 * <attestations>/bib-verification/source/<repo-relative file>.attestations.json   (a row with `id: null`)
 * <attestations>/bib-verification/source/external/<sha256(url)[:16]>.attestations.json
 * <attestations>/bib-human-review/reference/<ref id>.attestations.json
 * ```
 *
 * Each record wraps the ledger row VERBATIM (`entry` / `review`, same keys,
 * same order) with the one fact a per-subject split would otherwise lose: its
 * `position` in the assembled ledger, so the reader reproduces the ledger's
 * order exactly — readers key by id and the last duplicate wins, so order is
 * load-bearing. A verification row with no `verified_by` is carried with
 * `verifier: "unknown"`, and the schema refuses the combination either way: a
 * row cannot be both unattributed and marked attributed, and the store never
 * guesses an agent or a human for one. Reading and writing — with the legacy
 * fallback — is `schemas/library/bib-attestations.ts`; nothing else opens these files.
 */
export const BIB_REVIEW_STATUSES = ["unreviewed", "source-in-repo", "issue-open", "photo-uploaded", "validated"] as const;

/** One source-ledger row, opaque but for the three fields every reader keys on. */
export const BibLedgerRowSchema = z
  .record(z.string(), z.unknown())
  .refine((e) => typeof e["id"] === "string" || e["id"] === null, { message: "`id` must be a string or null" })
  .refine((e) => typeof e["status"] === "string", { message: "`status` must be a string" })
  .refine((e) => typeof (e["source"] as { kind?: unknown } | undefined)?.kind === "string", { message: "`source.kind` must be a string" });

/** `true` when a ledger row names no verifier — the ~101 rows that must stay `unknown`. */
export function bibRowVerifierUnknown(e: Record<string, unknown>): boolean {
  return e["verified_by"] === undefined || e["verified_by"] === null;
}

export const BibVerificationRecordSchema = z
  .object({
    position: z.number().int().nonnegative(),
    verifier: z.literal("unknown").optional(),
    entry: BibLedgerRowSchema,
  })
  .strict()
  .refine((r) => (r.verifier === "unknown") === bibRowVerifierUnknown(r.entry), {
    message: "`verifier: \"unknown\"` is required exactly when the row carries no `verified_by` — never attributed, never dropped",
  });

/** The `bib-verification` family: one reference's (or one orphan source's) ledger rows. */
export const BibVerificationAttestationsSchema = QaAttestationsBaseSchema.extend({
  family: z.literal("bib-verification"),
  verifications: z.array(BibVerificationRecordSchema),
}).strict();
export type BibVerificationAttestations = z.infer<typeof BibVerificationAttestationsSchema>;

/** One human review, opaque but for its status. */
export const BibReviewSchema = z
  .record(z.string(), z.unknown())
  .refine((e) => (BIB_REVIEW_STATUSES as readonly unknown[]).includes(e["status"]), {
    message: `\`status\` must be one of ${BIB_REVIEW_STATUSES.join(", ")}`,
  });

export const BibReviewRecordSchema = z
  .object({ position: z.number().int().nonnegative(), review: BibReviewSchema })
  .strict();

/** The `bib-human-review` family: at most one review per reference; `[]` records a retraction. */
export const BibHumanReviewAttestationsSchema = QaAttestationsBaseSchema.extend({
  family: z.literal("bib-human-review"),
  reviews: z.array(BibReviewRecordSchema).max(1),
}).strict();
export type BibHumanReviewAttestations = z.infer<typeof BibHumanReviewAttestationsSchema>;

/**
 * ## The `requirement-signoff` family (issue #2405, FR-011)
 *
 * A sign-off on a requirements document IS an adjudication record: who
 * decided (`kind`, `id`, `actor` — {@link QaReviewer}'s identity fields, and
 * the same three `kind`s), when (`at`), about what (`scope`: the set, or one
 * member), the outcome from the requirement-set code list, the stage it moves
 * the set to, the reason, and a permalink to where it was decided. It is a
 * judgement no writer can regenerate, so it lives here, on `main`, in the
 * `attestations` graph — one file per set:
 *
 * ```
 * <attestations>/requirement-signoff/<set slug>.attestations.json
 * ```
 *
 * The record's shape is the bootstrap base's `SignOffSchema` — imported
 * DOWNWARD, never restated — so a set that carries its sign-offs inline (a
 * set in a repository with no attestations graph) and one whose sign-offs are
 * kept here are judged by one function, `requirementSetProblems`, over the
 * union. Append-only: a later decision is a new record, never an edit.
 */
export const REQUIREMENT_SIGNOFF_FAMILY = "requirement-signoff" as const;

export const RequirementSignoffAttestationsSchema = QaAttestationsBaseSchema.extend({
  family: z.literal(REQUIREMENT_SIGNOFF_FAMILY),
  signoffs: z.array(SignOffSchema).min(1),
}).strict();
export type RequirementSignoffAttestations = z.infer<typeof RequirementSignoffAttestationsSchema>;

/** The store file for one requirement set's sign-offs. */
export function requirementSignoffPath(attestationsHome: string, setId: string): string {
  const slug = setId.replace(/^reqset:/, "");
  return join(attestationsHome, REQUIREMENT_SIGNOFF_FAMILY, `${slug}${ATTESTATIONS_SUFFIX}`);
}

/** The base schema every family extends. */
export const BaseAttestationsSchema = QaAttestationsBaseSchema;
export type BaseAttestations = z.infer<typeof BaseAttestationsSchema>;

/**
 * ## The `certification` family (bean `zaui`, test-plan-execution)
 *
 * A certification of a system under test against a `test-plan/v1` is an
 * adjudication record filed by `A_FileCertification` in
 * `test-plan-execution.bpmn`. It records the certifier's decision
 * (`certified` / `refused` / `undetermined`), the test plan, optional
 * requirement ids, signer details and signature verification data.
 *
 * It is a judgement, so it lives on `main` under the declared `attestations`
 * graph:
 *
 * ```
 * <attestations>/certification/<id or subject path>.attestations.json
 * ```
 *
 * Corrupt store handling returns `unknown` and refuses writes, consistent with
 * the other families.
 */
export const CERTIFICATION_FAMILY = "certification" as const;

export const CertificationSignerSchema = z.object({
  kind: z.string().min(1),
  id: z.string().min(1),
  actor: z.string().min(1).optional(),
  version: z.string().optional(),
});
export type CertificationSigner = z.infer<typeof CertificationSignerSchema>;

export const CertificationSignatureSchema = z.object({
  algorithm: z.string().optional(),
  value: z.string().min(1),
  certificate: z.string().optional(),
  signed_at: z.string().optional(),
  key_id: z.string().optional(),
});
export type CertificationSignature = z.infer<typeof CertificationSignatureSchema>;

export const CertificationEntrySchema = z
  .object({
    signer: z.union([z.string().min(1), CertificationSignerSchema]),
    timestamp: z.string().min(1),
    verdict: z.string().min(1).optional(),
    decision: z.string().min(1).optional(),
    testPlanId: z.string().min(1),
    reqId: z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
    signature: z.union([z.string().min(1), CertificationSignatureSchema]).optional(),
    evidence: z.string().optional(),
    notes: z.string().optional(),
    attestation: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((e) => e.verdict !== undefined || e.decision !== undefined, {
    message: "either verdict or decision must be provided",
  });
export type CertificationEntry = z.infer<typeof CertificationEntrySchema>;

export const CertificationAttestationsSchema = BaseAttestationsSchema.extend({
  family: z.literal(CERTIFICATION_FAMILY),
  certifications: z.array(CertificationEntrySchema),
}).strict();
export type CertificationAttestations = z.infer<typeof CertificationAttestationsSchema>;

/**
 * The store file for one certification:
 * `<attestationsHome>/certification/<id or relative path>.attestations.json`.
 */
export function certificationPath(attestationsHomeOrRoot: string, idOrPath: string): string {
  const home =
    attestationsHomeOrRoot.endsWith(join("test", "attestations")) ||
    attestationsHomeOrRoot.includes(join("test", "attestations"))
      ? attestationsHomeOrRoot
      : attestationsHomeFor(attestationsHomeOrRoot).root;
  const stem = idOrPath.endsWith(ATTESTATIONS_SUFFIX)
    ? idOrPath.slice(0, -ATTESTATIONS_SUFFIX.length)
    : idOrPath.replace(/\.json$/, "");
  return join(home, CERTIFICATION_FAMILY, `${stem}${ATTESTATIONS_SUFFIX}`);
}

/**
 * The attestation home for certification records: resolves using {@link attestationsHomeFor}.
 */
export function certificationAttestationsHome(instanceRoot: string): ReturnType<typeof attestationsHomeFor> {
  return attestationsHomeFor(instanceRoot);
}

export type CertificationAttestationRead =
  | { state: "hit"; path: string; text: string; file: CertificationAttestations }
  | { state: "miss" | "absent"; path: string }
  | { state: "corrupt" | "unknown"; path: string; reason: string };

/**
 * Read one certification attestation file, through {@link readAttestationFile}.
 */
export function readCertificationAttestations(
  instanceRoot: string,
  idOrPath: string,
): CertificationAttestationRead {
  const home = attestationsHomeFor(instanceRoot);
  const path = certificationPath(home.root, idOrPath);
  const r = readAttestationFile(path, home.storeRoot);
  if (r.state === "miss" || r.state === "absent") return { state: r.state, path };
  if (r.state !== "hit") return { state: r.state, path, reason: r.reason };
  const f = r.file;
  if (f.family !== CERTIFICATION_FAMILY) {
    return { state: "corrupt", path, reason: `names family "${f.family}", not "${CERTIFICATION_FAMILY}"` };
  }
  return { state: "hit", path, text: r.text, file: f as CertificationAttestations };
}

export type WriteCertificationResult =
  | { ok: true; path: string; written: boolean }
  | { ok: false; state: "corrupt" | "unknown"; path: string; reason: string };

/**
 * Write one certification attestation file.
 * Refuses write and returns state `unknown` or `corrupt` if store is corrupt or unreadable.
 */
export function writeCertificationAttestations(
  instanceRoot: string,
  idOrPath: string,
  data:
    | CertificationAttestations
    | {
        subject: z.infer<typeof AttestationSubjectSchema>;
        certifications?: CertificationEntry[];
        certification?: CertificationEntry;
      },
  opts: { asciiEscape?: boolean } = {},
): WriteCertificationResult {
  const home = attestationsHomeFor(instanceRoot);
  const path = certificationPath(home.root, idOrPath);
  const read = readAttestationFile(path, home.storeRoot);
  if (read.state === "corrupt" || read.state === "unknown") {
    return { ok: false, state: read.state, path, reason: read.reason };
  }

  let certifications: CertificationEntry[];
  if ("certifications" in data && Array.isArray(data.certifications)) {
    certifications = data.certifications;
  } else if ("certification" in data && data.certification) {
    const prior =
      read.state === "hit" &&
      read.file.family === CERTIFICATION_FAMILY &&
      Array.isArray((read.file as CertificationAttestations).certifications)
        ? (read.file as CertificationAttestations).certifications
        : [];
    certifications = [...prior, data.certification];
  } else {
    certifications = [];
  }

  const doc: CertificationAttestations = {
    $schema: QA_ATTESTATIONS_SCHEMA,
    family: CERTIFICATION_FAMILY,
    subject: data.subject,
    certifications,
  };

  const parsed = CertificationAttestationsSchema.safeParse(doc);
  if (!parsed.success) {
    return {
      ok: false,
      state: "corrupt",
      path,
      reason: `invalid certification document: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    };
  }

  const body = serialiseAttestations(doc, opts.asciiEscape ?? false);
  const before = existsSync(path) ? readFileSync(path, "utf-8") : undefined;
  if (before === body) return { ok: true, path, written: false };

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  return { ok: true, path, written: true };
}

/**
 * File a signed certification (for test-plan-execution `A_FileCertification`).
 * Re-exports {@link writeCertificationAttestations}.
 */
export const fileCertification = writeCertificationAttestations;

// ── The `section-title` family (bean `folio-assistant-5qy8`) ───────────

export const SECTION_TITLE_FAMILY = "section-title" as const;

/**
 * One title-coherence verdict on one section of a chapter.
 *
 * Owner, 2026-10-11 (bean `5qy8`, option 1): these were the `agent` slots of
 * the COMMITTED `section-title-audit.qa.json`, which made a derived sidecar
 * carry judgements. They move here; the sidecar becomes a derived working copy.
 *
 * Only a DECIDED verdict is stored — `pending` is the absence of a judgement,
 * and the derived copy is where an open slot shows. `reviewed_hash` pins what
 * was reviewed (the chapter manifest's hash, or under `thorough` the section's
 * subtree hash), so a stale verdict is detected by recomputing it and is never
 * rewritten here.
 */
export const SectionTitleVerdictSchema = z
  .object({
    title: z.string().min(1),
    depth: z.number().int().nonnegative(),
    result: z.string().min(1).refine((r) => r !== "pending", { message: "`pending` is no judgement: the store holds decided verdicts only" }),
    reviewer: z.string().min(1),
    reviewed_hash: z.string().min(1),
    stale_mode: z.enum(["manifest", "thorough"]),
    reviewed_at: z.string().min(1).optional(),
    note: z.string().nullable().optional(),
  })
  .strict();
export type SectionTitleVerdict = z.infer<typeof SectionTitleVerdictSchema>;

/** One paper's verdicts: chapter directory → section key (its label, else its title) → verdict. */
export const SectionTitleAttestationsSchema = QaAttestationsBaseSchema.extend({
  family: z.literal(SECTION_TITLE_FAMILY),
  title_coherence: z.record(z.string(), z.record(z.string(), SectionTitleVerdictSchema)),
}).strict();
export type SectionTitleAttestations = z.infer<typeof SectionTitleAttestationsSchema>;

/**
 * ## The `adversarial-review` family (bean `lvlv`; cat-harness#857)
 *
 * The `AdversarialReview` records `adversarial-backfill` or a reviewer
 * appends about a tool, schema, skill or process, kept verbatim. The owner
 * ruled them judgements on 2026-10-14 ("carry adversarial reviews forward and
 * restore the lost ones", cat-harness d37c20c4). Until this family they sat
 * only inside the derived `kg-qa/v1` sidecar, so removing `test/results/` from
 * main (cat-harness#857) took the last two with it and no generator could
 * write them again; under D2 (a) they belong here.
 *
 * A family of its own rather than an array in the `kg-qa` file: `kg-audit`
 * and `qa:attestations:migrate` own that file and rewrite it from the
 * judgements THEY carry, so a field they do not know would be dropped on the
 * next save. The mirror is the `kg-qa` one ({@link adversarialAttestationFor}).
 *
 * `source_hash` is the subject's source hash (sha256, first 12 hex) the
 * reviews are pinned to — the same field and meaning as the sidecar's — so a
 * reader tells a fresh review from a stale one without the derived tree.
 */
export const ADVERSARIAL_REVIEW_FAMILY = "adversarial-review" as const;

export const AdversarialReviewAttestationsSchema = QaAttestationsBaseSchema.extend({
  family: z.literal(ADVERSARIAL_REVIEW_FAMILY),
  adversarial_reviews: z.array(AdversarialReviewSchema).min(1),
  source_hash: z.string().min(1).nullable(),
}).strict();
export type AdversarialReviewAttestations = z.infer<typeof AdversarialReviewAttestationsSchema>;

/**
 * Every `qa-attestations/v1` file. A union on `family` so `kg_validate` and
 * the registry have ONE validator per `$schema`.
 */
export const QaAttestationsSchema = z.discriminatedUnion("family", [
  KgAttestationsSchema,
  BlockAttestationsSchema,
  TranslationAttestationsSchema,
  BibVerificationAttestationsSchema,
  BibHumanReviewAttestationsSchema,
  RequirementSignoffAttestationsSchema,
  CertificationAttestationsSchema,
  SectionTitleAttestationsSchema,
  AdversarialReviewAttestationsSchema,
]);
export type QaAttestations = z.infer<typeof QaAttestationsSchema>;

// ── Where ────────────────────────────────────────────────────────────────

/**
 * Where a layer's attestations live — the same three answers as
 * `kgQaHomeFor` (`schemas/kg/cat-harness.ts`), for the same reason:
 *
 * - **own** — the layer declares an `attestations` directory;
 * - **hosted** — it does not, and `hostRoot` does: `<host dir>/<stub>`;
 * - **convention** — neither: `<instance>/test/attestations`.
 */
export function attestationsHomeFor(
  instanceRoot: string,
  hostRoot?: string,
  registry: GraphTypologyRegistry = defaultGraphTypologies,
): {
  root: string;
  by: "own" | "hosted" | "convention";
  /**
   * The DECLARED directory whose absence makes every read `unknown`: the
   * layer's own, or the host's for a hosted layer. A hosted subtree
   * that does not exist yet is a store with nothing in it (a `miss`), not a
   * missing store — only the declared directory going is "store absent".
   */
  storeRoot: string;
} {
  const find = (root: string) =>
    resolveDirectories([{ name: "(local)", root, own: true }], registry).find((d) =>
      (d.graphTypologies as readonly string[]).includes(ATTESTATIONS_GRAPH_TYPOLOGY),
    );
  const own = find(instanceRoot);
  if (own !== undefined) return { root: own.absPath, by: "own", storeRoot: own.absPath };
  if (hostRoot !== undefined && resolve(hostRoot) !== resolve(instanceRoot)) {
    const host = find(hostRoot);
    const decl = readDeclaration(instanceRoot);
    if (host !== undefined && decl !== undefined && decl !== null) {
      return { root: join(host.absPath, artefactStub(decl)), by: "hosted", storeRoot: host.absPath };
    }
  }
  // declared-path-literal: the base case for a layer that declares no
  // `attestations` directory and is hosted by nobody.
  const conv = join(instanceRoot, "test", "attestations");
  return { root: conv, by: "convention", storeRoot: conv };
}

/**
 * The attestation file for a derived sidecar: the same mirrored path under
 * `<attestationsHome>/<family>/` instead of `<derivedTree>/`, with the family
 * suffix swapped for {@link ATTESTATIONS_SUFFIX}.
 *
 * Derived from the sidecar path rather than recomputed from the subject so
 * there is ONE mirror rule (`kgQaSidecarPath` for kg-qa) and two trees that
 * cannot disagree about it. Throws when the sidecar is not under the tree:
 * a composed path outside the store is a caller's bug, never a quiet miss.
 */
export function attestationPathFor(
  sidecarAbs: string,
  derivedTree: string,
  attestationsHome: string,
  family: AttestationFamily,
  derivedSuffix: string = `.${family}.json`,
): string {
  const rel = relative(resolve(derivedTree), resolve(sidecarAbs));
  if (rel.startsWith("..") || rel === "" || rel.startsWith(sep)) {
    throw new Error(`${sidecarAbs} is not under the derived tree ${derivedTree}`);
  }
  if (!rel.endsWith(derivedSuffix)) throw new Error(`${sidecarAbs} does not end in ${derivedSuffix}`);
  return join(attestationsHome, family, `${rel.slice(0, -derivedSuffix.length)}${ATTESTATIONS_SUFFIX}`);
}

// ── Read ─────────────────────────────────────────────────────────────────

export type AttestationRead =
  | { state: "hit"; path: string; text: string; file: QaAttestations }
  | { state: "miss"; path: string; reason: string }
  | { state: "absent"; path: string; reason: string }
  | { state: "corrupt"; path: string; reason: string }
  | { state: "unknown"; path: string; reason: string };

/**
 * Read one attestation file, in five states.
 *
 * `storeRoot` is the attestations directory (`storeRoot` from
 * {@link attestationsHomeFor}): when IT is absent the store is not there to
 * consult, which is `absent`, not `miss`. A writer then moves the prior
 * derived file's judgements into a new store as it saves (owner ruling 2,
 * 2026-10-01); see the module comment.
 */
export function readAttestationFile(path: string, storeRoot: string): AttestationRead {
  try {
    if (!existsSync(storeRoot)) {
      // No absolute path in the reason: it is written into committed sidecars.
      return { state: "absent", path, reason: "this instance has no attestation store yet" };
    }
    if (!statSync(storeRoot).isDirectory()) {
      return { state: "unknown", path, reason: "the attestation store path is not a directory" };
    }
  } catch (e) {
    return { state: "unknown", path, reason: `the attestation store could not be read: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!existsSync(path)) return { state: "miss", path, reason: "no attestation recorded for this subject" };
  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch (e) {
    return { state: "unknown", path, reason: `unreadable: ${e instanceof Error ? e.message : String(e)}` };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { state: "corrupt", path, reason: `not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const parsed = QaAttestationsSchema.safeParse(json);
  if (!parsed.success) {
    return { state: "corrupt", path, reason: `not ${QA_ATTESTATIONS_SCHEMA}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` };
  }
  // The RAW object, not `parsed.data`: zod rebuilds an object in schema key
  // order, and a writer that round-trips through it would reorder an entry
  // the store promises to keep byte-for-byte.
  return { state: "hit", path, text, file: json as QaAttestations };
}

/**
 * Is this JSON text ASCII-escaped — every non-ASCII character written as
 * `\uXXXX`, the way Python's `json.dumps` writes it?
 *
 * Measured 2026-10-01: 10 of the 12 derived block/translation reports carrying
 * a judgement are, and `JSON.stringify` would rewrite `—` as `—`. Same
 * string, other bytes. A store file keeps the style of the file its entries
 * came from, so their bytes survive the move rather than only their value.
 */
export function isAsciiEscaped(text: string): boolean {
  return /\\u[0-9a-fA-F]{4}/.test(text) && !/[^\x00-\x7f]/.test(text);
}

/** `JSON.stringify(value, null, 2)`, optionally ASCII-escaped in lowercase hex. */
export function jsonText(value: unknown, asciiEscape = false): string {
  const text = JSON.stringify(value, null, 2);
  return asciiEscape ? text.replace(/[^\x00-\x7f]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")) : text;
}

/** The one serialisation, so writer, migration and `--check` agree on bytes. */
export function serialiseAttestations(file: QaAttestations, asciiEscape = false): string {
  return `${jsonText(file, asciiEscape)}\n`;
}

// ── The kg-qa family's trees ─────────────────────────────────────────────

/** One layer's `kg-qa/` derived tree and the attestation home it maps onto. */
export interface KgAttestationTree {
  /** Repo-relative layer root, `.` for the checkout root. */
  instance: string;
  /** Absolute `<qa home>/kg-qa`. */
  kgTree: string;
  /** Absolute attestations home (the `<family>` directory goes under it). */
  attHome: string;
  /** The declared directory whose absence is "store absent" — see `attestationsHomeFor`. */
  storeRoot: string;
}

/** The suffix `kgQaSidecarPath` composes. */
export const KG_QA_SIDECAR_SUFFIX = ".kg-qa.json";

/**
 * Every layer's `kg-qa/` tree with its attestation home, as `kg-audit`
 * resolves them when `hostRoot` is the auditor's layer. Deduplicated on the
 * tree, since two layer roots can share a hosted home.
 */
export function kgAttestationTrees(repoRoot: string, hostRoot: string): KgAttestationTree[] {
  const out = new Map<string, KgAttestationTree>();
  for (const root of layerRootsIn(repoRoot)) {
    const kgTree = resolve(kgQaHomeFor(root, hostRoot).root, "kg-qa");
    if (out.has(kgTree)) continue;
    const home = attestationsHomeFor(root, hostRoot);
    out.set(kgTree, { instance: relative(repoRoot, root) || ".", kgTree, attHome: home.root, storeRoot: home.storeRoot });
  }
  return [...out.values()];
}

/**
 * The attestation file and family tree for a kg-qa sidecar path, or
 * `undefined` when the path is under no layer's `kg-qa/` tree.
 */
export function kgAttestationFor(
  sidecarAbs: string,
  repoRoot: string,
  hostRoot: string,
): { file: string; storeRoot: string } | undefined {
  const abs = resolve(sidecarAbs);
  const tree = kgAttestationTrees(repoRoot, hostRoot)
    .filter((t) => abs.startsWith(`${t.kgTree}${sep}`))
    // The deepest tree wins: a hosted home sits beside, never inside, the
    // host's own tree, but a longest match costs nothing and is never wrong.
    .sort((a, b) => b.kgTree.length - a.kgTree.length)[0];
  if (tree === undefined) return undefined;
  return {
    file: attestationPathFor(abs, tree.kgTree, tree.attHome, "kg-qa", KG_QA_SIDECAR_SUFFIX),
    storeRoot: tree.storeRoot,
  };
}

/**
 * The `adversarial-review` attestation file for a kg-qa sidecar path — the
 * `kg-qa` mirror under the family's own directory — or `undefined` when the
 * path is under no layer's `kg-qa/` tree.
 */
export function adversarialAttestationFor(
  sidecarAbs: string,
  repoRoot: string,
  hostRoot: string,
): { file: string; storeRoot: string } | undefined {
  const abs = resolve(sidecarAbs);
  const tree = kgAttestationTrees(repoRoot, hostRoot)
    .filter((t) => abs.startsWith(`${t.kgTree}${sep}`))
    .sort((a, b) => b.kgTree.length - a.kgTree.length)[0];
  if (tree === undefined) return undefined;
  return {
    file: attestationPathFor(abs, tree.kgTree, tree.attHome, ADVERSARIAL_REVIEW_FAMILY, KG_QA_SIDECAR_SUFFIX),
    storeRoot: tree.storeRoot,
  };
}

/** One subject's adversarial reviews as the store holds them. */
export interface StoredAdversarialReviews {
  /** Absolute path of the attestation file. */
  path: string;
  file: AdversarialReviewAttestations;
}

/**
 * Every `adversarial-review` attestation file under `attHome`. Only `hit`
 * files are returned: one that does not parse or validate is not a review
 * anybody can read, and the `attestations` kind validator reports it.
 */
export function storedAdversarialReviews(attHome: string): StoredAdversarialReviews[] {
  const out: StoredAdversarialReviews[] = [];
  const tree = join(attHome, ADVERSARIAL_REVIEW_FAMILY);
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.name.endsWith(ATTESTATIONS_SUFFIX)) {
        const read = readAttestationFile(abs, attHome);
        if (read.state === "hit" && read.file.family === ADVERSARIAL_REVIEW_FAMILY) out.push({ path: abs, file: read.file });
      }
    }
  };
  if (existsSync(tree)) walk(tree);
  return out.sort((a, b) => (a.path < b.path ? -1 : 1));
}

/** The kg-qa judgement arrays, in the order the pre-split sidecar carried them. */
export const KG_JUDGEMENT_FIELDS = ["pair_attestations", "voice_reviews"] as const;

/**
 * The judgements a PRIOR kg-qa sidecar still carries inside it, read raw —
 * the half of ruling 2 that a kg-qa reader needs on a `miss` or `absent`.
 *
 * `KgQaReportSchema` refuses a sidecar that carries one, so this never goes
 * through it: it is the one read that EXPECTS the old mixed shape. An absent
 * sidecar is `none` (nothing to move); one that will not parse is `unknown`,
 * because it may be holding judgements nobody can read.
 */
export function priorKgJudgements(
  sidecarAbs: string | undefined,
): { state: "none" } | { state: "found"; pair_attestations: unknown[]; voice_reviews: unknown[] } | { state: "unknown"; reason: string } {
  if (sidecarAbs === undefined || !existsSync(sidecarAbs)) return { state: "none" };
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(readFileSync(sidecarAbs, "utf-8")) as Record<string, unknown>;
  } catch (e) {
    return { state: "unknown", reason: `the prior sidecar does not parse, and may hold judgements: ${e instanceof Error ? e.message : String(e)}` };
  }
  const arr = (k: string) => (Array.isArray(json[k]) ? (json[k] as unknown[]) : []);
  const pairs = arr("pair_attestations");
  const reviews = arr("voice_reviews");
  if (pairs.length === 0 && reviews.length === 0) return { state: "none" };
  return { state: "found", pair_attestations: pairs, voice_reviews: reviews };
}

// ── The block-qa and translation-qa families (bean `8wj1`) ──────────────

/** The families whose judgements are `criteria` entries. */
export const CRITERIA_FAMILIES = ["block-qa", "translation-qa"] as const satisfies readonly AttestationFamily[];
export type CriteriaFamily = (typeof CRITERIA_FAMILIES)[number];

/** An entry, kept opaque: the store never rewrites one. */
export type QaEntryLike = { reviewer?: { kind?: unknown } | null } & Record<string, unknown>;
export type CriteriaMap<E = QaEntryLike> = Record<string, E[]>;

/** Which subject's judgements, in which family. */
export interface AttestationKey {
  family: CriteriaFamily;
  /** The subject root relative to the layer root, POSIX, without extension. */
  subject: string;
  /** `translation-qa` only. */
  locale?: string;
}

/** The derived suffix per family; the translation one carries the locale. */
const DERIVED_SUFFIX: Record<CriteriaFamily, RegExp> = {
  "block-qa": /\.qa\.json$/,
  "translation-qa": /\.([A-Za-z0-9_-]+)\.translation-qa\.json$/,
};

const posix = (p: string) => p.split(sep).join("/");

const homes = new Map<string, ReturnType<typeof attestationsHomeFor>>();
/**
 * The attestation home a block/translation writer uses: {@link attestationsHomeFor}
 * with no host, because a block writer runs against the content repository it
 * writes. Cached per layer root: a sweep asks once per block.
 */
export function criteriaAttestationsHome(instanceRoot: string): ReturnType<typeof attestationsHomeFor> {
  const k = resolve(instanceRoot);
  let h = homes.get(k);
  if (h === undefined) homes.set(k, (h = attestationsHomeFor(k)));
  return h;
}

/**
 * The store file for one subject: `<home>/<family>/<subject>[.<locale>].attestations.json`.
 * The same path {@link attestationPathFor} gives for the subject's derived
 * report under `test/results/<family>/`, composed from the subject rather than
 * the report because a writer may hold only the subject (its report absent).
 */
export function attestationPath(instanceRoot: string, key: AttestationKey): string {
  const tail = key.locale ? `${key.subject}.${key.locale}` : key.subject;
  return join(criteriaAttestationsHome(instanceRoot).root, key.family, tail + ATTESTATIONS_SUFFIX);
}

/** The key for a block, from its root (the `.ts` path without extension). */
export function blockAttestationKey(instanceRoot: string, blockRoot: string): AttestationKey {
  return { family: "block-qa", subject: posix(relative(instanceRoot, blockRoot)) };
}

/** The key for a (subject, locale) translation verdict. */
export function translationAttestationKey(instanceRoot: string, subjectRoot: string, locale: string): AttestationKey {
  return { family: "translation-qa", subject: posix(relative(instanceRoot, subjectRoot)), locale };
}

/**
 * The key for a derived report, given its path: either under
 * `test/results/<family>/` or the legacy sibling beside its subject.
 * `undefined` for a path that is neither.
 */
export function attestationKeyForDerived(instanceRoot: string, derivedAbs: string): AttestationKey | undefined {
  for (const family of CRITERIA_FAMILIES) {
    const m = DERIVED_SUFFIX[family].exec(derivedAbs);
    if (!m) continue;
    const stripped = derivedAbs.slice(0, m.index);
    const resultsBase = join(instanceRoot, "test", "results", family);
    const underResults = relative(resultsBase, stripped);
    const subjectAbs = underResults.startsWith("..") ? stripped : join(instanceRoot, underResults);
    const subject = posix(relative(instanceRoot, subjectAbs));
    if (subject.startsWith("..")) return undefined;
    return family === "translation-qa" ? { family, subject, locale: m[1]! } : { family, subject };
  }
  return undefined;
}

/** The subject object a block/translation file names. */
export function criteriaSubject(key: AttestationKey): z.infer<typeof AttestationSubjectSchema> {
  return { kind: "block", id: key.subject, path: key.subject };
}

/** Canonical identity of an entry: its exact serialisation, key order included. */
export function entryIdentity(e: unknown): string {
  return JSON.stringify(e);
}

/**
 * Split a criteria map into its script half and its judgement half. The script
 * half keeps EVERY criterion key, in order, even one left empty — so composing
 * the two halves back reproduces the original key order.
 */
export function splitCriteria<E>(criteria: CriteriaMap<E> | undefined): { script: CriteriaMap<E>; attestations: CriteriaMap<E> } {
  const script: CriteriaMap<E> = {};
  const attestations: CriteriaMap<E> = {};
  for (const [id, entries] of Object.entries(criteria ?? {})) {
    const list = Array.isArray(entries) ? entries : [];
    script[id] = list.filter((e) => !isAttestation(e));
    const att = list.filter((e) => isAttestation(e));
    if (att.length > 0) attestations[id] = att;
  }
  return { script, attestations };
}

/**
 * Compose a report's criteria from a script half and the store's judgements:
 * per criterion, judgements FIRST, then the script entries — the invariant
 * `insertAdjudication` in `qa-utils.ts` states for the block family. Key
 * order: the script half's, then any criterion only the store has.
 */
export function composeCriteria<E>(script: CriteriaMap<E>, attestations: CriteriaMap<E>): CriteriaMap<E> {
  const out: CriteriaMap<E> = {};
  for (const [id, entries] of Object.entries(script)) out[id] = [...(attestations[id] ?? []), ...entries];
  for (const [id, entries] of Object.entries(attestations)) if (!(id in out)) out[id] = [...entries];
  return out;
}

/**
 * Every judgement in `expected` that `actual` does not hold, as
 * `<criterion>|<reviewer kind>/<reviewer id>`. The after-check every writer
 * runs before it saves: an empty list is the only licence to write.
 */
export function missingAttestations(actual: CriteriaMap<unknown> | undefined, expected: CriteriaMap<unknown>): string[] {
  const out: string[] = [];
  for (const [id, entries] of Object.entries(expected)) {
    const have = new Set((actual?.[id] ?? []).map(entryIdentity));
    for (const e of entries) {
      if (!have.has(entryIdentity(e))) {
        const r = (e as QaEntryLike | null)?.reviewer as { kind?: unknown; id?: unknown } | undefined;
        out.push(`${id}|${String(r?.kind ?? "?")}/${String(r?.id ?? "?")}`);
      }
    }
  }
  return out;
}

export type CriteriaAttestationRead =
  | { state: "hit"; path: string; text: string; criteria: CriteriaMap }
  | { state: "miss" | "absent"; path: string }
  | { state: "corrupt" | "unknown"; path: string; reason: string };

/** Read one subject's block/translation judgements, through {@link readAttestationFile}. */
export function readCriteriaAttestations(instanceRoot: string, key: AttestationKey): CriteriaAttestationRead {
  const path = attestationPath(instanceRoot, key);
  const r = readAttestationFile(path, criteriaAttestationsHome(instanceRoot).storeRoot);
  if (r.state === "miss" || r.state === "absent") return { state: r.state, path };
  if (r.state !== "hit") return { state: r.state, path, reason: r.reason };
  const f = r.file;
  const locale = f.family === "translation-qa" ? f.locale : undefined;
  if (f.family !== key.family || f.subject.path !== key.subject || locale !== key.locale) {
    const name = `${f.family}:${f.subject.path ?? f.subject.id}${locale ? `@${locale}` : ""}`;
    return { state: "corrupt", path, reason: `names ${name}, not ${key.family}:${key.subject}${key.locale ? `@${key.locale}` : ""}` };
  }
  return { state: "hit", path, text: r.text, criteria: (f as unknown as { criteria: CriteriaMap }).criteria };
}

/** Serialise one subject's file. One function, so the migration and the writers agree on every byte. */
export function renderCriteriaAttestations(key: AttestationKey, criteria: CriteriaMap<unknown>, asciiEscape = false): string {
  const doc: Record<string, unknown> = { $schema: QA_ATTESTATIONS_SCHEMA, family: key.family, subject: criteriaSubject(key) };
  if (key.locale) doc["locale"] = key.locale;
  doc["criteria"] = criteria;
  return serialiseAttestations(doc as unknown as QaAttestations, asciiEscape);
}

/**
 * Write one subject's judgements, creating the store if needed — that is the
 * first save of ruling 2. Writes only when the content changes. An empty map
 * is still written when a file exists: a retraction is recorded, never
 * expressed by deleting the file.
 */
export function writeCriteriaAttestations(
  instanceRoot: string,
  key: AttestationKey,
  criteria: CriteriaMap<unknown>,
  opts: { asciiEscape?: boolean } = {},
): boolean {
  const path = attestationPath(instanceRoot, key);
  const nonEmpty = Object.fromEntries(Object.entries(criteria).filter(([, v]) => v.length > 0));
  if (Object.keys(nonEmpty).length === 0 && !existsSync(path)) return false;
  const before = existsSync(path) ? readFileSync(path, "utf-8") : undefined;
  // An existing file keeps the escaping it was written in; a new one takes the caller's.
  const body = renderCriteriaAttestations(key, nonEmpty, before !== undefined ? isAsciiEscaped(before) : (opts.asciiEscape ?? false));
  if (before === body) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  return true;
}

/** The command that adds judgements still inside derived files to the store, for every family. */
export const MIGRATE_COMMAND = "bun run cat qa:attestations:migrate";

/** The criteria type of a report, so a writer gets its judgements back in its own entry type. */
export type CriteriaOf<R> = R extends { criteria?: infer C } ? NonNullable<C> : CriteriaMap;

/** The answer a writer acts on: proceed with these, or refuse. */
export type PriorResolution<R> =
  | {
      ok: true;
      /** The prior report with its judgement half re-sourced from the store; `undefined` when there was no prior. */
      prior: R | undefined;
      /** The subject's judgements: the store's, or on `miss`/`absent` the prior's own (to be moved). */
      attestations: CriteriaOf<R>;
      /** The store path for this subject. */
      path: string;
      instanceRoot: string;
      key: AttestationKey;
      /** True when the prior carried judgements with no store entry: saving MOVES them into the store (ruling 2). */
      adopt: boolean;
    }
  | { ok: false; state: "corrupt" | "unknown" | "conflict"; path: string; reason: string };

/**
 * Resolve what a read-modify-write writer starts from.
 *
 * `prior` is the derived report the writer read (or `undefined`).
 *
 * - `hit` — the store's judgements are the source; the prior's are never
 *   read as judgements. A prior carrying one the store does NOT hold is a
 *   `conflict` and refused: it is either a judgement some writer put only in
 *   the derived file or one retracted from the store and not from the
 *   projection, and a writer cannot tell which.
 * - `miss` / `absent` — the subject has no store entry. The prior's
 *   judgements are MOVED: the writer writes them to the store as it saves
 *   (owner ruling 2, 2026-10-01). Not a refusal.
 * - `corrupt` / `unknown` — refused; the writer writes NOTHING for this subject.
 */
export function resolvePrior<R extends { criteria?: CriteriaMap<unknown> }>(
  instanceRoot: string,
  key: AttestationKey,
  prior: R | undefined,
): PriorResolution<R> {
  const read = readCriteriaAttestations(instanceRoot, key);
  if (read.state === "corrupt" || read.state === "unknown") {
    return { ok: false, state: read.state, path: read.path, reason: read.reason };
  }
  const split = prior ? splitCriteria(prior.criteria) : { script: {}, attestations: {} };
  if (read.state !== "hit") {
    // `miss` or `absent`: no store entry, so the prior's judgements are moved.
    const adopt = Object.keys(split.attestations).length > 0;
    const composed = prior ? ({ ...prior, criteria: composeCriteria(split.script, split.attestations) } as R) : undefined;
    return { ok: true, prior: composed, attestations: split.attestations as CriteriaOf<R>, path: read.path, instanceRoot, key, adopt };
  }
  const unheld = missingAttestations(read.criteria, split.attestations);
  if (unheld.length > 0) {
    return {
      ok: false,
      state: "conflict",
      path: read.path,
      reason:
        `the prior report carries ${unheld.length} judgement(s) the store's file for this subject does not hold (${unheld.join(", ")}). ` +
        `Run \`${MIGRATE_COMMAND}\` to add them to the store — or, if one was retracted from the store, remove it from the derived report too`,
    };
  }
  const composed = prior ? ({ ...prior, criteria: composeCriteria(split.script, read.criteria) } as R) : undefined;
  return { ok: true, prior: composed, attestations: read.criteria as CriteriaOf<R>, path: read.path, instanceRoot, key, adopt: false };
}

/** The resolution a writer may proceed with. */
export type PriorOk = Omit<Extract<PriorResolution<unknown>, { ok: true }>, "attestations"> & { attestations: CriteriaMap<unknown> };

/**
 * Finalise the criteria a writer is about to save. THROWS — before the writer
 * has written its report — if a judgement would not survive.
 *
 * - `"script"`: a writer that produces script entries only. Its judgement half
 *   is replaced by the store's, whatever it did to non-script entries on the
 *   way. When the resolution `adopt`s, the moved judgements are written to the
 *   store first (ruling 2).
 * - `"attesting"`: a writer that adds, replaces or removes a non-script entry.
 *   Its judgement half is written to the store FIRST, read back, and the
 *   derived projection is composed from it.
 *
 * `dryRun` computes and checks, and writes nothing.
 */
export function finalizeCriteria<E>(
  res: PriorOk,
  criteria: CriteriaMap<E>,
  mode: "script" | "attesting",
  opts: { dryRun?: boolean; asciiEscape?: boolean } = {},
): CriteriaMap<E> {
  const split = splitCriteria(criteria);
  const attestations = (mode === "attesting" ? split.attestations : res.attestations) as CriteriaMap<E>;
  if (!opts.dryRun && (mode === "attesting" || res.adopt)) {
    writeCriteriaAttestations(res.instanceRoot, res.key, attestations, { asciiEscape: opts.asciiEscape });
    const back = readCriteriaAttestations(res.instanceRoot, res.key);
    const held = back.state === "hit" ? back.criteria : {};
    const lost = missingAttestations(held, attestations);
    if (lost.length > 0) throw new Error(`the attestation store did not take ${lost.join(", ")} at ${back.path}`);
  }
  const out = composeCriteria(split.script, attestations);
  const dropped = missingAttestations(out, attestations);
  if (dropped.length > 0) throw new Error(`composition dropped ${dropped.join(", ")}`);
  return out;
}

/** One line for a refusal, in the shape every writer prints. */
export function refusalLine(writer: string, subject: string, r: { state: string; path: string; reason: string }): string {
  return `${writer}: UNKNOWN ${subject} — attestation store ${r.state} at ${r.path}: ${r.reason}. Nothing was written for it.`;
}
