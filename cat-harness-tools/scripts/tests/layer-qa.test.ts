/**
 * A mounted layer's QA, read from its OWN store at the pinned commit (bean
 * `folio-assistant-7mwa`; owner, 2026-11-03, "2. Each layer publishes").
 *
 * Over a real bare repository standing in for the layer's GitHub remote:
 * the reader finds `main/<sha>`, finds the one `pr/<n>/<sha>` a re-pin train
 * may pin, and answers `miss` naming the commit when the layer has not
 * published it — never the index's store, never an older entry.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { layerQaRemote, layerQaSource, readLayerQaTree } from "../layer-qa.ts";
import { MOUNT_LOCK_SCHEMA } from "../../schemas/kg/remote-mount.ts";
import { clearQaCache, publishQa, readQaTreeAtCommit, type QaStoreOptions } from "../qa-store.ts";

const NOGPG = ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t"];
const SHA_MAIN = "a".repeat(40);
const SHA_PR = "b".repeat(40);
const SHA_NONE = "c".repeat(40);
const LAYER = "some-layer";
const HOME = `${LAYER}/test/results`;
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

/** An index checkout holding one mounted layer, and a bare remote for the layer's store. */
function fixture() {
  const base = mkdtempSync(join(tmpdir(), "layer-qa-t-"));
  made.push(base);
  const bare = join(base, "layer.git");
  git(base, "init", "-q", "--bare", "-b", "main", bare);
  git(bare, "config", "uploadpack.allowFilter", "true");
  git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
  const url = `file://${bare}`;
  const index = join(base, "index");
  mkdirSync(index);
  git(index, "init", "-q", "-b", "main");
  const write = (rel: string, text: string) => {
    mkdirSync(dirname(join(index, rel)), { recursive: true });
    writeFileSync(join(index, rel), text);
  };
  write(`${HOME}/kg-qa/skills/a.kg-qa.json`, '{"verdict":"pass"}\n');
  write(`${HOME}/kg-qa.manifest.json`, '{"files":1}\n');
  const opts = (name: string): QaStoreOptions => ({
    repoRoot: index,
    remote: url,
    branch: "cat/cat-harness/qa-reports",
    storeDir: join(base, `${name}.store.git`),
    sleep: () => {},
    log: () => {},
  });
  return { base, index, url, write, opts };
}

describe("readQaTreeAtCommit", () => {
  test("a commit pushed to main is read at main/<sha>", () => {
    const f = fixture();
    publishQa({ ref: `main/${SHA_MAIN}`, roots: [HOME] }, f.opts("ci"));
    const r = readQaTreeAtCommit(SHA_MAIN, HOME, f.opts("reader"));
    expect(r.state).toBe("hit");
    if (r.state === "hit") {
      expect(r.key).toBe(`main/${SHA_MAIN}`);
      expect([...r.files.keys()]).toContain(`${HOME}/kg-qa/skills/a.kg-qa.json`);
    }
  }, T);

  test("a pull request's head, as a re-pin train may pin it, is read at pr/<n>/<sha>", () => {
    const f = fixture();
    publishQa({ ref: `main/${SHA_MAIN}`, roots: [HOME] }, f.opts("ci"));
    // Different results: identical ones are recorded as unchanged since main
    // (bean `folio-assistant-he8h`) and read back at main's entry, which is
    // also a right answer but not the one this case is about.
    f.write(`${HOME}/kg-qa/skills/a.kg-qa.json`, '{"verdict":"fail"}\n');
    publishQa({ ref: `pr/5/${SHA_PR}`, roots: [HOME] }, f.opts("ci-pr"));
    const r = readQaTreeAtCommit(SHA_PR, HOME, f.opts("reader"));
    expect(r.state === "hit" && r.key).toBe(`pr/5/${SHA_PR}`);
  }, T);

  test("an unpublished commit is a miss that names it — never the newest entry", () => {
    const f = fixture();
    publishQa({ ref: `main/${SHA_MAIN}`, roots: [HOME] }, f.opts("ci"));
    const r = readQaTreeAtCommit(SHA_NONE, HOME, f.opts("reader"));
    expect(r.state).toBe("miss");
    expect(r.state !== "hit" && r.reason).toContain(SHA_NONE);
  }, T);

  test("a layer with no store branch at all is a miss, not unknown", () => {
    const f = fixture();
    const r = readQaTreeAtCommit(SHA_MAIN, HOME, f.opts("reader"));
    expect(r.state).toBe("miss");
  }, T);

  test("an abbreviated sha is a usage error: a pin is a full commit", () => {
    const f = fixture();
    expect(() => readQaTreeAtCommit("abc1234", HOME, f.opts("reader"))).toThrow(/full commit sha/);
  });
});

describe("the layer a mount came from", () => {
  /** A minimal `index.lock.json` naming one mounted layer. */
  function lockFor(index: string, repository: string, sha: string): void {
    writeFileSync(
      join(index, "index.lock.json"),
      JSON.stringify({
        $schema: MOUNT_LOCK_SCHEMA,
        mounts: [{ harness: LAYER, repository, ref: sha }],
        instances: [
          {
            instance: LAYER,
            repository,
            sha,
            upstreamRoot: "",
            path: LAYER,
            via: LAYER,
            pinnedBy: "declared",
            declaration: { file: `${LAYER}.json`, sha256: "0".repeat(64) },
            directories: [],
          },
        ],
      }),
    );
  }

  test("an owner/name repository is read from GitHub; anything else is used as given", () => {
    expect(layerQaRemote({ instance: LAYER, repository: "litlfred/some-layer", sha: SHA_MAIN }, {})).toBe(
      "https://github.com/litlfred/some-layer.git",
    );
    expect(layerQaRemote({ instance: LAYER, repository: "file:///x/y.git", sha: SHA_MAIN }, {})).toBe("file:///x/y.git");
    expect(layerQaRemote({ instance: LAYER, repository: "litlfred/some-layer", sha: SHA_MAIN }, { QA_LAYER_REMOTE_SOME_LAYER: "file:///o.git" })).toBe(
      "file:///o.git",
    );
  });

  test("an instance no lock mounted has no layer source: its QA is the index's", () => {
    const f = fixture();
    expect(layerQaSource(f.index, join(f.index, LAYER))).toBeUndefined();
    expect(readLayerQaTree(f.index, join(f.index, LAYER)).source).toBeUndefined();
  });

  test("a mounted layer is read from its own store at the pinned commit", () => {
    const f = fixture();
    lockFor(f.index, f.url, SHA_MAIN);
    mkdirSync(join(f.index, LAYER), { recursive: true });
    const source = layerQaSource(f.index, join(f.index, LAYER));
    expect(source).toEqual({ instance: LAYER, repository: f.url, sha: SHA_MAIN });
    publishQa({ ref: `main/${SHA_MAIN}`, roots: [HOME] }, f.opts("ci"));
    const { read } = readLayerQaTree(f.index, join(f.index, LAYER), `${HOME}/kg-qa`, { storeDir: join(f.base, "layer-reader.store.git") });
    expect(read?.state).toBe("hit");
  }, T);
});
