import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { declaredNavsIn, jekyllNavPages, harnessOfUrl, labelUnder, pagesNav, siteAbsoluteDeclaration } from "../lib/jekyll-pages-nav.ts";
import { expandRail, injectRail, railDataJson } from "../lib/harness-rail.ts";
import { RAIL_SECTION_LABELS } from "../lib/navbar.ts";
import { pageLangOf } from "../mount-instance-docs.ts";

/**
 * The rail's server-built "Pages" section — owner, 2026-10-15, "folio rail
 * everywhere". It must list what the theme's `site-nav` lists, in the
 * theme's order, at the address Jekyll publishes each page.
 */
function site(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "pages-nav-"));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  return root;
}
const fm = (o: Record<string, string | number | boolean>) =>
  `---\n${Object.entries(o).map(([k, v]) => `${k}: ${typeof v === "string" ? JSON.stringify(v) : v}`).join("\n")}\n---\nbody\n`;

const SITE = {
  "index.md": fm({ title: "Home", nav_order: 1 }),
  "guide/index.md": fm({ title: "Guide", nav_order: 2 }),
  "guide/install.md": fm({ title: "Install", parent: "Guide", nav_order: 1 }),
  "guide/use.md": fm({ title: "Use", parent: "Guide", nav_order: 2 }),
  "guide/use-cli.md": fm({ title: "CLI", parent: "Use", grand_parent: "Guide" }),
  "about.md": fm({ title: "About" }),
  "Zebra.md": fm({ title: "zebra" }),
  "hidden.md": fm({ title: "Hidden", nav_exclude: true }),
  "custom.md": fm({ title: "Custom", permalink: "/elsewhere/", nav_order: 3 }),
  "stray.md": fm({ title: "Stray", parent: "Nobody" }),
  "untitled.md": fm({ layout: "default" }),
  "_includes/x.md": fm({ title: "Not a page" }),
  "assets/y.md": fm({ title: "Not navigation" }),
  "plain.html": "<p>no front matter: copied through</p>",
};

describe("jekyllNavPages — what the theme's navigation lists", () => {
  const pages = jekyllNavPages(site(SITE));
  const titles = pages.map((p) => p.title).sort();
  test("titled pages only; nav_exclude, untitled, underscore and asset paths, and front-matter-less files are out", () => {
    expect(titles).toEqual(["About", "CLI", "Custom", "Guide", "Home", "Install", "Stray", "Use", "zebra"]);
  });
  test("addresses are Jekyll's: permalink honoured, index pages as their directory", () => {
    const url = (t: string) => pages.find((p) => p.title === t)!.url;
    expect(url("Home")).toBe("/");
    expect(url("Guide")).toBe("/guide/");
    expect(url("Install")).toBe("/guide/install.html");
    expect(url("Custom")).toBe("/elsewhere/");
  });
});

describe("pagesNav — the theme's tree and order, as rail rows", () => {
  const { items, orphans } = pagesNav(jekyllNavPages(site(SITE)), { prefix: ".." });
  test("top level by nav_order, then title case-insensitively", () => {
    expect(items.map((i) => i.label)).toEqual(["Home", "Guide", "Custom", "About", "Stray", "zebra"]);
  });
  test("children and grandchildren nest, folded with a count", () => {
    const guide = items.find((i) => i.label === "Guide")!;
    expect(guide.children!.map((i) => i.label)).toEqual(["Install", "Use"]);
    expect(guide.fold).toBe("2 pages");
    expect(guide.children![1]!.children!.map((i) => i.label)).toEqual(["CLI"]);
    expect(guide.href).toBe("../guide/");
  });
  test("a page whose parent is not listed stays reachable, and is reported", () => {
    expect(items.some((i) => i.label === "Stray")).toBe(true);
    expect(orphans).toEqual(["stray.md"]);
  });
  test("the current page is drawn as 'you are here', not a link", () => {
    const here = pagesNav(jekyllNavPages(site(SITE)), { here: "/guide/install.html" }).items;
    const install = here.find((i) => i.label === "Guide")!.children![0]!;
    expect(install.current).toBe(true);
    expect(install.href).toBeUndefined();
  });
});

