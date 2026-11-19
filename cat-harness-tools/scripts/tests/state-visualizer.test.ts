/**
 * The state dashboards: their route, and what each page can and cannot claim.
 *
 * @module scripts/tests/state-visualizer
 *
 * The generator writes COMMITTED pages under this layer's site dir, so
 * `state:visualizer:check` is the staleness gate and this file is the
 * behaviour gate. It reads what the generator produced rather than re-deriving
 * it the same way, and it must never assert a COUNT of beans or epics — those
 * move whenever anybody works, and a test that fails because somebody closed a
 * bean is a test that gets deleted.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { existsSync, readFileSync } from "../../test/support/site-fs.ts";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

import {
  declaredVisualiserFor,
  describe as describeText,
  GENERATED_BY,
  ownVisualiserRefs,
  prunableDashboards,
  beansSubjectPage,
  beanStorePartsSection,
  BEAN_STORE_KINDS,
  todoBoardPage,
  todoStorePartsSection,
  instanceSubjectPage,
  instanceSubjectsOf,
  LISTED_KINDS,
  PER_INSTANCE_KINDS,
  projectInstanceSubject,
  REGISTRY_KINDS,
  registryRowsOf,
  instanceHubPage,
  codeDirectoriesOf,
  codeSubjectPage,
  listCodeFiles,
  pinnedBlobBase,
  MEMORY_KINDS,
  memoryRowsOf,
  memorySubjectPage,
  drawsInstanceHub,
  perInstanceSubjects,
  hostedVisualisers,
  MERGE_REVIEWS_KIND,
  mergeReviewsPage,
  mergeReviewsSection,
  VIEWER_TOOL,
  workflowInstancePage,
  workflowHubPage,
} from "../state-visualizer.ts";
import { readDeclaration, siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";
import {
  existingPageDir,
  forwardingParts,
  pageParts,
  visualiserPageDir,
  visualiserPageRef,
} from "../viewer-declarations.ts";
import { ensureDocsPages, siteNotBuilt } from "../../test/support/checkout.ts";
import { overlayPath } from "../lib/layer-output.ts";

const ROOT = HARNESS_ROOT;
const SITE = join(ROOT, siteDirFor(ROOT));

/**
 * The visualiser id cat-harness declares for a state graph — its URL segment
 * under `<site>/cat-harness/` (owner, 2026-10-09). `uploads` is the uploads
 * viewer's route, so its dashboard is `uploads-queue`.
 */
const VIS: Record<string, string> = { uploads: "uploads-queue" };
const visOf = (graph: string) => VIS[graph] ?? graph;
/**
 * Where a dashboard is drawn: the declared route under the page locale,
 * `<site>/en/cat-harness/<vis>/`. Until the committed site is regenerated the
 * page is still at `<site>/cat-harness/<vis>/`, and `existingPageDir` answers
 * whichever holds it.
 */
const pageDir = (graph: string) => {
  const parts = { harness: "cat-harness", visualiser: visOf(graph) };
  // Through the overlay first (bean cat-tools-sm8r): the writer puts the page at
  // the layer's OUTPUT ROOT, while a stale committed copy may still sit at the old
  // address in the pinned mount, which `existingPageDir` (mount only) would pick.
  const holds = (d: string) => existsSync(join(d, "index.html")) || existsSync(join(d, "index.md"));
  const overlaid = [visualiserPageDir(SITE, pageParts(parts)), visualiserPageDir(SITE, forwardingParts(parts))].find(holds);
  return overlaid ?? existingPageDir(SITE, parts) ?? visualiserPageDir(SITE, pageParts(parts));
};
/** The directory every dashboard of this harness sits in. */
const dashboardsDir = () => dirname(pageDir("beans"));
/** `../` once per route segment of a dashboard: its way back to the site root. */
const upFrom = (graph: string) => "../".repeat(relative(SITE, pageDir(graph)).split(sep).length);
/** A dashboard's committed page. */
const read = (graph: string) =>
  readFileSync(join(pageDir(graph), "index.html"), "utf-8");
const has = (graph: string) => existsSync(join(pageDir(graph), "index.html"));
/**
 * Standing alone, whether a dashboard page a test reads is unbuilt. The pages
 * are written by `state:visualizer` at publish and gitignored, so a fresh
 * clone has none (bean `folio-assistant-w1gy` F18); in the composed checkout
 * this is always false and the test runs.
 */
const dashboardsNotBuilt = (...graphs: string[]): boolean =>
  siteNotBuilt(
    `the ${graphs.join(", ")} dashboard page${graphs.length > 1 ? "s" : ""} \`state:visualizer\` writes at publish (gitignored)`,
    ...graphs.map((g) => join(pageDir(g), "index.html")),
  );

describe("the route is the policy, not this generator's choice", () => {
  test.skipIf(dashboardsNotBuilt("beans", "todos", "qa", "health", "issue-marks", "uploads"))("the visualiser is AT its declared route, `<harness>/<visualiser>/`, one per declared visualiser", () => {
    for (const id of ["beans", "todos", "qa", "health", "issue-marks", "uploads"]) {
      expect(has(id)).toBe(true);
      // Never at the site root any more: `<base>/<visualiser>/` is an opt-in
      // ALIAS (bean `t4xb`), composed as a redirect, never drawn here.
      expect(existsSync(join(SITE, id, "index.html"))).toBe(false);
    }
  });

  test("no stub segment, and no invented one", () => {
    // Bean `o7eq` ruling 1: the segment is the layer's NAME, never its
    // stub. Two earlier drafts published under `folio-assistant`, which names
    // the published graph DOCUMENT and not the layer. Ruling 3 then elides
    // this layer's own name, because its docs are the published root.
    expect(existsSync(join(SITE, "folio-assistant"))).toBe(false);
    expect(existsSync(join(SITE, "state"))).toBe(false);
    expect(existsSync(join(SITE, "state-visualizer"))).toBe(false);
    // And no segment BENEATH the directory either. `harness-requirements`
    // names `<base-url>/beans` as the obligation, so a page one level deeper
    // leaves that URL a 404 and does not meet it.
    expect(existsSync(join(pageDir("beans"), "dashboard"))).toBe(false);
  });

  test.skipIf(dashboardsNotBuilt("qa", "health"))("the segment is the declared ID, because two paths basename alike", () => {
    // `qa` is `test/results/` and `health` is `test/health/results/`. Taking
    // the basename — which the sibling schema visualiser does, correctly, for
    // its own graph — would give both the segment `results`, and one dashboard
    // would silently overwrite the other.
    expect(has("qa")).toBe(true);
    expect(has("health")).toBe(true);
    expect(existsSync(join(dashboardsDir(), "results", "index.html"))).toBe(false);
  });
});

describe("each page reads the projection that already exists", () => {
  beforeAll(() => {
    ensureDocsPages(ROOT);
  }, 180_000);
  test.skipIf(dashboardsNotBuilt("beans"))("relative to itself, at the depth its own route implies", () => {
    // `beans` is a THEMED page (#2418): `fa-beans-src` is the layout's own,
    // through `relative_url`. The no-JS fallback still links the projection,
    // relative to the page.
    // One `../` per route segment: `<locale>/<harness>/<visualiser>/`.
    expect(read("beans")).toContain(`href="${upFrom("beans")}assets/beans/index.json"`);
    // `todos` is a THEMED page (#1906): its `fa-todo-src` is the site's own,
    // written by `head_custom.html` through `relative_url`, so the page
    // carries no path of its own to get wrong.
  });

  test.skipIf(
    siteNotBuilt(
      "the beans and todos projections `gen-docs-pages.ts` writes at publish (gitignored)",
      overlayPath(join(SITE, "assets", "beans", "index.json")),
      overlayPath(join(SITE, "assets", "todos", "index.json")),
    ),
  )("and that projection is really there", () => {
    // The generator publishes no data of its own — `gen-docs-pages.ts` does.
    // A second copy would be two answers to what the work plan holds.
    expect(existsSync(overlayPath(join(SITE, "assets", "beans", "index.json")))).toBe(true);
    expect(existsSync(overlayPath(join(SITE, "assets", "todos", "index.json")))).toBe(true);
  });

  test.skipIf(dashboardsNotBuilt("beans", "todos"))("a graph page names only its own graph", () => {
    // Asserted on the META TAG, not the bare string: the renderer is INLINED
    // into every page and its source names both metas, because querying for
    // them is its job. An earlier draft asserted the string and failed on the
    // renderer's own code — a true fact about the file and nothing about the
    // page.
    const meta = (html: string, name: string) => new RegExp(`<meta name="${name}"`).test(html);
    // `beans` is themed (#2418): the layout's head carries BOTH metas, so the
    // page names neither and its container asks for beans only.
    expect(meta(read("beans"), "fa-beans-src")).toBe(false);
    expect(meta(read("beans"), "fa-todo-src")).toBe(false);
    expect(read("beans")).toContain('data-fa-workplan-only="beans"');
    // The todos page names NEITHER: it is themed, and the layout's head
    // supplies `fa-todo-src` — the same meta every site page carries.
    expect(meta(read("todos"), "fa-todo-src")).toBe(false);
    expect(meta(read("todos"), "fa-beans-src")).toBe(false);
  });
});

