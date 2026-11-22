/**
 * The rendering exemption — declared, reasoned, substituted, and not spreading.
 *
 * Bean `hfkl`. The obligation every layer carries is a visualiser per
 * declared subgraph (`2krx`); bootstrap is excused it and owes its own
 * `.jsonld`/`.json` instead. Three things have to hold for that to be an
 * exemption rather than a silence list: it is DECLARED where the axis reads it,
 * it names what it owes INSTEAD, and a second claimant is a finding rather than
 * a quiet widening.
 *
 * The test of this file that reads the checker the QA axis runs — a file of
 * the tools layer above, not of this one — lives in that layer's
 * `schemas/render-exemption.test.ts` (bean `7zz1` follow-up, owner 2026-10-06:
 * a test reading an upper layer's files moves to that layer's declared test
 * home). Standing alone, cat-harness does not hold the checker.
 *
 * @module schemas/render-exemption.test
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { RENDER_OBLIGATIONS, isExemptFrom, readDeclaration, renderExemptionProblems, repoRootFor, type RenderExemption, layerRootsIn } from "./kg/cat-harness.js";
import { requireHarnessRoot } from "./harness-root.ts";
const ROOT = requireHarnessRoot();
const REPO = repoRootFor(ROOT);
const CAT_BOOTSTRAP = join(REPO, "bootstrap");

/** A well-formed exemption, so each malformation below differs in one field. */
const ok: RenderExemption = {
  of: ["visualiser"],
  reason: "it is the navbar footer",
  owes: "its own .jsonld",
};

describe("this repository's actual declaration", () => {
  test("bootstrap claims the exemption, and it is well-formed", () => {
    const d = readDeclaration(CAT_BOOTSTRAP);
    expect(d?.renderExemption).toBeDefined();
    expect(renderExemptionProblems([{ name: "bootstrap", renderExemption: d?.renderExemption }])).toEqual([]);
  });

  test("it excuses BOTH visualisers the owner named, and nothing else", () => {
    // "no visualiser" and "no workflow visualiser" were named separately and
    // fail differently — a subgraph nobody can look at, and a process nobody
    // can look at. Asserted as the whole set rather than as two `.toContain`
    // calls, so a third obligation quietly appearing here fails.
    const d = readDeclaration(CAT_BOOTSTRAP);
    expect([...(d?.renderExemption?.of ?? [])].sort()).toEqual(["visualiser", "workflow-visualiser"]);
  });

  test("EXACTLY one instance in this repository claims it", () => {
    // The spreading case, measured against the real tree rather than a
    // fixture. `renderExemptionProblems` allows at most one; this asserts the
    // count is 1 rather than 0, so the guard is not vacuously satisfied by a
    // repository that lost the declaration. Every instance is DISCOVERED, not
    // listed: a hand-written list once spelled `folio-assist-core`, so the
    // layer it meant was never read and a second claimant there would pass.
    const roots = layerRootsIn(REPO);
    expect(roots).toContain(CAT_BOOTSTRAP);
    const claiming = roots
      .map((r) => readDeclaration(r))
      .filter((d) => d?.renderExemption !== undefined);
    expect(claiming.length).toBe(1);
    expect(claiming[0]?.name).toBe("bootstrap");
  });

  test("what it OWES exists on disk — the two render skills it names", () => {
    // This is the test that stops `owes` being decorative. An exemption whose
    // substitute is a sentence nobody can follow is the hole the field exists
    // to close, and a path named in prose rots exactly like any other link.
    const owes = readDeclaration(CAT_BOOTSTRAP)?.renderExemption?.owes ?? "";
    const named = [...owes.matchAll(/`([^`]*bootstrap-graph-[a-z-]+\.md)`/g)].map((m) => m[1]!);
    expect(named.length).toBeGreaterThan(0); // not vacuous
    for (const rel of named) expect(existsSync(join(CAT_BOOTSTRAP, rel))).toBe(true);
  });

  test("the subgraph it owes is DECLARED, not merely present", () => {
    // A directory that exists and is undeclared is not this layer's graph,
    // however many files sit in it — bootstrap's own declaration says so.
    // So "the skills are on disk" is not the property; "the graph reaches
    // them" is.
    //
    // Asked of the FILES the exemption owes, not of an entry id. This looked
    // up `bootstrap-render` by id until bean `n350` moved the two skills into
    // `skills/` and removed that entry; an id-shaped assertion would have died
    // with the entry while the property it guards held. The property is:
    // every owed file sits in a directory bootstrap DECLARES as a skills graph.
    const dirs = readDeclaration(CAT_BOOTSTRAP)?.directories ?? [];
    const owes = readDeclaration(CAT_BOOTSTRAP)?.renderExemption?.owes ?? "";
    const named = [...owes.matchAll(/`([^`]*bootstrap-graph-[a-z-]+\.md)`/g)].map((m) => m[1]!);
    expect(named.length).toBeGreaterThan(0); // not vacuous
    for (const rel of named) {
      const home = dirs.find((d) => rel.startsWith(d.path));
      expect(home, `${rel} is in no directory bootstrap declares`).toBeDefined();
      expect(home?.graphTypologies).toContain("skills");
    }
  });
});

