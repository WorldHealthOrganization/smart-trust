/**
 * One IG → one just-the-docs Jekyll source with `site.data.fhir` (bean
 * `bamf`). Driven by a synthetic IG, so it names no real one.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { igChromeIncludes, liquidInertScript } from "./build-ig-site";
import { Liquid } from "liquidjs";
import { EDIT_LINKS_RUNTIME } from "../../cat-harness-tools/src/core/edit-links.js";
import { ARTIFACT_LIST_TEMPLATE_PATH, artifactListInclude, publisherPlural, FOOTER_TEMPLATE_PATH, ARTIFACTS_TEMPLATE_PATH,IG_FIGURE_IMAGES_STAMP, annexMount, ANNEX_SCRIPT_PATH, artifactVariables, artifactCellLookup, kramdownId, linkTableCells, colourScheme, composeIgSite, liquidSiteBase, contrast, dedupeIds, igTocNav, igTopBar, IG_TOPBAR_CSS, includeTargets, isSafeIncludeName, localTemplateIncludes, pageNav, relinkArtifacts, relinkTemplatedArtifacts, relinkOffSite, offSiteHref, rubyLiquidStrings, relinkPublisherOutputs, relinkPublisherTemplateAssets, sourceHeadings, dataOverwritesQa, describeStage, RELEASES_TEMPLATE_PATH, releaseVariables, sizeLabel, stageIgSite, tocPage, type StageResult } from "./build-ig-site";
import { annexDirsFor, annexesFor, annexesIn, copyDocsInto, igSiteDocs, webpagePalette } from "./stage-ig-sites";
import type { IgReleases } from "../schemas/ig-releases.ts";
import { artifactPageName } from "../schemas/fhir-artifact-index.js";
import { siteFileFor } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";

let dir: string;
let out: string;
let r: StageResult;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "ig-site-"));
  const src = join(dir, "src");
  for (const d of ["input/pagecontent", "input/includes", "input/images", "input/images-source"]) mkdirSync(join(src, d), { recursive: true });
  writeFileSync(
    join(src, "sushi-config.yaml"),
    [
      "id: example.ig",
      "canonical: http://example.org/ig",
      "name: ExampleIG",
      "title: Example IG",
      "status: draft",
      "version: 0.1.0",
      "fhirVersion: 4.0.1",
      "publisher:",
      "  name: Example Org",
      "pages:",
      "  index.md:",
      "    title: Home",
      "    overview.md:",
      "      title: Overview",
      "  changes.md:",
      "    title: Change Log",
      "",
    ].join("\n"),
  );
  const pc = join(src, "input", "pagecontent");
  writeFileSync(join(pc, "index.md"), "Package {{ site.data.fhir.packageId }}.\n{% include overview.md %}\n");
  writeFileSync(join(pc, "overview.md"), "{% include flow.svg %}\n{% include notes.md %}\n");
  writeFileSync(join(pc, "changes.md"), "Nothing yet.\n");
  writeFileSync(join(pc, "orphan.md"), "Not in sushi-config.\n");
  writeFileSync(join(src, "input", "includes", "notes.md"), "a note\n");
  writeFileSync(join(src, "input", "images", "logo.png"), "png");
  writeFileSync(join(src, "input", "images", "good.jsonld"), '{"@id": "x"}');
  writeFileSync(join(src, "input", "images", "broken.jsonld"), '{"a: 1}');
  mkdirSync(join(src, "input", "images", "demo", "lib"), { recursive: true });
  writeFileSync(join(src, "input", "images", "demo", "app.js"), "export {};");
  writeFileSync(join(src, "input", "images", "demo", "lib", "data.json"), '{"ok": true}');
  writeFileSync(join(src, "input", "images", "demo", "broken.json"), '{"a: 1}');
  writeFileSync(join(src, "input", "images", "demo", "icon.svg"), "<svg/>");
  writeFileSync(join(src, "input", "images-source", "flow.plantuml"), "@startuml\nA -> B\n@enduml\n");
  out = join(dir, "site");
  r = stageIgSite(src, out, { baseurl: "/site/example" });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("staging one IG as one just-the-docs site", () => {
  test("fhirDataFromSushiConfig", () => {
    const fhir = JSON.parse(readFileSync(join(out, "_data", "fhir.json"), "utf-8"));
    expect(fhir.packageId).toBe("example.ig");
    expect(fhir.ig.version).toBe("0.1.0");
    expect(fhir.ig.publisher).toBe("Example Org");
    expect(JSON.stringify(fhir)).not.toContain('""');
  });

  test("navFromSushiPages", () => {
    const nav = pageNav({ "index.md": { title: "Home", "overview.md": { title: "Overview" } }, "changes.md": { title: "Change Log" } });
    expect(nav.get("index")).toEqual({ title: "Home", navOrder: 1 });
    expect(nav.get("overview")).toEqual({ title: "Overview", parent: "Home", navOrder: 2 });
    expect(nav.get("changes")).toEqual({ title: "Change Log", navOrder: 3 });
    expect(readFileSync(join(out, "overview.md"), "utf-8")).toStartWith('---\ntitle: "Overview"\nparent: "Home"\nnav_order: 2\nig_footer: true\n');
  });

  test("unlistedPageKeptAndReported", () => {
    expect(r.unlisted).toEqual(["orphan.md"]);
    expect(readFileSync(join(out, "orphan.md"), "utf-8")).toContain('title: "orphan"');
  });

  test("pagesIncludesImagesPlaced", () => {
    expect(r.pages).toEqual(["changes.md", "index.md", "orphan.md", "overview.md"]);
    for (const f of ["notes.md", "overview.md", "index.md"]) expect(readFileSync(join(out, "_includes", f), "utf-8").length).toBeGreaterThan(0);
    expect(readFileSync(join(out, "logo.png"), "utf-8")).toBe("png");
  });

  test("imageSubdirKept", () => {
    expect(readFileSync(join(out, "demo", "app.js"), "utf-8")).toBe("export {};");
    expect(readFileSync(join(out, "demo", "lib", "data.json"), "utf-8")).toBe('{"ok": true}');
    expect(existsSync(join(out, "demo", "icon.svg"))).toBe(true);
    // `{% include %}` names a file at the top level only.
    expect(existsSync(join(out, "_includes", "icon.svg"))).toBe(false);
  });

  test("unparseableDataNotPublished", () => {
    expect(existsSync(join(out, "good.jsonld"))).toBe(true);
    expect(existsSync(join(out, "broken.jsonld"))).toBe(false);
    expect(existsSync(join(out, "demo", "broken.json"))).toBe(false);
    expect(r.unparseable).toHaveLength(2);
    expect(r.unparseable[0]).toStartWith("broken.jsonld (");
    expect(r.unparseable[1]).toStartWith("demo/broken.json (");
  });

  test("unrenderedDiagramIsMarker", () => {
    expect(r.notRendered).toEqual(["flow.svg"]);
    expect(r.rendered).toEqual([]);
    expect(readFileSync(join(out, "_includes", "flow.svg"), "utf-8")).toContain("⟦not rendered: flow.svg⟧");
  });

  test("configIsJustTheDocsAtBaseurl", () => {
    const cfg = readFileSync(join(out, "_config.yml"), "utf-8");
    expect(cfg).toContain('title: "Example IG"');
    expect(cfg).toContain('baseurl: "/site/example"');
    expect(cfg).toContain("theme: just-the-docs");
  });

  test("includeTargetsWithLangFragment", () => {
    expect(includeTargets("{% include a.svg %} x {%- include b.md -%} y {% lang-fragment table.xhtml %}")).toEqual(["a.svg", "b.md", "table.xhtml"]);
  });

  test("dedupeIdsRenamesRepeats", () => {
    const r = dedupeIds(`<h3 id="x">a</h3><h3 id="x">b</h3><a id='x'></a><p id="y"></p>`);
    expect(r.html).toBe(`<h3 id="x">a</h3><h3 id="x--2">b</h3><a id='x--3'></a><p id="y"></p>`);
    expect(r.renamed).toEqual(["x -> x--2", "x -> x--3"]);
  });

  test("noPaletteNoScheme", () => {
    expect(r.scheme).toBeUndefined();
    expect(readFileSync(join(out, "_config.yml"), "utf-8")).not.toContain("color_scheme");
  });
});

// A synthetic palette: a dark accent, so the sidebar must take the light role.
const PALETTE = { surface: "#f7f7f7", ink: "#111111", edge: "#dddddd", accent: "#123456" };

describe("the instance's palette as a just-the-docs colour scheme", () => {
  test("wcagContrastPerSpec", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#fff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrast("navy", "#ffffff")).toBeUndefined();
  });

  test("rolesLandOnSchemeVars", () => {
    const s = colourScheme(PALETTE).scss;
    expect(s).toContain("$feedback-color: darken($sidebar-color, 3%);");
    expect(s).toContain("$body-background-color: #f7f7f7;");
    expect(s).toContain("$body-text-color: #111111;");
    expect(s).toContain("$link-color: #123456;");
    expect(s).toContain("$border-color: #dddddd;");
    expect(s).toContain("$sidebar-color: #123456;");
  });

  test("sidebarTextMoreContrastRole", () => {
    const dark = colourScheme(PALETTE);
    expect(dark.sidebarText).toBe("surface");
    expect(dark.scss).toContain("$nav-child-link-color: #f7f7f7;");
    const light = colourScheme({ ...PALETTE, accent: "#eeeeaa" });
    expect(light.sidebarText).toBe("ink");
  });

  test("lowContrastIsFinding", () => {
    expect(colourScheme(PALETTE).findings).toEqual([]);
    const low = colourScheme({ ...PALETTE, accent: "#999999" }).findings;
    expect(low.some((f) => f.startsWith("accent on surface (links)"))).toBe(true);
    const named = colourScheme({ ...PALETTE, accent: "navy" }).findings;
    expect(named.some((f) => f.includes("not computable"))).toBe(true);
  });

  test("paletteSelectsScheme", () => {
    const o = join(dir, "themed");
    const t = stageIgSite(join(dir, "src"), o, { palette: PALETTE });
    expect(t.scheme?.sidebarText).toBe("surface");
    expect(readFileSync(join(o, "_config.yml"), "utf-8")).toContain("color_scheme: ig");
    expect(readFileSync(join(o, "_sass", "color_schemes", "ig.scss"), "utf-8")).toContain("$sidebar-color: #123456;");
    expect(readFileSync(join(o, "_sass", "custom", "custom.scss"), "utf-8")).toContain("$nav-child-link-color");
  });
});

describe("pages the Publisher generates, written from data the build holds (bean jut3)", () => {
  test("tocNestsAndLinksExisting", () => {
    const t = tocPage({ "index.md": { title: "Home", "overview.md": { title: "Overview" } }, "artifacts.html": { title: "Artifacts" } }, (s) => s !== "artifacts");
    expect(t).toContain("- [Home](index.html)\n  - [Overview](overview.html)");
    // Not held and not generated: text, never a link to a page that is not there.
    expect(t).toContain("- Artifacts (generated by the IG Publisher; not part of this build)");
    expect(t).not.toContain("](artifacts.html)");
  });

  test("tocAlwaysGenerated", () => {
    expect(r.generated).toContain("toc.md");
    expect(r.pages).not.toContain("toc.md");
    expect(readFileSync(join(out, "toc.md"), "utf-8")).toContain("[Change Log](changes.html)");
  });

  test("artifactVariablesKeepFamilies", () => {
    const list = [
      { resourceType: "ValueSet", id: "a-b", title: "A [b]", category: "Terminology", canonical: "http://x/ValueSet/a-b", version: "1.0", published: { json: { url: "https://p/ValueSet-a-b.json" }, xml: { url: "https://p/ValueSet-a-b.xml" } } },
      { resourceType: "Endpoint", id: "e", category: undefined },
    ];
    const { vars, notSourced } = artifactVariables(list, "../artifact/");
    // smart__ValueSet__a_b__url__page  ->  site.data.fhir.artifacts.ValueSet__a_b.url.page
    const v = vars.artifacts["ValueSet__a_b"]!;
    expect(v.url.page).toBe(`../artifact/${artifactPageName(list[0]!)}.html`);
    expect(v.url.canonical).toBe("http://x/ValueSet/a-b");
    expect(v.url.json).toBe("https://p/ValueSet-a-b.json");
    expect(v.text.display).toBe("A [b]");
    expect(v.text.label).toBe("A \\[b\\]");
    expect(vars.artifacts_listed).toBe(1);
    expect(v.link.html).toBe('<a href="../artifact/ValueSet-a-b.html">A [b]</a>');
    expect(v.elements).toEqual({ title: "A [b]", version: "1.0" });
    // Uncategorised = not on the Publisher's artifacts.html: variables written, not grouped.
    expect(vars.artifact_categories).toEqual([{ name: "Terminology", anchor: "artifacts-terminology", count: 1, keys: ["ValueSet__a_b"] }]);
    // No description is an empty cell, never "undefined".
    expect(v.text.description_cell).toBe("");
    expect(vars.artifacts["Endpoint__e"]).toBeDefined();
    // What no source holds is REPORTED, never written empty.
    expect(notSourced).toContain("status");
    expect(Object.values(vars.artifacts).every((a) => !("status" in a.elements))).toBe(true);
  });

  const ruby = spawnSync("ruby", ["-e", 'require "liquid"'], { encoding: "utf-8" }).status === 0;
  test.skipIf(!ruby)("artifactsTemplateRendersLiquid", () => {
    const { vars } = artifactVariables([{ resourceType: "ValueSet", id: "v", title: "V [x]", category: "Terminology: Value Sets", description: "Codes for a | b,\nover two lines." }], "../artifact/");
    const script = 'require "liquid"; require "json"; d = JSON.parse(STDIN.read.force_encoding("UTF-8")); print Liquid::Template.parse(d["t"], error_mode: :strict).render("site" => { "data" => { "fhir" => d["v"] } })';
    const r = spawnSync("ruby", ["-e", script], { input: JSON.stringify({ t: readFileSync(ARTIFACTS_TEMPLATE_PATH, "utf-8"), v: vars }), encoding: "utf-8" });
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain("1 artefact(s).");
    // #1901: one COLLAPSED section per category, a Name | Description table inside,
    // `markdown="1"` so kramdown renders the table rather than printing pipes.
    expect(r.stdout).toContain('<details markdown="1" id="artifacts-terminology-value-sets">');
    expect(r.stdout).toContain("<summary><strong>Terminology: Value Sets</strong> — 1</summary>");
    expect(r.stdout).not.toContain("<details open");
    expect(r.stdout).toContain("| Name | Description |");
    expect(r.stdout).toContain("| [V \\[x\\]](../artifact/ValueSet-v.html) | Codes for a \\| b, over two lines. |");
  });

  test("artifactsTemplateOpensWithComment", () => {
    // `liquid-templates`: never an inline template in a .ts, and the leading
    // comment is the file's description; computation stays in the generator.
    const t = readFileSync(ARTIFACTS_TEMPLATE_PATH, "utf-8");
    expect(t.startsWith("{%- comment -%}")).toBe(true);
    expect(t).not.toMatch(/\|\s*(plus|minus|size|replace)\b/);
  });

  test("noIndexNoArtifactsPage", () => {
    expect(existsSync(join(out, "artifacts.md"))).toBe(false);
    expect(r.generated).not.toContain("artifacts.md");
  });
});

describe("post-processing fills: content a step writes after the Publisher, at a marker the source holds", () => {
  test("fillReplacesMarker", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-fill-"));
    try {
      const src = join(d, "src");
      mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
      writeFileSync(join(src, "sushi-config.yaml"), "id: x\ncanonical: http://x\nname: X\nversion: 0.1.0\nfhirVersion: 4.0.1\npages:\n  hub.md:\n    title: Hub\n");
      writeFileSync(join(src, "input", "pagecontent", "hub.md"), "# Hub\n\nIntro.\n\n<!-- MARK -->\n");
      const res = stageIgSite(src, join(d, "site"), {
        fills: [
          { marker: "<!-- MARK -->", body: "filled {{ page.k.v }}", data: { k: { v: "y" } } },
          { marker: "<!-- NOWHERE -->", body: "z", data: {} },
        ],
      });
      const page = readFileSync(join(d, "site", "hub.md"), "utf-8");
      expect(page.split("\n---\n")[0]).toContain('\nk: {"v":"y"}\n');
      expect(page).toContain("Intro.\n\nfilled {{ page.k.v }}");
      expect(page).not.toContain("<!-- MARK -->");
      expect(res.fills).toEqual({ filled: ["hub.md (<!-- MARK -->)"], unused: ["<!-- NOWHERE -->"] });
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("the releases page: pointers to release binaries, never the bytes (bean b8ip)", () => {
  const releases: IgReleases = {
    $schema: "ig-releases/v1",
    repository: "o/r",
    readAt: "2026-10-02",
    releases: [
      {
        tag: "v1.0.0",
        url: "https://github.com/o/r/releases/tag/v1.0.0",
        publishedAt: "2026-03-23T17:39:19Z",
        prerelease: false,
        assets: [
          { name: "package.tgz", url: "https://github.com/o/r/releases/download/v1.0.0/package.tgz", bytes: 915317, digest: `sha256:${"a".repeat(64)}` },
          { name: "package.db", url: "https://github.com/o/r/releases/download/v1.0.0/package.db", bytes: 13864960 },
        ],
      },
    ],
  };

  test("sizeLabels", () => {
    expect(sizeLabel(915317)).toBe("915 KB");
    expect(sizeLabel(13864960)).toBe("13.9 MB");
    expect(sizeLabel(10)).toBe("1 KB");
  });

  test("releaseVariablesComputed", () => {
    const v = releaseVariables(releases);
    expect(v.releases[0]).toMatchObject({ tag: "v1.0.0", name: "v1.0.0", published: "2026-03-23", prerelease: false });
    expect(v.releases[0].assets.map((a) => [a.name, a.size, a.digest])).toEqual([
      ["package.tgz", "915 KB", `sha256:${"a".repeat(64)}`],
      ["package.db", "13.9 MB", null],
    ]);
  });

  test("releasesPageOnlyWhenGiven", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-rel-"));
    try {
      const src = join(d, "src");
      mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
      writeFileSync(join(src, "sushi-config.yaml"), "id: x\ncanonical: http://x\nname: X\nversion: 0.1.0\nfhirVersion: 4.0.1\npages:\n  index.md:\n    title: Home\n");
      writeFileSync(join(src, "input", "pagecontent", "index.md"), "# Home\n");
      const res = stageIgSite(src, join(d, "with"), { releases });
      expect(res.generated).toContain("releases.md");
      expect(readFileSync(join(d, "with", "releases.md"), "utf-8")).toContain(readFileSync(RELEASES_TEMPLATE_PATH, "utf-8"));
      expect(JSON.parse(readFileSync(join(d, "with", "_data", "ig_releases.json"), "utf-8"))).toEqual(releaseVariables(releases));
      const none = stageIgSite(src, join(d, "without"), {});
      expect(none.generated).not.toContain("releases.md");
      expect(existsSync(join(d, "without", "_data", "ig_releases.json"))).toBe(false);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

// A local IG Publisher template (`ig.ini` `template = #<dir>`) holds includes a
// page uses: smart-trust's system-actors loop, 2026-10-09.
describe("the local template's includes", () => {
  const ig = (ini: string, withDir = true) => {
    const d = mkdtempSync(join(tmpdir(), "ig-tpl-"));
    writeFileSync(join(d, "ig.ini"), ini);
    if (withDir) mkdirSync(join(d, "local-template", "includes"), { recursive: true });
    return d;
  };

  test("localTemplateFromIgIni", () => {
    const cases: [string, boolean, string | undefined][] = [
      ["[IG]\ntemplate = #local-template\n#template = acme.template.root#current\n", true, "local-template/includes"],
      ["[IG]\n#template = #local-template\ntemplate = acme.template.root#current\n", true, undefined],
      ["[IG]\ntemplate = #../elsewhere\n", true, undefined],
      ["[IG]\ntemplate = #local-template\n", false, undefined],
    ];
    for (const [ini, withDir, want] of cases) {
      const d = ig(ini, withDir);
      try {
        expect(localTemplateIncludes(d)).toBe(want === undefined ? undefined : join(d, want));
      } finally {
        rmSync(d, { recursive: true, force: true });
      }
    }
  });

  test("relinkTemplatedArtifactLinks", () => {
    const src = '<a href="Requirements-{{r.id}}.html">x</a> [c](CapabilityStatement-{{c.id}}.html) <a href="Other-{{o.id}}.html">o</a> <a href="Requirements-R1.html">r</a>';
    const r = relinkTemplatedArtifacts(src, new Set(["Requirements", "CapabilityStatement"]), "artifact/");
    expect(r.count).toBe(2);
    expect(r.text).toBe('<a href="artifact/Requirements-{{r.id}}.html">x</a> [c](artifact/CapabilityStatement-{{c.id}}.html) <a href="Other-{{o.id}}.html">o</a> <a href="Requirements-R1.html">r</a>');
  });

  test("localIncludesStagedRelinked", () => {
    const d = ig("[IG]\ntemplate = #local-template\n");
    try {
      const src = d;
      mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
      mkdirSync(join(src, "input", "includes"), { recursive: true });
      writeFileSync(join(src, "sushi-config.yaml"), "id: x\ncanonical: http://x\nname: X\nversion: 0.1.0\nfhirVersion: 4.0.1\npages:\n  index.md:\n    title: Home\n");
      writeFileSync(join(src, "input", "pagecontent", "index.md"), "# Home\n\n{% include summary.liquid %}\n{% include both.liquid %}\n");
      writeFileSync(join(src, "local-template", "includes", "summary.liquid"), '<a href="Requirements-{{r.id}}.html">{{r.title}}</a>\n');
      writeFileSync(join(src, "local-template", "includes", "both.liquid"), "from the template\n");
      writeFileSync(join(src, "input", "includes", "both.liquid"), "from the IG\n");
      const out = join(d, "out");
      const res = stageIgSite(src, out, { artifacts: { list: [{ resourceType: "Requirements", id: "R1" }], pagesHref: "artifact/" } });
      expect(res.templateIncludes).toEqual({ dir: join("local-template", "includes"), files: 2 });
      expect(res.notRendered).not.toContain("summary.liquid");
      expect(readFileSync(join(out, "_includes", "summary.liquid"), "utf-8")).toContain('href="artifact/Requirements-{{r.id}}.html"');
      expect(readFileSync(join(out, "_includes", "both.liquid"), "utf-8")).toBe("from the IG\n");
      expect(describeStage(res)).toContain("local template includes (ig.ini): 2 from local-template/includes");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

// Bean `mftp`: the IG's prose links an artefact at the Publisher's flat path;
// this site keeps artefact pages under `pagesHref`.
describe("relinkArtifacts", () => {
  const names = new Set(["ValueSet-Domains", "CodeSystem-Actors"]);
  test("relinkArtifactsOnlyArtefactPages", () => {
    const src = "[d](ValueSet-Domains.html) [a](CodeSystem-Actors.html#x) <a href=\"ValueSet-Domains.html\">v</a> [c](concepts.html) [e](https://x.org/ValueSet-Domains.html) [s](sub/ValueSet-Domains.html)";
    const r = relinkArtifacts(src, names, "artifact/");
    expect(r.count).toBe(3);
    expect(r.text).toBe("[d](artifact/ValueSet-Domains.html) [a](artifact/CodeSystem-Actors.html#x) <a href=\"artifact/ValueSet-Domains.html\">v</a> [c](concepts.html) [e](https://x.org/ValueSet-Domains.html) [s](sub/ValueSet-Domains.html)");
  });
  test("relinkArtifactsNoOp", () => {
    expect(relinkArtifacts("[c](concepts.html)", names, "../artifact/")).toEqual({ text: "[c](concepts.html)", count: 0 });
  });
});

describe("copyDocsInto (an igSite instance's pages built into its IG site)", () => {
  test("copyDocsSkipsReadmeNoOverwrite", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-docs-"));
    const docs = join(d, "docs");
    const site = join(d, "site");
    mkdirSync(join(docs, "artifact"), { recursive: true });
    mkdirSync(site, { recursive: true });
    writeFileSync(join(docs, "README.md"), "repo docs");
    writeFileSync(join(docs, "artifact", "A.md"), "a");
    writeFileSync(join(docs, "artifacts.md"), "mine");
    writeFileSync(join(site, "artifacts.md"), "the IG site's");
    const c = copyDocsInto(docs, site);
    expect(c).toEqual({ copied: 1, merged: [], collisions: ["artifacts.md"] });
    expect(readFileSync(join(site, "artifact", "A.md"), "utf-8")).toBe("a");
    expect(readFileSync(join(site, "artifacts.md"), "utf-8")).toBe("the IG site's");
    expect(existsSync(join(site, "README.md"))).toBe(false);
    rmSync(d, { recursive: true, force: true });
  });
});

describe("copyDocsInto: a front-matter-only page declares something ABOUT a generated page", () => {
  test("frontMatterOnlyMergesOntoGenerated", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-docs-"));
    mkdirSync(join(d, "docs"), { recursive: true });
    mkdirSync(join(d, "site"), { recursive: true });
    writeFileSync(join(d, "docs", "artifacts.md"), "---\ntitle: mine\nrendered-by: ig-pages\n---\n");
    writeFileSync(join(d, "site", "artifacts.md"), "---\ntitle: Artifact Index\nparent: Indices\n---\nbody\n");
    writeFileSync(join(d, "docs", "orphan.md"), "---\nrendered-by: y\n---\n");
    const c = copyDocsInto(join(d, "docs"), join(d, "site"));
    expect(c.merged).toEqual(["artifacts.md"]);
    expect(c.collisions).toEqual(["orphan.md (front matter only, and no generated page to lay it on)"]);
    expect(readFileSync(join(d, "site", "artifacts.md"), "utf-8")).toBe("---\ntitle: Artifact Index\nparent: Indices\nrendered-by: ig-pages\n---\nbody\n");
    rmSync(d, { recursive: true, force: true });
  });
});

// Synthetic layers in a temp "repository", so this layer tests the
// mechanism without naming a layer above it: `plain` and `mid` are the
// layers that hold no IG site, which is all "a layer with no IG has no
// IG docs" asserts. The same two properties over REAL IGs are facts about
// those IGs, and are tested by the layers that hold them -- above this
// layer, so never here, and never named here.
//
// `leaf` → `mid` → `base`: two hops, the middle one declaring no theme, so
// the palette is found THROUGH a layer that has none.
const THEME_TS = join(import.meta.dir, "..", "..", "cat-harness-tools", "schemas", "ui", "theme.ts");
const BASE_THEME = `import { ResolvedThemeSchema } from ${JSON.stringify(THEME_TS)};
export const INSTANCE_THEMES = [ResolvedThemeSchema.parse({
  $schema: "folio-theme/v1", kind: "webpage", id: "base-web", name: "Base",
  palette: { surface: "#ffffff", ink: "#111111", edge: "#cccccc", accent: "#0066aa" },
  layouts: {
    laptop: { minWidth: "1000px", padding: "1rem", fontScale: 1 },
    mobile: { minWidth: "100%", padding: "1rem", fontScale: 1 },
    card: { minWidth: "200px", padding: "1rem", fontScale: 1 },
  },
})];
`;

let fixtureRoot: string;
beforeAll(() => {
  fixtureRoot = mkdtempSync(join(tmpdir(), "ig-instances-"));
  mkdirSync(join(fixtureRoot, ".git"));
  const instance = (name: string, decl: Record<string, unknown>): string => {
    const at = join(fixtureRoot, name);
    mkdirSync(at, { recursive: true });
    writeFileSync(join(at, `${name}.json`), JSON.stringify({ name, version: "0.1.0", directories: [], ...decl }, null, 2));
    return at;
  };
  const base = instance("base", {
    directories: [
      { id: "base-themes", path: "themes/", graphTypologies: ["themes"] },
      { id: "base-docs", path: "docs/", graphTypologies: ["docs"], igSite: true },
    ],
  });
  mkdirSync(join(base, "themes"), { recursive: true });
  writeFileSync(join(base, "themes", "themes.ts"), BASE_THEME);
  instance("mid", { needs: ["base"] });
  instance("leaf", { needs: ["mid"], directories: [{ id: "leaf-docs", path: "docs/", graphTypologies: ["docs"], igSite: true }] });
  instance("plain", { directories: [{ id: "plain-docs", path: "docs/", graphTypologies: ["docs"] }] });
});
afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }));

describe("igSiteDocs", () => {
  test("onlyDeclaredIgSiteBuilds", () => {
    expect(igSiteDocs(join(fixtureRoot, "leaf"))).toBe(join(fixtureRoot, "leaf", "docs/"));
    expect(igSiteDocs(join(fixtureRoot, "base"))).toBe(join(fixtureRoot, "base", "docs/"));
    // A docs directory that does not declare igSite is not one.
    expect(igSiteDocs(join(fixtureRoot, "plain"))).toBeUndefined();
    // Nor is a layer with no docs directory at all.
    expect(igSiteDocs(join(fixtureRoot, "mid"))).toBeUndefined();
  });
});

describe("webpagePalette inherits along needs (bean `mftp`)", () => {
  test("paletteInheritedAlongNeeds", () => {
    const t = webpagePalette(fixtureRoot, "leaf");
    expect(t.palette?.accent).toBe("#0066aa");
    expect(t.note).toContain("inherited from base");
    expect(webpagePalette(fixtureRoot, "base").note).not.toContain("inherited");
  });
  test("noThemeNoPalette", () => {
    const t = webpagePalette(fixtureRoot, "plain");
    expect(t.palette).toBeUndefined();
    expect(t.note).toContain("no webpage theme");
  });
});

// Bean `mftp`, owner 2026-10-05: the folio-assistant navbar, not just-the-docs'
// sidebar, and the IG's own top bar preserved.
describe("every IG site: the IG's top bar, and its TOC declared for the navbar", () => {
  const menu = { groups: [{ label: "Home", items: [{ label: "Summary", href: "overview.html" }] }, { label: "Indices", items: [{ label: "Artifact Index", href: "artifacts.html" }, { label: "Spec", href: "https://example.org/x" }] }] };
  test("tocNavDeclaration", () => {
    const decl = igTocNav(menu, "/b/acme-ig", [{ label: "Releases", href: "releases.html" }], [{ label: "Table of Contents", href: "toc.html" }]);
    expect(decl.startsWith('<script type="application/json" data-fa-visualiser-nav>')).toBe(true);
    const rows = JSON.parse(decl.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""));
    // The table of contents leads, where the Publisher's breadcrumb starts (owner, 2026-11-14).
    expect(rows).toEqual([
      { label: "Table of Contents", href: "/b/acme-ig/toc.html" },
      { label: "Home", items: [{ label: "Summary", href: "/b/acme-ig/overview.html" }] },
      { label: "Indices", items: [{ label: "Artifact Index", href: "/b/acme-ig/artifacts.html" }, { label: "Spec", href: "https://example.org/x" }] },
      { label: "Releases", href: "/b/acme-ig/releases.html" },
    ]);
  });
  test("topBarDropdownNotFolioNav", () => {
    const bar = igTopBar(menu, "/b/acme-ig", "ACME Example IG");
    expect(bar).toContain('<summary>Home</summary>');
    expect(bar).toContain('href="/b/acme-ig/overview.html"');
    expect(bar).not.toContain("fa-nav");
    expect(bar).not.toContain('id="site-nav"');
  });
  test("pageEntryIsLink", () => {
    const pageMenu = { groups: [{ label: "Home", href: "index.html", items: [] }, { label: "Logic", items: [{ label: "Testing", href: "testing.html" }] }, { label: "Artifacts", href: "artifacts.html", items: [] }] };
    const bar = igTopBar(pageMenu, "/b/acme-ig", "ACME Example IG");
    expect(bar).toContain('<a class="ig-topbar-group ig-topbar-link" href="/b/acme-ig/index.html">Home</a>');
    expect(bar).toContain('<a class="ig-topbar-group ig-topbar-link" href="/b/acme-ig/artifacts.html">Artifacts</a>');
    expect(bar).not.toContain('<span class="ig-topbar-group">');
    const rows = JSON.parse(igTocNav(pageMenu, "/b/acme-ig").replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""));
    expect(rows[0]).toEqual({ label: "Home", href: "/b/acme-ig/index.html" });
    expect(rows[2]).toEqual({ label: "Artifacts", href: "/b/acme-ig/artifacts.html" });
    const d = mkdtempSync(join(tmpdir(), "ig-menu-page-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: X IG\n");
    writeFileSync(join(src, "input", "pagecontent", "index.md"), "# Hi\n");
    writeFileSync(join(src, "input", "pagecontent", "testing.md"), "# T\n");
    stageIgSite(src, join(d, "out"), { menu: pageMenu, baseurl: "/b/x" });
    expect(existsSync(join(d, "out", "menu-home.md"))).toBe(false);
    expect(existsSync(join(d, "out", "menu-artifacts.md"))).toBe(false);
    expect(existsSync(join(d, "out", "menu-logic.md"))).toBe(true);
  });
  test("titleLineThenMenu", () => {
    const bar = igTopBar(menu, "/b/acme-ig", "ACME Example IG");
    // The title comes first in the bar, before every group.
    expect(bar.indexOf('class="ig-topbar-home"')).toBeLessThan(bar.indexOf('class="ig-topbar-group"'));
    // The bar wraps, and the title takes the whole first line of it.
    const rule = (sel: string) => new RegExp(`(?:^|\\n)\\${sel}\\{([^}]*)\\}`).exec(IG_TOPBAR_CSS)?.[1] ?? "";
    expect(rule(".ig-topbar")).toContain("flex-wrap:wrap");
    expect(rule(".ig-topbar-home")).toMatch(/flex:0 0 100%|flex-basis:100%/);
  });
  test("folioTabRowAtEveryWidth", () => {
    // Not inside a media query: the shared layout reserves the row only below
    // 50rem, and an IG bar's title and menu leave no empty middle above that.
    const reserve = /(?:^|\n)body:has\(> \.fa-glass-handle\) \.ig-topbar\.fa-page-bar\{([^}]*)\}/.exec(IG_TOPBAR_CSS)?.[1] ?? "";
    expect(reserve).toContain("padding-top:2.25rem");
    expect(IG_TOPBAR_CSS).not.toMatch(/@media[^{]*\{[^}]*\.fa-glass-handle\) \.ig-topbar/);
  });
  test("chromeLayoutNoSidebar", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-chrome-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: X IG\n");
    writeFileSync(join(src, "input", "pagecontent", "index.md"), "# Hi\n");
    stageIgSite(src, join(d, "out"), { menu, baseurl: "/b/x" });
    const layout = readFileSync(join(d, "out", "_layouts", "default.html"), "utf-8");
    expect(layout).toContain("data-fa-visualiser-nav");
    expect(layout).toContain('class="ig-topbar fa-page-bar"');
    expect(layout).not.toContain("site-nav");
    expect(layout).toContain('<meta name="fa-visualiser-label" content="X IG">');
    rmSync(d, { recursive: true, force: true });
  });
});

// #1901, owner 2026-10-02: "footer is missing" — the Publisher's footer, from
// the IG's own metadata, linking only what this site holds.
describe("the Publisher's page footer on the IG site's own pages (#1901)", () => {
  const sushi = [
    "id: x.ig",
    "title: X IG",
    "version: 0.2.0",
    "fhirVersion: 5.0.0",
    "copyrightYear: 2023+",
    "license: CC0-1.0",
    "publisher:",
    "  name: Example Org",
    "  url: https://example.org",
    "pages:",
    "  index.md:",
    "    title: Home",
    "  concepts.md:",
    "    title: Concepts",
    "  missing.md:",
    "    title: Not built",
    "  changes.md:",
    "    title: Changes",
    "",
  ].join("\n");
  const stage = (opts: Parameters<typeof stageIgSite>[2]) => {
    const d = mkdtempSync(join(tmpdir(), "ig-footer-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), sushi);
    for (const p of ["index", "concepts", "changes"]) writeFileSync(join(src, "input", "pagecontent", `${p}.md`), `# ${p}\n`);
    stageIgSite(src, join(d, "out"), opts);
    return { d, out: join(d, "out") };
  };
  const menu = { groups: [{ label: "Home", items: [{ label: "Concepts", href: "concepts.html" }] }] };

  test("footerFactsPackageFirst", () => {
    const { d, out } = stage({ menu, footer: { facts: { version: "0.2.1", generated: "2026-10-01", packageId: "x.ig" }, scope: "st-ig", stylesheets: ["assets/ig-pages.css"] } });
    const f = JSON.parse(readFileSync(join(out, "_data", "fhir.json"), "utf-8")).footer;
    expect(f).toMatchObject({
      publisher: "Example Org",
      publisherUrl: "https://example.org",
      packageId: "x.ig",
      version: "0.2.1", // the package's, over sushi-config's 0.2.0
      fhirVersion: "5.0.0",
      fhirUrl: "http://hl7.org/fhir/R5/",
      generated: "2026-10-01",
      copyrightYear: "2023+",
      scope: "st-ig",
      stylesheets: ["assets/ig-pages.css"],
    });
    // toc.html is always written; qa.html and history.html are not, so no link.
    expect(f.links).toEqual([
      { label: "Table of Contents", href: "toc.html" },
      { label: "License", href: "https://spdx.org/licenses/CC0-1.0.html", external: true },
    ]);
    rmSync(d, { recursive: true, force: true });
  });

  test("qaReportWrittenAsQaMd", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-footer-qa-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    mkdirSync(join(src, "output-ast"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), `${sushi}canonical: http://example.org/ig\n`);
    writeFileSync(join(src, "output-ast", "manifest.json"), JSON.stringify({ generatedAt: "2026-11-05T17:28:37Z" }));
    writeFileSync(join(src, "input", "pagecontent", "index.md"), "# index\n\nSee the [QA report](qa.html).\n");
    const r = stageIgSite(src, join(d, "out"), { menu, qaPage: "---\ntitle: QA Report\n---\nbody\n" });
    const out = join(d, "out");
    expect(r.qa).toBe("written");
    expect(r.generated).toContain("qa.md");
    expect(readFileSync(join(out, "qa.md"), "utf-8")).toStartWith("---\ntitle: QA Report\nig_footer: true\n");
    // The IG's own link to qa.html is this site's page now, not the published IG's.
    expect(readFileSync(join(out, "index.md"), "utf-8")).toContain("](qa.html)");
    expect(readFileSync(join(out, "index.md"), "utf-8")).not.toContain("example.org/ig/qa.html");
    const f = JSON.parse(readFileSync(join(out, "_data", "fhir.json"), "utf-8")).footer;
    expect(f.links.map((l: { label: string }) => l.label)).toEqual(["Table of Contents", "QA Report", "License"]);
    expect(f.generated).toBe("2026-11-05");
    expect(r.footer.links).toEqual(f.links);
    rmSync(d, { recursive: true, force: true });
  });

  test("qaReportWrittenInEachLocaleWithTheNotice", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-qa-locales-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), sushi);
    writeFileSync(join(src, "input", "pagecontent", "index.md"), "# index\n");
    const page = "---\ntitle: QA Report\nnav_exclude: true\n---\nbody\n";
    const r = stageIgSite(src, join(d, "out"), { menu, qaPage: page, qaPages: { en: page, fr: page.replace("QA Report", "Rapport"), ar: page } });
    const out = join(d, "out");
    expect(r.qa).toBe("written");
    expect(r.translated).toEqual(["ar/qa.md", "fr/qa.md"]);
    const fr = readFileSync(join(out, "fr", "qa.md"), "utf-8");
    expect(fr).toContain('lang: "fr"');
    expect(fr).toContain('translation_status: "unverified"');
    expect(fr).toContain("translation_reviewed: false");
    expect(fr).toContain('text_dir: "ltr"');
    expect(fr).toContain("title: Rapport");
    expect(readFileSync(join(out, "ar", "qa.md"), "utf-8")).toContain('text_dir: "rtl"');
    expect(readFileSync(join(out, "qa.md"), "utf-8")).toContain('available_locales: ["en","fr","ar"]');
    // Not Jekyll's own `page.dir` (the page's folder), which drew dir="/" on every page.
    for (const f of readdirSync(join(out, "_layouts"))) expect({ f, dir: /page\.dir\b/.test(readFileSync(join(out, "_layouts", f), "utf-8")) }).toEqual({ f, dir: false });
    rmSync(d, { recursive: true, force: true });
  });

  test("igOwnQaPageWins", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-footer-qa-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), sushi);
    writeFileSync(join(src, "input", "pagecontent", "qa.md"), "# mine\n");
    const r = stageIgSite(src, join(d, "out"), { menu, qaPage: "---\ntitle: QA Report\n---\nbody\n" });
    expect(r.qa).toBe("the IG's source holds its own qa page");
    expect(readFileSync(join(d, "out", "qa.md"), "utf-8")).toContain("# mine");
    rmSync(d, { recursive: true, force: true });
  });

  test("prevNextFollowTocOrder", () => {
    const { d, out } = stage({ menu });
    const fm = (p: string) => readFileSync(join(out, p), "utf-8").split("\n---")[0]!;
    expect(fm("index.md")).toContain("ig_footer: true");
    expect(fm("index.md")).not.toContain("ig_prev");
    expect(fm("index.md")).toContain('ig_next: "concepts.html"');
    expect(fm("concepts.md")).toContain('ig_prev: "index.html"');
    expect(fm("concepts.md")).toContain('ig_next: "changes.html"'); // missing.md is skipped
    expect(fm("changes.md")).not.toContain("ig_next");
    // A generated page carries the footer, outside the order.
    expect(fm("toc.md")).toContain("ig_footer: true");
    expect(fm("toc.md")).not.toContain("ig_prev");
    // The layout draws it last, only where the page asks.
    const layout = readFileSync(join(out, "_layouts", "default.html"), "utf-8");
    // After the column, a child of the body: the body's column puts it at the window's bottom on a short page.
    expect(layout).toContain("</main>\n{% if page.ig_footer %}{% include fa-ig-footer.html %}{% endif %}");
    expect(existsSync(join(out, "_includes", "fa-ig-footer.html"))).toBe(true);
    rmSync(d, { recursive: true, force: true });
  });

  test("noMenuFooterInPage", () => {
    const { d, out } = stage({});
    expect(readFileSync(join(out, "concepts.md"), "utf-8")).toMatch(/\{% include fa-ig-footer\.html %\}\n$/);
    rmSync(d, { recursive: true, force: true });
  });

  test("thinLayoutDrawsFooterAfterMain", () => {
    const { d, out } = stage({ menu });
    const host = join(d, "host");
    mkdirSync(host, { recursive: true });
    expect(composeIgSite(out, host, "x").collisions).toEqual([]);
    expect(readFileSync(join(host, "x", "concepts.md"), "utf-8")).not.toContain("fa-ig-footer.html");
    expect(readFileSync(join(host, "_layouts", "ig-thin-x.html"), "utf-8")).toContain("</main>\n{% if page.ig_footer %}{% include ig/x/fa-ig-footer.html %}{% endif %}\n</body>");
    rmSync(d, { recursive: true, force: true });
  });

  test("composedFooterNamespaced", () => {
    const { d, out } = stage({ menu });
    const host = join(d, "host");
    mkdirSync(host, { recursive: true });
    expect(composeIgSite(out, host, "x", { fullPages: true }).collisions).toEqual([]);
    expect(readFileSync(join(host, "x", "concepts.md"), "utf-8")).toContain("{% include ig/_bottom.html %}\n{% if page.ig_footer %}{% include ig/x/fa-ig-footer.html %}{% endif %}");
    expect(readFileSync(join(host, "_includes", "ig", "x", "fa-ig-footer.html"), "utf-8")).toContain('site.data.ig["x"].fhir.footer');
    rmSync(d, { recursive: true, force: true });
  });

  const ruby = spawnSync("ruby", ["-e", 'require "liquid"'], { encoding: "utf-8" }).status === 0;
  test.skipIf(!ruby)("footerTemplateRendersLiquid", () => {
    const footer = {
      publisher: "Example Org", publisherUrl: "https://example.org", packageId: "x.ig", version: "0.2.1",
      fhirVersion: "5.0.0", fhirUrl: "http://hl7.org/fhir/R5/", generated: "2026-10-01", copyrightYear: "2023+",
      links: [{ label: "Table of Contents", href: "toc.html" }, { label: "License", href: "https://l", external: true }],
      scope: "st-ig", stylesheets: ["assets/ig-pages.css"],
    };
    const script = 'require "liquid"; require "json"; d = JSON.parse(STDIN.read.force_encoding("UTF-8")); print Liquid::Template.parse(d["t"], error_mode: :strict).render("site" => { "data" => { "fhir" => { "footer" => d["f"] } } }, "page" => d["p"])';
    const run = (p: Record<string, string>) => spawnSync("ruby", ["-e", script], { input: JSON.stringify({ t: readFileSync(FOOTER_TEMPLATE_PATH, "utf-8"), f: footer, p }), encoding: "utf-8" });
    const r = run({ ig_prev: "a.html", ig_next: "c.html" });
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain('<link rel="stylesheet" href="assets/ig-pages.css">');
    expect(r.stdout).toContain('<footer id="ig-footer" class="st-ig">');
    expect(r.stdout).toContain('<a href="a.html">&lt;prev</a> | <a href="#">top</a> | <a href="c.html">next&gt;</a>');
    expect(r.stdout).toContain('IG © 2023+ <a href="https://example.org" rel="external">Example Org</a>. Package <code>x.ig#0.2.1</code> based on <a href="http://hl7.org/fhir/R5/" rel="external">FHIR 5.0.0</a>. Generated 2026-10-01');
    expect(r.stdout).toContain('Links: <a href="toc.html">Table of Contents</a> | <a href="https://l" rel="external">License</a>');
    // The first page: no prev, and nothing invented for it.
    expect(run({}).stdout).toContain('<p class="ig-footer-nav"><a href="#">top</a></p>');
  });
});

describe("a path a later site step writes is left to it", () => {
  test("reservedPrefixNotPublished", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-reserved-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    mkdirSync(join(src, "input", "images", "openapi"), { recursive: true });
    mkdirSync(join(src, "input", "images", "demo"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: X IG\n");
    writeFileSync(join(src, "input", "pagecontent", "index.md"), "# I\n");
    writeFileSync(join(src, "input", "images", "openapi", "index.html"), "<html>swagger</html>");
    writeFileSync(join(src, "input", "images", "openapi", "swagger-ui.js"), "//");
    writeFileSync(join(src, "input", "images", "openapi.png"), "png");
    writeFileSync(join(src, "input", "images", "demo", "app.js"), "export {};");
    const s = stageIgSite(src, join(d, "out"), { reservedPaths: [{ prefix: "openapi/", by: "ig-site:openapi" }] });
    expect(existsSync(join(d, "out", "openapi"))).toBe(false);
    // A file merely named like the prefix, and other subdirectories, still publish.
    expect(readFileSync(join(d, "out", "openapi.png"), "utf-8")).toBe("png");
    expect(existsSync(join(d, "out", "demo", "app.js"))).toBe(true);
    expect(s.reserved).toEqual(["openapi/index.html (ig-site:openapi)", "openapi/swagger-ui.js (ig-site:openapi)"]);
    expect(describeStage(s)).toContain("a later step writes the path: 2 file(s)");
    rmSync(d, { recursive: true, force: true });
  });
});

describe("a reserved FILE leaves the rest of its directory to the IG", () => {
  test("reservedFileOnlyWithheld", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-reserved-file-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    mkdirSync(join(src, "input", "images", "openapi"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: X IG\n");
    writeFileSync(join(src, "input", "pagecontent", "index.md"), "# I\n");
    writeFileSync(join(src, "input", "images", "openapi", "index.html"), "<html>swagger</html>");
    writeFileSync(join(src, "input", "images", "openapi", "api.openapi.json"), "{}");
    const s = stageIgSite(src, join(d, "out"), { reservedPaths: [{ prefix: "openapi/api.openapi.json", by: "served directory x-openapi" }] });
    expect(readFileSync(join(d, "out", "openapi", "index.html"), "utf-8")).toBe("<html>swagger</html>");
    expect(existsSync(join(d, "out", "openapi", "api.openapi.json"))).toBe(false);
    expect(s.reserved).toEqual(["openapi/api.openapi.json (served directory x-openapi)"]);
    rmSync(d, { recursive: true, force: true });
  });
});

describe("a link into a subdirectory of input/images stays on the site", () => {
  test("imageSubdirLinkStaysOnSite", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-nested-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    mkdirSync(join(src, "input", "images", "demo"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: X IG\n");
    writeFileSync(join(src, "input", "images", "demo", "app.css"), "p{}");
    writeFileSync(join(src, "input", "pagecontent", "concepts.md"), '[css](demo/app.css) <link rel="stylesheet" href="demo/app.css">\n');
    stageIgSite(src, join(d, "out"), { editBase: "https://github.com/o/r/edit/main" });
    const page = readFileSync(join(d, "out", "concepts.md"), "utf-8");
    expect(page).toContain("[css](demo/app.css)");
    expect(page).toContain('href="demo/app.css"');
    expect(readFileSync(join(d, "out", "demo", "app.css"), "utf-8")).toBe("p{}");
    rmSync(d, { recursive: true, force: true });
  });
});

describe("an SVG in input/images is published minified", () => {
  test("svgPublishedMinified", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-svg-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    mkdirSync(join(src, "input", "images", "demo"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: X IG\n");
    writeFileSync(join(src, "input", "pagecontent", "concepts.md"), '<img src="flow.svg">\n');
    const saved = '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:v="http://schemas.microsoft.com/visio/2003/SVGExtensions/">\n\t<v:userDefs><v:ud v:nameU="x"/></v:userDefs>\n\t<rect width="1" height="1" v:mID="1"/>\n</svg>\n';
    writeFileSync(join(src, "input", "images", "flow.svg"), saved);
    writeFileSync(join(src, "input", "images", "demo", "flow.svg"), saved);
    const r = stageIgSite(src, join(d, "out"), {});
    const small = '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
    expect(readFileSync(join(d, "out", "flow.svg"), "utf-8")).toBe(small);
    expect(readFileSync(join(d, "out", "demo", "flow.svg"), "utf-8")).toBe(small);
    // The include copy, which Jekyll does not publish, is the IG's file as given.
    expect(readFileSync(join(d, "out", "_includes", "flow.svg"), "utf-8")).toBe(saved);
    expect(r.svgMinified).toEqual({ files: 2, saved: 2 * (saved.length - small.length) });
    expect(describeStage(r)).toContain("SVGs published minified: 2");
    rmSync(d, { recursive: true, force: true });
  });
});

describe("edit links to the IG's own source (bean `mftp`)", () => {
  test("pagecontentHasEditUrl", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-edit-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: X IG\n");
    writeFileSync(join(src, "input", "pagecontent", "concepts.md"), "# C\n");
    stageIgSite(src, join(d, "out"), { menu: { groups: [{ label: "Home", items: [{ label: "C", href: "concepts.html" }] }] }, editBase: "https://github.com/o/r/edit/main" });
    expect(readFileSync(join(d, "out", "concepts.md"), "utf-8")).toContain('ig_edit_url: "https://github.com/o/r/edit/main/input/pagecontent/concepts.md"');
    expect(readFileSync(join(d, "out", "toc.md"), "utf-8")).not.toContain("ig_edit_url");
    expect(readFileSync(join(d, "out", "_layouts", "default.html"), "utf-8")).toContain("Edit this page on GitHub");
    // The standalone layout carries the same opt-in, inside the content it names (bean n7f8).
    expect(readFileSync(join(d, "out", "_layouts", "default.html"), "utf-8")).toMatch(/id="main-content">\n<span hidden data-fa-figure-images="ig"><\/span>/);
    const layout = readFileSync(join(d, "out", "_layouts", "default.html"), "utf-8");
    // Per-section: a source-line link and a pre-filled feedback issue.
    expect(layout).toContain('id="ig-source-lines"');
    // Built in the browser from the platform's one recipe (bean v433).
    expect(layout).toContain("function faBlockUrls");
    expect(layout).toContain('data-fa-link="edit"');
    const fm = readFileSync(join(d, "out", "concepts.md"), "utf-8");
    expect(fm).toContain('ig_source_repo: "o/r"');
    expect(fm).toContain('ig_source_branch: "main"');
    expect(fm).toContain('ig_source_path: "input/pagecontent/concepts.md"');
    expect(readFileSync(join(d, "out", "concepts.md"), "utf-8")).toContain('ig_source_blob: "https://github.com/o/r/blob/main/input/pagecontent/concepts.md"');
    rmSync(d, { recursive: true, force: true });
  });
});

describe("sourceHeadings: each section's line in the IG's source (bean `mftp`)", () => {
  test("sourceHeadingsWithLines", () => {
    const md = ["# Title {#t}", "", "text", "```", "# not a heading", "```", "### A [link](x.html) and **bold**", "## Last ##"].join("\n");
    expect(sourceHeadings(md)).toEqual([
      { t: "Title", l: 1 },
      { t: "A link and bold", l: 7 },
      { t: "Last", l: 8 },
    ]);
  });
});

// Bean `x78e`: an HL7 IG's landing page is `index.md` = `{% include index-ig.md %}`,
// so every heading the reader sees lives in the include. The ✎ / 📣 heading
// links (bean `mftp`) must follow the include to its own file and line, in the data
// the edit-links runtime reads.
describe("heading links on an IG's first page, whose headings live in an include (bean `x78e`)", () => {
  test("includeHeadingsLinkToInclude", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-x78e-"));
    const src = join(d, "src");
    const pc = join(src, "input", "pagecontent");
    mkdirSync(pc, { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: X IG\n");
    writeFileSync(join(pc, "index.md"), "{% include index-ig.md %}\n\n{% include ip-statements.xhtml %}\n");
    writeFileSync(
      join(pc, "index-ig.md"),
      ["An intro paragraph.", "", "<div>", "<p>Under development.</p>", "</div>{:.stu-note}", "", "", "### Summary ", "Summary text.", "", "### About this implementation guide", "", "More.", "", "### Disclaimer", "Text."].join("\n"),
    );
    stageIgSite(src, join(d, "out"), { menu: { groups: [{ label: "Home", items: [{ label: "Summary", href: "index.html" }] }] }, editBase: "https://github.com/o/r/edit/main" });
    const fm = readFileSync(join(d, "out", "index.md"), "utf-8");
    const lines = JSON.parse(/^ig_source_lines: (.*)$/m.exec(fm)?.[1] ?? "null");
    const inc = "https://github.com/o/r/blob/main/input/pagecontent/index-ig.md";
    expect(lines).toEqual([
      { t: "Summary", l: 8, b: inc },
      { t: "About this implementation guide", l: 11, b: inc },
      { t: "Disclaimer", l: 15, b: inc },
    ]);

    // The layout hands those lines to the page as data; the platform's
    // edit-links runtime draws ✎ / 📣 from them in the right gutter
    // (cat-harness-tools edit-links.test.ts holds its behaviour), and nothing
    // is appended to the heading itself any more (owner, 2026-11-08).
    const layout = readFileSync(join(d, "out", "_layouts", "default.html"), "utf-8");
    expect(layout).toContain('<script type="application/json" id="ig-source-lines">');
    expect(layout).toContain("page.ig_source_lines | jsonify");
    expect(layout).not.toContain('"ig-src"');
    expect(layout).not.toContain('"ig-feedback"');
    rmSync(d, { recursive: true, force: true });
  });

  test("includeCycleEnds", () => {
    const files: Record<string, string> = { "a.md": "# A\n{% include b.md %}", "b.md": "## B\n{% include a.md %}\n{% include x.xhtml %}" };
    const inc = (name: string) => (files[name] ? { md: files[name]!, path: `input/includes/${name}` } : undefined);
    expect(sourceHeadings("{% include a.md %}\n# Own", inc)).toEqual([
      { t: "A", l: 1, p: "input/includes/a.md" },
      { t: "B", l: 1, p: "input/includes/b.md" },
      { t: "Own", l: 2 },
    ]);
  });
});

// Bean `mftp`, owner 2026-10-05: "Build in main site" — the IG's pages wear the
// host site's chrome, with the IG's includes and data namespaced per IG.
describe("composeIgSite: a staged IG moved into a host Jekyll source", () => {
  // The full path (`--full-pages`): the host's own layout and chrome.
  test("composeNestsAndNamespaces", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-compose-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    mkdirSync(join(src, "input", "includes"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: X IG\n");
    writeFileSync(join(src, "input", "pagecontent", "index.md"), "# Home\n\n{{ site.data.fhir.packageId }}\n");
    writeFileSync(join(src, "input", "pagecontent", "concepts.md"), "# C\n\n{% include note.md %}\n");
    writeFileSync(join(src, "input", "includes", "note.md"), "a note");
    const staged = join(d, "site");
    stageIgSite(src, staged, { menu: { groups: [{ label: "Home", items: [{ label: "Summary", href: "index.html" }] }, { label: "Business", items: [{ label: "Concepts", href: "concepts.html" }] }] }, baseurl: "/b/x" });
    const host = join(d, "host");
    mkdirSync(host, { recursive: true });
    const c = composeIgSite(staged, host, "x", { fullPages: true });
    expect(c.collisions).toEqual([]);
    const index = readFileSync(join(host, "x", "index.md"), "utf-8");
    expect(index).toMatch(/^---\ntitle: "X IG"\nhas_children: true\n/);
    expect(index).toContain('site.data.ig["x"].fhir.packageId');
    expect(index).toContain("{% include ig/x/_top.html %}");
    expect(index).toContain("{% include ig/_bottom.html %}");
    const concepts = readFileSync(join(host, "x", "concepts.md"), "utf-8");
    expect(concepts).toContain('parent: "Business"');
    expect(concepts).toContain('grand_parent: "X IG"');
    expect(concepts).toContain("layout: default");
    expect(concepts).toContain("{% include ig/x/note.md %}");
    const group = readFileSync(join(host, "x", "menu-business.md"), "utf-8");
    expect(group).toContain('parent: "X IG"');
    expect(existsSync(join(host, "_includes", "ig", "x", "note.md"))).toBe(true);
    expect(existsSync(join(host, "_data", "ig", "x", "fhir.json"))).toBe(true);
    expect(readFileSync(join(host, "_includes", "ig", "x", "_top.html"), "utf-8")).toContain('class="ig-topbar fa-page-bar"');
    // Every composed IG page opts its raster images into the shared figure viewer (bean n7f8).
    expect(readFileSync(join(host, "_includes", "ig", "x", "_top.html"), "utf-8")).toContain(IG_FIGURE_IMAGES_STAMP);
    // ...through the attribute the platform's viewer actually reads: the contract is docs-ui.js's.
    expect(IG_FIGURE_IMAGES_STAMP).toContain("data-fa-figure-images");
    // Asked, never spelled: `docs-ui.js` is the site CHROME's since cat-harness
    // moved the chrome into its own `site-chrome/` layer (semantic subgraphs,
    // slice 1); `siteFileFor` gives the later-wins answer compose-docs gives.
    const harness = join(import.meta.dir, "..", "..", "cat-harness");
    const docsUi = readFileSync(join(harness, siteFileFor(harness, "assets/js/docs-ui.js")), "utf-8");
    expect(docsUi).toContain('document.querySelector("[data-fa-figure-images]")');
    expect(existsSync(join(host, "x", "_config.yml"))).toBe(false);
    expect(existsSync(join(host, "x", "_layouts"))).toBe(false);
    // A second compose of the same IG is two answers for one URL.
    expect(composeIgSite(staged, host, "x", { fullPages: true }).collisions.length).toBeGreaterThan(0);
    // `atRoot` (#2235 F1): the IG IS the site — the same pages at the root.
    const root = join(d, "root");
    mkdirSync(root, { recursive: true });
    expect(composeIgSite(staged, root, "x", { atRoot: true, fullPages: true }).collisions).toEqual([]);
    expect(existsSync(join(root, "index.md"))).toBe(true);
    expect(existsSync(join(root, "concepts.md"))).toBe(true);
    expect(existsSync(join(root, "x"))).toBe(false);
    expect(existsSync(join(root, "_includes", "ig", "x", "_top.html"))).toBe(true);
    rmSync(d, { recursive: true, force: true });
  });

  // Bean g196: the literal base was one preview's path, so every IG page
  // differed between two previews only by that name.
  test("hostBaseIsLiquidBaseurl", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-compose-base-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: X IG\n");
    writeFileSync(join(src, "input", "pagecontent", "index.md"), "# Home\n");
    const staged = join(d, "site");
    const site = "/folio-assistant/STAGING/some-branch";
    stageIgSite(src, staged, { menu: { groups: [{ label: "Home", items: [{ label: "Summary", href: "index.html" }] }] }, baseurl: `${site}/x/ig` });
    const host = join(d, "host");
    mkdirSync(host, { recursive: true });
    expect(composeIgSite(staged, host, "x", { siteBase: site, at: "ig" }).collisions).toEqual([]);
    const written = [readFileSync(join(host, "_layouts", "ig-thin-x.html"), "utf-8"), readFileSync(join(host, "_includes", "ig", "x", "_top.html"), "utf-8")].join("\n");
    expect(written).not.toContain("some-branch");
    expect(written).toContain('"href":"{{ site.baseurl }}/x/ig/index.html"');
    expect(written).toContain('href="{{ site.baseurl }}/x/ig/index.html"');
    // folio-assistant#2738: the pages land where the menu points.
    expect(existsSync(join(host, "x", "ig", "index.md"))).toBe(true);
    expect(existsSync(join(host, "x", "index.md"))).toBe(false);
    rmSync(d, { recursive: true, force: true });
  });

  // folio-assistant#2738: an IG at its layer's root, with no artefact pages
  // to bring `ig-artifact.css`, still gets the stylesheet its layout links.
  test("composedAtInstanceCarriesStylesheet", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-compose-at-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: X IG\n");
    writeFileSync(join(src, "input", "pagecontent", "index.md"), "# Home\n");
    const staged = join(d, "site");
    stageIgSite(src, staged, { menu: { groups: [{ label: "Home", items: [{ label: "Summary", href: "index.html" }] }] }, baseurl: "/b/x" });
    const host = join(d, "host");
    mkdirSync(host, { recursive: true });
    expect(composeIgSite(staged, host, "x", { siteBase: "/b", at: "." }).collisions).toEqual([]);
    expect(existsSync(join(host, "x", "index.md"))).toBe(true);
    expect(existsSync(join(host, "x", "ig"))).toBe(false);
    expect(existsSync(join(host, "x", "assets", "ig-artifact.css"))).toBe(true);
    const layout = readFileSync(join(host, "_layouts", "ig-thin-x.html"), "utf-8");
    expect(layout).toContain("/x/assets/ig-artifact.css");
    expect(layout).toContain('href="{{ site.baseurl }}/x/index.html"');
    rmSync(d, { recursive: true, force: true });
  });

  test("liquidSiteBaseQuotedOnly", () => {
    expect(liquidSiteBase('<a href="/fa/x/">x</a> <a href="/fa-core/">y</a> "/fa"', "/fa/")).toBe('<a href="{{ site.baseurl }}/x/">x</a> <a href="/fa-core/">y</a> "/fa"');
    expect(liquidSiteBase('{"href":"/fa/x.html"}', "/fa")).toBe('{"href":"{{ site.baseurl }}/x.html"}');
    expect(liquidSiteBase('<a href="/x/">', "")).toBe('<a href="/x/">');
    expect(liquidSiteBase('<a href="/x/">', undefined)).toBe('<a href="/x/">');
  });
});

describe("relinkPublisherOutputs — the Publisher's downloads live on the published IG", () => {
  test("relinksBareDownloads", () => {
    const r = relinkPublisherOutputs("* [IG Package](package.tgz)\n* [JSON](definitions.json.zip)", "http://example.org/ig/");
    expect(r.text).toBe("* [IG Package](http://example.org/ig/package.tgz)\n* [JSON](http://example.org/ig/definitions.json.zip)");
    expect(r.count).toBe(2);
  });
  test("leavesPagesPathsAbsolute", () => {
    const t = "[a](index.html) [b](files/x.zip) [c](https://x.org/y.zip) <a href=\"z.tgz\">";
    const r = relinkPublisherOutputs(t, "http://c");
    expect(r.text).toBe("[a](index.html) [b](files/x.zip) [c](https://x.org/y.zip) <a href=\"http://c/z.tgz\">");
    expect(r.count).toBe(1);
  });
});

describe("relinkArtifacts — a case-only mismatch", () => {
  test("caseOnlyMismatchResolves", () => {
    const r = relinkArtifacts("[model](StructureDefinition-hcert.html)", new Set(["StructureDefinition-HCert"]), "artifact/");
    expect(r.text).toBe("[model](artifact/StructureDefinition-HCert.html)");
  });
  test("ambiguousCaseLeftAlone", () => {
    const r = relinkArtifacts("[x](A-b.html)", new Set(["A-B", "a-B"]), "artifact/");
    expect(r.text).toBe("[x](A-b.html)");
    expect(r.count).toBe(0);
  });
});

describe("relinkOffSite — what this build cannot serve goes where it is served", () => {
  const src = mkdtempSync(join(tmpdir(), "offsite-"));
  mkdirSync(join(src, ".github", "skills"), { recursive: true });
  writeFileSync(join(src, ".github", "skills", "s.yaml"), "x");
  mkdirSync(join(src, "input", "bpmn"), { recursive: true });
  writeFileSync(join(src, "input", "bpmn", "D.bpmn"), "x");
  const o = { canonical: "http://example.org/ig", sourceBlob: "https://github.com/o/r/blob/main", srcRoot: src, isServed: (t: string) => t === "index.html" };
  test("publisherOnlyPageToPublished", () => {
    expect(relinkOffSite('<a href="qa.html">QA</a>', o).text).toBe('<a href="http://example.org/ig/qa.html">QA</a>');
  });
  test("repoFileToGithub", () => {
    const r = relinkOffSite("[s](.github/skills/s.yaml) [d](bpmn/D.bpmn)", o);
    expect(r.text).toBe("[s](https://github.com/o/r/blob/main/.github/skills/s.yaml) [d](https://github.com/o/r/blob/main/input/bpmn/D.bpmn)");
    expect(r.count).toBe(2);
  });
  test("artifactsHtmlToPublished", () => {
    expect(relinkOffSite('<a href="artifacts.html">A</a>', o).text).toBe('<a href="http://example.org/ig/artifacts.html">A</a>');
    expect(offSiteHref("artifacts.html", o.canonical, (t) => t === "artifacts.html")).toBe("artifacts.html");
    expect(offSiteHref("downloads.html", o.canonical, o.isServed)).toBe("downloads.html");
    expect(offSiteHref("artifacts.html", undefined, o.isServed)).toBe("artifacts.html");
  });
  test("unservedPageReportedDead", () => {
    const r = relinkOffSite("[v](video_tutorial.html) [i](index.html)", o);
    expect(r.text).toBe("[v](video_tutorial.html) [i](index.html)");
    expect(r.dead).toEqual(["video_tutorial.html"]);
  });
});

describe("rubyLiquidStrings — a Publisher Liquid string Jekyll can read", () => {
  test("escapedQuoteAssignSingleQuoted", () => {
    const src = '{% assign x__link__html = "<a href=\\"V.html\\">V</a>" %}';
    const r = rubyLiquidStrings(src);
    expect(r.text).toBe(`{% assign x__link__html = '<a href="V.html">V</a>' %}`);
    expect(r.count).toBe(1);
  });
  test("plainAndApostropheLeftAlone", () => {
    const plain = '{% assign a = "plain" %}';
    const apos = '{% assign b = "it\'s <a href=\\"x\\">" %}';
    expect(rubyLiquidStrings(plain + apos).text).toBe(plain + apos);
  });
});

describe("the Publisher's artefact lists, written from the artefact index (bean 9hfi)", () => {
  // A page as an IG's terminology or maps page writes it (bean 9hfi):
  // `list-*.xhtml` fragments the IG Publisher GENERATES, which no
  // IG source holds. Rendered through Liquid as Jekyll renders the page.
  let d: string;
  let o: string;
  let res: StageResult;
  let page: string;
  const list = [
    { resourceType: "CodeSystem", id: "cs-b", title: "beta system", description: "Beta codes" },
    { resourceType: "CodeSystem", id: "cs-a", title: "Alpha system", category: "Terminology: Code Systems" },
    { resourceType: "ValueSet", id: "vs.1", title: "Vaccines", description: "Codes for <vaccines> & boosters" },
    { resourceType: "Library", id: "lib", title: "Logic" },
  ];
  beforeAll(async () => {
    d = mkdtempSync(join(tmpdir(), "ig-lists-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: lists.ig\ncanonical: http://example.org/lists\ntitle: Lists IG\nversion: 0.1.0\nfhirVersion: 4.0.1\npages:\n  codings.md:\n    title: Codings\n");
    writeFileSync(
      join(src, "input", "pagecontent", "codings.md"),
      [
        "### CodeSystems",
        "{% include list-simple-codesystems.xhtml %}",
        "",
        "### ValueSets",
        "{% include list-valuesets.xhtml %}",
        "",
        "### Libraries",
        "{% include list-simple-libraries.xhtml %}",
        "",
        "### StructureMaps",
        "<div>",
        "    {% include list-structuremaps.xhtml %}",
        "  </div>",
        "",
        "### Profiles",
        "{% include list-simple-profiles.xhtml %}",
        "",
      ].join("\n"),
    );
    o = join(d, "site");
    res = stageIgSite(src, o, { artifacts: { list, pagesHref: "artifact/" } });
    const { Liquid } = await import("liquidjs");
    const engine = new Liquid({ root: [join(o, "_includes")], jekyllInclude: true, dynamicPartials: false, extname: "" });
    const text = readFileSync(join(o, "codings.md"), "utf-8");
    const body = text.slice(text.indexOf("\n---", 3) + 4);
    page = await engine.parseAndRender(body, { site: { data: { fhir: JSON.parse(readFileSync(join(o, "_data", "fhir.json"), "utf-8")) } } });
  });
  afterAll(() => rmSync(d, { recursive: true, force: true }));

  /** The rendered text between one heading and the next. */
  const section = (h: string) => page.split(`### ${h}`)[1]!.split("### ")[0]!;
  const href = (a: { resourceType: string; id: string }) => `artifact/${artifactPageName(a)}.html`;

  test("listSimpleListsArtefacts", () => {
    const cs = section("CodeSystems");
    expect(cs).not.toContain("ig-not-rendered");
    expect(cs).not.toContain("not rendered");
    // The Publisher's shape: one <li> per artefact, its title linked to its page, by title.
    expect(cs).toContain(`<ul class="ig-artifact-list">\n <li><a href="${href(list[1]!)}">Alpha system</a></li>\n <li><a href="${href(list[0]!)}">beta system</a></li>\n</ul>`);
    // Simple: no description. Every artefact of the type, categorised or not.
    expect(cs).not.toContain("Beta codes");
    expect(section("Libraries")).toContain(`<a href="${href(list[3]!)}">Logic</a>`);
    expect(res.listed).toEqual(["list-simple-codesystems.xhtml", "list-simple-libraries.xhtml", "list-structuremaps.xhtml", "list-valuesets.xhtml"]);
    expect(res.notRendered).not.toContain("list-simple-codesystems.xhtml");
  });

  test("fullFormCarriesDescription", () => {
    expect(section("ValueSets")).toContain(`<li><a href="${href(list[2]!)}">Vaccines</a> Codes for &lt;vaccines&gt; &amp; boosters</li>`);
  });

  test("emptyTypeIsSaid", () => {
    const sm = section("StructureMaps");
    expect(sm).toContain("This guide's artefact index holds no StructureMap resources.");
    expect(sm).not.toContain("not rendered");
  });

  test("untypedListStaysMarker", () => {
    expect(section("Profiles")).toContain("⟦not rendered: list-simple-profiles.xhtml⟧");
    expect(res.notRendered).toEqual(["list-simple-profiles.xhtml"]);
  });

  test("noIndexListsStayMarkers", () => {
    const r2 = stageIgSite(join(d, "src"), join(d, "no-index"));
    expect(r2.listed).toEqual([]);
    expect(r2.notRendered).toContain("list-simple-codesystems.xhtml");
  });

  test("publisherPluralsMapBack", () => {
    expect(publisherPlural("CodeSystem")).toBe("codesystems");
    expect(publisherPlural("Library")).toBe("libraries");
    expect(publisherPlural("SubscriptionStatus")).toBe("subscriptionstatuses");
    expect(publisherPlural("RelatedPerson")).toBe("relatedpeople");
    expect(artifactListInclude("list-simple-valuesets.xhtml")).toEqual({ resourceType: "ValueSet", simple: true });
    expect(artifactListInclude("list-structuremaps.xhtml")).toEqual({ resourceType: "StructureMap", simple: false });
    expect(artifactListInclude("list-simple-profiles.xhtml")).toBeUndefined();
    expect(artifactListInclude("list-simple-valuesets-json.xhtml")).toBeUndefined();
  });

  test("listTemplateOpensWithComment", () => {
    const t = readFileSync(ARTIFACT_LIST_TEMPLATE_PATH, "utf-8");
    expect(t.startsWith("{%- comment -%}")).toBe(true);
    expect(t).not.toMatch(/\|\s*(plus|minus|size|replace|sort)\b/);
  });
});

