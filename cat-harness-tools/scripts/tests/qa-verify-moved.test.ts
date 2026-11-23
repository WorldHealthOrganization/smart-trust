/**
 * qa-verify-moved on a REAL fixture repository: a bare remote over `file://`,
 * an entry written by `publishQa` itself, and a work directory laid out like a
 * checkout. Bean `5hox` — the verification that gates removing the moved QA
 * files from `main`, so every way it could read as green without being so is
 * a test here: a missing entry, an empty working tree, a file the entry lacks.
 *
 * @module scripts/tests/qa-verify-moved
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { clearQaCache, publishQa, QaUsageError, type QaStoreOptions } from "../qa-store.js";
import { VERIFY_EXIT, movedInventory, verifyMoved } from "../qa-verify-moved.js";

const SCRIPT = join(import.meta.dir, "..", "qa-verify-moved.ts");
const NOGPG = ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t"];
const SHA = "a".repeat(40);
const RESULTS = "inst/test/results";
const T = 60_000;

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", [...NOGPG, ...args], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} → ${r.status}\n${r.stderr}`);
  return r.stdout;
}

const made: string[] = [];
afterEach(() => {
  clearQaCache();
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fixture(): { work: string; url: string; opts: QaStoreOptions; write: (rel: string, text: string) => void } {
  const base = mkdtempSync(join(tmpdir(), "qa-verify-moved-"));
  made.push(base);
  const bare = join(base, "remote.git");
  git(base, "init", "-q", "--bare", "-b", "main", bare);
  git(bare, "config", "uploadpack.allowFilter", "true");
  git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
  const url = `file://${bare}`;
  const work = join(base, "work");
  mkdirSync(work);
  git(work, "init", "-q", "-b", "main");
  const write = (rel: string, text: string) => {
    mkdirSync(dirname(join(work, rel)), { recursive: true });
    writeFileSync(join(work, rel), text);
  };
  write(`${RESULTS}/kg-qa/skills/a.kg-qa.json`, '{"verdict":"pass"}\n');
  write(`${RESULTS}/audit-coverage.qa-results.json`, '{"rows":3}\n');
  // Outside every root: never inventoried, never compared.
  write("inst/test/attestations/kg-qa/a.attestations.json", '{"judged":true}\n');
  const opts: QaStoreOptions = { repoRoot: work, remote: url, branch: "qa-reports", storeDir: join(base, "store.git"), sleep: () => {}, log: () => {} };
  return { work, url, opts, write };
}

function publish(f: ReturnType<typeof fixture>): void {
  const r = publishQa({ ref: `main/${SHA}`, roots: [RESULTS] }, f.opts);
  expect(r.state).toBe("published");
  clearQaCache();
}

describe("the inventory", () => {
  test("is every file under the roots, counted, and nothing outside them", () => {
    const f = fixture();
    const inv = movedInventory(f.work, [RESULTS]);
    expect(inv.files).toBe(2);
    expect(inv.directories[0]!.files.map((x) => x.path)).toEqual([
      `${RESULTS}/audit-coverage.qa-results.json`,
      `${RESULTS}/kg-qa/skills/a.kg-qa.json`,
    ]);
    expect(inv.bytes).toBe('{"verdict":"pass"}\n'.length + '{"rows":3}\n'.length);
  });
});

describe("verifyMoved", () => {
  test("IDENTICAL: every working file is in the entry with the same blob id", () => {
    const f = fixture();
    publish(f);
    const r = verifyMoved({ ref: `main/${SHA}`, roots: [RESULTS] }, f.opts);
    expect(r.state).toBe("identical");
    expect(r.identical).toHaveLength(2);
    expect(r.differs).toEqual([]);
    expect(r.missing).toEqual([]);
  }, T);

  test("DIFFERS: an edited file differs and a new file is missing from the entry", () => {
    const f = fixture();
    publish(f);
    f.write(`${RESULTS}/audit-coverage.qa-results.json`, '{"rows":4}\n');
    f.write(`${RESULTS}/lsi/new.json`, "{}\n");
    const r = verifyMoved({ ref: `main/${SHA}`, roots: [RESULTS] }, f.opts);
    expect(r.state).toBe("differs");
    expect(r.differs).toEqual([`${RESULTS}/audit-coverage.qa-results.json`]);
    expect(r.missing).toEqual([`${RESULTS}/lsi/new.json`]);
  }, T);

  test("a file only the ENTRY holds is reported as extra and does not fail", () => {
    const f = fixture();
    publish(f);
    unlinkSync(join(f.work, `${RESULTS}/kg-qa/skills/a.kg-qa.json`));
    const r = verifyMoved({ ref: `main/${SHA}`, roots: [RESULTS] }, f.opts);
    expect(r.state).toBe("identical");
    expect(r.extra).toEqual([`${RESULTS}/kg-qa/skills/a.kg-qa.json`]);
  }, T);

  test("UNKNOWN, never green, when the branch or the entry is not there", () => {
    const f = fixture();
    const noBranch = verifyMoved({ ref: `main/${SHA}`, roots: [RESULTS] }, f.opts);
    expect(noBranch.state).toBe("unknown");
    expect(noBranch.identical).toEqual([]);
    publish(f);
    const noEntry = verifyMoved({ ref: `main/${"b".repeat(40)}`, roots: [RESULTS] }, f.opts);
    expect(noEntry.state).toBe("unknown");
    expect(noEntry.reason).toContain("MISS");
  }, T);

  test("UNKNOWN when the working tree holds nothing to compare", () => {
    const f = fixture();
    publish(f);
    rmSync(join(f.work, RESULTS), { recursive: true });
    expect(verifyMoved({ ref: `main/${SHA}`, roots: [RESULTS] }, f.opts).state).toBe("unknown");
  }, T);

  test("a malformed ref is a usage error, not an unknown", () => {
    const f = fixture();
    expect(() => verifyMoved({ ref: "refs/heads/main", roots: [RESULTS] }, f.opts)).toThrow(QaUsageError);
  });
});

describe("the CLI exit codes", () => {
  const run = (f: ReturnType<typeof fixture>, ...args: string[]) =>
    spawnSync("bun", [SCRIPT, ...args, "--root", RESULTS, "--remote", f.url, "--branch", "qa-reports", "--store", f.opts.storeDir!], {
      cwd: f.work,
      encoding: "utf-8",
    });

  test("0 identical, 1 differs, 2 unknown on a fetch miss, 3 usage", () => {
    const f = fixture();
    expect(run(f, "--key", `main/${SHA}`).status).toBe(VERIFY_EXIT.unknown);
    publish(f);
    expect(run(f, "--key", `main/${SHA}`).status).toBe(VERIFY_EXIT.identical);
    f.write(`${RESULTS}/audit-coverage.qa-results.json`, '{"rows":5}\n');
    expect(run(f, "--key", `main/${SHA}`).status).toBe(VERIFY_EXIT.differs);
    expect(run(f, "--key", "nonsense").status).toBe(VERIFY_EXIT.usage);
    expect(run(f).status).toBe(VERIFY_EXIT.usage);
  }, T);
});
