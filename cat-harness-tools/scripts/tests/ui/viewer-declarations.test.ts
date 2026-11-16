/**
 * Which visualiser renders a directory is read from the HARNESS declarations
 * (owner, 2026-10-09), never from the pages.
 *
 * Two halves: provenance (`rendered-by`) on fixtures, and the reader —
 * `declaredVisualisers` / `viewersOf` — over a fixture checkout of two
 * layers, one declaring a corpus-wide visualiser over the other's
 * directory. The tests of this file that read the whole checkout live in
 * `cat-harness-tools/test/coordinator/viewer-declarations-checkout.test.ts`.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { DEFAULT_LOCALE, PUBLISHED_LOCALES } from "../../../schemas/content/translation.js";
import {
  builtAtPublishWriter,
  carriesRenders,
  clearDeclaredVisualisers,
  declaredPageRoute,
  declaredRoute,
  declaredVisualisers,
  existingPageDir,
  forwardingParts,
  PAGE_LOCALE,
  pageParts,
  renderedByOf,
  renderedPath,
  viewersOf,
  visualiserPageDir,
  visualiserSitePath,
  withRenderedBy,
  withRenderedByFrontMatter,
} from "../../viewer-declarations.js";
import { declarationFindings, pagePlacement } from "../../check-visualiser-routes.js";

describe("provenance: a page names the Tool that drew it, and nothing else", () => {
  test("HTML: inserted after <head>, replaced not duplicated, and any `renders` meta removed", () => {
    const legacy = '<html><head>\n<meta name="renders" content="a/b">\n<meta name="rendered-by" content="old"><title>t</title></head></html>';
    const once = withRenderedBy(legacy, "t");
    expect(renderedByOf(once)).toBe("t");
    expect(carriesRenders(once)).toBe(false);
    expect(withRenderedBy(once, "u").match(/name="rendered-by"/g)).toHaveLength(1);
  });

  test("markdown: into the front matter, `renders:` list removed", () => {
    const md = "---\ntitle: T\nrenders:\n  - a/b\nrendered-by: x\n---\nbody\n";
    expect(carriesRenders(md)).toBe(true);
    const out = withRenderedByFrontMatter(md, "t");
    expect(out).toBe("---\ntitle: T\nrendered-by: t\n---\nbody\n");
    expect(renderedByOf(out)).toBe("t");
    expect(carriesRenders(out)).toBe(false);
    expect(withRenderedByFrontMatter("no front matter", "t")).toBe("no front matter");
  });

  test("a directory is named repository-relative, with no trailing slash", () => {
    expect(renderedPath("/r", "/r/who-iris/library/")).toBe("who-iris/library");
  });
});

/** A checkout: `base` (the site owner, named cat-harness) declares visualisers; `top` needs it. */
function fixture(): string {
  const repo = mkdtempSync(join(tmpdir(), "viewer-decl-"));
  const files: Record<string, unknown> = {
    "base/cat-harness.json": {
      name: "cat-harness",
      directories: [
        { id: "library", path: "library/", graphTypologies: ["library"] },
        { id: "todos", path: "todos/", graphTypologies: ["todos"], tile: { icon: "todo" } },
      ],
      visualisers: [
        { id: "library", renderedBy: "library-viewer", coversKinds: ["library"], subgraphs: "instance" },
        { id: "todos", renderedBy: "state-viewer", covers: ["todos"], title: "Todos", alias: "todos" },
      ],
    },
    "top/top.json": {
      name: "top",
      needs: ["cat-harness"],
      directories: [{ id: "top-library", path: "library/", graphTypologies: ["library"] }],
    },
  };
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(join(repo, dirname(f)), { recursive: true });
    writeFileSync(join(repo, f), JSON.stringify(body));
  }
  for (const d of ["base/library", "base/todos", "top/library", "base/docs/cat-harness/library/top", "base/docs/cat-harness/todos"]) {
    mkdirSync(join(repo, d), { recursive: true });
  }
  writeFileSync(join(repo, "base/docs/cat-harness/library/top/index.html"), "<html><head></head></html>");
  writeFileSync(join(repo, "base/docs/cat-harness/todos/index.html"), "<html><head></head></html>");
  clearDeclaredVisualisers();
  return repo;
}

