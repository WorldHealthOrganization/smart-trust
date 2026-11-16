/**
 * LaTeX ↔ Lean coverage tests.
 *
 * Validates:
 * 1. Every \lean{Decl} in LaTeX has a corresponding declaration in Lean source
 * 2. Every theorem-like environment has a \lean{} tag (or \notready)
 * 3. \leanok is only used on environments that have \lean{}
 *
 * Coverage results feed into the publication pipeline — the ∀ symbol
 * in PDF/HTML links readers to pretty-printed Lean documentation.
 *
 * EVERY assertion here needs `chapters/*.tex`, which is `content_build`
 * output and lives in the FOLIO. With no folio attached the file has nothing
 * to check, and it must say `skip` — not `pass`.
 *
 * It used to say `pass`. Two tests did `console.log("ℹ Skipped: …"); return;`
 * and two more asserted `expect(true).toBe(true)` after computing (and
 * logging) the violations they were named for — so CI printed
 * `✓ label prefixes match environment types` whether or not they did.
 * The per-declaration loop below generated ZERO tests, silently, because
 * `chapterFiles` was empty. And it was ALWAYS empty: `CHAPTERS_DIR` pointed
 * at the platform checkout rather than the folio, so this file had never run
 * one of its real assertions in either repo.
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { relative } from "path";
import {
  LEAN_DIR,
  findLeanFiles,
  findChapterFiles,
  extractEnvironments,
  type LatexEnvironment,
} from "./helpers";
// ── Collect all environments and Lean files once ────────────────

const chapterFiles = findChapterFiles();
const allEnvs: LatexEnvironment[] = chapterFiles.flatMap(extractEnvironments);
const allLeanFiles = findLeanFiles(LEAN_DIR);

/** No `chapters/*.tex` → nothing to check. Skip, visibly. */
const noChapters = chapterFiles.length === 0;

/** Read all Lean source into a searchable map: filename → content */
const leanContents = new Map<string, string>();
for (const f of allLeanFiles) {
  leanContents.set(relative(LEAN_DIR, f), readFileSync(f, "utf-8"));
}

/** Search all Lean source for a declaration name. */
function declExistsInLean(declName: string): boolean {
  // Extract the short name (last segment after dots)
  const shortName = declName.split(".").pop() || declName;
  for (const [, content] of leanContents) {
    // Match: def/theorem/lemma/structure/class/instance followed by the name
    const pattern = new RegExp(`\\b(def|theorem|lemma|structure|class|instance|abbrev|noncomputable\\s+def)\\s+${shortName}\\b`);
    if (pattern.test(content)) return true;
    // Also match if it appears as a declaration in any form
    if (content.includes(shortName)) return true;
  }
  return false;
}

// ── Test: every \lean{Decl} tag resolves to a Lean declaration ──

describe("\\lean{} tags → Lean declarations", () => {
  const envsWithLean = allEnvs.filter((e) => e.leanDecl);

  test.skipIf(noChapters)("at least one \\lean{} tag found", () => {
    expect(envsWithLean.length).toBeGreaterThan(0);
  });

  // Group by declaration to avoid duplicate tests
  const uniqueDecls = [...new Set(envsWithLean.map((e) => e.leanDecl!))];

  test.skipIf(noChapters)("the per-declaration checks below were generated", () => {
    // A `for` loop over an empty array registers no tests at all, so the
    // checks simply vanish from the run and the file still reports green.
    // This is the one test that notices.
    expect(uniqueDecls.length).toBeGreaterThan(0);
  });

  test.each(uniqueDecls)("%s exists in Lean source", (decl) => {
    expect(declExistsInLean(decl)).toBe(true);
  });
});

// ── Test: coverage completeness ─────────────────────────────────
// Every theorem/lemma/proposition/corollary/definition should have
// either \lean{} or \notready.

