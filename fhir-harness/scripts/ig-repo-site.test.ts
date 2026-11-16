/**
 * An IG repository's own site with no layer declaration: the closure's top,
 * the AST it is built from (restore gate, served data, the IG API sidecars a
 * layer above leaves), and what is never staged as the IG's source.
 * Driven by synthetic trees, so it names no real IG.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { parseBuild, STAMP_FILE } from "./site-build-stamp.ts";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isRemoteData, localResourceHref } from "./ig-artifact-jsonld.ts";
import type { FhirArtifact } from "../schemas/fhir-artifact-index.js";
import type { ResolvedEntry } from "../../cat-harness-tools/scripts/mount-instance-docs.ts";

import {
  acceptStaleFromEnv,
  AST_SOURCE_FILE,
  astArtefactPages,
  astGate,
  astRawBase,
  builtPage,
  cqlSourceOf,
  INDEX_CACHED,
  INDEX_REF_FILE,
  indexRef,
  locateArtefactIndex,
  readIgApiDir,
  rebaseSwaggerSpecs,
  siteIgApi,
  SWAGGER_PAGE,
  dropForeignIndexes,
  foreignArtefactIndexes,
  IG_API_DESCRIPTOR,
  IG_API_SITE,
  IG_API_WORK,
  IG_SITE_SCRIPTS,
  igSiteStamp,
  INDEX_WORK,
  isPreviewBase,
  isRedirectStub,
  libraryByUrl,
  reduceForSite,
  rootResourcesFromEnv,
  platformCommit,
  listedInstances,
  notSource,
  PLANTUML_VERSION,
  plantumlJarFor,
  PUBLISHER_CHROME,
  publisherChromePages,
  publisherPages,
  readIgApi,
  serveAstData,
  SIDECARS_SERVED,
  stampIgTocNav,
  topMounts,
  VALIDITY_FILE,
} from "./ig-repo-site.ts";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "ig-repo-site-"));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("topMounts", () => {
  test("topMountsNothingNeeds", () => {
    const needs: Record<string, string[]> = { base: ["fhir", "core"], fhir: ["core"], core: ["tools"], tools: [] };
    expect(topMounts(["base", "fhir", "core", "tools"], (n) => needs[n] ?? [])).toEqual(["base"]);
  });
  test("independentTopsBoth", () => {
    expect(topMounts(["a", "b"], () => [])).toEqual(["a", "b"]);
  });
});

describe("listedInstances", () => {
  test("listedInstancesInOrder", () => {
    const r = join(dir, "listed");
    mkdirSync(r, { recursive: true });
    expect(listedInstances(r)).toEqual([]);
    writeFileSync(join(r, "index.config.json"), JSON.stringify({ instances: [{ name: "b" }, { name: "a" }, {}] }));
    expect(listedInstances(r)).toEqual(["b", "a"]);
  });
});

describe("notSource", () => {
  test("notSourceMountsAndProducts", () => {
    const r = join(dir, "src");
    mkdirSync(r, { recursive: true });
    writeFileSync(join(r, "index.lock.json"), JSON.stringify({ instances: [{ path: "base" }, { path: "layer/sub" }, { path: "." }] }));
    const s = notSource(r);
    for (const p of ["base", "layer", ".git", "output", "output-ast", "temp", "input-cache"]) expect(s.has(p)).toBe(true);
    expect(s.has("input")).toBe(false);
    expect(s.has(".")).toBe(false);
  });
});

/** A minimal AST as `ig-cache.sh restore` lays it down: a manifest and its resource files. */
function fakeAst(root: string, resources: { resourceType: string; id: string }[]): string {
  const ast = join(root, "output-ast");
  const listed = resources.map((r) => ({ ...r, key: `${r.resourceType}/${r.id}`, file: `resources/${r.resourceType}/${r.id}--0000.json` }));
  for (const r of listed) {
    mkdirSync(join(ast, "resources", r.resourceType), { recursive: true });
    writeFileSync(join(ast, r.file), JSON.stringify({ resourceType: r.resourceType, id: r.id }));
  }
  writeFileSync(join(ast, "manifest.json"), JSON.stringify({ $schema: "ig-ast/v1", resources: listed }));
  return ast;
}

describe("the AST gate (ig-build-pipeline rule 2)", () => {
  test("validAstGoesOn", () => {
    expect(astGate("valid", { acceptStale: false, preview: false }).ok).toBe(true);
  });
  test("staleRefusedNoFallback", () => {
    for (const v of ["stale-inputs", "cannot-tell", "stale-toolchain"]) {
      const g = astGate(v, { acceptStale: false, preview: true });
      expect(g.ok).toBe(false);
      expect(g.said).toContain("does not fall back");
    }
  });
  test("staleAcceptedPreviewOnly", () => {
    expect(astGate("stale-inputs", { acceptStale: true, preview: true }).ok).toBe(true);
    const root = astGate("stale-inputs", { acceptStale: true, preview: false });
    expect(root.ok).toBe(false);
    expect(root.said).toContain("for a preview only");
    expect(root.said).toContain("ig-ast-build.sh");
  });
  test("previewAcceptsStaleByDefault", () => {
    expect(acceptStaleFromEnv(undefined)).toBe(true);
    expect(acceptStaleFromEnv("1")).toBe(true);
    expect(acceptStaleFromEnv("0")).toBe(false);
    const refused = astGate("stale-inputs", { acceptStale: acceptStaleFromEnv("0"), preview: true });
    expect(refused.ok).toBe(false);
    expect(refused.said).toContain("=0");
  });
  test("previewIsStagingBase", () => {
    expect(isPreviewBase("/smart-x/STAGING/claude-a")).toBe(true);
    expect(isPreviewBase("/smart-x")).toBe(false);
    expect(isPreviewBase(undefined)).toBe(false);
  });
});

