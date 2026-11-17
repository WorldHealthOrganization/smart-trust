/**
 * The docs site's renderer (bean `bnjs`): changed files to the pages of the
 * composed just-the-docs site, with the measured case's lessons pinned.
 */
import { describe, expect, test } from "bun:test";

import type { ConeDecision } from "../staging-cone.ts";
import {
  composedPath,
  docsRenderedImpact,
  frontMatter,
  indexSite,
  pagePath,
  reachedPages,
  SEARCH_INDEX,
  type DocsImpactOptions,
  type Mount,
} from "../docs-rendered-impact.ts";

const mounts: Mount[] = [
  // The site chrome is its own layer since slice 1 of the semantic subgraphs.
  { from: "cat-harness/site-chrome/", to: "" },
  { from: "cat-harness/docs/", to: "" },
  { from: "docs/", to: "" },
  { from: "smart-trust/docs/", to: "smart-trust/" },
];

const tree: Array<[string, string]> = [
  ["index.md", "---\ntitle: Home\n---\n{% include landing.html %}"],
  ["es/index.md", "---\npermalink: /es/\n---\n{% include landing.html %}"],
  ["guides/onboarding.md", "---\ntitle: On\n---\nText"],
  ["harnesses.md", "---\n---\n{% include harness_details.html instance=\"x\" %}"],
  ["_includes/landing.html", "{%- assign s = site.data.stickies.stickies -%}"],
  ["_includes/harness_details.html", "<p>What each harness holds</p>"],
  ["_includes/head_custom.html", "<link>"],
  ["_includes/orphan.html", "<p>nobody includes me</p>"],
  ["_layouts/wide.html", "{% include wide_nav.html %}"],
  ["_includes/wide_nav.html", "<nav>"],
  ["reference/kinds.md", "---\n---\n{% for k in site.data.node-kinds.kinds %}{{k}}{% endfor %}"],
  ["assets/js/harness-data.liquid", "---\nlayout: null\npermalink: /assets/js/harness-data.js\n---\n{{ site.data.harness.tiles | jsonify }}"],
  ["assets/harness/tiles.json", "---\nlayout: null\npermalink: /assets/harness/tiles.json\n---\n{{ site.data.harness.tiles | jsonify }}"],
];
const theme = new Set(["head_custom.html", "title.html"]);
const ix = indexSite(tree, theme);

const opts = (changed: string[], over: Partial<DocsImpactOptions> = {}): DocsImpactOptions => ({
  changed,
  mounts,
  read: (f) => (f.endsWith("gone.md") ? undefined : f.endsWith(".md") ? "---\ntitle: x\n---\nbody" : "x"),
  index: () => ix,
  coneOf: () => [],
  ...over,
});
const paths = (i: ReturnType<typeof docsRenderedImpact>) => i.files.map((f) => `${f.role}:${f.path}`);

describe("mapping a source file into the composed tree", () => {
  test("a docs layer lands at the root, a composed instance under its name, anything else nowhere", () => {
    expect(composedPath("cat-harness/docs/guides/a.md", mounts)).toBe("guides/a.md");
    expect(composedPath("docs/b.md", mounts)).toBe("b.md");
    expect(composedPath("smart-trust/docs/c.md", mounts)).toBe("smart-trust/c.md");
    expect(composedPath("cat-harness/scripts/x.ts", mounts)).toBeUndefined();
  });

  test("a page renders at its permalink, or at the same path as .html", () => {
    expect(pagePath("guides/a.md")).toBe("guides/a.html");
    expect(pagePath("es/index.md", "/es/")).toBe("es/index.html");
    expect(pagePath("x.md", "/y/z")).toBe("y/z/index.html");
    expect(pagePath("x.md", "/y.html")).toBe("y.html");
    expect(frontMatter("no front matter")).toBeNull();
    expect(frontMatter("---\npermalink: \"/p/\"\n---\n")).toEqual({ permalink: "/p/" });
  });
});

