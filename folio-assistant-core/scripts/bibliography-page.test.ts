/**
 * The bibliography page (bean folio-assistant-63q4), over a fixture checkout
 * of two layers: one declaring a `references` directory, one a `catalogue`
 * whose item holds a library copy.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeDeclaration } from "../../cat-harness-tools/test/support/instance-fixture.ts";
import { leakingLinesIn } from "../../cat-harness-tools/scripts/check-escaped-markup.ts";
import { ReferenceNodeSchema } from "../schemas/reference.ts";
import {
  LIST_LIMIT,
  EXPORTS,
  addReferenceHtml,
  segmentOf,
  buildStandaloneReference,
  byCitation,
  citationHtml,
  collect,
  detailHtml,
  entryHtml,
  linksHtml,
  newReferenceUrl,
  outputs,
  forInstance,
  renderPage,
} from "./bibliography-page.ts";

const made: string[] = [];
afterAll(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));

function put(root: string, rel: string, body: unknown): void {
  const p = join(root, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

/** `folio-x` declares references/ (two nodes); `iris-x` declares catalogue/ and library/. */
function checkout(extra?: (root: string) => void): string {
  const root = mkdtempSync(join(tmpdir(), "bib-"));
  made.push(root);
  const folio = join(root, "folio-x");
  mkdirSync(folio, { recursive: true });
  writeDeclaration(folio, { name: "folio-x", directories: [{ id: "folio-x-references", path: "references/", graphTypologies: ["references"] }] });
  put(folio, "references/garoufalidis2004.json", {
    $schema: "folio-reference/v1",
    id: "garoufalidis2004",
    type: "article-journal",
    title: "On the characteristic and deformation varieties of a knot",
    author: [{ family: "Garoufalidis", given: "Stavros" }],
    "container-title": "Geometry and Topology Monographs",
    issued: { "date-parts": [[2004]] },
    volume: "7",
    page: "291-309",
    DOI: "10.2140/gtm.2004.7.291",
  });
  put(folio, "references/aaronson2013.json", {
    $schema: "folio-reference/v1",
    id: "aaronson2013",
    type: "book",
    title: "Quantum Computing since Democritus",
    author: [{ family: "Aaronson", given: "Scott" }],
    issued: { "date-parts": [[2013]] },
    publisher: "Cambridge University Press",
  });
  const iris = join(root, "iris-x");
  mkdirSync(iris, { recursive: true });
  writeDeclaration(iris, {
    name: "iris-x",
    directories: [
      { id: "iris-x-catalogue", path: "catalogue/", graphTypologies: ["catalogue"] },
      { id: "iris-x-library", path: "library/", graphTypologies: ["library"] },
    ],
  });
  put(iris, "catalogue/records/who-handbook.dc.json", {
    $schema: "folio-dublin-core/v1",
    id: "63e14c27-7448-41ec-be08-a96a25a47db6",
    _comment: "a note for a person, not metadata",
    fields: [
      { schema: "dc", element: "contributor", qualifier: "author", values: [{ value: "World Health Organization" }] },
      { schema: "dc", element: "date", qualifier: "issued", values: [{ value: "2014-12-18" }] },
      { schema: "dc", element: "identifier", qualifier: "isbn", values: [{ value: "9789241548960" }] },
      { schema: "dc", element: "title", values: [{ value: "WHO handbook for guideline development" }] },
    ],
    provenance: { source: "https://iris.who.int/handle/10665/145714", retrievedAt: "2026-09-20", method: "transcribed" },
  });
  put(iris, "catalogue/nodes/item-who-handbook.json", { $schema: "folio-catalogue-node/v1", metadataRef: "catalogue/records/who-handbook.dc.json", libraryId: "who-handbook" });
  put(iris, "library/who-handbook/manifest.json", {});
  extra?.(root);
  return root;
}

