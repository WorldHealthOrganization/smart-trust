/**
 * A workflow store kept on an unmounted branch is reported, not a crash.
 *
 * litlfred/dth-sfp#14's first full-tier run: the layer's bean graph is
 * declared on `cat/<layer>/beans` and not mounted in CI, so `workflowDir`
 * throws, and `check:corpus-gate` died with "cannot resolve the workflow
 * instance directory" instead of reporting the block. `readInstance` turns
 * that into "this store cannot say", which the gate still refuses on.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readInstance } from "../src/workflow/corpus-gate.ts";
import { clearWorkflowDirCache } from "../src/workflow/store.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
  clearWorkflowDirCache();
});

/** A git repository declaring a `beans` graph, optionally on an unmounted branch. */
function repo(storage?: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), "corpus-gate-unmounted-"));
  made.push(root);
  const dirs = [{ id: "beans", path: "beans/", graphTypologies: ["beans"], ...(storage ? { storage } : {}) }];
  writeFileSync(join(root, "fixture.json"), JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "fixture", directories: dirs }));
  for (const args of [["init", "-q", "-b", "main"], ["config", "user.email", "t@t"], ["config", "user.name", "t"]])
    expect(spawnSync("git", args, { cwd: root }).status).toBe(0);
  return root;
}

describe("readInstance", () => {
  test("an unmounted bean graph is reported as unreachable, not thrown", () => {
    clearWorkflowDirCache();
    const cut = repo({ branch: "cat/fixture/beans", keyedBy: "tip" });
    const r = readInstance(cut, "editing-hci-validation--blk");
    expect(r.state).toBeUndefined();
    expect(r.unreachable).toMatch(/cannot resolve the workflow instance directory/);
  });

  test("a readable store with no record is simply no record", () => {
    clearWorkflowDirCache();
    const root = repo();
    mkdirSync(join(root, "beans", "workflows"), { recursive: true });
    writeFileSync(
      join(root, "beans", "beans.json"),
      JSON.stringify({ name: "fixture", directories: [{ id: "workflows", path: "workflows", graphTypologies: ["workflow-state"] }] }),
    );
    expect(readInstance(root, "editing-hci-validation--blk")).toEqual({ state: undefined });
  });

  test("a readable record is returned; a malformed one still throws", () => {
    clearWorkflowDirCache();
    const root = repo();
    const wf = join(root, "beans", "workflows");
    mkdirSync(wf, { recursive: true });
    writeFileSync(
      join(root, "beans", "beans.json"),
      JSON.stringify({ name: "fixture", directories: [{ id: "workflows", path: "workflows", graphTypologies: ["workflow-state"] }] }),
    );
    writeFileSync(join(wf, "ok.json"), JSON.stringify({ id: "ok", history: [] }));
    writeFileSync(join(wf, "bad.json"), "{ not json");
    expect(readInstance(root, "ok").state).toMatchObject({ id: "ok" });
    expect(() => readInstance(root, "bad")).toThrow();
  });
});
