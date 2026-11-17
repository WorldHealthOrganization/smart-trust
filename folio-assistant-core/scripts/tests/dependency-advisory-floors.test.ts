/**
 * The lockfile resolves past the advisories of bean folio-core-0b88:
 * undici (pulled by jsonld > @digitalbazaar/http-client, held by `overrides`)
 * at 6.29.1+, minimatch at 11.0.1+, and zod at 4.6.6+.
 * Checked by value from bun.lock, so a regenerated lockfile that drops back
 * below any floor fails here.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lock = readFileSync(join(import.meta.dir, "..", "..", "bun.lock"), "utf-8");

function resolved(name: string): string[] {
  const re = new RegExp(`"${name.replace(/[/@.]/g, "\\$&")}@(\\d+\\.\\d+\\.\\d+[^"]*)"`, "g");
  return [...new Set([...lock.matchAll(re)].map((m) => m[1]!))];
}

describe("dependency advisory floors (bean folio-core-0b88)", () => {
  for (const [name, floor] of [
    ["undici", "6.29.1"],
    ["minimatch", "11.0.1"],
    ["zod", "4.6.6"],
  ] as const) {
    test(`resolvedAtOrAboveFloor[${name}]`, () => {
      const versions = resolved(name);
      expect(versions.length).toBeGreaterThan(0);
      expect(versions.filter((v) => Bun.semver.order(v, floor) < 0)).toEqual([]);
    });
  }
});
