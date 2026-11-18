/**
 * An artefact's TAB VIEWS as thin pages (owner, 2026-10-14, answering whether
 * the IG Publisher's per-artefact tab views are rendered: "3. Render them
 * too"; and "I DO NOT WANT THE IG PUBLISHER HTML").
 *
 * Over a non-WHO IG (`ig-fixture.ts`) built the way an IG repository's own
 * site builds it (`gen-ig-pages --ig-site --publisher-data .`): a page per
 * view, at the Publisher's tab file name beside the artefact's page; each one
 * thin and free of the Publisher's chrome; every link and every file its
 * config names resolving in the site; the artefact's page linking its tabs;
 * and the narrative's links to the Publisher's tab file names pointed at
 * them.
 *
 * @module fhir-harness/scripts/ig-tab-views.test
 */
import { afterAll, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix, resolve } from "node:path";

import { FhirArtifactIndexSchema } from "../schemas/fhir-artifact-index.js";
import { IPS, artifactIndex, scratchRepo } from "../test/support/ig-fixture";
import { relinkArtifacts, stageIgSite } from "./build-ig-site";
import { PUBLISHER_CHROME, publisherChromePages, stateFromOutput } from "./ig-repo-site";
import { artifactPageConfigOf, artifactTabFile, artifactTabs, thinArtifactView, thinViewRedirect } from "./ig-thin-pages.ts";
import { artifactsFor } from "./stage-ig-sites";

const ROOT = resolve(import.meta.dir, "..", "..");
const SCRIPT = join(ROOT, "fhir-harness/scripts/gen-ig-pages.ts");
const BASE = "/x-ig";
const PROFILE = `${IPS.canonical}/StructureDefinition/Composition-uv-ips`;

/**
 * The index an IG site's compose reconstructs from `output/`: the profile, an
 * instance that claims it, and a ValueSet. Each published at the site's own
 * address, as `ig-index:build` writes it.
 */
function siteIndex(id: string): Record<string, unknown> {
  const ix = artifactIndex(IPS, id) as { artifacts: Record<string, unknown>[]; count: number };
  const at = (stem: string) => ({ json: { url: `${BASE}/${stem}.json` }, html: { url: `${BASE}/${stem}.html` } });
  const ref = (stem: string) => ({ state: "referenced", provenance: { upstream: `${BASE}/${stem}.html` } });
  const [profile] = ix.artifacts;
  profile!.published = at("StructureDefinition-Composition-uv-ips");
  profile!.materialization = ref("StructureDefinition-Composition-uv-ips");
  ix.artifacts.push(
    {
      key: "Composition/example",
      resourceType: "Composition",
      id: "example",
      published: at("Composition-example"),
      materialization: ref("Composition-example"),
      category: "Example: Composition",
      title: "An example",
      profiles: [PROFILE],
    },
    {
      key: "StructureDefinition/Lonely",
      resourceType: "StructureDefinition",
      id: "Lonely",
      published: at("StructureDefinition-Lonely"),
      materialization: ref("StructureDefinition-Lonely"),
      canonical: `${IPS.canonical}/StructureDefinition/Lonely`,
      name: "Lonely",
      category: "Structures: Resource Profiles",
      title: "A profile nothing claims",
    },
    {
      key: "ValueSet/sections",
      resourceType: "ValueSet",
      id: "sections",
      published: at("ValueSet-sections"),
      materialization: ref("ValueSet-sections"),
      canonical: `${IPS.canonical}/ValueSet/sections`,
      name: "Sections",
      category: "Terminology: Value Sets",
      title: "Sections",
    },
  );
  ix.count = ix.artifacts.length;
  return ix;
}

