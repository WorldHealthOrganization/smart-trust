/**
 * `state:seed` — refresh a seeded state branch, and refuse the two states
 * where a refresh would destroy work.
 *
 * Bean `9ofm`. Against REAL git over a local bare repository used as the
 * remote, the same harness shape as `state-drift.test.ts` beside it and for
 * the same reason: this module is git plumbing, so a stub of git would assert
 * the stub. Nothing here reaches the network.
 *
 * The refusals are what the tests are FOR. A refresh copies a whole subtree
 * in one commit, so there is no diff left to read afterwards: if
 * `authoritative` or `retired` stopped being refused, the first sign would be
 * a cutover-day store overwritten with a stale copy of a directory `main` no
 * longer tracks. That is the one failure in this file that cannot be undone
 * by re-running anything.
 *
 * @module scripts/tests/state-seed
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BranchStore, MANIFEST_SCHEMA } from "../branch-store.ts";
import { archiveIds, archiveTreeId, cutoverMain, exitCode, refreshSeed, retireInstance, rowFor } from "../state-seed.ts";
import { FROZEN_SUBTREE_FIELDS, FROZEN_SUBTREE_KIND, readFshGutsNode } from "../../schemas/kg/fsh-guts.ts";
import { defaultRepoRoot, driftOf, observedRows } from "../state-drift.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function run(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
  });
  expect(`${args.join(" ")} -> ${r.status}: ${r.stderr}`).toBe(`${args.join(" ")} -> 0: ${r.stderr}`);
  return r.stdout.trim();
}

/** A bare remote whose `main` holds `beans/defs/a.md`. */
function remote(): { url: string; storeDir: string; work: string } {
  const base = mkdtempSync(join(tmpdir(), "state-seed-"));
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

/** A seed branch of `beans/`, taken from a given ref of main's history. */
function seed(r: ReturnType<typeof remote>, branch: string, manifest: Record<string, unknown>, from = "main"): void {
  run(r.work, "checkout", "-q", "-B", "seedtmp", from);
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

const row = (name = "cat/x/beans") => ({ id: "beans", shape: "branch" as const, name, legacy: [] as string[] });

function refresh(r: ReturnType<typeof remote>, opts: Record<string, unknown> = {}) {
  return refreshSeed(row(), { repoRoot: r.work, remote: r.url, storeDir: r.storeDir, log: () => {}, ...opts });
}

/** The branch's `manifest.json`, read back off the remote. */
function manifestOn(r: ReturnType<typeof remote>, name = "cat/x/beans"): Record<string, unknown> {
  const store = BranchStore.open(name, { repoRoot: r.work, remote: r.url, storeDir: r.storeDir, log: () => {} });
  const tip = store.fetchTip();
  expect(tip.state).toBe("ok");
  const tree = store.must(["rev-parse", `${tip.state === "ok" ? tip.tip : ""}^{tree}`]).trim();
  const e = store.lookup(tree, "manifest.json")!;
  store.ensureBlobs(tree, [e.sha]);
  return JSON.parse(store.blobText(e.sha)) as Record<string, unknown>;
}

describe("a seed that is already current", () => {
  test("is `current`, pushes nothing, and exits 0", () => {
    const r = remote();
    seed(r, "cat/x/beans", SEED);
    const res = refresh(r);
    expect(res.state).toBe("current");
    expect(exitCode(res)).toBe(0);
  });
});

describe("a drifted seed", () => {
  test("is refreshed to the source ref, verified by RE-READING the tip, and `state:drift` then agrees", () => {
    const r = remote();
    seed(r, "cat/x/beans", SEED);
    writeFileSync(join(r.work, "beans", "defs", "b.md"), "two\n");
    run(r.work, "add", "-A");
    run(r.work, "commit", "-qm", "main moves on");
    run(r.work, "push", "-q", "origin", "main");

    // Drifted before.
    expect(driftOf(row(), { repoRoot: r.work, remote: r.url, storeDir: r.storeDir })[0]!.state).toBe("drift");

    const res = refresh(r);
    expect(res.state).toBe("refreshed");
    if (res.state !== "refreshed") return;
    expect(res.verified).toBe(true);
    expect(res.graphs[0]!.files).toBe(2);
    expect(exitCode(res)).toBe(0);

    // The gate that demanded the refresh is the one that has to be satisfied
    // by it — asked of the real branch, not of the result object.
    expect(driftOf(row(), { repoRoot: r.work, remote: r.url, storeDir: r.storeDir })[0]!.state).toBe("in-sync");
    expect(typeof manifestOn(r).refreshedAt).toBe("string");
  });

  test("`--dry-run` reports what it WOULD push and pushes nothing", () => {
    const r = remote();
    seed(r, "cat/x/beans", SEED);
    writeFileSync(join(r.work, "beans", "defs", "b.md"), "two\n");
    run(r.work, "add", "-A");
    run(r.work, "commit", "-qm", "main moves on");
    run(r.work, "push", "-q", "origin", "main");

    const res = refresh(r, { dryRun: true });
    expect(res.state).toBe("refreshed");
    if (res.state !== "refreshed") return;
    expect(res.commit).toBeUndefined();
    // Still drifted: a dry run that moved the branch would be the worst of
    // both answers.
    expect(driftOf(row(), { repoRoot: r.work, remote: r.url, storeDir: r.storeDir })[0]!.state).toBe("drift");
  });
});

// The three that must never silently "work". Each is a different kind of
// wrong, so each is asserted on its own reason rather than on `refused` alone.
describe("what it refuses", () => {
  test("`authoritative: true` — the branch IS the store, so a refresh would overwrite live edits", () => {
    const r = remote();
    seed(r, "cat/x/beans", { ...SEED, status: "authoritative", authoritative: true });
    const res = refresh(r);
    expect(res.state).toBe("refused");
    expect(res.reason).toMatch(/IS the store/);
    expect(exitCode(res)).toBe(5);
  });

  test("`status: retired` — a superseded seed must not be made to look current", () => {
    const r = remote();
    seed(r, "cat/x/beans", { ...SEED, status: "retired" });
    const res = refresh(r);
    expect(res.state).toBe("refused");
    expect(res.reason).toMatch(/RETIRED/);
  });

  test("no root manifest — a stray branch is not a seed of anything", () => {
    const r = remote();
    run(r.work, "checkout", "-q", "-B", "nomanifest", "main");
    run(r.work, "push", "-q", "origin", "nomanifest:refs/heads/cat/x/beans");
    run(r.work, "checkout", "-q", "main");
    const res = refresh(r);
    expect(res.state).toBe("refused");
    expect(res.reason).toMatch(/not a seed of anything/);
  });

  test("a branch that is not there at all is `unknown`, never a pass", () => {
    const r = remote();
    const res = refresh(r);
    expect(res.state).toBe("unknown");
    expect(exitCode(res)).toBe(4);
  });
});

describe("the cutover's branch half", () => {
  test("`--authoritative` marks the branch the store, and the next refresh is REFUSED", () => {
    const r = remote();
    seed(r, "cat/x/beans", SEED);
    writeFileSync(join(r.work, "beans", "defs", "b.md"), "two\n");
    run(r.work, "add", "-A");
    run(r.work, "commit", "-qm", "main moves on");
    run(r.work, "push", "-q", "origin", "main");

    const res = refresh(r, { authoritative: true });
    expect(res.state).toBe("refreshed");
    if (res.state !== "refreshed") return;
    expect(res.verified).toBe(true);

    const m = manifestOn(r);
    expect(m.authoritative).toBe(true);
    expect(m.status).toBe("authoritative");
    expect(typeof m.authoritativeSince).toBe("string");
    // `state:drift` stops comparing it — there is no source ref to be current
    // with once the branch is the store.
    expect(driftOf(row(), { repoRoot: r.work, remote: r.url, storeDir: r.storeDir })[0]!.state).toBe("authoritative");
    // One-way: the command now refuses its own output.
    expect(refresh(r).state).toBe("refused");
  });
});

describe("the key it takes", () => {
  test("`rowFor` matches an observed row by id, so the live rows are the vocabulary", () => {
    expect(rowFor("beans")?.name).toBe("cat/cat-harness/beans");
    expect(rowFor("todos")?.name).toBe("cat/cat-harness/todos");
    expect(rowFor("no-such-row")).toBeUndefined();
  });

  test("a branch FAMILY is refused: a prefix is not a seed", () => {
    // Built inline: the special-branches table this used to read is retired (bean rva2).
    const fam = { id: "build-cache", shape: "family", name: "cat/x/build-cache/", legacy: [] };
    const res = refreshSeed(fam, { log: () => {} });
    expect(res.state).toBe("refused");
    expect(res.reason).toMatch(/branch FAMILY/);
  });
});


/**
 * Bean `hp54`, measured 2026-10-06 cutting a folio over: run from a folio
 * that links the platform, every default read the PLATFORM's declarations,
 * and the cutover's main half had no command at all. A scratch folio — its
 * own declaration, its own remote — stands in for the folio.
 */
describe("a folio's own repository (hp54)", () => {
  /**
   * A folio `x` declaring `beans/` on `cat/x/beans`, committed on main while
   * main still tracks it — and, unless `guts` is false, its own `fsh-guts`
   * graph on `cat/x/fsh-guts`, seeded empty, where the cutover deposits.
   */
  function folio(guts: false | "seeded" | "declared-only" = "seeded"): ReturnType<typeof remote> {
    const r = remote();
    // `cutoverMain` commits with plain `git commit`, so the clone needs an
    // identity of its own — CI's fresh HOME has none (the env `run` passes
    // does not reach a commit the module under test makes).
    run(r.work, "config", "user.name", "t");
    run(r.work, "config", "user.email", "t@t");
    writeFileSync(
      join(r.work, "x.json"),
      JSON.stringify({
        name: "x",
        directories: [
          { id: "beans", path: "beans/", graphTypologies: ["beans"], source: { kind: "branch", branch: "cat/x/beans", keyedBy: "tip" } },
          ...(guts ? [{ id: "fsh-guts", path: "fsh-guts/", graphTypologies: ["fsh-guts"], source: { kind: "branch", branch: "cat/x/fsh-guts", keyedBy: "tip" } }] : []),
        ],
      }, null, 2) + "\n",
    );
    run(r.work, "add", "-A");
    run(r.work, "commit", "-qm", "declare beans on its branch");
    if (guts === "seeded") seedGuts(r);
    return r;
  }
  /** `cat/x/fsh-guts`: an orphan tip-keyed state branch holding only its manifest. */
  function seedGuts(r: ReturnType<typeof remote>): void {
    run(r.work, "checkout", "-q", "--orphan", "gutstmp");
    run(r.work, "rm", "-rqf", "--cached", ".");
    const tmp = mkdtempSync(join(tmpdir(), "guts-idx-"));
    made.push(tmp);
    const env = { ...process.env, GIT_INDEX_FILE: join(tmp, "index"), GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
    const g = (args: string[], input?: string) => spawnSync("git", args, { cwd: r.work, env, input, encoding: "utf-8" }).stdout.trim();
    const blob = g(["hash-object", "-w", "--stdin"], JSON.stringify({ $schema: MANIFEST_SCHEMA, authoritative: true, keyedBy: "tip", subgraph: "fsh-guts", graphs: [{ path: "fsh-guts" }] }) + "\n");
    g(["update-index", "--add", "--cacheinfo", `100644,${blob},manifest.json`]);
    const commit = g(["commit-tree", g(["write-tree"]), "-m", "seed cat/x/fsh-guts"]);
    run(r.work, "push", "-q", "origin", `${commit}:refs/heads/cat/x/fsh-guts`);
    run(r.work, "checkout", "-qf", "main");
  }
  /** What `cat/x/fsh-guts` holds under `fsh-guts/retired/`, read back off the remote. */
  function gutsOn(r: ReturnType<typeof remote>): Map<string, Buffer> {
    const store = BranchStore.open("cat/x/fsh-guts", { repoRoot: r.work, remote: r.url, storeDir: r.storeDir, log: () => {} });
    const t = store.readTreeEntries("fsh-guts/retired");
    return t.state === "hit" ? new Map([...t.files].map(([p, f]) => [p, f.bytes])) : new Map();
  }
  const cut = (r: ReturnType<typeof remote>, commit = false) =>
    cutoverMain(row(), { repoRoot: r.work, remote: r.url, storeDir: r.storeDir, commit });

  test("the default repository is the cwd's git toplevel, and resolves the folio's branch", () => {
    const r = folio();
    expect(realpathSync(defaultRepoRoot(join(r.work, "beans")))).toBe(realpathSync(r.work));
    seed(r, "cat/x/beans", SEED);
    expect(rowFor("beans", observedRows({ repoRoot: r.work, remote: r.url }) ?? [])?.name).toBe("cat/x/beans");
  });

  test("the CLI run FROM the folio root resolves the folio's branch, not the platform's", () => {
    const r = folio();
    seed(r, "cat/x/beans", { ...SEED, keyedBy: "tip", authoritative: true });
    const cli = spawnSync("bun", ["run", join(import.meta.dir, "..", "state-seed.ts"), "--id", "beans", "--cutover"], {
      cwd: r.work,
      encoding: "utf-8",
      env: { ...process.env, BRANCH_STORE_DIR: r.storeDir },
    });
    expect(cli.stdout + cli.stderr).toContain("cat/x/beans");
    expect(cli.stdout).toContain("would-cut-over");
    expect(cli.status).toBe(0);
  });

  test("--cutover refuses a branch whose manifest is not tip-keyed (the mount would be corrupt)", () => {
    const r = folio();
    seed(r, "cat/x/beans", { ...SEED, authoritative: true, keyedBy: undefined });
    const c = cut(r);
    expect(c.state).toBe("refused");
    expect(c.reason).toContain("not tip");
  });

  test("--cutover refuses while the branch is not authoritative", () => {
    const r = folio();
    seed(r, "cat/x/beans", { ...SEED, keyedBy: "tip" });
    const c = cut(r);
    expect(c.state).toBe("refused");
    expect(c.reason).toContain("authoritative");
  });

  test("--cutover refuses when the branch's tree is not byte-identical to HEAD's", () => {
    const r = folio();
    seed(r, "cat/x/beans", { ...SEED, keyedBy: "tip", authoritative: true });
    writeFileSync(join(r.work, "beans", "defs", "a.md"), "edited after the seed\n");
    run(r.work, "commit", "-qam", "edit on main");
    const c = cut(r);
    expect(c.state).toBe("refused");
    expect(c.reason).toContain("not byte-identical");
  });

  test("--cutover refuses a path no declaration keeps on that branch", () => {
    const r = remote(); // main tracks beans/ but declares nothing
    seed(r, "cat/x/beans", { ...SEED, keyedBy: "tip", authoritative: true });
    const c = cut(r);
    expect(c.state).toBe("refused");
    expect(c.reason).toContain("Declare");
  });

  test("dry run reports files and bytes; --commit removes and ignores in ONE commit, and pushes nothing", () => {
    const r = folio();
    seed(r, "cat/x/beans", { ...SEED, keyedBy: "tip", authoritative: true });
    const dry = cut(r);
    expect(dry.state).toBe("would-cut-over");
    if (dry.state !== "would-cut-over") return;
    expect(dry.paths).toEqual([expect.objectContaining({ path: "beans", files: 1, bytes: 4 })]);
    expect(existsSync(join(r.work, "beans", "defs", "a.md"))).toBe(true); // a dry run touches nothing

    const remoteMain = run(r.work, "ls-remote", "origin", "refs/heads/main");
    const before = run(r.work, "rev-parse", "HEAD");
    const done = cut(r, true);
    expect(done.state).toBe("cut-over");
    expect(run(r.work, "rev-parse", "HEAD~1")).toBe(before); // exactly one commit
    expect(spawnSync("git", ["rev-parse", "--verify", "--quiet", "HEAD:beans"], { cwd: r.work }).status).not.toBe(0);
    expect(readFileSync(join(r.work, ".gitignore"), "utf-8")).toContain("/beans/**");
    expect(run(r.work, "show", "--stat", "--format=%B", "HEAD")).toContain("cat/x/beans");
    expect(run(r.work, "ls-remote", "origin", "refs/heads/main")).toBe(remoteMain); // not pushed
    expect(cut(r).state).toBe("refused"); // already cut over
  });

  /**
   * Owner, 2026-10-06: "cutover dirs should go to fsh-guts". The removal
   * DEPOSITS a snapshot into the layer's own trashcan first, verifies it,
   * and only then makes the removal commit.
   */
  describe("the deposit into fsh-guts", () => {
    test("deposit THEN remove: the fsh-guts commit exists before main's, and main's names it", () => {
      const r = folio();
      seed(r, "cat/x/beans", { ...SEED, keyedBy: "tip", authoritative: true });
      const tree = run(r.work, "rev-parse", "HEAD:beans");
      const done = cut(r, true);
      expect(done.state).toBe("cut-over");
      if (done.state !== "cut-over") return;
      expect(done.deposits).toHaveLength(1);
      const d = done.deposits[0]!;
      expect(d.branch).toBe("cat/x/fsh-guts");
      expect(d.archive).toBe(`fsh-guts/retired/cutover-x-beans-${tree.slice(0, 12)}.tar.gz`);
      // Ordering, observed rather than assumed: the deposit commit is older
      // than (or as old as) the removal commit, and the removal names it.
      run(r.work, "fetch", "-q", "origin", "cat/x/fsh-guts");
      expect(run(r.work, "rev-parse", "FETCH_HEAD")).toBe(d.commit!);
      const depositAt = Number(run(r.work, "log", "-1", "--format=%ct", d.commit!));
      const removalAt = Number(run(r.work, "log", "-1", "--format=%ct", "HEAD"));
      expect(depositAt).toBeLessThanOrEqual(removalAt);
      expect(run(r.work, "log", "-1", "--format=%B", "HEAD")).toContain(d.commit!.slice(0, 12));
      expect(gutsOn(r).has(d.record)).toBe(true);
    });

    test("the deposited archive extracts to EXACTLY the removed tree, and the record carries the provenance", () => {
      const r = folio();
      // A second file, an executable bit and a .gitignore that would hide a
      // tracked file from a naive re-add — each one a way a snapshot drifts.
      writeFileSync(join(r.work, "beans", "run.sh"), "#!/bin/sh\n", { mode: 0o755 });
      writeFileSync(join(r.work, "beans", ".gitignore"), "*.log\n");
      writeFileSync(join(r.work, "beans", "kept.log"), "tracked despite the ignore\n");
      run(r.work, "add", "-f", "-A");
      run(r.work, "commit", "-qm", "more beans");
      seed(r, "cat/x/beans", { ...SEED, keyedBy: "tip", authoritative: true });
      const tree = run(r.work, "rev-parse", "HEAD:beans");
      const source = run(r.work, "rev-parse", "HEAD");
      const done = cut(r, true);
      expect(done.state).toBe("cut-over");
      if (done.state !== "cut-over") return;
      const d = done.deposits[0]!;
      const files = gutsOn(r);
      expect(archiveTreeId(files.get(d.archive)!, "beans")).toBe(tree);
      const rec = readFshGutsNode(files.get(d.record)!.toString("utf-8"));
      expect(rec.node).toBeDefined();
      expect(rec.node).toMatchObject({
        kind: "cutover-snapshot",
        movedFrom: "beans/",
        reason: "cutover",
        instance: "x",
        directory: "beans",
        sourceCommit: source,
        tree,
        authoritativeBranch: "cat/x/beans",
      });
    });

    test("REFUSES when the instance declares no fsh-guts graph, naming the fix — and removes nothing", () => {
      const r = folio(false);
      seed(r, "cat/x/beans", { ...SEED, keyedBy: "tip", authoritative: true });
      const before = run(r.work, "rev-parse", "HEAD");
      for (const commit of [false, true]) {
        const c = cut(r, commit);
        expect(c.state).toBe("refused");
        expect(c.reason).toContain("declares no `fsh-guts` graph");
        expect(c.reason).toContain("cat/x/fsh-guts");
      }
      expect(run(r.work, "rev-parse", "HEAD")).toBe(before);
      expect(run(r.work, "rev-parse", "HEAD:beans")).toBeTruthy();
    });

    test("REFUSES when the deposit cannot be made (declared, branch never seeded) — and removes nothing", () => {
      const r = folio("declared-only");
      seed(r, "cat/x/beans", { ...SEED, keyedBy: "tip", authoritative: true });
      const before = run(r.work, "rev-parse", "HEAD");
      expect(cut(r).state).toBe("refused"); // the dry run says so before anybody says go
      const c = cut(r, true);
      expect(c.state).toBe("refused");
      expect(c.reason).toContain("cat/x/fsh-guts");
      expect(c.reason).toContain("nothing was removed");
      expect(run(r.work, "rev-parse", "HEAD")).toBe(before);
      expect(run(r.work, "status", "--porcelain")).toBe("");
    });

    test("REFUSES when an item of the same name with different content is already there — never overwrites", () => {
      const r = folio();
      seed(r, "cat/x/beans", { ...SEED, keyedBy: "tip", authoritative: true });
      const tree = run(r.work, "rev-parse", "HEAD:beans");
      const store = BranchStore.open("cat/x/fsh-guts", { repoRoot: r.work, remote: r.url, storeDir: r.storeDir, log: () => {} });
      const squatter = `fsh-guts/retired/cutover-x-beans-${tree.slice(0, 12)}.tar.gz`;
      expect(store.write([{ path: squatter, content: "not the snapshot\n" }], "squat").state).toBe("pushed");
      const before = run(r.work, "rev-parse", "HEAD");
      const c = cut(r, true);
      expect(c.state).toBe("refused");
      expect(c.reason).toContain("different content");
      expect(run(r.work, "rev-parse", "HEAD")).toBe(before);
      expect(gutsOn(r).get(squatter)!.toString()).toBe("not the snapshot\n");
    });
  });
});

/**
 * `--retire <path> --into <instance>`: separating a whole layer root into
 * the HOST's trashcan (stage 13 of `sub-kg-lifecycle`), asked for by the
 * session separating smart-trust, smart-base and smart-immunizations (#2320).
 * The refusals are the point, as for `--cutover`: what leaves main must be
 * on the host's fsh-guts tip, byte for byte, before the `git rm`.
 */
describe("separating an instance (--retire)", () => {
  /** Host `h` (fsh-guts on `cat/h/fsh-guts`), a layer `leaf/` inside it, and a fork for the live copy. */
  function hostWithLeaf(opts: { guts?: boolean; eol?: boolean } = {}) {
    const r = remote();
    run(r.work, "config", "user.name", "t");
    run(r.work, "config", "user.email", "t@t");
    writeFileSync(
      join(r.work, "h.json"),
      JSON.stringify({
        name: "h",
        directories: opts.guts === false ? [] : [{ id: "fsh-guts", path: "fsh-guts/", graphTypologies: ["fsh-guts"], source: { kind: "branch", branch: "cat/h/fsh-guts", keyedBy: "tip" } }],
      }, null, 2) + "\n",
    );
    mkdirSync(join(r.work, "leaf", "docs"), { recursive: true });
    writeFileSync(join(r.work, "leaf", "leaf.json"), JSON.stringify({ name: "leaf", directories: [] }) + "\n");
    writeFileSync(join(r.work, "leaf", "docs", "a.md"), "leaf content\n");
    writeFileSync(join(r.work, "leaf", "run.sh"), "#!/bin/sh\n", { mode: 0o755 });
    writeFileSync(join(r.work, "leaf", ".gitignore"), "*.log\n");
    writeFileSync(join(r.work, "leaf", "kept.log"), "tracked despite the ignore\n");
    writeFileSync(join(r.work, "leaf.config.json"), "{}\n");
    if (opts.eol) {
      writeFileSync(join(r.work, ".gitattributes"), "*.bat text eol=crlf\n");
      writeFileSync(join(r.work, "leaf", "w.bat"), "@echo off\nexit /b 0\n");
    }
    run(r.work, "add", "-A", "-f");
    run(r.work, "commit", "-qm", "host with a leaf instance");
    if (opts.guts !== false) {
      run(r.work, "checkout", "-q", "--orphan", "gutstmp");
      run(r.work, "rm", "-rqf", "--cached", ".");
      const tmp = mkdtempSync(join(tmpdir(), "guts-idx-"));
      made.push(tmp);
      const env = { ...process.env, GIT_INDEX_FILE: join(tmp, "index"), GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
      const g = (args: string[], input?: string) => spawnSync("git", args, { cwd: r.work, env, input, encoding: "utf-8" }).stdout.trim();
      const blob = g(["hash-object", "-w", "--stdin"], JSON.stringify({ $schema: MANIFEST_SCHEMA, authoritative: true, keyedBy: "tip", subgraph: "fsh-guts", graphs: [{ path: "fsh-guts" }] }) + "\n");
      g(["update-index", "--add", "--cacheinfo", `100644,${blob},manifest.json`]);
      run(r.work, "push", "-q", "origin", `${g(["commit-tree", g(["write-tree"]), "-m", "seed cat/h/fsh-guts"])}:refs/heads/cat/h/fsh-guts`);
      run(r.work, "checkout", "-qf", "main");
    }
    const fork = join(r.work, "..", "fork.git");
    run(r.work, "init", "-q", "--bare", "-b", "main", fork);
    run(r.work, "push", "-q", fork, "main");
    return { ...r, fork };
  }
  const retire = (r: ReturnType<typeof hostWithLeaf>, o: Partial<Parameters<typeof retireInstance>[1]> = {}) =>
    retireInstance("leaf", { repoRoot: r.work, remote: r.url, storeDir: r.storeDir, into: "h", repository: r.fork, also: ["leaf.config.json"], ...o });
  function gutsSeparated(r: ReturnType<typeof hostWithLeaf>): Map<string, Buffer> {
    const store = BranchStore.open("cat/h/fsh-guts", { repoRoot: r.work, remote: r.url, storeDir: r.storeDir, log: () => {} });
    const t = store.readTreeEntries("fsh-guts/separated");
    return t.state === "hit" ? new Map([...t.files].map(([p, f]) => [p, f.bytes])) : new Map();
  }

  test("a root eol=crlf attribute does not make the snapshot differ from HEAD (folio-assistant-sci, 2026-10-07)", () => {
    // `git archive HEAD` applied the root's `*.bat eol=crlf`, so the snapshot
    // held CRLF where the object store held LF and every retire was refused.
    const r = hostWithLeaf({ eol: true });
    const d = retire(r);
    expect(d.state).toBe("would-retire");
  });

  test("dry run deposits nothing and removes nothing", () => {
    const r = hostWithLeaf();
    const before = run(r.work, "rev-parse", "HEAD");
    const dry = retire(r);
    expect(dry.state).toBe("would-retire");
    expect(run(r.work, "rev-parse", "HEAD")).toBe(before);
    expect(gutsSeparated(r).size).toBe(0);
  });

  test("--commit deposits into the HOST's fsh-guts, then removes the root and its --also files in ONE unpushed commit", () => {
    const r = hostWithLeaf();
    const head = run(r.work, "rev-parse", "HEAD");
    const ids = { leaf: run(r.work, "rev-parse", "HEAD:leaf"), cfg: run(r.work, "rev-parse", "HEAD:leaf.config.json") };
    const remoteMain = run(r.work, "ls-remote", "origin", "refs/heads/main");
    const done = retire(r, { commit: true, bean: "x-1234" });
    expect(done.state).toBe("retired");
    if (done.state !== "retired") return;
    expect(done.deposit.branch).toBe("cat/h/fsh-guts");
    expect(done.deposit.archive).toBe("fsh-guts/separated/leaf.tar.gz");
    expect(run(r.work, "rev-parse", "HEAD~1")).toBe(head);
    for (const p of ["leaf", "leaf.config.json"]) {
      expect(spawnSync("git", ["rev-parse", "--verify", "--quiet", `HEAD:${p}`], { cwd: r.work }).status).not.toBe(0);
    }
    expect(run(r.work, "ls-remote", "origin", "refs/heads/main")).toBe(remoteMain);

    const files = gutsSeparated(r);
    const got = archiveIds(files.get(done.deposit.archive)!, ["leaf", "leaf.config.json"])!;
    expect(got.get("leaf")).toBe(ids.leaf);
    expect(got.get("leaf.config.json")).toBe(ids.cfg);
    const note = readFshGutsNode(files.get(done.deposit.record)!.toString("utf-8"));
    expect(note.node).toMatchObject({
      kind: FROZEN_SUBTREE_KIND,
      movedFrom: "leaf/",
      repository: r.fork,
      matchesCommit: head,
      repositoryCompared: "false", // the front-matter reader keeps scalars as strings
      instance: "leaf",
      into: "h",
      bean: "x-1234",
    });
    for (const k of FROZEN_SUBTREE_FIELDS) expect((note.node as Record<string, unknown>)[k]).toBeTruthy();
    expect((note.node as Record<string, unknown>).paths).toEqual([
      `leaf = ${ids.leaf} (5 file(s), 89 bytes)`,
      `leaf.config.json = ${ids.cfg} (1 file(s), 3 bytes)`,
    ]);
    expect(retire(r).state).toBe("refused"); // already separated
  });

  test("REFUSES a directory that is not an instance root — that is a cutover", () => {
    const r = hostWithLeaf();
    const c = retireInstance("leaf/docs", { repoRoot: r.work, remote: r.url, storeDir: r.storeDir, into: "h", repository: r.fork });
    expect(c.state).toBe("refused");
    expect(c.reason).toContain("not an instance root");
  });

  test("REFUSES --into the instance that is leaving, or one that does not exist", () => {
    const r = hostWithLeaf();
    for (const into of ["leaf", "nope"]) {
      const c = retire(r, { into });
      expect(c.state).toBe("refused");
      expect(c.reason).toContain("no OTHER instance");
    }
  });

  test("REFUSES when the host keeps no fsh-guts, naming the fix — and removes nothing", () => {
    const r = hostWithLeaf({ guts: false });
    const before = run(r.work, "rev-parse", "HEAD");
    const c = retire(r, { commit: true });
    expect(c.state).toBe("refused");
    expect(c.reason).toContain("declares no `fsh-guts` graph");
    expect(run(r.work, "rev-parse", "HEAD")).toBe(before);
  });

  test("a repository that does not answer is `unknown`, never a guess — and removes nothing", () => {
    const r = hostWithLeaf();
    const before = run(r.work, "rev-parse", "HEAD");
    const c = retire(r, { commit: true, repository: join(r.work, "..", "no-such.git") });
    expect(c.state).toBe("unknown");
    expect(run(r.work, "rev-parse", "HEAD")).toBe(before);
    expect(gutsSeparated(r).size).toBe(0);
  });

  test("REFUSES uncommitted changes under the root", () => {
    const r = hostWithLeaf();
    writeFileSync(join(r.work, "leaf", "docs", "a.md"), "edited, not committed\n");
    const c = retire(r, { commit: true });
    expect(c.state).toBe("refused");
    expect(c.reason).toContain("uncommitted");
  });

  test("REFUSES rather than overwrite an item of the same name already in the host's trashcan", () => {
    const r = hostWithLeaf();
    const store = BranchStore.open("cat/h/fsh-guts", { repoRoot: r.work, remote: r.url, storeDir: r.storeDir, log: () => {} });
    expect(store.write([{ path: "fsh-guts/separated/leaf.tar.gz", content: "squat\n" }], "squat").state).toBe("pushed");
    const before = run(r.work, "rev-parse", "HEAD");
    const c = retire(r, { commit: true });
    expect(c.state).toBe("refused");
    expect(c.reason).toContain("different content");
    expect(run(r.work, "rev-parse", "HEAD")).toBe(before);
  });
});
