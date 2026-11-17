/**
 * Every `l1-extractions/<entry>/` is DECLARED, with the `l1-extraction`
 * typology — and every such declaration names a directory that is there.
 *
 * Until 2026-10-30 the output sat inside its library entry, at
 * `library/<entry>/l1-extraction/`. The handbook's sections then moved to
 * who-iris (who-iris#107), and a library folder holding only the extraction
 * read as a second copy of the entry, so folio-assistant's library ingest
 * refused the duplicate slug. The extraction is smart-base's own (owner,
 * 2026-10-16), so it moved to `l1-extractions/<entry>/` here.
 *
 * Owner, 2026-10-12, bean 8pzh item 1: the extraction output stays beside its
 * library entry AND is published with the source — "if its a part of the KG it
 * should be published". It was not published because it was not part of the
 * declared KG: plain files under `library/`, which no typology named. The
 * library publisher (`cat-harness-tools/scripts/gen-library-viz.ts`) publishes
 * the directories declared inside an entry whose kind is `within: "library"`,
 * so an undeclared `l1-extraction/` is an unpublished one, silently. This test
 * is what makes the declaration checked rather than assumed.
 *
 * Read from the files alone — the declaration and the typology node — so it
 * runs in this repository without the harness mounted.
 */
import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const KIND = "l1-extraction";

interface Dir { id: string; path: string; graphTypologies: string[] }
const decl = JSON.parse(readFileSync(join(ROOT, "smart-base.json"), "utf-8")) as { directories: Dir[] };
const libraryPath = decl.directories.find((d) => d.graphTypologies.includes("library"))!.path.replace(/\/$/, "");
const EXTRACTIONS = "l1-extractions";
const norm = (p: string): string => p.replace(/\/$/, "");

/** `l1-extractions/<entry>` for every extraction on disk. */
function onDisk(): string[] {
  const dir = join(ROOT, EXTRACTIONS);
  return readdirSync(dir)
    .filter((e) => statSync(join(dir, e)).isDirectory())
    .map((e) => `${EXTRACTIONS}/${e}`)
    .sort();
}

/** `library/<entry>/l1-extraction` anywhere: the old place, which must stay empty. */
function leftInLibrary(): string[] {
  const lib = join(ROOT, libraryPath);
  return readdirSync(lib).filter((e) => statSync(join(lib, e)).isDirectory() && existsSync(join(lib, e, KIND)));
}

describe("l1-extraction is declared KG content", () => {
  const declared = decl.directories.filter((d) => d.graphTypologies.includes(KIND));

  it("typologyNodeWithinLibraryDerived", () => {
    const node = JSON.parse(readFileSync(join(ROOT, "typologies", `${KIND}.json`), "utf-8"));
    expect(node.$schema).toBe("folio-graph-typology/v1");
    expect(node.kind).toBe(KIND);
    expect(node.within).toBe("library");
    expect(node.holds).toBe("derived");
    // The two are exclusive on a kind; this one says why no validator applies.
    expect(node.nodeSchemas).toBeUndefined();
    expect(typeof node.validatorNotApplicable).toBe("string");
  });

  it("atLeastOneExtractionOnDisk", () => {
    expect(onDisk().length).toBeGreaterThan(0);
  });

  it("everyExtractionOnDiskDeclared", () => {
    expect(declared.map((d) => norm(d.path)).sort()).toEqual(onDisk());
  });

  it("noExtractionLeftInLibrary", () => {
    expect(leftInLibrary()).toEqual([]);
  });

  it("declarationsInExtractionsDirOnly", () => {
    for (const d of declared) {
      expect(norm(d.path).startsWith(`${EXTRACTIONS}/`)).toBe(true);
      expect(d.graphTypologies).toEqual([KIND]);
    }
  });

  it("declaredL1GraphDocumentExists", () => {
    for (const d of declared) {
      const graph = JSON.parse(readFileSync(join(ROOT, d.path, "l1.json"), "utf-8"));
      expect(typeof graph["@context"]).toBe("string");
    }
  });
});
