/**
 * The upload-URL check of THIS repository's configuration, moved here from
 * `cat-harness/scripts/tests/upload-url.test.ts` (owner, 2026-10-06:
 * "Throwaway repository, plus moving the real-repo checks"). It asserts that
 * cat-harness, as configured in this checkout — its declared `uploads` queue,
 * that queue on disk, and the checkout's `origin` remote — resolves to an
 * upload URL. Standing alone, cat-harness has no `origin`, so the check can
 * only be answered here; the URL's SHAPE stays in that file, over a throwaway
 * repository. The path is composed from ORIGIN_DIR, the directory the test was
 * written in, so nothing it reads changed.
 */
import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";

import { uploadUrl } from "../../scripts/upload-url.js";

/** The directory this test was written in (`cat-harness/scripts/tests/`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const ROOT = resolve(ORIGIN_DIR, "../..");

describe("the URL", () => {
  test("resolves for this instance", () => {
    const t = uploadUrl(ROOT);
    expect(t.ok).toBe(true);
  });
});
