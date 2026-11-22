/**
 * `qrlc` — the live-vs-latent probe.
 *
 * The corpus-level cases live with the conversions
 * (`git-corpus-conversions.test.ts`). These are about the probe's own
 * honesty: the three ways it could manufacture a clearance, and the
 * derivation that keeps it from needing a roster.
 *
 * Its end-to-end falsifier is not here because it needs a second checkout:
 * run against `a0f7719032e~1`, the probe must call `kg:detangle` **LIVE** and
 * name `schemas.detangle.json` first — the artefact `biz4` measured going 233
 * to 1443 — while on the fixed code it must call it latent. Both were measured
 * 2026-09-27 and both held. Recorded here so the next reader knows the
 * falsifier exists and how to re-run it, rather than inferring it from a
 * passing unit suite.
 *
 * Its vacuity control over the real script table — "it derives a non-trivial
 * set from THIS repository" — lives in `test/detect-live-corpus-checkout.test.ts`
 * (bean `ho66`): the writer it pins, `auto:docs`, is declared by
 * cat-harness-tools, which a standalone cat-harness does not hold.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { derivedWriters, differingPaths } from "../detect-live-corpus.ts";

describe("differingPaths — what makes a run LIVE", () => {
  const m = (o: Record<string, string>): Map<string, string> => new Map(Object.entries(o));

  test("identical change-sets are latent", () => {
    expect(differingPaths(m({ "a.json": "1" }), m({ "a.json": "1" }))).toEqual([]);
  });

  test("the same path with different CONTENT is live", () => {
    // The case that matters: a writer that always rewrites its artefact looks
    // identical by path and differs by bytes.
    expect(differingPaths(m({ "a.json": "1" }), m({ "a.json": "2" }))).toEqual(["a.json"]);
  });

  test("a path only the planted run touched is live", () => {
    expect(differingPaths(m({}), m({ "b.json": "x" }))).toEqual(["b.json"]);
  });

  test("and so is a path only the CLEAN run touched — both directions", () => {
    // Asymmetry would be a silent half-blindness: a writer that stops
    // producing an artefact when ignored content appears is just as live as
    // one that starts.
    expect(differingPaths(m({ "c.json": "x" }), m({}))).toEqual(["c.json"]);
  });
});

describe("derivedWriters — no roster", () => {
  test("a script counts as a writer exactly when its `:check` sibling exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "writers-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        scripts: {
          "auto:docs": "x",
          "auto:docs:check": "x",
          "lonely:check": "x", // a check with no writer
          solo: "x", // a writer with no check
        },
      }),
    );
    expect(derivedWriters(dir)).toEqual(["auto:docs"]);
    rmSync(dir, { recursive: true, force: true });
  });
});
