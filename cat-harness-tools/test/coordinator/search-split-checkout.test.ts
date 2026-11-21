/**
 * `search-split` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/search-split.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each reads the layers the checkout's
 * site mounts, which only the checkout holds. Standing alone, cat-harness has
 * none of it, and `check:cat-harness-standalone` collects every test in that
 * layer. The rest of that file's tests stay there; every path here is composed
 * from ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { expect, test } from "bun:test";
import { join, resolve } from "node:path";

import { declaredInstanceNames } from "../../scripts/search-split.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

test("this checkout's declared instances include the ones the site mounts", () => {
  const names = declaredInstanceNames(resolve(ORIGIN_DIR, "..", "..", ".."));
  for (const n of ["smart-trust", "smart-base", "bootstrap"]) expect(names.has(n)).toBe(true);
});
