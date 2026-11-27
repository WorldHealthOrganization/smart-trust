/**
 * The UML overview's Graphviz DOT is the same model as its `.puml`, coloured
 * from the same stylesheet, and it lays out (skill `kg-subgraph-layout`).
 *
 * Owner, 2026-10-09: *"could use the wasm-graphviz to make the graph
 * visualizers overview more dynamic"* and *"in cat-harness visualizer, use
 * existing themes for coloring"*. The DOT is the page's Interactive view; a
 * DOT that drew a class the `.puml` does not, in a colour `uml.css` does not
 * declare, would be the second model and the second palette that
 * `graph-rendering` rules 1 and 7 forbid.
 */
import { describe, expect, test } from "bun:test";
import { statSync } from "node:fs";
import { existsSync, readdirSync, readFileSync } from "../../../test/support/site-fs.ts";
import { overlayPath } from "../../lib/layer-output.ts";
import { join, relative, resolve } from "node:path";

import { Graphviz } from "@hpcc-js/wasm-graphviz";

import { instanceDirectoryForGraph, siteDirFor } from "../../../schemas/kg/cat-harness.ts";
import { dot, type Section } from "../../gen-uml-overview.ts";
import { readUmlPalette } from "../../uml-palette.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { siteNotBuilt } from "../../../test/support/checkout.ts";

const HARNESS = resolve(HARNESS_ROOT);
const PALETTE = readUmlPalette(HARNESS);
// declared-path-literal: the conventional fallback when no declaration names the directory, as the generator's own
const UML_ROOT = join(instanceDirectoryForGraph(HARNESS, "uml") ?? join(HARNESS, "uml"), "overview");
const DOT_ROOT = join(HARNESS, siteDirFor(HARNESS), "assets", "img", "uml", "overview");

function walk(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(overlayPath(p)).isDirectory() ? walk(p, ext) : p.endsWith(ext) ? [p] : [];
  });
}

const FIXTURE: Section[] = [
  {
    instance: "demo",
    id: "skills",
    path: "demo/skills",
    kinds: ["skills"],
    classes: [
      { id: "demo_skills_Skill", title: "Skill", source: "json: SkillSchema", kind: "skills", attrs: [{ name: "inputs", type: "map<string>", mult: "0..1" }, { name: "steps", type: "Step[]", mult: "0..*" }] },
      { id: "demo_skills_Step", title: "Step", source: "json: SkillSchema", kind: "skills", attrs: [{ name: "a <b> & \"c\"", type: "", mult: "", remark: true }] },
    ],
    compositions: [{ from: "demo_skills_Skill", to: "demo_skills_Step", label: "steps", mult: "0..*" }],
    undetermined: [],
  },
  {
    instance: "demo",
    id: "beans",
    path: "demo/beans",
    kinds: ["bean-defs"],
    classes: [],
    compositions: [],
    undetermined: [{ kind: "bean-defs", reason: "no validator registered" }],
  },
];

