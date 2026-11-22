/**
 * The attestation store — bean `2gst`. The schema holds only judgements, the
 * path mirrors the derived family's tree, and a read answers in five states
 * where a miss or an absent store is "never attested" only once the prior derived file has been read.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ATTESTATION_FAMILIES,
  attestationPathFor,
  attestationsHomeFor,
  CertificationAttestationsSchema,
  certificationPath,
  fileCertification,
  QA_ATTESTATIONS_SCHEMA,
  QaAttestationsSchema,
  readAttestationFile,
  readCertificationAttestations,
  SectionTitleAttestationsSchema,
  serialiseAttestations,
  writeCertificationAttestations,
  type CertificationAttestations,
  type CertificationEntry,
  type KgAttestations,
} from "./qa-attestations";
import { defaultGraphTypologies } from "../kg/cat-harness";
import { KgQaReportSchema } from "./kg-qa";

const pair = {
  kind: "implements" as const,
  prose: "cat-harness/processes/p.bpmn",
  code: ".github/workflows/p.yml",
  prose_hash: "0123456789ab",
  code_hash: "ba9876543210",
  by: "baseline" as const,
};
const file = (over: Partial<KgAttestations> = {}): KgAttestations => ({
  $schema: QA_ATTESTATIONS_SCHEMA,
  family: "kg-qa",
  subject: { kind: "process", id: "Process_P", path: "processes/p.bpmn" },
  pair_attestations: [pair],
  ...over,
});

describe("qa-attestations/v1", () => {
  test("a kg-qa file with pair attestations and voice reviews validates", () => {
    const voice = {
      voice: "v",
      instance: "i",
      skill_hash: "s",
      voice_hash: "h",
      by: "agent" as const,
      at: "2026-10-01T00:00:00Z",
      verdicts: [{ rule: "r", result: "pass" as const }],
    };
    expect(QaAttestationsSchema.safeParse(file({ voice_reviews: [voice] })).success).toBe(true);
  });

  test("it holds ONLY judgements: a derived field is refused", () => {
    // A store that also took `criteria` or `totals` would be a second copy of
    // the derived verdict, free to disagree with the one on the branch.
    expect(QaAttestationsSchema.safeParse({ ...file(), criteria: {} }).success).toBe(false);
    expect(QaAttestationsSchema.safeParse({ ...file(), totals: {} }).success).toBe(false);
  });

  test("every judgement pins the hash it attested, so staleness is detectable", () => {
    const { code_hash: _drop, ...noHash } = pair;
    expect(QaAttestationsSchema.safeParse(file({ pair_attestations: [noHash as typeof pair] })).success).toBe(false);
  });

  test("the family is one of the shared list: kg-qa (bean 2gst), block-qa and translation-qa (bean 8wj1)", () => {
    expect([...ATTESTATION_FAMILIES]).toEqual([
      "kg-qa",
      "block-qa",
      "translation-qa",
      "bib-verification",
      "bib-human-review",
      "requirement-signoff",
      "certification",
      "section-title",
      "adversarial-review",
    ]);
    expect(QaAttestationsSchema.safeParse({ ...file(), family: "lsi" }).success).toBe(false);
  });

  test("the graph typology is registered, as state, with this validator", () => {
    const kind = defaultGraphTypologies.get("attestations");
    expect(kind?.holds).toBe("state");
    expect(kind?.validator).toBe("schemas/sdlc/qa-attestations.ts#QaAttestationsSchema");
  });
});

describe("where an attestation lives", () => {
  test("the same mirrored path as the derived sidecar, under <home>/<family>/", () => {
    const p = attestationPathFor(
      "/r/inst/test/results/kg-qa/skills/pkg/a.kg-qa.json",
      "/r/inst/test/results/kg-qa",
      "/r/inst/test/attestations",
      "kg-qa",
      ".kg-qa.json",
    );
    expect(p).toBe("/r/inst/test/attestations/kg-qa/skills/pkg/a.attestations.json");
  });

  test("a sidecar outside the derived tree is a caller's bug, never a quiet miss", () => {
    expect(() => attestationPathFor("/elsewhere/a.kg-qa.json", "/r/kg-qa", "/r/att", "kg-qa", ".kg-qa.json")).toThrow();
  });

  test("an instance with no declaration falls back to the convention", () => {
    const root = mkdtempSync(join(tmpdir(), "att-home-"));
    const conv = join(root, "test", "attestations");
    expect(attestationsHomeFor(root)).toEqual({ root: conv, by: "convention", storeRoot: conv });
  });
});

describe("reading — five states, and a miss or an absent store is 'never attested' only after the prior is read", () => {
  // Each test builds its own store in its own temp dir, so no test depends on
  // a file or directory another test left behind, nor on the order they run in.
  const homes: string[] = [];
  afterEach(() => {
    for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true });
  });
  function fresh(withSubjectDir = false): { home: string; tree: string; path: string } {
    const home = mkdtempSync(join(tmpdir(), "att-read-"));
    homes.push(home);
    const tree = join(home, "kg-qa");
    const path = join(tree, "processes", "p.attestations.json");
    if (withSubjectDir) mkdirSync(join(tree, "processes"), { recursive: true });
    return { home, tree, path };
  }

  test("no store at all is ABSENT, not a miss — the writer then moves the prior's judgements (owner ruling 2)", () => {
    const { home, path } = fresh();
    expect(readAttestationFile(path, join(home, "absent")).state).toBe("absent");
  });

  test("a store path that is not a directory is UNKNOWN", () => {
    const { home, path } = fresh();
    const notDir = join(home, "a-file");
    writeFileSync(notDir, "");
    expect(readAttestationFile(path, notDir).state).toBe("unknown");
  });

  test("a store with no file for this subject is a miss — even with no family tree under it yet", () => {
    const { home, tree, path } = fresh();
    expect(readAttestationFile(path, home).state).toBe("miss");
    mkdirSync(join(tree, "processes"), { recursive: true });
    expect(readAttestationFile(path, tree).state).toBe("miss");
  });

  test("a conflict-marked or invalid file is CORRUPT, never an empty list", () => {
    const { tree, path } = fresh(true);
    writeFileSync(path, "<<<<<<< ours\n{}\n=======\n{}\n>>>>>>> theirs\n");
    expect(readAttestationFile(path, tree).state).toBe("corrupt");
    writeFileSync(path, JSON.stringify({ $schema: QA_ATTESTATIONS_SCHEMA, family: "kg-qa" }));
    expect(readAttestationFile(path, tree).state).toBe("corrupt");
  });

  test("a valid file is a hit, returned as written — key order included", () => {
    const { tree, path } = fresh(true);
    // Keys deliberately NOT in schema order: zod would rebuild them, and a
    // writer round-tripping through it would rewrite every entry.
    const reordered = { ...file(), pair_attestations: [{ reason: "r", ...pair, by: "agent" }] };
    writeFileSync(path, serialiseAttestations(reordered as KgAttestations));
    const r = readAttestationFile(path, tree);
    expect(r.state).toBe("hit");
    if (r.state !== "hit") return;
    expect(JSON.stringify(r.file)).toBe(JSON.stringify(reordered));
    expect(r.text.endsWith("\n")).toBe(true);
  });
});

describe("the kg-qa sidecar no longer carries judgements", () => {
  test("KgQaReportSchema refuses pair_attestations and voice_reviews", () => {
    const derived = { $schema: "kg-qa/v1", subject: { kind: "process", id: "P", path: "p.bpmn" }, source_hash: null, criteria: {}, totals: { pass: 0, fail: 0, "n/a": 0, unknown: 0 } };
    expect(KgQaReportSchema.safeParse(derived).success).toBe(true);
    expect(KgQaReportSchema.safeParse({ ...derived, pair_attestations: [pair] }).success).toBe(false);
    expect(KgQaReportSchema.safeParse({ ...derived, voice_reviews: [] }).success).toBe(false);
  });
});

describe("the certification family (bean zaui)", () => {
  const certEntry: CertificationEntry = {
    signer: { kind: "agent", id: "certifier-bot", actor: "certifier" },
    timestamp: "2026-10-09T12:00:00Z",
    verdict: "certified",
    decision: "certified",
    testPlanId: "test-plan-core-v1",
    reqId: ["req:auth-tokens", "req:session-expiry"],
    signature: {
      algorithm: "ed25519",
      value: "sig_abc123",
      signed_at: "2026-10-09T12:00:05Z",
    },
    evidence: "https://github.com/litlfred/cat-harness/issues/123#issuecomment-456",
    notes: "All test cases passed exit criteria",
  };

  const certDoc: CertificationAttestations = {
    $schema: QA_ATTESTATIONS_SCHEMA,
    family: "certification",
    subject: {
      kind: "test-report",
      id: "report-2026-10-09",
      path: "tests/crdm/report-2026-10-09.json",
    },
    certifications: [certEntry],
  };

  test("a certification file validates against CertificationAttestationsSchema and QaAttestationsSchema", () => {
    expect(CertificationAttestationsSchema.safeParse(certDoc).success).toBe(true);
    expect(QaAttestationsSchema.safeParse(certDoc).success).toBe(true);
  });

  test("a certification entry requires either verdict or decision", () => {
    const { verdict: _v, decision: _d, ...noVerdictOrDecision } = certEntry;
    expect(CertificationAttestationsSchema.safeParse({ ...certDoc, certifications: [noVerdictOrDecision] }).success).toBe(false);
    expect(CertificationAttestationsSchema.safeParse({ ...certDoc, certifications: [{ ...certEntry, decision: undefined }] }).success).toBe(true);
    expect(CertificationAttestationsSchema.safeParse({ ...certDoc, certifications: [{ ...certEntry, verdict: undefined }] }).success).toBe(true);
  });

  test("certificationPath resolves under <attestationsHome>/certification/", () => {
    const root = "/repo/test/attestations";
    expect(certificationPath(root, "plan-123")).toBe("/repo/test/attestations/certification/plan-123.attestations.json");
    expect(certificationPath(root, "sub/dir/report.json")).toBe("/repo/test/attestations/certification/sub/dir/report.attestations.json");
    expect(certificationPath(root, "my-cert.attestations.json")).toBe("/repo/test/attestations/certification/my-cert.attestations.json");
  });

  test("a filed certification round-trips cleanly through the store", () => {
    const root = mkdtempSync(join(tmpdir(), "cert-roundtrip-"));
    const id = "tests/plan-1/report-1";
    try {
      // 1. Initially missing
      const initial = readCertificationAttestations(root, id);
      expect(initial.state).toBe("absent");

      // 2. File / write certification
      const writeRes = writeCertificationAttestations(root, id, certDoc);
      expect(writeRes.ok).toBe(true);
      if (!writeRes.ok) return;
      expect(writeRes.written).toBe(true);

      // 3. Read back
      const readRes = readCertificationAttestations(root, id);
      expect(readRes.state).toBe("hit");
      if (readRes.state !== "hit") return;
      expect(readRes.file).toEqual(certDoc);
      expect(readRes.file.certifications[0]?.testPlanId).toBe("test-plan-core-v1");
      expect(readRes.file.certifications[0]?.verdict).toBe("certified");

      // 4. Writing identical data is a no-op (written: false)
      const reWrite = fileCertification(root, id, certDoc);
      expect(reWrite.ok).toBe(true);
      if (!reWrite.ok) return;
      expect(reWrite.written).toBe(false);

      // 5. Append a second certification entry
      const secondEntry: CertificationEntry = {
        signer: "human:auditor",
        timestamp: "2026-10-09T13:00:00Z",
        verdict: "certified",
        testPlanId: "test-plan-core-v1",
      };
      const appendRes = writeCertificationAttestations(root, id, {
        subject: certDoc.subject,
        certification: secondEntry,
      });
      expect(appendRes.ok).toBe(true);
      const afterAppend = readCertificationAttestations(root, id);
      expect(afterAppend.state).toBe("hit");
      if (afterAppend.state !== "hit") return;
      expect(afterAppend.file.certifications).toHaveLength(2);
      expect(afterAppend.file.certifications[1]?.signer).toBe("human:auditor");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("corrupt store handling returns corrupt/unknown and refuses write", () => {
    const root = mkdtempSync(join(tmpdir(), "cert-corrupt-"));
    const id = "tests/plan-1/report-corrupt";

    try {
      const p = certificationPath(root, id);
      mkdirSync(join(p, ".."), { recursive: true });
      writeFileSync(p, "<<<<<<< ours\n");

      // Reading a corrupt file returns state corrupt
      const r = readCertificationAttestations(root, id);
      expect(r.state).toBe("corrupt");

      // Writing to a corrupt store is refused
      const w = writeCertificationAttestations(root, id, certDoc);
      expect(w.ok).toBe(false);
      if (w.ok) return;
      expect(w.state).toBe("corrupt");
      expect(readFileSync(p, "utf-8")).toBe("<<<<<<< ours\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an unreadable/non-directory store root returns unknown and refuses write", () => {
    const root = mkdtempSync(join(tmpdir(), "cert-unknown-"));
    const id = "tests/plan-1/report-unknown";

    try {
      const storeRoot = join(root, "test", "attestations");
      mkdirSync(join(root, "test"), { recursive: true });
      writeFileSync(storeRoot, "not a directory");

      const r = readCertificationAttestations(root, id);
      expect(r.state).toBe("unknown");

      const w = writeCertificationAttestations(root, id, certDoc);
      expect(w.ok).toBe(false);
      if (w.ok) return;
      expect(w.state).toBe("unknown");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the `section-title` family — bean 5qy8, owner's option 1", () => {
  const verdict = {
    title: "Setting the scene",
    depth: 1,
    result: "pass",
    reviewer: "agent",
    reviewed_hash: "abc123",
    stale_mode: "thorough" as const,
    reviewed_at: "2026-10-11T07:00:00Z",
    note: null,
  };
  const st = (title_coherence: unknown) => ({
    $schema: QA_ATTESTATIONS_SCHEMA,
    family: "section-title",
    subject: { kind: "paper", id: "my-paper", path: "folio/my-paper" },
    title_coherence,
  });

  test("a decided verdict per chapter and section parses, through the shared union", () => {
    expect(QaAttestationsSchema.safeParse(st({ "01-intro": { "1.1": verdict } })).success).toBe(true);
  });

  test("`pending` is refused — it is the absence of a judgement, and the store holds judgements only", () => {
    expect(SectionTitleAttestationsSchema.safeParse(st({ "01-intro": { "1.1": { ...verdict, result: "pending" } } })).success).toBe(false);
  });

  test("a verdict without the hash it reviewed is refused — staleness is recomputed from it", () => {
    const { reviewed_hash: _drop, ...noHash } = verdict;
    expect(SectionTitleAttestationsSchema.safeParse(st({ "01-intro": { "1.1": noHash } })).success).toBe(false);
  });

  test("an anonymous verdict is refused", () => {
    expect(SectionTitleAttestationsSchema.safeParse(st({ "01-intro": { "1.1": { ...verdict, reviewer: "" } } })).success).toBe(false);
  });
});
