/**
 * `site-dir-single-answer` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/ui/site-dir-single-answer.test.ts` (bean `7zz1`,
 * owner ruling 2026-10-06 "Top-level instance"): each reads the aggregate
 * root's `.gitignore`, which only the checkout holds. Standing alone,
 * cat-harness has none of it, and `check:cat-harness-standalone` collects
 * every test in that layer. The rest of that file's tests stay there; every
 * path here is composed from ORIGIN_DIR, the directory they were written in,
 * so nothing they read changed.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { siteDirFor } from "../../schemas/kg/cat-harness.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const ROOT = resolve(ORIGIN_DIR, "../..");

describe("the site root is one answer, not a literal", () => {

  /**
   * The guard above scans `.ts`/`.mjs`. `.gitignore` is neither, and it names
   * the site root **five times** — which is how the inversion broke it in both
   * directions at once, five hours after the repo last paid for exactly this.
   *
   * Measured 2026-09-19 on `daf19326c`, after `docs-site.yml` had already been
   * pointed at `./folio-assistant/docs`:
   *
   * - `!docs/assets/js/` no longer reached the moved tree, so the blanket
   *   `*.js` rule swallowed it. A NEW file under `<stub>/docs/assets/js/`
   *   would have been invisible to `git add` — the file's own comment records
   *   that happening before, verbatim: *"`git add` reported nothing and the
   *   file would simply never have deployed."*
   * - `docs/.bundle/` and `docs/vendor/` no longer reached it either, so the
   *   bundler's gem tree was unignored again. The same comment prices that at
   *   **3,080 files and 53 MB** that any `git add -A` would sweep into a
   *   commit.
   *
   * Neither was visible, and the reason is worth more than the fix: a working
   * tree that predates the move still HAS a `docs/`, holding build residue, so
   * the stale rules went on matching something. **A rule matching the wrong
   * thing reads exactly like a rule matching the right thing.**
   *
   * So this asserts the direction that actually matters — what git does to a
   * path — rather than the spelling. A rename of the stub flips these before
   * anyone can ship it, which is the point: `folio-assistant/` → `cat-harness/`
   * is the next move, and it walks straight back into this.
   */
  test("`.gitignore` follows the site root, in both directions", () => {
    // REPO-relative, composed and said so: `git check-ignore` runs at the
    // repository root, while `siteDir` is measured from the layer root.
    // This is the one caller that needs the other form.
    //
    // Composed from the layer directory's BASENAME, not from `artefactStub`.
    // Those were the same string until the move (bean `wggr`) and are now two
    // different facts: the directory is `cat-harness/`, while the stub stays
    // `folio-assistant` because it names PUBLISHED artefacts — `<stub>.jsonld`
    // is what every `@id` in the graph is minted against, so renaming it
    // renames the whole graph. Using the stub here would have made this guard
    // check `.gitignore` against a directory that does not exist, and pass.
    //
    // RESTATED for the split (2026-10-09). The repository that commits these
    // files is no longer the checkout: cat-harness is litlfred/cat-harness,
    // laid into the composed checkout as a REMOTE MOUNT that the index's own
    // `.gitignore` ignores wholesale (`/cat-harness/`). Asked at the checkout
    // root, every path below is ignored and the guard says nothing about the
    // site root. So the question goes to the `.gitignore` of the repository
    // that holds the site -- the layer's own, alone, in a throwaway
    // repository -- with the paths relative to that repository's root, which
    // is the layer root. Same eight probes, same two directions.
    const site = siteDirFor(ROOT);

    // Hand-written source Jekyll serves verbatim. Ignoring these is the SILENT
    // failure: `git add` says nothing and the asset never deploys.
    const mustBeAddable = [
      `${site}/assets/js/probe.js`,
      `${site}/assets/js/vendor/probe.js`,
      `${site}/_includes/probe.js`,
    ];

    // Local build state. NOT ignoring these is the loud failure: `git add -A`
    // commits a gem tree.
    const mustBeIgnored = [
      `${site}/.bundle/config`,
      `${site}/vendor/bundle/probe.rb`,
      `${site}/_data/build.yml`,
      `${site}/_site/probe.html`,
    ];

    const own = mkdtempSync(join(tmpdir(), "site-dir-ignore-"));
    expect(spawnSync("git", ["init", "-q"], { cwd: own }).status).toBe(0);
    copyFileSync(join(ROOT, ".gitignore"), join(own, ".gitignore"));
    const ignored = (rel: string) =>
      spawnSync("git", ["check-ignore", "-q", "--no-index", "--", rel], { cwd: own }).status === 0;

    expect(mustBeAddable.filter(ignored)).toEqual([]);
    expect(mustBeIgnored.filter((r) => !ignored(r))).toEqual([]);
    rmSync(own, { recursive: true, force: true });
  });
});