describe("collect", () => {
  const c = collect(checkout());

  test("readsBothSourcesInOrder", () => {
    expect(c.invalid).toEqual([]);
    expect(c.entries.map((e) => [e.subgraph, e.ref.id])).toEqual([
      ["folio-x-references", "aaronson2013"],
      ["folio-x-references", "garoufalidis2004"],
      ["iris-x-catalogue", "who-handbook"],
    ]);
    expect(c.subgraphs.map((s) => [s.id, s.kind])).toEqual([
      ["folio-x-references", "references"],
      ["iris-x-catalogue", "catalogue"],
    ]);
  });

  test("catalogueRecordBecomesReference", () => {
    const who = c.entries.find((e) => e.ref.id === "who-handbook")!.ref;
    expect(who.provenance).toBe("catalogue");
    expect(who.derivedFrom).toBe("iris-x/catalogue/records/who-handbook.dc.json");
    expect(who.heldAt).toBe("iris-x/library/who-handbook");
    expect(who.ISBN).toBe("9789241548960");
  });

  test("refusesMisnamedAndBadNode", () => {
    const bad = collect(
      checkout((root) => {
        put(join(root, "folio-x"), "references/misnamed.json", { $schema: "folio-reference/v1", id: "other2020", type: "book" });
        put(join(root, "folio-x"), "references/broken.json", { $schema: "folio-reference/v1", id: "has space", type: "book" });
      }),
    );
    expect(bad.invalid.some((m) => m.includes("misnamed.json") && m.includes('"other2020"'))).toBe(true);
    expect(bad.invalid.some((m) => m.includes("broken.json"))).toBe(true);
  });
});