const repo = scratchRepo({ site: { index: siteIndex("site") } });
afterAll(() => rmSync(repo, { recursive: true, force: true }));
const inst = join(repo, "site");
const docs = join(inst, "docs");
const gen = Bun.spawnSync(["bun", "run", SCRIPT, "--instance", inst, "--label", "X IG", "--ig-site", "--publisher-data", "."], { cwd: ROOT });
if (gen.exitCode !== 0) throw new Error(`gen-ig-pages failed:\n${gen.stderr.toString()}${gen.stdout.toString()}`);
// What the rest of the site serves beside the artefact pages: the IG's own
// pages (`build-ig-site`) and the Publisher's JSON, copied as data
// (`ig-site:publisher-pages`).
for (const f of ["index.html", "artifacts.html", "toc.html"]) writeFileSync(join(docs, f), "<!doctype html><title>x</title>");
for (const stem of ["StructureDefinition-Composition-uv-ips", "StructureDefinition-Lonely", "Composition-example", "ValueSet-sections"]) writeFileSync(join(docs, `${stem}.json`), "{}");

const page = (file: string) => readFileSync(join(docs, "artifact", file), "utf8");
const IX = FhirArtifactIndexSchema.parse(siteIndex("unit"));
const [SD, EXAMPLE, , VS] = IX.artifacts as [(typeof IX.artifacts)[0], (typeof IX.artifacts)[0], (typeof IX.artifacts)[0], (typeof IX.artifacts)[0]];

describe("artifactTabs: which views an artefact gets, at the Publisher's file names", () => {
  it("profileTabs", () => {
    expect(artifactTabs(SD, { resource: true }).map((t) => t.file)).toEqual([
      "StructureDefinition-Composition-uv-ips.html",
      "StructureDefinition-Composition-uv-ips-definitions.html",
      "StructureDefinition-Composition-uv-ips-mappings.html",
      "StructureDefinition-Composition-uv-ips.profile.json.html",
      "StructureDefinition-Composition-uv-ips-examples.html",
    ]);
  });
  it("otherTabs", () => {
    expect(artifactTabs(VS, { resource: true }).map((t) => t.file)).toEqual(["ValueSet-sections.html", "ValueSet-sections.json.html"]);
    expect(artifactTabFile(EXAMPLE, "json")).toBe("Composition-example.json.html");
  });
  it("noResourceNoTabs", () => {
    expect(artifactTabs(SD, { resource: false })).toEqual([]);
  });
  it("sidecarTabs", () => {
    // The IG API sidecars are views of the same page, after the JSON (fhir-harness#325 step 3).
    expect(artifactTabs(VS, { resource: true, sidecars: ["schema", "jsonld"] }).map((t) => [t.view, t.file, t.href])).toEqual([
      ["content", "ValueSet-sections.html", "ValueSet-sections.html"],
      ["json", "ValueSet-sections.json.html", "ValueSet-sections.html?view=json"],
      ["jsonld", "ValueSet-sections.jsonld.html", "ValueSet-sections.html?view=jsonld"],
      ["schema", "ValueSet-sections.schema.json.html", "ValueSet-sections.html?view=schema"],
    ]);
    // A sidecar alone still gives the page its tabs.
    expect(artifactTabs(VS, { resource: false, sidecars: ["jsonld"] }).map((t) => t.view)).toEqual(["content", "jsonld"]);
  });
});

describe("thinArtifactView: one shell, the view in its config", () => {
  const tabs = artifactTabs(SD, { resource: true });
  const html = thinArtifactView(IX, SD, "definitions", { label: "X IG", home: "../index.html", all: "../artifacts.html", resource: "../StructureDefinition-Composition-uv-ips.json", tabs, index: "index.jsonld" });
  it("namesCanonicalAndAlternate", () => {
    expect(html).toContain('<link rel="canonical" href="StructureDefinition-Composition-uv-ips-definitions.html">');
    expect(html).toContain('<link rel="alternate" type="application/ld+json" href="StructureDefinition-Composition-uv-ips.jsonld">');
  });
  it("configNamesViewNoOrder", () => {
    const cfg = artifactPageConfigOf(html)!;
    expect(cfg).toMatchObject({ view: "definitions", node: "StructureDefinition-Composition-uv-ips.jsonld", resource: "../StructureDefinition-Composition-uv-ips.json", astLoader: "../assets/ast-resource.js" });
    expect(cfg.prev).toBeUndefined();
    expect(cfg.next).toBeUndefined();
  });
  it("tabBarMarksCurrent", () => {
    for (const t of tabs) expect(html).toContain(`href="${t.href}"`);
    expect(html).toContain('<a href="StructureDefinition-Composition-uv-ips.html?view=definitions" data-view="definitions" aria-current="page">');
  });
  it("viewIsThin", () => {
    expect(html).toContain('<script src="../assets/ig-artifact.js"></script>');
    expect(html).toContain('<meta name="folio-navbar" content="linked">');
    expect(html).not.toContain("A fixture profile.");
    expect(html.length).toBeLessThan(4000);
  });
});

