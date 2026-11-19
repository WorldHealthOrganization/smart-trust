/**
 * `viewer-declarations` tests about the WHOLE CHECKOUT (bean `7zz1`): each
 * reads every layer's declared visualisers, which only the checkout holds.
 *
 * Since 2026-10-09 a visualiser is declared by the HARNESS, in its own
 * `<instance>.json` `visualisers`, and published at the route
 * `visualiserRoute` computes — `<base>/<harness>/<visualiser>/` — so these
 * pin the routes a directory's tile resolves to, read from the declarations.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
// A page written at publish is at the layer output root (bean cat-tools-sm8r).
import { overlayPath } from "../../scripts/lib/layer-output.ts";
import { join, resolve } from "node:path";

import { declarationPathIn, layerRootsIn, visualisationResolves } from "../../schemas/kg/cat-harness.ts";
import { declaredVisualisers, PAGE_LOCALE, viewersOf, type ViewedDirectory } from "../../scripts/viewer-declarations.js";

/** The directory these tests were written in (`cat-harness/scripts/tests/`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

describe("the corpus: viewers are read from the harness declarations (owner, 2026-10-09)", () => {
  const REPO = resolve(ORIGIN_DIR, "..", "..", "..");

  type Dir = ViewedDirectory;
  const dirs: { root: string; instance: string; dir: Dir; raw: { coverage?: { visualiser?: unknown } } }[] = [];
  for (const root of layerRootsIn(REPO)) {
    const p = declarationPathIn(root);
    if (!p) continue;
    const decl = JSON.parse(readFileSync(p, "utf-8")) as { name?: string; directories?: Dir[] };
    for (const dir of decl.directories ?? []) dirs.push({ root, instance: decl.name ?? root.split("/").pop()!, dir, raw: dir });
  }

  test("the corpus is non-empty, so the assertions below are not vacuous", () => {
    expect(dirs.length).toBeGreaterThan(0);
    expect(declaredVisualisers(REPO).length).toBeGreaterThan(0);
  });

  test("no directory declares its own viewer — the harness does", () => {
    // `coverage.visualiser` on disk was the directory pointing at its page,
    // and `renders:` on a page was the page claiming the directory. Both are
    // retired: neither can stop two pages contending for one URL.
    expect(dirs.filter(({ raw }) => raw.coverage?.visualiser !== undefined).map(({ instance, dir }) => `${instance}/${dir.id}`)).toEqual([]);
  });

  test("beans and folio: one page per instance, the declarer's by-id directory keeps its full view (bean 1nu0)", () => {
    const resolveFor = (instance: string, id: string): string | undefined => {
      const row = dirs.find((d) => d.instance === instance && d.dir.id === id);
      return row ? viewersOf(row.dir, row.root, REPO)[0]?.ref : undefined;
    };
    const page = (route: string) => new RegExp(`^cat-harness/docs/(${PAGE_LOCALE}/)?${route.replace(/\./g, "\\.")}$`);
    // Each layer's `beans/` is its own store, not the repository one.
    if (dirs.some((d) => d.instance === "cat-harness-tools" && d.dir.id === "beans")) {
      expect(resolveFor("cat-harness-tools", "beans")).toMatch(page("cat-harness/beans/cat-harness-tools/index.html"));
    }
    if (dirs.some((d) => d.instance === "who-iris" && d.dir.id === "folio")) {
      expect(resolveFor("who-iris", "folio")).toMatch(page("cat-harness/folio/who-iris/index.html"));
    }
    // cat-harness names both by id: its rows open the full views it had.
    expect(resolveFor("cat-harness", "beans")).toMatch(page("cat-harness/beans/index.html"));
    expect(resolveFor("cat-harness", "folio")).toMatch(page("cat-harness/folio/index.html"));
  });

  test("known directories resolve to their declared route", () => {
    const resolveFor = (instance: string, id: string): string | undefined => {
      const row = dirs.find((d) => d.instance === instance && d.dir.id === id)!;
      return viewersOf(row.dir, row.root, REPO)[0]?.ref;
    };
    // A committed page under the page locale — or, until the committed site is
    // regenerated (folio-assistant#2527), at the address without it.
    const committed = (route: string) => new RegExp(`^cat-harness/docs/(${PAGE_LOCALE}/)?${route.replace(/\./g, "\\.")}$`);
    // Covered by kind with per-instance sub-graphs (bean 1nu0): each layer's
    // tools directory opens its own layer's page.
    expect(resolveFor("cat-harness", "tools")).toMatch(committed("cat-harness/tools/cat-harness/index.md"));
    expect(resolveFor("smart-base", "tools")).toMatch(committed("cat-harness/tools/smart-base/index.md"));
    // Processes has per-instance sub-graph pages too since cat-harness#930.
    expect(resolveFor("cat-harness", "processes")).toMatch(committed("cat-harness/processes/cat-harness/index.md"));
    // A corpus-wide visualiser with per-instance sub-graphs opens the subject's view.
    expect(resolveFor("who-iris", "library")).toMatch(committed("cat-harness/library/who-iris/index.html"));
    // A declared nested sub-graph path (`subgraphUnder`), never one inferred from the pages.
    const autoDocsSkills = "cat-harness/docs/cat-harness/auto-docs/index/skills/skills/index.html";
    // Once cat-harness declares the Skills hub (a `skills` visualiser drawn by
    // `skill-docs`, owner card "Skills hub", option A, 2026-11-18), its OWN
    // `skills` directory opens the hub; `covers` names only that layer's
    // directories, so another layer's `skills` directory still opens the
    // nested auto-docs view. Before it does, cat-harness's opens auto-docs.
    const hub = declaredVisualisers(REPO).find((v) => v.harness === "cat-harness" && v.renderedBy === "skill-docs");
    if (hub !== undefined) {
      expect(resolveFor("cat-harness", "skills")).toMatch(committed(`cat-harness/${hub.id}/index.html`));
      if (dirs.some((d) => d.instance === "bootstrap" && d.dir.id === "skills")) {
        expect(resolveFor("bootstrap", "skills")).toBe(autoDocsSkills);
      }
    } else {
      expect(resolveFor("cat-harness", "skills")).toBe(autoDocsSkills);
    }
    // ...and for `subgraphs: "instance"` too (owner, 2026-10-15, "3a"): each
    // layer's glossary tile opens `glossary/instance/<instance>/`, never
    // the shared page, so it cannot meet `glossary/skills/` and the like.
    // Asserted where the mounted core declares the nesting.
    const glossaryVis = declaredVisualisers(REPO).find((v) => v.renderedBy === "glossary-page");
    if (glossaryVis?.subgraphUnder?.glossary === "instance") {
      for (const inst of ["who-iris", "cat-harness"]) {
        if (!dirs.some((d) => d.instance === inst && d.dir.id === "glossary")) continue;
        expect(resolveFor(inst, "glossary")).toMatch(
          new RegExp(`^cat-harness/docs/(${PAGE_LOCALE}/)?folio-assistant-core/glossary/instance/${inst}/index\\.(html|md)$`),
        );
      }
    }
    expect(resolveFor("cat-harness", "beans")).toMatch(committed("cat-harness/beans/index.html"));
    // Built at publish, never committed: its declared route, under the page locale.
    expect(resolveFor("cat-harness", "fsh-guts")).toMatch(
      new RegExp(`^cat-harness/docs/${PAGE_LOCALE}/cat-harness/fsh-guts/index\\.(html|md)$`),
    );
  });

  // "Exists" includes a page BUILT AT PUBLISH (bean 0b8c): never committed,
  // so it resolves by its declared writer rather than by the disk.
  test("every resolved page exists, or is built at publish by a writer that exists", () => {
    const missing = dirs.flatMap(({ root, instance, dir }) =>
      viewersOf(dir, root, REPO)
        .filter((v) => !visualisationResolves(v, (p: string) => existsSync(overlayPath(join(REPO, p)))))
        .map((v) => `${instance}/${dir.id} → ${v.ref}`),
    );
    expect(missing).toEqual([]);
  });
});
