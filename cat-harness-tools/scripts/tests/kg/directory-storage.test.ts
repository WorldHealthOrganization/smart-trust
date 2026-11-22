/**
 * `ContentDirectory.storage` — a directory kept on a branch, keyed by commit.
 *
 * Bean `16ei`, proposal §2.4. The field changes what three presence checks may
 * conclude from an absent directory, so each is pinned here against a REAL
 * fixture declaration rather than a hand-built object:
 *
 * | consumer | without `storage` | with `storage` |
 * |---|---|---|
 * | `check:declared-dirs` | absent → finding | absent → nothing (it is on its branch) |
 * | `harness:dirs` | absent → created | absent → NOT created (an empty working copy reads as clean) |
 * | `audit:coverage` | censused | skipped, and the kind reads `stored` |
 *
 * `keyedBy` is `commit`, `tip` or `route` (beans `2h76`, `9ofm`); `tip` is refused on a `qa`
 * directory. Every real `qa` directory declares it since bean `5hox`, and the
 * last describe block pins the one consequence a fixture cannot: each stored
 * directory's working copy is ignored by version control, so a writer's output
 * is never committed by accident and the removal stays removed.
 *
 * ## The two keyings are NOT the same question (bean `9ofm`)
 *
 * The table above is the **commit**-keyed behaviour, and it stays. For a
 * branch TIP the mount is deterministic, so "not in the checkout" has a right
 * answer and skipping the directory would report a clean run over nothing:
 *
 * | consumer | commit-keyed | tip-keyed |
 * |---|---|---|
 * | `check:declared-dirs` | absent → nothing | `not-cut-over` / `unmounted` / mounted → nothing |
 * | `audit:coverage` | skipped, kind reads `stored` | censused at the mount, or kind reads `undetermined` |
 *
 * These cases need a REAL git repository, because the answer is read from
 * `git ls-files` and the mount marker — never from the branch, so the gates
 * stay offline.
 *
 * @module scripts/tests/directory-storage
 *
 * The tests of this file that read the whole checkout (reads the aggregate
 * root's `.gitignore` and asks git at the checkout root) live in
 * `test/directory-storage-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MOUNT_MARKER_SCHEMA, markerPath, recordAbsence } from "../../branch-store.ts";

import { ContentDirectorySchema, DirectoryStorageSchema, materialiseDirectories, resolveDirectories } from "../../../schemas/kg/cat-harness.js";
import { censusDirectories } from "../../audit-coverage.js";
import { auditInstance } from "../../check-declared-dirs.ts";
import { graphReadPath } from "../../graph-read.js";
import { resolveSubgraphSource } from "../../../schemas/kg/subgraph-source.js";
import { QaUsageError, resolveQaLocation } from "../../qa-store.js";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const STORED = { branch: "qa-reports", keyedBy: "commit" } as const;
const TIP = { branch: "cat/cat-harness/beans", keyedBy: "tip" } as const;
const ROUTE = { branch: "cat/cat-harness/uml-overview", keyedBy: "route" } as const;

/** `instance()`, in a real (empty) git repository — what the tip cases need. */
function gitInstance(dirs: Array<Record<string, unknown>>): string {
  const root = instance(dirs);
  for (const args of [["init", "-q", "-b", "main"], ["config", "user.email", "t@t"], ["config", "user.name", "t"]]) {
    const r = spawnSync("git", args, { cwd: root, encoding: "utf-8" });
    expect(r.status).toBe(0);
  }
  return root;
}

function git(root: string, ...args: string[]): void {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf-8" });
  expect(r.stderr + String(r.status)).toBe("0");
}

/** A mount of `id` at `into`, as `mountTip` would leave it. */
function marker(root: string, id: string, into: string): void {
  mkdirSync(into, { recursive: true });
  const p = markerPath(root, id);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(
    p,
    JSON.stringify({ $schema: MOUNT_MARKER_SCHEMA, id, branch: TIP.branch, path: "beans", into, tip: "0".repeat(40), files: {} }),
  );
}

