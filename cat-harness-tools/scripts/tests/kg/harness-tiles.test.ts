/**
 * One fat tile per initiated harness — ordered by declaration, linked by
 * presence, honest about both gaps.
 *
 * The tests that matter are the ones that would pass for a generator that
 * quietly linked nothing, or that hardcoded the bootstrap's name.
 *
 * @module scripts/tests/harness-tiles.test
 *
 * The tests of this file that read the whole checkout (reads who-iris's own
 * theme) live in `test/harness-tiles-checkout.test.ts` (bean `7zz1`): standing
 * alone, cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { siteDir, siteDirFor } from "../../../schemas/kg/cat-harness.js";
import { harnessTiles, inertNote, ownStatePage, subgraphsOf, subjectPage } from "../../harness-tiles.js";
import { PAGE_LOCALE } from "../../viewer-declarations.js";
import { writeDeclaration } from "../../../test/support/instance-fixture.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { dirname } from "node:path";

/** A repo with a site-owning harness and any number of siblings. */
function fixture(
  instances: Record<string, unknown>,
  pages: readonly string[] = [],
): { repo: string; names: string[] } {
  const repo = mkdtempSync(join(tmpdir(), "harness-tiles-"));
  for (const [name, decl] of Object.entries(instances)) {
    const dir = name === "" ? repo : join(repo, name);
    mkdirSync(dir, { recursive: true });
    // `dependents` is REQUIRED on every directory entry and has no default on
    // purpose, so a fixture that omitted it would fail in `readDeclaration`
    // rather than in the assertion. Filled in here so each test states only
    // the fields it is about.
    const d = decl as { directories?: Array<Record<string, unknown>> };
    for (const entry of d.directories ?? []) entry["dependents"] ??= "skip";
    writeDeclaration(dir, JSON.stringify(decl, null, 2));
  }
  // The site root is READ from the host's declaration, never written here.
  // `site-dir-single-answer.test.ts` guards that rule across the whole tree,
  // and a fixture that hardcoded the default would be a second answer to
  // "where does this instance publish" — in the tests of all places.
  const site = siteDirFor(join(repo, "host"));
  for (const p of pages) {
    const dir = join(repo, "host", site, p);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), "<!doctype html>");
  }
  return { repo, names: Object.keys(instances).filter((n) => n !== "").sort() };
}

/**
 * Give a layer its own site directory — what `folioRoot` looks for.
 *
 * The path is READ from that layer's declaration rather than written here.
 * `site-dir-single-answer.test.ts` guards that rule across the whole tree, and
 * it caught this helper's first version hardcoding the default.
 */
function giveOwnSite(repo: string, name: string): void {
  mkdirSync(join(repo, name, siteDirFor(join(repo, name))), { recursive: true });
}

/**
 * The site owner's VISUALISERS (owner, 2026-10-09: the harness declares each
 * one, at `<base>/<harness>/<visualiser>/`). By kind, so a layer stacked
 * on `host` (`needs: ["host"]`) is covered and one that is not, is not.
 */
const HOST_VISUALISERS = [
  { id: "library", renderedBy: "library-viewer", coversKinds: ["library"], subgraphs: "instance" },
  { id: "schemas", renderedBy: "schemas-viewer", coversKinds: ["schemas"], subgraphs: "instance" },
  { id: "beans", renderedBy: "state-viewer", coversKinds: ["beans"], alias: "beans" },
];

const host = (extra: Record<string, unknown> = {}) => ({
  name: "host",
  directories: [{ id: "beans", path: "beans/", graphTypologies: ["beans"] }],
  visualisers: HOST_VISUALISERS,
  ...extra,
});

const tilesOf = (f: { repo: string; names: string[] }) =>
  harnessTiles(f.repo, join(f.repo, "host"), f.names);

describe("the ORDER is the declared dependency stack, bottom to top", () => {
  test("the spine reads foundation-last, which is the owner's sentence", () => {
    // Owner, 2026-09-20: "So bootsteap, cat harness, fa-core, f-a, from bottom
    // to top." Computed from `needs`, never written out as names.
    const f = fixture({
      host: host({ needs: [] }),
      mid: { name: "mid", directories: [], needs: ["host"] },
      top: { name: "top", directories: [], needs: ["mid"] },
    });
    expect(tilesOf(f).map((t) => t.name)).toEqual(["top", "mid", "host"]);
  });

  test("it is the DECLARATION, not alphabetical luck", () => {
    // `a` sorts first by name and sits at the bottom by rule; a comparator
    // that happened to agree with the alphabet would pass the test above.
    const f = fixture({
      host: host({ needs: ["a"] }),
      a: { name: "a", directories: [], needs: [] },
    });
    expect(tilesOf(f).map((t) => t.name)).toEqual(["host", "a"]);
  });

  test("an instance that declares NO needs sits BELOW the spine's head, and says so", () => {
    // Owner, 2026-09-21: "in reverse dep order (so bootsrap on bottom,
    // folio-asst, on top)". The first version put the whole unplaced group
    // above the spine, which left the most derived layer eighth from the
    // top — both endpoints of that sentence were wrong.
    // Absent is not `[]`. A node that needs nothing is free to sort first in
    // `flattenDependencies`, which would put an unlabelled layer on the
    // floor beside the bootstrap — asserting something nobody declared.
    const f = fixture({
      host: host({ needs: [] }),
      top: { name: "top", directories: [], needs: ["host"] },
      loose: { name: "loose", directories: [] },
    });
    const tiles = tilesOf(f);
    expect(tiles.map((t) => t.name)).toEqual(["top", "loose", "host"]);
    expect(tiles.find((t) => t.name === "loose")!.findings.join(" ")).toContain("alphabetical rather than derived");
  });

  test("the declared FLOOR is last even when its layer was never declared", () => {
    // The second rule, and the reason it is kept separate: an exempt layer
    // with no `needs` is undetermined, and undetermined floats to the top of
    // the unplaced group — which would put the bootstrap above everything it
    // underpins.
    const f = fixture({
      host: host({ needs: [] }),
      boot: {
        name: "boot",
        directories: [],
        renderExemption: { of: ["visualiser"], reason: "it is the floor", owes: "its own graph" },
      },
    });
    const tiles = tilesOf(f);
    expect(tiles[tiles.length - 1]!.name).toBe("boot");
    expect(tiles[tiles.length - 1]!.footer).toBe(true);
  });

  test("the two rules AGREE on the real repository — the floor is also the deepest layer", () => {
    const f = fixture({
      host: host({ needs: ["boot"] }),
      boot: {
        name: "boot",
        directories: [],
        needs: [],
        renderExemption: { of: ["visualiser"], reason: "floor", owes: "graph" },
      },
    });
    expect(tilesOf(f).map((t) => t.name)).toEqual(["host", "boot"]);
  });

  test("a CYCLE is reported and falls back to alphabetical — it does not blank the navbar", () => {
    // `flattenDependencies` returns an empty order on a broken graph, which is
    // right for a pipeline and wrong for a sidebar: showing nothing hides
    // every layer over one typo.
    const f = fixture({
      host: host({ needs: ["b"] }),
      b: { name: "b", directories: [], needs: ["host"] },
    });
    const tiles = tilesOf(f);
    expect(tiles.map((t) => t.name)).toEqual(["b", "host"]);
    expect(tiles.flatMap((t) => t.findings).join(" ")).toContain("cycle");
  });

  test("a dependency naming no instance is reported, never silently dropped", () => {
    const f = fixture({ host: host({ needs: ["ghost"] }) });
    expect(tilesOf(f)[0]!.findings.join(" ")).toContain('needs "ghost"');
  });
});

