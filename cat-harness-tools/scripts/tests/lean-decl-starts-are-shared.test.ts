/**
 * One answer to *where does a Lean declaration begin*, and it is
 * `lean-lexer`'s `declarationStarts`.
 *
 * Bean `bqrg`, second half. The first half converged six `stripLeanComments`
 * implementations onto one module and is gated by
 * `lean-lexer-is-the-only-stripper.test.ts`. The declaration splitter was what
 * was left, and it was not one duplicate but two functions answering different
 * questions off two different regexes.
 *
 * ## This file replaced `lean-decl-regex-divergence.test.ts`
 *
 * That file PINNED the divergence, on a stated reason:
 *
 * > this repository has no Lean corpus to re-sweep against
 *
 * The assertion was true and is kept below. The conclusion drawn from it was
 * not: the corpus is a SIBLING CHECKOUT rather than a file in this tree, and
 * `lean-lexer-is-the-only-stripper.test.ts` in this same directory already
 * recorded a 3,954-file sweep run from a container exactly like this one. Its
 * own instruction for that case was to replace it with "one union pattern plus
 * its results", which is what this is.
 *
 * ## The sweep — 3,971 files, 52,144 declarations, 2026-09-25
 *
 *     union (DECL_RE now)    52,144
 *     DECL_RE, before        51,901   missed 243 in 105 files
 *                                     axiom 113, opaque 130; no `unsafe` in this corpus
 *     LEAN_DECL_RE           52,144   every name, 990 (1.9%) truncated at the dot
 *
 * **A missed keyword is not a skipped declaration.** `splitDeclarations`
 * slices from one start to the NEXT, so unrecognised text is absorbed into the
 * body of whatever precedes it. Those 243 were reported as part of another
 * declaration's body, in authored content — `vertex-algebra-relations.lean`
 * absorbed 9 on its own — and the triviality probe splices bodies.
 *
 * @module cat-harness/scripts/tests/lean-decl-starts-are-shared.test
 *
 * The tests here whose subject is folio-assistant-sci's contribution (the
 * `lean-lexer` pipeline plugin this layer contributes) live in
 * `folio-assistant-sci/scripts/tests/lean-decl-starts-are-shared.test.ts`
 * (bean `ho66`): standing alone, cat-harness has no such contribution to read.
 */
import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import {
  declarationStarts,
  splitDeclarations,
  stripLeanComments,
} from "../../pipeline/lean-lexer.js";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";

const INSTANCE = resolve(HARNESS_ROOT);
const ROOT = repoRootFor(INSTANCE);
const CANONICAL = "cat-harness-tools/pipeline/lean-lexer.ts";

/** One declaration of each shape the two patterns disagreed about. */
const DIVERGENT = `theorem alpha : True := by trivial

axiom choice_ax : Nonempty Nat

unsafe def beta (n : Nat) : Nat := n + 1

opaque gamma : Nat := 7

def Ns.delta : Nat := 3
`;

describe("every shape the two patterns disagreed about is found", () => {
  const names = declarationStarts(stripLeanComments(DIVERGENT)).map((d) => d.name);

  test("all five, in source order", () => {
    expect(names).toEqual(["alpha", "choice_ax", "beta", "gamma", "Ns.delta"]);
  });

  test.each([["axiom", "choice_ax"], ["opaque", "gamma"], ["the unsafe modifier", "beta"]])(
    "%s — was missed by DECL_RE, absorbed into alpha's body",
    (_shape, name) => {
      expect(names).toContain(name);
    },
  );

  test("a dotted name is NOT truncated at the dot", () => {
    // 990 of the corpus's 52,144. `LEAN_DECL_RE` returned `Ns`, so a lookup by
    // name missed every one of them.
    expect(names).toContain("Ns.delta");
    expect(names).not.toContain("Ns");
  });
});

describe("a missed keyword is ABSORBED, which is why the gap mattered", () => {
  const spans = splitDeclarations(stripLeanComments(DIVERGENT));

  test("no declaration's body contains another declaration", () => {
    // Asserted as a property over every span rather than on one example, so a
    // keyword this lexer does not yet know fails HERE rather than being
    // quietly attributed to its predecessor.
    for (const s of spans) {
      for (const kw of ["axiom ", "opaque ", "theorem ", "unsafe def ", "def "]) {
        expect(s.body.includes(kw), `${s.name}'s body absorbed a \`${kw.trim()}\``).toBe(false);
      }
    }
  });

  test("alpha's body is its own and nothing else", () => {
    expect(spans.find((s) => s.name === "alpha")?.body.trim()).toBe(":= by trivial");
  });

  test("a body-less declaration reports bodyAt -1, which the probe checks", () => {
    // An `axiom` has no `:=`. `lean-triviality-probe` skips on `bodyAt < 0`
    // rather than splicing, so admitting axioms cannot make it rewrite
    // something it has no cut for.
    const ax = spans.find((s) => s.name === "choice_ax");
    expect(ax?.body).toBe("");
    expect(ax?.bodyAt).toBe(-1);
  });
});

