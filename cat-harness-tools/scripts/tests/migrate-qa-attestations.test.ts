/**
 * The attestation migration, kg-qa half — bean `2gst`. Round-tripped on the REAL
 * corpus, never only on a fixture: the property that matters is that the
 * judgements committed in this repository survived the move byte for byte.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import { composeAttestations, entryFingerprints, migrateTree } from "../migrate-qa-attestations";
import { readAttestations } from "../prose-code-pairs.ts";
import { readVoiceReviews } from "../skill-voice-review.ts";
import { ATTESTATIONS_SUFFIX, KG_QA_SIDECAR_SUFFIX, kgAttestationTrees } from "../../schemas/sdlc/qa-attestations.ts";

const HOST = resolve(import.meta.dir, "..", "..");
const REPO = resolve(HOST, "..");
/** The last commit whose kg-qa sidecars still carried their attestations. */
const PRE_MIGRATION = "5d64d4d8";

function walk(dir: string, suffix: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, suffix, acc);
    else if (e.name.endsWith(suffix)) acc.push(p);
  }
  return acc.sort();
}

/** Every real store file, with the sidecar it was moved out of. */
function realStore(): { store: string; sidecar: string; tree: (typeof trees)[number] }[] {
  const out: { store: string; sidecar: string; tree: (typeof trees)[number] }[] = [];
  for (const t of trees) {
    const fam = join(t.attHome, "kg-qa");
    for (const store of walk(fam, ATTESTATIONS_SUFFIX)) {
      const rel = relative(fam, store).slice(0, -ATTESTATIONS_SUFFIX.length);
      out.push({ store, sidecar: join(t.kgTree, `${rel}${KG_QA_SIDECAR_SUFFIX}`), tree: t });
    }
  }
  return out;
}
const trees = kgAttestationTrees(REPO, HOST);

