/**
 * `gen-navbar-include.ts` — the Jekyll sidebar's navbar, written by the shared
 * renderer. Bean `sjic`, issue #1260.
 *
 * **These test what JEKYLL will do with the bytes**, not whether the committed
 * copy is current. Staleness is the gate's job and is a different question —
 * `artefact-verification.json` is where this repository writes that
 * distinction down, and `library:viz:check` being green over a page that could
 * not run (PR #805) is why it insists on it.
 *
 * The file is generated rather than asserted line by line, so every test here
 * either runs the generator over the REAL data or over a fixture shaped like
 * it. A snapshot would pin the output and tell you nothing about why it is
 * right.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { readFileSync } from "../../../test/support/site-fs.ts";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { siteDirFor, siteFileFor } from "../../../schemas/kg/cat-harness.js";
import { instanceView, render, type Harness } from "../../gen-navbar-include.js";
import { harnessTiles } from "../../harness-tiles.js";
import { writeDeclaration } from "../../../test/support/instance-fixture.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { siteNotBuilt } from "../../../test/support/checkout.ts";
import { dirname } from "node:path";

const ROOT = join(dirname(HARNESS_ROOT));
// The site root is ASKED FOR here too. `site-dir-single-answer` scans test
// files as well, and it is right to: a fixture that writes the literal is a
// second answer that happens to be in a test, and it caught both of these.
const INSTANCE = join(ROOT, "cat-harness");
const SITE = join(INSTANCE, siteDirFor(INSTANCE));
const INCLUDE = join(SITE, "_includes", "generated", "navbar-footer.html");
const TEMPLATE = join(INSTANCE, siteFileFor(INSTANCE, "_includes/nav_footer_custom.html"));

const file = (): string => readFileSync(INCLUDE, "utf-8");
/** Standing alone, the include is not built: `navbar:include` writes it at publish, and it is gitignored (bean w1gy F18). */
const NOT_BUILT = (): boolean =>
  siteNotBuilt("the generated sidebar include `navbar:include` writes at publish (gitignored)", INCLUDE);

/** The two deploy variants, split on the one Liquid conditional that makes them. */
function variants(s: string): { canonical: string; staging: string } {
  const parts = s.split("{%- else -%}");
  expect(parts.length).toBe(2);
  return { canonical: parts[0]!, staging: parts[1]! };
}

