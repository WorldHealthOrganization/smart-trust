/**
 * The pages `gen-iris-pages.ts` writes: the docs pages, the catalogue page's
 * inputs, the library's withheld list, and since 2026-10-30 the one page
 * left of the IRIS replica: its home page.
 *
 * @module who-iris/scripts/tests/gen-iris-pages.test
 */
import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { execFileSync, spawnSync } from "child_process";
import { createHash } from "crypto";

import {
  OWNED,
  authoredDocs,
  renderAuthored,
  RECENT_SUBMISSIONS_MAX,
  SITE_LOCALES,
  SITE_STRINGS,
  stripXmlComments,
  catalogueProblems,
  fixedPagesOf,
  requirementsFromSkill,
  rebaseToOwnSiteRoot,
} from "../gen-iris-pages.js";
import { coverNodes as nodesOf, pngSize, publicationBlockers } from "../../platform.ts";

const INSTANCE = resolve(import.meta.dir, "..", "..");
const DOCS = join(INSTANCE, "docs");
/**
 * The replica is in `site/` since bean `2b5s` (2026-09-30, the owner's
 * *"site/ + publish covers"*); it was library-side from 2026-09-21 until then.
 * `library/` is the CORPUS only — the covers and `withheld.json` the replica
 * reads — so a test that wants a replica page reads `site/`, and `read()`
 * routes by what the page IS rather than by where it used to be.
 */
const SITE = join(INSTANCE, "site");
const LIB = join(INSTANCE, "library");
/** Every rendered page, both sides, as `read()` would resolve them. */
const allHtml = (): string[] => [
  ...readdirSync(SITE).filter((f) => f.endsWith(".html")),
  ...readdirSync(DOCS).filter((f) => f.endsWith(".html")),
];

describe("the generator owns its filenames, and prunes only those", () => {
  it("committedHtmlIsExactlyGenerated", () => {
    // The orphan guard, asserted against the COMMITTED tree rather than a
    // temp dir. Re-keying two items on 2026-09-20 left
    // `item-item-local-*.html` behind — nine files where seven were wanted,
    // two of them serving a record the catalogue no longer describes, and
    // `--check` was blind because it only inspected what it was about to
    // write. This fails if that recurs.
    const html = allHtml();
    expect(html.length).toBeGreaterThan(3);
    // Since 2026-10-30 site/ holds only the replica's home page; the item,
    // collection and community pages are gone and their addresses 404.
    // A SECOND LIST BESIDE `OWNED`, and it has now gone stale in BOTH
    // directions within three days — which is the finding, not the chore.
    //
    // 2026-09-22 (morning): `catalogue.html` was added, written, pruned-checked
    // and gated, and this set still did not know it existed.
    // 2026-09-22 (later, bean `ha78` / issue #886): it MOVED out of who-iris
    // altogether, to the conventional viewer route under the built site, and
    // this set still listed it — so the assertion failed on a page whose
    // absence was the whole point of the change.
    //
    // NOW DERIVED (bean `o6vj`, issue #895). It was a hand-kept list, on the
    // reasoning that `OWNED` is a regex and cannot enumerate — true, and the
    // fix was to export the enumerable part rather than to keep a fourth copy
    // of it. `fixedPagesOf` is the generator's own declaration; the item and
    // collection families are still built from the catalogue here, because
    // those genuinely depend on the data and are what the orphan half of this
    // test is about.
    //
    // This does NOT weaken the assertion into agreeing with any change. The
    // per-side ownership guard now runs inside the generator on every
    // invocation, so a page added to a side that does not own it fails before
    // this test is reached — and what this still pins is that the committed
    // tree holds exactly the pages the declaration says, no more and no less.
    const wanted = new Set([
      "index.html",
      "search.html", // the search page (issue #196), in every language like the home page
      ...fixedPagesOf("docs"),
      // The renderings of the authored pages (bean `mw5z`), derived the way the generator derives them.
      ...authoredDocs(DOCS).map((d) => d.file.replace(/\.md$/, ".html")),
    ]);
    expect(html.filter((f) => !wanted.has(f))).toEqual([]);
    expect([...wanted].filter((f) => !html.includes(f))).toEqual([]);
  });

  it("ownedMatchesEmittedPages", () => {
    for (const f of allHtml()) {
      expect(OWNED.test(f)).toBe(true);
    }
  });

  it("ownedSparesForeignFiles", () => {
    // The other half, and the one that makes pruning safe to run at all:
    // `deletion-requires-confirmation` is about artefacts an agent did not
    // create, so the pattern must not reach them. Checked by name rather than
    // by deleting anything.
    for (const f of ["hand-authored.html", ".nojekyll", "README.md", "assets", "index.json"]) {
      expect(OWNED.test(f)).toBe(false);
    }
  });
});

