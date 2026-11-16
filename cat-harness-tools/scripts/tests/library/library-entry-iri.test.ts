/**
 * Every library entry has its own IRI — a materialized path whose page is a
 * thin shell that loads the entry from published data.
 *
 * Owner, 2026-10-02 (#1881): *"each link/page needs to be materialized on the
 * CDN (gh-pagees), just load the content from the KG json(ld) assets already
 * published"*; *"no query strings... each asset gets its own IRI"*; and 404
 * routing ruled out as *"a hack"*.
 *
 * These pin the parts that are not a browser's to judge: the path parser and
 * the legacy-fragment reader (the SAME source string the published script
 * carries), the shell template, the committed shells, and the referenced
 * `smart-trust` entry the owner's own example URL names. The browser half is
 * `cat-harness/test/library-entry-iri.e2e.ts`.
 *
 * @module scripts/tests/library-entry-iri
 *
 * The tests of this file that read the whole checkout (reads the library
 * entries of smart-base, smart-trust and fhir-harness) live in
 * `test/library-entry-iri-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { EDIT_LINKS_RUNTIME } from "../../../src/core/edit-links.ts";
import { describe, expect, test } from "bun:test";
// Publish-time files are written to the layer output overlay (bean sm8r);
// these read the copy a site reader sees, falling back to the path given.
import { existsSync, readdirSync, readFileSync, statSync } from "../../../test/support/site-fs.ts";
import { join, resolve } from "node:path";

import { ADDRESS_JS } from "../../lib/library-address.ts";
import { pageNodeOf, pageNodeProblems } from "../../thin-page.ts";
import { libraryAssetIri } from "../../../schemas/library/library-iri.ts";
import { entryPageHtml, isEntryShellFor, isSubjectShell, libraryConfigOf, VIEWER_JS, viewerHtml } from "../../gen-library-viz.ts";
import { ReferencedSourceSchema } from "../../../schemas/library/referenced-source.ts";
import { LibraryIndexSchema } from "../../../schemas/ui/site-indexes.ts";
import { checkEntry } from "../../check-l1-complete.ts";
import { readDeclaration, siteDirFor, siteFileFor } from "../../../schemas/kg/cat-harness.ts";
import { DOCS_SITE, libraryAssetSitePath, libraryStubSitePath } from "../../../schemas/library/library-iri.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { declaredPageRoute } from "../../viewer-declarations.ts";
import { siteNotBuilt } from "../../../test/support/checkout.ts";

const HARNESS = resolve(HARNESS_ROOT);
const REPO = resolve(HARNESS, "..");
const SITE = join(HARNESS, siteDirFor(HARNESS));
/**
 * The library viewer's DECLARED page route, `<locale>/<harness>/<id>` (owner,
 * 2026-10-09) — the route `gen-library-viz.ts` writes under, asked rather than
 * composed, so the locale segment the route gained is not restated here.
 */
const ROUTE = declaredPageRoute(HARNESS, "library-viewer")!;
const LIB = join(SITE, ROUTE);
const INDEX = join(SITE, "assets", "library", "index.json");
/**
 * The library projection and the entry shells beside it are written at
 * publish and gitignored (bean w1gy F18). `describe` still runs its body, so
 * an index that is not built reads as empty there and the tests over it skip.
 */
const NOT_BUILT = siteNotBuilt("the library projection `library:viz` writes at publish (gitignored)", INDEX);
type LibraryIndex = ReturnType<typeof LibraryIndexSchema.parse>;
const readIndex = (): LibraryIndex =>
  NOT_BUILT ? ({ entries: [] } as unknown as LibraryIndex) : LibraryIndexSchema.parse(JSON.parse(readFileSync(INDEX, "utf-8")));

/** The shipped source, evaluated — what is tested is what the page runs. */
// input-site: inert #e164e46d — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
const { entryFromPath, legacyKey } = new Function(`${ADDRESS_JS}\nreturn { entryFromPath, legacyKey };`)() as {
  entryFromPath: (p: string, root: string) => { instance: string; id: string } | null;
  legacyKey: (h: string) => string;
};