describe("the rail carries Pages, from shared data too", () => {
  const PAGE = `<!doctype html><html><head><title>t</title></head><body><h1>T</h1></body></html>`;
  const pages = pagesNav(jekyllNavPages(site(SITE)), { prefix: "@root@" }).items;
  test("server-rendered and browser-drawn rails both show Pages, between the page's section and Folders", () => {
    const files = new Map<string, string>();
    const opts = { instance: "x", toRoot: "..", links: [{ href: "../library/", label: "Library" }], pages: pages.map((p) => JSON.parse(JSON.stringify(p).split("@root@").join(".."))) };
    const server = injectRail(PAGE, opts)!;
    const shared = expandRail(injectRail(PAGE, { ...opts, emitRailData: (f, b) => void files.set(f, b) })!, (n) => railDataJson(files.get(`assets/navbar/${n}.js`)!));
    for (const html of [server, shared]) {
      const labels = [...html.matchAll(/<details class="fa-nav-group"[^>]*><summary>[\s\S]*?<span class="fa-nav-label">([^<]*)</g)].map((m) => m[1]);
      expect(labels).toEqual([RAIL_SECTION_LABELS.pages, RAIL_SECTION_LABELS.folders]);
      expect(html).toContain('href="../guide/install.html"');
    }
  });
});

describe("xka5 — Pages grouped by harness from the URL, with sub-doc graphs from _config.yml defaults", () => {
  const HARNESS_SITE = {
    "_config.yml": [
      "defaults:",
      '  - scope: { path: "start" }',
      '    values: { parent: "Start here" }',
      '  - scope: { path: "concepts" }',
      '    values: { parent: "Concepts" }',
      '  - scope: { path: "*/README.md" }',
      "    values: { nav_exclude: true }",
      '  - scope: { path: "start/*" }',
      '    values: { permalink: "/docs/cat-harness/:path/:basename:output_ext" }',
      '  - scope: { path: "concepts/*" }',
      '    values: { permalink: "/docs/cat-harness/:path/:basename:output_ext" }',
    ].join("\n"),
    "index.md": fm({ title: "Home", nav_order: 1 }),
    "start/README.md": fm({ title: "Start README" }),
    "start/index.md": fm({ title: "Start here", parent: "" }),
    "start/installation.md": fm({ title: "Installation", nav_order: 99 }),
    "start/getting-started.md": fm({ title: "Getting started", nav_order: 1 }),
    "concepts/index.md": fm({ title: "Concepts", parent: "" }),
    "concepts/architecture.md": fm({ title: "Architecture" }),
    "concepts/theming.md": fm({ title: "Theming", parent: "Architecture", grand_parent: "Concepts" }),
    "who-iris/index.md": fm({ title: "WHO IRIS", permalink: "/docs/who-iris/" }),
    "who-iris/ingest.md": fm({ title: "Ingestion", parent: "WHO IRIS", permalink: "/docs/who-iris/ingest.html" }),
  };

  test("harnessOfUrl derives the harness from /docs/<h>/, /<outer>/docs/<h>/, and /<h>/docs/", () => {
    expect(harnessOfUrl("/docs/cat-harness/start/")).toBe("cat-harness");
    expect(harnessOfUrl("/docs/who-iris/ingest.html")).toBe("who-iris");
    expect(harnessOfUrl("/cat-harness/docs/smart-base/overview.html")).toBe("smart-base");
    expect(harnessOfUrl("/smart-base/docs/index.html")).toBe("smart-base");
    expect(harnessOfUrl("/")).toBeUndefined();
    expect(harnessOfUrl("/guide/install.html")).toBeUndefined();
  });

  test("_config.yml defaults supply parent and nav_exclude; parent: '' keeps a group index at its harness root", () => {
    const navPages = jekyllNavPages(site(HARNESS_SITE));
    expect(navPages.some((p) => p.title === "Start README")).toBe(false);
    expect(navPages.find((p) => p.title === "Start here")!.parent).toBeUndefined();
    expect(navPages.find((p) => p.title === "Installation")!.parent).toBe("Start here");
    expect(navPages.find((p) => p.title === "Architecture")!.parent).toBe("Concepts");
  });

  test("top level is Home plus the harnesses derived from the URL; sub-doc graphs nest below each harness", () => {
    const { items, orphans } = pagesNav(jekyllNavPages(site(HARNESS_SITE)), {
      prefix: "..",
      here: "/docs/cat-harness/concepts/theming.html",
      locale: "en",
    });
    expect(orphans).toEqual([]);
    expect(items.map((i) => i.label)).toEqual(["Home", "cat-harness", "WHO IRIS"]);
    const ch = items.find((i) => i.label === "cat-harness")!;
    expect(ch.fold).toBe("2 pages");
    expect(ch.children!.map((c) => c.label)).toEqual(["Concepts", "Start here"]);
    const start = ch.children!.find((c) => c.label === "Start here")!;
    expect(start.depth).toBe(1);
    expect(start.children!.map((c) => c.label)).toEqual(["Getting started", "Installation"]);
    expect(start.children![0]!.depth).toBe(2);
    const concepts = ch.children!.find((c) => c.label === "Concepts")!;
    const arch = concepts.children![0]!;
    expect(arch.label).toBe("Architecture");
    expect(arch.depth).toBe(2);
    const theming = arch.children![0]!;
    expect(theming.label).toBe("Theming");
    expect(theming.depth).toBe(3);
    expect(theming.current).toBe(true);
    const iris = items.find((i) => i.label === "WHO IRIS")!;
    expect(iris.href).toBe("../docs/who-iris/");
    expect(iris.children!.map((c) => c.label)).toEqual(["Ingestion"]);
  });
});