describe("pages and exports", () => {
  const c = collect(checkout());
  const files = outputs(c);
  const paths = [...files.keys()].map((p) => p.split("/").slice(-3).join("/"));

  test("fiveExportsPerPage", () => {
    for (const where of ["bibliography", "folio-x-references", "iris-x-catalogue"]) {
      for (const f of ["index.md", ...EXPORTS.map(([n]) => n)]) expect(paths.some((p) => p.endsWith(`${where}/${f}`))).toBe(true);
    }
    expect(EXPORTS.map(([n]) => n)).toEqual([
      "references.bib",
      "references.csl.json",
      "references.ris",
      "references.dc.xml",
      "references.jsonld",
    ]);
    // …and the route's self-ignoring marker (bean folio-assistant-uldr): the
    // route is built at publish, so git and the mount digest leave it alone.
    // …and one own page per reference, `<sub-graph>/<key>/index.md` (owner, 2026-11-08).
    // …and the search index, `search/` (manifest, facets, one terms and one refs file here).
    expect([...files.keys()].filter((p) => p.includes("/bibliography/search/")).length).toBe(4);
    expect(files.size).toBe(3 * (1 + EXPORTS.length) + 1 + c.entries.length + 4);
    expect([...files.keys()].filter((p) => p.endsWith("/.gitignore"))).toHaveLength(1);
  });

  test("perAssetRouteExports", () => {
    const withLib = collect(
      checkout((root) => {
        put(join(root, "iris-x"), "library/knot-paper/manifest.jsonld", {
          docId: "knot-paper",
          title: "A Knot Paper in the Library",
          sourceUrl: "https://arxiv.org/abs/2401.00001",
          ingestedAt: "2024-01-15T00:00:00Z",
        });
        put(join(root, "folio-x"), "references/extracted1999.json", {
          $schema: "folio-reference/v1",
          id: "extracted1999",
          type: "article-journal",
          title: "An Extracted Citation",
          author: [{ family: "Thurston", given: "William" }],
          issued: { "date-parts": [[1999]] },
          provenance: "extracted",
          derivedFrom: "iris-x/library/knot-paper/sections/references.md",
        });
      }),
    );
    expect(withLib.assets.map((a) => [a.subgraph, a.asset, a.entries.map((e) => e.ref.id)])).toEqual([
      ["iris-x-library", "knot-paper", ["knot-paper", "extracted1999"]],
    ]);
    const libFiles = outputs(withLib);
    const assetPage = [...libFiles].find(([p]) => p.endsWith("iris-x-library/knot-paper/index.md"))?.[1];
    const assetDcXml = [...libFiles].find(([p]) => p.endsWith("iris-x-library/knot-paper/references.dc.xml"))?.[1];
    expect(assetPage).toContain("A Knot Paper in the Library");
    expect(assetPage).toContain("An Extracted Citation");
    expect(assetDcXml).toContain("A Knot Paper in the Library");
    expect(assetDcXml).toContain("An Extracted Citation");
  });

  test("catalogueHeldDocumentGetsItsOwnBibliography", () => {
    const ext = (id: string, from: string, extra: Record<string, unknown> = {}) => ({
      $schema: "folio-reference/v1",
      id,
      type: "document",
      provenance: "extracted",
      derivedFrom: from,
      printed: `Printed entry ${id}. Geneva: WHO; 2001.`,
      ...extra,
    });
    const withRefs = collect(
      checkout((root) => {
        const sec = "iris-x/library/who-handbook/sections/sec-009-references.md";
        put(join(root, "folio-x"), "references/who-handbook.sec-009.2.json", ext("who-handbook.sec-009.2", sec));
        put(join(root, "folio-x"), "references/who-handbook.sec-009.10.json", ext("who-handbook.sec-009.10", sec));
        // Another document CITES the handbook: it belongs to that document, not here.
        put(join(root, "folio-x"), "references/other.sec-001.1.json", ext("other.sec-001.1", "iris-x/library/other/sections/s.md", { heldAt: "iris-x/library/who-handbook" }));
      }),
    );
    expect(withRefs.invalid).toEqual([]);
    expect(withRefs.assets.map((a) => [a.subgraph, a.asset, a.entries.map((e) => e.ref.id)])).toEqual([
      ["iris-x-library", "who-handbook", ["who-handbook", "who-handbook.sec-009.2", "who-handbook.sec-009.10"]],
    ]);
    const page = [...outputs(withRefs)].find(([p]) => p.endsWith("iris-x-library/who-handbook/index.md"))?.[1];
    expect(page).toContain("Printed entry who-handbook.sec-009.10");
    // Without an extracted list, a catalogued copy gets no page of its own.
    expect(c.assets).toEqual([]);
  });

  test("extractedReferencesOpenInThePanelNotTheirOwnPage", () => {
    // Owner, 2026-11-15, card Q-BIBSCALE-2: "A. Summaries, panel, no lunr".
    const sec = "iris-x/library/who-handbook/sections/sec-009-references.md";
    const withRefs = collect(
      checkout((root) => {
        put(join(root, "folio-x"), "references/who-handbook.sec-009.2.json", {
          $schema: "folio-reference/v1",
          id: "who-handbook.sec-009.2",
          type: "document",
          provenance: "extracted",
          derivedFrom: sec,
          printed: "Printed entry two. Geneva: WHO; 2001.",
        });
      }),
    );
    const out = outputs(withRefs);
    expect([...out.keys()].some((p) => p.includes("who-handbook.sec-009.2/"))).toBe(false);
    const page = out.get([...out.keys()].find((p) => p.endsWith("iris-x-library/who-handbook/index.md"))!)!;
    expect(page).toContain('data-fa-bib-key="who-handbook.sec-009.2" data-fa-bib-inline');
    expect(page).toContain('<template class="fa-bib-inline"><section class="fa-bib-detail" data-fa-bib-key="who-handbook.sec-009.2">');
    // An authored reference keeps its own page.
    expect([...out.keys()].some((p) => p.endsWith("folio-x-references/garoufalidis2004/index.md"))).toBe(true);
  });

  test("everyPageIsOutOfTheSiteSearch", () => {
    for (const [p, s] of files) if (p.endsWith(".md")) expect(s).toContain("\nsearch_exclude: true\n");
  });

  test("aLongListIsSummarised", () => {
    const many = Array.from({ length: LIST_LIMIT + 1 }, (_, i) => `ref${i}`);
    const big = collect(
      checkout((root) => {
        for (const id of many) put(join(root, "folio-x"), `references/${id}.json`, { $schema: "folio-reference/v1", id, type: "book", title: `Book ${id}` });
      }),
    );
    const out = outputs(big);
    const whole = out.get([...out.keys()].find((p) => p.endsWith("bibliography/index.md"))!)!;
    expect(whole).toContain('<p class="fa-bib-summary">');
    expect(whole).not.toContain('<ol class="fa-bib">');
    expect(whole).toContain('<a href="folio-x-references/">folio-x-references</a>');
    expect(whole).toContain('<div class="fa-bib-search" data-fa-bib-index="search/" data-fa-bib-root="">');
    // The exports still hold every reference.
    const bib = out.get([...out.keys()].find((p) => p.endsWith("bibliography/references.bib"))!)!;
    expect(bib).toContain("@book{ref500,");
    // A sub-graph page with no document page below it says so, and lists nothing.
    const sub = out.get([...out.keys()].find((p) => p.endsWith("folio-x-references/index.md"))!)!;
    expect(sub).toContain("Search them below, or take all of them in an export.");
    expect(sub).toContain('data-fa-bib-index="../search/" data-fa-bib-root="../" data-fa-bib-scope="');
    expect(sub).not.toContain('<ol class="fa-bib">');
    // The + Add reference panel still works there: its script is the filter's.
    expect(whole).toContain('id="fa-bib-add-form"');
    expect(whole).toContain('var form=document.getElementById("fa-bib-add-form")');
  });

  test("subgraphPageOwnRefsOnly", () => {
    const [page, bib] = ["index.md", "references.bib"].map((f) => [...files].find(([p]) => p.endsWith(`iris-x-catalogue/${f}`))![1]);
    expect(page).toContain('data-fa-bib-key="who-handbook" data-fa-bib-href="who-handbook/"');
    expect(page).not.toContain("garoufalidis2004");
    expect(bib).toContain("@book{who-handbook,");
    expect(bib).not.toContain("garoufalidis2004");
  });

  test("wholePageLinksSubgraphs", () => {
    const page = [...files].find(([p]) => p.endsWith("bibliography/index.md"))![1];
    expect(page).toContain('<a href="folio-x-references/">folio-x-references</a> (2)');
    expect(page).toContain('<a href="iris-x-catalogue/">iris-x-catalogue</a> (1)');
  });

  test("entryPagesNestUnderTheirSubgraphPage", () => {
    // Owner, 2026-11-10: entry pages sat at the top of a site's Pages list.
    // Each names its sub-graph page as `parent`, and that page exists.
    const titleOf = (s: string) => /^title: "(.*)"$/m.exec(s)?.[1];
    const subgraphTitles = new Set([...files].filter(([p]) => /\/bibliography\/[^/]+\/index\.md$/.test(p)).map(([, s]) => titleOf(s)));
    const entryPages = [...files].filter(([p, s]) => p.endsWith("/index.md") && s.includes("All references of "));
    expect(entryPages.length).toBe(c.entries.length);
    for (const [p, s] of entryPages) {
      const slug = p.split("/").slice(-3)[0];
      expect(s).toContain(`parent: "Bibliography: ${slug}"\ngrand_parent: "Bibliography"\n`);
      // …but stays out of the sidebar: just-the-docs writes the nav into every
      // page, and 7,219 entries there ran a site's Jekyll build out of memory.
      expect(s).toContain("nav_exclude: true\n");
      expect(subgraphTitles.has(`Bibliography: ${slug}`)).toBe(true);
    }
    // …and each sub-graph page sits under the Bibliography page.
    for (const [p, s] of files) if (/\/bibliography\/[^/]+\/index\.md$/.test(p)) expect(s).toContain('parent: "Bibliography"\n');
  });

  test("entryCarriesOwnExports", () => {
    const e = c.entries.find((x) => x.ref.id === "garoufalidis2004")!;
    const html = entryHtml(e);
    for (const ext of ["bib", "ris", "csl.json"]) expect(html).toContain(`download="garoufalidis2004.${ext}"`);
    expect(decodeURIComponent(html)).toContain("@article{garoufalidis2004,");
  });
});