describe("ingestion-notes is a projection of the skill, not a copy of it", () => {
  const SKILL = readFileSync(join(INSTANCE, "skills", "iris-dspace.md"), "utf-8");

  it("everyRequirementReachesPage", () => {
    // The point of generating the page: a requirement added to the skill and
    // not visible on the page would be a finding captured where nobody who
    // needs it is looking, which is the failure the page exists to prevent.
    const page = readFileSync(join(DOCS, "ingestion-notes.html"), "utf-8");
    const reqs = requirementsFromSkill(SKILL);
    expect(reqs.length).toBeGreaterThan(10);
    for (const r of reqs) expect(page).toContain(`>${r.id}</th>`);
    expect(page).toContain(`<strong>${reqs.length}</strong>`);
  });

  it("refusesEmptyRequirementsTable", () => {
    // A projection that quietly produces nothing when its source is renamed
    // reports "0 findings", which is indistinguishable from "no problems" and
    // is a lie. It throws instead, and the gate goes red.
    expect(() => requirementsFromSkill("# a skill with no requirements table\n")).toThrow(
      /no .* rows found/,
    );
  });

  it("requirementIdsUniqueAndGapless", () => {
    const ids = requirementsFromSkill(SKILL).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(ids.map((_, i) => `R${i + 1}`));
  });
});

