/**
 * `check:state-on-main` — a declared state directory on `main` is recorded
 * debt, and the record may only shrink.
 *
 * The gate's value is entirely in the two directions it fails, so both are
 * falsified here rather than described: a NEW state directory on `main` that
 * the baseline does not name, and a baseline line that no longer describes
 * one. The second is the one a one-way ratchet gets wrong — the debt is paid,
 * the line stays, and the next directory to take that id inherits an
 * exemption nobody granted. `translation-drift.ts` records the same lesson
 * from the other side: its first version exempted a whole page, and drift
 * under the exemption went unseen until somebody mutated a heading to check.
 *
 * `stateDirectories` is pinned against REAL fixture declarations rather than
 * hand-built objects, for the reason `directory-storage.test.ts` gives: the
 * answer depends on how the declaration reader resolves two levels, and an
 * object literal would test this file's idea of the reader instead of the
 * reader.
 *
 * @module scripts/tests/state-on-main
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { compare, instancesNotInCheckout, keyOf, stateDirectories } from "../check-state-on-main.ts";
import type { StateDirectory } from "../check-state-on-main.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

/** A fixture layer whose declaration is written from `dirs`. */
function instance(dirs: unknown[], nested?: Record<string, unknown[]>): string {
  const root = mkdtempSync(join(tmpdir(), "state-on-main-"));
  made.push(root);
  writeFileSync(
    join(root, "fixture.json"),
    JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "fixture", directories: dirs }, null, 2),
  );
  for (const [dir, entries] of Object.entries(nested ?? {})) {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(
      join(root, dir, `${dir}.json`),
      JSON.stringify({ name: "fixture", directories: entries }, null, 2),
    );
  }
  return root;
}

function dir(over: Partial<StateDirectory> = {}): StateDirectory {
  return {
    instance: "",
    id: "beans",
    path: "beans",
    stateKinds: ["beans"],
    offCheckout: false,
    declaredIn: "folio-assistant.json",
    ...over,
  };
}

describe("keyOf", () => {
  test("keys on instance and id, and spells the repository root `.`", () => {
    expect(keyOf({ instance: "", id: "beans" })).toBe(".::beans");
    expect(keyOf({ instance: "cat-harness", id: "health" })).toBe("cat-harness::health");
  });

  test("does NOT key on the path, because a cutover leaves the path alone", () => {
    // After the flip, `path` is where the mount lands — unchanged. Keying on
    // it would make the line stop matching for the one change it tracks.
    expect(keyOf(dir({ path: "beans" }))).toBe(keyOf(dir({ path: "somewhere/else" })));
  });
});

describe("compare — a NEW state directory on main fails", () => {
  test("an unrecorded on-main directory is a finding", () => {
    const f = compare([dir()], { onMain: [] });
    expect(f).toHaveLength(1);
    expect(f[0]!.kind).toBe("new-on-main");
    expect(f[0]!.key).toBe(".::beans");
  });

  test("a recorded one is not", () => {
    expect(compare([dir()], { onMain: [".::beans"] })).toHaveLength(0);
  });

  test("an off-checkout directory is never a finding, recorded or not", () => {
    expect(compare([dir({ offCheckout: true })], { onMain: [] })).toHaveLength(0);
  });

  test("FALSIFICATION: drop the baseline and every on-main directory fires", () => {
    // If this passed with an empty baseline the gate would be inert.
    const dirs = [dir({ id: "beans" }), dir({ id: "todos" }), dir({ id: "uploads" })];
    expect(compare(dirs, { onMain: [] })).toHaveLength(3);
  });
});

