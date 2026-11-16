/**
 * `compose-docs.ts` — bean `n0nf`, issue #638, the owner's compose ruling.
 *
 * @module scripts/tests/compose-docs
 * @graphNode none — a test
 *
 * ## The assertion this file exists for
 *
 * **An empty overlay must compose to a byte-identical tree.** `docs-site.yml`
 * publishes the real site, so changing its `source:` changes what readers get.
 * If composing with nothing in the overlay is provably the same bytes as the
 * base alone, wiring the composition in is a no-op until somebody deliberately
 * authors an override — and the risk is bounded to that moment rather than to
 * the commit that rewires the publish path.
 *
 * That property is checked against the REAL tree, not a fixture, because a
 * fixture proves the algorithm and the publish path runs on the real one.
 *
 * ## Everything else is checked on fixtures, and both directions
 *
 * An overlay that silently shadows a page is `dh4f`: a consumer reads the
 * composed tree, sees one file, and cannot tell an override from the only
 * copy. So "it overrode" and "it SAID it overrode" are separate assertions,
 * and a composer that did the first without the second would pass one of them.
 *
 * The tests of this file that read the whole checkout (reads the root
 * layer's declaration, which declares the `root-docs` layer) live in
 * `test/compose-docs-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  carriedInstances,
  chromeLayers,
  compose,
  docsLayers,
  instanceStub,
  isChrome,
  isWithheld,
  mergeConfig,
  OUTPUT_LAYER_SUFFIX,
  redirectStub,
  treeDigest,
  withheldFromCanonical,
  type ComposedInstance,
} from "../compose-docs.ts";
import { clearDeclaredVisualisers, PAGE_LOCALE } from "../viewer-declarations.ts";
import {  } from "../../schemas/kg/cat-harness.js";
import { parse as parseYaml } from "yaml";
import { writeDeclaration } from "../../test/support/instance-fixture.js";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));

/** The layer that owns the base layer in these fixtures. */
const INSTANCE = "cat-harness";
/**
 * The fixture's declared entries, written into `harness.json` AND used to
 * place the directories — one answer, not two.
 *
 * Restating the paths when creating the directories would be a second copy of
 * the site root free to disagree with the declaration, which is the very thing
 * `site-dir-single-answer.test.ts` guards against. The fixture derives them.
 */
const ENTRIES = [
  { id: "docs", path: "docs/", graphTypologies: ["docs"] },
  { id: "root-docs", path: "docs/", scope: "repository", graphTypologies: ["docs"] },
  // A non-docs entry, so the filter is doing something rather than happening
  // to match everything.
  { id: "schemas", path: "schemas/", graphTypologies: ["schemas"] },
] as const;

const layerDir = (root: string, id: string): string => {
  const e = ENTRIES.find((x) => x.id === id)!;
  return join("scope" in e && e.scope === "repository" ? root : join(root, INSTANCE), e.path);
};

/** A repository with a base layer under the layer and a root overlay. */
function fixture(base: Record<string, string>, overlay: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "composedocs-"));
  mkdirSync(join(root, INSTANCE), { recursive: true });
  writeDeclaration(join(root, INSTANCE), JSON.stringify({ name: INSTANCE, directories: ENTRIES }));
  for (const [where, files] of [
    [layerDir(root, "docs"), base],
    [layerDir(root, "root-docs"), overlay],
  ] as const) {
    mkdirSync(where, { recursive: true });
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(join(where, rel, ".."), { recursive: true });
      writeFileSync(join(where, rel), body);
    }
  }
  return root;
}

const out = (root: string) => join(root, "_composed");