describe("the IRIS home replica", () => {
  // The REPLICA's home, which is in `site/` now (bean `2b5s`).
  const home = readFileSync(join(SITE, "index.html"), "utf-8");

  it("recentSubmissionsCappedAtTen", () => {
    // Owner, 2026-11-10 (who-iris#207): the strip shows at most 10 items, however many the catalogue holds.
    const rows = home.match(/<article class="sub">/g) ?? [];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(RECENT_SUBMISSIONS_MAX);
    expect(RECENT_SUBMISSIONS_MAX).toBe(10);
  });

  it("referencedItemsLinkToLibraryNotIris", () => {
    // Owner, 2026-11-10 (card Q-IRIS-5 = A): a title in Recent Submissions goes
    // to our library entry page, never to IRIS or the Handle resolver.
    const titles = [...home.matchAll(/<a class="sub-title"[^>]* href="([^"]*)"/g)].map((m) => m[1]!);
    expect(titles.length).toBeGreaterThan(0);
    for (const href of titles) expect(href).toMatch(/^\.\.\/en\/cat-harness\/library\/who-iris\/[^/]+\/$/);
  });

  it("stripsNestedXmlComments", () => {
    expect(stripXmlComments("<svg><!-- a --><g/></svg>")).toBe("<svg><g/></svg>");
    expect(stripXmlComments("<!-<!-- x -->- y -->z")).toBe("z");
    expect(stripXmlComments("<a/>")).toBe("<a/>");
  });

  it("homeHasNoEmblemOrPhoto", () => {
    // The instruction this page exists under: a replica carrying the real mark
    // is indistinguishable from the real site at a glance. Checked by name
    // because the capture ships `who_logo.svg` and it is one copy-paste away.
    expect(home).not.toContain("who_logo");
    expect(home).not.toContain(".jpg");
    expect(home.toLowerCase()).not.toContain("emblem.svg");
  });

  /**
   * Is the PDF backend here? Asked once, the way `gen-covers` asks it.
   *
   * The CI gate job installs `ruff` and nothing else. `gen-covers.ts` carries
   * a paragraph about exactly this — `iris:covers:check` went into that job
   * and "turned the branch red three times" — and the first version of the
   * test below was written anyway, in the same session that read it. It went
   * red on the first CI run for precisely the documented reason.
   */
  const pdfBackend = spawnSync("python3", ["-c", "import pymupdf"]).status === 0;

  it("emblemMaskedInCoverBytes", () => {
    // The display flag is not the guarantee. `pdf-cover.py` blanks the region
    // before it computes the digests, so the committed PNG cannot carry the
    // emblem whatever a page decides to do with it.
    //
    // WITHOUT THE BACKEND this degrades to *slightly less* and says so, rather
    // than to could-not-determine — `verifyWithoutRender`'s rule, and the
    // reason it exists: a check reporting `unknown` on every CI run is a check
    // nobody reads. Two of the three claims need no decoder at all.
    //
    // MASK_FILL is spelled here rather than imported: this test's job is to be
    // an independent witness, and a constant shared with the thing it checks
    // agrees with it by construction.
    const nodeDir = join(INSTANCE, "catalogue", "nodes");
    let pixelChecked = 0;
    let declaredChecked = 0;
    const regions: { name: string; p: string; r: number[] }[] = [];

    for (const f of readdirSync(nodeDir).filter((x) => x.endsWith(".json"))) {
      const n = JSON.parse(readFileSync(join(nodeDir, f), "utf-8"));
      for (const b of n.bitstreams ?? []) {
        for (const r of b.maskedRegions ?? []) {
          const abs = join(INSTANCE, b.materialization.localPath);

          // (1) The bytes on disk are the ones the claim describes. No decoder.
          const sha = createHash("sha256").update(readFileSync(abs)).digest("hex");
          expect(sha, `${b.name}: committed bytes are not the declared ones`).toBe(
            b.materialization.fixity.digest,
          );

          // (2) The rectangle fits the ACTUAL file, read from its IHDR — not
          // from the declaration, which is the thing that could be stale. This
          // is the "measured against a different rendering" defect, and it is
          // checkable with no backend.
          const size = pngSize(readFileSync(abs))!;
          expect(size, `${b.name}: not a readable PNG`).toBeDefined();
          expect(r.x1, `${b.name}: mask runs past the real width`).toBeLessThanOrEqual(size.w);
          expect(r.y1, `${b.name}: mask runs past the real height`).toBeLessThanOrEqual(size.h);
          declaredChecked++;

          // (3) The pixels really are flat fill. Needs a decoder.
          if (pdfBackend) regions.push({ name: b.name, p: abs, r: [r.x0, r.y0, r.x1, r.y1] });
        }
      }
    }

    // (3) The pixels really are flat fill. Needs a decoder; one process for
    // every region (with the pilot covers, who-iris#207, there are over a
    // hundred, and a process each took minutes).
    if (pdfBackend && regions.length) {
      const lines = execFileSync("python3", [
        "-c",
        [
          "import pymupdf,sys,json",
          "for q in json.load(sys.stdin):",
          "  x0,y0,x1,y1 = q['r']",
          "  pm = pymupdf.Pixmap(q['p'])",
          "  pm = pymupdf.Pixmap(pm, 0) if pm.alpha else pm",
          "  b,W,n = pm.samples, pm.width, pm.n",
          "  cols = {tuple(b[(y*W+x)*n:(y*W+x)*n+3]) for y in range(y0,y1) for x in range(x0,x1)}",
          "  print(len(cols), sorted(cols)[0] if cols else ())",
        ].join("\n"),
      ], { input: JSON.stringify(regions) }).toString().trim().split("\n");
      regions.forEach((q, i) => {
        expect(lines[i], `${q.name}: mask is not a single flat colour`).toMatch(/^1 /);
        expect(lines[i]).toContain("128, 128, 128");
        pixelChecked++;
      });
    }

    // A sweep that found nothing must not report clean — the `dh4f` shape.
    expect(declaredChecked, "no masked region found to check").toBeGreaterThan(0);
    if (!pdfBackend) {
      console.log(
        `    (no pymupdf: checked ${declaredChecked} declared region(s) against each file's own ` +
          `IHDR and digest; the flat-fill pixel check was skipped)`,
      );
    } else {
      expect(pixelChecked).toBe(declaredChecked);
    }
  }, 60_000);
});

