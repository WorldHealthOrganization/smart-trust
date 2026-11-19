/**
 * The harness's `themes.css`, built here when the checkout does not have it.
 *
 * litlfred/cat-harness#371 stopped committing it: the stylesheet (and the
 * `_data/instance-themes.json` written beside it) is BUILT AT PUBLISH by
 * `themes:css` (`scripts/gen-themes-css.ts`). This repository's PR checks run
 * `bun test` without `derive:publish`, and the e2e specs read the stylesheet at
 * module load — before `e2e-global-setup.ts` runs — so a spec that reads it
 * must build it when it is absent, the way `todos-repo-root.test.ts` builds
 * `todos/index.md` (#411). What is under test is then what the deploy emits,
 * never a committed copy that could agree with the test and disagree with what
 * ships.
 *
 * A generator that cannot run here (a standalone layer, with no checkout of
 * instances beside it) is not itself a failure: the caller then fails on the
 * missing file, under its own name.
 *
 * @module test/support/themes-css
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { checkoutRootFor, siteFileFor } from "../../schemas/kg/cat-harness.ts";
import { readPathAt } from "../../scripts/lib/layer-output.ts";
import { TOOLS_ROOT } from "../../scripts/lib/roots.ts";

/** The generator, in this layer — `TOOLS_ROOT`, since Playwright loads specs under Node, where `import.meta.dir` is undefined. */
const GENERATOR = join(TOOLS_ROOT, "scripts", "gen-themes-css.ts");

/**
 * The absolute path of `themes.css` for the harness rooted at `root`, built
 * first if it is missing. Building is synchronous so a spec can call this at
 * module load; the file may still be absent afterwards (see the module note).
 */
export function ensureThemesCss(root: string): string {
  const path = join(root, siteFileFor(root, "assets/css/themes.css"));
  // A MOUNTED layer's generator writes the stylesheet at its output-root twin
  // (`build/layers/<instance>/…`), not into the pinned mount (sm8r item 4,
  // step 4), so look for it, and return it, where a reader of the checkout
  // finds it: the twin when one was written, else the path itself.
  const checkout = checkoutRootFor(root);
  if (!existsSync(readPathAt(checkout, path))) {
    // input-site: runs */scripts/gen-themes-css.ts,scripts/gen-themes-css.ts #968cf591 — builds themes.css with this layer's generator when it is missing
    spawnSync("bun", [GENERATOR, `--harness=${root}`], { cwd: root, encoding: "utf-8", stdio: "inherit" });
  }
  return readPathAt(checkout, path);
}
