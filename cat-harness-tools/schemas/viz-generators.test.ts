/**
 * The two visualiser generators produce a page, and it is a whole one.
 *
 * @module schemas/viz-generators.test
 * @graphNode none — a test over the generators, not a schema itself
 *
 * ## The failure this exists for, which cost a push
 *
 * Both viewers are authored as a TypeScript **template literal** holding a
 * whole HTML document, and a backtick anywhere inside it — including inside a
 * JavaScript comment in the embedded script — silently terminates the string.
 * That happened here: a comment reading *"the intake's own `files[]`"* turned
 * the rest of the page into TypeScript, and the generator exited 1 at a line
 * number 200 lines from the mistake.
 *
 * Nothing caught it but running the generator by hand. Importing the module
 * is enough to catch the parse error, and asserting the page's shape catches
 * the subtler version — a truncated document that still parses.
 */
import { describe, expect, test } from "bun:test";
import { HARNESS_ROOT, TOOLS_ROOT } from "../scripts/lib/roots.ts";
import { readFileSync } from "../test/support/site-fs.ts";
import { basename, join } from "node:path";

import { viewerHtml as schemaViewer, viewerPlacement } from "../scripts/gen-schema-viz.ts";
import { unscopedSelectors } from "../scripts/lib/themed-page.ts";
import { viewerHtml as libraryShell, VIEWER_CSS, VIEWER_JS } from "../scripts/gen-library-viz.ts";
import { readSchemaGraph } from "../scripts/schema-graph.ts";
import { readLibraryGraph } from "../scripts/library-graph.ts";
import { directoriesForGraph, repoRootFor, siteDirFor } from "./kg/cat-harness.ts";
import { siteNotBuilt } from "../test/support/checkout.ts";

const ROOT = TOOLS_ROOT; // the schema corpus moved here (bean 8lcl)

/**
 * THE GRAPHS ARE READ ONCE, HERE — not inside the tests that assert on them.
 *
 * Bean `vxho`. Both readers walk the REAL repository, and `bun test` applies
 * its 5000ms timeout PER TEST. Read inside a test, that filesystem work sits
 * inside the budget: measured at ~150ms warm in a quiet process, and **5683ms**
 * under the full suite, where hundreds of files contend for the same disk. So
 * the gate's colour depended on what else the machine was doing — the red that
 * clears on re-run and teaches everybody to re-run.
 *
 * At module scope the same work happens once per FILE, before any test starts,
 * and no test's budget contains it. That is not a trick to get under the
 * number: these graphs are a FIXTURE — every test here asserts about the same
 * repository, and reading it four times was four answers to one question that
 * were only ever equal by luck.
 *
 * `readLibraryGraph` was called twice and `readSchemaGraph` twice; now each is
 * read once.
 */
const SCHEMA_GRAPH = readSchemaGraph(ROOT);
const LIBRARY_GRAPH = readLibraryGraph([ROOT, repoRootFor(ROOT)]);

/** The href a page two levels down uses — what `viewerPlacement` computes. */
const DATA = "../../assets/schemas/index.json";

/**
 * The schema viewer is a THEMED page since 2026-10-07 — on the site's
 * `default` layout, so it carries the top band (search, Folio, language). It
 * left the standalone-document family below; these are its questions now.
 */
