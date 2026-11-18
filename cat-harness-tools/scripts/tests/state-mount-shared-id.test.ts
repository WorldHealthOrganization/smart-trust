/**
 * Several layers of one index each declaring a state graph with the SAME id.
 *
 * Found on folio-assistant#2529 (2026-10-11): cat-harness, cat-harness-tools,
 * folio-assistant-core and who-iris each declare `health` on a branch of their
 * own. `tipLocations` kept the first location per id and the markers were
 * filed by id, so only cat-harness's mounted; the other three were skipped
 * without a word, and `audit:coverage` reported `health` undetermined and
 * refused to write its sidecar.
 *
 * And the second half: a graph declared INSIDE a remote-mounted layer is
 * that layer's state, so it is read from — and pushed to — the layer's
 * own repository (named by the index lock), at its instance-relative path.
 *
 * Real repositories throughout, as in `state-mount-per-branch.test.ts`: the
 * failure is a fetch that does not happen, which a stub cannot show.
 *
 * @module scripts/tests/state-mount-shared-id
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { MOUNT_MARKER_SCHEMA, gitBlobId, markerPath, resolveTipLocation, tipLocations } from "../branch-store.ts";
import { tipPresence } from "../check-declared-dirs.ts";
import { graphReadPath } from "../graph-read.ts";
import { stateMountedDirs } from "../mount-from-lock.ts";
import { mountState } from "../state-mount.ts";
import { pushState } from "../state-push.ts";

const NOGPG = ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t"];
const MANIFEST = JSON.stringify({ $schema: "state-manifest/v1", status: "seed", authoritative: false, keyedBy: "tip" });
const SHA = "0".repeat(40);

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", [...NOGPG, ...args], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} → ${r.status}\n${r.stderr}`);
  return r.stdout;
}

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Seed `branch` on the bare repository `bare` with `files`. */
function seed(base: string, bare: string, branch: string, files: Record<string, string>): void {
  const dir = mkdtempSync(join(base, "seed-"));
  git(dir, "init", "-q", "-b", "seed");
  for (const [p, t] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), t);
  }
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", `seed ${branch}`);
  git(dir, "push", "-q", `file://${bare}`, `HEAD:refs/heads/${branch}`);
}

/** The file at `path` on `branch` of the bare repository, or undefined. */
function onBranch(bare: string, branch: string, path: string): string | undefined {
  const r = spawnSync("git", ["--git-dir", bare, "show", `refs/heads/${branch}:${path}`], { encoding: "utf-8" });
  return r.status === 0 ? r.stdout : undefined;
}

const INSTANCES = ["alpha", "beta"] as const;
const HEALTH = "test/health/results";

/**
 * An index checkout with two remote-mounted layers, `alpha/` and `beta/`,
 * each declaring `health` at `test/health/results/` on `cat/<instance>/health`.
 * Each layer's branch is seeded in ITS OWN repository at the
 * instance-relative path; the checkout's `origin` holds an index-layout copy
 * of alpha's only (what folio-assistant carried on 2026-10-11).
 */
