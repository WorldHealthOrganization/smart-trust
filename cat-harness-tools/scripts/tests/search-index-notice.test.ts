/**
 * A preview says which index its search box is searching.
 *
 * @module scripts/tests/search-index-notice.test
 *
 * ## The ruling this implements, and the rule it narrows
 *
 * Bean `eof6` concluded that staging must **disable** search outright, on the
 * grounds that a stale hit is *"a wrong PASS, BELIEVED"*. The owner ruled
 * otherwise on 2026-09-22: *"staging uses last published index (w/ wanrnig)"*.
 *
 * The ruling holds against the objection because **belief** was the
 * load-bearing word, and a warning is what attacks it. The narrower rule:
 *
 * > Unmarked staleness is worse than absence. Marked staleness is not.
 *
 * So the swap is never silent, and that is what is asserted here.
 *
 * ## Why the decision is a pure function
 *
 * `searchIndexNotice` maps the stamped state to its text and touches no DOM,
 * precisely so it can be checked without a browser. Rendering needs a built
 * page; deciding does not. Only the rendering is left to CI's e2e job, and
 * the text it renders is pinned here.
 *
 * ## The CSS half, and the mistake it is guarding
 *
 * A first draft styled the notice with `--fa-accent`, `--fa-surface-2` and
 * `--fa-ink-dim`. **None of the three exists.** The existing token tests did
 * not catch it, and could not: they forbid a raw hex rather than requiring a
 * defined name, and an undefined custom property is not a CSS error — it just
 * renders unstyled. So this file checks that every token the rule references
 * is actually declared somewhere.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { siteFileFor } from "../../schemas/kg/cat-harness.js";

const JS = readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/js/docs-ui.js")), "utf8");
const CSS = readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/css/docs-ui.css")), "utf8");
const HEAD = readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "_includes/head_custom.html")), "utf8");

/**
 * `searchIndexNotice`, lifted out of the client IIFE and evaluated.
 *
 * Extracted from the shipped file rather than duplicated, so the test cannot
 * pass against a copy that has drifted from what the browser runs — the same
 * reason `client-function-names.test.ts` reads this file rather than a model
 * of it.
 */
function noticeFn(): (state: string) => string | null {
  const m = /function searchIndexNotice\(state\) \{[\s\S]*?\n  \}/.exec(JS);
  if (!m) throw new Error("searchIndexNotice not found in docs-ui.js");
  // input-site: inert #a63ac241 — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
  return new Function(`${m[0]}; return searchIndexNotice;`)() as (s: string) => string | null;
}

describe("the notice is decided without a browser", () => {
  const notice = noticeFn();

  test("`published` warns that hits are about the main site", () => {
    const t = notice("published");
    expect(t).toBeTruthy();
    // The specific claim, not just "some text": a reader has to learn that a
    // hit is not evidence about this branch.
    expect(t!).toContain("published site");
    expect(t!).toContain("not from this preview");
  });

  test("`unavailable` says search does not work here, and why", () => {
    const t = notice("unavailable");
    expect(t).toBeTruthy();
    expect(t!).toContain("unavailable");
    expect(t!).toContain("could not be fetched");
  });

  test("the canonical deploy draws NOTHING", () => {
    // The empty stamp is the ordinary site, where the index is its own. A
    // warning there would be noise that trains readers to ignore the real one.
    expect(notice("")).toBeNull();
  });

  test("an unrecognised stamp draws nothing rather than guessing", () => {
    // Putting words on the page that no build step wrote is worse than
    // silence: the reader cannot tell an invented warning from a real one.
    expect(notice("something-a-later-build-invented")).toBeNull();
  });
});

describe("the wiring the pure function cannot cover", () => {
  test("the meta the notice reads is the meta the page emits", () => {
    expect(HEAD).toContain('name="fa-search-index"');
    expect(HEAD).toContain("site.data.build.search_index");
    expect(JS).toContain('meta[name="fa-search-index"]');
  });

  test("the notice is appended to the search holder, not the page banner", () => {
    // It is about the INDEX, while the staging banner is about the PREVIEW —
    // different claims — and somebody who types into the box has not
    // necessarily read the banner.
    //
    // Since #2201 it goes into `.fa-search-drop`, the container under the
    // field, which is itself inside the holder — so it can never be drawn
    // over the field's text.
    expect(JS).toContain("fa-search-notice");
    expect(/searchDrop\.appendChild\(noticeEl\)/.test(JS)).toBe(true);
    expect(/adopted\.appendChild\(searchDrop\)/.test(JS)).toBe(true);
    expect(/searchHolder\.appendChild\(adopted\)/.test(JS)).toBe(true);
  });

  test('it carries role="status", for the declared low-dexterity profile', () => {
    expect(/class: "fa-search-notice", role: "status"/.test(JS)).toBe(true);
  });
});

describe("every CSS token the notice uses is actually defined", () => {
  test("no invented custom properties", () => {
    // The guard for the mistake this change made once: an undefined custom
    // property is not an error, so the rule renders unstyled and says nothing.
    const rule = /\.fa-search-notice \{[\s\S]*?\}/.exec(CSS);
    expect(rule).not.toBeNull();

    const used = [...rule![0].matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]!);
    expect(used.length).toBeGreaterThan(0);

    const undefined_ = used.filter((t) => !new RegExp(`${t}\\s*:`).test(CSS));
    expect(undefined_).toEqual([]);
  });
});
