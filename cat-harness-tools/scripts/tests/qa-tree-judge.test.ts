/**
 * Compute-and-judge over a TREE of sidecars — bean `oqe3` (arc `3fva`,
 * proposal `qa-reports-branch-and-test-process` §2.3).
 *
 * `kg:audit:check`, `kg:audit:all:check` and `translation:block-qa:check`
 * compared every fresh sidecar with the committed one and failed on "stale",
 * which is why they were three of the gates still red with `test/results/`
 * absent (5hox inventory, group A). They now judge, like `bo44`'s gates:
 *
 * - a finding NEW against the baseline fails; an INHERITED one does not;
 * - a baseline that cannot be read is UNKNOWN — reported, never a pass,
 *   never a failure — and an absent ENTRY is one unknown, never "every
 *   subject is new";
 * - the gate form writes nothing.
 *
 * The branch half runs against a real bare repository over `file://`, as
 * `qa-baseline.test.ts` does. The two CLI halves run the real producers in
 * judge mode with the store pointed at a fixture remote, and assert that
 * nothing in the checkout changed.
 *
 * @module scripts/tests/qa-tree-judge
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { judgeSidecarTree, type FreshSidecar } from "../qa-results.ts";
import { clearQaCache, publishQa, type QaStoreOptions } from "../qa-store.ts";
import { KG_CRITERIA, KG_QA_SCHEMA, gradedKgFindings, type KgQaReport } from "../../schemas/sdlc/kg-qa.ts";
import { gradedTranslationFindings } from "../../pipeline/translation-block-qa.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const REPO = resolve(dirname(HARNESS_ROOT));
const NOGPG = ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t"];
const SHA = "e".repeat(40);
const T = 60_000;

const made: string[] = [];
afterEach(() => {
  clearQaCache();
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), `qa-tree-${prefix}-`));
  made.push(d);
  return d;
}

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", [...NOGPG, ...args], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} → ${r.status}\n${r.stderr}`);
  return r.stdout;
}

/** Judge quietly: the verdict is what is asserted, not the console. */
function judge(args: Parameters<typeof judgeSidecarTree>[0]) {
  const log = console.log;
  const err = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return judgeSidecarTree(args);
  } finally {
    console.log = log;
    console.error = err;
  }
}

/** A sidecar shape: `{ f: [...] }`, its findings the array. */
const findingsOf = (text: string): unknown[] | undefined => {
  try {
    const j = JSON.parse(text) as { f?: unknown[] };
    return Array.isArray(j.f) ? j.f : undefined;
  } catch {
    return undefined;
  }
};

function writeSidecar(path: string, f: unknown[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ f }));
}

describe("judging a tree against the working copy (an unstored directory)", () => {
  test("new mode: a SEEDED new finding fails (1); the same finding inherited does not (0)", () => {
    const root = tmp("wc");
    writeSidecar(join(root, "a.json"), [{ x: "old" }]);
    const seeded = judge({ gate: "t", fresh: [{ path: join(root, "a.json"), findings: [{ x: "old" }, { x: "new" }] }], findingsOf, mode: "new" });
    expect(seeded.exit).toBe(1);
    expect(seeded.added[join(root, "a.json")]).toEqual([{ x: "new" }]);
    const inherited = judge({ gate: "t", fresh: [{ path: join(root, "a.json"), findings: [{ x: "old" }] }], findingsOf, mode: "new" });
    expect(inherited.exit).toBe(0);
    expect(inherited.inherited).toBe(1);
  });

  test("a subject with no sidecar yet is new — a determined miss, not an unknown", () => {
    const root = tmp("miss");
    const v = judge({ gate: "t", fresh: [{ path: join(root, "b.json"), findings: [{ x: 1 }] }], findingsOf, mode: "new" });
    expect(v.exit).toBe(1);
    expect(v.baseline.state).toBe("hit");
  });

  test("absolute mode against the working copy: the author's own record cannot excuse their finding", () => {
    const root = tmp("abs");
    writeSidecar(join(root, "a.json"), [{ x: "old" }]);
    expect(judge({ gate: "t", fresh: [{ path: join(root, "a.json"), findings: [{ x: "old" }] }], findingsOf, mode: "absolute" }).exit).toBe(1);
  });

  test("a baseline that will not parse is reported unknown for that sidecar", () => {
    const root = tmp("corrupt");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "a.json"), "{ nope");
    const v = judge({ gate: "t", fresh: [{ path: join(root, "a.json"), findings: [{ x: 1 }] }], findingsOf, mode: "new" });
    expect(v.exit).toBe(0);
    expect(v.unknowns.join(" ")).toContain("a.json");
  });

  test("extraFailing (a committed file out of date) fails; undetermined outranks it (2)", () => {
    const root = tmp("extra");
    const fresh: FreshSidecar[] = [{ path: join(root, "a.json"), findings: [] }];
    expect(judge({ gate: "t", fresh, findingsOf, mode: "new", extraFailing: { count: 1, detail: "x" } }).exit).toBe(1);
    expect(judge({ gate: "t", fresh, findingsOf, mode: "new", extraFailing: { count: 1, detail: "x" }, undetermined: "blind" }).exit).toBe(2);
  });
});