/** A layer (at a fresh repository root) declaring exactly `dirs`. */
function instance(dirs: Array<Record<string, unknown>>): string {
  const root = mkdtempSync(join(tmpdir(), "dir-storage-"));
  made.push(root);
  writeFileSync(join(root, "fixture.json"), JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "fixture", directories: dirs }, null, 2));
  return root;
}

describe("the schema", () => {
  test("accepts { branch, keyedBy: commit } and leaves it optional", () => {
    expect(ContentDirectorySchema.safeParse({ id: "qa", path: "test/results/", graphTypologies: ["qa"], storage: STORED }).success).toBe(true);
    expect(ContentDirectorySchema.safeParse({ id: "qa", path: "test/results/", graphTypologies: ["qa"] }).success).toBe(true);
  });

  test.each([
    ["commit", { id: "qa", path: "test/results/", graphTypologies: ["qa"] }],
    ["tip", { id: "beans-defs", path: "beans/defs/", graphTypologies: ["bean-defs"] }],
    ["route", { id: "auto-docs", path: "docs/cat-harness/auto-docs/", graphTypologies: ["docs"] }],
  ])("accepts keyedBy %s (beans 2h76, 1j3q)", (keyedBy, dir) => {
    const storage = { branch: "cat/cat-harness/beans", keyedBy };
    expect(DirectoryStorageSchema.safeParse(storage).success).toBe(true);
    expect(ContentDirectorySchema.safeParse({ ...dir, storage }).success).toBe(true);
  });

  // Both non-commit keyings, not just `tip`. A guard that named one value
  // would admit every value added after it — which is exactly how `route`
  // would have slipped past the check written for `tip` (bean `1j3q`).
  test.each(["tip", "route"])("refuses keyedBy %s on a qa directory: qa is commit-keyed by construction", (keyedBy) => {
    const r = ContentDirectorySchema.safeParse({ id: "qa", path: "test/results/", graphTypologies: ["qa"], storage: { branch: "x", keyedBy } });
    expect(r.success).toBe(false);
  });

  test.each([
    [{ branch: "qa-reports", keyedBy: "path" }, "an unimplemented keying"],
    [{ branch: "qa-reports", keyedBy: "routes" }, "a near-miss of an implemented keying"],
    [{ branch: "refs/heads/qa-reports", keyedBy: "commit" }, "a full ref rather than a branch"],
    [{ branch: "-qa", keyedBy: "commit" }, "a leading dash (an option to git)"],
    [{ branch: "qa..reports", keyedBy: "commit" }, "a `..`"],
    [{ branch: "qa reports", keyedBy: "commit" }, "whitespace"],
    [{ branch: "qa-reports", keyedBy: "commit", force: true }, "an unknown key"],
    [{ keyedBy: "commit" }, "no branch"],
  ])("refuses %j — %s", (storage) => {
    expect(DirectoryStorageSchema.safeParse(storage).success).toBe(false);
    expect(ContentDirectorySchema.safeParse({ id: "qa", path: "test/results/", graphTypologies: ["qa"], storage }).success).toBe(false);
  });
});

