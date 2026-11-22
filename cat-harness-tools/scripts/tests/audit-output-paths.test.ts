/**
 * Machine-generated audit output must not land in `beans/` or `todos/`,
 * and benchmark runners must not write into declared graph directories.
 *
 * `AGENTS.md` is explicit about both:
 *
 * - *"Do not stand up a separate todo store (no API route, dashboard, or
 *   `todos/*.json` work-plan); beans is it."*
 * - *"`beans ≠ sidecars`: never `beans create` bulk machine-generated queues
 *   … keep those as bulk JSON."* — `beans/` holds the work plan, not bulk
 *   output.
 *
 * Four pipeline scripts defaulted into those two directories anyway. Nothing
 * noticed, because every one of them was unreachable from a scaffolded folio
 * until the pipeline-resolution fix; the first run after it dirtied the
 * folio's git status with two files in forbidden locations.
 *
 * `build/` is gitignored in every folio layout, including what `folio_init`
 * scaffolds — `todos/` was not, which is why the docstring claiming otherwise
 * was wrong outside the `qou` repo it was written in.
 *
 * Benchmark runners (issue #363, bean folio-assistant-wp49):
 * Benchmarking output is a report about model performance across configurations,
 * and is deliberately excluded from declared KG graphs. Runners default output
 * to `build/benchmarks/` and are guarded against writing to any declared graph.
 */
import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import {
  assertBenchmarkOutputPath,
  isDeclaredGraphPath,
  getDeclaredGraphDirectories,
} from "../benchmark-guard";

const PIPELINE = join(import.meta.dir, "../../pipeline");
const SCRIPTS = join(import.meta.dir, "..");

/** Scripts that write a machine-generated worklist or report. */
const WRITERS = [
  "audit-status-sections.ts",
  "extract-status-sections.ts",
  "qa-agent-drain-queue.ts",
  "qa-section-title-audit.ts",
];

/** Benchmark runners that score model performance across tasks. */
const BENCHMARK_RUNNERS = [
  "toc-benchmark.py",
  "page-label-benchmark.py",
  "formula-benchmark.py",
];

/**
 * A quoted `beans/<name>.json` or `todos/<name>.json` string literal, in
 * double or single quotes. Not backticks: those also quote paths in prose
 * comments ("Was hardcoded to `todos/…`"), which name a retired default.
 */
