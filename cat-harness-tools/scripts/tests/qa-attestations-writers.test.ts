/**
 * C11, per writer: with the derived prior report ABSENT, every attestation
 * survives. Bean `8wj1` (arc `3fva`, reader-audit family F4).
 *
 * Each writer used to keep a block's agent and human verdicts only by reading
 * the prior report and carrying them forward, so a run with no prior — which
 * moving `test/results/` to the `qa-reports` branch makes ordinary — wrote a
 * report without them and said nothing. Every writer now reads them from the
 * attestation store (`schemas/sdlc/qa-attestations.ts`), and refuses with
 * exit 4 when the store cannot be read.
 *
 * The writers are CLIs with top-level state, so each is SPAWNED against a
 * throwaway content repository: `.git` anchors the content root, and a
 * declaration names `content/` as the folio. The translation writer's merge is
 * a function and is tested as one.
 *
 * Writer families:
 * - block, script-only: `qa-sweep`, `integration-audit` (`language-trap-audit`
 *   moved to `folio-assistant-sci` in bean `saqd` and is tested there;
 *   `q-usage-audit` shares `finalizeCriteria(…, "script")` but needs
 *   a paper layout to run at all; covered at the library level in
 *   `qa-attestations.test.ts`);
 * - block, attesting: `qa-merge-findings`, `qa-agent-entry`, `qa-agent-write`
 *   (and `proof-narrative-lean-equiv-sweep`, which needs a Lean sibling;
 *   same library-level coverage);
 * - translation: `translation-block-qa`'s `mergeWithAttestations`.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { blockQaPath } from "../../pipeline/qa-paths";
import {
  attestationPath,
  blockAttestationKey,
  criteriaAttestationsHome,
  entryIdentity,
  readCriteriaAttestations as readAttestations,
  translationAttestationKey,
  writeCriteriaAttestations as writeAttestations,
  type CriteriaMap,
} from "../../schemas/sdlc/qa-attestations.ts";
import { mergeWithAttestations } from "../../pipeline/translation-block-qa";
import { writeDeclaration } from "../../test/support/instance-fixture";

const PIPELINE = resolve(import.meta.dir, "..", "..", "pipeline");
const SRC = resolve(import.meta.dir, "..", "..", "src");

/** A spawn is ~1.5 s cold; three per test at most. */
const BUDGET = 30_000;

const ADJUDICATION = {
  field_hash: { md: "000000000000" },
  result: "pass",
  reviewer: { kind: "agent", id: "voice-editorial-review", version: "claude-opus-5" },
  reviewed_at: "2026-09-18T23:52:40.659Z",
  reviewed_sha: "339c01a7b8fb032ec02f807456a076bb4dceec78",
  notes: "Quoted speech — the author is showing an utterance, not speaking.",
};
const HUMAN = { ...ADJUDICATION, result: "fail", reviewer: { kind: "human", id: "owner" }, notes: "Overruled." };

interface Fixture {
  root: string;
  blockRoot: string;
  md: string;
  sidecars: string;
  cleanup: () => void;
}

/** A content repo with one block, a store holding two attestations on it, and NO derived report. */
function fixture(): Fixture {
  // NESTED one level, inside a REAL repository: the criteria registry asks git
  // for the top level and then scans the layers beside it (`repoRootFor` is
  // the parent directory), so a fixture directly under the temp directory would
  // read every other test's fixture as a sibling layer.
  const parent = realpathSync(mkdtempSync(join(tmpdir(), "qa-attest-writers-")));
  const root = join(parent, "repo");
  mkdirSync(root);
  if (spawnSync("git", ["init", "-q"], { cwd: root }).status !== 0) throw new Error("git init failed");
  writeDeclaration(root, {
    name: "probe",
    description: "one folio directory",
    directories: [{ id: "folio", path: "content/", graphTypologies: ["folio"] }],
  });
  mkdirSync(join(root, "content", "ch1"), { recursive: true });
  const blockRoot = join(root, "content", "ch1", "blk");
  writeFileSync(`${blockRoot}.ts`, 'export default prose({ label: "sec:blk", body: "x" });\n');
  writeFileSync(`${blockRoot}.md`, "We are excited to begin this journey. Thank you, dear reader.\n");
  writeAttestations(root, blockAttestationKey(root, blockRoot), {
    "voice-emoji-content": [ADJUDICATION],
    "human-only-axis": [HUMAN],
  });
  const sidecars = join(root, ".sidecars");
  mkdirSync(sidecars);
  return { root, blockRoot, md: `${blockRoot}.md`, sidecars, cleanup: () => rmSync(parent, { recursive: true, force: true }) };
}

function run(cwd: string, args: string[]) {
  // `env` explicitly: Bun's child_process does not inherit variables set at
  // runtime, and standalone the test preload sets FOLIO_FIXTURE_CHECKOUT —
  // without it the sweep sees no vocabulary and recognises no block.
  return spawnSync("bun", args, { cwd, encoding: "utf-8", env: { ...process.env } });
}

