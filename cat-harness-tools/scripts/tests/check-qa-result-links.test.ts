/**
 * check:qa-result-links, bean `bejf` (issue #2217): the rule over plain
 * inputs, including the exact URL the owner found dead on `/fr/`.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkSite, judgeBlobMainPath, judgeProjection, scanText, type QaDirDecl } from "../check-qa-result-links.ts";

const DIRS: QaDirDecl[] = [
  { path: "cat-harness/test/results", stored: true },
  { path: "legacy/test/results", stored: false },
];
const G = "https://github.com/litlfred/folio-assistant";

describe("judgeBlobMainPath", () => {
  test("the owner's dead link: an instance-relative test/results path", () => {
    // declared-path-literal: a test vector for judgeBlobMainPath, a pure string judge; the path is the
    // dead link the owner reported, and whether a working copy holds it is not what is asserted (bean `7mwa`).
    expect(judgeBlobMainPath("test/results/translation-qa/docs/index.ar.translation-qa.json", DIRS)).toContain("instance-relative");
  });
  test("a stored directory's file addressed on main", () => {
    expect(judgeBlobMainPath("cat-harness/test/results/kg-qa/x.kg-qa.json", DIRS)).toContain("declares storage");
  });
  test("an unstored qa directory keeps its main link", () => {
    expect(judgeBlobMainPath("legacy/test/results/a.json", DIRS)).toBeUndefined();
  });
  test("an authored file is none of this gate's business", () => {
    expect(judgeBlobMainPath("cat-harness/sdlc/skills/sdlc-core/qa-reports.md", DIRS)).toBeUndefined();
  });
});

describe("scanText", () => {
  test("finds each offending URL with its line, and passes a branch address", () => {
    const text = [
      `ok <a href="${G}/blob/cat/cat-harness/qa-reports/main/${"a".repeat(40)}/cat-harness/test/results/x.json">`,
      `bad "${G}/blob/main/test/results/translation-qa/docs/index.ar.translation-qa.json"`,
      `bad ${G}/blob/main/cat-harness/test/results/kg-qa/p.kg-qa.json)`,
    ].join("\n");
    const f = scanText(text, DIRS, "x.html");
    expect(f.map((x) => x.line)).toEqual([2, 3]);
  });
});

describe("judgeProjection", () => {
  const base = { $schema: "qa-witness/v1", sidecars: ["test/results/a.json"] };
  test("not a projection: not judged, and not counted", () => {
    expect(judgeProjection({ $schema: "other/v1" }, DIRS, "f").projection).toBe(false);
  });
  test("an unstamped projection is a finding: the panel would have nothing to link", () => {
    expect(judgeProjection(base, DIRS, "f").findings).toHaveLength(1);
  });
  test("a stored result addressed on main is a finding", () => {
    const doc = { ...base, sidecarLinks: [{ path: "cat-harness/test/results/a.json", addressedBy: "main", href: `${G}/blob/main/cat-harness/test/results/a.json` }] };
    expect(judgeProjection(doc, DIRS, "f").findings.length).toBeGreaterThan(0);
  });
  test("a stored result addressed on its entry is clean", () => {
    const doc = {
      ...base,
      sidecarLinks: [{ path: "cat-harness/test/results/a.json", addressedBy: "entry", href: `${G}/blob/cat/cat-harness/qa-reports/main/${"a".repeat(40)}/cat-harness/test/results/a.json` }],
    };
    expect(judgeProjection(doc, DIRS, "f")).toEqual({ projection: true, findings: [] });
  });
});

describe("checkSite", () => {
  test("counts projections, so an empty site can be told from a clean one", () => {
    const dir = mkdtempSync(join(tmpdir(), "qa-links-"));
    try {
      mkdirSync(join(dir, "assets", "qa", "p"), { recursive: true });
      writeFileSync(join(dir, "index.html"), "<p>nothing</p>");
      expect(checkSite(dir, DIRS).projections).toBe(0);
      writeFileSync(join(dir, "assets", "qa", "p", "k.json"), JSON.stringify({ $schema: "qa-witness/v1", sidecars: [], sidecarLinks: [] }));
      expect(checkSite(dir, DIRS)).toMatchObject({ projections: 1, findings: [] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
