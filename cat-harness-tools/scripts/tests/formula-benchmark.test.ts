/**
 * The formula benchmark — `formula-benchmark.py`.
 *
 * Each claim is made against an entry and a LaTeX source this file builds, so
 * the expected recall is known before the script runs.
 *
 * @module scripts/tests/formula-benchmark
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPTS = new URL("..", import.meta.url).pathname;
const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

interface Fixture {
  root: string;
  entry: string;
  tgz: string;
}

/** An entry whose sections hold `text`, and a source whose sections hold `tex`. */
function fixture(text: Record<string, string>, tex: Record<string, string>, fm: string[] = []): Fixture {
  const root = mkdtempSync(join(tmpdir(), "fbench-"));
  made.push(root);
  const entry = join(root, "library", "arxiv-0705.1468v1");
  mkdirSync(join(entry, "sections"), { recursive: true });
  const sections = Object.keys(text).map((title, i) => ({ id: `sec-00${i}`, title, level: 1 }));
  writeFileSync(join(entry, "structure.json"), JSON.stringify({ _schema: "pdf-structure/v1", sections }));
  for (const [i, t] of Object.values(text).entries()) {
    writeFileSync(join(entry, "sections", `sec-00${i}.md`), `---\nsection_id: sec-00${i}\n${fm.join("\n")}${fm.length ? "\n" : ""}---\n${t}\n`);
  }
  const src = join(root, "src");
  mkdirSync(src);
  const body = Object.entries(tex)
    .map(([title, t]) => `\\section{${title}}\n${t}\n`)
    .join("");
  writeFileSync(join(src, "main.tex"), `\\documentclass{article}\n\\begin{document}\n${body}\\end{document}\n`);
  if (Bun.spawnSync(["sh", "-c", "tar czf ../e-print.tgz ."], { cwd: src }).exitCode !== 0) throw new Error("tar failed");
  return { root, entry, tgz: join(root, "e-print.tgz") };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a JSON report, read by path in the assertions
function bench(f: Fixture, ...args: string[]): { code: number; out: any; err: string } {
  const r = Bun.spawnSync(["python3", join(SCRIPTS, "formula-benchmark.py"), f.entry, "--source", f.tgz, "--stdout-json", ...args], {
    cwd: f.root,
  });
  const out = new TextDecoder().decode(r.stdout);
  return { code: r.exitCode, out: out ? JSON.parse(out) : null, err: new TextDecoder().decode(r.stderr) };
}

const INTRO = "Introduction";
const LATEX = "We study $\\phi:\\mathbb{R}^3\\to S^2$ and $x^2+y^2=z^2$ and also $\\int_0^1 f(t)\\,dt = \\frac{\\pi}{4}$.";

describe("formula-benchmark", () => {
  test("a text layer is scored formula by formula: exact, fuzzy and missed", () => {
    // The first two survive the text layer exactly (up to the glyph table);
    // the third loses its limits and fraction, so it is at best a near miss.
    const f = fixture({ [INTRO]: "We study φ: R3 → S2 and x2 + y 2 = z2 and also ∫ f (t)dt = π/4." }, { [INTRO]: LATEX });
    const { code, out } = bench(f);
    expect(code).toBe(0);
    const sec = out.reports[0].sections[0];
    expect(sec.result).toBe("scored");
    expect(sec.formulas).toBe(3);
    expect(sec.matches.map((m: { stage: string }) => m.stage).slice(0, 2)).toEqual(["exact", "exact"]);
    expect(sec.matches[2].stage).not.toBe("exact");
    expect(sec.recall_exact).toBeCloseTo(2 / 3, 2);
    expect(out.formulas).toBe(3);
  });

  test("the threshold decides fuzzy against missed", () => {
    const f = fixture({ [INTRO]: "and x2 + y2 = z3 there" }, { [INTRO]: "and $x^2+y^2=z^2$ there" });
    expect(bench(f, "--threshold", "0.2").out.reports[0].sections[0].matches[0].stage).toBe("fuzzy");
    expect(bench(f, "--threshold", "0.05").out.reports[0].sections[0].matches[0].stage).toBe("missed");
  });

  test("an overlaid section is not scored against itself", () => {
    const f = fixture({ [INTRO]: LATEX }, { [INTRO]: LATEX }, ["text_source: latex"]);
    const { out } = bench(f);
    expect(out.reports[0].sections[0].result).toMatch(/^overlaid/);
    expect(out.formulas).toBe(0);
    expect(out.recall).toBeNull();
  });

  test("sections are paired by title, never by position", () => {
    const f = fixture({ "Rational maps": "x2 + y2 = z2" }, { "Something else entirely": "$x^2+y^2=z^2$" });
    const { out } = bench(f);
    expect(out.reports[0].sections[0].result).toBe("no matching \\section");
    expect(out.formulas).toBe(0);
  });

  test("an entry with no source is skipped with a reason, not scored zero", () => {
    const f = fixture({ [INTRO]: "x" }, { [INTRO]: "$x$" });
    const r = Bun.spawnSync(["python3", join(SCRIPTS, "formula-benchmark.py"), f.entry, "--stdout-json"], { cwd: f.root });
    const out = JSON.parse(new TextDecoder().decode(r.stdout));
    expect(r.exitCode).toBe(0);
    expect(out.reports[0].status).toBe("skipped");
    expect(out.reports[0].reason).toContain("arxiv-source.py");
    expect(out.reports[0].recall).toBeUndefined();
  });

  test("the report is refused inside a graph directory", () => {
    const f = fixture({ [INTRO]: "x2" }, { [INTRO]: "$x^2$" });
    const { code, err } = bench(f, "--json", "library/formula.json");
    expect(code).not.toBe(0);
    expect(err).toContain("declared graph directory");
  });
});

describe("formula-benchmark stage 3 — judge verdicts read as data (#130)", () => {
  const agent = { kind: "agent", id: "claude-code", model: "test-model" };
  // `\\frac{a}{b}` printed as a/b: the string stages miss it, a judge would not.
  const TEXT = "the ratio a/b and the sum x+y";
  const TEX = "the ratio $\\frac{a}{b}$ and the sum $x+y$";

  function queue(f: Fixture): { entry: string; section: string; formula: string; text_sha256: string }[] {
    const q = join(f.root, "build", "q.json");
    expect(bench(f, "--judge-queue", q).code).toBe(0);
    const doc = JSON.parse(readFileSync(q, "utf8"));
    expect(doc.$schema).toBe("formula-judge-queue/v1");
    return doc.pairs;
  }

  function verdicts(f: Fixture, rows: object[]): string {
    const p = join(f.root, "library", "formula-verdicts.json");
    writeFileSync(p, JSON.stringify({ $schema: "formula-verdicts/v1", verdicts: rows }));
    return p;
  }

  test("the queue holds only the pairs the string stages did not find", () => {
    const f = fixture({ [INTRO]: TEXT }, { [INTRO]: TEX });
    const pairs = queue(f);
    expect(pairs.map((p) => p.formula)).toEqual(["\\frac{a}{b}"]);
    expect(pairs[0]!.text_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a current verdict is reported beside the string recall, uncalibrated by default", () => {
    const f = fixture({ [INTRO]: TEXT }, { [INTRO]: TEX });
    const [p] = queue(f);
    verdicts(f, [{ ...p, verdict: "equivalent", judged_by: agent }]);
    const { code, out, err } = bench(f);
    expect(code).toBe(0);
    expect(out.recall).toBeCloseTo(0.5, 2);
    expect(out.judge.judged).toBe(1);
    expect(out.judge.recall_judged).toBe(1);
    expect(out.judge.recall_combined).toBe(1);
    expect(out.judge.calibrated).toBe(false);
    expect(err).toContain("UNCALIBRATED");
    expect(queue(f)).toEqual([]);
  });

  test("a verdict on text that has since changed is stale and never used", () => {
    const f = fixture({ [INTRO]: TEXT }, { [INTRO]: TEX });
    const [p] = queue(f);
    verdicts(f, [{ ...p, text_sha256: "0".repeat(64), verdict: "equivalent", judged_by: agent }]);
    const { out } = bench(f);
    expect(out.judge.stale).toBe(1);
    expect(out.judge.judged).toBe(0);
    expect(out.judge.recall_combined).toBeCloseTo(0.5, 2);
  });

  test("a verdict must name its model", () => {
    const f = fixture({ [INTRO]: TEXT }, { [INTRO]: TEX });
    const [p] = queue(f);
    verdicts(f, [{ ...p, verdict: "equivalent", judged_by: { kind: "agent", id: "x" } }]);
    const { code, err } = bench(f);
    expect(code).not.toBe(0);
    expect(err).toContain("must name the model");
  });

  test("a held set scores the judge against ground truth", () => {
    const f = fixture({ [INTRO]: TEXT }, { [INTRO]: TEX });
    const held = join(f.root, "held.json");
    writeFileSync(
      held,
      JSON.stringify({
        $schema: "formula-judge-held-set/v1",
        pairs: [
          { formula: "\\frac{a}{b}", text: "a/b", truth: true, verdict: "equivalent", judged_by: agent },
          { formula: "x_i", text: "x i", truth: true, verdict: "not-equivalent", judged_by: agent },
          { formula: "a+b", text: "a-b", truth: false, verdict: "not-equivalent", judged_by: agent },
          { formula: "a+b", text: "b+c", truth: false, verdict: "equivalent", judged_by: agent },
        ],
      }),
    );
    const { out } = bench(f, "--held-set", held);
    expect(out.judge.calibrated).toBe(true);
    expect(out.judge.calibration.agreement).toBe(0.5);
    expect(out.judge.calibration.precision).toBe(0.5);
    expect(out.judge.calibration.recall).toBe(0.5);
  });
});
