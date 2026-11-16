/**
 * The instance a root-level library or upload queue is attributed to is the
 * root's DECLARED name, not the folder the repository was cloned into. Bean
 * `t5dm`: a worktree named `pr1290` published `"uploadInstance": "pr1290"`.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { instanceOf, referencedCatalogueEntries } from "../../library-graph.ts";
import { writeDeclaration } from "../../../test/support/instance-fixture.js";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A repository root in a folder whose name is NOT its instance's name. */
function cloneNamed(folder: string, declared?: string): string {
  const parent = mkdtempSync(join(tmpdir(), "t5dm-"));
  made.push(parent);
  const root = join(parent, folder);
  mkdirSync(join(root, "uploads"), { recursive: true });
  mkdirSync(join(root, "who-iris", "library"), { recursive: true });
  if (declared !== undefined) writeDeclaration(root, { name: declared, directories: [] });
  return root;
}

describe("instanceOf (bean t5dm)", () => {
  test("a root-level directory belongs to the root's declared name, whatever the clone is called", () => {
    const root = cloneNamed("pr1290", "folio-assistant");
    expect(instanceOf(join(root, "uploads"), root)).toBe("folio-assistant");
  });

  test("the same repository cloned under two folder names gives one answer", () => {
    const a = cloneNamed("folio-assistant", "folio-assistant");
    const b = cloneNamed("worktree-xyz", "folio-assistant");
    expect(instanceOf(join(b, "uploads"), b)).toBe(instanceOf(join(a, "uploads"), a));
  });

  test("a sub-instance is its path inside the repository — unchanged by the clone's name", () => {
    const root = cloneNamed("pr1290", "folio-assistant");
    expect(instanceOf(join(root, "who-iris", "library"), root)).toBe("who-iris");
  });

  // Issue #1904: the folder-name fallback is gone. An undeclared root belongs
  // to its single landing harness, and with none decided it is an error.
  test("a root that declares nothing belongs to its only instantiated harness, not its folder", () => {
    const root = cloneNamed("smart-trust");
    writeFileSync(join(root, "smart-base.config.json"), "{}");
    expect(instanceOf(join(root, "uploads"), root)).toBe("smart-base");
  });

  test("a root that declares nothing and decides no landing harness is an error, not a guess", () => {
    const root = cloneNamed("bare-folio");
    expect(() => instanceOf(join(root, "uploads"), root)).toThrow(/issue #1904/);
  });
});

/**
 * Owner, 2026-11-10: a referenced IRIS item's title goes to *"our ingested
 * record in linbrary and associated KG"*, not IRIS. The catalogue's
 * `referenced` items are listed as entries with no bytes.
 */
describe("referencedCatalogueEntries", () => {
  function layer(dir = "iris"): { root: string; inst: string } {
    const root = mkdtempSync(join(tmpdir(), "refent-"));
    made.push(root);
    writeDeclaration(root, { name: "host", directories: [] });
    const inst = join(root, dir);
    for (const d of ["library/held-1", "catalogue/nodes", "catalogue/records", "site/dublin-core"]) mkdirSync(join(inst, d), { recursive: true });
    writeDeclaration(inst, {
      name: "iris",
      directories: [
        { id: "library", path: "library/", graphTypologies: ["library"] },
        { id: "catalogue", path: "catalogue/", graphTypologies: ["catalogue"] },
        { id: "site", path: "site/", graphTypologies: ["docs"], instanceRoot: true },
      ],
    });
    const node = (f: string, n: object): void => writeFileSync(join(inst, "catalogue", "nodes", f), JSON.stringify(n));
    writeFileSync(join(inst, "catalogue", "records", "10665-1.dc.json"), "{}");
    writeFileSync(join(inst, "catalogue", "records", "10665-2.dc.json"), "{}");
    writeFileSync(join(inst, "site", "dublin-core", "10665-1.dc.xml"), "<x/>");
    node("item-a.json", {
      flavour: "item", title: "A referenced item", handle: "10665/1", metadataRef: "catalogue/records/10665-1.dc.json",
      materialization: { state: "referenced" },
      bitstreams: [
        { name: "a.pdf", bundle: "ORIGINAL", materialization: { state: "referenced", provenance: { upstream: "https://iris.example/bitstreams/a/download" } } },
        { name: "a.txt", bundle: "TEXT", materialization: { state: "referenced", provenance: { upstream: "https://iris.example/t" } } },
      ],
    });
    node("item-b.json", { flavour: "item", title: "Held", libraryId: "held-1", metadataRef: "catalogue/records/10665-2.dc.json", materialization: { state: "materialized" } });
    node("item-c.json", { flavour: "item", title: "No record", metadataRef: "catalogue/records/missing.dc.json", materialization: { state: "referenced" } });
    return { root, inst };
  }

  test("a referenced item with a record is an entry: record, XML, KG node, Handle and its upstream files", () => {
    const { root, inst } = layer();
    const got = referencedCatalogueEntries([inst], root, new Set());
    expect(got.map((e) => e.id)).toEqual(["10665-1"]);
    const e = got[0]!;
    expect(e.instance).toBe("iris");
    expect(e.title).toBe("A referenced item");
    expect(e.provenance).toBe("catalogued");
    expect(e.catalogue).toEqual({
      record: "iris/catalogue/records/10665-1.dc.json",
      handle: "10665/1",
      xml: "iris/dublin-core/10665-1.dc.xml",
      node: "iris/catalogue/nodes/item-a.json",
    });
    expect(e.upstream).toEqual([{ label: "a.pdf", href: "https://iris.example/bitstreams/a/download" }]);
    expect(e.sourceFile).toBe("a.pdf");
  });

  test("the XML's site path names the DECLARED layer, not the checkout directory (a clone at iris-217/ serves /iris/)", () => {
    const { root, inst } = layer("iris-217");
    const got = referencedCatalogueEntries([inst], root, new Set());
    expect(got[0]?.catalogue?.xml).toBe("iris/dublin-core/10665-1.dc.xml");
  });

  test("an id a held entry already uses is skipped", () => {
    const { root, inst } = layer();
    expect(referencedCatalogueEntries([inst], root, new Set(["iris/10665-1"]))).toEqual([]);
  });

  test("an id held in ANOTHER layer is skipped too: the site has one entry per id", () => {
    const { root, inst } = layer();
    expect(referencedCatalogueEntries([inst], root, new Set(["who-iris/10665-1"]))).toEqual([]);
  });

  test("a record two layers' catalogues both hold is listed once", () => {
    const { root, inst } = layer();
    const twin = join(root, "iris2");
    cpSync(inst, twin, { recursive: true });
    rmSync(join(twin, "iris.json"));
    writeDeclaration(twin, {
      name: "iris2",
      directories: [
        { id: "library", path: "library/", graphTypologies: ["library"] },
        { id: "catalogue", path: "catalogue/", graphTypologies: ["catalogue"] },
        { id: "site", path: "site/", graphTypologies: ["docs"], instanceRoot: true },
      ],
    });
    const got = referencedCatalogueEntries([inst, twin], root, new Set());
    expect(got.map((e) => `${e.instance}/${e.id}`)).toEqual(["iris/10665-1"]);
  });
});
