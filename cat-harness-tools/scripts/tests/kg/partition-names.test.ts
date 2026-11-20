/**
 * A target repo's `instance` must equal that layer's own declared `name`.
 *
 * Bean `yx9p`. The partition named its five targets `agentic-harness`,
 * `folio-assist-core`, `folio-asst-sci`, `smart-kg`, `smart-base`; the
 * directories staging them declared `cat-harness`, `folio-assistant-core`,
 * `folio-assistant-sci`, — and `smart-base`. **One of five agreed.**
 *
 * Three were near-misses, which is the part that made it survive: a reader
 * skims `folio-assist-core` and `folio-assistant-core` as the same string, so
 * nobody looking at either file noticed. A test compares them by `===` and
 * cannot skim.
 *
 * ## Why this asserts against the DECLARATION rather than a second list
 *
 * `instance-rules.ts` could have carried the declared names as literals and
 * this test could have checked the literals. That is two copies and one of
 * them would be stale within a week — the defect it is meant to prevent,
 * reproduced one level in. So the test resolves each layer's declaration
 * and reads the `name` out of it: the declaration is the source of truth, and
 * `REPOS[].instance` is a pointer to it.
 *
 * ## The third state is load-bearing here
 *
 * `kg` has no `instance`, because `smart-kg` is a Phase III target this
 * checkout does not stage. That is NOT the `dh4f` defect (declared but absent,
 * so a consumer scans nothing and calls it clean) and the two must not
 * collapse: one is a plan, the other is a blind sweep. The test therefore
 * distinguishes three cases — has a layer and agrees, has a layer and
 * DISAGREES, has no layer — and passes only the first and third. An
 * `instance` naming a directory that does not exist fails, so the escape
 * hatch cannot be used to paper over a missing one.
 *
 * The tests of this file that read the whole checkout (reads every staged
 * layer's declaration in the checkout) live in
 * `test/partition-names-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */

import { expect, test } from "bun:test";

import { REPOS } from "../../partition/instance-rules.js";

/**
 * The entries that name a staging layer, narrowed so `instance` is a string.
 *
 * `REPOS.filter(r => r.instance !== undefined)` does NOT narrow the type —
 * TypeScript keeps `string | undefined` through a plain predicate — so every
 * use below would need a `!`, which is an assertion the compiler cannot check
 * and which this file exists to avoid making. One type predicate, used
 * everywhere, is checkable once.
 */
const STAGED = REPOS.filter((r): r is typeof r & { instance: string } => r.instance !== undefined);

test("a target with no instance is a PLAN, and is allowed to have one", () => {
  // Anti-vacuity in the other direction. If every target gained an `instance`,
  // the loop above would cover everything and this file would silently stop
  // testing the third state — so the third state is asserted to still exist.
  // If `smart-kg` is ever staged, delete this test rather than weakening it:
  // the `dh4f` distinction it guards has no subject once nothing is unstaged.
  const unstaged = REPOS.filter((r) => r.instance === undefined).map((r) => r.id);
  expect(unstaged).toContain("kg");
});

test("the loop is not vacuous — it covers the targets that ARE staged", () => {
  // Without this, deleting every `instance` would make the describe block
  // above generate zero tests and the file would pass by testing nothing.
  const staged = STAGED;
  expect(staged.length).toBeGreaterThanOrEqual(4);
});

test("a staged target's NAME equals the instance staging it", () => {
  // THE invariant `yx9p` is about, and the one this file did not have until a
  // falsifier caught it: reverting `core` to `folio-assist-core` while leaving
  // `instance: "folio-assistant-core"` passed all seven earlier tests, because
  // they compared `declared` to `instance` and never `name` to `instance`.
  //
  // A prefix check was tried first and is WORSE THAN USELESS here:
  // `"folio-assistant-core".startsWith("folio-assist-core")` is FALSE — the two
  // diverge at `a` vs `-` — so the shape the bean actually recorded is not a
  // prefix relation at all, and a test built on that idea passes on the defect.
  // Equality is the only thing that catches a near-miss, because near-misses
  // are near by eye and not by any string relation.
  for (const r of STAGED) {
    expect(
      r.name,
      `Target \`${r.id}\` is named \`${r.name}\` but staged in \`${r.instance}/\`. ` +
        `For a STAGED target the two are one fact — the declaration is the source ` +
        `of truth, so change \`name\` to \`${r.instance}\`. If they genuinely must ` +
        `differ, say why here rather than loosening this test: bean \`yx9p\` exists ` +
        `because three of five drifted by an abbreviation nobody could see.`,
    ).toBe(r.instance);
  }
});