// ── The branch: --against over a real bare remote ──────────────────────────

/** A checkout `work` whose `inst/test/results/{a,b}.json` are published as `main/<SHA>`, then removed. */
function branchFixture(published: Record<string, unknown[]> | undefined): { work: string; store: (n: string) => QaStoreOptions } {
  const base = tmp("branch");
  const bare = join(base, "remote.git");
  git(base, "init", "-q", "--bare", "-b", "main", bare);
  git(bare, "config", "uploadpack.allowFilter", "true");
  git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
  const work = join(base, "work");
  mkdirSync(work);
  git(work, "init", "-q", "-b", "main");
  const store = (n: string): QaStoreOptions => ({
    repoRoot: work,
    remote: `file://${bare}`,
    branch: "qa-reports",
    storeDir: join(base, `${n}.store.git`),
    sleep: () => {},
    log: () => {},
  });
  if (published) {
    for (const [name, f] of Object.entries(published)) writeSidecar(join(work, "inst/test/results", name), f);
    publishQa({ ref: `main/${SHA}`, roots: ["inst/test/results"] }, store("writer"));
    // The working copy is gone: the branch is the only baseline, as after 5hox.
    rmSync(join(work, "inst"), { recursive: true, force: true });
    clearQaCache();
  }
  return { work, store };
}

describe("judging a tree --against the qa-reports branch", () => {
  test(
    "absolute mode: a seeded new finding fails; inherited ones do not; a subject the entry lacks is new",
    () => {
      const { work, store } = branchFixture({ "a.json": [{ x: "old" }] });
      const a = join(work, "inst/test/results/a.json");
      const b = join(work, "inst/test/results/b.json");
      const opts = { findingsOf, mode: "absolute" as const, against: "main", store: store("reader") };
      const inherited = judge({ gate: "t", fresh: [{ path: a, findings: [{ x: "old" }] }], ...opts });
      expect(inherited.baseline.state).toBe("hit");
      expect(inherited.baseline.from).toBe(`qa-reports:main/${SHA}`);
      expect(inherited.exit).toBe(0);
      const seeded = judge({ gate: "t", fresh: [{ path: a, findings: [{ x: "old" }, { x: "new" }] }], ...opts });
      expect(seeded.exit).toBe(1);
      expect(seeded.failing).toBe(1);
      const newSubject = judge({ gate: "t", fresh: [{ path: a, findings: [{ x: "old" }] }, { path: b, findings: [{ y: 1 }] }], ...opts });
      expect(newSubject.exit).toBe(1);
      expect(Object.keys(newSubject.added)).toEqual([b]);
    },
    T,
  );

  test(
    "no entry on the branch: ONE unknown, never N new subjects — new mode does not fail, absolute judges in full",
    () => {
      const { work, store } = branchFixture(undefined);
      const fresh = [{ path: join(work, "inst/test/results/a.json"), findings: [{ x: 1 }] }];
      const v = judge({ gate: "t", fresh, findingsOf, mode: "new", against: "main", store: store("reader") });
      expect(v.baseline.state).toBe("unknown");
      expect(v.exit).toBe(0);
      expect(v.added).toEqual({});
      expect(v.unknowns.filter((u) => u.includes("no baseline")).length).toBe(1);
      expect(judge({ gate: "t", fresh, findingsOf, mode: "absolute", against: "main", store: store("reader2") }).exit).toBe(1);
    },
    T,
  );

  test(
    "an unreachable remote is unknown — never a pass of the split",
    () => {
      const { work, store } = branchFixture(undefined);
      const o = { ...store("reader"), remote: "file:///no/such/remote.git" };
      const v = judge({ gate: "t", fresh: [{ path: join(work, "inst/test/results/a.json"), findings: [{ x: 1 }] }], findingsOf, mode: "new", against: "main", store: o });
      expect(v.baseline.state).toBe("unknown");
      expect(v.exit).toBe(0);
    },
    T,
  );
});

// ── What each gate grades ──────────────────────────────────────────────────

describe("what kg:audit:check grades", () => {
  const critical = KG_CRITERIA.find((c) => c.severity === "critical")!;
  const minor = KG_CRITERIA.find((c) => c.severity === "minor")!;
  const report = (criteria: KgQaReport["criteria"]): Pick<KgQaReport, "criteria"> => ({ criteria });

  test("fail and unknown at the gate's severity, per finding; a lower severity and a pass are not graded", () => {
    const r = report({
      [critical.id]: { result: "fail", findings: [{ message: "one" } as never, { message: "two" } as never] },
      [minor.id]: { result: "fail", findings: [{ message: "minor" } as never] },
    });
    expect(gradedKgFindings(r, ["critical"]).length).toBe(2);
    expect(gradedKgFindings(r, ["critical", "minor"]).length).toBe(3);
    expect(gradedKgFindings(report({ [critical.id]: { result: "pass", findings: [] } }), ["critical"])).toEqual([]);
    expect(gradedKgFindings(report({ [critical.id]: { result: "unknown", findings: [] } }), ["critical"])).toEqual([{ criterion: critical.id, result: "unknown" }]);
  });

  test("a second finding in a subject that already failed is NEW, not hidden behind the first", () => {
    const before = gradedKgFindings(report({ [critical.id]: { result: "fail", findings: [{ message: "one" } as never] } }), ["critical"]);
    const after = gradedKgFindings(report({ [critical.id]: { result: "fail", findings: [{ message: "one" } as never, { message: "two" } as never] } }), ["critical"]);
    const root = tmp("kg");
    const p = join(root, "s.kg-qa.json");
    writeSidecar(p, before);
    const v = judge({ gate: "kg:audit:check", fresh: [{ path: p, findings: after }], findingsOf, mode: "absolute" });
    expect(v.added[p]).toEqual([{ criterion: critical.id, result: "fail", finding: { message: "two" } }]);
  });

  test("KG_QA_SCHEMA is what a baseline sidecar must declare to be read", () => {
    expect(KG_QA_SCHEMA).toBe("kg-qa/v1");
  });
});

