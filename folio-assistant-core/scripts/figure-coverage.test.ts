/**
 * figure-coverage: every declared figure has a block, and how computable it is.
 */
import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { coverage, exitCodeFor, figureNumbers, readBlocks, type FigureBlock } from "./figure-coverage";

const SCRIPT = resolve(import.meta.dir, "figure-coverage.ts");

const declared = (...n: string[]) => new Map(n.map((x) => [x, `caption ${x}`] as [string, string | null]));
const block = (over: Partial<FigureBlock>): FigureBlock => ({
  file: "ch/f.jsonld", kind: "figure", figures: ["1"], method: "l1-vector-figure", linkedViews: 0, ...over,
});

describe("figureNumbers", () => {
  it("figureNumbersRead", () => {
    expect(figureNumbers("Fig. 26. Ethiopia current; Fig. 27. Ethiopia future")).toEqual(["26", "27"]);
    expect(figureNumbers("![Fig 1. Partners](media/vfig-p011.png)")).toEqual(["1"]);
    expect(figureNumbers("Figure 2.13. m4RH")).toEqual(["2.13"]);
    expect(figureNumbers("Fight stock-outs")).toEqual([]);
  });
});

describe("coverage states", () => {
  it("missingFigureFails", () => {
    const r = coverage(declared("1", "2"), [block({ figures: ["1"] })]);
    expect(r.figures.map((f) => f.state)).toEqual(["picture", "missing"]);
    expect(exitCodeFor(r)).toBe(1);
  });

  it("signedExclusionExcluded", () => {
    const signed = coverage(declared("12"), [], [{ figure: "12", scope: "block", reason: "third-party", signedOffBy: "owner" }]);
    expect(signed.figures[0]!.state).toBe("excluded");
    expect(exitCodeFor(signed)).toBe(0);
    const proposed = coverage(declared("12"), [], [{ figure: "12", scope: "block", reason: "third-party" }]);
    expect(proposed.figures[0]!.state).toBe("missing");
  });

  it("statesOrdered", () => {
    const r = coverage(declared("1", "2", "3", "4", "5"), [
      block({ figures: ["1"] }),
      block({ figures: ["2"], linkedViews: 1 }),
      block({ figures: ["3"], method: "archimate-view" }),
      block({ figures: ["4"] }),
      block({ figures: ["4"], kind: "table", method: null }),
      block({ figures: ["5"] }),
    ], [{ figure: "5", scope: "rebuild", reason: "country example", signedOffBy: "owner" }]);
    expect(r.figures.map((f) => f.state)).toEqual(["picture", "linked", "computable", "computable", "cited"]);
    expect(exitCodeFor(r)).toBe(0);
    expect(exitCodeFor(r, true)).toBe(1);
  });

  it("reproducesIsLinked", () => {
    const r = coverage(declared("1", "2"), [
      block({ figures: ["1"], reproduces: true }),
      block({ figures: ["2"], reproduces: false }),
    ]);
    expect(r.figures.map((f) => f.state)).toEqual(["linked", "picture"]);
  });

  it("reportsUndeclaredAndBadExclusion", () => {
    const r = coverage(declared("1"), [block({ figures: ["1", "9"] })], [{ figure: "1", scope: "other", reason: "x" }]);
    expect(r.undeclared).toEqual([{ file: "ch/f.jsonld", figure: "9" }]);
    expect(r.problems).toHaveLength(1);
    expect(exitCodeFor(r)).toBe(1);
  });
});

describe("end to end", () => {
  it("endToEndReadsEntryAndFolio", () => {
    const dir = mkdtempSync(join(tmpdir(), "figcov-"));
    const sections = join(dir, "entry", "sections");
    const folio = join(dir, "folio", "doc", "ch01");
    mkdirSync(sections, { recursive: true });
    mkdirSync(folio, { recursive: true });
    writeFileSync(join(sections, "page-011.md"), "Fig 1. Partners and processes\n");
    writeFileSync(join(sections, "page-012.md"), "Fig 2. Information flow\n");
    writeFileSync(join(folio, "f-ch01-fig-1.jsonld"), JSON.stringify({ kind: "figure", meta: { source: { method: "l1-vector-figure" } } }));
    writeFileSync(join(folio, "f-ch01-fig-1.md"), "![Fig. 1. Partners and processes](media/vfig-p011.png)\n");
    writeFileSync(join(folio, "p-ch01-page-012.jsonld"), JSON.stringify({ kind: "prose" }));
    writeFileSync(join(folio, "p-ch01-page-012.md"), "As Fig. 2 shows ...\n");
    expect(readBlocks(join(dir, "folio", "doc")).map((b) => b.figures)).toEqual([["1"]]);
    const run = spawnSync("bun", ["run", SCRIPT, "--entry", join(dir, "entry"), "--folio", join(dir, "folio", "doc")], { encoding: "utf8" });
    expect(run.status).toBe(1);
    const report = JSON.parse(run.stdout);
    expect(report.counts).toMatchObject({ picture: 1, missing: 1 });
  });

  it("reproducesNeedsSourceAndComponent", () => {
    const dir = mkdtempSync(join(tmpdir(), "figcov-rep-"));
    const folio = join(dir, "ch10");
    mkdirSync(folio, { recursive: true });
    const write = (n: string, reproduces: unknown) => {
      writeFileSync(join(folio, `f-fig-${n}.jsonld`), JSON.stringify({ kind: "figure", meta: { source: { method: "l1-vector-figure" }, reproduces } }));
      writeFileSync(join(folio, `f-fig-${n}.md`), `![Fig. ${n}. Reproduced](media/f${n}.png)\n`);
    };
    write("10", { source: "WHO ANC DAK", processId: "ANC.A", component: "business-process" });
    write("11", { source: "WHO ANC DAK" });
    expect(readBlocks(dir).map((b) => [b.figures[0], b.reproduces])).toEqual([["10", true], ["11", false]]);
  });
});
