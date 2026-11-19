/**
 * The two navbar stylesheets may not disagree. Bean `7mog`, issue #1294.
 *
 * ## What this guards, and what it deliberately does not
 *
 * `lib/navbar.ts` renders the navbar's markup for every surface (`sjic`, #1264),
 * but its STYLESHEET reaches only the pages it is injected into. The docs site
 * paints the same component from `docs/assets/css/docs-ui.css`. Two files,
 * therefore two chances to say the same thing differently.
 *
 * **Measured before this was written, rather than assumed:** the two share
 * exactly three rules and disagree about none of them. The sidebar is a
 * SUPERSET with a different container — it carries ~50 `fa-nav*` selectors the
 * rail has no counterpart for, including a persisted `data-fa-nav` preference
 * state machine, a `.fa-nav-icons` region and responsive floors keyed to the
 * theme's own column. So this is NOT a test that the two files are the same,
 * and it must never become one: that would fail on the sidebar doing its job.
 *
 * It asserts the narrow, durable property instead:
 *
 * > where both files declare the SAME selector, they declare the SAME thing.
 *
 * Zero drift today is not the same as cannot drift. The open/close control DID
 * come apart once — the sidebar grew a third control and a different placement,
 * and #928 realigned it by hand after the owner reported it. A hand-alignment
 * is a thing that drifts again; this is the version that does not.
 *
 * ## Why parse rather than grep
 *
 * A grep for a declaration finds it inside the comment that explains why the
 * rule avoids it — `sidebar-strip.test.ts` records paying for exactly that, and
 * the fix there was to strip comments before scanning. Comparing parsed
 * selector→declaration maps sidesteps the question: a comment has no selector.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { siteFileFor } from "../../../schemas/kg/cat-harness.js";
import { navbarCss } from "../../lib/navbar.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { dirname } from "node:path";

const ROOT = join(dirname(HARNESS_ROOT));
const INSTANCE = join(ROOT, "cat-harness");
const SITE_CSS = join(INSTANCE, siteFileFor(INSTANCE, "assets/css/docs-ui.css"));

/**
 * Selector → normalised declaration body.
 *
 * Whitespace is collapsed and a trailing `;` dropped, so a rule reformatted on
 * one side does not read as a disagreement. `@`-rules are skipped: this compares
 * what a selector DECLARES, and a media query's own text is a condition rather
 * than a declaration. Their contents are still compared, because the regex
 * matches the inner blocks.
 */
function rules(css: string): Map<string, string> {
  const out = new Map<string, string>();
  // Comments first: one can contain braces, and an unstripped `/* … { … } */`
  // would be parsed as a rule with a selector nobody wrote.
  const s = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  for (const m of s.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1]!.trim().replace(/\s+/g, " ");
    if (!sel || sel.startsWith("@")) continue;
    out.set(sel, m[2]!.trim().replace(/\s+/g, "").replace(/;$/, ""));
  }
  return out;
}

const rail = rules(navbarCss());
const site = rules(readFileSync(SITE_CSS, "utf-8"));
const shared = [...rail.keys()].filter((s) => site.has(s));

describe("the two navbar stylesheets cannot disagree", () => {
  test("every selector both files declare, they declare identically", () => {
    // The whole point. A mismatch here is one component painted two ways, which
    // renders fine and is therefore invisible without this.
    const drifted = shared
      .filter((s) => rail.get(s) !== site.get(s))
      .map((s) => ({ selector: s, rail: rail.get(s), site: site.get(s) }));
    expect(drifted).toEqual([]);
  });

  test("the parser saw real rules on both sides", () => {
    // Without this every assertion above is vacuously true — a regex that
    // stopped matching would report perfect agreement about nothing. The floors
    // are deliberately far below today's counts (37 and 732), because this
    // guards against the parser breaking, not against the stylesheets growing.
    expect(rail.size).toBeGreaterThan(20);
    expect(site.size).toBeGreaterThan(200);
  });

  test("the shared set is SMALL, and its size is the trade this design rests on", () => {
    // Three rules are worth a guard. Thirty would be worth generating the
    // shared stylesheet from `navbarCss()` and having the site load it, which
    // is the truer single-sourcing and costs a new asset, a head link, a gate
    // and verification across 1,283 pages.
    //
    // This assertion is how that day announces itself instead of being noticed.
    // Raising the bound is a decision; leaving it is not maintenance.
    //
    // Two of the three went with the `[x]` (#1757): the rail no longer renders
    // a close control, so `navbarCss()` no longer styles one.
    expect(shared.sort()).toEqual([".fa-nav-open"]);
  });
});