describe("the IG API sidecars a layer above leaves in the work directory", () => {
  test("noSidecarsNothingBound", () => {
    const w = join(dir, "work-none");
    mkdirSync(join(w, IG_API_WORK, "sidecars"), { recursive: true });
    expect(readIgApi(undefined)).toBeUndefined();
    expect(readIgApi(join(dir, "absent"))).toBeUndefined();
    expect(readIgApi(w)).toBeUndefined();
  });
  test("sidecarsAndLabelFromDescriptor", () => {
    const w = join(dir, "work-api");
    mkdirSync(join(w, IG_API_WORK, "sidecars"), { recursive: true });
    writeFileSync(join(w, IG_API_WORK, "sidecars", "ValueSet-x.schema.json"), "{}");
    expect(readIgApi(w)).toEqual({ sidecars: join(w, IG_API_WORK, "sidecars"), files: 1 });
    writeFileSync(join(w, IG_API_WORK, IG_API_DESCRIPTOR), JSON.stringify({ label: " My API " }));
    expect(readIgApi(w)?.label).toBe("My API");
  });
  test("refusesEmptyLabel", () => {
    const w = join(dir, "work-bad");
    mkdirSync(join(w, IG_API_WORK, "sidecars"), { recursive: true });
    writeFileSync(join(w, IG_API_WORK, "sidecars", "a.jsonld"), "{}");
    writeFileSync(join(w, IG_API_WORK, IG_API_DESCRIPTOR), JSON.stringify({ label: "" }));
    expect(() => readIgApi(w)).toThrow(/label/);
  });
});

describe("publisher pages: the AST's data, never the Publisher's HTML", () => {
  test("servesAstDataAndIndex", () => {
    const root = join(dir, "serve");
    const ast = fakeAst(root, [{ resourceType: "ValueSet", id: "x" }, { resourceType: "CodeSystem", id: "y" }]);
    const site = join(root, "_site");
    mkdirSync(site, { recursive: true });
    writeFileSync(join(site, "CodeSystem-y.json"), "site");
    const index = join(root, "index.json");
    writeFileSync(index, "{}");
    const sidecars = join(root, "sidecars");
    mkdirSync(sidecars);
    writeFileSync(join(sidecars, "ValueSet-x.schema.json"), "{}");
    const r = serveAstData({ site, ast, index, igApi: { sidecars, files: 1 } });
    expect(r).toEqual({ named: 1, kept: 1, sidecars: 1, siteFiles: 0, siteKept: [], siteFilled: [], index: true });
    expect(existsSync(join(site, "ast-data"))).toBe(false);
    expect(JSON.parse(readFileSync(join(site, "ValueSet-x.json"), "utf-8")).id).toBe("x");
    expect(readFileSync(join(site, "CodeSystem-y.json"), "utf-8")).toBe("site");
    expect(existsSync(join(site, "fhir-artifact-index", "index.json"))).toBe(true);
    expect(existsSync(join(site, SIDECARS_SERVED, "ValueSet-x.schema.json"))).toBe(true);
  });
  test("noAstRefusedNamingStep", () => {
    const site = join(dir, "site-noast");
    mkdirSync(site, { recursive: true });
    expect(() => publisherPages({ site, ast: join(dir, "absent"), log: () => {} })).toThrow(new RegExp(`no AST[\\s\\S]*${IG_SITE_SCRIPTS.ast}`));
  });
  test("readsWorkDirIndexAndSidecars", () => {
    const root = join(dir, "serve-work");
    const ast = fakeAst(root, [{ resourceType: "ValueSet", id: "x" }]);
    const work = join(root, "work");
    mkdirSync(join(work, INDEX_WORK), { recursive: true });
    writeFileSync(join(work, INDEX_WORK, "index.json"), "{}");
    mkdirSync(join(work, IG_API_WORK, "sidecars"), { recursive: true });
    writeFileSync(join(work, IG_API_WORK, "sidecars", "ValueSet-x.jsonld"), "{}");
    const site = join(root, "_site");
    mkdirSync(site, { recursive: true });
    const said: string[] = [];
    expect(publisherPages({ site, ast, work, log: (s) => said.push(s) })).toEqual({ named: 1, kept: 0, sidecars: 1, siteFiles: 0, siteKept: [], siteFilled: [], index: true });
    expect(said.join("\n")).toContain("The Publisher's HTML is not taken");
  });
});

test("layerSiteFilesServedNotOver", () => {
  const root = join(dir, "serve-site");
  const ast = fakeAst(root, [{ resourceType: "ValueSet", id: "x" }]);
  const work = join(root, "work");
  const api = join(work, IG_API_WORK);
  mkdirSync(join(api, "sidecars"), { recursive: true });
  writeFileSync(join(api, "sidecars", "ValueSet-x.openapi.json"), "{}");
  mkdirSync(join(api, IG_API_SITE, "openapi"), { recursive: true });
  writeFileSync(join(api, IG_API_SITE, "openapi", "index.html"), "<p>hub</p>");
  writeFileSync(join(api, IG_API_SITE, "ValueSet-x.openapi.json"), "{}");
  writeFileSync(join(api, IG_API_SITE, "index.html"), "<p>overlay</p>");
  const igApi = readIgApi(work);
  expect(igApi?.site).toBe(join(api, IG_API_SITE));
  const site = join(root, "_site");
  mkdirSync(site, { recursive: true });
  writeFileSync(join(site, "index.html"), "<p>site</p>");
  const r = serveAstData({ site, ast, igApi: igApi! });
  expect(r.siteFiles).toBe(2);
  expect(r.siteKept).toEqual(["index.html"]);
  expect(readFileSync(join(site, "openapi", "index.html"), "utf-8")).toBe("<p>hub</p>");
  expect(existsSync(join(site, "ValueSet-x.openapi.json"))).toBe(true);
  expect(readFileSync(join(site, "index.html"), "utf-8")).toBe("<p>site</p>");
});

test("placeholderPageReplaced", () => {
  const root = join(dir, "serve-fill");
  const ast = fakeAst(root, [{ resourceType: "ValueSet", id: "x" }]);
  const work = join(root, "work");
  const api = join(work, IG_API_WORK);
  mkdirSync(join(api, "sidecars"), { recursive: true });
  writeFileSync(join(api, "sidecars", "ValueSet-x.jsonld"), "{}");
  mkdirSync(join(api, IG_API_SITE), { recursive: true });
  writeFileSync(join(api, IG_API_SITE, "hub.html"), "<p>thin hub</p>");
  writeFileSync(join(api, IG_API_SITE, "other.html"), "<p>overlay</p>");
  writeFileSync(join(api, IG_API_DESCRIPTOR), JSON.stringify({ placeholder: "<!-- HUB_HERE -->" }));
  const site = join(root, "_site");
  mkdirSync(site, { recursive: true });
  writeFileSync(join(site, "hub.html"), "<h1>Hub</h1><!-- HUB_HERE -->");
  writeFileSync(join(site, "other.html"), "<p>the IG's own</p>");
  const r = serveAstData({ site, ast, igApi: readIgApi(work)! });
  expect(r.siteFilled).toEqual(["hub.html"]);
  expect(r.siteKept).toEqual(["other.html"]);
  expect(readFileSync(join(site, "hub.html"), "utf-8")).toBe("<p>thin hub</p>");
  expect(readFileSync(join(site, "other.html"), "utf-8")).toBe("<p>the IG's own</p>");
});