// `route` arrived in `DirectoryStorageSchema` with bean `1j3q` and did NOT arrive
// in `subgraph-source.ts`'s `KeyedBySchema`, which is what every consumer parses
// through. A declaration carrying it therefore parsed and then threw. These pin
// both halves: that the value survives the resolver, and that each consumer has
// DECIDED what to do with it rather than inheriting a `!== "tip"` arm.
describe("a route-keyed directory is TWO-valued, and the missing third is deliberate", () => {
  /** A route-keyed layer whose files are still tracked — the pre-cutover state. */
  function notCutOver(): string {
    const root = gitInstance([{ id: "uml", path: "uml/", graphTypologies: ["docs"], storage: ROUTE }]);
    mkdirSync(join(root, "uml"));
    writeFileSync(join(root, "uml", "a.html"), "x\n");
    writeFileSync(join(root, "uml", "b.html"), "y\n");
    git(root, "add", "uml/a.html", "uml/b.html");
    return root;
  }

  test("the resolver ACCEPTS keyedBy route — it threw a ZodError until the two enums were made one", () => {
    const root = gitInstance([{ id: "uml", path: "uml/", graphTypologies: ["docs"], storage: ROUTE }]);
    // The symptom of the drift was a THROW out of `auditInstance`, surfacing as
    // an `unmounted` finding carrying `Invalid option: expected one of
    // "commit"|"tip"`. Not a crash, and not a pass: a wrong finding.
    const f = auditInstance(root, root);
    expect(JSON.stringify(f)).not.toContain("Invalid option");
    expect(JSON.stringify(f)).not.toContain("ZodError");
  });

  test("not-cut-over: route gets the two-copies finding, because two copies is two copies", () => {
    const root = notCutOver();
    const f = auditInstance(root, root);
    expect(f.map((x) => x.kind)).toEqual(["not-cut-over"]);
    expect(f[0]!.detail).toContain("keyed by route");
    expect(f[0]!.detail).toContain("still tracks 2 file(s)");
    expect(f[0]!.detail).toContain("ONE change");
  });

  test("cut over: NO finding — there is no route-keyed mount for `unmounted` to be about", () => {
    const root = gitInstance([{ id: "uml", path: "uml/", graphTypologies: ["docs"], storage: ROUTE }]);
    // The discriminator against the tip case, which reports `unmounted` for the
    // identical fixture. A finding here could never be cleared: nothing mounts a
    // route store, so it would redden every run for ever.
    expect(auditInstance(root, root)).toEqual([]);
    const tip = gitInstance([{ id: "uml", path: "uml/", graphTypologies: ["docs"], storage: TIP }]);
    expect(auditInstance(tip, tip).map((x) => x.kind)).toEqual(["unmounted"]);
  });

  test("graph-read: not-cut-over reads the CHECKOUT and says so; cut over is REFUSED, never a path", () => {
    const root = notCutOver();
    const pre = graphReadPath("uml", root);
    expect(pre.state).toBe("ok");
    expect(pre.state === "ok" && pre.from).toBe("checkout");
    expect(pre.state === "ok" && pre.notCutOver).toBe(true);

    const after = gitInstance([{ id: "uml", path: "uml/", graphTypologies: ["docs"], storage: ROUTE }]);
    const post = graphReadPath("uml", after);
    expect(post.state).toBe("refused");
    // Naming the reason, not just the state: "nothing moved" was the old answer
    // and it returned `ok`, so a test asserting only `refused` would pass over a
    // refusal invented for any other cause.
    expect(post.state === "refused" && post.reason).toContain("has no mount");
    expect(post.state === "refused" && post.reason).toContain("dh4f");
  });

  test("audit:coverage: `stored` only once it is TRUE — not-cut-over is undetermined", () => {
    const root = notCutOver();
    const pre = censusDirectories([{ id: "uml", absPath: join(root, "uml"), storage: ROUTE }], undefined, root);
    expect({ stored: pre.stored, undetermined: pre.undetermined }).toEqual({ stored: 0, undetermined: 1 });

    const after = gitInstance([{ id: "uml", path: "uml/", graphTypologies: ["docs"], storage: ROUTE }]);
    const post = censusDirectories([{ id: "uml", absPath: join(after, "uml"), storage: ROUTE }], undefined, after);
    expect({ stored: post.stored, undetermined: post.undetermined }).toEqual({ stored: 1, undetermined: 0 });
  });

  test("a route-keyed `qa` subgraph is refused by the resolver too, not only by the schema", () => {
    // `ContentDirectorySchema` already refuses it for a DECLARED entry. This is
    // the hand-built-entry path `audit-coverage.ts` uses, where no schema runs —
    // and the guard named `tip` alone until this change.
    expect(() => resolveSubgraphSource({ id: "qa", path: "test/results/", graphTypologies: ["qa"], storage: ROUTE })).toThrow(/keyed by commit/);
    expect(() => resolveSubgraphSource({ id: "qa", path: "test/results/", graphTypologies: ["qa"], storage: TIP })).toThrow(/keyed by commit/);
    // And a commit-keyed one is NOT refused, so the guard is about the keying
    // rather than about `qa`.
    expect(resolveSubgraphSource({ id: "qa", path: "test/results/", graphTypologies: ["qa"], storage: STORED }).kind).toBe("branch");
  });
});

