/**
 * MOUNT TRUST — what must be true before a remote knowledge graph is mounted.
 *
 * @module schemas/mount-trust
 * @graphNode schema
 *
 * Rule H8 of `skills/conduct/security/zero-trust-handover.md`: a remote mount
 * needs a trusted, signed provenance source or explicit user consent; staging
 * needs neither. A mounted skill steers an agent and mounted code runs, so
 * mounting is a supply-chain decision, not a fetch.
 *
 * ## Three ways a mount may proceed, and one it may not
 *
 * | basis | when | state |
 * |---|---|---|
 * | `staging` | the mount is for a staging preview | allowed, recorded as such |
 * | `consent` | a person consented to THIS harness at THIS pin | allowed |
 * | `signature` | a signature verifiable through a declared trust network | **could not determine**: no verifier exists yet, so a recorded signature is reported and NOT trusted |
 * | none | unsigned and unconsented | **refused** |
 *
 * **Consent is scoped to the pin.** A moved pin is different code, so it asks
 * again — unless a declared STANDING consent covers it (below).
 *
 * **An unverified signature is not trust.** Until a verifier for the declared
 * network exists (GDHCN is the named example; its trust-list model belongs to
 * a layer above this layer), a signature-only mount is
 * `could-not-determine`, which never mounts.
 *
 * ## What the lock keeps, and who may consent
 *
 * - **The basis is recorded.** Every locked layer carries the basis it was
 *   mounted on ({@link MountTrustBasisSchema}): `staging` (the caller's
 *   `--staging` flag) or `consent` with who and when. `mount:remote:check`
 *   re-runs {@link mountTrust} against the CURRENT declaration and reports a
 *   mount whose recorded basis no longer holds.
 * - **Who consented is checked when the layer says who may.** A layer
 *   may declare `mountApprovers`; then `consent.by` must be one of them. With
 *   no list, the verdict says `approver: "unverified"`, which callers report
 *   as its own state, never as clean.
 * - **A gitlink is not covered by its parent's consent.** A layer reached
 *   through a gitlink needs consent of its own, given on the downstream's
 *   override for that layer.
 *
 * ## Standing consent
 *
 * Each site keeps its own lock. A site may say, once, per upstream layer,
 * *"keep me on `<branch>` of this upstream"* — a {@link StandingConsentSchema}
 * on that layer's `trust.standing` (the remote source's own `trust`, or
 * `overrides.<instance>.trust` for a layer reached through a gitlink). It
 * names the person who gave it and when.
 *
 * A standing consent does not trust a pin by itself, and a hand-moved pin is
 * still refused. It lets the repin tool, having resolved the followed
 * branch's newest (or, with `require: "green"`, newest green) commit, WRITE a
 * per-pin consent for the new pin, attributed to the standing rule's person
 * and marked `consent.standing` ({@link withStandingConsent}). {@link mountTrust}
 * accepts that pin only while the rule it names is still declared, unchanged,
 * on the same layer; withdraw or edit the rule and every pin recorded under
 * it asks again.
 */
import { z } from "zod";


/** A full commit SHA. Restated rather than imported: `remote-mount.ts` imports THIS module, and a cycle would be the price. */
const CommitShaSchema = z.string().regex(/^[0-9a-f]{40}$/, "a full 40-character commit SHA");

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "an ISO date");

/** A git branch name a standing consent follows, e.g. `main`. No whitespace, no `..`, no leading `-`. */
const BranchSchema = z
  .string()
  .regex(/^(?!-)(?!.*\.\.)[A-Za-z0-9._/-]+$/, "a branch name, e.g. `main`")
  .refine((b) => !b.startsWith("refs/"), "the short branch name, not `refs/…`");

/**
 * A person's STANDING consent for one upstream layer: "re-pin me to the
 * newest commit of `follows`" (owner, 2026-10-16). It sits on the layer's
 * `trust.standing`, so the layer is the entry it is declared on.
 */
export const StandingConsentSchema = z
  .object({
    /** The upstream branch whose newest commit the pin follows. */
    follows: BranchSchema,
    /** Who gave the standing consent — recorded as `consent.by` on every pin it covers. */
    consentBy: z.string().min(1),
    /** When it was given. Part of the rule's identity: a re-given rule re-asks every pin under the old one. */
    consentAt: IsoDate,
    /** `green`: only a commit whose own combined status / checks are green. Absent: the branch head. */
    require: z.literal("green").optional(),
    /** Where it was given, so it can be read. Optional: `consentBy` and `consentAt` are the record. */
    evidence: z.string().min(1).optional(),
  })
  .strict();
