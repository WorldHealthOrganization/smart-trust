/**
 * Every block kind's RDF class is minted in the namespace of the layer that
 * declares the kind (owner ruling 2026-10-06, bean `0r7u`): `Prose` is
 * folio-assistant-core's, `Theorem` folio-assistant-sci's, `Persona`
 * smart-base's. A class written under another layer's prefix would assert
 * that layer defines it. Whole-checkout, so it lives in the top-level test
 * home (bean `7zz1`).
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { directoriesForGraph, layerRootsIn, readDeclaration } from "../../schemas/kg/cat-harness.ts";
import { documentContext, instancePrefixes } from "../../schemas/content/content-context.ts";

const ROOT = join(import.meta.dir, "../../..");

interface Row { instance: string; file: string; folioType: string }

function blockKindRows(): Row[] {
  const rows: Row[] = [];
  for (const root of layerRootsIn(ROOT)) {
    const decl = readDeclaration(root);
    if (decl === undefined) continue;
    for (const dir of directoriesForGraph(root, "block-kinds")) {
      let files: string[];
      try {
        files = readdirSync(dir).filter((f) => f.endsWith(".json"));
      } catch {
        continue;
      }
      for (const f of files) {
        const raw = JSON.parse(readFileSync(join(dir, f), "utf-8")) as { folioType?: string };
        if (raw.folioType) rows.push({ instance: decl.stub ?? decl.name, file: join(dir, f), folioType: raw.folioType });
      }
    }
  }
  return rows;
}

describe("block-kind classes live in their owner's namespace", () => {
  const rows = blockKindRows();

  test("there are block kinds to check", () => {
    expect(rows.length).toBeGreaterThan(20);
  });

  test("every folioType's prefix is the declaring instance's", () => {
    const wrong = rows.filter((r) => r.folioType.split(":")[0] !== r.instance).map((r) => `${r.file}: ${r.folioType}`);
    expect(wrong).toEqual([]);
  });

  test("every folioType expands: its prefix is an instance this checkout declares", () => {
    const prefixes = instancePrefixes(ROOT);
    for (const r of rows) expect(() => documentContext([r.folioType], { prefixes })).not.toThrow();
  });
});
