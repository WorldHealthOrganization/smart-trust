/**
 * check:derived-from, seen failing on planted violations (bean nama, step 2):
 * an edge between derived graphs is only checkable if a wrong one is refused.
 */
import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { analyse, downstreamOf, type Inst, judge, ratchet, readTree, renderingOrder } from "../check-derived-from.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

const dir = (id: string, index: number, derivedFrom?: string[], derived = true) => ({
  id,
  index,
  derived,
  ...(derivedFrom ? { derivedFrom } : {}),
});

// base ← mid ← top, and a sibling `side` that top does not need.
const world = (topDirs: Inst["dirs"]): Inst[] => [
  { name: "base", ancestors: [], dirs: [dir("chrome", 0, undefined, false), dir("lib", 1, undefined, false)] },
  { name: "mid", ancestors: ["base"], dirs: [dir("lib", 0, undefined, false), dir("index", 1, ["lib"])] },
  { name: "side", ancestors: [], dirs: [dir("styling", 0, undefined, false)] },
  { name: "top", ancestors: ["mid", "base"], dirs: topDirs },
];

describe("resolution", () => {
  it("an id resolves to the NEAREST declaring instance, and the edge says which", () => {
    const j = judge(world([dir("pages", 0, ["lib", "chrome"])]));
    expect(j.findings).toEqual([]);
    expect(j.edges).toContainEqual({ from: "top/pages", to: "mid/lib" });
    expect(j.edges).toContainEqual({ from: "top/pages", to: "base/chrome" });
  });
  it("an id declared nowhere is refused", () => {
    const j = judge(world([dir("pages", 0, ["nothing"])]));
    expect(j.findings).toEqual([{ kind: "unknown-id", instance: "top", directory: "pages", target: "nothing" }]);
  });
  it("an id only a non-needed instance declares is a LAYERING GAP, not an unknown id", () => {
    const j = judge(world([dir("pages", 0, ["styling"])]));
    expect(j.findings).toEqual([
      { kind: "layering-gap", instance: "top", directory: "pages", target: "styling", declaredBy: ["side"] },
    ]);
  });
});

describe("the interim order: declaration order is rendering order", () => {
  it("a consumer declared before its same-instance source is refused", () => {
    const j = judge(world([dir("pages", 0, ["ast"]), dir("ast", 1, undefined)]));
    expect(j.findings.map((f) => f.kind)).toEqual(["order"]);
  });
  it("the same pair in source-first order passes", () => {
    expect(judge(world([dir("ast", 0, undefined), dir("pages", 1, ["ast"])])).findings).toEqual([]);
  });
});

describe("cycles", () => {
  it("a two-node cycle is refused once", () => {
    const j = judge(world([dir("a", 0, ["b"]), dir("b", 1, ["a"])]));
    expect(j.findings.filter((f) => f.kind === "cycle")).toHaveLength(1);
  });
  it("a self-edge is a cycle", () => {
    const j = judge(world([dir("a", 0, ["a"])]));
    expect(j.findings.some((f) => f.kind === "cycle")).toBe(true);
  });
});

describe("the ratchet over layering gaps", () => {
  const gap = judge(world([dir("pages", 0, ["styling"])])).findings;
  const entry = { instance: "top", directory: "pages", target: "styling", reason: "planted", bean: "nama" };
  it("an unbaselined gap regresses", () => {
    expect(ratchet(gap, []).regressions).toHaveLength(1);
  });
  it("a baselined gap passes", () => {
    expect(ratchet(gap, [entry])).toEqual({ regressions: [], stale: [] });
  });
  it("a baseline entry that is no longer a gap is stale", () => {
    expect(ratchet([], [entry]).stale).toEqual([entry]);
  });
});

describe("advisory", () => {
  it("a derived directory naming no derivedFrom is counted, not refused", () => {
    const j = judge(world([dir("pages", 0, undefined)]));
    expect(j.findings).toEqual([]);
    expect(j.undeclared).toContain("top/pages");
  });
});

