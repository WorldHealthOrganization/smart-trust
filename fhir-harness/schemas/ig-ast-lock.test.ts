import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { astPinsIn, IG_AST_LOCK_FILE } from "./ig-ast-lock.ts";
import { checkAstLock, withPin } from "../scripts/ig-ast-pin.ts";

const SHA = "45be719be00fa3193700757e8bfd7d0761350aec";
const IG = "633b11fb2e628a9aa6086815e78edfe2d47d2095";
const pin = { instance: "ig", repository: "beta/ig", branch: "cat/fhir-harness/fhir-ast/beta.ig", sha: SHA, consent: { by: "owner", on: "2026-11-01", evidence: "card A" } };

function dir(files: Record<string, unknown>): string {
  const d = mkdtempSync(join(tmpdir(), "ig-ast-lock-"));
  for (const [f, v] of Object.entries(files)) writeFileSync(join(d, f), JSON.stringify(v));
  return d;
}

describe("ig-ast-lock/v1 (bean fwtz: the AST is pinned like a layer)", () => {
  test("noLockNoPinsInvalidLockThrows", () => {
    const none = dir({});
    const bad = dir({ [IG_AST_LOCK_FILE]: { $schema: "ig-ast-lock/v1", pins: [{ ...pin, sha: "45be719" }] } });
    try {
      expect(astPinsIn(none).size).toBe(0);
      expect(() => astPinsIn(bad)).toThrow();
    } finally {
      rmSync(none, { recursive: true, force: true });
      rmSync(bad, { recursive: true, force: true });
    }
  });

  test("pinMustNameMountedSameRepo", () => {
    const ok = dir({ [IG_AST_LOCK_FILE]: { $schema: "ig-ast-lock/v1", pins: [pin] }, "index.lock.json": { instances: [{ instance: "ig", repository: "beta/ig", sha: IG }] } });
    const elsewhere = dir({ [IG_AST_LOCK_FILE]: { $schema: "ig-ast-lock/v1", pins: [pin] }, "index.lock.json": { instances: [{ instance: "ig", repository: "fork/ig", sha: IG }] } });
    const unmounted = dir({ [IG_AST_LOCK_FILE]: { $schema: "ig-ast-lock/v1", pins: [pin] }, "index.lock.json": { instances: [] } });
    try {
      expect(checkAstLock(ok)).toEqual([]);
      expect(checkAstLock(elsewhere)[0]).toContain("mounted from fork/ig");
      expect(checkAstLock(unmounted)[0]).toContain("not mounted");
    } finally {
      for (const d of [ok, elsewhere, unmounted]) rmSync(d, { recursive: true, force: true });
    }
  });

  test("repinReplacesAndSorts", () => {
    const other = { ...pin, instance: "alpha" };
    const next = withPin([pin, other], { ...pin, sha: IG });
    expect(next.pins.map((p) => [p.instance, p.sha])).toEqual([["alpha", SHA], ["ig", IG]]);
  });
});