describe("a link is DECLARATION-driven and PRESENCE-checked", () => {
  test("a declared graph with a published page becomes a link", () => {
    const f = fixture(
      { host: host(), who: { name: "who", needs: ["host"], directories: [{ id: "lib", path: "library/", graphTypologies: ["library"] }] } },
      ["host/library/who"],
    );
    const who = tilesOf(f).find((t) => t.name === "who")!;
    expect(who.visualisations).toEqual([{ kind: "library", label: "Library", path: "/host/library/who/" }]);
  });

  test("a declared graph with NO page is not linked, and is reported", () => {
    // The `pb04` rule: a dead link is worse than no link. The assertion is on
    // BOTH halves, because a generator that dropped the entry silently would
    // satisfy "not linked" and hide the gap.
    const f = fixture({
      host: host(),
      who: { name: "who", needs: ["host"], directories: [{ id: "lib", path: "library/", graphTypologies: ["library"] }] },
    });
    const who = tilesOf(f).find((t) => t.name === "who")!;
    expect(who.visualisations).toEqual([{ kind: "library", label: "Library", note: "no viewer yet" }]);
    expect(who.findings.join(" ")).toContain("no published viewer");
  });

  test("a page published under a kind the instance does NOT declare is reported, not linked", () => {
    // `flh4`'s other half. The declaration decides what a tile claims to show,
    // so this cannot become a link — but silence would hide a working viewer
    // behind a rule, and the remedy is one line in a declaration.
    const f = fixture({ host: host(), who: { name: "who", needs: ["host"], directories: [] } }, ["host/library/who"]);
    const who = tilesOf(f).find((t) => t.name === "who")!;
    expect(who.visualisations).toEqual([]);
    expect(who.findings.join(" ")).toContain("covers none of this instance's directories");
  });

  test("the site owner's own state graph is at its DECLARED route — the short URL is only an alias", () => {
    // Until 2026-10-09 the site owner elided its own name (`/beans/`). The
    // owner's rule is `<base>/<harness>/<visualizer>`; `/beans/` survives as
    // a declared alias, composed as a redirect, and is never what a tile links.
    const f = fixture({ host: host() }, ["host/beans"]);
    expect(tilesOf(f)[0]!.visualisations).toEqual([{ kind: "beans", label: "Plans and work", path: "/host/beans/" }]);
    const stale = fixture({ host: host() }, ["beans"]);
    expect(tilesOf(stale)[0]!.visualisations).toEqual([{ kind: "beans", label: "Plans and work", note: "no viewer yet" }]);
  });

  test("there is no elided namespace to squat: a sibling's graph opens the visualiser DECLARED over it", () => {
    // `/beans/` was the host's by convention, and a sibling had to be kept out
    // of it. Now a page is reached only through a declaration: `host` declares
    // its `beans` visualiser over the KIND, so the sibling's beans graph opens
    // that route — and the bare `/beans/` page links nobody.
    const f = fixture({ host: host(), who: { name: "who", directories: [{ id: "b", path: "b/", graphTypologies: ["beans"] }] } }, [
      "host/beans",
      "beans",
    ]);
    expect(tilesOf(f).find((t) => t.name === "who")!.visualisations).toEqual([{ kind: "beans", label: "Plans and work", path: "/host/beans/" }]);
  });
});

describe("the stats are DERIVED, so they cannot disagree with the tile", () => {
  test("views counts only what is actually linked", () => {
    const f = fixture(
      {
        host: host(),
        who: {
          name: "who",
          directories: [
            { id: "lib", path: "library/", graphTypologies: ["library"] },
            { id: "sch", path: "schemas/", graphTypologies: ["schemas"] },
          ],
        },
      },
      ["host/library/who"],
    );
    const who = tilesOf(f).find((t) => t.name === "who")!;
    const by = Object.fromEntries(who.stats.map((s) => [s.id, s.value]));
    expect(by).toEqual({ directories: 2, kinds: 2, views: 1 });
    expect(who.visualisations.filter((v) => v.path).length).toBe(by["views"]);
  });

  test("every stat carries a label, because a badge with no name is an unnamed control", () => {
    const f = fixture({ host: host() });
    for (const s of tilesOf(f)[0]!.stats) expect(s.label.length).toBeGreaterThan(0);
  });

  test("two directories holding the same graph count as one KIND", () => {
    const f = fixture({
      host: host({
        directories: [
          { id: "a", path: "a/", graphTypologies: ["beans"] },
          { id: "b", path: "b/", graphTypologies: ["beans"] },
        ],
      }),
    });
    const by = Object.fromEntries(tilesOf(f)[0]!.stats.map((s) => [s.id, s.value]));
    expect(by).toEqual({ directories: 2, kinds: 1, views: 0 });
  });
});

describe("an instance with no avatar says so rather than rendering blank", () => {
  test("a name with no declared avatar takes the generic one and is reported", () => {
    const f = fixture({ host: host(), who: { name: "who", needs: ["host"], directories: [] } });
    const who = tilesOf(f).find((t) => t.name === "who")!;
    expect(who.genericAvatar).toBe(true);
    expect(who.findings.join(" ")).toContain("no avatar declared");
  });

  test("a name that IS a declared kind takes its own hue", () => {
    // `cat-harness` is in the avatar registry, so its tile is themed by the
    // mechanism that already exists rather than by a second palette.
    const f = fixture({ "cat-harness": { name: "cat-harness", directories: [] }, host: host() });
    const ch = tilesOf(f).find((t) => t.name === "cat-harness")!;
    expect(ch.genericAvatar).toBe(false);
    expect(ch.tone).toBeGreaterThan(0);
  });
});