test("refusesShortPlaceholder", () => {
  const w = join(dir, "work-ph");
  mkdirSync(join(w, IG_API_WORK, "sidecars"), { recursive: true });
  writeFileSync(join(w, IG_API_WORK, "sidecars", "a.jsonld"), "{}");
  writeFileSync(join(w, IG_API_WORK, IG_API_DESCRIPTOR), JSON.stringify({ placeholder: "<p>" }));
  expect(() => readIgApi(w)).toThrow(/placeholder/);
});

describe("the PlantUML jar", () => {
  test("plantumlJarPrecedence", () => {
    const home = join(dir, "home");
    const given = join(dir, "given.jar");
    writeFileSync(given, "jar");
    expect(plantumlJarFor(given, {}, home)).toBe(given);
    expect(plantumlJarFor(join(dir, "nope.jar"), { PLANTUML_JAR: given }, home)).toBe(given);
    expect(plantumlJarFor(undefined, {}, home)).toBeUndefined();
    const cached = join(home, ".cache", "plantuml", `plantuml-${PLANTUML_VERSION}.jar`);
    mkdirSync(join(cached, ".."), { recursive: true });
    writeFileSync(cached, "jar");
    expect(plantumlJarFor(undefined, {}, home)).toBe(cached);
  });
});

describe("the guard: no published page wears the IG Publisher's chrome (owner, 2026-10-14)", () => {
  // The Publisher's own page head and footer, as it writes them.
  const PUBLISHER_PAGE =
    '<html><head><link href="fhir.css" rel="stylesheet"/><link href="assets/css/bootstrap-fhir.css" rel="stylesheet"/></head>' +
    '<body><p>x</p><p>Generated <span title="Wed, Oct 14, 2026">2026-10-14</span></p></body></html>';
  test("publisherChromeMarkers", () => {
    for (const html of ['<link href="fhir.css" rel="stylesheet"/>', '<link rel="stylesheet" href="../assets/css/fhir.css">', '<link href="assets/css/bootstrap-fhir.css" rel="stylesheet"/>', 'Generated <span title="Wed">2026</span>']) {
      expect(PUBLISHER_CHROME.some((re) => re.test(html))).toBe(true);
    }
    expect(PUBLISHER_CHROME.some((re) => re.test('<link rel="stylesheet" href="/x/assets/ig-artifact.css"><p>Generated by hand</p>'))).toBe(false);
  });
  test("namesPagesWithChrome", () => {
    const site = join(dir, "guarded");
    mkdirSync(join(site, "deep"), { recursive: true });
    writeFileSync(join(site, "index.html"), "<p>site</p>");
    writeFileSync(join(site, "deep", "StructureDefinition-x.html"), PUBLISHER_PAGE);
    writeFileSync(join(site, "fhir.css"), "body{}");
    expect(publisherChromePages(site)).toEqual(["deep/StructureDefinition-x.html"]);
  });
  test("refusesSiteWithChrome", () => {
    const site = join(dir, "refused");
    mkdirSync(site, { recursive: true });
    writeFileSync(join(site, "artifacts.html"), PUBLISHER_PAGE);
    const ast = fakeAst(join(dir, "refused-ig"), [{ resourceType: "ValueSet", id: "x" }]);
    expect(() => publisherPages({ site, ast, log: () => {} })).toThrow(/IG Publisher's chrome[\s\S]*artifacts\.html/);
  });
});

test("builtPageByPermalink", () => {
  expect(builtPage("index.md")).toBe("index.html");
  expect(builtPage("sub/x.markdown")).toBe("sub/x.html");
  expect(builtPage("y.html")).toBe("y.html");
  expect(builtPage("_includes/ig/x/a.md")).toBeUndefined();
  expect(builtPage("assets/a.png")).toBeUndefined();
});

test("checkoutScriptsDeclared", () => {
  const pkg = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf-8")) as { checkoutScripts: Record<string, string> };
  expect(pkg.checkoutScripts[IG_SITE_SCRIPTS.ast]).toBe("bun run fhir-harness/scripts/ig-repo-site.ts ast");
  expect(pkg.checkoutScripts[IG_SITE_SCRIPTS.compose]).toBe("bun run fhir-harness/scripts/ig-repo-site.ts compose");
  expect(pkg.checkoutScripts[IG_SITE_SCRIPTS.publisherPages]).toBe("bun run fhir-harness/scripts/ig-repo-site.ts publisher-pages");
});

describe("the site's folio-build.json", () => {
  const ig = () => {
    const r = mkdtempSync(join(tmpdir(), "ig-stamp-"));
    const git = (...a: string[]) => spawnSync("git", ["-C", r, ...a], { encoding: "utf-8" });
    git("init", "-q", "-b", "main");
    git("remote", "add", "origin", "https://github.com/example/my-ig.git");
    writeFileSync(join(r, "sushi-config.yaml"), "id: example.ig\n");
    git("add", "-A");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "c");
    return r;
  };

  test("platformIsPinnedToolset", () => {
    const r = ig();
    expect(platformCommit(r)).toBeUndefined();
    writeFileSync(join(r, "index.lock.json"), JSON.stringify({ mounts: [{ harness: "base", ref: "b1" }, { harness: "cat-harness-tools", ref: "t1" }] }));
    expect(platformCommit(r)).toBe("t1");
    writeFileSync(join(r, "index.lock.json"), JSON.stringify({ mounts: [{ harness: "base", ref: "b1" }] }));
    expect(platformCommit(r)).toBe("b1");
  });

  test("stampNamesRepoAndCommit", () => {
    const r = ig();
    writeFileSync(join(r, "index.lock.json"), JSON.stringify({ mounts: [{ harness: "cat-harness-tools", ref: "t1" }] }));
    const head = spawnSync("git", ["-C", r, "rev-parse", "HEAD"], { encoding: "utf-8" }).stdout.trim();
    const s = igSiteStamp(r, {}, new Date("2026-10-14T00:00:00Z"));
    expect(s).toEqual({ $schema: "folio-site-build/v1", instance: "my-ig", platform: { commit: "t1" }, source: { repo: "example/my-ig", ref: "main", commit: head }, builtAt: "2026-10-14T00:00:00.000Z" });
  });

  test("publisherPagesWritesStamp", () => {
    const r = ig();
    writeFileSync(join(r, "index.lock.json"), JSON.stringify({ mounts: [{ harness: "cat-harness-tools", ref: "t1" }] }));
    const site = join(r, "_site");
    mkdirSync(site);
    writeFileSync(join(site, "index.html"), "<p>site</p>");
    publisherPages({ site, ast: fakeAst(r, [{ resourceType: "ValueSet", id: "x" }]), ig: r, log: () => {} });
    expect(existsSync(join(site, STAMP_FILE))).toBe(true);
    const b = parseBuild(readFileSync(join(site, STAMP_FILE), "utf-8"));
    expect(typeof b === "string" ? b : b.platform.commit).toBe("t1");
  });

  test("stampNamesAstSource", () => {
    const r = ig();
    writeFileSync(join(r, "index.lock.json"), JSON.stringify({ mounts: [{ harness: "cat-harness-tools", ref: "t1" }] }));
    const site = join(r, "_site");
    const work = join(r, "work");
    mkdirSync(site);
    mkdirSync(work);
    writeFileSync(join(site, "index.html"), "<p>site</p>");
    writeFileSync(join(work, VALIDITY_FILE), JSON.stringify({ verdict: "stale-inputs", recorded: { sourceRevision: "91b2b5a" } }));
    const said: string[] = [];
    publisherPages({ site, ast: fakeAst(r, [{ resourceType: "ValueSet", id: "x" }]), ig: r, work, log: (s) => said.push(s) });
    const b = parseBuild(readFileSync(join(site, STAMP_FILE), "utf-8"));
    expect(typeof b === "string" ? b : b.ast).toEqual({ commit: "91b2b5a", verdict: "stale-inputs", kind: "full" });
    expect(said.some((s) => s.includes("stale-inputs") && s.includes("91b2b5a"))).toBe(true);
  });
});

