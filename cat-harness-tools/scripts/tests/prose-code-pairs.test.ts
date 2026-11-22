/**
 * `prose-reviewed-since-code-changed` — bean `cuxx`, issue #1042 (R1, R2).
 *
 * The rule under test is asymmetric on purpose: a CODE change with the prose
 * standing still is a finding; a prose edit never is. Each case below builds a
 * throwaway repo so the hashes are real.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { attest, discoverPairs, evaluatePairs, evaluatePairsFrom, readAttestations } from "../prose-code-pairs";
import { QA_ATTESTATIONS_SCHEMA, serialiseAttestations, type KgAttestations } from "../../schemas/sdlc/qa-attestations.ts";

const SUBJECT = { kind: "skill", id: "s", path: "skills/pkg/s.md" };

function repo(): { root: string; inst: string } {
  const root = mkdtempSync(join(tmpdir(), "pairs-"));
  const inst = join(root, "inst");
  mkdirSync(join(inst, "processes"), { recursive: true });
  mkdirSync(join(inst, "skills", "pkg"), { recursive: true });
  mkdirSync(join(root, ".github", "workflows"), { recursive: true });
  writeFileSync(join(root, ".github/workflows/w.yml"), "# bpmn: inst/processes/p.bpmn\njobs: {}\n");
  writeFileSync(join(root, ".github/workflows/unrelated.yml"), "# mentions inst/processes/p.bpmn only in prose\njobs: {}\n");
  writeFileSync(join(inst, "processes/p.bpmn"), `<bpmn:process id="P"/>`);
  writeFileSync(join(inst, "skills/pkg/s.md"), "# s\n");
  writeFileSync(join(inst, "skills/pkg/s.ts"), "export const s = 1;\n");
  writeFileSync(join(inst, "skills/pkg/lonely.md"), "# no code beside me\n");
  return { root, inst };
}

describe("discoverPairs — declared pairs only (R1)", () => {
  test("a workflow naming the diagram (`# bpmn:`, bean 61ca) and a co-located skill .md/.ts", () => {
    const { root, inst } = repo();
    expect(discoverPairs({ kind: "process", path: "processes/p.bpmn" }, inst, root)).toEqual([
      { kind: "implements", prose: "inst/processes/p.bpmn", code: ".github/workflows/w.yml" },
    ]);
    expect(discoverPairs({ kind: "skill", path: "skills/pkg/s.md" }, inst, root)).toEqual([
      { kind: "co-located", prose: "inst/skills/pkg/s.md", code: "inst/skills/pkg/s.ts" },
    ]);
  });

  test("a skill with no code beside it, and a subject with no path, declare nothing", () => {
    const { root, inst } = repo();
    expect(discoverPairs({ kind: "skill", path: "skills/pkg/lonely.md" }, inst, root)).toEqual([]);
    expect(discoverPairs({ kind: "role", path: null }, inst, root)).toEqual([]);
  });
});

describe("evaluatePairs — one-sided change (R2)", () => {
  const setup = () => {
    const { root, inst } = repo();
    const pairs = discoverPairs({ kind: "skill", path: "skills/pkg/s.md" }, inst, root);
    const first = evaluatePairs(pairs, [], root);
    return { root, inst, pairs, first };
  };

  test("first sight records a baseline and passes", () => {
    const { first } = setup();
    expect(first.entry.result).toBe("pass");
    expect(first.attestations[0]!.by).toBe("baseline");
  });

  test("code changed, prose did not → finding, and the old attestation is kept", () => {
    const { root, inst, pairs, first } = setup();
    writeFileSync(join(inst, "skills/pkg/s.ts"), "export const s = 2;\n");
    const r = evaluatePairs(pairs, first.attestations, root);
    expect(r.entry.result).toBe("fail");
    expect(r.entry.findings[0]!.where).toBe("inst/skills/pkg/s.ts");
    expect(r.attestations).toEqual(first.attestations);
  });

  test("prose edited — alone or with the code — never raises, and the baseline moves", () => {
    const { root, inst, pairs, first } = setup();
    writeFileSync(join(inst, "skills/pkg/s.ts"), "export const s = 2;\n");
    writeFileSync(join(inst, "skills/pkg/s.md"), "# s, updated for 2\n");
    const r = evaluatePairs(pairs, first.attestations, root);
    expect(r.entry.result).toBe("pass");
    expect(r.attestations[0]!.code_hash).not.toBe(first.attestations[0]!.code_hash);
  });

  test("a missing side of a declared pair is unknown, never a pass", () => {
    const { root } = repo();
    const r = evaluatePairs([{ kind: "implements", prose: "inst/processes/p.bpmn", code: ".github/workflows/gone.yml" }], [], root);
    expect(r.entry.result).toBe("unknown");
  });

  test("no declared pair is n/a", () => {
    const { root } = repo();
    expect(evaluatePairs([], [], root).entry.result).toBe("n/a");
  });
});

describe("attest — the re-review mark", () => {
  test("moves the attestation to current hashes with who and why, which clears the finding", () => {
    const { root, inst } = repo();
    const pairs = discoverPairs({ kind: "skill", path: "skills/pkg/s.md" }, inst, root);
    const first = evaluatePairs(pairs, [], root);
    const tree = join(root, "att", "kg-qa");
    mkdirSync(tree, { recursive: true });
    const store = join(tree, "s.attestations.json");
    const file: KgAttestations = { $schema: QA_ATTESTATIONS_SCHEMA, family: "kg-qa", subject: SUBJECT, pair_attestations: first.attestations };
    writeFileSync(store, serialiseAttestations(file));
    writeFileSync(join(inst, "skills/pkg/s.ts"), "export const s = 3;\n");
    expect(evaluatePairsFrom(pairs, readAttestations(store, tree), root).entry.result).toBe("fail");

    expect(attest(store, tree, "human", "re-read against s = 3", root)).toBe(1);
    const after = readAttestations(store, tree);
    expect(after.state).toBe("hit");
    if (!("attestations" in after)) return;
    expect(after.attestations[0]).toMatchObject({ by: "human", reason: "re-read against s = 3" });
    expect(evaluatePairs(pairs, after.attestations, root).entry.result).toBe("pass");
    expect(readFileSync(store, "utf-8").endsWith("\n")).toBe(true);
  });

  test("refuses a store file it cannot read, rather than overwriting it", () => {
    const { root } = repo();
    const tree = join(root, "att", "kg-qa");
    mkdirSync(tree, { recursive: true });
    const store = join(tree, "s.attestations.json");
    writeFileSync(store, "<<<<<<< ours\n");
    expect(() => attest(store, tree, "agent", "r", root)).toThrow(/corrupt/);
    expect(readFileSync(store, "utf-8")).toBe("<<<<<<< ours\n");
  });
});

// C4 and the `de9k` leftover: a store that cannot be read is NEVER "no prior".
describe("the prior read — only a miss is first sight (bean 2gst)", () => {
  const setup = () => {
    const { root, inst } = repo();
    const pairs = discoverPairs({ kind: "skill", path: "skills/pkg/s.md" }, inst, root);
    const tree = join(root, "att", "kg-qa");
    return { root, pairs, tree, store: join(tree, "s.attestations.json") };
  };

  // Owner ruling 2 (2026-10-01): an absent store is no longer a refusal. The
  // judgements a prior sidecar still carries are read and moved on first save.
  test("(a) no store, the prior sidecar holds an attestation: it is the prior, unchanged — drift still found", () => {
    const { root, pairs, tree, store } = setup();
    const was = evaluatePairs(pairs, [], root).attestations; // the baseline at s = 1
    writeFileSync(join(root, "inst/skills/pkg/s.ts"), "export const s = 2;\n"); // code moved, prose did not
    const sidecar = join(root, "s.kg-qa.json");
    writeFileSync(sidecar, JSON.stringify({ $schema: "kg-qa/v1", subject: SUBJECT, criteria: {}, totals: {}, pair_attestations: was }));
    const read = readAttestations(store, tree, sidecar);
    expect(read.state).toBe("absent");
    if (read.state !== "absent") return;
    expect(read.moved).toBe(1);
    const r = evaluatePairsFrom(pairs, read, root);
    // NOT re-baselined: the drift the moved attestation recorded is still a finding.
    expect(r.entry.result).toBe("fail");
    expect(r.attestations).toEqual(was);
  });

  test("(a) no store and no prior sidecar: first sight, a baseline", () => {
    const { root, pairs, tree, store } = setup();
    const read = readAttestations(store, tree, join(root, "nothing-here.kg-qa.json"));
    expect(read.state).toBe("absent");
    expect(evaluatePairsFrom(pairs, read, root).attestations?.[0]?.by).toBe("baseline");
  });

  test("(b) no store entry and a prior sidecar that will not parse is UNKNOWN: nothing is re-baselined", () => {
    const { root, pairs, tree, store } = setup();
    const sidecar = join(root, "s.kg-qa.json");
    writeFileSync(sidecar, "<<<<<<< ours\n");
    const read = readAttestations(store, tree, sidecar);
    expect(read.state).toBe("unknown");
    const r = evaluatePairsFrom(pairs, read, root);
    expect(r.entry.result).toBe("unknown");
    expect(r.attestations).toBeUndefined();
  });

  test("(c) a store HIT is the source: the prior sidecar is never read for judgements", () => {
    const { root, pairs, tree, store } = setup();
    mkdirSync(tree, { recursive: true });
    const held = evaluatePairs(pairs, [], root).attestations.map((a) => ({ ...a, by: "human" as const, reason: "the store's" }));
    writeFileSync(store, serialiseAttestations({ $schema: QA_ATTESTATIONS_SCHEMA, family: "kg-qa", subject: SUBJECT, pair_attestations: held }));
    // A sidecar that would fail to parse proves it is not read at all.
    const sidecar = join(root, "s.kg-qa.json");
    writeFileSync(sidecar, "<<<<<<< ours\n");
    const read = readAttestations(store, tree, sidecar);
    expect(read.state).toBe("hit");
    if (read.state !== "hit") return;
    expect(read.attestations).toEqual(held);
  });

  test("a corrupt store file is CORRUPT, never []", () => {
    const { root, pairs, tree, store } = setup();
    mkdirSync(tree, { recursive: true });
    writeFileSync(store, "{ not json");
    const read = readAttestations(store, tree);
    expect(read.state).toBe("corrupt");
    expect("attestations" in read).toBe(false);
    expect(evaluatePairsFrom(pairs, read, root).attestations).toBeUndefined();
  });

  test("a present store with no file for the subject is a miss, and baselines", () => {
    const { root, pairs, tree, store } = setup();
    mkdirSync(tree, { recursive: true });
    const r = evaluatePairsFrom(pairs, readAttestations(store, tree), root);
    expect(r.entry.result).toBe("pass");
    expect(r.attestations?.[0]?.by).toBe("baseline");
  });

  test("no declared pair is n/a whatever the store says", () => {
    const { root, tree, store } = setup();
    expect(evaluatePairsFrom([], readAttestations(store, tree), root).entry.result).toBe("n/a");
  });
});
