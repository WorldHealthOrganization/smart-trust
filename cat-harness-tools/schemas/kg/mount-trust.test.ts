import { describe, expect, test } from "bun:test";
import { mountTrust, MountTrustBasisSchema, MountTrustSchema, standingCovers, withConsent, withStandingConsent, type MountTrust, type StandingConsent } from "./mount-trust.ts";

/** A mount as `withConsent` sees it: `trust` optional, so a bare literal still type-checks its result. */
type Mount = { harness: string; ref: string; trust?: MountTrust };

const PIN = "a".repeat(40);
const OTHER = "b".repeat(40);
const consent = (ref: string) => ({ consent: { by: "litlfred", on: "2026-10-07", ref, evidence: "issue #2389" } });

describe("mount trust (H8): signed provenance or explicit consent; staging needs neither", () => {
  test("staging mounts with no signature and no consent", () => {
    expect(mountTrust({ harness: "x", ref: PIN }, "staging")).toMatchObject({ ok: true, basis: "staging" });
  });

  test("unsigned and unconsented is REFUSED", () => {
    expect(mountTrust({ harness: "x", ref: PIN }, "mount")).toMatchObject({ ok: false, state: "refused" });
  });

  test("consent for this exact pin mounts", () => {
    expect(mountTrust({ harness: "x", ref: PIN, trust: consent(PIN) }, "mount")).toMatchObject({ ok: true, basis: "consent" });
  });

  test("consent for a different pin is refused: a moved pin asks again", () => {
    expect(mountTrust({ harness: "x", ref: PIN, trust: consent(OTHER) }, "mount")).toMatchObject({ ok: false, state: "refused" });
  });

  test("a signature with no verifier is could-not-determine, never trusted", () => {
    const trust = { signature: { network: "gdhcn", keyId: "k1", signedDigest: "c".repeat(64), value: "sig" } };
    expect(mountTrust({ harness: "x", ref: PIN, trust }, "mount")).toMatchObject({ ok: false, state: "could-not-determine" });
  });

  test("the record is strict: an unknown trust key does not validate", () => {
    expect(MountTrustSchema.safeParse({ trusted: true }).success).toBe(false);
    expect(MountTrustSchema.safeParse(consent(PIN)).success).toBe(true);
  });

  test("the verdict carries the record the lock keeps: who, when, and whether the approver was checked", () => {
    expect(mountTrust({ harness: "x", ref: PIN, trust: consent(PIN) }, "mount", ["litlfred"])).toMatchObject({
      ok: true,
      approver: "declared",
      record: { basis: "consent", by: "litlfred", on: "2026-10-07", ref: PIN, approver: "declared" },
    });
    expect(mountTrust({ harness: "x", ref: PIN }, "staging")).toMatchObject({ record: { basis: "staging" } });
  });

  test("no declared approvers: consent proceeds but is UNVERIFIED, never plain clean", () => {
    const v = mountTrust({ harness: "x", ref: PIN, trust: consent(PIN) }, "mount");
    expect(v).toMatchObject({ ok: true, approver: "unverified" });
    expect(v.detail).toContain("UNVERIFIED APPROVER");
    expect(mountTrust({ harness: "x", ref: PIN, trust: consent(PIN) }, "mount", [])).toMatchObject({ approver: "unverified" });
  });

  test("declared approvers: consent by anyone else is refused", () => {
    expect(mountTrust({ harness: "x", ref: PIN, trust: consent(PIN) }, "mount", ["someone-else"])).toMatchObject({ ok: false, state: "refused" });
  });

  test("the recorded basis is strict: a consent basis needs who, when, the pin and the approver state", () => {
    expect(MountTrustBasisSchema.safeParse({ basis: "staging" }).success).toBe(true);
    expect(MountTrustBasisSchema.safeParse({ basis: "consent", by: "a", on: "2026-10-07", ref: PIN, approver: "declared" }).success).toBe(true);
    expect(MountTrustBasisSchema.safeParse({ basis: "consent", by: "a", on: "2026-10-07", ref: PIN }).success).toBe(false);
    expect(MountTrustBasisSchema.safeParse({ basis: "signature" }).success).toBe(false);
  });
});

