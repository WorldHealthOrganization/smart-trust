import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { InitStep } from "@litlfred/bootstrap-tools/scripts/init.ts";
import { initializationBadge, partiallyMounted, readsInstanceFiles, relativize, stateOf } from "../harness-state.ts";

const step = (id: string, state: InitStep["state"], action?: string): InitStep => ({ id, namedBy: "x", what: `step ${id}`, state, detail: "/repo/x/thing", ...(action ? { action } : {}) });
const unknown = { id: "repository" as const, state: "unknown" as const, label: "no report" };

describe("harness-state (bean supn)", () => {
  test("position is the first not-done step, and next is its action, said and not done", () => {
    const s = stateOf("x", [step("declaration", "done"), step("directory:a", "not-done", "create /repo/x/a"), step("readme", "not-done", "write it")], "/repo", unknown);
    expect(s.initialization.position).toBe("directory:a");
    expect(s.initialization.next).toEqual({ step: "directory:a", action: "create x/a" });
    expect(s.initialization.counts).toEqual({ done: 1, "not-done": 2, "could-not-determine": 0, stated: 0 });
    expect(s.health.badges[0]).toEqual({ id: "initialization", state: "finding", label: "2 setup step(s) not done" });
  });

  test("no not-done step is `complete`, and only could-not-determine left is unknown, never ok", () => {
    const s = stateOf("x", [step("declaration", "done"), step("site:live", "could-not-determine")], "/repo", unknown);
    expect(s.initialization.position).toBe("complete");
    expect(s.initialization.next).toBeNull();
    expect(s.health.badges[0]!.state).toBe("unknown");
    expect(initializationBadge({ done: 3, "not-done": 0, "could-not-determine": 0, stated: 1 }).state).toBe("ok");
  });

  test("published paths carry no build-machine directory", () => {
    expect(relativize("/repo/x/a and /repo", "/repo")).toBe("x/a and .");
    const s = stateOf("x", [step("declaration", "done")], "/repo", unknown);
    expect(JSON.stringify(s)).not.toContain("/repo/");
  });

  test("an instance the lock mounts in part is partial; whole, or without a lock, is not", () => {
    const repo = mkdtempSync(join(tmpdir(), "harness-state-"));
    try {
      mkdirSync(join(repo, "a"));
      mkdirSync(join(repo, "b"));
      expect(partiallyMounted(join(repo, "a"), repo)).toBe(false);
      writeFileSync(
        join(repo, "index.lock.json"),
        JSON.stringify({ instances: [{ path: "a", directories: [{ path: "a" }] }, { path: "b", directories: [{ path: "b/library" }] }] }),
      );
      expect(partiallyMounted(join(repo, "a"), repo)).toBe(false);
      expect(partiallyMounted(join(repo, "b"), repo)).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
    expect(readsInstanceFiles("directory:docs")).toBe(true);
    expect(readsInstanceFiles("needs:cat-harness")).toBe(false);
  });
});
