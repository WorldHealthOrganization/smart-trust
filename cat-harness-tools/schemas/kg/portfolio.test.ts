/**
 * The portfolio kind: levels of linked libraries, each reached by a library
 * catalogue, by discovery, or by name.
 */
import { describe, expect, it } from "bun:test";

import { nodeKind } from "./node-kind";
import { PortfolioKind, PortfolioSchema } from "./portfolio";

const sample = {
  $schema: "portfolio/1.0.0",
  id: "smart-guidelines",
  title: "SMART Guidelines",
  levels: [
    {
      id: "L1",
      title: "Publications",
      libraries: [{ id: "who-iris", source: { library: { repo: "litlfred/who-iris", items: ["10665/344249"] } } }],
    },
    {
      id: "L2",
      title: "Handbooks",
      libraries: [{ id: "dth", source: { discover: { owner: "litlfred", prefixes: ["dth-"], memberKind: "folio-document" } } }],
    },
    {
      id: "L3",
      title: "Implementation guides",
      libraries: [{ id: "foundations", source: { repos: ["litlfred/smart-base"], memberKind: "fhir-ig" } }],
    },
  ],
};

describe("portfolio", () => {
  it("accepts levels whose libraries use each of the three sources", () => {
    expect(PortfolioSchema.safeParse(sample).success).toBe(true);
    expect(PortfolioKind.tag).toBe("portfolio/1.0.0");
  });

  it("refuses a level or a library declared twice", () => {
    const twiceLevel = { ...sample, levels: [sample.levels[0], sample.levels[0]] };
    expect(PortfolioSchema.safeParse(twiceLevel).error?.issues.map((i) => i.message)).toContain("level `L1` is declared twice");
    const lib = sample.levels[0]!.libraries[0]!;
    const twiceLib = { ...sample, levels: [sample.levels[0], { ...sample.levels[1], libraries: [lib] }] };
    expect(PortfolioSchema.safeParse(twiceLib).error?.issues.map((i) => i.message)).toContain("library `who-iris` is declared twice");
  });

  it("refuses an unknown key and a source that is none of the three", () => {
    expect(PortfolioSchema.safeParse({ ...sample, extra: 1 }).success).toBe(false);
    const bad = { ...sample, levels: [{ id: "L1", title: "x", libraries: [{ id: "a", source: { copy: true } }] }] };
    expect(PortfolioSchema.safeParse(bad).success).toBe(false);
  });

  it("a subclass can pin what its levels mean", () => {
    const pinned = nodeKind("pinned-portfolio/1.0.0", [PortfolioKind], {}, {
      refine: (p, ctx) => {
        for (const l of p.levels) if (!/^L[1-4]$/.test(l.id)) ctx.addIssue({ code: "custom", message: `level ${l.id}` });
      },
    });
    expect(pinned.order).toEqual(["portfolio", "pinned-portfolio"]);
    expect(pinned.schema.safeParse({ ...sample, $schema: "pinned-portfolio/1.0.0" }).success).toBe(true);
    const l9 = { ...sample, $schema: "pinned-portfolio/1.0.0", levels: [{ id: "L9", title: "x", libraries: [] }] };
    expect(pinned.schema.safeParse(l9).success).toBe(false);
  });
});