describe("there is exactly one declaration pattern", () => {
  const files = [...new Glob("**/*.ts").scanSync({ cwd: TOOLS_ROOT, absolute: true })]
    .filter((f) => !f.includes("/node_modules/") && !f.endsWith(".test.ts"))
    .sort();

  test("the scan found files — otherwise nothing below proves anything", () => {
    expect(files.length).toBeGreaterThan(200);
  });

  /** Files carrying a `theorem|lemma|def`-style alternation, excluding comments. */
  function patternFiles(): string[] {
    const LEAN_KEYWORDS = /theorem\|lemma\|def\b/;
    const hits = new Set<string>();
    for (const f of files) {
      const rel = relative(ROOT, f);
      for (const line of readFileSync(f, "utf-8").split("\n")) {
        if (/^\s*(\*|\/\/|#)/.test(line)) continue; // describing one is not being one
        if (LEAN_KEYWORDS.test(line)) hits.add(rel);
      }
    }
    return [...hits].sort();
  }

  test("no module outside the canonical one carries a local pattern any more", () => {
    // The scoped claim, and the only one this change earns. `DECL_RE` lives in
    // the canonical module; `qa-checkers-q-usage` (in folio-assistant-sci
    // since bean saqd) reads it through `declarationStarts` and defines nothing.
    // It is no longer in this layer, so naming it here could never fail: the
    // claim is held against every module the scan found instead, and a pattern
    // reintroduced anywhere but the canonical module fails it.
    expect(patternFiles().filter((f) => f !== CANONICAL)).toEqual([]);
  });

  test("no other module here carries its own, and the list may only shrink", () => {
    // FOUND BY THIS TEST, not by the bean: `bqrg` said the declaration
    // splitter had "at least two" implementations. It has EIGHT sites across
    // seven files, and every extra one is missing a keyword the union has:
    //
    //   conjectural-propagation-audit   misses example, inductive
    //   generate-lean-stubs            misses axiom, example, opaque
    //   proof-narrative-lean-equiv-sweep misses example, opaque
    //   qa-utils                       misses example
    //   lean-coverage                  misses axiom, example, inductive, opaque
    //
    // 🛑 One row RENAMED, 2026-09-27, and this is the reason to read the line
    // below rather than the count. `qa-utils` -> `lean-formal-ref`: the pattern
    // did not appear, converge or multiply — the ~327 lines carrying it moved
    // out of core into the science layer on the owner ruling that the `lean.ref`
    // grammar is science vocabulary, and core kept one-line delegations. Still
    // FIVE non-canonical patterns, still the same five defects, still missing
    // `example`. A reader seeing a name change in a list that "may only shrink"
    // should not conclude the rule was broken; nothing about the inventory
    // changed except which file holds one of the rows.
    //
    // 🛑 Three rows MOVED to `folio-assistant-sci/pipeline/` (bean `saqd`
    // group 2: `conjectural-propagation-audit`, `generate-lean-stubs`,
    // `proof-narrative-lean-equiv-sweep`) and are pinned in
    // `folio-assistant-sci/scripts/tests/lean-decl-starts-are-shared.test.ts`.
    //
    // `axiom` and `opaque` are the two that cost 243 declarations in the
    // corpus sweep, and three of the five miss one or both.
    //
    // NOT converged here, for the bean's own reason: each feeds a different
    // consumer, so each is its own corpus re-sweep and its own changed verdict
    // on merged content. Converging five more on the strength of one sweep is
    // exactly the "cleanup becomes a silent re-scoring" the bean warns about.
    //
    // 🛑 The last two rows (`lean-formal-ref`, `lean-coverage`) moved to
    // folio-assistant-sci too, so the list is down to the canonical module and
    // the title says so: no other module here carries its own any more.
    //
    // Asserted by FILE rather than by line, so an unrelated edit above a
    // pattern does not fail this. The list may only shrink: a second file fails
    // here.
    expect(patternFiles()).toEqual([
      "cat-harness-tools/pipeline/lean-lexer.ts",
    ]);
  });

  test("...and it is used from outside, so the rule is not vacuous", () => {
    const callers = files.filter(
      (f) => relative(ROOT, f) !== CANONICAL && /declarationStarts/.test(readFileSync(f, "utf-8")),
    );
    expect(callers.length).toBeGreaterThanOrEqual(1);
  });
});

describe("the corpus this was swept against is not in this repository", () => {
  test("no `.lean` file is tracked here", () => {
    // KEPT from the file this replaced, because the assertion was always true
    // and is worth holding: this is the platform, and Lean content belongs to
    // a folio. What changed is the inference — a sibling checkout is where the
    // corpus lives, and `lean-lexer-is-the-only-stripper.test.ts` had already
    // swept one from a container like this.
    const found = [...new Glob("**/*.lean").scanSync({ cwd: ROOT, onlyFiles: true })].filter(
      (p) => !p.includes("node_modules"),
    );
    expect(found, `Lean files appeared: ${found.slice(0, 5).join(", ")}`).toEqual([]);
  });

  test("so the sweep's results are recorded rather than re-run in CI", () => {
    // A test cannot re-derive 52,144 from a repository holding zero files. The
    // numbers live in `declarationStarts`' comment and this module's header,
    // and what CI checks is the behaviour they justified — every assertion
    // above. This test pins that the claim is written down somewhere a reader
    // will find it, so converging without recording a sweep fails here.
    const lexer = readFileSync(resolve(ROOT, CANONICAL), "utf-8");
    expect(lexer).toContain("52,144");
    expect(lexer).toContain("3,971");
  });
});
