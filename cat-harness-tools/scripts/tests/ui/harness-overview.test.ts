/**
 * ONE OVERVIEW PAGE PER HARNESS, and the Harnesses panel linking it — owner,
 * 2026-11-13: *"links under harnesses inconsistent… should be page that give
 * an overview of how the particular harness is being used and linked back to
 * the harnesses documentation and knowledge graph."*
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildOverviews, overviewHtml, overviewJsonld, PAGE_MARK, writeHarnessPages, type HarnessDataRow } from "../../gen-harness-pages.ts";
import { harnessOverviewRoute, harnessOverviewsRoute, overviewHrefIn } from "../../lib/harness-overview.ts";

const json = (file: string, v: unknown) => {
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, JSON.stringify(v, null, 2));
};

/** A checkout: its own layer `site-a` at the root, on `lower` (mounted, opt-in group `extra` on) and `base`. */
function fixture(): { checkout: string; site: string; rows: HarnessDataRow[] } {
  const checkout = mkdtempSync(join(tmpdir(), "harness-overview-"));
  const site = join(checkout, "_site");
  mkdirSync(site);
  json(join(checkout, "site-a.json"), { name: "site-a", title: "Site A", version: "1.0.0", iriBase: "https://example.org/site-a/", repository: "acme/site-a", needs: ["lower"], directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }] });
  json(join(checkout, "lower", "lower.json"), {
    name: "lower",
    title: "Lower",
    description: "A lower layer.",
    version: "0.2.0",
    iriBase: "https://example.org/lower/",
    repository: "acme/lower",
    needs: ["base"],
    contentAdapters: [{ contentType: "document" }],
    contentTranslations: [{ contentType: "ig" }, { contentType: "document" }],
    directories: [
      { id: "skills", path: "skills/", graphTypologies: ["skills"] },
      { id: "extra", path: "extra/", graphTypologies: ["notes"], optIn: true },
      { id: "dormant", path: "dormant/", graphTypologies: ["notes"], optIn: true },
    ],
  });
  writeFileSync(join(checkout, "lower", "README.md"), "# Lower\n");
  json(join(checkout, "base", "base.json"), { name: "base", title: "Base", iriBase: "https://example.org/base/", repository: "acme/base", directories: [] });
  json(join(checkout, "index.config.json"), {
    $schema: "folio-index-config/v1",
    layers: [
      { name: "site-a", source: { local: { at: "." } }, contentType: "document" },
      { name: "lower", source: { remote: { repository: "acme/lower", ref: "a".repeat(40) } } },
      { name: "base", source: { remote: { repository: "acme/base", ref: "b".repeat(40) } } },
    ],
    harnesses: [{ name: "site-a" }],
    contentTypes: { ig: { include: ["input/fsh/", "sushi-config.yaml"] } },
  });
  json(join(checkout, "index.lock.json"), {
    $schema: "cat-harness-mount-lock/v1",
    instances: [
      { instance: "lower", repository: "acme/lower", sha: "a".repeat(40), pinnedBy: "declared", via: "lower" },
      { instance: "base", repository: "acme/base", sha: "b".repeat(40), pinnedBy: "declared", via: "lower" },
    ],
  });
  // The lower layer's skills view is on this site; its notes view is not.
  mkdirSync(join(site, "en", "cat-harness", "skills", "lower"), { recursive: true });
  writeFileSync(join(site, "en", "cat-harness", "skills", "lower", "index.html"), "<p>skills</p>");
  // Its code view is not at the data's path, but at the handler's route for it on this site.
  mkdirSync(join(site, "en", "cat-harness", "code", "lower"), { recursive: true });
  writeFileSync(join(site, "en", "cat-harness", "code", "lower", "index.html"), "<p>code</p>");
  mkdirSync(join(site, "en", "cat-harness", "cat-harness-declaration", "lower"), { recursive: true });
  writeFileSync(join(site, "en", "cat-harness", "cat-harness-declaration", "lower", "index.html"), "<p>decl</p>");
  const rows: HarnessDataRow[] = [
    { name: "site-a", title: "Site A", href: "/#harness-site-a", hrefKind: "section", instantiated: true, needs: ["lower"] },
    {
      name: "lower",
      title: "Lower",
      href: "/lower/",
      hrefKind: "folio",
      needs: ["base"],
      visualisations: [
        { kind: "skills", label: "Skills", path: "/en/cat-harness/skills/lower/" },
        { kind: "notes", label: "Notes", path: "/en/cat-harness/notes/lower/" },
        { kind: "code", label: "Code", path: "/lower/code/" },
        { kind: "kg", label: "Skills again", sameAs: "skills" },
      ],
      subgraphs: [{ id: "skills", where: "local" }],
    },
    { name: "base", title: "Base", needs: [] },
    { name: "absent", title: "Not in this checkout" },
  ];
  return { checkout, site, rows };
}