describe("what a page may claim", () => {
  test.skipIf(dashboardsNotBuilt("issue-marks"))("a graph with no projection says so instead of rendering zeros", () => {
    // `qa` was the example here until 2026-09-21, when bean `py74` gave it a
    // projection. `issue-marks` (2 files) is the one this repository has
    // DECIDED is too thin to earn a dashboard, so it is the stable example
    // rather than merely a currently-empty one. `health` was beside it until
    // 2026-10-15, when it gained per-instance pages (bean
    // `folio-assistant-1nu0`).
    const html = read("issue-marks");
    expect(html).toContain("declared");
    expect(html).toContain("2krx");
    // No container in the BODY, so the renderer never mounts. Matched as the
    // element rather than the attribute name, which the inlined renderer also
    // contains.
    expect(/<div class="fa-workplan" data-fa-workplan>/.test(html)).toBe(false);
    expect(/<meta name="fa-(beans|todo)-src"/.test(html)).toBe(false);
  });

  test.skipIf(dashboardsNotBuilt("beans", "qa", "health", "uploads"))("every page carries the registry, so the set is navigable from any of them", () => {
    // There is no index above these: `<base>/` is the documentation site's.
    // The way across is on each page, which is what makes them registered
    // sub-visualisations rather than six unrelated pages.
    //
    // EXCEPT `todos`, by the owner's ruling (#1906, 2026-10-02): "not sure why
    // all the graphs are listed on the todos page. cluttery". The other
    // dashboards keep it until the owner rules on them.
    for (const id of ["beans", "qa", "health", "uploads"]) {
      expect(read(id)).toContain("State graphs this harness declares");
    }
    // The link to beans is on every page EXCEPT the beans page, which is the
    // next assertion and the reason this one cannot simply check all of them.
    expect(read("qa")).toContain('href="../beans/"');
    // And the others still reach todos, which is still a page.
    expect(read("beans")).toContain('href="../todos/"');
  });

  test.skipIf(dashboardsNotBuilt("beans", "todos"))("a page never links to itself", () => {
    // A link to here is a control that does nothing, and a reader who clicks
    // it learns only that it did nothing. The current row is plain text.
    expect(read("beans")).not.toContain('href="../beans/"');
    expect(read("todos")).not.toContain('href="../todos/"');
    expect(read("beans")).toContain('<span class="sv-here">beans</span>');
  });

  test.skipIf(dashboardsNotBuilt("beans", "todos", "qa", "health", "issue-marks", "uploads", "attestations", "swimlane-glossary"))("EVERY dashboard is a themed page, so every one carries the top band (#2418)", () => {
    // Owner, 2026-10-07: "(and other pages)". The band is docs-ui.js's, and
    // only a layout page loads it — a doctype shell with its own head has none.
    const IDS = ["beans", "todos", "qa", "health", "issue-marks", "uploads", "attestations", "swimlane-glossary"]
      .filter(has);
    expect(IDS.length).toBeGreaterThan(0);
    for (const id of IDS) {
      const html = read(id);
      expect(html.startsWith("---\nlayout: default\n"), id).toBe(true);
      expect(html, id).not.toMatch(/<!doctype html>/i);
      // Nothing inlined: the layout's head carries the renderer and its styles.
      expect(html, id).not.toContain("mountWorkPlan");
      expect(html, id).not.toContain("<script");
      // An explicit id on the one h1, so the theme cannot mint a shared anchor (gjli).
      expect(html, id).toMatch(/<h1 id="[^"]+">/);
    }
  });

  test.skipIf(dashboardsNotBuilt("beans"))("the beans page is THEMED, so it carries the site's top band (#2418)", () => {
    const html = read("beans");
    // The band (language, search, Folio) is built by docs-ui.js, which only a
    // layout page loads. A doctype shell with its own head has no band.
    expect(html.startsWith("---\nlayout: default\n")).toBe(true);
    expect(html).not.toMatch(/<!doctype html>/i);
    expect(html).not.toContain("mountWorkPlan");
    expect(html).toContain('<div class="fa-workplan" data-fa-workplan data-fa-workplan-only="beans">');
    expect(html).toContain("State graphs this harness declares");
  });

  test.skipIf(dashboardsNotBuilt("todos"))("the todos page is the landing's sticky panel, open, on a themed page (#1906)", () => {
    const html = read("todos");
    // Themed: Jekyll front matter on the default layout, so the site chrome,
    // docs-ui.js and the no-JS floor come from the layout — not a doctype
    // shell with its own inlined renderer.
    expect(html.startsWith("---\nlayout: default\n")).toBe(true);
    expect(html).not.toMatch(/<!doctype html>/i);
    expect(html).not.toContain("mountWorkPlan");
    // The SAME panel as the landing page: its own include, not a second board.
    expect(html).toContain("{% include landing.html open=true %}");
    // And no clutter: neither the registry nor the plain-text by-node list.
    expect(html).not.toContain("State graphs this harness declares");
    expect(html).not.toContain("Todos by the node they are attached to");
    // A page no longer says what it renders — the harness declares it — and
    // names only the Tool that drew it.
    expect(html).not.toMatch(/^renders:/m);
    expect(html).toContain("rendered-by: state-viewer");
  });

  test("the landing include opens the panel only when asked", () => {
    const inc = readFileSync(join(SITE, "_includes", "landing.html"), "utf-8");
    expect(inc).toContain('<details class="fa-sticky-panel" lang="en" dir="ltr"{% if include.open %} open{% endif %}>');
    // The landing page itself includes it bare, so it stays slid away there.
    const index = readFileSync(join(SITE, "index.md"), "utf-8");
    expect(index).toContain("{% include landing.html %}");
  });

  test.skipIf(dashboardsNotBuilt("beans", "todos", "qa"))("every page carries the do-not-hand-edit notice", () => {
    for (const id of ["beans", "todos", "qa"]) {
      expect(read(id)).toContain("Do not hand-edit");
    }
  });
});

describe("no projection here is not the same as nothing renders this", () => {
  // Bean `flh4`, issue #618. The generator asked "is there a projection at MY
  // path?" and published the answer as "nothing renders this graph". `uploads`
  // is where the two diverge: its queue block lives inside
  // `assets/library/index.json`, because it is one dataset with `library/` and
  // two projections over it would be two answers to "how many are queued".

  test.skipIf(dashboardsNotBuilt("uploads"))("a graph whose declaration names a visualiser says so, and links to it", () => {
    const html = read("uploads");
    expect(html).toContain("rendered elsewhere");
    expect(html).not.toContain("nothing publishes a projection for it yet");
  });

  test.skipIf(dashboardsNotBuilt("uploads"))("the link is a real directory under this site, not a fabricated path", () => {
    // Asserted by RESOLVING it, not by matching the string. The declared value
    // is repo-root relative and the page is two levels into the site, so a
    // plausible-looking href is exactly the defect that would survive a
    // string assertion.
    const html = read("uploads");
    const href = /rendered elsewhere[\s\S]*?href="([^"]+)"/.exec(html)?.[1];
    expect(href).toBeTruthy();
    const target = join(pageDir("uploads"), href!);
    expect(existsSync(join(target, "index.html"))).toBe(true);
  });

  test.skipIf(dashboardsNotBuilt("uploads"))("it is labelled with the URL a reader sees, never the repo path", () => {
    // The declared value is `cat-harness/docs/...`, which is correct on disk
    // and meaningless in an address bar.
    const label = /rendered elsewhere[\s\S]*?<a [^>]*>([^<]+)<\/a>/.exec(read("uploads"))?.[1];
    expect(label).toBeTruthy();
    expect(label!.startsWith("/")).toBe(true);
    expect(label).not.toContain("docs/");
  });

  test.skipIf(dashboardsNotBuilt("uploads"))("and the graph that page renders really is the one being pointed at", () => {
    // Falsification the other way: if the target stopped carrying queue data,
    // "rendered elsewhere" would be a link to a page that does not render it.
    const href = /rendered elsewhere[\s\S]*?href="([^"]+)"/.exec(read("uploads"))![1]!;
    const target = readFileSync(join(pageDir("uploads"), href, "index.html"), "utf-8");
    expect(target).toContain("uningested");
  });

  test.skipIf(dashboardsNotBuilt("issue-marks"))("a graph with NO declared visualiser still says nothing renders it", () => {
    // The other direction, and the reason this change is scoped rather than a
    // blanket rewrite: these declare no visualiser, so their pages were right
    // and must not move. `qa` was in this list until 2026-09-21 and left it by
    // GAINING a projection (bean `py74`), not by the rule changing; `health`
    // left it on 2026-10-15 by GAINING a declared viewer (per-instance pages,
    // bean `folio-assistant-1nu0`).
    for (const id of ["issue-marks"]) {
      expect(read(id)).toContain("nothing publishes a projection for it yet");
      expect(read(id)).not.toContain("rendered elsewhere");
    }
  });

  test.skipIf(dashboardsNotBuilt("health", "attestations"))("health and attestations point at this instance's own per-instance page (bean folio-assistant-1nu0)", () => {
    for (const id of ["health", "attestations"]) {
      const html = read(id);
      expect(html).toContain("rendered elsewhere");
      expect(html).toContain(`href="cat-harness/"`);
      expect(html).not.toContain("nothing publishes a projection for it yet");
    }
  });

  test.skipIf(dashboardsNotBuilt("beans", "todos", "qa", "health", "issue-marks", "uploads"))("no page claims a visualiser that is not there", () => {
    // `unresolved` fires on nothing today — 27 of 27 coverage paths resolve —
    // so this asserts the CORPUS is clean rather than that the state works.
    // The state itself is exercised in the unit test below, because a test
    // that can only pass is not a test.
    for (const id of ["beans", "todos", "qa", "health", "issue-marks", "uploads"]) {
      expect(read(id)).not.toContain("not there");
    }
  });
});

describe("declaredVisualiserFor — the four outcomes, against fixtures", () => {
  // The site segment comes from the SINGLE ANSWER, never a literal — the rule
  // `site-dir-single-answer` enforces, and which this block broke on its first
  // draft. A hardcoded site root once unignored 3,080 files.
  const SEG = siteDirFor(ROOT);
  const page = (...parts: string[]) => ["inst", SEG, ...parts].join("/");

  /** A repo root with a site in it, and whichever pages the case needs. */
  function roots(pages: string[] = []): { site: string; repoRoot: string } {
    const repoRoot = mkdtempSync(join(tmpdir(), "sv-cov-"));
    const site = join(repoRoot, "inst", SEG);
    mkdirSync(site, { recursive: true });
    for (const rel of pages) {
      const f = join(repoRoot, rel);
      mkdirSync(join(f, ".."), { recursive: true });
      writeFileSync(f, "<html></html>");
    }
    return { site, repoRoot };
  }

  test("no declared visualiser is `declared` — unchanged, and the common case", () => {
    expect(declaredVisualiserFor("qa", undefined, roots()).state).toBe("declared");
  });

  test("a declared visualiser that resolves is `elsewhere`, with a page-relative href", () => {
    const rel = page("lib", "x", "index.html");
    const got = declaredVisualiserFor("uploads", rel, roots([rel]));
    expect(got.state).toBe("elsewhere");
    expect(got.href).toBe(join("..", "lib", "x", "index.html"));
    expect(got.declaredVisualiser).toBe(rel);
  });

  test("a declared visualiser that is NOT there is `unresolved`, never `elsewhere`", () => {
    // The branch the corpus cannot reach: 27 of 27 coverage paths resolve. If
    // this collapsed into `elsewhere`, the page would publish a link to a 404
    // — which is the defect this whole change exists to avoid, one level down.
    const rel = page("lib", "gone", "index.html");
    const got = declaredVisualiserFor("uploads", rel, roots());
    expect(got.state).toBe("unresolved");
    expect(got.href).toBeUndefined();
    expect(got.declaredVisualiser).toBe(rel);
  });

  test("a visualiser OUTSIDE the site is `elsewhere` but carries no href", () => {
    // It exists, so it is not `unresolved`; it is not published, so any href
    // would be a control that resolves to nothing once the site is served.
    const got = declaredVisualiserFor("uploads", "other/place/index.html", roots(["other/place/index.html"]));
    expect(got.state).toBe("elsewhere");
    expect(got.href).toBeUndefined();
  });

  test("resolution is against the REPO root, not the instance root", () => {
    // The trap that would have marked all 27 missing. Measured 2026-09-20: 25
    // of 27 coverage paths resolve ONLY from the repo root, 0 only from the
    // layer. The same page, spelled both ways: the repo-root spelling must
    // resolve and the instance-relative one must not, or the assertion above
    // is not discriminating.
    const rel = page("lib", "x", "index.html");
    const r = roots([rel]);
    expect(declaredVisualiserFor("uploads", rel, r).state).toBe("elsewhere");
    expect(declaredVisualiserFor("uploads", "lib/x/index.html", r).state).toBe("unresolved");
  });
});