test("siteTitledOnce", async () => {
  const { thinIgLayout, harnessLayout } = await import("./build-ig-site");
  const { Liquid } = await import("liquidjs");
  const engine = new Liquid();
  for (const layout of [thinIgLayout("/"), harnessLayout("", "")]) {
    const title = /<title>.*<\/title>/.exec(layout)![0];
    expect(await engine.parseAndRender(title, { page: { title: "My IG" }, site: { title: "My IG" } })).toBe("<title>My IG</title>");
    expect(await engine.parseAndRender(title, { page: { title: "Home" }, site: { title: "My IG" } })).toMatch(/^<title>Home (—|\|) My IG<\/title>$/);
  }
});

test("composedPageCarriesFolio", async () => {
  const { thinIgLayout } = await import("./build-ig-site");
  const { hasMount } = await import("../../cat-harness-tools/scripts/folio-mount.ts");
  const { Liquid } = await import("liquidjs");
  const layout = thinIgLayout("/some-ig/");
  expect(hasMount(layout)).toBe(true);
  // Linked from the HOST's root, not the IG's, which is where docs-ui.js is published.
  const engine = new Liquid();
  engine.registerFilter("relative_url", (u: string) => `/folio-assistant${u}`);
  const head = /<head>[\s\S]*<\/head>/.exec(layout)![0];
  const html = await engine.parseAndRender(head, { page: { title: "x" }, site: { title: "y" } });
  expect(html).toContain('<script src="/folio-assistant/assets/js/docs-ui.js" defer');
  expect(html).toContain('href="/folio-assistant/assets/css/docs-ui.css"');
});

describe("the IG's TOC on its thin pages (owner, 2026-11-02: artifacts.html had no TOC in the rail)", () => {
  const nav = `<script type="application/json" data-fa-visualiser-nav>[{"label":"Home","href":"/ig/index.html"}]</script>`;
  const label = `<meta name="fa-visualiser-label" content="My IG">`;
  const thin = (id: string): string => `<!doctype html><html><head><title>x</title></head><body><main></main><script type="application/json" id="${id}">{}</script></body></html>`;
  test("thinPagesGetTocNav", () => {
    const site = mkdtempSync(join(dir, "toc-"));
    mkdirSync(join(site, "artifact"));
    mkdirSync(join(site, "docs"));
    writeFileSync(join(site, "index.html"), `<html><head>${label}\n${nav}</head><body><h1>Home</h1></body></html>`);
    writeFileSync(join(site, "artifacts.html"), thin("ig-index-page"));
    writeFileSync(join(site, "toc.html"), thin("ig-index-page"));
    writeFileSync(join(site, "api.html"), thin("ig-api-hub"));
    writeFileSync(join(site, "artifact", "Patient-x.html"), thin("ig-artifact-page"));
    const other = `<html><head></head><body><h2 id="a">A</h2><h2 id="b">B</h2></body></html>`;
    writeFileSync(join(site, "docs", "other.html"), other);
    expect(stampIgTocNav(site).pages).toBe(4);
    for (const f of ["artifacts.html", "toc.html", "api.html", "artifact/Patient-x.html"]) {
      const html = readFileSync(join(site, f), "utf-8");
      expect(html).toContain(nav);
      expect(html).toContain(label);
      expect(html.indexOf(nav)).toBeLessThan(html.indexOf("</head>"));
    }
    expect(readFileSync(join(site, "docs", "other.html"), "utf-8")).toBe(other);
    // Run twice, nothing doubles.
    expect(stampIgTocNav(site).pages).toBe(0);
  });
  test("noTocNothingStamped", () => {
    const site = mkdtempSync(join(dir, "toc-none-"));
    writeFileSync(join(site, "artifacts.html"), thin("ig-index-page"));
    expect(stampIgTocNav(site).pages).toBe(0);
  });
});