describe("presence checks honour it", () => {
  test("check:declared-dirs: an absent STORED directory is not a finding; the same without storage is", () => {
    const stored = instance([{ id: "qa", path: "test/results/", graphTypologies: ["qa"], storage: STORED }]);
    expect(auditInstance(stored, stored)).toEqual([]);
    const plain = instance([{ id: "qa", path: "test/results/", graphTypologies: ["qa"] }]);
    expect(auditInstance(plain, plain).map((f) => f.kind)).toEqual(["absent"]);
  });

  test("check:declared-dirs: a fetched working copy of a stored directory is not a stale exemption", () => {
    const root = instance([{ id: "qa", path: "test/results/", graphTypologies: ["qa"], storage: STORED }]);
    mkdirSync(join(root, "test", "results"), { recursive: true });
    expect(auditInstance(root, root)).toEqual([]);
  });

  test("harness:dirs does not create a stored directory empty, and does not list it as missing", () => {
    const root = instance([
      { id: "qa", path: "test/results/", graphTypologies: ["qa"], storage: STORED },
      { id: "health", path: "test/health/results/", graphTypologies: ["health"] },
    ]);
    const dirs = resolveDirectories([{ name: "fixture", root, own: true }]);
    expect(dirs.find((d) => d.id === "qa")?.storage).toEqual(STORED);
    const out = materialiseDirectories(dirs, root);
    expect(out.map((r) => r.id)).not.toContain("qa");
    expect(existsSync(join(root, "test", "results"))).toBe(false);
    expect(existsSync(join(root, "test", "health", "results"))).toBe(true);
  });

  test("audit:coverage skips a stored directory's working copy and says how many it skipped", () => {
    const root = instance([]);
    const a = join(root, "a");
    const b = join(root, "b");
    mkdirSync(a);
    mkdirSync(b);
    const r = censusDirectories([
      { absPath: a, storage: STORED },
      { absPath: b, storage: STORED },
    ]);
    expect(r).toEqual({ files: 0, sidecars: 0, stored: 2, undetermined: 0, uncounted: 0, absent: 0 });
  });

  test("a directory neither stored nor present is UNCOUNTED, never a census of zero (bean 0dav, C8)", () => {
    const root = instance([]);
    const here = join(root, "here");
    mkdirSync(here);
    writeFileSync(join(here, "x.json"), "{}");
    const r = censusDirectories([{ absPath: here }, { absPath: join(root, "gone") }]);
    expect(r).toEqual({ files: 1, sidecars: 0, stored: 0, undetermined: 0, uncounted: 1, absent: 0 });
  });
});

