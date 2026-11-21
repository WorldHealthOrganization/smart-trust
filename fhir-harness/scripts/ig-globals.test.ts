import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Liquid } from "liquidjs";
import { globalsFromImplementationGuide, globalsFromSushiConfig } from "./ig-globals.ts";
import { GLOBALS_TABLE_TEMPLATE_PATH, describeStage, stageIgSite } from "./build-ig-site";

describe("the IG's global profiles (globals-table.xhtml)", () => {
  test("fromIgSortedDropsMalformed", () => {
    expect(globalsFromImplementationGuide({ global: [
      { type: "Patient", profile: "http://acme.org/StructureDefinition/p" },
      { type: "Encounter", profile: "http://acme.org/StructureDefinition/e" },
      { type: "Observation" },
    ] })).toEqual([
      { type: "Encounter", profile: "http://acme.org/StructureDefinition/e" },
      { type: "Patient", profile: "http://acme.org/StructureDefinition/p" },
    ]);
    expect(globalsFromImplementationGuide({})).toEqual([]);
  });

  test("fromSushiOneOrSeveral", () => {
    expect(globalsFromSushiConfig({ global: { Patient: "http://acme.org/p", Observation: ["http://acme.org/o2", "http://acme.org/o1"] } })).toEqual([
      { type: "Observation", profile: "http://acme.org/o1" },
      { type: "Observation", profile: "http://acme.org/o2" },
      { type: "Patient", profile: "http://acme.org/p" },
    ]);
    expect(globalsFromSushiConfig({})).toEqual([]);
  });

  test("templateRowsOrNone", async () => {
    const liquid = new Liquid();
    const tpl = readFileSync(GLOBALS_TABLE_TEMPLATE_PATH, "utf-8");
    const some = await liquid.parseAndRender(tpl, { site: { data: { fhir: { globals: [{ type: "Patient", profile: "http://acme.org/p" }] } } } });
    expect(some).toContain("<td>Patient</td>");
    expect(some).toContain('<a href="http://acme.org/p">');
    const none = await liquid.parseAndRender(tpl, { site: { data: { fhir: { globals: [] } } } });
    expect(none).toContain("There are no Global profiles defined.");
  });

  test("includingPageGetsTable", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-glob-"));
    try {
      const src = join(d, "src");
      mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
      writeFileSync(join(src, "sushi-config.yaml"), "id: acme\ncanonical: http://acme.org\nname: Acme\nversion: 0.1.0\nfhirVersion: 4.0.1\nglobal:\n  Patient: http://acme.org/p\npages:\n  index.md:\n    title: Home\n");
      writeFileSync(join(src, "input", "pagecontent", "index.md"), "# Home\n\n{% include globals-table.xhtml %}\n");
      const out = join(d, "out");
      const res = stageIgSite(src, out, {});
      expect(res.notRendered).not.toContain("globals-table.xhtml");
      expect(res.globals).toEqual({ from: "sushi-config.yaml (global)", rows: 1 });
      expect(JSON.parse(readFileSync(join(out, "_data", "fhir.json"), "utf-8")).globals).toEqual([{ type: "Patient", profile: "http://acme.org/p" }]);
      expect(describeStage(res)).toContain("globals table from sushi-config.yaml (global): 1 global profile(s)");
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});
