import { describe, expect, test } from "bun:test";

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { SCRIPT_NAME, siteFields, buildConfig, DEFAULT_LAYOUT, overrideConfig, ownerRepo, pageUrls, stagingDir, targetOf, keepPinned, checkLinks, selfAddressOf, selfTargetOf, writeLinkReport, LINK_REPORT, missingRequired, isGraphData, writeBuildQa, BUILD_QA_REPORT, readUpstreamPages, stepCommand, writerCommand, pinGeneratedData, publishedRoot, shellFlags, chromeArtefacts, buildChrome, LIBRARY_GATE, gateSteps, NODE_KIND_PAGES, recipeWritesNodeKindPages, linkedDataSteps, softRun, siteIriCheckStep, declaredIriBase, ownDocumentStep } from "../../build-instance-site.ts";
import type { DeclaredArtefact } from "../../derive-at-publish.ts";

describe("build-instance-site — the agent-run site recipe (bean n3h9)", () => {
  test("a preview lands under one branches/ segment, whatever the branch is called", () => {
    expect(stagingDir("claude/exciting-hawking")).toBe("branches/claude-exciting-hawking");
    expect(stagingDir("fix/a b")).toBe("branches/fix-a-b");
    expect(() => stagingDir("..")).toThrow();
    expect(() => stagingDir("///")).toThrow();
  });

  test("the base path is read from the remote, https or ssh", () => {
    expect(ownerRepo("https://github.com/litlfred/who-iris")).toEqual({ owner: "litlfred", repo: "who-iris" });
    expect(ownerRepo("git@github.com:litlfred/smart-ra.git")).toEqual({ owner: "litlfred", repo: "smart-ra" });
    expect(ownerRepo("http://local_proxy@127.0.0.1:1/git/litlfred/x")).toBeUndefined();
  });

  test("the build config drops the remote theme it cannot fetch, and nothing else", () => {
    const c = "title: X\nremote_theme: just-the-docs/just-the-docs\nplugins:\n  - jekyll-remote-theme\n  - jekyll-feed\n";
    expect(buildConfig(c)).toBe(`title: X\nplugins:\n  - jekyll-seo-tag\n  - jekyll-feed\n\ndefaults:\n${DEFAULT_LAYOUT.join("\n")}\n`);
  });

  test("a page with no layout gets the theme's default, as GitHub Pages gives it; the config's own defaults stay", () => {
    const c = "title: X\ndefaults:\n  - scope:\n      path: start\n    values:\n      parent: Start here\n";
    const out = buildConfig(c);
    expect(out).toBe(`title: X\ndefaults:\n${DEFAULT_LAYOUT.join("\n")}\n  - scope:\n      path: start\n    values:\n      parent: Start here\n`);
    expect(out.match(/^defaults:/gm)).toHaveLength(1);
  });

  test("the override says what the declaration and the remote say, first description line only", () => {
    const o = overrideConfig({ title: 'WHO "IRIS"', description: "Line one\nline two", baseurl: "/who-iris", url: "https://litlfred.github.io" });
    expect(o).toContain('title: "WHO \\"IRIS\\""');
    expect(o).toContain('description: "Line one"');
    expect(o).not.toContain("line two");
    expect(o).toContain('baseurl: "/who-iris"');
  });

  test("the override turns off Sass source maps, so no .css.map is published", () => {
    const o = Bun.YAML.parse(overrideConfig({ title: "T", baseurl: "/r", url: "https://o.github.io" })) as { sass?: { sourcemap?: string } };
    expect(o.sass).toEqual({ sourcemap: "never" });
  });

  test("a link resolves relative to its page, a base-rooted one against the base, an outside one is a miss", () => {
    expect(targetOf("../a/b.html#x", "docs/p/index.html", "/r/")).toBe("docs/a/b.html");
    expect(targetOf("/r/catalogue/", "index.html", "/r/")).toBe("catalogue/");
    expect(targetOf("/concepts/x.html", "index.html", "/r/")).toBe("outside-base");
    expect(targetOf("https://example.org/", "index.html", "/r/")).toBeUndefined();
    expect(targetOf("mailto:a@b", "index.html", "/r/")).toBeUndefined();
    expect(targetOf("#top", "index.html", "/r/")).toBeUndefined();
    expect(targetOf("//cdn.example/x.js", "index.html", "/r/")).toBeUndefined();
  });

  test("urls are read by an HTML parser: a quote-concatenated string in a script is not a link", async () => {
    const html = `<a href="a.html">x</a><img src="i.png"><form action="f/"></form><script>var u = "<a href='" + base + "x.html'>";</script>`;
    expect(await pageUrls(html)).toEqual(["a.html", "i.png", "f/"]);
  });

  test("--pre, --source-step and --site-step take package script names, never commands", () => {
    for (const ok of ["check:catalogue", "site:catalogue", "iris.pages-check_2"]) expect(SCRIPT_NAME.test(ok)).toBe(true);
    for (const bad of ["bun run x", "a;rm -rf /", "$(id)", "a && b", "-x", ""]) expect(SCRIPT_NAME.test(bad)).toBe(false);
  });

  test("the declaration is read for name, title and description only, whatever kinds it names (bean qump)", () => {
    const text = JSON.stringify({ name: "x", title: "X", description: "d", directories: [{ id: "c", path: "c/", graphTypologies: ["not-registered-here"] }] });
    expect(siteFields(text, "x.json")).toEqual({ name: "x", title: "X", description: "d" });
    expect(() => siteFields("{", "x.json")).toThrow(/not valid JSON/);
    expect(() => siteFields("{}", "x.json")).toThrow(/declares no name/);
  });
});

