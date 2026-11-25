/**
 * `GET /api/work-plan/beans-processed`: the local store's rows for the
 * all-beans page's 5-second refresh (cat-harness#991 §4.9). Local only, read
 * only, and "could not read" is never an empty answer.
 *
 * @module scripts/tests/sdlc/work-plan-route
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BEANS_PROCESSED_PATH, handleWorkPlanGet } from "../../../src/routes/work-plan.ts";
import { MountedGitBranchStore } from "../../../src/workflow/work-plan-store-git-mount.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function repo(): string {
  const r = mkdtempSync(join(tmpdir(), "wp-route-"));
  made.push(r);
  mkdirSync(join(r, "beans", "defs"), { recursive: true });
  mkdirSync(join(r, "beans", "workflows"), { recursive: true });
  writeFileSync(
    join(r, "beans", "beans.json"),
    JSON.stringify({ name: "f", directories: [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"] }, { id: "workflows", path: "workflows", graphTypologies: ["workflow-state"] }] }),
  );
  const s = new MountedGitBranchStore(r, { cli: false });
  s.create({ id: "fx-aaaa", title: "In a process", status: "in-progress", type: "task", body: "x\n" });
  s.create({ id: "fx-bbbb", title: "In none", status: "todo", type: "task", body: "y\n" });
  writeFileSync(
    join(r, "beans", "workflows", "ccr--a.json"),
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
      history: [],
      status: "running",
      startedAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z",
    }),
  );
  return r;
}

const at = (host: string) => new URL(`http://${host}${BEANS_PROCESSED_PATH}`);

describe("/api/work-plan/beans-processed", () => {
  test("another path is not this route's", () => {
    expect(handleWorkPlanGet(new URL("http://localhost/api/other"), repo(), {})).toBeNull();
  });

  test("a request addressed to anything but localhost is refused: the work plan is not served to a network", async () => {
    const res = handleWorkPlanGet(at("192.168.1.5:8080"), repo(), {})!;
    expect(res.status).toBe(403);
  });

  test("on localhost it answers the rows, the beans in no process, and which store Tool it read", async () => {
    const res = handleWorkPlanGet(at("localhost:8080"), repo(), {})!;
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const j = (await res.json()) as { tool: string; rows: Array<{ instance: string; tokens: string[] }>; unplaced: Array<{ id: string }> };
    expect(j.tool).toBe("beans-git-branch");
    expect(j.rows.map((r) => [r.instance, r.tokens])).toEqual([["ccr--a", ["Task_Review"]]]);
    expect(j.unplaced.map((b) => b.id)).toEqual(["fx-bbbb"]);
  });

  test("a localhost origin may read it cross-origin; any other origin gets no CORS header", async () => {
    const r = repo();
    const local = handleWorkPlanGet(at("localhost:8080"), r, {}, new Request("http://localhost:8080/", { headers: { origin: "http://localhost:4000" } }))!;
    expect(local.headers.get("access-control-allow-origin")).toBe("http://localhost:4000");
    const site = handleWorkPlanGet(at("localhost:8080"), r, {}, new Request("http://localhost:8080/", { headers: { origin: "https://litlfred.github.io" } }))!;
    expect(site.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("a store that cannot be chosen is 503 with the reason, never an empty plan", async () => {
    const res = handleWorkPlanGet(at("127.0.0.1:8080"), repo(), { CAT_DEPLOYMENT: "nowhere" })!;
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toContain("CAT_DEPLOYMENT=nowhere");
  });
});