export type StandingConsent = z.infer<typeof StandingConsentSchema>;

/** What a per-pin consent keeps of the standing rule it was written under — enough to match the rule still declared. */
export const StandingMarkerSchema = z
  .object({
    follows: BranchSchema,
    consentAt: IsoDate,
    require: z.literal("green").optional(),
  })
  .strict();
export type StandingMarker = z.infer<typeof StandingMarkerSchema>;

/** The marker a rule leaves on the consent it writes. */
export function standingMarkerOf(rule: StandingConsent): StandingMarker {
  return { follows: rule.follows, consentAt: rule.consentAt, ...(rule.require ? { require: rule.require } : {}) };
}

/** A person's explicit consent to mount one harness at one pin. */
export const MountConsentSchema = z
  .object({
    /** Who consented: a person, by the identity they act under here. */
    by: z.string().min(1),
    on: IsoDate,
    /** The pin consented to. Must equal the mount's `ref`; a moved pin asks again. */
    ref: CommitShaSchema,
    /** Where the consent was given (an issue comment, a chat session), so it can be read. */
    evidence: z.string().min(1),
    /**
     * Present when this pin's consent was written under a STANDING consent
     * (`trust.standing`), by the repin tool rather than by the person at this
     * pin. It holds only while that rule is still declared, unchanged.
     */
    standing: StandingMarkerSchema.optional(),
  })
  .strict();
export type MountConsent = z.infer<typeof MountConsentSchema>;

/** A signature over the mounted declaration, by a key in a declared trust network. */
export const MountSignatureSchema = z
  .object({
    /** The trust network the key is listed in, e.g. `gdhcn`. */
    network: z.string().min(1),
    keyId: z.string().min(1),
    /** What was signed: the pinned declaration's sha256, as the lock records it. */
    signedDigest: z.string().regex(/^[0-9a-f]{64}$/),
    value: z.string().min(1),
  })
  .strict();
export type MountSignature = z.infer<typeof MountSignatureSchema>;

export const MountTrustSchema = z
  .object({
    consent: MountConsentSchema.optional(),
    signature: MountSignatureSchema.optional(),
    /** A standing consent for this layer: see "Standing consent" above. */
    standing: StandingConsentSchema.optional(),
  })
  .strict();
export type MountTrust = z.infer<typeof MountTrustSchema>;

/** Was `consent.by` checked against a declared approver list? `unverified` is never clean. */
export type ApproverState = "declared" | "unverified";

/** The basis a mount was allowed on, as the lock records it. */
export const MountTrustBasisSchema = z.discriminatedUnion("basis", [
  /** The caller passed `--staging`. */
  z.object({ basis: z.literal("staging") }).strict(),
  z
    .object({
      basis: z.literal("consent"),
      by: z.string().min(1),
      on: IsoDate,
      ref: CommitShaSchema,
      approver: z.enum(["declared", "unverified"]),
      /** The standing rule this pin's consent was written under, when it was. */
      standing: StandingMarkerSchema.optional(),
    })
    .strict(),
]);
export type MountTrustBasis = z.infer<typeof MountTrustBasisSchema>;

export type TrustVerdict =
  | { ok: true; basis: "staging"; detail: string; record: MountTrustBasis }
  | { ok: true; basis: "consent"; approver: ApproverState; detail: string; record: MountTrustBasis }
  | { ok: false; state: "refused" | "could-not-determine"; detail: string };

/**
 * May this mount proceed? `purpose: "staging"` needs neither signature nor
 * consent, by the owner's ruling; anything else needs consent for this exact
 * pin, because no signature can be verified yet.
 *
 * `approvers` is the layer's declared `mountApprovers`. Non-empty: a
 * consent by anyone else is REFUSED. Absent or empty: a consent proceeds with
 * `approver: "unverified"`.
 */
