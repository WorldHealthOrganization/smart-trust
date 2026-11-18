/**
 * The site CHROME subgraph (proposal semantic-subgraphs-2026-10-09, slice 1;
 * owner, 2026-10-09: "go ahead with the cat-harness chrome subgraph").
 *
 * Pins three things: the site layers are read off the declaration in order,
 * base first; a site file resolves later-wins across them, as compose-docs
 * lays them down; and cat-harness's own chrome is the base, holding the files
 * the slice moved, with its `_config.yml` merging with `docs/`'s to the
 * settings the single file had (ruling D1, parse-equal).
 */
import { describe, expect, test } from "bun:test";
import { type Dirent, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Liquid } from "liquidjs";
import { parse as parseYaml } from "yaml";

import { siteChromeDirFor, siteDirFor, siteFileFor, siteLayersFor } from "./kg/cat-harness.js";

import { requireHarnessRoot } from "./harness-root.ts";
const HARNESS = requireHarnessRoot();

function instance(directories: unknown[], files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "site-chrome-"));
  writeFileSync(join(root, "acme.json"), JSON.stringify({ name: "acme", version: "0.1.0", directories }));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  return root;
}

describe("site layers", () => {
  test("one docs directory: every answer is siteDirFor's", () => {
    const root = instance([{ id: "pages", path: `${siteDirFor(HARNESS)}/`, graphTypologies: ["docs"] }], {});
    try {
      expect(siteLayersFor(root)).toEqual([siteDirFor(root)]);
      expect(siteChromeDirFor(root)).toBe(siteDirFor(root));
      expect(siteFileFor(root, "assets/css/a.css")).toBe(join(siteDirFor(root), "assets/css/a.css"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a chrome layer declared first is the base; a file resolves to the top-most layer holding it", () => {
    const root = instance(
      [
        { id: "chrome", path: "chrome/", graphTypologies: ["docs"] },
        { id: "pages", path: "pages/", graphTypologies: ["docs"] },
        { id: "root-pages", path: "../pages/", graphTypologies: ["docs"], scope: "repository" },
      ],
      { "chrome/_includes/head_custom.html": "c", "chrome/_config.yml": "a: 1", "pages/_config.yml": "b: 2" },
    );
    try {
      // `siteDirFor` is always a layer, appended when undeclared; the declared
      // ones keep their order and the repository-scoped one is not a layer.
      expect(siteLayersFor(root)).toEqual(["chrome", "pages", siteDirFor(root)]);
      expect(siteChromeDirFor(root)).toBe("chrome");
      expect(siteFileFor(root, "_includes/head_custom.html")).toBe(join("chrome", "_includes/head_custom.html"));
      expect(siteFileFor(root, "_config.yml")).toBe(join("pages", "_config.yml"));
      // Held by no layer: written where the chrome lives.
      expect(siteFileFor(root, "assets/css/new.css")).toBe(join("chrome", "assets/css/new.css"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("cat-harness's own site chrome", () => {
  test("is declared before docs, so it is the base layer", () => {
    expect(siteLayersFor(HARNESS)).toEqual(["site-chrome", siteDirFor(HARNESS)]);
    expect(siteChromeDirFor(HARNESS)).toBe("site-chrome");
  });

  test("holds the chrome the slice moved, and docs/ no longer does", () => {
    for (const rel of [
      "_includes/head_custom.html",
      "_includes/footer_custom.html",
      "_includes/nav_footer_custom.html",
      "_includes/mermaid_config.js",
      "assets/css/docs-ui.css",
      "assets/js/docs-ui.js",
      "assets/js/navbar.js",
      "Gemfile",
    ]) {
      expect(siteFileFor(HARNESS, rel)).toBe(join(siteChromeDirFor(HARNESS), rel));
      expect(existsSync(join(HARNESS, siteDirFor(HARNESS), rel))).toBe(false);
    }
    // Ruling D2: the harness pages' own assets stay with the pages.
    for (const rel of ["assets/js/work-plan.js", "assets/js/process-index.js", "assets/js/slice-sqlite.js", "assets/js/kg-render.js"]) {
      expect(siteFileFor(HARNESS, rel)).toBe(join(siteDirFor(HARNESS), rel));
    }
  });

  test("an include the chrome pulls in exists in the chrome alone, so a site with no harness pages builds", () => {
    for (const rel of ["_includes/generated/navbar-footer.html", "_includes/generated/todo-listing.html"]) {
      expect(existsSync(join(HARNESS, siteChromeDirFor(HARNESS), rel))).toBe(true);
    }
  });

  test("the nav is cached: each theme override looks its answer up in a map rendered once per build", () => {
    // "Cache the nav": the theme re-derives a page's place in the nav on
    // every page, O(pages^2) for the site. Each override fetches a map that
    // `include_cached` renders once; an override that lost that line, or a
    // map that moved, would put the quadratic cost back without failing the
    // build.
    const overrides: Record<string, string> = {
      "_includes/css/activation.scss.liquid": "nav_cache/activation_map.html",
      "_includes/components/breadcrumbs.html": "nav_cache/breadcrumbs_map.html",
      "_includes/components/children_nav.html": "nav_cache/parenthood_map.html",
    };
    for (const [rel, map] of Object.entries(overrides)) {
      const body = readFileSync(join(HARNESS, siteChromeDirFor(HARNESS), rel), "utf-8");
      expect(body).toContain(`{%- include_cached ${map} -%}`);
      expect(existsSync(join(HARNESS, siteChromeDirFor(HARNESS), "_includes", map))).toBe(true);
      // A map depends on `site` alone; `page` in it would be cached from
      // whichever page rendered first.
      const mapBody = readFileSync(join(HARNESS, siteChromeDirFor(HARNESS), "_includes", map), "utf-8")
        .replace(/{%-? comment -?%}[\s\S]*?{%-? endcomment -?%}/g, "");
      expect(mapBody).not.toMatch(/\bpage\./);
    }
  });

  test("the two _config.yml layers merge to a config with the theme keys and the site's identity (D1)", () => {
    const chrome = parseYaml(readFileSync(join(HARNESS, siteChromeDirFor(HARNESS), "_config.yml"), "utf-8")) as Record<string, unknown>;
    const docs = parseYaml(readFileSync(join(HARNESS, siteDirFor(HARNESS), "_config.yml"), "utf-8")) as Record<string, unknown>;
    expect(chrome.remote_theme).toMatch(/^just-the-docs\/just-the-docs@/);
    expect(docs.remote_theme).toBeUndefined();
    expect(chrome.title).toBeUndefined();
    expect(docs.title).toBeDefined();
    // Lists replace, so the overlay restates what the chrome excludes.
    for (const x of chrome.exclude as string[]) expect(docs.exclude as string[]).toContain(x);
  });
});

/**
 * The theme's markup passes must not reach raw-text elements (owner's report,
 * 2026-10-15: /en/cat-harness/schemas/bootstrap/ never loaded). just-the-docs
 * rewrites every `<hN>` in a page's content (`vendor/anchor_headings.html`)
 * and every `<table` in the whole page (`table_wrappers.html`) by string
 * replacement, so a generator that builds HTML in an inline script had its
 * string literals broken and the script did not parse. The chrome overrides
 * both to leave `<script>` and `<style>` bodies alone. Rendered here with
 * liquidjs, Jekyll-include mode: the same Liquid, not the same engine, so the
 * local Jekyll build in the PR is the other half of the evidence.
 */
describe("the theme's markup passes leave <script> and <style> alone", () => {
  const chrome = join(HARNESS, siteChromeDirFor(HARNESS));
  const engine = new Liquid({ root: join(chrome, "_includes"), jekyllInclude: true, extname: "" });
  // The theme's own call, from its `_layouts/default.html`, less the svg.
  const call = (file: string) =>
    `{% include ${file} html=content beforeHeading="true" anchorBody="#" anchorClass="anchor-heading" anchorAttrs="data-x" %}`;
  const anchored = (content: string, file = "vendor/anchor_headings.html") => engine.parseAndRender(call(file), { content });
  const tableWrappers = (content: string) =>
    engine.parseAndRender(readFileSync(join(chrome, "_layouts/table_wrappers.html"), "utf-8").replace(/^---\n[\s\S]*?\n---\n/, ""), { content });
  /** Every inline classic script in `html`, and whether it parses. */
  const scripts = (html: string) =>
    [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => {
      try {
        // input-site: inert #ec7c3244 — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
        new Function(m[1]);
        return { body: m[1], parses: true };
      } catch {
        return { body: m[1], parses: false };
      }
    });

  // What gen-schema-viz.ts emits, cut down: HTML built in JavaScript.
  const script = `<script>\nvar h = '<h2>' + esc(d.name) + '</h2><p class="sub">';\nh += "<table><caption class=\\"sub\\">Fields</caption></table>";\nvar s = "<script" + ">";\n</script>`;
  const style = `<style>\n/* <h4>not a heading</h4> <table> */ .a { color: red }\n</style>`;
  const page = `<h2 id="one">One</h2>\n<p>x</p>\n${script}\nafter text <h3 id="two">Two</h3>\n${style}\n<h4 id="three">Three</h4>`;

  test("the theme's pass alone breaks the script (the defect, reproduced)", async () => {
    const out = await anchored(page, "vendor/anchor_headings_core.html");
    expect(scripts(out).some((s) => !s.parses)).toBe(true);
    expect(scripts(out)[0].body).toContain("anchor-heading");
  });

  test("anchor_headings: script and style bodies come through byte for byte; every heading outside them is anchored", async () => {
    const out = await anchored(page);
    expect(out).toContain(script);
    expect(out).toContain(style);
    expect(scripts(out).every((s) => s.parses)).toBe(true);
    for (const id of ["one", "two", "three"]) expect(out).toContain(`<a href="#${id}" class="anchor-heading" data-x>#</a>`);
    // The text before a heading is not read as a heading's tail ("<hafter").
    expect(out).toContain("after text ");
    expect(out).not.toContain("<hafter");
  });

  test("anchor_headings: content with no script or style is exactly the theme's pass", async () => {
    const plain = `<h1 id="a">A</h1>\n<p>p</p>\n<h2 id="b">B <code>c</code></h2>\n<hr>\n<h3>no id</h3>`;
    expect(await anchored(plain)).toBe(await anchored(plain, "vendor/anchor_headings_core.html"));
  });

  test("table_wrappers: tables outside raw text are wrapped, the script's are not", async () => {
    const whole = `<!DOCTYPE html>\n<html><head>${style}</head><body>\n<table><tr><td>1</td></tr></table>\n${script}\n</body></html>`;
    const out = await tableWrappers(whole);
    expect(out).toContain(script);
    expect(out).toContain(style);
    expect(out).toContain(`<div class="table-wrapper"><table><tr><td>1</td></tr></table></div>`);
    expect(out.match(/table-wrapper/g)?.length).toBe(1);
    expect(scripts(out).every((s) => s.parses)).toBe(true);
  });

  test("the theme's include is kept, renamed, for the override to call", () => {
    const core = readFileSync(join(chrome, "_includes/vendor/anchor_headings_core.html"), "utf-8");
    expect(core).toContain("https://github.com/allejo/jekyll-anchor-headings");
    expect(readFileSync(join(chrome, "_includes/vendor/anchor_headings.html"), "utf-8")).toContain("include vendor/anchor_headings_core.html");
  });
});

/**
 * `?v=` on a first-party asset is a hash of the asset, never the build time
 * (bean `g196`, 2026-10-23). `site.time` is new on every build, so a page that
 * prints it differs on every rebuild, and every re-push of a branches/ preview
 * stored a whole new copy of its HTML. The hash itself is computed by
 * `_plugins/fa-asset-version.rb` once Jekyll has rendered everything; this
 * pins the templates' side of the contract, which is what an edit breaks.
 */
describe("first-party asset versions", () => {
  const roots = ["site-chrome", "docs"].map((d) => join(HARNESS, d));
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e: Dirent) =>
      e.isDirectory() ? walk(join(dir, e.name)) : /\.(html|md|liquid|scss|js|json)$/.test(e.name) ? [join(dir, e.name)] : [],
    );

  test("no template prints site.time, so a rebuild with no source change renders the same bytes", () => {
    const offenders = roots.flatMap(walk).filter((f) => /\{\{[^}]*site\.time|\{%[^%]*site\.time/.test(readFileSync(f, "utf-8")));
    expect(offenders).toEqual([]);
  });

  test("every ?v= in head_custom.html hashes the very asset its URL names", () => {
    const head = readFileSync(join(HARNESS, siteChromeDirFor(HARNESS), "_includes/head_custom.html"), "utf-8");
    const tags = [...head.matchAll(/\{\{ '([^']+)' \| relative_url \}\}\?v=\{\{ '([^']+)' \| ([a-z_]+) \}\}/g)];
    expect(tags.length).toBeGreaterThanOrEqual(10);
    for (const [, url, hashed, filter] of tags) {
      expect({ url, filter }).toEqual({ url: hashed, filter: "fa_asset_version" });
    }
    // Any ?v= not in that shape would escape the check above.
    expect((head.match(/\?v=/g) ?? []).length).toBe(tags.length + (head.match(/\?v=<content hash>/g) ?? []).length);
  });

  test("harness-data.js, which carries live counts, is loaded with no ?v", () => {
    // A ?v naming its content would put every count change into every page
    // (1,351 pages for one bean count, measured 2026-10-23).
    const head = readFileSync(join(HARNESS, siteChromeDirFor(HARNESS), "_includes/head_custom.html"), "utf-8");
    const tag = /<script src="\{\{ '\/assets\/js\/harness-data\.js' \| relative_url \}\}([^"]*)"/.exec(head);
    expect(tag?.[1]).toBe("");
  });

  test("the filter is defined in the chrome, so every site that mounts the chrome has it", () => {
    const plugin = readFileSync(join(HARNESS, siteChromeDirFor(HARNESS), "_plugins/fa-asset-version.rb"), "utf-8");
    expect(plugin).toMatch(/def fa_asset_version\(/);
    expect(plugin).toMatch(/register_filter\(FaAssetVersion::Filter\)/);
    expect(plugin).toMatch(/Hooks\.register :site, :post_render/);
    // Never falls back to the build time: that is the churn this replaced.
    // Code only: the comments explain why, and naming site.time is how they do it.
    const code = plugin.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
    expect(code).not.toMatch(/site\.time|Time\.now/);
  });
});

/**
 * A template's explanation is a Liquid comment, never an HTML one (owner,
 * 2026-11-08: "strip template comments"). An HTML comment in an include is
 * copied into every page that renders it: head_custom.html's notes were
 * ~31 KB of each page's 50 KB. Only short `fa-` markers stay, which tests and
 * scripts locate blocks by.
 */
describe("the chrome's includes carry no HTML comments into pages", () => {
  const includes = join(HARNESS, siteChromeDirFor(HARNESS), "_includes");
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e: Dirent) =>
      // vendor/ holds third-party includes kept as their authors wrote them.
      e.isDirectory() ? (e.name === "vendor" ? [] : walk(join(dir, e.name))) : /\.html$/.test(e.name) ? [join(dir, e.name)] : [],
    );
  test("every HTML comment outside <script>/<style> is a fa- marker", async () => {
    // An HTML parser, not a regex: it reports the comments a browser would see,
    // and a comment-like string inside a <script> or <style> is raw text to it.
    const offenders: string[] = [];
    for (const f of walk(includes)) {
      await new HTMLRewriter()
        .onDocument({
          comments(c) {
            if (c.text.startsWith("[") || /^\s*fa-[a-z0-9:-]+\s*$/.test(c.text)) return;
            offenders.push(`${f.slice(includes.length + 1)}: ${c.text.trim().slice(0, 60)}`);
          },
        })
        .transform(new Response(readFileSync(f, "utf-8")))
        .text();
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * Same-site links on an HTML page are relative to the page (bean `g196`,
 * 2026-10-23), so a page that did not change is the same bytes in every
 * branches/ preview. `_plugins/fa-root-relative.rb` does the work at build
 * time; this pins the pieces an edit could quietly undo.
 */
describe("page-relative links", () => {
  const plugin = readFileSync(join(HARNESS, siteChromeDirFor(HARNESS), "_plugins/fa-root-relative.rb"), "utf-8");
  const head = readFileSync(join(HARNESS, siteChromeDirFor(HARNESS), "_includes/head_custom.html"), "utf-8");

  test("the plugin swaps the base for a token once the site is read, before generators run, and resolves it after rendering", () => {
    // Not `pre_render`: jekyll-relative-links rewrites `.md` links at GENERATE
    // time, and a swap after that left every one of them absolute.
    expect(plugin).toMatch(/Hooks\.register :site, :post_read[\s\S]*swap_in/);
    expect(plugin).toMatch(/Hooks\.register :site, :post_render[\s\S]*resolve/);
    // The real base is put back however resolving ends, or `jekyll serve`
    // would go on serving under the token.
    expect(plugin).toMatch(/ensure\s+site\.config\["baseurl"\] = @real\.delete/);
  });

  test("an absolute URL keeps the real base: an identity is never relativized", () => {
    expect(plugin).toMatch(/origin \? "#\{origin\}#\{base\}" : root/);
  });

  test("404.html keeps the real base: GitHub Pages serves it at whatever depth was missing", () => {
    expect(plugin).toMatch(/return false if item\.url == "\/404\.html"/);
  });

  test("fa-staging says only WHETHER this is a preview, never which one", () => {
    const meta = head.split("\n").find((l) => l.includes('name="fa-staging"'))!;
    expect(meta).toBe('<meta name="fa-staging" content="{% if site.data.build.staging_slug %}preview{% endif %}">');
  });
});
