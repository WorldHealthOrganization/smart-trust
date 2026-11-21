/**
 * The engine's own PROV-O record: one `prov:Activity` written as each step is
 * recorded, under the verdict that let it be recorded.
 *
 * Issue #1180 step 5 built the AFTER-check (`scripts/prov-qaqc.ts`), which
 * derives activities from history and re-runs `authorizeTask` with the actor
 * `asserted`, because history carried only a name. Since the engine went
 * strict (issue #1207, owner 2026-09-24) the engine knows more than history
 * did: the principal GitHub vouched for, the lane's role, and every policy the
 * verdict was computed under. This writes that down at the moment it is true,
 * so the after-check reads a record rather than reconstructing one.
 *
 * For computable Data Sharing Agreements (DSA B4, bean `3z44`, issue #2702),
 * decision records also cite their agreement — a `prov:used` entity whose `@id`
 * is the DCAT 3 distribution of the agreement text, with its `spdx:checksum` —
 * and, for B5, their grant as a `prov:used` entity whose `@id` is the W3C VC
 * 2.0 credential `id` (bean `yy40`). They form an append-only hash chain
 * (`cat-harness:previousHash` → `cat-harness:recordHash`, a local extension:
 * no open standard defines one) verified by {@link verifyProvHashChain}.
 *
 * Same rule as the after-check, and for the same reason: **no activity is
 * invented.** A step with no actor, or in a lane that binds no role, gets none,
 * because `ProvActivitySchema` requires both and a guessed value is
 * fabrication. A refused step gets none either: it did not happen.
 *
 * @module folio-assistant/workflow/prov-record
 */

import { basename } from "node:path";
import {
  ProvActivitySchema,
  ProvConsentDecisionRecordSchema,
  ProvConsentRefSchema,
  ProvDecisionRecordSchema,
  agreementDistribution,
  agreementsCited,
  appendProvDecisionRecord,
  buildProvHashChain,
  canonicalProvRecord,
  computeProvRecordHash,
  grantCredential,
  grantsCited,
  isConsentBasedRecord,
  isConsentPolicyUid,
  stampProvDecisionRecord,
  stampProvRecord,
  verifyProvHashChain,
  type ProvActivity,
  type ProvAgreementDistribution,
  type ProvUsed,
  type ProvChainError,
  type ProvChainErrorKind,
  type ProvChainVerification,
  type ProvChainVerifyOptions,
  type ProvConsentDecisionRecord,
  type ProvConsentRef,
  type ProvDecisionRecord,
} from "../../schemas/content/prov.js";
import type { TaskAuthVerdict } from "./authorize.js";

export {
  ProvConsentDecisionRecordSchema,
  ProvConsentRefSchema,
  ProvDecisionRecordSchema,
  agreementDistribution,
  agreementsCited,
  appendProvDecisionRecord,
  buildProvHashChain,
  canonicalProvRecord,
  computeProvRecordHash,
  grantCredential,
  grantsCited,
  isConsentBasedRecord,
  isConsentPolicyUid,
  stampProvDecisionRecord,
  stampProvRecord,
  verifyProvHashChain,
  type ProvAgreementDistribution,
  type ProvChainError,
  type ProvChainErrorKind,
  type ProvChainVerification,
  type ProvChainVerifyOptions,
  type ProvConsentDecisionRecord,
  type ProvConsentRef,
  type ProvDecisionRecord,
};

/** `code-change-review.bpmn` → `code-change-review`: the `hadPlan` prefix, as the after-check writes it. */
export function planStem(source: string): string {
  return basename(source).replace(/\.bpmn$/i, "").toLowerCase();
}

export interface ProvRecordInput {
  /** `<instance id>#<history index>`: the same `@id` the after-check derives. */
  id: string;
  at: string;
  /** The `.bpmn` the instance runs, for the plan reference. */
  source: string;
  node: string;
  verdict: TaskAuthVerdict;
  /** Every policy uid in force, which is what `decide` evaluated. */
  policies: readonly string[];
  /** The content the step acted on. */
  target?: string;
  /**
   * The agreement the step/decision was evaluated under (DSA B4, beans `3z44`,
   * `yy40`): its DCAT distribution and `spdx:checksum`, written into
   * `prov:used`. Build one with {@link agreementDistribution}.
   */
  agreement?: ProvAgreementDistribution;
  /** The grant's W3C VC 2.0 credential `id` (DSA B5), written into `prov:used`. */
  grant?: string;
  /**
   * The IHE PCF / FHIR R4 `Consent` (`id` + `versionId`) cited when the
   * step/decision is consent-based (PCF8, bean `2egb`).
   */
  consent?: ProvConsentRef;
  /**
   * Whether the step/decision is consent-based (e.g. evaluated under a policy
   * with an `odrl:obtainConsent` duty). When `true`, `consent` (`id` + `versionId`)
   * is required.
   */
  consentBased?: boolean;
  /**
   * SHA-256 hex digest of the preceding PROV record in the log (`null` for the
   * first record in a chain). When supplied (or when `agreement` or `chain` is
   * set), stamps `cat-harness:previousHash` and `cat-harness:recordHash`.
   */
  previousHash?: string | null;
  /** Explicitly opt into hash-chaining even when no `agreement` is supplied. */
  chain?: boolean;
}