export function mountTrust(
  mount: { harness: string; ref: string; trust?: MountTrust },
  purpose: "staging" | "mount",
  approvers?: readonly string[],
): TrustVerdict {
  if (purpose === "staging") {
    return { ok: true, basis: "staging", detail: "staging (--staging): a staging preview needs no signature (owner, 2026-10-07)", record: { basis: "staging" } };
  }
  const t = mount.trust;
  if (t?.consent) {
    if (t.consent.ref !== mount.ref) {
      const hint = t.standing
        ? `; a standing consent (follows \`${t.standing.follows}\`) is declared, but a pin is covered only once the repin tool records its consent for that pin`
        : "";
      return {
        ok: false,
        state: "refused",
        detail: `consent by ${t.consent.by} on ${t.consent.on} was for ${t.consent.ref.slice(0, 10)}, not ${mount.ref.slice(0, 10)}: a moved pin asks again${hint}`,
      };
    }
    if (t.consent.standing) {
      const why = standingMismatch(t.consent, t.standing);
      if (why) {
        return {
          ok: false,
          state: "refused",
          detail: `consent for ${mount.ref.slice(0, 10)} was recorded under a standing consent (follows \`${t.consent.standing.follows}\`, given ${t.consent.standing.consentAt}) that ${why}: a pin the rule no longer covers asks again`,
        };
      }
    }
    const declared = (approvers?.length ?? 0) > 0;
    if (declared && !approvers!.includes(t.consent.by)) {
      return {
        ok: false,
        state: "refused",
        detail: `consent for \`${mount.harness}\` is by ${t.consent.by}, who is not among the declared mountApprovers (${approvers!.join(", ")})`,
      };
    }
    const approver: ApproverState = declared ? "declared" : "unverified";
    const standing = t.consent.standing;
    return {
      ok: true,
      basis: "consent",
      approver,
      detail: `consented by ${t.consent.by} on ${t.consent.on} (${t.consent.evidence})${standing ? ` under a standing consent following \`${standing.follows}\`${standing.require ? ` (${standing.require} only)` : ""}` : ""}${declared ? "" : "; UNVERIFIED APPROVER: the instance declares no mountApprovers, so nothing checked who that is"}`,
      record: { basis: "consent", by: t.consent.by, on: t.consent.on, ref: t.consent.ref, approver, ...(standing ? { standing } : {}) },
    };
  }
  if (t?.signature) {
    return {
      ok: false,
      state: "could-not-determine",
      detail: `signed by ${t.signature.keyId} in \`${t.signature.network}\`, but no verifier for that network exists yet; an unverified signature is not trust. Record a person's consent for this pin, or build the verifier.`,
    };
  }
  return { ok: false, state: "refused", detail: `\`${mount.harness}\` at ${mount.ref.slice(0, 10)} is unsigned and unconsented, so it is not mounted (H8)` };
}

/**
 * What a person said when they consented, before it is bound to a pin: who,
 * where it can be read, and optionally when (default: today, UTC).
 */
export interface ConsentGrant {
  by: string;
  evidence: string;
  on?: string;
  /** Set when the grant is a standing rule's, not a person's at this pin ({@link withStandingConsent}). */
  standing?: StandingMarker;
}

/**
 * Why a consent recorded under a standing rule is no longer covered by the
 * rule declared now, or `undefined` when it still is. The rule is matched on
 * everything that defines it — who gave it, when, the branch, and `require` —
 * so editing any of them re-asks every pin recorded under the old one.
 */
export function standingMismatch(consent: MountConsent, declared: StandingConsent | undefined): string | undefined {
  const m = consent.standing;
  if (!m) return "is not a standing consent";
  if (!declared) return "is no longer declared on this instance";
  if (declared.consentBy !== consent.by) return `was given by ${consent.by}, but the rule declared now is ${declared.consentBy}'s`;
  if (declared.consentAt !== m.consentAt) return `was given ${m.consentAt}, but the rule declared now was given ${declared.consentAt}`;
  if (declared.follows !== m.follows) return `followed \`${m.follows}\`, but the rule declared now follows \`${declared.follows}\``;
  if ((declared.require ?? null) !== (m.require ?? null)) return `required ${m.require ?? "nothing"}, but the rule declared now requires ${declared.require ?? "nothing"}`;
  return undefined;
}

/** What the repin tool knows about one candidate commit of a followed branch. */
export interface StandingCandidate {
  /** The branch the commit was resolved from — it must be the one the rule follows. */
  branch: string;
  sha: string;
  /** The commit's own combined status / checks: `green` only when every one concluded successfully. */
  verdict?: "green" | "pending" | "red" | "none";
}