describe("input/data -> _data (bean yy4u): the IG's own site.data, and every overwrite flagged", () => {
  test("igDataStagedAndClashesFlagged", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-data-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    mkdirSync(join(src, "input", "data"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: X IG\n");
    writeFileSync(join(src, "input", "pagecontent", "index.md"), "https://raw.githubusercontent.com/{{site.data.features.github.repo_owner}}/x\n");
    writeFileSync(join(src, "input", "data", "features.yaml"), "github:\n  repo_owner: Someone\n");
    // Two IG files with one stem, and one with the harness's own key: three sources, two clashes.
    writeFileSync(join(src, "input", "data", "features.json"), "{}");
    writeFileSync(join(src, "input", "data", "fhir.yml"), "packageId: shadow\n");
    writeFileSync(join(src, "input", "data", "notes.txt"), "not Jekyll data");
    const staged = join(d, "site");
    const r = stageIgSite(src, staged, {});
    expect(r.data.staged).toEqual(["features.json"]);
    expect(r.data.overwrites).toEqual([
      { key: "features", kept: "input/data/features.json", dropped: "input/data/features.yaml" },
      { key: "fhir", kept: "_data/fhir.json (written by this build)", dropped: "input/data/fhir.yml" },
    ]);
    // The harness's site.data.fhir survives the IG's fhir.yml.
    expect(JSON.parse(readFileSync(join(staged, "_data", "fhir.json"), "utf-8")).packageId).not.toBe("shadow");
    expect(existsSync(join(staged, "_data", "notes.txt"))).toBe(false);
    expect(describeStage(r)).toContain("QA FINDING data-overwrite: site.data.fhir");
    const qa = dataOverwritesQa("x", { script: "s", script_hash: "h" }, r.data.overwrites);
    expect(qa.total).toBe(2);
    expect(qa.families["data-overwrite"]!.count).toBe(2);
    // Composed, the IG's data key is namespaced exactly as site.data.fhir is.
    const host = join(d, "host");
    mkdirSync(host, { recursive: true });
    expect(composeIgSite(staged, host, "x", { atRoot: true }).collisions).toEqual([]);
    expect(readFileSync(join(host, "index.md"), "utf-8")).toContain('site.data.ig["x"].features.github.repo_owner');
    expect(existsSync(join(host, "_data", "ig", "x", "features.json"))).toBe(true);
    rmSync(d, { recursive: true, force: true });
  });

  test("noDataNothingFlagged", () => {
    const qa = dataOverwritesQa("x", { script: "s", script_hash: "h" }, []);
    expect(qa.total).toBe(0);
    expect(qa.families["data-overwrite"]!.count).toBe(0);
  });
});

describe("the FHIR AST's resources as site.data (system-actors rendered EMPTY without them)", () => {
  // smart-trust's system-actors.md, the loop that rendered no actor at all on
  // gh-pages 63303eb because neither site.data.canonicals nor site.data[stub]
  // existed. The include is reduced to the one field it prints.
  const LOOP = [
    "{% assign canonicals = site.data.canonicals | where: 'type' , 'ActorDefinition' %}",
    "{% for canonical in canonicals %}{% assign stub = canonical.type | append: \"-\" | append: canonical.id %}" +
      "{% assign actordefinition = site.data[stub] %}[{{ actordefinition.title }}]{% endfor %}",
  ].join("\n");
  const ast = (dir: string) => {
    mkdirSync(dir, { recursive: true });
    const res = [
      { key: "http://x/ActorDefinition/holder|1", canonical: "http://x/ActorDefinition/holder", version: "1", resourceType: "ActorDefinition", id: "holder", name: "Holder", file: "ActorDefinition-holder.json", source: null },
      { key: "http://x/ActorDefinition/issuer|1", canonical: "http://x/ActorDefinition/issuer", version: "1", resourceType: "ActorDefinition", id: "issuer", name: "Issuer", file: "ActorDefinition-issuer.json", source: null },
      { key: "Patient/p1", canonical: null, version: null, resourceType: "Patient", id: "p1", file: "Patient-p1.json", source: null },
      { key: "http://x/ImplementationGuide/x|1", canonical: "http://x/ImplementationGuide/x", version: "1", resourceType: "ImplementationGuide", id: "x", file: "ImplementationGuide-x.json", source: null },
    ];
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ $schema: "ig-ast/v1", authority: "cache", provisional: [], resources: res }));
    writeFileSync(join(dir, "dependencies.json"), JSON.stringify({ $schema: "ig-ast-dependencies/v1", dependencies: [] }));
    writeFileSync(join(dir, "ActorDefinition-holder.json"), JSON.stringify({ resourceType: "ActorDefinition", id: "holder", title: "Holder" }));
    writeFileSync(join(dir, "ActorDefinition-issuer.json"), JSON.stringify({ resourceType: "ActorDefinition", id: "issuer", title: "Issuer" }));
    writeFileSync(join(dir, "Patient-p1.json"), JSON.stringify({ resourceType: "Patient", id: "p1" }));
    writeFileSync(join(dir, "ImplementationGuide-x.json"), JSON.stringify({ resourceType: "ImplementationGuide", id: "x", url: "http://x/ImplementationGuide/x", packageId: "x.ig", version: "1" }));
  };
  const siteData = (dataDir: string): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const f of readdirSync(dataDir)) {
      if (f.endsWith(".json")) out[f.replace(/\.json$/, "")] = JSON.parse(readFileSync(join(dataDir, f), "utf-8"));
    }
    return out;
  };

  test("astResourcesAsSiteData", async () => {
    const d = mkdtempSync(join(tmpdir(), "ig-ast-data-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: X IG\n");
    writeFileSync(join(src, "input", "pagecontent", "system-actors.md"), LOOP + "\n");
    ast(join(src, "output-ast"));
    const staged = join(d, "site");
    const r = stageIgSite(src, staged, {});
    expect(r.astData).toEqual({ canonicals: 3, resources: 4 });
    const canon = JSON.parse(readFileSync(join(staged, "_data", "canonicals.json"), "utf-8"));
    expect(canon.map((c: { type: string; id: string }) => `${c.type}/${c.id}`)).toEqual(["ActorDefinition/holder", "ActorDefinition/issuer", "ImplementationGuide/x"]);
    expect(existsSync(join(staged, "_data", "Patient-p1.json"))).toBe(true);
    expect(describeStage(r)).toContain("site.data.canonicals (3)");
    const { Liquid } = await import("liquidjs");
    const liquid = new Liquid();
    const data = siteData(join(staged, "_data"));
    expect((await liquid.parseAndRender(LOOP, { site: { data } })).trim()).toBe("[Holder][Issuer]");

    // Composed into a host, the computed-key lookup follows the data to site.data.ig["x"].
    const host = join(d, "host");
    mkdirSync(host, { recursive: true });
    expect(composeIgSite(staged, host, "x", { atRoot: true }).collisions).toEqual([]);
    const page = readFileSync(join(host, "system-actors.md"), "utf-8");
    expect(page).toContain('site.data.ig["x"][stub]');
    expect(page).toContain('site.data.ig["x"].canonicals');
    // Only the loop: the composed page also carries the chrome includes, which need the host.
    const body = page.slice(page.indexOf("{% assign canonicals"), page.indexOf("{% endfor %}") + "{% endfor %}".length);
    const composed = { ig: { x: siteData(join(host, "_data", "ig", "x")) } };
    expect((await liquid.parseAndRender(body, { site: { data: composed } })).trim()).toContain("[Holder][Issuer]");
    rmSync(d, { recursive: true, force: true });
  });

  test("noAstNothingWritten", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-ast-none-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: X IG\n");
    writeFileSync(join(src, "input", "pagecontent", "index.md"), "x\n");
    const r = stageIgSite(src, join(d, "site"), {});
    expect(r.astData).toBeUndefined();
    expect(existsSync(join(d, "site", "_data", "canonicals.json"))).toBe(false);
    expect(describeStage(r)).toContain("renders EMPTY");
    rmSync(d, { recursive: true, force: true });
  });
});

