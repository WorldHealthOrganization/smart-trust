/**
 * The root publish's guard (owner, 2026-10-14: an IG main site published by
 * the one publish path loses nothing `folio-site.yml` gave it): a built site is
 * measured on its PAGES, and a candidate that lacks what the current root
 * carries is named, feature by feature.
 *
 * The fixtures are the three shapes measured on smart-trust that day: the root
 * `folio-site.yml` built (theme side bar and search, icon row, served
 * directories, stamp), the IG Publisher's bare preview, and a railed one.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { publishedRoot, recipeFromConfig, siteStepEnv } from "../../build-instance-site.ts";
import { droppedByRuling, matchesDropped, PARITY_REPORT, parityReport, parityShortfall, readParityReport, siteFeatures, writeParityReport } from "../../site-parity.ts";
import { THEME_SIDEBAR_RULING } from "../../build-instance-site.ts";

const tmp = (p: string) => mkdtempSync(join(tmpdir(), p));
const put = (root: string, rel: string, text = "x") => {
  mkdirSync(join(root, rel, ".."), { recursive: true });
  writeFileSync(join(root, rel), text);
};
const page = (body: string, head = "") => `<!doctype html><html><head><title>t</title>${head}</head><body>${body}</body></html>`;
const META = '<script type="application/json" id="fa-translation-meta">{"lang":"en"}</script>';
const THEMED = page(`<div class="side-bar"><nav id="site-nav"></nav><input id="search-input"></div><script type="application/json" id="fa-navbar-row">{}</script>`, META);
const RAILED = page(`<nav class="fa-nav"></nav><script type="application/json" id="fa-navbar-row">{}</script>`);

/** The root folio-site.yml built: two themed pages, served directories, a stamp, and previews under branches/. */
function folioSiteRoot(): string {
  const d = tmp("parity-root-");
  put(d, "index.html", THEMED);
  put(d, "artifact/StructureDefinition-HCert.html", THEMED);
  put(d, "openapi/index.html", RAILED);
  put(d, "fhir-artifact-index/index.json", "{}");
  put(d, "ast-data/resources/x.json", "{}");
  put(d, "folio-build.json", JSON.stringify({ $schema: "folio-site-build/v1", instance: "r" }));
  put(d, "branches/feature/index.html", page("bare preview"));
  return d;
}

describe("siteFeatures — measured on the pages", () => {
  test("counts each feature, lists top-level directories without the kept ones, reads the stamp", () => {
    const f = siteFeatures(folioSiteRoot(), ["branches"]);
    expect(f.pages).toBe(3);
    expect(f.counts).toEqual({ siteNav: 2, search: 2, navbarRow: 3, rail: 3, translationMeta: 2 });
    expect(f.index).toEqual(["siteNav", "search", "navbarRow", "rail", "translationMeta"]);
    expect(f.dirs).toEqual(["artifact", "ast-data", "fhir-artifact-index", "openapi"]);
    expect(f.stamp).toMatchObject({ instance: "r" });
  });

  test("a site that is not there measures as empty", () => {
    expect(siteFeatures(join(tmpdir(), "no-such-site-x"))).toMatchObject({ pages: 0, dirs: [] });
  });
});

