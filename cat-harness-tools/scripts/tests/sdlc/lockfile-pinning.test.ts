/**
 * The lockfile-pinning gate, falsified.
 *
 * Both patterns it catches produce a GREEN step. That is the entire reason the
 * gate exists and the entire reason these tests do: nothing about either
 * failure is visible from a passing CI run.
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { knownFor, scanWorkflows } from "../../check-lockfile-pinning.ts";

function workflows(...bodies: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "pinning-"));
  bodies.forEach((b, i) => writeFileSync(join(dir, `w${i}.yml`), b));
  return dir;
}

describe("a pin that falls back is not a pin", () => {
  test("the bare fallback is caught", () => {
    const f = scanWorkflows(workflows("        run: bun install --frozen-lockfile || bun install\n"));
    expect(f).toHaveLength(1);
    expect(f[0].why).toContain("swallows the failure the pin exists to raise");
  });

  test("silencing stderr does not hide it from the gate", () => {
    const f = scanWorkflows(workflows("        run: bun install --frozen-lockfile 2>/dev/null || bun install\n"));
    expect(f).toHaveLength(1);
  });

  test("a pin with no fallback is clean", () => {
    expect(scanWorkflows(workflows("        run: bun install --frozen-lockfile\n"))).toEqual([]);
  });

  test("a degrading pin is reported as `degrading`, which is never baselined", () => {
    const f = scanWorkflows(workflows("        run: bun install --frozen-lockfile || bun install\n"));
    expect(f[0].kind).toBe("degrading");
  });
});

describe("`cd X && A || B` runs B in the wrong directory", () => {
  test("it is caught even when the pin itself looks fine", () => {
    // This is the class-A defect: the fallback is not about the lockfile at
    // all, it is about the `cd` failing. Measured in this repo, `content/`
    // does not exist, so all four sites installed at the root, unpinned.
    const f = scanWorkflows(workflows("          cd content && bun install --frozen-lockfile 2>/dev/null || bun install\n"));
    expect(f).toHaveLength(1);
  });

  test("a cd with no fallback is clean — the failure propagates, which is correct", () => {
    expect(scanWorkflows(workflows("          cd content && bun install --frozen-lockfile\n"))).toEqual([]);
  });

  test("an install with NO pin at all is reported — the row the first denominator hid", () => {
    // The first version of this gate counted LINES carrying --frozen-lockfile
    // and called that the set of install steps. It was not: three steps never
    // pinned at all, one of them in the release workflow, and choosing the
    // wrong denominator is what hid them.
    const f = scanWorkflows(workflows("        run: cd $PKG_DIR && bun install\n"));
    expect(f).toHaveLength(1);
    expect(f[0].kind).toBe("unpinned");
  });

  test("the guarded form this repo now uses carries no DEGRADING finding", () => {
    const guarded = [
      "        run: |",
      "          if [ ! -d content ]; then",
      '            echo "::notice::no content/ in this checkout"',
      "          elif [ -f content/bun.lock ]; then",
      "            (cd content && bun install --frozen-lockfile)",
      "          else",
      '            echo "::warning::content/ carries no bun.lock — installing UNPINNED"',
      "            (cd content && bun install)",
      "          fi",
      "",
    ].join("\n");
    // The guard's deliberate fallback branch IS an unpinned install and is
    // reported as one — baselined rather than failed, because failing on it
    // would make the honest branch unreachable. What must NOT appear is a
    // `degrading` finding.
    const f = scanWorkflows(workflows(guarded));
    expect(f.map((x) => x.kind)).toEqual(["unpinned"]);
    expect(f[0].text).toBe("(cd content && bun install)");
  });
});

describe("the three states the guard keeps apart", () => {
  test("no folio, pinned, and no-lockfile are each reachable and distinct", () => {
    // Not a behavioural test of the shell — a statement of what the guard
    // must be able to SAY. "there is no lockfile" and "the lockfile did not
    // match" are different facts and only one of them is acceptable, so a
    // form that cannot distinguish them is the defect however it is spelled.
    const guarded = [
      "          if [ ! -d content ]; then",
      '            echo "::notice::no content/ in this checkout"',
      "          elif [ -f content/bun.lock ]; then",
      "            (cd content && bun install --frozen-lockfile)",
      "          else",
      '            echo "::warning::content/ carries no bun.lock — installing UNPINNED"',
      "            (cd content && bun install)",
      "          fi",
    ].join("\n");
    expect(guarded).toContain("::notice::");
    expect(guarded).toContain("::warning::");
    expect(guarded).toContain("--frozen-lockfile");
    expect(scanWorkflows(workflows(guarded)).every((f) => f.kind === "unpinned")).toBe(true);
  });
});

describe("the baseline judges only the root it was recorded in", () => {
  // Owner, 2026-11-05: "scope to fa". Every site that mounts this layer runs
  // the gate; the index's entries there read as "stale baseline entry".
  const baseline = { root: "folio-assistant", known: ["repin-train.yml: bun install"] };

  test("in the root it names, its entries apply", () => {
    expect(knownFor(baseline, "folio-assistant")).toEqual(["repin-train.yml: bun install"]);
  });

  test("in any other root, none of them do — so none can read as stale", () => {
    expect(knownFor(baseline, "smart-ra")).toEqual([]);
  });

  test("a baseline naming no root still judges every root", () => {
    expect(knownFor({ known: ["x.yml: bun install"] }, "smart-ra")).toEqual(["x.yml: bun install"]);
  });
});
