/**
 * `probes` tests that read the aggregate repository's own root — the
 * root-declared `beans/` store — moved here from
 * `cat-harness/test/health/probes.test.ts` (bean `ho66`), as
 * `merge-guard-workflows.test.ts` was: a standalone cat-harness layer has no
 * such root, and `check:cat-harness-standalone` collects every test in that
 * layer. The rest of that file's tests stay there.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { rmSync } from "node:fs";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "bun:test";

import { countConsideredOptions, probeBeans } from "../health/probes.ts";

/**
 * The directory this test was written in (`cat-harness/test/health/`): every path below
 * is composed from it exactly as it was before the move, so nothing it reads changed.
 */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/test/health");

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

describe("the root the sweep is given", () => {
  it("is the REPOSITORY root, not the instance root", async () => {
    // The probes above resolve their store from a declaration, and do it
    // correctly. That was not enough: `run.ts` handed them the LAYER root,
    // so from the moment `#437` moved the layer under `cat-harness/` both
    // stores resolved to `cat-harness/beans/defs` and
    // `cat-harness/todos/items`, neither of which exists.
    //
    // The three-state rule did its job — the sweep reported "could not be
    // evaluated" and refused to call itself clean rather than reporting an
    // empty store as healthy, which is the `dh4f` shape it exists to avoid.
    // But a check that cannot see its subject is not doing the work either,
    // and this one hid 215 inline completed beans and 449 MB of staging
    // previews until it was repointed.
    //
    // Asserted against the real tree rather than a fixture: the defect was
    // that a real path stopped existing, and a fixture would have passed
    // throughout.
    const { existsSync } = await import("node:fs");
    const { join, resolve } = await import("node:path");
    const { repoRootFor } = await import("../../schemas/kg/cat-harness.ts");

    const instanceRoot = resolve(ORIGIN_DIR, "..", "..");
    const repoRoot = repoRootFor(instanceRoot);

    expect(existsSync(join(repoRoot, "beans", "beans.json"))).toBe(true);
    expect(existsSync(join(instanceRoot, "beans", "beans.json"))).toBe(false);

    // And the probes actually find something when given the right one.
    const beans = probeBeans(repoRoot);
    expect(beans.state).toBe("ok");
  });
});

describe("countConsideredOptions — the parse the MADR criterion rests on", () => {

  it("the real store has SUBJECTS — a detector with none is not a detector that passed", async () => {
    // Asserted against the real bean store rather than a fixture, for the same
    // reason the staging test above is: the failure mode is the detector matching
    // nothing in practice, and every fixture in this file would pass throughout.
    const { repoRootFor } = await import("../../schemas/kg/cat-harness.ts");
    const { resolve } = await import("node:path");
    const p = probeBeans(repoRootFor(resolve(ORIGIN_DIR, "..", "..")));
    expect(p.state).toBe("ok");
    if (p.state !== "ok") return;
    // The subjects are mostly settled decisions, and a drain archives those:
    // the 2026-11-01 sweep left no open bean with considered options
    // (cat-harness-tools#1248). So the detector is run over the archive view
    // too, which archiving fills rather than empties.
    const { readFileSync, readdirSync } = await import("node:fs");
    const { resolveBeanArchive } = await import("../../scripts/beans.ts");
    const archive = resolveBeanArchive(repoRootFor(resolve(ORIGIN_DIR, "..", ".."))).dir;
    const archived = archive === null
      ? 0
      : readdirSync(archive)
          .filter((f) => f.endsWith(".md"))
          .filter((f) => countConsideredOptions(readFileSync(join(archive, f), "utf-8")) !== undefined).length;
    const records = p.value.filter((b) => b.consideredOptions !== undefined);
    expect(records.length + archived).toBeGreaterThan(0);
  });
});
