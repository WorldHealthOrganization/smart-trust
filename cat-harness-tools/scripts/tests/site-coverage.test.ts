/**
 * `site-coverage.ts`: a built site carries every declared visualiser page of
 * its checkout (owner, 2026-10-15: smart-ra was published without
 * `en/cat-harness/library/`, and nothing noticed).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expectedPages, igIndexSubjects, owedOnScopedSite, INDEX_PAGE_NEEDS_SUBJECTS, legacyOnlyPages, instanceSubgraph, missingPages, SUBJECT_READERS, subjectInstances, webAppSubjects, type ExpectedPage } from "../site-coverage.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.ts";

const page = (route: string, legacyRoute: string): ExpectedPage => ({ route, legacyRoute, harness: "h", visualiser: "v" });

describe("missingPages", () => {
  const expected = [page("en/h/v/", "h/v/"), page("en/h/w/", "h/w/"), page("en/h/x/", "h/x/")];
  const site = new Set(["en/h/v/index.html", "h/w/index.md"]);
  const has = (p: string): boolean => site.has(p);

  test("a page at its localised route, or a Jekyll source there, is present", () => {
    expect(missingPages([page("en/h/v/", "h/v/")], has)).toEqual([]);
  });

  test("a page only at its old address is not missing, and is counted as legacy", () => {
    expect(missingPages([expected[1]!], has)).toEqual([]);
    expect(legacyOnlyPages(expected, has).map((p) => p.legacyRoute)).toEqual(["h/w/"]);
  });

  test("a page at neither address is missing", () => {
    expect(missingPages(expected, has).map((p) => p.route)).toEqual(["en/h/x/"]);
  });
  test("on the instance's own site, its page at the site's own root is present (who-iris catalogue, 2026-10-15)", () => {
    const own: ExpectedPage = { ...page("en/h/x/", "h/x/"), ownSiteRoute: "x/" };
    expect(missingPages([own], (p) => p === "x/index.html")).toEqual([]);
    // ...and only there: another harness's page at the root does not count.
    expect(missingPages([page("en/h/x/", "h/x/")], (p) => p === "x/index.html")).toHaveLength(1);
  });
});

describe("expectedPages over this checkout", () => {
  const root = repoRootFor(HARNESS_ROOT);
  const pages = expectedPages(root);

  test("expects the library index and a page per instance whose library has entries", () => {
    const library = pages.filter((p) => p.visualiser === "library");
    expect(library.some((p) => p.instance === undefined && p.route.endsWith("/library/"))).toBe(true);
    for (const p of library.filter((x) => x.instance !== undefined)) expect(p.route).toMatch(new RegExp(`/library/${p.instance}/$`));
  });

  test("a staging-only visualiser is expected in a preview, never on a root publish", () => {
    const staging = expectedPages(root, { staging: true });
    const onlyInPreview = staging.filter((s) => !pages.some((p) => p.route === s.route));
    expect(onlyInPreview.every((p) => p.harness !== undefined)).toBe(true);
    expect(staging.length).toBeGreaterThanOrEqual(pages.length);
  });

  test("a scoped site owes no page of a layer outside its scope (owner, 2026-11-10)", () => {
    const scoped = expectedPages(root, { scope: ["no-such-instance"] });
    expect(pages.length).toBeGreaterThan(0);
    expect(scoped).toEqual([]);
    const own = expectedPages(root, { scope: ["cat-harness"] });
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((p) => p.harness === "cat-harness" || p.instance === "cat-harness")).toBe(true);
  });
});

describe("subjectInstances: the guard asks the writer's own reader which instances have a page", () => {
  // smart-immunizations, 2026-10-15: smart-base's `tools` declaration reached
  // the IG's own `tools/` folder (FHIR scripts, sub-directories and all) as a
  // member. The tools writer draws a page per layer with Tool NODES, so it
  // drew none there, and the guard, counting folders, failed the build.
  const at = mkdtempSync(join(tmpdir(), "site-coverage-"));
  const igTools = join(at, "smart-immunizations", "tools");
  const harnessTools = join(at, "cat-harness", "tools");
  mkdirSync(join(igTools, "node"), { recursive: true });
  mkdirSync(join(harnessTools, "gates"), { recursive: true });
  const dirs = [
    { instance: "cat-harness", absPath: harnessTools },
    { instance: "smart-immunizations", absPath: igTools },
  ];

  test("a writer with a reader of its own decides: a folder of scripts is not a Tool", () => {
    const readers = { "tools-viewer": () => ["cat-harness", "smart-base", "cat-harness"] };
    expect(subjectInstances({ renderedBy: "tools-viewer" }, at, dirs, readers)).toEqual(["cat-harness", "smart-base"]);
  });

  test("a writer with none keeps the sub-directory test", () => {
    expect(subjectInstances({ renderedBy: "library-viewer" }, at, dirs, {})).toEqual(["cat-harness", "smart-immunizations"]);
  });

  test("a reader that throws falls back to the sub-directory test rather than expecting nothing", () => {
    const readers = { "tools-viewer": (): string[] => { throw new Error("a declared tools graph did not load"); } };
    expect(subjectInstances({ renderedBy: "tools-viewer" }, at, dirs, readers)).toEqual(["cat-harness", "smart-immunizations"]);
    rmSync(at, { recursive: true, force: true });
  });
});

describe("ig-pages: an IG's artefact pages are owed only where its index is built (smart-ra#103)", () => {
  test("the guard reads the ig-pages writer's subjects, and owes its index page only with one", () => {
    expect(SUBJECT_READERS["ig-pages"]).toBe(igIndexSubjects);
    expect(INDEX_PAGE_NEEDS_SUBJECTS.has("ig-pages")).toBe(true);
  });

  test("only an instance whose index.json is there is a subject; a README or retired sidecars are not", () => {
    const at = mkdtempSync(join(tmpdir(), "site-coverage-ig-"));
    const built = join(at, "smart-trust", "fhir-artifact-index");
    const unbuilt = join(at, "smart-base", "fhir-artifact-index");
    mkdirSync(built, { recursive: true });
    mkdirSync(join(unbuilt, "dak"), { recursive: true });
    writeFileSync(join(built, "index.json"), "{}");
    writeFileSync(join(unbuilt, "README.md"), "built at publish");
    const dirs = [{ instance: "smart-base", absPath: unbuilt }, { instance: "smart-trust", absPath: built }];
    expect(igIndexSubjects(at, dirs)).toEqual(["smart-trust"]);
    expect(subjectInstances({ renderedBy: "ig-pages" }, at, dirs)).toEqual(["smart-trust"]);
    expect(igIndexSubjects(at, [dirs[0]!])).toEqual([]);
    rmSync(at, { recursive: true, force: true });
  });

  test("a MOUNTED layer's index written to the layer output root makes it a subject (bean `cat-tools-sm8r` item 4)", () => {
    const at = mkdtempSync(join(tmpdir(), "site-coverage-ig-out-"));
    writeFileSync(join(at, "index.lock.json"), JSON.stringify({ instances: [{ instance: "some-ig", path: "some-ig" }] }));
    const pinned = join(at, "some-ig", "fhir-artifact-index");
    mkdirSync(pinned, { recursive: true });
    const dirs = [{ instance: "some-ig", absPath: pinned }];
    expect(igIndexSubjects(at, dirs)).toEqual([]);
    const out = join(at, "build", "layers", "some-ig", "fhir-artifact-index");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "index.json"), "{}");
    expect(igIndexSubjects(at, dirs)).toEqual(["some-ig"]);
    rmSync(at, { recursive: true, force: true });
  });
});

describe("web-app-build: a layer that carries an app owes the apps page on its own scoped site (smart-trust onboarding game)", () => {
  test("the guard reads the apps writer's subjects, and owes its index page only with one", () => {
    expect(SUBJECT_READERS["web-app-build"]).toBe(webAppSubjects);
    expect(INDEX_PAGE_NEEDS_SUBJECTS.has("web-app-build")).toBe(true);
  });

  test("only a directory holding web-app.json is a subject", () => {
    const at = mkdtempSync(join(tmpdir(), "site-coverage-web-app-"));
    const game = join(at, "smart-trust", "onboarding-game");
    const empty = join(at, "other", "apps");
    mkdirSync(join(game, "src"), { recursive: true });
    mkdirSync(join(empty, "src"), { recursive: true });
    writeFileSync(join(game, "web-app.json"), "{}");
    const dirs = [{ instance: "other", absPath: empty }, { instance: "smart-trust", absPath: game }];
    expect(webAppSubjects(at, dirs)).toEqual(["smart-trust"]);
    expect(subjectInstances({ renderedBy: "web-app-build" }, at, dirs)).toEqual(["smart-trust"]);
    expect(webAppSubjects(at, [dirs[0]!])).toEqual([]);
    rmSync(at, { recursive: true, force: true });
  });
});

describe("expectedPages over this checkout: tools", () => {
  test("expects a tools sub-graph page exactly for the instances the tools writer draws", async () => {
    const { toolSubjects } = await import("../gen-tools-viz.ts");
    const root = repoRootFor(HARNESS_ROOT);
    let drawn: string[];
    try {
      drawn = toolSubjects(root).subjects.map((s) => s.name).sort();
    } catch {
      return; // a sibling's tools graph does not load in this checkout: the fallback is pinned above
    }
    const expected = expectedPages(root).filter((p) => p.visualiser === "tools" && p.instance !== undefined).map((p) => p.instance!).sort();
    expect(expected).toEqual(drawn);
  });
});

describe("expectedPages over this checkout: schemas", () => {
  // smart-ips-pilgrimage#25's root publish (2026-11-07): smart-trust-tools'
  // `schemas/` holds only JSON contracts in `skills/`, the writer draws no page
  // for it, and the sub-directory test owed one, so the build refused.
  test("the guard reads the schemas writer's own subjects", async () => {
    const { schemaSubjects } = await import("../gen-schema-viz.ts");
    expect(SUBJECT_READERS["schemas-viewer"]).toBeDefined();
    const root = repoRootFor(HARNESS_ROOT);
    const drawn = schemaSubjects(root);
    expect(SUBJECT_READERS["schemas-viewer"]!(root, [])).toEqual(drawn);
    const pages = expectedPages(root).filter((p) => p.visualiser === "schemas");
    if (pages.length === 0) return; // no `schemas` visualiser declared in this checkout
    const expected = pages.filter((p) => p.instance !== undefined).map((p) => p.instance!).sort();
    expect(expected).toEqual(drawn);
  });
});

describe("instanceSubgraph: subgraphUnder nests the per-instance page, as the tiles and the writer do", () => {
  test("the glossary's per-instance page is at instance/<instance>/", () => {
    expect(instanceSubgraph("folio-assistant-core", [{ instance: "folio-assistant-core", under: "instance" }])).toBe("instance/folio-assistant-core");
  });
  test("a visualiser with no subgraphUnder keeps <instance>/", () => {
    expect(instanceSubgraph("smart-base", [{ instance: "smart-base" }, { instance: "who-iris", under: "instance" }])).toBe("smart-base");
  });
});

describe("owedOnScopedSite: a host-site visualiser is owed where a layer in scope holds its subjects", () => {
  // who-iris, 2026-11-15: core's bibliography is `subgraphs: "directory"` and
  // `builtOnHostSite`; who-iris's site is scoped to who-iris, so the page was
  // owed nowhere, never written, and the guard passed.
  const bib = { harness: "folio-assistant-core", builtOnHostSite: {} };
  const scope = new Set(["who-iris"]);
  test("owed when a layer in scope holds a covered directory with anything in it", () => {
    expect(owedOnScopedSite(bib, scope, [], [{ instance: "who-iris" }])).toBe(true);
  });
  test("not owed when only layers out of scope hold one", () => {
    expect(owedOnScopedSite(bib, scope, [], [{ instance: "smart-base" }])).toBe(false);
  });
  test("a visualiser not built on the host site keeps the old rule", () => {
    const plain = { harness: "folio-assistant-core" };
    expect(owedOnScopedSite(plain, scope, [], [{ instance: "who-iris" }])).toBe(false);
    expect(owedOnScopedSite(plain, scope, ["who-iris"], [])).toBe(true);
    expect(owedOnScopedSite(plain, new Set(["folio-assistant-core"]), [], [])).toBe(true);
  });
});
