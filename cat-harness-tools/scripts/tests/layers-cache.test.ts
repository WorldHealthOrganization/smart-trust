/**
 * The shared layers cache ref (`refs/cat/layers/<key>`), against FIXTURE
 * repositories served over `file://`: a fixture INDEX whose `origin` is a bare
 * repository, and two layer repositories its lock pins.
 *
 * - hit: a fresh clone mounts every layer from the one ref, with the layer
 *   repositories unreachable;
 * - miss: no ref, the per-repository fetch mounts as before;
 * - tampered: a ref whose bytes do not hash to the lock is refused per
 *   layer and that layer falls back;
 * - stale: `main` from an older lock still serves the layer that did not
 *   move, and the one that did is fetched;
 * - publish refuses a checkout whose mounts do not read `current`.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { checkLayers, digestOf, LAYERS_BRANCH_PREFIX, LAYERS_MAIN_REF, layersKey, layersRef, layersSummaryLine, moveLayers, publishLayers, pruneLayers, run, type LockInstance } from "../mount-from-lock.ts";

const ENV = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
function git(cwd: string, ...args: string[]): string {
  // input-site: tree #a0997295 — git in the test's own scratch repository, with the environment handed whole plus a fixed identity: git's answer, which the cone replays or records
  const r = spawnSync("git", args, { cwd, encoding: "utf-8", env: { ...process.env, ...ENV } });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}
function write(root: string, files: Record<string, string>): void {
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
}
const sha256 = (b: Buffer | string): string => new Bun.CryptoHasher("sha256").update(b).digest("hex");

let base: string;
let prior: Record<string, string | undefined>;

/** A layer repository at `<base>/o/<name>` with a declaration and one `scripts/` directory. */
function layer(name: string, body: string): { sha: string; inst: (sha?: string) => LockInstance } {
  // input-site: inert #4481d431 — a unique scratch name or throwaway token; no assertion depends on its value
  const work = join(base, `${name}-work-${Math.random().toString(36).slice(2)}`);
  mkdirSync(work, { recursive: true });
  git(work, "init", "-q", "-b", "main");
  const declText = JSON.stringify({ name, directories: [{ id: `${name}-scripts`, path: "scripts/" }] });
  write(work, { [`${name}.json`]: declText, "scripts/run.ts": body, "scripts/deep/x.txt": `${name}\n` });
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "fixture");
  const sha = git(work, "rev-parse", "HEAD");
  const bare = join(base, "o", name);
  if (!existsSync(bare)) {
    mkdirSync(dirname(bare), { recursive: true });
    git(base, "init", "-q", "--bare", bare);
    git(bare, "config", "uploadpack.allowFilter", "true");
    git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
  }
  git(work, "push", "-q", "--force", bare, "HEAD:refs/heads/main");
  const dg = digestOf(join(work, "scripts"));
  return {
    sha,
    inst: () => ({
      instance: name,
      repository: `o/${name}`,
      sha,
      upstreamRoot: "",
      path: name,
      declaration: { file: `${name}.json`, sha256: sha256(declText) },
      directories: [{ id: `${name}-scripts`, path: `${name}/scripts`, upstreamPath: "scripts", treeDigest: dg.treeDigest, files: dg.files }],
    }),
  };
}

/** A fixture index: a bare `origin`, and a working clone whose committed lock pins `instances`. */
function index(instances: LockInstance[]): { origin: string; work: string } {
  // input-site: inert #37120c16 — a unique scratch name or throwaway token; no assertion depends on its value
  const id = Math.random().toString(36).slice(2);
  const origin = join(base, `index-${id}.git`);
  git(base, "init", "-q", "--bare", "-b", "main", origin);
  const work = join(base, `index-${id}`);
  git(base, "clone", "-q", origin, work);
  write(work, { "index.lock.json": JSON.stringify({ $schema: "cat-harness-mount-lock/v1", instances }, null, 2) + "\n" });
  git(work, "add", "-A");
  git(work, "commit", "-q", "-m", "lock");
  git(work, "push", "-q", "origin", "HEAD:refs/heads/main");
  return { origin, work };
}
function freshClone(origin: string): string {
  // input-site: inert #94964ff0 — a unique scratch name or throwaway token; no assertion depends on its value
  const dir = join(base, `clone-${Math.random().toString(36).slice(2)}`);
  git(base, "clone", "-q", origin, dir);
  return dir;
}
const states = (r: ReturnType<typeof run>) => Object.fromEntries(r.outcomes.map((o) => [o.instance, o.state]));
const replay = (root: string) => run(root, false, { install: false });