describe("what translation:block-qa:check grades", () => {
  const entry = (result: string, extra: Record<string, unknown> = {}) => ({
    result,
    severity: "major",
    evidence: ["a URL differs"],
    reviewed_at: new Date().toISOString(),
    // input-site: inert #01bfcf99 — a unique scratch name or throwaway token; no assertion depends on its value
    reviewer: { kind: "script", id: "x", version: "v1", script_hash: Math.random().toString(36) },
    ...extra,
  });

  test("only `fail`, by substance: a re-run's timestamp and script hash do not make an inherited finding new", () => {
    const one = gradedTranslationFindings({ criteria: { "translation-urls": [entry("fail") as never], "translation-acronyms": [entry("warn") as never] } });
    const two = gradedTranslationFindings({ criteria: { "translation-urls": [entry("fail") as never] } });
    expect(one).toEqual([{ criterion: "translation-urls", severity: "major", evidence: ["a URL differs"], notes: undefined }]);
    expect(JSON.stringify(one)).toBe(JSON.stringify(two));
  });
});

// ── The CLIs: judge mode writes nothing and reads the store ────────────────

function gitStatus(): string {
  return spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: REPO, encoding: "utf-8" }).stdout;
}

describe("the gate CLIs in judge mode", () => {
  test("an unknown flag is a usage error (2) before anything is computed", () => {
    for (const script of ["cat-harness-tools/scripts/kg-audit.ts", "cat-harness-tools/scripts/kg-audit-all.ts", "cat-harness-tools/pipeline/translation-block-qa.ts"]) {
      const r = spawnSync("bun", ["run", script, "--check", "--chek"], { cwd: REPO, encoding: "utf-8" });
      expect(r.status, script).toBe(2);
      expect(r.stderr + r.stdout, script).toContain("unknown flag");
    }
  });

  test("a malformed --against is a usage error (2), never a missing baseline", () => {
    const r = spawnSync("bun", ["run", "cat-harness-tools/scripts/kg-audit.ts", "--check", "--against", "refs/heads/main"], { cwd: REPO, encoding: "utf-8" });
    expect(r.status).toBe(2);
  });

  test(
    "kg:audit:check --against a branch with no entry: UNKNOWN reported, not gated, and nothing written",
    () => {
      const base = tmp("kgcli");
      const bare = join(base, "remote.git");
      git(base, "init", "-q", "--bare", "-b", "main", bare);
      const before = gitStatus();
      const r = spawnSync("bun", ["run", "cat-harness-tools/scripts/kg-audit.ts", "--check", "--against", "main"], {
        cwd: REPO,
        encoding: "utf-8",
        env: { ...process.env, QA_STORE_REMOTE: `file://${bare}`, QA_STORE_DIR: join(base, "store.git") },
      });
      const out = r.stdout + r.stderr;
      expect(out).toContain("judge mode, wrote nothing");
      expect(out).toContain("UNKNOWN");
      // The checkout carries no critical KG finding today, so the verdict is OK
      // on what was determined; a red here names a real finding, and the line
      // above still shows the gate judged rather than compared.
      expect([0, 1]).toContain(r.status!);
      expect(gitStatus()).toBe(before);
    },
    180_000,
  );

  test(
    "translation:block-qa:check on one chapter: judges, writes nothing, and the missing baseline is UNKNOWN",
    () => {
      const base = tmp("trcli");
      const bare = join(base, "remote.git");
      git(base, "init", "-q", "--bare", "-b", "main", bare);
      const before = gitStatus();
      const r = spawnSync(
        "bun",
        ["run", "cat-harness-tools/pipeline/translation-block-qa.ts", "--check", "--root", "docs/source/process-crdm-methodology", "--against", "main"],
        { cwd: REPO, encoding: "utf-8", env: { ...process.env, QA_STORE_REMOTE: `file://${bare}`, QA_STORE_DIR: join(base, "store.git") } },
      );
      const out = r.stdout + r.stderr;
      expect(out).toContain("judge mode, wrote nothing");
      expect(out).toContain("no baseline to split NEW from inherited");
      expect(r.status).toBe(0);
      expect(gitStatus()).toBe(before);
    },
    180_000,
  );
});
