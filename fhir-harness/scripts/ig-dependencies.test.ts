import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dependencyRows, fromImplementationGuide, fromSushiConfig } from "./ig-dependencies";

const pkg = (cache: string, id: string, v: string, m: Record<string, unknown>) => {
  mkdirSync(join(cache, `${id}#${v}`, "package"), { recursive: true });
  writeFileSync(join(cache, `${id}#${v}`, "package", "package.json"), JSON.stringify({ name: id, version: v, ...m }));
};

describe("the IG's package dependencies (dependency-table.xhtml, bean 4475)", () => {
  test("declaredFromIgOrSushi", () => {
    expect(fromImplementationGuide({ dependsOn: [{ packageId: "a.b", version: "1.0.0", uri: "http://a/ImplementationGuide/a.b" }, { uri: "x" }] }))
      .toEqual([{ packageId: "a.b", version: "1.0.0", canonical: "http://a" }]);
    expect(fromSushiConfig({ dependencies: { "a.b": "1.0.0", "c.d": { id: "cd", version: "2.0.0", uri: "http://c/ImplementationGuide/c.d" } } }))
      .toEqual([{ packageId: "a.b", version: "1.0.0" }, { packageId: "c.d", version: "2.0.0", canonical: "http://c" }]);
    expect(fromSushiConfig({})).toEqual([]);
  });

  test("nestedFromPackageCache", () => {
    const cache = mkdtempSync(join(tmpdir(), "fhir-cache-"));
    pkg(cache, "a.b", "1.0.0", { title: "A B", canonical: "http://a", fhirVersions: ["4.0.1"], dependencies: { "hl7.fhir.r4.core": "4.0.1", "e.f": "3.0.0" } });
    pkg(cache, "hl7.fhir.r4.core", "4.0.1", { fhirVersions: ["4.0.1"], dependencies: { "never.shown": "1" } });
    pkg(cache, "c.d", "2.0.0", { title: "C D", fhirVersions: ["4.0.1"], dependencies: { "a.b": "1.0.0" } });
    const rows = dependencyRows([{ packageId: "a.b", version: "1.0.0" }, { packageId: "c.d", version: "2.0.0" }], cache);
    expect(rows.map((r) => `${"  ".repeat(r.depth)}${r.packageId}${r.resolved ? "" : " ?"}${r.repeat ? " (repeat)" : ""}`)).toEqual([
      "a.b",
      "  hl7.fhir.r4.core",
      "  e.f ?",
      "c.d",
      "  a.b (repeat)",
    ]);
    expect(rows[0]).toMatchObject({ title: "A B", canonical: "http://a", fhirVersion: "4.0.1" });
    rmSync(cache, { recursive: true, force: true });
  });

  test("templateRendersThreeForms", async () => {
    const { Liquid } = await import("liquidjs");
    const t = readFileSync(join(import.meta.dir, "templates", "ig-site", "dependency-table.liquid"), "utf-8");
    expect(t.startsWith("{%- comment -%}")).toBe(true);
    const liquid = new Liquid();
    const rows = [
      { packageId: "a.b", version: "1.0.0", depth: 0, title: "A B", canonical: "http://a", fhirVersion: "4.0.1", resolved: true },
      { packageId: "e.f", version: "3.0.0", depth: 1, resolved: false },
    ];
    const render = (form: string, deps: unknown) => liquid.parseAndRender(t, { site: { data: { fhir: { dependencies: deps } } }, include: { form } });
    const full = await render("full", rows);
    expect(full).toContain('<a href="http://a">A B</a>');
    expect(full).toContain("simplifier.net/packages/e.f/3.0.0");
    expect(full).toContain("not in the package cache");
    const short = await render("short", rows);
    expect(short).toContain("a.b#1.0.0");
    expect(short).not.toContain("e.f#3.0.0");
    expect(await render("nontech", rows)).toContain("<li>A B</li>");
    expect(await render("full", [])).toContain("declares no package dependencies");
  });
});
