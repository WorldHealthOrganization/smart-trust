/**
 * `state:drift` — a seeded state branch still matches the ref it was seeded from.
 *
 * Bean `9ofm`. Against REAL git throughout, over a local bare repository used
 * as the remote, so the plumbing is exercised and nothing reaches the network.
 * A stub of `git` would assert the stub.
 *
 * @module scripts/tests/state-drift
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MANIFEST_SCHEMA } from "../branch-store.ts";
import { brief, candidatesOf, driftOf, exitCodeFor, observedRows, type DriftRow } from "../state-drift.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function run(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  // The STATUS, with stderr carried into the message. Asserting stderr were
  // empty would fail on git's warnings (cloning an empty repository), which
  // say nothing about whether the command worked.
  expect(`${args.join(" ")} -> ${r.status}: ${r.stderr}`).toBe(`${args.join(" ")} -> 0: ${r.stderr}`);
  return r.stdout.trim();
}

/**
 * A bare remote with `main` holding `beans/a.md`, plus whatever branches
 * `extra` adds. Returns the remote path and a fresh store directory.
 */
function remote(): { url: string; storeDir: string; work: string } {
  const base = mkdtempSync(join(tmpdir(), "state-drift-"));
  made.push(base);
  const url = join(base, "remote.git");
  run(base, "init", "-q", "--bare", "-b", "main", url);
  const work = join(base, "work");
  run(base, "clone", "-q", url, work);
  mkdirSync(join(work, "beans", "defs"), { recursive: true });
  writeFileSync(join(work, "beans", "defs", "a.md"), "one\n");
  run(work, "add", "-A");
  run(work, "commit", "-qm", "main: beans");
  run(work, "push", "-q", "origin", "main");
  return { url, storeDir: join(base, "store.git"), work };
}