describe("keepPinned — a build leaves a mounted layer as the lock pins it (litlfred/dth-hrh, 2026-10-14)", () => {
  const setup = () => {
    const root = mkdtempSync(join(tmpdir(), "keep-pinned-"));
    mkdirSync(join(root, "cat-harness/docs/_data"), { recursive: true });
    return root;
  };

  test("puts a mounted file's pinned bytes back after it is rewritten", () => {
    const root = setup();
    const f = join(root, "cat-harness/docs/_data/harness.json");
    writeFileSync(f, "pinned");
    const restore = keepPinned(f, ["cat-harness"], root);
    writeFileSync(f, "rewritten by sync-docs-harness");
    restore();
    expect(readFileSync(f, "utf-8")).toBe("pinned");
  });

  test("removes a mounted file the build created", () => {
    const root = setup();
    const f = join(root, "cat-harness/docs/_data/harness.json");
    const restore = keepPinned(f, ["cat-harness"], root);
    writeFileSync(f, "created");
    restore();
    expect(existsSync(f)).toBe(false);
  });

  test("leaves a file outside every mount alone (cat-harness building its own site commits it)", () => {
    const root = setup();
    const f = join(root, "cat-harness/docs/_data/harness.json");
    writeFileSync(f, "old");
    const restore = keepPinned(f, ["smart-base"], root);
    writeFileSync(f, "new");
    restore();
    expect(readFileSync(f, "utf-8")).toBe("new");
  });
});