describe("a claim that is not well-formed is refused", () => {
  test("no reason", () => {
    expect(renderExemptionProblems([{ name: "x", renderExemption: { ...ok, reason: "" } }])).toHaveLength(1);
  });

  test("no substitute — the hole this field exists to close", () => {
    expect(renderExemptionProblems([{ name: "x", renderExemption: { ...ok, owes: "" } }])).toHaveLength(1);
  });

  test("excused from nothing", () => {
    // `of: []` reads as an exemption and excuses nothing, which is a
    // declaration that means the opposite of what it looks like.
    expect(renderExemptionProblems([{ name: "x", renderExemption: { ...ok, of: [] } }])).toHaveLength(1);
  });

  test("an obligation nobody has defined", () => {
    const bogus = { ...ok, of: ["prettiness"] } as unknown as RenderExemption;
    expect(renderExemptionProblems([{ name: "x", renderExemption: bogus }])).toHaveLength(1);
  });

  test("and a well-formed one is NOT refused", () => {
    // The other direction: every assertion above passes equally for a
    // function that refuses everything.
    expect(renderExemptionProblems([{ name: "x", renderExemption: ok }])).toEqual([]);
  });
});

describe("the exemption does not spread", () => {
  test("two claimants is a finding, and it names them", () => {
    const problems = renderExemptionProblems([
      { name: "bootstrap", renderExemption: ok },
      { name: "cat-harness", renderExemption: ok },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("bootstrap");
    expect(problems[0]).toContain("cat-harness");
  });

  test("none is fine — at most one, not exactly one", () => {
    // A repository that vendors no bootstrap has nothing to exempt.
    // Failing it would be asking it to declare something to stay green, which
    // is how a declaration stops meaning anything.
    expect(renderExemptionProblems([{ name: "some-folio" }])).toEqual([]);
  });
});

describe("isExemptFrom is what the QA axis calls", () => {
  test("true for a listed obligation, false for an unlisted one", () => {
    const d = { renderExemption: { ...ok, of: ["visualiser" as const] } };
    expect(isExemptFrom(d, "visualiser")).toBe(true);
    expect(isExemptFrom(d, "workflow-visualiser")).toBe(false);
  });

  test("false for an instance that declares no exemption", () => {
    // The normal case, and the one the axis meets most often. Every other
    // layer in this repository takes this branch.
    expect(isExemptFrom({}, "visualiser")).toBe(false);
  });

});

describe("the obligations are a closed set", () => {
  test("all three are named, and adding one is a deliberate edit", () => {
    // `own-docs` added 2026-09-21 for bean `op30`, DELIBERATELY — which is
    // what this test exists to force. It reuses this mechanism rather than
    // minting a second opt-out because the requirement is identical: an
    // exemption needs a reason, and a reason with no substitute is a hole,
    // which `owes` already refuses.
    expect([...RENDER_OBLIGATIONS].sort()).toEqual([
      "own-docs",
      "visualiser",
      "workflow-visualiser",
    ]);
  });
});