describe("the KG-to-portal page keeps its claims honest", () => {
  const page = readFileSync(join(DOCS, "kg-to-portal.html"), "utf-8");

  it("inlinesArchitectureDrawing", () => {
    // These pages are served from BOTH `/who-iris/` and `/docs/who-iris/`, so
    // a relative path to a file outside this directory resolves under one and
    // 404s under the other. Inlined, there is no path to be wrong.
    expect(page).toContain("<svg");
    expect(page).toContain("did:web");
    expect(page).not.toContain("cat-harness/docs/assets");
  });

  it("namesWhoDidAsTrustAnchor", () => {
    expect(page).toContain("WHO signing DID — did:web + x5c chain");
    expect(page).toContain("publicKeyJwk.x5c");
    expect(page).toContain("No GDHCN trust list is assumed.");
    expect(page).not.toContain("The trust anchor is to be <strong>GDHCN</strong>");
  });

  it("claimsNoUnbuiltStage", () => {
    // The page's whole value is that it says where who-iris actually is.
    // Package, sign and verify are not built here, and a page that quietly
    // promoted one would be the `xom7` shape: it looks exactly like a working
    // pipeline from in here.
    for (const s of ["Package", "Sign", "Verify"]) {
      const row = new RegExp(`<strong>${s}</strong>[\\s\\S]{0,600}?</tr>`);
      const m = row.exec(page);
      expect(m).not.toBeNull();
      expect(m![0]).toContain("not built");
    }
  });

  it("upstreamFiguresFromCatalogue", () => {
    const cat = JSON.parse(readFileSync(join(INSTANCE, "catalogue", "catalogue.json"), "utf-8"));
    expect(page).toContain(cat.totalItemsUpstream.toLocaleString("en-US"));
    expect(page).toContain(cat.totalFilesUpstream.toLocaleString("en-US"));
  });

  it("saysReadersNotMeasured", () => {
    // Traffic is bytes x requests and nothing here counts requests. An
    // invented reader count would make every cost figure under it fiction.
    expect(page).toContain("not measured");
  });
});

describe("a phone-width reader never pans sideways — bean `xwrt`", () => {
  it("inlineCodeBreaksOnEveryPage", () => {
    // Mounted verbatim, so the harness's narrow-viewport.css never reaches
    // these pages. Three long code spans made kg-to-portal 566 px wide at a
    // 390 px viewport before the rule was in the generator's own stylesheet.
    // docs/ only: site/ holds nothing but the retired replica's redirects.
    const pages = readdirSync(DOCS).filter((f) => f.endsWith(".html")).map((f) => join(DOCS, f));
    expect(pages.length).toBeGreaterThan(0);
    const missing = pages.filter((p) => !readFileSync(p, "utf-8").includes(":not(pre) > code { overflow-wrap: anywhere; }"));
    expect(missing).toEqual([]);
  });
});

describe("every generated page carries the Do not hand-edit marker — bean `7te5`", () => {
  it("everyPageCarriesGeneratorBanner", () => {
    const pages = readdirSync(DOCS).filter((f) => f.endsWith(".html")).map((f) => join(DOCS, f));
    expect(pages.length).toBeGreaterThan(0);
    const missing = pages.filter((p) => !readFileSync(p, "utf-8").includes("Do not hand-edit: the next run overwrites it"));
    expect(missing).toEqual([]);
  });
});

