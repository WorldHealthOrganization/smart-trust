/**
 * A bean or todo store that a mount DETERMINED absent from this checkout: the
 * readers throw a typed error and the gates exit 78, "not applicable here".
 *
 * smart-ips-pilgrimage#13: a site instance has no bean store, so every bean
 * gate exited 2 and main's own verdict was red with nothing wrong. A store
 * that is declared and merely NOT MOUNTED keeps exiting 2.
 *
 * @module scripts/tests/bean-store-absent
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { readBeanFiles, readBeanStore } from "../bean-store-read.ts";
import { recordAbsence } from "../branch-store.ts";
import { readBeans, resolveBeanDefs } from "../beans.ts";
import { BeanStoreAbsentError, StoreAbsentError } from "../lib/bean-store-absent.ts";
import { NOT_APPLICABLE_EXIT } from "../lib/not-applicable.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const TIP = { branch: "cat/cat-harness/beans", keyedBy: "tip" } as const;
const SCRIPTS = resolve(import.meta.dir, "..");

function git(root: string, ...args: string[]): void {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf-8" });
  expect(`${args.join(" ")} -> ${r.status}`).toBe(`${args.join(" ")} -> 0`);
}

/** A checkout declaring a tip-kept `beans` graph, with or without a recorded absence. */
function checkout(absent: boolean): string {
  const root = mkdtempSync(join(tmpdir(), "bean-store-absent-"));
  made.push(root);
  writeFileSync(
    join(root, "fixture.json"),
    JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "fixture", directories: [{ id: "beans", path: "beans/", graphTypologies: ["beans"], storage: TIP }] }, null, 2),
  );
  git(root, "init", "-q", "-b", "main");
  git(root, "remote", "add", "origin", "https://github.com/example/instance.git");
  if (absent) recordAbsence(root, { id: "beans", key: "beans", path: "beans" }, "fixture", "this checkout's remote carries no cat/cat-harness/* branch");
  return root;
}

describe("the readers", () => {
  test("a recorded absence reads as `unreachable` with `absent`, and the readers throw the typed error", () => {
    const root = checkout(true);
    expect(resolveBeanDefs(root)).toMatchObject({ dir: null, absent: true });
    const s = readBeanStore(root);
    expect(s).toMatchObject({ state: "unreachable", absent: true });
    expect(() => readBeanFiles(root)).toThrow(BeanStoreAbsentError);
    expect(() => readBeans(root)).toThrow(BeanStoreAbsentError);
    expect(new BeanStoreAbsentError("x")).toBeInstanceOf(StoreAbsentError);
  });

  test("NOT MOUNTED is not absent: no flag, and a plain error", () => {
    const root = checkout(false);
    expect(resolveBeanDefs(root).absent).toBeUndefined();
    const s = readBeanStore(root);
    expect(s.state).toBe("unreachable");
    expect("absent" in s && s.absent).toBeFalsy();
    let thrown: unknown;
    try {
      readBeanFiles(root);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(StoreAbsentError);
  });
});

describe("the gates", () => {
  test.each(["check-bean-parents.ts", "check-draft-beans.ts", "check-bean-issues.ts", "check-bean-rollup.ts", "check-harness-dirs.ts"])("%s: absent exits 78; not mounted stays red", (gate) => {
    const run = (root: string) => spawnSync("bun", [join(SCRIPTS, gate)], { cwd: root, encoding: "utf-8" });
    const absent = run(checkout(true));
    expect(`${absent.status} ${absent.stdout}`).toContain(`${NOT_APPLICABLE_EXIT} `);
    expect(absent.stdout).toContain("NOT APPLICABLE");
    // Not mounted keeps its old answer (2, or 1 where the gate reports it as a problem): never 0 or 78.
    expect([0, NOT_APPLICABLE_EXIT]).not.toContain(run(checkout(false)).status);
  });
});
