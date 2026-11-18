/**
 * A folio's site describes the FOLIO, not the platform (#2263).
 *
 * Owner, 2026-10-06, on https://litlfred.github.io/smart-trust/: *"the beans
 * and todos badges seems to be countts from folio-assistant and not
 * litlfred/smart-trust as expected. links to beans and todos dont work. why
 * not? fix process and skills."*
 *
 * Nothing caught it because every check ran on the PLATFORM's own site, where
 * the platform's tiles are right by construction. These tests run the two
 * foreign-site passes — the IG site's chrome shell (`compose-docs --shell`)
 * and the injected rail (`rail-standalone-pages --foreign-site`) — over a
 * FOLIO, and assert the two halves of the rule:
 *
 *   (a) the tiles describe the folio's layer: no other layer's count,
 *       and no other layer's state graph linked;
 *   (b) no href is left root-relative unless it is the folio's own path,
 *       resolved inside the folio's baseurl.
 *
 * And the same rule for a FIGURE that is not a tile (the #2263 follow-up):
 *
 *   (c) the platform's translation sweep and index are not shipped as the
 *       folio's, and the sweep badge is told what to SAY instead
 *       ("Swept 49/689" on every page of an IG folio's site was the platform's);
 *   (d) the fsh-guts icon is not this site's trashcan unless the folio links
 *       its own, so its count is not fetched from a site that has none
 *       (it showed "?").
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
// Publish-time files are written to the layer output overlay (bean sm8r);
// these read the copy a site reader sees, falling back to the path given.
import { existsSync, readFileSync, readdirSync } from "../../test/support/site-fs.ts";
import type { Dirent } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import { siteDirFor, siteFileFor } from "../../schemas/kg/cat-harness.js";
import { compose, EMPTY_TODO_LISTING } from "../compose-docs.ts";
import {
  HOST_DATA_PROJECTIONS,
  foreignScopeFor,
  isHostProjection,
  foreignFooterContent,
  rootOwnPages,
  rootRelativeLeft,
  scopeHarnessData,
  scopeSiteConfig,
  scopeStickies,
  scopeNavbarRow,
  scopeTiles,
  siteHref,
  type ForeignScope,
} from "../lib/foreign-site-scope.ts";
import { railStandalonePages } from "../mount-instance-docs.js";
import { navbarRowJsonOf } from "../lib/harness-rail.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";
import { writeDeclaration } from "../../test/support/instance-fixture.js";
import { copyBuiltAtPublish, notApplicableAlone, scratchCheckoutOf, siteNotBuilt } from "../../test/support/checkout.ts";
import { ensureThemesCss } from "../../test/support/themes-css.ts";
import { declaredPlan, runWriter, writersOf } from "../derive-at-publish.ts";

const REPO = resolve(dirname(HARNESS_ROOT));
const BASE = "https://litlfred.github.io/folio-assistant";
const CAT_HARNESS = join(REPO, "cat-harness");
/** The platform's own harness data, at its declared site directory (`siteDirFor`), never a literal. */
const PLATFORM_DATA = join(CAT_HARNESS, siteDirFor(CAT_HARNESS), "_data", "harness.json");
const SMART_TRUST = join(REPO, "smart-trust");