describe("this generator's own pages are own at EITHER address — the first run after the locale move", () => {
  // A graph with no projection is told apart from one another visualiser draws
  // by whether its coverage ref is one of OURS. That ref is
  // `visualiserPageRef`'s answer, which is whichever address holds the page
  // NOW. On the first run after the move only the old `<harness>/<vis>/` page
  // is on disk, so the old address is what the ref names; if own-ness looked
  // only at the localised address, that run linked a graph to a page the same
  // run then pruned (`attestations`, `health`, `issue-marks` read `elsewhere`).
  const SEG = siteDirFor(ROOT);
  const harness = "cat-harness";

  /** A repo root with a site in it, and the named pages under that site. */
  function site(pages: string[] = []): { repoRoot: string; site: string } {
    const repoRoot = mkdtempSync(join(tmpdir(), "sv-own-"));
    const s = join(repoRoot, "inst", SEG);
    mkdirSync(s, { recursive: true });
    for (const abs of pages.map((p) => join(s, p))) {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, "<html></html>");
    }
    return { repoRoot, site: s };
  }
  const oldDir = (s: string, visualiser: string) => visualiserPageDir(s, forwardingParts({ harness, visualiser }));
  const newDir = (s: string, visualiser: string) => visualiserPageDir(s, pageParts({ harness, visualiser }));

  test("only the OLD-address page is on disk: the ref names it, and it is own", () => {
    const r = site([`${harness}/health/index.html`]);
    const ref = visualiserPageRef(r.repoRoot, { harness, visualiser: "health" }, r.site);
    // Discriminating: the ref really is the old address, not the localised one.
    expect(join(r.repoRoot, ref)).toBe(join(oldDir(r.site, "health"), "index.html"));
    expect(ownVisualiserRefs(r.repoRoot, r.site, harness, ["health"]).has(ref)).toBe(true);
  });

  test("the localised page is on disk: the ref names it, and it is own", () => {
    const r = site([`${harness}/health/index.html`]);
    const at = join(newDir(r.site, "health"), "index.html");
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, "<html></html>");
    const ref = visualiserPageRef(r.repoRoot, { harness, visualiser: "health" }, r.site);
    expect(join(r.repoRoot, ref)).toBe(at);
    expect(ownVisualiserRefs(r.repoRoot, r.site, harness, ["health"]).has(ref)).toBe(true);
  });

  test("an `index.md` at the old address is own too", () => {
    const r = site([`${harness}/issue-marks/index.md`]);
    const ref = visualiserPageRef(r.repoRoot, { harness, visualiser: "issue-marks" }, r.site);
    expect(ref.endsWith("/index.md")).toBe(true);
    expect(ownVisualiserRefs(r.repoRoot, r.site, harness, ["issue-marks"]).has(ref)).toBe(true);
  });

  test("no page yet: the ref is the localised `index.html`, and it is own", () => {
    const r = site();
    const ref = visualiserPageRef(r.repoRoot, { harness, visualiser: "health" }, r.site);
    expect(join(r.repoRoot, ref)).toBe(join(newDir(r.site, "health"), "index.html"));
    expect(ownVisualiserRefs(r.repoRoot, r.site, harness, ["health"]).has(ref)).toBe(true);
  });

  test("a visualiser this generator does NOT draw is not own, at either address", () => {
    const r = site([`${harness}/qa/index.html`]);
    const own = ownVisualiserRefs(r.repoRoot, r.site, harness, ["health"]);
    const ref = visualiserPageRef(r.repoRoot, { harness, visualiser: "qa" }, r.site);
    expect(own.has(ref)).toBe(false);
    expect(own.has(relative(r.repoRoot, join(newDir(r.site, "qa"), "index.html")).split(sep).join("/"))).toBe(false);
  });
});