describe("compare — a baseline line that describes nothing also fails", () => {
  test("a cut-over entry must be deleted from the baseline", () => {
    const f = compare([dir({ offCheckout: true })], { onMain: [".::beans"] });
    expect(f).toHaveLength(1);
    expect(f[0]!.kind).toBe("baseline-stale");
    expect(f[0]!.key).toBe(".::beans");
  });

  test("so does an entry whose directory is no longer declared at all", () => {
    const f = compare([], { onMain: [".::gone"] });
    expect(f).toHaveLength(1);
    expect(f[0]!.kind).toBe("baseline-stale");
  });

  test("FALSIFICATION: a one-way ratchet would pass this, and must not", () => {
    // The whole case for the second direction. `beans` has been cut over and
    // something else now holds the id on main. A gate that only looked for
    // unrecorded entries would see `.::beans` recorded and say nothing.
    const f = compare([dir({ offCheckout: true })], { onMain: [".::beans"] });
    expect(f.map((x) => x.kind)).toEqual(["baseline-stale"]);
  });
});

describe("stateDirectories reads the declaration, not the disk", () => {
  test("a directory holding a state kind is listed; a content kind is not", () => {
    const root = instance([
      { id: "beans", path: "beans/", graphTypologies: ["beans"] },
      { id: "skills", path: "skills/", graphTypologies: ["skills"] },
    ]);
    const got = stateDirectories(root);
    expect(got.map((d) => d.id)).toEqual(["beans"]);
    expect(got[0]!.stateKinds).toEqual(["beans"]);
  });

  test("`source: branch` reads as off the checkout; a bare directory does not", () => {
    const root = instance([
      { id: "beans", path: "beans/", graphTypologies: ["beans"], source: { kind: "branch", branch: "cat/cat-harness/beans", keyedBy: "tip" } },
      { id: "todos", path: "todos/", graphTypologies: ["todos"] },
    ]);
    const by = new Map(stateDirectories(root).map((d) => [d.id, d.offCheckout]));
    expect(by.get("beans")).toBe(true);
    expect(by.get("todos")).toBe(false);
  });

  test("the legacy `storage` spelling counts too", () => {
    const root = instance([
      { id: "qa", path: "test/results/", graphTypologies: ["qa"], storage: { branch: "qa-reports", keyedBy: "commit" } },
    ]);
    expect(stateDirectories(root).map((d) => d.offCheckout)).toEqual([true]);
  });

  test("it finds entries declared FROM WITHIN a directory, which is where most of them are", () => {
    // A one-level read reported `beans` and missed `defs`, `notes` and
    // `workflows` underneath it — most of the real list.
    const root = instance(
      [{ id: "beans", path: "beans/", graphTypologies: ["beans"] }],
      {
        beans: [
          { id: "defs", path: "defs", graphTypologies: ["bean-defs"] },
          { id: "notes", path: "notes", graphTypologies: ["bean-notes"] },
          { id: "workflows", path: "workflows", graphTypologies: ["workflow-state"] },
        ],
      },
    );
    const ids = stateDirectories(root).map((d) => d.id).sort();
    expect(ids).toContain("beans");
    expect(ids).toContain("beans/defs");
    expect(ids).toContain("beans/notes");
    expect(ids).toContain("beans/workflows");
  });

  test("an entry declared from within a BRANCH-sourced directory is off the checkout too", () => {
    // `beans/beans.json` declares `defs` with no source of its own, but its
    // content is read from the mounted branch, not from `main`. Reporting it
    // on `main` made every bean sub-directory a finding after the cutover.
    const root = instance(
      [{ id: "beans", path: "beans/", graphTypologies: ["beans"], source: { kind: "branch", branch: "cat/cat-harness/beans", keyedBy: "tip" } }],
      { beans: [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"] }] },
    );
    const by = new Map(stateDirectories(root).map((d) => [d.id, d.offCheckout]));
    expect(by.get("beans")).toBe(true);
    expect(by.get("beans/defs")).toBe(true);
  });

  test("a `repository`-scoped entry is keyed and located at the checkout root, not under its declarer", () => {
    // The index checkout's root declares nothing; cat-harness declares the
    // checkout's `uploads/` with `scope: "repository"`. It is the ROOT's
    // directory, and the baseline names it `.::<id>`.
    const repo = mkdtempSync(join(tmpdir(), "state-on-main-repo-"));
    made.push(repo);
    const inst = join(repo, "fixture");
    mkdirSync(inst);
    writeFileSync(
      join(inst, "fixture.json"),
      JSON.stringify({
        $schema: "cat-harness-declaration/1.0.0",
        name: "fixture",
        directories: [
          { id: "checkout-uploads", path: "uploads/", graphTypologies: ["uploads"], scope: "repository" },
          { id: "health", path: "health/", graphTypologies: ["health"] },
        ],
      }, null, 2),
    );
    const got = new Map(stateDirectories(repo).map((d) => [d.id, d]));
    expect(keyOf(got.get("checkout-uploads")!)).toBe(".::checkout-uploads");
    expect(got.get("checkout-uploads")!.path).toBe("uploads");
    expect(keyOf(got.get("health")!)).toBe("fixture::health");
    expect(got.get("health")!.path).toBe("fixture/health");
  });

  test("an ABSENT directory is not a finding — the question is the declaration", () => {
    // Nothing is created on disk here. A checkout where nobody ran
    // `state:mount` must not read as a state directory appearing on main,
    // which is bean `dh4f`'s clean-run-over-nothing in this gate's shape.
    const root = instance([
      { id: "beans", path: "beans/", graphTypologies: ["beans"], source: { kind: "branch", branch: "cat/cat-harness/beans", keyedBy: "tip" } },
    ]);
    expect(compare(stateDirectories(root), { onMain: [] })).toHaveLength(0);
  });
});

// cat-harness-tools#1701: a content instance's joined checkout (smart-ips-
// pilgrimage) does not mount `folio-assistant-sci`, so its baseline line is
// not this checkout's to judge. Excused only when DETERMINED — lock parses,
// does not list it, and it is not on disk — and judged as before otherwise.
describe("instancesNotInCheckout — a baseline line for an instance this checkout does not hold", () => {
  function checkout(lockInstances: unknown[] | undefined, dirs: string[] = []): string {
    const root = mkdtempSync(join(tmpdir(), "state-on-main-lock-"));
    made.push(root);
    if (lockInstances !== undefined) {
      writeFileSync(join(root, "index.lock.json"), JSON.stringify({ instances: lockInstances }));
    }
    for (const d of dirs) mkdirSync(join(root, d), { recursive: true });
    return root;
  }
  const baseline = { onMain: [".::checkout-uploads", "cat-harness::uploads", "folio-assistant-sci::attestations"] };

  test("an instance absent from the lock and the disk is not applicable, and is not a failure", () => {
    const root = checkout([{ instance: "cat-harness", path: "cat-harness" }], ["cat-harness"]);
    const notHere = instancesNotInCheckout(root, baseline);
    expect([...notHere.keys()]).toEqual(["folio-assistant-sci"]);
    const f = compare([], { onMain: ["folio-assistant-sci::attestations"] }, notHere);
    expect(f.map((x) => x.kind)).toEqual(["not-applicable"]);
  });

  test("an instance the lock mounts is still judged, so a really stale line still fails", () => {
    const root = checkout([{ instance: "folio-assistant-sci", path: "folio-assistant-sci" }]);
    const notHere = instancesNotInCheckout(root, baseline);
    expect(notHere.has("folio-assistant-sci")).toBe(false);
    expect(compare([], { onMain: ["folio-assistant-sci::attestations"] }, notHere).map((x) => x.kind)).toEqual(["baseline-stale"]);
  });

  test("an instance on disk is still judged, lock or no lock entry", () => {
    const root = checkout([], ["folio-assistant-sci"]);
    expect(instancesNotInCheckout(root, baseline).has("folio-assistant-sci")).toBe(false);
  });

  test("no lock, or an unreadable lock, determines nothing", () => {
    expect(instancesNotInCheckout(checkout(undefined), baseline).size).toBe(0);
    const bad = checkout(undefined);
    writeFileSync(join(bad, "index.lock.json"), "{ not json");
    expect(instancesNotInCheckout(bad, baseline).size).toBe(0);
  });
});
