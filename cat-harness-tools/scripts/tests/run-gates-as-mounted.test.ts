/**
 * cat-harness-tools#1701: the mount gates are judged on the tree AS MOUNTED.
 *
 * In smart-ips-pilgrimage's main run (42455839636) mount:remote:check,
 * mount:lock:check and separation:cutover:check ran in the shards over the
 * prepared tree, after derive:publish had written into the mounted layers, so
 * 8 of 9 mounts read "modified". The prepare job now runs them first
 * (`run-gates.py --as-mounted`), and the shards take that record
 * (`--as-mounted-record`) instead of running them again.
 *
 * The fixture root's `cat` script is `echo`, so every gate "runs" and passes
 * at once: a recorded exit that survives into the report can only have come
 * from the record.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { RUN_GATES } from "../lib/root-gate-set.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function write(root: string, rel: string, body: unknown): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "run-gates-as-mounted-"));
  made.push(root);
  write(root, "doc.json", { $schema: "cat-harness-declaration/v1", name: "doc", needs: ["tools"] });
  write(root, "package.json", { name: "doc", scripts: { cat: "echo" } });
  write(root, "tools/tools.json", { $schema: "cat-harness-declaration/v1", name: "tools" });
  write(root, "tools/package.json", {
    name: "tools",
    scripts: { "mount:lock:check": "x", "mount:remote:check": "x", "separation:cutover:check": "x", "check:other": "x" },
  });
  return root;
}

function runGates(root: string, ...args: string[]) {
  const env: Record<string, string | undefined> = { ...process.env, GATE_JOBS: "8", GATE_CONE: "" };
  delete env.GATE_SHARD;
  delete env.GATE_TIMINGS;
  return spawnSync("python3", ["-B", RUN_GATES, root, ...args], { encoding: "utf-8", env, timeout: 120_000 });
}

describe("run-gates.py --as-mounted", () => {
  test("runs only the mount gates and records them in the --record shape", () => {
    const root = fixture();
    const out = join(root, "as-mounted.json");
    const r = runGates(root, "--as-mounted", out);
    expect(r.status).toBe(0);
    const got = JSON.parse(readFileSync(out, "utf-8")) as Record<string, { exit: number; command: string }>;
    expect(Object.keys(got).sort()).toEqual(["tools:mount:lock:check", "tools:mount:remote:check", "tools:separation:cutover:check"]);
    expect(got["tools:mount:lock:check"]!.exit).toBe(0);
  });

  test("a shard takes the recorded answer in place of running the gate over the built-on tree", () => {
    const root = fixture();
    const rec = join(root, "rec.json");
    write(root, "rec.json", { "tools:mount:lock:check": { command: "bun run cat mount:lock:check", exit: 1, tail: "as mounted: MISSING" } });
    const out = join(root, "gates.json");
    const r = runGates(root, out, "--as-mounted-record", rec);
    expect(r.status).toBe(0);
    const got = JSON.parse(readFileSync(out, "utf-8")) as Record<string, { exit?: number; tail?: string }>;
    expect(got["tools:mount:lock:check"]).toMatchObject({ exit: 1, tail: "as mounted: MISSING" });
    // the others still run here
    expect(got["tools:check:other"]?.exit).toBe(0);
    expect(got["tools:mount:remote:check"]?.exit).toBe(0);
  });

  test("with no record the mount gates run in the shard as before", () => {
    const root = fixture();
    const out = join(root, "gates.json");
    const r = runGates(root, out, "--as-mounted-record", join(root, "absent.json"));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("missing or unreadable");
    const got = JSON.parse(readFileSync(out, "utf-8")) as Record<string, { exit?: number }>;
    expect(got["tools:mount:lock:check"]?.exit).toBe(0);
  });
});
