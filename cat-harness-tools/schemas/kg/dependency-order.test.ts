/**
 * The four rules of {@link flattenDependencies}, each tested as a rule rather
 * than as an example — a cycle test that only checks "it did not return an
 * order" passes for a module that returns nothing at all.
 */
import { describe, expect, it } from "bun:test";

import {
  ancestorsOf,
  findConflicts,
  flattenDependencies,
  runInOrder,
  type OrderedStep,
} from "./dependency-order";

const step = (id: string, needs: string[] = [], fatal = false): OrderedStep => ({ id, needs, fatal });

describe("rule 1 — a node runs after everything it needs", () => {
  it("orders a chain", () => {
    const r = flattenDependencies([step("c", ["b"]), step("a"), step("b", ["a"])]);
    expect(r.problems).toEqual([]);
    expect(r.order.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("the owner's pipeline: kg → readme → the dynamic renders", () => {
    const r = flattenDependencies([
      step("kg-export", [], true),
      step("readme", ["kg-export"], true),
      step("kg-viewer", ["kg-export"]),
      step("visualisers", ["kg-export"]),
    ]);
    expect(r.problems).toEqual([]);
    const ids = r.order.map((s) => s.id);
    expect([...ids].sort()).toEqual(["kg-export", "kg-viewer", "readme", "visualisers"]);
    expect(ids.indexOf("readme")).toBeGreaterThan(ids.indexOf("kg-export"));
    expect(ids.indexOf("kg-viewer")).toBeGreaterThan(ids.indexOf("kg-export"));
    expect(ids.indexOf("visualisers")).toBeGreaterThan(ids.indexOf("kg-export"));
  });
});

describe("rule 2 — ties break on declaration order", () => {
  it("two independent steps keep the order they were declared in", () => {
    expect(flattenDependencies([step("zebra"), step("aardvark")]).order.map((s) => s.id)).toEqual([
      "zebra",
      "aardvark",
    ]);
  });

  it("renaming a node does not reshuffle its unrelated siblings", () => {
    const before = flattenDependencies([step("a"), step("m"), step("z")]).order.map((s) => s.id);
    const after = flattenDependencies([step("a"), step("m2"), step("z")]).order.map((s) => s.id);
    expect(before).toEqual(["a", "m", "z"]);
    // The renamed node keeps its slot, and every unrelated sibling keeps its own.
    expect(after).toEqual(["a", "m2", "z"]);
    expect(after.indexOf("m2")).toBe(before.indexOf("m"));
    expect(after.filter((id) => id !== "m2")).toEqual(before.filter((id) => id !== "m"));
  });
});

describe("rule 3 — a cycle is reported, never broken", () => {
  it("returns no order at all", () => {
    const r = flattenDependencies([step("a", ["b"]), step("b", ["a"])]);
    expect(r.order).toEqual([]);
    expect(r.problems).toHaveLength(1);
  });

  it("names EVERY node in the cycle, not the first one found", () => {
    const r = flattenDependencies([step("a", ["c"]), step("b", ["a"]), step("c", ["b"])]);
    const p = r.problems[0]!;
    expect(p.kind).toBe("cycle");
    expect(p.kind === "cycle" && p.ids).toEqual(["a", "b", "c"]);
  });

  it("a clean subgraph beside a cycle is still not ordered — partial output gets run", () => {
    const r = flattenDependencies([step("ok"), step("a", ["b"]), step("b", ["a"])]);
    expect(r.order).toEqual([]);
    // The cycle is still reported, naming only the nodes in it — not the clean one.
    expect(r.problems).toHaveLength(1);
    const p = r.problems[0]!;
    expect(p.kind).toBe("cycle");
    expect(p.kind === "cycle" && p.ids).toEqual(["a", "b"]);
  });
});

describe("rule 4 — a missing dependency is reported, never dropped", () => {
  it("is a problem, and the step is not silently ordered", () => {
    const r = flattenDependencies([step("a", ["ghost"])]);
    expect(r.order).toEqual([]);
    expect(r.problems[0]!.kind).toBe("missing");
    expect(r.problems[0]!.kind === "missing" && r.problems[0]!.needs).toBe("ghost");
  });

  it("a duplicate id is a problem — nothing says which of the two was ordered", () => {
    const r = flattenDependencies([step("a"), step("a")]);
    expect(r.order).toEqual([]);
    expect(r.problems).toHaveLength(1);
    const p = r.problems[0]!;
    expect(p.kind).toBe("duplicate");
    expect(p.kind === "duplicate" && p.id).toBe("a");
  });
});

describe("fatal is per step", () => {
  const order = flattenDependencies([
    { id: "kg", fatal: true },
    { id: "readme", needs: ["kg"], fatal: true },
    { id: "viewer", needs: ["kg"], fatal: false },
    { id: "tiles", needs: ["viewer"], fatal: false },
    { id: "unrelated", fatal: false },
  ]).order;

  it("a fatal failure stops the run", () => {
    const { records, stopped } = runInOrder(order, (s) => (s.id === "kg" ? "no declarations" : undefined));
    expect(stopped).toBe("kg");
    expect(records.map((r) => r.step.id)).toEqual(["kg"]);
  });

  it("a non-fatal failure skips what needed it and nothing else", () => {
    const { records, stopped } = runInOrder(order, (s) => (s.id === "viewer" ? "no renderer" : undefined));
    expect(stopped).toBeUndefined();
    const byId = new Map(records.map((r) => [r.step.id, r]));
    expect(byId.get("viewer")!.outcome).toBe("failed");
    expect(byId.get("tiles")!.outcome).toBe("skipped");
    expect(byId.get("unrelated")!.outcome).toBe("ran");
    expect(byId.get("readme")!.outcome).toBe("ran");
  });

  it("a skipped step names the step that BROKE, not the chain that carried it", () => {
    const { records } = runInOrder(order, (s) => (s.id === "viewer" ? "no renderer" : undefined));
    expect(records.find((r) => r.step.id === "tiles")!.blockedBy).toBe("viewer");
  });
});

describe("multiple inheritance — ancestors and conflicts (bean a1lq)", () => {
  // root needs A and B; B needs D. A and D are unrelated at DIFFERENT depths.
  const graph = () => flattenDependencies([step("D"), step("A"), step("B", ["D"]), step("root", ["A", "B"])]).order;

  it("a diamond resolves once, below both branches", () => {
    const r = flattenDependencies([step("D"), step("B", ["D"]), step("C", ["D"]), step("A", ["B", "C"])]);
    expect(r.problems).toEqual([]);
    expect(r.order.map((s) => s.id)).toEqual(["D", "B", "C", "A"]);
    expect([...ancestorsOf(r.order).get("A")!].sort()).toEqual(["B", "C", "D"]);
  });

  it("an override by a layer that reaches the other is not a conflict", () => {
    const keys: Record<string, string[]> = { D: ["k"], B: ["k"] };
    expect(findConflicts(graph(), (id) => keys[id] ?? [])).toEqual([]);
  });

  it("two unrelated layers at DIFFERENT depths conflict — incomparable, not same-depth", () => {
    const keys: Record<string, string[]> = { A: ["k"], D: ["k"] };
    const c = findConflicts(graph(), (id) => keys[id] ?? []);
    expect(c).toHaveLength(1);
    expect(c[0].ids.sort()).toEqual(["A", "D"]);
  });

  it("the child that reaches both settles the conflict by redefining the key", () => {
    const keys: Record<string, string[]> = { A: ["k"], D: ["k"], root: ["k"] };
    expect(findConflicts(graph(), (id) => keys[id] ?? [])).toEqual([]);
  });
});
