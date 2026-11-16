/**
 * `build-glossary.ts` refuses a missing argument with USAGE and exit 2 — not a
 * stack trace.
 *
 * ## The defect, and why the guard could not fire
 *
 * The CLI read its argument as `resolve(positional[0] || "")` and then guarded
 * with `if (!paperDir || !existsSync(paperDir))`. **`resolve("")` returns the
 * current working directory**, which is both truthy and existing, so for the
 * no-argument case the guard was dead code: a bare
 * `bun run build-glossary.ts` fell straight through into `buildGlossary`, which
 * threw `Paper manifest not found: <cwd>/<cwd-basename>.ts` and exited **1**.
 *
 * Measured on this repository before the fix: exit 1 with a stack trace, and the
 * usage line never printed.
 *
 * That is the third-state discipline broken at its cheapest point. Exit 1 says
 * "this went wrong"; exit 2 says "I could not determine what you asked for". A
 * caller — including a Tool node whose contract promises exit 2 — cannot tell a
 * missing argument from a genuinely broken paper if both come back as 1.
 *
 * ## Why this is a spawn test and not a unit test
 *
 * The bug lived in argv handling and process exit, inside `if
 * (import.meta.main)`. Nothing importable was wrong, so no unit test over
 * `buildGlossary` could have caught it — the function behaved correctly on the
 * input it was wrongly given. The observable is the process, so the process is
 * what this runs.
 *
 * @module scripts/build-glossary-usage.test
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(import.meta.dir, "build-glossary.ts");
const REPO = resolve(import.meta.dir, "../..");

interface Ran {
  code: number | null;
  stderr: string;
}

/**
 * Run the CLI from the REPOSITORY ROOT, deliberately.
 *
 * That is the cwd where the defect reproduced: `resolve("")` becomes a directory
 * that exists, which is exactly what let the guard pass. Running from a
 * temporary directory would also reproduce it, but running from the repo root is
 * what a person actually does.
 */
function run(args: string[], cwd = REPO): Ran {
  const r = Bun.spawnSync(["bun", "run", SCRIPT, ...args], { cwd });
  return { code: r.exitCode, stderr: new TextDecoder().decode(r.stderr) };
}

describe("build-glossary CLI argument handling", () => {
  it("noArgumentUsage", () => {
    // The measured defect: this exited 1 with `Paper manifest not found:
    // <cwd>/<cwd-basename>.ts` and no usage line.
    const r = run([]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Usage: build-glossary.ts <paper-dir>");
    // The specific symptom, asserted as an ABSENCE so the old behaviour cannot
    // return while the exit code happens to be right.
    expect(r.stderr).not.toContain("Paper manifest not found");
  });

  it("missingDirNamed", () => {
    // A different mistake from omitting the argument, so it gets a different
    // message — a caller who mistyped a path needs to see which path arrived.
    const r = run([join(tmpdir(), "definitely-not-here-9c3f")]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("no such directory");
    expect(r.stderr).toContain("definitely-not-here-9c3f");
  });

  it("flagAloneIsNoArgument", () => {
    // `positional` filters on the `--` prefix, so this is the case where the
    // list is empty although argv is not. Worth pinning: it is the shape a
    // caller hits when they remember the flag and forget the path.
    const r = run(["--check"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Usage: build-glossary.ts <paper-dir>");
  });

  it("notPaperDirNoUsage", () => {
    // The boundary, and it matters in both directions: the fix must not turn a
    // real "this is not a paper" error into a usage message, because the two
    // have different remedies — supply an argument, versus point it at a paper.
    // An empty temp directory exists, so it passes both guards and reaches
    // `buildGlossary`, which is correct.
    const dir = mkdtempSync(join(tmpdir(), "glossary-notapaper-"));
    try {
      const r = run([dir]);
      expect(r.code).not.toBe(2);
      expect(r.stderr).toContain("Paper manifest not found");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