describe("withConsent: seeding writes consent for the pin it writes (task #10, gap c)", () => {
  const grant = { by: "litlfred", evidence: "session X: 'repin as needed'", on: "2026-10-12" };

  test("an unconsented mount gains consent bound to ITS ref, and then mounts", () => {
    const m = withConsent<Mount>({ harness: "x", ref: PIN }, grant);
    expect(m.trust?.consent).toEqual({ by: "litlfred", on: "2026-10-12", ref: PIN, evidence: grant.evidence });
    expect(mountTrust(m, "mount")).toMatchObject({ ok: true, basis: "consent" });
  });

  test("a consent for a moved pin is replaced by the new grant", () => {
    const m = withConsent({ harness: "x", ref: PIN, trust: consent(OTHER) }, grant);
    expect(m.trust?.consent?.ref).toBe(PIN);
    expect(m.trust?.consent?.evidence).toBe(grant.evidence);
  });

  test("a consent already recorded for this pin is kept, not rewritten", () => {
    const before = { harness: "x", ref: PIN, trust: consent(PIN) };
    expect(withConsent(before, grant)).toBe(before);
  });

  test("a signature is kept beside the new consent", () => {
    const signature = { network: "gdhcn", keyId: "k", signedDigest: "c".repeat(64), value: "v" };
    expect(withConsent({ harness: "x", ref: PIN, trust: { signature } }, grant).trust?.signature).toEqual(signature);
  });

  test("an empty grant throws rather than writing consent nobody can read", () => {
    expect(() => withConsent<Mount>({ harness: "x", ref: PIN }, { by: "", evidence: "e" })).toThrow();
    expect(() => withConsent<Mount>({ harness: "x", ref: PIN }, { by: "b", evidence: "" })).toThrow();
  });

  test("`on` defaults to today", () => {
    expect(withConsent<Mount>({ harness: "x", ref: PIN }, { by: "b", evidence: "e" }).trust?.consent?.on).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe("standing consent (cat-harness-tools#401): a declared rule re-pins, by name, and nothing else moves a pin", () => {
  const rule: StandingConsent = { follows: "main", consentBy: "litlfred", consentAt: "2026-10-16", require: "green" };
  const standingAt = (ref: string, r: StandingConsent = rule): Mount => withStandingConsent<Mount>({ harness: "x", ref: OTHER, trust: { ...consent(OTHER), standing: r } }, ref, "2026-10-17");

  test("the repin writes a per-pin consent BY the rule's person, marked with the rule, and it mounts", () => {
    const m = standingAt(PIN);
    expect(m.ref).toBe(PIN);
    expect(m.trust?.consent).toMatchObject({ by: "litlfred", on: "2026-10-17", ref: PIN, standing: { follows: "main", consentAt: "2026-10-16", require: "green" } });
    expect(MountTrustSchema.safeParse(m.trust).success).toBe(true);
    const v = mountTrust(m, "mount", ["litlfred"]);
    expect(v).toMatchObject({ ok: true, basis: "consent", record: { by: "litlfred", ref: PIN, standing: { follows: "main" } } });
    expect(v.ok && MountTrustBasisSchema.safeParse(v.record).success).toBe(true);
  });

  test("a hand-moved pin is still refused even with a standing rule declared", () => {
    const v = mountTrust({ harness: "x", ref: PIN, trust: { ...consent(OTHER), standing: rule } }, "mount");
    expect(v).toMatchObject({ ok: false, state: "refused" });
    expect(v.detail).toContain("a moved pin asks again");
  });

  test("withdrawing or editing the rule re-asks every pin recorded under it", () => {
    const m = standingAt(PIN);
    const { standing: _s, ...withdrawn } = m.trust!;
    expect(mountTrust({ ...m, trust: withdrawn }, "mount")).toMatchObject({ ok: false, state: "refused" });
    for (const edit of [{ consentBy: "someone" }, { consentAt: "2026-11-01" }, { follows: "dev" }, { require: undefined }]) {
      expect(mountTrust({ ...m, trust: { ...m.trust!, standing: { ...rule, ...edit } } }, "mount")).toMatchObject({ ok: false, state: "refused" });
    }
  });

  test("declared approvers still apply to the rule's person", () => {
    expect(mountTrust(standingAt(PIN), "mount", ["someone-else"])).toMatchObject({ ok: false, state: "refused" });
  });

  test("no rule, no repin: withStandingConsent throws", () => {
    expect(() => withStandingConsent<Mount>({ harness: "x", ref: OTHER, trust: consent(OTHER) }, PIN)).toThrow();
  });

  test("coverage: the followed branch, and green when the rule requires it", () => {
    const m: Mount = { harness: "x", ref: OTHER, trust: { ...consent(OTHER), standing: rule } };
    expect(standingCovers(m, { branch: "main", sha: PIN, verdict: "green" })).toMatchObject({ covered: true });
    expect(standingCovers(m, { branch: "main", sha: PIN, verdict: "pending" })).toMatchObject({ covered: false });
    expect(standingCovers(m, { branch: "main", sha: PIN, verdict: "red" })).toMatchObject({ covered: false });
    expect(standingCovers(m, { branch: "dev", sha: PIN, verdict: "green" })).toMatchObject({ covered: false });
    expect(standingCovers(m, { branch: "main", sha: OTHER, verdict: "green" })).toMatchObject({ covered: false });
    expect(standingCovers(m, { branch: "main", sha: "abc", verdict: "green" })).toMatchObject({ covered: false });
    const head = { ...m, trust: { ...m.trust!, standing: { ...rule, require: undefined } } };
    expect(standingCovers(head, { branch: "main", sha: PIN })).toMatchObject({ covered: true });
    expect(standingCovers({ harness: "x", ref: OTHER, trust: consent(OTHER) }, { branch: "main", sha: PIN, verdict: "green" })).toMatchObject({ covered: false });
  });

  test("the rule is strict: an unknown key or a refs/ branch does not validate", () => {
    expect(MountTrustSchema.safeParse({ standing: rule }).success).toBe(true);
    expect(MountTrustSchema.safeParse({ standing: { ...rule, anyone: true } }).success).toBe(false);
    expect(MountTrustSchema.safeParse({ standing: { ...rule, follows: "refs/heads/main" } }).success).toBe(false);
    expect(MountTrustSchema.safeParse({ standing: { ...rule, require: "red" } }).success).toBe(false);
  });
});