describe("the published paths are the OTHER generators' rules, read rather than restated", () => {
  test("a subject page is handler/kind/subject — never subject first", () => {
    // `gen-library-viz.ts` is emphatic: `<base>/who-iris/` is who-iris
    // presenting itself, and a viewer parked there would squat on the
    // layer's own site.
    // Under the page locale (folio-assistant#2527): the old address is a
    // forwarding page, and nothing we publish links one.
    expect(subjectPage("cat-harness", "library", "who-iris")).toBe(`/${PAGE_LOCALE}/cat-harness/library/who-iris/`);
  });

  test("an alias is the bare segment, and only that", () => {
    expect(ownStatePage("beans")).toBe("/beans/");
  });
});

describe("a repository with nothing to show", () => {
  test("no site-owning declaration yields no tiles rather than throwing", () => {
    const repo = mkdtempSync(join(tmpdir(), "harness-tiles-"));
    expect(harnessTiles(repo, join(repo, "host"), [])).toEqual([]);
  });

  test("an instance directory with no harness.json is skipped, not guessed at", () => {
    const f = fixture({ host: host() });
    mkdirSync(join(f.repo, "not-an-instance"), { recursive: true });
    expect(harnessTiles(f.repo, join(f.repo, "host"), ["host", "not-an-instance"])).toHaveLength(1);
  });
});

describe("the tile opens the INSTANCE, not a kind handler's view of it", () => {
  test("an instance with its own docs/ links to its themed root", () => {
    // Owner, 2026-09-21: "cliking shoud go to folio view, not the schema
    // viweer", and `mount-instance-docs`: "who-iris themed at `/who-iris/`".
    const f = fixture(
      { host: host(), who: { name: "who", needs: ["host"], directories: [{ id: "s", path: "s/", graphTypologies: ["schemas"] }] } },
      ["host/schemas/who"],
    );
    giveOwnSite(f.repo, "who");
    const who = tilesOf(f).find((t) => t.name === "who")!;
    expect({ href: who.href, kind: who.hrefKind }).toEqual({ href: "/who/", kind: "folio" });
  });

  test("an instance WITHOUT its own docs/ falls back to a viewer, and says so", () => {
    const f = fixture(
      { host: host(), who: { name: "who", needs: ["host"], directories: [{ id: "s", path: "s/", graphTypologies: ["schemas"] }] } },
      ["host/schemas/who"],
    );
    const who = tilesOf(f).find((t) => t.name === "who")!;
    expect(who.hrefKind).toBe("viewer");
    expect(who.findings.join(" ")).toContain("rather than the instance's own themed root");
  });

  test("an instance with neither is NOT a link", () => {
    // `pb04`: a dead link invites a click and then reads as "this site is
    // broken". No target is a better answer than a guessed one.
    const f = fixture({ host: host(), who: { name: "who", needs: ["host"], directories: [] } });
    const who = tilesOf(f).find((t) => t.name === "who")!;
    expect(who.href).toBeUndefined();
    expect(who.hrefKind).toBeUndefined();
  });

  test("the folio view WINS over a viewer that also exists", () => {
    // The defect the owner reported: the first version took whichever viewer
    // sorted first, which for a schemas-only layer is the schema viewer.
    const f = fixture(
      { host: host(), who: { name: "who", needs: ["host"], directories: [{ id: "s", path: "s/", graphTypologies: ["schemas"] }] } },
      ["host/schemas/who"],
    );
    giveOwnSite(f.repo, "who");
    const who = tilesOf(f).find((t) => t.name === "who")!;
    expect(who.href).toBe("/who/");
    // ...and the viewer is still reachable, listed rather than dropped.
    expect(who.visualisations.filter((v) => v.path).map((v) => v.path)).toEqual(["/host/schemas/who/"]);
  });
});

describe("an icon is PUBLISHED, never declared — owner: \"broken image on LHS navbar\"", () => {
  /** A layer declaring an icon at a path under its own site directory. */
  const withIcon = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    directories: [{ id: "beans", path: "beans/", graphTypologies: ["beans"] }],
    icon: "mark",
    // The site directory is read from the DECLARATION, not from disk: this
    // runs before the fixture has written anything, and hardcoding the default
    // here would be the second answer `site-dir-single-answer.test.ts` exists
    // to refuse.
    images: [{ id: "mark", src: `${siteDir({ name, stub: name })}/assets/img/mark.svg`, title: "M" }],
    ...extra,
  });

  test("the site directory's prefix is STRIPPED, because the mount does not carry it", () => {
    // Measured on the served bytes, 2026-09-21:
    //   src="/folio-assistant/branches/<branch>/docs/assets/img/icons/cat-mark.svg"
    // `docs/` is the layer's site directory and the build copies its
    // CONTENTS to the mount, so every reader got a 404 and a placeholder.
    const f = fixture({ host: withIcon("host") });
    const [tile] = tilesOf(f).filter((t) => t.name === "host");
    expect(tile.icon?.src).toBe("/assets/img/mark.svg");
    expect(tile.icon?.src).not.toContain(`${siteDirFor(join(f.repo, "host"))}/`);
  });

  test("an instance mounted beneath the site root carries its SITE DIR's mount", () => {
    // THIS TEST ASSERTED `/sibling/...` AND THAT WAS THE BUG, on the premise
    // "the site owner is at `/`; everything else is at `/<name>/`".
    //
    // Disproved by running the mount rather than by reading a file:
    //
    //     who-iris/library/  ->  /who-iris/        (1378 files)
    //     who-iris/docs/     ->  /docs/who-iris/   (4 files)
    //
    // Every layer gets a `<kind>/<name>` route unconditionally; the bare
    // `<name>` route goes to whichever kind claims it FIRST, and for who-iris
    // that is the library. So the front door served 1,378 corpus files and the
    // icon composed against it 404'd — 404 against 200 for the same asset at
    // `/docs/who-iris/assets/...`, on a mounted build.
    //
    // `<kind>/<name>` is the route that always exists, so it is the one to
    // compose against; the bare one is right only by luck.
    const f = fixture({
      host: host(),
      sibling: withIcon("sibling", {
        directories: [
          { id: "beans", path: "beans/", graphTypologies: ["beans"] },
          { id: "site", path: `${siteDir({ name: "sibling", stub: "sibling" })}/`, graphTypologies: ["docs"] },
        ],
      }),
    });
    giveOwnSite(f.repo, "sibling");
    const [tile] = tilesOf(f).filter((t) => t.name === "sibling");
    expect(tile.icon?.src).toBe("/docs/sibling/assets/img/mark.svg");
  });

  test("no mount means NO icon and a finding — `pb04` one layer down", () => {
    // An `<img>` whose `src` 404s is worse than no `<img>`: a placeholder
    // reads as a broken site rather than as a layer with no art. `sibling`
    // has no site directory of its own, so there is nowhere to serve it from.
    const f = fixture({ host: host(), sibling: withIcon("sibling") });
    const [tile] = tilesOf(f).filter((t) => t.name === "sibling");
    expect(tile.icon).toBeNull();
    expect(tile.findings.join(" ")).toContain("Showing no mark rather than a broken image");
  });

  test("a path outside the site directory is refused rather than rewritten", () => {
    // Guessing would turn a path the layer meant into one it did not, and
    // the result would look exactly like art that failed to load.
    const f = fixture({
      host: {
        name: "host",
        directories: [{ id: "beans", path: "beans/", graphTypologies: ["beans"] }],
        icon: "mark",
        images: [{ id: "mark", src: "elsewhere/mark.svg", title: "M" }],
      },
    });
    const [tile] = tilesOf(f).filter((t) => t.name === "host");
    expect(tile.icon).toBeNull();
    expect(tile.findings.join(" ")).toContain("elsewhere/mark.svg");
  });
});