describe("library/ is the corpus only — bean 2b5s", () => {
  it("libraryHoldsNoPage", () => {
    // `mount-instance-docs.ts` mounts a directory that carries an index.html
    // and copies all of it. An index.html here is what published 1,367
    // corpus sidecars at two routes; the generator's sweep prunes one, and
    // this is the committed tree agreeing.
    expect(readdirSync(LIB).filter((f) => f.endsWith(".html"))).toEqual([]);
  });
});

describe("library/withheld.json is the catalogue's gates, for the mount — bean cw35", () => {
  const w = JSON.parse(readFileSync(join(LIB, "withheld.json"), "utf-8")) as { paths: { path: string }[] };
  const listed = new Set(w.paths.map((p) => p.path));
  const items = nodesOf(INSTANCE).filter((n) => n.libraryId);
  const originalBlocked = (n: (typeof items)[number]) =>
    (n.bitstreams ?? []).some(
      (b) => b.bundle === "ORIGINAL" && b.materialization?.state === "materialized" && publicationBlockers(b.materialization?.gates).length > 0,
    );

  it("withholdsExactlyGatedItems", () => {
    const blocked = items.filter(originalBlocked);
    const open = items.filter((n) => !originalBlocked(n));
    expect(open.length, "no publishable item — the assertion below is vacuous").toBeGreaterThan(0);
    for (const n of blocked) expect(listed.has(`${n.libraryId}/`), `${n.libraryId} should be withheld`).toBe(true);
    for (const n of open) expect(listed.has(`${n.libraryId}/`), `${n.libraryId} is publishable and must not be withheld`).toBe(false);
  });

  it("withheldPathsExist", () => {
    for (const p of listed) expect(existsSync(join(LIB, p)), `${p} is listed but absent`).toBe(true);
  });
});

describe("the replica in the six UN languages — issue #2228", () => {
  it("translationCataloguesComplete", () => {
    expect(SITE_STRINGS.length).toBeGreaterThan(0);
    expect(catalogueProblems().problems).toEqual([]);
  });
});

/**
 * The site root the pages derive in the browser, read back out of a page as
 * it ships — not out of the generator's constant, so the test fails if the
 * page and the source ever disagree.
 *
 * The last two rows are the case that broke: this instance's OWN site, served
 * from a repository also named `who-iris`, where a lazy match stopped at the
 * base path and every PDF frame asked the host root for the viewer (a 404 the
 * owner hit on the live site, 2026-10-09). Read from a docs page since the
 * replica's item pages went (2026-10-30); the docs pages carry the same pattern.
 */
describe("the page finds its site root on every host it is served from", () => {
  const html = readFileSync(join(DOCS, "ingestion-notes.html"), "utf-8");
  const m = /new RegExp\(("(?:[^"\\]|\\.)*")\)/.exec(html);
  it("pageCarriesSiteRootPattern", () => expect(m).not.toBeNull());
  const re = new RegExp(JSON.parse(m![1]!) as string);
  const rows: [string, string][] = [
    ["/who-iris/item-x.html", "/"],
    ["/docs/who-iris/ingestion-notes.html", "/"],
    ["/folio-assistant/who-iris/item-x.html", "/folio-assistant/"],
    ["/STAGING/branch/who-iris/item-x.html", "/STAGING/branch/"],
    ["/who-iris/who-iris/item-x.html", "/who-iris/"],
    ["/who-iris/who-iris/fr/item-x.html", "/who-iris/"],
    ["/who-iris/docs/who-iris/ingestion-notes.html", "/who-iris/"],
  ];
  for (const [path, root] of rows) it(`findsSiteRoot[${path}]`, () => expect(path.match(re)?.[1]).toBe(root));
});

