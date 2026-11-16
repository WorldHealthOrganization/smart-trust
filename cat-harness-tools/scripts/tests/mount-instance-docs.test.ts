/**
 * The mount-point resolution rule.
 *
 * Owner, 2026-09-20: *"an instance can also register 'new' sub-pages. name
 * collsion can occur potentially. need resolution rule: walk path to see which
 * instantiated handler wants to process the path then stop."*
 *
 * Asserted against `resolve_` directly rather than through `cpSync`, because a
 * routing rule tested only by copying files is a rule whose failing case
 * nobody writes down — and the failing case is the whole point: two handlers
 * wanting one path must produce a REFUSAL, not a silent overwrite.
 *
 * @module scripts/tests/mount-instance-docs.test
 *
 * The tests of this file that read the whole checkout (reads smart-trust's and
 * smart-base's served directories) live in
 * `test/mount-instance-docs-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, expect, it } from "bun:test";

import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { publishedPath } from "../../schemas/kg/url-space.js";

import {
  declaredEntries,
  igSiteRoots,
  instanceRoute,
  mountable,
  mountedKindRoutes,
  servedClashes,
  servedDirectories,
  WITHHELD_FILE,
  publishedAsset,
  redirectHtml,
  referencedAssets,
  resolve_,
  withRoutes,
  withheldFilter,
  withheldPaths,
} from "../mount-instance-docs.js";

const r = (route: string) => ({ route });

describe("the walk stops at the first handler that wants the path", () => {
  it("mounts non-overlapping routes, all of them", () => {
    const { mounts, refused } = resolve_([r("docs/who-iris"), r("library/who-iris")]);
    expect(mounts.map((m) => m.route)).toEqual(["docs/who-iris", "library/who-iris"]);
    expect(refused).toEqual([]);
  });

  it("OUTERMOST wins: a handler at `docs` owns `docs/who-iris`", () => {
    // The direction that matters, and the opposite of longest-prefix routing.
    // A mount point is a claim on a SUBTREE: if a deeper handler could punch
    // through, the outer layer's own index could not be trusted to describe
    // what sits under it.
    const { mounts, refused } = resolve_([r("docs/who-iris"), r("docs")]);
    expect(mounts.map((m) => m.route)).toEqual(["docs"]);
    expect(refused.map((x) => [x.route, x.ownedBy])).toEqual([["docs/who-iris", "docs"]]);
  });

  it("refuses regardless of the order the claims arrive in", () => {
    // Directory-read order varies by filesystem. A collision report that
    // depended on it would be irreproducible, and the two runs would disagree
    // about which layer is at fault.
    const a = resolve_([r("docs"), r("docs/who-iris")]);
    const b = resolve_([r("docs/who-iris"), r("docs")]);
    expect(a.mounts.map((m) => m.route)).toEqual(b.mounts.map((m) => m.route));
    expect(a.refused.map((x) => x.route)).toEqual(b.refused.map((x) => x.route));
  });

  it("an exact duplicate is a collision too, not a harmless re-mount", () => {
    // Two layers declaring the same name is not hypothetical here: #477
    // records TWO silent name collisions in one merge, and `instanceRoots` is
    // keyed on the declared name, so "the stub won" with nothing reported.
    const { mounts, refused } = resolve_([r("docs/who-iris"), r("docs/who-iris")]);
    expect(mounts).toHaveLength(1);
    expect(refused.map((x) => [x.route, x.ownedBy])).toEqual([["docs/who-iris", "docs/who-iris"]]);
  });

  it("a shared PREFIX that is not a path segment is not a collision", () => {
    // `docs/who-iris` must not be treated as owning `docs/who-iris-extra`.
    // A naive `startsWith` says it does, and the site would then refuse a
    // perfectly distinct layer on a string coincidence.
    const { mounts, refused } = resolve_([r("docs/who-iris"), r("docs/who-iris-extra")]);
    expect(mounts.map((m) => m.route)).toEqual(["docs/who-iris", "docs/who-iris-extra"]);
    expect(refused).toEqual([]);
  });

  it("owns the whole subtree, not just the next segment down", () => {
    const { mounts, refused } = resolve_([r("library"), r("library/who-iris/items/x")]);
    expect(mounts.map((m) => m.route)).toEqual(["library"]);
    expect(refused.map((x) => x.ownedBy)).toEqual(["library"]);
  });

  it("a refused claim is carried out with its owner named, never dropped", () => {
    // The property that makes the non-zero exit actionable: a report saying
    // "something collided" and not WITH WHAT is a report somebody switches off.
    const { refused } = resolve_([r("docs"), r("docs/a"), r("docs/b")]);
    expect(refused).toHaveLength(2);
    for (const x of refused) expect(x.ownedBy).toBe("docs");
  });

  it("returns every claim exactly once, across the two lists", () => {
    // The partition property. Without it a claim could go missing from both
    // and the site would be short a page with nothing saying so.
    const claims = [r("docs"), r("docs/a"), r("library/x"), r("library"), r("uploads/y")];
    const { mounts, refused } = resolve_(claims);
    expect([...mounts, ...refused]).toHaveLength(claims.length);
    expect(new Set([...mounts, ...refused].map((x) => x.route)).size).toBe(claims.length);
    // And the split is the one the rule dictates: `docs` and `library` each
    // swallow their child, `uploads/y` stands alone.
    expect(mounts.map((m) => m.route).sort()).toEqual(["docs", "library", "uploads/y"]);
    expect(refused.map((x) => x.route).sort()).toEqual(["docs/a", "library/x"]);
  });
});

describe("both handlers register: the kind's, and the instance's own", () => {
  it("an instance root and its kind route are DISTINCT, so neither refuses the other", () => {
    // Owner, 2026-09-20: "/docs/who-iris/ should be the cat-harness handler
    // default for docs. who-iris themed at /who-iris/." Two handlers, two
    // routes -- the walk never has to choose between them.
    const { mounts, refused } = resolve_([r("docs/who-iris"), r("who-iris")]);
    expect(mounts.map((m) => m.route).sort()).toEqual(["docs/who-iris", "who-iris"]);
    expect(refused).toEqual([]);
  });

  it("but an instance root DOES own its own subtree", () => {
    // `/who-iris/` is a claim on everything beneath it, like any other mount.
    const { mounts, refused } = resolve_([r("who-iris"), r("who-iris/extra")]);
    expect(mounts.map((m) => m.route)).toEqual(["who-iris"]);
    expect(refused.map((x) => x.ownedBy)).toEqual(["who-iris"]);
  });

  it("an instance root does NOT own a same-prefixed sibling instance", () => {
    const { mounts, refused } = resolve_([r("who-iris"), r("who-iris-extra")]);
    expect(mounts).toHaveLength(2);
    expect(refused).toEqual([]);
  });
});

describe("which kind answers at the instance's own route", () => {
  const m = (name: string, kind: string, instanceRoot = false) => ({
    name,
    kind,
    dir: `/repo/${name}/${kind}`,
    instanceRoot,
  });

  it("ONE renderable kind needs no choosing", () => {
    const { candidates, undetermined } = withRoutes([m("who-iris", "docs")]);
    expect(candidates.map((c) => c.route).sort()).toEqual(["docs/who-iris", "who-iris"]);
    expect(undetermined).toEqual([]);
  });

  it("the DECLARED kind takes the root, not the one that sorts first", () => {
    // The defect this field exists for. `docs` sorts before `library`, so the
    // themed root served the documentation — contradicting the ruling that
    // puts the themed replica there. Order is deliberately docs-first here so
    // the test fails if the declaration stops being consulted.
    const { candidates, undetermined } = withRoutes([
      m("who-iris", "docs"),
      m("who-iris", "library", true),
    ]);
    const root = candidates.find((c) => c.route === "who-iris");
    expect(root?.kind).toBe("library");
    expect(undetermined).toEqual([]);
  });

  it("every kind still gets its own route, declared root or not", () => {
    const { candidates } = withRoutes([m("who-iris", "docs"), m("who-iris", "library", true)]);
    expect(candidates.map((c) => c.route).sort()).toEqual([
      "docs/who-iris",
      "library/who-iris",
      "who-iris",
    ]);
  });

  it("the root is emitted ONCE, however many kinds are declared", () => {
    const { candidates } = withRoutes([
      m("who-iris", "docs"),
      m("who-iris", "library", true),
      m("who-iris", "catalogue"),
    ]);
    expect(candidates.filter((c) => c.route === "who-iris")).toHaveLength(1);
  });

  it("several kinds and NONE declared is UNDETERMINED, and still serves something", () => {
    // Could-not-determine is not a choice, and not a crash either: a site has
    // to answer at that URL. The caller reports it rather than letting a
    // silent pick read as a decision.
    const { candidates, undetermined } = withRoutes([m("x", "docs"), m("x", "library")]);
    expect(undetermined).toEqual([{ name: "x", kinds: ["docs", "library"], serving: "docs" }]);
    expect(candidates.filter((c) => c.route === "x")).toHaveLength(1);
  });

  it("a declared root YIELDS its kind route to a same-kind sibling — bean 2b5s", () => {
    // A replica (`site/`) and documentation (`docs/`) both declared `docs`.
    // Without the rule both claim `docs/inst` and the walk refuses one; with
    // it the replica answers at `/inst/` only and the kind route stays with
    // the sibling that is not the root.
    const site = { ...m("inst", "docs", true), dir: "/repo/inst/site" };
    const docs = { ...m("inst", "docs"), dir: "/repo/inst/docs" };
    const { candidates, undetermined } = withRoutes([docs, site]);
    expect(candidates.map((c) => [c.route, c.dir]).sort()).toEqual([
      ["docs/inst", "/repo/inst/docs"],
      ["inst", "/repo/inst/site"],
    ]);
    expect(resolve_(candidates).refused).toEqual([]);
    expect(undetermined).toEqual([]);
  });

  it("same-kind siblings with no root each get their OWN kind route — cat-harness-tools#681", () => {
    // `ui/`, `viewer/` and `id-lookup/` all declared `code`. All three claimed
    // `code/cat-harness-tools` and the walk refused two, which failed every
    // site build that mounted the layer. Each now answers under its own
    // directory, and nothing claims the shared route.
    const dirs = ["ui", "viewer", "id-lookup"].map((d) => ({ ...m("cht", "code"), dir: `/repo/cht/${d}` }));
    const { candidates } = withRoutes(dirs);
    expect(candidates.map((c) => c.route).sort()).toEqual(["cht", "code/cht/id-lookup", "code/cht/ui", "code/cht/viewer"]);
    expect(resolve_(candidates).refused).toEqual([]);
  });

  it("a lone directory of a kind keeps the plain kind route", () => {
    const { candidates } = withRoutes([m("cht", "code"), m("cht", "docs", true)]);
    expect(candidates.map((c) => c.route).sort()).toEqual(["cht", "code/cht", "docs/cht"]);
  });

  it("with NO same-kind sibling the root still publishes at both routes", () => {
    // One docs directory, marked root. The yield rule must not take a URL
    // away from a layer it does not concern.
    const { candidates } = withRoutes([m("lone", "docs", true)]);
    expect(candidates.map((c) => c.route).sort()).toEqual(["docs/lone", "lone"]);
  });

  it("a root already TAKEN by an IG site is not inherited by the next kind", () => {
    // smart-trust: `docs/` is the declared root AND `igSite`, so it is built
    // by stage-ig-sites and never reaches `found`. `openapi/` then claimed
    // `/smart-trust/`, was copied over the IG site, and the mount's rail walk
    // railed every IG page on top of the side-bar they already carry.
    const { candidates, undetermined } = withRoutes([m("st", "openapi"), m("st", "library")], new Set(["st"]));
    expect(candidates.map((c) => c.route).sort()).toEqual(["library/st", "openapi/st"]);
    expect(undetermined).toEqual([]);
  });

  it("a declared igSite root keeps /<instance>/ off the mount table — read from a declaration", () => {
    // smart-trust's shape, as a fixture so it holds in a standalone checkout.
    const repo = mkdtempSync(join(tmpdir(), "igsite-root-"));
    const inst = join(repo, "st");
    for (const d of ["docs", "openapi"]) {
      mkdirSync(join(inst, d), { recursive: true });
      writeFileSync(join(inst, d, "index.html"), "<html><body></body></html>");
    }
    writeFileSync(
      join(inst, "st.json"),
      JSON.stringify({
        name: "st",
        directories: [
          { id: "st-docs", path: "docs/", graphTypologies: ["docs"], instanceRoot: true, igSite: true },
          { id: "st-openapi", path: "openapi/", graphTypologies: ["openapi"] },
        ],
      }),
    );
    expect([...igSiteRoots(repo)]).toEqual(["st"]);
    const found = mountable(repo).filter((m) => m.name === "st");
    expect(found.map((m) => m.kind)).toEqual(["openapi"]);
    expect(withRoutes(found).candidates.map((c) => c.route).sort()).toEqual(["openapi/st", "st"]); // the defect
    expect(withRoutes(found, igSiteRoots(repo)).candidates.map((c) => c.route)).toEqual(["openapi/st"]);
  });

  it("an instance declared at the REPOSITORY ROOT is mounted too — a separated instance's own site", () => {
    // who-iris's shape after its cutover (bean g8jp): the declaration sits at the
    // checkout root, not in a subdirectory, so the subdirectory scan alone found
    // nothing and the replica was published nowhere.
    const repo = mkdtempSync(join(tmpdir(), "root-instance-"));
    for (const d of ["site", "docs"]) {
      mkdirSync(join(repo, d), { recursive: true });
      writeFileSync(join(repo, d, "index.html"), "<html><body></body></html>");
    }
    writeFileSync(
      join(repo, "wi.json"),
      JSON.stringify({
        name: "wi",
        directories: [
          { id: "wi-site", path: "site/", graphTypologies: ["docs"], instanceRoot: true },
          { id: "wi-docs", path: "docs/", graphTypologies: ["docs"] },
        ],
      }),
    );
    const found = mountable(repo).filter((m) => m.name === "wi");
    expect(found.length).toBe(2);
    expect(withRoutes(found).candidates.map((c) => c.route).sort()).toEqual(["docs/wi", "wi"]);
  });

  it("mountedKindRoutes answers the kind route the navbar's Docs row opens, and not the instance root", () => {
    // who-iris, 2026-11-13: `docs/` (the CDN proposal among it) mounted at
    // /docs/who-iris/ while the Folders row read "no viewer yet".
    const repo = mkdtempSync(join(tmpdir(), "kind-route-"));
    for (const d of ["site", "docs", "guides", "notes"]) {
      mkdirSync(join(repo, d), { recursive: true });
      writeFileSync(join(repo, d, "index.html"), "<html><body></body></html>");
    }
    writeFileSync(
      join(repo, "wi.json"),
      JSON.stringify({
        name: "wi",
        directories: [
          { id: "wi-site", path: "site/", graphTypologies: ["docs"], instanceRoot: true },
          { id: "wi-docs", path: "docs/", graphTypologies: ["docs"] },
          // Two of one kind share no route, so neither is THE kind's page.
          { id: "wi-guides", path: "guides/", graphTypologies: ["processes"] },
          { id: "wi-notes", path: "notes/", graphTypologies: ["processes"] },
        ],
      }),
    );
    expect([...mountedKindRoutes(repo, "wi")]).toEqual([["docs", "/docs/wi/"]]);
    expect(mountedKindRoutes(repo, "nobody").size).toBe(0);
  });

  it("a directory of a kind a build Tool publishes (web-app) is never mounted, though it holds an index.html", () => {
    // smart-trust's onboarding game, 2026-11-12: its Vite index.html made the
    // mount pass copy the source and node_modules to /web-app/smart-trust/.
    const repo = mkdtempSync(join(tmpdir(), "web-app-not-mounted-"));
    for (const d of ["game", "docs"]) {
      mkdirSync(join(repo, "wa", d), { recursive: true });
      writeFileSync(join(repo, "wa", d, "index.html"), "<html><body></body></html>");
    }
    writeFileSync(
      join(repo, "wa", "wa.json"),
      JSON.stringify({
        name: "wa",
        directories: [
          { id: "game", path: "game/", graphTypologies: ["web-app"] },
          { id: "wa-docs", path: "docs/", graphTypologies: ["docs"] },
        ],
      }),
    );
    expect(mountable(repo).filter((m) => m.name === "wa").map((m) => m.kind)).toEqual(["docs"]);
  });

  it("one instance being undetermined does not implicate another", () => {
    const { undetermined } = withRoutes([
      m("x", "docs"),
      m("x", "library"),
      m("y", "docs"),
      m("y", "library", true),
    ]);
    expect(undetermined.map((u) => u.name)).toEqual(["x"]);
  });
});

describe("a mounted directory's withheld.json is honoured — bean cw35", () => {
  const tree = () => {
    const d = mkdtempSync(join(tmpdir(), "withheld-"));
    mkdirSync(join(d, "refused", "sections"), { recursive: true });
    mkdirSync(join(d, "kept"), { recursive: true });
    writeFileSync(join(d, "refused", "sections", "p1.md"), "text of a work whose licence refuses redistribution");
    writeFileSync(join(d, "refused-cover.png"), "x");
    writeFileSync(join(d, "refused-covers-are-not-a-prefix.png"), "x");
    writeFileSync(join(d, "kept", "p1.md"), "fine");
    writeFileSync(join(d, "index.html"), "<html></html>");
    return d;
  };

  it("absent → nothing withheld", () => {
    expect(withheldPaths(tree())).toEqual([]);
  });

  it("copies everything EXCEPT the listed paths, and a directory takes its whole subtree", () => {
    const d = tree();
    writeFileSync(
      join(d, WITHHELD_FILE),
      JSON.stringify({ $schema: "folio-withheld/v1", paths: [{ path: "refused/", reason: "copyright refused" }, { path: "refused-cover.png", reason: "copyright refused" }] }),
    );
    const out = mkdtempSync(join(tmpdir(), "site-"));
    cpSync(d, out, { recursive: true, filter: withheldFilter(d, withheldPaths(d)) });
    expect(existsSync(join(out, "refused"))).toBe(false);
    expect(existsSync(join(out, "refused", "sections", "p1.md"))).toBe(false);
    expect(existsSync(join(out, "refused-cover.png"))).toBe(false);
    // a sibling whose NAME merely starts with a withheld path is not withheld
    expect(existsSync(join(out, "refused-covers-are-not-a-prefix.png"))).toBe(true);
    expect(existsSync(join(out, "kept", "p1.md"))).toBe(true);
    expect(existsSync(join(out, "index.html"))).toBe(true);
  });

  it("a withheld.json it cannot read REFUSES to mount — never 'publish everything'", () => {
    const d = tree();
    writeFileSync(join(d, WITHHELD_FILE), "{ not json");
    expect(() => withheldPaths(d)).toThrow(/refusing to publish/);
    writeFileSync(join(d, WITHHELD_FILE), JSON.stringify({ paths: [{ nope: 1 }] }));
    expect(() => withheldPaths(d)).toThrow(/refusing to publish/);
  });
});

describe("a page's embedded assets are published, and nothing else from their directory — bean 2b5s", () => {
  const instance = () => {
    const d = mkdtempSync(join(tmpdir(), "inst-"));
    mkdirSync(join(d, "site", "sub"), { recursive: true });
    mkdirSync(join(d, "library", "slug"), { recursive: true });
    writeFileSync(join(d, "library", "a-cover.png"), "a");
    writeFileSync(join(d, "library", "b-cover.png"), "b");
    writeFileSync(join(d, "library", "unreferenced.png"), "u");
    writeFileSync(join(d, "library", "slug", "section.md"), "corpus");
    writeFileSync(join(d, "site", "local.png"), "l");
    return d;
  };

  it("finds the embedded files outside the mount, and only those", () => {
    const d = instance();
    writeFileSync(
      join(d, "site", "index.html"),
      '<img src="../library/a-cover.png"><img src="local.png"><a href="../library/b-cover.png">x</a>' +
        '<img src="https://example.org/x.png"><img src="data:image/png;base64,AA"><script src="/abs.js"></script>',
    );
    writeFileSync(join(d, "site", "sub", "p.html"), '<img src="../../library/b-cover.png">');
    const { assets, problems } = referencedAssets(join(d, "site"), d);
    expect(problems).toEqual([]);
    // `local.png` is inside the mount and travels with it; the `href` is
    // navigation, not an embed; remote, data and root-absolute are not files.
    expect(assets.map((a) => [a.page, a.underInstance])).toEqual([
      ["index.html", "library/a-cover.png"],
      ["sub/p.html", "library/b-cover.png"],
    ]);
  });

  it("publishes beneath the route at the instance-relative path, and rewrites the ref to match", () => {
    const d = instance();
    writeFileSync(join(d, "site", "index.html"), '<img src="../library/a-cover.png">');
    writeFileSync(join(d, "site", "sub", "p.html"), '<img src="../../library/a-cover.png">');
    const [top, deep] = referencedAssets(join(d, "site"), d).assets;
    expect(publishedAsset("inst", top!)).toEqual({ dest: "inst/library/a-cover.png", ref: "library/a-cover.png" });
    expect(publishedAsset("inst", deep!)).toEqual({ dest: "inst/library/a-cover.png", ref: "../library/a-cover.png" });
  });

  it("refuses, naming it, a ref that leaves the instance, resolves to nothing, or is withheld", () => {
    const d = instance();
    writeFileSync(
      join(d, "library", WITHHELD_FILE),
      JSON.stringify({ $schema: "folio-withheld/v1", paths: [{ path: "b-cover.png", reason: "copyright refused" }] }),
    );
    writeFileSync(
      join(d, "site", "index.html"),
      '<img src="../../elsewhere.png"><img src="../library/missing.png"><img src="../library/b-cover.png">',
    );
    const { assets, problems } = referencedAssets(join(d, "site"), d);
    expect(assets).toEqual([]);
    expect(problems.map((p) => p.ref)).toEqual(["../../elsewhere.png", "../library/missing.png", "../library/b-cover.png"]);
    expect(problems[2]!.why).toContain("library/withheld.json");
  });
});

describe("a kind route whose directory is not mounted is a one-file redirect — bean 2b5s", () => {
  it("refreshes, declares canonical, and links visibly, all to the viewer re-based from the route", () => {
    const html = redirectHtml("library/inst", "handler/library/inst/");
    const target = "../../handler/library/inst/";
    expect(html).toContain(`<meta http-equiv="refresh" content="0; url=${target}">`);
    expect(html).toContain(`<link rel="canonical" href="${target}">`);
    expect(html).toContain(`<a href="${target}">`);
    expect(html).toContain('content="noindex"');
  });
});

describe("a served directory's bytes publish at /<instance>/<path> — bean 680p", () => {
  const entry = (path: string, served?: boolean) => ({
    name: "smart-trust",
    abs: `/repo/smart-trust/${path}`,
    entry: { path, graphTypologies: ["fhir-artifact-index"], ...(served === undefined ? {} : { served }) },
  });

  it("is opt-in: only a directory declaring `served: true` is served", () => {
    expect(servedDirectories([entry("fhir-artifact-index/"), entry("docs/", false)])).toEqual([]);
  });

  it("routes under the instance, with no leading or trailing slash", () => {
    expect(servedDirectories([entry("fhir-artifact-index/", true)])).toEqual([
      { name: "smart-trust", dir: "/repo/smart-trust/fhir-artifact-index/", route: "smart-trust/fhir-artifact-index" },
    ]);
  });

  it("a MOUNTED layer's twin under the layer output root is served over the pinned bytes — bean cat-tools-sm8r item 4", () => {
    const repo = mkdtempSync(join(tmpdir(), "served-twin-"));
    writeFileSync(join(repo, "index.lock.json"), JSON.stringify({ instances: [{ instance: "some-ig", path: "some-ig" }] }));
    const pinned = join(repo, "some-ig", "fhir-artifact-index");
    mkdirSync(pinned, { recursive: true });
    const at = { name: "some-ig", abs: pinned, entry: { path: "fhir-artifact-index/", graphTypologies: ["fhir-artifact-index"], served: true } };
    expect(servedDirectories([at], repo)[0]?.computed).toBeUndefined();
    const twin = join(repo, "build", "layers", "some-ig", "fhir-artifact-index");
    mkdirSync(twin, { recursive: true });
    expect(servedDirectories([at], repo)).toEqual([{ name: "some-ig", dir: pinned, route: "some-ig/fhir-artifact-index", computed: twin }]);
    rmSync(repo, { recursive: true, force: true });
  });
});

describe("the URL space: several instances, each under its own name — bean cat-tools-sthf", () => {
  // Three layers in one repository: two published, one declaring
  // `"enabled": false`. The layout is the plan the mount walk would build.
  const repo = mkdtempSync(join(tmpdir(), "url-space-"));
  const instance = (name: string, decl: Record<string, unknown>, dirs: string[]) => {
    for (const d of dirs) {
      mkdirSync(join(repo, name, d), { recursive: true });
      writeFileSync(join(repo, name, d, "index.html"), "<html><body></body></html>");
    }
    writeFileSync(join(repo, name, `${name}.json`), JSON.stringify({ name, ...decl }));
  };
  instance("alpha", { directories: [{ id: "alpha-docs", path: "docs/", graphTypologies: ["docs"], instanceRoot: true }] }, ["docs"]);
  instance(
    "beta",
    {
      stub: "beta-stub",
      directories: [
        { id: "beta-library", path: "library/", graphTypologies: ["library"] },
        { id: "beta-index", path: "artifact-index/", graphTypologies: ["fhir-artifact-index"], served: true },
      ],
    },
    ["library", "artifact-index"],
  );
  instance("gamma", { enabled: false, directories: [{ id: "gamma-docs", path: "docs/", graphTypologies: ["docs"] }] }, ["docs"]);

  it("an instance route is publishedPath's instance case, with the slashes trimmed", () => {
    expect(instanceRoute("alpha")).toBe(publishedPath({ case: "instance", instance: "alpha" }).replace(/^\/|\/$/g, ""));
    expect(instanceRoute("beta", "artifact-index")).toBe(publishedPath({ case: "instance", instance: "beta", path: "artifact-index" }).slice(1));
  });

  it("lays out every enabled instance under its NAME, never its stub, and leaves the disabled one out", () => {
    const found = mountable(repo);
    expect([...new Set(found.map((m) => m.name))].sort()).toEqual(["alpha", "beta"]);
    expect(withRoutes(found).candidates.map((c) => c.route).sort()).toEqual(["alpha", "beta", "docs/alpha", "fhir-artifact-index/beta", "library/beta"]);
    expect(servedDirectories(declaredEntries(repo)).map((x) => x.route)).toEqual(["beta/artifact-index"]);
  });
});

describe("a served directory is refused over a FILE the site holds, not over its route", () => {
  it("names only the files both sides hold, skipping withheld ones", () => {
    const d = mkdtempSync(join(tmpdir(), "served-clash-"));
    const src = join(d, "src");
    const dest = join(d, "site", "inst", "openapi");
    mkdirSync(join(src, "sub"), { recursive: true });
    mkdirSync(join(dest, "sub"), { recursive: true });
    writeFileSync(join(src, "api.openapi.json"), "{}");
    writeFileSync(join(src, "sub", "op.json"), "{}");
    writeFileSync(join(src, "secret.json"), "{}");
    writeFileSync(join(dest, "index.html"), "<html>swagger</html>");
    expect(servedClashes(src, dest)).toEqual([]);
    writeFileSync(join(dest, "sub", "op.json"), "{}");
    writeFileSync(join(dest, "secret.json"), "{}");
    expect(servedClashes(src, dest, (p) => !p.endsWith("secret.json"))).toEqual(["sub/op.json"]);
    expect(servedClashes(src, join(d, "absent"))).toEqual([]);
  });
});
