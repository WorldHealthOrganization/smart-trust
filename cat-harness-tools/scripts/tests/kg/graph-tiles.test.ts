/**
 * A tile per declared visualisation — derived, never a second list.
 *
 * @module scripts/tests/graph-tiles.test
 */
import { describe, expect, test } from "bun:test";

import {
  graphTiles,
  kindTileIcon,
  publishedHref,
  resolveGlassStrip,
  tileFindings,
  tilesOn,
  undeclaredProjections,
  directoryByVisualisationRef,
  withTileCounts,
  type GraphTile,
  type TiledDirectory,
} from "../../graph-tiles.js";
import { GlassStripSchema, SubgraphCoverageSchema, visualisationsOf } from "../../../schemas/kg/cat-harness.js";

const dir = (id: string, coverage?: unknown, theme?: string): TiledDirectory => ({
  id,
  ...(coverage === undefined ? {} : { coverage: SubgraphCoverageSchema.parse(coverage) }),
  ...(theme === undefined ? {} : { theme: { themeId: theme } }),
});

describe("a bare string still parses — the widening is additive", () => {
  test("27 declared paths in this repository must not need an edit", () => {
    // A widening that cost each of them one would be a required-field change
    // wearing an optional one's clothes, and every concurrent branch would pay
    // for it. That is the `dependents` lesson, recorded on this very schema.
    const cov = SubgraphCoverageSchema.parse({ visualiser: "docs/x/index.html" });
    expect(visualisationsOf(cov, "x")).toEqual([{ ref: "docs/x/index.html", title: "x" }]);
  });

  test("a list of visualisations parses too", () => {
    const cov = SubgraphCoverageSchema.parse({
      visualiser: [
        { ref: "docs/shelf.html", title: "Shelf" },
        { ref: "docs/map.html", title: "Map" },
      ],
    });
    expect(visualisationsOf(cov, "library").map((v) => v.title)).toEqual(["Shelf", "Map"]);
  });

  test("a title falls back to the directory's id — a tile is never blank", () => {
    const cov = SubgraphCoverageSchema.parse({ visualiser: [{ ref: "docs/x.html" }] });
    expect(visualisationsOf(cov, "library")[0]?.title).toBe("library");
  });

  test("no visualiser is an empty list, which is a real answer", () => {
    // Different from "declares one that does not resolve" — `flh4`'s
    // distinction, checked elsewhere.
    expect(visualisationsOf(undefined, "x")).toEqual([]);
    expect(visualisationsOf(SubgraphCoverageSchema.parse({ docs: "d.md" }), "x")).toEqual([]);
  });
});

describe("a tile is derived from the DECLARATION", () => {
  test("one per declared visualisation, and a directory with several gets several", () => {
    const tiles = graphTiles([
      dir("library", {
        visualiser: [{ ref: "a.html", title: "Shelf" }, { ref: "b.html", title: "Map" }],
      }),
      dir("beans", { visualiser: "beans.html" }),
      dir("nothing"),
    ]);
    expect(tiles.map((t) => t.id)).toEqual(["beans", "library/1", "library/2"]);
    expect(tiles.map((t) => t.title)).toEqual(["beans", "Shelf", "Map"]);
  });

  test("a directory with ONE visualisation gets its own name as the id", () => {
    // The index is part of the id only where it has to be: it is what a reader
    // sees in a URL fragment and what a test addresses it by.
    expect(graphTiles([dir("beans", { visualiser: "b.html" })])[0]?.id).toBe("beans");
  });

  test("a directory declaring none gets no tile — silence is not a tile", () => {
    expect(graphTiles([dir("qa"), dir("health", { docs: "d.md" })])).toEqual([]);
  });

  test("the order is the declaration's, so the artefact is generated and not a snapshot", () => {
    const tiles = graphTiles([
      dir("zed", { visualiser: "z.html" }),
      dir("alpha", { visualiser: "a.html" }),
    ]);
    expect(tiles.map((t) => t.directory)).toEqual(["alpha", "zed"]);
  });

  test("the tile carries the ref EXACTLY as declared — it opens the existing viewer", () => {
    // "those should open their exisiting visualzaiton". Nothing here builds a
    // viewer, and a tile that recomposed the path could reach a different one.
    const ref = "cat-harness/docs/cat-harness/beans/index.html";
    expect(graphTiles([dir("beans", { visualiser: ref })])[0]?.ref).toBe(ref);
  });
});