export interface ProvDecisionRecordInput extends ProvRecordInput {
  /** Required on every decision record: the agreement's DCAT distribution + `spdx:checksum`. */
  agreement: ProvAgreementDistribution;
  /** Optional preceding record in the chain, from which `previousHash` is read. */
  previousRecord?: Pick<ProvActivity, "cat-harness:recordHash"> | null;
}

export interface ProvConsentDecisionRecordInput extends ProvDecisionRecordInput {
  /** Required on every consent-based decision record: Consent `id` + `versionId` (PCF8, bean `2egb`). */
  consent: ProvConsentRef;
}

/** The activity for an allowed step, or `undefined` when one would have to be invented. */
export function provActivityFor(input: ProvRecordInput): ProvActivity | undefined {
  const { verdict: v } = input;
  if (!v.allowed || !v.actor || !v.role || input.policies.length === 0) return undefined;
  const policies = [...input.policies].sort();
  const used: ProvUsed[] = [
    ...(input.target ? [input.target] : []),
    ...(input.agreement ? [input.agreement] : []),
    ...(input.grant ? [grantCredential(input.grant)] : []),
  ];
  const baseActivity = {
    "@type": "prov:Activity" as const,
    "@id": input.id,
    "prov:startedAtTime": input.at,
    "prov:qualifiedAssociation": {
      "prov:agent": v.actor,
      "prov:hadRole": v.role,
      "prov:hadPlan": `${planStem(input.source)}#${input.node}`,
    },
    ...(used.length > 0 ? { "prov:used": used } : {}),
    "cat-harness:underPolicy": policies.length === 1 ? policies[0]! : policies,
    ...(input.consent ? { "cat-harness:consent": input.consent } : {}),
    ...(input.consentBased !== undefined ? { "cat-harness:consentBased": input.consentBased } : {}),
  };
  const shouldChain =
    input.agreement !== undefined || input.previousHash !== undefined || input.chain === true;
  if (shouldChain) {
    const previousHash = input.previousHash ?? null;
    const withPrev = {
      ...baseActivity,
      "cat-harness:previousHash": previousHash,
    };
    const recordHash = computeProvRecordHash(withPrev);
    const chained = {
      ...withPrev,
      "cat-harness:recordHash": recordHash,
    };
    if (input.agreement && (input.consent || input.consentBased)) {
      return ProvConsentDecisionRecordSchema.parse(chained);
    }
    return input.agreement
      ? ProvDecisionRecordSchema.parse(chained)
      : ProvActivitySchema.parse(chained);
  }
  // Validated here, so an invalid record is a thrown bug at the step that
  // produced it rather than a finding discovered later by the after-check.
  return ProvActivitySchema.parse(baseActivity);
}

/**
 * Build a hash-chained PROV decision record (DSA B4, bean `3z44`) naming its
 * agreement (DCAT distribution + `spdx:checksum`, and optional VC grant) — and its Consent
 * (`id` + `versionId`, PCF8, bean `2egb`) when consent-based — chained to
 * `previousRecord` / `previousHash`. Returns `undefined` when the verdict was
 * refused or lacks actor/role/policies.
 */
export function provDecisionRecordFor(
  input: ProvDecisionRecordInput,
): ProvDecisionRecord | undefined {
  const previousHash =
    input.previousRecord !== undefined
      ? (input.previousRecord?.["cat-harness:recordHash"] ?? null)
      : (input.previousHash ?? null);
  const act = provActivityFor({
    ...input,
    previousHash,
    chain: true,
  });
  return act ? ProvDecisionRecordSchema.parse(act) : undefined;
}

/**
 * Build a hash-chained consent-based PROV decision record (PCF8, bean `2egb`)
 * requiring both `agreement` (DCAT distribution + `spdx:checksum`) and `consent` (`id` + `versionId`).
 */
export function provConsentDecisionRecordFor(
  input: ProvConsentDecisionRecordInput,
): ProvConsentDecisionRecord | undefined {
  const rec = provDecisionRecordFor({
    ...input,
    consentBased: true,
  });
  return rec ? ProvConsentDecisionRecordSchema.parse(rec) : undefined;
}