describe("the schema viewer", () => {
  const page = schemaViewer(DATA, "", ["cat-harness", "smart-base"]);

  test("is a themed Jekyll page, not a standalone document", () => {
    expect(page.startsWith("---\nlayout: default\n")).toBe(true);
    expect(page).not.toMatch(/<!doctype|<html|<head|<body|<main\b|<header\b/i);
    expect(page).toContain('<h1 id="sc-title">');
    expect(page).toContain("</script>");
    expect(page).toContain("</style>");
  });

  test("fetches its projection RELATIVE to its own location, with no base URL", () => {
    expect(page).toContain(DATA);
    expect(page).not.toContain("https://litlfred.github.io");
  });

  test("restyles nothing of the theme's, and follows the site's scheme switch", () => {
    expect(unscopedSelectors(page, ".sc-page")).toEqual([]);
    expect(page).toMatch(/\.sc-page \{\s*color-scheme: dark;/);
    expect(page).toContain(':root[data-fa-scheme="light"] .sc-page {');
  });

  test("lists its subject pages, since the theme's sidebar does not", () => {
    expect(page).toContain('<a href="smart-base/">smart-base</a>');
    expect(page).toContain('<span aria-current="page">All instances</span>');
  });

  test("says so when the projection cannot be read, rather than showing nothing", () => {
    expect(page).toContain("could not");
  });
});

/**
 * The library viewer is a THEMED page since 2026-10-07 — on the site's
 * `default` layout, so it gets the top band (search, Folio, language) that
 * `docs-ui.js` builds there. So the questions a standalone viewer answered
 * with its own head are asked of the front matter, the scoped stylesheet and
 * the shared script instead.
 */
describe("the library viewer", () => {
  const page = libraryShell(DATA);

  test("is a themed page on the default layout, with its body Liquid-raw", () => {
    expect(page.startsWith("---\nlayout: default\n")).toBe(true);
    expect(page).toMatch(/^title: "[^"]+"$/m);
    expect(page).toContain("\nnav_exclude: true\n");
    expect(page).not.toMatch(/<!doctype|<html|<head|<body/i);
    expect(page).toContain("{% raw %}");
    expect(page.trimEnd().endsWith("{% endraw %}")).toBe(true);
    expect(page).toContain('<h1 id="lib-title">');
  });

  test("fetches its projection RELATIVE to its own location, with no base URL", () => {
    expect(page).toContain(DATA);
    expect(page).not.toContain("https://litlfred.github.io");
  });

  test("its stylesheet styles only its own wrapper, in both colour schemes", () => {
    // Every rule's selectors start .lib-page; a rule on body, :root or a
    // would restyle the THEME on the page it sits in.
    const css = VIEWER_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [...css.matchAll(/([^{};]+)\{/g)]
      .map((m) => m[1]!.trim())
      .filter((p) => !p.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(50);
    for (const sel of selectors.flatMap((p) => p.split(",")).map((x) => x.trim())) {
      expect(sel, sel).toMatch(/^(html\[data-fa-scheme="light"\] )?\.lib-page\b/);
    }
    expect(css).not.toMatch(/(^|[\s,}])(body|:root|a)\s*[{,]/);
    expect(css).toContain('html[data-fa-scheme="light"] .lib-page {');
    // The ground a sticky header paints over is defined in both schemes.
    expect(css).toMatch(/\.lib-page \{[^}]*--bg:#27262b/);
    expect(css).toMatch(/data-fa-scheme="light"\] \.lib-page \{[^}]*--bg:#fff/);
  });

  test("says so when the projection cannot be read, rather than showing nothing", () => {
    // "could not load" and "there is nothing" are different answers, and this
    // repository's rule is that rendering them alike reports a clean run over
    // something never looked at.
    expect(VIEWER_JS).toContain("could not");
  });
});

describe("viewerPlacement — the URL is the directory's path, not a composition", () => {
  // Owner, 2026-09-20: "<baseurl>/<path to kind in knowledge graph>" or
  // "<path to dir handled>/<optional subject>".
  test("a directory publishes at its own repo-relative path", () => {
    const { pageDir } = viewerPlacement("/site", "cat-harness/schemas", "schemas");
    expect(pageDir).toBe(join("/site", "cat-harness", "schemas"));
  });

  test("a directory NOT at owner/kind is addressed by its path, not by the renderer", () => {
    // The composition this replaced would have said `cat-harness/library` for
    // this one — naming the machinery where the rule names the data.
    const { pageDir } = viewerPlacement("/site", "who-iris/library", "library");
    expect(pageDir).toBe(join("/site", "who-iris", "library"));
    expect(pageDir).not.toContain("cat-harness");
  });

  test("the data href is relative to the page's own depth", () => {
    // A literal `../assets/...` kept parsing and fetched nothing once the page
    // moved two levels down.
    expect(viewerPlacement("/site", "cat-harness/schemas", "schemas").dataHref)
      .toBe("../../assets/schemas/index.json");
    expect(viewerPlacement("/site", "deep/er/still", "schemas").dataHref)
      .toBe("../../../assets/schemas/index.json");
  });
});

describe("the readers agree with what the generators publish", () => {
  test("the schema graph spans every DECLARED schemas directory, not one", () => {
    // `directoryForGraph` throws when several directories declare a graph —
    // the `wggr` guard — and four layers declare `schemas` here. Asking for
    // one was the bug; this locks in the plural answer.
    const g = SCHEMA_GRAPH;
    expect(g).not.toBeNull();
    expect(g!.roots.length).toBeGreaterThan(1);
    expect(new Set(g!.modules.map((m) => m.instance)).size).toBeGreaterThan(1);
  });

  test("a queue's declared intake is ONE unit, not one per file it carries", () => {
    // An `intake.json` declares the capture's files. Counting them
    // individually made a four-file capture read as four documents waiting.
    const g = LIBRARY_GRAPH;
    expect(g).not.toBeNull();
    const intakes = g!.uploads.filter((u) => u.kind === "intake");
    for (const i of intakes) {
      expect(i.declaredFiles).toBeGreaterThan(0);
      // One row, however many files it declares.
      expect(g!.uploads.filter((u) => u.path === i.path)).toHaveLength(1);
    }
  });

  test("every queue's uningested count is total minus ingested, and never negative", () => {
    const g = LIBRARY_GRAPH!;
    for (const q of g.queues) {
      expect(q.uningested).toBe(q.total - q.ingested);
      expect(q.uningested).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("the projection is stable under edits that do not change the graph", () => {
  // The projection is the HARNESS's: `gen-schema-viz.ts` writes it under
  // `HARNESS_ROOT`'s site, though the corpus it reads moved here (bean 8lcl).
  // Reading it under this layer's site named a file nothing writes, in every
  // layout (bean w1gy F18). Standing alone it is not built either:
  // `schema:viz` writes it at publish and it is gitignored.
  const site = join(HARNESS_ROOT, siteDirFor(HARNESS_ROOT));
  const own = directoriesForGraph(ROOT, "schemas").find((d) => d.startsWith(`${ROOT}/`));
  const projection = join(site, "assets", basename(own ?? "schemas"), "index.json");
  test.skipIf(
    own !== undefined && siteNotBuilt("the schema projection `schema:viz` writes at publish (gitignored)", projection),
  )("no declaration carries a line number", () => {
    // A line number is an editor coordinate, not a property of a declaration.
    // Carrying it made the staleness gate fire whenever anything ABOVE a
    // declaration moved: merging main shifted two declarations in
    // `cat-harness.ts` by 36 lines, and the gate went red over two integers
    // with nothing else in 895 KB different.
    //
    // A gate whose red means "somebody added a blank line" teaches
    // contributors to regenerate reflexively instead of reading the finding,
    // which is the opposite of what a gate is for.
    // Both path halves are RESOLVED, not spelled out. `site-dir-single-answer`
    // fails any source file that hardcodes the site root, and it caught the
    // first draft of this test doing exactly that — the gate working on the
    // test written to guard another gate. The published segment is the
    // declared directory's own name, the same rule the generator follows.
    expect(own).toBeDefined();
    const published = JSON.parse(
      readFileSync(projection, "utf-8"),
    ) as { decls: Array<Record<string, unknown>> };
    expect(published.decls.length).toBeGreaterThan(0);
    expect(published.decls.filter((d) => "line" in d)).toEqual([]);
  });

  test("the reader still knows the line, so a consumer that wants one can have it", () => {
    // Dropped from the PROJECTION, kept on the reader. The two are different
    // artefacts and conflating them would remove the information entirely.
    const g = SCHEMA_GRAPH!;
    expect(g.decls.every((d) => typeof d.line === "number" && d.line > 0)).toBe(true);
  });
});
