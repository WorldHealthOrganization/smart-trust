import { describe, expect, test } from "bun:test";
import {
  calculateChangeSize,
  classifyFilePath,
  DEFAULT_CHANGE_SIZE_THRESHOLD,
  formatSc005Metric,
} from "../../../schemas/sdlc/change-size.ts";

describe("classifyFilePath — file categorization", () => {
  test("identifies executable code files", () => {
    expect(classifyFilePath("cat-harness/scripts/check-spec.ts")).toBe("code");
    expect(classifyFilePath("src/index.js")).toBe("code");
    expect(classifyFilePath("pipeline/runner.py")).toBe("code");
    expect(classifyFilePath("scripts/build.sh")).toBe("code");
  });

  test("identifies prose and knowledge graph documentation files", () => {
    expect(classifyFilePath("README.md")).toBe("prose_kg");
    expect(classifyFilePath("cat-harness/sdlc/skills/spec-kit/spec-kit.md")).toBe("prose_kg");
    expect(classifyFilePath("skills/authoring/intro.md")).toBe("prose_kg");
    // declared-path-literal: fixture path to test classifier on real documentation files
    expect(classifyFilePath("docs/guides/agent-onboarding.md")).toBe("prose_kg");
  });

  test("identifies exempt files (lockfiles, generated QA sidecars, build artifacts)", () => {
    expect(classifyFilePath("bun.lock")).toBe("exempt");
    expect(classifyFilePath("package-lock.json")).toBe("exempt");
    expect(classifyFilePath("cat-harness/test/results/kg-export.qa.json")).toBe("exempt");
    expect(classifyFilePath("library/mcp/prose-001.jsonld")).toBe("exempt");
    expect(classifyFilePath("_site/index.html")).toBe("exempt");
    expect(classifyFilePath("dist/bundle.js")).toBe("exempt");
  });
});

describe("calculateChangeSize — weights, threshold and exemptions", () => {
  test("code is weighted at 1.0", () => {
    const files = [{ path: "src/logic.ts", linesChanged: 200 }];
    const result = calculateChangeSize(files);
    expect(result.codeLines).toBe(200);
    expect(result.proseKgLines).toBe(0);
    expect(result.exemptLines).toBe(0);
    expect(result.effectiveLines).toBe(200);
    expect(result.exceedsThreshold).toBe(false);
  });

  test("prose and KG documentation are weighted at 0.25 (4x line allowance)", () => {
    const files = [{ path: "skills/guide.md", linesChanged: 800 }];
    const result = calculateChangeSize(files);
    expect(result.codeLines).toBe(0);
    expect(result.proseKgLines).toBe(800);
    expect(result.exemptLines).toBe(0);
    // 800 * 0.25 = 200 effective lines
    expect(result.effectiveLines).toBe(200);
    expect(result.exceedsThreshold).toBe(false);
  });

  test("exempt files (lockfiles, generated) contribute zero effective lines", () => {
    const files = [
      { path: "bun.lock", linesChanged: 5000 },
      { path: "test/results/report.qa.json", linesChanged: 1000 },
      { path: "src/feature.ts", linesChanged: 150 },
    ];
    const result = calculateChangeSize(files);
    expect(result.codeLines).toBe(150);
    expect(result.exemptLines).toBe(6000);
    expect(result.effectiveLines).toBe(150);
    expect(result.exceedsThreshold).toBe(false);
  });

  test("exceeds threshold when effective lines cross 400", () => {
    const files = [
      { path: "src/a.ts", linesChanged: 300 },
      { path: "src/b.ts", linesChanged: 150 },
    ];
    const result = calculateChangeSize(files);
    expect(result.effectiveLines).toBe(450);
    expect(result.exceedsThreshold).toBe(true);
  });

  test("mixed code and prose calculation accurately combines weighted lines", () => {
    const files = [
      { path: "src/controller.ts", linesChanged: 250 }, // 250 * 1.0 = 250
      { path: "docs/architecture.md", linesChanged: 400 }, // 400 * 0.25 = 100
      { path: "bun.lock", linesChanged: 2000 }, // 0
    ];
    const result = calculateChangeSize(files);
    expect(result.codeLines).toBe(250);
    expect(result.proseKgLines).toBe(400);
    expect(result.exemptLines).toBe(2000);
    expect(result.effectiveLines).toBe(350);
    expect(result.exceedsThreshold).toBe(false);
  });
});

describe("DEFAULT_CHANGE_SIZE_THRESHOLD — structural basis", () => {
  test("threshold structurally carries non-empty basis, metric, limit and mode", () => {
    expect(DEFAULT_CHANGE_SIZE_THRESHOLD.metric).toBe("effective_lines");
    expect(DEFAULT_CHANGE_SIZE_THRESHOLD.limit).toBe(400);
    expect(DEFAULT_CHANGE_SIZE_THRESHOLD.mode).toBe("report");
    expect(DEFAULT_CHANGE_SIZE_THRESHOLD.basis.length).toBeGreaterThan(20);
    expect(DEFAULT_CHANGE_SIZE_THRESHOLD.basis).toContain("Cohen et al., 2006");
    expect(DEFAULT_CHANGE_SIZE_THRESHOLD.basis).toContain("Google Modern Code Review");
    expect(DEFAULT_CHANGE_SIZE_THRESHOLD.weights.code).toBe(1.0);
    expect(DEFAULT_CHANGE_SIZE_THRESHOLD.weights.prose_kg).toBe(0.25);
  });
});

describe("formatSc005Metric — SC-005 formatting", () => {
  test("formats compliance as count with denominator, never bare percentage", () => {
    expect(formatSc005Metric(4, 32)).toBe("4 of 32 PRs (12.5%)");
    expect(formatSc005Metric(0, 10)).toBe("0 of 10 PRs (0.0%)");
    expect(formatSc005Metric(0, 0)).toBe("0 of 0 PRs (0%)");
  });
});
