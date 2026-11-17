import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { firstPage, libraryIdOfL1, listsOf, parseLocation, recommendationsOf, scenarioListName, scenariosOf } from "./l1-statement-lists.ts";

describe("where an L1 source came from", () => {
  it("reads graph.source.entry, else the library/<id>/ its paths name, else nothing", () => {
    expect(libraryIdOfL1({ graph: { source: { entry: "library/unepi-deck" } } })).toBe("unepi-deck");
    expect(libraryIdOfL1({ graph: { source: { pdf: "library/wer-92-17/WER9217.pdf" } } })).toBe("wer-92-17");
    expect(libraryIdOfL1({ graph: { source: { pdf: "uploads/x.pdf" } } })).toBeUndefined();
    expect(libraryIdOfL1({})).toBeUndefined();
  });

  it("takes a row's first page", () => {
    expect(firstPage("220–221")).toBe(220);
    expect(firstPage(7)).toBe(7);
    expect(firstPage("")).toBeUndefined();
  });

  it("parses a scenario's evidence location", () => {
    expect(parseLocation("a/b.l1.yaml#C01 (p210)")).toEqual({ file: "a/b.l1.yaml", key: "C01", page: 210 });
    expect(parseLocation("a/b.yaml#K")).toEqual({ file: "a/b.yaml", key: "K" });
    expect(parseLocation("not a location")).toBeUndefined();
  });
});

describe("statements", () => {
  it("are the rows verbatim, one line, with entry and page", () => {
    const s = recommendationsOf({ recommendations: [{ key: "R1", page: "3", statement: "Give\n  dose 1." }, { key: "R2" }] }, "deck");
    expect(s).toEqual([{ id: "R1", statement: "Give dose 1.", kind: "recommendation", source: { libraryId: "deck", page: 3 } }]);
  });

  it("skip a node citing a file that is not an L1 source, and report one naming no entry", () => {
    const graph = {
      nodes: [
        { id: "a", type: "user-scenario", label: "A", evidence: { location: "src.l1.yaml#R1 (p3)" } },
        { id: "p", type: "persona", label: "P", evidence: { location: "mapping.yaml#x" } },
        { id: "b", type: "user-scenario", label: "B", evidence: { location: "bad.l1.yaml#R1 (p3)" } },
      ],
    };
    const r = scenariosOf(graph, (f) => (f === "src.l1.yaml" ? "deck" : f === "mapping.yaml" ? null : undefined));
    expect(r.statements.map((x) => x.id)).toEqual(["a"]);
    expect(r.statements[0]!.derivedFrom).toBe("R1");
    expect(r.unresolved).toHaveLength(1);
  });
});

describe("a directory", () => {
  it("yields one list per L1 source and per scenario graph", () => {
    const dir = mkdtempSync(join(tmpdir(), "l1sl-"));
    writeFileSync(join(dir, "src.l1.yaml"), "graph:\n  source:\n    entry: library/deck\nrecommendations:\n  - {key: R1, page: '7', statement: Give dose 1.}\n");
    mkdirSync(join(dir, "candidates"));
    writeFileSync(join(dir, "candidates", "scenario-candidates.l2.json"), JSON.stringify({ "@context": "x", nodes: [{ id: "s1", type: "user-scenario", label: "S1", evidence: { location: "src.l1.yaml#R1 (p7)" } }] }));
    const { lists, problems } = listsOf(dir, dir);
    expect(problems).toEqual([]);
    expect([...lists.keys()].sort()).toEqual([`${dir.split("/").pop()}-scenario-candidates.scenarios.json`, "src.recommendations.json"].sort());
  });
});

describe("list names", () => {
  it("name a candidates/<source>/ graph after its source, and a <x>/candidates/ graph after <x>", () => {
    expect(scenarioListName("/r/uganda/candidates/unepi-deck/scenario-candidates.l2.json", "scenario-candidates")).toBe("unepi-deck");
    expect(scenarioListName("/r/measles/candidates/scenario-candidates.l2.json", "scenario-candidates")).toBe("measles-scenario-candidates");
    expect(scenarioListName("/r/x/graph.l2.json", "graph")).toBe("graph");
  });

  it("keep two sources' scenario lists apart (the Uganda layout), and refuse a name two inputs share", () => {
    const dir = mkdtempSync(join(tmpdir(), "l1sl-"));
    for (const src of ["poster", "deck"]) {
      writeFileSync(join(dir, `${src}.l1.yaml`), `graph:\n  source:\n    entry: library/${src}\nrecommendations:\n  - {key: R1, page: '1', statement: S.}\n`);
      mkdirSync(join(dir, "candidates", src), { recursive: true });
      writeFileSync(join(dir, "candidates", src, "scenario-candidates.l2.json"), JSON.stringify({ "@context": "x", nodes: [{ id: `${src}-s1`, type: "user-scenario", label: "S", evidence: { location: `${src}.l1.yaml#R1 (p1)` } }] }));
    }
    const { lists, problems } = listsOf(dir, dir);
    expect(problems).toEqual([]);
    expect(lists.get("poster.scenarios.json")?.statements[0]?.source.libraryId).toBe("poster");
    expect(lists.get("deck.scenarios.json")?.statements[0]?.source.libraryId).toBe("deck");

    // A second graph that would land on the same name is refused, not written over the first.
    mkdirSync(join(dir, "more", "candidates", "deck"), { recursive: true });
    writeFileSync(join(dir, "more", "candidates", "deck", "scenario-candidates.l2.json"), JSON.stringify({ "@context": "x", nodes: [{ id: "d2", type: "user-scenario", label: "S", evidence: { location: "../../../deck.l1.yaml#R1 (p1)" } }] }));
    expect(listsOf(dir, dir).problems.some((p) => p.includes("deck.scenarios.json"))).toBe(true);
  });
});
