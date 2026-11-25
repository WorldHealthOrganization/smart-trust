/**
 * One Lean comment stripper, and it is `lean-lexer`'s.
 *
 * Bean `bqrg`. There were **six** — the canonical one plus five
 * reimplementations in `qa-checkers-extended`, `qa-checkers-vacuity`,
 * `conditional-class-banner-audit`, `qa-checkers-q-usage` and
 * `scripts/lean-coverage`.
 *
 * ## Why they were not merely redundant
 *
 * Measured over **3,954 real `.lean` files** in the qou corpus, comparing the
 * IDENTIFIER SET each produced against the canonical one's — raw output was
 * never the right comparison, because canonical blanks comments to preserve
 * byte offsets while every copy deleted them:
 *
 *     impl        same token set   differs
 *     extended          3954          0     depth counter — equivalent
 *     coverage          3954          0     depth counter — equivalent
 *     vacuity           3950          4     non-greedy regex, NO nesting
 *     banner            3950          4     ditto
 *     qusage            3950          4     ditto
 *
 * The three regex versions used `/\/-[\s\S]*?-\//g`, which matches to the
 * FIRST `-/`. Lean nests block comments, so an outer comment ends early and
 * its tail is handed to the checker as code. On
 * `confined-particle.lean` (nesting depth 2) that leaked **113 prose tokens**
 * — `def`, `Prop`, `fun`, `True`, and English words like "docstring" and
 * "about" — into text three QA checkers scan for declarations. The canonical
 * module's own header names this: *"how a scanner invents edges out of
 * documentation."*
 *
 * Four files change across the corpus, listed in the commit. Reported rather
 * than asserted, which is what the bean asked for.
 *
 * @module cat-harness/scripts/tests/lean-lexer-is-the-only-stripper.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { stripLeanComments } from "../../pipeline/lean-lexer.js";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";

const INSTANCE = resolve(HARNESS_ROOT);
const ROOT = repoRootFor(INSTANCE);
const CANONICAL = "cat-harness-tools/pipeline/lean-lexer.ts";

/**
 * Modules allowed a `stripLeanComments` definition that strips NOTHING.
 *
 * `pipeline-plugins.ts` (bean `squu`) defines one that forwards to the
 * `lean-lexer` pipeline slot, which folio-assistant-sci fills with the
 * canonical function above. It is how generic code reaches the lexer without
 * importing a file that moves to the science layer. Exempt by NAME rather than
 * by pattern, and asserted below to be a pure forward, so a real second
 * stripper cannot hide behind it.
 */
const DELEGATES = new Set(["cat-harness-tools/pipeline/pipeline-plugins.ts"]);

