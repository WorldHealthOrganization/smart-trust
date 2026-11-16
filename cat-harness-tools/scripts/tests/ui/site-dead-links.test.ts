/**
 * The built-site link check, and the two repointings `--fix` makes
 * (litlfred/folio-assistant#2741).
 *
 * Calibrated: removing the locale fallback from `repointFor` fails "a missing
 * translation falls back"; making `sourceFor` take the first of several hits
 * fails "an ambiguous source is left dead".
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { blobUrl, checkSite, isInternal, publishedFor, publishedRootOf, sourceCandidates, sourceFor, tailIndex, targetOf, withoutLocale } from "../../site-dead-links.ts";

function site(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "site-dead-links-"));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return root;
}

describe("which links are checked", () => {
  it("skips external, anchor, Liquid, ellipsis-placeholder and script-template values", () => {
    for (const v of ["https://x.org/a", "mailto:a@b", "#top", "//cdn/x.js", "{{ '/a' | relative_url }}", "viewer/${a.url}", "…", "' + esc(SITE_HREF + r.page) + '", "' + escape(v) + '"]) {
      expect(isInternal(v)).toBe(false);
    }
    expect(isInternal("../a/b.html")).toBe(true);
  });

  it("ignores escaped HTML inside <code>/<pre> and template strings inside <script>, while still checking <script src>", () => {
    const root = site({
      "p.html": [
        '<code>&lt;img src="x.svg"&gt;</code>',
        '<pre>&lt;a href="y.html"&gt;y&lt;/a&gt;</pre>',
        '<script>const s = `<a href="/api/pdf" target="_blank">PDF</a>`;</script>',
        '<script src="missing.js"></script>',
      ].join("\n"),
    });
    const r = checkSite({ site: root, basePath: "", fix: false, resolveSource: () => undefined });
    expect(r.dead.map((d) => d.target)).toEqual(["missing.js"]);
  });

  it("resolves relative and base-path-absolute links to site paths", () => {
    expect(targetOf("docs/x/page.html", "../y/z.md#s", "")).toBe("docs/y/z.md");
    expect(targetOf("a.html", "/folio-assistant/b/c.svg", "/folio-assistant")).toBe("b/c.svg");
    expect(targetOf("a.html", "../../out.html", "")).toBeUndefined();
  });

  it("drops only translated-locale segments", () => {
    expect(withoutLocale("es/assets/img/x.svg")).toBe("assets/img/x.svg");
    expect(withoutLocale("docs/process/fr/p.html")).toBe("docs/process/p.html");
    expect(withoutLocale("en/cat-harness/x/")).toBeUndefined();
  });
});

describe("--fix repoints what has one answer and reports the rest", () => {
  it("a missing translation falls back to the untranslated target", () => {
    const root = site({
      "assets/img/x.svg": "<svg/>",
      "core/es/page.html": '<img src="../../es/assets/img/x.svg"><a href="../../nowhere.html">x</a>',
    });
    const r = checkSite({ site: root, basePath: "", fix: true, resolveSource: () => undefined });
    expect(r.repointed.map((x) => x.why)).toEqual(["locale"]);
    expect(readFileSync(join(root, "core/es/page.html"), "utf-8")).toContain('src="../../assets/img/x.svg"');
    expect(r.dead.map((d) => d.target)).toEqual(["nowhere.html"]);
  });

  it("a link into a carried directory is not judged: the deploy lays that tree back after the check", () => {
    const root = site({ "en/h/site/index.html": '<a href="../../../STAGING/pr-1/">p</a><a href="../../../_render-log/">l</a><a href="../../../gone/">g</a>' });
    const r = checkSite({ site: root, basePath: "", fix: false, resolveSource: () => undefined });
    expect(r.dead.map((d) => d.target)).toEqual(["gone/"]);
  });

  it("a source file goes to GitHub at the pinned commit", () => {
    const idx = tailIndex(["cat-harness/sdlc/skills/crdm/crdm-detect.md", "cat-harness/AGENTS.md", "smart-base/AGENTS.md"]);
    const file = sourceFor("docs/sdlc/skills/crdm/crdm-detect.md", idx)!;
    expect(file).toBe("cat-harness/sdlc/skills/crdm/crdm-detect.md");
    const origins = [{ path: "cat-harness", repository: "litlfred/cat-harness", ref: "abc", upstreamRoot: "" }];
    expect(blobUrl(file, origins)).toBe("https://github.com/litlfred/cat-harness/blob/abc/sdlc/skills/crdm/crdm-detect.md");
  });

  it("an unrendered page is looked up as its .md, a folder as its README, a translation as its source", () => {
    expect(sourceCandidates("proposals/x.html")).toEqual(["proposals/x.html", "proposals/x.md"]);
    expect(sourceCandidates("docs/skills/tools/t/")).toEqual(["docs/skills/tools/t/README.md", "docs/skills/tools/t/index.md"]);
    expect(sourceCandidates("a/b.bpmn")).toEqual(["a/b.bpmn"]);
    const root = site({ "core/process/es/p.html": '<a href="../../../es/proposals/x.html">x</a>' });
    const seen: string[] = [];
    const r = checkSite({
      site: root,
      basePath: "",
      fix: true,
      resolveSource: (rel) => {
        seen.push(rel);
        return rel === "proposals/x.html" ? "https://github.com/o/r/blob/s/proposals/x.md" : undefined;
      },
    });
    expect(seen).toEqual(["es/proposals/x.html", "proposals/x.html"]);
    expect(r.repointed.map((x) => [x.to, x.why])).toEqual([["https://github.com/o/r/blob/s/proposals/x.md", "source"]]);
    expect(r.dead).toEqual([]);
  });

  it("an ambiguous source is left dead", () => {
    const idx = tailIndex(["cat-harness/docs/AGENTS.md", "smart-base/docs/AGENTS.md"]);
    expect(sourceFor("docs/AGENTS.md", idx)).toBeUndefined();
  });

  it("a directory link whose section page is published as a sibling .html repoints to that .html", () => {
    const root = site({
      "docs/cat-harness/concepts/architecture.html": "<p>arch</p>",
      "docs/cat-harness/concepts/README.html": '<a href="architecture/">architecture/</a>',
    });
    const r = checkSite({ site: root, basePath: "", fix: true, resolveSource: () => undefined });
    expect(r.dead).toEqual([]);
    expect(readFileSync(join(root, "docs/cat-harness/concepts/README.html"), "utf-8")).toContain('href="architecture.html"');
  });

  it("a relative link from docs/<instance>/<chapter>/ that landed at docs/<tail> resolves <instance>/<tail> in the checkout", () => {
    const idx = tailIndex(["cat-harness/README.md", "cat-harness/docs/README.md", "other-inst/docs/README.md"]);
    const origins = [{ path: "cat-harness", repository: "litlfred/cat-harness", ref: "abc", upstreamRoot: "" }];
    const root = site({
      "docs/cat-harness/start/README.html": '<a href="../../README.md">C@T Harness</a>',
    });
    const r = checkSite({
      site: root,
      basePath: "",
      fix: true,
      resolveSource: (rel) => {
        for (const c of sourceCandidates(rel)) {
          const f = sourceFor(c, idx);
          if (f !== undefined) return blobUrl(f, origins);
        }
        return undefined;
      },
    });
    expect(r.dead).toEqual([]);
    expect(readFileSync(join(root, "docs/cat-harness/start/README.html"), "utf-8")).toContain(
      'href="https://github.com/litlfred/cat-harness/blob/abc/README.md"',
    );
  });

  it("without --fix nothing is rewritten", () => {
    const root = site({ "assets/x.svg": "", "es/p.html": '<img src="../es/assets/x.svg">' });
    const r = checkSite({ site: root, basePath: "", fix: false, resolveSource: () => undefined });
    expect(r.repointed).toEqual([]);
    expect(r.dead).toHaveLength(1);
  });
});

describe("in a preview, a page of an instance the preview does not carry goes to the published site", () => {
  it("reads the published root off a preview base path, and none off a canonical one", () => {
    expect(publishedRootOf("/folio-assistant/STAGING/repin-train-1")).toBe("/folio-assistant");
    expect(publishedRootOf("/folio-assistant")).toBeUndefined();
    expect(publishedRootOf("")).toBeUndefined();
  });

  it("repoints only when the instance's composed directory holds the page's source", () => {
    const composed = site({ "concepts/who.md": "# who" });
    const instances = new Map([["an-ig", [composed]]]);
    expect(publishedFor("an-ig/concepts/who.html", "/folio-assistant", instances)).toBe("/folio-assistant/an-ig/concepts/who.html");
    expect(publishedFor("an-ig/concepts/nobody-wrote-this.html", "/folio-assistant", instances)).toBeUndefined();
    expect(publishedFor("other/concepts/who.html", "/folio-assistant", instances)).toBeUndefined();
  });

  it("checkSite takes the rule only when it is given one, so a canonical build still reports", () => {
    const composed = site({ "guides/dak.md": "# dak" });
    const instances = new Map([["an-ig", [composed]]]);
    const files = { "en/p/x.html": '<a href="../../an-ig/guides/dak.html#a">dak</a>' };
    const canonical = checkSite({ site: site(files), basePath: "", fix: true, resolveSource: () => undefined });
    expect(canonical.dead.map((d) => d.target)).toEqual(["an-ig/guides/dak.html"]);
    const root = site(files);
    const preview = checkSite({
      site: root,
      basePath: "/folio-assistant/STAGING/s",
      fix: true,
      resolveSource: () => undefined,
      resolvePublished: (t) => publishedFor(t, "/folio-assistant", instances),
    });
    expect(preview.dead).toEqual([]);
    expect(preview.repointed.map((r) => [r.to, r.why])).toEqual([["/folio-assistant/an-ig/guides/dak.html#a", "published"]]);
    expect(readFileSync(join(root, "en/p/x.html"), "utf-8")).toContain('href="/folio-assistant/an-ig/guides/dak.html#a"');
  });
});
