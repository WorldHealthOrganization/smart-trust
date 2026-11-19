/**
 * ChangeSet at handbook scale: the 2,000-block before/after pair from
 * `scripts/test-fixtures/scale-pair.ts` (bean `xp72`), checked twice:
 * against the edit script's hand-derived counts, and against the committed
 * golden ChangeSet.
 *
 * Regenerate the golden file after a deliberate change to the ChangeSet or
 * to the fixture with `UPDATE_GOLDEN=1 bun test schemas/changeset-scale.test.ts`,
 * and review its diff. The test never writes it otherwise.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EXPECTED, removedFiles, writeSide } from "../scripts/test-fixtures/scale-pair.js";
import { type ChangeSet, ChangeSetSchema, computeChangeSet } from "./changeset.js";

const GOLDEN = join(import.meta.dir, "..", "scripts", "test-fixtures", "scale-pair.changeset.json");

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/** The ChangeSet minus the base commit, whose SHA differs on every run. */
const portable = (cs: ChangeSet): ChangeSet => ({ ...cs, base: { ref: "base", commit: null } });

let repo = "";
let cs: ChangeSet;
let ms = 0;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "cs-scale-"));
  const folio = join(repo, "folio");
  writeSide(folio, "before");
  git(repo, "init", "-q");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "before");
  const base = git(repo, "rev-parse", "HEAD");
  writeSide(folio, "after");
  for (const f of removedFiles()) unlinkSync(join(folio, f));
  const t0 = performance.now();
  cs = computeChangeSet({ repoRoot: repo, folio: "folio", base, head: "worktree" });
  ms = performance.now() - t0;
  // A measurement, not a gate: the bean's budget is for the review PAGE,
  // which the browser gate enforces. This is the one number below it.
  console.log(`ChangeSet over ${EXPECTED.total} blocks: ${ms.toFixed(0)} ms`);
}, 120_000);

afterAll(() => {
  if (repo) rmSync(repo, { recursive: true, force: true });
});

describe("ChangeSet at scale (xp72)", () => {
  it("isValidChangeset", () => {
    expect(ChangeSetSchema.safeParse(cs).success).toBe(true);
  });

  it("matchesHandDerivedCounts", () => {
    const { total: _total, ...summary } = EXPECTED;
    expect(cs.summary).toEqual(summary);
    expect(cs.summary.added + cs.summary.changed + cs.summary.unchanged).toBe(EXPECTED.total - EXPECTED.removed + EXPECTED.added);
  });

  it("topInsertMovesNothing", () => {
    const top = cs.changes.filter((c) => c.change === "changed" && c.head.section?.endsWith("::sec-00"));
    expect(top.map((c) => c.label).sort()).toEqual(Array.from({ length: 10 }, (_, c) => `def:${String(c).padStart(2, "0")}-00-08`));
  });

  it("allAtOnceEditCarriesAspects", () => {
    const all = cs.changes.find((c) => c.label === "def:00-08-15-renamed");
    expect(all).toMatchObject({ change: "changed", from: "def:00-08-15", aspects: ["renamed", "prose", "moved"] });
  });

  it("equalsGoldenChangeset", () => {
    const got = portable(cs);
    if (process.env.UPDATE_GOLDEN === "1" || !existsSync(GOLDEN)) {
      if (process.env.UPDATE_GOLDEN !== "1") throw new Error(`no golden file at ${GOLDEN}; run with UPDATE_GOLDEN=1`);
      writeFileSync(GOLDEN, JSON.stringify(got, null, 2) + "\n");
    }
    expect(got).toEqual(JSON.parse(readFileSync(GOLDEN, "utf-8")));
  });
});
