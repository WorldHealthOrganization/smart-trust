/**
 * The derived indexes index the artefacts — not their renderings, not their
 * supporting pages, and not a directory that holds neither.
 *
 * @module scripts/tests/gen-auto-docs.test
 *
 * Both of the defects pinned here were live in drafts of the generator, and
 * both had the same shape: a second answer to a question the repository
 * already answers.
 *
 *   1,522 skills — every declared directory walked, including `docs/`, which
 *                  holds a generated markdown rendering of every skill.
 *     227 skills — the skill directories walked RECURSIVELY, so
 *                  `skills/<package>/<skill>/<page>.md` counted as a skill.
 *     219 skills — `knownSkills()`'s own number, reached by asking
 *                  `skillMdDirs()` instead of re-deriving what it encodes.
 */
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "../../test/support/site-fs.ts";
import { join, resolve } from "node:path";

import { TYPES, autoDocPage, declaredDirectories, levelPage, owningDirectory } from "../gen-auto-docs.ts";
import { knownSkills } from "../known-skills.ts";
import { layerRootsIn, isExemptFrom, readDeclaration, siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { notApplicableAlone, siteNotBuilt } from "../../test/support/checkout.ts";

// The harness whose docs the generator writes; the test moved up with it (70lx B2).
const INSTANCE = HARNESS_ROOT;
const SITE = join(INSTANCE, siteDirFor(INSTANCE));
const HANDLER = readDeclaration(INSTANCE)?.name;

describe("the type registry", () => {
  it("every type declares the graph typology its artefacts live in", () => {
    // Not optional: without it the walk reaches `docs/`, and a RENDERING of an
    // artefact gets counted as a second artefact.
    expect(TYPES.length).toBeGreaterThan(0);
    for (const t of TYPES) {
      expect(t.graph).toBeTruthy();
      expect(t.id).toMatch(/^[a-z]+(\/[a-z-]+)*$/);
      expect(t.extracts.length).toBeGreaterThan(20);
    }
  });

  it("`toc` is not a type, and that is a decision rather than an omission", () => {
    // Owner withdrew it in the session that proposed it: a table of contents
    // is a document-order notion and a sub-graph has no single order.
    expect(TYPES.map((t) => t.id)).not.toContain("toc");
    expect(TYPES.map((t) => t.id)).not.toContain("index/toc");
  });

  it("no two types share an id", () => {
    const ids = TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("index/skills agrees with knownSkills, exactly", () => {
  const items = TYPES.find((t) => t.id === "index/skills")!.collect();

  it("the same set of names, neither more nor fewer", () => {
    // The ratchet for both historical defects at once. A superset means the
    // walk has reached renderings or supporting pages; a subset means it has
    // stopped seeing a declared directory.
    const mine = new Set(items.map((i) => i.name));
    const known = new Set(knownSkills(INSTANCE));
    for (const inst of layerRootsIn(resolve(INSTANCE, ".."))) {
      const decl = readDeclaration(inst);
      if (decl && !isExemptFrom(decl, "visualiser")) {
        for (const s of knownSkills(inst, "instance")) known.add(s);
      }
    }
    expect([...known].filter((n) => !mine.has(n))).toEqual([]);
    expect([...mine].filter((n) => !known.has(n))).toEqual([]);
  });

  it("every item names a file that exists", () => {
    const repo = resolve(INSTANCE, "..");
    for (const i of items) expect(existsSync(join(repo, i.path))).toBe(true);
  });

  it("items are in a deterministic order", () => {
    const paths = items.map((i) => i.path);
    expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b, "en")));
  });
});

describe("index/processes extracts what a BPMN declares about itself", () => {
  const items = TYPES.find((t) => t.id === "index/processes")!.collect();

  it("finds the diagrams, and each carries its lanes and activity count", () => {
    expect(items.length).toBeGreaterThan(20);
    for (const i of items) {
      expect(i.path.endsWith(".bpmn")).toBe(true);
      expect(Number(i.facts?.activities ?? "-1")).toBeGreaterThanOrEqual(0);
    }
  });

  it("at least one names the skills its activities reference", () => {
    // The repo requires `<folio:skill ref>` on every activity, so an index
    // that surfaced none would mean the extraction, not the corpus, is wrong.
    expect(items.some((i) => (i.facts?.skills ?? "").length > 0)).toBe(true);
  });

  it("a layer's shared-steps file is labelled by its instance, so two layers' rows differ", () => {
    // Every layer names the file `processes/global-tasks.bpmn`; labelled by
    // basename, cat-harness's and folio-assistant-core's rows read alike.
    const shared = items.filter((i) => i.name.startsWith("Shared steps ("));
    expect(new Set(shared.map((i) => i.name)).size).toBe(shared.length);
    for (const i of shared) expect(i.name).not.toBe("Shared steps (global-tasks)");
  });

  it("summaries are one sentence, not a whole documentation block", () => {
    for (const i of items) {
      if (!i.summary) continue;
      expect(i.summary.length).toBeLessThanOrEqual(230);
      expect(i.summary).not.toContain("\n");
    }
  });
});

describe("owningDirectory picks the most specific declaration", () => {
  const dirs = [
    { id: "outer", path: "cat-harness/skills" },
    { id: "inner", path: "cat-harness/processes" },
    { id: "other", path: "who-iris/skills" },
  ];

  it("an inner declaration wins over the outer one that also contains the file", () => {
    // Attributing a workflow to `cat-harness` would leave the workflow
    // directory's own declaration indexing nothing while looking populated.
    expect(owningDirectory("cat-harness/processes/x.bpmn", dirs)?.id).toBe("inner");
  });

  it("a file only the outer declaration contains goes to the outer one", () => {
    expect(owningDirectory("cat-harness/skills/todo-manager.md", dirs)?.id).toBe("outer");
  });

  it("a file under no declaration is unattributed rather than guessed", () => {
    expect(owningDirectory("somewhere/else/x.md", dirs)).toBeUndefined();
  });

  it("a prefix that is not a path boundary does not match", () => {
    // `who-iris/skills` must not claim `who-iris/skills-extra/…`.
    expect(owningDirectory("who-iris/skills-extra/x.md", dirs)).toBeUndefined();
  });
});

describe("declaredDirectories is filtered and existence-checked", () => {
  it("returns only directories declaring the asked-for graph", () => {
    const kg = declaredDirectories("cat-harness");
    expect(kg.length).toBeGreaterThan(1);
    // `docs/` declares the `docs` graph, not `cat-harness` — it is the
    // directory whose inclusion produced the 1,522 count.
    expect(kg.map((d) => d.id)).not.toContain("docs");
  });

  it("an undeclared graph yields nothing rather than everything", () => {
    expect(declaredDirectories("no-such-graph-typology")).toEqual([]);
  });
});

describe("the emitted page", () => {
  it("carries the ownership line the pruner reads", () => {
    // `orphanSubjectPages` establishes ownership from this line. Without it a
    // page could never be pruned, and with a wrong one it could be pruned
    // from the wrong place.
    const html = autoDocPage(TYPES[0]!, [], "who-iris-skills", "who-iris/skills", []);
    expect(html).toContain('var SCOPE = "who-iris-skills";');
  });

  it("says it is an index and not the documentation", () => {
    // The authoring obligation is stated on the artefact, not only in the
    // skill — a reader who lands here from a search never opened the skill.
    const html = autoDocPage(TYPES[0]!, [], "", undefined, []);
    expect(html).toContain("not the documentation");
    expect(html).toContain("auto-docs");
  });

  it("an item with no description says so rather than showing blank", () => {
    const html = autoDocPage(TYPES[0]!, [{ path: "a/b.md", name: "b" }], "", undefined, []);
    expect(html).toContain("no description in the artefact");
  });
});

describe("a THEMED page, so the layout gives it the top band (2026-10-07)", () => {
  const pages = [
    autoDocPage(TYPES[0]!, [{ path: "a/b.md", name: "b" }], "x", "a/", []),
    levelPage("index", [{ seg: "skills", title: "Skills", detail: "d", count: 1 }]),
  ];

  it("is on the default layout, excluded from the nav, with a quoted title", () => {
    for (const html of pages) {
      expect(html.startsWith("---\nlayout: default\ntitle: \"")).toBe(true);
      expect(html).toMatch(/^nav_exclude: true$/m);
    }
  });

  it("is not a document of its own, and declares no rail", () => {
    // The theme's sidebar is the navigation; a page with a <head> would be
    // standalone again and lose the band.
    for (const html of pages) {
      expect(html).not.toMatch(/<!doctype|<html|<head|<body/i);
      expect(html).not.toContain("fa-nav");
      expect(html).toContain('<h1 id="da-title">');
      expect(html).toContain('<div class="da-page">');
    }
  });

  it("styles nothing outside its own wrapper", () => {
    // A rule on body, :root or a bare `a` would restyle the theme page.
    for (const html of pages) {
      const css = /<style>([\s\S]*?)<\/style>/.exec(html)![1]!.replace(/\/\*[\s\S]*?\*\//g, "");
      for (const sel of css.matchAll(/(?:^|})\s*([^{}@]+)\{/g)) {
        for (const one of sel[1]!.split(",")) expect(one.trim().startsWith(".da-page")).toBe(true);
      }
    }
  });

  it("keeps the body Liquid-raw, with the front matter outside it", () => {
    const html = autoDocPage(
      TYPES[0]!,
      [{ path: "a/b.md", name: "b", summary: "uses {{ x }} and {% endraw %} and {%- endraw -%}" }],
      "x",
      "a/",
      [],
    );
    const fm = /^---\n[\s\S]*?\n---\n/.exec(html)![0];
    expect(fm).not.toContain("{%");
    const body = html.slice(fm.length);
    expect(body.indexOf("{% raw %}")).toBeGreaterThan(-1);
    // The artefact's own endraw could end the raw block early and expose the
    // rest to Liquid. `escapeForRaw` (lib/liquid-raw.ts) closes the block,
    // emits the brace through Liquid and reopens it — so once those escape
    // sequences are taken out, the only endraw left is the closing one.
    const ESC = '{% endraw %}{{ "{" }}{% raw %}%';
    const unescaped = body.split(ESC).join("{%");
    expect(body.split(ESC).length - 1).toBe(2);
    expect(unescaped.match(/\{%-?\s*endraw/g)).toEqual(["{% endraw", "{%- endraw", "{% endraw"]);
    expect(body.trimEnd().endsWith("{% endraw %}")).toBe(true);
  });

  it("a title with a quote still parses as one YAML scalar", () => {
    const html = autoDocPage({ ...TYPES[0]!, title: 'Say "hi"' }, [], "", undefined, []);
    expect(html).toContain('title: "Say \\"hi\\" · auto-docs"');
  });
});

describe("what is published", () => {
  // who-iris is a higher layer; standing alone it contributes nothing to render.
  it.skipIf(notApplicableAlone("who-iris, whose one skill (iris-dspace) is the sparse sub-graph this page renders"))("a sub-graph page exists for who-iris, the sparse case", () => {
    // The owner asked for the handler to be exercised on who-iris, which
    // contributes ONE skill. A thin index is a real answer; the test is that
    // it is rendered at all rather than dropped as uninteresting.
    expect(HANDLER).toBeTruthy();
    const p = join(SITE, HANDLER!, "auto-docs", "index", "skills", "who-iris-skills", "index.html");
    expect(existsSync(p)).toBe(true);
    expect(readFileSync(p, "utf-8")).toContain("iris-dspace");
  });

  it("no page is published for a sub-graph that contributes nothing", () => {
    // `dh4f` as a nav entry. `who-iris-skills` holds no BPMN, so it gets a
    // skills page and must NOT get a processes page.
    const p = join(SITE, HANDLER!, "auto-docs", "index", "processes", "who-iris-skills");
    expect(existsSync(p)).toBe(false);
  });
});

describe("the LEVEL pages — a route that reads like a section must answer", () => {
  // Standing alone the level pages are not built: `auto:docs` writes them at
  // publish and `auto-docs/` is gitignored (bean w1gy F18).
  const notBuilt = (...levels: string[][]): boolean =>
    siteNotBuilt(
      "the auto-docs level pages `auto:docs` writes at publish (gitignored)",
      ...levels.map((l) => join(SITE, HANDLER ?? "", "auto-docs", ...l, "index.html")),
    );

  // The root level is the one every built type sits under: absent, none is built.
  it.skipIf(notBuilt([]))("every level above a built type has an index", () => {
    // Bean `06e3`: a type id may carry a slash, so `viewerPlacement` nests its
    // page directory and the levels above came into existence holding nothing.
    // `/cat-harness/auto-docs/` and `/cat-harness/auto-docs/index/` were both
    // bare directories — the same defect §4(a) fixed one level up, and the
    // reason the authored landing page had to name `auto-docs` without a link.
    const levels = new Set<string>();
    for (const t of TYPES) {
      const segs = t.id.split("/");
      for (let i = 0; i < segs.length; i++) levels.add(segs.slice(0, i).join("/"));
    }
    expect(levels.size).toBeGreaterThan(0);
    for (const prefix of levels) {
      const p = join(SITE, HANDLER!, "auto-docs", ...(prefix ? prefix.split("/") : []), "index.html");
      expect(existsSync(p), `no index at auto-docs/${prefix}`).toBe(true);
    }
  });

  it.skipIf(notBuilt([], ["index"]))("a level page names ITSELF, so the one pruner can read its ownership", () => {
    // `orphanSubjectPages` establishes ownership from `var SCOPE`, and a page
    // whose SCOPE does not match its own directory is FOREIGN — reported and
    // left. A level page that got this wrong would be unprunable forever, and
    // nothing else would say so.
    const root = readFileSync(join(SITE, HANDLER!, "auto-docs", "index.html"), "utf-8");
    expect(root).toContain('var SCOPE = "auto-docs";');
    const mid = readFileSync(join(SITE, HANDLER!, "auto-docs", "index", "index.html"), "utf-8");
    expect(mid).toContain('var SCOPE = "index";');
  });

  it.skipIf(notBuilt(["index"]))("its links are relative to itself, so the tree can move", () => {
    const mid = readFileSync(join(SITE, HANDLER!, "auto-docs", "index", "index.html"), "utf-8");
    for (const t of TYPES) {
      const seg = t.id.split("/").pop()!;
      if (!t.id.startsWith("index/")) continue;
      expect(mid).toContain(`href="${seg}/"`);
    }
    // And no absolute path composed from a base URL — the same rule every
    // viewer here follows, because the base is not this generator's to know.
    expect(/href="\//.test(mid)).toBe(false);
  });

  it("renders a level with nothing under it as a stated absence", () => {
    // Not an empty list: an empty list and a complete list look identical,
    // which is why `TYPES` keeps unbuilt types absent rather than stubbed.
    expect(levelPage("index", [])).toContain("Nothing is built under this level");
  });

  it("counts a type's items and says what a nested level holds", () => {
    const h = levelPage("", [
      { seg: "index", title: "index", detail: "2 type(s) below" },
      { seg: "glossary", title: "Glossary", detail: "every defined term", count: 7, countKey: "glossary" },
    ], "../assets/auto-docs/index.json");
    expect(h).toContain("2 type(s) below");
    expect(h).toContain('href="glossary/"');
    // The count is FETCHED (cone-shrinking, 2026-10-31): the page carries the
    // key, so a file added anywhere does not rewrite the page.
    expect(h).toContain('data-da-count="glossary"');
    expect(h).not.toContain(">7<");
    expect(h).toContain('fetch("../assets/auto-docs/index.json"');
  });
});

describe("a description naming another artefact on the page links to its row (bean qgjh)", () => {
  const items = [
    { path: "g/l.json#role/adjudicator", name: "Adjudicator", summary: "Inherits `reviewer`, not `adjudicator` or `ghost`." },
    { path: "g/l.json#role/reviewer", name: "Reviewer", summary: "Reports." },
  ];
  const html = autoDocPage(TYPES[0]!, items, "", undefined, []);

  it("links the one row whose fragment ends in that name", () => {
    expect(html).toContain('<tr id="a-g-l-json-role-reviewer">');
    expect(html).toContain('<a href="#a-g-l-json-role-reviewer"><code>reviewer</code></a>');
  });
  it("never links a row to itself, nor a name no row carries", () => {
    expect(html).toContain("not <code>adjudicator</code> or <code>ghost</code>.");
  });
  it("a name two rows share stays code", () => {
    const dup = autoDocPage(TYPES[0]!, [...items, { path: "h/m.json#x/reviewer", name: "R2" }], "", undefined, []);
    expect(dup).not.toContain('href="#a-g-l-json-role-reviewer"');
  });
});

describe("a code span that is not a row here links to a skill page or a file (bean qgjh)", () => {
  const refs = {
    skill: (n: string) => (n === "todo-manager" ? "../skill/todo-manager.html" : undefined),
    file: (p: string) => (p === "a/b.bpmn" ? "https://example.invalid/a/b.bpmn" : undefined),
  };
  const html = autoDocPage(
    TYPES[0]!,
    [{ path: "g/l.json#role/x", name: "X", summary: "See `todo-manager`, `todo-manager.md`, `a/b.bpmn` and `claim`." }],
    "",
    undefined,
    [],
    refs,
  );

  it("a skill name, with or without .md, links to its instruction page", () => {
    expect(html).toContain('<a href="../skill/todo-manager.html"><code>todo-manager</code></a>');
    expect(html).toContain('<a href="../skill/todo-manager.html"><code>todo-manager.md</code></a>');
  });
  it("a repository path links to its source", () => {
    expect(html).toContain('<a href="https://example.invalid/a/b.bpmn"><code>a/b.bpmn</code></a>');
  });
  it("a name that resolves to neither stays code", () => {
    expect(html).toContain("and <code>claim</code>.");
  });
});

describe("counts are fetched from one file, so pages do not move when a count does", () => {
  const siblings = (n: number) => [
    { id: "a-skills", path: "a/skills", count: n },
    { id: "b-skills", path: "b/skills", count: 3 },
  ];
  const page = (n: number) =>
    autoDocPage(TYPES[0]!, [{ path: "a/skills/x/SKILL.md", name: "x" }], "a-skills", "a/skills", siblings(n), undefined, "../../x.json");

  it("a sibling's count changing leaves the page byte-identical", () => {
    // Before, each sub-graph page listed every sibling's count, so one file
    // added anywhere rewrote every sibling page (about 40 per deploy).
    expect(page(5)).toBe(page(6));
  });

  it("each sibling carries its key and a pending mark, filled from the counts file", () => {
    const html = page(5);
    expect(html).toContain(`data-da-count="${TYPES[0]!.id}/a-skills"`);
    expect(html).toContain(`data-da-count="${TYPES[0]!.id}/b-skills"`);
    expect(html).toContain('data-da-count-state="pending"');
    expect(html).toContain('fetch("../../x.json"');
    expect(html).toContain("j.counts");
  });

  it("a level page's type count changing leaves it byte-identical", () => {
    const lp = (n: number) => levelPage("index", [{ seg: "skills", title: "Skills", detail: "d", count: n, countKey: "index/skills" }], "x.json");
    expect(lp(1)).toBe(lp(2));
  });
});
