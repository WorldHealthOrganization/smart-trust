/**
 * `activity-log` tests that read the aggregate repository's own root — the
 * `.gitignore` and the root-declared `fsh-guts` trashcan — moved here from
 * `cat-harness/scripts/tests/activity-log.test.ts` (bean `ho66`), as
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
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";

import { LOG_DIR } from "../../schemas/sdlc/log-entry.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { fshGutsDirectory } from "../../schemas/kg/fsh-guts.js";

/**
 * The directory this test was written in (`cat-harness/scripts/tests/`): every path below
 * is composed from it exactly as it was before the move, so nothing it reads changed.
 */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const ROOT = resolve(ORIGIN_DIR, "../..");

describe("persistence is off by default in the repository too", () => {
  test("fsh-guts/logs/ is git-ignored", () => {
    const ignore = readFileSync(join(repoRootFor(ROOT), ".gitignore"), "utf8");
    // The ignore file cannot read a declaration, so it names LOG_DIR's spelling;
    // the test reads the same constant rather than repeating it (bean `gz47`).
    expect(ignore).toContain(`${LOG_DIR}/`);
  });

  test("the REST of the trashcan is still committed", () => {
    // Ignoring `fsh-guts/` wholesale would turn the never-delete rule from a
    // relocation into a disappearance, which is the opposite of its purpose.
    const ignore = readFileSync(join(repoRootFor(ROOT), ".gitignore"), "utf8");
    expect(ignore).not.toMatch(/^fsh-guts\/\s*$/m);
    // WITNESS CHANGED 2026-09-23, not the property. This named
    // `fsh-guts/proposals` until the owner moved the proposals to the `docs/`
    // of the stub that needs them — *"proposals not in fsh-guts but docs/ for
    // needed <stub>"*. The claim being tested is that the trashcan is still
    // COMMITTED rather than ignored wholesale; `retired/` witnesses it just as
    // well and is the population that is actually retired material, which
    // `proposals/` never was.
    expect(existsSync(join(fshGutsDirectory(repoRootFor(ROOT)), "retired"))).toBe(true);
  });
});

describe("logs never reach a published graph", () => {

  test("LOG_DIR really is inside the stripped tree, so the guarantee is structural", () => {
    // If someone moves logs out of fsh-guts, the assertion above keeps
    // passing (nothing would mention the old path) while the guarantee is
    // gone. This is what catches that.
    // Inside the DECLARED trashcan, not merely spelled with its name (bean `gz47`).
    const repo = repoRootFor(ROOT);
    expect(resolve(repo, LOG_DIR).startsWith(fshGutsDirectory(repo) + sep)).toBe(true);
  });
});