describe("a declared description is escaped BEFORE its code spans are made", () => {
  // Bean `xo3t`. The registry wrote descriptions through `esc()` alone, so the
  // markdown backticks in them reached the page as backticks. Measured across
  // both declarations: 12 of 34 carry one in the first sentence, which is the
  // part the registry shows.

  test("a backticked span becomes code", () => {
    expect(describeText("what the sweep under `test/health/` wrote"))
      .toBe("what the sweep under <code>test/health/</code> wrote");
  });

  test("several spans on one line each become their own code element", () => {
    expect(describeText("`a`, `b` and `c`"))
      .toBe("<code>a</code>, <code>b</code> and <code>c</code>");
  });

  test("ANGLE BRACKETS INSIDE a span stay escaped — the order is the fix", () => {
    // This is the case the corpus would exploit unaided: `library` is declared
    // as "one `<bib-slug>/` per ingested document". Escaping AFTER the code
    // substitution would turn the emitted <code> into text and leave the
    // description's own brackets live.
    expect(describeText("one `<bib-slug>/` per document"))
      .toBe("one <code>&lt;bib-slug&gt;/</code> per document");
  });

  test("markup outside a span is escaped, never emitted", () => {
    expect(describeText('<img src=x onerror="alert(1)">'))
      .toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(describeText("a & b")).toBe("a &amp; b");
  });

  test("an UNPAIRED backtick is left alone, not greedy to end of line", () => {
    // A greedy or unanchored match would swallow the rest of the text into a
    // code element that the author never opened.
    expect(describeText("a ` b")).toBe("a ` b");
    expect(describeText("`open and never closed")).toBe("`open and never closed");
  });

  test.skipIf(dashboardsNotBuilt("beans", "todos", "qa", "health", "issue-marks", "uploads"))("the corpus renders with no literal backtick left in a registry row", () => {
    // The end-to-end half: whatever the declarations say today, no dashboard
    // shows a raw backtick in the descriptions it lists.
    for (const id of ["beans", "todos", "qa", "health", "issue-marks", "uploads"]) {
      const body = read(id).slice(read(id).indexOf('<ul class="sv-list">'));
      expect(/<p>[^<]*`/.test(body)).toBe(false);
    }
  });
});

describe("orphan dashboards — a page that answers to no declaration", () => {
  // Bean `ankg`. A generator that writes and never deletes leaves a page
  // serving a subject nothing describes, and `--check` was structurally blind
  // to it: it inspected only the files it was about to write, so it could find
  // a page that was WRONG but never one that SHOULD NOT EXIST.

  // The generator's own constant, not a retyped copy: a fixture that restates
  // the value under test agrees with a wrong one just as happily as a right one.
  const MARK = GENERATED_BY;

  /** A site directory with the given pages in it. */
  function site(pages: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), "sv-prune-"));
    for (const [rel, body] of Object.entries(pages)) {
      const abs = join(dir, rel);
      mkdirSync(join(abs, ".."), { recursive: true });
      writeFileSync(abs, body);
    }
    return dir;
  }

  test("a page carrying our marker, under no wanted id, is an orphan", () => {
    const d = site({ "gone/index.html": `<html><!-- ${MARK} --></html>` });
    expect(prunableDashboards(d, ["beans"])).toEqual([join("gone", "index.html")]);
  });

  test("a page for a WANTED id is never an orphan", () => {
    const d = site({ "beans/index.html": `<html><!-- ${MARK} --></html>` });
    expect(prunableDashboards(d, ["beans"])).toEqual([]);
  });

  test("a page WITHOUT our marker is never touched, even with nothing wanted", () => {
    // The safety argument, as a test. The site holds `guides/`, `reference/`,
    // `assets/`, `api/` and the translated trees — none of them ours. Selecting
    // on the directory instead of the marker would take all of them.
    const d = site({
      "guides/index.html": "<html>hand-authored</html>",
      "reference/index.html": "<html>another generator</html>",
      "assets/index.html": "<html></html>",
    });
    expect(prunableDashboards(d, [])).toEqual([]);
  });

  test("a directory with no index.html at all is not a candidate", () => {
    const d = site({ "stuff/notes.md": "# notes" });
    expect(prunableDashboards(d, [])).toEqual([]);
  });

  test("ours and theirs side by side: only ours is selected", () => {
    const d = site({
      "gone/index.html": `<html><!-- ${MARK} --></html>`,
      "guides/index.html": "<html>hand-authored</html>",
      "beans/index.html": `<html><!-- ${MARK} --></html>`,
    });
    expect(prunableDashboards(d, ["beans"])).toEqual([join("gone", "index.html")]);
  });

  test("a site that does not exist yields nothing rather than throwing", () => {
    expect(prunableDashboards(join(tmpdir(), "sv-prune-absent-xyz"), [])).toEqual([]);
  });

  test.skipIf(dashboardsNotBuilt("beans", "todos", "qa", "attestations", "health", "issue-marks", "merge-reviews", "uploads", "swimlane-glossary"))("ON THE REAL CORPUS: an empty keep-set selects only pages we wrote", () => {
    // The strongest statement available: ask for the worst case — nothing is
    // wanted — and assert the answer is exactly this generator's own pages,
    // never one of the site's other directories.
    const dashboards = ["beans", "todos", "qa", "attestations", "health", "issue-marks", "merge-reviews", "uploads", "swimlane-glossary"].map(visOf);
    // And the hub at a per-instance visualiser's own route (#294: code and the
    // registry kinds), read from the declaration through the writer's own
    // selection rather than listed, so a new hub is ours without an edit here.
    const hubs = (readDeclaration(ROOT)?.visualisers ?? [])
      .filter((v) => v.renderedBy === VIEWER_TOOL && v.subgraphs === "instance")
      .filter((v) => {
        const p = perInstanceSubjects(v, ROOT, readDeclaration(ROOT)?.name ?? "cat-harness");
        return p.unread.length === 0 && drawsInstanceHub(p.kinds, dashboards.includes(v.id), p.subjects.length);
      })
      .map((v) => v.id);
    expect(hubs.length, "the declaration draws no hub, so this half tests nothing").toBeGreaterThan(0);
    const ours = [...dashboards, ...hubs];
    const selected = prunableDashboards(dashboardsDir(), []);
    expect(selected.sort()).toEqual(ours.map((g) => join(g, "index.html")).sort());
    // And the site root holds none: every dashboard moved to its route.
    expect(prunableDashboards(SITE, [])).toEqual([]);
  });
});


describe("the renderer is chosen by the projection's `$schema`, not by the graph's id", () => {
  // This was `g.id === "beans" ? beans-meta : todo-meta` — a DEFAULT rather
  // than a choice, so every projection that was not beans got the todo
  // renderer. It survived because only two existed. The third (`qa`, bean
  // `py74`) would have mounted the work-plan renderer over a document with no
  // `items` array, and the page would have claimed `live` above a container
  // that rendered nothing — worse than honestly saying `declared`, which is
  // the defect `flh4` already paid for one state over.

  test.skipIf(dashboardsNotBuilt("qa"))("the qa page mounts NO work-plan container and declares no src meta", () => {
    const html = read("qa");
    expect(/<div class="fa-workplan" data-fa-workplan>/.test(html)).toBe(false);
    // The bare strings appear in the INLINED renderer's own source, which
    // queries for both. Asserted as the element, the way the sibling test
    // above already learned to.
    expect(/<meta name="fa-(beans|todo)-src"/.test(html)).toBe(false);
  });

  test.skipIf(dashboardsNotBuilt("beans", "todos"))("beans and todos still get theirs, so the dispatch did not simply stop working", () => {
    // Themed (#2418): the work-plan container, asked for beans only.
    expect(read("beans")).toContain('data-fa-workplan-only="beans"');
    // The todo projection still gets ITS renderer — the sticky board, by way
    // of the landing panel on a themed page (#1906) — rather than falling
    // through to the "no renderer" or `declared` sentence.
    const todos = read("todos");
    expect(todos).toContain("{% include landing.html open=true %}");
    expect(todos).not.toContain("has no renderer for");
  });

  test.skipIf(dashboardsNotBuilt("qa"))("the qa page renders one panel per family, server-side", () => {
    const html = read("qa");
    for (const fam of ["kg-qa/v1", "qa-witness/v1", "block-qa/v1"]) {
      expect(html).toContain(`<code>${fam}</code>`);
    }
  });

  test.skipIf(dashboardsNotBuilt("qa"))("and SAYS there is no total, rather than leaving its absence to be noticed", () => {
    // The ruling is that no cross-family number exists. A reader who finds
    // none and is told nothing will assume the page is unfinished.
    const html = read("qa");
    expect(html).toContain("no total across these families");
    // The three disagreements are named, so the claim is checkable on the page.
    expect(html).toContain("<code>totals</code>");
    expect(html).toContain("<code>counts</code>");
    expect(html).toContain("<code>warn</code>");
  });

  test.skipIf(dashboardsNotBuilt("qa"))("both third states are printed even at zero", () => {
    // A count that appears only when non-zero cannot be told from one nobody
    // measured — which is the whole reason this graph had no projection.
    const html = read("qa");
    expect(html).toContain("could not determine");
    expect(html).toMatch(/\d+ would not parse/);
  });
});

describe("the bucket counts are a KPI row, not nested panels", () => {
  // Found by SCREENSHOTTING the page, not by reading the markup: the counts
  // were `.sv-item` cards nested inside the family's own `.sv-item`, so a
  // label and an integer carried the same visual weight as the panel
  // containing them, and nine of them filled half the page.

  test.skipIf(dashboardsNotBuilt("qa"))("each count is a stat tile with a value and a label", () => {
    const html = read("qa");
    expect(html).toContain('<ul class="sv-counts">');
    expect(html).toMatch(/<li class="sv-count"><span class="sv-count-v">\d+<\/span><span class="sv-count-k">/);
  });

  test.skipIf(dashboardsNotBuilt("qa"))("a count is never a `.sv-item`, which is the registry's card", () => {
    // The regression this guards: reusing `.sv-item` here is what made a
    // bucket look like a peer of the family that contains it.
    const panels = read("qa").split(/<h2 class="sv-h2"[^>]*>State graphs/)[0] ?? "";
    expect(panels).toContain("sv-count");
    expect(panels).not.toContain('<li class="sv-item">');
  });

  test.skipIf(dashboardsNotBuilt("qa"))("no bucket carries a status colour", () => {
    // fail/pass/warn are status words and the status palette is right for them
    // in general. Here it would assert a shared scale across families that
    // deliberately have none — one has `warn`, the other has no concept of it.
    const panels = read("qa").split(/<h2 class="sv-h2"[^>]*>State graphs/)[0] ?? "";
    expect(panels).not.toMatch(/sv-count[^"]*"[^>]*class="[^"]*is-(declared|live|elsewhere|unresolved)/);
    expect(panels).not.toMatch(/<li class="sv-count"[^>]*style=/);
  });
});

describe("the e2e spec's copy of the marker agrees with the generator's — bean `5wrg`", () => {
  // `state-dashboards.e2e.ts` discovers dashboards by the marker, and CANNOT
  // import it: `state-visualizer.ts` calls `HARNESS_ROOT`
  // at module scope, and `import.meta.dir` is a Bun extension that is
  // `undefined` under Node — which is what Playwright runs specs with.
  //
  // So the string is duplicated, and this checks it. An unavoidable duplicate
  // is fine; an unchecked one is not.

  test("the spec carries the exact marker the generator writes", () => {
    const spec = readFileSync(join(TOOLS_ROOT, "test", "ui", "state-dashboards.e2e.ts"), "utf-8");
    expect(spec).toContain(`const MARKER = ${JSON.stringify(GENERATED_BY)};`);
  });

  test.skipIf(dashboardsNotBuilt("qa"))("and the marker is really in the pages, so neither copy is hypothetical", () => {
    // Guards the case where both copies agree and both are wrong.
    expect(read("qa")).toContain(GENERATED_BY);
  });
});

describe("per-instance QA pages (bean folio-assistant-1nu0)", () => {
  const dir = (o: { id?: string; path?: string; absPath: string; declaredBy: string; member?: string; kinds?: string[] }) => ({
    id: o.id ?? "qa",
    path: o.path ?? "test/results/",
    absPath: o.absPath,
    declaredBy: o.declaredBy,
    ...(o.member ? { member: o.member } : {}),
    graphTypologies: o.kinds ?? ["qa"],
  });

  test("one subject per instance holding the kind, named by its member, sorted", () => {
    const subjects = instanceSubjectsOf(
      [
        dir({ absPath: "/x/who-iris/test/results", declaredBy: "who-iris" }),
        dir({ absPath: "/x/cat-harness-tools/test/results", declaredBy: "cat-harness", member: "cat-harness-tools" }),
        dir({ absPath: "/x/cat-harness/test/results", declaredBy: "cat-harness" }),
        dir({ id: "beans", path: "beans/", absPath: "/x/cat-harness/beans", declaredBy: "cat-harness", kinds: ["beans"] }),
      ],
      ["qa"],
    );
    expect(subjects.map((s) => s.name)).toEqual(["cat-harness", "cat-harness-tools", "who-iris"]);
  });

  test("the instance root is recovered from the declared path, not composed", () => {
    const [s] = instanceSubjectsOf([dir({ absPath: "/x/who-iris/test/results", declaredBy: "who-iris" })], ["qa"]);
    expect(s!.instanceRoot).toBe("/x/who-iris");
  });

  test("a declared directory that is not on disk still gets a subject, so its tile has a page", () => {
    // Derived QA lives on qa-reports: an absent tree is the normal case.
    const absent = join(tmpdir(), "sv-qa-absent-xyz", "test", "results");
    expect(existsSync(absent)).toBe(false);
    expect(instanceSubjectsOf([dir({ absPath: absent, declaredBy: "smart-base" })], ["qa"]).map((s) => s.name)).toEqual(["smart-base"]);
  });

  test("an instance page with no corpus says UNKNOWN, links back and to its siblings", () => {
    const subjects = instanceSubjectsOf(
      [
        dir({ absPath: "/x/a/test/results", declaredBy: "a" }),
        dir({ absPath: "/x/b/test/results", declaredBy: "b" }),
      ],
      ["qa"],
    );
    const html = instanceSubjectPage({ id: "qa", title: "QA results" }, subjects[0]!, subjects, {
      $schema: "folio-qa-graph/v1",
      availability: "unknown",
      reason: "not fetched",
    });
    expect(html).toContain("<strong>unknown</strong>, not zero");
    expect(html).toContain('href="../"');
    expect(html).toContain('href="../b/"');
    expect(html).not.toContain('href="../a/"');
    expect(html).toContain(GENERATED_BY);
  });

  test("an instance page with a corpus renders its families", () => {
    const [s] = instanceSubjectsOf([dir({ absPath: "/x/a/test/results", declaredBy: "a" })], ["qa"]);
    const html = instanceSubjectPage({ id: "qa" }, s!, [s!], {
      $schema: "folio-qa-graph/v1",
      files: 2,
      families: [{ schema: "kg-qa/v1", files: 2, rollUpField: "totals", buckets: { pass: 3 } }],
      unclassified: 0,
      unreadable: 0,
    } as never);
    expect(html).toContain("<code>kg-qa/v1</code>");
    expect(html).toContain("over 2 document(s)");
  });
});

describe("per-instance beans pages (bean folio-assistant-1nu0)", () => {
  const subj = (name: string) => ({ name, path: "beans/", absPath: `/x/${name}/beans`, instanceRoot: `/x/${name}` });
  const bean = (id: string, status: string, priority = "normal") => ({
    id, file: `beans/defs/${id}.md`, title: `title of ${id}`, status, type: "task", priority, parent: "",
    blocking: [], blockedBy: [], createdAt: "", updatedAt: "", body: "", tags: [], targets: [],
  });

  test("lists the store's OPEN beans, by priority, and counts the rest", () => {
    const s = [subj("a"), subj("b")];
    const html = beansSubjectPage({ id: "beans" }, s[0]!, s, {
      beans: [bean("a-1", "todo"), bean("a-2", "completed"), bean("a-3", "in-progress", "high")] as never,
    });
    expect(html).toContain("Open in a's own store — 2 of 3 bean(s)");
    expect(html).toContain("The Beans badge in the navbar counts");
    expect(html.indexOf("a-3")).toBeLessThan(html.indexOf("a-1"));
    expect(html).not.toContain("<code>a-2</code>");
    expect(html).toContain('href="../b/"');
    expect(html).toContain(GENERATED_BY);
  });

  test("an unreachable store is UNKNOWN, and no store is not an empty one", () => {
    const s = [subj("a")];
    expect(beansSubjectPage({ id: "beans" }, s[0]!, s, { unreachable: "not mounted" })).toContain("<strong>unknown</strong>, not zero");
    expect(beansSubjectPage({ id: "beans" }, s[0]!, s, { beans: null })).toContain("no store, not an empty one");
  });
});

describe("a bean store's notes and workflow instances (bean folio-assistant-750a)", () => {
  test("the store's parts are the kinds its page draws", () => {
    expect([...BEAN_STORE_KINDS].sort()).toEqual([
      "bean-defs",
      "bean-notes",
      "beans",
      "merge-queue",
      "session-survey",
      "sweep-marks",
      "workflow-state",
    ]);
  });

  test("lists the merge steward's decisions, links each PR, and keeps a bad entry visible (bean folio-assistant-30jr)", () => {
    const store = mkdtempSync(join(tmpdir(), "bean-store-"));
    try {
      writeFileSync(
        join(store, "beans.json"),
        JSON.stringify({ name: "x", directories: [{ id: "queue", path: "queue", graphTypologies: ["merge-queue"] }] }),
      );
      mkdirSync(join(store, "queue"));
      writeFileSync(join(store, "queue", "README.md"), "index\n");
      writeFileSync(
        join(store, "queue", "o--r--7.json"),
        JSON.stringify({
          $schema: "folio-merge-queue-entry/v1",
          repository: "o/r",
          pr: 7,
          placement: { kind: "override", position: 1, reason: "owner named it first" },
          reason: "owner: <first>",
          decidedBy: "owner",
          decidedAt: "2026-10-04T13:50:00Z",
          hold: { waitsOn: "o/r#6", since: "2026-10-04T13:50:00Z", expires: "2026-10-05T13:50:00Z", handoff: "steward" },
          status: "blocked",
        }),
      );
      // A GitHub fact on an entry: refused by name, and still listed.
      writeFileSync(
        join(store, "queue", "o--r--8.json"),
        JSON.stringify({ $schema: "folio-merge-queue-entry/v1", repository: "o/r", pr: 8, headSha: "a".repeat(40) }),
      );
      const html = beanStorePartsSection(store);
      expect(html).toContain("Merge queue — 1 decision(s), 1 unreadable");
      expect(html).toContain('<a href="https://github.com/o/r/pull/7">o/r#7</a>');
      expect(html).toContain("<td>blocked</td><td>override, position 1</td><td>on o/r#6 until 2026-10-05T13:50:00Z</td>");
      expect(html).toContain("owner: &lt;first&gt;");
      expect(html).toContain("<code>o--r--8.json</code>");
      expect(html).toContain("headSha: `headSha` is a fact GitHub owns");
      expect(html).not.toContain("README");
    } finally {
      rmSync(store, { recursive: true, force: true });
    }
  });

  test("lists the notes and the instances its beans.json declares, read from disk", () => {
    const store = mkdtempSync(join(tmpdir(), "bean-store-"));
    try {
      writeFileSync(
        join(store, "beans.json"),
        JSON.stringify({
          name: "x",
          directories: [
            { id: "notes", path: "notes", graphTypologies: ["bean-notes"] },
            { id: "workflows", path: "workflows", graphTypologies: ["workflow-state"] },
          ],
        }),
      );
      mkdirSync(join(store, "notes"));
      writeFileSync(join(store, "notes", "x-ab12--2026-10-15--claude-some-branch.md"), "---\n---\n");
      writeFileSync(join(store, "notes", "README.md"), "index\n");
      mkdirSync(join(store, "workflows"));
      writeFileSync(
        join(store, "workflows", "crdm--x-ab12.json"),
        JSON.stringify({ $schema: "folio-workflow-instance/v1", id: "crdm--x-ab12", processId: "Process_CRDM", status: "running", tokens: ["A_Step"], bean: "x-ab12" }),
      );
      const html = beanStorePartsSection(store);
      expect(html).toContain("Bean notes — 1");
      expect(html).toContain("<td>claude-some-branch</td>");
      expect(html).not.toContain("README");
      expect(html).toContain("Workflow instances — 1");
      expect(html).toContain("<td>Process_CRDM</td><td>running</td><td>A_Step</td>");
      // Liquid-safe: the data sits inside one raw block.
      expect(html.startsWith("{% raw %}")).toBe(true);
    } finally {
      rmSync(store, { recursive: true, force: true });
    }
  });

  test("a store declaring no parts lists none, rather than guessing paths", () => {
    const store = mkdtempSync(join(tmpdir(), "bean-store-"));
    try {
      mkdirSync(join(store, "notes"));
      writeFileSync(join(store, "notes", "x-1--2026-10-15--b.md"), "");
      const html = beanStorePartsSection(store);
      expect(html).toContain("Bean notes — 0");
      expect(html).toContain("Workflow instances — 0");
      expect(html).toContain("No merge-queue decision recorded in this store.");
      expect(html).toContain("No session survey recorded in this store.");
      expect(html).toContain("No sweep mark recorded in this store.");
    } finally {
      rmSync(store, { recursive: true, force: true });
    }
  });

  test("lists session surveys and sweep marks, and keeps a bad entry visible (bean folio-assistant-750a)", () => {
    const store = mkdtempSync(join(tmpdir(), "bean-store-"));
    try {
      writeFileSync(
        join(store, "beans.json"),
        JSON.stringify({
          name: "x",
          directories: [
            { id: "surveys", path: "surveys", graphTypologies: ["session-survey"] },
            { id: "marks", path: "marks", graphTypologies: ["sweep-marks"] },
          ],
        }),
      );
      mkdirSync(join(store, "surveys"));
      writeFileSync(join(store, "surveys", "README.md"), "index\n");
      writeFileSync(
        join(store, "surveys", "aaaa.json"),
        JSON.stringify({
          $schema: "folio-session-survey/v1",
          from: "a".repeat(40),
          to: "b".repeat(40),
          branch: "origin/main",
          takenAt: "2026-10-20T09:00:00Z",
          by: "session <x>",
          commits: 12,
          axes: [
            { axis: "beans", covered: true, finding: "ok" },
            { axis: "ci", covered: false, finding: "not looked at" },
          ],
        }),
      );
      // A ref for an edge: refused by the schema, and still listed.
      writeFileSync(
        join(store, "surveys", "bbbb.json"),
        JSON.stringify({ $schema: "folio-session-survey/v1", from: "origin/main" }),
      );
      mkdirSync(join(store, "marks"));
      writeFileSync(
        join(store, "marks", "session-staleness.json"),
        JSON.stringify({ $schema: "folio-sweep-mark/v1", check: "session-staleness", checkedAt: "2026-10-20T09:00:00Z", read: 4, findings: 1 }),
      );
      writeFileSync(join(store, "marks", "broken.json"), "{");
      const html = beanStorePartsSection(store);
      expect(html).toContain("Session surveys — 1 survey(s), 1 unreadable");
      expect(html).toContain(`<code>${"a".repeat(12)}..${"b".repeat(12)}</code></td><td>origin/main</td><td>12</td><td>1 of 2</td>`);
      expect(html).toContain("session &lt;x&gt;");
      expect(html).toContain("<code>bbbb.json</code>");
      expect(html).toContain("not a valid entry — from:");
      expect(html).toContain("Sweep marks — 1 mark(s), 1 unreadable");
      expect(html).toContain("<td><code>session-staleness</code></td><td>2026-10-20T09:00:00Z</td><td></td><td>4</td><td>1</td>");
      expect(html).toContain("<code>broken.json</code></td><td colspan=\"4\">not readable JSON");
      expect(html).not.toContain("README");
    } finally {
      rmSync(store, { recursive: true, force: true });
    }
  });
});

describe("the todo graph's feedback and boards (bean folio-assistant-750a)", () => {
  const graph = (store: string) =>
    writeFileSync(
      join(store, "todos.json"),
      JSON.stringify({
        name: "x",
        directories: [
          { id: "items", path: "items", graphTypologies: ["todo-items"] },
          { id: "feedback", path: "feedback", graphTypologies: ["todo-feedback"] },
          { id: "boards", path: "boards", graphTypologies: ["boards"] },
          { id: "positions", path: "boards", graphTypologies: ["board-positions"] },
        ],
      }),
    );

  test("lists each feedback todo's block, submitter and status, and each board's filter and placed notes", () => {
    const store = mkdtempSync(join(tmpdir(), "todo-graph-"));
    try {
      graph(store);
      mkdirSync(join(store, "feedback"));
      writeFileSync(
        join(store, "feedback", "fix-the-lemma.md"),
        "---\n$schema: todo/1.0.0\nid: fix-the-lemma\nsummary: \"The lemma <is> wrong\"\nstatus: open\npriority: high\n" +
          "origin: review\ncreatedAt: 2026-10-20\ntargetLabel: sec:ch1-lemma-2\nidentities:\n  - github:reviewer\n---\nBody.\n",
      );
      // Declares no todo tag: listed with the reason, not dropped.
      writeFileSync(join(store, "feedback", "stray.md"), "---\nid: stray\n---\n");
      writeFileSync(join(store, "feedback", "README.md"), "index\n");
      mkdirSync(join(store, "boards"));
      writeFileSync(join(store, "boards", "whole.json"), JSON.stringify({ $schema: "folio-board/v1", id: "whole", title: "Whole" }));
      writeFileSync(
        join(store, "boards", "ch1.json"),
        JSON.stringify({ $schema: "folio-board/v1", id: "ch1", title: "Chapter 1", filter: { pages: ["ch1"], kinds: ["lemma"] } }),
      );
      // An empty filter is refused by BoardFilterSchema, and still listed.
      writeFileSync(join(store, "boards", "bad.json"), JSON.stringify({ $schema: "folio-board/v1", id: "bad", title: "Bad", filter: {} }));
      writeFileSync(
        join(store, "boards", "board-positions.json"),
        JSON.stringify({ $schema: "folio-board-positions/v1", boards: { ch1: { "fix-the-lemma": { x: 1, y: 2 }, other: { x: 3, y: 4 } } } }),
      );
      const html = todoStorePartsSection(store);
      expect(html).toContain("Feedback — 1 todo(s), 1 unreadable");
      expect(html).toContain(
        "<td><code>fix-the-lemma</code><br>The lemma &lt;is&gt; wrong</td><td><code>sec:ch1-lemma-2</code></td><td>github:reviewer</td><td>open</td>",
      );
      expect(html).toContain("<code>stray.md</code></td><td colspan=\"3\">carries no");
      expect(html).toContain("Boards — 2 board(s), 1 unreadable");
      expect(html).toContain("<td><code>ch1</code></td><td>Chapter 1</td><td>pages: ch1; kinds: lemma</td><td>2</td>");
      expect(html).toContain("<td><code>whole</code></td><td>Whole</td><td>the whole folio</td><td>0</td>");
      expect(html).toContain("<code>bad.json</code>");
      // The positions file is a part of its own, not a board.
      expect(html).not.toContain("<code>board-positions.json</code></td>");
      expect(html).not.toContain("README");
      expect(html.startsWith("{% raw %}")).toBe(true);
      // And the todos page carries it below the board.
      const page = todoBoardPage({ description: "Todos." }, store);
      expect(page).toContain("{% include landing.html open=true %}");
      expect(page).toContain('id="todo-feedback"');
    } finally {
      rmSync(store, { recursive: true, force: true });
    }
  });

  test("an empty graph says so, part by part", () => {
    const store = mkdtempSync(join(tmpdir(), "todo-graph-"));
    try {
      graph(store);
      mkdirSync(join(store, "feedback"));
      mkdirSync(join(store, "boards"));
      const html = todoStorePartsSection(store);
      expect(html).toContain("No feedback todo recorded in this graph.");
      expect(html).toContain("No board recorded in this graph.");
      expect(html).toContain("no note has been placed on any board");
    } finally {
      rmSync(store, { recursive: true, force: true });
    }
  });
});

describe("per-instance health and attestations pages (bean folio-assistant-1nu0)", () => {
  const dir = (o: { id: string; path: string; absPath: string; declaredBy: string; member?: string; kinds: string[] }) => ({
    ...o,
    graphTypologies: o.kinds,
  });

  test("health and attestations have a per-instance renderer; a kind without one does not", () => {
    expect(PER_INSTANCE_KINDS.has("health")).toBe(true);
    expect(PER_INSTANCE_KINDS.has("attestations")).toBe(true);
    expect(PER_INSTANCE_KINDS.has("beans")).toBe(false);
  });

  test("subjects of `health` are every instance declaring it, whatever its path", () => {
    const subjects = instanceSubjectsOf(
      [
        dir({ id: "health", path: "test/health/results/", absPath: "/x/cat-harness/test/health/results", declaredBy: "cat-harness", kinds: ["health"] }),
        dir({ id: "health", path: "health/", absPath: "/x/cat-harness-tools/health", declaredBy: "cat-harness-tools", kinds: ["health"] }),
        dir({ id: "qa", path: "test/results/", absPath: "/x/who-iris/test/results", declaredBy: "who-iris", kinds: ["qa"] }),
      ],
      ["health"],
    );
    expect(subjects.map((s) => s.name)).toEqual(["cat-harness", "cat-harness-tools"]);
    expect(subjects[1]!.instanceRoot).toBe("/x/cat-harness-tools");
  });

  test("an absent health directory is UNKNOWN, not zero, and the page says no QA no-total claim", () => {
    const absent = join(tmpdir(), "sv-health-absent-xyz", "test", "health", "results");
    expect(existsSync(absent)).toBe(false);
    const [s] = instanceSubjectsOf(
      [dir({ id: "health", path: "test/health/results/", absPath: absent, declaredBy: "who-iris", kinds: ["health"] })],
      ["health"],
    );
    const ix = projectInstanceSubject(s!, ["health"]);
    expect((ix as { availability?: string }).availability).toBe("unknown");
    const html = instanceSubjectPage({ id: "health", coversKinds: ["health"] }, s!, [s!], ix);
    expect(html).toContain("<strong>unknown</strong>, not zero");
    expect(html).toContain("test/health/results/");
    expect(html).toContain(GENERATED_BY);
  });

  test("a present attestations directory is counted by its documents' $schema", () => {
    const root = mkdtempSync(join(tmpdir(), "sv-att-"));
    const at = join(root, "test", "attestations", "kg-qa");
    mkdirSync(at, { recursive: true });
    writeFileSync(join(at, "a.attestations.json"), JSON.stringify({ $schema: "qa-attestations/v1", subject: "a" }));
    writeFileSync(join(at, "b.attestations.json"), JSON.stringify({ $schema: "qa-attestations/v1", subject: "b" }));
    try {
      const [s] = instanceSubjectsOf(
        [dir({ id: "attestations", path: "test/attestations/", absPath: join(root, "test", "attestations"), declaredBy: "folio-assistant-sci", kinds: ["attestations"] })],
        ["attestations"],
      );
      expect(s!.instanceRoot).toBe(resolve(root));
      const html = instanceSubjectPage({ id: "attestations", coversKinds: ["attestations"] }, s!, [s!]);
      expect(html).toContain("<code>qa-attestations/v1</code>");
      expect(html).toContain("over 2 document(s)");
      expect(html).not.toContain("three silent decisions");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("per-instance registry pages (bean folio-assistant-k7ro)", () => {
  test("every registry kind draws per instance", () => {
    for (const k of ["typologies", "validators", "qa-checkers", "block-kinds", "content-adapters", "code-list", "pipeline-plugins", "editor-checkers"]) {
      expect(REGISTRY_KINDS.has(k)).toBe(true);
      expect(PER_INSTANCE_KINDS.has(k)).toBe(true);
    }
  });

  test("a registry page lists each node, by id and title, and is not run through Liquid", () => {
    const root = mkdtempSync(join(tmpdir(), "sv-reg-"));
    const at = join(root, "validators");
    mkdirSync(at, { recursive: true });
    writeFileSync(join(at, "b.json"), JSON.stringify({ $schema: "folio-validator/v1", id: "b-check", title: "Checks {{ b }}" }));
    writeFileSync(join(at, "a.json"), JSON.stringify({ $schema: "folio-validator/v1", summary: "no id here" }));
    writeFileSync(join(at, "bad.json"), "{not json");
    try {
      const rows = registryRowsOf(at);
      expect(rows.map((r) => r.id)).toEqual(["a", "b-check", "bad"]);
      expect(rows[0]!.text).toBe("no id here");
      expect(rows[2]!.note).toBe("does not parse as JSON");
      const [s] = instanceSubjectsOf(
        [{ id: "v", path: "validators/", absPath: at, declaredBy: "x", graphTypologies: ["validators"] }],
        ["validators"],
      );
      const html = instanceSubjectPage({ id: "validators", title: "Validators", coversKinds: ["validators"] }, s!, [s!]);
      expect(html).toContain("render_with_liquid: false");
      expect(html).toContain("Nodes — 3");
      expect(html).toContain("<code>b-check</code>");
      expect(html).toContain("Checks {{ b }}");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the listed kinds draw per instance as registries do, JSON-LD included (bean folio-assistant-6gme)", () => {
    for (const k of ["scenarios", "policies", "test-plan", "tool-release", "vocab-mapping", "substrate-snapshot"]) {
      expect(LISTED_KINDS).toContain(k);
      expect(REGISTRY_KINDS.has(k)).toBe(true);
      expect(PER_INSTANCE_KINDS.has(k)).toBe(true);
    }
    const root = mkdtempSync(join(tmpdir(), "sv-listed-"));
    const at = join(root, "policies");
    mkdirSync(at, { recursive: true });
    writeFileSync(join(at, "defaults.jsonld"), JSON.stringify({ "@type": "Set", description: "the floor" }));
    try {
      expect(registryRowsOf(at).map((r) => [r.id, r.text])).toEqual([["defaults", "the floor"]]);
      const [s] = instanceSubjectsOf([{ id: "policies", path: "policies/", absPath: at, declaredBy: "x", graphTypologies: ["policies"] }], ["policies"]);
      const html = instanceSubjectPage({ id: "policies", title: "Policies", coversKinds: ["policies"] }, s!, [s!]);
      // The census counts the file the table lists, rather than "0 documents" over one node.
      expect(html).toContain("over 1 document(s)");
      expect(html).toContain("Nodes — 1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a QA page carries no node table and keeps Liquid as it was", () => {
    const [s] = instanceSubjectsOf([{ id: "qa", path: "test/results/", absPath: "/x/a/test/results", declaredBy: "a", graphTypologies: ["qa"] }], ["qa"]);
    const html = instanceSubjectPage({ id: "qa", coversKinds: ["qa"] }, s!, [s!], { $schema: "folio-qa-graph/v1", availability: "unknown", reason: "x" } as never);
    expect(html).not.toContain("render_with_liquid");
    expect(html).not.toContain("Nodes —");
  });

  test("a QA page whose layer keeps its results on a branch loads them in the browser", () => {
    const [s] = instanceSubjectsOf(
      [{ id: "qa", path: "test/results/", absPath: "/x/a/test/results", declaredBy: "a", graphTypologies: ["qa"], storage: { branch: "cat/cat-harness/qa-reports", keyedBy: "commit" } }],
      ["qa"],
    );
    expect(s!.storage).toBe("cat/cat-harness/qa-reports");
    const live = { repository: "o/a", ref: "a".repeat(40), branch: "cat/cat-harness/qa-reports", root: "a/test/results" };
    const html = instanceSubjectPage({ id: "qa", coversKinds: ["qa"] }, s!, [s!], { $schema: "folio-qa-graph/v1", availability: "unknown", reason: "x" } as never, live);
    expect(html).toContain('class="sv-qa-live"');
    expect(html).toContain("render_with_liquid: false");
    expect(html).not.toContain("Not available in this build");
  });

  test("the hub lists every instance page", () => {
    const html = instanceHubPage({ id: "validators", title: "Validators" }, [
      { name: "a", path: "validators/", absPath: "/x/a/validators", instanceRoot: "/x/a" },
      { name: "b", path: "validators/", absPath: "/x/b/validators", instanceRoot: "/x/b" },
    ]);
    expect(html).toContain('<a href="a/">a</a>');
    expect(html).toContain('<a href="b/">b</a>');
    expect(html).toContain(GENERATED_BY);
  });
});

describe("per-instance code pages (bean folio-assistant-svgx)", () => {
  const dir = (o: { id: string; path: string; absPath: string; declaredBy: string; member?: string; kinds: string[]; description?: string }) => ({
    ...o,
    graphTypologies: o.kinds,
  });
  const dirs = [
    dir({ id: "scripts", path: "scripts/", absPath: "/x/core/scripts", declaredBy: "core", kinds: ["code"] }),
    dir({ id: "pipeline", path: "pipeline/", absPath: "/x/core/pipeline", declaredBy: "core", kinds: ["cat-harness", "code"], description: "the pipeline" }),
    dir({ id: "docs", path: "docs/", absPath: "/x/core/docs", declaredBy: "core", kinds: ["docs"] }),
    dir({ id: "scripts", path: "scripts/", absPath: "/x/other/scripts", declaredBy: "other", kinds: ["code"] }),
  ];

  test("an instance's code page lists EVERY code directory it declares, not just the first", () => {
    const got = codeDirectoriesOf(dirs, "core", ["code"]);
    expect(got.map((d) => d.id)).toEqual(["scripts", "pipeline"]);
    expect(got[1]!.description).toBe("the pipeline");
    expect(instanceSubjectsOf(dirs, ["code"]).map((s) => s.name)).toEqual(["core", "other"]);
  });

  test("files are listed relative to the directory, sorted, skipping node_modules and dot directories; absent is null", () => {
    const tmp = mkdtempSync(join(tmpdir(), "code-list-"));
    try {
      for (const f of ["b.ts", "a/x.ts", "node_modules/m/i.js", ".git/HEAD"]) {
        mkdirSync(dirname(join(tmp, f)), { recursive: true });
        writeFileSync(join(tmp, f), "");
      }
      expect(listCodeFiles(tmp)).toEqual({ files: ["a/x.ts", "b.ts"], total: 2 });
      expect(listCodeFiles(tmp, 1)).toEqual({ files: ["a/x.ts"], total: 2 });
      expect(listCodeFiles(join(tmp, "absent"))).toBeNull();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("links go to GitHub at the pinned commit from index.lock.json, and nowhere when not locked", () => {
    const tmp = mkdtempSync(join(tmpdir(), "code-lock-"));
    try {
      writeFileSync(
        join(tmp, "index.lock.json"),
        JSON.stringify({ mounts: [{ harness: "core", repository: "o/core", ref: "0123456789abcdef0123456789abcdef01234567" }] }),
      );
      expect(pinnedBlobBase(tmp, "core")).toBe("https://github.com/o/core/blob/0123456789abcdef0123456789abcdef01234567/");
      expect(pinnedBlobBase(tmp, "other")).toBeUndefined();
      expect(pinnedBlobBase(join(tmp, "absent"), "core")).toBeUndefined();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("the page links each file, says unknown for an absent directory, and turns Liquid off", () => {
    const subjects = instanceSubjectsOf(dirs, ["code"]);
    const core = subjects.find((s) => s.name === "core")!;
    const html = codeSubjectPage(
      { id: "code", title: "Code" },
      core,
      subjects,
      codeDirectoriesOf(dirs, "core", ["code"]),
      "https://github.com/o/core/blob/abc1234/",
      (p) => (p.endsWith("scripts") ? { files: ["{{ x }}.ts"], total: 1 } : null),
    );
    expect(html).toContain("render_with_liquid: false");
    expect(html).toContain('href="https://github.com/o/core/blob/abc1234/scripts/%7B%7B%20x%20%7D%7D.ts"');
    expect(html).toContain("<strong>unknown</strong>, not none");
    expect(html).toContain('<a href="../other/">other</a>');
  });
});

describe("drawsInstanceHub: a per-instance visualiser no dashboard draws gets its own route", () => {
  test("`code` gets a hub (en/cat-harness/code/, 2026-10-15)", () => {
    expect(drawsInstanceHub(["code"], false, 3)).toBe(true);
  });
  test("a registry kind gets a hub", () => {
    expect(drawsInstanceHub([[...REGISTRY_KINDS][0]!], false, 1)).toBe(true);
  });
  test("not when a dashboard already draws the route, nor with no instance pages, nor for a state kind", () => {
    expect(drawsInstanceHub(["code"], true, 3)).toBe(false);
    expect(drawsInstanceHub(["code"], false, 0)).toBe(false);
    expect(drawsInstanceHub(["beans"], false, 2)).toBe(false);
  });
});

describe("per-instance memory pages (the library page's last \"no viewer yet\" row)", () => {
  test("a memory directory's lessons, interaction node and waivers are all listed; absent is null", () => {
    const root = mkdtempSync(join(tmpdir(), "sv-mem-"));
    const at = join(root, "memory");
    mkdirSync(at, { recursive: true });
    writeFileSync(join(at, "README.md"), "# memory\n");
    writeFileSync(join(at, "b-lesson.md"), "---\n$schema: folio-memory/v1\nid: b-lesson\nlabel: trap\nsummary: \"Mind {{ this }}\"\n---\nbody\n");
    writeFileSync(join(at, "a-old.md"), "---\n$schema: folio-memory/v1\nid: a-old\nlabel: stable\nsummary: \"Old\"\narchived: true\n---\n");
    writeFileSync(join(at, "interaction.json"), JSON.stringify({ $schema: "folio-interaction/v1", id: "interaction", title: "How to ask" }));
    writeFileSync(join(at, "bad.json"), "{not json");
    try {
      const rows = memoryRowsOf(at)!;
      expect(rows.map((r) => r.file)).toEqual(["a-old.md", "b-lesson.md", "bad.json", "interaction.json"]);
      expect(rows[0]!.archived).toBe(true);
      expect(rows[1]!.label).toBe("trap");
      expect(rows[1]!.text).toBe("Mind {{ this }}");
      expect(rows[2]!.note).toBe("does not parse as JSON");
      expect(memoryRowsOf(join(root, "absent"))).toBeNull();

      const [s] = instanceSubjectsOf(
        [{ id: "memory", path: "memory/", absPath: at, declaredBy: "x", graphTypologies: ["memory", "waiver", "interaction"] }],
        ["memory"],
      );
      const html = memorySubjectPage({ id: "memory", title: "Memory" }, s!, [s!], "https://github.com/o/x/blob/abc/");
      expect(html).toContain("render_with_liquid: false");
      expect(html).toContain("2 lessons (1 archived), 2 other nodes");
      expect(html).toContain('href="https://github.com/o/x/blob/abc/memory/b-lesson.md"');
      expect(html).toContain("Mind {{ this }}");
      expect(html).toContain(GENERATED_BY);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an instance whose memory is not in the build says unknown, not empty", () => {
    const s = { name: "x", path: "memory/", absPath: "/nowhere/memory", instanceRoot: "/nowhere" };
    const html = memorySubjectPage({ id: "memory" }, s, [s], undefined, null);
    expect(html).toContain("<strong>unknown</strong>, not empty");
  });

  test("memory is drawn per instance, with a hub, and is not refused as unread", () => {
    expect(MEMORY_KINDS.has("memory")).toBe(true);
    expect(drawsInstanceHub(["memory"], false, 2)).toBe(true);
    const p = perInstanceSubjects({ coversKinds: ["memory"] }, ROOT, readDeclaration(ROOT)?.name ?? "cat-harness");
    expect(p.memory).toBe(true);
    expect(p.unread).toEqual([]);
  });
});

describe("pipeline plugins and editor checkers are registries (cat-harness-tools#386)", () => {
  test("a plugin is listed by its slot and rationale", () => {
    const root = mkdtempSync(join(tmpdir(), "sv-plug-"));
    const at = join(root, "pipeline-plugins");
    mkdirSync(at, { recursive: true });
    writeFileSync(join(at, "x.json"), JSON.stringify({ $schema: "folio-pipeline-plugin/v1", slot: "site-publisher-ig", rationale: "builds the IG" }));
    try {
      const [row] = registryRowsOf(at);
      expect(row!.id).toBe("site-publisher-ig");
      expect(row!.text).toBe("builds the IG");
      expect(drawsInstanceHub(["pipeline-plugins"], false, 1)).toBe(true);
      expect(drawsInstanceHub(["editor-checkers"], false, 1)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("merge reviews (bean w8jq)", () => {
  const sha = (c: string) => c.repeat(40);
  const review = (at: string, result: string, flags: unknown[] = []) => ({
    reviewer: { by: "agent", session: "session_rev", model: "m-1" },
    author_sessions: ["session_auth"],
    skill_hash: "h",
    at,
    coverage: { files_total: 2, files_reviewed: 2 },
    result,
    flags,
  });
  const blocking = (id: string, status: string) => ({
    id,
    category: "correctness",
    severity: "major",
    weight: "blocking",
    where: "a.ts:1",
    evidence: "printed 1, expected 2",
    status,
  });

  function store(entries: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), "merge-reviews-"));
    for (const [name, body] of Object.entries(entries)) writeFileSync(join(dir, name), body);
    return dir;
  }

  test("one row per verdict, newest review first, the pull request linked when the repository is named", () => {
    const dir = store({
      [`${sha("a")}.json`]: JSON.stringify({
        $schema: "merge-review/v1",
        repository: "o/r",
        pr: 7,
        base_sha: sha("b"),
        head_sha: sha("a"),
        reviews: [review("2026-10-20T10:00:00Z", "fail", [blocking("f1", "open"), blocking("f2", "resolved")]), review("2026-10-21T10:00:00Z", "fail", [blocking("f1", "open")])],
      }),
      [`${sha("c")}.json`]: JSON.stringify({
        $schema: "merge-review/v1",
        pr: 9,
        base_sha: sha("b"),
        head_sha: sha("c"),
        reviews: [review("2026-10-22T10:00:00Z", "pass")],
      }),
      "manifest.json": "{}",
    });
    try {
      const files = [`${sha("a")}.json`, `${sha("c")}.json`].map((f) => join(dir, f));
      const html = mergeReviewsSection(files);
      expect(html).toContain("Verdicts — 2 verdict(s)");
      expect(html).toContain('<a href="https://github.com/o/r/pull/7">o/r#7</a>');
      // No repository: the number, never a link to a guessed one.
      expect(html).toContain("<td>#9</td>");
      expect(html).not.toContain("/pull/9");
      expect(html).toContain(`<code>${"a".repeat(12)}</code>`);
      expect(html).toContain("fail <span class=\"sv-sub\">(+1 earlier)</span>");
      expect(html).toContain("agent <code>session_rev</code><br>m-1");
      // The LATEST review's open blocking flags: one, not the earlier review's.
      expect(html).toContain("<td>2026-10-21T10:00:00Z</td><td>1</td>");
      // Newest first: the pass of the 22nd before the fail of the 21st.
      expect(html.indexOf("#9")).toBeLessThan(html.indexOf("o/r#7"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an unreadable or invalid file is listed with its reason, never dropped; a misnamed head is said", () => {
    const dir = store({
      "bad.json": "{",
      "invalid.json": JSON.stringify({ $schema: "merge-review/v1", head_sha: sha("d") }),
      "renamed.json": JSON.stringify({ $schema: "merge-review/v1", base_sha: sha("b"), head_sha: sha("e"), repository: "<x>", pr: 3 }),
    });
    try {
      const html = mergeReviewsSection(["bad.json", "invalid.json", "renamed.json"].map((f) => join(dir, f)));
      expect(html).toContain("Verdicts — 1 verdict(s), 2 unreadable");
      expect(html).toContain("<code>bad.json</code> — not readable JSON");
      expect(html).toContain("<code>invalid.json</code> — not a valid verdict — base_sha");
      expect(html).toContain("file is named <code>renamed</code>");
      expect(html).toContain("no review recorded");
      // A repository that is not `owner/repo` is not linked, and not echoed raw.
      expect(html).toContain("<td>#3</td>");
      expect(html).not.toContain("<x>");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an empty store says none; an unmounted one says unknown, not none", () => {
    const g = { id: "merge-reviews", path: "merge-reviews/", kinds: [MERGE_REVIEWS_KIND] };
    const dir = store({ "manifest.json": "{}" });
    try {
      const empty = mergeReviewsPage(g, [], dir);
      expect(empty).toContain("No adversarial review verdict recorded in this store.");
      expect(empty).toContain("render_with_liquid: false");
      expect(empty).toContain(GENERATED_BY);
      const unknown = mergeReviewsPage(g, [], null);
      expect(unknown).toContain("<strong>unknown</strong>, not none");
      expect(unknown).not.toContain("No adversarial review verdict");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the workflow view: per-instance pages and the store's stuck column (bean folio-assistant-v49e)", () => {
  const NOW = new Date("2026-10-24T00:00:00Z");
  const bean = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    file: `defs/${id}.md`,
    title: `bean ${id}`,
    status: "in-progress",
    type: "task",
    priority: "normal",
    parent: "",
    blocking: [],
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-02T00:00:00Z",
    body: "",
    ...over,
  });
  const stale = {
    $schema: "folio-workflow-instance/v1",
    id: "crdm--x-ab12",
    processId: "Process_CRDM",
    source: "gone/crdm.bpmn",
    subject: "x-ab12",
    bean: "x-ab12",
    status: "running",
    tokens: ["A_Step"],
    arrivals: {},
    history: [{ at: "2026-09-01T00:00:00Z", node: "Start", note: "<started>" }],
    startedAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  };

  function storeWith(files: Record<string, unknown>): string {
    const store = mkdtempSync(join(tmpdir(), "bean-store-"));
    writeFileSync(
      join(store, "beans.json"),
      JSON.stringify({ name: "x", directories: [{ id: "workflows", path: "workflows", graphTypologies: ["workflow-state"] }] }),
    );
    mkdirSync(join(store, "workflows"));
    for (const [name, body] of Object.entries(files)) writeFileSync(join(store, "workflows", name), typeof body === "string" ? body : JSON.stringify(body));
    return store;
  }

  test("with a view, each instance links its page and carries its stuck states; the third state is stated", () => {
    const store = storeWith({ "crdm--x-ab12.json": stale });
    try {
      const html = beanStorePartsSection(store, { beans: [bean("x-ab12"), bean("x-cd34")] as never, now: NOW });
      expect(html).toContain('<a href="workflows/crdm--x-ab12/"><code>crdm--x-ab12</code></a>');
      expect(html).toContain("<th>stuck</th>");
      expect(html).toContain("enabled-not-taken");
      expect(html).toContain("is <code>refused-gate</code>");
      expect(html).toContain("Where this store's beans sit in a process — 2 bean(s)");
      expect(html).toContain('<span class="sv-count-v">1</span><span class="sv-count-k">no instance recorded</span>');
      expect(html).toContain("<code>x-cd34</code>");
      expect(html).toContain("That is a third state, not an empty diagram");
      // Without a view the section is as it was: no column, no links.
      const plain = beanStorePartsSection(store);
      expect(plain).not.toContain("<th>stuck</th>");
      expect(plain).not.toContain('href="workflows/');
    } finally {
      rmSync(store, { recursive: true, force: true });
    }
  });

  test("an instance page reads the dynamic-state document when given one (bean 6h47), and says what it was built with", () => {
    const base = {
      instance: stale as never,
      store: "cat-harness",
      model: { missing: "not loaded", recorded: "" },
      beans: [bean("x-ab12")] as never,
      todos: [],
      now: NOW,
      drawingFor: () => undefined,
    };
    const html = workflowInstancePage({ ...base, stateDocument: "../../../../../state.jsonld" });
    expect(html).toContain('data-wv-state="../../../../../state.jsonld"');
    expect(html).toContain(`data-wv-instance="#workflow/cat-harness/${(stale as { id: string }).id}"`);
    expect(html).toContain("Latest exported state");
    expect(html).toContain("enabled-not-taken"); // the build-time stuck kinds ride along in data-wv-built
    expect(html).toContain("[data-wv-state]");
    // Without one, no section: a page never links a document nobody published.
    expect(workflowInstancePage(base)).not.toContain("data-wv-state=");
  });

  test("an instance page states position, stuck states, the not-recorded gate and a missing diagram in words", () => {
    const html = workflowInstancePage({
      instance: stale as never,
      store: "cat-harness",
      model: { missing: "`gone/crdm.bpmn` is not on disk, and no diagram in the checkout declares `Process_CRDM`", recorded: "gone/crdm.bpmn" },
      beans: [bean("x-ab12", { body: "This is blocked on the owner." })] as never,
      todos: [{ id: "t-1", summary: "about it", status: "open", processes: ["Process_CRDM"] }],
      now: NOW,
      drawingFor: () => undefined,
    });
    expect(html).toContain("<strong>Where it is:</strong> <code>A_Step</code>");
    expect(html).toContain("Stuck states — 2");
    expect(html).toContain("enabled-not-taken");
    expect(html).toContain("blocked-without-expiry");
    expect(html).toContain("<strong>Diagram not found</strong>");
    expect(html).toContain("the position is given in words only");
    expect(html).toContain("The steps that act on the bean are unknown: the diagram was not found.");
    expect(html).toContain("Todos it names — 1");
    expect(html).toContain("tagged with Process_CRDM");
    // Bean v49e item 3: a file from before refusals were recorded says so, and
    // a missing diagram leaves the working context uncomputed, in words.
    expect(html).toContain("Refused steps — not recorded");
    expect(html).toContain("Working context at the token");
    expect(html).toContain("Not computed: the diagram was not found.");
    expect(html).toContain("is not committed state and is not read here");
    expect(html).toContain("&lt;started&gt;");
    expect(html).toContain("render_with_liquid: false");
    expect(html).toContain(GENERATED_BY);
  });

  test("a published drawing is fetched by the page and keyed on the token's BPMN id", () => {
    const html = workflowInstancePage({
      instance: stale as never,
      store: "cat-harness",
      model: { missing: "x", recorded: "gone/crdm.bpmn" },
      beans: null,
      todos: [],
      now: NOW,
      drawingFor: () => "../../assets/img/workflows/crdm.svg",
    });
    // No model: the level has no source, so no drawing is asked for.
    expect(html).not.toContain('<figure class="wv-diagram"');
    const model = { id: "Process_CRDM", source: "/r/crdm.bpmn", nodes: new Map(), children: new Map() };
    const drawn = workflowInstancePage({
      instance: stale as never,
      store: "cat-harness",
      model: { model: model as never, source: "crdm.bpmn", recorded: "gone/crdm.bpmn", moved: true },
      beans: null,
      todos: [],
      now: NOW,
      drawingFor: () => "../../assets/img/workflows/crdm.svg",
      processPageFor: () => "../../processes/crdm.html",
    });
    expect(drawn).toContain('data-wv-svg="../../assets/img/workflows/crdm.svg"');
    // Back to the process's own page, from the header and from the diagram's caption.
    expect(drawn).toContain('<a href="../../processes/crdm.html" title="the process page"><code>Process_CRDM</code></a>');
    expect(drawn).toContain('Process <a href="../../processes/crdm.html"><code>Process_CRDM</code></a>');
    expect(drawn).toContain('data-wv-tokens="[&quot;A_Step&quot;]"');
    expect(drawn).toContain("which is not on disk; drawn from <code>crdm.bpmn</code>");
  });

  test("the hub lists every instance, an unreadable one with its reason", () => {
    const store = storeWith({ "crdm--x-ab12.json": stale, "broken.json": "{" });
    try {
      const html = workflowHubPage("cat-harness", store, { beans: [bean("x-ab12")] as never, now: NOW });
      expect(html).toContain('<a href="crdm--x-ab12/"><code>crdm--x-ab12</code></a>');
      expect(html).toContain("<code>broken.json</code></td><td colspan=\"5\">not readable JSON");
    } finally {
      rmSync(store, { recursive: true, force: true });
    }
  });
});

/**
 * cat-harness#1150, item 3 (owner card Q-CGI-1 A, 2026-11-09): a layer above
 * the harness declares the page for a kind only it registers, and this Tool
 * draws it on the host site under that layer's name. Before, cat-harness
 * declared the Editor checkers page itself, naming a kind only
 * folio-assistant-sci registers.
 */
describe("hostedVisualisers: another layer's state-viewer page, built on the host site", () => {
  test("picks only another layer's builtOnHostSite, per-instance, state-viewer visualisers", async () => {
    const { clearDeclaredVisualisers } = await import("../viewer-declarations.ts");
    const repo = mkdtempSync(join(tmpdir(), "hosted-vis-"));
    const files: Record<string, unknown> = {
      "base/cat-harness.json": {
        name: "cat-harness",
        directories: [],
        visualisers: [{ id: "validators", renderedBy: "state-viewer", coversKinds: ["validators"], subgraphs: "instance" }],
      },
      "top/top.json": {
        name: "top",
        needs: ["cat-harness"],
        directories: [{ id: "top-editor-checkers", path: "editor-checkers/", graphTypologies: ["editor-checkers"] }],
        visualisers: [
          { id: "editor-checkers", renderedBy: "state-viewer", coversKinds: ["editor-checkers"], subgraphs: "instance", builtOnHostSite: {} },
          { id: "not-hosted", renderedBy: "state-viewer", coversKinds: ["editor-checkers"], subgraphs: "instance" },
          { id: "other-tool", renderedBy: "glossary-page", coversKinds: ["glossary"], subgraphs: "instance", builtOnHostSite: {} },
          { id: "a-dashboard", renderedBy: "state-viewer", covers: ["top-editor-checkers"], builtOnHostSite: {} },
        ],
      },
    };
    for (const [f, body] of Object.entries(files)) {
      mkdirSync(join(repo, dirname(f)), { recursive: true });
      writeFileSync(join(repo, f), JSON.stringify(body));
    }
    mkdirSync(join(repo, "top/editor-checkers"), { recursive: true });
    clearDeclaredVisualisers();
    try {
      const got = hostedVisualisers(repo, "cat-harness").map((v) => `${v.harness}/${v.id}`);
      expect(got).toEqual(["top/editor-checkers"]);
      // The harness's own visualisers are never "hosted": it draws them as before.
      expect(hostedVisualisers(repo, "top").map((v) => `${v.harness}/${v.id}`)).toEqual([]);
    } finally {
      clearDeclaredVisualisers();
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