/** The two seeded attestations are in the derived report AND unchanged in the store. */
function expectSurvived(t: Fixture, extra = 0): void {
  const report = JSON.parse(readFileSync(blockQaPath(t.root, t.blockRoot), "utf-8")) as { criteria: CriteriaMap };
  const all = Object.values(report.criteria).flat().map(entryIdentity);
  expect(all).toContain(entryIdentity(ADJUDICATION));
  expect(all).toContain(entryIdentity(HUMAN));
  const store = readAttestations(t.root, blockAttestationKey(t.root, t.blockRoot));
  expect(store.state).toBe("hit");
  if (store.state !== "hit") return;
  const held = Object.values(store.criteria).flat().map(entryIdentity);
  expect(held).toContain(entryIdentity(ADJUDICATION));
  expect(held).toContain(entryIdentity(HUMAN));
  expect(held).toHaveLength(2 + extra);
}

describe("block, script-only writers — prior ABSENT", () => {
  test("qa-sweep keeps both attestations, leading their criterion", () => {
    const t = fixture();
    try {
      expect(existsSync(blockQaPath(t.root, t.blockRoot))).toBe(false);
      const r = run(t.root, [join(PIPELINE, "qa-sweep.ts"), join(t.root, "content"), "--only", "voice-emoji-content", "--script-sidecar-root", t.sidecars]);
      expect(r.status).toBe(0);
      expectSurvived(t);
      const report = JSON.parse(readFileSync(blockQaPath(t.root, t.blockRoot), "utf-8")) as { criteria: CriteriaMap };
      expect(entryIdentity(report.criteria["voice-emoji-content"]![0])).toBe(entryIdentity(ADJUDICATION));
    } finally {
      t.cleanup();
    }
  }, BUDGET);

  test("(b) qa-sweep with a CORRUPT store writes nothing and exits 4", () => {
    const t = fixture();
    try {
      writeFileSync(attestationPath(t.root, blockAttestationKey(t.root, t.blockRoot)), "<<<<<<< ours\n");
      const r = run(t.root, [join(PIPELINE, "qa-sweep.ts"), join(t.root, "content"), "--only", "voice-emoji-content", "--script-sidecar-root", t.sidecars]);
      expect(r.status).toBe(4);
      expect(r.stderr).toContain("UNKNOWN");
      expect(existsSync(blockQaPath(t.root, t.blockRoot))).toBe(false);
      expect(readFileSync(attestationPath(t.root, blockAttestationKey(t.root, t.blockRoot)), "utf-8")).toBe("<<<<<<< ours\n");
    } finally {
      t.cleanup();
    }
  }, BUDGET);

  test("(a) owner ruling 2: NO store, a prior report holding judgements — qa-sweep moves them into a new store as it saves", () => {
    const t = fixture();
    try {
      // The folio has never had a store: remove the one the fixture seeded.
      rmSync(criteriaAttestationsHome(t.root).storeRoot, { recursive: true, force: true });
      const path = blockQaPath(t.root, t.blockRoot);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, JSON.stringify({
        $schema: "block-qa/v1", label: "sec:blk", kind: "prose", paths: {}, source_hashes: {},
        criteria: { "voice-emoji-content": [ADJUDICATION], "human-only-axis": [HUMAN] }, updated_at: "t",
      }));
      const r = run(t.root, [join(PIPELINE, "qa-sweep.ts"), join(t.root, "content"), "--only", "voice-emoji-content", "--script-sidecar-root", t.sidecars]);
      expect(r.status).toBe(0);
      // In the store now, verbatim — and still in the report's projection.
      expectSurvived(t);
    } finally {
      t.cleanup();
    }
  }, BUDGET);

  test("qa-sweep with a prior that carries a judgement the store's file does not hold refuses (conflict)", () => {
    const t = fixture();
    try {
      const stray = { ...ADJUDICATION, notes: "not in the store" };
      const path = blockQaPath(t.root, t.blockRoot);
      mkdirSync(join(path, ".."), { recursive: true });
      const prior = JSON.stringify({ $schema: "block-qa/v1", label: "sec:blk", kind: "prose", paths: {}, source_hashes: {}, criteria: { x: [stray] }, updated_at: "t" });
      writeFileSync(path, prior);
      const r = run(t.root, [join(PIPELINE, "qa-sweep.ts"), join(t.root, "content"), "--only", "voice-emoji-content", "--script-sidecar-root", t.sidecars]);
      expect(r.status).toBe(4);
      expect(r.stderr).toContain("conflict");
      expect(readFileSync(path, "utf-8")).toBe(prior);
    } finally {
      t.cleanup();
    }
  }, BUDGET);

  test("integration-audit, over a prior that LOST its attestations, puts them back", () => {
    const t = fixture();
    try {
      const path = blockQaPath(t.root, t.blockRoot);
      mkdirSync(join(path, ".."), { recursive: true });
      const script = { field_hash: {}, result: "fail", reviewer: { kind: "script", id: "s" }, reviewed_at: "t", reviewed_sha: "x" };
      writeFileSync(path, JSON.stringify({ $schema: "block-qa/v1", label: "sec:blk", kind: "prose", paths: {}, source_hashes: {}, criteria: { "voice-emoji-content": [script] }, updated_at: "t" }));
      const r = run(t.root, [join(PIPELINE, "integration-audit.ts"), join(t.root, "content"), "--criteria", "voice-emoji-content", "--no-sweep"]);
      expect(r.status).toBe(0);
      expectSurvived(t);
    } finally {
      t.cleanup();
    }
  }, BUDGET);
});