describe("Coverage completeness", () => {
  // Only check formalizable types (not examples, remarks)
  const formalizableTypes = new Set([
    "theorem", "lemma", "proposition", "corollary", "definition",
  ]);

  const formalizable = allEnvs.filter((e) => formalizableTypes.has(e.envType));

  test.skipIf(noChapters)("formalizable environments found", () => {
    expect(formalizable.length).toBeGreaterThan(0);
  });

  const missing = formalizable.filter(
    (e) => !e.leanDecl && !e.hasNotready
  );

  // Log missing coverage (informational — doesn't fail the build)
  if (missing.length > 0) {
    console.log(`\n    ℹ ${missing.length} environments without \\lean{} or \\notready:`);
    for (const e of missing.slice(0, 20)) {
      console.log(`      - ${e.label} (${e.envType}) in ${e.file}:${e.line}`);
    }
    if (missing.length > 20) {
      console.log(`      ... and ${missing.length - 20} more`);
    }
  }

  // Coverage stats
  const covered = formalizable.filter((e) => e.leanDecl).length;
  const notready = formalizable.filter((e) => e.hasNotready).length;
  const total = formalizable.length;
  const pct = total > 0 ? ((covered / (total - notready)) * 100).toFixed(1) : "0";

  // A report, not a check — so it says so, and it skips rather than printing
  // "Coverage: 0/0 formalizable (0%)" over an empty corpus, which is not a
  // coverage figure at all. It was `expect(true).toBe(true)`: a console.log
  // wearing a test's clothes, counted among the passes.
  test.skipIf(noChapters)("coverage statistics (report)", () => {
    console.log(`\n    Coverage: ${covered}/${total - notready} formalizable (${pct}%), ${notready} not-ready`);
    // The report is only meaningful over a corpus it actually read.
    expect(total).toBeGreaterThan(0);
  });
});

// ── Test: \leanok consistency ───────────────────────────────────

describe("\\leanok consistency", () => {
  const orphans = allEnvs.filter((e) => e.hasLeanok && !e.leanDecl);

  // A real gate — but `[]` has length 0, so with no corpus it passed by
  // finding nothing. Skipped instead, like the rest of the file.
  test.skipIf(noChapters)("no \\leanok without \\lean{}", () => {
    if (orphans.length > 0) {
      console.log(`\n    Orphan \\leanok tags:`);
      for (const e of orphans) {
        console.log(`      - ${e.label} in ${e.file}:${e.line}`);
      }
    }
    expect(orphans).toHaveLength(0);
  });
});

// ── Test: label conventions ─────────────────────────────────────

describe("Label conventions", () => {
  const prefixMap: Record<string, string> = {
    theorem: "thm:",
    lemma: "lem:",
    proposition: "prop:",
    corollary: "cor:",
    definition: "def:",
    example: "ex:",
    remark: "rem:",
    conjecture: "conj:",
  };

  const mismatches = allEnvs.filter((env) => {
    const expected = prefixMap[env.envType];
    return expected && !env.label.startsWith(expected);
  });

  // Named "label prefixes match environment types" and asserting
  // `expect(true).toBe(true)` — so CI printed a green tick for a property it
  // never checked, next to a log of every violation. Renamed to what it does.
  //
  // It stays a REPORT rather than becoming a gate because the live count is
  // unknown from this repo — the corpus is in the folio — and the ratchet
  // rule is that a rule becomes an error only once its count is zero.
  // Measure in a folio, then flip the last line to
  // `expect(mismatches).toHaveLength(0)`.
  test.skipIf(noChapters)("label prefix mismatches (report)", () => {
    if (mismatches.length > 0) {
      console.log(`\n    ℹ ${mismatches.length} label prefix mismatches (fix or reclassify):`);
      for (const e of mismatches) {
        console.log(`      - ${e.label} is ${e.envType} (expected ${prefixMap[e.envType]}*) in ${e.file}:${e.line}`);
      }
    }
    // Asserts the report ran over a real corpus — the one thing that can
    // actually go wrong here without anybody noticing.
    expect(allEnvs.length).toBeGreaterThan(0);
  });
});
