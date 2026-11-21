/**
 * The change-set route through the corpus gate, for a layer whose workflow
 * store is kept on `cat/<instance>/beans` (owner, 2026-11-17).
 *
 * A change-set instance used to cover a block only when its JSON was in the
 * PR's diff. A store kept on a branch and mounted can never be in the diff,
 * so the route was closed to those layers. A running `content-change-review`
 * instance in the store, started after the PR's base, now covers the blocks
 * it names; one started before the base does not.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CHANGE_REVIEW_PROCESS, MAKE_PHASE, changeSetCover, nearMiss, startedSince } from "../src/workflow/change-set-coverage.ts";
import { storedChangeSets } from "../src/workflow/corpus-gate.ts";
import type { InstanceState } from "../src/workflow/instance.ts";
import { clearWorkflowDirCache } from "../src/workflow/store.ts";

const BASE = "2026-11-17T06:00:00Z";

function cs(id: string, startedAt: string, over: Partial<InstanceState> = {}): InstanceState {
  return {
    id,
    processId: CHANGE_REVIEW_PROCESS,
    status: "running",
    startedAt,
    updatedAt: startedAt,
    history: [{ node: MAKE_PHASE, at: startedAt }],
    scope: { changeSet: id.toUpperCase(), blocks: ["fig-1", "fig-2"] },
    ...over,
  } as unknown as InstanceState;
}

describe("startedSince", () => {
  test("keeps running change sets started after the base, and nothing else", () => {
    const after = cs("cs-new", "2026-11-17T07:00:00Z");
    const before = cs("cs-old", "2026-11-16T07:00:00Z");
    const done = cs("cs-done", "2026-11-17T07:00:00Z", { status: "completed" } as Partial<InstanceState>);
    const other = cs("ed-1", "2026-11-17T07:00:00Z", { processId: "Process_Editing" } as Partial<InstanceState>);
    const undated = cs("cs-undated", "");
    expect(startedSince([after, before, done, other, undated], BASE).map((s) => s.id)).toEqual(["cs-new"]);
  });

  test("an unparseable base admits nothing", () => {
    expect(startedSince([cs("cs-new", "2026-11-17T07:00:00Z")], "not a time")).toEqual([]);
  });

  test("a stored change set started since the base covers the blocks it names", () => {
    const fresh = startedSince([cs("cs-new", "2026-11-17T07:00:00Z")], BASE);
    expect(changeSetCover(fresh, "fig-2")).toEqual({ instance: "cs-new", changeSet: "CS-NEW" });
    expect(changeSetCover(fresh, "fig-9")).toBeUndefined();
    expect(nearMiss(fresh, "fig-9")).toMatch(/started since the PR's base do not list fig-9/);
  });
});

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
  clearWorkflowDirCache();
});

/** A git repository declaring a `beans` graph whose `workflows/` holds `states`; `storage` puts it on a branch. */
function repo(states: InstanceState[], storage?: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), "corpus-gate-cs-"));
  made.push(root);
  const dirs = [{ id: "beans", path: "beans/", graphTypologies: ["beans"], ...(storage ? { storage } : {}) }];
  writeFileSync(join(root, "fixture.json"), JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "fixture", directories: dirs }));
  for (const args of [["init", "-q", "-b", "main"], ["config", "user.email", "t@t"], ["config", "user.name", "t"]])
    expect(spawnSync("git", args, { cwd: root }).status).toBe(0);
  if (!storage) {
    const wf = join(root, "beans", "workflows");
    mkdirSync(wf, { recursive: true });
    writeFileSync(
      join(root, "beans", "beans.json"),
      JSON.stringify({ name: "fixture", directories: [{ id: "workflows", path: "workflows", graphTypologies: ["workflow-state"] }] }),
    );
    for (const s of states) writeFileSync(join(wf, `${s.id}.json`), JSON.stringify(s));
  }
  return root;
}

describe("storedChangeSets", () => {
  test("reads the store and keeps only change sets started since the base", () => {
    clearWorkflowDirCache();
    const root = repo([cs("cs-new", "2026-11-17T07:00:00Z"), cs("cs-old", "2026-11-16T07:00:00Z")]);
    expect(storedChangeSets(root, BASE).map((s) => s.id)).toEqual(["cs-new"]);
  });

  test("an unmounted store gives no cover rather than a crash", () => {
    clearWorkflowDirCache();
    const cut = repo([], { branch: "cat/fixture/beans", keyedBy: "tip" });
    expect(storedChangeSets(cut, BASE)).toEqual([]);
  });
});