// The platform's harness data is BUILT AT PUBLISH (cat-harness's
// `builtAtPublish`, B1), and so is smart-trust's own site, which it reads:
// `docs:harness` gives smart-trust a rail scope only when that site exists.
// Neither is committed. Until 2026-10-15 this file read whatever an earlier
// `derive:publish` had left in the tree — CI's step before `bun test`, or
// another file's hook (`staging-only-publish` ran the whole of it until
// a1794c8) — so in a checkout with no such run, or alone, the describes below
// threw ENOENT at collection, and over a build in the wrong order they read a
// harness.json with no smart-trust rail scope.
//
// So this file builds what it reads, and only that: the writers the
// declarations name for those two artefacts, in `derive:publish`'s own order
// (`declaredPlan`, consumers first — smart-trust:pages before docs:pages and
// docs:harness), run the way it runs them (`runWriter`). About 10 s, against
// the whole `derive:publish`'s 300 s and more. At module scope, not in a
// hook, because the describes compute their fixtures at collection time.
// The writers resolve their paths from the checkout they belong to, so they
// write into this tree's ignored, publish-time paths, as a site build does.
//
// And it takes away again what it ADDED, once its tests have run. `docs:pages`
// writes far more than harness.json (the todos pages, the bean and QA
// projections, the witnesses under test/results/) and smart-trust:pages a
// whole site; a test file run after this one in the same `bun test` must see
// the tree it would have seen without it. pr-tests.yml runs no
// `derive:publish`, so left behind they gave every later file a tree main's
// run never has: "Tests (no new failures)" went red on PR #306, and locally
// compose-docs' "the cut, on the REAL tree" passes with them absent and
// fails with them present. A path that existed before is left as the
// writers made it: they are deterministic over the same inputs (harness.json
// rebuilt twice is byte-identical).
//
// Where they cannot be built — a layer standing alone without smart-trust
// (the standalone ratchet), or no state mounted — this says why and builds
// nothing, and the tests that read the data fail on their own, by name, as
// they do without it; it does not turn the whole file into one load error.
/** Every file and directory under `roots`, so what this file's build adds can be taken away again. */
function inventory(roots: readonly string[]): Set<string> {
  const out = new Set<string>();
  const walk = (d: string): void => {
    let es: Dirent[];
    try {
      es = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of es) {
      if (e.name === "node_modules" || e.name === ".git") continue;
      const p = join(d, e.name);
      out.add(p);
      if (e.isDirectory()) walk(p);
    }
  };
  for (const r of roots) walk(r);
  return out;
}
const BUILD_ROOTS = [CAT_HARNESS, SMART_TRUST];
const BEFORE_BUILD = inventory(BUILD_ROOTS);
afterAll(() => {
  const added = [...inventory(BUILD_ROOTS)].filter((p) => !BEFORE_BUILD.has(p));
  // Deepest first, so a directory goes after what it holds; one the build made goes whole.
  for (const p of added.sort((a, b) => b.length - a.length)) rmSync(p, { recursive: true, force: true });
});