describe("parityShortfall — what the candidate would lose", () => {
  const current = siteFeatures(folioSiteRoot(), ["branches"]);

  test("the IG Publisher's bare preview loses every feature, three directories and the stamp", () => {
    const bare = tmp("parity-bare-");
    put(bare, "index.html", page("<h1>IG home</h1>"));
    put(bare, "openapi/index.html", page("swagger"));
    const short = parityShortfall(current, siteFeatures(bare));
    expect(short).toHaveLength(7);
    expect(short.join("\n")).toMatch(/side bar \(#site-nav\): on 2 of the current root's 3 page\(s\), on none of the candidate's 2/);
    expect(short.join("\n")).toMatch(/artifact\/, ast-data\/, fhir-artifact-index\//);
    expect(short.join("\n")).toMatch(/folio-build\.json/);
  });

  test("a railed preview keeps the icon row and the rail, and loses the theme's side bar, search and the language picker", () => {
    const railed = tmp("parity-railed-");
    put(railed, "index.html", RAILED);
    for (const d of ["artifact", "ast-data", "fhir-artifact-index", "openapi"]) put(railed, `${d}/x.html`, RAILED);
    put(railed, "folio-build.json", "{}");
    const short = parityShortfall(current, siteFeatures(railed));
    expect(short.map((s) => s.split(":")[0])).toEqual(["the theme's side bar (#site-nav)", "the search box (#search-input)", "the language picker's block (#fa-translation-meta)"]);
  });

  test("a feature on some pages but missing from the candidate's index.html is named too", () => {
    const c = siteFeatures(folioSiteRoot(), ["branches"]);
    const cand = { ...c, index: ["navbarRow" as const, "rail" as const] };
    expect(parityShortfall(c, cand)).toEqual([
      "the theme's side bar (#site-nav): on the current root's index.html, not on the candidate's",
      "the search box (#search-input): on the current root's index.html, not on the candidate's",
      "the language picker's block (#fa-translation-meta): on the current root's index.html, not on the candidate's",
    ]);
  });

  test("the same site loses nothing; extra pages and directories are not a shortfall", () => {
    const more = folioSiteRoot();
    put(more, "qa/index.html", THEMED);
    expect(parityShortfall(current, siteFeatures(more, ["branches"]))).toEqual([]);
  });
});

describe("a shortfall is a QA finding, not a refusal (owner, 2026-11-14)", () => {
  // A folio's root publish was refused because its index.html lacked the icon row.
  // Owner: "It shouldn't fail if there is an issue it should be a QA report."
  const current = siteFeatures(folioSiteRoot(), ["branches"]);
  const noRowOnIndex = { ...current, index: (current.index ?? []).filter((k) => k !== "navbarRow") };

  test("an index.html without the icon row is published with the shortfall reported", () => {
    const r = parityReport(current, noRowOnIndex);
    expect(r.outcome).toBe("published-with-shortfall");
    expect(r.shortfall).toEqual(["the harness icon row (#fa-navbar-row): on the current root's index.html, not on the candidate's"]);
  });

  test("the guard still finds the missing icon row; only a caller that asks for refuse is refused", () => {
    expect(parityReport(current, noRowOnIndex, [], true).outcome).toBe("refused");
    expect(parityReport(current, current, [], true).outcome).toBe("carries-everything");
  });

  test("the report is written beside the link report, for the QA page", () => {
    const site = tmp("parity-qa-");
    writeParityReport(site, parityReport(current, noRowOnIndex));
    expect(PARITY_REPORT).toBe("assets/site-qa/parity.json");
    const back = JSON.parse(readFileSync(join(site, PARITY_REPORT), "utf-8"));
    expect(back.$schema).toBe("site-parity-report/v1");
    expect(back.outcome).toBe("published-with-shortfall");
    expect(back.shortfall).toHaveLength(1);
    expect(back.current.stamp).toEqual({ present: true });
    rmSync(site, { recursive: true, force: true });
  });
});

describe("a loss is named against the last clean publish until it is fixed (owner, 2026-11-14: \"last clean\")", () => {
  // The case that showed it: a folio's root lost the icon row; the next three
  // publishes each compared with the one before, which also lacked it, and read clean.
  const clean = siteFeatures(folioSiteRoot(), ["branches"]);
  const lost = { ...clean, index: (clean.index ?? []).filter((k) => k !== "navbarRow") };
  const ROW = "the harness icon row (#fa-navbar-row): on the current root's index.html, not on the candidate's";

  test("a publish that loses the icon row is named, and the clean root it replaced becomes the baseline", () => {
    const r1 = parityReport(clean, lost, [], false, undefined, "aaa111");
    expect(r1.shortfall).toEqual([ROW]);
    expect(r1.baseline?.features.index).toContain("navbarRow");
    expect(r1.baseline?.from).toBeUndefined();
  });

  test("the next publish, still without it, is named against the last clean publish, not read as clean", () => {
    const r1 = parityReport(clean, lost, [], false, undefined, "aaa111");
    const r2 = parityReport(lost, lost, [], false, r1, "bbb222");
    expect(r2.outcome).toBe("published-with-shortfall");
    expect(r2.shortfall).toEqual([`${ROW} (against the last clean publish)`]);
    const r3 = parityReport(lost, lost, [], false, r2, "ccc333");
    expect(r3.shortfall).toEqual(r2.shortfall);
    expect(r3.baseline).toEqual(r1.baseline);
  });

  test("once fixed it reads clean, and the fixed build becomes the next baseline, named by its commit", () => {
    const r1 = parityReport(clean, lost, [], false, undefined, "aaa111");
    const fixed = parityReport(lost, clean, [], false, r1, "ddd444");
    expect(fixed.outcome).toBe("carries-everything");
    expect(fixed.baseline?.from).toBe("ddd444");
    expect(parityReport(clean, lost, [], false, fixed).shortfall[0]).toBe(ROW);
    expect(parityReport(lost, lost, [], false, parityReport(clean, lost, [], false, fixed)).shortfall).toEqual([`${ROW} (against the last clean publish, ddd444)`]);
  });

  test("a loss the owner's ruling drops is not named against the baseline either", () => {
    const r1 = parityReport(clean, lost, [], false, undefined);
    const ruling = [{ feature: "navbarRow" as const, ruling: "the row moved off the home page (test)" }];
    expect(parityReport(lost, lost, ruling, false, r1).shortfall).toEqual([]);
  });

  test("a site's own report is read back with its baseline; an older one without a baseline, or none, reads as having none", () => {
    const site = tmp("parity-prev-");
    expect(readParityReport(site)).toBeUndefined();
    writeParityReport(site, parityReport(clean, lost, [], false, undefined, "aaa111"));
    expect(readParityReport(site)?.baseline?.features.index).toContain("navbarRow");
    const { baseline: _b, ...old } = parityReport(clean, lost);
    writeParityReport(site, old as never);
    expect(readParityReport(site)?.baseline).toBeUndefined();
    writeFileSync(join(site, PARITY_REPORT), "not json");
    expect(readParityReport(site)).toBeUndefined();
    rmSync(site, { recursive: true, force: true });
  });
});

describe("the recipe an IG declares (site.build)", () => {
  const checkout = (build: unknown) => {
    const d = tmp("recipe-");
    writeFileSync(join(d, "r.config.json"), JSON.stringify({ site: { build } }));
    return d;
  };

  test("keep, profile and links are read and checked", () => {
    // `report` is the default (owner, 2026-11-14). A DECLARED value is carried, `report` too, so
    // a site's own choice wins over the shared preset it extends (cat-harness-tools#2345).
    expect(recipeFromConfig(checkout({ pre: ["site:ast"], keep: ["branches"], profile: "ig-repo-site", links: "refuse" }), "r")).toEqual({
      pre: ["site:ast"], sourceSteps: [], siteSteps: [], keep: ["branches"], profile: "ig-repo-site", links: "refuse",
    });
    expect(recipeFromConfig(checkout({ links: "report", coverage: "report" }), "r")).toEqual({ pre: [], sourceSteps: [], siteSteps: [], links: "report", coverage: "report" });
    expect(recipeFromConfig(checkout({}), "r")).toEqual({ pre: [], sourceSteps: [], siteSteps: [] });
    expect(recipeFromConfig(checkout({ extends: "document-folio" }), "r")).toEqual({ pre: [], sourceSteps: [], siteSteps: [], extends: "document-folio" });
    expect(() => recipeFromConfig(checkout({ extends: "../x" }), "r")).toThrow(/extends/);
    expect(() => recipeFromConfig(checkout({ keep: ["../x"] }), "r")).toThrow(/keep/);
    expect(() => recipeFromConfig(checkout({ keep: ["."] }), "r")).toThrow(/keep/);
    expect(() => recipeFromConfig(checkout({ profile: "ig" }), "r")).toThrow(/profile/);
    expect(() => recipeFromConfig(checkout({ links: "ignore" }), "r")).toThrow(/links/);
  });

  test("every step is told the build's own values in its environment", () => {
    expect(siteStepEnv({ instance: "r", title: "R", baseurl: "/r", url: "https://o.github.io", linkRoot: "L", work: "/w", source: "/w/s", site: "/w/_site", repository: "o/r", commit: "abc", ref: "main" })).toEqual({
      SITE_REPOSITORY: "o/r", SITE_COMMIT: "abc", SITE_REF: "main",
      SITE_INSTANCE: "r", SITE_TITLE: "R", SITE_BASEURL: "/r", SITE_URL: "https://o.github.io", SITE_LINK_ROOT: "L",
      SITE_WORK: "/w", SITE_SOURCE: "/w/s", SITE_DIR: "/w/_site",
    });
  });
});

describe("publishedRoot — the root a publish would replace, read without cloning into the checkout", () => {
  test("the branch's root is laid out without the kept entries; an absent branch is undefined", () => {
    const bare = tmp("published-bare-");
    execFileSync("git", ["init", "-q", "--bare", "-b", "gh-pages", bare]);
    const seed = folioSiteRoot();
    const g = (...a: string[]) => execFileSync("git", ["-C", seed, ...a], { stdio: "ignore" });
    g("init", "-q", "-b", "gh-pages");
    g("add", "-A");
    g("-c", "user.name=t", "-c", "user.email=t@example.org", "commit", "-q", "-m", "folio-site");
    g("push", "-q", `file://${bare}`, "gh-pages");
    const root = publishedRoot(`file://${bare}`, "gh-pages", ["branches", "STAGING"])!;
    const f = siteFeatures(root);
    expect(f.dirs).toEqual(["artifact", "ast-data", "fhir-artifact-index", "openapi"]);
    expect(f.stamp).toBeDefined();
    expect(publishedRoot(`file://${bare}`, "no-such-branch", [])).toBeUndefined();
  });

  test("an exclude is a pathspec, never shell text: `$(touch …)` runs nothing (bean cat-tools-j4sh)", () => {
    const bare = tmp("published-bare-");
    execFileSync("git", ["init", "-q", "--bare", "-b", "gh-pages", bare]);
    const seed = folioSiteRoot();
    const g = (...a: string[]) => execFileSync("git", ["-C", seed, ...a], { stdio: "ignore" });
    g("init", "-q", "-b", "gh-pages");
    g("add", "-A");
    g("-c", "user.name=t", "-c", "user.email=t@example.org", "commit", "-q", "-m", "folio-site");
    g("push", "-q", `file://${bare}`, "gh-pages");
    const marker = join(tmp("published-marker-"), "x");
    for (const ex of [`$(touch ${marker})`, `\`touch ${marker}\``, `"; touch ${marker}; "`]) {
      const root = publishedRoot(`file://${bare}`, "gh-pages", [ex]);
      expect(root).toBeDefined();
      expect(existsSync(marker)).toBe(false);
    }
  });
});

describe("directories dropped by the owner's ruling", () => {
  const ruling = { dir: "comparison-v*", ruling: "owner, 2026-10-14, \"2a\"" };
  const withComparison = () => {
    const r = folioSiteRoot();
    put(r, "comparison-v1.0.0/index.html", page("<p>comparison</p>"));
    return r;
  };
  /** The root as rebuilt without `openapi/`: a loss no ruling excuses. */
  const withoutOpenapi = () => {
    const r = folioSiteRoot();
    rmSync(join(r, "openapi"), { recursive: true, force: true });
    return r;
  };

  test("the glob matches top-level directory names only", () => {
    expect(matchesDropped("comparison-v1.0.0", ruling)).toBe(true);
    expect(matchesDropped("comparison-v2", ruling)).toBe(true);
    expect(matchesDropped("comparison", ruling)).toBe(false);
    expect(matchesDropped("openapi", ruling)).toBe(false);
    expect(matchesDropped("x", { dir: "a/b", ruling: "r" })).toBe(false);
  });

  test("a dropped directory is not a shortfall, and is said with its ruling", () => {
    const current = siteFeatures(withComparison(), ["branches"]);
    const cand = siteFeatures(withoutOpenapi(), ["branches"]);
    expect(droppedByRuling(current, cand, [ruling])).toEqual([{ dir: "comparison-v1.0.0", words: "comparison-v1.0.0/", ruling: ruling.ruling }]);
    const short = parityShortfall(current, cand, [ruling]);
    expect(short.join("\n")).not.toContain("comparison-v1.0.0");
    // It excuses nothing else: openapi/ is still a shortfall.
    expect(short.join("\n")).toContain("openapi/");
  });

  test("without the declaration the same drop is a shortfall", () => {
    const current = siteFeatures(withComparison(), ["branches"]);
    expect(parityShortfall(current, siteFeatures(folioSiteRoot(), ["branches"])).join("\n")).toContain("comparison-v1.0.0/");
  });
});

describe("page features dropped by the owner's ruling (layout \"C\", 2026-10-15)", () => {
  const sideNav = { feature: "siteNav" as const, ruling: "owner, 2026-10-15, layout \"C\": the folio rail stands in for the theme's side menu" };
  /** An IG-route build: railed pages with the IG's own search box and the language block, no theme side bar. */
  const igRoute = (o: { search?: boolean; meta?: boolean } = {}) => {
    const d = tmp("parity-ig-route-");
    const body = `<nav class="fa-nav"></nav><script type="application/json" id="fa-navbar-row">{}</script>` +
      `<div class="ig-topbar">${o.search === false ? "" : '<form class="ig-search"><input id="search-input"></form>'}</div>`;
    const html = page(body, o.meta === false ? "" : META);
    put(d, "index.html", html);
    for (const x of ["artifact", "ast-data", "fhir-artifact-index", "openapi"]) put(d, `${x}/x.html`, html);
    put(d, "folio-build.json", "{}");
    return d;
  };
  const current = siteFeatures(folioSiteRoot(), ["branches"]);

  test("the dropped feature is reported with its ruling, not a shortfall", () => {
    const cand = siteFeatures(igRoute());
    expect(parityShortfall(current, cand, [sideNav])).toEqual([]);
    expect(droppedByRuling(current, cand, [sideNav])).toEqual([{ feature: "siteNav", words: "the theme's side bar (#site-nav)", ruling: sideNav.ruling }]);
  });

  test("without the ruling the guard still refuses the same build", () => {
    expect(parityShortfall(current, siteFeatures(igRoute())).map((s) => s.split(":")[0])).toEqual(["the theme's side bar (#site-nav)"]);
  });

  test("search stays required: the side-bar ruling does not excuse a missing search box", () => {
    const short = parityShortfall(current, siteFeatures(igRoute({ search: false })), [sideNav]);
    expect(short.map((s) => s.split(":")[0])).toEqual(["the search box (#search-input)"]);
  });

  test("the language picker is required: a build that drops fa-translation-meta is refused", () => {
    const short = parityShortfall(current, siteFeatures(igRoute({ meta: false })), [sideNav]);
    expect(short.map((s) => s.split(":")[0])).toEqual(["the language picker's block (#fa-translation-meta)"]);
  });

  test("a feature entry excuses no directory, and a directory entry no feature", () => {
    const noOpenapi = igRoute();
    rmSync(join(noOpenapi, "openapi"), { recursive: true, force: true });
    expect(parityShortfall(current, siteFeatures(noOpenapi), [sideNav]).join("\n")).toContain("openapi/");
    expect(matchesDropped("openapi", { feature: "siteNav", ruling: "r" })).toBe(false);
    expect(parityShortfall(current, siteFeatures(igRoute()), [{ dir: "site-nav", ruling: "r" }]).join("\n")).toContain("#site-nav");
  });

  test("an entry naming both a directory and a feature excuses neither", () => {
    const both = { dir: "openapi", feature: "siteNav" as const, ruling: "r" };
    const noOpenapi = igRoute();
    rmSync(join(noOpenapi, "openapi"), { recursive: true, force: true });
    const short = parityShortfall(current, siteFeatures(noOpenapi), [both]).join("\n");
    expect(short).toContain("openapi/");
    expect(short).toContain("#site-nav");
  });
});

describe("the theme side bar the rail pass replaces", () => {
  // who-iris, 2026-10-15: the one-rail build replaced #site-nav on every page,
  // and the guard refused the publish for losing it.
  test("its loss is the ruling's, not a shortfall; a lost search box or rail still is", () => {
    const cur = tmp("parity-theme-cur-");
    put(cur, "index.html", THEMED);
    const cand = tmp("parity-theme-cand-");
    put(cand, "index.html", page(`<nav class="fa-nav"></nav><input id="search-input"><script type="application/json" id="fa-navbar-row">{}</script>`, META));
    expect(parityShortfall(siteFeatures(cur), siteFeatures(cand))).toHaveLength(1);
    expect(parityShortfall(siteFeatures(cur), siteFeatures(cand), [THEME_SIDEBAR_RULING])).toEqual([]);
    const bare = tmp("parity-theme-bare-");
    put(bare, "index.html", page(`<nav class="fa-nav"></nav><script type="application/json" id="fa-navbar-row">{}</script>`, META));
    expect(parityShortfall(siteFeatures(cur), siteFeatures(bare), [THEME_SIDEBAR_RULING]).map((x) => x.split(":")[0])).toEqual(["the search box (#search-input)"]);
  });
});
