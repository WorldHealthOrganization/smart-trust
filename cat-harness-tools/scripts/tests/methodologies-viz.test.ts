/**
 * The methodologies viewer — the join, the three states, and the page a reader
 * actually gets.
 *
 * Bean `yunp`: `methodology` was one of seven declared graph typologies with no
 * published viewer, so the navbar listed it disabled and nine typed nodes
 * reached nobody.
 *
 * ## What is asserted here, and what deliberately is not
 *
 * **Not the prose.** A test that pinned the page's sentences would fail every
 * time somebody improved one, which is how a generated-artefact test becomes
 * something people delete.
 *
 * **The join, over a fixture.** Which node lands in which of the three
 * evidence states is the one piece of logic in the generator, and it is keyed
 * by node PATH rather than by name — two layers may adopt methods with
 * names one letter apart (`raci`, `rasci` already do), and a name-keyed join
 * would attribute one layer's evidence to another's node without saying so.
 *
 * **The consumer property, over the real corpus.** `check:artefact-verification`
 * asks what verifies a generated artefact FOR ITS CONSUMER, as against merely
 * verifying that the committed copy is current — the distinction that let
 * `library:viz:check` stay green while the page it generated could not run
 * (PR #805). Here the consumer property is that every row's link resolves to an
 * anchor on the same page, and that no cell breaks the table it sits in. Both
 * are `pb04` one layer down: a link that goes nowhere reads as a broken site.
 *
 * @module scripts/tests/methodologies-viz.test
 *
 * The tests of this file that read the whole checkout (reads the methodology
 * graphs of the content layers, smart-base's among them) live in
 * `test/methodologies-viz-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";

import {
  evidenceLine,
  instanceOf,
  linkProse,
  methodologyRows,
  page,
  nodePage,
  nodePageRel,
  bodyOf,
} from "../gen-methodologies-viz.js";
import {
  type EvidenceReport,
  type MethodologyNode,
} from "../check-methodology-evidence.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const INSTANCE = resolve(HARNESS_ROOT);
const REPO = resolve(INSTANCE, "..");

/** A valid node, with only the fields the row cares about varied. */
function node(path: string, name: string, evidence?: string[]): MethodologyNode {
  return {
    node: path,
    state: "ok",
    front: {
      $schema: "folio-methodology/v1",
      name,
      title: `${name.toUpperCase()} — a method`,
      origin: "Somebody, somewhere (1999)",
      "applies-when": "When the question is what this method answers.",
      ...(evidence ? { evidence } : {}),
    },
  };
}

function report(over: Partial<EvidenceReport> = {}): EvidenceReport {
  return {
    undetermined: false,
    nodes: 0,
    invalid: [],
    unresolved: [],
    noEvidence: [],
    untagged: [],
    resolved: [],
    ...over,
  };
}

describe("the three evidence states are three, and stay apart", () => {
  const nodes = [
    node("methodologies/held.md", "held", ["library/a-source"]),
    node("methodologies/cited.md", "cited"),
    node("methodologies/broken.md", "broken", ["library/no-such-slug"]),
  ];
  const r = report({
    nodes: 3,
    noEvidence: [{ node: "methodologies/cited.md", name: "cited", detail: "…" }],
    unresolved: [{ node: "methodologies/broken.md", name: "broken", detail: "…" }],
  });
  const rows = methodologyRows(nodes, r, INSTANCE, REPO);
  const state = (name: string): string => rows.find((x) => x.name === name)!.state;

  it("a citation that resolves is `ingested`", () => {
    expect(state("held")).toBe("ingested");
  });

  it("an origin with no `evidence:` is `cited-only` — an open question, not a defect", () => {
    expect(state("cited")).toBe("cited-only");
  });

  it("an `evidence:` naming nothing is `dangling`, NOT the same as having none", () => {
    // Strictly worse than declaring none: it reads as an ingested source in
    // every listing, so a reader who does not open it is told the citation
    // resolves. `dh4f` — collapsing the two puts the more reassuring answer on
    // the record for the broken one.
    expect(state("broken")).toBe("dangling");
    expect(state("broken")).not.toBe(state("cited"));
  });

  it("all three are distinguishable ON THE PAGE, in words and not only in colour", () => {
    const html = page(rows, r);
    for (const words of ["source held", "cited, not ingested", "citation does not resolve"]) {
      expect(html).toContain(words);
    }
  });
});