describe("surfaces: one declaration, per-surface visibility", () => {
  test("absent means EVERY surface — a tile that states nothing is complete", () => {
    expect(graphTiles([dir("x", { visualiser: "x.html" })])[0]?.surfaces).toEqual([
      "navbar",
      "board",
      "glass",
    ]);
  });

  test("a declared surface is the only one it appears on", () => {
    const tiles = graphTiles([
      dir("navbar-only", { visualiser: [{ ref: "a.html", surfaces: ["navbar"] }] }),
      dir("board-only", { visualiser: [{ ref: "b.html", surfaces: ["board"] }] }),
      dir("both", { visualiser: "c.html" }),
    ]);
    expect(tilesOn(tiles, "navbar").map((t) => t.directory)).toEqual(["both", "navbar-only"]);
    expect(tilesOn(tiles, "board").map((t) => t.directory)).toEqual(["board-only", "both"]);
  });

  test("ONE declaration drives every surface — never two lists to disagree", () => {
    // Q11. Two registries would be free to disagree about what a tile IS, and
    // the disagreement would be invisible.
    const tiles = graphTiles([dir("x", { visualiser: [{ ref: "a.html", title: "T" }] })]);
    for (const s of ["navbar", "board", "glass"] as const) {
      expect(tilesOn(tiles, s)[0]?.title).toBe("T");
      expect(tilesOn(tiles, s)[0]?.ref).toBe("a.html");
    }
  });
});

describe("visibility and theme default, and may be overridden", () => {
  test("hidden defaults to false and is declarable", () => {
    // Q9: declared default, reader may override. Only the DECLARED half is
    // here; a reader's hiding is theirs alone and is committed nowhere.
    expect(graphTiles([dir("x", { visualiser: "a.html" })])[0]?.hidden).toBe(false);
    expect(
      graphTiles([dir("x", { visualiser: [{ ref: "a.html", hidden: true }] })])[0]?.hidden,
    ).toBe(true);
  });

  test("a tile's theme falls back to the directory's, then to nothing", () => {
    // The same inherit-and-override rule `semantic-zoom.ts` encodes: a tile
    // that states nothing is complete, and absent means the layer's.
    expect(graphTiles([dir("x", { visualiser: "a.html" }, "library")])[0]?.theme).toBe("library");
    expect(
      graphTiles([dir("x", { visualiser: [{ ref: "a.html", theme: { themeId: "own" } }] }, "library")])[0]?.theme,
    ).toBe("own");
    expect(graphTiles([dir("x", { visualiser: "a.html" })])[0]?.theme).toBeUndefined();
  });
});

describe("a live projection with no declaration is a FINDING — `flh4`'s third state", () => {
  const dirs = [
    dir("uploads", { visualiser: "u.html" }),
    dir("beans"),
    dir("qa"),
  ];
  const published = (id: string) => id === "uploads" || id === "beans";

  test("it is reported, not silently given a tile", () => {
    // A tile appearing without a declaration would make the audit that reports
    // the gap look wrong.
    expect(undeclaredProjections(dirs, published)).toEqual(["beans"]);
    expect(graphTiles(dirs).map((t) => t.directory)).toEqual(["uploads"]);
  });

  test("a directory with neither is NOT a finding — nothing is missing there", () => {
    expect(undeclaredProjections(dirs, published)).not.toContain("qa");
  });

  test("a directory with both is not a finding either", () => {
    expect(undeclaredProjections(dirs, published)).not.toContain("uploads");
  });

  test("the finding names the repair, not the symptom", () => {
    const [f] = tileFindings("cat-harness", dirs, published);
    expect(f).toContain("beans");
    // The repair since #1168 B7a: the generator names the directory in the page.
    expect(f).toContain("withRenders");
    expect(f).toContain("name the directory in the page");
  });
});

