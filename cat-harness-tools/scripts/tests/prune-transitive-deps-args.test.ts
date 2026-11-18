import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Argv contract for `prune-transitive-deps.ts --paper <name>`.
 *
 * `--paper` takes the token after it. Before this guard that token was taken
 * unconditionally, so `--paper --apply` handed `requirePaper` the string
 * `"--apply"` — which it returns unchanged, an explicit name being trusted by
 * design — and the run failed much later looking for a paper directory called
 * `--apply`. Reported by the PR review bot on #151; the flag was added in the
 * same PR, so the hazard shipped with it.
 *
 * Run from an empty temp directory, above no content repo, so the results do
 * not depend on whether this checkout happens to sit beside a folio. That is
 * also what the third test pins: the usage error must be raised BEFORE repo
 * discovery, or a real usage mistake gets reported as "no content repo found".
 */

const SCRIPT = resolve(import.meta.dir, "../../pipeline/prune-transitive-deps.ts");
let cwd: string;

const run = (args: string[]): { code: number; out: string } => {
  const r = Bun.spawnSync(["bun", "run", SCRIPT, ...args], { cwd });
  const dec = new TextDecoder();
  return { code: r.exitCode, out: dec.decode(r.stdout) + dec.decode(r.stderr) };
};

beforeAll(() => {
  cwd = mkdtempSync(join(tmpdir(), "prune-args-"));
});
afterAll(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe("--paper argument validation", () => {
  test("a following flag is refused, not taken as the paper name", () => {
    const r = run(["--paper", "--apply"]);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("--paper needs a value");
    expect(r.out).toContain("another flag");
    // The specific regression: `--apply` must not reach `requirePaper`.
    expect(r.out).not.toContain("papers found");
  });

  test("a trailing --paper with nothing after it is refused", () => {
    const r = run(["--paper"]);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("--paper needs a value");
    expect(r.out).toContain("Nothing followed it");
  });

  // The control. Without it, both tests above would still pass if the script
  // failed for some unrelated reason on every invocation — which, run above no
  // content repo, is exactly what it does. A well-formed `--paper` must get
  // PAST argument parsing and fail somewhere else.
  test("a well-formed --paper is not caught by the guard", () => {
    const r = run(["--paper", "quantum-observable-universe"]);
    expect(r.code).not.toBe(0); // no content repo here — a different failure
    expect(r.out).not.toContain("needs a value");
  });
});
