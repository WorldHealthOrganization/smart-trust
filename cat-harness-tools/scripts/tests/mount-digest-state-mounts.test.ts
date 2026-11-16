/**
 * A remote mount's integrity digest skips the directories a STATE mount laid
 * down inside it, and nothing else.
 *
 * Found on folio-assistant#2529 (2026-10-11): cat-harness's `health` moved to
 * `cat/cat-harness/health`, so in the index `state:mount` puts its report at
 * `cat-harness/test/health/results/` — inside the remote mount of cat-harness.
 * Every later mount check then read cat-harness as edited ("no longer hash to
 * the lock") and refused it, failing every CI job that mounts.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { digestOf, stateMountedDirs, withoutStateMounts } from "../mount-from-lock.ts";

const ROOT = mkdtempSync(join(tmpdir(), "mount-digest-state-"));
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

function git(...args: string[]): void {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
}

function put(rel: string, text: string): void {
  mkdirSync(join(ROOT, rel, ".."), { recursive: true });
  writeFileSync(join(ROOT, rel), text);
}

git("init", "-q");
put("inst/a.md", "pinned\n");
put("inst/test/health/results/report.json", "{}\n");
const MOUNT = join(ROOT, "inst/test/health/results");

describe("withoutStateMounts", () => {
  test("drops only the files under a state-mounted directory", () => {
    const files = ["a.md", "test/health/results/report.json", "test/health/other.json"];
    expect(withoutStateMounts(join(ROOT, "inst"), files, [MOUNT])).toEqual(["a.md", "test/health/other.json"]);
  });

  test("a sibling whose name only STARTS with the mount's is kept", () => {
    expect(withoutStateMounts(join(ROOT, "inst"), ["test/health/results-old/x.json"], [MOUNT])).toEqual(["test/health/results-old/x.json"]);
  });

  test("no state mounts skips nothing", () => {
    expect(withoutStateMounts(join(ROOT, "inst"), ["a.md"], [])).toEqual(["a.md"]);
  });
});

describe("stateMountedDirs", () => {
  test("no marker directory is no mounts, not an error", () => {
    expect(stateMountedDirs(ROOT)).toEqual([]);
  });

  test("reads `into` from each branch-mount/v1 marker, and ignores anything else", () => {
    put(".git/branch-mounts/health.json", JSON.stringify({ $schema: "branch-mount/v1", id: "health", into: MOUNT }));
    put(".git/branch-mounts/other.json", JSON.stringify({ $schema: "something-else/v1", into: join(ROOT, "inst") }));
    put(".git/branch-mounts/broken.json", "{ not json");
    expect(stateMountedDirs(ROOT)).toEqual([MOUNT]);
  });

  test("markers keyed `<instance>.<id>` — one id declared by several instances — are read too", () => {
    const other = join(ROOT, "inst2/test/health/results");
    put(".git/branch-mounts/inst2.health.json", JSON.stringify({ $schema: "branch-mount/v1", id: "health", key: "inst2.health", into: other }));
    expect(stateMountedDirs(ROOT).sort()).toEqual([MOUNT, other].sort());
  });
});

describe("digestOf", () => {
  test("a state mount's bytes do not move the instance's digest", () => {
    const without = digestOf(join(ROOT, "inst"), [MOUNT]);
    put("inst/test/health/results/report.json", '{"changed":true}\n');
    expect(digestOf(join(ROOT, "inst"), [MOUNT])).toEqual(without);
  });

  test("an edit OUTSIDE the state mount still does", () => {
    const before = digestOf(join(ROOT, "inst"), [MOUNT]).treeDigest;
    put("inst/a.md", "edited\n");
    expect(digestOf(join(ROOT, "inst"), [MOUNT]).treeDigest).not.toBe(before);
  });
});