describe("xka5 — order within a level is alphabetical in the reader's locale", () => {
  const LOCALE_SITE = {
    "index.md": fm({ title: "Home", nav_order: 99 }),
    "angstrom.md": fm({ title: "Ångström", nav_order: 1 }),
    "apple.md": fm({ title: "apple", nav_order: 50 }),
    "zebra.md": fm({ title: "Zebra", nav_order: 2 }),
    "zebra-b.md": fm({ title: "beta", parent: "Zebra", nav_order: 1 }),
    "zebra-a.md": fm({ title: "Alpha", parent: "Zebra", nav_order: 2 }),
  };

  test("English ('en') sorts Ångström with A before apple and Zebra; Swedish ('sv') sorts Ångström after Zebra", () => {
    const pages = jekyllNavPages(site(LOCALE_SITE));
    const en = pagesNav(pages, { locale: "en" }).items;
    const sv = pagesNav(pages, { locale: "sv" }).items;
    expect(en.map((i) => i.label)).toEqual(["Home", "Ångström", "apple", "Zebra"]);
    expect(sv.map((i) => i.label)).toEqual(["Home", "apple", "Zebra", "Ångström"]);
    expect(en.find((i) => i.label === "Zebra")!.children!.map((c) => c.label)).toEqual(["Alpha", "beta"]);
  });

  test("pageLangOf reads <html lang='…'> and defaults to 'en'", () => {
    expect(pageLangOf('<!doctype html><html lang="sv"><head></head><body></body></html>')).toBe("sv");
    expect(pageLangOf("<!doctype html><html><head></head><body></body></html>")).toBe("en");
  });
});