describe("a declared path is NOT a published URL — `prc5` one layer down", () => {
  const SITE = "cat-harness/docs";

  test("the site directory's prefix is stripped and `index.html` becomes the route", () => {
    // The mistake already paid for: a tile carrying `docs/assets/…` 404'd for
    // every reader, because the build copies the site directory's CONTENTS to
    // the mount and the declared prefix is exactly what a URL does not carry.
    expect(publishedHref(SITE, "cat-harness/docs/cat-harness/beans/index.html")).toBe("/cat-harness/beans/");
    expect(publishedHref(SITE, "cat-harness/docs/cat-harness/schemas/x/index.html")).toBe(
      "/cat-harness/schemas/x/",
    );
  });

  test("a page that is not `index.html` keeps its filename", () => {
    expect(publishedHref(SITE, "cat-harness/docs/guides/x.html")).toBe("/guides/x.html");
  });

  test("A NAMED MARKDOWN PAGE BECOMES `.html`, because Jekyll serves no `.md`", () => {
    // The half the first fix missed. `index.md` was rewritten to the directory
    // route on 2026-09-21, when `fsh-guts` became the first markdown viewer —
    // and a viewer named anything else kept its `.md`, which is the identical
    // 404 the comment above argues against.
    //
    // Measured 2026-09-22: `processes-index.md` produced `href:
    // "/processes-index.md"`, a tile pointing at a SOURCE file. `pb04` — a
    // dead link is worse than no link.
    expect(publishedHref(SITE, "cat-harness/docs/processes-index.md")).toBe("/processes-index.html");
    expect(publishedHref(SITE, "cat-harness/docs/guides/x.md")).toBe("/guides/x.html");
  });

  test("...and the directory form still wins where both would apply", () => {
    // `index.md` must reach `/x/`, not `/x/index.html`: two spellings of one
    // page are two entries in a reader's history, which is why the directory
    // rewrite exists at all. The `.md` mapping must not undo it.
    expect(publishedHref(SITE, "cat-harness/docs/cat-harness/processes/index.md")).toBe("/cat-harness/processes/");
    expect(publishedHref(SITE, "cat-harness/docs/cat-harness/tools/index.md")).toBe("/cat-harness/tools/");
  });

  test("a ref OUTSIDE the site gets no href rather than a guessed one", () => {
    // `pb04`: a tile with no href is not a link, which is better than a link
    // to nowhere. Guessing would turn a viewer this site does not serve into a
    // 404 that reads as a broken page.
    expect(publishedHref(SITE, "elsewhere/viewer.html")).toBeUndefined();
    expect(publishedHref(SITE, "cat-harness/docsomething/x.html")).toBeUndefined();
  });

  test("tiles carry the href only when a site directory is supplied", () => {
    const dirs = [dir("beans", { visualiser: "cat-harness/docs/cat-harness/beans/index.html" })];
    expect(graphTiles(dirs)[0]?.href).toBeUndefined();
    expect(graphTiles(dirs, SITE)[0]?.href).toBe("/cat-harness/beans/");
  });

  test("an unservable ref leaves the tile unlinked but still present", () => {
    // The tile is what says the visualisation was DECLARED. Dropping it would
    // lose that; linking it would lie about where it goes.
    const tiles = graphTiles([dir("x", { visualiser: "elsewhere/v.html" })], SITE);
    expect(tiles.length).toBe(1);
    expect(tiles[0]?.href).toBeUndefined();
    expect(tiles[0]?.ref).toBe("elsewhere/v.html");
  });
});


/**
 * Issue #856, bean `tis1`. The owner ruled for a badge over greying an empty
 * tile out, because a badge also makes a WRONG count visible where a dimmed
 * tile only answers "empty or not".
 *
 * These assert the SPLIT and the THIRD STATE, not the arithmetic. A test over
 * the numbers would pass just as happily on the day a tile started inventing
 * one.
 */
