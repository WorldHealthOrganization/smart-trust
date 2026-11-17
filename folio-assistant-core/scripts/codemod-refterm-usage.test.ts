/**
 * `codemod-refterm.ts` refuses a missing argument with USAGE and exit 2 — not a
 * stack trace.
 *
 * ## The same defect as `build-glossary.ts`, found eight days later
 *
 * The CLI read its argument as `resolve(positional[0] || "")` and then guarded
 * with `if (!target || !existsSync(target))`. **`resolve("")` returns the
 * current working directory**, which is both truthy and existing, so for the
 * no-argument case the guard was dead code: a bare
 * `bun run codemod-refterm.ts` fell straight through into `resolveChapters`,
 * which threw `Manifest not found: <cwd>/<cwd-basename>.ts` and exited with a
 * stack trace.
 *
 * Measured on this repository before the fix, 2026-09-30: the usage line never
 * printed.
 *
 * Bean `1oqu` fixed the identical shape in `build-glossary.ts` and
 * `build-glossary-usage.test.ts` pinned it. This file is that test's twin, and
 * the duplication is deliberate: the observable is a process, so there is
 * nothing importable to share, and a test that covered both through one helper
 * would pass while either script regressed alone.
 *
 * ## Why the second instance survived the first fix
 *
 * These two scripts sat in different directories — `content/pipeline/` and
 * `scripts/tests/` — until bean `yj6r` moved both into
 * `folio-assistant-core/scripts/` for the layer-boundary work. **Being
 * adjacent is what made the second one visible**, and it was found by reading
 * the neighbour rather than by any check. Nothing in the gate set asks whether
 * a CLI refuses a missing argument, which is why one fix did not imply the
 * other.
 *
 * ## The third-state discipline, at its cheapest point
 *
 * Exit 1 says "this went wrong". Exit 2 says "I could not determine what you
 * asked for". A caller — including a Tool node whose contract promises exit 2 —
 * cannot tell a missing argument from a genuinely broken paper if both come
 * back as 1.
 *
 * @module scripts/codemod-refterm-usage.test
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(import.meta.dir, "codemod-refterm.ts");

function run(args: string[]): { code: number; stderr: string } {
  const r = Bun.spawnSync(["bun", "run", SCRIPT, ...args], { stderr: "pipe", stdout: "pipe" });
  return { code: r.exitCode, stderr: new TextDecoder().decode(r.stderr) };
}

describe("codemod-refterm CLI argument handling", () => {
  it("noArgumentUsage", () => {
    // The measured defect: this threw `Manifest not found:
    // <cwd>/<cwd-basename>.ts` with a stack trace and no usage line.
    const r = run([]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Usage: codemod-refterm.ts <paper-or-chapter-dir>");
    // Asserted as an ABSENCE so the old behaviour cannot return while the exit
    // code happens to be right.
    expect(r.stderr).not.toContain("Manifest not found");
  });

  it("missingDirNamed", () => {
    // A different mistake from omitting the argument, so it gets a different
    // message — somebody who mistyped a path needs to see which path arrived.
    const r = run([join(tmpdir(), "definitely-not-here-7a1d")]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("no such directory");
    expect(r.stderr).toContain("definitely-not-here-7a1d");
  });

  it("flagAloneIsNoArgument", () => {
    // `positional` filters on the `--` prefix, so this is the case where the
    // list is empty although argv is not. It is the shape a caller hits when
    // they remember the flag and forget the path — and `--write` makes it the
    // more expensive of the two scripts to get wrong.
    const r = run(["--write"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Usage: codemod-refterm.ts <paper-or-chapter-dir>");
  });

  it("notPaperDirNoUsage", () => {
    // The boundary, and it matters in both directions: the fix must not turn a
    // real "this is not a paper" error into a usage message, because the two
    // need different responses from the reader. An empty temp directory exists,
    // so it passes the guard and fails later — which is correct.
    const r = run([mkdtempSync(join(tmpdir(), "not-a-paper-"))]);
    expect(r.stderr).not.toContain("Usage: codemod-refterm.ts");
  });
});