describe("the join is keyed by node path, not by name", () => {
  it("two instances adopting the same name do not share a verdict", () => {
    // The failure this pins: a name-keyed join makes one layer's missing
    // source into the other's, silently, and the page then says a method rests
    // on a document that was never ingested for it.
    const nodes = [
      node("methodologies/swot.md", "swot", ["library/held"]),
      node("../smart-base/methodologies/swot.md", "swot"),
    ];
    const rows = methodologyRows(
      nodes,
      report({ noEvidence: [{ node: "../smart-base/methodologies/swot.md", name: "swot", detail: "…" }] }),
      INSTANCE,
      REPO,
    );
    expect(rows.map((x) => [x.instance, x.state])).toEqual([
      ["cat-harness", "ingested"],
      ["smart-base", "cited-only"],
    ]);
  });

  it("a node that does not validate is not a row — it is a finding", () => {
    const rows = methodologyRows(
      [{ node: "methodologies/broken.md", state: "invalid", detail: "origin: Required" }],
      report(),
      INSTANCE,
      REPO,
    );
    expect(rows).toEqual([]);
  });

  it("an untagged file is not a row either — a README in the directory is correct", () => {
    const rows = methodologyRows(
      [{ node: "methodologies/README.md", state: "untagged", detail: "carries no $schema" }],
      report(),
      INSTANCE,
      REPO,
    );
    expect(rows).toEqual([]);
  });
});

describe("which instance declared it — `instanceOf`", () => {
  it("this instance's own node names this instance", () => {
    expect(instanceOf("methodologies/swot.md", INSTANCE, REPO)).toBe("cat-harness");
  });

  it("a SIBLING's node names the sibling, not `..`", () => {
    // What the first rendering of this page actually printed for two of its
    // nine rows, because it split the path instead of resolving it. Caught by
    // reading the page, so it is pinned here rather than trusted to review.
    expect(instanceOf("../smart-base/methodologies/diig.md", INSTANCE, REPO)).toBe("smart-base");
    expect(instanceOf("../folio-assistant-core/methodologies/doc-researcher.md", INSTANCE, REPO)).toBe("folio-assistant-core");
  });
});

/**
 * Bean `qgjh`: an ingested source links to the viewer, the item page and the
 * source where each resolves, and anything unplaceable stays code.
 */
