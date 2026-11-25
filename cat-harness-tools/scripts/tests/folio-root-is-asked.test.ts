/**
 * The folio root is ASKED for, never spelled.
 *
 * Bean `hs08`. The owner's ruling is that a folio says where its content is —
 * *"qou can declare a new folio at content/"* — and `folioDir` is the one
 * place that reads the declaration. This is the ratchet that keeps it the one
 * place.
 *
 * ## Why a ratchet rather than a convention
 *
 * Before `folioDir`, **162 sites** spelled the folio root as a literal. Not
 * one of them was wrong when it was written; each was the obvious way to name
 * a directory, and together they made the declaration unreadable — a folio
 * could declare `content/` and be invisible anyway. A convention would have
 * produced them again, one plausible line at a time.
 *
 * The failure this guards is silent by construction: a reintroduced literal
 * breaks nothing in THIS repository, which has no folio to look in. It breaks
 * a downstream folio that declared a different path, and it breaks it by
 * finding nothing rather than by erroring. Nobody here would see it.
 *
 * ## What is allowed, and why
 *
 * - `schemas/kg/cat-harness.ts` — `folioDir` itself. It IS the base case: the
 *   convention has to be written down once, and resolving it through a
 *   declaration would be circular.
 * - `*.test.ts` — fixtures BUILD trees rather than resolving them. A test that
 *   writes `<tmp>/folio/paper` is constructing a world, not reading one.
 *
 * Everything else asks.
 *
 * @module scripts/tests/folio-root-is-asked.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const INSTANCE = resolve(HARNESS_ROOT);
const ROOT = repoRootFor(INSTANCE);

/** `join(x, "folio")` / `resolve(x, "folio")` — the folio root, spelled. */
const LITERAL = /(?<![.\w])(?:join|resolve)\s*\([^,()]*(?:\([^()]*\))?[^,()]*,\s*"folio"\s*[,)]/;

/** The one module that may spell it, because it is where the answer lives. */
const BASE_CASE = "cat-harness-tools/schemas/kg/cat-harness.ts"; // moved up a layer in bean `8lcl`

/**
 * The harness and the layer that implements its tools. The MCP server moved to
 * `cat-harness-tools` (bean `w2gr`, step 3a) and took many of the `folioDir`
 * call sites with it. Scanning only this layer would let that code escape
 * the rule, and would make the floor below fail for a reason unrelated to it.
 */
const SCANNED = [INSTANCE, resolve(ROOT, "cat-harness-tools")];

function sourceFiles(): string[] {
  const out = new Set<string>();
  for (const cwd of SCANNED) {
    for (const f of new Bun.Glob("**/*.ts").scanSync({ cwd, absolute: true })) {
      if (f.includes("/node_modules/") || f.endsWith(".test.ts")) continue;
      out.add(f);
    }
  }
  return [...out].sort();
}

describe("the folio root is asked for, not spelled", () => {
  const files = sourceFiles();

  test("the scan found files — otherwise nothing below proves anything", () => {
    // A filter over nothing passes. This repository's own `gates.ts` carries
    // the same guard, for the same reason.
    expect(files.length).toBeGreaterThan(200);
  });

  test("no module outside `folioDir` itself spells the folio root", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const rel = relative(ROOT, f);
      if (rel === BASE_CASE) continue;
      const src = readFileSync(f, "utf-8");
      for (const [i, line] of src.split("\n").entries()) {
        // A comment describing the old shape is not a call.
        if (/^\s*(\*|\/\/)/.test(line)) continue;
        if (LITERAL.test(line)) offenders.push(`${rel}:${i + 1}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("`folioDir` is actually used — the rule is not vacuously satisfied", () => {
    // Deleting every call site would satisfy the rule above while undoing the
    // change entirely. This is the other direction of the ratchet.
    const callers = files.filter((f) => {
      if (relative(ROOT, f) === BASE_CASE) return false;
      return /(?<![.\w])folioDir\s*\(/.test(readFileSync(f, "utf-8"));
    });
    // 41 → 39 on 2026-10-04 with no call site deleted: the glossary and
    // relevance routes moved UP to folio-assistant-core with their content
    // (bean `70lx`, owner ruling), out of what this scans. 39 → 36 in bean
    // `saqd` as maths pipeline audits (`language-trap-audit`,
    // `conjectural-propagation-audit`, `proof-narrative-lean-equiv-sweep`)
    // moved UP to folio-assistant-sci, and 36 → 32 in `saqd` group 5 as the
    // plugin-slot and Tool target scripts followed them, and 32 → 31 when the
    // q-usage checker moved to folio-assistant-sci too (saqd, #1002). A move is
    // not the regression this floor exists to catch, so the floor follows it.
    expect(callers.length).toBeGreaterThan(30);
  });
});