function index() {
  const base = mkdtempSync(join(tmpdir(), "state-mount-shared-id-"));
  made.push(base);
  const origin = join(base, "origin.git");
  git(base, "init", "-q", "--bare", "-b", "main", origin);
  const repos: Record<string, string> = {};
  for (const name of INSTANCES) {
    repos[name] = join(base, `${name}.git`);
    git(base, "init", "-q", "--bare", "-b", "main", repos[name]!);
    seed(base, repos[name]!, `cat/${name}/health`, { "manifest.json": MANIFEST, [`${HEALTH}/report.json`]: `{"from":"${name}"}\n` });
  }
  seed(base, origin, "cat/alpha/health", { "manifest.json": MANIFEST, [`alpha/${HEALTH}/report.json`]: `{"from":"index copy"}\n` });

  const work = join(base, "work");
  mkdirSync(work);
  git(work, "init", "-q", "-b", "main");
  writeFileSync(join(work, "README.md"), "index\n");
  git(work, "add", "README.md");
  git(work, "commit", "-q", "-m", "root");
  git(work, "remote", "add", "origin", `file://${origin}`);
  for (const name of INSTANCES) {
    mkdirSync(join(work, name));
    writeFileSync(
      join(work, name, `${name}.json`),
      JSON.stringify({
        $schema: "cat-harness-declaration/1.0.0",
        name,
        directories: [{ id: "health", path: `${HEALTH}/`, graphTypologies: ["health"], storage: { branch: `cat/${name}/health`, keyedBy: "tip" } }],
      }),
    );
  }
  writeFileSync(
    join(work, "index.lock.json"),
    JSON.stringify({
      $schema: "cat-harness-mount-lock/v1",
      mounts: INSTANCES.map((n) => ({ harness: n, repository: `test/${n}`, ref: SHA })),
      instances: INSTANCES.map((n) => ({
        instance: n,
        repository: `test/${n}`,
        sha: SHA,
        upstreamRoot: "",
        path: n,
        via: n,
        pinnedBy: "declared",
        declaration: { file: `${n}.json`, sha256: "0".repeat(64) },
        directories: [],
      })),
      unmounted: [],
    }),
  );
  const urlFor = (repository: string): string => `file://${repos[repository.replace(/^test\//, "")]}`;
  return { base, origin, repos, work, store: { urlFor } };
}

describe("two instances declaring the same state-graph id", () => {
  test("tipLocations lists BOTH, each keyed by its instance and read from its own repository", () => {
    const f = index();
    expect(tipLocations(f.work)).toEqual([
      { id: "health", path: `alpha/${HEALTH}`, branch: "cat/alpha/health", keyedBy: "tip", repository: "test/alpha", instance: "alpha", branchPath: HEALTH, key: "alpha.health" },
      { id: "health", path: `beta/${HEALTH}`, branch: "cat/beta/health", keyedBy: "tip", repository: "test/beta", instance: "beta", branchPath: HEALTH, key: "beta.health" },
    ]);
  });

  test("resolveTipLocation refuses the shared id as ambiguous and takes a key", () => {
    const f = index();
    expect(() => resolveTipLocation("health", f.work)).toThrow("2 declared directories have id health");
    expect(resolveTipLocation("beta.health", f.work)).toMatchObject({ path: `beta/${HEALTH}`, repository: "test/beta" });
  });

  test("state:mount mounts both, each from its own repository, with a marker apiece", () => {
    const f = index();
    const r = mountState({ repoRoot: f.work, store: f.store });
    expect(r.state).toBe("mounted");
    expect(r.graphs.map((g) => [g.id, g.state])).toEqual([
      ["alpha.health", "mounted"],
      ["beta.health", "mounted"],
    ]);
    for (const n of INSTANCES) {
      expect(readFileSync(join(f.work, n, HEALTH, "report.json"), "utf-8")).toBe(`{"from":"${n}"}\n`);
      expect(existsSync(markerPath(f.work, `${n}.health`))).toBe(true);
    }
    // The consumers that read markers by directory, not by name, see both.
    expect(stateMountedDirs(f.work).sort()).toEqual(INSTANCES.map((n) => join(f.work, n, HEALTH)));
    for (const n of INSTANCES) {
      expect(tipPresence({ id: "health", branch: `cat/${n}/health`, keyedBy: "tip" }, join(f.work, n, HEALTH), f.work)).toEqual({
        state: "mounted",
        into: join(f.work, n, HEALTH),
      });
    }
  });

  test("`--id health` selects every graph with that id; a key selects one", () => {
    const f = index();
    expect(mountState({ repoRoot: f.work, store: f.store, id: "health" }).graphs.map((g) => g.id)).toEqual(["alpha.health", "beta.health"]);
    expect(mountState({ repoRoot: f.work, store: f.store, id: "beta.health" }).graphs.map((g) => g.id)).toEqual(["beta.health"]);
  });

  test("a push goes to the instance's own repository, at its instance-relative path", () => {
    const f = index();
    mountState({ repoRoot: f.work, store: f.store });
    writeFileSync(join(f.work, "beta", HEALTH, "report.json"), '{"from":"beta","edited":true}\n');
    const p = pushState({ repoRoot: f.work, store: f.store, retag: false });
    expect(p.state).toBe("pushed");
    expect(p.graphs.map((g) => [g.id, g.state])).toEqual([
      ["alpha.health", "unchanged"],
      ["beta.health", "pushed"],
    ]);
    expect(onBranch(f.repos.beta!, "cat/beta/health", `${HEALTH}/report.json`)).toBe('{"from":"beta","edited":true}\n');
    expect(onBranch(f.repos.alpha!, "cat/alpha/health", `${HEALTH}/report.json`)).toBe('{"from":"alpha"}\n');
  });
});