const FORBIDDEN_BEANS = /["']beans\/[\w-]+\.json["']/;
const FORBIDDEN_TODOS = /["']todos\/[\w-]+\.json["']/;

describe("audit output paths", () => {
  test("the forbidden-path patterns match the literals they exist to catch", () => {
    // `"\beans/…"` read `\b` as a word boundary and could never match a
    // `beans/` literal: a pattern is only a check once it is seen to fire.
    for (const q of ['"', "'"]) {
      expect(`const out = ${q}beans/status-sections.json${q};`).toMatch(FORBIDDEN_BEANS);
      expect(`const out = ${q}todos/status-sections.json${q};`).toMatch(FORBIDDEN_TODOS);
    }
    expect('const out = "build/status-sections.json";').not.toMatch(FORBIDDEN_BEANS);
    expect('const out = "build/beans-status.json";').not.toMatch(FORBIDDEN_BEANS);
  });

  describe.each([...WRITERS])("%s", (file) => {
    const src = readFileSync(join(PIPELINE, file), "utf-8");

    test("does not default into beans/ or todos/", () => {
      // String literals only — a path assembled at runtime would slip past
      // this, but all four spell theirs out, which is what made the drift
      // invisible and is also what makes it checkable.
      expect(src).not.toMatch(FORBIDDEN_BEANS);
      expect(src).not.toMatch(FORBIDDEN_TODOS);
    });

    test("defaults into build/", () => {
      expect(src).toMatch(/"build\/[\w-]+\.json"/);
    });
  });

  test("qa-section-title-audit honours --out like its three siblings", () => {
    // It was the only one with a hardcoded path and no way to redirect it.
    const src = readFileSync(join(PIPELINE, "qa-section-title-audit.ts"), "utf-8");
    expect(src).toContain('indexOf("--out")');
  });
});

describe("benchmark runner output paths and graph isolation (folio-assistant-wp49)", () => {
  const declaredGraphDirs = getDeclaredGraphDirectories(SCRIPTS);

  describe.each([...BENCHMARK_RUNNERS])("%s", (runner) => {
    const src = readFileSync(join(SCRIPTS, runner), "utf-8");

    test("does not default into beans/ or todos/", () => {
      expect(src).not.toMatch(/default=["'][.]?[\/\\]?beans[\/\\]/);
      expect(src).not.toMatch(/default=["'][.]?[\/\\]?todos[\/\\]/);
    });

    test("does not default into any declared graph directory", () => {
      for (const gDir of declaredGraphDirs) {
        const pattern = new RegExp(`default=["'][.]?[\\/\\\\]?${gDir.replace("/", "[\\/\\\\]")}[\\/\\\\]`);
        expect(src).not.toMatch(pattern);
      }
    });

    test("defaults its output into build/benchmarks/", () => {
      expect(src).toMatch(/default=["']build\/benchmarks\/[\w-]+\.json["']/);
    });
  });

  test("isDeclaredGraphPath detects all declared graph paths", () => {
    expect(isDeclaredGraphPath("beans/test.json").isGraph).toBeTrue();
    expect(isDeclaredGraphPath("todos/items.json").isGraph).toBeTrue();
    expect(isDeclaredGraphPath("test/results/qa.json").isGraph).toBeTrue();
    expect(isDeclaredGraphPath("test/attestations/att.json").isGraph).toBeTrue();
    expect(isDeclaredGraphPath("library/item.json").isGraph).toBeTrue();
    expect(isDeclaredGraphPath("schemas/node.json").isGraph).toBeTrue();
    expect(isDeclaredGraphPath("skills/sdlc/test.json").isGraph).toBeTrue();
  });

  test("isDeclaredGraphPath allows non-graph report paths", () => {
    expect(isDeclaredGraphPath("build/benchmarks/toc.json").isGraph).toBeFalse();
    expect(isDeclaredGraphPath("build/results.json").isGraph).toBeFalse();
    expect(isDeclaredGraphPath("reports/benchmark-report.json").isGraph).toBeFalse();
  });

  test("assertBenchmarkOutputPath throws for graph destinations and allows reports", () => {
    expect(() => assertBenchmarkOutputPath("beans/output.json")).toThrow(/declared graph directory "beans"/);
    expect(() => assertBenchmarkOutputPath("test/results/benchmark.json")).toThrow(/declared graph directory "test\/results"/);
    expect(() => assertBenchmarkOutputPath("todos/bench.json")).toThrow(/declared graph directory "todos"/);

    // Non-graph paths do not throw
    expect(() => assertBenchmarkOutputPath("build/benchmarks/toc.json")).not.toThrow();
    expect(() => assertBenchmarkOutputPath("reports/toc-synthesis.json")).not.toThrow();
  });

  test("Python benchmark guard rejects graph paths and allows build/benchmarks/", () => {
    const pyGuard = join(SCRIPTS, "_benchmark_guard.py");

    const okRun = spawnSync("python3", ["-B", pyGuard, "build/benchmarks/run.json"], { encoding: "utf-8" });
    expect(okRun.status).toBe(0);

    const beansRun = spawnSync("python3", ["-B", pyGuard, "beans/run.json"], { encoding: "utf-8" });
    expect(beansRun.status).toBe(1);
    expect(beansRun.stderr).toContain("resolves inside declared graph directory 'beans'");

    const qaRun = spawnSync("python3", ["-B", pyGuard, "test/results/run.json"], { encoding: "utf-8" });
    expect(qaRun.status).toBe(1);
    expect(qaRun.stderr).toContain("resolves inside declared graph directory 'test/results'");
  });
});