describe("#1261 — Bibliography: … and Tools — … pages fold under one parent", () => {
  const FAMILY = {
    "index.md": fm({ title: "Home" }),
    "bib/w3c.md": fm({ title: "Bibliography: library/w3c" }),
    "bib/who.md": fm({ title: "Bibliography: library/who" }),
    "glossary.md": fm({ title: "Glossary" }),
    "tools/index.md": fm({ title: "Tools" }),
    "tools/ch.md": fm({ title: "Tools — cat-harness" }),
    "tools/iris.md": fm({ title: "Tools — who-iris" }),
    "notes.md": fm({ title: "Note: alone" }),
  };
  const { items } = pagesNav(jekyllNavPages(site(FAMILY)), { prefix: "..", here: "/tools/iris.html" });
  test("one Bibliography and one Tools row; a family of one stays flat", () => {
    expect(items.map((i) => i.label)).toEqual(["Bibliography", "Glossary", "Home", "Note: alone", "Tools"]);
  });
  test("with no Bibliography page, the parent is a label-only fold", () => {
    const bib = items.find((i) => i.label === "Bibliography")!;
    expect(bib.href).toBeUndefined();
    expect(bib.fold).toBe("2 pages");
    expect(bib.children!.map((i) => [i.label, i.depth, i.href])).toEqual([
      ["library/w3c", 1, "../bib/w3c.html"],
      ["library/who", 1, "../bib/who.html"],
    ]);
  });
  test("the Tools page is the parent and keeps its link; the current page stays current inside", () => {
    const tools = items.find((i) => i.label === "Tools")!;
    expect(tools.href).toBe("../tools/");
    expect(tools.children!.map((i) => i.label)).toEqual(["cat-harness", "who-iris"]);
    expect(tools.children![1]!.current).toBe(true);
  });
});

describe("bibliography pages nest under Bibliography by parent (owner, 2026-11-10)", () => {
  // A reference's own page was listed at the top level of the Pages list.
  const BIB = {
    "index.md": fm({ title: "Home" }),
    "bibliography/index.md": fm({ title: "Bibliography" }),
    "bibliography/cat/index.md": fm({ title: "Bibliography: si-catalogue", parent: "Bibliography" }),
    "bibliography/cat/openhie/index.md": fm({ title: "Open Health Information Exchange", parent: "Bibliography: si-catalogue", grand_parent: "Bibliography" }),
    "bibliography/lib/index.md": fm({ title: "Bibliography: library", parent: "Bibliography" }),
    "bibliography/lib/knot/index.md": fm({ title: "Bibliography: library/knot", parent: "Bibliography: library", grand_parent: "Bibliography" }),
  };
  const { items, orphans } = pagesNav(jekyllNavPages(site(BIB)));
  test("only Home and Bibliography at the top; entries two levels down", () => {
    expect(orphans).toEqual([]);
    expect(items.map((i) => i.label)).toEqual(["Bibliography", "Home"]);
    const bib = items.find((i) => i.label === "Bibliography")!;
    expect(bib.children!.map((i) => [i.label, i.depth])).toEqual([
      ["library", 1],
      ["si-catalogue", 1],
    ]);
    expect(bib.children![1]!.children!.map((i) => [i.label, i.depth])).toEqual([["Open Health Information Exchange", 2]]);
    expect(bib.children![0]!.children!.map((i) => i.label)).toEqual(["knot"]);
  });
  test("labelUnder drops only what the parent already says", () => {
    expect(labelUnder("Bibliography: x", "Bibliography")).toBe("x");
    expect(labelUnder("Bibliography: x/y", "Bibliography: x")).toBe("y");
    expect(labelUnder("WHO: a handbook", "Bibliography: x")).toBe("WHO: a handbook");
    expect(labelUnder("Plain", "Bibliography")).toBe("Plain");
  });
});

