import { describe, expect, it } from "bun:test";
import { drawEveryDot } from "./gen-archimate-pages.ts";

/** A Graphviz whose instance fails once it has laid out `budget` drawings, as the wasm heap does. */
function fakeGraphviz(budget: number) {
  let loads = 0;
  return {
    get loads() {
      return loads;
    },
    unload() {},
    async load() {
      loads++;
      let used = 0;
      return {
        dot(dot: string) {
          if (++used > budget) throw new Error("Out of bounds memory access");
          return `<svg>${dot}</svg>`;
        },
      };
    },
  };
}

describe("drawEveryDot", () => {
  it("draws every collected DOT, reloading once an instance gives out", async () => {
    const gv = fakeGraphviz(2);
    const dots = ["a", "b", "c", "d", "e"];
    const draw = await drawEveryDot(gv, (d) => dots.map(d));
    expect(dots.map(draw)).toEqual(dots.map((d) => `<svg>${d}</svg>`));
    expect(gv.loads).toBe(3);
  });

  it("lays out a repeated DOT once", async () => {
    const gv = fakeGraphviz(1);
    const draw = await drawEveryDot(gv, (d) => ["x", "x", "x"].map(d));
    expect(draw("x")).toBe("<svg>x</svg>");
    expect(gv.loads).toBe(1);
  });

  it("refuses a DOT the first pass did not see", async () => {
    const draw = await drawEveryDot(fakeGraphviz(5), (d) => d("a"));
    expect(() => draw("b")).toThrow(/did not collect/);
  });
});