describe("libraryByUrl", () => {
  const lib = {
    resourceType: "Library",
    id: "IMMZLogic",
    name: "IMMZLogic",
    content: [
      { contentType: "text/cql", data: "bGlicmFyeQ==" },
      { contentType: "application/elm+xml", data: "PGxpYi8+" },
      { contentType: "application/elm+json", data: "e30=" },
    ],
  };

  test("cqlByUrlNoElm", () => {
    const cqlDir = join(dir, "cql-a");
    mkdirSync(cqlDir, { recursive: true });
    writeFileSync(join(cqlDir, "IMMZLogic.cql"), "library IMMZLogic");
    const out = libraryByUrl(lib, { dir: cqlDir, url: (f) => `https://kg.example/cql/${f}` }) as { content: unknown[] };
    expect(out.content).toEqual([{ contentType: "text/cql", url: "https://kg.example/cql/IMMZLogic.cql" }]);
  });

  test("cqlKeptWithoutSource", () => {
    const out = libraryByUrl(lib, { dir: join(dir, "no-cql"), url: (f) => f }) as { content: unknown[] };
    expect(out.content).toEqual([{ contentType: "text/cql", data: "bGlicmFyeQ==" }]);
  });

  test("otherResourcesUntouched", () => {
    expect(libraryByUrl({ resourceType: "ValueSet", id: "x" }, { dir, url: (f) => f })).toBeUndefined();
    expect(libraryByUrl({ resourceType: "Library", id: "y", content: [{ contentType: "text/cql", url: "u" }] }, { dir, url: (f) => f })).toBeUndefined();
  });

  test("urlFromRepositoryAndCommit", () => {
    const ig = join(dir, "ig-cql");
    mkdirSync(join(ig, "input/cql"), { recursive: true });
    const c = cqlSourceOf(ig, { SITE_REPOSITORY: "litlfred/smart-immunizations", SITE_COMMIT: "14517c8b" })!;
    expect(c.url("A B.cql")).toBe("https://raw.githubusercontent.com/litlfred/smart-immunizations/14517c8b/input/cql/A%20B.cql");
    expect(cqlSourceOf(ig, { SITE_REPOSITORY: "litlfred/smart-immunizations" })).toBeUndefined();
    expect(cqlSourceOf(join(dir, "no-ig"), { SITE_REPOSITORY: "a/b", SITE_COMMIT: "abcdef1" })).toBeUndefined();
  });
});