describe("the docs landing page lists the authored pages it does not generate (bean mw5z)", () => {
  it("derivesAuthoredDocsFromDirectory", () => {
    const d = mkdtempSync(join(tmpdir(), "iris-docs-"));
    writeFileSync(join(d, "README.md"), "# The directory\n");
    writeFileSync(join(d, "site-home.md"), "---\nlayout: default\n---\n# Home\n");
    writeFileSync(join(d, "style-guide.md"), "# The WHO style guide\n\nText.\n");
    writeFileSync(join(d, "notes.md"), "No heading here.\n");
    writeFileSync(join(d, "index.html"), "<h1>x</h1>");
    expect(authoredDocs(d)).toEqual([
      { file: "notes.md", title: "notes" },
      { file: "style-guide.md", title: "The WHO style guide" },
    ]);
  });

  it("authoredPagesRenderedAndLinked", () => {
    const docs = join(import.meta.dir, "..", "..", "docs");
    const index = readFileSync(join(docs, "index.html"), "utf-8");
    for (const d of authoredDocs(docs)) {
      const html = d.file.replace(/\.md$/, ".html");
      expect(existsSync(join(docs, html))).toBe(true);
      expect(index).toContain(`href="${html}"`);
      expect(index).not.toContain(`href="${d.file}"`);
    }
  });

  it("rendersGfmAndRewritesMdLinks", () => {
    const html = renderAuthored("# T\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n[s](style-guide.md#x) [o](../library/README.md)\n", new Set(["style-guide.md"]), null);
    expect(html).toContain("<table>");
    expect(html).toContain('href="style-guide.html#x"');
    expect(html).toContain('href="../library/README.md"');
  });

  it("citesOutsideFilesByRepository", () => {
    const html = renderAuthored(
      "[o](../library/README.md#a) [v](../skills/voices/) [g](../../AGENTS.md)\n",
      new Set(),
      "example/who-iris",
    );
    expect(html).toContain('href="https://github.com/example/who-iris/blob/HEAD/library/README.md#a"');
    expect(html).toContain('href="https://github.com/example/who-iris/tree/HEAD/skills/voices/"');
    // Climbing out of the instance is a source defect, left for the site's link check to report.
    expect(html).toContain('href="../../AGENTS.md"');
  });
});

describe("the catalogue page (bean kx0p)", () => {
  it("listsHeldFirstLabelsGatesNoViewer", async () => {
    const { catalogueViewer } = await import("../gen-iris-pages.ts");
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(import.meta.dir, "..", "..", "catalogue", "nodes");
    const all = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")));
    const page = catalogueViewer(all, { libraryViewer: false });
    const every = page.slice(page.indexOf('id="ic-nodes"'));
    const states = [...every.matchAll(/<td><span class="state ([a-z]+)">/g)].map((m) => m[1]);
    expect(states.length).toBe(all.length);
    const order = ["materialized", "referenced", "unknown"];
    expect(states).toEqual([...states].sort((a, b) => order.indexOf(a!) - order.indexOf(b!)));
    expect(states[0]).toBe("materialized"); // not vacuous: who-iris holds items
    const gates = page.slice(page.indexOf('id="ic-gates"'), page.indexOf('id="ic-nodes"'));
    expect(gates).toMatch(/<span class="state [a-z]+">[a-zA-Z]+: \d+ of \d+<\/span>/);
    expect(gates).not.toMatch(/<\/span> \d/);
    expect(page).not.toContain("library/who-iris/#");
    const full = catalogueViewer(all);
    expect(full).toContain("library/who-iris/#"); // the harness site's build keeps the viewer links
    expect(full).toContain("library/who-iris/b0426/"); // and links held item titles to their library entry pages
  });
});