describe("one page per artefact: the views by ?view=, the old names redirect", () => {
  const tabs = artifactTabs(VS, { resource: true, sidecars: ["jsonld", "schema"] });
  const html = thinArtifactView(IX, VS, "content", { label: "X IG", home: "../index.html", all: "../artifacts.html", resource: "../ValueSet-sections.json", tabs, sidecars: { jsonld: "../fhir-artifact-index/sidecars/ValueSet-sections.jsonld", schema: "../fhir-artifact-index/sidecars/ValueSet-sections.schema.json" } });
  it("pageListsViewsAndSidecars", () => {
    expect(artifactPageConfigOf(html)).toMatchObject({
      views: ["content", "json", "jsonld", "schema"],
      sidecars: { jsonld: "../fhir-artifact-index/sidecars/ValueSet-sections.jsonld", schema: "../fhir-artifact-index/sidecars/ValueSet-sections.schema.json" },
    });
    expect(html).toContain('href="ValueSet-sections.html?view=jsonld" data-view="jsonld"');
  });
  it("redirectStubKeepsFragment", () => {
    const stub = thinViewRedirect(SD, "definitions");
    expect(stub).toContain('<meta http-equiv="refresh" content="0; url=StructureDefinition-Composition-uv-ips.html?view=definitions">');
    expect(stub).toContain('location.replace("StructureDefinition-Composition-uv-ips.html?view=definitions" + location.hash)');
    expect(stub).toContain('<meta name="robots" content="noindex">');
    expect(stub).not.toContain("<script src=");
    // Bare for the platform's injectors: no <body> tag, the rail declined.
    expect(stub).not.toMatch(/<body/i);
    expect(stub).toContain('<meta name="folio-navbar" content="none">');
  });
  it("historyTabWhenVersionsServed", () => {
    const t = artifactTabs(VS, { resource: true, history: true });
    expect(t.map((x) => x.view)).toEqual(["content", "json", "history"]);
    expect(t[2]!.href).toBe("ValueSet-sections.html?view=history");
    expect(artifactTabs(VS, { resource: false, sidecars: ["jsonld"], history: true }).map((x) => x.view)).toEqual(["content", "jsonld"]);
    const page = thinArtifactView(IX, VS, "content", { label: "X IG", home: "../index.html", all: "../artifacts.html", resource: "../ValueSet-sections.json", tabs: t, history: { versions: "../fhir-artifact-index/ast-history.json", repository: "o/r" } });
    expect(artifactPageConfigOf(page)!.history).toEqual({ versions: "../fhir-artifact-index/ast-history.json", repository: "o/r", resourceType: "ValueSet", id: "sections" });
  });
  it("historyDrawnAsText", () => {
    const renderer = readFileSync(join(import.meta.dir, "templates", "ig-pages", "ig-artifact.js"), "utf8");
    expect(renderer).toContain("function drawHistory(");
    expect(renderer).toContain('rawAt(h.repository, commit, "manifest.json")');
    // Values go in by textContent through el(); nothing from a version is set as HTML.
    const body = renderer.slice(renderer.indexOf("function drawHistory("), renderer.indexOf("function drawView("));
    expect(body).not.toContain("innerHTML");
  });
  it("rendererReadsViewQuery", () => {
    const renderer = readFileSync(join(import.meta.dir, "templates", "ig-pages", "ig-artifact.js"), "utf8");
    expect(renderer).toContain('new URLSearchParams(location.search).get("view")');
    expect(renderer).toContain("cfg.views.indexOf(asked) >= 0");
    expect(renderer).toContain("function drawSidecar(");
  });
});

