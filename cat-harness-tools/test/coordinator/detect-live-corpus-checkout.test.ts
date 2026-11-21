/**
 * `detect-live-corpus` held against the WHOLE CHECKOUT's script table, moved
 * here from `cat-harness/scripts/tests/detect-live-corpus.test.ts` (bean
 * `ho66`, owner ruling 2026-10-06 "Top-level instance"): `derivedWriters`
 * reads every layer's `checkoutScripts`, and the writer this pins,
 * `auto:docs`, is declared by cat-harness-tools — so standing alone,
 * cat-harness cannot answer it. The probe's own fixture tests stay there; the
 * path below is composed from ORIGIN_DIR, the directory it was written in, so
 * nothing it reads changed.
 */
import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";

import { derivedWriters } from "../../scripts/detect-live-corpus.ts";

/** The directory this test was written in (`cat-harness/scripts/tests/`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

describe("derivedWriters — no roster", () => {
  test("it derives a non-trivial set from THIS repository", () => {
    // The vacuity control. A probe over zero writers reports "0 live" and has
    // measured nothing — the shape every check here is required to rule out.
    const writers = derivedWriters(resolve(ORIGIN_DIR, "../../.."));
    expect(writers.length).toBeGreaterThan(20);
    // And it finds itself, which is the point of deriving rather than listing:
    // the probe's own subject list grows when somebody adds a writer.
    expect(writers).toContain("auto:docs");
  });
});