describe("reading an entry from its own path", () => {
  const root = "/folio-assistant/cat-harness/library/";
  test("an entry IRI, with or without its trailing slash or index.html", () => {
    for (const tail of ["smart-base/smart-trust/", "smart-base/smart-trust", "smart-base/smart-trust/index.html"]) {
      expect(entryFromPath(root + tail, root)).toEqual({ instance: "smart-base", id: "smart-trust" });
    }
  });
  test("a library page is not an entry, and neither is the whole view", () => {
    expect(entryFromPath(`${root}smart-base/`, root)).toBeNull();
    expect(entryFromPath(root, root)).toBeNull();
    expect(entryFromPath(`${root}index.html`, root)).toBeNull();
  });
  test("anything deeper, outside the root, or undecodable is refused rather than guessed", () => {
    expect(entryFromPath(`${root}a/b/c/`, root)).toBeNull();
    expect(entryFromPath("/elsewhere/smart-base/smart-trust/", root)).toBeNull();
    expect(entryFromPath(`${root}smart-base/%E0%A4%A/`, root)).toBeNull();
  });
  test("the script uses it, and carries no query-string addressing", () => {
    expect(VIEWER_JS).toContain(ADDRESS_JS);
    expect(VIEWER_JS).toContain("entryFromPath(location.pathname, LIB_ROOT)");
    expect(VIEWER_JS).not.toMatch(/location\.search|[?](entry|id|key)=/);
  });
});

describe("a legacy #key is read once, to be normalised to the path", () => {
  test("decodes the fragment form every old link carries", () => {
    expect(legacyKey("#smart-base%2Fsmart-trust")).toBe("smart-base/smart-trust");
    expect(legacyKey("#smart-base/smart-trust")).toBe("smart-base/smart-trust");
  });
  test("an empty or non-key fragment is not a key", () => {
    expect(legacyKey("")).toBe("");
    expect(legacyKey("#")).toBe("");
    expect(legacyKey("#badges")).toBe("");
  });
  test("normalisation is a replaceState to the entry's path, never a new fragment", () => {
    expect(VIEWER_JS).toContain("history.replaceState(null, \"\", to)");
    // The viewer's OWN code. The embedded edit-links runtime (bean zcak) puts a
    // block's address in a feedback issue's body with a fragment; that is a
    // link written into an issue, not navigation, so it is not this rule's.
    expect(VIEWER_JS.replace(EDIT_LINKS_RUNTIME, "")).not.toMatch(/"#" \+ encodeURIComponent/);
  });
});

describe("a row's TITLE opens the entry's own page (owner, 2026-10-02)", () => {
  // The shipped script, run against stubs: the projection fetch never
  // resolves, so only the module-level definitions run and COLS is returned.
  const pageUrl = "https://example.test/folio-assistant/cat-harness/library/smart-base/";
  // input-site: inert #c17f51b2 — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
  const run = new Function(
    "document",
    "location",
    "fetch",
    "window",
    "history",
    `${VIEWER_JS}\nreturn { COLS: COLS };`,
  ) as (...a: unknown[]) => { COLS: { k: string; f: (e: unknown) => string }[] };
  const { COLS } = run(
    {
      getElementById: () => null,
      addEventListener: () => {},
      // The page's identity is data-kg-* on its .lib-page element (issue #1830).
      querySelector: (sel: string) =>
        sel === ".lib-page" ? { dataset: { kgData: "../../../assets/library/index.json", kgScope: "smart-base", kgLibRoot: "../" } } : null,
    },
    { href: pageUrl, pathname: new URL(pageUrl).pathname, hash: "" },
    () => new Promise(() => {}),
    { addEventListener: () => {} },
    { replaceState: () => {} },
  );
  const title = COLS.find((c) => c.k === "title")!;
  test("a referenced entry with no README: the title links its path IRI", () => {
    const html = title.f({ instance: "smart-base", id: "smart-trust", title: "WHO SMART Trust", links: [] });
    expect(html).toContain('href="/folio-assistant/cat-harness/library/smart-base/smart-trust/" title="WHO SMART Trust">WHO SMART Trust</a>');
    expect(html).not.toContain("github.com");
  });
  test("the SLUG links the entry's `view`, composed against the site root", () => {
    const slug = COLS.find((c) => c.k === "id")!;
    const html = slug.f({ instance: "smart-base", id: "smart-trust", title: "T", view: "/smart-trust/" });
    expect(html).toContain('<a class="lib-view" href="/folio-assistant/smart-trust/">');
  });
  test("an entry WITH a README keeps it, as a secondary link only", () => {
    const html = title.f({ instance: "smart-base", id: "x", title: "X", readme: "https://github.com/o/r/blob/main/x/README.md" });
    expect(html).toMatch(/^<a class="lib-title" href="\/folio-assistant\/cat-harness\/library\/smart-base\/x\/" title="X">X<\/a>/);
    expect(html).toContain('<a class="src" href="https://github.com/o/r/blob/main/x/README.md">README</a>');
  });
});

