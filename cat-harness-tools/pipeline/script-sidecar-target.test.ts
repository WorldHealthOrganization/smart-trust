/**
 * `scriptSidecarTarget`: a sweep run from a folio does not write script
 * sidecars into the folio's mounted copy of the platform (smart-ra,
 * 2026-10-30: the write blocked the next mount, and so the staging publish).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { scriptSidecarTarget } from "./qa-utils.ts";

describe("scriptSidecarTarget", () => {
  const at = mkdtempSync(join(tmpdir(), "sidecar-target-"));
  const checkout = join(at, "checkout");
  const mount = join(at, "mount");
  mkdirSync(join(checkout, ".git"), { recursive: true });
  mkdirSync(mount, { recursive: true });

  test("the platform's own checkout is written to", () => {
    expect(scriptSidecarTarget(undefined, checkout)).toBe(checkout);
  });
  test("a mounted copy (no .git) is not", () => {
    expect(scriptSidecarTarget(undefined, mount)).toBeNull();
  });
  test("an explicit --script-sidecar-root always wins", () => {
    expect(scriptSidecarTarget("/elsewhere", mount)).toBe("/elsewhere");
    rmSync(at, { recursive: true, force: true });
  });
});
