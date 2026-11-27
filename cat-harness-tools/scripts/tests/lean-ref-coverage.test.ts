/**
 * Regression suite for import + SSOT hygiene guards.
 *
 * The `lean.ref` resolution and orphan library-tree coverage tests whose
 * subject is `folio-assistant-sci/pipeline/lean-formal-ref.ts` and the
 * chapter profiles live in
 * `folio-assistant-sci/scripts/tests/lean-ref-coverage.test.ts` (beans `ho66`
 * and `saqd`).
 *
 *     cd scripts/tests && bun test lean-ref-coverage.test.ts
 */

import { describe, test, expect } from "bun:test";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, resolve, relative } from "path";

import { HARNESS_ROOT } from "../lib/roots.ts";

const INSTANCE_ROOT = resolve(HARNESS_ROOT);

// ── Hygiene / single-source-of-truth guards ──────────────────

describe("import + SSOT hygiene guards", () => {
  function tsFilesUnder(dir: string): string[] {
    const out: string[] = [];
    const abs = join(INSTANCE_ROOT, dir);
    const stack = [abs];
    while (stack.length) {
      const d = stack.pop()!;
      let entries: string[];
      try {
        entries = readdirSync(d);
      } catch {
        continue;
      }
      for (const e of entries) {
        if (e === "node_modules" || e === ".lake" || e.startsWith(".")) continue;
        const full = join(d, e);
        if (statSync(full).isDirectory()) stack.push(full);
        else if (e.endsWith(".ts")) out.push(full);
      }
    }
    return out;
  }

  test("no imports reference the non-existent folio-assistant/schemas path", () => {
    const offenders: string[] = [];
    for (const dir of ["content", "adapters", "schemas", "src", "scripts"]) {
      for (const f of tsFilesUnder(dir)) {
        const src = readFileSync(f, "utf-8");
        for (const line of src.split("\n")) {
          // Only flag actual import/export-from statements, not prose/comments.
          if (
            /^\s*(?:import|export)\b[^\n]*\bfrom\s+["'][^"']*folio-assistant\/schemas/.test(
              line,
            )
          ) {
            offenders.push(`${relative(INSTANCE_ROOT, f)}: ${line.trim()}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
  // "q-usage-audit carries no private resolver/walker" moved to
  // folio-assistant-sci with the script (bean saqd).
});