/**
 * THE coverage decision: may `rule` move `mount`'s pin to `candidate`? Pure, so
 * the repin tool and its tests share one answer. Covered only when the rule is
 * declared on this mount, the candidate came from the branch it follows, and —
 * with `require: "green"` — the candidate's own verdict is green. A pin that
 * would not move (same sha) is reported as such, not as covered.
 */
export function standingCovers(
  mount: { harness: string; ref: string; trust?: MountTrust },
  candidate: StandingCandidate,
): { covered: true; rule: StandingConsent } | { covered: false; reason: string } {
  const rule = mount.trust?.standing;
  if (!rule) return { covered: false, reason: `\`${mount.harness}\` declares no standing consent: its pin moves only when a person consents again` };
  if (!CommitShaSchema.safeParse(candidate.sha).success) return { covered: false, reason: `\`${candidate.sha}\` is not a full commit sha` };
  if (candidate.branch !== rule.follows) return { covered: false, reason: `the candidate came from \`${candidate.branch}\`, but the standing consent follows \`${rule.follows}\`` };
  if (rule.require === "green" && candidate.verdict !== "green") {
    return { covered: false, reason: `${candidate.sha.slice(0, 10)} is ${candidate.verdict ?? "unknown"}, and the standing consent requires green` };
  }
  if (candidate.sha === mount.ref) return { covered: false, reason: `already pinned at ${candidate.sha.slice(0, 10)}` };
  return { covered: true, rule };
}

/**
 * Re-pin `mount` to `ref` under its standing consent: the pin moves, and a
 * consent for exactly that pin is written in the same object, `by` the rule's
 * person and marked with the rule ({@link standingMarkerOf}), so
 * {@link mountTrust} accepts it while the rule stands. Throws when the mount
 * declares no standing consent — a pin is never moved on nobody's word.
 */
export function withStandingConsent<T extends { ref: string; trust?: MountTrust }>(mount: T, ref: string, on?: string): T {
  const rule = mount.trust?.standing;
  if (!rule) throw new Error("no standing consent is declared on this mount; a moved pin asks again");
  return withConsent({ ...mount, ref }, standingGrantOf(rule, on));
}

/** The {@link ConsentGrant} a standing rule gives each pin it covers. */
export function standingGrantOf(rule: StandingConsent, on?: string): ConsentGrant {
  const evidence =
    `standing consent by ${rule.consentBy} given ${rule.consentAt}: follow \`${rule.follows}\`${rule.require ? ` (${rule.require} commits only)` : ""}` + (rule.evidence ? ` — ${rule.evidence}` : "");
  return { by: rule.consentBy, evidence, on, standing: standingMarkerOf(rule) };
}

/**
 * SEEDING writes consent; it is not left for hand editing (task #10, gap c).
 * Whatever creates or re-pins a remote layer in `index.config.json` passes
 * the person's grant here, and the mount comes back carrying
 * `trust.consent {by, on, ref, evidence}` with `ref` taken from the mount
 * itself — so the consent is for exactly the pin being written, and
 * {@link mountTrust} accepts it.
 *
 * A consent ALREADY recorded for this same pin is kept as it is: it is that
 * person's record, and a second grant does not rewrite who said yes first.
 * A consent for a DIFFERENT pin is replaced — a moved pin asks again, and the
 * grant passed here is the asking. A signature, if any, is kept beside it.
 * The grant is validated with {@link MountConsentSchema}, so an empty `by` or
 * `evidence` throws rather than writing consent nobody can read.
 */
export function withConsent<T extends { ref: string; trust?: MountTrust }>(mount: T, grant: ConsentGrant): T {
  if (mount.trust?.consent?.ref === mount.ref) return mount;
  const consent = MountConsentSchema.parse({
    by: grant.by,
    // input-site: inert #0e0591be — default date when stamping a new consent grant; never reached by a read-only check
    on: grant.on ?? new Date().toISOString().slice(0, 10),
    ref: mount.ref,
    evidence: grant.evidence,
    ...(grant.standing ? { standing: grant.standing } : {}),
  });
  return { ...mount, trust: { ...mount.trust, consent } };
}
