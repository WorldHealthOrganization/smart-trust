/**
 * A re-pin that moves cat-harness-tools regenerates the checkout's own health
 * report and pushes only that graph (owner, 2026-11-07, card "Layer health":
 * "A. The re-pin does it"). Found on a content layer's re-pin: it failed
 * `health-result-is-from-the-current-producer` on a report three days old,
 * because nothing refreshed a layer's report when its checker moved.
 */
import { describe, expect, test } from "bun:test";

import { afterMountHealth, checkerMoved, ownGraphIds, refreshOwnHealth, toolsPinIn, type Runner } from "../lib/repin-health.js";

const lock = (tools: string | undefined) =>
  JSON.stringify({ instances: [{ instance: "bootstrap", sha: "b".repeat(40) }, ...(tools ? [{ instance: "cat-harness-tools", sha: tools }] : [])] });

describe("checkerMoved", () => {
  test("the cat-harness-tools pin moved", () => {
    expect(checkerMoved(lock("a".repeat(40)), lock("c".repeat(40)))).toBe(true);
  });
  test("only another instance moved", () => {
    expect(checkerMoved(lock("a".repeat(40)), lock("a".repeat(40)))).toBe(false);
  });
  test("no lock before, one now: the first mount counts as a move", () => {
    expect(checkerMoved(undefined, lock("a".repeat(40)))).toBe(true);
  });
  test("no checker pinned now: nothing to refresh", () => {
    expect(checkerMoved(lock("a".repeat(40)), lock(undefined))).toBe(false);
    expect(toolsPinIn("{ not json")).toBeUndefined();
  });
});

const DRY_RUN = JSON.stringify({
  state: "would-push",
  graphs: [
    { id: "root.health", path: "test/health/results", branch: "cat/upper-layer/health" },
    { id: "cat-harness-tools.health", path: "cat-harness-tools/health", branch: "litlfred/cat-harness-tools:cat/cat-harness-tools/health" },
    { id: "lower.health", path: "test/health/results/", branch: "litlfred/lower:cat/lower/health" },
    { id: "beans", path: "beans", branch: "cat/cat-harness/beans" },
  ],
});

describe("ownGraphIds", () => {
  test("picks the graph at the own path, never one kept in another repository", () => {
    expect(ownGraphIds(DRY_RUN, ["test/health/results"])).toEqual(["root.health"]);
  });
  test("a dry run that does not parse finds nothing", () => {
    expect(ownGraphIds("oops", ["test/health/results"])).toEqual([]);
  });
});

function recorder(status: Partial<Record<string, number>> = {}): { run: Runner; calls: string[] } {
  const calls: string[] = [];
  const run: Runner = (script, args) => {
    const name = script.split("/").pop()!;
    calls.push([name, ...args].join(" "));
    if (name === "state-push.ts" && args.includes("--dry-run")) return { status: 0, stdout: DRY_RUN, stderr: "" };
    return { status: status[name] ?? 0, stdout: "", stderr: status[name] ? "boom" : "" };
  };
  return { run, calls };
}

describe("refreshOwnHealth", () => {
  test("mounts, writes the report with --warn, and pushes only the own graph", () => {
    const { run, calls } = recorder({ "state-mount.ts": 1 });
    const r = refreshOwnHealth("/x", ["test/health/results"], run);
    expect(r.ok).toBe(true);
    expect(calls).toEqual([
      "state-mount.ts",
      "run.ts --warn",
      "state-push.ts --dry-run --json",
      "state-push.ts --id root.health -m health: regenerate at the re-pin's cat-harness-tools pin",
    ]);
  });
  test("a health run that fails pushes nothing", () => {
    const { run, calls } = recorder({ "run.ts": 2 });
    const r = refreshOwnHealth("/x", ["test/health/results"], run);
    expect(r.ok).toBe(false);
    expect(calls.some((c) => c.startsWith("state-push.ts --id"))).toBe(false);
  });
  test("a push that fails is reported", () => {
    const { run } = recorder({ "state-push.ts": 1 });
    expect(refreshOwnHealth("/x", ["test/health/results"], run).ok).toBe(false);
  });
});

describe("afterMountHealth", () => {
  test("a declaration the registry cannot read is reported, never thrown (2026-11-07, l1-extraction)", () => {
    const { run, calls } = recorder();
    const lines = afterMountHealth("/x", lock("a".repeat(40)), lock("c".repeat(40)), run, () => {
      throw new Error('declares unknown graph typology "l1-extraction"');
    });
    expect(lines!.join("\n")).toContain("could not be determined");
    expect(lines!.join("\n")).toContain("l1-extraction");
    expect(calls).toEqual([]);
  });
  test("nothing runs when the checker did not move", () => {
    const { run, calls } = recorder();
    expect(afterMountHealth("/x", lock("a".repeat(40)), lock("a".repeat(40)), run)).toBeUndefined();
    expect(calls).toEqual([]);
  });
});