describe("build-instance-site — a checkout that only mounts layers (an IG repository)", () => {
  test("a step runs from the checkout's own package.json, or through run-script.ts where it has none", () => {
    const d = mkdtempSync(join(tmpdir(), "bis-step-"));
    expect(stepCommand(d, "ig-site:compose")).toMatch(/run-script\.ts['"]? ig-site:compose$/);
    writeFileSync(join(d, "package.json"), JSON.stringify({ scripts: { "build:site": "echo" } }));
    expect(stepCommand(d, "build:site")).toBe("bun run build:site");
    // A package.json for the IG's own tooling, naming none of the site's steps
    // (smart-immunizations: fsh-sushi only): the step still resolves.
    writeFileSync(join(d, "package.json"), JSON.stringify({ dependencies: { "fsh-sushi": "^3" } }));
    expect(stepCommand(d, "ig-site:compose")).toMatch(/run-script\.ts['"]? ig-site:compose$/);
    expect(() => stepCommand(d, "x; rm -rf /")).toThrow();
  });

  test("a chrome writer runs through the checkout's `cat` runner, or run-script.ts where it has none (dth-hrh)", () => {
    const d = mkdtempSync(join(tmpdir(), "bis-writer-"));
    writeFileSync(join(d, "package.json"), JSON.stringify({ scripts: { "site:document": "echo" } }));
    const [bun, run, script, writer] = writerCommand(d, "avatars:css");
    expect([bun, run, writer]).toEqual(["bun", "run", "avatars:css"]);
    expect(script).toMatch(/run-script\.ts$/);
    writeFileSync(join(d, "package.json"), JSON.stringify({ scripts: { cat: "bun cat-harness-tools/scripts/run-script.ts" } }));
    expect(writerCommand(d, "avatars:css")).toEqual(["bun", "run", "cat", "avatars:css"]);
  });

  test("the pages a step lists as the content's own: one per line, comments and blanks ignored", () => {
    const d = mkdtempSync(join(tmpdir(), "bis-up-"));
    expect(readUpstreamPages(join(d, "absent.txt")).size).toBe(0);
    writeFileSync(join(d, "u.txt"), "# composed\na.html\n\nsub/b.html\n");
    expect([...readUpstreamPages(join(d, "u.txt"))]).toEqual(["a.html", "sub/b.html"]);
  });

  test("a required root file a step did not write is named, so the site is not published", () => {
    const site = mkdtempSync(join(tmpdir(), "bis-req-"));
    writeFileSync(join(site, "index.html"), "x");
    expect(missingRequired(site, ["folio-build.json", "index.html"])).toEqual(["folio-build.json"]);
    writeFileSync(join(site, "folio-build.json"), "{}");
    expect(missingRequired(site, ["folio-build.json"])).toEqual([]);
  });

  // Owner, 2026-11-14: "only refuse should be related to json(ld) publishing".
  test("only graph data refuses: a missing .json or .jsonld is graph data, a page or stylesheet is not", () => {
    for (const f of ["folio-build.json", "index.jsonld", "layer/layer.jsonld", "INDEX.JSONLD"]) expect(isGraphData(f)).toBe(true);
    for (const f of ["index.html", "assets/css/avatars.css", "assets/js/x.js", "a.jsonl", "json/index.html"]) expect(isGraphData(f)).toBe(false);
  });

  test("what the build published with is written beside the link report, for the QA page", () => {
    const site = mkdtempSync(join(tmpdir(), "bis-qa-"));
    writeBuildQa(site, [{ check: "coverage", detail: "/x/ (h declares `v`)" }]);
    expect(BUILD_QA_REPORT).toBe("assets/site-qa/build.json");
    expect(JSON.parse(readFileSync(join(site, BUILD_QA_REPORT), "utf-8"))).toEqual({ $schema: "site-build-qa/v1", findings: [{ check: "coverage", detail: "/x/ (h declares `v`)" }] });
  });

  test("a dead link on a content page is reported apart; one on any other page still refuses", async () => {
    const site = mkdtempSync(join(tmpdir(), "bis-links-"));
    mkdirSync(join(site, "sub"));
    writeFileSync(join(site, "index.html"), '<a href="sub/b.html">ok</a><a href="gone.html">dead</a>');
    writeFileSync(join(site, "sub", "b.html"), '<a href="../StructureDefinition-x.html">dead</a>');
    const r = await checkLinks(site, "/repo/", new Set(["sub/b.html"]));
    expect(r.misses).toEqual(["index.html: gone.html"]);
    expect(r.upstreamMisses).toEqual(["sub/b.html: ../StructureDefinition-x.html"]);
  });

  test("an absolute link to the site's own address is checked too (fhir-harness#380)", async () => {
    // smart-trust-demo's journey actors linked the root ActorDefinition-….html, which no build writes.
    const site = mkdtempSync(join(tmpdir(), "self-links-"));
    mkdirSync(join(site, "artifact"));
    writeFileSync(join(site, "artifact", "ActorDefinition-A.html"), "ok");
    const own = selfAddressOf("LitlFred", "demo");
    expect(own).toBe("https://litlfred.github.io/demo/");
    writeFileSync(
      join(site, "index.html"),
      '<a href="https://litlfred.github.io/demo/ActorDefinition-A.html">dead</a>' +
        '<a href="https://litlfred.github.io/demo/artifact/ActorDefinition-A.html#x">ok</a>' +
        '<a href="https://litlfred.github.io/demo/">home</a>' +
        '<a href="https://litlfred.github.io/other/ActorDefinition-A.html">another site</a>',
    );
    const r = await checkLinks(site, "/demo/", new Set(), own);
    expect(r.selfMisses).toEqual(["index.html: https://litlfred.github.io/demo/ActorDefinition-A.html"]);
    expect(r.misses).toEqual([]);
    // Without the address, absolute links stay unchecked, as before.
    expect((await checkLinks(site, "/demo/", new Set())).selfMisses).toEqual([]);
    expect(selfTargetOf("https://LITLFRED.github.io/demo/a%20b.html?q=1", own)).toBe("a b.html");
    expect(selfTargetOf("https://litlfred.github.io/demo", own)).toBe("");
    expect(selfTargetOf("https://litlfred.github.io/demox/a.html", own)).toBeUndefined();
    // The result is on the site for its QA report.
    writeLinkReport(site, r);
    const rep = JSON.parse(readFileSync(join(site, LINK_REPORT), "utf-8"));
    expect(rep.selfAddress).toEqual([{ page: "index.html", href: "https://litlfred.github.io/demo/ActorDefinition-A.html" }]);
    expect(rep.unresolved).toEqual([]);
  });

  test("links inside a diagram resolve against the .svg file and are reported apart", async () => {
    const site = mkdtempSync(join(tmpdir(), "bis-svg-"));
    mkdirSync(join(site, "img"));
    mkdirSync(join(site, "artifact"));
    writeFileSync(join(site, "artifact", "CodeSystem-T.html"), "ok");
    writeFileSync(join(site, "index.html"), "<p>home</p>");
    writeFileSync(
      join(site, "img", "flow.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
        '<a href="../artifact/CodeSystem-T.html#T-a"><text>ok</text></a>' +
        '<a xlink:href="../CodeSystem-T.html#T-b"><text>dead</text></a>' +
        '<a href="https://litlfred.github.io/demo/CodeSystem-T.html"><text>dead self</text></a>' +
        "</svg>",
    );
    const r = await checkLinks(site, "/demo/", new Set(), selfAddressOf("litlfred", "demo"));
    expect(r.diagrams).toBe(1);
    expect(r.diagramMisses).toEqual(["img/flow.svg: ../CodeSystem-T.html#T-b", "img/flow.svg: https://litlfred.github.io/demo/CodeSystem-T.html"]);
    expect(r.misses).toEqual([]);
    writeLinkReport(site, r);
    expect(JSON.parse(readFileSync(join(site, LINK_REPORT), "utf-8")).inDiagrams).toHaveLength(2);
  });
});

describe("build-instance-site — whose chrome the shell carries (smart-trust, 2026-10-14)", () => {
  test("an IG repository's shell is the platform's chrome only; a folio's carries its own as well", () => {
    // folio-site.yml composed an IG's shell in a folio-assistant checkout, which declares no
    // root docs layer; run from the IG's checkout, the shell must not pick the IG's docs/ up,
    // because stage-ig-sites builds that directory into the IG site and refuses a second copy.
    expect(shellFlags("ig-repo-site")).toBe("--shell --platform-only");
    expect(shellFlags("folio")).toBe("--shell");
    expect(shellFlags()).toBe("--shell");
  });
});

describe("pinGeneratedData — the build's data never stays in a mount (litlfred/smart-hiv, 2026-10-14)", () => {
  test("the landing's stickies.json in a smart-base mount is put back, and one the build created is removed", () => {
    const root = mkdtempSync(join(tmpdir(), "pin-data-"));
    // A mounted landing with a declaration naming its site directory.
    mkdirSync(join(root, "smart-base/docs/_data"), { recursive: true });
    writeFileSync(join(root, "smart-base/smart-base.json"), JSON.stringify({ name: "smart-base" }));
    writeFileSync(join(root, "smart-base/docs/_data/stickies.json"), "pinned");
    // A mount with no declaration: nothing to keep, and no throw.
    mkdirSync(join(root, "bootstrap"), { recursive: true });
    const restore = pinGeneratedData(root, ["smart-base", "bootstrap"]);
    writeFileSync(join(root, "smart-base/docs/_data/stickies.json"), "rewritten by gen-landing-data");
    writeFileSync(join(root, "smart-base/docs/_data/harness.json"), "created by sync-docs-harness");
    restore();
    expect(readFileSync(join(root, "smart-base/docs/_data/stickies.json"), "utf-8")).toBe("pinned");
    expect(existsSync(join(root, "smart-base/docs/_data/harness.json"))).toBe(false);
  });
});


describe("the chrome's publish-time writers run before the chrome is composed (smart-ra avatars.css)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "bis-chrome-"));
  const chrome = join(tmp, "cat-harness/site-chrome");
  const docs = join(tmp, "cat-harness/docs");
  const entry = (path: string, writer: string, under = chrome): DeclaredArtefact => ({ instance: "cat-harness", abs: join(under, path), path, writer: [writer], because: "checkout" });
  const css = entry("assets/css/avatars.css", "avatars:css");
  const page = entry("_data/harness.json", "docs:pages", docs);

  test("an entry inside a chrome layer is the chrome's; one in the site directory is not", () => {
    expect(chromeArtefacts(tmp, [css, page], [chrome])).toEqual([css]);
  });

  test("a writer that built its artefact passes, and runs once however many artefacts name it", () => {
    const calls: string[] = [];
    const twin = entry("assets/css/other.css", "avatars:css");
    const r = buildChrome(tmp, [css, twin], (w) => {
      calls.push(w);
      mkdirSync(join(chrome, "assets/css"), { recursive: true });
      writeFileSync(css.abs, ".a{}");
      writeFileSync(twin.abs, ".b{}");
      return { kind: "ran" };
    });
    expect(calls).toEqual(["avatars:css"]);
    expect(r.ran).toEqual(["avatars:css"]);
  });

  // Owner, 2026-11-14: "only refuse should be related to json(ld) publishing".
  test("a stylesheet writer that fails is a QA finding, and the build goes on", () => {
    const r = buildChrome(tmp, [css], () => ({ kind: "failed", exit: 1 }));
    expect(r.findings).toEqual([{ check: "chrome", detail: "chrome artefact writer avatars:css failed (exit 1)" }]);
  });

  test("a script writer that ran and built nothing is a QA finding, and the build goes on", () => {
    const gone = entry("assets/js/never.js", "never:js");
    const r = buildChrome(tmp, [gone], () => ({ kind: "ran" }));
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]!.detail).toMatch(/never\.js came out missing or empty after never:js/);
  });

  test("graph data still refuses: a JSON(-LD) writer that fails, or a JSON(-LD) that came out missing", () => {
    const graph = entry("assets/graph/index.jsonld", "graph:jsonld");
    expect(() => buildChrome(tmp, [graph], () => ({ kind: "failed", exit: 1 }))).toThrow(/graph:jsonld failed .*graph data/);
    expect(() => buildChrome(tmp, [graph], () => ({ kind: "ran" }))).toThrow(/graph data .*index\.jsonld came out missing or empty/);
  });

  test("a writer that does not apply to this root (exit 78) is reported, and its artefacts excused", () => {
    const na = entry("assets/js/na.js", "na:js");
    const r = buildChrome(tmp, [na], () => ({ kind: "skipped", why: "no frobnicator here" }));
    expect(r.skipped.get("na:js")).toBe("no frobnicator here");
  });
});

describe("gateSteps — every site build runs the library gate folio-assistant's publish runs (owner, 2026-10-16)", () => {
  test("the library gate runs first, before the recipe's own pre steps", () => {
    expect(gateSteps(["check:archimate"])).toEqual([LIBRARY_GATE, "check:archimate"]);
    expect(gateSteps([])).toEqual(["check:l1-complete"]);
  });
  test("a recipe that already names it does not run it twice", () => {
    expect(gateSteps(["check:l1-complete", "ig-site:ast"])).toEqual(["check:l1-complete", "ig-site:ast"]);
  });
  test("it is a script name a step may carry", () => {
    expect(SCRIPT_NAME.test(LIBRARY_GATE)).toBe(true);
  });
});

describe("every site writes its node-kind pages (who-iris schemas page, owner 2026-11-13)", () => {
  // who-iris's recipe named no site step, so the 34 node-kind links its schemas page draws were dead.
  const src = readFileSync(join(import.meta.dir, "..", "..", "build-instance-site.ts"), "utf-8");
  const body = src.slice(src.indexOf("export async function buildInstanceSite("));
  const folio = (scripts: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), "bis-nodekinds-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts }));
    return dir;
  };

  test("a recipe with no step that writes them gets them from the build", () => {
    expect(recipeWritesNodeKindPages(folio({ "site:catalogue": "bun run scripts/x.ts" }), ["site:catalogue"])).toBe(false);
    expect(recipeWritesNodeKindPages(mkdtempSync(join(tmpdir(), "bis-nopkg-")), [])).toBe(false);
  });
  test("a recipe whose own step runs the writer (a folio's site:node-kinds) does not run it twice", () => {
    const root = folio({ "site:node-kinds": `bun run cat-harness-tools/scripts/${NODE_KIND_PAGES} --root . --out` });
    expect(recipeWritesNodeKindPages(root, ["site:node-kinds"])).toBe(true);
    expect(recipeWritesNodeKindPages(root, [])).toBe(false);
  });
  test("it runs on the built site after the site steps, as a folio, and before the rail and the link check", () => {
    const at = (s: string) => {
      const i = body.indexOf(s);
      expect(i).toBeGreaterThan(-1);
      return i;
    };
    const step = at("${NODE_KIND_PAGES} --root . --out ${s}");
    expect(at("for (const st of o.siteSteps ?? [])")).toBeLessThan(step);
    for (const after of ["rail-standalone-pages.ts", "checkLinks(site,"]) expect(at(after)).toBeGreaterThan(step);
  });
});

describe("publishedRoot — shell-safe quoting of git archive arguments (bean cat-tools-j4sh)", () => {
  test("an exclude of $(touch ...) is single-quoted for bash and does not execute", () => {
    const dir = mkdtempSync(join(tmpdir(), "bis-pubroot-"));
    const remote = join(dir, "remote");
    const marker = join(dir, "pwned");
    mkdirSync(remote);
    const g = (...a: string[]) => spawnSync("git", a, { cwd: remote, encoding: "utf-8" });
    g("init", "-q", "-b", "gh-pages");
    g("config", "user.email", "t@t");
    g("config", "user.name", "t");
    writeFileSync(join(remote, "index.html"), "<p>ok</p>");
    g("add", "index.html");
    g("commit", "-qm", "init");

    const tree = publishedRoot(remote, "gh-pages", [`$(touch ${marker})`, "`touch " + marker + "`"]);
    expect(existsSync(marker)).toBe(false);
    expect(tree).toBeDefined();
    expect(readFileSync(join(tree!, "index.html"), "utf-8")).toBe("<p>ok</p>");
  });
});

describe("every site build writes its search scopes (who-iris search, owner 2026-11-13)", () => {
  // Without `assets/js/search/manifest.json` the theme's loader falls back to the
  // whole site index (33 MB on who-iris) and the search box never answers.
  const src = readFileSync(join(import.meta.dir, "..", "..", "build-instance-site.ts"), "utf-8");
  const body = src.slice(src.indexOf("export async function buildInstanceSite("));

  test("the split runs on the built site, scoped by the checkout it was built from", () => {
    expect(body).toContain("splitSite(site, root)");
  });

  test("after the last step that writes pages, and before the site is judged", () => {
    const at = (s: string) => {
      const i = body.indexOf(s);
      expect(i).toBeGreaterThan(-1);
      return i;
    };
    const split = at("splitSite(site, root)");
    for (const before of ["rail-standalone-pages.ts", "for (const st of o.finalSteps ?? [])", "writeForwardingPages(site, root)"]) expect(at(before)).toBeLessThan(split);
    for (const after of ['join(site, ".nojekyll")', "siteCoverageShortfall(", "parityReport("]) expect(at(after)).toBeGreaterThan(split);
  });
});

describe("every site build publishes its knowledge-graph search (owner, 2026-11-18)", () => {
  // "KG slice only, linked": the kg slice, its payloads and the harness's search
  // page, before the rail so the page gets the chrome, and before the split,
  // whose manifest links the page only when it is there.
  const src = readFileSync(join(import.meta.dir, "..", "..", "build-instance-site.ts"), "utf-8");
  const body = src.slice(src.indexOf("export async function buildInstanceSite("));
  const at = (s: string) => {
    const i = body.indexOf(s);
    expect(i).toBeGreaterThan(-1);
    return i;
  };
  test("after the mounted docs, before the rail and the search split", () => {
    const kg = at("publishKgSearch(site, root)");
    expect(at("mount-instance-docs.ts")).toBeLessThan(kg);
    expect(at("rail-standalone-pages.ts")).toBeGreaterThan(kg);
    expect(at("splitSite(site, root)")).toBeGreaterThan(kg);
  });
  test("builds the kg slice with its payloads, and a failure is said, not a refused publish", () => {
    const fn = src.slice(src.indexOf("function publishKgSearch("), src.indexOf("function run("));
    expect(fn).toContain("--slice kg");
    expect(fn).toContain("--with-published-payloads");
    expect(fn).toContain("the site publishes no KG search");
    expect(fn).not.toContain("throw ");
  });
});

describe("build-instance-site — every layer's site serves its JSON-LD context and vocabulary (IRI fix 1A, d)", () => {
  test("the steps build the context into the site and the vocabulary beside it, never over a richer one", () => {
    const steps = linkedDataSteps("cat-harness-tools/scripts", "dth-pc", "/tmp/site");
    expect(steps.map((s) => s.label)).toEqual(["JSON-LD context", "vocabulary (ns)"]);
    expect(steps[0]!.argv).toEqual(["run", "cat-harness-tools/scripts/publish-instance-context.ts", "build", "--root", ".", "--instance", "dth-pc", "--site", "/tmp/site"]);
    expect(steps[1]!.argv).toEqual(["run", "cat-harness-tools/scripts/publish-instance-context.ts", "vocab", "--root", ".", "--instance", "dth-pc", "--out-dir", "/tmp/site", "--keep-existing"]);
  });

  test("an instance name or site path is one argument, never shell", () => {
    expect(linkedDataSteps("t", "a;rm -rf /", "s p")[0]!.argv).toContain("a;rm -rf /");
    expect(linkedDataSteps("t", "a", "s p")[0]!.argv).toContain("s p");
  });

  test("softRun spawns bun with the argv, no shell; a failure is an error annotation and the build goes on", () => {
    const logs: string[] = [];
    const calls: unknown[][] = [];
    const orig = console.log;
    console.log = (m: string) => void logs.push(m);
    try {
      const fail = ((cmd: string, args: string[]) => (calls.push([cmd, args]), { status: 1 })) as unknown as typeof spawnSync;
      const pass = (() => ({ status: 0 })) as unknown as typeof spawnSync;
      expect(softRun("JSON-LD context", ["run", "x.ts"], ".", fail)).toBe(false);
      expect(softRun("JSON-LD context", ["run", "x.ts"], ".", pass)).toBe(true);
    } finally {
      console.log = orig;
    }
    expect(calls[0]).toEqual(["bun", ["run", "x.ts"]]);
    expect(logs.some((l) => l.startsWith("::error::JSON-LD context failed (exit 1)"))).toBe(true);
  });

  test("the build runs the steps for every declared layer, whatever its recipe", () => {
    const src = readFileSync(join(import.meta.dir, "..", "..", "build-instance-site.ts"), "utf-8");
    expect(src).toContain("if (declared) for (const st of linkedDataSteps(TOOLS, o.instance, site)) softRun(st.label, st.argv, root);");
  });
});

describe("build-instance-site — a layer's own site serves its document and Tool documents (#638)", () => {
  const layer = (decl: Record<string, unknown>, file = "layer.json"): string => {
    const d = mkdtempSync(join(tmpdir(), "own-doc-"));
    mkdirSync(dirname(join(d, file)), { recursive: true });
    writeFileSync(join(d, file), JSON.stringify(decl));
    return d;
  };

  test("on the layer's own canonical site, kg-export writes the document at its own path with no --base-url", () => {
    const root = layer({ name: "qou", canonicalUrl: "https://litlfred.github.io/qou" }, "qou.json");
    const st = ownDocumentStep("t", root, "qou.json", "qou.jsonld", "/tmp/site", "https://litlfred.github.io/qou/")!;
    expect(st.out).toBe(join("/tmp/site", "qou.jsonld"));
    expect(st.argv.slice(0, 8)).toEqual(["run", join("t", "kg-export.ts"), "--instance", ".", "--scope", "instance", "--out", st.out]);
    expect(st.argv).not.toContain("--base-url");
    expect(st.argv).toContain("--qa-root");
  });

  test("the address comparison ignores a trailing slash and case; a layer in a subdirectory is named by it", () => {
    const root = layer({ name: "x", canonicalUrl: "https://Owner.github.io/repo/" }, "sub/x.json");
    const st = ownDocumentStep("t", root, "sub/x.json", "x.jsonld", "/s", "https://owner.github.io/repo")!;
    expect(st.argv[3]).toBe("./sub");
  });

  test("no step on another site, without a canonicalUrl, or for a path outside the site", () => {
    const own = layer({ name: "qou", canonicalUrl: "https://litlfred.github.io/qou" });
    expect(ownDocumentStep("t", own, "layer.json", "qou.jsonld", "/s", "https://litlfred.github.io/folio-assistant/")).toBeUndefined();
    expect(ownDocumentStep("t", layer({ name: "a" }), "layer.json", "a.jsonld", "/s", "https://litlfred.github.io/a/")).toBeUndefined();
    expect(ownDocumentStep("t", own, "layer.json", "../qou.jsonld", "/s", "https://litlfred.github.io/qou/")).toBeUndefined();
    expect(ownDocumentStep("t", own, "missing.json", "qou.jsonld", "/s", "https://litlfred.github.io/qou/")).toBeUndefined();
  });

  test("the build runs it for a declared layer, before the IRI and link checks", () => {
    const src = readFileSync(join(import.meta.dir, "..", "..", "build-instance-site.ts"), "utf-8");
    const at = src.indexOf("ownDocumentStep(TOOLS, root, declFile, docPath, site, selfAddressOf(gh.owner, gh.repo))");
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(src.indexOf("siteIriCheckStep(TOOLS, site, iriBase)"));
    expect(at).toBeLessThan(src.indexOf("const links = await checkLinks("));
  });
});

describe("build-instance-site — a built site serves the IRIs it mints (IRI fix 1A, f)", () => {
  test("the step checks the tree against the declared iriBase, and no JSON-LD (78) is a pass", () => {
    const st = siteIriCheckStep("cat-harness-tools/scripts", "/tmp/site", "https://example.org/layer/");
    expect(st.argv).toEqual(["run", "cat-harness-tools/scripts/check-site-iris.ts", "--site", "/tmp/site", "--base", "https://example.org/layer/"]);
    expect(st.ok).toEqual([0, 78]);
  });

  test("softRun honours the passing exits it is given", () => {
    const orig = console.log;
    console.log = () => undefined;
    try {
      const exit78 = (() => ({ status: 78 })) as unknown as typeof spawnSync;
      expect(softRun("x", ["x"], ".", exit78)).toBe(false);
      expect(softRun("x", ["x"], ".", exit78, [0, 78])).toBe(true);
    } finally {
      console.log = orig;
    }
  });

  test("declaredIriBase reads the declaration's iriBase, and nothing from a file without one", () => {
    const d = mkdtempSync(join(tmpdir(), "iribase-"));
    writeFileSync(join(d, "a.json"), JSON.stringify({ name: "a", iriBase: "https://example.org/a/" }));
    writeFileSync(join(d, "b.json"), JSON.stringify({ name: "b" }));
    writeFileSync(join(d, "c.json"), "not json");
    expect(declaredIriBase(join(d, "a.json"))).toBe("https://example.org/a/");
    expect(declaredIriBase(join(d, "b.json"))).toBeUndefined();
    expect(declaredIriBase(join(d, "c.json"))).toBeUndefined();
    // Removed: a temp directory holding two declarations is an ambiguous
    // instance to any other test that scans the temp root.
    rmSync(d, { recursive: true, force: true });
  });

  test("the build and the folio path both run the check", () => {
    const build = readFileSync(join(import.meta.dir, "..", "..", "build-instance-site.ts"), "utf-8");
    const stage = readFileSync(join(import.meta.dir, "..", "..", "stage-local.ts"), "utf-8");
    expect(build).toContain("const st = siteIriCheckStep(TOOLS, site, iriBase);");
    expect(stage).toContain("siteIriCheckStep(dirname(script(\"check-site-iris.ts\")), site, iriBase)");
  });
});