describe("rendering", () => {
  const c = collect(checkout());
  const g = c.entries.find((e) => e.ref.id === "garoufalidis2004")!;

  test("citationFormat", () => {
    expect(citationHtml(g.ref)).toBe(
      "Garoufalidis, Stavros (2004). <cite>On the characteristic and deformation varieties of a knot</cite>. <i>Geometry and Topology Monographs</i>, 7, 291-309.",
    );
  });

  test("untitledShowsPrintedText", () => {
    const r = { $schema: "folio-reference/v1" as const, id: "x.r10", type: "document", issued: { "date-parts": [[2025]] }, note: "Gemini Team: Gemini 2.5 <b>. arXiv preprint (2025)" };
    expect(citationHtml(r)).toBe('<span class="as-printed">Gemini Team: Gemini 2.5 &lt;b&gt;. arXiv preprint (2025)</span>');
    expect(citationHtml({ ...r, printed: "As printed." })).toContain("As printed.");
    expect(citationHtml({ ...r, note: undefined })).toBe("(2025).");
  });

  test("htmlEscaped", () => {
    expect(citationHtml({ ...g.ref, title: "<script>x</script>" })).toContain("&lt;script&gt;");
  });

  test("segmentsUrlSafe", () => expect(segmentOf("a:b/c+d.e")).toBe("a-b-c-d.e"));

  test("emptyPageSaysSo", () => {
    const p = renderPage({ title: "Bibliography: x", permalink: "/x/", intro: "x", entries: [] });
    expect(p).toContain("No references here yet.");
    expect(p).toContain('<a href="references.bib">BibTeX</a>');
  });

  test("orderAuthorThenYear", () => {
    const [a, b] = [c.entries[0]!, c.entries[1]!];
    expect(byCitation(a, b)).toBeLessThan(0);
  });

  test("addReferenceFormControls", () => {
    const html = addReferenceHtml({ targetDir: "folio-x/references" });
    expect(html).toContain("✍ + Add reference (standalone node)");
    expect(html).toContain('id="fa-bib-add-form"');
    expect(html).toContain('id="fa-bib-add-key"');
    expect(html).toContain('id="fa-bib-add-type"');
    expect(html).toContain('id="fa-bib-add-title"');
    expect(html).toContain('id="fa-bib-add-authors"');
    expect(html).toContain('id="fa-bib-add-issued"');
    expect(html).toContain('id="fa-bib-add-container"');
    expect(html).toContain('id="fa-bib-add-doi"');
    expect(html).toContain('id="fa-bib-add-url"');
    expect(html).toContain('id="fa-bib-add-arxiv"');
    expect(html).toContain('id="fa-bib-add-abstract"');
    expect(html).toContain('id="fa-bib-add-raw"');
    expect(html).toContain('id="fa-bib-add-dl-jsonld"');
    expect(html).toContain('id="fa-bib-add-dl-csl"');
    expect(html).toContain('id="fa-bib-add-gh"');
    expect(html).toContain("folio-x/references/reference.jsonld");

    // Unsafe repoUrl is refused by safeHref and never reaches an <a href>
    const unsafeForm = addReferenceHtml({ repoUrl: "javascript:alert(1)" });
    expect(unsafeForm).not.toContain('id="fa-bib-add-gh"');
    expect(unsafeForm).not.toContain("javascript:alert(1)");
    expect(newReferenceUrl({ repoUrl: "javascript:alert(1)", key: "x" })).toBeUndefined();

    // Unsafe reference URL is rendered as code text, never as an <a href>
    const unsafeEntry = linksHtml({
      ...g,
      ref: { ...g.ref, DOI: undefined, URL: "javascript:alert(1)" },
    });
    expect(unsafeEntry).not.toContain("<a ");
    expect(unsafeEntry).toContain("<code>javascript:alert(1)</code>");

    // Standalone .jsonld node built by buildStandaloneReference is collected from a references/ directory
    const withStandalone = collect(
      checkout((root) => {
        const built = buildStandaloneReference({
          id: "standalone2026",
          type: "report",
          title: "Standalone Node Added From Viewer",
          authors: "World Health Organization",
          issued: "2026",
          URL: "https://example.org/standalone",
        });
        expect(ReferenceNodeSchema.parse(built.node).id).toBe("standalone2026");
        put(join(root, "folio-x"), "references/standalone2026.jsonld", built.jsonld);
        // Also an authorless/yearless entry whose citationHtml starts with <cite>
        put(join(root, "folio-x"), "references/titleonly.json", {
          $schema: "folio-reference/v1",
          id: "titleonly",
          type: "document",
          title: "Title With No Author Or Year",
        });
      }),
    );
    expect(withStandalone.invalid).toEqual([]);
    expect(withStandalone.entries.some((e) => e.ref.id === "standalone2026")).toBe(true);
    for (const [p, content] of outputs(withStandalone)) {
      if (p.endsWith(".md")) {
        expect(leakingLinesIn(p, content)).toEqual([]);
      }
    }
  });
});