describe("ingested sources link what resolves (qgjh)", () => {
  const links = {
    links: (id: string) =>
      id === "known-item"
        ? { viewer: "cat-harness/library/cat-harness/#known-item", readme: "https://host/README.md", source: "https://arxiv.org/abs/1" }
        : undefined,
  };

  it("links a known library item, relative to the page it sits on", () => {
    const line = evidenceLine("library/known-item", links, "methodologies/index.md");
    expect(line).toBe(
      "- [`library/known-item`](../cat-harness/library/cat-harness/#known-item) · [item page](https://host/README.md) · [source](https://arxiv.org/abs/1)",
    );
  });

  it("links the entry's own page as [view] when it has one (owner, 2026-10-16)", () => {
    const withEntry = { links: () => ({ viewer: "cat-harness/library/cat-harness/#k", entry: "cat-harness/library/cat-harness/k/" }) };
    expect(evidenceLine("library/k", withEntry, "methodologies/index.md")).toBe(
      "- [`library/k`](../cat-harness/library/cat-harness/#k) · [view](../cat-harness/library/cat-harness/k/)",
    );
  });

  const row = { name: "m", title: "M", origin: "o", appliesWhen: "a", instance: "cat-harness", evidence: [], state: "cited-only" as const, path: "cat-harness/methodologies/m.md" };
  const report = { undetermined: false, nodes: 1, invalid: [], unresolved: [], noEvidence: [], untagged: [], resolved: [] };

  it("links each node's extracted method, the body the page does not draw (owner, 2026-10-16)", () => {
    const md = page([row], report, undefined, "", (p) => `https://github.com/o/r/blob/main/${p}`);
    expect(md).toContain("**The method, as extracted:** [read it](cat-harness/m/)");
    expect(page([row], report)).not.toContain("The method, as extracted");
  });

  it("gives each node its own page at <route>/<instance>/<name>/, the library's pattern", () => {
    expect(nodePageRel("en/cat-harness/methodologies/index.md", row)).toBe("en/cat-harness/methodologies/cat-harness/m/index.md");
    const text = "---\n$schema: folio-methodology/v1\nname: m\n---\n\n# M\n\nSee [the skill](../skills/s.md#how) and [W3C](https://w3.org/x) and [below](#here).\n";
    const body = bodyOf(text);
    expect(body.startsWith("# M")).toBe(true);
    const md = nodePage(row, body, undefined, "en/cat-harness/methodologies/cat-harness/m/index.md", (p) => `https://github.com/o/r/blob/main/${p}`);
    expect(md).toContain('title: "M"');
    expect(md).toContain("**Node file:** [m.md](https://github.com/o/r/blob/main/cat-harness/methodologies/m.md)");
    expect(md).toContain("[the skill](https://github.com/o/r/blob/main/cat-harness/skills/s.md#how)");
    expect(md).toContain("[W3C](https://w3.org/x)");
    expect(md).toContain("[below](#here)");
    expect(md).toContain("[&larr; All methodologies](../../)");
  });

  it("lists the skills whose uses-methodology names it (owner, 2026-10-16)", () => {
    const md = nodePage(row, "# M\n", undefined, "", undefined, [{ skill: "s1", href: "https://h/s1.md" }, { skill: "s2" }]);
    expect(md).toContain("**Applied by skills:**\n\n- [`s1`](https://h/s1.md)\n- `s2`");
    expect(nodePage(row, "# M\n")).not.toContain("Applied by skills");
  });

  it("leaves an unknown item, or no resolver, as code", () => {
    expect(evidenceLine("library/unknown", links, "methodologies/index.md")).toBe("- `library/unknown`");
    expect(evidenceLine("library/known-item")).toBe("- `library/known-item`");
  });
});

describe("code spans in prose that name a methodology or library item are links (owner, 2026-11-10)", () => {
  const names = new Set(["grade", "madr"]);
  const links = {
    links: (id: string, instance?: string) =>
      id === "9789240010567-eng" && (instance === undefined || instance === "who-iris")
        ? { viewer: "en/cat-harness/library/who-iris/#who-iris%2F9789240010567-eng" }
        : undefined,
  };

  it("links a methodology on this site to its section, and leaves others as code", () => {
    expect(linkProse("that is `grade`, not `kepner-tregoe`", names)).toBe("that is [`grade`](#grade), not `kepner-tregoe`");
    expect(linkProse("(`madr`)", names, "../../")).toBe("([`madr`](../../#madr))");
  });

  it("links a <layer>/library/<slug>/ reference to the library viewer, relative to the page", () => {
    expect(linkProse("Ingested at `who-iris/library/9789240010567-eng/`;", names, "", links, "en/cat-harness/methodologies/index.md")).toBe(
      "Ingested at [`who-iris/library/9789240010567-eng/`](../library/who-iris/#who-iris%2F9789240010567-eng);",
    );
    expect(linkProse("`library/unknown`", names, "", links)).toBe("`library/unknown`");
  });

  it("does not re-link a span that is already link text", () => {
    expect(linkProse("[`grade`](x)", names)).toBe("[`grade`](x)");
  });

  it("is applied on the list page and on a node page", () => {
    const r = { name: "diig", title: "DIIG", origin: "o", appliesWhen: "not `grade`", instance: "smart-base", evidence: [], state: "cited-only" as const };
    const g = { ...r, name: "grade", title: "GRADE", appliesWhen: "a" };
    const report = { undetermined: false, nodes: 2, invalid: [], unresolved: [], noEvidence: [], untagged: [], resolved: [] };
    expect(page([r, g], report)).toContain("**Applies when.** not [`grade`](#grade)");
    expect(nodePage(r, "# D\n", undefined, "", undefined, [], names)).toContain("**Applies when.** not [`grade`](../../#grade)");
  });
});