describe("a page that declares its own navigation gives its Pages subtree (owner, 2026-11-14)", () => {
  // A page set with a menu of its own: a section page whose front matter makes
  // stub group pages, items ordered by nav_order, and a declaration of the menu
  // in the built page. Before: the subtree sorted alphabetically, the stubs
  // shown as groups, and every entry that is not a Jekyll page missing.
  const SOURCE = {
    "index.md": fm({ title: "Guide", has_children: true, nav_order: 900 }),
    "menu-home.md": fm({ title: "Home", parent: "Guide", nav_order: 1, has_children: true }),
    "faq.md": fm({ title: "FAQ", parent: "Home", grand_parent: "Guide", nav_order: 2 }),
    "dependencies.md": fm({ title: "Dependencies", parent: "Home", grand_parent: "Guide", nav_order: 1 }),
    "menu-indices.md": fm({ title: "Indices", parent: "Guide", nav_order: 3, has_children: true }),
    "maps.md": fm({ title: "Mappings", parent: "Indices", grand_parent: "Guide", nav_order: 3 }),
    "license.md": fm({ title: "License", parent: "Indices", grand_parent: "Guide", nav_order: 4 }),
    "notes.md": fm({ title: "Notes", parent: "Guide", nav_order: 5 }),
    "about.md": fm({ title: "About", nav_order: 1 }),
  };
  const MENU = [
    { label: "Home", items: [
      { label: "Summary", href: "./index.html" },
      { label: "Dependencies", href: "./dependencies.html" },
      { label: "FAQ", href: "./faq.html" },
    ] },
    { label: "Framework", href: "./framework.pdf" },
    { label: "Indices", items: [
      { label: "Artifact Index", href: "./artifacts.html" },
      { label: "Bibliography", href: "https://example.org/bib/" },
      { label: "Profile: B", href: "./maps.html" },
      { label: "Profile: A", href: "./license.html" },
    ] },
  ];
  const built = site({
    "index.html": `<html><body><script type="application/json" data-fa-visualiser-nav>${JSON.stringify(MENU)}</script></body></html>`,
    "about.html": `<html><body><script type="application/json" data-fa-visualiser-nav>[{"label":"Top","href":"#top"}]</script></body></html>`,
  });
  const pages = jekyllNavPages(site(SOURCE));
  const declared = declaredNavsIn(built, pages);
  const tree = (items: readonly { label: string; href?: string; children?: readonly unknown[] }[], ind = ""): string[] =>
    items.flatMap((i) => [`${ind}${i.label}${i.href ? ` ${i.href}` : ""}`, ...tree((i.children ?? []) as typeof items, `${ind}  `)]);

  test("declaredNavsIn reads a parent page's declaration with site-absolute hrefs; anchors and leaf pages give none", () => {
    expect([...declared.keys()]).toEqual(["/"]);
    const d = declared.get("/")!;
    expect(d.map((e) => e.label)).toEqual(["Home", "Framework", "Indices"]);
    expect(d[0]!.items!.map((k) => k.href)).toEqual(["/index.html", "/dependencies.html", "/faq.html"]);
    expect(d[1]!.href).toBe("/framework.pdf");
    expect(d[2]!.items![1]!.href).toBe("https://example.org/bib/");
    expect(siteAbsoluteDeclaration([{ label: "Top", href: "#top" }], ".")).toBeUndefined();
  });

  test("the declaring page's children are the declaration: same entries, order and nesting, unsorted and unfolded; stubs gone, uncovered pages kept after", () => {
    const { items } = pagesNav(pages, { prefix: "..", locale: "en", declared });
    expect(tree(items)).toEqual([
      "Guide ../",
      "  Home",
      "    Summary ../index.html",
      "    Dependencies ../dependencies.html",
      "    FAQ ../faq.html",
      "  Framework ../framework.pdf",
      "  Indices",
      "    Artifact Index ../artifacts.html",
      "    Bibliography https://example.org/bib/",
      "    Profile: B ../maps.html",
      "    Profile: A ../license.html",
      "  Notes ../notes.html",
      "About ../about.html",
    ]);
    const guide = items.find((i) => i.label === "Guide")!;
    expect(guide.fold).toBe("4 pages");
    expect(guide.children!.map((c) => c.depth)).toEqual([1, 1, 1, 1]);
    expect(guide.children![0]!.children!.map((c) => c.depth)).toEqual([2, 2, 2]);
  });

  test("without declarations the front-matter tree is unchanged: stubs as groups, sorted in the reader's locale", () => {
    const { items } = pagesNav(pages, { prefix: "..", locale: "en" });
    const guide = items.find((i) => i.label === "Guide")!;
    expect(guide.children!.map((c) => c.label)).toEqual(["Home", "Indices", "Notes"]);
    expect(guide.children![0]!.href).toBe("../menu-home.html");
  });
});