describe("this checkout", () => {
  it("reads every instance and finds nothing hard", () => {
    const j = analyse();
    expect(j.findings.filter((f) => f.kind !== "layering-gap")).toEqual([]);
  });
  it("resolves scope: 'repository' directories against the checkout root, not the declaring instance", () => {
    const ch = readTree().find((i) => i.name === "cat-harness");
    expect(ch).toBeDefined();
    expect(ch!.dirs.find((d) => d.id === "beans")?.path).toBe("beans/");
    expect(ch!.dirs.find((d) => d.id === "todos")?.path).toBe("todos/");
    expect(ch!.dirs.find((d) => d.id === "health")?.path).toBe("test/health/results/");
  });
});

describe("the rendering order, derived from the edges", () => {
  it("puts a source before its consumer even when the consumer is declared first", () => {
    // The interim rule would refuse this world; the derived order still answers.
    const w = world([dir("pages", 0, ["ast"]), dir("ast", 1, undefined)]);
    const order = renderingOrder(w, judge(w).edges);
    expect(order.indexOf("top/ast")).toBeLessThan(order.indexOf("top/pages"));
  });
  it("agrees with the interim order when the gate passes", () => {
    const w = world([dir("ast", 0, undefined), dir("pages", 1, ["ast", "chrome"])]);
    const interim = w.flatMap((i) => i.dirs.map((d) => `${i.name}/${d.id}`));
    expect(renderingOrder(w, judge(w).edges)).toEqual(interim);
  });
  it("leaves a cycle's members out", () => {
    const w = world([dir("a", 0, ["b"]), dir("b", 1, ["a"])]);
    const order = renderingOrder(w, judge(w).edges);
    expect(order).not.toContain("top/a");
    expect(order).not.toContain("top/b");
  });
});

describe("downstream of a change", () => {
  const w = world([dir("ast", 0, ["lib"]), dir("pages", 1, ["ast"]), dir("other", 2, undefined)]);
  const { edges } = judge(w);
  const order = renderingOrder(w, edges);
  it("is transitive and in rendering order", () => {
    expect(downstreamOf(["mid/lib"], order, edges)).toEqual(["mid/lib", "mid/index", "top/ast", "top/pages"]);
  });
  it("carries nothing a change cannot reach", () => {
    expect(downstreamOf(["top/pages"], order, edges)).toEqual(["top/pages"]);
  });
});

/** The real-tree cases need the IG layers; standing alone they are skipped, named as skipped. */
// smart-immunizations is mounted but declares no directories since the owner's
// B1 ruling (2026-10-15, `directories: []`), so it has no IG pages to carry.
const HAS_IGS = ["fhir-harness", "smart-base", "smart-trust"].every((i) =>
  existsSync(join(resolve(dirname(HARNESS_ROOT)), i)),
);

describe.skipIf(!HAS_IGS)("this checkout's IG pages", () => {
  it("re-render when smart-base's chrome changes", () => {
    const tree = readTree();
    const { edges } = judge(tree);
    const down = downstreamOf(["smart-base/smart-base-themes"], renderingOrder(tree, edges), edges);
    for (const ig of ["smart-base", "smart-trust"]) expect(down).toContain(`${ig}/${ig}-docs`);
  });
});

describe("writer", () => {
  it("a writer path that does not exist is refused", () => {
    const w = world([{ ...dir("pages", 0, undefined), writer: ["gen/missing.ts"] }]);
    expect(judge(w, () => false).findings).toEqual([
      { kind: "missing-writer", instance: "top", directory: "pages", writer: "gen/missing.ts" },
    ]);
  });
  it.skipIf(!HAS_IGS)("this checkout's IG page sets name gen-ig-pages as their writer", () => {
    const tree = readTree();
    const pages = tree.flatMap((i) => i.dirs.filter((d) => d.id === `${i.name}-docs` && d.writer).map((d) => ({ ig: i.name, writer: d.writer })));
    // Every IG this checkout mounts (smart-trust-phw joined smart-base and
    // smart-trust), so the count is not fixed; the two named ones must be there.
    for (const ig of ["smart-base", "smart-trust"]) expect(pages.map((p) => p.ig)).toContain(ig);
    for (const p of pages) expect(p.writer).toContain("fhir-harness/scripts/gen-ig-pages.ts");
  });
});

