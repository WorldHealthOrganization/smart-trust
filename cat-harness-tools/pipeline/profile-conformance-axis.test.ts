/**
 * The `profile-conformance` QA axis — bean `0bzg`.
 *
 * `checkFolioProfile` catches what schema validation STRUCTURALLY cannot: a block
 * valid against its own schema but wrong for the folio's content profile, because
 * adapters partition disjointly while profiles nest. Until this axis it had no
 * shell entry point at all — its only caller registered MCP tools — so CI could
 * never ask the question. The owner chose a `qa-sweep` axis over a `check:profile`
 * script because a sweep verdict is durable where a printed one is not.
 *
 * ## What these tests are for, specifically
 *
 * **Reaching every state, not just the one this repository happens to produce.**
 * The platform declares no `contentType`, so a test that only ran the axis here
 * would see `n/a` forever and prove nothing about `pass` or `fail`. That is the
 * "filter over nothing" trap: an axis whose only demonstrated state is
 * could-not-determine looks implemented and checks nothing.
 *
 * **The `n/a`-vs-`pass` boundary, which the first version of the axis got
 * wrong.** It guarded on `ProfileCheckResult.profile === undefined`, and that
 * field is never `undefined`: `checkFolioProfile` resolves through
 * `readFolioProfile`, which turns an undeclared profile into `"paper"` — correct
 * for a validator, since the wider vocabulary is the safe thing to validate
 * against. So the guard never fired and the axis reported **`pass` on a folio
 * that declares nothing**, which is precisely the laundering it exists to
 * prevent. Caught by running it, not by reading it.
 *
 * @module pipeline/profile-conformance-axis.test
 */
import { afterAll, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkFolioProfile, readDeclaredFolioProfile } from "./profile-check.ts";
import { writeInstanceConfig } from "../test/support/instance-fixture.js";

const made: string[] = [];
afterAll(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/**
 * A folio with one conformant block and one that is not.
 *
 * A block manifest is `export default <builder>({ … label: "…" })`. A plain
 * object literal is NOT recognised — the first fixture written for this used one
 * and reported `blocksChecked: 0`, which would have made every assertion below
 * pass over nothing.
 */
function folio(contentType: string | undefined): string {
  const root = mkdtempSync(join(tmpdir(), "profile-axis-"));
  made.push(root);
  if (contentType !== undefined) {
    writeInstanceConfig(root, JSON.stringify({ contentType }));
  }
  const ch = join(root, "content", "ch");
  mkdirSync(ch, { recursive: true });
  writeFileSync(join(ch, "bad.ts"), `export default theorem({ label: "thm:x", kind: "theorem" });\n`);
  writeFileSync(join(ch, "ok.ts"), `export default prose({ label: "sec:x" });\n`);
  return root;
}

describe("the mechanism the axis wraps", () => {
  it("finds the block that is outside the declared profile", () => {
    // A `theorem` in a DOCUMENT folio: valid against its own schema, wrong for
    // the profile. Nothing else in the pipeline reports this.
    const root = folio("document");
    const r = checkFolioProfile(root, join(root, "content"));
    expect(r.profile).toBe("document");
    // Both blocks seen, or the single violation below could be a walk that found
    // one file and missed the other.
    expect(r.blocksChecked).toBe(2);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]!.reason).toBe("kind-outside-profile");
    expect(r.violations[0]!.ts).toContain("bad.ts");
    // The remedy names what to change, not just what is wrong.
    expect(r.violations[0]!.detail).toContain('contentType: "paper"');
  });

  it("a paper folio holds the same blocks WITHOUT violation", () => {
    // The control. Without it, the assertion above could be reporting a
    // violation for any reason at all — a broken walk, a bad kind table — rather
    // than because the kind is outside THIS profile. Profiles nest, and
    // `theorem` is inside `paper`.
    const root = folio("paper");
    const r = checkFolioProfile(root, join(root, "content"));
    expect(r.profile).toBe("paper");
    expect(r.blocksChecked).toBe(2);
    expect(r.violations).toEqual([]);
  });
});

describe("declared vs resolved — the distinction the axis rests on", () => {
  it("an undeclared folio resolves to `paper` but DECLARES nothing", () => {
    // Both halves in one assertion pair, because the axis's correctness depends
    // on them differing. `readFolioProfile` resolving to `paper` is right for a
    // validator; an axis reading that as "the folio said paper" is wrong.
    const root = folio(undefined);
    expect(readDeclaredFolioProfile(root).profile).toBeUndefined();
    // And the check still resolves a profile to validate against, so a consumer
    // reading `result.profile` learns nothing about whether anybody declared it.
    expect(checkFolioProfile(root, join(root, "content")).profile).toBe("paper");
  });

  it("`declaredBy` distinguishes the two in words, and is NOT what the axis parses", () => {
    // It says which case it was, which is what a report needs. The axis asks
    // `readDeclaredFolioProfile` instead: matching on this prose would break the
    // moment the sentence is reworded, and a check that silently stops firing is
    // worse than one that never existed.
    expect(readDeclaredFolioProfile(folio(undefined)).declaredBy).toContain("undetermined");
    expect(readDeclaredFolioProfile(folio("document")).declaredBy).toContain("document");
  });
});
