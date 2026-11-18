/**
 * `kg:audit --instance .` audits the layer declared AT the repository root.
 *
 * ## The defect this pins (bean `pgzn`)
 *
 * `kg-audit.ts` computed its repository root as `resolve(root, "..")` — that
 * is `dirname`, right for every layer nested one level under the checkout
 * and wrong for the one declared at its root. Measured on `main` `cf3e624`:
 *
 * ```
 * bun run cat-harness/scripts/kg-audit.ts --instance .
 *   ENOENT: no such file or directory, open '<parent of checkout>/package.json'
 *     at rootScripts (cat-harness/scripts/pair-claims.ts)
 * ```
 *
 * so the root layer was audited by nothing, and `kg-audit-all.ts` skipped
 * it by name. The audit now asks `checkoutRootFor`.
 *
 * ## Why two assertions and not one
 *
 * "Did not throw" alone would pass a run that printed nothing useful. So the
 * run must ALSO emit its JSON report with at least one subject, and the
 * resolved repository root must be the checkout — not its parent — which is
 * asserted directly against the helper the audit now uses, so a regression to
 * `dirname` fails here before it fails as a crash.
 *
 * @module scripts/tests/kg-audit-root-instance
 *
 * The tests here that read the aggregate repository's own root (the root
 * layer declaration) live in
 * `test/kg-audit-root-instance-repo-root.test.ts`
 * (bean `ho66`): standing alone, cat-harness has no such root to read.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { repoRootFor } from "../../../schemas/kg/cat-harness.js";
import { checkoutRootFor } from "../../../schemas/kg/harness-config.js";
import { inAggregate } from "../../../test/support/checkout.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));

describe("kg:audit over the instance declared at the repository root (bean `pgzn`)", () => {

  // The root layer here is the AGGREGATE's, the one checkout whose root
  // carries `package.json` and nests `cat-harness/`. cat-harness run as its own
  // clone is a different shape — schemas/instance-roots-worktrees.test.ts
  // covers a checkout answering itself there — so this is skipped, not passed
  // (bean `ho66`).
  test.skipIf(!inAggregate())("checkoutRootFor resolves the root instance to the checkout, where repoRootFor climbs out", () => {
    // The falsifier: `dirname` lands where there is no package.json.
    expect(resolve(repoRootFor(REPO))).not.toBe(REPO);
    expect(checkoutRootFor(REPO)).toBe(REPO);
    expect(existsSync(join(checkoutRootFor(REPO), "package.json"))).toBe(true);
    // And it agrees with `dirname` for a nested layer.
    const nested = join(REPO, "cat-harness");
    expect(checkoutRootFor(nested)).toBe(resolve(repoRootFor(nested)));
  });

  test("`--instance .` emits a report rather than throwing", async () => {
    // `--check` so the run writes nothing into the tree it is judging.
    const p = Bun.spawn(
      ["bun", "run", "cat-harness-tools/scripts/kg-audit.ts", "--instance", ".", "--check", "--json"],
      { cwd: REPO, stdout: "pipe", stderr: "pipe" },
    );
    const out = await new Response(p.stdout).text();
    const err = await new Response(p.stderr).text();
    await p.exited;

    expect(err, "the audit crashed before reporting").not.toContain("ENOENT");
    let parsed: { reports?: unknown[] } | undefined;
    try {
      parsed = JSON.parse(out) as { reports?: unknown[] };
    } catch {
      parsed = undefined;
    }
    expect(parsed, `no JSON report:\n${err.slice(-600)}`).toBeDefined();
    expect(parsed!.reports?.length ?? 0).toBeGreaterThan(0);
  }, 120_000);
});