describe("block, attesting writers — prior ABSENT", () => {
  test("qa-merge-findings records the new adjudication in the store beside the old ones", () => {
    const t = fixture();
    try {
      const batch = join(t.root, "batch.json");
      writeFileSync(batch, JSON.stringify({
        reviewer: { kind: "agent", id: "second-reviewer", version: "v1" },
        findings: [{ block_root: t.blockRoot, criterion: "voice-emoji-content", result: "warn", notes: "n" }],
      }));
      const r = run(t.root, [join(PIPELINE, "qa-merge-findings.ts"), "--file", batch]);
      expect(r.status).toBe(0);
      expectSurvived(t, 1);
    } finally {
      t.cleanup();
    }
  }, BUDGET);

  test("qa-agent-entry", () => {
    const t = fixture();
    try {
      const r = run(t.root, [join(PIPELINE, "qa-agent-entry.ts"), "--block", t.md, "--criterion", "voice-emoji-content", "--result", "pass", "--id", "third"]);
      expect(r.status).toBe(0);
      expectSurvived(t, 1);
    } finally {
      t.cleanup();
    }
  }, BUDGET);

  test("qa-agent-write", () => {
    const t = fixture();
    try {
      const r = run(t.root, [join(SRC, "qa-agent-write.ts"), "--block", t.blockRoot, "--criterion", "voice-emoji-content", "--result", "pass"]);
      expect(r.status).toBe(0);
      expectSurvived(t, 1);
    } finally {
      t.cleanup();
    }
  }, BUDGET);

  test("an attesting writer with an unreadable store exits 4 and writes nothing", () => {
    const t = fixture();
    try {
      const key = blockAttestationKey(t.root, t.blockRoot);
      writeFileSync(attestationPath(t.root, key), "{ garbled");
      const r = run(t.root, [join(PIPELINE, "qa-agent-entry.ts"), "--block", t.md, "--criterion", "c", "--result", "pass"]);
      expect(r.status).toBe(4);
      expect(existsSync(blockQaPath(t.root, t.blockRoot))).toBe(false);
      expect(readFileSync(attestationPath(t.root, key), "utf-8")).toBe("{ garbled");
    } finally {
      t.cleanup();
    }
  }, BUDGET);
});

describe("translation — prior ABSENT", () => {
  const roundtrip = { result: "pass", reviewer: { kind: "agent", id: "roundtrip-adjudicator" }, notes: "r" };
  const fresh = {
    "translation-coverage": [{ result: "pass", reviewer: { kind: "script", id: "pipeline/translation-block-qa.ts" } }],
    // The sweep declares this criterion and writes `[]` — which is how the two real ones were lost.
    "translation-semantic-roundtrip": [],
  } as never;

  test("the store's verdicts are merged in, on the criterion the sweep leaves empty", () => {
    const root = mkdtempSync(join(tmpdir(), "qa-attest-tr-"));
    try {
      const subject = join(root, "content", "p");
      writeAttestations(root, translationAttestationKey(root, subject, "fr"), { "translation-semantic-roundtrip": [roundtrip] });
      const m = mergeWithAttestations(root, subject, "fr", undefined, fresh);
      expect(m.ok).toBe(true);
      if (!m.ok) return;
      expect(m.criteria["translation-semantic-roundtrip"]!.map(entryIdentity)).toEqual([entryIdentity(roundtrip)]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an unreadable store file is a refusal, never an empty merge", () => {
    const root = mkdtempSync(join(tmpdir(), "qa-attest-tr-"));
    try {
      const key = translationAttestationKey(root, join(root, "p"), "fr");
      mkdirSync(join(attestationPath(root, key), ".."), { recursive: true });
      writeFileSync(attestationPath(root, key), "{ garbled");
      const m = mergeWithAttestations(root, join(root, "p"), "fr", undefined, fresh);
      expect(m.ok).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("(a) owner ruling 2: NO store, the prior carries the round-trip verdicts — they are kept and marked to move", () => {
    const root = mkdtempSync(join(tmpdir(), "qa-attest-tr-"));
    try {
      const subject = join(root, "content", "p");
      const prior = { criteria: { "translation-semantic-roundtrip": [roundtrip] } } as never;
      const m = mergeWithAttestations(root, subject, "fr", prior, fresh);
      expect(m.ok).toBe(true);
      if (!m.ok) return;
      expect(m.resolution.adopt).toBe(true);
      expect(m.criteria["translation-semantic-roundtrip"]!.map(entryIdentity)).toEqual([entryIdentity(roundtrip)]);
      expect(existsSync(criteriaAttestationsHome(root).storeRoot)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
