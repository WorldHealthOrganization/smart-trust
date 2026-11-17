import { describe, expect, test } from "bun:test";

import { linkTerms, termAnchor, unlinkedTerms } from "./term-links";

const T = ["KnowledgeGraph", "Node", "NodeKind", "Role", "Process"].map((key) => ({ key, href: `d.md#${termAnchor(key)}` }));

describe("linkTerms", () => {
  test("linksEveryUseLongestFirst", () => {
    const r = linkTerms("A Node Kind names Nodes. Two Roles and a Process.", T);
    expect(r.text).toBe(
      "A [Node Kind](d.md#node-kind) names [Nodes](d.md#node). Two [Roles](d.md#role) and a [Process](d.md#process).",
    );
    expect(r.added).toBe(4);
  });

  test("skipsCodeHeadingsLinks", () => {
    const text = [
      "## A Role heading",
      "| Role | who |",
      "|---|---|",
      "| **Knowledge Graph Data Store** | a `Role` in code, and [Process](x.md) already linked |",
      "```",
      "Role inside a fence",
      "```",
    ].join("\n");
    expect(linkTerms(text, T)).toEqual({ text, added: 0 });
  });

  test("noTermsUnchanged", () => {
    expect(linkTerms("What to do.", [])).toEqual({ text: "What to do.", added: 0 });
  });

  test("unlinkedTermsForGuard", () => {
    expect(unlinkedTerms("a [Role](r.md) and a Process", T)).toEqual(["Process"]);
  });
});
