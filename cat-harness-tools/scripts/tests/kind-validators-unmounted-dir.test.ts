/**
 * A declared directory the mount did not CHOOSE is not examined — never
 * `EXAMINED NOTHING` — while a chosen, mounted, empty one still is.
 *
 * A downstream mounts a subset of an upstream layer's directories, and the
 * declaration it lays down names all of them. When the upstream later
 * declares a new directory (here `beans/`), the downstream's mount has no such
 * directory at all; the lock (`instances[].directories`) says it was not
 * chosen. Before the fix, `sweepFamilies` read the absent path as an empty
 * corpus and the gate failed with `EXAMINED NOTHING`.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sweepFamilies } from "../check-kind-validators.js";
import { mountChoiceOf } from "../../schemas/kg/remote-mount.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";

const made: string[] = [];
afterAll(() => {
  for (const p of made) rmSync(p, { recursive: true, force: true });
});

const SHA = "a".repeat(40);
const DIGEST = "b".repeat(64);

/** A downstream scope holding its own layer, an index lock, and a mounted `up` whose `beans/` is chosen or not. */
function downstream(chooseBeans: boolean): { own: string; up: string } {
  const scope = mkdtempSync(join(tmpdir(), "kv-unmounted-"));
  made.push(scope);
  const own = join(scope, "own");
  mkdirSync(own, { recursive: true });
  writeDeclaration(own, { name: "own", directories: [] });
  const up = join(scope, "up");
  mkdirSync(join(up, "glossary"), { recursive: true });
  writeDeclaration(up, {
    name: "up",
    directories: [
      { id: "up-glossary", path: "glossary/", graphTypologies: ["code"] },
      { id: "up-beans", path: "beans/", graphTypologies: ["beans"] },
    ],
  });
  const dirs = [{ id: "up-glossary", path: "up/glossary", upstreamPath: "glossary", treeDigest: DIGEST, files: 0 }];
  if (chooseBeans) {
    mkdirSync(join(up, "beans"), { recursive: true });
    dirs.push({ id: "up-beans", path: "up/beans", upstreamPath: "beans", treeDigest: DIGEST, files: 0 });
  }
  writeFileSync(
    join(scope, "index.lock.json"),
    JSON.stringify({
      $schema: "cat-harness-mount-lock/v1",
      mounts: [{ harness: "up", repository: "o/up", ref: SHA }],
      instances: [
        {
          instance: "up",
          repository: "o/up",
          sha: SHA,
          upstreamRoot: "",
          path: "up",
          via: "up",
          pinnedBy: "declared",
          declaration: { file: "up.json", sha256: DIGEST },
          directories: dirs,
        },
      ],
      unmounted: [],
    }),
  );
  return { own, up };
}

const nodesOf = (s: { counts: Record<string, { nodes: number }> }): number => Object.values(s.counts).reduce((a, c) => a + c.nodes, 0);

describe("a declared directory the mount did not choose", () => {
  const { own, up } = downstream(false);

  test("the lock answers: not chosen", () => {
    expect(mountChoiceOf(up, join(up, "beans"))).toEqual({ chosen: false, lock: "index.lock.json" });
    expect(mountChoiceOf(up, join(up, "glossary"))).toEqual({ chosen: true, lock: "index.lock.json" });
    // The checkout's own layer: no mount placed it, so no answer.
    expect(mountChoiceOf(own, join(own, "beans"))).toBeUndefined();
  });

  test("is reported not mounted, and nothing was read", async () => {
    const beans = (await sweepFamilies(own)).find((f) => f.kind === "beans")!;
    expect(nodesOf(beans)).toBe(0);
    expect(beans.notMounted).toEqual([{ id: "up-beans", path: "up/beans", lock: "index.lock.json" }]);
    expect(beans.read ?? 0).toBe(0);
  });
});

describe("a chosen directory, mounted and empty", () => {
  const { own } = downstream(true);

  test("is read, and is not excused as unmounted", async () => {
    const beans = (await sweepFamilies(own)).find((f) => f.kind === "beans")!;
    expect(nodesOf(beans)).toBe(0);
    expect(beans.notMounted).toBeUndefined();
    expect(beans.read).toBe(1);
  });
});

/**
 * A directory whose content the declaration says is BUILT AT PUBLISH
 * (`builtAtPublish` names a path inside it): gitignored and never committed,
 * so no checkout holds it until the writer runs. Not examined, never
 * `EXAMINED NOTHING`. The same absent directory WITHOUT that claim still fails.
 */
describe("a declared directory built at publish and not built here", () => {
  function instance(builtAtPublish: boolean): string {
    const parent = mkdtempSync(join(tmpdir(), "kv-built-"));
    made.push(parent);
    const inst = join(parent, "fixture");
    mkdirSync(inst, { recursive: true });
    writeDeclaration(inst, {
      name: "fixture",
      directories: [{ id: "fixture-beans", path: "beans/", graphTypologies: ["beans"] }],
      ...(builtAtPublish
        ? { builtAtPublish: [{ path: "beans/index.json", writer: ["beans:build"], because: "checkout", reason: "written at publish, never committed" }] }
        : {}),
    });
    return inst;
  }

  test("is reported as built at publish, and nothing was read", async () => {
    const beans = (await sweepFamilies(instance(true))).find((f) => f.kind === "beans")!;
    expect(nodesOf(beans)).toBe(0);
    expect(beans.builtNotHere).toEqual([{ id: "fixture-beans", path: "fixture/beans", writers: ["beans:build"] }]);
    expect(beans.read ?? 0).toBe(0);
  });

  test("without a builtAtPublish claim, an absent directory gets no excuse", async () => {
    const beans = (await sweepFamilies(instance(false))).find((f) => f.kind === "beans")!;
    expect(beans.builtNotHere).toBeUndefined();
    expect(beans.notMounted).toBeUndefined();
    expect(beans.read).toBe(1);
  });
});