describe("dot() draws the overview model", () => {
  const text = dot("demo", "https://example.test/uml/overview/demo.html", FIXTURE, true);

  test("a named sub-graph is a cluster, labelled as the .puml package is", () => {
    expect(text).toContain('subgraph "cluster_pkg_demo_skills" {');
    expect(text).toContain("<b>demo/skills</b>");
    expect(text).toContain('subgraph "cluster_pkg_demo_beans" {');
  });

  test("a class is filled with its family colour from uml.css, and carries its kind's class", () => {
    expect(PALETTE.kind("skills")).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    expect(text).toContain(`"demo_skills_Skill" [fillcolor="${PALETTE.kind("skills")}", class="fa_uml_kind_skills"`);
  });

  test("every hex in the DOT is a colour uml.css declares", () => {
    const declared = new Set([...Object.values(PALETTE.family)].map((h) => h.toLowerCase()));
    const used = [...text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((h) => !declared.has(h))).toEqual([]);
  });

  test("a composition has its diamond at the whole and its field as the label", () => {
    expect(text).toContain('"demo_skills_Skill" -> "demo_skills_Step" [dir=both, arrowtail=diamond, arrowhead=none, label="steps", headlabel="0..*"');
  });

  test("an undetermined kind is a dashed node saying why, never an empty box", () => {
    expect(text).toMatch(/"n_demo_beans_bean_defs" \[style="rounded,filled,dashed".*fa_uml_undetermined.*could not determine: no validator registered/);
  });

  test("a union type stays one row: no record shape splits the label at `|`", async () => {
    const gv = await Graphviz.load();
    const one = dot("demo/skills", "", [{ ...FIXTURE[0]!, classes: [{ ...FIXTURE[0]!.classes[0]!, attrs: [{ name: "v", type: "a | b | c", mult: "1" }] }], compositions: [] }], true);
    expect(gv.dot(one)).toContain("v [1] : a | b | c");
  });

  test("label text is escaped for an HTML-like label", () => {
    expect(text).toContain("a &lt;b&gt; &amp; &quot;c&quot;");
  });

  test("layout scaffolding is invisible and marked, so the viewer neither lists nor drags it", () => {
    const scaffold = text.split("\n").filter((l) => l.includes("grid_"));
    expect(scaffold.length).toBeGreaterThan(0);
    expect(scaffold.every((l) => l.includes("style=invis") && l.includes('class="kg-graph-anchor"'))).toBe(true);
  });

  test("one sub-graph needs no grid anchors", () => {
    expect(dot("demo/skills", "", [FIXTURE[0]!], true)).not.toContain("grid_");
  });

  test("it lays out with the pinned Graphviz", async () => {
    const gv = await Graphviz.load();
    const svg = gv.dot(gv.unflatten(text, 2, true, 2));
    expect(svg).toContain('class="node fa_uml_kind_skills"');
    expect(svg).toContain("<title>demo_skills_Skill&#45;&gt;demo_skills_Step</title>");
  });
});

describe("every committed DOT is the model its .puml draws", () => {
  const dots = walk(DOT_ROOT, ".dot");

  // Standing alone the DOTs are not built: `uml:overview` writes them at
  // publish and `docs/assets/img/uml/overview/` is gitignored (bean w1gy F18).
  test.skipIf(
    siteNotBuilt("the overview DOTs gen-uml-overview writes at publish (gitignored)", DOT_ROOT),
  )("there is a DOT for an overview", () => {
    expect(dots.length).toBeGreaterThan(0);
  });

  test("each DOT has its .puml, with every class, its colour, every package and every composition", () => {
    const problems: string[] = [];
    for (const d of dots) {
      const rel = relative(DOT_ROOT, d).replace(/\.dot$/, "");
      const pumlPath = join(UML_ROOT, `${rel}.puml`);
      if (!existsSync(pumlPath)) {
        problems.push(`${rel}: no .puml`);
        continue;
      }
      const puml = readFileSync(pumlPath, "utf8");
      const text = readFileSync(d, "utf8");
      for (const m of puml.matchAll(/^\s*class "[^"]*" as (\w+) <<[^>]*>> (#[0-9a-fA-F]{3,8})/gm)) {
        if (!text.includes(`"${m[1]}" [fillcolor="${m[2]}"`)) problems.push(`${rel}: class ${m[1]} missing, or not ${m[2]}`);
      }
      for (const m of puml.matchAll(/^package "[^"]*" as (\w+)/gm)) {
        if (!text.includes(`subgraph "cluster_${m[1]}"`)) problems.push(`${rel}: package ${m[1]} is no cluster`);
      }
      const comps = [...puml.matchAll(/^(\w+) \*-- "[^"]*" (\w+) : /gm)].length;
      const edges = [...text.matchAll(/class="fa_uml_composition"/g)].length;
      if (comps !== edges) problems.push(`${rel}: ${comps} composition(s) in the .puml, ${edges} in the DOT`);
    }
    expect(problems).toEqual([]);
  });

  test("each lays out with the pinned Graphviz", async () => {
    const gv = await Graphviz.load();
    const failed: string[] = [];
    for (const d of dots) {
      try {
        gv.dot(gv.unflatten(readFileSync(d, "utf8"), 2, true, 2));
      } catch (e) {
        failed.push(`${relative(DOT_ROOT, d)}: ${String(e).slice(0, 120)}`);
      }
    }
    expect(failed).toEqual([]);
  });
});