describe("the declaration is the only source of a visualiser and its route", () => {
  test("every instance's `visualisers`, with the harness that declares them", () => {
    const repo = fixture();
    const v = declaredVisualisers(repo);
    expect(v.map((x) => `${x.harness}/${x.id}:${x.renderedBy}`).sort()).toEqual([
      "cat-harness/library:library-viewer",
      "cat-harness/todos:state-viewer",
    ]);
    expect(declaredRoute(join(repo, "base"), "library-viewer")).toBe("cat-harness/library");
    expect(declaredRoute(join(repo, "base"), "no-such-tool")).toBeUndefined();
  });

  test("`covers`: the harness's own directory, at the full view", () => {
    const repo = fixture();
    const got = viewersOf({ id: "todos", path: "todos/", graphTypologies: ["todos"], tile: { icon: "todo" } }, join(repo, "base"), repo);
    expect(got.map((g) => g.ref)).toEqual(["base/docs/cat-harness/todos/index.html"]);
    expect(got[0]!.title).toBe("Todos");
    expect(got[0]!.icon).toBe("todo");
  });

  test("`coversKinds` + `subgraphs: instance`: another instance's directory opens its sub-graph view", () => {
    const repo = fixture();
    const got = viewersOf({ id: "top-library", path: "library/", graphTypologies: ["library"] }, join(repo, "top"), repo);
    expect(got.map((g) => g.ref)).toEqual(["base/docs/cat-harness/library/top/index.html"]);
  });

  test("`coversKinds` + `subgraphs: instance` + `writer`: a publish-time sub-graph view resolves before its writer runs (bean 8jur)", () => {
    const repo = fixture();
    writeFileSync(
      join(repo, "base/cat-harness.json"),
      JSON.stringify({
        name: "cat-harness",
        visualisers: [
          { id: "ig-ast", renderedBy: "ig-ast-pages", coversKinds: ["ig-ast"], subgraphs: "instance", writer: ["scripts/gen-ig-ast-pages.ts"] },
        ],
      }),
    );
    clearDeclaredVisualisers();
    const got = viewersOf({ id: "top-ast", path: "ast/", graphTypologies: ["ig-ast"] }, join(repo, "top"), repo);
    expect(got.map((g) => g.ref)).toEqual([`base/docs/${PAGE_LOCALE}/cat-harness/ig-ast/top/index.html`]);
    expect(got[0]?.writer).toEqual(["base/scripts/gen-ig-ast-pages.ts"]);
  });

  test("a directory nothing covers has no viewer — no page can claim one", () => {
    const repo = fixture();
    expect(viewersOf({ id: "x", path: "x/", graphTypologies: ["voices"] }, join(repo, "top"), repo)).toEqual([]);
  });
});

describe("collisions are declaration errors", () => {
  const v = (harness: string, id: string, alias?: string) => ({
    harness,
    harnessRoot: `/r/${harness}`,
    id,
    renderedBy: "t",
    covers: ["d"] as [string, ...string[]],
    ...(alias ? { alias } : {}),
  });

  test("two declarations of one route — the LOCALISED route (folio-assistant#2527)", () => {
    const f = declarationFindings([v("a", "x"), v("a", "x")], [], ["a"]);
    expect(f.map((x) => x.kind)).toEqual(["route-collision"]);
    expect(f[0]!.subject).toBe(`${PAGE_LOCALE}/a/x/`);
  });

  test("an alias may not take a published locale's top-level segment", () => {
    const f = declarationFindings([v("a", "x", PAGE_LOCALE)], [], ["a"]);
    expect(f.map((x) => `${x.kind}:${x.subject}`)).toEqual([`alias-collision:${PAGE_LOCALE}/`]);
    expect(f[0]!.detail).toContain(`locale ${PAGE_LOCALE}`);
  });

  test("an alias naming another alias, a harness, or something the site already carries", () => {
    const f = declarationFindings([v("a", "x", "x"), v("a", "y", "x"), v("a", "z", "b"), v("a", "w", "guides")], ["guides"], ["a", "b"]);
    expect(f.map((x) => `${x.kind}:${x.subject}`).sort()).toEqual([
      "alias-collision:b/",
      "alias-collision:guides/",
      "alias-collision:x/",
    ]);
  });

  test("distinct routes and free aliases are clean", () => {
    expect(declarationFindings([v("a", "x", "x"), v("b", "x")], ["guides"], ["a", "b"])).toEqual([]);
  });
});