/** A definition of a stripper — `function f(` or `const f = `. */
const DEFINES = /(?:function\s+stripLeanComments\s*\(|(?:const|let|var)\s+stripLeanComments\s*[:=])/;

function sources(): string[] {
  const out: string[] = [];
  for (const f of new Bun.Glob("**/*.ts").scanSync({ cwd: TOOLS_ROOT, absolute: true })) {
    if (f.includes("/node_modules/") || f.endsWith(".test.ts")) continue;
    out.push(f);
  }
  return out.sort();
}

describe("there is exactly one Lean comment stripper", () => {
  const files = sources();

  test("the scan found files — otherwise nothing below proves anything", () => {
    expect(files.length).toBeGreaterThan(200);
  });

  test("no module defines its own", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const rel = relative(ROOT, f);
      if (rel === CANONICAL || DELEGATES.has(rel)) continue;
      for (const [i, line] of readFileSync(f, "utf-8").split("\n").entries()) {
        if (/^\s*(\*|\/\/)/.test(line)) continue; // a comment describing one is not one
        if (DEFINES.test(line)) offenders.push(`${rel}:${i + 1}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("an exempt delegate only forwards to the slot", () => {
    for (const rel of DELEGATES) {
      const src = readFileSync(resolve(ROOT, rel), "utf-8");
      const body = src.match(/function\s+stripLeanComments\s*\([^)]*\)[^{]*\{([^}]*)\}/)?.[1] ?? "";
      expect(body.trim()).toBe('return pipelinePlugin("lean-lexer").stripLeanComments(src);');
    }
  });

  test("...and it is actually used, so the rule is not vacuously satisfied", () => {
    const callers = files.filter(
      (f) => relative(ROOT, f) !== CANONICAL && /stripLeanComments/.test(readFileSync(f, "utf-8")),
    );
    expect(callers.length).toBeGreaterThanOrEqual(4);
  });
});

describe("the invariants a reimplementation kept losing", () => {
  test("byte offsets are preserved — comments blank, never delete", () => {
    // `splitDeclarations` indexes into the result. A copy that deletes
    // misaligns every span it feeds, silently.
    const src = "def a := 1 -- note\n/- block -/\ndef b := 2\n";
    expect(stripLeanComments(src).length).toBe(src.length);
  });

  test("LINE COUNT is preserved too — a block comment keeps its newlines", () => {
    // THE SECOND INVARIANT, and asserting only length above is why its absence
    // survived (bean `vrfx`). A newline inside a block comment was blanked like
    // any other character, so an N-line comment collapsed to one line and every
    // line number below it was reported short. Measured over the qou corpus
    // before the fix: 3,931 of 3,971 files shifted (99.0%), 281,234 lines lost.
    const src = ["def a := 1", "/- block", "   spanning", "   three -/", "def b := 2"].join("\n");
    const got = stripLeanComments(src);
    expect(got.length).toBe(src.length);
    expect(got.split("\n")).toHaveLength(src.split("\n").length);
    // Not just the count — `def b` must land on its SOURCE line, which is the
    // only thing a reader of a QA hit cares about.
    expect(got.split("\n").findIndex((l) => l.includes("def b")) + 1).toBe(5);
  });

  test("a `/-! … -/` module header does not shift the whole file", () => {
    // The worst case in the corpus: a header at the top moves EVERYTHING below
    // it. Reproduced before the fix as 6 source lines reporting as 2.
    const src = ["/-!", "# Header", "spanning", "four lines", "-/", "def c := 3"].join("\n");
    const got = stripLeanComments(src);
    expect(got.split("\n")).toHaveLength(6);
    expect(got.split("\n").findIndex((l) => l.includes("def c")) + 1).toBe(6);
  });

  test("a restored newline yields only spaces — the comment is still blanked", () => {
    // The obvious objection to writing the newline back: does the comment's
    // CONTENT survive? It must not, or a declaration pattern could match inside
    // a comment. Every line of the stripped block is blank.
    const src = ["/- def hidden := 1", "   theorem alsoHidden : True := trivial -/", "def real := 2"].join("\n");
    const lines = stripLeanComments(src).split("\n");
    expect(lines[0]!.trim()).toBe("");
    expect(lines[1]!.trim()).toBe("");
    expect(lines[2]).toContain("def real");
  });

  test("NESTED block comments close at the right place", () => {
    // The whole defect, in one line. A non-greedy regex stops at the inner
    // `-/` and hands `outer tail def leaked` to the caller as code.
    const src = "/- outer /- inner -/ outer tail -/\ndef real := 1\n";
    const got = stripLeanComments(src);
    expect(got).not.toContain("tail");
    expect(got).not.toContain("outer");
    expect(got).toContain("def real");
  });

  test("doc comments are comments — a name in prose is not a dependency", () => {
    const src = "/-- mentions Nonexistent.thing -/\ndef real := 1\n";
    const got = stripLeanComments(src);
    expect(got).not.toContain("Nonexistent");
    expect(got).toContain("def real");
  });

  test("a line comment does not eat the following line", () => {
    const src = "-- gone\ndef kept := 1\n";
    expect(stripLeanComments(src)).toContain("def kept");
  });
});
