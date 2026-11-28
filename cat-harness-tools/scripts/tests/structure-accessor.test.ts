/**
 * The structure-accessor gate (bean rkqp, owner 2026-09-30): it must FAIL on
 * the thing it exists for, not only pass on today's tree.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { ALLOWED, declaredAllowed, GATE, scan } from "../check-structure-accessor.ts";

const REPO = resolve(import.meta.dir, "..", "..", "..");

describe("what the gate matches", () => {
  const files: Record<string, string> = {
    "a.ts": 'const p = join(dir, "structure.json");',
    "b.ts": "const p = join(dir, 'structure.json');",
    "c.ts": " * reads `structure.json` through the accessor",
    "d.ts": "// the old path was structure.json",
    "e.ts": "throw new Error(`${dir}: no structure.json — this is not a staged entry`);",
    "f.ts": "const p = join(dir, STRUCTURE_FILENAME);",
  };
  const hits = scan(Object.keys(files), (f) => files[f]!);

  test("a path built from the quoted token is caught, in either quote style", () => {
    expect(hits.has("a.ts")).toBe(true);
    expect(hits.has("b.ts")).toBe(true);
  });

  test("prose is not: doc comments, line comments and the name inside a message", () => {
    for (const f of ["c.ts", "d.ts", "e.ts"]) expect(hits.has(f)).toBe(false);
  });

  test("the constant is the way through", () => {
    expect(hits.has("f.ts")).toBe(false);
  });
});

describe("the real corpus", () => {
  test("passes, and every allowlist entry still earns its place", () => {
    const r = spawnSync("bun", ["run", "cat-harness-tools/scripts/check-structure-accessor.ts"], { cwd: REPO, encoding: "utf-8" });
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
  });

  test("every allowlist entry carries a reason, the declared ones included", () => {
    for (const [f, why] of Object.entries({ ...ALLOWED, ...declaredAllowed(REPO) })) expect(why.length > 20 ? "" : f).toBe("");
  });

  test("this layer's own list names no file of an instance above it", () => {
    // Item 6b (owner, 2026-10-16): a layer above declares its own entries.
    // Its own files and cat-harness's, below it; the accessor moved here in 8lcl.
    for (const f of Object.keys(ALLOWED)) expect(/^cat-harness(-tools)?\//.test(f) ? "" : f).toBe("");
  });
});

describe("entries an instance declares for its own files", () => {
  const made: string[] = [];
  const corpus = (gateExemptions: unknown): string => {
    const root = mkdtempSync(join(tmpdir(), "structure-accessor-"));
    made.push(root);
    mkdirSync(join(root, "up"), { recursive: true });
    writeFileSync(join(root, "up", "up.json"), JSON.stringify({ name: "up", version: "0.1.0", needs: [], gateExemptions }));
    return root;
  };

  test("are read repo-relative, with their reason, for this gate only", () => {
    const root = corpus({
      files: [
        { gate: GATE, file: "schemas/x.ts", reason: "existence only" },
        { gate: "check:something-else", file: "schemas/y.ts", reason: "another gate's entry" },
      ],
    });
    expect(declaredAllowed(root)).toEqual({ "up/schemas/x.ts": "existence only" });
    for (const r of made) rmSync(r, { recursive: true, force: true });
  });

  test("an instance declaring none contributes none", () => {
    expect(declaredAllowed(corpus({ scripts: [] }))).toEqual({});
    for (const r of made) rmSync(r, { recursive: true, force: true });
  });
});
