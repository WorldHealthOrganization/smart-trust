/**
 * values.jsonld: every reference in a folio's Markdown is a node, resolved as
 * the renderers resolve it, and one that does not resolve is listed with its
 * reason rather than left out (owner, 2026-10-14).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { writeDeclaration } from "../test/support/instance-fixture";
import { buildValueScope } from "./liquid-values";
import { valuesGraph } from "./gen-values-jsonld";

let repo: string;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "values-jsonld-"));
  const demo = join(repo, "demo");
  mkdirSync(join(demo, "computations"), { recursive: true });
  writeFileSync(join(demo, "computations", "masses.witness.json"), JSON.stringify({ data: { m: "0.51099895069" } }));
  writeDeclaration(demo, { name: "demo", directories: [{ id: "computations", path: "computations/", graphTypologies: ["code"] }] });
  const ig = join(repo, "ig");
  mkdirSync(ig, { recursive: true });
  writeDeclaration(ig, { name: "ig", liquid: { prefix: "site.data", passThrough: true } } as never);
  const ch = join(repo, "folio", "paper", "ch1");
  mkdirSync(ch, { recursive: true });
  writeFileSync(
    join(ch, "a.md"),
    "m = {{ demo.computations.masses.data.m | precision: 3 }}; again {{ demo.computations.masses.data.m | precision: 3 }}.\n" +
      "Missing {{ demo.computations.masses.data.nope }}; IG {{ site.data.fhir.version }}; page {{ page.title }}.\n",
  );
  writeFileSync(join(ch, "b.md"), "Raw {{ demo.computations.masses.data.m }}.\n");
});
afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("values.jsonld", () => {
  test("one node per distinct reference, each with its state", () => {
    const g = valuesGraph(repo, buildValueScope(repo))["@graph"];
    const by = Object.fromEntries(g.map((n) => [n.reference, n]));
    expect(Object.keys(by).sort()).toEqual([
      "demo.computations.masses.data.m",
      "demo.computations.masses.data.m | precision: 3",
      "demo.computations.masses.data.nope",
      "site.data.fhir.version",
    ]);
    const p3 = by["demo.computations.masses.data.m | precision: 3"]!;
    expect(p3.state).toBe("resolved");
    expect(p3.formatted).toBe("0.511");
    expect(p3.value).toBe("0.51099895069");
    expect(p3.provenance?.file).toBe("demo/computations/masses.witness.json");
    // Used twice in one file: listed once.
    expect(p3.usedIn).toEqual(["folio/paper/ch1/a.md"]);
    expect(by["demo.computations.masses.data.m"]!.usedIn).toEqual(["folio/paper/ch1/b.md"]);
  });

  test("an unresolved reference is a node with its reason, a pass-through one awaits its pipeline, a foreign one is not ours", () => {
    const g = valuesGraph(repo, buildValueScope(repo))["@graph"];
    const nope = g.find((n) => n.key.endsWith(".nope"))!;
    expect(nope.state).toBe("unresolved");
    expect(nope.reason).toContain('no scalar at "data.nope"');
    expect(g.find((n) => n.key === "site.data.fhir.version")!.state).toBe("pass-through");
    expect(g.some((n) => n.key.startsWith("page."))).toBe(false);
  });
});
