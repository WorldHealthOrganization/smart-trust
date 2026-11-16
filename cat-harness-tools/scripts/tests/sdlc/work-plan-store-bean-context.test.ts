/**
 * The bean in the task's context (cat-harness#991 step 4b): an enabled step
 * carries its beans themselves — read through the work-plan store's `get` and
 * `positions` — not only their ids.
 *
 * @module scripts/tests/sdlc/work-plan-store-bean-context
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MountedGitBranchStore } from "../../../src/workflow/work-plan-store-git-mount.ts";
import { beansInContext, describeBeans, withBeans, type BeanInContext, type WorkPlanStore } from "../../../src/workflow/work-plan-store.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const AT = "2026-11-02T10:00:00Z";

function store(): { s: MountedGitBranchStore; repo: string } {
  const repo = mkdtempSync(join(tmpdir(), "wps-ctx-"));
  made.push(repo);
  mkdirSync(join(repo, "beans", "defs"), { recursive: true });
  mkdirSync(join(repo, "beans", "workflows"), { recursive: true });
  writeFileSync(
    join(repo, "beans", "beans.json"),
    JSON.stringify({
      name: "f",
      directories: [
        { id: "defs", path: "defs", graphTypologies: ["bean-defs"] },
        { id: "workflows", path: "workflows", graphTypologies: ["workflow-state"] },
      ],
    }),
  );
  const s = new MountedGitBranchStore(repo, { cli: false });
  s.create({ id: "fx-aaaa", title: "Do the work", status: "in-progress", type: "task", parent: undefined, tags: ["area:store"], body: "What and why.\n" });
  writeFileSync(
    join(repo, "beans", "workflows", "ccr--a.json"),
    JSON.stringify({
      $schema: "folio-workflow-instance/v1",
      id: "ccr--a",
      processId: "code-change-review",
      // declared-path-literal: a fixture instance's `source`, never read as a file
      source: "processes/code-change-review.bpmn",
      subject: "a",
      bean: "fx-aaaa",
      tokens: ["Task_Review"],
      arrivals: {},
      history: [{ at: AT, node: "Start" }],
      status: "running",
      startedAt: AT,
      updatedAt: AT,
    }),
  );
  return { s, repo };
}

describe("beansInContext", () => {
  test("a bean the store holds comes with its fields and where it is", () => {
    const { s } = store();
    const [b] = beansInContext(s, ["fx-aaaa"]);
    expect(b).toMatchObject({
      id: "fx-aaaa",
      found: true,
      title: "Do the work",
      status: "in-progress",
      tags: ["area:store"],
      body: "What and why.\n",
      positions: [{ process: "code-change-review", instance: "ccr--a", nodes: ["Task_Review"], status: "running" }],
    });
  });

  test("a bean the store does not hold is said to be missing, not dropped", () => {
    const { s } = store();
    expect(beansInContext(s, ["fx-gone"])).toEqual([{ id: "fx-gone", found: false }]);
  });

  test("instances that cannot be read make the position UNKNOWN, never empty", () => {
    const { s } = store();
    const broken: WorkPlanStore = {
      get: (id) => s.get(id),
      list: (f) => s.list(f),
      create: (b) => s.create(b),
      update: (id, c, v) => s.update(id, c, v),
      note: (id, t, by) => s.note(id, t, by),
      keep: (id, e) => s.keep(id, e),
      recall: (id) => s.recall(id),
      open: (r) => s.open(r),
      beansAt: (p, st) => s.beansAt(p, st),
      history: (id) => s.history(id),
      positions: () => {
        throw new Error("the workflows graph is not mounted");
      },
    };
    const [b] = beansInContext(broken, ["fx-aaaa"]);
    expect(b!.positions).toBeUndefined();
    expect(b!.positionsUnknown).toBe("the workflows graph is not mounted");
  });
});

describe("withBeans", () => {
  test("each enabled step's context carries its beans; a step with no context is left alone", () => {
    const { s } = store();
    const pos: { instance: string; enabled: Array<{ node: string; context?: { carriedBeans: string[]; beans?: BeanInContext[] } }> } = {
      instance: "ccr--a",
      enabled: [
        { node: "Task_Review", context: { carriedBeans: ["fx-aaaa", "fx-gone"] } },
        { node: "Gateway_X" },
      ],
    };
    const out = withBeans(pos, s);
    expect(out.enabled[0]!.context!.beans!.map((b) => [b.id, b.found])).toEqual([
      ["fx-aaaa", true],
      ["fx-gone", false],
    ]);
    expect(out.enabled[1]).toEqual({ node: "Gateway_X" });
    // The input is not mutated.
    expect(pos.enabled[0]!.context).toEqual({ carriedBeans: ["fx-aaaa", "fx-gone"] });
  });
});

describe("describeBeans", () => {
  test("one line per bean: title, status, and the running process it is at", () => {
    const { s } = store();
    const text = describeBeans(beansInContext(s, ["fx-aaaa", "fx-gone"]));
    expect(text).toContain("fx-aaaa — Do the work (in-progress); code-change-review at Task_Review");
    expect(text).toContain("fx-gone — not in the work plan");
  });

  test("nothing carried, nothing printed", () => {
    expect(describeBeans([])).toBe("");
  });
});