// Bean `9ofm`. Each case is the state the machinery can actually be left in,
// asserted through the gate rather than through a hand-built object, because
// the question "what does this checkout know" is answered by git and the
// marker and a stub of either would assert nothing.
describe("a tip-keyed directory is three-valued, and only one value is a pass", () => {
  test("not-cut-over: the declaration names the branch and the checkout still tracks the files", () => {
    const root = gitInstance([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    mkdirSync(join(root, "beans"));
    writeFileSync(join(root, "beans", "a.md"), "x\n");
    git(root, "add", "beans/a.md");

    const f = auditInstance(root, root);
    expect(f.map((x) => x.kind)).toEqual(["not-cut-over"]);
    // The remedy is the part a reader acts on: the two halves are ONE change.
    expect(f[0]!.detail).toContain("ONE change");
    expect(f[0]!.detail).toContain("still tracks 1 file(s)");
  });

  test("unmounted: cut over, nothing mounted — an EMPTY graph, not an unreachable one", () => {
    const root = gitInstance([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    const f = auditInstance(root, root);
    expect(f.map((x) => x.kind)).toEqual(["unmounted"]);
    expect(f[0]!.detail).toContain("nothing is mounted here");
  });

  test("mounted is the pass, and a marker whose mount is GONE is not", () => {
    const root = gitInstance([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    const into = join(root, "beans");
    marker(root, "beans", into);
    expect(auditInstance(root, root)).toEqual([]);

    rmSync(into, { recursive: true, force: true });
    expect(auditInstance(root, root).map((x) => x.kind)).toEqual(["unmounted"]);
  });

  test("a COMMIT-keyed directory in the same repository is still skipped — the distinction is the keying", () => {
    const root = gitInstance([
      { id: "qa", path: "test/results/", graphTypologies: ["qa"], storage: STORED },
      { id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP },
    ]);
    // Only the tip-keyed one is answered; `qa` contributes no finding either way.
    expect(auditInstance(root, root).map((x) => x.id)).toEqual(["beans"]);
  });

  test("audit:coverage counts a mount's real files, and will not fold `undetermined` into `stored`", () => {
    const root = gitInstance([]);
    const into = join(root, "mounted");
    marker(root, "beans", into);
    writeFileSync(join(into, "a.md"), "x\n");
    writeFileSync(join(into, "b.md"), "y\n");

    // Mounted: censused AT THE MARKER's `into`, which is not the declared path.
    expect(censusDirectories([{ id: "beans", absPath: join(root, "beans"), storage: TIP }], undefined, root)).toEqual({
      files: 2,
      sidecars: 0,
      stored: 0,
      undetermined: 0,
      uncounted: 0,
      absent: 0,
    });

    // Unmounted: `undetermined`, and NOT `stored` — "could not read the files"
    // and "not where the files are, by design" are different answers.
    expect(censusDirectories([{ id: "todos", absPath: join(root, "todos"), storage: TIP }], undefined, root)).toEqual({
      files: 0,
      sidecars: 0,
      stored: 0,
      undetermined: 1,
      uncounted: 0,
      absent: 0,
    });
  });

  // cat-harness-tools#1701: a graph `state:mount` DETERMINED absent (declared
  // for every checkout by a mounted instance, not by this root, not on this
  // remote) is not this checkout's: `absent`, never a lower bound.
  test("unmounted WITH an absence record is `absent`, not `undetermined`", () => {
    const root = gitInstance([]);
    recordAbsence(root, { id: "todos", path: "todos" }, "cat-harness", "declared for every checkout by cat-harness, not by this root");
    expect(censusDirectories([{ id: "todos", absPath: join(root, "todos"), storage: TIP }], undefined, root)).toEqual({
      files: 0,
      sidecars: 0,
      stored: 0,
      undetermined: 0,
      uncounted: 0,
      absent: 1,
    });
    // A different graph with no record stays undetermined.
    expect(censusDirectories([{ id: "beans", absPath: join(root, "beans"), storage: TIP }], undefined, root).undetermined).toBe(1);
  });

  // The MODERN spelling (#1987, bean `l4ay`). `storage` is its legacy form and
  // the resolver maps one onto the other, so both must reach the same verdict
  // — otherwise the answer depends on which field a declaration happened to
  // use, which is the defect `subgraph-source` exists to remove.
  test("`source: { kind: branch, keyedBy: tip }` reaches the same verdict as the legacy `storage`", () => {
    const src = { kind: "branch", branch: TIP.branch, keyedBy: "tip" } as const;
    const root = gitInstance([{ id: "beans", path: "beans/", graphTypologies: ["beans"], source: src }]);
    expect(auditInstance(root, root).map((x) => x.kind)).toEqual(["unmounted"]);

    marker(root, "beans", join(root, "beans"));
    expect(auditInstance(root, root)).toEqual([]);
    expect(censusDirectories([{ id: "beans", absPath: join(root, "beans"), source: src }], undefined, root).undetermined).toBe(0);
  });

  test("`source: { kind: branch, keyedBy: commit }` is skipped, like the legacy commit-keyed form", () => {
    const src = { kind: "branch", branch: "cat/cat-harness/qa-reports", keyedBy: "commit" } as const;
    const root = gitInstance([{ id: "qa", path: "test/results/", graphTypologies: ["qa"], source: src }]);
    expect(auditInstance(root, root)).toEqual([]);
    expect(censusDirectories([{ id: "qa", absPath: join(root, "test", "results"), source: src }], undefined, root)).toEqual({
      files: 0,
      sidecars: 0,
      stored: 1,
      undetermined: 0,
      uncounted: 0,
      absent: 0,
    });
  });

  test("an entry declaring BOTH is a finding carrying the resolver's message, not a crash", () => {
    const root = gitInstance([
      { id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP, source: { kind: "branch", branch: TIP.branch, keyedBy: "tip" } },
    ]);
    const f = auditInstance(root, root);
    expect(f.map((x) => x.kind)).toEqual(["unmounted"]);
    expect(f[0]!.detail).toContain("two answers to where its content comes from");
  });

  test("no git repository is `undetermined`, never a pass: a gate that could not ask has not asked", () => {
    const root = instance([{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }]);
    const f = auditInstance(root, root);
    expect(f.map((x) => x.kind)).toEqual(["unmounted"]);
    expect(f[0]!.detail).toContain("Not a pass");
    expect(censusDirectories([{ id: "beans", absPath: join(root, "beans"), storage: TIP }], undefined, root).undetermined).toBe(1);
  });
});

describe("resolveQaLocation", () => {
  test("reads the branch from the declaration; with none declared it is the default, and says so", () => {
    const root = instance([{ id: "qa", path: "test/results/", graphTypologies: ["qa"], storage: { branch: "qa-elsewhere", keyedBy: "commit" } }]);
    const loc = resolveQaLocation(root);
    expect(loc).toMatchObject({ branch: "qa-elsewhere", declared: true, keyedBy: "commit" });
    expect(loc.directories).toEqual([
      expect.objectContaining({ id: "qa", path: "test/results", present: false, storage: { branch: "qa-elsewhere", keyedBy: "commit" } }),
    ]);

    const plain = instance([{ id: "qa", path: "test/results/", graphTypologies: ["qa"] }]);
    expect(resolveQaLocation(plain)).toMatchObject({ branch: "cat/cat-harness/qa-reports", declared: false });
  });

  test("two qa directories naming different branches are refused, not resolved by order", () => {
    const root = instance([
      { id: "qa", path: "test/results/", graphTypologies: ["qa"], storage: { branch: "one", keyedBy: "commit" } },
      { id: "qa2", path: "more/results/", graphTypologies: ["qa"], storage: { branch: "two", keyedBy: "commit" } },
    ]);
    expect(() => resolveQaLocation(root)).toThrow(QaUsageError);
  });
});

describe("storage's FAMILY form (bean lehh)", () => {
  const FAMILY = { branchPrefix: "cat/fhir-harness/fhir-ast/", keyedBy: "family", keyFrom: "the IG's package id" };
  test("parses, with a prefix ending in / and the key said in words", () => {
    expect(DirectoryStorageSchema.safeParse(FAMILY).success).toBe(true);
    expect(ContentDirectorySchema.safeParse({ id: "ig-ast", path: "ig-ast/", graphTypologies: ["docs"], storage: FAMILY }).success).toBe(true);
  });
  test("refuses a prefix without /, a family with a single branch, and a family with no key", () => {
    expect(DirectoryStorageSchema.safeParse({ ...FAMILY, branchPrefix: "cat/fhir-harness/fhir-ast" }).success).toBe(false);
    expect(DirectoryStorageSchema.safeParse({ branch: "cat/x/y", keyedBy: "family", keyFrom: "k" }).success).toBe(false);
    expect(DirectoryStorageSchema.safeParse({ branchPrefix: "cat/x/", keyedBy: "family" }).success).toBe(false);
  });
});
