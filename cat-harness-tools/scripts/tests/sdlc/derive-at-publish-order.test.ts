/**
 * The order `derive:publish` runs the declared publish-time writers in (owner,
 * 2026-10-15, "A1"): lowest layer first, each layer's entries in their
 * declared order, a shared writer once, and a writer that DECLARES it reads a
 * kind of directory (`reads`) after the writers of other layers' entries
 * that fill one. A cycle is refused.
 *
 * The case that failed (2026-10-15): cat-harness's `docs/_data/harness.json`
 * (`docs:harness`) links smart-trust as a folio, with a rail scope, only when
 * `smart-trust/docs/` exists, and that directory is smart-trust's own
 * publish-time artefact (`smart-trust:pages`). Lowest-first wrote the tiles
 * before the directory, so `foreign-site-scope.test.ts` (a) and
 * `viewer-undiscovered.test.ts`'s smart-trust tile went red. The fixture
 * mirrors it: `a-platform` stands at the bottom and reads `docs`, `b-ig` stands
 * on top and fills a `docs` directory at publish.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { declaredPlan, enclosingKinds, writerEdges, writersOf, writingOrder, type DeclaredArtefact } from "../../derive-at-publish.ts";

let tmp: string;

// declared-path-literal: a fixture layer's own builtAtPublish entry, written into a temp tree, not a path of this checkout
const PLATFORM_DATA = "docs/_data/harness.json";

type Entry = { path: string; writer: string[]; because: "checkout" | "state"; reads?: string[]; directory?: string };

function instance(name: string, needs: string[], builtAtPublish: Entry[], directories: unknown[] = []): void {
  const p = join(tmp, name, `${name}.json`);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ name, needs, directories, builtAtPublish: builtAtPublish.map((e) => ({ ...e, reason: "fixture" })) }));
}

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "derive-order-"));
  // `a-platform` stands below the others, as cat-harness stands below smart-trust.
  instance("a-platform", [], [
    { path: PLATFORM_DATA, writer: ["platform:pages", "platform:harness"], because: "checkout", reads: ["docs"] },
    { path: "docs/_includes/navbar.html", writer: ["platform:navbar"], because: "checkout" },
    { path: "docs/other/", writer: ["platform:other"], because: "checkout" },
  ]);
  instance(
    "b-ig",
    ["c-base"],
    [
      // declared-path-literal: the test's subject is this published context path itself, written as consumers see it.
      { path: "ns/context/v1.jsonld", writer: ["shared:contexts"], because: "checkout" },
      { path: "docs/", writer: ["ig:pages"], because: "checkout", directory: "b-ig-docs" },
    ],
    [{ id: "b-ig-docs", path: "docs/", graphTypologies: ["docs", "ig-pages"] }],
  );
  // declared-path-literal: the same published context path, declared by the fixture base layer.
  instance("c-base", ["a-platform"], [{ path: "ns/context/v1.jsonld", writer: ["shared:contexts"], because: "checkout" }]);
});

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("the base order is lowest layer first", () => {
  test("every instance comes after each instance it needs", () => {
    const order = writingOrder(tmp);
    expect(order.indexOf("a-platform")).toBeLessThan(order.indexOf("c-base"));
    expect(order.indexOf("c-base")).toBeLessThan(order.indexOf("b-ig"));
  });

  test("an entry carries the kinds it reads, and the kinds of the directory it fills", () => {
    const plan = declaredPlan(tmp);
    expect(plan.find((a) => a.path === PLATFORM_DATA)?.reads).toEqual(["docs"]);
    expect(plan.find((a) => a.instance === "b-ig" && a.path === "docs/")?.fills).toEqual(["docs", "ig-pages"]);
  });
});

describe("a declared read edge orders the reader after what it reads", () => {
  test("the IG's pages are written before the platform data that reads whether they exist", () => {
    const writers = writersOf(declaredPlan(tmp));
    expect(writers.indexOf("ig:pages")).toBeLessThan(writers.indexOf("platform:pages"));
    expect(writers.indexOf("ig:pages")).toBeLessThan(writers.indexOf("platform:harness"));
  });

  test("the edge is named, with the entries it comes from", () => {
    const edge = writerEdges(declaredPlan(tmp)).find((e) => e.before === "ig:pages" && e.after === "platform:harness");
    expect(edge?.why).toBe("a-platform/docs/_data/harness.json reads docs, which b-ig/docs/ fills");
  });

  test("an instance's own declared order holds behind a moved writer, and a shared writer runs once", () => {
    // `platform:navbar` renders what `platform:harness` writes: it must not
    // overtake it when the read edge holds `platform:harness` back.
    expect(writersOf(declaredPlan(tmp))).toEqual(["shared:contexts", "ig:pages", "platform:pages", "platform:harness", "platform:navbar", "platform:other"]);
  });

  test("without the declared edge the base order stands: lowest first, no guess at a read", () => {
    const plan = declaredPlan(tmp).map(({ reads: _r, ...a }) => a);
    expect(writersOf(plan)).toEqual(["platform:pages", "platform:harness", "platform:navbar", "platform:other", "shared:contexts", "ig:pages"]);
  });

  test("a reader is not ordered after its own instance's entries by `reads`", () => {
    const own: DeclaredArtefact[] = [
      { instance: "x", abs: "/x/a", path: "a", writer: ["x:reader"], because: "checkout", reads: ["docs"] },
      { instance: "x", abs: "/x/docs/", path: "docs/", writer: ["x:docs"], because: "checkout", fills: ["docs"] },
    ];
    expect(writerEdges(own).filter((e) => e.why.includes("reads"))).toEqual([]);
    expect(writersOf(own)).toEqual(["x:reader", "x:docs"]);
  });
});

describe("a cycle is refused", () => {
  test("two instances that each read what the other builds have no right order", () => {
    const plan: DeclaredArtefact[] = [
      { instance: "low", abs: "/low/d/", path: "d/", writer: ["low:tiles"], because: "checkout", reads: ["docs"], fills: ["listing"] },
      { instance: "high", abs: "/high/docs/", path: "docs/", writer: ["high:pages"], because: "checkout", reads: ["listing"], fills: ["docs"] },
    ];
    expect(() => writersOf(plan)).toThrow(/cycle among low:tiles, high:pages/);
  });

  test("an instance's declared order contradicting a read edge is a cycle too", () => {
    const plan: DeclaredArtefact[] = [
      { instance: "high", abs: "/high/docs/", path: "docs/", writer: ["shared:gen", "high:pages"], because: "checkout", fills: ["docs"] },
      { instance: "low", abs: "/low/x", path: "x", writer: ["shared:gen"], because: "checkout", reads: ["docs"] },
    ];
    expect(() => writersOf(plan)).toThrow(/high lists shared:gen before high:pages/);
  });
});

/**
 * folio-assistant#2953 (2026-11-08): an IG layer declares its artefact index as
 * a directory of kind `fhir-artifact-index`, but the `builtAtPublish` entries
 * that `ig-index:build` writes into it (`fhir-artifact-index/index.json`, ...)
 * name no `directory`. So they filled no kind, nothing could be ordered after
 * them, and `uml:overview` (which draws every declared directory) ran beside
 * `ig-index:build` and read a sidecar while it was being rewritten (ENOENT).
 * An entry that names no `directory` now fills the kinds of the declared
 * directory that holds it.
 */
