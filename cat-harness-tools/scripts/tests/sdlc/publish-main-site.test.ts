import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { isOwnPath, MANIFEST, publish } from "../../publish-main-site.ts";

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "main-site-"));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  return root;
}

describe("publish-main-site (bean 5uuf)", () => {
  test("the first publish writes the site and a manifest, and leaves everything else alone", () => {
    const pages = tree({ "STAGING/pr-1/index.html": "preview", CNAME: "folio.example", "_render-log/a.json": "{}" });
    const site = tree({ "index.html": "main", "doc/a.html": "a" });
    const r = publish({ site, pages, commit: "abc" });
    expect(r).toEqual({ written: 2, removed: 0, leftAlone: 1, firstPublish: true });
    expect(readFileSync(join(pages, "doc/a.html"), "utf8")).toBe("a");
    expect(readFileSync(join(pages, "STAGING/pr-1/index.html"), "utf8")).toBe("preview");
    expect(existsSync(join(pages, "CNAME"))).toBe(true);
    expect(JSON.parse(readFileSync(join(pages, MANIFEST), "utf8")).files).toEqual(["doc/a.html", "index.html"]);
  });

  test("a later publish removes the pages main stopped producing, and only those", () => {
    const pages = tree({ CNAME: "folio.example", "STAGING/pr-1/doc/a.html": "preview" });
    publish({ site: tree({ "index.html": "v1", "doc/a.html": "a" }), pages });
    const r = publish({ site: tree({ "index.html": "v2" }), pages });
    expect(r.removed).toBe(2);
    expect(existsSync(join(pages, "doc/a.html"))).toBe(false);
    expect(readFileSync(join(pages, "index.html"), "utf8")).toBe("v2");
    expect(existsSync(join(pages, "CNAME"))).toBe(true);
    expect(existsSync(join(pages, "STAGING/pr-1/doc/a.html"))).toBe(true);
  });

  test("a site that writes into a reserved path is refused before anything changes", () => {
    const pages = tree({ "STAGING/pr-1/index.html": "preview" });
    expect(() => publish({ site: tree({ "STAGING/pr-1/index.html": "clobber" }), pages })).toThrow(/reserved/);
    expect(readFileSync(join(pages, "STAGING/pr-1/index.html"), "utf8")).toBe("preview");
    expect(existsSync(join(pages, MANIFEST))).toBe(false);
  });

  test("an empty site is refused, so main keeps its last site", () => {
    const pages = tree({ "index.html": "old" });
    expect(() => publish({ site: tree({}), pages })).toThrow(/empty/);
    expect(readFileSync(join(pages, "index.html"), "utf8")).toBe("old");
  });

  test("a manifest naming a path outside the main site is refused, not followed", () => {
    const pages = tree({
      "STAGING/pr-1/index.html": "preview",
      [MANIFEST]: JSON.stringify({ $schema: "folio-main-site/v1", commit: null, files: ["STAGING/pr-1/index.html"] }),
    });
    expect(() => publish({ site: tree({ "index.html": "x" }), pages })).toThrow(/not the main site's/);
    expect(existsSync(join(pages, "STAGING/pr-1/index.html"))).toBe(true);
  });

  test("a manifest that is not one is an error, never read as 'no manifest'", () => {
    const pages = tree({ [MANIFEST]: "{}" });
    expect(() => publish({ site: tree({ "index.html": "x" }), pages })).toThrow(/folio-main-site\/v1/);
  });

  test("own paths exclude escapes and reserved names", () => {
    expect(isOwnPath("doc/a.html")).toBe(true);
    // input-site: inert #46ee0ca7 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    for (const p of ["", "/etc/x", "../x", "a/../b", "./a", "STAGING/x", "_render-log/x", MANIFEST, ".git/config"]) {
      expect(isOwnPath(p)).toBe(false);
    }
  });
});
