/**
 * Liquid value references resolve ONCE, the same way, for every target
 * (bean `kott`, issue #1564). The falsifier for the whole design is the
 * cross-target test: one fixture, and the PDF path and the site path must
 * print the same text.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { writeDeclaration } from "../test/support/instance-fixture";
import {
  buildValueScope,
  configureValueScope,
  resolveKey,
  substituteLiquidValues,
  type ValueScope,
} from "./liquid-values";
import { markdownToLatex } from "./render-latex";
import { renderBlockMarkdown } from "./render-markdown";

let repo: string;
let scope: ValueScope;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "liquid-values-"));
  // A folio with a declared `computations` directory holding a witness.
  const demo = join(repo, "demo");
  mkdirSync(join(demo, "computations"), { recursive: true });
  writeFileSync(
    join(demo, "computations", "codata-masses.witness.json"),
    JSON.stringify({ commitSha: "abc123", scriptHash: "def456", data: { m_e_MeV: "0.51099895069" } }),
  );
  mkdirSync(join(demo, "stray"), { recursive: true });
  writeFileSync(join(demo, "stray", "x.witness.json"), JSON.stringify({ data: { v: 1 } }));
  writeDeclaration(demo, {
    name: "demo",
    version: "1.2.3",
    directories: [{ id: "computations", path: "computations/", graphTypologies: ["skills"] }],
  });
  // An IG-style layer whose prefix is handed to Jekyll / the IG Publisher.
  const ig = join(repo, "ig");
  mkdirSync(ig, { recursive: true });
  writeDeclaration(ig, { name: "ig", liquid: { prefix: "site.data", passThrough: true }, directories: [] });
  scope = buildValueScope(repo);
  configureValueScope(scope);
});
afterAll(() => {
  configureValueScope(undefined);
  rmSync(repo, { recursive: true, force: true });
});

describe("addressing", () => {
  test("a witness under a DECLARED directory resolves, with provenance", () => {
    const r = resolveKey("demo.computations.codata-masses.data.m_e_MeV", scope);
    expect(r.state).toBe("resolved");
    if (r.state !== "resolved") return;
    expect(r.text).toBe("0.51099895069");
    expect(r.provenance).toEqual({
      file: "demo/computations/codata-masses.witness.json",
      path: "data.m_e_MeV",
      commitSha: "abc123",
      scriptHash: "def456",
    });
  });

  test("a declaration scalar resolves: {{ demo.version }}", () => {
    const r = resolveKey("demo.version", scope);
    expect(r.state === "resolved" && r.text).toBe("1.2.3");
  });

  test("an UNDECLARED directory is not addressable, even though the file exists", () => {
    const r = resolveKey("demo.stray.x.data.v", scope);
    expect(r.state).toBe("unresolved");
  });

  test("a pass-through prefix and a foreign one are left for Jekyll", () => {
    expect(resolveKey("site.data.fhir.ig.version", scope).state).toBe("pass-through");
    expect(resolveKey("page.title", scope).state).toBe("not-ours");
  });
});

describe("substitution", () => {
  test("precision is significant digits; no filter prints the stored value", () => {
    const { text } = substituteLiquidValues(
      "a {{ demo.computations.codata-masses.data.m_e_MeV | precision: 4 }} b {{ demo.computations.codata-masses.data.m_e_MeV }}",
      scope,
    );
    expect(text).toBe("a 0.5110 b 0.51099895069");
  });

  test("site.data and page.* survive untouched for Jekyll / the IG Publisher", () => {
    const src = "v {{ site.data.fhir.ig.version }} t {{ page.title }}";
    expect(substituteLiquidValues(src, scope).text).toBe(src);
  });

  test("an unresolved own reference is VISIBLE and reported, never an empty string", () => {
    const { text, report } = substituteLiquidValues("x {{ demo.computations.nope.data.v }} y", scope);
    expect(text).toBe("x ⟦unresolved: demo.computations.nope.data.v⟧ y");
    expect(report.unresolved.map((u) => u.key)).toEqual(["demo.computations.nope.data.v"]);
  });

  test("an unknown filter is reported, not ignored", () => {
    const { report } = substituteLiquidValues("{{ demo.version | round: 2 }}", scope);
    expect(report.unresolved[0]!.reason).toContain("unknown filter");
  });
});

describe("one value, every target", () => {
  const md = "The electron mass is {{ demo.computations.codata-masses.data.m_e_MeV | precision: 6 }} MeV, $m_e = {{ demo.computations.codata-masses.data.m_e_MeV | precision: 6 }}$.";

  test("the PDF path and the site path print the same number, in prose and in math", () => {
    const latex = markdownToLatex(md);
    const site = renderBlockMarkdown({ block: { kind: "remark", label: "rem:m" } as never, mdContent: md } as never);
    for (const out of [latex, site]) {
      expect(out.match(/0\.510999/g)?.length).toBe(2);
      expect(out).not.toContain("{{");
    }
  });
});