describe("compose-docs reads its layers from the declaration", () => {
  test("base first, overlay last — and the non-docs entry is not a layer", () => {
    const root = fixture({ "a.md": "base" }, {});
    const { layers, missing } = docsLayers(root);
    expect(layers.map((l) => l.id)).toEqual(["docs", "root-docs"]);
    expect(layers.map((l) => l.repositoryScoped)).toEqual([false, true]);
    expect(missing).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  test("a declared layer with NO directory is reported, never silently empty", () => {
    // `dh4f`: the declaration says to look, there is nothing there, and a
    // composer that shrugged would report a clean run over it.
    const root = fixture({ "a.md": "base" }, {});
    rmSync(layerDir(root, "root-docs"), { recursive: true, force: true });
    const { layers, missing } = docsLayers(root);
    expect(layers.map((l) => l.id)).toEqual(["docs"]);
    expect(missing.map((l) => l.id)).toEqual(["root-docs"]);
    rmSync(root, { recursive: true, force: true });
  });

  test("a declared layer absent because it is BUILT AT PUBLISH is pending, not missing", () => {
    // smart-trust, 2026-10-15: docs/ declared built at publish by its pages
    // step; the IG's own site build never runs it, and was refused for it.
    const root = fixture({ "a.md": "base" }, {});
    writeDeclaration(root, JSON.stringify({ name: "checkout", directories: [{ id: "built-docs", path: "built/", graphTypologies: ["docs"] }], builtAtPublish: [{ path: "built/" }] }));
    const { layers, missing, pending } = docsLayers(root);
    expect(pending.map((l) => l.id)).toEqual(["built-docs"]);
    expect(missing).toEqual([]);
    expect(layers.map((l) => l.id)).not.toContain("built-docs");
    // Once built, it is an ordinary layer.
    mkdirSync(join(root, "built"), { recursive: true });
    expect(docsLayers(root).layers.map((l) => l.id)).toContain("built-docs");
    rmSync(root, { recursive: true, force: true });
  });
});

describe("an EMPTY overlay composes byte-identically — the safety property", () => {
  test("on the real tree, every file and every byte matches the base", () => {
    // The one that licenses rewiring `docs-site.yml`. Checked on the real tree
    // rather than a fixture, because that is what the publish path builds.
    //
    // SINCE SLICE 1 OF THE SEMANTIC SUBGRAPHS (owner, 2026-10-09) the real tree
    // has TWO layer layers: the just-the-docs chrome, `site-chrome/`, and
    // the harness's pages, `docs/`, over it. So "the base" is their later-wins
    // union, and the owner's ruling D1 ("parse-equal") states what `_config.yml`
    // may do: the two layers' configs are MERGED, so the composed file must
    // PARSE to the merge, while every other file stays byte-identical.
    const { layers } = docsLayers(REPO);
    const instanceLayers = layers.filter((l) => !l.repositoryScoped);
    // A mounted cat-harness's computed files are an `@output` layer laid over
    // its own (bean `cat-tools-sm8r`, item 4): part of the base, not a layer
    // of their own, so the declared layers are named without them.
    const isTwin = (id: string): boolean => id.endsWith(OUTPUT_LAYER_SUFFIX);
    expect(instanceLayers.map((l) => l.id).filter((id) => !isTwin(id))).toEqual(["site-chrome", "docs"]);

    const dest = join(mkdtempSync(join(tmpdir(), "composereal-")), "site");
    const report = compose(dest, REPO);

    // ...and it actually composed something. A byte-identity assertion over
    // two empty trees is satisfied by a composer that does nothing.
    expect(Object.keys(report.suppliedBy).length).toBeGreaterThan(100);
    // The only shadows are the chrome's empty stand-ins for the includes the
    // harness's pages generate: anything else would be a page silently lost.
    for (const o of report.overrides) {
      // A layer's own output-root twin replacing a pinned copy is the overlay
      // doing its job, not a page lost.
      if (o.by === `${o.baseLayer}${OUTPUT_LAYER_SUFFIX}`) continue;
      expect(o.baseLayer).toBe("site-chrome");
      expect(o.path.startsWith("_includes/generated/")).toBe(true);
    }
    // D1: the config is the merge of the two, setting for setting.
    // By id, not by position: a mounted cat-harness's `@output` twins
    // (`site-chrome@output`, `docs@output`) sit among the layers too, and a
    // twin holds computed files, not the layer's `_config.yml`.
    const layerDir = (id: string): string => instanceLayers.find((l) => l.id === id)!.dir;
    const chromeCfg = parseYaml(readFileSync(join(layerDir("site-chrome"), "_config.yml"), "utf-8"));
    const docsCfg = parseYaml(readFileSync(join(layerDir("docs"), "_config.yml"), "utf-8"));
    expect(parseYaml(readFileSync(join(dest, "_config.yml"), "utf-8"))).toEqual(mergeConfig(chromeCfg, docsCfg).merged);

    const before = new Map<string, string>();
    for (const l of instanceLayers) for (const [p, h] of treeDigest(l.dir)) before.set(p, h);
    before.delete("_config.yml");
    const after = treeDigest(dest);
    after.delete("_config.yml");

    // THE PROPERTY IS "COMPOSITION NEVER CHANGES A BASE FILE", not "the tree
    // has the same number of files in it". Those were the same assertion until
    // layers could be composed (`jut3`), and the size check is the half
    // that stopped being true: `smart-trust/docs/` now lands under
    // `smart-trust/`, so the composed tree is base PLUS that.
    //
    // Weakening it to "the base files match" alone would license a composer
    // that scattered files anywhere, so the additions are checked too: every
    // path the composed tree adds must sit under a composed layer's own
    // prefix. That is strictly stronger than the count it replaces, which
    // said nothing about WHERE a new file could appear.
    // WITHHELD PATHS ARE ABSENT ON PURPOSE, so the property is stated against
    // the base MINUS them rather than against the base. Added 2026-09-21 with
    // `publish: "staging-only"`.
    //
    // This is the one weakening in this file that had to be argued rather than
    // just made. The property licenses pointing `docs-site.yml`'s `source:` at
    // the composed tree, and it did so by saying composition changes NOTHING.
    // A canonical compose now deliberately omits a page, so that sentence is
    // no longer true as written.
    //
    // What replaces it is not "nothing changes except what changed" — that
    // would license anything. It is two separate claims, and the second is why
    // this is still a safety property:
    //
    //   1. every base file that is NOT withheld is byte-identical, and
    //   2. the withheld set is exactly what the declarations asked for,
    //      which `staging-only-publish.test.ts` asserts against the real
    //      declaration (`["fsh-guts/"]`) rather than against whatever the
    //      composer happened to drop.
    //
    // Without (2) this assertion would pass for a composer that silently lost
    // files, since it would simply report them as withheld. The two tests are
    // load-bearing together and neither is sufficient alone.
    const withheld = report.withheld;
    const differing = [...before]
      .filter(([p]) => !isWithheld(p, withheld))
      .filter(([p, h]) => after.get(p) !== h)
      .map(([p]) => p);
    expect(differing).toEqual([]);

    // And the omissions are ONLY the withheld ones — a base file missing for
    // any other reason is the failure this property exists to catch.
    const missingFromComposed = [...before.keys()].filter((p) => !after.has(p));
    expect(missingFromComposed.sort()).toEqual([...withheld].sort());

    // An ALIAS redirect (bean `t4xb`, owner 2026-10-09) is the one other
    // addition, and only where a declaration opted into one: every stray must
    // be a stub the report names, never a file it does not.
    const prefixes = report.composed.map((c) => `${c.under}/`);
    // So is a FORWARDING page at an old visualiser address (folio-assistant#2527),
    // written only where nothing the layers carry already stands.
    // And so is a visualiser page a harness holds in its own site directory,
    // laid at its declared route (wrong-direction move M1): named in `held`.
    const stubs = new Set([...report.aliases.written, ...report.forwards.written, ...report.held.written]);
    const strays = [...after.keys()].filter(
      (p) => !before.has(p) && !prefixes.some((pre) => p.startsWith(pre)) && !stubs.has(p),
    );
    expect(strays).toEqual([]);
    expect(report.aliases.collisions).toEqual([]);
    // A forwarding page never replaces a file a layer carries.
    for (const f of report.forwards.written) expect(before.has(f)).toBe(false);

    // ...and the composition actually happened. Both checks above are
    // satisfied by a composer that emitted nothing: no base file differs and
    // there are no strays if there are no new files at all. The line this
    // replaces read `expect(after.size).toBe(before.size + (after.size -
    // before.size))`, which is an identity and guarded nothing — the same
    // defect as a test that restates the expression it checks.
    //
    // SINCE BEAN `mftp` NO LAYER ON THE REAL TREE COMPOSES: every smart-*
    // IG builds into its own IG site (`igSite`). So the addition is asserted
    // to follow the composition exactly, either way, rather than to be
    // non-empty: added files exist iff a layer composed. The composer's
    // own behaviour on a layer stays pinned by the fixtures below.
    const added = [...after.keys()].filter((p) => !before.has(p) && !stubs.has(p));
    expect(added.length > 0).toBe(report.composed.length > 0);
    rmSync(join(dest, ".."), { recursive: true, force: true });
    // Composes the whole real tree twice and reads every byte: over bun's 5 s
    // default on a busy runner (6.3 s on a content layer's main, 2026-11-12), so it
    // carries the real-tree budget the cut's compose already has.
  }, 30_000);

  test("the overlay's own dotfile does NOT become a published page", () => {
    // `docs/.gitkeep` carries the overlay's documentation. Jekyll ignores
    // dotfiles and so must this, or the byte-identity above would be false the
    // moment somebody explained what the directory is for.
    const root = fixture({ "a.md": "base" }, { ".gitkeep": "# notes", ".hidden/x.md": "no" });
    const r = compose(out(root), root);
    expect(Object.keys(r.suppliedBy)).toEqual(["a.md"]);
    expect(existsSync(join(out(root), ".gitkeep"))).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("an override is applied AND reported", () => {
  test("the overlay's bytes win", () => {
    const root = fixture({ "p.md": "BASE", "keep.md": "untouched" }, { "p.md": "OVERLAY" });
    compose(out(root), root);
    expect(Bun.file(join(out(root), "p.md")).text()).resolves.toBe("OVERLAY");
    expect(Bun.file(join(out(root), "keep.md")).text()).resolves.toBe("untouched");
    rmSync(root, { recursive: true, force: true });
  });

  test("...and BOTH layers are named, which is the ruling's actual requirement", () => {
    // Doing it silently is `dh4f`: one file in the tree, and no way to tell an
    // override from the only copy. A composer that overrode correctly and said
    // nothing would pass the test above and fail the requirement.
    const root = fixture({ "p.md": "BASE" }, { "p.md": "OVERLAY" });
    const r = compose(out(root), root);
    expect(r.overrides).toEqual([{ path: "p.md", baseLayer: "docs", by: "root-docs" }]);
    rmSync(root, { recursive: true, force: true });
  });

  test("a path only the overlay has is ADDED, not an override", () => {
    // Two different facts. Collapsing them would make "how many pages does the
    // root change" unanswerable from the report.
    const root = fixture({ "p.md": "BASE" }, { "new.md": "ONLY HERE" });
    const r = compose(out(root), root);
    expect(r.overrides).toEqual([]);
    expect(r.added).toEqual(["new.md"]);
    expect(r.suppliedBy["new.md"]).toBe("root-docs");
    expect(r.suppliedBy["p.md"]).toBe("docs");
    rmSync(root, { recursive: true, force: true });
  });

  test("nested paths override at the right path, not by basename", () => {
    const root = fixture(
      { "guides/a.md": "BASE A", "b.md": "BASE B" },
      { "guides/a.md": "OVERLAY A" },
    );
    const r = compose(out(root), root);
    expect(r.overrides.map((o) => o.path)).toEqual(["guides/a.md"]);
    expect(Bun.file(join(out(root), "b.md")).text()).resolves.toBe("BASE B");
    rmSync(root, { recursive: true, force: true });
  });
});

describe("a Jekyll config is MERGED, overlay keys winning", () => {
  test("the overlay's keys win and the base's survive", () => {
    // The owner's rule, 2026-09-21. Shadowing would have dropped `plugins`
    // entirely while reading in the report as one added page.
    const root = fixture(
      { "_config.yml": "title: BASE\nplugins:\n  - jekyll-feed\n" },
      { "_config.yml": "title: OVERLAY\n" },
    );
    const r = compose(out(root), root);
    const cfg = parseYaml(readFileSync(join(out(root), "_config.yml"), "utf-8"));
    expect(cfg.title).toBe("OVERLAY");
    expect(cfg.plugins).toEqual(["jekyll-feed"]);
    expect(r.overrides).toEqual([]);
    expect(r.added).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  test("...and the CHANGED KEYS are named, not counted", () => {
    // `dh4f` again: "merged 1 file" leaves a reader unable to tell which
    // settings the overlay moved, which is the whole question it raises.
    const root = fixture(
      { "_config.yml": "title: BASE\ncolor: red\n" },
      { "_config.yml": "title: OVERLAY\n" },
    );
    const r = compose(out(root), root);
    expect(r.merged).toEqual([
      { path: "_config.yml", baseLayer: "docs", by: "root-docs", keys: ["title"] },
    ]);
    rmSync(root, { recursive: true, force: true });
  });

  test("a config only the BASE has passes through with its BYTES untouched", () => {
    // The property the conditional merge exists for. A YAML round trip strips
    // comments and may reorder keys, so merging unconditionally would rewrite
    // the published config on a tree whose overlay carries none — and that is
    // exactly the live publish path today.
    const body = "# a comment the round trip would eat\ntitle: BASE\nplugins:\n  - jekyll-feed\n";
    const root = fixture({ "_config.yml": body }, {});
    const r = compose(out(root), root);
    expect(readFileSync(join(out(root), "_config.yml"), "utf-8")).toBe(body);
    expect(r.merged).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("the merge rule itself", () => {
  test("objects merge RECURSIVELY — one token does not drop the theme", () => {
    const { merged } = mergeConfig(
      { theme: { color: "red", font: "serif" } },
      { theme: { color: "blue" } },
    );
    expect(merged).toEqual({ theme: { color: "blue", font: "serif" } });
  });

  test("lists REPLACE rather than concatenate", () => {
    // The clause worth a test of its own, because concatenation is the more
    // common default. Concatenating leaves an overlay no way to REMOVE an
    // inherited entry, which is the same reason the file overlay is last-wins.
    const { merged } = mergeConfig({ nav: ["a", "b", "c"] }, { nav: ["a"] });
    expect(merged).toEqual({ nav: ["a"] });
  });

  test("a nested change is reported by its DOTTED path", () => {
    const { changed } = mergeConfig(
      { theme: { color: "red", font: "serif" }, title: "x" },
      { theme: { color: "blue" } },
    );
    expect(changed).toEqual(["theme.color"]);
  });

  test("an overlay may deliberately null a key out", () => {
    // `null` is a value, not an absence. Treating it as "unset" would make a
    // key impossible to clear from an overlay.
    const { merged, changed } = mergeConfig({ analytics: "UA-1" }, { analytics: null });
    expect(merged).toEqual({ analytics: null });
    expect(changed).toEqual(["analytics"]);
  });

  test("a key only the base has is untouched", () => {
    const { merged, changed } = mergeConfig({ a: 1, b: 2 }, { a: 9 });
    expect(merged).toEqual({ a: 9, b: 2 });
    expect(changed).toEqual(["a"]);
  });
});

/**
 * Bean `ga8a` — a composed layer is carried only when the branch touches it.
 *
 * `tebu` cut `reference/` and `api/` from a preview whose branch cannot have
 * changed them. This is the same cut one directory over, and by 2026-09-23 the
 * bigger one: measured across `origin/gh-pages`, `smart-trust/` was **776.6 MB
 * over 13 previews, 37 % of a 2.10 GB `branches/` tree**, against `reference/`'s
 * 464.7 MB — because `smart-trust/docs/` is 3.2 MB of markdown that Jekyll
 * inflates to 111.6 MB of themed HTML across 681 pages.
 *
 * ## What is asserted
 *
 * **The decision, not the size.** A test that pinned megabytes would fail every
 * time somebody added a page, and the number it guarded would be this repo's
 * own `dh4f` shape: a figure in a test rather than a measurement. The saving is
 * measured against the real tree below as a RATIO with a floor, which fails if
 * the cut stops working and survives the corpus growing.
 *
 * **Both directions of the doubt rule.** "No list" and "an empty list" are
 * different facts — one is a failed lookup, the other a determined zero — and
 * conflating them is exactly the failure this family of bugs keeps making.
 */
describe("carriedInstances — what a preview must carry (bean `ga8a`)", () => {
  /** A composed layer shaped like the real one, without touching disk. */
  const inst = (root: string, under = root): ComposedInstance => ({
    instance: under,
    dir: `/nowhere/${root}/docs`,
    under,
    root,
  });

  test("NO list carries everything — any doubt keeps the pages under review", () => {
    // The asymmetry that decides the default: a preview that is too big is a
    // threshold finding somebody reads; a preview missing the pages under
    // review is a reviewer misled.
    const d = carriedInstances([inst("smart-trust"), inst("who-iris")], undefined);
    expect(d.map((x) => x.carry)).toEqual([true, true]);
    for (const x of d) expect(x.why).toContain("no readable file list");
  });

  test("an EMPTY list is a determined zero, and it stubs", () => {
    // A pull request that genuinely changes nothing touches no layer. If
    // this fell through to "carry everything", the flag would be unable to
    // distinguish a failed API call from a real answer — the `dh4f` shape.
    const d = carriedInstances([inst("smart-trust")], []);
    expect(d[0]!.carry).toBe(false);
  });

  test("a file under the instance carries it, and the reason NAMES that file", () => {
    // Named rather than counted: a build log saying "carried" without saying
    // what triggered it leaves nobody able to check the predicate.
    const d = carriedInstances([inst("smart-trust")], [
      "cat-harness/docs/index.md",
      "smart-trust/fhir-artifact-index/dak/x.json",
    ]);
    expect(d[0]!.carry).toBe(true);
    expect(d[0]!.why).toContain("smart-trust/fhir-artifact-index/dak/x.json");
  });

  test("the predicate is the INSTANCE, not its composed directory", () => {
    // `smart-trust/docs/` is GENERATED from `fhir-artifact-index/` by
    // `scripts/`. A branch that changes the generator and regenerates in the
    // same commit must still get the rebuilt pages, so matching `docs/` alone
    // would drop exactly the review that needed them.
    expect(carriedInstances([inst("smart-trust")], ["smart-trust/scripts/gen.ts"])[0]!.carry).toBe(
      true,
    );
  });

  test("a branch touching nothing of the instance's stubs it", () => {
    const d = carriedInstances([inst("smart-trust")], ["cat-harness/schemas/types.ts"]);
    expect(d[0]!.carry).toBe(false);
    expect(d[0]!.why).toContain("smart-trust/");
  });

  test("a SIBLING sharing the name's prefix does not count as a touch", () => {
    // `startsWith("smart-trust")` without the separator would carry the whole
    // IG for a branch that only edited `smart-trust-notes/`. Cheap to get
    // wrong, silent when wrong, and it inflates rather than truncates — so
    // nothing downstream would ever notice.
    expect(
      carriedInstances([inst("smart-trust")], ["smart-trust-notes/readme.md"])[0]!.carry,
    ).toBe(false);
  });

  test("a `./`-prefixed path still matches", () => {
    // Some diff tools spell it that way. A miss here reads as "this branch
    // touches nothing", which is the failure direction that loses pages.
    expect(carriedInstances([inst("smart-trust")], ["./smart-trust/docs/x.md"])[0]!.carry).toBe(
      true,
    );
  });

  test("the match is on the DIRECTORY, not the declaration's name", () => {
    // `under` is what a URL carries; `root` is where the files sit. They
    // coincide today and are free to diverge, and matching the wrong one would
    // fail silently the day somebody renames a declaration.
    const renamed = inst("smart-trust", "WHO SMART Trust");
    expect(carriedInstances([renamed], ["smart-trust/docs/x.md"])[0]!.carry).toBe(true);
    expect(carriedInstances([renamed], ["WHO SMART Trust/x.md"])[0]!.carry).toBe(false);
  });

  test("the stub says where the full copy is — `pb04`", () => {
    // The navbar's harness tiles address `/<instance>/`. Removing the tree
    // outright turns a working link into a 404 a reviewer has to diagnose.
    const s = instanceStub(inst("smart-trust"));
    expect(s).toContain("https://litlfred.github.io/folio-assistant/smart-trust/");
    expect(s).toContain("smart-trust/");
    expect(s.startsWith("---\n")).toBe(true);
  });
});

describe("the cut, on the REAL tree", () => {
  // Each real-tree compose costs seconds, and these tests ask about only two
  // trees: the full one and the one cut for a branch touching no layer. So
  // each is composed once, on first use, and read by every test that needs it
  // (read only — no test writes into either). Composing the same tree again
  // per test bought nothing and pushed the ratio test past its 5 s budget.
  const trees = new Map<string, { dir: string; report: ReturnType<typeof compose> }>();
  const tree = (key: "all" | "cut") => {
    let t = trees.get(key);
    if (!t) {
      const dir = join(mkdtempSync(join(tmpdir(), `compose${key}-`)), "site");
      const report = key === "all" ? compose(dir, REPO) : compose(dir, REPO, { changedFiles: ["cat-harness/docs/index.md"] });
      t = { dir, report };
      trees.set(key, t);
    }
    return t;
  };
  // Composed before the tests, under a budget of their own: composed lazily,
  // whichever test ran first paid the compose inside its own 5 s budget, and
  // timed out on a slower runner (cat-harness-tools#970, 5.2 s).
  beforeAll(() => {
    tree("all");
    tree("cut");
  }, 120_000);
  // Removing the two composed trees is real-tree work too: under the default
  // 5 s it failed as "(unnamed)" at 7.2 s on a layer main (2026-11-11).
  afterAll(() => {
    for (const { dir } of trees.values()) rmSync(join(dir, ".."), { recursive: true, force: true });
  }, 60_000);

  test("every composed instance gets exactly one decision", () => {
    // Reported rather than inferred: a tree quietly missing a layer's
    // pages must be distinguishable from a layer that failed to read.
    const r = tree("cut").report;
    // No layer composes on the real tree since bean `mftp` (each smart-* IG
    // builds its own site); the decisions must still match the compositions.
    expect(r.carried.map((d) => d.instance.under).sort()).toEqual(
      r.composed.map((c) => c.under).sort(),
    );
  });

  test("a branch touching no instance composes MATERIALLY fewer files", () => {
    // The saving, measured rather than projected — bean `ga8a`'s fourth
    // Done-when. Stated as a ratio with a floor rather than as megabytes: a
    // pinned byte count would fail on every added page while saying nothing
    // about whether the cut still fires.
    const all = tree("all").report;
    const { dir: b, report: cut } = tree("cut");

    const nAll = Object.keys(all.suppliedBy).length;
    const nCut = Object.keys(cut.suppliedBy).length;
    // The cut fires on every composed layer a branch does not touch. Since
    // bean `mftp` the real tree composes none — the smart-* IGs build their
    // own sites, whose cut is `stage-ig-sites`' staging cone — so with none,
    // there is nothing to cut and the two trees must be the same size.
    if (all.composed.length === 0) {
      expect(nCut).toBe(nAll);
      return;
    }
    expect(cut.carried.some((d) => !d.carry)).toBe(true);
    // EVERY page of every stubbed layer is gone, each replaced by its one
    // stub. This was a ratio (`nCut < 0.75 * nAll`) while smart-trust and
    // smart-base were composed; since bean `mftp` they build into their own
    // IG sites (`igSite`), whose cut is the staging cone in `stage-ig-sites`,
    // so a ratio tuned to that corpus measured layers no longer here.
    const stubbed = cut.carried.filter((d) => !d.carry).map((d) => `${d.instance.under}/`);
    // The layer's OWN files — supplied BY it. Since 2026-10-09 a harness's
    // declared visualisers are also drawn under `<name>/<visualiser>/`, in the
    // base layer, and a cut that stubs the layer's docs rightly keeps them.
    const stubbedNames = new Set(cut.carried.filter((d) => !d.carry).map((d) => d.instance.instance));
    // A layer with its own IG site gets NO stub: its IG build answers
    // `/<instance>/` (smart-base, whose docs pages compose beside its IG).
    const stubCount = cut.carried.filter((d) => !d.carry && !d.instance.igSite).length;
    const theirs = Object.entries(all.suppliedBy).filter(([k, by]) => stubbedNames.has(by) && stubbed.some((u) => k.startsWith(u))).length;
    // A stubbed layer whose docs are ONE page (folio-assistant-core's, since
    // bean c5fm) is replaced by exactly one stub, so the cut cannot shrink the
    // tree: assert that it does not grow it either, the same answer the
    // composes-none case above gives. Otherwise the cut must remove pages.
    if (theirs === stubCount) {
      expect(nCut).toBe(nAll);
    } else {
      expect(theirs).toBeGreaterThan(stubCount);
    }
    expect(nCut).toBeLessThanOrEqual(nAll - theirs + stubCount);

    // ...and what remains in place of each stubbed layer is its stub, not a
    // hole. A 404 where a tile links is the `pb04` defect this replaces.
    for (const d of cut.carried.filter((x) => !x.carry)) {
      const stub = join(b, d.instance.under, "index.md");
      if (d.instance.igSite) {
        expect(existsSync(stub)).toBe(false);
        continue;
      }
      expect(existsSync(stub)).toBe(true);
      expect(readFileSync(stub, "utf-8")).toContain("not built into this preview");
    }
  });

  test("with no list, the real tree carries every instance in full", () => {
    // The canonical publisher passes nothing, so this is the property that
    // keeps `docs-site.yml` unaffected by the flag.
    const r = tree("all").report;
    expect(r.carried.every((d) => d.carry)).toBe(true);
  });
});

describe("carriedInstances with the staging cone (bean 4j86)", () => {
  const smartTrust = {
    instance: "smart-trust",
    dir: "/repo/smart-trust/docs",
    under: "smart-trust",
    root: "smart-trust",
  };
  const reached = [{ node: "smart-trust/smart-trust-docs", path: "smart-trust/docs/", carry: true, why: "x" }];
  test("the cone carries what the prefix match drops: a generator change", () => {
    const d = carriedInstances([smartTrust], ["fhir-harness/scripts/gen-ig-pages.ts"], reached, "/repo");
    expect(d[0]!.carry).toBe(true);
    expect(d[0]!.why).toContain("staging cone");
  });
  test("a cone that does not reach it leaves the stub", () => {
    const d = carriedInstances([smartTrust], ["cat-harness/skills/x.md"], [{ ...reached[0]!, carry: false }], "/repo");
    expect(d[0]!.carry).toBe(false);
  });
  test("the prefix match stays a floor: the cone can only add", () => {
    const d = carriedInstances([smartTrust], ["smart-trust/scripts/gen.ts"], [{ ...reached[0]!, carry: false }], "/repo");
    expect(d[0]!.carry).toBe(true);
  });
});

// smart-trust, 2026-10-14: an IG repository builds its own site from its own
// checkout, where the root declares the IG's docs/ — which stage-ig-sites builds
// into the IG site. A platform-only shell leaves that layer to it.
describe("--shell --platform-only: the platform's chrome, not the checkout's own", () => {
  test("a repository-scoped layer's assets are left out, and said to be", () => {
    const root = fixture(
      { "_config.yml": "title: base\n", "assets/base.css": "b", "index.md": "base" },
      { "assets/ig-pages.css": "ig", "artifact/X.html": "page" },
    );
    try {
      const whole = compose(out(root), root, { shell: true });
      expect(Object.keys(whole.suppliedBy)).toContain("assets/ig-pages.css");
      expect(whole.leftOut).toBeUndefined();

      const r = compose(out(root), root, { shell: true, platformOnly: true });
      expect(r.layers.map((l) => l.id)).toEqual(["docs"]);
      expect(r.leftOut?.map((l) => l.id)).toEqual(["root-docs"]);
      expect(Object.keys(r.suppliedBy).sort()).toEqual(["_config.yml", "assets/base.css"]);
      expect(existsSync(join(out(root), "assets", "ig-pages.css"))).toBe(false);
      expect(r.added).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  test("it is a shell's option: asked of a whole-site compose, it is refused", () => {
    const root = fixture({ "index.md": "base" }, {});
    try {
      expect(() => compose(out(root), root, { platformOnly: true })).toThrow(/needs --shell/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// #2235 F1: an IG repository's own site is built inside the main site's CHROME.
describe("--shell: the chrome only", () => {
  test("isChrome is the Jekyll machinery and assets, nothing else", () => {
    for (const p of ["_config.yml", "_includes/head_custom.html", "_data/harness.json", "assets/js/docs-ui.js"]) expect(isChrome(p)).toBe(true);
    for (const p of ["index.md", "glossary/index.md", "smart-trust/index.md"]) expect(isChrome(p)).toBe(false);
  });
  test("the real tree composes no page, no instance, and EMPTY generated includes", () => {
    const out = mkdtempSync(join(tmpdir(), "shell-"));
    try {
      const r = compose(out, REPO, { shell: true });
      const paths = Object.keys(r.suppliedBy);
      expect(paths.length).toBeGreaterThan(0);
      expect(paths.filter((p) => !isChrome(p))).toEqual([]);
      expect(r.carried).toEqual([]);
      expect(existsSync(join(out, "_config.yml"))).toBe(true);
      const gen = paths.filter((p) => /^_includes[\\/]generated[\\/]/.test(p));
      expect(gen.length).toBeGreaterThan(0);
      for (const g of gen) expect(readFileSync(join(out, g), "utf-8")).toBe("");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});

/**
 * A fixture whose layer DECLARES visualisers, so the route machinery has
 * something to forward: `todos` (alias `todos`), `fsh` (staging-only).
 */
function routedFixture(base: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "composedocs-routes-"));
  mkdirSync(join(root, INSTANCE), { recursive: true });
  writeDeclaration(
    join(root, INSTANCE),
    JSON.stringify({
      name: INSTANCE,
      directories: ENTRIES,
      visualisers: [
        { id: "todos", renderedBy: "state-viewer", covers: ["schemas"], alias: "todos" },
        { id: "fsh", renderedBy: "staging-graph-viewer", covers: ["schemas"], publish: "staging-only" },
      ],
    }),
  );
  for (const [rel, body] of Object.entries(base)) {
    const at = join(layerDir(root, "docs"), rel);
    mkdirSync(join(at, ".."), { recursive: true });
    writeFileSync(at, body);
  }
  mkdirSync(layerDir(root, "root-docs"), { recursive: true });
  clearDeclaredVisualisers();
  return root;
}

describe("forwarding pages at the old visualiser addresses (folio-assistant#2527)", () => {
  const L = PAGE_LOCALE;

  test("a page under the locale gets a forwarding page at its old address; a data file gets none", () => {
    const root = routedFixture({
      [`${L}/${INSTANCE}/todos/index.md`]: "---\ntitle: T\n---\nlist",
      [`${L}/${INSTANCE}/todos/item/index.html`]: "<html><head></head><body>item</body></html>",
      [`${L}/${INSTANCE}/todos/data.json`]: "{}",
    });
    const r = compose(out(root), root);
    expect(r.forwards.written).toEqual([`${INSTANCE}/todos/index.html`, `${INSTANCE}/todos/item/index.html`]);
    expect(r.forwards.superseded).toEqual([]);
    const top = readFileSync(join(out(root), INSTANCE, "todos", "index.html"), "utf-8");
    expect(top).toContain(`url=../../${L}/${INSTANCE}/todos/`);
    const item = readFileSync(join(out(root), INSTANCE, "todos", "item", "index.html"), "utf-8");
    expect(item).toContain(`url=../../../${L}/${INSTANCE}/todos/item/`);
    // Data is fetched by a script, which does not follow a redirect page.
    expect(existsSync(join(out(root), INSTANCE, "todos", "data.json"))).toBe(false);
    // And the page itself is where the layer put it, untouched.
    expect(readFileSync(join(out(root), L, INSTANCE, "todos", "index.md"), "utf-8")).toBe("---\ntitle: T\n---\nlist");
    rmSync(root, { recursive: true, force: true });
  });

  test("a page still at the old address stands, and its forwarding page is reported as not written", () => {
    const root = routedFixture({
      [`${L}/${INSTANCE}/todos/index.md`]: "new",
      [`${INSTANCE}/todos/index.md`]: "old, not yet regenerated",
    });
    const r = compose(out(root), root);
    expect(r.forwards.written).toEqual([]);
    expect(r.forwards.superseded).toEqual([`${INSTANCE}/todos/index.html`]);
    expect(readFileSync(join(out(root), INSTANCE, "todos", "index.md"), "utf-8")).toBe("old, not yet regenerated");
    expect(existsSync(join(out(root), INSTANCE, "todos", "index.html"))).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });

  test("an alias redirects to the page under the locale, never to the forwarding page", () => {
    const root = routedFixture({ [`${L}/${INSTANCE}/todos/index.md`]: "list" });
    const r = compose(out(root), root);
    expect(r.aliases.written).toEqual(["todos/index.html"]);
    expect(readFileSync(join(out(root), "todos", "index.html"), "utf-8")).toContain(`url=../${L}/${INSTANCE}/todos/`);
    rmSync(root, { recursive: true, force: true });
  });

  test("an alias of a page not yet moved still redirects to where the page is", () => {
    const root = routedFixture({ [`${INSTANCE}/todos/index.md`]: "old" });
    const r = compose(out(root), root);
    expect(r.forwards.written).toEqual([]);
    expect(r.aliases.written).toEqual(["todos/index.html"]);
    expect(readFileSync(join(out(root), "todos", "index.html"), "utf-8")).toContain(`url=../${INSTANCE}/todos/`);
    rmSync(root, { recursive: true, force: true });
  });

  test("a staging-only visualiser is withheld at BOTH addresses, and nothing forwards to it", () => {
    const root = routedFixture({ [`${L}/${INSTANCE}/fsh/index.md`]: "trashcan" });
    expect(withheldFromCanonical(root)).toEqual([`${INSTANCE}/fsh/`, `${L}/${INSTANCE}/fsh/`].sort());
    const r = compose(out(root), root);
    expect(existsSync(join(out(root), L, INSTANCE, "fsh"))).toBe(false);
    expect(existsSync(join(out(root), INSTANCE, "fsh"))).toBe(false);
    expect(r.forwards.written).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("a redirect page carries the ?query and the #fragment (folio-assistant#2527)", () => {
  test("the script appends location.search and location.hash; the meta refresh is the fallback", () => {
    const html = redirectStub("../../en/cat-harness/library/");
    const script = html.indexOf("<script>");
    const meta = html.indexOf('http-equiv="refresh"');
    expect(html).toContain('location.replace("../../en/cat-harness/library/" + location.search + location.hash)');
    // The script runs before the refresh can drop the fragment.
    expect(script).toBeGreaterThan(-1);
    expect(script).toBeLessThan(meta);
    expect(html).toContain('<link rel="canonical" href="../../en/cat-harness/library/">');
  });

  test("a target cannot close the script element it sits in", () => {
    const html = redirectStub("x</script><b>");
    expect(html).not.toContain("x</script>");
    expect(html).toContain("\\u003c/script>");
  });
});

describe("a composed instance's docs SOURCE is never composed (owner, 2026-10-23, A1)", () => {
  test("its rendered pages are composed under its name; the blocks they were rendered from are not", () => {
    const root = fixture({ "index.md": "base" }, {});
    const upper = join(root, "upper");
    mkdirSync(join(upper, "docs", "source", "guides-x"), { recursive: true });
    writeDeclaration(upper, JSON.stringify({ name: "upper", directories: [{ id: "upper-docs", path: "docs/", graphTypologies: ["docs"], composed: true }] }));
    writeFileSync(join(upper, "docs", "docs.json"), JSON.stringify({ name: "upper", directories: [{ id: "docs-source", path: "source", graphTypologies: ["docs"] }] }));
    writeFileSync(join(upper, "docs", "source", "guides-x", "overview.md"), "a block\n");
    mkdirSync(join(upper, "docs", "guides"), { recursive: true });
    writeFileSync(join(upper, "docs", "guides", "x.md"), "---\ntitle: X\n---\n");
    try {
      const r = compose(out(root), root);
      expect(existsSync(join(out(root), "upper", "guides", "x.md"))).toBe(true);
      expect(existsSync(join(out(root), "upper", "source"))).toBe(false);
      expect(Object.keys(r.suppliedBy).filter((k) => k.startsWith("upper/source"))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("a MOUNTED base layer's computed pages at the output root (bean cat-tools-sm8r, item 4, step 4)", () => {
  /** The fixture, with the checkout's lock mounting cat-harness, and `files` written at its output-root twin. */
  function mounted(base: Record<string, string>, overlay: Record<string, string>, computed: Record<string, string>): string {
    const root = fixture(base, overlay);
    writeFileSync(join(root, "index.lock.json"), JSON.stringify({ instances: [{ instance: INSTANCE, path: INSTANCE, sha: "a".repeat(40) }] }));
    const twin = join(root, "build", "layers", INSTANCE, "docs");
    for (const [rel, body] of Object.entries(computed)) {
      mkdirSync(join(twin, rel, ".."), { recursive: true });
      writeFileSync(join(twin, rel), body);
    }
    return root;
  }

  test("the twin is laid directly over its base, before the repository overlay", () => {
    const root = mounted({ "a.md": "base" }, {}, { "gen.md": "computed" });
    expect(docsLayers(root).layers.map((l) => l.id)).toEqual(["docs", "docs@output", "root-docs"]);
    rmSync(root, { recursive: true, force: true });
  });

  test("no twin layer while nothing was written there: the composed tree is unchanged", () => {
    const root = mounted({ "a.md": "base" }, {}, {});
    expect(docsLayers(root).layers.map((l) => l.id)).toEqual(["docs", "root-docs"]);
    rmSync(root, { recursive: true, force: true });
  });

  test("a computed page shadows the pinned copy and says so; the overlay still wins over both", () => {
    const root = mounted({ "p.md": "PINNED", "q.md": "PINNED Q" }, { "q.md": "OVERLAY Q" }, { "p.md": "COMPUTED", "q.md": "COMPUTED Q", "new.md": "NEW" });
    const r = compose(out(root), root);
    expect(readFileSync(join(out(root), "p.md"), "utf-8")).toBe("COMPUTED");
    expect(readFileSync(join(out(root), "q.md"), "utf-8")).toBe("OVERLAY Q");
    expect(readFileSync(join(out(root), "new.md"), "utf-8")).toBe("NEW");
    expect(r.overrides).toContainEqual({ path: "p.md", baseLayer: "docs", by: "docs@output" });
    expect(r.suppliedBy["new.md"]).toBe("docs@output");
    rmSync(root, { recursive: true, force: true });
  });

  test("a base layer absent from the mount but present at the output root is carried, not missing", () => {
    const root = mounted({}, {}, { "gen.md": "computed" });
    rmSync(layerDir(root, "docs"), { recursive: true, force: true });
    const { layers, missing } = docsLayers(root);
    expect(layers.map((l) => l.id)).toEqual(["docs@output", "root-docs"]);
    expect(missing).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  test("a chrome layer's output-root twin is that layer, not a second chrome layer", () => {
    const root = mounted({}, {}, {});
    writeDeclaration(
      join(root, INSTANCE),
      JSON.stringify({ name: INSTANCE, directories: [{ id: "site-chrome", path: "site-chrome/", graphTypologies: ["docs"] }, ...ENTRIES] }),
    );
    mkdirSync(join(root, INSTANCE, "site-chrome"), { recursive: true });
    mkdirSync(join(root, "build", "layers", INSTANCE, "site-chrome", "assets"), { recursive: true });
    expect(chromeLayers(root).map((l) => l.id)).toEqual(["site-chrome"]);
    // A twin whose base is absent carries the layer, so it is still listed.
    rmSync(join(root, INSTANCE, "site-chrome"), { recursive: true, force: true });
    expect(chromeLayers(root).map((l) => l.id)).toEqual(["site-chrome@output"]);
    rmSync(root, { recursive: true, force: true });
  });

  test("a checkout that does not mount the layer has no twin, even with files at that path", () => {
    const root = fixture({ "a.md": "base" }, {});
    mkdirSync(join(root, "build", "layers", INSTANCE, "docs"), { recursive: true });
    writeFileSync(join(root, "build", "layers", INSTANCE, "docs", "gen.md"), "stray");
    expect(docsLayers(root).layers.map((l) => l.id)).toEqual(["docs", "root-docs"]);
    rmSync(root, { recursive: true, force: true });
  });
});