describe("gen-ig-pages --ig-site --publisher-data: a thin page per view, beside the artefact's", () => {
  const files = readdirSync(join(docs, "artifact")).filter((f) => f.endsWith(".html")).sort();

  it("writesEachPublisherView", () => {
    expect(files).toEqual([
      "Composition-example.html",
      "Composition-example.json.html",
      "StructureDefinition-Composition-uv-ips-definitions.html",
      "StructureDefinition-Composition-uv-ips-examples.html",
      "StructureDefinition-Composition-uv-ips-mappings.html",
      "StructureDefinition-Composition-uv-ips.html",
      "StructureDefinition-Composition-uv-ips.profile.json.html",
      "StructureDefinition-Lonely-definitions.html",
      "StructureDefinition-Lonely-examples.html",
      "StructureDefinition-Lonely-mappings.html",
      "StructureDefinition-Lonely.html",
      "StructureDefinition-Lonely.profile.json.html",
      "ValueSet-sections.html",
      "ValueSet-sections.json.html",
    ]);
    // One page per artefact draws every view; each view's old file name is a redirect stub to it.
    const shells = files.filter((f) => artifactPageConfigOf(page(f)) !== undefined);
    expect(shells).toEqual(["Composition-example.html", "StructureDefinition-Composition-uv-ips.html", "StructureDefinition-Lonely.html", "ValueSet-sections.html"]);
    for (const f of shells) expect(artifactPageConfigOf(page(f))!.view).toBeUndefined();
    const stub = page("StructureDefinition-Composition-uv-ips.profile.json.html");
    expect(stub).toContain('<meta http-equiv="refresh" content="0; url=StructureDefinition-Composition-uv-ips.html?view=json">');
    expect(stub).toContain('location.replace("StructureDefinition-Composition-uv-ips.html?view=json" + location.hash)');
    expect(stub.length).toBeLessThan(700);
  });

  it("everyPageThinNoChrome", () => {
    for (const f of files) {
      const html = page(f);
      expect(html.startsWith("<!doctype html>")).toBe(true);
      expect(html.length).toBeLessThan(4000);
      for (const re of PUBLISHER_CHROME) expect(re.test(html)).toBe(false);
    }
    expect(publisherChromePages(docs)).toEqual([]);
  });

  it("ownPageLinksTabs", () => {
    const html = page("StructureDefinition-Composition-uv-ips.html");
    for (const v of ["definitions", "mappings", "json", "examples"]) expect(html).toContain(`href="StructureDefinition-Composition-uv-ips.html?view=${v}"`);
    expect(artifactPageConfigOf(html)!.views).toEqual(["content", "definitions", "mappings", "json", "examples"]);
    expect(page("ValueSet-sections.html")).toContain('href="ValueSet-sections.html?view=json"');
  });

  it("everyLinkResolves", () => {
    const dead: string[] = [];
    for (const f of files) {
      const html = page(f);
      const cfg = artifactPageConfigOf(html) ?? {};
      const targets = [...html.matchAll(/(?:href|src|url)="?=?([^"> ]+)"/g)].map((m) => m[1]!).filter((h) => !/^(data:|https?:|#)/.test(h));
      for (const k of ["node", "resource", "index", "pages", "astLoader", "footer", "toc", "home", "prev", "next", "definitions"]) if (typeof cfg[k] === "string") targets.push(cfg[k] as string);
      for (const t of targets) {
        const at = posix.normalize(`artifact/${t.split(/[?#]/)[0]}`);
        if (!existsSync(join(docs, at))) dead.push(`${f} → ${t}`);
      }
    }
    expect(dead).toEqual([]);
  });

  it("viewsDrawFromJson", () => {
    const cfg = artifactPageConfigOf(page("StructureDefinition-Composition-uv-ips.html"))!;
    // A mapping row links its element on the definitions view; the examples view reads the index.
    expect(cfg).toMatchObject({ resource: "../StructureDefinition-Composition-uv-ips.json", definitions: "StructureDefinition-Composition-uv-ips.html?view=definitions", index: "index.jsonld" });
  });

  it("loaderListsEveryView", () => {
    const listed = JSON.parse(readFileSync(join(docs, "assets", "ast-pages.json"), "utf8")) as string[];
    expect(listed).toEqual(expect.arrayContaining(files));
    expect(existsSync(join(docs, "assets", "ast-resource.js"))).toBe(true);
  });
});