describe("docsRenderedImpact", () => {
  test("a page, an asset and the search index every page change moves", () => {
    const i = docsRenderedImpact(opts(["cat-harness/docs/guides/onboarding.md", "cat-harness/site-chrome/assets/css/docs-ui.css"]));
    expect(paths(i)).toEqual(["data:assets/css/docs-ui.css", `index:${SEARCH_INDEX}`, "content:guides/onboarding.html"]);
  });

  test("an asset alone does not move the search index", () => {
    expect(paths(docsRenderedImpact(opts(["cat-harness/site-chrome/assets/css/docs-ui.css"])))).toEqual(["data:assets/css/docs-ui.css"]);
  });

  test("an asset hashed by fa_asset_version reaches the pages or theme includes that hash it", () => {
    const withVersionedAssets = indexSite(
      [
        ...tree,
        ["guides/styled.md", "---\ntitle: Styled\n---\n<link href=\"{{ '/assets/css/page.css' | fa_asset_version }}\">"],
        ["_includes/head_custom.html", "<script src=\"{{ '/assets/js/docs-ui.js' | relative_url }}?v={{ '/assets/js/docs-ui.js' | fa_asset_version }}\"></script>"],
      ],
      theme,
    );
    const pageScoped = docsRenderedImpact(opts(["cat-harness/docs/assets/css/page.css"], { index: () => withVersionedAssets }));
    expect(paths(pageScoped)).toEqual(["data:assets/css/page.css", `index:${SEARCH_INDEX}`, "content:guides/styled.html"]);
    expect(pageScoped.undetermined).toEqual([]);

    const siteWide = docsRenderedImpact(opts(["cat-harness/site-chrome/assets/js/docs-ui.js"], { index: () => withVersionedAssets }));
    expect(paths(siteWide)).toEqual(["data:assets/js/docs-ui.js"]);
    expect(siteWide.undetermined).toEqual([
      expect.objectContaining({ input: "cat-harness/site-chrome/assets/js/docs-ui.js", scope: "all" }),
    ]);
  });

  test("an include reaches the pages that include it, through other includes", () => {
    const i = docsRenderedImpact(opts(["cat-harness/docs/_includes/harness_details.html"]));
    expect(paths(i)).toEqual([`index:${SEARCH_INDEX}`, "content:harnesses.html"]);
  });

  test("a data file reaches the pages that read it, directly and through an include", () => {
    expect(paths(docsRenderedImpact(opts(["cat-harness/docs/_data/stickies.json"])))).toEqual([
      `index:${SEARCH_INDEX}`,
      "content:es/index.html",
      "content:index.html",
    ]);
    expect(paths(docsRenderedImpact(opts(["cat-harness/docs/_data/node-kinds.json"])))).toContain("content:reference/kinds.html");
  });

  test("Liquid-rendered non-HTML templates (.liquid, .json with front matter) render at their permalink as data, without touching the search index", () => {
    expect(paths(docsRenderedImpact(opts(["cat-harness/docs/_data/harness.json"])))).toEqual([
      "data:assets/harness/tiles.json",
      "data:assets/js/harness-data.js",
    ]);
    expect(
      paths(
        docsRenderedImpact(
          opts(["cat-harness/site-chrome/assets/js/harness-data.liquid"], {
            read: () => "---\nlayout: null\npermalink: /assets/js/harness-data.js\n---\nbody",
          }),
        ),
      ),
    ).toEqual(["data:assets/js/harness-data.js"]);
  });

  test("an include the THEME defines, one nothing calls, or one a layout calls, can change any page", () => {
    for (const f of ["_includes/head_custom.html", "_includes/orphan.html", "_includes/wide_nav.html", "_layouts/wide.html", "_config.yml"]) {
      const i = docsRenderedImpact(opts([`cat-harness/docs/${f}`]));
      expect(i.files).toEqual([]);
      expect(i.undetermined.map((u) => u.scope)).toEqual(["all"]);
    }
  });

  test("with no readable theme, EVERY include is site-wide: never 'no page'", () => {
    const blind = indexSite(tree);
    expect(reachedPages(["_includes/harness_details.html"], blind)).toBe("all");
  });

  test("a removed page is reported removed", () => {
    expect(docsRenderedImpact(opts(["cat-harness/docs/guides/gone.md"])).files).toContainEqual(
      expect.objectContaining({ path: "guides/gone.html", change: "removed" }),
    );
  });

  test("a file outside the tree: undetermined when the staging cone carries anything, nothing when it reaches nothing", () => {
    const carried: ConeDecision[] = [{ node: "cat-harness/kg", path: "cat-harness/skills/", carry: true, why: "the branch changes x" }];
    const reached = docsRenderedImpact(opts(["cat-harness/scripts/gen.ts"], { coneOf: () => carried }));
    expect(reached.files).toEqual([]);
    expect(reached.undetermined).toEqual([expect.objectContaining({ input: "cat-harness/scripts/gen.ts", scope: "unknown" })]);
    expect(reached.undetermined[0]!.reason).toContain("cat-harness/kg");
    const nowhere = docsRenderedImpact(opts(["README.md"]));
    expect(nowhere.files).toEqual([]);
    expect(nowhere.undetermined).toEqual([]);
    expect(nowhere.inputs).toEqual(["README.md"]);
  });

  test("a site prefix is put in front of every path", () => {
    expect(paths(docsRenderedImpact(opts(["cat-harness/docs/guides/onboarding.md"], { site: "STAGING/x" })))).toEqual([
      `index:STAGING/x/${SEARCH_INDEX}`,
      "content:STAGING/x/guides/onboarding.html",
    ]);
  });
});