/**
 * A page's `alternate` — the asset it renders. A THEMED page (2026-10-07) has
 * no head of its own, so it declares it in front matter and
 * `_includes/head_custom.html` writes the link from `alternate_jsonld`.
 */
function alternateOf(html: string): string | undefined {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(html)?.[1];
  const m = fm ? /^alternate_jsonld: "([^"]+)"$/m.exec(fm) : null;
  return m?.[1];
}

describe("the shell template", () => {
  const shell = entryPageHtml("../../../assets/library/index.json", "smart-base", "../../", {
    id: "smart-trust",
    jsonld: "../../../assets/library/jsonld/smart-base/source/smart-trust.jsonld",
  });
  test("holds identity only — config and alternate — and loads the shared assets", () => {
    expect(libraryConfigOf(shell)).toEqual({
      data: "../../../assets/library/index.json",
      scope: "smart-base",
      libRoot: "../../",
      entry: "smart-trust",
    });
    expect(alternateOf(shell)).toBe("../../../assets/library/jsonld/smart-base/source/smart-trust.jsonld");
    expect(shell).toContain('<script src="../../../assets/library/viewer.js"></script>');
    expect(shell).toContain('<link rel="stylesheet" href="../../../assets/library/viewer.css">');
    expect(shell).not.toContain("<style>");
  });
  test("declares its entry in RDFa and a JSON-LD stub, with no private config block (issue #1830)", () => {
    expect(pageNodeProblems(shell)).toEqual([]);
    expect(pageNodeOf(shell)!.rdfa[0]!.iri).toBe(libraryAssetIri("smart-base", "smart-trust"));
    expect(shell).not.toContain('type="application/json"');
    // A library's own page renders no single entry: it declares none.
    expect(pageNodeOf(viewerHtml("../../assets/library/index.json", "smart-base"))).toBeUndefined();
  });
  test("the entry IRI is extensionless kind/id; its JSON-LD and stub sit beside it (Q-THIN-6 B)", () => {
    const iri = libraryAssetIri("smart-base", "smart-trust");
    expect(iri).toBe(`${DOCS_SITE}assets/library/jsonld/smart-base/source/smart-trust`);
    expect(libraryAssetSitePath("smart-base", "smart-trust")).toBe("assets/library/jsonld/smart-base/source/smart-trust.jsonld");
    expect(libraryStubSitePath("smart-base", "smart-trust")).toBe("assets/library/jsonld/smart-base/source/smart-trust.html");
    expect(iri).not.toMatch(/[#?]/);
  });
  test("is a THEMED page (2026-10-07): the layout's band, no rail, no folio mount, both sources named", () => {
    // On the theme's default layout, which carries the top band and loads
    // docs-ui.js itself — so neither the rail declaration nor the mount
    // fragment belongs in it any more.
    expect(shell.startsWith("---\nlayout: default\n")).toBe(true);
    expect(shell).toContain('\ntitle: "smart-trust — smart-base library"\n');
    expect(shell).toContain("\nnav_exclude: true\n");
    expect(shell).toContain("\nsearch_exclude: true\n");
    expect(shell).not.toMatch(/<!doctype|<head|folio-navbar|data-fa-folio-mount/i);
    expect(shell).toContain('<a href="../../../assets/library/index.json">the library projection</a> and this entry from');
    // The body is Liquid-raw, so nothing in it is evaluated by Jekyll.
    expect(shell.indexOf("{% raw %}")).toBeLessThan(shell.indexOf('<div class="lib-page"'));
    expect(shell.trimEnd().endsWith("{% endraw %}")).toBe(true);
  });
  test("the layout writes the alternate it declares", () => {
    const include = readFileSync(join(HARNESS, siteFileFor(HARNESS, "_includes/head_custom.html")), "utf-8");
    expect(include).toContain(
      '{% if page.alternate_jsonld %}<link rel="alternate" type="application/ld+json" href="{{ page.alternate_jsonld }}">{% endif %}',
    );
  });
  test("an entry with no published JSON-LD gets no `alternate`, and its noscript names only the projection", () => {
    const bare = entryPageHtml("../../../assets/library/index.json", "smart-base", "../../", { id: "x" });
    expect(alternateOf(bare)).toBeUndefined();
    expect(bare).not.toContain("alternate");
    expect(bare).toContain("the library projection</a>; it needs JavaScript");
    expect(libraryConfigOf(bare)).toEqual({ data: "../../../assets/library/index.json", scope: "smart-base", libRoot: "../../", entry: "x" });
  });
  test("is a few KB", () => {
    expect(shell.length).toBeLessThan(4096);
  });
  test("the instance page is the same template, with no entry", () => {
    const page = viewerHtml("../../assets/library/index.json", "smart-base");
    expect(libraryConfigOf(page)).toEqual({ data: "../../assets/library/index.json", scope: "smart-base", libRoot: "../" });
    expect(isSubjectShell(page, "smart-base")).toBe(true);
    expect(isEntryShellFor("smart-base")(page, "smart-trust")).toBe(false);
    expect(isEntryShellFor("smart-base")(shell, "smart-trust")).toBe(true);
    expect(isSubjectShell(shell, "smart-base")).toBe(false);
  });
});

describe("the committed tree: one materialized shell per entry", () => {
  const index = readIndex();
  test.skipIf(NOT_BUILT)("every entry in the projection has a shell at <library>/<instance>/<id>/, and nothing else does", () => {
    const want = index.entries.map((e) => `${e.instance}/${e.id}`).sort();
    const have: string[] = [];
    for (const inst of readdirSync(LIB)) {
      const d = join(LIB, inst);
      if (!statSync(d).isDirectory()) continue;
      for (const id of readdirSync(d)) {
        const f = join(d, id, "index.html");
        if (existsSync(f) && isEntryShellFor(inst)(readFileSync(f, "utf-8"), id)) have.push(`${inst}/${id}`);
      }
    }
    expect(have.sort()).toEqual(want);
  });
  test.skipIf(NOT_BUILT)("each shell's alternate JSON-LD is published", () => {
    for (const e of index.entries.filter((x) => x.hasManifest)) {
      const f = join(LIB, e.instance, e.id, "index.html");
      const alt = alternateOf(readFileSync(f, "utf-8"));
      expect(alt, `${e.instance}/${e.id} names no JSON-LD`).toBeDefined();
      expect(existsSync(resolve(join(LIB, e.instance, e.id), alt!)), `${e.instance}/${e.id}: ${alt}`).toBe(true);
    }
  });
  // An item catalogued by reference holds no manifest, so it publishes no
  // JSON-LD (#1765): its shell names no `alternate` rather than a missing one,
  // the case the shell template's own test pins.
  test.skipIf(NOT_BUILT)("a shell whose entry holds no manifest names no alternate", () => {
    for (const e of index.entries.filter((x) => !x.hasManifest)) {
      const f = join(LIB, e.instance, e.id, "index.html");
      expect(alternateOf(readFileSync(f, "utf-8")), `${e.instance}/${e.id}`).toBeUndefined();
    }
  });
});

describe("asset and rendering: two resources, two IRIs (owner, 2026-10-02)", () => {
  // "each asset should have one IRI, but the view page is a rendering of that
  // asset, a different page. fix IRIs" — and "asset doesnt know about its
  // renderings".
  const index = readIndex();
  test("the site root the IRIs are minted under is the one the site is served at", () => {
    const cfg = readFileSync(join(SITE, "_config.yml"), "utf-8");
    const url = /^url:\s*"?([^"\n]+)"?/m.exec(cfg)?.[1];
    const baseurl = /^baseurl:\s*"?([^"\n]*)"?/m.exec(cfg)?.[1];
    expect(DOCS_SITE).toBe(`${url}${baseurl}/`);
  });
  test.skipIf(NOT_BUILT)("the rendering points TO the asset: its alternate resolves to the asset's file", () => {
    for (const e of index.entries.filter((x) => x.hasManifest)) {
      const shellDir = join(LIB, e.instance, e.id);
      const alt = alternateOf(readFileSync(join(shellDir, "index.html"), "utf-8"));
      expect(resolve(shellDir, alt!)).toBe(join(SITE, libraryAssetSitePath(e.instance, e.id)));
    }
  });
  test.skipIf(NOT_BUILT)("every entry's `view` is GENERATED into the projection: another instance's declared root, else its own page", () => {
    const byKey = new Map(index.entries.map((e) => [`${e.instance}/${e.id}`, e]));
    // A referenced entry the smart-trust instance renders, at its declared root.
    expect(byKey.get("smart-base/smart-trust")?.view).toBe("/smart-trust/");
    // An ingested PDF: rendered by the library viewer, at its own entry page.
    expect(byKey.get("who-iris/who-rhr-1806-eng")?.view).toBe(`/${ROUTE}/who-iris/who-rhr-1806-eng/`);
    for (const e of index.entries) {
      expect(e.view, `${e.instance}/${e.id}`).toBeDefined();
      // Every view is a page that exists on the site, or an instance root route.
      if (e.view!.startsWith(`/${ROUTE}/`)) expect(existsSync(join(SITE, e.view!, "index.html"))).toBe(true);
    }
  });
  test.skipIf(NOT_BUILT)("the asset never references a rendering of itself", () => {
    for (const e of index.entries.filter((x) => x.hasManifest)) {
      const text = readFileSync(join(SITE, libraryAssetSitePath(e.instance, e.id)), "utf-8");
      expect(text, e.id).not.toMatch(/subjectOf|foaf:page|"page"|\/library\/[^"]*\/index\.html|cat-harness\/library\//);
    }
  });
});