describe("a LABEL identifies its subject, or it is not a label", () => {
  test("two instances with one title are told apart, and both say so", () => {
    // Owner, 2026-09-21: the sidebar showed `folio-assistant` twice — the
    // repository root acting as a layer, and `cat-harness`, whose declared
    // title is the product's name. Both linked `/`.
    const f = fixture({
      host: { name: "host", title: "Shared", directories: [{ id: "b", path: "b/", graphTypologies: ["beans"] }] },
      other: { name: "other", title: "Shared", directories: [{ id: "b", path: "b/", graphTypologies: ["beans"] }] },
    });
    const labels = tilesOf(f).map((t) => t.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain("Shared (host)");
    expect(labels).toContain("Shared (other)");
    for (const t of tilesOf(f)) {
      expect(t.findings.join(" ")).toContain("is also another instance's");
    }
  });

  test("a unique title is left exactly as its author wrote it", () => {
    // A title is a person's choice and is not required to be unique. The
    // qualifier appears only where it carries information.
    const f = fixture({ host: { ...host(), title: "Only one" } });
    expect(tilesOf(f)[0].label).toBe("Only one");
  });

  test("`name (name)` is never emitted — it says nothing twice", () => {
    const f = fixture({
      host: { name: "host", title: "host", directories: [{ id: "b", path: "b/", graphTypologies: ["beans"] }] },
      other: { name: "other", title: "host", directories: [{ id: "b", path: "b/", graphTypologies: ["beans"] }] },
    });
    const labels = tilesOf(f).map((t) => t.label);
    expect(labels).toContain("host");
    expect(labels).toContain("host (other)");
    expect(labels).not.toContain("host (host)");
  });
});

/* ── A render-exempt layer is still REACHABLE ──────────────────────────
 *
 * Owner, 2026-09-21: *"Boostrap should be clicable. even though it doesnt
 * render itself, cat-bootrap does take over ... render responsibles of
 * bootrstraps json(ld) and documentation."*
 *
 * bootstrap is instantiated, and correctly has no viewer — it declares a
 * `renderExemption`, which is the owner's own 2026-09-20 ruling. So
 * `harness-tiles` found no href and the tab rendered as a greyed `<span>`.
 *
 * NEITHER the declaration NOR `pb04` ("a tab with nowhere to go is not a
 * link") was wrong. What was missing is that the exemption said "I do not
 * render myself" without saying "so go here instead". These cover the field
 * that closes it — and, more importantly, the two ways it can be wrong,
 * because a link invented for an exempt layer 404s for every reader.
 */
describe("a render-exempt instance links to one of its own files, as published", () => {
  const exempt = (reachableAt?: string) => ({
    name: "floor",
    directories: [{ id: "skills", path: "skills/", graphTypologies: ["skills"] }],
    renderExemption: {
      of: ["visualiser"],
      reason: "the bottom of the stack renders nothing",
      owes: "its .json/.jsonld is its existence",
      ...(reachableAt === undefined ? {} : { reachableAt }),
    },
  });

  test("with `reachableAt`, the tab is a link and says what KIND of target it is", () => {
    // `reachableAt` names one of the layer's OWN files, relative to its own
    // directory (bean iwtn), and the site build publishes it at `/<stub>/`.
    const f = fixture({ host: host(), floor: exempt("README.md") });
    writeFileSync(join(f.repo, "floor", "README.md"), "# floor\n");

    const floor = tilesOf(f).find((t) => t.name === "floor")!;
    // `.md` publishes as `.html`, under the layer's stub.
    expect(floor.href).toBe("/floor/README.html");
    // NOT "viewer" and NOT "folio". A third kind, so a consumer can tell that
    // this tab points at a published file rather than a rendering.
    expect(floor.hrefKind).toBe("handled");
    expect(floor.findings.join(" ")).toContain("renders nothing of its own");
  });

  test("WITHOUT `reachableAt` it stays unlinked — absent is a real state", () => {
    // An exempt layer with nothing published about it has no honest
    // target, and inventing one would 404 for every reader.
    const f = fixture({ host: host(), floor: exempt() });
    const floor = tilesOf(f).find((t) => t.name === "floor")!;
    expect(floor.href).toBeUndefined();
    expect(floor.hrefKind).toBeUndefined();
  });

  test("a `reachableAt` that names no file is a FINDING, and still unlinked", () => {
    // `flh4`'s defect: a declared path that does not resolve. Distinct from
    // "nothing is published" — one says the declaration is wrong, the other
    // says nobody built it — so the message has to separate them.
    const f = fixture({ host: host(), floor: exempt("missing.md") });
    const floor = tilesOf(f).find((t) => t.name === "floor")!;
    expect(floor.href).toBeUndefined();
    expect(floor.findings.join(" ")).toContain("not a file");
  });

  test("a `reachableAt` outside the instance is a FINDING, and still unlinked", () => {
    // The file EXISTS, so an existence check alone would pass it — but it is
    // a layer above the layer, which is the leak bean iwtn removed.
    const f = fixture({ host: host(), floor: exempt("../host/NOTES.md") });
    writeFileSync(join(f.repo, "host", "NOTES.md"), "# notes\n");
    const floor = tilesOf(f).find((t) => t.name === "floor")!;
    expect(floor.href).toBeUndefined();
    expect(floor.findings.join(" ")).toContain("outside the instance");
  });

  test("an instance with its OWN site ignores `reachableAt` — it is the last resort", () => {
    // The control. `reachableAt` must not outrank a real folio root, or a
    // layer that gained one would keep pointing at a bare file.
    const f = fixture({ host: host(), floor: exempt("README.md") });
    writeFileSync(join(f.repo, "floor", "README.md"), "# floor\n");
    giveOwnSite(f.repo, "floor");

    const floor = tilesOf(f).find((t) => t.name === "floor")!;
    expect(floor.hrefKind).toBe("folio");
  });
});

describe("a DECLARED visualiser is a viewer — the other half of `flh4`", () => {
  /* The host's site directory, READ from its declaration. Same reason as the
   * block above: hardcoding "docs" here is a second answer to "where does
   * this instance publish", in the tests of all places. */
  const hostSite = (repo: string) => siteDirFor(join(repo, "host"));

  /** Publish a page at a NON-conventional path under the host's site, and
   *  return the repo-relative ref a `coverage.visualiser` would declare. */
  function publishAt(repo: string, rel: string): string {
    const dir = join("host", hostSite(repo), rel);
    mkdirSync(join(repo, dir), { recursive: true });
    writeFileSync(join(repo, dir, "index.html"), "<!doctype html>");
    return join(dir, "index.html");
  }

  /* `dependents` is required on every directory entry and has no default, so
   * `fixture` fills it in. These tests rewrite the declaration AFTER that, to
   * point a visualiser at a page only just published, so they fill it the
   * same way rather than restating it on every entry. */
  function decorate<T extends { directories?: Array<Record<string, unknown>> }>(decl: T): T {
    for (const entry of decl.directories ?? []) entry["dependents"] ??= "skip";
    return decl;
  }

  const withViewer = (ref: string) => ({
    name: "who",
    directories: [{ id: "lib", path: "library/", graphTypologies: ["library"], coverage: { visualiser: ref } }],
  });

  test("a resolving, published visualiser links its kind at the path it names", () => {
    // The defect this fixes, in one sentence: the tile's `directories` list
    // read `coverage.visualiser` and linked it, while `visualisations` two
    // lines away reported the same kind as having no viewer. One question,
    // two answers — and the wrong one is the one a finding counted.
    const f = fixture({ host: host(), who: { name: "who", needs: ["host"], directories: [] } });
    const ref = publishAt(f.repo, "translation-status");
    writeDeclaration(join(f.repo, "who"), JSON.stringify(decorate(withViewer(ref)), null, 2));
    const who = tilesOf(f).find((t) => t.name === "who")!;
    expect(who.visualisations).toEqual([{ kind: "library", label: "Library", path: "/translation-status/" }]);
    expect(who.findings.join(" ")).not.toContain("no published viewer");
  });

  test("a visualiser that does NOT resolve links nothing, and the gap is still reported", () => {
    // `flh4` is that these are two findings, not one: "the declaration is
    // wrong" and "nobody built it". Both leave the kind unlinked, and a
    // generator that linked the declared path regardless would put a 404
    // behind the tab — `pb04`.
    const f = fixture({ host: host(), who: { name: "who", needs: ["host"], directories: [] } });
    const ref = join("host", hostSite(f.repo), "nowhere", "index.html");
    writeDeclaration(join(f.repo, "who"), JSON.stringify(decorate(withViewer(ref)), null, 2));
    const who = tilesOf(f).find((t) => t.name === "who")!;
    expect(who.visualisations).toEqual([{ kind: "library", label: "Library", note: "no viewer yet" }]);
    expect(who.findings.join(" ")).toContain("does not resolve on disk");
    expect(who.findings.join(" ")).toContain("no published viewer");
  });

  test("the checkout ROOT's own site directory is served at the site root, as its icon is (issue #46, gap 3)", () => {
    // A folio that generates its own site and is the checkout's root declares
    // its pages under its own site directory. Only the SITE OWNER's directory
    // counted, so they read "no viewer yet" while its icon, under the same
    // directory, resolved (`siteDirMount`).
    const f = fixture({ host: host(), "": { name: "folio", directories: [] } });
    const site = siteDirFor(f.repo);
    mkdirSync(join(f.repo, site, "schemas"), { recursive: true });
    writeFileSync(join(f.repo, site, "schemas", "index.html"), "<!doctype html>");
    const ref = join(site, "schemas", "index.html");
    writeDeclaration(
      f.repo,
      JSON.stringify(decorate({ name: "folio", directories: [{ id: "sch", path: "schemas/", graphTypologies: ["schemas"], coverage: { visualiser: ref } }] }), null, 2),
    );
    const folio = tilesOf(f).find((t) => t.name === "folio")!;
    expect(folio.visualisations.find((v) => v.kind === "schemas")?.path).toBe("/schemas/");
  });

  test("a folio whose whole site is GENERATED links a writer-built viewer at its ref (smart-ra, 2026-10-14)", () => {
    // The checkout root, no site directory on disk: its pages are written into
    // the site source at publish, so a declared ref IS the site path. Every
    // Folders row on litlfred/smart-ra read "viewer not published" until this.
    const f = fixture({ host: host(), "": { name: "folio", directories: [] } });
    expect(existsSync(join(f.repo, siteDirFor(f.repo)))).toBe(false);
    mkdirSync(join(f.repo, "tools"), { recursive: true });
    writeFileSync(join(f.repo, "tools", "gen.ts"), "");
    const viewer = { ref: "en/folio/models/index.html", writer: ["tools/gen.ts"] };
    writeDeclaration(
      f.repo,
      JSON.stringify(decorate({ name: "folio", directories: [{ id: "m", path: "models/", graphTypologies: ["schemas"], coverage: { visualiser: [viewer] } }] }), null, 2),
    );
    const folio = tilesOf(f).find((t) => t.name === "folio")!;
    expect(folio.visualisations.find((v) => v.kind === "schemas")?.path).toBe("/en/folio/models/");
  });

  test("a data-only site directory (the build's own docs/_data) does not make the site authored", () => {
    const f = fixture({ host: host(), "": { name: "folio", directories: [] } });
    mkdirSync(join(f.repo, siteDirFor(f.repo), "_data"), { recursive: true });
    writeFileSync(join(f.repo, siteDirFor(f.repo), "_data", "stickies.json"), "{}");
    mkdirSync(join(f.repo, "tools"), { recursive: true });
    writeFileSync(join(f.repo, "tools", "gen.ts"), "");
    const viewer = { ref: "en/folio/models/index.html", writer: ["tools/gen.ts"] };
    writeDeclaration(
      f.repo,
      JSON.stringify(decorate({ name: "folio", directories: [{ id: "m", path: "models/", graphTypologies: ["schemas"], coverage: { visualiser: [viewer] } }] }), null, 2),
    );
    expect(tilesOf(f).find((t) => t.name === "folio")!.visualisations.find((v) => v.kind === "schemas")?.path).toBe("/en/folio/models/");
  });

  test("...but not when the folio HAS an authored site on disk", () => {
    const f = fixture({ host: host(), "": { name: "folio", directories: [] } });
    mkdirSync(join(f.repo, siteDirFor(f.repo)), { recursive: true });
    writeFileSync(join(f.repo, siteDirFor(f.repo), "_config.yml"), "title: x\n");
    mkdirSync(join(f.repo, "tools"), { recursive: true });
    writeFileSync(join(f.repo, "tools", "gen.ts"), "");
    const dir = (ref: string) => ({ id: "m", path: "models/", graphTypologies: ["schemas"], coverage: { visualiser: [{ ref, writer: ["tools/gen.ts"] }] } });
    writeDeclaration(f.repo, JSON.stringify(decorate({ name: "folio", directories: [dir("en/folio/models/index.html")] }), null, 2));
    expect(tilesOf(f).find((t) => t.name === "folio")!.visualisations.find((v) => v.kind === "schemas")?.path).toBeUndefined();
  });

  test("a page that resolves OUTSIDE the site directory is NOT linked — and is named as built", () => {
    // Two halves, and they were written by two branches that met in a merge.
    //
    // NOT LINKED is this block's rule: the tile links what the SITE serves,
    // and a ref outside the site directory has no published path to compose
    // without resolving it through `withRoutes` — a layer's own mounted
    // `docs/` lands somewhere the strip above cannot guess.
    //
    // NAMED AS BUILT is main's, and it is the better message. "No published
    // viewer" would assert something false about a page that exists; the
    // `undiscovered` finding says exactly what is true — built, and no tile
    // reaches it — which is what tells the next reader which gap to close.
    const f = fixture({ host: host(), who: { name: "who", needs: ["host"], directories: [] } });
    mkdirSync(join(f.repo, "who", "elsewhere"), { recursive: true });
    writeFileSync(join(f.repo, "who", "elsewhere", "index.html"), "<!doctype html>");
    const ref = join("who", "elsewhere", "index.html");
    writeDeclaration(join(f.repo, "who"), JSON.stringify(decorate(withViewer(ref)), null, 2));
    const who = tilesOf(f).find((t) => t.name === "who")!;
    // THE ROW SAYS THE SAME THING THE FINDING DOES. `viewer not published`,
    // never `no viewer yet` — a reader told the second about a viewer that
    // was built would go and build a second one.
    expect(who.visualisations).toEqual([{ kind: "library", label: "Library", note: "viewer not published" }]);
    expect(who.findings.join(" ")).toContain("exists but is not at a conventional path");
    // And NOT the unbuilt message, which is the assertion that would have
    // been false. Without this line the test passes on a report that says
    // both things at once.
    expect(who.findings.join(" ")).not.toContain("no published viewer");
  });

  test("the CONVENTIONAL page wins when a kind resolves both ways", () => {
    // The order is observable, so it is a decision. Preferring the
    // declaration would repoint a link that already works; preferring the
    // convention fills only the gaps, which is all this is for.
    const f = fixture({ host: host(), who: { name: "who", needs: ["host"], directories: [] } }, ["host/library/who"]);
    const ref = publishAt(f.repo, "somewhere-else");
    writeDeclaration(join(f.repo, "who"), JSON.stringify(decorate(withViewer(ref)), null, 2));
    const who = tilesOf(f).find((t) => t.name === "who")!;
    expect(who.visualisations).toEqual([{ kind: "library", label: "Library", path: "/host/library/who/" }]);
  });

  test("one directory's viewer does not vouch for a kind it does not hold", () => {
    // The map is keyed by the kinds the DECLARING directory lists. A viewer
    // for `library` saying nothing about `uploads` is the point: a tile that
    // borrowed it would claim a page that renders another graph.
    const f = fixture({ host: host(), who: { name: "who", needs: ["host"], directories: [] } });
    const ref = publishAt(f.repo, "lib-view");
    writeDeclaration(
      join(f.repo, "who"),
      JSON.stringify(
        decorate({
          name: "who",
          directories: [
            { id: "lib", path: "library/", graphTypologies: ["library"], coverage: { visualiser: ref } },
            { id: "up", path: "uploads/", graphTypologies: ["uploads"] },
          ],
        }),
        null,
        2,
      ),
    );
    const who = tilesOf(f).find((t) => t.name === "who")!;
    expect(who.visualisations).toEqual([
      { kind: "library", label: "Library", path: "/lib-view/" },
      { kind: "uploads", label: "Uploads", note: "no viewer yet" },
    ]);
    expect(who.findings.join(" ")).toContain("no published viewer — uploads");
  });
});

describe("a render-exempt instance is not missing what it was excused from", () => {
  /* Bean `sbck`, third done-when. bootstrap declares
   * `renderExemption.of: ["visualiser", …]` and the tile went on reporting
   * its graphs as "no published viewer" — a gap raised against a layer
   * excused from exactly that, which is the noise the bean names. */
  const exempt = (extra: Record<string, unknown> = {}) => ({
    name: "floor",
    directories: [{ id: "skills", path: "skills/", graphTypologies: ["skills"] }],
    renderExemption: {
      of: ["visualiser"],
      reason: "the bottom of the stack renders nothing",
      owes: "its own graph as .jsonld",
      ...extra,
    },
  });

  test("its unrendered kinds are named as EXEMPT, not as a gap", () => {
    const f = fixture({ host: host(), floor: exempt() });
    const floor = tilesOf(f).find((t) => t.name === "floor")!;
    const all = floor.findings.join(" ");
    expect(all).toContain("render no viewer");
    expect(all).toContain("under a declared `renderExemption`");
    // The assertion that would have failed before: the gap wording is gone.
    expect(all).not.toContain("no published viewer");
  });

  test("the kinds are still NAMED, and so is what the layer owes", () => {
    // `2krx`: an opt-out without a reason per entry becomes a silence list.
    // Dropping the finding would make "excused" and "nobody looked"
    // indistinguishable, so the exemption is stated with its substitute —
    // what is unrendered AND what is carried instead, which is the bargain
    // the exemption struck.
    const f = fixture({ host: host(), floor: exempt() });
    const floor = tilesOf(f).find((t) => t.name === "floor")!;
    const f0 = floor.findings.find((x) => x.includes("render no viewer"))!;
    expect(f0).toContain("skills");
    expect(f0).toContain("its own graph as .jsonld");
  });

  test("an instance exempt from something ELSE still gets the gap finding", () => {
    // The control. `isExemptFrom` takes the obligation, and an exemption
    // from `own-docs` says nothing about viewers — without this a rule that
    // read "has any exemption" would pass.
    const f = fixture({
      host: host(),
      floor: exempt({ of: ["own-docs"], owes: "its README on the forge" }),
    });
    const floor = tilesOf(f).find((t) => t.name === "floor")!;
    expect(floor.findings.join(" ")).toContain("no published viewer");
  });

  test("an instance with NO exemption is unaffected", () => {
    const f = fixture({
      host: host(),
      who: { name: "who", needs: ["host"], directories: [{ id: "lib", path: "library/", graphTypologies: ["library"] }] },
    });
    const who = tilesOf(f).find((t) => t.name === "who")!;
    expect(who.findings.join(" ")).toContain("no published viewer");
  });

  test("a directory declaring `coverage.exempt.visualiser` renders `no viewer by design` and a `Not a gap` finding (bean folio-assistant-6gme)", () => {
    // `folio-assistant-sci/folio-assistant-sci.json` declares `coverage.exempt.visualiser`
    // on `sci-lean` ("This directory holds a Lean TEMPLATE, not a Lake package...").
    // `check-subgraph-coverage.ts` honours `dir.coverage?.exempt?.visualiser`, and
    // `harness-tiles.ts` must agree so the row says "no viewer by design" and the
    // finding says "Not a gap" while non-exempted unbuilt kinds still report as gaps.
    const f = fixture({
      host: host(),
      sci: {
        name: "sci",
        needs: ["host"],
        directories: [
          {
            id: "sci-lean",
            path: "lean/",
            graphTypologies: ["lean"],
            coverage: {
              exempt: {
                visualiser: "This directory holds a Lean TEMPLATE, not a Lake package.",
              },
            },
          },
          {
            id: "lib",
            path: "library/",
            graphTypologies: ["library"],
          },
        ],
      },
    });
    const sci = tilesOf(f).find((t) => t.name === "sci")!;
    expect(sci.visualisations).toEqual([
      { kind: "lean", label: "Lean packages", note: "no viewer by design" },
      { kind: "library", label: "Library", note: "no viewer yet" },
    ]);
    const exemptFinding = sci.findings.find((x) => x.includes("render no viewer"))!;
    expect(exemptFinding).toContain("lean");
    expect(exemptFinding).toContain("coverage.exempt.visualiser");
    expect(exemptFinding).toContain("Not a gap");
    expect(exemptFinding).toContain("This directory holds a Lean TEMPLATE");
    const gapFinding = sci.findings.find((x) => x.includes("no published viewer"))!;
    expect(gapFinding).toContain("library");
    expect(gapFinding).not.toContain("lean");
  });
});

describe("an icon's URL is the SITE DIRECTORY's mount, not the instance's front door", () => {
  // MEASURED, by running `mount-instance-docs` against a built preview rather
  // than by reading either file:
  //
  //     who-iris/library/  ->  /who-iris/        (1378 files)
  //     who-iris/docs/     ->  /docs/who-iris/   (4 files)
  //
  // Every layer gets a `<kind>/<name>` route unconditionally; the bare
  // `<name>` route goes to whichever kind claims it first, and for who-iris
  // that is the LIBRARY. So its front door serves 1,378 corpus files and its
  // docs are somewhere else entirely.
  //
  // The shipped version composed an icon against `folioRoot` — the front door
  // — and produced a URL that 404s. Confirmed against a mounted build: 404 for
  // `/who-iris/assets/...` and 200 for `/docs/who-iris/assets/...`, same asset.
  //
  // The local preview HID it, which is why this is a test and not a comment:
  // `preview:site` does not run the mount, so the asset was absent there for
  // an unrelated reason and the wrong URL looked like the same 404.

  const withIcon = (name: string, kind: string) => ({
    name,
    icon: "mark",
    images: [{ id: "mark", src: `${siteDir({ name })}/assets/m.svg`, title: "M", description: "d" }],
    directories: [{ id: `${name}-site`, path: `${siteDir({ name })}/`, graphTypologies: [kind] }],
  });

  test("a mounted instance addresses its icon under its site dir's KIND", () => {
    const f = fixture({ host: host({ needs: [] }), guest: withIcon("guest", "docs") });
    giveOwnSite(f.repo, "guest");
    const guest = tilesOf(f).find((t) => t.name === "guest")!;
    expect(guest.icon?.src).toBe("/docs/guest/assets/m.svg");
  });

  test("...and the kind is the DECLARATION's, not the string `docs`", () => {
    // The whole point: who-iris's bare route is taken by `library`, so a rule
    // that assumed `docs` would be right by luck here and wrong there.
    const f = fixture({ host: host({ needs: [] }), guest: withIcon("guest", "library") });
    giveOwnSite(f.repo, "guest");
    const guest = tilesOf(f).find((t) => t.name === "guest")!;
    expect(guest.icon?.src).toBe("/library/guest/assets/m.svg");
  });

  test("the site OWNER keeps the root — its docs are built in place, not mounted", () => {
    const f = fixture({
      host: { ...host({ needs: [] }), ...withIcon("host", "docs"), name: "host" },
    });
    const h = tilesOf(f).find((t) => t.name === "host")!;
    expect(h.icon?.src).toBe(`/assets/m.svg`);
  });

  test("an instance that classifies its site dir under NO kind gets no icon", () => {
    // `pb04` one layer down, and a real answer rather than a guess: nothing
    // can be said about where a directory nobody classified will be served, so
    // an `<img>` is not emitted at all.
    const f = fixture({
      host: host({ needs: [] }),
      guest: {
        name: "guest",
        icon: "mark",
        images: [{ id: "mark", src: `${siteDir({ name: "guest" })}/assets/m.svg`, title: "M", description: "d" }],
        // A registered kind, on a path that is NOT the site directory — so the
        // site dir itself is classified by nothing.
        directories: [{ id: "beans", path: "beans/", graphTypologies: ["beans"] }],
      },
    });
    giveOwnSite(f.repo, "guest");
    const guest = tilesOf(f).find((t) => t.name === "guest")!;
    expect(guest.icon).toBeNull();
  });
});

/**
 * THE WORDS ON AN INERT ROW, all four of them.
 *
 * Two of these four answers occur ZERO times in this repository — measured
 * over all 31 unlinked kinds in `docs/_data/harness.json` on 2026-09-23, of
 * which 24 are `unbuilt` and 7 are `unbuilt` under `bootstrap`'s exemption.
 * `staging-only` and `undiscovered` are produced by no layer here, and
 * `harnessTiles` emits no finding of either shape either.
 *
 * `undiscovered` is still reached by a FIXTURE — the `flh4` test above, for a
 * viewer that resolves outside the site directory, which now asserts the row
 * as well as the finding. `staging-only` is reached by nothing else at all,
 * so the first test below is the only thing in this repository that runs it.
 * `1xhc` — a gate that does not fire is indistinguishable from one that
 * passed.
 */
describe("inertNote — why a row does not open", () => {
  test("a STAGING-ONLY viewer is withheld on purpose, and is not called a gap", () => {
    // `harness-tiles` already refuses to report this as a finding: "a report
    // that flags an intended state as a finding is the same disease as one
    // that hides a real gap". Labelling the row "no viewer yet" on the surface
    // a reader is actually looking at would be that same mistake, moved.
    expect(inertNote("staging-only", false)).toBe("staging only");
    // And the exemption has no view about it — it is withheld by its own
    // `publish` setting, not by a decision not to render.
    expect(inertNote("staging-only", true)).toBe("staging only");
  });

  test("a viewer that EXISTS but is not published says so — it is a different gap", () => {
    // "Built and unreachable is a different gap from unbuilt", in the
    // finding's own words. A reader told "no viewer yet" about a viewer that
    // was built would go and build a second one.
    expect(inertNote("undiscovered", false)).toBe("viewer not published");
    expect(inertNote("undiscovered", true)).toBe("viewer not published");
  });

  test("UNBUILT is the only bucket the render exemption narrows", () => {
    expect(inertNote("unbuilt", false)).toBe("no viewer yet");
    expect(inertNote("unbuilt", true)).toBe("no viewer by design");
  });

  test("every answer is distinct — four states must not collapse to one wording", () => {
    // The defect this replaced: `title="declared, with no published viewer"`,
    // one wording for four states, and wrong for two of them.
    const all = [
      inertNote("staging-only", false),
      inertNote("undiscovered", false),
      inertNote("unbuilt", false),
      inertNote("unbuilt", true),
    ];
    expect(new Set(all).size).toBe(4);
  });
});

describe("an instance's OWN theme tones its tile (bean v8n5)", () => {
  // Over THIS repository, because the subject is a real reference: who-iris's
  // card cites `{instance: "who-iris", themeId: "iris-sticky"}`, a theme the
  // platform does not hold. If resolution fell back to the platform default,
  // or the tone to the avatar registry, the tile would still render — on the
  // wrong hue — which is why this is a test and not a glance.
  const REPO = join(dirname(HARNESS_ROOT));
  const HOST = join(REPO, "cat-harness");
  const tiles = harnessTiles(REPO, HOST, ["who-iris", "cat-harness", "bootstrap"]);

  test("an instance citing a PLATFORM theme keeps its avatar tone", () => {
    for (const name of ["cat-harness", "bootstrap"]) {
      expect(tiles.find((t) => t.name === name)!.toneFrom).toBe("avatar");
    }
  });
});

describe("one name per destination (bean `ob3m` finding 6)", () => {
  test("each row carries its kind's display name; two kinds on two pages are not merged", () => {
    const f = fixture(
      {
        host: host(),
        who: { name: "who", needs: ["host"], directories: [{ id: "s", path: "schemas/", graphTypologies: ["schemas", "cat-harness"] }] },
      },
      ["host/schemas/who"],
    );
    const who = tilesOf(f).find((t) => t.name === "who")!;
    // ONE directory holding two kinds is drawn by ONE declared visualiser, so
    // both rows open the same page, and the second says it is the same page
    // rather than inventing a second name for it. A page at a conventional
    // `/host/cat-harness/who/` would be reached by nothing: nothing declares it.
    expect(who.visualisations.map((v) => [v.kind, v.label, v.sameAs])).toEqual([
      ["cat-harness", "Schemas", "schemas"],
      ["schemas", "Schemas", undefined],
    ]);
  });

  test("an INSTANTIATED harness with no folio opens its landing section, not a graph's viewer", () => {
    // `host` declares a processes visualiser drawing one view per layer.
    // Bootstrap's row linked `/processes/` and named that page "Bootstrap".
    const f = fixture(
      {
        host: host({ visualisers: [...HOST_VISUALISERS, { id: "processes", renderedBy: "processes-viewer", coversKinds: ["processes"], subgraphs: "instance" }] }),
        who: { name: "who", needs: ["host"], directories: [{ id: "p", path: "processes/", graphTypologies: ["processes"] }] },
      },
      ["host/processes/who"],
    );
    writeFileSync(join(f.repo, "who.config.json"), "{}");
    const who = tilesOf(f).find((t) => t.name === "who")!;
    expect(who.instantiated).toBe(true);
    expect({ href: who.href, kind: who.hrefKind }).toEqual({ href: "/#harness-who", kind: "section" });
    // The graph keeps its own page under its own name.
    expect(who.visualisations).toEqual([{ kind: "processes", label: "Processes", path: "/host/processes/who/" }]);
  });
});

describe("subgraphsOf — every declared graph, marked local or remote (603s)", () => {
  const dirs = [
    { id: "library", path: "who/library/", graphTypologies: ["library"] },
    { id: "docs", path: "who/docs/", graphTypologies: ["docs"] },
  ];

  test("lists the declared directories as LOCAL, in declared order, with their paths", () => {
    const rows = subgraphsOf({}, dirs);
    expect(rows.map((r) => [r.id, r.where])).toEqual([["library", "local"], ["docs", "local"]]);
    expect(rows[0]).toMatchObject({ path: "who/library/", kinds: ["library"] });
  });

  test("lists remote graphs and subscriptions as REMOTE, after the local ones", () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const rows = subgraphsOf(
      {
        remoteGraphs: [{ id: "upstream", url: "https://example.org/kg", graphTypologies: ["skills"] }],
        subscriptions: [{ id: "smart", repository: "WorldHealthOrganization/smart-base", ref: sha, subgraphs: ["library"] }],
      } as Parameters<typeof subgraphsOf>[0],
      dirs,
    );
    expect(rows.map((r) => r.where)).toEqual(["local", "local", "remote", "remote"]);
    expect(rows[2]).toMatchObject({ id: "upstream", via: "remote-graph", url: "https://example.org/kg" });
    expect(rows[3]).toMatchObject({
      id: "smart",
      via: "subscription",
      ref: "0123456",
      materialised: ["library"],
      url: `https://github.com/WorldHealthOrganization/smart-base/tree/${sha}`,
    });
  });

  test("an instance with nothing remote has zero remote rows, not an absent list", () => {
    expect(subgraphsOf({ remoteGraphs: [], subscriptions: [] }, dirs).filter((r) => r.where === "remote")).toEqual([]);
  });
});

