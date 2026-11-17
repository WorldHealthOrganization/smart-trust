/**
 * Tests for repo-conversion scanner outside-content math artifact detection
 * and candidate classification (folio-assistant-qdai).
 *
 * Recorded from the qou orphaned-content census (2026-10-04, session 01NdDGeP1SyShmoUssLuRZ91,
 * issue #2106): 30 docs/audits/*.lean (several refuting paper claims, e.g.
 * skein-mass-relation-is-false), 68 docs/audits/*.py computations, and 272 derivation notes
 * live outside folio/ and are linked by no block. A conversion carrying only the content
 * tree drops evidence that some claims are false.
 *
 * @module scripts/tests/repo-conversion-math-scan
 */

import { describe, expect, test } from "bun:test";
import {
  classifyMathCandidate,
  formatScan,
  scanMathCandidates,
  scanRepo,
} from "../scan-repo-content.js";
import { gitFixtureRepo } from "../../test/support/git-fixture.js";

describe("repo-conversion: math candidate classification (unit)", () => {
  test("classifies audit refutations by path, filename, and content cues", () => {
    const c1 = classifyMathCandidate("docs/audits/skein-mass-relation-is-false.lean");
    expect(c1).not.toBeNull();
    expect(c1?.classification).toBe("audit_refutation");
    expect(c1?.kind).toBe("audit_refutation");
    expect(c1?.rationale).toContain("refutation");

    const c2 = classifyMathCandidate("audits/counterexample.py");
    expect(c2).not.toBeNull();
    expect(c2?.classification).toBe("audit_refutation");

    const c3 = classifyMathCandidate("docs/audits/claim-disproof-note.md");
    expect(c3).not.toBeNull();
    expect(c3?.classification).toBe("audit_refutation");
  });

  test("classifies formal math proofs outside content tree", () => {
    const lean = classifyMathCandidate("docs/audits/helper.lean");
    expect(lean).not.toBeNull();
    expect(lean?.classification).toBe("math_proof");
    expect(lean?.rationale).toContain("Lean");

    const coq = classifyMathCandidate("math/specs.v");
    expect(coq).not.toBeNull();
    expect(coq?.classification).toBe("math_proof");
    expect(coq?.rationale).toContain("Coq");

    const isabelle = classifyMathCandidate("scripts/lemma.thy");
    expect(isabelle).not.toBeNull();
    expect(isabelle?.classification).toBe("math_proof");
    expect(isabelle?.rationale).toContain("Isabelle");
  });

  test("classifies computation and numerical verification scripts", () => {
    const py = classifyMathCandidate("docs/audits/verify_eigenvalues.py");
    expect(py).not.toBeNull();
    expect(py?.classification).toBe("computation_script");

    const sage = classifyMathCandidate("computations/orbit_calc.sage");
    expect(sage).not.toBeNull();
    expect(sage?.classification).toBe("computation_script");

    const nb = classifyMathCandidate("computations/spectrum_simulation.ipynb");
    expect(nb).not.toBeNull();
    expect(nb?.classification).toBe("computation_script");
  });

  test("classifies TeX macros, custom commands, and standalone tables", () => {
    const macros = classifyMathCandidate("macros.tex");
    expect(macros).not.toBeNull();
    expect(macros?.classification).toBe("macro_definition");

    const table = classifyMathCandidate("tables/spin_table.tex");
    expect(table).not.toBeNull();
    expect(table?.classification).toBe("macro_definition");

    const preamble = classifyMathCandidate("preamble/defs.sty");
    expect(preamble).not.toBeNull();
    expect(preamble?.classification).toBe("macro_definition");
  });

  test("classifies derivation notes and mathematical scratchpads", () => {
    const note = classifyMathCandidate("docs/notes/derivation-step1.md");
    expect(note).not.toBeNull();
    expect(note?.classification).toBe("derivation_note");

    const scratch = classifyMathCandidate("notes/proof_scratchpad.md");
    expect(scratch).not.toBeNull();
    expect(scratch?.classification).toBe("derivation_note");

    const deriv = classifyMathCandidate("derivations/spin_chain.tex");
    expect(deriv).not.toBeNull();
    expect(deriv?.classification).toBe("derivation_note");
  });

  test("returns null for non-math files outside content tree", () => {
    expect(classifyMathCandidate("README.md")).toBeNull();
    expect(classifyMathCandidate("docs/install.md")).toBeNull();
    expect(classifyMathCandidate("docs/contributing.txt")).toBeNull();
    expect(classifyMathCandidate("scripts/deploy.sh")).toBeNull();
    expect(classifyMathCandidate("scripts/build.ts")).toBeNull();
    expect(classifyMathCandidate("assets/diagram.png")).toBeNull();
  });
});

