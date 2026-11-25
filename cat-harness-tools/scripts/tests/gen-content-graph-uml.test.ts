import { describe, expect, test } from "bun:test";

import { ContentGraph } from "../../pipeline/content-graph";
import { buildFiles, contentGraphPuml, formalLegend, modelOf, statusOf, type BlockModel } from "../gen-content-graph-uml";
import { landscapeOf } from "../plantuml-render";

/**
 * The block-graph drawing applies the `graph-rendering` rules to a paper. No
 * folio is attached to the platform, so the graph is built by hand: two
 * chapters, an editorial chain, one formal edge and one cross-chapter edge.
 * Asserted against the rules, not against a snapshot of the text.
 */
function paper(): { g: ContentGraph; root: string } {
  const root = "/folio/paper";
  const g = new ContentGraph();
  const node = (label: string, kind: string, chapter: string, leanRef?: string) =>
    g.nodes.set(label, { label, kind, ts: `${root}/${chapter}/${label.replace(":", "-")}.ts`, leanRef, uses: [] });
  node("def:space", "definition", "ch01", "Qou:Space");
  node("thm:main", "theorem", "ch01", "Qou:main");
  node("rem:why", "remark", "ch01");
  node("cor:use", "corollary", "ch02", "Qou:use");
  g.addEdge({ from: "thm:main", to: "def:space", kind: "editorial", editorialField: "uses" });
  g.addEdge({ from: "rem:why", to: "thm:main", kind: "editorial", editorialField: "interprets" });
  g.addEdge({ from: "thm:main", to: "def:space", kind: "formal", formalKind: "type" });
  g.addEdge({ from: "cor:use", to: "thm:main", kind: "editorial", editorialField: "uses" });
  return { g, root };
}

const FILL = { proved: "#eaf3de", reviewed_human: "#d9eed9" };

describe("gen-content-graph-uml", () => {
  test("chapters are the groups (rule 2)", () => {
    const { g, root } = paper();
    const m = modelOf(g, root);
    expect([...new Set(m.nodes.map((n) => n.group))]).toEqual(["ch01", "ch02"]);
  });

  test("editorial and formal edges are drawn apart, never merged (rule 4)", () => {
    const { g, root } = paper();
    const text = contentGraphPuml(modelOf(g, root), { name: "t", title: "t", statusFill: FILL });
    // The same pair carries both relations, so two lines, two styles.
    expect(text).toContain("b_thm_main --> b_def_space : uses");
    expect(text).toContain("b_thm_main -[#6a3d9a,dashed]-> b_def_space : type");
    expect(text).toContain("b_rem_why --> b_thm_main : interprets");
  });

  test("no block is drawn as an empty box (rule 3)", () => {
    const { g, root } = paper();
    const text = contentGraphPuml(modelOf(g, root), { name: "t", title: "t", statusFill: FILL });
    expect(text).not.toMatch(/\{\n\s*\}/);
    expect(text).toContain("//prose only: no lean.ref//");
  });

  test("a chapter diagram draws other chapters' blocks as stubs, not in full", () => {
    const { g, root } = paper();
    const files = buildFiles(modelOf(g, root), "/out", FILL);
    const ch02 = files.get("/out/content-graph/ch02.puml")!;
    expect(ch02).toContain('class "cor:use" as b_cor_use <<corollary>>');
    expect(ch02).toContain("<<in ch01>>");
    // ch01's internal edge is not ch02's business.
    expect(ch02).not.toContain("b_thm_main --> b_def_space");
  });

  test("status fills the box; a human review outranks the Lean status", () => {
    expect(statusOf({ label: "x", formalization_status: "proved", reviews: [{ reviewer_type: "human" }] } as never)).toBe("reviewed_human");
    expect(statusOf({ label: "x", formalization_status: "proved" } as never)).toBe("proved");
    const { g, root } = paper();
    const m: BlockModel = modelOf(g, root, new Map([["thm:main", "proved" as const]]));
    const text = contentGraphPuml(m, { name: "t", title: "t", statusFill: FILL });
    expect(text).toContain('class "thm:main" as b_thm_main <<theorem>> #eaf3de {');
    expect(text).toContain("status : proved");
  });

  test("the landscape view is derived, left to right (rule 6)", () => {
    const { g, root } = paper();
    const text = contentGraphPuml(modelOf(g, root), { name: "t", title: "t", statusFill: FILL });
    const land = landscapeOf(text);
    expect(land).toContain("left to right direction");
    expect(land).not.toContain("!pragma layout elk");
  });

  test("the legend says where the formal edges came from, in three states (#1492)", () => {
    const { g, root } = paper();
    const legend = (source?: string) => {
      g.hasFormal = source !== undefined;
      g.formalSource = source as never;
      return contentGraphPuml(modelOf(g, root), { name: "t", title: "t", statusFill: FILL });
    };
    expect(legend(undefined)).toContain("UNAVAILABLE here (no formal cache)");
    expect(legend("elaborated")).toContain("source elaborated (elaborated)");
    expect(legend("atlas")).toContain("source atlas (elaborated)");
    expect(legend("scan")).toContain("source scan: APPROXIMATE");
    expect(legend("mixed")).toContain("source mixed: APPROXIMATE");
    expect(formalLegend("scan")).not.toContain("(elaborated)");
  });
});