describe("a marker written before locations were keyed", () => {
  /** What the old code left for alpha's health: `health.json`, read from the checkout's origin. */
  function legacy(f: ReturnType<typeof index>, content: string): void {
    const into = join(f.work, "alpha", HEALTH);
    mkdirSync(into, { recursive: true });
    writeFileSync(join(into, "report.json"), content);
    const p = markerPath(f.work, "health");
    mkdirSync(dirname(p), { recursive: true });
    const blob = gitBlobId(Buffer.from('{"from":"index copy"}\n'));
    writeFileSync(
      p,
      JSON.stringify({
        $schema: MOUNT_MARKER_SCHEMA,
        id: "health",
        branch: "cat/alpha/health",
        path: `alpha/${HEALTH}`,
        into,
        tip: SHA,
        files: { "report.json": { blob, mode: "100644" } },
      }),
    );
  }

  test("with no edits, the re-mount replaces it with the keyed marker — never leaves both", () => {
    const f = index();
    legacy(f, '{"from":"index copy"}\n');
    expect(mountState({ repoRoot: f.work, store: f.store }).state).toBe("mounted");
    const names = readdirSync(dirname(markerPath(f.work, "x"))).sort();
    expect(names).toEqual(["alpha.health.json", "beta.health.json"]);
    expect(readFileSync(join(f.work, "alpha", HEALTH, "report.json"), "utf-8")).toBe('{"from":"alpha"}\n');
  });

  test("with edits, it is found, left untouched, and its edits push to where they were read from", () => {
    const f = index();
    legacy(f, '{"from":"index copy","edited":true}\n');
    const m = mountState({ repoRoot: f.work, store: f.store });
    expect(m.graphs.find((g) => g.id === "alpha.health")?.state).toBe("stale");
    expect(existsSync(markerPath(f.work, "health"))).toBe(true);
    const p = pushState({ repoRoot: f.work, store: f.store, retag: false, id: "alpha.health" });
    expect(p.graphs.map((g) => [g.id, g.state])).toEqual([["alpha.health", "pushed"]]);
    // The old marker recorded no repository: its mount came from the checkout's
    // origin in the index layout, and that is where its edits go back.
    expect(onBranch(f.origin, "cat/alpha/health", `alpha/${HEALTH}/report.json`)).toBe('{"from":"index copy","edited":true}\n');
    expect(onBranch(f.repos.alpha!, "cat/alpha/health", `${HEALTH}/report.json`)).toBe('{"from":"alpha"}\n');
  });
});

