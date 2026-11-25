/**
 * `check:materialized-fixity` judges only the records the caller commits in a
 * layer's PR checks (owner ruling 2026-11-05, "Move the checks";
 * cat-harness-tools `lib/gate-own.ts`). smart-ra#228 went red on who-iris's
 * catalogue nodes, a mounted lower layer's records.
 *
 * @module scripts/tests/materialized-fixity-own-files.test
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { collect } from "../check-materialized-fixity.ts";

const REPO = resolve(import.meta.dir, "..", "..", "..");

describe("collect scopes to the files the caller owns", () => {
  const whole = collect(REPO, () => true);

  test("owningNothingReadsNothing", () => {
    expect(collect(REPO, () => false)).toEqual([]);
  });

  test("mountedLayerLeftOut", () => {
    const notIris = (rel: string) => !rel.startsWith("who-iris/");
    const scoped = collect(REPO, notIris);
    expect(scoped.every((r) => notIris(r.source))).toBe(true);
    expect(scoped.length).toBe(whole.filter((r) => notIris(r.source)).length);
  });
});
