/**
 * `healthResultPath` — the health report goes where the graph IS.
 *
 * Bean `9ofm` row D. Against real git and a real mount marker: the question
 * "what does this checkout know" is answered by git and the marker, and a stub
 * of either would assert the stub.
 *
 * @module scripts/tests/health-result-path
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MOUNT_MARKER_SCHEMA, markerPath } from "../branch-store.ts";
import { HEALTH_REPORT_FILENAME } from "../../schemas/sdlc/health-report.ts";
import { healthResultPath } from "../../test/health/run.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const TIP = { branch: "cat/cat-harness/health", keyedBy: "tip" } as const;

function git(root: string, ...args: string[]): void {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf-8" });
  expect(`${args.join(" ")} -> ${r.status}`).toBe(`${args.join(" ")} -> 0`);
}

/** A git repository declaring exactly `dirs`. */
function repo(dirs: Array<Record<string, unknown>>): string {
  const root = mkdtempSync(join(tmpdir(), "health-path-"));
  made.push(root);
  writeFileSync(join(root, "fixture.json"), JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "fixture", directories: dirs }, null, 2));
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.email", "t@t");
  git(root, "config", "user.name", "t");
  return root;
}

function mount(root: string, id: string, into: string): void {
  mkdirSync(into, { recursive: true });
  const p = markerPath(root, id);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify({ $schema: MOUNT_MARKER_SCHEMA, id, branch: TIP.branch, path: "test/health/results", into, tip: "0".repeat(40), files: {} }));
}

const HEALTH = { id: "health", path: "test/health/results/", graphTypologies: ["health"] };

describe("healthResultPath", () => {
  test("not moved: the declared directory in the checkout", () => {
    const root = repo([HEALTH]);
    mkdirSync(join(root, "test", "health", "results"), { recursive: true });
    expect(healthResultPath(root)).toBe(join(root, "test", "health", "results", HEALTH_REPORT_FILENAME));
  });

  test("mounted: the report follows the graph", () => {
    const root = repo([{ ...HEALTH, storage: TIP }]);
    const into = join(root, "health-mount");
    mount(root, "health", into);
    expect(healthResultPath(root)).toBe(join(into, HEALTH_REPORT_FILENAME));
  });

  test("unreachable: THROWS rather than naming a directory mkdirSync would happily create", () => {
    // The failure this prevents: `healthReportPath` names a path that is not
    // in the checkout, `mkdirSync` creates it, and the run writes a report
    // nothing will ever read — while printing `wrote …`.
    const root = repo([{ ...HEALTH, storage: TIP }]);
    expect(() => healthResultPath(root)).toThrow(/cannot write the health report.*state:mount/s);
  });

  test("nothing declared: the conventional layout, unchanged — an unmigrated instance is fine, not wrong", () => {
    const root = repo([]);
    expect(healthResultPath(root)).toBe(join(root, "test", "health", "results", HEALTH_REPORT_FILENAME));
  });
});