describe("dependency-table.xhtml is written from the IG's declaration, not left a marker (bean 4475)", () => {
  test("dependencyTableFromDeclaration", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-deps-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: X IG\ndependencies:\n  a.b: 1.0.0\n");
    writeFileSync(join(src, "input", "pagecontent", "dependencies.md"), "{% include dependency-table.xhtml %}\n\n{% include dependency-table-short.xhtml %}\n");
    const out = join(d, "site");
    const r = stageIgSite(src, out, { packageCache: join(d, "no-cache") });
    expect(r.dependencyTables).toEqual(["dependency-table-short.xhtml", "dependency-table.xhtml"]);
    expect(r.notRendered).not.toContain("dependency-table.xhtml");
    expect(readFileSync(join(out, "_includes", "dependency-table.xhtml"), "utf-8")).toContain('form="full"');
    expect(JSON.parse(readFileSync(join(out, "_data", "fhir.json"), "utf-8")).dependencies).toEqual([{ packageId: "a.b", version: "1.0.0", depth: 0, resolved: false }]);
    expect(describeStage(r)).toContain("from sushi-config.yaml (dependencies): 1 row(s); NOT in the package cache");
    rmSync(d, { recursive: true, force: true });
  });
});

describe("linkTableCells (owner, 2026-10-10: table ids should be clickable)", () => {
  const lookup = artifactCellLookup(
    [
      { resourceType: "PlanDefinition", id: "IMMZD2DTBCG", title: "IMMZ.D2.DT.BCG" },
      { resourceType: "PlanDefinition", id: "IMMZD18SBCG", title: "IMMZ.D18.S.BCG schedule" },
      { resourceType: "Measure", id: "IMMZIND01", title: "IMMZIND01" },
      { resourceType: "ValueSet", id: "Dup", title: "Shared" },
      { resourceType: "CodeSystem", id: "Dup2", title: "Shared" },
    ],
    "artifact/",
  );

  test("markdownCellLinksByTitle", () => {
    const r = linkTableCells("| ID | Description |\n|---|---|\n| **IMMZ.D18.S.BCG schedule** | Recommended schedule |\n", lookup);
    expect(r.text).toContain("| [**IMMZ.D18.S.BCG schedule**](artifact/PlanDefinition-IMMZD18SBCG.html) |");
    expect(r.text).toContain("| Recommended schedule |");
    expect(r.count).toBe(1);
  });

  test("htmlCellMatchesIdWithoutPunctuation", () => {
    const r = linkTableCells("<tr>\n<td>IMMZ.IND.01</td>\n<td>Coverage for BCG</td>\n</tr>", lookup);
    expect(r.text).toContain('<td><a href="artifact/Measure-IMMZIND01.html">IMMZ.IND.01</a></td>');
    expect(r.text).toContain("<td>Coverage for BCG</td>");
  });

  test("processNameLinksToHeading", () => {
    const body = [
      "| # | Process Name | Process ID |",
      "|---|---|---|",
      "| A | Vaccination location registration  | IMMZ.A |",
      "| H | Resolve duplicate vaccination events | IMMZ.H |",
      "",
      "####  A.  Vaccination location registration  ",
      "####  H .  Resolve duplicate vaccination events  ",
    ].join("\n");
    const r = linkTableCells(body, lookup);
    expect(r.text).toContain("| A | [Vaccination location registration](#a--vaccination-location-registration)  | [IMMZ.A](#a--vaccination-location-registration) |");
    expect(r.text).toContain("[IMMZ.H](#h---resolve-duplicate-vaccination-events)");
    // The single-letter `#` column is not identifier-shaped and stays text.
    expect(r.text).toContain("| A | [");
  });

  test("sharedKeyAndLinkedCellLeftAlone", () => {
    const r = linkTableCells("| x |\n|---|\n| Shared |\n| [IMMZ.D2.DT.BCG](elsewhere.html) |\n", lookup);
    expect(r.count).toBe(0);
  });

  test("kramdownIdMatchesHeadings", () => {
    expect(kramdownId("A.  Vaccination location registration")).toBe("a--vaccination-location-registration");
  });
});

