import { describe, expect, test } from "bun:test";

import { CatalogueNodeSchema } from "../schemas/catalogue.ts";
import { DublinCoreRecordSchema, dcValues } from "../schemas/dublin-core.ts";
import { ReferenceNodeSchema, type ReferenceNode } from "../schemas/reference.ts";
import { OWN_ID_PREFIX, planCatalogue, type CatalogueInput } from "./catalogue-from-references.ts";

const ref = (id: string, extra: Partial<ReferenceNode> = {}): { node: ReferenceNode; file: string } => ({
  node: ReferenceNodeSchema.parse({
    $schema: "folio-reference/v1",
    id,
    type: "article-journal",
    title: `Title of ${id}`,
    author: [{ family: "Neumann", given: "Walter" }],
    issued: { "date-parts": [[1985]] },
    DOI: `10.1000/${id}`,
    ...extra,
  }),
  file: "folio/schema/references.ts",
});

function input(over: Partial<CatalogueInput> = {}): CatalogueInput {
  return {
    references: new Map([
      ["nz85", ref("nz85")],
      ["milnor", ref("milnor")],
      ["untitled", ref("untitled", { title: undefined })],
    ]),
    ledger: [
      { file: "uploads/nz85.pdf", id: "nz85", sha256: "aaa" },
      { file: "uploads/milnor.pdf", id: "milnor" },
      { file: "uploads/orphan.pdf", id: null },
      { file: "uploads/two.pdf", id: "nz85" },
      { file: "uploads/sub/two.pdf", id: "milnor" },
      { file: "uploads/gone.pdf", id: "not-in-bibliography" },
      { file: "uploads/bad-sha.pdf", id: "milnor", sha256: "zzz" },
      { file: "uploads/untitled.pdf", id: "untitled" },
    ],
    library: [
      { slug: "neumann-zagier-1985", sourceFile: "nz85.pdf", sha256: "aaa" },
      { slug: "milnor-1982", sourceFile: "milnor.pdf" },
      { slug: "orphan", sourceFile: "orphan.pdf" },
      { slug: "two", sourceFile: "two.pdf" },
      { slug: "gone", sourceFile: "gone.pdf" },
      { slug: "bad-sha", sourceFile: "bad-sha.pdf", sha256: "yyy" },
      { slug: "untitled", sourceFile: "untitled.pdf" },
      { slug: "no-row", sourceFile: "nothing.pdf" },
      { slug: "no-source" },
    ],
    nodes: new Map(),
    records: new Map(),
    catalogueRel: "catalogue",
    libraryRel: "library",
    today: "2026-10-29",
    ...over,
  };
}

const parse = (s: string) => JSON.parse(s) as Record<string, unknown>;

describe("planCatalogue", () => {
  test("joinsOnlyUnambiguousEntries", () => {
    const plan = planCatalogue(input());
    expect(plan.joined.map((j) => j.slug)).toEqual(["milnor-1982", "neumann-zagier-1985"]);
    const why = Object.fromEntries(plan.skipped.map((s) => [s.slug, s.why]));
    expect(why).toEqual({
      "bad-sha": "sha256-mismatch",
      gone: "unknown-reference",
      "no-row": "no-ledger-row",
      "no-source": "no-source-file",
      orphan: "ledger-row-has-no-reference",
      two: "ambiguous",
      untitled: "reference-has-no-title",
    });
  });

  test("writesNodeAndRecord", () => {
    const plan = planCatalogue(input());
    expect(plan.writes.map((w) => `${w.action} ${w.path}`).sort()).toEqual([
      "create catalogue/nodes/item-milnor-1982.json",
      "create catalogue/nodes/item-neumann-zagier-1985.json",
      "create catalogue/records/milnor-1982.dc.json",
      "create catalogue/records/neumann-zagier-1985.dc.json",
    ]);
    const node = CatalogueNodeSchema.parse(parse(plan.writes.find((w) => w.path.endsWith("item-neumann-zagier-1985.json"))!.content));
    expect(node.id).toBe(`${OWN_ID_PREFIX}nz85`);
    expect(node.libraryId).toBe("neumann-zagier-1985");
    expect(node.metadataRef).toBe("catalogue/records/neumann-zagier-1985.dc.json");
    expect(node.materialization.gates?.copyright.verdict).toBe("unknown");
    const rec = DublinCoreRecordSchema.parse(parse(plan.writes.find((w) => w.path.endsWith("neumann-zagier-1985.dc.json"))!.content));
    expect(dcValues(rec, "title")[0]?.value).toBe("Title of nz85");
    expect(dcValues(rec, "contributor", "author")[0]?.value).toBe("Neumann, Walter");
    expect(dcValues(rec, "identifier", "doi")[0]?.value).toBe("10.1000/nz85");
    expect(rec.provenance).toEqual({ source: "folio/schema/references.ts#nz85", retrievedAt: "2026-10-29", method: "catalogue-from-references" });
  });

  test("rerunWritesNothing", () => {
    const first = planCatalogue(input());
    const nodes = new Map<string, Record<string, unknown>>();
    const records = new Map<string, Record<string, unknown>>();
    for (const w of first.writes) {
      const name = w.path.split("/").pop()!;
      (w.path.includes("/nodes/") ? nodes : records).set(name, parse(w.content));
    }
    const again = planCatalogue(input({ nodes, records, today: "2026-12-01" }));
    expect(again.writes).toEqual([]);
    expect(again.removals).toEqual([]);
    expect(again.unchanged).toBe(4);
  });

  test("changedReferenceUpdates", () => {
    const first = planCatalogue(input());
    const records = new Map<string, Record<string, unknown>>();
    for (const w of first.writes) if (w.path.includes("/records/")) records.set(w.path.split("/").pop()!, parse(w.content));
    const refs = input().references;
    refs.set("nz85", ref("nz85", { title: "Volumes of hyperbolic three-manifolds" }));
    const plan = planCatalogue(input({ references: refs, records, today: "2026-12-01" }));
    const w = plan.writes.find((x) => x.path.endsWith("neumann-zagier-1985.dc.json"))!;
    expect(w.action).toBe("update");
    expect((parse(w.content).provenance as { retrievedAt: string }).retrievedAt).toBe("2026-12-01");
  });

  test("neverOverridesForeignNode", () => {
    const nodes = new Map<string, Record<string, unknown>>([
      ["item-milnor-1982.json", { id: "item/b08c6c19", libraryId: "milnor-1982" }],
      ["item-old.json", { id: `${OWN_ID_PREFIX}old`, libraryId: "old", metadataRef: "catalogue/records/old.dc.json" }],
    ]);
    const records = new Map<string, Record<string, unknown>>([["old.dc.json", {}]]);
    const plan = planCatalogue(input({ nodes, records }));
    expect(plan.skipped.find((s) => s.slug === "milnor-1982")?.why).toBe("already-catalogued");
    expect(plan.writes.some((w) => w.path.includes("milnor-1982"))).toBe(false);
    expect(plan.removals.sort()).toEqual(["catalogue/nodes/item-old.json", "catalogue/records/old.dc.json"]);
  });
});
