/**
 * `tools-viewer` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/tools/tools-viewer.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each joins every Tool to the skills of
 * every layer in the checkout, which only the checkout holds. Standing
 * alone, cat-harness has none of it, and `check:cat-harness-standalone`
 * collects every test in that layer. The rest of that file's tests stay there;
 * every path here is composed from ORIGIN_DIR, the directory they were written
 * in, so nothing they read changed.
 */
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { declarationPathIn } from "../../schemas/kg/cat-harness.js";
import { gitCorpus } from "../../schemas/sdlc/git-corpus.js";
import { baseDocsDir } from "../../scripts/compose-docs.js";
import { docsPages, documentingPages } from "../../scripts/docs-declarations.js";
import { allPages, page, pageRelPath, skillIds, toolPageRelPath, toolRows, toolSubjects } from "../../scripts/gen-tools-viz.js";
import { discoverTools } from "../../tools/discover.ts";
import { siteNotBuilt } from "../support/checkout.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const REPO = resolve(ORIGIN_DIR, "..", "..", "..");
/**
 * The base docs layer — asked, never spelled.
 *
 * It was `join(REPO, "cat-harness", "docs")`, and `site-dir-single-answer`
 * refused it. Rightly: the site root has moved twice (beans `x4a6`, `wggr`),
 * and a test carrying its own copy keeps checking where the site used to be
 * while reporting a pass.
 *
 * Worth noting HOW this reached CI. The pre-push checks that caught the other
 * two failures were named gate scripts, and this guard is a UNIT TEST — so a
 * targeted run of `check:*` scripts skipped it entirely. `bun test` is itself
 * a gate, and a subset of the gate set is not the gate set.
 */
const DOCS = baseDocsDir(REPO);

const decl = JSON.parse(readFileSync(declarationPathIn(join(REPO, "cat-harness"))!, "utf-8")) as {
  directories?: { id?: string; graphTypologies?: string[]; coverage?: { docs?: string; visualiser?: unknown } }[];
};
const entryFor = (kind: string) => (decl.directories ?? []).find((e) => (e.graphTypologies ?? []).includes(kind));

// Since #1168 B7c the PAGE declares what it documents (`documents:`), so the
// tools graph's page is found by asking the pages, not the directory entry.
const docsPagesFor = (kind: string): string[] => {
  const e = entryFor(kind)!;
  // `gitCorpus`, not a bare `git ls-files`: in the composed checkout every
  // layer is a REMOTE MOUNT, laid down from `index.lock.json` and ignored by
  // the index repository's git, so `ls-files` from the root lists none of
  // cat-harness's pages. `gitCorpus` counts a mount's files as a submodule's
  // were counted, which is what "the checkout's pages" means since the split.
  // Standing alone the checkout root holds sibling clones and is no git work
  // tree, so git cannot answer there; cat-harness's own clone can, and its
  // pages are the ones asked about (bean w1gy F18).
  const tracked = (gitCorpus(REPO, ["*.md", "*.html"]) ?? gitCorpus(join(REPO, "cat-harness"), ["*.md", "*.html"]) ?? []).map((f) =>
    relative(REPO, f),
  );
  return documentingPages(
    { instance: "cat-harness", id: e.id ?? "", graphTypologies: e.graphTypologies ?? [] },
    docsPages(REPO, tracked),
    REPO,
    [join(REPO, "cat-harness")],
  );
};

const { tools } = (await import("../../schemas/tools/harness-tools.js")) as { tools: () => unknown[] };
const rows = toolRows(tools());

