/**
 * `strip-preview-seo` — a preview must not claim to be canonical.
 *
 * The tests worth having are the ones that pin WHAT COUNTS as an identity
 * claim, because the cost of the two mistakes is asymmetric. Leaving a claim
 * in invites a crawler to index a branch build that will be pruned; removing
 * too much deletes a folio's DATA. So the narrowness of the JSON-LD match is
 * tested as carefully as the match itself.
 */
import { describe, test, expect, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { stripSeo, runStripPreviewSeo } from "../../strip-preview-seo";

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function site(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "folio-seo-"));
  dirs.push(root);
  for (const [path, body] of Object.entries(files)) {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body);
  }
  return root;
}

/** The three tags exactly as `jekyll-seo-tag` emits them under a staging baseurl. */
const CANONICAL =
  '<link rel="canonical" href="https://litlfred.github.io/folio-assistant/STAGING/claude-x/a.html" />';
const OG_URL =
  '<meta property="og:url" content="https://litlfred.github.io/folio-assistant/STAGING/claude-x/a.html" />';
const LD_JSON =
  '<script type="application/ld+json">\n' +
  '{"@context":"https://schema.org","@type":"WebPage","headline":"A",' +
  '"url":"https://litlfred.github.io/folio-assistant/STAGING/claude-x/a.html"}</script>';

describe("stripSeo", () => {
  test("removes all three claims and counts each", () => {
    const { html, removed } = stripSeo(
      `<head>\n${CANONICAL}\n${OG_URL}\n${LD_JSON}\n</head>`,
    );
    expect(removed).toEqual({ canonical: 1, ogUrl: 1, jsonLd: 1 });
    expect(html).not.toContain("canonical");
    expect(html).not.toContain("og:url");
    expect(html).not.toContain("ld+json");
    // The surrounding document survives — this is a deletion, not a rewrite.
    expect(html).toContain("<head>");
    expect(html).toContain("</head>");
  });

  test("leaves every other rel, property and meta alone", () => {
    // `rel="icon"` and `og:title` are the near-misses that a loose pattern eats.
    const src = [
      '<link rel="icon" type="image/svg+xml" href="/a/icon.svg">',
      '<link rel="stylesheet" href="/a/x.css">',
      '<meta property="og:title" content="A">',
      '<meta property="og:locale" content="en">',
      '<meta name="description" content="x">',
    ].join("\n");
    const { html, removed } = stripSeo(src);
    expect(removed).toEqual({ canonical: 0, ogUrl: 0, jsonLd: 0 });
    expect(html).toBe(src);
  });

  /**
   * The expensive mistake. A folio's knowledge-graph export IS a JSON-LD
   * document, and a page may inline a fragment of one — removing that deletes
   * CONTENT, not a claim. So the match requires BOTH a schema.org `@context`
   * and a `url` key, which is the `jekyll-seo-tag` shape and not a graph's.
   */
  test("a folio's own JSON-LD is content and is never touched", () => {
    const graph =
      '<script type="application/ld+json">\n' +
      '{"@context":{"cat":"https://litlfred.github.io/cat-harness/v0/ns/"},' +
      '"@graph":[{"@id":"cat:skill/x","@type":"cat:Skill"}]}</script>';
    const { html, removed } = stripSeo(graph);
    expect(removed.jsonLd).toBe(0);
    expect(html).toBe(graph);
  });

  test("a schema.org block with no url is left alone too", () => {
    // Structured data that describes the SITE rather than asserting this page's
    // address is not the claim being removed.
    const org =
      '<script type="application/ld+json">' +
      '{"@context":"https://schema.org","@type":"Organization","name":"x"}</script>';
    expect(stripSeo(org).removed.jsonLd).toBe(0);
  });

  test("running twice is a no-op", () => {
    const once = stripSeo(`<head>${CANONICAL}${OG_URL}</head>`).html;
    const twice = stripSeo(once);
    expect(twice.removed).toEqual({ canonical: 0, ogUrl: 0, jsonLd: 0 });
    expect(twice.html).toBe(once);
  });

  test("single quotes and mixed case are matched", () => {
    const { removed } = stripSeo(
      "<LINK REL='canonical' href='/a'>\n<META PROPERTY='og:url' content='/a'>",
    );
    expect(removed).toEqual({ canonical: 1, ogUrl: 1, jsonLd: 0 });
  });
});

describe("runStripPreviewSeo", () => {
  test("walks the tree, writes, and reports what it removed", () => {
    const root = site({
      "index.html": `<head>${CANONICAL}</head>`,
      "guides/a.html": `<head>${OG_URL}${LD_JSON}</head>`,
      "assets/x.css": "body{}",
      "folio.jsonld": '{"@context":{}}',
    });
    const r = runStripPreviewSeo({ site: root });

    expect(r.exitCode).toBe(0);
    expect(r.filesSeen).toBe(2); // only .html
    expect(r.filesChanged).toBe(2);
    expect(r.removed).toEqual({ canonical: 1, ogUrl: 1, jsonLd: 1 });
    expect(readFileSync(join(root, "index.html"), "utf-8")).not.toContain("canonical");
    // A non-HTML sibling is never rewritten, and the export in particular.
    expect(readFileSync(join(root, "folio.jsonld"), "utf-8")).toBe('{"@context":{}}');
  });

  test("--dry-run reports without writing", () => {
    const root = site({ "index.html": `<head>${CANONICAL}</head>` });
    const r = runStripPreviewSeo({ site: root, dryRun: true });

    expect(r.removed.canonical).toBe(1);
    expect(r.text).toContain("would remove");
    expect(readFileSync(join(root, "index.html"), "utf-8")).toContain("canonical");
  });

  /**
   * The third-state rule. A pass that could not read the tree has not
   * established that the tree is clean, and "0 removed" would be
   * indistinguishable from a site that legitimately had none.
   */
  test("an unreadable site is an error, not a clean pass", () => {
    const r = runStripPreviewSeo({ site: join(tmpdir(), "folio-seo-absent-xyz") });
    expect(r.exitCode).toBe(2);
    expect(r.text).toContain("could not read");
    expect(r.removed).toEqual({ canonical: 0, ogUrl: 0, jsonLd: 0 });
  });

  test("a site with no claims exits 0 and says so", () => {
    const root = site({ "index.html": "<head><title>a</title></head>" });
    const r = runStripPreviewSeo({ site: root });
    expect(r.exitCode).toBe(0);
    expect(r.filesChanged).toBe(0);
    expect(r.text).toContain("1 page(s) seen, 0 changed");
  });
});