const HAS_SMART_TRUST_REF = existsSync(join(REPO, "smart-base", "library", "smart-trust", "referenced.json"));

describe.skipIf(!HAS_SMART_TRUST_REF)("smart-trust, referenced in smart-base's library (owner, 2026-10-02)", () => {
  if (!HAS_SMART_TRUST_REF) return;
  const dir = join(REPO, "smart-base", "library", "smart-trust");
  const rec = ReferencedSourceSchema.parse(JSON.parse(readFileSync(join(dir, "referenced.json"), "utf-8")));
  const ig = JSON.parse(readFileSync(join(REPO, "smart-trust", "fhir-artifact-index", "index.json"), "utf-8")) as {
    packageId: string;
    canonicalBase: string;
  };
  // The record names the PUBLICATION as read on its `read_at` date. The index
  // beside it is built from the IG's source at publish (fhir-harness#124), so
  // it shares the publication's identity (canonical, package id) but not its
  // version, which moves with the source. The version is checked against the
  // record's own identity.
  test("is a valid referenced record of a PUBLICATION, with the identity of the IG the index describes", () => {
    expect(rec.materialization.state).toBe("referenced");
    expect(rec.source).toMatchObject({ kind: "published", canonical: ig.canonicalBase, package_id: ig.packageId });
    const src = rec.source;
    if (!("version" in src)) throw new Error("the record's source is not a publication");
    expect(rec.identity.version).toBe(src.version);
  });
  test("holds nothing of the IG and passes the L1 gate", () => {
    for (const d of ["sections", "blocks", "images"]) expect(existsSync(join(dir, d))).toBe(false);
    expect(checkEntry(dir).requirements.filter((q) => q.state === "unmet")).toEqual([]);
  });
  test("links the published IG and this site's artefact index — the instance's declared root", () => {
    expect(rec.links).toContainEqual({ label: "published IG", url: "http://smart.who.int/trust" });
    // The site path is the smart-trust instance's ROOT route, which is what its
    // declaration's `instanceRoot` docs directory publishes at.
    const decl = readDeclaration(join(REPO, "smart-trust"))!;
    expect(decl.directories?.some((d) => (d as { instanceRoot?: boolean }).instanceRoot && d.graphTypologies?.includes("docs"))).toBe(true);
    expect(rec.links).toContainEqual({ label: "artefact index", site_path: `${decl.name}/` });
  });
  test.skipIf(NOT_BUILT)("appears in smart-base's library projection, with its links", () => {
    const index = readIndex();
    const e = index.entries.find((x) => x.instance === "smart-base" && x.id === "smart-trust");
    expect(e?.rung).toBe("referenced");
    expect(e?.title).toBe("WHO SMART Trust");
    expect(e?.links).toEqual([
      { label: "published IG", href: "http://smart.who.int/trust" },
      { label: "artefact index", href: "/smart-trust/" },
    ]);
  });
});