describe("a site with its own instance (declared at the checkout root) and dependencies", () => {
  /** `site-x` is declared at the root; `dep-x` is a mounted layer. Both name their directory `references`. */
  function siteCheckout(): string {
    const root = mkdtempSync(join(tmpdir(), "bib-site-"));
    made.push(root);
    writeDeclaration(root, { name: "site-x", directories: [{ id: "references", path: "references/", graphTypologies: ["references"] }] });
    put(root, "references/zeta2020.json", { $schema: "folio-reference/v1", id: "zeta2020", type: "book", title: "Own work", author: [{ family: "Zeta", given: "Z" }] });
    const dep = join(root, "dep-x");
    mkdirSync(dep, { recursive: true });
    writeDeclaration(dep, { name: "dep-x", directories: [{ id: "references", path: "references/", graphTypologies: ["references"] }] });
    put(dep, "references/alpha2019.json", { $schema: "folio-reference/v1", id: "alpha2019", type: "book", title: "Dependency work", author: [{ family: "Alpha", given: "A" }] });
    return root;
  }
  const c = collect(siteCheckout());
  const files = outputs(c);
  const page = (suffix: string) => [...files].find(([p]) => p.endsWith(suffix))![1];

  test("rootInstanceIsOwn", () => {
    expect(c.invalid).toEqual([]);
    expect(c.own).toBe("site-x");
    expect(c.subgraphs.map((s) => [s.instance, s.slug])).toEqual([
      ["dep-x", "dep-x-references"],
      ["site-x", "references"],
    ]);
  });

  test("ownFirstDepsInClosedSection", () => {
    const root = page("bibliography/index.md");
    const own = root.indexOf('data-fa-bib-key="zeta2020" data-fa-bib-href="references/zeta2020/"');
    const deps = root.indexOf('<details class="fa-bib-deps"');
    const dep = root.indexOf('data-fa-bib-key="alpha2019" data-fa-bib-href="dep-x-references/alpha2019/"');
    expect(own).toBeGreaterThan(-1);
    expect(deps).toBeGreaterThan(own);
    expect(dep).toBeGreaterThan(deps);
    expect(root).toContain("<strong>From dependencies</strong>");
    expect(root).toContain("They are not part of site-x.");
    expect(root).toContain("dep-x <small>(dependency, 1 reference)</small>");
    expect(root).toContain("**site-x (this site), by sub-graph:** <a href=\"references/\">references</a> (1)");
    expect(root).toContain("**Dependencies, by sub-graph:** <a href=\"dep-x-references/\">references</a> (1, dep-x)");
  });

  test("layerSubgraphPageOwnOnly", () => {
    expect(page("bibliography/references/index.md")).toContain('data-fa-bib-key="zeta2020"');
    expect(page("bibliography/references/index.md")).not.toContain('data-fa-bib-key="alpha2019"');
    const dep = page("bibliography/dep-x-references/index.md");
    expect(dep).toContain('data-fa-bib-key="alpha2019"');
    expect(dep).toContain("a dependency of site-x");
  });

  test("noRootInstanceOneList", () => {
    const plain = [...outputs(collect(checkout()))].find(([p]) => p.endsWith("bibliography/index.md"))![1];
    expect(plain).not.toContain("<details class=\"fa-bib-deps\"");
    expect(plain).toContain("**By sub-graph:**");
  });
});