describe("annexes (owner, 2026-10-10: the data dictionary loaded on demand)", () => {
  test("annexMountPointsAtJson", () => {
    const m = annexMount("dd.json", ["data element id", "data type"]);
    expect(m).toContain('class="fa-annex" data-src="assets/annex/dd.json"');
    expect(m).toContain('data-columns="data element id|data type"');
    expect(m).toContain('href="assets/annex/dd.json"');
    expect(m).toContain('src="assets/js/ig-annex.js"');
    // Page-relative, so a host's base cannot send it to the host's root.
    expect(m).not.toContain("site.baseurl");
  });

  test("annexRendererUsesTextContent", () => {
    const js = readFileSync(ANNEX_SCRIPT_PATH, "utf-8");
    expect(js).not.toContain("innerHTML");
    expect(js).toContain("textContent");
  });
});

describe("annexes in a staged page", () => {
  test("jsonAnnexMountsMarkdownAppended", () => {
    const root = mkdtempSync(join(tmpdir(), "annex-"));
    const src = join(root, "ig");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: x\ncanonical: http://example.org/x\npages:\n  index.md:\n    title: Home\n  people.md:\n    title: People\n");
    writeFileSync(join(src, "input", "pagecontent", "index.md"), "Home.\n");
    writeFileSync(join(src, "input", "pagecontent", "people.md"), "People.\n");
    writeFileSync(join(root, "t.json"), JSON.stringify({ title: "T", sheets: [] }));
    writeFileSync(join(root, "x.md"), "### Cross-references\n\n- [A](index.html)\n");
    const out = join(root, "out");
    const r = stageIgSite(src, out, { annexes: [{ page: "index.md", src: join(root, "t.json") }, { page: "people.md", src: join(root, "x.md") }, { page: "nope.md", src: join(root, "x.md") }] });
    expect(readFileSync(join(out, "index.md"), "utf-8")).toContain('class="fa-annex"');
    expect(existsSync(join(out, "assets", "js", "ig-annex.js"))).toBe(true);
    const people = readFileSync(join(out, "people.md"), "utf-8");
    expect(people).toContain("### Cross-references");
    expect(people).not.toContain("fa-annex");
    expect(r.unplaced).toEqual(["nope.md (x.md)"]);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("the annex contract: an ig-annex directory the instance declares (fm9n)", () => {
  const ig = (decl: Record<string, unknown>): string => {
    const root = mkdtempSync(join(tmpdir(), "annex-decl-"));
    const at = join(root, "an-ig");
    mkdirSync(join(at, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(at, "an-ig.json"), JSON.stringify({ name: "an-ig", version: "0.1.0", directories: [], ...decl }, null, 2));
    writeFileSync(join(at, "sushi-config.yaml"), "id: x\ncanonical: http://example.org/x\npages:\n  dictionary.md:\n    title: Dictionary\n");
    writeFileSync(join(at, "input", "pagecontent", "dictionary.md"), "The dictionary.\n");
    return at;
  };
  const table = JSON.stringify({ title: "T", sheets: [] });

  test("annexesInReadsBothShapes", () => {
    const d = mkdtempSync(join(tmpdir(), "annex-dir-"));
    writeFileSync(join(d, "t.json"), table);
    expect(annexesIn(d)).toBeUndefined();
    writeFileSync(join(d, "annexes.json"), JSON.stringify({ $schema: "ig-annexes/v1", annexes: [{ page: "dictionary.md", file: "t.json", columns: ["a"] }] }));
    expect(annexesIn(d)).toEqual([{ page: "dictionary.md", src: join(d, "t.json"), columns: ["a"] }]);
    writeFileSync(join(d, "annexes.json"), JSON.stringify([{ page: "dictionary.md", file: "t.json" }]));
    expect(annexesIn(d)).toEqual([{ page: "dictionary.md", src: join(d, "t.json") }]);
    writeFileSync(join(d, "annexes.json"), JSON.stringify({ $schema: "ig-annexes/v1", annexes: [{ page: "dictionary.md", file: "gone.json" }] }));
    expect(() => annexesIn(d)).toThrow(/declared but not held/);
    writeFileSync(join(d, "annexes.json"), JSON.stringify({ $schema: "ig-annexes/v1", annexes: [{ page: "dictionary.md" }] }));
    expect(() => annexesIn(d)).toThrow();
    rmSync(d, { recursive: true, force: true });
  });

  test("annexesForReadsDeclaredDirs", () => {
    const at = ig({
      directories: [
        { id: "an-ig-annexes", path: "annexes/", graphTypologies: ["ig-annex"] },
        { id: "an-ig-annex-files", path: "annexes/tables/", graphTypologies: ["docs"] },
      ],
    });
    mkdirSync(join(at, "annexes", "tables"), { recursive: true });
    writeFileSync(join(at, "annexes", "tables", "t.json"), table);
    writeFileSync(join(at, "annexes", "annexes.json"), JSON.stringify({ $schema: "ig-annexes/v1", annexes: [{ page: "dictionary.md", file: "tables/t.json" }] }));
    // A directory holding an annexes.json that is not declared ig-annex is not read.
    mkdirSync(join(at, "other"));
    writeFileSync(join(at, "other", "annexes.json"), JSON.stringify({ $schema: "ig-annexes/v1", annexes: [{ page: "x.md", file: "nope.json" }] }));
    expect(annexDirsFor(at)).toEqual([join(at, "annexes/")]);
    expect(annexesFor(at)).toEqual([{ page: "dictionary.md", src: join(at, "annexes", "tables", "t.json") }]);
    // What compose and stage-ig-sites hand stageIgSite: the page mounts the loader.
    const out = join(at, "..", "out");
    const r = stageIgSite(at, out, { annexes: annexesFor(at) });
    expect(readFileSync(join(out, "dictionary.md"), "utf-8")).toContain('data-src="assets/annex/t.json"');
    expect(existsSync(join(out, "assets", "annex", "t.json"))).toBe(true);
    expect(r.annexed).toEqual(["dictionary.md <- t.json"]);
    rmSync(join(at, ".."), { recursive: true, force: true });
  });

  test("absentAnnexDirSaidAndSkipped", () => {
    const at = ig({ directories: [{ id: "an-ig-annexes", path: "annexes/", graphTypologies: ["ig-annex"] }] });
    const said: string[] = [];
    expect(annexesFor(at, (s) => said.push(s))).toBeUndefined();
    expect(said.join("\n")).toMatch(/an-ig-annexes is declared and not in this checkout/);
    rmSync(join(at, ".."), { recursive: true, force: true });
  });

  test("legacyArtifactIndexAnnexesRead", () => {
    const at = ig({});
    mkdirSync(join(at, "fhir-artifact-index"));
    writeFileSync(join(at, "fhir-artifact-index", "t.json"), table);
    writeFileSync(join(at, "fhir-artifact-index", "annexes.json"), JSON.stringify([{ page: "dictionary.md", file: "t.json", columns: ["a"] }]));
    expect(annexesFor(at)).toEqual([{ page: "dictionary.md", src: join(at, "fhir-artifact-index", "t.json"), columns: ["a"] }]);
    rmSync(join(at, ".."), { recursive: true, force: true });
  });
});

describe("an inlined runtime is kept out of Liquid's reach (smart-trust, 2026-10-14)", () => {
  // The edit-links runtime's variable pattern carries `{%`; inlined bare into
  // `_includes/ig/_bottom.html` it was a Liquid syntax error that stopped the build.
  const liquid = new Liquid({ strictFilters: false });
  test("inertScriptRendersOwnBytes", async () => {
    const js = "var re = /\\{\\{[\\s\\S]*?\\}\\}|\\{%[\\s\\S]*?%\\}/g; var t = '{{ x }} {% if y %}';";
    expect(await liquid.parseAndRender(`<script>${liquidInertScript(js)}</script>`, {})).toBe(`<script>${js}</script>`);
  });
  test("refusesScriptClosingRaw", () => {
    expect(() => liquidInertScript("var s = '{% endraw %}';")).toThrow(/endraw/);
    expect(() => liquidInertScript("var s = '{%- endraw -%}';")).toThrow(/endraw/);
  });
  test("fullPagesBottomCarriesRuntimes", async () => {
    const { bottom } = igChromeIncludes("");
    const html = await liquid.parseAndRender(bottom, { page: { ig_source_lines: [1], ig_edit_url: "e" } });
    expect(html).toContain(EDIT_LINKS_RUNTIME);
    expect(html).toContain('id="ig-source-lines"');
  });
});

describe("include names are refused unless they are one safe path segment", () => {
  test("safeIncludeNames", () => {
    for (const ok of ["foo.md", "bar.svg", "x.liquid", "list-simple-profiles.xhtml", "_top.html"]) expect(isSafeIncludeName(ok)).toBe(true);
    for (const bad of ["", ".", "..", "../x.md", "a/b.md", "a\\b.md", "/abs.md", "{{", "x\0.md", "-x.md"]) expect(isSafeIncludeName(bad)).toBe(false);
  });

  test("refusedIncludeWritesNothing", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-site-refuse-"));
    try {
      const src = join(d, "src");
      mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
      writeFileSync(join(src, "sushi-config.yaml"), "id: example.ig\ncanonical: http://example.org/ig\nname: ExampleIG\ntitle: Example IG\nstatus: draft\nversion: 0.1.0\nfhirVersion: 4.0.1\npages:\n  index.md:\n    title: Home\n");
      writeFileSync(join(src, "input", "pagecontent", "index.md"), "{% include ../../escaped.md %}\n{% include sub/nested.md %}\n{% include kept.md %}\n");
      const out = join(d, "site");
      const res = stageIgSite(src, out);
      expect(res.refusedIncludes).toEqual(["../../escaped.md", "sub/nested.md"]);
      expect(existsSync(join(d, "escaped.md"))).toBe(false);
      expect(existsSync(join(out, "_includes", "sub"))).toBe(false);
      expect(res.notRendered).toEqual(["kept.md"]);
      expect(describeStage(res)).toContain("REFUSED include name(s)");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("relinkPublisherTemplateAssets — staged input/images HTML pages point Publisher template assets at canonical (#2741)", () => {
  test("relinksTemplateAssets", () => {
    const html = [
      '<link href="../../fhir.css" rel="stylesheet"/>',
      '<link href="../../assets/css/bootstrap-fhir.css" rel="stylesheet"/>',
      '<link href="./swagger-ui.css" rel="stylesheet"/>',
      '<link href="index.css" rel="stylesheet"/>',
      '<link rel="apple-touch-icon-precomposed" sizes="144x144" href="../../assets/ico/icon-fhir-144.png"/>',
      '<script src="../../fhir-table-scripts.js"></script>',
      '<script src="../../assets/js/jquery.js"></script>',
      '<script src="./swagger-ui-bundle.js"></script>',
    ].join("\n");
    const r = relinkPublisherTemplateAssets(html, "http://example.org/ig/");
    expect(r.count).toBe(5);
    expect(r.text).toContain('href="http://example.org/ig/fhir.css"');
    expect(r.text).toContain('href="http://example.org/ig/assets/css/bootstrap-fhir.css"');
    expect(r.text).toContain('href="http://example.org/ig/assets/ico/icon-fhir-144.png"');
    expect(r.text).toContain('src="http://example.org/ig/fhir-table-scripts.js"');
    expect(r.text).toContain('src="http://example.org/ig/assets/js/jquery.js"');
    expect(r.text).toContain('href="./swagger-ui.css"');
    expect(r.text).toContain('href="index.css"');
    expect(r.text).toContain('src="./swagger-ui-bundle.js"');
  });

  test("stageRelinksTemplateAssets", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-openapi-assets-"));
    try {
      const src = join(d, "src");
      mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
      mkdirSync(join(src, "input", "images", "openapi"), { recursive: true });
      writeFileSync(
        join(src, "sushi-config.yaml"),
        "id: example.ig\ncanonical: http://example.org/ig\nname: ExampleIG\ntitle: Example IG\nstatus: draft\nversion: 0.1.0\nfhirVersion: 4.0.1\npages:\n  index.md:\n    title: Home\n",
      );
      writeFileSync(join(src, "input", "pagecontent", "index.md"), "Home");
      writeFileSync(
        join(src, "input", "images", "openapi", "index.html"),
        '<html><head><link href="../../fhir.css" rel="stylesheet"/><link href="./swagger-ui.css" rel="stylesheet"/></head><body><script src="../../assets/js/jquery.js"></script></body></html>',
      );
      const out = join(d, "out");
      const res = stageIgSite(src, out);
      expect(res.relinked).toBe(2);
      const staged = readFileSync(join(out, "openapi", "index.html"), "utf-8");
      expect(staged).toContain('href="http://example.org/ig/fhir.css"');
      expect(staged).toContain('src="http://example.org/ig/assets/js/jquery.js"');
      expect(staged).toContain('href="./swagger-ui.css"');
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("the process task panel on an IG's pages (owner, 2026-11-12, Q-RAIL-2)", () => {
  test("bothLayoutsCarryTheLoader", async () => {
    const m = await import("./build-ig-site.ts");
    for (const l of [m.thinIgLayout("/x/"), m.harnessLayout("", "")]) expect(l).toContain(`<script>{% raw %}${m.IG_TASK_PANEL_JS}{% endraw %}</script>`);
    expect(m.IG_TASK_PANEL_JS).not.toMatch(/\{\{|\{%/);
  });
  test("loadsOnlyFromASameSiteSidecar", async () => {
    const { IG_TASK_PANEL_JS } = await import("./build-ig-site.ts");
    const re = new RegExp(IG_TASK_PANEL_JS.match(/if\(!\/(.+?)\/\.test\(p\)/)![1]!);
    const ok = (p: string) => re.test(p) && !p.includes("//");
    expect(ok("en/cat-harness/processes/j1.tasks.json")).toBe(true);
    expect(ok("../processes/j1.tasks.json")).toBe(true);
    for (const bad of ["https://evil.example/x.tasks.json", "//evil.example/x.tasks.json", "/abs/x.tasks.json", "javascript:alert(1)//.tasks.json", "en/x.json", "en/x.tasks.json?y", "data:text/javascript,1.tasks.json", "en/j1Xtasks.json", "en/j1.tasksXjson"]) expect(ok(bad)).toBe(false);
  });
});

describe("the Contents card on an IG's narrative pages (owner, 2026-11-10)", () => {
  test("bothLayoutsCarryTheCard", async () => {
    const m = await import("./build-ig-site.ts");
    const thin = m.thinIgLayout("/x/");
    const full = m.harnessLayout("", "");
    for (const l of [thin, full]) expect(l).toContain(`<script>{% raw %}${m.IG_CONTENTS_JS}{% endraw %}</script>\n</main>`);
    // The standalone layout links no ig-artifact.css, so it carries the card's style itself.
    expect(full).toContain(".igi-contents{");
    expect(full).toContain("float:right");
  });
  test("cardNeedsTwoHeadings", async () => {
    const { IG_CONTENTS_JS, igContentsRows } = await import("./build-ig-site.ts");
    expect(igContentsRows([{ level: 3, i: 0 }])).toEqual([]);
    expect(igContentsRows([])).toEqual([]);
    // The browser runs the same function, and the script is Liquid-inert and parses.
    expect(IG_CONTENTS_JS).toContain("function igContentsRows(");
    expect(IG_CONTENTS_JS).not.toMatch(/\{\{|\{%/);
    expect(() => new Function(IG_CONTENTS_JS)).not.toThrow();
  });
  test("shallowestLevelWithOneNested", async () => {
    const { igContentsRows } = await import("./build-ig-site.ts");
    // A markdown IG page: sections at h3, subsections at h4, a deeper h5 left out.
    const page = [3, 4, 4, 3, 4, 2 + 3].map((level, i) => ({ level, i }));
    expect(igContentsRows(page)).toEqual([{ i: 0, sub: [1, 2] }, { i: 3, sub: [4] }]);
    // Where the page has h2, h2 is the top level and h4 is not listed.
    expect(igContentsRows([2, 3, 4, 2].map((level, i) => ({ level, i })))).toEqual([{ i: 0, sub: [1] }, { i: 3, sub: [] }]);
    // A nested heading before any top-level one is listed at the top.
    expect(igContentsRows([4, 3, 4].map((level, i) => ({ level, i })))).toEqual([{ i: 0, sub: [] }, { i: 1, sub: [2] }]);
  });
  test("cardPrintsAsABlock", () => {
    const css = readFileSync(join(import.meta.dir, "templates", "ig-pages", "ig-artifact.css"), "utf-8");
    expect(css).toMatch(/@media print\{\.ig-main>\.igi-contents[^}]*float:none/);
  });
});