/** A seed branch of `beans/`, taken from main's current tip. */
function seed(r: ReturnType<typeof remote>, branch: string, manifest: Record<string, unknown>): void {
  run(r.work, "checkout", "-q", "-B", "seedtmp", "main");
  writeFileSync(join(r.work, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  run(r.work, "add", "-A");
  run(r.work, "commit", "-qm", `seed ${branch}`);
  run(r.work, "push", "-q", "origin", `seedtmp:refs/heads/${branch}`);
  run(r.work, "checkout", "-q", "main");
}

const SEED = {
  $schema: MANIFEST_SCHEMA,
  status: "seed",
  authoritative: false,
  subgraph: "beans",
  source: { ref: "main" },
  graphs: [{ path: "beans" }],
};

const entry = (name: string) => ({ id: "beans", shape: "branch", name, legacy: [] as string[] });

function rows(r: ReturnType<typeof remote>, name = "cat/x/beans"): DriftRow[] {
  return driftOf(entry(name), { repoRoot: r.work, remote: r.url, storeDir: r.storeDir });
}

describe("candidatesOf", () => {
  test("canonical first, then legacy — the file's own resolution rule, with ONE implementation", () => {
    expect(candidatesOf({ id: "qa", shape: "branch", name: "cat/h/qa", legacy: ["cat-qa", "qa"] })).toEqual(["cat/h/qa", "cat-qa", "qa"]);
  });

  test("a `family` is a branch PREFIX, not a branch, so it is not compared", () => {
    expect(candidatesOf({ id: "lake", shape: "family", name: "cat/h/lake-cache/", legacy: [] })).toBeUndefined();
  });
});

describe("drift against the seeded ref", () => {
  test("identical trees are in-sync, and the row says which two commits it compared", () => {
    const r = remote();
    seed(r, "cat/x/beans", SEED);
    const [row] = rows(r);
    expect(row).toMatchObject({ id: "beans", path: "beans", state: "in-sync" });
    expect(row!.detail).toContain("vs main@");
  });

  test("a file changed on the SOURCE ref is drift, named — this is the state a cutover must not run in", () => {
    const r = remote();
    seed(r, "cat/x/beans", SEED);
    writeFileSync(join(r.work, "beans", "defs", "a.md"), "two\n");
    run(r.work, "commit", "-aqm", "main moves on");
    run(r.work, "push", "-q", "origin", "main");

    const [row] = rows(r);
    expect(row!.state).toBe("drift");
    expect(row!.files).toEqual(["M\tdefs/a.md"]);
  });

  test("a file added on the BRANCH is drift too: a seed somebody wrote to directly is not current either", () => {
    const r = remote();
    seed(r, "cat/x/beans", SEED);
    // `seedtmp` is where `seed()` built the seed commit; the clone has no local
    // ref for the pushed branch name.
    run(r.work, "checkout", "-q", "-B", "direct", "seedtmp");
    writeFileSync(join(r.work, "beans", "defs", "b.md"), "only on the branch\n");
    run(r.work, "add", "-A");
    run(r.work, "commit", "-qm", "written straight to the seed");
    run(r.work, "push", "-q", "origin", "direct:refs/heads/cat/x/beans");
    run(r.work, "checkout", "-q", "main");

    const [row] = rows(r);
    expect(row!.state).toBe("drift");
    // Direction is branch -> source, so a file only on the branch is a DELETE.
    expect(row!.files).toEqual(["D\tdefs/b.md"]);
  });

  test("a commit on the source ref that did not touch the subgraph is NOT drift — trees, not commit distance", () => {
    const r = remote();
    seed(r, "cat/x/beans", SEED);
    writeFileSync(join(r.work, "unrelated.md"), "x\n");
    run(r.work, "add", "-A");
    run(r.work, "commit", "-qm", "main moves, beans does not");
    run(r.work, "push", "-q", "origin", "main");
    expect(rows(r)[0]!.state).toBe("in-sync");
  });
});

describe("the three answers that are not drift", () => {
  test("a branch with no root manifest is `not-a-seed`, not `unknown` — gh-pages is healthy", () => {
    const r = remote();
    run(r.work, "push", "-q", "origin", "main:refs/heads/cat/x/beans");
    expect(rows(r)[0]).toMatchObject({ state: "not-a-seed" });
  });

  test("`authoritative: true` has no source ref to be current with", () => {
    const r = remote();
    seed(r, "cat/x/beans", { ...SEED, status: "store", authoritative: true });
    expect(rows(r)[0]).toMatchObject({ state: "authoritative" });
  });

  test("`status: retired` is NAMED and not compared, even with real drift under it", () => {
    const r = remote();
    seed(r, "cat/x/beans", { ...SEED, status: "retired", retiredReason: "superseded by the per-graph branches" });
    // Real drift on the source ref, which a seed row would report.
    writeFileSync(join(r.work, "beans", "defs", "a.md"), "moved on\n");
    run(r.work, "commit", "-aqm", "main moves on");
    run(r.work, "push", "-q", "origin", "main");

    const row = rows(r)[0]!;
    expect(row.state).toBe("retired");
    expect(row.files).toBeUndefined();
    // The reason travels with the branch, verbatim — a superseded seed is more
    // dangerous than a stale one, so WHY it is retired is the useful part.
    expect(row.detail).toBe("superseded by the per-graph branches");
  });

  test("a branch that is not on the remote is `unknown` — never reported as in-sync", () => {
    const r = remote();
    const row = rows(r, "cat/x/absent")[0]!;
    expect(row.state).toBe("unknown");
    expect(row.detail).toContain("no such branch");
  });

  test("a manifest with no `source.ref` is `unknown`: there is nothing to be current WITH", () => {
    const r = remote();
    seed(r, "cat/x/beans", { ...SEED, source: {} });
    expect(rows(r)[0]).toMatchObject({ state: "unknown" });
  });

  test("a subgraph path absent from one side is `unknown`, not an empty diff", () => {
    const r = remote();
    seed(r, "cat/x/beans", { ...SEED, graphs: [{ path: "nowhere" }] });
    const row = rows(r)[0]!;
    expect(row.state).toBe("unknown");
    expect(row.detail).toContain("nowhere is not on");
  });
});

describe("brief — the session-start form", () => {
  const row = (state: DriftRow["state"], extra: Partial<DriftRow> = {}): DriftRow => ({ id: "beans", branch: "b", path: "beans", state, ...extra });

  test("silent when every seed is current: a section printed every time is a section people skip", () => {
    expect(brief([row("in-sync"), row("retired"), row("not-a-seed")])).toBe("");
  });

  test("counts, not paths — the superseded branch alone carried 159 and would bury the sweep", () => {
    const b = brief([row("drift", { files: new Array(159).fill("M\tx"), detail: "state@aaa vs main@bbb" })]);
    expect(b).toContain("159 file(s) behind main@bbb");
    expect(b).not.toContain("M\tx");
  });

  test("says `main` is still the store, so a reader does not over-read a stale seed as a broken work-plan", () => {
    const b = brief([row("drift", { files: ["M\tx"] })]);
    expect(b).toContain("`main` is still the store");
    expect(b).toContain("It breaks the cutover");
  });

  test("an `unknown` is carried too — it is a finding, not a quiet pass", () => {
    expect(brief([row("unknown", { detail: "could not reach it" })])).toContain("could not determine: could not reach it");
  });
});

describe("exitCodeFor", () => {
  const row = (state: DriftRow["state"]): DriftRow => ({ id: "x", branch: "b", path: "p", state });

  test("drift is 1, unknown is 4, and neither is 0", () => {
    expect(exitCodeFor([row("in-sync"), row("not-a-seed"), row("authoritative")])).toBe(0);
    expect(exitCodeFor([row("in-sync"), row("unknown")])).toBe(4);
    expect(exitCodeFor([row("in-sync"), row("drift")])).toBe(1);
  });

  test("drift outranks unknown: the actionable finding is the one the exit code should carry", () => {
    expect(exitCodeFor([row("unknown"), row("drift")])).toBe(1);
  });

  test("an EMPTY report is not a pass by accident — it is 0 because there was nothing to compare", () => {
    expect(exitCodeFor([])).toBe(0);
  });
});

describe("observed, not tabled (bean rva2)", () => {
  test("every cat/** branch on the remote is a row, and one no directory declares is marked undeclared", () => {
    const remote = mkdtempSync(join(tmpdir(), "observed-remote-"));
    const repo = mkdtempSync(join(tmpdir(), "observed-repo-"));
    const run = (cwd: string, ...a: string[]) => expect(spawnSync("git", a, { cwd, encoding: "utf-8" }).status).toBe(0);
    run(remote, "init", "-q", "--bare");
    const work = mkdtempSync(join(tmpdir(), "observed-work-"));
    run(work, "init", "-q", "-b", "main");
    run(work, "config", "user.email", "t@t");
    run(work, "config", "user.name", "t");
    writeFileSync(join(work, "f"), "x");
    run(work, "add", "f");
    run(work, "commit", "-q", "-m", "x");
    for (const b of ["cat/fx/declared", "cat/fx/stray", "feature/not-special"]) run(work, "push", "-q", remote, `HEAD:refs/heads/${b}`);
    mkdirSync(join(repo, "d"));
    writeFileSync(
      join(repo, "fx.json"),
      JSON.stringify({ name: "fx", directories: [{ id: "d", path: "d/", graphTypologies: ["docs"], storage: { branch: "cat/fx/declared", keyedBy: "tip" } }] }),
    );
    const rows = observedRows({ repoRoot: repo, remote })!;
    expect(rows.map((r) => [r.name, r.id, r.declared])).toEqual([
      ["cat/fx/declared", "d", true],
      ["cat/fx/stray", "cat/fx/stray", false],
    ]);
    for (const d of [remote, repo, work]) rmSync(d, { recursive: true, force: true });
  });
  test("a remote that cannot be listed is undefined, never an empty set", () => {
    expect(observedRows({ repoRoot: tmpdir(), remote: join(tmpdir(), "no-such-remote-xyz") })).toBeUndefined();
  });
});