describe("one page per entry, a slash address and no anchor (owner, 2026-11-08)", () => {
  // Two IGs' catalogues can each hold the same work under the same key
  // (who-guideline-handbook in smart-trust-phw and smart-immunizations, bean
  // djj5): each has its own page under its own sub-graph.
  const ref = ReferenceNodeSchema.parse({ $schema: "folio-reference/v1", id: "who-guideline-handbook", type: "book", title: "WHO handbook for guideline development" });
  const a = { ref, instance: "smart-trust-phw", subgraph: "catalogue", file: "a" };
  const b = { ref, instance: "smart-immunizations", subgraph: "catalogue", file: "b" };
  const c = {
    entries: [a, b],
    subgraphs: [
      { id: "catalogue", instance: "smart-trust-phw", kind: "catalogue" as const, path: "p/catalogue", slug: "smart-trust-phw-catalogue" },
      { id: "catalogue", instance: "smart-immunizations", kind: "catalogue" as const, path: "i/catalogue", slug: "smart-immunizations-catalogue" },
    ],
    assets: [],
    invalid: [],
  };
  const files = outputs(c);
  const find = (suffix: string) => [...files].find(([p]) => p.endsWith(suffix))?.[1];

  test("noAnchorIds", () => {
    const index = find("bibliography/index.md")!;
    expect(index).not.toMatch(/<li id=/);
    expect(index).not.toContain("#ref-");
    expect(index).toContain('data-fa-bib-href="smart-trust-phw-catalogue/who-guideline-handbook/"');
    expect(index).toContain('data-fa-bib-href="smart-immunizations-catalogue/who-guideline-handbook/"');
  });

  test("entryPageHoldsDetail", () => {
    const page = find("smart-trust-phw-catalogue/who-guideline-handbook/index.md")!;
    expect(page).toContain('title: "WHO handbook for guideline development"');
    expect(page).toContain('<section class="fa-bib-detail" data-fa-bib-key="who-guideline-handbook">');
    expect(page).toContain("<h3>Sources</h3>");
    expect(page).toContain("No link to the work is recorded");
    expect(page).toContain('<a href="../">All references of smart-trust-phw-catalogue</a>');
  });

  test("subgraphPageLinksBesideIt", () => {
    expect(find("smart-immunizations-catalogue/index.md")).toContain('data-fa-bib-href="who-guideline-handbook/"');
  });

  test("detailListsEverySource", () => {
    const r = ReferenceNodeSchema.parse({
      $schema: "folio-reference/v1",
      id: "dspace",
      type: "document",
      title: "DSpace 7 REST Contract",
      URL: "https://github.com/DSpace/RestContract/tree/dspace-7_x",
      DOI: "10.1/x",
      sources: [
        { url: "https://github.com/DSpace/RestContract/tree/1c16b57", label: "copy held", kind: "pinned" },
        { url: "https://github.com/DSpace/RestContract/tree/dspace-7_x/", kind: "repository" },
      ],
    });
    const html = detailHtml({ ref: r, instance: "core", subgraph: "library", file: "f" });
    expect(html).toContain('href="https://github.com/DSpace/RestContract/tree/dspace-7_x"');
    expect(html).toContain('href="https://doi.org/10.1/x"');
    expect(html).toContain(">copy held</a> <small>(pinned)</small>");
    // The trailing-slash twin of URL is the same place: listed once.
    expect(html.match(/href="https:\/\/github.com\/DSpace\/RestContract\/tree\/dspace-7_x/g)).toHaveLength(1);
  });

  test("panelScriptOnEveryList", () => {
    expect(find("bibliography/index.md")).toContain("fa-bib-panel");
  });
});

describe("one instance's own bibliography, for its page inside a composed site (bean djj5)", () => {
  // Owner, 2026-11-03: build a bibliography page per IG. An IG's pages link
  // `en/folio-assistant-core/bibliography/` relative to the IG's site, which
  // an index composes at `/<ig>/`.
  const mk = (id: string, instance: string) => ({
    ref: ReferenceNodeSchema.parse({ $schema: "folio-reference/v1", id, type: "webpage", title: id }),
    instance,
    subgraph: `${instance}-catalogue`,
    file: id,
  });
  const c = {
    entries: [mk("a", "smart-trust"), mk("b", "smart-base"), mk("c", "smart-immunizations")],
    subgraphs: ["smart-trust", "smart-base", "smart-immunizations"].map((i) => ({ id: `${i}-catalogue`, instance: i, kind: "catalogue" as const, path: `${i}/catalogue`, slug: `${i}-catalogue` })),
    assets: [],
    invalid: [],
  };
  const needs: Record<string, string[]> = { "smart-trust": ["smart-base"], "smart-base": [], "smart-immunizations": ["smart-base"] };

  test("keepsInstanceAndNeeds", () => {
    const own = forInstance(c, "smart-trust", (n) => needs[n] ?? []);
    expect(own.own).toBe("smart-trust");
    expect(own.entries.map((e) => e.ref.id)).toEqual(["a", "b"]);
    expect(own.subgraphs.map((s) => s.instance)).toEqual(["smart-trust", "smart-base"]);
  });

  test("leavesOutALayerBelowsExtractedReferenceLists", () => {
    // Owner, 2026-11-12 ("A. IGs list own refs only"): who-iris's per-document
    // reference lists (`provenance: extracted`) stay on its own and the
    // platform's bibliography, not in every IG composed above it.
    const ex = (id: string, instance: string) => {
      const e = mk(id, instance);
      return { ...e, subgraph: `${instance}-references`, ref: { ...e.ref, provenance: "extracted" as const } };
    };
    const withLists = {
      ...c,
      entries: [...c.entries, ex("doc.1.1", "smart-base"), ex("own.1.1", "smart-trust")],
      subgraphs: [...c.subgraphs, ...["smart-base", "smart-trust"].map((i) => ({ id: `${i}-references`, instance: i, kind: "references" as const, path: `${i}/references`, slug: `${i}-references` }))],
    };
    const own = forInstance(withLists, "smart-trust", (n) => needs[n] ?? []);
    expect(own.entries.map((e) => e.ref.id)).toEqual(["a", "b", "own.1.1"]);
    expect(own.subgraphs.map((s) => s.id)).not.toContain("smart-base-references");
    expect(own.subgraphs.map((s) => s.id)).toContain("smart-trust-references");
  });

  test("pagesUnderInstance", () => {
    const pages = outputs(forInstance(c, "smart-trust", (n) => needs[n] ?? []), "/smart-trust");
    const root = [...pages].find(([p]) => p.endsWith("bibliography/index.md"))![1];
    expect(root).toContain("permalink: /smart-trust/en/folio-assistant-core/bibliography/");
    const sub = [...pages].find(([p]) => p.endsWith("smart-trust-catalogue/index.md"))![1];
    expect(sub).toContain("permalink: /smart-trust/en/folio-assistant-core/bibliography/smart-trust-catalogue/");
  });

  test("layerSiteTitlesNameTheLayer", () => {
    // just-the-docs matches `parent` by title across the composed site: a
    // layer's copy must not share the root's titles, or each tree adopts the
    // others' pages (folio-assistant run 42942756201 ran out of resources).
    const pages = outputs(forInstance(c, "smart-trust", (n) => needs[n] ?? []), "/smart-trust");
    const root = [...pages].find(([p]) => p.endsWith("bibliography/index.md"))![1];
    expect(root).toContain('title: "Bibliography (smart-trust)"\n');
    const sub = [...pages].find(([p]) => p.endsWith("smart-trust-catalogue/index.md"))![1];
    expect(sub).toContain('title: "Bibliography (smart-trust): smart-trust-catalogue"\n');
    expect(sub).toContain('parent: "Bibliography (smart-trust)"\n');
    for (const [p, s] of pages) {
      if (!p.endsWith("index.md")) continue;
      expect(s).not.toMatch(/^(parent|grand_parent): "Bibliography(: [^"]*)?"$/m);
    }
  });
});
