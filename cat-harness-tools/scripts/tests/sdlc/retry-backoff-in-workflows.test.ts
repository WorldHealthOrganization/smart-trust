/**
 * Every retry loop in every workflow uses the ONE backoff. Bean `06kg`.
 *
 * ## Why this file exists rather than a note in the skill
 *
 * `cat-harness/skills/conduct/conduct-core/retry-backoff.md` records an owner rule —
 * *"as rule, use logarithmic fall-off on all errors. core best practice."* —
 * and `src/core/retry.ts` is that rule as code, covered by `retry.test.ts`.
 *
 * That was true on 2026-09-20 while **all four** retry loops in
 * `feature-staging.yml` slept `$((attempt * 5))`: 5 s then 10 s, linear and
 * unjittered. The skill's own §"Jitter is not decoration here" names that
 * schedule as the thundering herd, on `gh-pages` — the ref it cites as the
 * contended one — written by the same concurrent sessions it says contend on
 * it (four pushing inside ninety minutes, bean `bm6d`).
 *
 * **Nothing noticed, and could not have.** The rule had an implementation and
 * a test in TypeScript and four call sites in bash that no check read;
 * `retry.ts` passing its suite said nothing whatsoever about a workflow. That
 * is the `dh4f` shape — a consumer scans nothing and the absence reads as
 * compliance — and it was found only because somebody read a sibling's open
 * PR. A rule enforced by a person happening to look is not enforced.
 *
 * ## What is pinned
 *
 * The PROPERTY — *a loop that retries does not compute its own wait* — not
 * the spelling of any one line. A loop reaching the shared implementation some
 * other way passes; one that hand-rolls a schedule does not, however it is
 * written.
 *
 * The vacuity guard matters as much as the assertions. If the discovery ever
 * returns no workflows, or no loops, this file would pass by finding nothing
 * to object to — `check-declared-assets` shipped exactly that (bean `6tkl`,
 * "0 across 0 instances, exit 0"). So the counts are asserted first.
 *
 * The workflow discovery and the assertions over it read the index
 * repository's own `.github/workflows/`, so they live in that repository's
 * `test/workflows/retry-backoff-in-workflows.test.ts` (owner's ruling
 * 2026-10-09, litlfred/folio-assistant#2521, ruling 1(c)). What stays here is
 * the shared implementation those loops must reach.
 */
import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { join, resolve } from "path";

describe("the shared implementation is the one `retry.ts` defines", () => {
  /**
   * Comments stripped here too, and for the same reason as the workflow
   * test's `code()` (now in the index repository) — which this file initially
   * failed to apply to itself. `backoff-sleep.ts`
   * documents WHY it does not reimplement the doubling, and that explanation
   * necessarily spells `baseMs * 2 ** (attempt - 1)`; the "does not carry its
   * own copy of the arithmetic" assertion matched the prose and went red on
   * correct code. Third time this trap has been paid for in this repository.
   */
  const script = readFileSync(
    join(resolve(import.meta.dir, "..", "..", "..", "scripts"), "backoff-sleep.ts"),
    "utf-8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  test("it calls `waitFor` rather than reimplementing the doubling", () => {
    // A shell function copied into four `run:` bodies is still four
    // implementations, free to drift — which is how six copies of
    // `stripLeanComments` ended up with three broken and nothing saying so
    // (bean `bqrg`). This is the whole reason the wait is a script.
    expect(script).toMatch(/import\s*\{\s*waitFor\s*\}\s*from/);
    expect(script).toMatch(/waitFor\(attempt/);
    // ...and does NOT carry its own copy of the arithmetic.
    expect(script).not.toMatch(/2\s*\*\*\s*\(\s*attempt/);
  });

  test("a bad attempt number refuses rather than becoming a short wait", () => {
    // Silently treating a typo as attempt 1 reintroduces the herd this exists
    // to break, which is worse than failing the step.
    expect(script).toMatch(/process\.exit\(2\)/);
  });
});
