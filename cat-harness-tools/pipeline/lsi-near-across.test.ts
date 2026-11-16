import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  discoverLsiUnitProviders,
  explicitRefs,
  formatNearAcross,
  nearAcross,
  nearInGraph,
  parseNearAcrossArgs,
  type LsiProviderResult,
} from "./lsi-near-across";

const UNITS = [
  { id: "a", text: "markov chain mixing time spectral gap bound for the random walk" },
  { id: "b", text: "spectral gap of the laplacian and the cheeger inequality on graphs" },
  { id: "c", text: "vaccine schedule for measles rubella and the second dose interval" },
  { id: "d", text: "immunization registry records each dose given and the schedule due" },
  { id: "e", text: "random walk on a graph converges to its stationary distribution" },
];

function graph(extra: Partial<LsiProviderResult> = {}): LsiProviderResult {
  return { units: UNITS, unreadable: [], ...extra };
}

describe("explicitRefs", () => {
  test("names the units the text spells out, in order, once each", () => {
    const keys: Array<[string, string]> = [
      ["QOU.Mass.foo", "QOU.Mass.foo@QOU.Mass.X"],
      ["QOU.Mass.foo", "QOU.Mass.foo@QOU.Mass.Y"],
      ["library/l/blocks/b1", "library/l/blocks/b1"],
    ];
    const text = "Re-prove library/l/blocks/b1, then QOU.Mass.foo. Also QOU.Mass.foo again.";
    expect(explicitRefs(text, keys)).toEqual(["library/l/blocks/b1", "QOU.Mass.foo@QOU.Mass.X", "QOU.Mass.foo@QOU.Mass.Y"]);
  });

  test("a key that is only part of a longer token does not match", () => {
    expect(explicitRefs("QOU.Mass.foobar", [["QOU.Mass.foo", "x"]])).toEqual([]);
  });
});

describe("nearInGraph", () => {
  test("a provider's notSearched passes through, with nothing else claimed", () => {
    const r = nearInGraph("lean-decl", graph({ units: [], notSearched: "no --root given" }), "spectral gap");
    expect(r.notSearched).toBe("no --root given");
    expect(r.hits).toEqual([]);
  });

  test("too few units is not searched, not an empty result", () => {
    const r = nearInGraph("blocks", graph({ units: UNITS.slice(0, 2) }), "spectral gap");
    expect(r.notSearched).toContain("too few");
  });

  test("a query sharing no vocabulary says so", () => {
    const r = nearInGraph("blocks", graph(), "zzzz qqqq");
    expect(r.vocabularyMiss).toBe(true);
    expect(r.hits).toEqual([]);
    expect(r.notSearched).toBeUndefined();
  });

  test("explicit units are listed first and left out of the latent hits", () => {
    const r = nearInGraph("blocks", graph({ refKeys: [["b", "b"]] }), "see b about the spectral gap", 5);
    expect(r.explicit).toEqual(["b"]);
    expect(r.hits.map((h) => h.id)).not.toContain("b");
  });

  test("hits are labelled lexical or latent only", () => {
    const r = nearInGraph("blocks", graph(), "spectral gap", 5);
    const a = r.hits.find((h) => h.id === "a");
    expect(a?.lexical).toBe(true);
    for (const h of r.hits) expect(typeof h.lexical).toBe("boolean");
  });
});

describe("formatNearAcross", () => {
  test("one block per graph, never one merged list", () => {
    const lines = formatNearAcross([
      nearInGraph("blocks", graph(), "spectral gap", 2, "core"),
      nearInGraph("lean-decl", graph({ units: [], notSearched: "no --root given" }), "spectral gap"),
    ]);
    expect(lines[0]).toStartWith("blocks (core): 5 units.");
    expect(lines.some((l) => l === "lean-decl: not searched (no --root given)")).toBe(true);
  });
});

describe("parseNearAcrossArgs", () => {
  test("reads --graphs and repeated --root", () => {
    expect(parseNearAcrossArgs(["--near", "x", "--graphs", "beans, blocks", "--root", "lean-decl=/a", "--root", "lean-decl=/b"])).toEqual({
      graphs: ["beans", "blocks"],
      roots: { "lean-decl": ["/a", "/b"] },
    });
    expect(parseNearAcrossArgs([])).toEqual({ roots: {} });
  });
});

/** A checkout of plain directories, each a layer with its own declaration. */
function checkout(instances: Record<string, { providers?: unknown; files?: Record<string, string> }>): string {
  const root = mkdtempSync(join(tmpdir(), "near-across-"));
  for (const [name, spec] of Object.entries(instances)) {
    const dir = join(root, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}.json`), JSON.stringify({ name, ...(spec.providers !== undefined ? { lsiUnitProviders: spec.providers } : {}) }));
    for (const [f, body] of Object.entries(spec.files ?? {})) writeFileSync(join(dir, f), body);
  }
  return root;
}

const PROVIDER = `export function units(ctx) {
  return { units: ${JSON.stringify(UNITS)}, unreadable: [], refKeys: [["c", "c"]], roots: ctx.roots };
}
export function fails() { throw new Error("boom"); }
export const notAFunction = 1;
`;

describe("discoverLsiUnitProviders", () => {
  test("finds declared providers, and reports malformed ones and collisions", () => {
    const root = checkout({
      core: { providers: [{ graphKind: "blocks", module: "p.ts", export: "units" }] },
      sci: { providers: [{ graphKind: "lean-decl", module: "p.ts", export: "units" }, { graphKind: "blocks", module: "p.ts", export: "units" }] },
      bad: { providers: [{ graphKind: "Not Kebab", module: "../escape.ts", export: "units" }] },
      none: {},
    });
    const { providers, problems } = discoverLsiUnitProviders(root);
    expect(providers.map((p) => `${p.instance}:${p.graphKind}`)).toEqual(["sci:lean-decl"]);
    expect(problems.some((p) => p.startsWith("bad: `lsiUnitProviders` is malformed"))).toBe(true);
    expect(problems.some((p) => p.includes('"blocks" is declared by "core" and "sci"'))).toBe(true);
  });
});

describe("nearAcross", () => {
  test("searches each declared graph on its own, and says why one was not searched", async () => {
    const root = checkout({
      core: { providers: [{ graphKind: "blocks", module: "p.ts", export: "units" }], files: { "p.ts": PROVIDER } },
      sci: {
        providers: [
          { graphKind: "lean-decl", module: "p.ts", export: "fails" },
          { graphKind: "odd", module: "p.ts", export: "notAFunction" },
        ],
        files: { "p.ts": PROVIDER },
      },
    });
    const { results } = await nearAcross("c and the measles schedule", { checkoutRoot: root, graphs: ["blocks", "lean-decl", "odd", "missing"] });
    const by = new Map(results.map((r) => [r.graphKind, r]));
    expect(by.get("blocks")?.explicit).toEqual(["c"]);
    expect(by.get("blocks")?.hits.length).toBeGreaterThan(0);
    expect(by.get("lean-decl")?.notSearched).toBe("its provider failed: boom");
    expect(by.get("odd")?.notSearched).toContain("has no exported function `notAFunction`");
    expect(by.get("missing")?.notSearched).toBe("no instance in this checkout declares it");
  });
});
