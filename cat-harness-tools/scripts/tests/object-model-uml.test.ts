/**
 * The harness schemas UML draws every arrow from the dependent to the general
 * node, and every class reaches its glossary definition (#1168, plan C).
 */
import { describe, expect, test } from "bun:test";

import { assertTerms, glossaryLinksMd, glossaryPage, schemasViewPuml, termPageRoute } from "../gen-object-model-uml.js";
import { siteNotBuilt } from "../../test/support/checkout.ts";

// The view refuses to draw a class its glossary page does not define, and that
// page is written at publish and gitignored (bean w1gy F18). Not built, the
// view cannot be drawn here, and the tests over it skip; the rest still run.
const GLOSSARY_NOT_BUILT = siteNotBuilt("the glossary page `glossary:page` writes at publish (gitignored)", glossaryPage());
const puml = GLOSSARY_NOT_BUILT ? "" : schemasViewPuml("test");
const edges = puml.split("\n").filter((l) => /^\w+ (-->|\.\.>|\.\.\|>)/.test(l));
const classes = puml.split("\n").filter((l) => /^\s+class "/.test(l));

describe.skipIf(GLOSSARY_NOT_BUILT)("arrows run from the dependent to the general node", () => {
  test("a Task realises the Skill it implements", () => {
    expect(edges.some((l) => /^Task \.\.\|> "1" Skill : implements/.test(l))).toBe(true);
  });

  test("a Voice and a User Story point at their Role, and the Role names neither", () => {
    expect(edges.some((l) => l.startsWith("Voice --> ") && l.includes(" Role : written for"))).toBe(true);
    expect(edges.some((l) => l.startsWith("UserStory --> ") && l.includes(" Role : as a"))).toBe(true);
    expect(edges.filter((l) => l.startsWith("Role ") && /(Voice|UserStory)\b/.test(l))).toEqual([]);
  });

  test("a Skill points at its input and output schemas, and a Test Run at the ones its cases meet", () => {
    expect(edges.filter((l) => l.startsWith("Skill ..> ") && l.includes("JsonSchema")).length).toBe(2);
    expect(edges.some((l) => l.startsWith("TestRun --> ") && l.includes("JsonSchema"))).toBe(true);
  });
});

describe("every class links to its glossary definition", () => {
  test.skipIf(GLOSSARY_NOT_BUILT)("in the PlantUML", () => {
    expect(classes.length).toBeGreaterThan(0);
    // On the owning layer's page, glossary/instance/<instance>/ (6c7adce), which the anchor's first segment names.
    const linked = classes.map((l) => l.match(/\[\[\.\.\/\.\.\/\.\.\/([\w/-]+)\/instance\/([\w-]+)\/#(([\w-]+?)--[\w-]+)\]\]/));
    expect(classes.filter((_, i) => !linked[i])).toEqual([]);
    for (const m of linked) expect(m![2]).toBe(m![4]);
  });

  test.skipIf(GLOSSARY_NOT_BUILT)("and on the page, since the SVG is shown as an image", () => {
    const md = glossaryLinksMd();
    expect(md.match(/\]\(/g)?.length).toBe(classes.length);
  });

  test("a term's page is its owning instance's glossary page", () => {
    expect(termPageRoute("cat-harness--platform--actor")).toMatch(/\/instance\/cat-harness\/$/);
    expect(termPageRoute("bootstrap--terms--task")).toMatch(/\/instance\/bootstrap\/$/);
    // Under the page locale like every visualiser's page (owner, 2026-10-16, "c").
    expect(termPageRoute("bootstrap--terms--task")).toMatch(/^en\/[\w-]+\/[\w-]+\/instance\/bootstrap\/$/);
  });

  test("a class whose term the page lacks is reported, and no page is could-not-determine", () => {
    const c = [{ id: "Task", term: "bootstrap--terms--task" }];
    expect(assertTerms(c, new Set(["bootstrap--terms--task"]))).toEqual([]);
    expect(assertTerms(c, new Set())).toEqual(["Task: no glossary entry bootstrap--terms--task"]);
    expect(assertTerms(c, null)[0]).toMatch(/^could not determine/);
  });
});