// Bean 0b8c (#2230): a derived artefact cannot be current in a commit when an
// input upstream of it is kept on a branch, because that input moves without one.
describe("the storage clock", () => {
  // `guts` is kept on a branch; `report` is a checkout directory derived from it.
  const clock = (extra: Partial<Inst["dirs"][number]> = {}, reportExtra: Partial<Inst["dirs"][number]> = {}): Inst[] =>
    world([
      { ...dir("guts", 0, undefined, false), path: "guts/", onBranch: true, ...extra },
      { ...dir("report", 1, ["guts"]), path: "report/", ...reportExtra },
    ]);
  const viewer = (writer?: string[]) => ({ visualisers: [{ ref: "docs/guts/index.md", ...(writer ? { writer } : {}) }] });

  it("a COMMITTED viewer of a branch-kept graph is refused, naming the chain", () => {
    const j = judge(clock(viewer(["gen/guts.ts"])), () => true, (p) => p === "docs/guts/index.md");
    expect(j.findings).toEqual([
      { kind: "committed-from-branch", instance: "top", directory: "guts", artefact: "docs/guts/index.md", via: ["top/guts"] },
    ]);
  });

  it("an untracked viewer with a writer is built at publish, and is not a finding", () => {
    const j = judge(clock(viewer(["gen/guts.ts"])), () => true, () => false);
    expect(j.findings).toEqual([]);
    expect(j.publish).toEqual([{ node: "top/guts", artefact: "docs/guts/index.md", writer: ["gen/guts.ts"], via: ["top/guts"] }]);
  });

  it("an untracked viewer with NO writer is refused: nothing would build it", () => {
    const j = judge(clock(viewer()), () => true, () => false);
    expect(j.findings.map((f) => f.kind)).toEqual(["publish-without-writer"]);
  });

  it("the clock is TRANSITIVE: a committed directory derived from a branch-kept one is refused", () => {
    const j = judge(clock({}, { writer: ["gen/report.ts"] }), () => true, (p) => p === "report/");
    expect(j.findings).toEqual([
      { kind: "committed-from-branch", instance: "top", directory: "report", artefact: "report/", via: ["top/report", "top/guts"] },
    ]);
  });

  it("and a viewer of THAT directory is publish-time too, through the edge", () => {
    const j = judge(clock({}, { ...viewer(["gen/r.ts"]) }), () => true, () => false);
    expect(j.publish.map((a) => [a.artefact, a.via])).toContainEqual(["docs/guts/index.md", ["top/report", "top/guts"]]);
  });

  it("nothing kept on a branch means nothing is publish-time, and a committed viewer is fine", () => {
    const j = judge(clock({ onBranch: false, ...viewer(["gen/guts.ts"]) }), () => true, () => true);
    expect(j.findings).toEqual([]);
    expect(j.publish).toEqual([]);
  });

  // The fsh-guts declaration lives in the ROOT layer, which a standalone
  // cat-harness extract does not carry.
  it.skipIf(!existsSync(join(resolve(dirname(HARNESS_ROOT)), "folio-assistant.json")))("this checkout: the fsh-guts viewer is built at publish and nothing committed derives from a branch", () => {
    const j = analyse();
    expect(j.findings.filter((f) => f.kind === "committed-from-branch" || f.kind === "publish-without-writer")).toEqual([]);
    expect(j.publish.map((a) => a.artefact)).toContain("cat-harness/docs/fsh-guts/index.md");
  });
});
