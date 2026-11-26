/**
 * Every lock in a composition pins the same commit of a shared lower layer
 * (owner, 2026-11-06: "align pins"; bean `cat-tools-sm8r`).
 */
import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { exitCodeOf, lockSkews, type LockFetcher, type LockLike } from "../check-lock-consistency.ts";

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const inst = (instance: string, sha: string, path = instance) => ({ instance, repository: `o/${instance}`, sha, path });

function index(lock: LockLike, onDisk: Record<string, LockLike> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "lock-consistency-"));
  dirs.push(root);
  writeFileSync(join(root, "index.lock.json"), JSON.stringify(lock));
  for (const [path, l] of Object.entries(onDisk)) {
    mkdirSync(join(root, path), { recursive: true });
    writeFileSync(join(root, path, "index.lock.json"), JSON.stringify(l));
  }
  return root;
}

const none: LockFetcher = () => undefined;

test("aligned: the layer's own lock pins the shared layer at the index's commit", () => {
  const root = index({ instances: [inst("bootstrap", "b1"), inst("cat-harness", "c1")] }, { "cat-harness": { instances: [inst("bootstrap", "b1")] } });
  expect(lockSkews(root, none)).toEqual({ skews: [], undetermined: [], compared: 1 });
});

test("skewed: the measured case, bootstrap at one commit in the index and another in cat-harness's lock", () => {
  const root = index({ instances: [inst("bootstrap", "c90ef456"), inst("cat-harness", "c1")] }, { "cat-harness": { instances: [inst("bootstrap", "a83ae82d")] } });
  expect(lockSkews(root, none).skews).toEqual([{ instance: "bootstrap", index: "c90ef456", layer: "cat-harness", layerPins: "a83ae82d" }]);
});

test("a lock not on disk is read at the pinned commit; a layer pinning what the index does not mount is not compared", () => {
  const asked: string[] = [];
  const fetch: LockFetcher = (repo, sha) => {
    asked.push(`${repo}@${sha}`);
    return { instances: [inst("bootstrap", "b2"), inst("not-mounted-here", "x")] };
  };
  const root = index({ instances: [inst("bootstrap", "b1"), inst("upper-layer", "s1")] });
  const r = lockSkews(root, fetch);
  expect(asked).toContain("o/upper-layer@s1");
  expect(r.skews).toEqual([{ instance: "bootstrap", index: "b1", layer: "upper-layer", layerPins: "b2" }]);
  expect(r.compared).toBe(1);
});

test("a lock that cannot be read is could-not-determine, never a pass", () => {
  const root = index({ instances: [inst("bootstrap", "b1"), inst("upper-layer", "s1")] });
  const r = lockSkews(root, () => {
    throw new Error("cannot fetch o/upper-layer@s1");
  });
  // Neither layer's lock is on disk, so both are asked for, and both are unreadable.
  expect(r.undetermined).toContain("upper-layer: cannot fetch o/upper-layer@s1");
  expect(r.undetermined).toHaveLength(2);
  expect(r.skews).toEqual([]);
  expect(exitCodeOf(r)).toBe(2);
});

test("skews are a report by default (exit 0), and exit 1 only when --gate is asked", () => {
  const root = index({ instances: [inst("bootstrap", "c90ef456"), inst("cat-harness", "c1")] }, { "cat-harness": { instances: [inst("bootstrap", "a83ae82d")] } });
  const r = lockSkews(root, none);
  expect(exitCodeOf(r)).toBe(0);
  expect(exitCodeOf(r, { gate: true })).toBe(1);
});