try {
  const READS = new Set([PLATFORM_DATA, join(SMART_TRUST, siteDirFor(SMART_TRUST))].map((p) => resolve(p)));
  const READ_PLAN = declaredPlan(REPO).filter((a) => READS.has(resolve(a.abs)));
  // Built already (the publish wrote them, into the overlay): build nothing.
  // A scratch rebuild copied back over the publish's own `harness.json` left
  // it out of step with the include `navbar:include` wrote from it, and later
  // files in the shard (gen-navbar-include's fixpoint, nav-names) read that.
  const ALREADY_BUILT = [...READS].every((p) => existsSync(p));
  if (ALREADY_BUILT) {
    // nothing to do: read what the publish built
  } else if (READ_PLAN.length !== READS.size) {
    console.warn(
      `foreign-site-scope: built nothing — expected a builtAtPublish entry for each of ${[...READS].join(", ")}; found ${READ_PLAN.map((a) => `${a.instance}/${a.path}`).join(", ") || "none"}`,
    );
  } else {
    // `docs:pages` also re-renders every layer's committed pages and QA
    // witnesses, so the writers run over a scratch copy of the checkout and
    // only what the layers build at publish is copied back (bean
    // `cat-tools-sm8r` item 4: in place, a mounted layer read `edited`).
    const scratch = scratchCheckoutOf(REPO);
    try {
      for (const w of writersOf(READ_PLAN)) {
        const o = runWriter(["bun", "run", "cat", w], scratch);
        if (o.kind !== "ran") {
          console.warn(`foreign-site-scope: the publish-time writer \`${w}\` did not build what this file reads (${JSON.stringify(o)}; is the state mounted? \`bun run cat state:mount\`)`);
          break;
        }
      }
      copyBuiltAtPublish(scratch, REPO);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
} catch (e) {
  console.warn(`foreign-site-scope: built nothing — could not read the publish plan: ${(e as Error).message}`);
}

/** A scope over a made-up declaration set, so the rule matrix is stated rather than inherited. */
function fakeScope(over: Partial<ForeignScope> = {}): ForeignScope {
  const kinds: Record<string, string[]> = {
    beans: ["beans"],
    todos: ["todos"],
    skills: ["skills"],
    qa: ["qa"],
    mystery: ["no-such-kind"],
    "folio-docs": ["docs"],
  };
  const holds: Record<string, string> = { beans: "state", todos: "state", qa: "state", skills: "content", docs: "content" };
  return {
    instance: "folio",
    platformBase: BASE,
    ownKinds: new Set(["docs", "qa"]),
    kindsOf: (id) => kinds[id],
    holdsOf: (k) => holds[k],
    ...over,
  };
}

const tile = (id: string, href: string, count?: number) => ({
  id,
  directory: id,
  title: id,
  qualifier: "C@T Harness",
  href,
  ...(count === undefined ? {} : { count, unit: "things" }),
});

describe("a folio that is the ROOT of its own site keeps the pages it declares (issue #46, gap 1)", () => {
  // Its pages are written root-relative (`/beans/`), not under `/<instance>/`.
  const s = fakeScope({ ownPages: new Set(["/beans/", "/schemas/"]) });

  test("a declared own page is the folio's: kept root-relative, with its link and count", () => {
    expect(siteHref("/beans/", s)).toBe("/beans/");
    const [beans] = scopeTiles([tile("beans", "/beans/", 15)], s);
    expect(beans!.href).toBe("/beans/");
    expect(beans!.count).toBe(15);
    const row = scopeNavbarRow({ icons: ["beans"], hrefs: { beans: "/beans/" }, folders: [{ kind: "schemas", path: "/schemas/" }] }, s) as {
      hrefs: Record<string, string>;
      folders: { path?: string }[];
    };
    expect(row.hrefs.beans).toBe("/beans/");
    expect(row.folders[0]!.path).toBe("/schemas/");
  });

  test("a root-relative path it does NOT declare is still not its own", () => {
    expect(siteHref("/todos/", s)).toBe(`${BASE}/todos/`);
    const [todos] = scopeTiles([tile("todos", "/todos/", 3)], s);
    expect(todos!.href).toBeUndefined();
  });
});

describe("the rule, one row per case", () => {
  const s = fakeScope();
  const out = Object.fromEntries(
    scopeTiles(
      [
        tile("beans", "/beans/", 916),
        tile("todos", "/todos/", 3),
        tile("skills", "/skills/", 40),
        tile("qa", "/lsi/", 1002),
        tile("mystery", "/mystery/", 7),
        tile("folio-docs", "/folio/docs/", 12),
      ],
      s,
    ).map((t) => [t.id, t]),
  );

  test("another instance's STATE graph is not borrowed: no link, no count", () => {
    for (const id of ["beans", "todos"]) {
      expect(out[id]!.href).toBeUndefined();
      expect(out[id]!.count).toBeUndefined();
    }
  });

  test("declaring a kind of the same NAME does not make the platform's graph the folio's (smart-trust declares `qa`)", () => {
    expect(out.qa!.href).toBeUndefined();
    expect(out.qa!.count).toBeUndefined();
  });

  test("a kind that cannot be classified is treated as state — the conservative direction", () => {
    expect(out.mystery!.href).toBeUndefined();
  });

  test("a platform CONTENT graph is re-based onto the platform, labelled, and carries no count", () => {
    expect(out.skills!.href).toBe(`${BASE}/skills/`);
    expect(out.skills!.count).toBeUndefined();
    expect(out.skills!.showQualifier).toBe(true);
  });

  test("the folio's OWN graph resolves inside its own root and keeps its count", () => {
    expect(out["folio-docs"]!.href).toBe("/docs/");
    expect(out["folio-docs"]!.count).toBe(12);
  });

  test("an inert icon SAYS why, and the words tell 'declares none' from 'not published here'", () => {
    const row = scopeNavbarRow({ icons: ["todos", "qa", "skills"], hrefs: { todos: "/todos/", qa: "/qa/", skills: "/skills/" } }, s) as {
      hrefs: Record<string, string>;
      notes: Record<string, string>;
    };
    expect(row.hrefs).toEqual({ skills: `${BASE}/skills/` });
    expect(row.notes.todos).toBe("folio declares no todos graph");
    expect(row.notes.qa).toBe("folio's qa graph is not published on this site");
  });

  test("siteHref: own root, platform, and what it leaves alone", () => {
    expect(siteHref("/folio/", s)).toBe("/");
    expect(siteHref("/folio/a.html", s)).toBe("/a.html");
    expect(siteHref("/folios/a.html", s)).toBe(`${BASE}/folios/a.html`);
    expect(siteHref("https://x.org/a", s)).toBe("https://x.org/a");
    expect(siteHref("#top", s)).toBe("#top");
  });

  test("a count projection is told apart from chrome", () => {
    expect(isHostProjection("assets/beans/count.json", '{"tile":{"beans":{"count":1,"unit":"beans"}}}')).toBe(true);
    expect(isHostProjection("assets/harness/tiles.json", "---\nlayout: null\n---\n{{ site.data.harness.tiles | jsonify }}")).toBe(false);
    expect(isHostProjection("assets/img/x.json", '{"a":1}')).toBe(false);
  });

  test("(c) the host's translation sweep and index are projections, by name, on either separator", () => {
    expect(isHostProjection("_data/translation-qa.json", '{"sweptAt":"x","totalPages":689}')).toBe(true);
    expect(isHostProjection("_data/translations.json", '{"$schema":"folio-translation-index/v1"}')).toBe(true);
    expect(isHostProjection("_data\\translations.json", "{}")).toBe(true);
    expect(isHostProjection("_data/instance-themes.json", '{"instances":[]}')).toBe(false);
  });

  test("(d) a borrowed icon says WHOSE it is; an own one does not", () => {
    const row = scopeNavbarRow(
      { icons: ["fsh-guts", "skills"], hrefs: { "fsh-guts": "/fsh-guts/", skills: "/folio/skills/" } },
      fakeScope({ kindsOf: (id) => (id === "fsh-guts" ? ["fsh-guts"] : ["skills"]), holdsOf: () => "context" }),
    ) as { hrefs: Record<string, string>; whose?: Record<string, string> };
    expect(row.hrefs["fsh-guts"]).toBe(`${BASE}/fsh-guts/`);
    expect(row.whose?.["fsh-guts"]).toBe("the platform's: folio declares no fsh-guts graph");
    expect(row.hrefs.skills).toBe("/skills/");
    expect(row.whose?.skills).toBeUndefined();
  });

  test("(c, d) foreignSite.absent says what the chrome shows instead of a number", () => {
    const fish = (href?: string, note?: string) =>
      (scopeHarnessData(
        { navbar: { icons: ["fsh-guts"], hrefs: href ? { "fsh-guts": href } : {}, ...(note ? { notes: { "fsh-guts": note } } : {}) } },
        fakeScope({ kindsOf: () => ["fsh-guts"], holdsOf: () => "context" }),
      ).foreignSite as { absent: Record<string, string> }).absent;
    // The platform's trashcan, re-based: not this site's, so no count is fetched here.
    expect(fish("/fsh-guts/")).toEqual({
      translationQa: "folio publishes no translation QA sweep on this site",
      fshGuts: "folio declares no fsh-guts graph",
    });
    // The folio's OWN trashcan: its count is this site's to fetch.
    expect(fish("/folio/fsh-guts/").fshGuts).toBeUndefined();
  });
});

// smart-trust is a higher layer a standalone checkout does not hold, and
// the platform's harness data is built at publish and gitignored (bean w1gy
// F18). Either absent, there is no real data to scope.
const NO_REAL_DATA =
  (!existsSync(SMART_TRUST) && notApplicableAlone("smart-trust's checkout, whose rail scope the platform's data is scoped to (a higher instance)")) ||
  siteNotBuilt("the platform's harness data `docs:harness` writes at publish (gitignored)", PLATFORM_DATA);
describe.skipIf(NO_REAL_DATA)("smart-trust, against the platform's real harness data", () => {
  // `describe.skipIf` still runs this body, so nothing is read when it skips.
  const data = (NO_REAL_DATA ? {} : JSON.parse(readFileSync(PLATFORM_DATA, "utf-8"))) as Record<string, unknown>;
  const out = (NO_REAL_DATA
    ? {}
    : scopeHarnessData(data, foreignScopeFor(REPO, { instance: "smart-trust", platformBase: BASE, title: "WHO SMART Trust" }))) as {
    title: string;
    tiles: { id: string; href?: string; count?: number }[];
    navbar: { hrefs: Record<string, string>; notes: Record<string, string> };
    railScopes: { name: string; href: string }[];
  };

  test("(a) no tile carries the platform's count, and its beans and todos are not linked", () => {
    expect(out.tiles.filter((t) => t.count !== undefined)).toEqual([]);
    for (const id of ["beans", "todos"]) expect(out.tiles.find((t) => t.id === id)?.href).toBeUndefined();
    expect(out.navbar.hrefs.beans).toBeUndefined();
    expect(out.navbar.hrefs.todos).toBeUndefined();
    // Only a navbar row that carries the beans slot owes its note: the
    // platform's row dropped beans, todos and fsh-guts on 2026-11-13
    // (cat-harness's `navbarIcons`), so whether it is there is read from the data.
    const icons = ((data.navbar as { icons?: string[] } | undefined)?.icons ?? []);
    if (icons.includes("beans")) expect(out.navbar.notes.beans).toBe("smart-trust declares no beans graph");
    else expect(out.navbar.notes.beans).toBeUndefined();
  });

  test("(d) the platform's fsh-guts is a labelled link, and the chrome is told it is not this site's", () => {
    const o = out as unknown as {
      navbar: { hrefs: Record<string, string>; whose?: Record<string, string> };
      foreignSite: { absent: Record<string, string> };
    };
    // Re-based onto the platform: the platform's OWN root-relative href for its
    // fsh-guts page (since 2026-10-09 under its declared `<locale>/<harness>/`
    // route), read from the platform's data rather than restated here.
    // The navbar half applies only while the platform's row has the slot
    // (it left the row on 2026-11-13); the chrome's `absent` half always does.
    const platformHref = (data.navbar as { hrefs: Record<string, string> }).hrefs["fsh-guts"];
    if (platformHref !== undefined) {
      expect(platformHref.startsWith("/")).toBe(true);
      expect(o.navbar.hrefs["fsh-guts"]).toBe(`${BASE}${platformHref}`);
      expect(o.navbar.whose?.["fsh-guts"]).toBe("the platform's: smart-trust declares no fsh-guts graph");
    } else {
      expect(o.navbar.hrefs["fsh-guts"]).toBeUndefined();
    }
    expect(o.foreignSite.absent.fshGuts).toBe("smart-trust declares no fsh-guts graph");
    expect(o.foreignSite.absent.translationQa).toBe("smart-trust publishes no translation QA sweep on this site");
  });

  test("(a) the header and the rail scope are smart-trust's", () => {
    expect(out.title).toBe("WHO SMART Trust");
    expect(out.railScopes.map((r) => [r.name, r.href])).toEqual([["smart-trust", "/"]]);
  });

  test("(b) every root-relative path left is one of smart-trust's own, from under /smart-trust/", () => {
    const own = new Set(
      rootRelativeLeft(data)
        .map((p) => p.split("=")[1]!)
        .filter((p) => p.startsWith("/smart-trust/"))
        .map((p) => `/${p.slice("/smart-trust/".length)}`),
    );
    for (const left of rootRelativeLeft(out)) expect(own.has(left.split("=")[1]!)).toBe(true);
  });
});

describe("the IG site's shell (compose-docs --shell), end to end", () => {
  const out = mkdtempSync(join(tmpdir(), "foreign-shell-"));
  const r = compose(out, REPO, { shell: true, foreign: { instance: "smart-trust", platformBase: BASE } });
  // The shell is smart-trust's, a higher layer a standalone checkout does
  // not hold; and what it leaves out or scopes is the platform's BUILT site,
  // written at publish and gitignored (bean w1gy F18). Either absent, the
  // composition has nothing to scope.
  const noSmartTrust = (): boolean =>
    !existsSync(SMART_TRUST) && notApplicableAlone("smart-trust's checkout, whose IG site the shell composes (a higher instance)");
  const PLATFORM_SITE = join(CAT_HARNESS, siteDirFor(CAT_HARNESS));

  test.skipIf(
    noSmartTrust() ||
      siteNotBuilt("the platform's beans count projection `docs:pages` writes at publish (gitignored)", join(PLATFORM_SITE, "assets", "beans", "count.json")),
  )("the platform's count projections are not shipped as the folio's", () => {
    expect(existsSync(join(out, "assets", "beans", "count.json"))).toBe(false);
    expect(existsSync(join(out, "assets", "todos", "count.json"))).toBe(false);
    expect(r.scoped?.hostProjections).toContain("assets/beans/count.json");
    // Chrome stays: the todo page's own script is code, not the platform's todos.
    expect(existsSync(join(out, "assets", "todos", "todo-page.js"))).toBe(true);
  });

  test.skipIf(noSmartTrust())("(c) the platform's translation sweep and index are not shipped as the folio's", () => {
    for (const rel of Object.keys(HOST_DATA_PROJECTIONS)) {
      expect(existsSync(join(out, rel))).toBe(false);
      expect(r.scoped?.hostProjections).toContain(rel);
    }
  });

  test("(c) every data file the shell still carries is chrome — a new projection must be named", () => {
    // What each remaining `_data/` file is, and why it is not a figure about
    // the host's pages on the folio's site. A file not listed here fails this
    // test: it is either a projection (a HOST_DATA_PROJECTIONS row) or chrome
    // (a row here), and somebody has to say which.
    const CHROME: Record<string, string> = {
      "harness.json": "scoped to the folio by scopeHarnessData, not copied",
      "instance-themes.json": "which theme a URL prefix wears: configuration, read by prefix",
      "node-kinds.json": "the node-kind vocabulary: context, not a count",
      "stickies.json": "read only by the platform's landing page (index.md), which a shell does not carry",
      "todo_listing.json": "written EMPTY ({pages:{}}): no page of the folio's site lists a platform note",
    };
    const left = readdirSync(join(out, "_data")).filter((f) => f.endsWith(".json"));
    expect(left.filter((f) => !(f in CHROME))).toEqual([]);
  });

  test("the platform's per-page todo listing is written EMPTY, never left out", () => {
    // Left out, the footer would fall back to the platform's WHOLE listing.
    const p = join(out, "_data", "todo_listing.json");
    // The host's listing is built at publish; with none built there is nothing to empty.
    const host = join(REPO, "cat-harness", siteDirFor(join(REPO, "cat-harness")), "_data", "todo_listing.json");
    if (!existsSync(host)) return;
    expect(JSON.parse(readFileSync(p, "utf-8"))).toEqual(EMPTY_TODO_LISTING);
  });

  const noHarnessData = (): boolean =>
    noSmartTrust() || siteNotBuilt("the platform's harness data `docs:harness` writes at publish (gitignored)", PLATFORM_DATA);
  test.skipIf(noHarnessData())("its harness data is scoped: no count, no unresolved root-relative href", () => {
    const d = JSON.parse(readFileSync(join(out, "_data", "harness.json"), "utf-8")) as { tiles: { count?: number }[] };
    expect(d.tiles.filter((t) => t.count !== undefined)).toEqual([]);
    const known = new Set(["/artifacts.html"]); // smart-trust's own, under its baseurl
    for (const left of rootRelativeLeft(d)) expect(known.has(left.split("=")[1]!)).toBe(true);
  });
});

describe("the footer line: a folio's site does not print the platform's (#1901 follow-up)", () => {
  /** The platform's own `footer_content`, read from its config rather than restated. */
  const platformConfig = parseYaml(readFileSync(join(CAT_HARNESS, siteDirFor(CAT_HARNESS), "_config.yml"), "utf-8")) as Record<string, unknown>;
  const platformFooter = platformConfig.footer_content as string;

  test("scopeSiteConfig names the folio, links the platform absolutely, and states no licence", () => {
    const c = scopeSiteConfig({ title: "Platform", footer_content: "Platform — code under Some Licence" }, { instance: "scratch-folio", title: "Scratch <Folio>", platformBase: BASE });
    expect(c.footer_content).toBe(`Scratch &lt;Folio&gt; — built with <a href="${BASE}/">Platform</a>.`);
    expect(String(c.footer_content)).not.toMatch(/licen[cs]e/i);
    // No title: the layer name. No layer either: no name is invented.
    expect(foreignFooterContent({ instance: "scratch-folio", platformBase: BASE }, "P")).toStartWith("scratch-folio — built with");
    expect(foreignFooterContent({ platformBase: BASE }, "P")).toBe(`This site is built with <a href="${BASE}/">P</a>.`);
    // Nothing to replace: the same object back.
    const none = { title: "Platform" };
    expect(scopeSiteConfig(none, { platformBase: BASE })).toBe(none);
  });

  test("the shell for a scratch folio carries the neutral line, not the platform's footer text", () => {
    expect(platformFooter).toBeTruthy(); // else this test proves nothing
    const out = mkdtempSync(join(tmpdir(), "foreign-footer-"));
    try {
      compose(out, REPO, { shell: true, foreign: { instance: "scratch-folio", title: "Scratch Folio", platformBase: BASE } });
      const c = parseYaml(readFileSync(join(out, "_config.yml"), "utf-8")) as Record<string, unknown>;
      expect(c.footer_content).not.toBe(platformFooter);
      expect(String(c.footer_content)).toBe(foreignFooterContent({ instance: "scratch-folio", title: "Scratch Folio", platformBase: BASE }, String(platformConfig.title)));
      expect(String(c.footer_content)).not.toMatch(/licen[cs]e/i);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  test("the platform's own build keeps its footer text, byte for byte", () => {
    const out = mkdtempSync(join(tmpdir(), "own-footer-"));
    try {
      compose(out, REPO, {});
      // Since slice 1 of the semantic subgraphs the platform's config is two
      // layers, the site chrome's and docs/'s, MERGED — so the composed file is
      // parse-equal rather than byte-equal (owner ruling D1, 2026-10-09). The
      // footer is the site's own, and it arrives unchanged.
      const own = parseYaml(readFileSync(join(CAT_HARNESS, siteDirFor(CAT_HARNESS), "_config.yml"), "utf-8")) as Record<string, unknown>;
      const composed = parseYaml(readFileSync(join(out, "_config.yml"), "utf-8")) as Record<string, unknown>;
      expect(composed.footer_content).toBe(own.footer_content);
      for (const [k, v] of Object.entries(own)) expect(composed[k]).toEqual(v);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("the injected rail (rail-standalone-pages --foreign-site) over a fixture folio page", () => {
  // The rail pins the harness's themes.css, which cat-harness#371 builds at
  // publish rather than commits: build it here when the checkout lacks it.
  beforeAll(() => {
    ensureThemesCss(HARNESS_ROOT);
  });

  // The icon row is the harness data's `navbar`, which `docs:harness` writes at publish (gitignored).
  test.skipIf(
    siteNotBuilt(
      "the harness data `docs:harness` writes at publish (gitignored), whose `navbar` is the icon row",
      join(HARNESS_ROOT, siteDirFor(HARNESS_ROOT), "_data", "harness.json"),
    ),
  )("its icon row names no platform work plan and no root-relative destination", () => {
    const root = mkdtempSync(join(tmpdir(), "foreign-rail-"));
    mkdirSync(join(root, "doc"), { recursive: true });
    writeFileSync(join(root, "doc", "index.html"), "<!doctype html>\n<html><head><title>t</title></head><body><h1>Doc</h1></body></html>\n");
    const r = railStandalonePages(root, "cat-harness", "cat-harness", [], { platformBase: BASE, homeLabel: "smart-trust", instance: "smart-trust" });
    expect(r.injected).toBe(1);
    const html = readFileSync(join(root, "doc", "index.html"), "utf-8");
    // The row is written ONCE beside the rail's data (2026-10-10); read it as a browser would.
    const json = navbarRowJsonOf(html, (f) => (existsSync(join(root, f)) ? readFileSync(join(root, f), "utf-8") : undefined));
    expect(json).toBeDefined();
    const row = JSON.parse(json!) as { icons: string[]; hrefs: Record<string, string>; notes: Record<string, string> };
    expect(row.hrefs.beans).toBeUndefined();
    expect(row.hrefs.todos).toBeUndefined();
    // cat-harness's row no longer carries Todos or Beans at all (owner,
    // 2026-11-13: "remove the fsh-guts, beans and todos"); a layer that still
    // declares them gets the note, which the cases above test.
    expect(row.icons).not.toContain("todos");
    expect(row.icons).not.toContain("beans");
    expect(rootRelativeLeft(row)).toEqual([]);
  });
});

describe("the chrome reads foreignSite.absent (head_custom.html, rendered)", () => {
  /** head_custom.html rendered with liquidjs, includes stubbed: only the two islands are read. */
  async function render(data: Record<string, unknown>): Promise<{ sweep: Record<string, unknown>; fishSrc: boolean }> {
    const { Liquid } = await import("liquidjs");
    const liquid = new Liquid({
      jekyllInclude: true,
      dynamicPartials: false,
      fs: {
        readFileSync: () => "",
        existsSync: () => true,
        exists: async () => true,
        readFile: async () => "",
        resolve: (_r: string, f: string) => f,
        contains: () => true,
        dirname: () => "",
        sep: "/",
      } as never,
    });
    liquid.registerFilter("relative_url", (p: string) => `/ig-folio${p}`);
    liquid.registerFilter("absolute_url", (p: string) => `https://example.org/ig-folio${p}`);
    liquid.registerFilter("jsonify", (v: unknown) => JSON.stringify(v ?? null));
    const src = readFileSync(join(CAT_HARNESS, siteFileFor(CAT_HARNESS, "_includes/head_custom.html")), "utf-8");
    const html = await liquid.parseAndRender(src, { site: { baseurl: "/ig-folio", data }, page: { path: "p.md" } });
    const meta = /id="fa-translation-meta">([\s\S]*?)<\/script>/.exec(html);
    expect(meta).not.toBeNull();
    return {
      sweep: (JSON.parse(meta![1]!) as { sweep: Record<string, unknown> }).sweep,
      fishSrc: /<meta name="fa-fsh-guts-src"/.test(html.replace(/<!--[\s\S]*?-->/g, "")),
    };
  }
  const absent = { translationQa: "ig-folio publishes no translation QA sweep on this site", fshGuts: "ig-folio declares no fsh-guts graph" };

  test("(c, d) on a folio's site with no sweep of its own: the words, and no fsh-guts fetch", async () => {
    const r = await render({ harness: { foreignSite: { instance: "ig-folio", absent } } });
    expect(r.sweep.absent).toBe(absent.translationQa);
    expect(r.sweep.run).toBe(false);
    expect(r.fishSrc).toBe(false);
  });

  test("(c) a folio that publishes its OWN sweep shows its own figure, not the note", async () => {
    const r = await render({
      harness: { foreignSite: { instance: "ig-folio", absent } },
      "translation-qa": { sweptAt: "t", totalPages: 12, pagesWithTranslations: 3, complete: true },
    });
    expect(r.sweep.absent).toBeNull();
    expect(r.sweep.totalPages).toBe(12);
  });

  test("on the platform's own site nothing changes: no note, and the fsh-guts document is fetched", async () => {
    const r = await render({ harness: {}, "translation-qa": { sweptAt: "t", totalPages: 689, pagesWithTranslations: 49, complete: true } });
    expect(r.sweep.absent).toBeNull();
    expect(r.sweep.pagesWithTranslations).toBe(49);
    expect(r.fishSrc).toBe(true);
  });
});

describe("the landing stickies on a folio's site (who-iris, 2026-10-09)", () => {
  const scope = { instance: "who-iris", platformBase: BASE };
  const data = {
    stickies: [
      {
        id: "cat-harness",
        links: [
          { label: "source", href: "https://github.com/litlfred/cat-harness", external: true },
          { label: "docs", href: "/docs/cat-harness/concepts/agentic-harness.html", external: false },
          { label: "own", href: "/who-iris/community-list.html", external: false },
          { label: "relative", href: "community-list.html", external: false },
        ],
      },
    ],
  };
  const links = (scopeStickies(data, scope).stickies as { links: { label: string; href: string; external: boolean }[] }[])[0]!.links;
  test("a platform page is re-based onto the platform's site, and marked external so relative_url leaves it alone", () => {
    expect(links[1]).toEqual({ label: "docs", href: `${BASE}/docs/cat-harness/concepts/agentic-harness.html`, external: true });
  });
  test("an external link, a path in the folio's own root, and a relative link are the folio's", () => {
    expect(links[0]!.href).toBe("https://github.com/litlfred/cat-harness");
    expect(links[2]).toEqual({ label: "own", href: "/community-list.html", external: false });
    expect(links[3]!.href).toBe("community-list.html");
  });
  test("a file with no stickies passes through", () => {
    expect(scopeStickies({ other: 1 }, scope)).toEqual({ other: 1 });
  });
});

describe("rootOwnPages on a GENERATED folio site (smart-ra, 2026-10-14)", () => {
  test("a writer-built viewer is the folio's own page at its ref; with a site directory on disk it is not", () => {
    const repo = mkdtempSync(join(tmpdir(), "gen-site-"));
    try {
      mkdirSync(join(repo, "tools"), { recursive: true });
      writeFileSync(join(repo, "tools", "gen.ts"), "");
      const decl = {
        name: "folio",
        directories: [{ id: "m", path: "models/", graphTypologies: ["archimate"], coverage: { visualiser: [{ ref: "en/folio/models/index.html", writer: ["tools/gen.ts"] }] } }],
      };
      writeDeclaration(repo, JSON.stringify(decl, null, 2));
      expect([...(rootOwnPages(repo, "folio") ?? [])]).toEqual(["/en/folio/models/"]);
      mkdirSync(join(repo, siteDirFor(repo), "_data"), { recursive: true });
      expect([...(rootOwnPages(repo, "folio") ?? [])]).toEqual(["/en/folio/models/"]);
      writeFileSync(join(repo, siteDirFor(repo), "_config.yml"), "title: x\n");
      expect(rootOwnPages(repo, "folio")).toBeUndefined();
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
