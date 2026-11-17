import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync, utimesSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  saveQaScriptSidecar,
  loadQaScriptSidecar,
  scriptSidecarPath,
} from "../../pipeline/qa-utils";
import type { QaScriptSidecar } from "../../schemas/sdlc/block-qa.ts";

/**
 * Script sidecars live in the PLATFORM repo and describe the platform's own
 * checker sources. But a sweep is driven from a CONTENT repo, and two things
 * leaked across that boundary:
 *
 *  1. `last_run_sha` was the content repo's HEAD (`gitHeadSha()` with no
 *     `-C` reads `process.cwd()`), so the platform recorded a foreign
 *     commit as its own "HEAD at last run".
 *  2. `last_run_at` is a fresh timestamp every run and the write was
 *     unconditional, so one sweep from qou left 76 modified files here —
 *     churn indistinguishable in `git status` from a real hash movement.
 */

let root: string;

const base = (): QaScriptSidecar => ({
  $schema: "qa-script/v1",
  criterion_id: "test-criterion",
  source_file: "pipeline/qa-checkers-test.ts",
  script_hash: "aaaaaaaaaaaa",
  script_commit_sha: "1111111111111111111111111111111111111111",
  deps_hash: "bbbbbbbbbbbb",
  last_run_at: "2026-01-01T00:00:00.000Z",
  last_run_sha: "2222222222222222222222222222222222222222",
  engine_version: "bun-1.3.11",
});

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "folio-scriptsidecar-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("saveQaScriptSidecar", () => {
  test("writes a sidecar that did not exist", () => {
    saveQaScriptSidecar(base(), root);
    const p = scriptSidecarPath("test-criterion", root);
    expect(existsSync(p)).toBe(true);
    expect(loadQaScriptSidecar("test-criterion", root)?.script_hash).toBe("aaaaaaaaaaaa");
  });

  test("does NOT rewrite when only last_run_at / last_run_sha differ", () => {
    saveQaScriptSidecar(base(), root);
    const p = scriptSidecarPath("test-criterion", root);
    const before = readFileSync(p, "utf-8");
    // Backdate so a rewrite is detectable by mtime as well as content.
    const old = new Date(Date.now() - 60_000);
    utimesSync(p, old, old);
    const mtimeBefore = statSync(p).mtimeMs;

    saveQaScriptSidecar(
      { ...base(), last_run_at: "2026-08-07T15:00:00.000Z", last_run_sha: "deadbeef" },
      root,
    );

    // This is the churn guard: byte-identical AND untouched on disk.
    expect(readFileSync(p, "utf-8")).toBe(before);
    expect(statSync(p).mtimeMs).toBe(mtimeBefore);
  });

  test("DOES rewrite when the script hash moves", () => {
    saveQaScriptSidecar(base(), root);
    saveQaScriptSidecar({ ...base(), script_hash: "cccccccccccc" }, root);
    expect(loadQaScriptSidecar("test-criterion", root)?.script_hash).toBe("cccccccccccc");
  });

  test("DOES rewrite when deps_hash moves", () => {
    saveQaScriptSidecar(base(), root);
    saveQaScriptSidecar({ ...base(), deps_hash: "dddddddddddd" }, root);
    expect(loadQaScriptSidecar("test-criterion", root)?.deps_hash).toBe("dddddddddddd");
  });

  test("DOES rewrite when script_commit_sha moves", () => {
    saveQaScriptSidecar(base(), root);
    const sha = "3333333333333333333333333333333333333333";
    saveQaScriptSidecar({ ...base(), script_commit_sha: sha }, root);
    expect(loadQaScriptSidecar("test-criterion", root)?.script_commit_sha).toBe(sha);
  });

  test("DOES rewrite when extra_inputs change", () => {
    saveQaScriptSidecar(base(), root);
    saveQaScriptSidecar({ ...base(), extra_inputs: ["folio/schema/refs.ts"] }, root);
    expect(loadQaScriptSidecar("test-criterion", root)?.extra_inputs).toEqual([
      "folio/schema/refs.ts",
    ]);
  });

  test("does NOT rewrite when only the engine version differs (bean 3ozg)", () => {
    // This asserted the opposite until 2026-09-27. A different bun is a
    // different RUN, not a different checker, and treating it as a change
    // meant every sweep from a machine whose bun differed from CI's rewrote
    // all 72 committed sidecars. That included the one `bun test` performs,
    // which kept `bun run cat gates` reporting "NOT clean" everywhere.
    saveQaScriptSidecar(base(), root);
    const p = scriptSidecarPath("test-criterion", root);
    const before = readFileSync(p, "utf-8");
    const old = new Date(Date.now() - 60_000);
    utimesSync(p, old, old);
    const mtimeBefore = statSync(p).mtimeMs;

    saveQaScriptSidecar(
      { ...base(), engine_version: "bun-9.9.9", last_run_at: "2026-09-27T05:00:00.000Z", last_run_sha: "deadbeef" },
      root,
    );

    expect(readFileSync(p, "utf-8")).toBe(before);
    expect(statSync(p).mtimeMs).toBe(mtimeBefore);
  });

  test("a CONTENT change still records the engine it ran under", () => {
    // The engine is not a reason to write, but when a real change does write,
    // the new sidecar carries the engine of that run, not a stale one.
    saveQaScriptSidecar(base(), root);
    saveQaScriptSidecar({ ...base(), script_hash: "cccccccccccc", engine_version: "bun-9.9.9" }, root);
    const got = loadQaScriptSidecar("test-criterion", root);
    expect(got?.script_hash).toBe("cccccccccccc");
    expect(got?.engine_version).toBe("bun-9.9.9");
  });

  test("treats absent and empty extra_inputs as the same", () => {
    saveQaScriptSidecar(base(), root);
    const p = scriptSidecarPath("test-criterion", root);
    const before = readFileSync(p, "utf-8");
    saveQaScriptSidecar({ ...base(), extra_inputs: [] }, root);
    expect(readFileSync(p, "utf-8")).toBe(before);
  });
});