describe("the AST's resources by raw URL at the cache commit (fhir-harness#325)", () => {
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const recorded = (name: string, rec: unknown): string => {
    const work = join(dir, name);
    mkdirSync(work, { recursive: true });
    writeFileSync(join(work, AST_SOURCE_FILE), typeof rec === "string" ? rec : JSON.stringify(rec));
    return work;
  };

  test("rawBaseFromRecordedCommit", () => {
    expect(astRawBase(recorded("raw-https", { commit: sha, remote: "https://github.com/litlfred/smart-immunizations.git" }), {})).toBe(`https://raw.githubusercontent.com/litlfred/smart-immunizations/${sha}`);
    expect(astRawBase(recorded("raw-ssh", { commit: sha, remote: "git@github.com:litlfred/smart-immunizations" }), {})).toBe(`https://raw.githubusercontent.com/litlfred/smart-immunizations/${sha}`);
  });

  test("noRawBaseWithoutUsableRecord", () => {
    expect(astRawBase(undefined, {})).toBeUndefined();
    expect(astRawBase(join(dir, "raw-none"), {})).toBeUndefined();
    expect(astRawBase(recorded("raw-short", { commit: "0123abc", remote: "https://github.com/a/b" }), {})).toBeUndefined();
    expect(astRawBase(recorded("raw-gitlab", { commit: sha, remote: "https://gitlab.com/a/b" }), {})).toBeUndefined();
    expect(astRawBase(recorded("raw-bad", "{not json"), {})).toBeUndefined();
    expect(astRawBase(recorded("raw-off", { commit: sha, remote: "https://github.com/a/b" }), { SITE_AST_BY_URL: "0" })).toBeUndefined();
  });

  test("pagesPointAtRawUrl", () => {
    const a = { resourceType: "StructureDefinition", id: "IMMZ.Immunization", materialization: { state: "materialized", purpose: "compiled", localPath: "output-ast/resources/StructureDefinition/IMMZ.Immunization--88a5f2dd.json" } } as unknown as FhirArtifact;
    const base = `https://raw.githubusercontent.com/a/b/${sha}`;
    expect(isRemoteData(base)).toBe(true);
    expect(isRemoteData(".")).toBe(false);
    expect(localResourceHref(a, base)).toBe(`${base}/resources/StructureDefinition/IMMZ.Immunization--88a5f2dd.json`);
    expect(localResourceHref(a, ".")).toBe("../StructureDefinition-IMMZ.Immunization.json");
  });

  test("restoreRecordsCacheCommit", () => {
    const root = join(dir, "restore-record");
    const remote = join(root, "remote.git");
    const ig = join(root, "ig");
    const git = (cwd: string, ...a: string[]): string => {
      const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "init.defaultBranch=main", ...a], { cwd, encoding: "utf-8" });
      if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
      return r.stdout.trim();
    };
    mkdirSync(root, { recursive: true });
    git(root, "init", "-q", "--bare", remote);
    // The cache branch: the AST at the root of the tree, as `seed` writes it.
    const cache = fakeAst(root, [{ resourceType: "ValueSet", id: "x" }]);
    git(cache, "init", "-q");
    git(cache, "add", ".");
    git(cache, "commit", "-qm", "ast");
    const commit = git(cache, "rev-parse", "HEAD");
    git(cache, "push", "-q", remote, "HEAD:refs/heads/cat/fhir-harness/fhir-ast/ex.ig");
    mkdirSync(ig, { recursive: true });
    writeFileSync(join(ig, "sushi-config.yaml"), "id: ex.ig\n");
    git(ig, "init", "-q");
    git(ig, "remote", "add", "origin", remote);
    const record = join(root, "work", AST_SOURCE_FILE);
    mkdirSync(join(root, "work"), { recursive: true });
    const r = spawnSync("bash", [join(import.meta.dir, "ig-cache.sh"), "restore", "--ig-root", ig, "--record", record], { cwd: ig, encoding: "utf-8" });
    expect(r.status).toBe(0);
    expect(JSON.parse(readFileSync(record, "utf-8"))).toEqual({ commit, remote });
    expect(existsSync(join(ig, "output-ast", "manifest.json"))).toBe(true);
    // An AST already present that is the tip's is recorded too; a changed one is not.
    rmSync(record);
    const again = () => spawnSync("bash", [join(import.meta.dir, "ig-cache.sh"), "restore", "--ig-root", ig, "--record", record], { cwd: ig, encoding: "utf-8" });
    expect(again().status).toBe(0);
    expect(JSON.parse(readFileSync(record, "utf-8"))).toEqual({ commit, remote });
    rmSync(record);
    writeFileSync(join(ig, "output-ast", "manifest.json"), "{}");
    expect(again().status).toBe(0);
    expect(existsSync(record)).toBe(false);
  });

  test("pagesReadTheSiteWorkRecord", () => {
    // compose has a scratch work directory of its own; the record is in the SITE build's.
    const root = join(dir, "pages-by-url");
    mkdirSync(root, { recursive: true });
    // A valid AST manifest, as the cache holds it.
    const ast = join(root, "output-ast");
    mkdirSync(join(ast, "resources", "ValueSet"), { recursive: true });
    writeFileSync(join(ast, "resources", "ValueSet", "x--0000.json"), JSON.stringify({ resourceType: "ValueSet", id: "x", url: "http://ex/ValueSet/x", name: "X" }));
    writeFileSync(
      join(ast, "manifest.json"),
      JSON.stringify({ $schema: "ig-ast/v1", authority: "cache", provisional: [], inputs: { toolchain: "t", sourceRevision: "a".repeat(40) }, resources: [{ key: "http://ex/ValueSet/x|", canonical: "http://ex/ValueSet/x", version: null, resourceType: "ValueSet", id: "x", name: "X", file: "resources/ValueSet/x--0000.json", source: null }] }),
    );
    writeFileSync(join(ast, "dependencies.json"), JSON.stringify({ $schema: "ig-ast-dependencies/v1", authority: "cache", dependencies: [] }));
    writeFileSync(join(root, "sushi-config.yaml"), "id: ex.ig\ntitle: Ex\n");
    const siteWork = recorded("pages-by-url-site", { commit: sha, remote: "https://github.com/a/b" });
    const work = join(root, "scratch");
    mkdirSync(work, { recursive: true });
    const said: string[] = [];
    const inst = astArtefactPages({ ig: root, ast, work, siteWork, name: "ex", label: "Ex", log: (s) => said.push(s) });
    expect(said.join("\n")).toContain(`read from https://raw.githubusercontent.com/a/b/${sha}`);
    const node = readFileSync(join(inst, "docs", "artifact", "ValueSet-x.jsonld"), "utf-8");
    expect(node).toContain(`https://raw.githubusercontent.com/a/b/${sha}/resources/ValueSet/x--0000.json`);
  });

  test("byUrlServesReducedRootCopy", () => {
    const root = join(dir, "serve-by-url");
    const ast = fakeAst(root, [{ resourceType: "ValueSet", id: "x" }]);
    writeFileSync(join(ast, "resources/ValueSet/x--0000.json"), JSON.stringify({ resourceType: "ValueSet", id: "x", text: { status: "generated", div: "<div>x</div>" }, url: "http://ex/ValueSet/x" }, null, 2));
    const work = recorded("serve-by-url-work", { commit: sha, remote: "https://github.com/a/b" });
    mkdirSync(join(work, INDEX_WORK), { recursive: true });
    writeFileSync(join(work, INDEX_WORK, "index.json"), "{}");
    const site = join(root, "_site");
    mkdirSync(site, { recursive: true });
    const said: string[] = [];
    const r = publisherPages({ site, ast, work, log: (s) => said.push(s) });
    expect(r.named).toBe(1);
    expect(r.reduced).toBe(true);
    expect(r.index).toBe(true);
    // FHIR's convention, the Publisher's name, at the root: minified and without the narrative.
    expect(readFileSync(join(site, "ValueSet-x.json"), "utf-8")).toBe('{"resourceType":"ValueSet","id":"x","url":"http://ex/ValueSet/x"}');
    expect(said.join("\n")).toContain(`raw.githubusercontent.com/a/b/${sha}`);
    expect(said.join("\n")).toContain("1 reduced resource(s) as <Type>-<id>.json at the root");
  });

  test("rootResourcesOffServesNoRootCopy", () => {
    expect(rootResourcesFromEnv({})).toBe(true);
    expect(rootResourcesFromEnv({ SITE_ROOT_RESOURCES: "1" })).toBe(true);
    expect(rootResourcesFromEnv({ SITE_ROOT_RESOURCES: "0" })).toBe(false);
    const root = join(dir, "serve-root-off");
    const ast = fakeAst(root, [{ resourceType: "ValueSet", id: "x" }]);
    const site = join(root, "_site");
    mkdirSync(site, { recursive: true });
    expect(serveAstData({ site, ast, byUrl: true, rootResources: false }).named).toBe(0);
    expect(existsSync(join(site, "ValueSet-x.json"))).toBe(false);
    // Without a cache commit to read by URL, the root copy is the pages' own: served whole, whatever the switch says.
    expect(serveAstData({ site, ast, rootResources: false }).named).toBe(1);
    expect(readFileSync(join(site, "ValueSet-x.json"), "utf-8")).toBe(JSON.stringify({ resourceType: "ValueSet", id: "x" }));
  });

  test("rootNameFromTheResourceNotTheFile", () => {
    const root = join(dir, "serve-root-name");
    const ast = join(root, "output-ast");
    mkdirSync(join(ast, "resources", "ValueSet"), { recursive: true });
    // The cache file name may change (fhir-ig-publisher#13): `<id>.json`, or a hash; the resource says what it is.
    writeFileSync(join(ast, "resources/ValueSet/whatever.json"), JSON.stringify({ resourceType: "ValueSet", id: "Real-Id" }));
    writeFileSync(join(ast, "manifest.json"), JSON.stringify({ resources: [{ file: "resources/ValueSet/whatever.json" }] }));
    const site = join(root, "_site");
    mkdirSync(site, { recursive: true });
    expect(serveAstData({ site, ast, byUrl: true }).named).toBe(1);
    expect(existsSync(join(site, "ValueSet-Real-Id.json"))).toBe(true);
  });

  test("caseOnlyCollisionWarned", () => {
    const root = join(dir, "serve-root-case");
    const ast = fakeAst(root, [{ resourceType: "ValueSet", id: "abc" }, { resourceType: "ValueSet", id: "ABC" }]);
    const site = join(root, "_site");
    mkdirSync(site, { recursive: true });
    const said: string[] = [];
    const r = serveAstData({ site, ast, byUrl: true, warn: (s) => said.push(s) });
    expect(r.caseCollisions).toEqual(["ValueSet-abc.json / ValueSet-ABC.json"]);
    expect(said.join("\n")).toContain("differ only by case");
  });

  test("reducedLibraryKeepsCqlPointsElmAtFullCopy", () => {
    const full = `https://raw.githubusercontent.com/a/b/${sha}/resources/Library/L--1.json`;
    const lib = {
      resourceType: "Library",
      id: "L",
      text: { status: "generated", div: "<div/>" },
      contained: [{ resourceType: "Parameters", id: "p", text: { status: "generated", div: "<div/>" } }],
      content: [
        { contentType: "text/cql", data: "Y3Fs" },
        { contentType: "application/elm+xml", data: "eG1s" },
        { contentType: "application/elm+json", data: "anNvbg==" },
      ],
    };
    expect(reduceForSite(lib, full)).toEqual({
      resourceType: "Library",
      id: "L",
      contained: [{ resourceType: "Parameters", id: "p" }],
      content: [
        { contentType: "text/cql", url: full },
        { contentType: "application/elm+xml", url: full },
        { contentType: "application/elm+json", url: full },
      ],
    });
    // The CQL links to the IG's own .cql source when there is one.
    const cqlUrl = "https://raw.githubusercontent.com/o/r/abc1234/input/cql/L.cql";
    expect((reduceForSite(lib, full, cqlUrl) as { content: unknown[] }).content[0]).toEqual({ contentType: "text/cql", url: cqlUrl });
    // No full copy to point at: the ELM's data is still left out, the entry kept, and the CQL stays inline.
    expect((reduceForSite(lib) as { content: unknown[] }).content[1]).toEqual({ contentType: "application/elm+xml" });
    expect((reduceForSite(lib) as { content: unknown[] }).content[0]).toEqual({ contentType: "text/cql", data: "Y3Fs" });
    // The input is not changed.
    expect(lib.content[1]!.data).toBe("eG1s");
  });
});