describe("what Jekyll is handed", () => {
  test.skipIf(NOT_BUILT())("every href goes through `relative_url`", () => {
    // `68au`: every graph tile in this navbar 404'd because an href was
    // composed without the baseurl. The site is served from
    // `/folio-assistant/` on the canonical deploy and from
    // `/folio-assistant/branches/<branch>/` on a preview, and ONE include is
    // rendered into pages at every depth — so a resolved href cannot be right
    // for more than one of them.
    const s = file();
    const bare = [...s.matchAll(/href="([^"]*)"/g)].map((m) => m[1]!);
    expect(bare.length).toBeGreaterThan(0);
    // `for="fa-nav-open"` is not an href; every real one is a Liquid filter.
    const unfiltered = bare.filter((h) => !h.includes("relative_url"));
    expect(unfiltered).toEqual([]);
  });

  test.skipIf(NOT_BUILT())("the avatar `src` goes through it too — the one that looks like content", () => {
    // Missed the first time for a reason worth keeping: an `img src` is
    // composed exactly like an href and does not read like a link, so a sweep
    // looking for navigation skips it. Omitting the filter rendered the mark
    // as NOTHING, measured 404 bare against 200 prefixed.
    const s = file();
    const srcs = [...s.matchAll(/<img[^>]*\ssrc="([^"]*)"/g)].map((m) => m[1]!);
    expect(srcs.length).toBeGreaterThan(0);
    expect(srcs.filter((h) => !h.includes("relative_url"))).toEqual([]);
  });

  test.skipIf(NOT_BUILT())("the checkbox is rendered ONCE, inside the copy guard", () => {
    // just-the-docs renders this extension point twice per page by design:
    // once in `.site-footer` inside `.side-bar`, once in a `.d-md-none` block
    // outside it. With the input in both, `id="fa-nav-open"` appeared twice on
    // 429 of 1,283 built pages (`uknu`).
    const s = file();
    const inputs = [...s.matchAll(/<input[^>]*id="fa-nav-open"/g)];
    expect(inputs.length).toBe(1);
    // And it must be INSIDE the guard, not merely present once in the file —
    // one occurrence outside it is one per copy at render time, which is the
    // bug wearing the fix's shape.
    const guard = /{%-\s*if fa_nav_copy == 1\s*-%}([\s\S]*?){%-\s*endif\s*-%}/.exec(s);
    expect(guard).not.toBeNull();
    expect(guard![1]).toContain('id="fa-nav-open"');
  });

  test.skipIf(NOT_BUILT())("neither variant renders a label: the theme's avatar is the way in (#1757)", () => {
    // There were two labels per copy, the `☰` and the `[x]`, and the owner
    // asked for both to go because they duplicated the avatar. So the way in
    // is no longer in this include at all — it is `.site-title`, which
    // `docs-ui.js` makes open this checkbox. Assert BOTH halves, or removing
    // the labels would read as leaving the sidebar with no way in. Since the
    // owner's 2026-10-30 ruling (cat-harness-tools#910) a click on a CLOSED
    // bar's avatar opens it, and on an open bar it is the theme's home link.
    const { canonical, staging } = variants(file());
    for (const v of [canonical, staging]) expect(v).not.toContain('for="fa-nav-open"');
    const js = readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "assets/js/docs-ui.js")), "utf8");
    expect(js).toContain('bar.querySelector(".site-title")');
    expect(js).toMatch(/box\.checked = true/);
  });
});