describe("the replica keeps only its IRIS-style home page (owner, 2026-10-30)", () => {
  const home = (): string => readFileSync(join(SITE, "index.html"), "utf-8");

  // The search page joined the home page on 2026-11-08 (owner, issue #196).
  it("eachLocaleHasOnlyHomeAndSearchPages", () => {
    expect(readdirSync(SITE).filter((f) => f.endsWith(".html")).sort()).toEqual(["index.html", "search.html"]);
    for (const loc of SITE_LOCALES) expect(readdirSync(join(SITE, loc)).filter((f) => f.endsWith(".html")).sort()).toEqual(["index.html", "search.html"]);
  });

  it("searchPageFacetValuesAreComputedNotWritten", () => {
    const page = readFileSync(join(SITE, "search.html"), "utf-8");
    expect(page).toContain('href="index.html"');
    expect(page).toContain('id="iris-search-data"');
    // The facet list is empty in the HTML: every value and count is drawn in the browser from the data.
    expect(page).toContain('<div id="is-facets"></div>');
    expect(home()).toContain('action="search.html"');
    expect(home()).not.toContain("iris-facet-chips");
  });

  it("homeLinksHeldItemsToLibrary", () => {
    const items = readdirSync(join(INSTANCE, "catalogue", "nodes"))
      .map((f) => JSON.parse(readFileSync(join(INSTANCE, "catalogue", "nodes", f), "utf-8")) as { flavour?: string; libraryId?: string })
      .filter((n) => n.flavour === "item" && n.libraryId && existsSync(join(LIB, n.libraryId)));
    expect(items.length).toBeGreaterThan(0);
    // Recent Submissions is capped at 10 (who-iris#207), so a held item is linked
    // from the strip OR from the page's visualiser nav, which lists every held item.
    for (const n of items) {
      const url = `../en/cat-harness/library/who-iris/${n.libraryId}/`;
      expect(home().includes(`href="${url}"`) || home().includes(`"href":"${url}"`), `${n.libraryId} is not linked from the home page`).toBe(true);
    }
    expect(home()).not.toMatch(/href="(?:item-|collection-|community-list)/);
    expect(home()).toContain('href="../who-iris/catalogue/"');
  });

  it("rebasesLinksToOwnSiteRoot", () => {
    const html = rebaseToOwnSiteRoot('<a href="../who-iris/catalogue/">c</a><a href="index.html">h</a><a href="fr/index.html">fr</a><a href="../en/cat-harness/library/who-iris/x/">x</a><img src="../library/x-cover.png">');
    expect(html).toBe('<a href="catalogue/">c</a><a href="./">h</a><a href="who-iris/fr/index.html">fr</a><a href="en/cat-harness/library/who-iris/x/">x</a><img src="library/x-cover.png">');
  });

  it("rebasesJsonLinks", () => {
    const html = rebaseToOwnSiteRoot(
      '<script type="application/json" data-fa-visualiser-nav>[{"label":"Home","href":"index.html"},' +
        '{"label":"Community List","href":"../who-iris/catalogue/"},{"label":"x","href":"../en/cat-harness/library/who-iris/x/"},' +
        '{"label":"ext","href":"https://example.org/"}]</script>',
    );
    expect(html).toContain('"href":"./"');
    expect(html).toContain('"href":"catalogue/"');
    expect(html).toContain('"href":"en/cat-harness/library/who-iris/x/"');
    expect(html).toContain('"href":"https://example.org/"');
    expect(html).not.toContain('"href":"../');
  });
});

describe("search data is loaded when it is needed (owner, 2026-11-14)", () => {
  // "do lazy load content and libs": the home page fetches its search records
  // on first use, and the search page ships each record once, not twice.
  const homeOf = (dir: string): string => readFileSync(join(dir, "index.html"), "utf-8");
  const dirs = [SITE, ...SITE_LOCALES.map((l) => join(SITE, l))];

  /** The home page's inline search script, run against a stub page. */
  function runHomeScript(html: string, rows: unknown[], search = "") {
    // Any case, any attributes, and `</script >` with space before the `>`, as
    // an HTML parser closes it; only a script with no `type` is code to run.
    const script = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi)]
      .filter((m) => !/\btype\s*=/i.test(m[1]!))
      .map((m) => m[2]!)
      .find((s) => s.includes("iris-search-input"));
    if (!script) throw new Error("no home search script");
    const on: Record<string, ((e?: unknown) => void)[]> = {};
    const listen = (target: string) => (type: string, fn: (e?: unknown) => void) => {
      (on[`${target}:${type}`] ??= []).push(fn);
    };
    const results = { style: { display: "none" }, innerHTML: "", replaceChildren() { this.innerHTML = ""; } };
    const input = { value: "", addEventListener: listen("input") };
    const form = { addEventListener: listen("form") };
    const els: Record<string, unknown> = { "iris-search-form": form, "iris-search-input": input, "iris-search-results": results };
    const fetched: string[] = [];
    const win: Record<string, unknown> = { addEventListener: listen("window"), location: { search } };
    const fetchStub = (url: string) => {
      fetched.push(url);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(rows) });
    };
    // input-site: inert — runs the committed page's own inline script against stubs; it reads no environment
    new Function("window", "document", "fetch", "URLSearchParams", "console", script)(
      win,
      { getElementById: (id: string) => els[id] ?? null },
      fetchStub,
      URLSearchParams,
      { warn() {} },
    );
    const fire = (key: string) => (on[key] ?? []).forEach((fn) => fn());
    const settle = () => new Promise((r) => setTimeout(r, 0));
    return { input, results, fetched, fire, settle };
  }

  it("homeSearchRecordsAreAFileNotInline", () => {
    for (const dir of dirs) {
      const home = homeOf(dir);
      expect(home).not.toMatch(/var index = \[\{/);
      expect(home).toContain('var DATA = "home-search.json"');
      const rows = JSON.parse(readFileSync(join(dir, "home-search.json"), "utf-8")) as { title: string; href: string; text: string }[];
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) expect(typeof r.title === "string" && typeof r.href === "string" && typeof r.text === "string").toBe(true);
    }
  });

  it("homeSearchFetchesOnFirstUseOnly", async () => {
    const rows = JSON.parse(readFileSync(join(SITE, "home-search.json"), "utf-8")) as { title: string }[];
    const p = runHomeScript(homeOf(SITE), rows);
    expect(p.fetched).toEqual([]); // nothing at load
    p.fire("input:focus");
    p.fire("input:focus");
    await p.settle();
    expect(p.fetched).toEqual(["home-search.json"]); // once, however often it is focused
    p.input.value = rows[0]!.title.split(/\s+/)[0]!;
    p.fire("input:input");
    await p.settle();
    expect(p.results.style.display).toBe("block");
    expect(p.results.innerHTML).toContain("search-result-item");
    expect(p.fetched.length).toBe(1);
  });

  it("homeSearchPrintsComplete", async () => {
    // PRINT (owner, 2026-11-14: "Make sure printing loads all of the content
    // before it renders the PDF"): a box holding a query when the reader prints
    // loads its records on beforeprint, so the panel is not printed empty.
    const rows = JSON.parse(readFileSync(join(SITE, "home-search.json"), "utf-8")) as { title: string }[];
    const p = runHomeScript(homeOf(SITE), rows);
    p.input.value = rows[0]!.title.split(/\s+/)[0]!;
    p.fire("window:beforeprint");
    await p.settle();
    expect(p.fetched).toEqual(["home-search.json"]);
    expect(p.results.innerHTML).toContain("search-result-item");
    // And a ?q= link loads at once, without waiting for a focus.
    const q = runHomeScript(homeOf(SITE), rows, `?q=${encodeURIComponent(p.input.value)}`);
    await q.settle();
    expect(q.fetched).toEqual(["home-search.json"]);
    expect(q.results.innerHTML).toContain("search-result-item");
  });

  it("searchRecordsCarryNoLowerCasedCopies", () => {
    for (const dir of dirs) {
      const page = readFileSync(join(dir, "search.html"), "utf-8");
      const m = /<script\b[^>]*\bid="iris-search-data"[^>]*>([\s\S]*?)<\/script\b[^>]*>/i.exec(page);
      const records = JSON.parse(m![1]!) as Record<string, unknown>[];
      expect(records.length).toBeGreaterThan(0);
      for (const r of records) {
        for (const k of ["titleLc", "abstractLc", "facetLc", "text"]) expect(r).not.toHaveProperty(k);
        expect(typeof r.ids).toBe("string");
      }
      // The client makes them as it parses.
      for (const k of ["it.titleLc =", "it.abstractLc =", "it.facetLc =", "it.text ="]) expect(page).toContain(k);
    }
  });
});