describe("the real attestation store", () => {
  const rows = realStore();

  test("there is one, and no kg-qa sidecar still carries a judgement", () => {
    expect(rows.length).toBeGreaterThan(0);
    for (const t of trees) {
      for (const s of walk(t.kgTree, KG_QA_SIDECAR_SUFFIX)) {
        const json = JSON.parse(readFileSync(s, "utf-8")) as Record<string, unknown>;
        expect(composeAttestations(json), `${relative(REPO, s)} still carries a judgement`).toBeUndefined();
      }
    }
  });

  test("round trip: put each judgement back in a copy of its sidecar, migrate, and get the same bytes", () => {
    const tmp = mkdtempSync(join(tmpdir(), "att-roundtrip-"));
    let entries = 0;
    for (const [i, row] of rows.entries()) {
      // One tmp tree per row keeps the mirror intact without copying the corpus.
      const kgTree = join(tmp, `t${i}`, "kg-qa");
      const attHome = join(tmp, `t${i}`, "att");
      const sidecar = join(kgTree, relative(row.tree.kgTree, row.sidecar));
      mkdirSync(dirname(sidecar), { recursive: true });
      mkdirSync(attHome, { recursive: true });
      const original = readFileSync(row.store, "utf-8");
      const judged = JSON.parse(original) as Record<string, unknown>;
      // The subject is the sidecar's own; the judgement arrays go back where
      // the pre-migration writer put them, after `totals`.
      const derived = existsSync(row.sidecar)
        ? (JSON.parse(readFileSync(row.sidecar, "utf-8")) as Record<string, unknown>)
        : { $schema: "kg-qa/v1", subject: judged["subject"], source_hash: null, criteria: {}, totals: {} };
      expect(derived["subject"]).toEqual(judged["subject"]);
      const mixed = { ...derived };
      for (const f of ["pair_attestations", "voice_reviews"]) if (judged[f]) mixed[f] = judged[f];
      writeFileSync(sidecar, `${JSON.stringify(mixed, null, 2)}\n`);

      const tree = { instance: row.tree.instance, kgTree, attHome, storeRoot: attHome };
      const first = migrateTree(tree);
      expect(first.map((o) => o.state)).toEqual(["moved"]);
      const store = join(attHome, "kg-qa", relative(join(row.tree.attHome, "kg-qa"), row.store));
      expect(readFileSync(store, "utf-8"), relative(REPO, row.store)).toBe(original);
      entries += Object.values(entryFingerprints(judged)).flat().length;

      // The stripped sidecar is the derived one, byte for byte.
      if (existsSync(row.sidecar)) expect(readFileSync(sidecar, "utf-8")).toBe(readFileSync(row.sidecar, "utf-8"));
      // Idempotent: a second run finds nothing to move and changes nothing.
      expect(migrateTree(tree)).toEqual([]);
      expect(readFileSync(store, "utf-8")).toBe(original);
    }
    expect(entries).toBeGreaterThan(0);
  });

  test("owner ruling 2 on the real corpus: with NO store, each prior sidecar's judgements are what the readers return, verbatim", () => {
    // What `kg-audit` sees on a folio that never migrated: no attestation
    // directory, and the judgements still inside the sidecars. The readers it
    // uses must hand back exactly those entries (so nothing is re-baselined
    // and nothing is dropped), for every file in the real store. The store
    // grows as new subjects are judged (d6bw added qa-publish), so the count is
    // the store's own; the 32 measured at the move is pinned by the history test.
    const tmp = mkdtempSync(join(tmpdir(), "att-ruling2-"));
    let files = 0;
    let entries = 0;
    let expected = 0;
    for (const [i, row] of rows.entries()) {
      const judged = JSON.parse(readFileSync(row.store, "utf-8")) as Record<string, unknown>;
      const fp = entryFingerprints(judged);
      expected += fp["pair_attestations"]!.length + fp["voice_reviews"]!.length;
      const sidecar = join(tmp, `s${i}.kg-qa.json`);
      writeFileSync(sidecar, `${JSON.stringify({ $schema: "kg-qa/v1", subject: judged["subject"], criteria: {}, totals: {}, ...judged }, null, 2)}\n`);
      const absentStore = join(tmp, "no-store");
      const pairs = readAttestations(join(absentStore, "kg-qa", "x.attestations.json"), absentStore, sidecar);
      const reviews = readVoiceReviews(join(absentStore, "kg-qa", "x.attestations.json"), absentStore, sidecar);
      expect(pairs.state).toBe("absent");
      expect(reviews.state).toBe("absent");
      if (pairs.state !== "absent" || reviews.state !== "absent") continue;
      expect(pairs.attestations.map((e) => JSON.stringify(e))).toEqual(entryFingerprints(judged)["pair_attestations"]!);
      expect(reviews.reviews.map((e) => JSON.stringify(e))).toEqual(entryFingerprints(judged)["voice_reviews"]!);
      files++;
      entries += pairs.moved + reviews.moved;
    }
    // Not the 32 measured at the move: cat-harness#749 (y9r6) retired eight
    // pair attestations with the .ts skills they paired, and the store grows
    // as new subjects are judged. The history test pins the 32.
    expect(rows.length).toBeGreaterThan(0);
    expect(files).toBe(rows.length);
    expect(entries).toBe(expected);
  });

  test("against history: every judgement the sidecars held before the move is in the store, unchanged", () => {
    // A shallow checkout cannot answer this; it says so rather than passing.
    const has = (rev: string) => spawnSync("git", ["cat-file", "-e", `${rev}^{commit}`], { cwd: REPO }).status === 0;
    const added = spawnSync("git", ["log", "--diff-filter=A", "--format=%H", "--", "cat-harness/test/attestations"], { cwd: REPO, encoding: "utf-8" })
      .stdout.trim()
      .split("\n")
      .filter(Boolean)
      .pop();
    // In an index checkout cat-harness is a mount its git does not track, so
    // the history is cat-harness's own repository's, not this one's.
    const tracked = spawnSync("git", ["ls-files", "--", "cat-harness/test/attestations"], { cwd: REPO, encoding: "utf-8" }).stdout.trim() !== "";
    if (!tracked || !has(PRE_MIGRATION) || added === undefined) {
      console.warn(`n/a: cat-harness is not tracked here, or ${PRE_MIGRATION} or the migration commit is not in this checkout — history comparison unexercised`);
      return;
    }
    const show = (rev: string, path: string) => spawnSync("git", ["show", `${rev}:${path}`], { cwd: REPO, encoding: "utf-8" });
    const listed = spawnSync("git", ["grep", "-l", '"pair_attestations"', PRE_MIGRATION, "--", "*.kg-qa.json"], { cwd: REPO, encoding: "utf-8" })
      .stdout.trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => l.slice(PRE_MIGRATION.length + 1));
    const before: string[] = [];
    const after: string[] = [];
    const byKind: Record<string, number> = {};
    for (const path of listed) {
      const json = JSON.parse(show(PRE_MIGRATION, path).stdout) as Record<string, unknown>;
      for (const a of (json["pair_attestations"] as Array<{ by: string }>) ?? []) byKind[a.by] = (byKind[a.by] ?? 0) + 1;
      before.push(...entryFingerprints(json)["pair_attestations"]!.map((e) => `${path}\t${e}`));
      const t = trees.find((x) => resolve(REPO, path).startsWith(`${x.kgTree}/`))!;
      const rel = relative(t.kgTree, resolve(REPO, path)).slice(0, -KG_QA_SIDECAR_SUFFIX.length);
      const storePath = relative(REPO, join(t.attHome, "kg-qa", `${rel}${ATTESTATIONS_SUFFIX}`));
      const stored = show(added, storePath);
      expect(stored.status, `${storePath} missing at ${added}`).toBe(0);
      after.push(...entryFingerprints(JSON.parse(stored.stdout))["pair_attestations"]!.map((e) => `${path}\t${e}`));
    }
    // The counts measured before the move (bean 2gst): 32 files, 26 baseline + 6 agent.
    expect(listed.length).toBe(32);
    expect(byKind).toEqual({ baseline: 26, agent: 6 });
    expect(after.sort()).toEqual(before.sort());
  });
});

