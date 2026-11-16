/**
 * The memory store conformance suite, run against both memory Tools: the run's
 * file store, and beans (the work plan's mount). Same responsibilities, two
 * Tools: the Role is Tool-neutral (cat-harness#991 §4.14, Q17).
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FileMemoryStore } from "../../../src/workflow/memory-file-store.ts";
import { MountedGitBranchStore } from "../../../src/workflow/work-plan-store-git-mount.ts";
import { record, takeUp, workContextFrom } from "../../../src/workflow/work-context.ts";
import { memoryStoreConformance } from "./memory-store-conformance.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});
const tmp = (p: string): string => {
  const d = mkdtempSync(join(tmpdir(), p));
  made.push(d);
  return d;
};

memoryStoreConformance({
  name: "run files (run-files)",
  fresh() {
    const d = tmp("mem-files-");
    return { a: new FileMemoryStore(d), b: new FileMemoryStore(d) };
  },
});

memoryStoreConformance({
  name: "beans on the mount (work-plan)",
  fresh() {
    const r = tmp("mem-beans-");
    mkdirSync(join(r, "beans", "defs"), { recursive: true });
    writeFileSync(join(r, "beans", "beans.json"), JSON.stringify({ name: "f", directories: [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"] }] }));
    return { a: new MountedGitBranchStore(r, { cli: false }), b: new MountedGitBranchStore(r, { cli: false }) };
  },
});

describe("run files: what is on disk", () => {
  test("a record is memory-record/1.0.0, and each entry one JSON line", () => {
    const d = tmp("mem-disk-");
    const s = new FileMemoryStore(d);
    s.open({ id: "m1", title: "T", scope: "run" });
    s.keep("m1", { at: "2026-11-03T07:00:00Z", by: "a", kind: "note", text: "x" });
    expect(JSON.parse(readFileSync(join(d, "m1", "record.json"), "utf8")).$schema).toBe("memory-record/1.0.0");
    expect(readFileSync(join(d, "m1", "entries.jsonl"), "utf8").trim().split("\n")).toHaveLength(1);
  });

  test("an id that would leave the store's directory is refused", () => {
    const s = new FileMemoryStore(tmp("mem-id-"));
    expect(s.open({ id: "../escape", title: "T", scope: "run" }).state).toBe("refused");
    expect(s.keep("../escape", { at: "x", by: "a", kind: "note", text: "x" }).state).toBe("none");
  });

  test("a torn line is skipped, never fatal to the rest of the memory", () => {
    const d = tmp("mem-torn-");
    const s = new FileMemoryStore(d);
    s.open({ id: "m1", title: "T", scope: "run" });
    s.keep("m1", { at: "2026-11-03T07:00:00Z", by: "a", kind: "note", text: "first" });
    writeFileSync(join(d, "m1", "entries.jsonl"), '{"at":"2026', { flag: "a" });
    const r = s.recall("m1");
    expect(r.state === "hit" && r.record.entries.map((e) => e.text)).toEqual(["first"]);
  });
});

describe("the engine keeps work context in run files when the deployment says so", () => {
  const chosen = (stores: Record<string, string>) => ({ store: {} as never, tool: "beans-git-branch", deployment: "itb-run", stores });

  test("run-files needs CAT_MEMORY_DIR, and says so", () => {
    expect(() => workContextFrom(chosen({ "work-context": "run-files" }), {})).toThrow(/CAT_MEMORY_DIR/);
  });

  test("taken up and a step done land in the run's files; no work-plan status is touched", () => {
    const d = tmp("mem-engine-");
    const t = workContextFrom(chosen({ "work-context": "run-files" }), { CAT_MEMORY_DIR: d });
    expect(t.tool).toBe("run-files");
    new FileMemoryStore(d).open({ id: "case-1", title: "Case 1", scope: "item" });
    const meta = { process: "p", instance: "p--a", by: "workflow" };
    expect(takeUp(t, "case-1", meta, "started").summary).toBe("work context kept on case-1 (taken-up)");
    record(t, "case-1", { ...meta, kind: "step-done", node: "Task_X" }, "done");
    const r = new FileMemoryStore(d).recall("case-1");
    expect(r.state === "hit" && r.record.entries.map((e) => [e.kind, e.step])).toEqual([["taken-up", undefined], ["step-done", "Task_X"]]);
  });
});