describe("a mounted layer's own work plan is never the checkout's", () => {
  /**
   * smart-ips-pilgrimage#25 (2026-11-07; owner's ruling: the checkout's `beans`
   * resolves only to the checkout's own). `plat` declares the checkout-level
   * `beans` (REPOSITORY-scoped, at `beans/`, as cat-harness does) on a branch
   * the checkout's origin does not carry, so it is absent here. `up`, a
   * mounted layer, keeps its own `beans` on its own branch, and that one
   * mounts. The checkout's work plan must stay absent, not become `up`'s.
   */
  function withUpstreamBeans() {
    const base = mkdtempSync(join(tmpdir(), "state-mount-own-beans-"));
    made.push(base);
    const origin = join(base, "origin.git");
    git(base, "init", "-q", "--bare", "-b", "main", origin);
    const up = join(base, "up.git");
    git(base, "init", "-q", "--bare", "-b", "main", up);
    seed(base, up, "cat/up/beans", { "manifest.json": MANIFEST, "beans/defs/up-0001--an-upstream-issue.md": "---\ntitle: an upstream issue\n---\n" });

    const work = join(base, "work");
    mkdirSync(work);
    git(work, "init", "-q", "-b", "main");
    writeFileSync(join(work, "README.md"), "index\n");
    git(work, "add", "README.md");
    git(work, "commit", "-q", "-m", "root");
    git(work, "remote", "add", "origin", `file://${origin}`);
    const decl = (name: string, beans: Record<string, unknown>) => {
      mkdirSync(join(work, name));
      writeFileSync(join(work, name, `${name}.json`), JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name, directories: [beans] }));
    };
    decl("plat", { id: "beans", path: "beans/", scope: "repository", graphTypologies: ["beans"], source: { kind: "branch", branch: "cat/plat/beans", keyedBy: "tip" } });
    decl("up", { id: "beans", path: "beans/", graphTypologies: ["beans"], source: { kind: "branch", branch: "cat/up/beans", keyedBy: "tip" } });
    writeFileSync(
      join(work, "index.lock.json"),
      JSON.stringify({
        $schema: "cat-harness-mount-lock/v1",
        mounts: ["plat", "up"].map((n) => ({ harness: n, repository: `test/${n}`, ref: SHA })),
        instances: ["plat", "up"].map((n) => ({
          instance: n,
          repository: `test/${n}`,
          sha: SHA,
          upstreamRoot: "",
          path: n,
          via: n,
          pinnedBy: "declared",
          declaration: { file: `${n}.json`, sha256: "0".repeat(64) },
          directories: [],
        })),
        unmounted: [],
      }),
    );
    const urlFor = (repository: string): string => (repository === "test/up" ? `file://${up}` : `file://${join(base, "plat.git")}`);
    return { work, store: { urlFor } };
  }

  test("the upstream's beans mount as ITS graph, and the checkout-level `beans` stays unmounted", () => {
    const f = withUpstreamBeans();
    const r = mountState({ repoRoot: f.work, store: f.store });
    const states = Object.fromEntries(r.graphs.map((g) => [g.id, g.state]));
    expect(states["up.beans"]).toBe("mounted");
    expect(states["plat.beans"]).not.toBe("mounted");
    expect(existsSync(join(f.work, "up", "beans", "defs", "up-0001--an-upstream-issue.md"))).toBe(true);
    // The upstream's own graph is still readable as such...
    expect(tipPresence({ id: "beans", branch: "cat/up/beans", keyedBy: "tip" }, join(f.work, "up", "beans"), f.work)).toEqual({
      state: "mounted",
      into: join(f.work, "up", "beans"),
    });
    // ...and is not the checkout's: the checkout-level `beans` has no mount.
    expect(tipPresence({ id: "beans", branch: "cat/plat/beans", keyedBy: "tip" }, join(f.work, "beans"), f.work).state).toBe("unmounted");
  });

  test("the checkout's bean store resolves to nothing, not to the upstream's beans", () => {
    const f = withUpstreamBeans();
    mountState({ repoRoot: f.work, store: f.store });
    const read = graphReadPath("beans", f.work);
    expect(read.state).toBe("refused");
    if (read.state === "ok") throw new Error(`resolved to ${read.at}`);
  });
});