describe("a tile's count is attached, never derived", () => {
  const tiles = (): GraphTile[] =>
    graphTiles(
      [dir("beans", { visualiser: "docs/cat-harness/beans/index.html" }),
       dir("fsh-guts", { visualiser: "docs/fsh-guts/index.html" })],
      "docs",
    );

  test("a declared count reaches the tile with its unit", () => {
    const got = withTileCounts(tiles(), new Map([["beans", { count: 466, unit: "beans" }]]));
    const beans = got.find((t) => t.directory === "beans")!;
    expect(beans.count).toBe(466);
    expect(beans.unit).toBe("beans");
  });

  test("a directory nobody counted has NO count field — not a zero", () => {
    // The third state, at the layer that emits the JSON the browser reads.
    // `dh4f`: an absent count and an empty graph are opposite facts, and a
    // `0` here would publish the wrong one of them to every reader.
    const got = withTileCounts(tiles(), new Map([["beans", { count: 466, unit: "beans" }]]));
    const other = got.find((t) => t.directory === "fsh-guts")!;
    expect("count" in other).toBe(false);
    expect("unit" in other).toBe(false);
  });

  test("ZERO is carried, because zero is the answer worth showing", () => {
    const got = withTileCounts(tiles(), new Map([["beans", { count: 0, unit: "beans" }]]));
    expect(got.find((t) => t.directory === "beans")!.count).toBe(0);
  });

  test("an empty map changes nothing at all", () => {
    // The state of a site whose projections have not been generated yet. It
    // must publish tiles with no badges, not fourteen tiles reading zero.
    const before = tiles();
    const after = withTileCounts(before, new Map());
    expect(after).toEqual(before);
    expect(after.every((t) => !("count" in t))).toBe(true);
  });

  test("a count for a directory with no TILE is simply not a tile", () => {
    // `undeclaredProjections`' rule, restated from the other side: a live
    // projection with no declared visualiser is a FINDING, and attaching a
    // count must not conjure the tile that finding says is missing.
    const got = withTileCounts(tiles(), new Map([["voices", { count: 5, unit: "voices" }]]));
    expect(got.map((t) => t.directory).includes("voices")).toBe(false);
    expect(got).toHaveLength(2);
  });

  test("the pass does not MUTATE the tiles it was given", () => {
    const before = tiles();
    withTileCounts(before, new Map([["beans", { count: 466, unit: "beans" }]]));
    expect(before.every((t) => !("count" in t))).toBe(true);
  });

  test("keyed by DIRECTORY, so two views of one graph share its number", () => {
    // A directory declaring several visualisations mints `beans`, `beans/2`,
    // and every one of them is a view of the same graph. Keying on `id` would
    // badge the first and leave the rest looking uncounted.
    const many = graphTiles(
      [dir("beans", {
        visualiser: [{ ref: "docs/cat-harness/beans/index.html" }, { ref: "docs/cat-harness/beans/alt.html" }],
      })],
      "docs",
    );
    expect(many.length).toBeGreaterThan(1);
    const got = withTileCounts(many, new Map([["beans", { count: 466, unit: "beans" }]]));
    expect(got.every((t) => t.count === 466)).toBe(true);
  });
});


/**
 * Issue #863. A scoped viewer's generator knows the SUBJECT it renders, not
 * the directory id whose declaration produced the tile. This is the bridge,
 * and both tests below are for mistakes that were actually made building it.
 */
describe("a page's declared ref names the directory that declared it", () => {
  test("the ref resolves to its directory id", () => {
    const got = directoryByVisualisationRef([
      dir("beans", { visualiser: "docs/cat-harness/beans/index.html" }),
      dir("todos", { visualiser: "docs/cat-harness/todos/index.html" }),
    ]);
    expect(got.get("docs/cat-harness/beans/index.html")).toBe("beans");
    expect(got.get("docs/cat-harness/todos/index.html")).toBe("todos");
  });

  test("a ref nobody declared is ABSENT, not a guess", () => {
    // The third state, at the layer that decides whether a page gets a badge
    // at all. A page no declaration names has no tile, so there is nothing to
    // badge; inventing an id here would mint a count for a directory nobody
    // declared.
    const got = directoryByVisualisationRef([dir("beans", { visualiser: "docs/cat-harness/beans/index.html" })]);
    expect(got.get("docs/nobody/index.html")).toBeUndefined();
  });

  test("the id is NOT the subject name with a suffix", () => {
    // The corpus that rules composition out, asserted rather than described.
    // Three of this repository's four scoped schema directories follow
    // `${subject}-schemas`; `folio-assistant-core` declares
    // `folio-assist-core-schemas`. A composed key badges three and silently
    // drops the fourth -- right enough to look correct, which is the failure
    // mode #856 refused.
    const got = directoryByVisualisationRef([
      dir("folio-assist-core-schemas", {
        visualiser: "cat-harness/docs/cat-harness/schemas/folio-assistant-core/index.html",
      }),
    ]);
    const subject = "folio-assistant-core";
    expect(got.get(`cat-harness/docs/cat-harness/schemas/${subject}/index.html`))
      .toBe("folio-assist-core-schemas");
    expect(`${subject}-schemas`).not.toBe("folio-assist-core-schemas");
  });

  test("a directory declaring SEVERAL visualisations claims each page", () => {
    const got = directoryByVisualisationRef([
      dir("library", {
        visualiser: [{ ref: "docs/library/a.html" }, { ref: "docs/library/b.html" }],
      }),
    ]);
    expect(got.get("docs/library/a.html")).toBe("library");
    expect(got.get("docs/library/b.html")).toBe("library");
  });

  test("two directories over ONE page keep the first, rather than racing", () => {
    // A page is NOT uniquely owned, and assuming it was is the defect this
    // test exists for. `.../library/agent-skills/` is `agent-skills-library`
    // to this layer and plain `library` to the agent-skills layer, which
    // declares its own view of the same page. Building the lookup across every
    // layer therefore returned an id that is not a tile HERE -- which is
    // why callers pass the ONE declaration their tiles came from.
    const got = directoryByVisualisationRef([
      dir("agent-skills-library", { visualiser: "docs/library/agent-skills/index.html" }),
      dir("library", { visualiser: "docs/library/agent-skills/index.html" }),
    ]);
    expect(got.get("docs/library/agent-skills/index.html")).toBe("agent-skills-library");
    expect(got.size).toBe(1);
  });

  test("a directory declaring nothing contributes nothing", () => {
    expect([...directoryByVisualisationRef([dir("undeclared")])]).toEqual([]);
  });
});

