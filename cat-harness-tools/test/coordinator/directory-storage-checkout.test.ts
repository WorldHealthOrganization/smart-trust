/**
 * `directory-storage` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/kg/directory-storage.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each reads the aggregate root's
 * `.gitignore` and asks git at the checkout root, which only the checkout
 * holds. Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolveQaLocation } from "../../scripts/qa-store.js";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

describe("the real declarations (bean 5hox)", () => {
  const repoRoot = join(ORIGIN_DIR, "..", "..", "..");

  test("every declared qa directory is stored, and every stored working copy is ignored", () => {
    const loc = resolveQaLocation(repoRoot);
    expect(loc.directories.length).toBeGreaterThan(0);
    expect(loc.declared).toBe(true);
    expect(loc.directories.filter((d) => !d.storage).map((d) => d.path)).toEqual([]);
    const probes = loc.directories.map((d) => `${d.path}/probe.json`);
    const r = spawnSync("git", ["check-ignore", "--no-index", "--stdin"], { cwd: repoRoot, input: probes.join("\n") + "\n", encoding: "utf-8" });
    const ignored = new Set(r.stdout.split("\n").filter(Boolean));
    expect(probes.filter((p) => !ignored.has(p))).toEqual([]);
  });

  test("attestations are never ignored: they stay on main (ruling D2 (a))", () => {
    // RESTATED for the split. `main` is now litlfred/cat-harness's, and in the
    // composed checkout `cat-harness/` is a REMOTE MOUNT that the index's own
    // `.gitignore` ignores wholesale (`/cat-harness/`) -- so asking the index
    // reports every path in the mount as ignored, which says nothing about the
    // ruling. The question is whether the repository that HOLDS the
    // attestations ignores them, so it is put to cat-harness's own
    // `.gitignore`, alone, in a throwaway repository.
    const scratch = mkdtempSync(join(tmpdir(), "attestations-ignore-"));
    made.push(scratch);
    expect(spawnSync("git", ["init", "-q"], { cwd: scratch }).status).toBe(0);
    copyFileSync(join(repoRoot, "cat-harness", ".gitignore"), join(scratch, ".gitignore"));
    const r = spawnSync("git", ["check-ignore", "--no-index", "-q", "test/attestations/kg-qa/probe.attestations.json"], { cwd: scratch });
    expect(r.status).toBe(1);
  });
});