describe("refusals", () => {
  test("a store file holding DIFFERENT judgements is a conflict: neither file is touched", () => {
    const tmp = mkdtempSync(join(tmpdir(), "att-conflict-"));
    const kgTree = join(tmp, "kg-qa");
    const attHome = join(tmp, "att");
    mkdirSync(join(attHome, "kg-qa"), { recursive: true });
    mkdirSync(kgTree, { recursive: true });
    const subject = { kind: "skill", id: "s", path: "skills/s.md" };
    const pair = { kind: "co-located", prose: "a.md", code: "a.ts", prose_hash: "1", code_hash: "2", by: "baseline" };
    const sidecarText = `${JSON.stringify({ $schema: "kg-qa/v1", subject, criteria: {}, totals: {}, pair_attestations: [pair] }, null, 2)}\n`;
    writeFileSync(join(kgTree, "s.kg-qa.json"), sidecarText);
    const storeText = `${JSON.stringify({ $schema: "qa-attestations/v1", family: "kg-qa", subject, pair_attestations: [{ ...pair, by: "human", reason: "r" }] }, null, 2)}\n`;
    writeFileSync(join(attHome, "kg-qa", "s.attestations.json"), storeText);
    const out = migrateTree({ instance: "x", kgTree, attHome, storeRoot: attHome });
    expect(out.map((o) => o.state)).toEqual(["conflict"]);
    expect(readFileSync(join(kgTree, "s.kg-qa.json"), "utf-8")).toBe(sidecarText);
    expect(readFileSync(join(attHome, "kg-qa", "s.attestations.json"), "utf-8")).toBe(storeText);
  });

  test("a dry run writes nothing", () => {
    const tmp = mkdtempSync(join(tmpdir(), "att-dry-"));
    const src = join(tmp, "src");
    mkdirSync(src);
    const subject = { kind: "skill", id: "s", path: "skills/s.md" };
    const text = `${JSON.stringify({ $schema: "kg-qa/v1", subject, criteria: {}, totals: {}, pair_attestations: [{ kind: "co-located", prose: "a", code: "b", prose_hash: "1", code_hash: "2", by: "agent", reason: "r" }] }, null, 2)}\n`;
    writeFileSync(join(src, "s.kg-qa.json"), text);
    const kgTree = join(tmp, "kg-qa");
    cpSync(src, kgTree, { recursive: true });
    const out = migrateTree({ instance: "x", kgTree, attHome: join(tmp, "att"), storeRoot: join(tmp, "att") }, { dryRun: true });
    expect(out.map((o) => o.state)).toEqual(["moved"]);
    expect(existsSync(join(tmp, "att"))).toBe(false);
    expect(readFileSync(join(kgTree, "s.kg-qa.json"), "utf-8")).toBe(text);
  });
});