test("redirectStubsLeftBare", () => {
  expect(isRedirectStub('<head><meta http-equiv="refresh" content="0; url=X.html?view=json"></head>')).toBe(true);
  expect(isRedirectStub('<head><meta http-equiv="refresh" content="30"></head><body>x</body>')).toBe(false);
  expect(isRedirectStub("<html><body>page</body></html>")).toBe(false);
});

describe("another IG layer's artefact index is not copied into this IG's site (owner, 2026-11-10)", () => {
  const entry = (name: string, instanceDir: string, path: string, extra: Record<string, unknown> = {}) =>
    ({ name, instanceDir, entry: { path, ...extra }, abs: join(instanceDir, path) }) as unknown as ResolvedEntry;

  test("foreignIndexesAreTheOtherLayersServedIndexes", () => {
    const root = join(dir, "foreign-ix");
    const entries = [
      entry("base-ig", join(root, "base-ig"), "fhir-artifact-index/", { served: true, graphTypologies: ["fhir-artifact-index"] }),
      entry("base-ig", join(root, "base-ig"), "openapi/", { served: true, graphTypologies: ["openapi"] }),
      entry("other-ig", join(root, "other-ig"), "fhir-artifact-index/", { graphTypologies: ["fhir-artifact-index"] }),
      entry("this-ig", root, "fhir-artifact-index/", { served: true, graphTypologies: ["fhir-artifact-index"] }),
    ];
    expect(foreignArtefactIndexes(root, entries).map((s) => s.route)).toEqual(["base-ig/fhir-artifact-index"]);
  });

  test("dropForeignIndexesRemovesOnlyThoseRoutes", () => {
    const root = join(dir, "foreign-drop");
    const site = join(root, "_site");
    mkdirSync(join(site, "base-ig", "fhir-artifact-index", "sidecars"), { recursive: true });
    writeFileSync(join(site, "base-ig", "fhir-artifact-index", "index.json"), "{}");
    writeFileSync(join(site, "base-ig", "fhir-artifact-index", "sidecars", "a.schema.json"), "{\"x\":1}");
    mkdirSync(join(site, "base-ig", "l1-extraction"), { recursive: true });
    mkdirSync(join(site, "fhir-artifact-index"), { recursive: true });
    writeFileSync(join(site, "fhir-artifact-index", "index.json"), "{}");
    const entries = [entry("base-ig", join(root, "base-ig"), "fhir-artifact-index/", { served: true, graphTypologies: ["fhir-artifact-index"] })];
    expect(dropForeignIndexes(site, root, entries)).toEqual([{ route: "base-ig/fhir-artifact-index", bytes: 9 }]);
    expect(existsSync(join(site, "base-ig", "fhir-artifact-index"))).toBe(false);
    expect(existsSync(join(site, "base-ig", "l1-extraction"))).toBe(true);
    expect(existsSync(join(site, "fhir-artifact-index", "index.json"))).toBe(true);
    expect(dropForeignIndexes(site, root, entries)).toEqual([]);
  });
});

