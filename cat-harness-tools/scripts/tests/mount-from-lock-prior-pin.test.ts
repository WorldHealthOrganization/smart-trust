/**
 * A mount at an EARLIER pin of the same lock is stale, not somebody's work
 * (bean folio-assistant-jstq).
 *
 * Measured 2026-11-05: every fresh folio-assistant container held 20 locked
 * directories whose bytes hashed to an older committed lock, and `mount:lock`
 * refused every one as "edits there are somebody's work", so the checkout ran
 * on tools and declarations older than its lock (and `state:mount` rewrote
 * `.gitignore` from them, bean x38u). These pin the replacement and its limits.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { digestOf, priorPins, run } from "../mount-from-lock.ts";

function git(cwd: string, ...args: string[]): string {
  // input-site: tree #7150efbd — git in the test's own scratch repository, with the environment handed whole plus a fixed identity: git's answer, which the cone replays or records
  const r = spawnSync("git", args, { cwd, encoding: "utf-8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

function write(root: string, files: Record<string, string>): void {
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
}

const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

let base: string;
let bare: string;
/** The two pins of the fixture layer, oldest first. */
const pins: Array<{ sha: string; treeDigest: string; files: number; declSha: string }> = [];

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "prior-pin-"));
  const work = join(base, "inst-work");
  mkdirSync(work, { recursive: true });
  git(work, "init", "-q", "-b", "main");
  for (const v of [1, 2]) {
    write(work, { "inst.json": JSON.stringify({ name: "inst", v }) + "\n", "lib.ts": `export const v = ${v};\n` });
    git(work, "add", "-A");
    git(work, "commit", "-q", "-m", `v${v}`);
    const tree = join(base, `tree-${v}`);
    git(base, "clone", "-q", work, tree);
    rmSync(join(tree, ".git"), { recursive: true, force: true });
    const d = digestOf(tree);
    pins.push({ sha: git(work, "rev-parse", "HEAD"), treeDigest: d.treeDigest, files: d.files, declSha: sha256(readFileSync(join(tree, "inst.json"))) });
  }
  bare = join(base, "inst.git");
  git(base, "clone", "-q", "--bare", work, bare);
  git(bare, "config", "uploadpack.allowFilter", "true");
  git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
});

afterAll(() => rmSync(base, { recursive: true, force: true }));

let n = 0;
/** A checkout whose committed lock pins `inst` at pin `v`, laid down from it. */
function checkoutAt(v: 0 | 1): string {
  const root = join(base, `down-${++n}`);
  mkdirSync(root, { recursive: true });
  git(root, "init", "-q", "-b", "main");
  commitLock(root, v);
  expect(run(root, false, { install: false }).outcomes[0]!.state).toBe("mounted");
  return root;
}

function commitLock(root: string, v: 0 | 1): void {
  const p = pins[v]!;
  const lock = {
    $schema: "cat-harness-mount-lock/v1",
    instances: [
      {
        instance: "inst",
        repository: `file://${bare}`,
        sha: p.sha,
        upstreamRoot: "",
        path: "inst",
        declaration: { file: "inst.json", sha256: p.declSha },
        directories: [{ id: "*", path: "inst", upstreamPath: ".", treeDigest: p.treeDigest, files: p.files }],
      },
    ],
  };
  writeFileSync(join(root, "index.lock.json"), JSON.stringify(lock, null, 2) + "\n");
  git(root, "add", "index.lock.json");
  git(root, "commit", "-q", "-m", `pin v${v + 1}`);
}

describe("a mount at an earlier pin of the lock (bean folio-assistant-jstq)", () => {
  test("priorPins reads every committed version of the lock", () => {
    const root = checkoutAt(0);
    commitLock(root, 1);
    const p = priorPins(root, join(root, "index.lock.json"));
    expect([...(p.trees.get("inst") ?? [])].sort()).toEqual([pins[0]!.treeDigest, pins[1]!.treeDigest].sort());
    expect(p.blobs.get("inst/inst.json")?.has(pins[0]!.declSha)).toBe(true);
  });

  test("is replaced by the current pin, and --check says so first", () => {
    const root = checkoutAt(0);
    commitLock(root, 1);
    const checked = run(root, true).outcomes[0]!;
    expect(checked.state).toBe("missing");
    expect(checked.detail).toContain("an earlier pin's bytes, not an edit");
    const r = run(root, false, { install: false }).outcomes[0]!;
    expect(r.state).toBe("mounted");
    expect(r.detail).toContain("replaced an earlier pin's inst");
    expect(readFileSync(join(root, "inst/lib.ts"), "utf-8")).toBe("export const v = 2;\n");
    expect(run(root, true).outcomes[0]!.state).toBe("current");
    // Nothing of the set-aside copy is left behind.
    expect(spawnSync("ls", [join(root, git(root, "rev-parse", "--git-path", "mount-prior"))], { encoding: "utf-8" }).stdout.trim()).toBe("");
  });

  test("keeps a state mount and node_modules inside it", () => {
    const root = checkoutAt(0);
    const into = join(root, "inst/test/health/results");
    write(root, { "inst/test/health/results/report.json": '{"unpushed":true}\n', "inst/node_modules/dep/package.json": '{"name":"dep"}\n' });
    mkdirSync(join(root, ".git/branch-mounts"), { recursive: true });
    writeFileSync(join(root, ".git/branch-mounts/inst.health.json"), JSON.stringify({ $schema: "branch-mount/v1", id: "health", path: "inst/test/health/results", into, files: {} }));
    commitLock(root, 1);
    const r = run(root, false, { install: false }).outcomes[0]!;
    expect(r.state).toBe("mounted");
    expect(r.detail).toContain("keeping inst/test/health/results, inst/node_modules");
    expect(readFileSync(join(into, "report.json"), "utf-8")).toBe('{"unpushed":true}\n');
    expect(existsSync(join(root, "inst/node_modules/dep/package.json"))).toBe(true);
    expect(readFileSync(join(root, "inst/lib.ts"), "utf-8")).toBe("export const v = 2;\n");
    expect(run(root, true).outcomes[0]!.state).toBe("current");
  });

  test("an EDITED mount is still somebody's work: refused and left byte for byte", () => {
    const root = checkoutAt(0);
    writeFileSync(join(root, "inst/lib.ts"), "export const v = 99; // mine\n");
    commitLock(root, 1);
    const r = run(root, false, { install: false }).outcomes[0]!;
    expect(r.state).toBe("missing");
    expect(r.detail).toContain("somebody's work");
    expect(readFileSync(join(root, "inst/lib.ts"), "utf-8")).toBe("export const v = 99; // mine\n");
    expect(run(root, true).outcomes[0]!.detail).not.toContain("earlier pin");
  });

  test("a replacement that cannot be fetched restores the earlier pin as it was", () => {
    const root = checkoutAt(0);
    commitLock(root, 1);
    const lock = JSON.parse(readFileSync(join(root, "index.lock.json"), "utf-8"));
    lock.instances[0].repository = `file://${join(base, "no-such.git")}`;
    writeFileSync(join(root, "index.lock.json"), JSON.stringify(lock));
    const r = run(root, false, { install: false }).outcomes[0]!;
    expect(r.state).toBe("could-not-determine");
    expect(r.detail).toContain("restored as it was");
    expect(readFileSync(join(root, "inst/lib.ts"), "utf-8")).toBe("export const v = 1;\n");
    expect(digestOf(join(root, "inst")).treeDigest).toBe(pins[0]!.treeDigest);
  });
});