describe("every harness's navbar MARK is resolved once — bean `2vpn`", () => {
  // Owner, 2026-10-04: *"who-iris is missing top icon on LHS navbar … all
  // needs to be consistent and consolidated"*. who-iris's mark was a registry
  // glyph, and the resolver only knew theme cards and declared icons.
  test("an instance with its own registry glyph and no image carries the GLYPH as its mark", () => {
    // The glyph is the declaration's own `avatar` (sod4 #4), so the fixture
    // carries it rather than leaning on the real checkout's smart-base.json.
    const avatar = { glyph: "M0 0h1v1z", tone: 210, reads: "test" };
    const f = fixture({ "smart-base": { name: "smart-base", directories: [], avatar }, host: host() });
    const sb = tilesOf(f).find((t) => t.name === "smart-base")!;
    expect(sb.mark?.glyph).toMatch(/^M/);
    expect(sb.mark?.src).toBeUndefined();
  });

  test("the generic fallback is a blank mark when an instance has none declared", () => {
    const f = fixture({ host: host(), who: { name: "who", needs: ["host"], directories: [] } });
    expect(tilesOf(f).find((t) => t.name === "who")!.mark).toEqual({
      glyph: "M3 3h18v18H3z",
      title: "a blank mark — no avatar declared; rendered in theme colour",
      blank: true,
    });
  });
});