describe("the narrative's links to the Publisher's tab file names land on the thin views", () => {
  const a = artifactsFor(inst, "artifact/")!;

  it("artifactsForNamesViews", () => {
    expect(a.pages).toEqual([
      "Composition-example.json",
      "StructureDefinition-Composition-uv-ips-definitions",
      "StructureDefinition-Composition-uv-ips-examples",
      "StructureDefinition-Composition-uv-ips-mappings",
      "StructureDefinition-Composition-uv-ips.profile.json",
      "StructureDefinition-Lonely-definitions",
      "StructureDefinition-Lonely-examples",
      "StructureDefinition-Lonely-mappings",
      "StructureDefinition-Lonely.profile.json",
      "ValueSet-sections.json",
    ]);
  });

  it("relinksTabFileNames", () => {
    const names = new Set(["StructureDefinition-Composition-uv-ips", ...a.pages!]);
    const r = relinkArtifacts(
      '[d](StructureDefinition-Composition-uv-ips-definitions.html#Composition.section) <a href="StructureDefinition-Composition-uv-ips.profile.json.html">j</a> [m](StructureDefinition-Composition-uv-ips-mappings.html)',
      names,
      "artifact/",
    );
    expect(r.count).toBe(3);
    expect(r.text).toBe(
      '[d](artifact/StructureDefinition-Composition-uv-ips-definitions.html#Composition.section) <a href="artifact/StructureDefinition-Composition-uv-ips.profile.json.html">j</a> [m](artifact/StructureDefinition-Composition-uv-ips-mappings.html)',
    );
  });

  it("stageRelinksTabLinks", () => {
    const d = mkdtempSync(join(tmpdir(), "fhir-harness-tabs-site-"));
    try {
      const src = join(d, "src");
      mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
      writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: X IG\npages:\n  index.md:\n    title: Home\n");
      writeFileSync(
        join(src, "input", "pagecontent", "index.md"),
        "# Home\n\nSee [the definitions](StructureDefinition-Composition-uv-ips-definitions.html), [the JSON](ValueSet-sections.json.html) and [the page](ValueSet-sections.html).\n",
      );
      const out = join(d, "site");
      stageIgSite(src, out, { menu: { groups: [] }, baseurl: BASE, artifacts: a });
      const md = readFileSync(join(out, "index.md"), "utf8");
      expect(md).toContain("(artifact/StructureDefinition-Composition-uv-ips-definitions.html)");
      expect(md).toContain("(artifact/ValueSet-sections.json.html)");
      expect(md).toContain("(artifact/ValueSet-sections.html)");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("stateFromOutput: what each artefact's own JSON states, copied into the index", () => {
  it("copiesStatedProfileAndCode", () => {
    const d = mkdtempSync(join(tmpdir(), "fhir-harness-stated-"));
    try {
      const file = join(d, "index.json");
      writeFileSync(file, JSON.stringify({ artifacts: [{ resourceType: "Composition", id: "example" }, { resourceType: "ValueSet", id: "none" }, { resourceType: "Basic", id: "missing" }] }));
      writeFileSync(join(d, "Composition-example.json"), JSON.stringify({ resourceType: "Composition", meta: { profile: [PROFILE] }, code: { coding: [{ system: "http://loinc.org", code: "60591-5" }] } }));
      writeFileSync(join(d, "ValueSet-none.json"), JSON.stringify({ resourceType: "ValueSet" }));
      expect(stateFromOutput(file, d)).toBe(1);
      const ix = JSON.parse(readFileSync(file, "utf8")) as { artifacts: Record<string, unknown>[] };
      expect(ix.artifacts[0]).toMatchObject({ profiles: [PROFILE], code: { coding: [{ system: "http://loinc.org", code: "60591-5" }] } });
      expect(ix.artifacts[1]!.profiles).toBeUndefined();
      expect(ix.artifacts[2]!.profiles).toBeUndefined();
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("the shared renderer and the AST loader draw the views", () => {
  const renderer = readFileSync(join(import.meta.dir, "templates", "ig-pages", "ig-artifact.js"), "utf8");
  const ast = readFileSync(join(import.meta.dir, "templates", "ig-pages", "ast-resource.js"), "utf8");
  it("scriptsParse", () => {
    expect(() => new Function(renderer)).not.toThrow();
    expect(() => new Function(ast)).not.toThrow();
  });
  it("oneRendererBranches", () => {
    expect(renderer).toContain("if (cfg.view)");
    for (const fn of ["drawDefinitions", "drawMappings", "drawExamples"]) expect(renderer).toContain(`function ${fn}(`);
    // The definitions come from the snapshot, the differential where there is none.
    expect(renderer).toMatch(/snap && snap\.length \? snap : diff/);
  });
  it("noExamplesSaysSo", () => {
    expect(renderer).toContain("No examples: no artefact of this IG claims this profile");
  });
  it("jsonViewIsAstLoader", () => {
    expect(renderer).toContain('astHolder(src, "json")');
    expect(ast).toContain('getAttribute("data-ast-view") === "json"');
  });
  it("descriptionDrawsMarkdownSubset", () => {
    // Run description() with a tiny DOM stand-in: each node is {tag, cls, kids}.
    type N = { tag: string; cls?: string; kids: (N | string)[]; start?: number; href?: string; tagName?: string };
    const mk = (tag: string, cls?: string, text?: string): N => ({ tag, tagName: tag.toUpperCase(), cls, kids: text === undefined ? [] : [text], append(...k: (N | string)[]) { this.kids.push(...k.filter((x) => x !== "")); } }) as N;
    const src = renderer.slice(renderer.indexOf("function breaks("), renderer.indexOf("function stats("));
    const draw = new Function("el", "link", "indexView", "document", src + "; return description;")(
      mk,
      (href: string, text: string) => Object.assign(mk("a", undefined, text), { href }),
      false,
      { createDocumentFragment: () => mk("#frag") },
    ) as (t: string) => N;
    const show = (n: N | string): string => (typeof n === "string" ? n : `<${n.tag}>${n.kids.map(show).join("")}</${n.tag}>`);
    const out = (t: string) => draw(t).kids.map(show).join("");
    expect(out("**Persona**: a *shared* `phone`.")).toBe("<p><strong>Persona</strong>: a <em>shared</em> <code>phone</code>.</p>");
    expect(out("**In**:\n\n- [A](a.html): one\n- two\n  wrapped")).toBe('<p><strong>In</strong>:</p><ul><li><a>A</a>: one</li><li>two\nwrapped</li></ul>');
    expect(out("Lead:\n1. first\n2. second")).toBe("<p>Lead:</p><ol><li>first</li><li>second</li></ol>");
    expect(out("in\n2023. Then")).toBe("<p>in\n2023. Then</p>");
    expect(out("a * b * c and 2*3")).toBe("<p>a * b * c and 2*3</p>");
    expect(out("- ![Bo](data:image/svg+xml;base64,AA==) [Bo](p.html), father")).toBe("<ul><li><img></img> <a>Bo</a>, father</li></ul>");
    expect(out("![x](javascript:void)")).toBe("<p>x</p>");
    expect(out("![x](https://example.org/x.png)")).toBe("<p>x</p>");
    // Text only: the renderer never sets markdown as HTML.
    const body = renderer.slice(renderer.indexOf("function inline("), renderer.indexOf("function stats("));
    expect(body).not.toContain("innerHTML");
  });
  it("neitherReadsPublisherHtml", () => {
    expect(renderer).not.toMatch(/fetch\([^)]*\.html/);
    expect(ast).not.toMatch(/fetch\([^)]*\.html/);
  });
});