describe("the locale goes in front of every visualiser page (folio-assistant#2527)", () => {
  test("the page locale is cat-harness's default, supplied in ONE place", () => {
    expect(PAGE_LOCALE).toBe(DEFAULT_LOCALE);
    expect(PUBLISHED_LOCALES as readonly string[]).toContain(PAGE_LOCALE);
    expect(pageParts({ harness: "h", visualiser: "v" })).toEqual({ harness: "h", visualiser: "v", locale: PAGE_LOCALE });
    // A locale the caller names is kept, and dropping it gives the old address.
    expect(pageParts({ harness: "h", visualiser: "v", locale: "fr" }).locale).toBe("fr");
    expect(forwardingParts(pageParts({ harness: "h", visualiser: "v", subgraph: "s" }))).toEqual({ harness: "h", visualiser: "v", subgraph: "s" });
  });

  test("a generator writes under the locale; the unlocalised route is the forwarding address", () => {
    const repo = fixture();
    expect(declaredPageRoute(join(repo, "base"), "library-viewer")).toBe(`${PAGE_LOCALE}/cat-harness/library`);
    expect(declaredRoute(join(repo, "base"), "library-viewer")).toBe("cat-harness/library");
    expect(declaredPageRoute(join(repo, "base"), "no-such-tool")).toBeUndefined();
    const p = visualiserSitePath(join(repo, "base"), "state-viewer");
    expect(p.rel).toBe(`${PAGE_LOCALE}/cat-harness/todos/index.md`);
    // Three directories deep, so three steps back to the site root.
    expect(p.up).toBe("../../../");
  });

  test("the localised page dir is under `<site>/<locale>/<harness>/<visualiser>/`", () => {
    const site = "/s";
    expect(visualiserPageDir(site, pageParts({ harness: "cat-harness", visualiser: "library", subgraph: "who-iris" }))).toBe(
      join(site, PAGE_LOCALE, "cat-harness", "library", "who-iris"),
    );
  });

  test("a page is read where it IS: under the locale once drawn there, else at the old address", () => {
    const repo = fixture();
    const site = join(repo, "base/docs");
    const parts = { harness: "cat-harness", visualiser: "todos" };
    // Only the old copy exists (a site not regenerated yet).
    expect(existingPageDir(site, parts)).toBe(join(site, "cat-harness", "todos"));
    // Drawn under the locale: that wins, the old copy notwithstanding.
    mkdirSync(join(site, PAGE_LOCALE, "cat-harness", "todos"), { recursive: true });
    writeFileSync(join(site, PAGE_LOCALE, "cat-harness", "todos", "index.html"), "<html><head></head></html>");
    expect(existingPageDir(site, parts)).toBe(join(site, PAGE_LOCALE, "cat-harness", "todos"));
    expect(existingPageDir(site, { harness: "cat-harness", visualiser: "nothing" })).toBeUndefined();
    // And a tile opens the localised page, never the forwarding address.
    const got = viewersOf({ id: "todos", path: "todos/", graphTypologies: ["todos"] }, join(repo, "base"), repo);
    expect(got.map((g) => g.ref)).toEqual([`base/docs/${PAGE_LOCALE}/cat-harness/todos/index.html`]);
  });

  test("with no page anywhere, a tile names the localised address, not the forwarding one", () => {
    const repo = fixture();
    rmSync(join(repo, "base/docs/cat-harness/todos"), { recursive: true });
    const got = viewersOf({ id: "todos", path: "todos/", graphTypologies: ["todos"] }, join(repo, "base"), repo);
    expect(got.map((g) => g.ref)).toEqual([`base/docs/${PAGE_LOCALE}/cat-harness/todos/index.html`]);
  });
});

