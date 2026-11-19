/**
 * `landingMountedNotOwned` (cat-harness-tools#1701): `landing:data:check` is
 * not applicable when the landing is a lock-mounted layer of a content
 * instance's root, and is judged as before everywhere else.
 *
 * @module scripts/tests/mounted-landing
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { landingMountedNotOwned } from "../lib/mounted-landing.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function checkout(rootName: string | undefined, lock: unknown): string {
  const r = mkdtempSync(join(tmpdir(), "mounted-landing-"));
  made.push(r);
  if (rootName !== undefined) writeFileSync(join(r, `${rootName}.json`), JSON.stringify({ name: rootName }));
  if (lock !== undefined) writeFileSync(join(r, "index.lock.json"), typeof lock === "string" ? lock : JSON.stringify(lock));
  return r;
}
const lock = { instances: [{ instance: "smart-base", path: "smart-base" }] };

describe("landingMountedNotOwned", () => {
  test("a content root whose landing is a mounted layer: not applicable", () => {
    expect(landingMountedNotOwned(checkout("smart-ips-pilgrimage", lock), "smart-base")).toContain("smart-base");
  });

  test("the platform index (root declares nothing) is still checked", () => {
    expect(landingMountedNotOwned(checkout(undefined, lock), "smart-base")).toBeUndefined();
  });

  test("a root whose landing is itself is still checked", () => {
    expect(landingMountedNotOwned(checkout("smart-base", lock), "smart-base")).toBeUndefined();
  });

  test("a landing the lock does not mount, or an unreadable lock, is still checked", () => {
    expect(landingMountedNotOwned(checkout("folio", lock), "who-iris")).toBeUndefined();
    expect(landingMountedNotOwned(checkout("folio", "{ bad"), "smart-base")).toBeUndefined();
    expect(landingMountedNotOwned(checkout("folio", lock), undefined)).toBeUndefined();
  });
});