describe("one tile per page (#1168 B7a-2b)", () => {
  // Viewers are read from the pages, and one page may draw several
  // directories. The tile goes to the layer's own directory first.
  const shared = "docs/cat-harness/processes/index.md";
  const tiles = graphTiles([
    { id: "smart-base-processes", scope: "repository", coverage: { visualiser: shared } },
    { id: "processes", coverage: { visualiser: shared } },
    { id: "core-processes", scope: "repository", coverage: { visualiser: shared } },
    { id: "tools", coverage: { visualiser: "docs/cat-harness/tools/index.md" } },
  ]);

  test("a page shared by several directories gets one tile", () => {
    expect(tiles.filter((t) => t.ref === shared)).toHaveLength(1);
    expect(tiles).toHaveLength(2);
  });

  test("and it is the instance's own directory's tile", () => {
    expect(tiles.find((t) => t.ref === shared)?.directory).toBe("processes");
  });
});


describe("a tile with no icon of its own takes its graph TYPOLOGY's (ob3m finding 11)", () => {
  const kinded = (id: string, kinds: string[], icon?: string): TiledDirectory => ({
    id,
    graphTypologies: kinds,
    coverage: SubgraphCoverageSchema.parse({ visualiser: [{ ref: `${id}.html`, ...(icon ? { icon } : {}) }] }),
  });

  test("an undeclared icon falls back to the first kind that has one", () => {
    const [t] = graphTiles([kinded("who-iris-library", ["library"])]);
    expect(t?.icon).toBe("library");
    expect(kindTileIcon(["cat-harness", "schemas"])).toBe("schemas");
  });

  test("a declared icon still wins over the kind", () => {
    expect(graphTiles([kinded("skills", ["skills"], "docs")])[0]?.icon).toBe("docs");
  });

  test("a kind with no icon leaves the tile without one, rather than guessing", () => {
    expect(graphTiles([kinded("glossary", ["swimlane-glossary"])])[0]).not.toHaveProperty("icon");
    expect(kindTileIcon(undefined)).toBeUndefined();
  });
});

describe("a tile says the destination's ONE name (bean `ob3m` finding 6)", () => {
  // Owner, 2026-10-01, "One name everywhere". The glass called the folio's
  // root docs page `root-docs` (the directory id) while the rail called it
  // `docs`, and called cat-harness's "Docs — cat-harness".
  const docs = (id: string, title?: string): TiledDirectory => ({
    id,
    graphTypologies: ["docs"],
    coverage: SubgraphCoverageSchema.parse({ visualiser: [{ ref: `site/${id}/index.html`, ...(title ? { title } : {}) }] }),
  });

  test("an undeclared title is the kind's display name, never the directory id", () => {
    expect(graphTiles([docs("root-docs")]).map((t) => t.title)).toEqual(["Docs"]);
  });

  test("the harness is a qualifier beside the label, never folded into it", () => {
    const tiles = graphTiles(
      [docs("docs", "Docs — cat-harness"), { ...docs("root-docs"), scope: "repository" }],
      undefined,
      (d) => (d.scope === "repository" ? "Folio Assistant" : "C@T Harness"),
      ["cat-harness"],
    );
    expect(tiles.map((t) => [t.title, t.qualifier])).toEqual([
      ["Docs", "C@T Harness"],
      ["Docs", "Folio Assistant"],
    ]);
    // Two tiles share the name, so the qualifier is SHOWN on both.
    expect(tiles.map((t) => t.showQualifier)).toEqual([true, true]);
  });

  test("a tile whose name is unique keeps the qualifier out of sight", () => {
    const tiles = graphTiles([docs("docs")], undefined, () => "C@T Harness");
    expect(tiles[0]!.qualifier).toBe("C@T Harness");
    expect(tiles[0]!.showQualifier).toBeUndefined();
  });
});