describe('the IG API read from the AST cache commit (owner, 2026-11-10, card "A")', () => {
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const raw = `https://raw.githubusercontent.com/o/ig/${sha}`;
  /** A work directory where `ast` recorded the cache commit, an AST whose cache holds an IG API, and the step's own output. */
  const setup = (name: string, cached: boolean) => {
    const root = join(dir, name);
    const ast = fakeAst(root, [{ resourceType: "ValueSet", id: "x" }]);
    const work = join(root, "work");
    mkdirSync(join(work, IG_API_WORK, "sidecars"), { recursive: true });
    writeFileSync(join(work, AST_SOURCE_FILE), JSON.stringify({ commit: sha, remote: "https://github.com/o/ig.git" }));
    writeFileSync(join(work, IG_API_WORK, "sidecars", "ValueSet-x.schema.json"), "{}");
    if (cached) {
      const c = join(ast, IG_API_WORK);
      mkdirSync(join(c, "sidecars"), { recursive: true });
      mkdirSync(join(c, IG_API_SITE, "openapi"), { recursive: true });
      writeFileSync(join(c, "sidecars", "ValueSet-x.schema.json"), "{}");
      writeFileSync(join(c, "sidecars", "ValueSet-x.openapi.json"), "{}");
      writeFileSync(join(c, IG_API_SITE, "ValueSets.schema.json"), "{}");
      writeFileSync(join(c, IG_API_SITE, SWAGGER_PAGE), `<script>var swaggerUrls = [{"url": "../ValueSet-x.openapi.json"}]; url: "../ValueSet-x.openapi.json"</script>`);
      writeFileSync(join(c, IG_API_DESCRIPTOR), JSON.stringify({ label: "My API" }));
    }
    return { root, ast, work };
  };

  test("cachedIgApiReadByRawUrl", () => {
    const { ast, work } = setup("api-cached", true);
    expect(siteIgApi(work, ast, {})).toEqual({ sidecars: join(ast, IG_API_WORK, "sidecars"), files: 2, label: "My API", site: join(ast, IG_API_WORK, IG_API_SITE), rawBase: `${raw}/${IG_API_WORK}` });
  });

  test("olderCacheFallsBackToTheStepsOutput", () => {
    const { ast, work } = setup("api-old-cache", false);
    expect(siteIgApi(work, ast, {})).toEqual({ sidecars: join(work, IG_API_WORK, "sidecars"), files: 1 });
    // No recorded commit (or by-URL off): the step's output, even when the cache holds one.
    const c = setup("api-off", true);
    expect(siteIgApi(c.work, c.ast, { SITE_AST_BY_URL: "0" })?.rawBase).toBeUndefined();
  });

  test("byUrlServesNoSidecarAndRebasesSwagger", () => {
    const { root, ast } = setup("api-serve", true);
    const site = join(root, "_site");
    mkdirSync(site, { recursive: true });
    const igApi = { ...readIgApiDir(join(ast, IG_API_WORK))!, rawBase: `${raw}/${IG_API_WORK}` };
    const r = serveAstData({ site, ast, igApi, byUrl: true });
    expect(r.sidecars).toBe(0);
    expect(r.siteFiles).toBe(1);
    expect(existsSync(join(site, SIDECARS_SERVED))).toBe(false);
    expect(existsSync(join(site, "ValueSets.schema.json"))).toBe(false);
    const page = readFileSync(join(site, SWAGGER_PAGE), "utf-8");
    expect(page).toContain(`"url": "${raw}/ig-api/sidecars/ValueSet-x.openapi.json"`);
    expect(page).not.toContain('"../ValueSet-x.openapi.json"');
  });

  test("localSwaggerSpecsPointAtTheServedSidecars", () => {
    const html = `{"url": "../A.openapi.json"}, {"url": "../B.openapi.json"}, url: "../A.openapi.json"`;
    expect(rebaseSwaggerSpecs(html, new Set(["A.openapi.json"]), (f) => `../${SIDECARS_SERVED}/${f}`)).toBe(
      `{"url": "../fhir-artifact-index/sidecars/A.openapi.json"}, {"url": "../B.openapi.json"}, url: "../fhir-artifact-index/sidecars/A.openapi.json"`,
    );
  });
});

describe('the artefact index read from the AST cache commit (owner, 2026-11-10, card "A")', () => {
  const sha = "0123456789abcdef0123456789abcdef01234567";
  const raw = `https://raw.githubusercontent.com/o/ig/${sha}`;

  test("cachedIndexNotServedPointerIs", () => {
    const root = join(dir, "index-cached");
    const ast = fakeAst(root, [{ resourceType: "ValueSet", id: "x" }]);
    const site = join(root, "_site");
    mkdirSync(site, { recursive: true });
    const index = join(root, "index.json");
    writeFileSync(index, "{}");
    const r = serveAstData({ site, ast, index, byUrl: true, indexRef: indexRef({ raw, repository: "o/ig", commit: sha }) });
    expect(r.index).toBe(false);
    expect(existsSync(join(site, INDEX_CACHED))).toBe(false);
    expect(JSON.parse(readFileSync(join(site, "fhir-artifact-index", INDEX_REF_FILE), "utf-8"))).toEqual({
      $schema: "fhir-artifact-index-ref/v1",
      index: `${raw}/fhir-artifact-index/index.json`,
      base: `${raw}/`,
      repository: "o/ig",
      commit: sha,
    });
  });

  test("olderCacheServesTheIndexAndPointsAtIt", () => {
    const root = join(dir, "index-local");
    const ast = fakeAst(root, [{ resourceType: "ValueSet", id: "x" }]);
    const site = join(root, "_site");
    mkdirSync(site, { recursive: true });
    const index = join(root, "index.json");
    writeFileSync(index, "{}");
    expect(serveAstData({ site, ast, index, indexRef: indexRef({}) }).index).toBe(true);
    expect(existsSync(join(site, INDEX_CACHED))).toBe(true);
    expect(JSON.parse(readFileSync(join(site, "fhir-artifact-index", INDEX_REF_FILE), "utf-8")).index).toBe("index.json");
  });

  test("publisherPagesReadsTheCacheCopy", () => {
    const root = join(dir, "index-pages");
    const ast = fakeAst(root, [{ resourceType: "ValueSet", id: "x" }]);
    mkdirSync(join(ast, "fhir-artifact-index"), { recursive: true });
    writeFileSync(join(ast, INDEX_CACHED), "{}");
    const work = join(root, "work");
    mkdirSync(join(work, INDEX_WORK), { recursive: true });
    writeFileSync(join(work, INDEX_WORK, "index.json"), "{}");
    writeFileSync(join(work, AST_SOURCE_FILE), JSON.stringify({ commit: sha, remote: "https://github.com/o/ig.git" }));
    const site = join(root, "_site");
    mkdirSync(site, { recursive: true });
    const said: string[] = [];
    expect(publisherPages({ site, ast, work, log: (s) => said.push(s) }).index).toBe(false);
    expect(existsSync(join(site, INDEX_CACHED))).toBe(false);
    expect(said.join("\n")).toContain(`${raw}/fhir-artifact-index/index.json`);
  });

  test("locateFollowsThePointerElseTheOldPath", async () => {
    const site = "https://o.github.io/ig";
    expect(await locateArtefactIndex(site, async () => ({ $schema: "fhir-artifact-index-ref/v1", index: `${raw}/fhir-artifact-index/index.json` }))).toBe(`${raw}/fhir-artifact-index/index.json`);
    expect(await locateArtefactIndex(`${site}/`, async () => ({ $schema: "fhir-artifact-index-ref/v1", index: "index.json" }))).toBe(`${site}/fhir-artifact-index/index.json`);
    expect(
      await locateArtefactIndex(site, async () => {
        throw new Error("404");
      }),
    ).toBe(`${site}/fhir-artifact-index/index.json`);
  });
});