describe("check:visualiser-routes places pages under the localised routes (folio-assistant#2527)", () => {
  const vis = [
    { harness: "cat-harness", harnessRoot: "/r/cat-harness", id: "library", renderedBy: "library-viewer", covers: ["d"] as [string, ...string[]] },
    { harness: "cat-harness", harnessRoot: "/r/cat-harness", id: "todos", renderedBy: "state-viewer", covers: ["d"] as [string, ...string[]] },
  ];
  const tools = new Set(["library-viewer", "state-viewer"]);

  test("a page under `<locale>/<harness>/<visualiser>/`, by its own Tool, is placed", () => {
    expect(pagePlacement(`${PAGE_LOCALE}/cat-harness/library/index.html`, "library-viewer", vis, tools)).toEqual({ kind: "ok" });
    expect(pagePlacement(`${PAGE_LOCALE}/cat-harness/library/who-iris/index.html`, "library-viewer", vis, tools)).toEqual({ kind: "ok" });
  });

  test("the same page at the OLD address is counted as legacy, not failed", () => {
    expect(pagePlacement("cat-harness/library/who-iris/index.html", "library-viewer", vis, tools)).toEqual({
      kind: "legacy",
      route: "cat-harness/library/",
    });
  });

  test("a page by another Tool under the localised route is foreign; one under no route is outside", () => {
    expect(pagePlacement(`${PAGE_LOCALE}/cat-harness/todos/index.html`, "library-viewer", vis, tools).kind).toBe("foreign-page");
    const out = pagePlacement("elsewhere/index.html", "library-viewer", vis, tools);
    expect(out.kind).toBe("outside-route");
    expect(out.kind === "outside-route" && out.detail).toContain(`${PAGE_LOCALE}/cat-harness/library/`);
  });

  test("a page naming no discovered Tool is not this gate's to place", () => {
    expect(pagePlacement("anything/index.html", undefined, vis, tools)).toEqual({ kind: "ok" });
    expect(pagePlacement("anything/index.html", "unknown", vis, tools)).toEqual({ kind: "ok" });
  });
});

describe("a viewer page built at publish counts as present (owner, 2026-10-15)", () => {
  // `processes`, `schemas` and the like are generated by `derive:publish` and
  // never committed. Before this, their visualisation had no writer, looked
  // absent on any unbuilt checkout, and the navbar said "no viewer yet".
  const root = mkdtempSync(join(tmpdir(), "built-at-publish-viewer-"));
  const put = (rel: string, body: unknown): void => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), typeof body === "string" ? body : JSON.stringify(body));
  };
  put("package.json", { name: "fixture", scripts: { "procs:viz": "bun run tools/gen-procs.ts" } });
  put("tools/gen-procs.ts", "");
  put("h/h.json", { name: "h", builtAtPublish: [{ path: "docs/en/h/procs/", writer: ["procs:viz"], because: "checkout", reason: "fixture" }] });

  test("a page under the harness's builtAtPublish gets that entry's writer files", () => {
    expect(builtAtPublishWriter(root, join(root, "h"), "h/docs/en/h/procs/index.html")).toEqual(["tools/gen-procs.ts"]);
  });

  test("a page the harness does not build at publish gets none", () => {
    expect(builtAtPublishWriter(root, join(root, "h"), "h/docs/en/h/other/index.html")).toBeUndefined();
  });

  test("a writer name that resolves to no file is not a writer", () => {
    put("h2/h2.json", { name: "h2", builtAtPublish: [{ path: "docs/x/", writer: ["missing:script"], because: "checkout", reason: "fixture" }] });
    expect(builtAtPublishWriter(root, join(root, "h2"), "h2/docs/x/index.html")).toBeUndefined();
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));
});
