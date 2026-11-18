/**
 * No two functions in the client script share a name.
 *
 * ## The failure this exists for, measured
 *
 * `docs-ui.js` is one long IIFE, so every `function foo()` inside it lands in
 * the SAME scope. A second declaration of a name does not error, does not
 * warn, and does not shadow — it REPLACES the first for every caller,
 * including the ones written hundreds of lines above it.
 *
 * 2026-09-22, merging `main` into a branch: `main` had added
 * `siteBaseurl()` reading `meta[name="fa-baseurl"]` to compose graph-tile
 * hrefs (issue #801), and the branch had added a `siteBaseurl()` deriving the
 * prefix from `meta[name="fa-todo-src"]` for sticky art. Neither side touched
 * the other's feature and the merge reported no conflict, because there was
 * none: the two functions are 500 lines apart. The branch's declaration came
 * later, so it won, `withBase` began asking for a meta the tile fixtures do
 * not carry, and all twelve tiles lost their base — #801 restored by a merge
 * of two green branches.
 *
 * ## Why a SOURCE check rather than a behavioural one
 *
 * The behavioural test that caught it was `graph-tiles.e2e.ts`, and it caught
 * ONE consequence of one collision. The next duplicate will be a different
 * pair of features, and the test that would catch it is the one nobody wrote
 * — which is exactly the `hfkl` reading: a checker naming one instance states
 * a rule true only for the layer somebody remembered.
 *
 * A collision is also the hardest kind of merge result to see in review. Both
 * halves of the diff look right, and the defect is in neither of them.
 *
 * @module scripts/tests/client-function-names.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { siteFileFor } from "../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
const CLIENT = join(ROOT, siteFileFor(ROOT, "assets/js/docs-ui.js"));

/**
 * Every declaration in the IIFE's OWN scope, with its line.
 *
 * Two narrowings, both of which the first version of this check got wrong and
 * a real pair of functions caught:
 *
 * DECLARATIONS ONLY. A `var f = function ()` is an assignment, which the next
 * assignment overwrites in a way a reader can at least see at the call site.
 * Hoisted declarations are the ones that reach backwards.
 *
 * EXACTLY ONE INDENT LEVEL. The file is one long IIFE, so its own functions
 * sit at two spaces and anything deeper is inside another function — a
 * genuinely separate scope. `nudge` is declared twice in this file and both
 * are correct: one is a local hover handler nested in the highlight strip,
 * the other is the top-level arrow-key handler for a window. Matching any
 * indentation reports that pair as a collision, which is a false finding in
 * the check whose whole value is that its findings are real.
 */
function declarations(source: string): Array<{ name: string; line: number }> {
  const out: Array<{ name: string; line: number }> = [];
  source.split("\n").forEach((text, i) => {
    const m = /^ {2}function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(text);
    if (m) out.push({ name: m[1]!, line: i + 1 });
  });
  return out;
}

describe("the client declares each function name once", () => {
  const source = readFileSync(CLIENT, "utf-8");
  const decls = declarations(source);

  test("there ARE declarations, so this is not vacuous", () => {
    // Without this the check passes loudest when the regex has stopped
    // matching anything at all — a green that means the opposite of green.
    expect(decls.length).toBeGreaterThan(50);
  });

  test("no name is declared twice", () => {
    const seen = new Map<string, number[]>();
    for (const d of decls) seen.set(d.name, [...(seen.get(d.name) ?? []), d.line]);
    const dupes = [...seen.entries()]
      .filter(([, lines]) => lines.length > 1)
      // NAMED WITH THEIR LINES. "there is a duplicate" sends the next reader
      // grepping; the lines send them to both halves, which is where the
      // decision about which one survives has to be made.
      .map(([name, lines]) => `${name} (lines ${lines.join(", ")})`);
    expect(dupes).toEqual([]);
  });
});
