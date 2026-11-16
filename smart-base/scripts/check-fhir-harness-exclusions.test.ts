/**
 * The fhir-harness exclusion gate, seen failing on planted violations — a
 * boundary check never seen failing checks nothing (`4j3h`, `q2wn`, `p11x`).
 *
 * Calibrated 2026-10-03: emptying `BASELINE` makes the real run exit 1 with
 * 9 NEW pairs; restoring it exits 0.
 */
import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";

import { BASELINE } from "./fhir-harness-exclusions.baseline.ts";
import { MOVED_DOWN, codeOf, dakStepNames, judge, pathHits, rules, scan } from "./check-fhir-harness-exclusions.ts";

const root = resolve(import.meta.dir, "..", "..");
const rs = rules(root);
const one = (path: string, text: string) => scan([{ path, text }], rs);

describe("a mention is not a dependency", () => {
  it("docblockMentionNotGraded", () => {
    const r = one("fhir-harness/x.ts", "/** never reference smart.who.int */\nexport const x = 1;\n");
    expect(r.graded).toEqual([]);
    expect(r.mentions).toBe(1);
  });
  it("regexQuotesDoNotOpenString", () => {
    const src = 'const m = s.matchAll(/href="([^"]+)"/g);\nconst half = a / b; // c / d\n// smart-base/ is named in a comment\nexport const x = 1;\n';
    expect(one("fhir-harness/r.ts", src).graded).toEqual([]);
    expect(codeOf(src)).toContain('/href="([^"]+)"/g');
  });
  it("markdownPageIsProse", () => {
    expect(one("fhir-harness/skills/a.md", "No `dak.config.json` here.").graded).toEqual([]);
  });
  it("jsonCommentProseOtherValuesGraded", () => {
    const r = one("fhir-harness/a.json", JSON.stringify({ _comment: "smart.who.int", description: "smart.who.int", canonical: "http://smart.who.int/x" }));
    expect(r.graded).toEqual([{ file: "fhir-harness/a.json", rule: "who-canonical", count: 1 }]);
    expect(r.mentions).toBe(2);
  });
  it("bpmnDocsProseImportLocationGraded", () => {
    const xml = `<!-- smart-base/ -->\n<bpmn:documentation>smart-base/x</bpmn:documentation>\n<bpmn:import location="../../../smart-base/p.bpmn"/>`;
    expect(one("fhir-harness/p.bpmn", xml).graded.map((h) => [h.rule, h.count])).toEqual([["who-layer-path", 1]]);
  });
});

describe("planted dependencies are graded", () => {
  it("templateLiteralDakLabelGraded", () => {
    expect(codeOf("const p = `${s} DAK API`; // smart.who.int")).toContain("DAK API");
    expect(one("fhir-harness/s.ts", "const label = `${s} DAK API`;").graded[0]!.rule).toBe("dak-naming");
  });
  it("igApiSidecarsNotAHit", () => {
    const src = "const files = [`schemas/${s}.schema.json`, `schemas/${s}.displays.json`, `schemas/${s}.openapi.json`];";
    expect(one("fhir-harness/s.ts", src).graded).toEqual([]);
  });
  it("dakNamesAreHits", () => {
    for (const src of ['const hub = "dak-api.html";', "export function dakViews() {}", 'import "./dak-views.ts";']) {
      expect(one("fhir-harness/s.ts", src).graded.some((h) => h.rule === "dak-naming")).toBe(true);
    }
  });
  it("dakFileNameIsHit", () => {
    expect(pathHits(["fhir-harness/scripts/templates/ig-pages/dak-api.liquid", "fhir-harness/scripts/dak-views.ts"])).toHaveLength(2);
    expect(pathHits(["fhir-harness/scripts/ig-api-views.ts", "fhir-harness/scripts/gen-ig-pages.ts"])).toEqual([]);
  });
  it("readingDakConfigJsonGraded", () => {
    expect(one("fhir-harness/s.ts", 'readFileSync("dak.config.json")').graded[0]!.rule).toBe("dak-config");
  });
  it("readingIndexDakSectionGraded", () => {
    expect(one("fhir-harness/s.ts", "const d = cfg.contentTypes.dak;").graded[0]!.rule).toBe("dak-config");
    expect(one("fhir-harness/s.ts", 'const d = cfg.contentTypes["dak"];').graded[0]!.rule).toBe("dak-config");
    expect(one("fhir-harness/s.sh", "python3 input/scripts/dak_index.py .").graded[0]!.rule).toBe("dak-config");
    expect(one("fhir-harness/s.ts", "const t = cfg.contentTypes.paper;").graded).toEqual([]);
  });
  it("dakStepInvocationGraded", () => {
    const step = dakStepNames(root)[0]!;
    expect(one("fhir-harness/s.sh", `python3 ${step}`).graded[0]!.rule).toBe("dak-step");
    expect(one("fhir-harness/s.sh", `# ${step}`).graded).toEqual([]);
  });
  it("importingWhoPackageGraded", () => {
    expect(one("fhir-harness/s.ts", 'import x from "../../smart-base/skills/content/authoring-who-smart-guidelines/a.ts";').graded.map((h) => h.rule).sort()).toEqual([
      "who-layer-path",
      "who-package",
    ]);
  });
  it("bareSchemaJsonNotGraded", () => {
    expect(one("fhir-harness/s.ts", 'const p = "ig-ast.schema.json";').graded).toEqual([]);
  });
});

describe("the DAK step names come from smart-base's own tables", () => {
  it("dakStepNamesFromBothTables", () => {
    const names = dakStepNames(root);
    expect(names).toContain("generate_dak_from_sushi.py");
    expect(names).toContain("generate_dak_api_hub.py");
    for (const m of MOVED_DOWN) expect(names).not.toContain(m);
  });
});

describe("the ratchet", () => {
  const hit = { file: "fhir-harness/a.ts", rule: "who-canonical", count: 2 };
  const entry = { ...hit, reason: "r", bean: "b" };
  it("unbaselinedHitIsRegression", () => {
    expect(judge([hit], []).regressions).toHaveLength(1);
  });
  it("hitAboveBaselineIsRegression", () => {
    expect(judge([{ ...hit, count: 3 }], [entry]).regressions).toHaveLength(1);
  });
  it("hitAtBaselinePasses", () => {
    expect(judge([hit], [entry])).toEqual({ regressions: [], stale: [] });
  });
  it("clearedHitLeavesBaselineStale", () => {
    expect(judge([], [entry]).stale).toHaveLength(1);
    expect(judge([{ ...hit, count: 1 }], [entry]).stale).toHaveLength(1);
  });
  it("baselineEntriesNameRuleReasonBean", () => {
    const ids = new Set(rs.map((r) => r.id));
    for (const b of BASELINE) {
      expect(ids.has(b.rule)).toBe(true);
      expect(b.reason.length).toBeGreaterThan(20);
      expect(b.bean).toMatch(/^folio-assistant-[a-z0-9]{4}$/);
    }
  });
});