describe("the tools graph is not documented by the skills page", () => {
  it("has a corpus at all", () => {
    // Vacuity guard — every assertion below is over `rows`.
    expect(rows.length).toBeGreaterThan(0);
  });

  it("declares a docs page", () => {
    expect(docsPagesFor("tools")).toHaveLength(1);
  });

  /**
   * A CHECK THAT IS NOT HERE, AND WHY — so it is not built a third time.
   *
   * While fixing this defect I recorded a hypothesis on bean `yunp`: *"a `docs`
   * page shared by two entries whose graph typologies are disjoint is at least
   * suspicious, and that is computable."* It was written as the weaker,
   * mechanisable form of "is this page about this graph".
   *
   * IT WAS BUILT AND THE CORPUS FALSIFIED IT IMMEDIATELY. Three hits, all
   * legitimate:
   *
   * | page | shared by | why it is fine |
   * |---|---|---|
   * | `beans-and-todos.md` | `beans`, `todos` | one page about both, and its name says so |
   * | `document-ingestion.md` | `uploads`, `library` | the two ends of one process |
   * | `subgraph-viewers.md` | `schemas`, `library` | a page about the viewer mechanism itself |
   *
   * Three of three false positives — and it would not have caught the defect
   * it was written for either, because `skills.md` was never another entry's
   * DECLARED docs. `tools` pointed at a page that merely describes skills.
   *
   * So "disjoint graph typologies" does not imply "unrelated subjects", and a check
   * that fires only on legitimate cases is worse than none: it trains a reader
   * to skip it. The guard that does work is the vocabulary approximation
   * below, which is honest about approximating.
   */

  it("and it resolves", () => {
    const d = docsPagesFor("tools")[0]!;
    expect(existsSync(join(REPO, d))).toBe(true);
  });

  it("and it is about tools — approximated, and the approximation is stated", () => {
    // "Is this page about this subject" is not mechanically decidable. What IS
    // checkable: the page uses the graph's own vocabulary. A page that never
    // says `defineTool` or `satisfies` is not documentation of this graph
    // whatever its title claims, which is the property that failed before.
    const d = docsPagesFor("tools")[0]!;
    const text = readFileSync(join(REPO, d), "utf-8");
    expect(text).toContain("defineTool");
    expect(text).toContain("satisfies");
    expect(text.toLowerCase()).toContain("tool");
  });

  it("the skills page is NOT silently repurposed as the tools page", () => {
    // Guards the fix from being undone by editing skills.md instead: even if
    // somebody added a tools section there, the declaration must still name a
    // page of its own.
    expect(docsPagesFor("tools").some((p) => p.endsWith("skills.md"))).toBe(false);
  });
});

describe("every satisfies names a skill that exists", () => {
  const known = skillIds(REPO);

  it("the skill corpus is non-empty", () => {
    // Without this the join below passes vacuously — the `dh4f` shape, where a
    // probe sweeps nothing and reports a clean run.
    expect(known.size).toBeGreaterThan(0);
  });

  it("no tool advertises a capability the graph cannot locate", () => {
    const refs = [...new Set(rows.flatMap((r) => r.satisfies))];
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.filter((s) => !known.has(s))).toEqual([]);
  });

  it("and every tool says what it satisfies", () => {
    // A different gap from a dangling ref: the tool exists and nothing says
    // what capability it is a way of exercising.
    expect(rows.filter((r) => r.satisfies.length === 0).map((r) => r.id)).toEqual([]);
  });
});

describe("the page reports the join in both directions", () => {
  it("states that all resolve, rather than only warning when they do not", () => {
    // "Nothing unresolved" and "the check did not run" are different facts,
    // and a section that appeared only on failure could not tell them apart.
    const html = page(rows, skillIds(REPO));
    expect(html).toContain("Does every `satisfies` name a skill that exists?");
    expect(html).toMatch(/Yes — all \*\*\d+\*\*/);
  });
});

