/**
 * `ahab` — a translated page sits one directory deeper than its source, and
 * its relative links have to move with it.
 *
 * The corpus tests below are the ones that would have caught the defect; the
 * unit tests are the ones that would have caught the two ways I got the
 * REPAIR wrong before the gate went green.
 */
import { HARNESS_ROOT } from "../lib/roots.ts";
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { siteDir } from "../../schemas/kg/cat-harness.ts";

import {
  depthSensitive,
  localeSegmentIndex,
  repair,
  translatedLinkDepth,
} from "../check-translated-link-depth.ts";

const HARNESS = HARNESS_ROOT;

describe("the real corpus", () => {
  const report = translatedLinkDepth(HARNESS);

  test("there are locales to report on", () => {
    // `6tkl`: a sweep over no locales asserts nothing, so "clean" over an
    // empty set must not be reachable.
    expect(report.locales.length).toBeGreaterThan(0);
  });

  test("every depth-sensitive link on a translated page resolves at its own depth", () => {
    expect(report.findings.map((f) => `${f.file} -> ${f.target}`)).toEqual([]);
  });

  test("the check is DISCRIMINATING, not merely passing everything through", () => {
    // The load-bearing assertion. Without it, a rule that classified every
    // link as "published-tree only" would pass the test above while
    // asserting nothing at all — and `siteResolved` is exactly the bucket
    // where that mistake is invisible, because most of it really is
    // published-tree only.
    //
    // 30 on `origin/main` at fb62ecdae5c: `api/`, `proposals/*.html`,
    // `migrations/*.html`. A floor rather than the number, because a count in
    // a test is a claim that goes stale.
    expect(report.publishedOnly).toBeGreaterThan(0);
  });
});

describe("localeSegmentIndex — a locale directory at ANY depth", () => {
  const L = ["ar", "es", "fr", "ru", "zh"];

  test("at the top, the shape the first version handled", () => {
    expect(localeSegmentIndex(["fr", "architecture.md"], L)).toBe(0);
  });

  test("NESTED, the shape it missed", () => {
    // 24 links across four `docs/guides/<locale>/agent-onboarding.md` pages
    // were invisible while this asked `segs[0]` only. Same defect, same
    // repair, one directory further in.
    expect(localeSegmentIndex(["guides", "ar", "agent-onboarding.md"], L)).toBe(1);
  });

  test("a FILE named like a locale is not a locale directory", () => {
    // The last segment is the filename. Without this the check would treat
    // `docs/fr.md` as a translated page and compute a source path that is
    // just `docs/`, which resolves differently and would mint findings on a
    // page nobody translated.
    expect(localeSegmentIndex(["fr.md"], L)).toBe(-1);
    expect(localeSegmentIndex(["guides", "fr.md"], L)).toBe(-1);
  });

  test("no locale anywhere", () => {
    expect(localeSegmentIndex(["guides", "agent-onboarding.md"], L)).toBe(-1);
  });
});

describe("depthSensitive — a link whose meaning does not depend on where the page sits", () => {
  test("a relative path is", () => {
    expect(depthSensitive("reference/skills/x.html")).toBe(true);
    expect(depthSensitive("../sdlc/skills/crdm/crdm-detect.md")).toBe(true);
  });

  test("site-absolute, fragment-only and external are NOT", () => {
    // Each would be turned into nonsense by a `../`, which is the whole
    // reason this is a separate predicate rather than an inline condition.
    expect(depthSensitive("/folio-assistant/guides/")).toBe(false);
    expect(depthSensitive("#the-l3-pipeline")).toBe(false);
    expect(depthSensitive("https://example.org/x")).toBe(false);
    expect(depthSensitive("mailto:someone@example.org")).toBe(false);
  });
});

describe("repair — the two ways the rewrite was wrong before it was right", () => {
  const withTemp = (body: string, targets: string[]): string => {
    const dir = mkdtempSync(join(tmpdir(), "ahab-"));
    try {
      // `siteDir` rather than "docs": the output site root is ONE ANSWER and
      // a literal is a second one. `site-dir-single-answer` flagged both
      // lines below, and it was right to — a test that hardcodes the site
      // root keeps passing the day the layer moves it, which is the only
      // moment it mattered.
      const site = siteDir({ name: "scratch" });
      mkdirSync(join(dir, site, "fr"), { recursive: true });
      const file = join(site, "fr", "page.md");
      writeFileSync(join(dir, file), body);
      repair(
        {
          locales: ["fr"],
          pages: 1,
          publishedOnly: 0,
          findings: targets.map((t) => ({ file, locale: "fr", target: t, repaired: `../${t}` })),
        },
        dir,
      );
      return readFileSync(join(dir, file), "utf-8");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  test("a link carrying a #fragment is rewritten", () => {
    // MEASURED, not hypothetical. `scanSubgraphs` reports the target with the
    // fragment already stripped, so the first version of this rewrite matched
    // `](target)` exactly and silently skipped every link with one — 25 of
    // the first 745. The count dropped, the gate still failed, and the
    // remainder looked like a different problem.
    expect(withTemp("[a](guides/who-smart-ig.html#the-l3-pipeline)", ["guides/who-smart-ig.html"])).toBe(
      "[a](../guides/who-smart-ig.html#the-l3-pipeline)",
    );
  });

  test("a longer path that merely STARTS with the target is left alone", () => {
    // `](a/b)` must not consume `](a/bc/d)`. The lookahead on `)`/`#`/`?`/
    // whitespace is what makes the match an end-of-path rather than a prefix.
    expect(withTemp("[x](a/b) [y](a/bc/d)", ["a/b"])).toBe("[x](../a/b) [y](a/bc/d)");
  });

  test("every occurrence is rewritten, not the first", () => {
    // The same literal target on the same page resolves the same way, so one
    // being wrong makes all of them wrong.
    expect(withTemp("[1](r/x.html) and [2](r/x.html)", ["r/x.html"])).toBe(
      "[1](../r/x.html) and [2](../r/x.html)",
    );
  });

  test("a link that is not a finding is untouched", () => {
    expect(withTemp("[keep](api/) [fix](r/x.html)", ["r/x.html"])).toBe("[keep](api/) [fix](../r/x.html)");
  });
});