/** Make the layer repositories unreachable, run `fn`, put them back. */
function offline<T>(fn: () => T): T {
  renameSync(join(base, "o"), join(base, "o-away"));
  try {
    return fn();
  } finally {
    renameSync(join(base, "o-away"), join(base, "o"));
  }
}

let a: ReturnType<typeof layer>;
let b: ReturnType<typeof layer>;

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "layers-cache-"));
  // input-site: inert #a7739ef9 — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
  prior = { CAT_MOUNT_URL_PREFIX: process.env.CAT_MOUNT_URL_PREFIX, CAT_LAYERS_URL: process.env.CAT_LAYERS_URL, CAT_LAYERS_CACHE: process.env.CAT_LAYERS_CACHE, CAT_MOUNT_CACHE_DIR: process.env.CAT_MOUNT_CACHE_DIR };
  process.env.CAT_MOUNT_URL_PREFIX = `file://${base}`;
  delete process.env.CAT_LAYERS_URL;
  delete process.env.CAT_LAYERS_CACHE;
  delete process.env.CAT_MOUNT_CACHE_DIR;
  a = layer("alpha", "export const a = 1;\n");
  b = layer("beta", "export const b = 2;\n");
});
afterAll(() => {
  for (const [k, v] of Object.entries(prior)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  rmSync(base, { recursive: true, force: true });
});

describe("layers cache: publish and the fast path", () => {
  test("miss: no ref at the index, every layer is fetched from its own repository", () => {
    const { origin } = index([a.inst(), b.inst()]);
    const r = replay(freshClone(origin));
    expect(states(r)).toEqual({ alpha: "mounted", beta: "mounted" });
    expect(r.layers[0]?.ref).toBeUndefined();
    expect(r.layers[0]?.miss).toContain("refs/cat/layers/");
    expect(layersSummaryLine(r.layers[0]!)).toStartWith("**cached-step `layers`: miss** (exact) — ");
  });

  test("hit: after publish, a fresh clone mounts every layer from the ref with the layer repositories unreachable", () => {
    const { origin, work } = index([a.inst(), b.inst()]);
    expect(states(replay(work))).toEqual({ alpha: "mounted", beta: "mounted" });
    const p = publishLayers(work, { main: true });
    expect(p.ok).toBe(true);
    expect(p.refs).toEqual([layersRef(p.key!), LAYERS_MAIN_REF]);
    expect(p.key).toBe(layersKey([a.inst(), b.inst()]));
    // The published tree is the overlay, exactly: declarations and directories at their mount paths.
    expect(git(origin, "ls-tree", "-r", "--name-only", layersRef(p.key!)).split("\n")).toEqual(["alpha/alpha.json", "alpha/scripts/deep/x.txt", "alpha/scripts/run.ts", "beta/beta.json", "beta/scripts/deep/x.txt", "beta/scripts/run.ts"]);
    const clone = freshClone(origin);
    const r = offline(() => replay(clone));
    expect(states(r)).toEqual({ alpha: "mounted", beta: "mounted" });
    expect(r.layers[0]?.ref).toBe(layersRef(p.key!));
    expect(r.outcomes.every((o) => o.detail.includes("layers cache"))).toBe(true);
    expect(layersSummaryLine(r.layers[0]!)).toBe(`**cached-step \`layers\`: hit** (exact) — 2 layer(s) from ${layersRef(p.key!)}, 0 fetched. Key \`${p.key}\`.`);
    // Already current: nothing needed, so no line.
    expect(layersSummaryLine(replay(clone).layers[0]!)).toBeUndefined();
    expect(states(run(clone, true))).toEqual({ alpha: "current", beta: "current" });
  });

  test("tampered: a cached directory that does not hash to the lock is refused and that layer falls back", () => {
    const { origin, work } = index([a.inst(), b.inst()]);
    replay(work);
    const good = publishLayers(work);
    // Re-publish a doctored overlay under the same ref: alpha's script changed.
    const doctor = freshClone(origin);
    git(doctor, "fetch", "-q", "origin", `${layersRef(good.key!)}:refs/x`);
    git(doctor, "checkout", "-q", "refs/x");
    writeFileSync(join(doctor, "alpha/scripts/run.ts"), "export const a = 666;\n");
    git(doctor, "commit", "-q", "-am", "tamper");
    git(doctor, "push", "-q", "--force", "origin", `HEAD:${layersRef(good.key!)}`);
    const clone = freshClone(origin);
    const r = replay(clone);
    expect(states(r)).toEqual({ alpha: "mounted", beta: "mounted" });
    expect(r.layers[0]?.fellBack).toEqual(["alpha"]);
    expect(r.outcomes.find((o) => o.instance === "beta")?.detail).toContain("layers cache");
    expect(r.outcomes.find((o) => o.instance === "alpha")?.detail).not.toContain("layers cache");
    expect(readFileSync(join(clone, "alpha/scripts/run.ts"), "utf-8")).toBe("export const a = 1;\n");
    // Offline, the tampered layer cannot be fetched: it is reported, never laid down from the cache.
    const clone2 = freshClone(origin);
    const r2 = offline(() => replay(clone2));
    expect(states(r2)).toEqual({ alpha: "could-not-determine", beta: "mounted" });
    expect(existsSync(join(clone2, "alpha/scripts"))).toBe(false);
  });

  test("stale: main from an older lock still serves the layer that did not move; the re-pinned one is fetched", () => {
    const { origin, work } = index([a.inst(), b.inst()]);
    replay(work);
    expect(publishLayers(work, { main: true }).ok).toBe(true);
    // Re-pin beta to a new commit, without publishing the new lock's ref.
    const b2 = layer("beta", "export const b = 3;\n");
    writeFileSync(join(work, "index.lock.json"), JSON.stringify({ $schema: "cat-harness-mount-lock/v1", instances: [a.inst(), b2.inst()] }, null, 2) + "\n");
    git(work, "commit", "-q", "-am", "repin beta");
    git(work, "push", "-q", "origin", "HEAD:refs/heads/main");
    const clone = freshClone(origin);
    const r = replay(clone);
    expect(states(r)).toEqual({ alpha: "mounted", beta: "mounted" });
    expect(r.layers[0]?.ref).toBe(LAYERS_MAIN_REF);
    expect(r.layers[0]?.fellBack).toEqual(["beta"]);
    expect(layersSummaryLine(r.layers[0]!)).toContain("**cached-step `layers`: warm** (exact) — 1 layer(s) from refs/cat/layers/main, 1 fetched (beta did not verify)");
    expect(readFileSync(join(clone, "beta/scripts/run.ts"), "utf-8")).toBe("export const b = 3;\n");
  });

  test("publish refuses a checkout whose mounts do not hash to the lock, and --no-layers-cache skips the ref", () => {
    const { origin, work } = index([a.inst()]);
    expect(publishLayers(work, { push: false }).ok).toBe(false);
    replay(work);
    writeFileSync(join(work, "alpha/scripts/run.ts"), "edited\n");
    const p = publishLayers(work);
    expect(p.ok).toBe(false);
    expect(p.detail).toContain("refused");
    expect(git(origin, "for-each-ref", "refs/cat/")).toBe("");
    const r = run(freshClone(origin), false, { install: false, layers: false });
    expect(r.layers).toEqual([]);
  });

  test("publishing leaves no objects behind in the index checkout", () => {
    const { work } = index([a.inst(), b.inst()]);
    replay(work);
    const count = () => git(work, "count-objects").split(" ")[0];
    const before = count();
    expect(publishLayers(work).ok).toBe(true);
    expect(publishLayers(work, { push: false }).ok).toBe(true);
    expect(count()).toBe(before);
  });

  test("node_modules and other install artefacts are never published", () => {
    const { origin, work } = index([a.inst()]);
    replay(work);
    write(work, { "alpha/scripts/node_modules/x/index.js": "1;\n" });
    const p = publishLayers(work);
    expect(p.ok).toBe(true);
    expect(git(origin, "ls-tree", "-r", "--name-only", layersRef(p.key!))).not.toContain("node_modules");
  });

  test("prune keeps the newest N lock refs, main, and any key asked to be kept", () => {
    const { origin, work } = index([a.inst()]);
    replay(work);
    const p = publishLayers(work, { main: true });
    const blob = git(work, "rev-parse", "HEAD");
    const extra = ["1", "2", "3"].map((n) => n.repeat(64));
    for (const k of extra) git(work, "push", "-q", origin, `${blob}:${layersRef(k)}`);
    const pruned = pruneLayers(origin, 1, [p.key!, extra[0]!]);
    const left = git(origin, "for-each-ref", "--format=%(refname)", "refs/cat/layers/").split("\n").sort();
    expect(left).toContain(layersRef(p.key!));
    expect(left).toContain(LAYERS_MAIN_REF);
    expect(left).toContain(layersRef(extra[0]!));
    expect(pruned.length).toBeGreaterThanOrEqual(1);
    expect(left.length).toBe(5 - pruned.length);
  });
});

describe("layers:check — the re-pinner's gate", () => {
  test("missing until the re-pinner publishes, then published; an unchanged lock owes nothing", () => {
    const { work } = index([a.inst(), b.inst()]);
    replay(work);
    const before = checkLayers(work);
    expect(before.ok).toBe(false);
    expect(before.state).toBe("missing");
    expect(before.detail).toContain("layers:publish");
    expect(checkLayers(work, { changedFrom: "HEAD" }).state).toBe("skipped");
    expect(publishLayers(work).ok).toBe(true);
    const after = checkLayers(work);
    expect(after.ok).toBe(true);
    expect(after.state).toBe("published");
    expect(after.key).toBe(layersKey([a.inst(), b.inst()]));
  });
});

describe("layers:move — a sandbox's publish, moved by the runner", () => {
  test("a remote that refuses refs/cat gets the claude/cat-layers/ branch; the mover moves it and deletes the branch", () => {
    const { origin, work } = index([a.inst(), b.inst()]);
    replay(work);
    const key = layersKey([a.inst(), b.inst()]);
    // The sandbox's git proxy: only claude/ branches may be pushed.
    const hook = join(origin, "hooks", "pre-receive");
    writeFileSync(hook, "#!/bin/sh\nwhile read o n r; do case \"$r\" in refs/heads/claude/*) ;; *) echo refused >&2; exit 1 ;; esac; done\n");
    chmodSync(hook, 0o755);
    const p = publishLayers(work);
    expect(p.ok).toBe(true);
    expect(p.viaBranch).toBe(true);
    expect(p.refs).toEqual([`${LAYERS_BRANCH_PREFIX}${key}`]);
    const pending = checkLayers(work);
    expect(pending.ok).toBe(false);
    expect(pending.state).toBe("pending");
    // The runner's token may push any ref.
    rmSync(hook);
    const m = moveLayers(work);
    expect(m.ok).toBe(true);
    expect(m.state).toBe("published");
    expect(checkLayers(work).state).toBe("published");
    expect(git(work, "ls-remote", origin, `${LAYERS_BRANCH_PREFIX}${key}`).trim()).toBe("");
    // A second run finds the ref and moves nothing.
    expect(moveLayers(work).state).toBe("published");
  });

  test("the mover refuses a branch that does not hold this lock's layers commit", () => {
    const { origin, work } = index([a.inst()]);
    replay(work);
    const key = layersKey([a.inst()]);
    git(work, "push", "-q", origin, `HEAD:${LAYERS_BRANCH_PREFIX}${key}`);
    const m = moveLayers(work);
    expect(m.state).toBe("error");
    expect(m.detail).toContain("is not this lock's layers commit");
  });
});