describe("harness overview route", () => {
  it("is the node-kind pages' shape under the host harness", () => {
    expect(harnessOverviewsRoute()).toBe("en/cat-harness/harness/");
    expect(harnessOverviewRoute("who-iris")).toBe("en/cat-harness/harness/who-iris/");
  });

  it("a row links the page only where the site holds it", () => {
    const site = mkdtempSync(join(tmpdir(), "harness-overview-site-"));
    mkdirSync(join(site, harnessOverviewRoute("held")), { recursive: true });
    writeFileSync(join(site, harnessOverviewRoute("held"), "index.html"), "x");
    const at = overviewHrefIn(site, "../..");
    expect(at("held")).toBe("../../en/cat-harness/harness/held/");
    expect(at("missing")).toBeUndefined();
    expect(at("../escape")).toBeUndefined();
  });

  it("both rail passes give the panel the resolver", () => {
    const src = readFileSync(join(import.meta.dir, "..", "..", "mount-instance-docs.ts"), "utf-8");
    expect(src.match(/overviewHrefIn\(siteAbs, toRoot\)/g)?.length).toBe(2);
  });
});

describe("buildOverviews", () => {
  const { checkout, site, rows } = fixture();
  const hs = buildOverviews({ checkout, site, rows, commit: "c".repeat(40), enabled: new Set(["lower.extra"]), docsBase: "https://docs.example.org/" });
  const by = new Map(hs.map((h) => [h.name, h]));

  it("one per harness the checkout holds, in the data's order", () => {
    expect(hs.map((h) => h.name)).toEqual(["site-a", "lower", "base"]);
  });

  it("says each one's role, and who needs whom", () => {
    expect(by.get("site-a")!.role).toBe("site");
    expect(by.get("lower")!.role).toBe("dependency");
    expect(by.get("lower")!.neededBy).toEqual(["site-a"]);
    expect(by.get("lower")!.needs).toEqual(["base"]);
  });

  it("the pin is the lock's, or the checkout's own commit for its local layer", () => {
    expect(by.get("lower")!.pin).toEqual({ local: false, sha: "a".repeat(40), repository: "acme/lower", pinnedBy: "declared" });
    expect(by.get("base")!.pin).toMatchObject({ via: "lower" });
    expect(by.get("site-a")!.pin).toEqual({ local: true, commit: "c".repeat(40) });
  });

  it("links its documentation: the platform's page and its source at the pin", () => {
    const docs = by.get("lower")!.docs.map((d) => d.href);
    expect(docs).toContain("https://docs.example.org/lower/");
    expect(docs).toContain(`https://github.com/acme/lower/tree/${"a".repeat(40)}`);
    expect(docs).toContain(`https://github.com/acme/lower/blob/${"a".repeat(40)}/README.md`);
    expect(by.get("site-a")!.docs[0]).toEqual({ label: "This site's home page", href: "" });
  });

  it("its knowledge graph: the declaration's node page and the views this site holds", () => {
    const l = by.get("lower")!;
    expect(l.declarationPage).toBe("en/cat-harness/cat-harness-declaration/lower/");
    expect(l.graphs).toEqual([
      { label: "Skills", href: "en/cat-harness/skills/lower/" },
      { label: "Notes", note: "not published on this site" },
      { label: "Code", href: "en/cat-harness/code/lower/" },
    ]);
    expect(by.get("base")!.declarationPage).toBeUndefined();
  });

  it("the content types it supplies, and how this site uses each", () => {
    expect(by.get("lower")!.contentTypes).toEqual([
      { id: "document", section: false, include: [], layers: ["site-a"] },
      { id: "ig", section: true, include: ["input/fsh/", "sushi-config.yaml"], layers: [] },
    ]);
  });

  it("its folders, checkout-relative, with the opt-in groups on or off", () => {
    const f = by.get("lower")!.folders;
    expect(f.map((x) => x.path)).toEqual(["lower/skills/", "lower/extra/", "lower/dormant/"]);
    expect(f[0]!.where).toBe("local");
    expect(f[1]!.optIn).toEqual({ id: "lower.extra", enabled: true });
    expect(f[2]!.optIn).toEqual({ id: "lower.dormant", enabled: false });
    expect(by.get("site-a")!.folders[0]!.path).toBe("library/");
  });

  it("writes the pages, the index, and each page's JSON-LD with its IRI", () => {
    const written = writeHarnessPages(site, hs, "Site A", "https://acme.github.io/site-a/");
    expect(written).toContain("en/cat-harness/harness/");
    const html = readFileSync(join(site, harnessOverviewRoute("lower"), "index.html"), "utf-8");
    expect(html).toContain(PAGE_MARK);
    expect(html).toContain(`href="../../../../en/cat-harness/cat-harness-declaration/lower/"`);
    expect(html).toContain(`href="../base/"`);
    expect(html).toContain(`<link rel="alternate" type="application/ld+json" href="index.jsonld">`);
    const ld = JSON.parse(readFileSync(join(site, harnessOverviewRoute("lower"), "index.jsonld"), "utf-8"));
    expect(ld["@id"]).toBe("https://acme.github.io/site-a/en/cat-harness/harness/lower/");
    expect(ld.about["@id"]).toBe("https://example.org/lower/");
    expect(ld.about.isBasedOn).toEqual([{ "@id": "https://example.org/base/" }]);
    expect(readFileSync(join(site, harnessOverviewsRoute(), "index.html"), "utf-8")).toContain(`href="lower/"`);
  });

  it("escapes what the declarations say", () => {
    const h = { ...by.get("base")!, label: `<b>x</b>`, description: `"q" & <i>` };
    const html = overviewHtml(h, "S", new Map());
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(overviewJsonld(h, "S", undefined, new Map())["@id"]).toBeUndefined();
  });
});