describe("the two deploy variants differ ONLY at a staging-only viewer", () => {
  /**
   * The narrowest statement of the falsifier this bean was opened with.
   *
   * A `publish: "staging-only"` viewer is a LINK on a preview and a NOTE on the
   * canonical deploy. That is a fact about which deploy is being built, and the
   * include is committed, so it cannot be baked — checked rather than assumed:
   * neither workflow re-runs `docs:harness`, so `harness.json` is the same
   * bytes on both, and `--staging` reaches `compose-docs.ts` alone.
   *
   * So the generator emits one Liquid conditional and the renderer stays free
   * of Liquid. What must hold is that the conditional buys exactly that and
   * nothing else — a second difference hiding in there would be a branch
   * nobody declared, which is the thing `sjic` is against.
   */
  test.skipIf(NOT_BUILT())("the difference is the staging-only rows, and no other row", () => {
    const { canonical, staging } = variants(file());
    const rows = (s: string): string[] => [...s.matchAll(/fa-nav-label">([^<]*)</g)].map((m) => m[1]!);
    // Same rows, in the same order, on both deploys. Only their REACHABILITY
    // differs — a viewer that vanished on one deploy would answer "what is in
    // this harness" differently depending on where you read it.
    expect(rows(staging)).toEqual(rows(canonical));
    // And the note appears on exactly one side.
    expect(canonical).toContain("staging only");
    expect(staging).not.toContain("staging only");
  });

  test.skipIf(NOT_BUILT())("the canonical side renders the withheld viewer as a DEAD row, not a hidden one", () => {
    // `pb04`, and the rule the rest of the navbar follows. Dropping it would
    // answer "what is in this harness" with a shorter and wronger list; making
    // it a link would invite a click that 404s on this deploy.
    const { canonical } = variants(file());
    const i = canonical.indexOf("staging only");
    expect(i).toBeGreaterThan(-1);
    expect(canonical.slice(0, i)).toMatch(/fa-nav-dead[\s\S]*$/);
  });
});

describe("the template composes nothing", () => {
  test("it is a single include and not one tag of markup", () => {
    // THE SWITCH. This test previously asserted the opposite — that the
    // template was still the hand-written one — so that moving to the
    // generated include had to come back here and change it deliberately
    // rather than happen quietly. It has, and this is the other half.
    //
    // No element may be composed here. A `{% include %}` and Liquid control
    // flow are not markup; a `<div>` is, and one tag is all it takes for the
    // sidebar to start deciding something the renderer already decided.
    const t = readFileSync(TEMPLATE, "utf-8");
    expect(t).toContain("generated/navbar-footer.html");
    expect(t).not.toMatch(/<(?!!--)[a-z]/i);
  });
});

describe("the writer is a fixpoint over the real data", () => {
  // Standing alone neither side is built: `sync-docs-harness` writes the
  // `_data/harness.json` the writer reads, `navbar:include` the include it is
  // compared with, both at publish and both gitignored (bean w1gy F18).
  test.skipIf(
    siteNotBuilt(
      "the `_data/harness.json` the writer reads and the include it compares with, both written at publish (gitignored)",
      join(SITE, "_data", "harness.json"),
      INCLUDE,
    ),
  )("running it leaves the committed file unchanged", () => {
    // A reader who runs the generator once must get a file that agrees with
    // the corpus. `--check` is what CI runs, so running it here asserts the
    // same equality the gate does — and asserts it against the REAL
    // `harness.json` rather than a fixture, which is the only version of this
    // question worth asking.
    const r = Bun.spawnSync({
      cmd: ["bun", "run", join(ROOT, "cat-harness-tools", "scripts", "gen-navbar-include.ts"), "--check"],
      cwd: ROOT,
      // `env` explicitly: a child does not inherit variables set at runtime,
      // and standalone the test preload sets FOLIO_FIXTURE_CHECKOUT.
      env: { ...process.env },
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = `${r.stdout.toString()}${r.stderr.toString()}`;
    expect(out).not.toContain("stale");
    expect(r.exitCode).toBe(0);
  });
});

// Bean `nvbr` (#223): "the lhs navbar should have sections for each node in
// the folio instance". The model that shipped is one section per INSTANTIATED
// harness (`603s`, `b5f0`), so the gate is stated in those terms. Asserted on
// `render` rather than on the committed file, so the two cases the gate names
// — several layers, and none — are tested whatever the repository holds.
describe("one navbar section per instantiated harness (bean `nvbr`)", () => {
  const h = (name: string, instantiated: boolean): Harness => ({ name, label: name, instantiated });
  const sections = (s: string) => [...s.matchAll(/data-fa-harness-config="([^"]+)"/g)].map((m) => m[1]);

  test("two instantiated harnesses render two sections; a declared-only one renders none", () => {
    const out = variants(render([h("alpha", true), h("beta", true), h("gamma", false)], "T"));
    for (const v of [out.canonical, out.staging]) expect(sections(v)).toEqual(["alpha", "beta"]);
  });

  test("zero instances renders without error, and with no empty Harnesses group", () => {
    const out = render([], "T");
    expect(out).toContain('class="fa-nav-top"');
    expect(sections(out)).toEqual([]);
    expect(out).not.toContain(">Harnesses<");
  });
  // GOAL 2 box 3 (bean `p5wm`), measured from a SCANNED root rather than from
  // hand-made `Harness` rows: the two tests above feed `render()` directly, so
  // nothing tied "two instantiated harnesses" to what `harnessTiles` actually
  // finds in a repository. This runs the real pipeline the docs sync runs —
  // scan → `harness.json` (a JSON round trip) → render.
  const scanned = (repo: string, host: string, names: string[]): Harness[] =>
    JSON.parse(JSON.stringify(harnessTiles(repo, host, names))) as Harness[];

  test("a SCANNED root with two instantiated harnesses renders exactly their two sections", () => {
    const repo = mkdtempSync(join(tmpdir(), "navbar-two-"));
    const decl = (name: string) => {
      mkdirSync(join(repo, name), { recursive: true });
      writeDeclaration(join(repo, name), JSON.stringify({ name, directories: [] }, null, 2));
    };
    decl("host");
    decl("alpha");
    decl("beta");
    decl("gamma");
    // Instantiated means a `<name>.config.json` at the repository root; gamma
    // is declared and NOT instantiated, so it must not get a section.
    for (const n of ["alpha", "beta"]) writeFileSync(join(repo, `${n}.config.json`), "{}\n");
    const out = variants(render(scanned(repo, join(repo, "host"), ["host", "alpha", "beta", "gamma"]), "T"));
    for (const v of [out.canonical, out.staging]) expect(sections(v).sort()).toEqual(["alpha", "beta"]);
  });

  test("a SCANNED root with no declaration at all yields no tiles and still renders", () => {
    // `siteDirFor` throws on a directory with no declaration; `harnessTiles`
    // must answer with no tiles rather than take the whole sync down.
    const repo = mkdtempSync(join(tmpdir(), "navbar-zero-"));
    const harnesses = scanned(repo, repo, []);
    expect(harnesses).toEqual([]);
    const out = render(harnesses, "T");
    expect(out).toContain('class="fa-nav-top"');
    expect(sections(out)).toEqual([]);
    expect(out).not.toContain(">Harnesses<");
  });
});

describe("a graph row says the destination's ONE name (bean `ob3m` finding 6)", () => {
  const harness: Harness = {
    name: "cat-harness",
    title: "C@T Harness",
    label: "C@T Harness",
    href: "/#harness-cat-harness",
    instantiated: true,
    visualisations: [
      { kind: "cat-harness", label: "Schemas", sameAs: "schemas", path: "/s/" },
      { kind: "methodology", label: "Methodologies", path: "/methodologies/" },
      { kind: "schemas", label: "Schemas", path: "/s/" },
    ],
  };
  const out = variants(render([harness], "T")).canonical;

  test("the row prints the data's label, not the kind word", () => {
    expect(out).toContain('<span class="fa-nav-label">Methodologies');
    expect(out).not.toContain('<span class="fa-nav-label">methodology');
  });

  test("a kind whose page is another kind's row is listed once", () => {
    expect(out.match(/<span class="fa-nav-label">Schemas/g)?.length).toBe(1);
  });
});

// #2235 F1: the navbar of an IG repository's OWN site.
describe("instanceView — an instance's own site", () => {
  const rows: Harness[] = [
    { name: "core", href: "/core/", instantiated: true, visualisations: [{ kind: "docs", path: "/core/docs/" }] },
    { name: "ig", href: "/ig/", instantiated: true, needs: ["base"], visualisations: [{ kind: "docs", path: "/ig/artifacts.html" }] },
    { name: "base", href: "/base/", instantiated: false, needs: ["core"] },
    { name: "other", href: "/other/", instantiated: true },
  ];
  const v = instanceView(rows, "ig", "https://main.example/site/");
  test("the instance first, then only what it needs, transitively", () => {
    // After the layer, the rows keep harness.json's order (the main navbar's).
    expect(v.map((h) => h.name)).toEqual(["ig", "core", "base"]);
  });
  test("the instance's own pages move to this site's root; every other link is the main site's", () => {
    expect(v[0]!.href).toBe("/");
    expect(v[0]!.visualisations![0]!.path).toBe("/artifacts.html");
    expect(v.find((h) => h.name === "core")!.href).toBe("https://main.example/site/core/");
    expect(v.find((h) => h.name === "core")!.visualisations![0]!.path).toBe("https://main.example/site/core/docs/");
  });
  test("every row it shows is rendered — a dependency here is reachable on the main site", () => {
    expect(v.every((h) => h.instantiated === true)).toBe(true);
    expect(render(v, "IG")).toContain("https://main.example/site/core/");
  });
});
