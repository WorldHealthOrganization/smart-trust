import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { findPapers, soleFolioPaper } from "../../pipeline/repo-root";

/**
 * The pipeline lives in folio-assistant but audits a downstream CONTENT
 * repo. `q-usage-audit.ts` derived its root from its own file location,
 * which after the repo split resolved to the platform tree — so it walked
 * `<platform>/content/quantum-observable-universe`, found nothing, and
 * **exited 0**. Silent success is what made it invisible: the seven
 * `q-usage-*` criteria went unrefreshable in every downstream sidecar
 * while CI stayed green. Observed live on qou #4673.
 *
 * These pin the two halves of the fix: paper discovery must not hardcode
 * a name, and a zero-block sweep must not report success.
 */

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "folio-roots-"));
  const content = join(root, "folio");
  mkdirSync(content, { recursive: true });

  // Two papers, by the `folio/<name>/<name>.ts` manifest convention.
  for (const p of ["alpha-paper", "beta-paper"]) {
    mkdirSync(join(content, p), { recursive: true });
    writeFileSync(join(content, p, `${p}.ts`), "export default {};\n");
  }
  // Non-papers: no same-named manifest. `pipeline` and `schema` are real
  // sibling directories in a content repo and must never be walked as papers.
  for (const d of ["pipeline", "schema", "values"]) {
    mkdirSync(join(content, d), { recursive: true });
    writeFileSync(join(content, d, "index.ts"), "export default {};\n");
  }
  // A dotfile directory must be skipped outright.
  mkdirSync(join(content, ".cache"), { recursive: true });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("findPapers", () => {
  test("discovers every paper by its same-named manifest", () => {
    expect(findPapers(root)).toEqual(["alpha-paper", "beta-paper"]);
  });

  test("does not privilege any paper by name", () => {
    // The regression: the audit hardcoded `quantum-observable-universe`,
    // so it found nothing in any other folio — and nothing in a folio that
    // had merely renamed its paper.
    expect(findPapers(root)).not.toContain("quantum-observable-universe");
  });

  test("ignores sibling directories that carry no manifest", () => {
    const papers = findPapers(root);
    for (const d of ["pipeline", "schema", "values", ".cache"]) {
      expect(papers).not.toContain(d);
    }
  });

  test("returns [] for a root with no folio/ at all", () => {
    expect(findPapers(join(root, "nope"))).toEqual([]);
  });
});

describe("soleFolioPaper", () => {
  test("is undefined when the folio holds several papers", () => {
    // Guessing here is exactly what produced the hardcoded name.
    expect(soleFolioPaper(root)).toBeUndefined();
  });

  test("names the paper when there is exactly one", () => {
    const one = mkdtempSync(join(tmpdir(), "folio-one-"));
    mkdirSync(join(one, "folio", "only-paper"), { recursive: true });
    writeFileSync(join(one, "folio", "only-paper", "only-paper.ts"), "export default {};\n");
    expect(soleFolioPaper(one)).toBe("only-paper");
    rmSync(one, { recursive: true, force: true });
  });
});

// The q-usage-audit CLI half of this file moved to folio-assistant-sci with
// the script (scripts/tests/q-usage-audit-cli.test.ts, bean saqd).