// ── The glass strip's pins — owner, 2026-10-01, bean `ob3m` finding 10 ─────
describe("resolveGlassStrip — pinned tiles first, plus '+N more'", () => {
  const tile = (id: string, directory: string, extra: Partial<GraphTile> = {}): GraphTile => ({
    id, directory, title: id, ref: "x", href: `/${id}/`, surfaces: ["navbar", "board", "glass"], hidden: false, ...extra,
  });
  const kinds = new Map<string, string[]>([
    ["library", ["library"]],
    ["library-who-iris", ["library"]],
    ["processes", ["processes"]],
    ["tools", ["tools"]],
    ["skills", ["skills"]],
    ["skills-other", ["skills"]],
    ["staged", ["fsh-guts"]],
  ]);

  test("chrome pins become glass-<id>, kinds become ONE tile each, in declared order", () => {
    const tiles = [tile("library-who-iris", "library-who-iris"), tile("library", "library"),
      tile("skills-other", "skills-other"), tile("processes", "processes"), tile("tools", "tools")];
    const r = resolveGlassStrip(
      [{ chrome: "todos" }, { chrome: "settings" }, { kind: "library" }, { kind: "processes" }, { kind: "tools" }, { kind: "skills" }],
      tiles, kinds);
    // The directory named for the kind wins over an earlier tile of the same kind.
    expect(r.pinned).toEqual(["glass-todos", "glass-settings", "library", "processes", "tools", "skills-other"]);
    expect(r.unmatched).toEqual([]);
  });

  test("a kind no usable tile holds is a finding, never a silent skip", () => {
    const r = resolveGlassStrip(
      [{ kind: "fsh-guts" }, { kind: "processes" }],
      [tile("staged", "staged", { publish: "staging-only" }), tile("processes", "processes", { surfaces: ["navbar"] })],
      kinds);
    expect(r.pinned).toEqual([]);
    expect(r.unmatched).toEqual(["fsh-guts", "processes"]);
  });

  test("a hidden tile or one with no page is never pinned", () => {
    const r = resolveGlassStrip(
      [{ kind: "library" }],
      [tile("library", "library", { hidden: true }), { ...tile("library-who-iris", "library-who-iris"), href: undefined }],
      kinds);
    expect(r.unmatched).toEqual(["library"]);
  });

  test("the schema refuses a pin listed twice and a chrome id nothing draws", () => {
    expect(GlassStripSchema.safeParse([{ kind: "tools" }, { kind: "tools" }]).success).toBe(false);
    expect(GlassStripSchema.safeParse([{ chrome: "more" }]).success).toBe(false);
    expect(GlassStripSchema.safeParse([{ chrome: "todos" }, { kind: "tools" }]).success).toBe(true);
  });
});

// cat-harness-tools#1701: an undeclared tile takes the name the harness rows
// give its page, so the glass and FOLDERS/the sidebar say one name.
describe("labelFor — an undeclared tile is named as its page's rows name it", () => {
  const SITE = "cat-harness/docs";
  const schemas = (): TiledDirectory => ({
    ...dir("smart-base-schemas", { visualiser: "cat-harness/docs/en/cat-harness/schemas/smart-base/index.html" }),
    graphTypologies: ["code", "schemas"],
  });
  const rows = (href: string) => (href === "/en/cat-harness/schemas/smart-base/" ? "Schemas" : undefined);

  test("the row's name replaces the first-kind fallback", () => {
    expect(graphTiles([schemas()], SITE)[0]?.title).toBe("Code");
    expect(graphTiles([schemas()], SITE, undefined, [], rows)[0]?.title).toBe("Schemas");
  });

  test("a declared title still wins over the row's name", () => {
    const d: TiledDirectory = {
      ...dir("x", { visualiser: [{ ref: "cat-harness/docs/en/cat-harness/schemas/smart-base/index.html", title: "Declared" }] }),
      graphTypologies: ["code"],
    };
    expect(graphTiles([d], SITE, undefined, [], rows)[0]?.title).toBe("Declared");
  });

  test("no row for the page keeps the fallback", () => {
    expect(graphTiles([schemas()], SITE, undefined, [], () => undefined)[0]?.title).toBe("Code");
  });
});