describe("the generator writes where the declaration says", () => {

  // The full view is the full KG (bean 1nu0): every declared `tools` graph,
  // read by auto-discovery, with one sub-graph page per layer.
  const { subjects, empty } = toolSubjects(REPO);

  // Drawn once for the three tests below: reading every process diagram takes
  // seconds, and three reads would time each test out.
  let memo: ReturnType<typeof allPages> | undefined;
  const drawn = () => (memo ??= allPages(toolRows(discoverTools(REPO).tools), pageRelPath(REPO)!, skillIds(REPO), REPO));

  // Standing alone the page is not built: `tools:viz` writes it at publish and
  // `tools/` is gitignored (bean w1gy F18).
  const toolsPage = pageRelPath(REPO);
  it.skipIf(
    toolsPage !== undefined && siteNotBuilt("the Tools page `tools:viz` writes at publish (gitignored)", join(DOCS, toolsPage)),
  )("and the committed page is current", async () => {
    // The gate runs this too; asserting it here means a stale page fails the
    // unit suite rather than only the gate, which is where it is noticed first.
    // The same assembly the writer runs (`allPages`), so the two cannot differ.
    const rel = pageRelPath(REPO)!;
    const { pages } = await drawn();
    expect(readFileSync(join(DOCS, rel), "utf-8")).toBe(pages.get(rel)!);
  }, 60_000);

  // Standing alone the per-instance pages are not built: `tools:viz` writes
  // them at publish and `tools/` is gitignored (bean w1gy F18). A subject with
  // no page route guards nothing, so the assertion below still names it.
  const subjectPages = subjects.flatMap((x) => {
    const rel = pageRelPath(REPO, x.name);
    return rel === undefined ? [] : [join(DOCS, rel)];
  });
  it.skipIf(
    subjectPages.length > 0 &&
      siteNotBuilt("the per-instance Tools pages `tools:viz` writes at publish (gitignored)", ...subjectPages),
  )("draws one current page per instance that declares Tools, and none for an empty graph", async () => {
    // Vacuity guard: more than cat-harness's own graph is drawn.
    expect(subjects.length).toBeGreaterThan(1);
    const { pages } = await drawn();
    for (const x of subjects) {
      const rel = pageRelPath(REPO, x.name)!;
      expect(rel).toEndWith(`/tools/${x.name}/index.md`);
      expect(readFileSync(join(DOCS, rel), "utf-8")).toBe(pages.get(rel)!);
    }
    for (const n of empty) expect(existsSync(join(DOCS, pageRelPath(REPO, n)!))).toBe(false);
  }, 60_000);

  // Owner, 2026-11-12: "each tool in a harness should have its own page … with
  // IRI and viewer", and the tools table "should then link to that viewer".
  it.skipIf(
    subjectPages.length > 0 &&
      siteNotBuilt("the per-Tool pages `tools:viz` writes at publish (gitignored)", ...subjectPages),
  )("draws one page per Tool, carrying its IRI, and every row links to it", async () => {
    const { pages } = await drawn();
    for (const x of subjects) {
      const layerPage = pages.get(pageRelPath(REPO, x.name)!)!;
      for (const r of x.rows) {
        const rel = toolPageRelPath(REPO, x.name, r.id)!;
        const tool = pages.get(rel);
        expect(tool, `${x.name}/${r.id} has no page`).toBeDefined();
        expect(tool!).toContain(`| Tool | \`${r.id}\` |`);
        expect(tool!).toContain('<script type="application/ld+json">');
        expect(tool!).toContain("## Skills it satisfies");
        expect(tool!).toContain("## How it is deployed and reached");
        expect(layerPage).toContain(`[\`${r.id}\`](${encodeURIComponent(r.id)}/)`);
      }
    }
  }, 60_000);

  // Owner, 2026-11-12: "go ahead with the OpenAPI generation and MCP tool list".
  it.skipIf(
    subjectPages.length > 0 &&
      siteNotBuilt("the API documents `tools:viz` writes at publish (gitignored)", ...subjectPages),
  )("publishes an OpenAPI document, an MCP tool list and an API reference per layer, linked from its page", async () => {
    const { pages } = await drawn();
    for (const x of subjects) {
      const dir = pageRelPath(REPO, x.name)!.replace(/index\.md$/, "");
      const doc = JSON.parse(pages.get(`${dir}openapi.json`)!) as { openapi: string; paths: Record<string, unknown> };
      expect(doc.openapi).toBe("3.1.0");
      expect(Object.keys(doc.paths).sort()).toEqual(x.rows.map((r) => `/tools/${r.id}`).sort());
      expect(JSON.parse(pages.get(`${dir}mcp-tools.json`)!).tools).toBeArray();
      expect(pages.get(`${dir}api/index.md`)).toContain("## Operations");
      expect(pages.get(pageRelPath(REPO, x.name)!)).toContain("[OpenAPI document](openapi.json)");
    }
  }, 60_000);
});
