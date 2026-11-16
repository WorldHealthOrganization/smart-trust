/**
 * `index:render` is not applicable at a root that declares its own instance
 * (cat-harness-tools#1701): there the four entry files are the instance's own.
 * The platform index's root declares nothing and is rendered as before.
 *
 * @module scripts/tests/index-render-root-instance
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { rootDeclaredInstance } from "../index-render.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function root(files: Record<string, unknown>): string {
  const r = mkdtempSync(join(tmpdir(), "index-render-root-"));
  made.push(r);
  for (const [f, body] of Object.entries(files)) writeFileSync(join(r, f), JSON.stringify(body));
  return r;
}

describe("rootDeclaredInstance", () => {
  test("a content instance's root (declaration beside index.config.json) names itself", () => {
    const r = root({ "index.config.json": { instances: [] }, "smart-ips-pilgrimage.json": { name: "smart-ips-pilgrimage" } });
    expect(rootDeclaredInstance(r)).toBe("smart-ips-pilgrimage");
  });

  test("an index root that declares nothing is not excused", () => {
    const r = root({ "index.config.json": { instances: [] }, "index.lock.json": { mounts: [] }, "package.json": { name: "folio-assistant" } });
    expect(rootDeclaredInstance(r)).toBeUndefined();
  });
});