describe("an entry fills the kinds of the declared directory that holds it", () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "derive-enclosing-"));
    const write = (name: string, needs: string[], builtAtPublish: Entry[], directories: unknown[] = []): void => {
      const p = join(root, name, `${name}.json`);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify({ name, needs, directories, builtAtPublish: builtAtPublish.map((e) => ({ ...e, reason: "fixture" })) }));
    };
    write("platform", [], [
      { path: "uml/overview/", writer: ["platform:handler", "platform:uml"], because: "checkout", reads: ["fhir-artifact-index"] },
    ]);
    write(
      "ig",
      ["platform"],
      [{ path: "fhir-artifact-index/index.json", writer: ["ig:index"], because: "checkout" }],
      [{ id: "ig-artifact-index", path: "fhir-artifact-index/", graphTypologies: ["fhir-artifact-index"] }],
    );
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  test("an index file inside the declared index directory fills its kind", () => {
    expect(declaredPlan(root).find((a) => a.instance === "ig")?.fills).toEqual(["fhir-artifact-index"]);
  });

  test("the reader of that kind runs after the index's writer, though it stands in a lower layer", () => {
    const writers = writersOf(declaredPlan(root));
    expect(writers.indexOf("ig:index")).toBeLessThan(writers.indexOf("platform:uml"));
    expect(writers.indexOf("platform:handler")).toBeLessThan(writers.indexOf("platform:uml"));
  });

  test("the deepest declared directory wins; a path outside every one fills nothing; an explicit `directory` is unchanged", () => {
    const dirs = [
      { path: "docs/", graphTypologies: ["docs"] },
      { path: "docs/api/", kinds: ["api"] },
      { path: "fhir-artifact-index", graphTypologies: ["fhir-artifact-index"] },
    ];
    expect(enclosingKinds(dirs, "docs/api/x.json")).toEqual(["api"]);
    expect(enclosingKinds(dirs, "docs/")).toEqual(["docs"]);
    expect(enclosingKinds(dirs, "./fhir-artifact-index/menu.json")).toEqual(["fhir-artifact-index"]);
    expect(enclosingKinds(dirs, "fhir-artifact-indexes/x.json")).toEqual([]);
    expect(enclosingKinds(dirs, "elsewhere/outside.json")).toEqual([]);
    expect(declaredPlan(tmp).find((a) => a.instance === "b-ig" && a.path === "docs/")?.fills).toEqual(["docs", "ig-pages"]);
  });
});