describe("repo-conversion: math candidate scanning with fixtures (integration)", () => {
  test("scans outside math candidates with link status and reporting", () => {
    const fx = gitFixtureRepo({
      files: {
        // Content tree files
        "content/chapter1/intro.md": "# Chapter 1\nWe cite helper from docs/audits/helper.lean.\n",
        "content/chapter1/main.md": "# Claims\nHere is theorem 1.\n",

        // Outside mathematical evidence
        "docs/audits/skein-mass-relation-is-false.lean":
          "-- theorem skein_mass_relation_is_false : False := sorry\n",
        "docs/audits/helper.lean":
          "-- theorem helper_lemma : True := trivial\n",
        "computations/verify_mass.py":
          "import numpy as np\nprint('verifying mass spectrum')\n",
        "macros.tex":
          "\\newcommand{\\R}{\\mathbb{R}}\n",
        "docs/notes/mass-derivation.md":
          "# Derivation of mass\nLet $m_0$ be the bare mass.\n",

        // Outside non-math file
        "docs/contributing.md":
          "# How to contribute\nOpen a PR.\n",
        "README.md":
          "# Example Repo\n",
      },
    });

    try {
      const candidates = scanMathCandidates(fx.root);
      expect(candidates.length).toBe(5);

      // 1. Audit refutation (unlinked!)
      const refut = candidates.find((c) => c.path === "docs/audits/skein-mass-relation-is-false.lean");
      expect(refut).toBeDefined();
      expect(refut?.classification).toBe("audit_refutation");
      expect(refut?.linkStatus).toBe("unlinked");
      expect(refut?.linkedBy).toBeUndefined();

      // 2. Math proof (linked by content/chapter1/intro.md!)
      const helper = candidates.find((c) => c.path === "docs/audits/helper.lean");
      expect(helper).toBeDefined();
      expect(helper?.classification).toBe("math_proof");
      expect(helper?.linkStatus).toBe("linked");
      expect(helper?.linkedBy).toEqual(["content/chapter1/intro.md"]);

      // 3. Computation script (unlinked)
      const comp = candidates.find((c) => c.path === "computations/verify_mass.py");
      expect(comp).toBeDefined();
      expect(comp?.classification).toBe("computation_script");
      expect(comp?.linkStatus).toBe("unlinked");

      // 4. Macro definition (unlinked)
      const macro = candidates.find((c) => c.path === "macros.tex");
      expect(macro).toBeDefined();
      expect(macro?.classification).toBe("macro_definition");
      expect(macro?.linkStatus).toBe("unlinked");

      // 5. Derivation note (unlinked)
      const note = candidates.find((c) => c.path === "docs/notes/mass-derivation.md");
      expect(note).toBeDefined();
      expect(note?.classification).toBe("derivation_note");
      expect(note?.linkStatus).toBe("unlinked");

      // Integration with scanRepo
      const result = scanRepo(fx.root);
      expect(result.mathCandidates.length).toBe(5);

      // Verify formatScan output warns about unlinked refutations
      const formatted = formatScan(result);
      expect(formatted).toContain("Outside-content mathematical candidates (5 artifact(s), 4 unlinked):");
      expect(formatted).toContain("WARNING: These files live OUTSIDE the content tree.");
      expect(formatted).toContain("[audit_refutation] docs/audits/skein-mass-relation-is-false.lean");
      expect(formatted).toContain("UNLINKED (danger of dropping!)");
      expect(formatted).toContain("[math_proof] docs/audits/helper.lean");
      expect(formatted).toContain("linked by content/chapter1/intro.md");

      // Read-only verification: working tree remained completely untouched
      expect(fx.git("status", "--porcelain")).toBe("");
    } finally {
      fx.cleanup();
    }
  });

  test("negative control: clean content-only repo reports 0 math candidates", () => {
    const fx = gitFixtureRepo({
      files: {
        "content/chapter1/intro.md": "# Chapter 1\nIntroduction.\n",
        "content/chapter1/sec1.md": "# Section 1\nDetails.\n",
        "README.md": "# Clean repo\n",
      },
    });

    try {
      const candidates = scanMathCandidates(fx.root);
      expect(candidates).toEqual([]);

      const result = scanRepo(fx.root);
      expect(result.mathCandidates).toEqual([]);

      const formatted = formatScan(result);
      expect(formatted).not.toContain("Outside-content mathematical candidates");
      expect(fx.git("status", "--porcelain")).toBe("");
    } finally {
      fx.cleanup();
    }
  });

  test("negative control: repo with non-math outside files reports 0 math candidates", () => {
    const fx = gitFixtureRepo({
      files: {
        "content/chapter1.md": "# Chapter 1\n",
        "docs/setup.md": "# Setup instructions\nRun bun install.\n",
        "docs/contributing.md": "# Contributing guidelines\nSubmit PRs.\n",
        "scripts/deploy.sh": "#!/bin/sh\necho deploy\n",
        "scripts/check.ts": "console.log('check');\n",
        "README.md": "# Repo\n",
      },
    });

    try {
      const candidates = scanMathCandidates(fx.root);
      expect(candidates).toEqual([]);

      const result = scanRepo(fx.root);
      expect(result.mathCandidates).toEqual([]);
      expect(fx.git("status", "--porcelain")).toBe("");
    } finally {
      fx.cleanup();
    }
  });

  test("negative control: math files inside content tree are not treated as outside candidates", () => {
    const fx = gitFixtureRepo({
      files: {
        "content/theorems/proof.lean": "theorem thm1 : True := trivial\n",
        "content/scripts/compute.py": "import numpy as np\n",
        "README.md": "# Repo\n",
      },
    });

    try {
      const candidates = scanMathCandidates(fx.root);
      expect(candidates).toEqual([]);

      const result = scanRepo(fx.root);
      expect(result.mathCandidates).toEqual([]);
      expect(fx.git("status", "--porcelain")).toBe("");
    } finally {
      fx.cleanup();
    }
  });
});
