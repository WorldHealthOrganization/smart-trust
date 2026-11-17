/**
 * Regression tests for the script-quality Python checker.
 *
 * Locks in the masking-bug fixes (sentinel exemption against the
 * original source line; `float(...)` cast scan that does not
 * double-flag inner literals) and the regex-robustness improvements
 * (PEP 515 underscores, one level of nested parens, multiline
 * casts).
 *
 * Run via the standard `bun test` harness:
 *
 *     ./scripts/tests/run-tests.sh
 *     # or
 *     cd scripts/tests && bun test qa-checkers-python.test.ts
 */

import { describe, test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  checkDoesNotDefaultToFloat,
  checkRespectsArchimedeanWall,
  checkCodeIsCommented,
  checkVariablesTyped,
  checkHasReferencesToPaper,
  checkConnectedToCiPipeline,
  checkDeprecated,
  checkUsesLibraryFrameworkAppropriately,
  checkAssertionsAreFalsifiable,
} from "../../pipeline/qa-checkers-python";

/** Write `source` to a temp `.py` and run `fn` against its path. */
function withPy<T>(source: string, fn: (p: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "qa-py-"));
  try {
    const file = join(dir, "fixture.py");
    writeFileSync(file, source);
    return fn(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runChecker(source: string): {
  bare_literals: number;
  float_casts: number;
  hits: Array<{ text: string }>;
} {
  const dir = mkdtempSync(join(tmpdir(), "qa-checkers-python-"));
  try {
    const file = join(dir, "fixture.py");
    writeFileSync(file, source);
    const res = checkDoesNotDefaultToFloat(file);
    let bare_literals = 0;
    let float_casts = 0;
    for (const h of res.hits) {
      if (h.text.startsWith("bare float literal")) bare_literals++;
      else if (h.text.startsWith("bare `float(")) float_casts++;
    }
    return { bare_literals, float_casts, hits: res.hits };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("checkDoesNotDefaultToFloat — sentinel exemption", () => {
  test("float('inf') is exempt", () => {
    const r = runChecker('x = float("inf")\n');
    expect(r).toEqual({ bare_literals: 0, float_casts: 0, hits: [] });
  });

  test("float('nan') is exempt", () => {
    const r = runChecker("y = float('nan')\n");
    expect(r).toEqual({ bare_literals: 0, float_casts: 0, hits: [] });
  });

  test("float('-inf') is exempt", () => {
    const r = runChecker('z = float("-inf")\n');
    expect(r).toEqual({ bare_literals: 0, float_casts: 0, hits: [] });
  });

  test("float('infinity') is exempt (Python long form)", () => {
    const r = runChecker('a = float("infinity")\n');
    expect(r).toEqual({ bare_literals: 0, float_casts: 0, hits: [] });
  });

  test("sentinel exemption is case-insensitive", () => {
    const r = runChecker('a = float("INF")\n');
    expect(r).toEqual({ bare_literals: 0, float_casts: 0, hits: [] });
  });
});

describe("checkDoesNotDefaultToFloat — no double-flag", () => {
  test("float(1.0) is reported ONCE as a cast", () => {
    const r = runChecker("a = float(1.0)\n");
    expect(r.bare_literals).toBe(0);
    expect(r.float_casts).toBe(1);
  });

  test("float(x) on a name is a cast hit, no literal hit", () => {
    const r = runChecker("b = float(x)\n");
    expect(r.bare_literals).toBe(0);
    expect(r.float_casts).toBe(1);
  });
});

describe("checkDoesNotDefaultToFloat — bare literals", () => {
  test("bare float literal outside any cast is reported once", () => {
    const r = runChecker("c = 1.5\n");
    expect(r.bare_literals).toBe(1);
    expect(r.float_casts).toBe(0);
  });

  test("scientific notation literal is reported", () => {
    const r = runChecker("d = 3.14e-10\n");
    expect(r.bare_literals).toBe(1);
    expect(r.float_casts).toBe(0);
  });

  test("two bare literals on one line each report", () => {
    const r = runChecker("i = 1.0 + 2.0\n");
    expect(r.bare_literals).toBe(2);
    expect(r.float_casts).toBe(0);
  });

  test("cast + unrelated literal both report", () => {
    const r = runChecker("j = float(x) + 2.0\n");
    expect(r.bare_literals).toBe(1);
    expect(r.float_casts).toBe(1);
  });
});

describe("checkDoesNotDefaultToFloat — string + comment exemption", () => {
  test("float literal inside a `#` comment is exempt", () => {
    const r = runChecker("e = 1  # set to 1.5 later\n");
    expect(r).toEqual({ bare_literals: 0, float_casts: 0, hits: [] });
  });

  test("float literal inside a single-line string is exempt", () => {
    const r = runChecker('f = "value is 1.5 by default"\n');
    expect(r).toEqual({ bare_literals: 0, float_casts: 0, hits: [] });
  });

  test("float literal inside a triple-quoted docstring is exempt", () => {
    const r = runChecker('"""\nDoc says 1.0 is allowed here.\n"""\ng = 1\n');
    expect(r).toEqual({ bare_literals: 0, float_casts: 0, hits: [] });
  });

  test("mpmath.mpf('0.5') string arg is exempt", () => {
    const r = runChecker('from mpmath import mpf\nh = mpf("0.5")\n');
    expect(r).toEqual({ bare_literals: 0, float_casts: 0, hits: [] });
  });

  test("no floats at all → pass with zero hits", () => {
    const r = runChecker("k = 1\nl = 'plain string'\n");
    expect(r).toEqual({ bare_literals: 0, float_casts: 0, hits: [] });
  });
});

describe("checkDoesNotDefaultToFloat — PEP 515 underscores", () => {
  test("1_000.5 is reported as a bare float literal", () => {
    const r = runChecker("m = 1_000.5\n");
    expect(r.bare_literals).toBe(1);
    expect(r.hits[0].text).toContain("1_000.5");
  });

  test("1.5_5e1_0 (underscore in mantissa + exponent) is reported", () => {
    const r = runChecker("n = 1.5_5e1_0\n");
    expect(r.bare_literals).toBe(1);
  });

  test("1.5e10 is reported as the full e-form, not split at the dot", () => {
    const r = runChecker("p = 1.5e10\n");
    expect(r.bare_literals).toBe(1);
    expect(r.hits[0].text).toContain("1.5e10");
  });
});

describe("checkDoesNotDefaultToFloat — nested parens", () => {
  test("float(int(x)) is captured as a single cast (one level of nesting)", () => {
    const r = runChecker("q = float(int(x))\n");
    expect(r.float_casts).toBe(1);
    expect(r.bare_literals).toBe(0);
  });

  test("float(int(1.0)) reports cast once; inner literal blanked by cast", () => {
    const r = runChecker("r = float(int(1.0))\n");
    // The cast hit captures the full call; the inner 1.0 is blanked
    // out by the cast's region so the literal scan does not see it.
    expect(r.float_casts).toBe(1);
    expect(r.bare_literals).toBe(0);
  });
});

describe("checkDoesNotDefaultToFloat — multiline casts", () => {
  test('multiline float("inf") sentinel (Black-style) is exempt', () => {
    const r = runChecker('s = float(\n    "inf"\n)\n');
    expect(r).toEqual({ bare_literals: 0, float_casts: 0, hits: [] });
  });

  test("multiline float(1.0) (Black-style) reports cast once", () => {
    const r = runChecker("t = float(\n    1.0,\n)\n");
    expect(r.float_casts).toBe(1);
    expect(r.bare_literals).toBe(0);
  });
});

describe("checkDoesNotDefaultToFloat — trailing-comma sentinel (Black)", () => {
  test('single-line float("inf",) is exempt', () => {
    const r = runChecker('u = float("inf",)\n');
    expect(r).toEqual({ bare_literals: 0, float_casts: 0, hits: [] });
  });

  test('multiline float(\\n  "inf",\\n) is exempt', () => {
    const r = runChecker('v = float(\n    "inf",\n)\n');
    expect(r).toEqual({ bare_literals: 0, float_casts: 0, hits: [] });
  });

  test('float("nan",) is exempt', () => {
    const r = runChecker('w = float("nan",)\n');
    expect(r).toEqual({ bare_literals: 0, float_casts: 0, hits: [] });
  });
});

describe("checkDoesNotDefaultToFloat — format-spec exemption", () => {
  test("f-string format spec {x:.2f} does not flag .2 as a bare float", () => {
    // `.2f` after `:` is a precision specifier, not code. The `:`
    // lookbehind blocks the bare-literal regex.
    const r = runChecker('aa = f"value is {x:.2f}"\n');
    expect(r).toEqual({ bare_literals: 0, float_casts: 0, hits: [] });
  });

  test("f-string width.precision spec {x:10.5f} does not flag 10.5", () => {
    const r = runChecker('ab = f"{x:10.5f}"\n');
    expect(r).toEqual({ bare_literals: 0, float_casts: 0, hits: [] });
  });

  test("regular `.format()` spec is also exempt", () => {
    const r = runChecker('ac = "{x:.2f}".format(x=v)\n');
    expect(r.bare_literals).toBe(0);
  });
});

describe("checkDoesNotDefaultToFloat — f-string limitations (documented)", () => {
  // F-string expression regions are masked uniformly with their text
  // portions, so bare floats inside `f'{1.0}'` are CURRENTLY false
  // negatives. This is a documented heuristic limitation; the test
  // locks in the current behaviour so a future change is intentional.
  // Full f-string awareness lands in a follow-up PR.
  test("bare float inside f-string expression is a (documented) false negative", () => {
    const r = runChecker('ad = f"{1.0}"\n');
    expect(r.bare_literals).toBe(0); // current heuristic limitation
  });

  test("text-only f-string content does not produce false positives", () => {
    // The mask correctly suppresses bare-float matches inside the
    // text portion of an f-string.
    const r = runChecker('ae = f"value is 1.0 by default"\n');
    expect(r.bare_literals).toBe(0);
  });
});

// ─── helpers for the per-checker test suites below ─────────────

function withFixtureFile<T>(
  source: string,
  fn: (path: string) => T,
): T {
  const dir = mkdtempSync(join(tmpdir(), "qa-checkers-fixture-"));
  try {
    const file = join(dir, "fixture.py");
    writeFileSync(file, source);
    return fn(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ─── respects_archimedean_wall ─────────────────────────────────

describe("checkRespectsArchimedeanWall", () => {
  test("flags math.sqrt(x)", () => {
    const r = withFixtureFile(
      "import math\ny = math.sqrt(x)\n",
      checkRespectsArchimedeanWall,
    );
    expect(r.result).toBe("fail");
    expect(r.hits.some((h) => h.text.includes("math.sqrt"))).toBe(true);
  });

  test("flags numpy.cos and np.exp", () => {
    const r = withFixtureFile(
      "import numpy as np\nimport numpy\na = np.exp(x)\nb = numpy.cos(y)\n",
      checkRespectsArchimedeanWall,
    );
    expect(r.result).toBe("fail");
    expect(r.hits.length).toBeGreaterThanOrEqual(2);
  });

  test("flags numpy.float64 type usage", () => {
    const r = withFixtureFile(
      "import numpy\nx: numpy.float64 = 1\n",
      checkRespectsArchimedeanWall,
    );
    expect(r.result).toBe("fail");
    expect(r.hits.some((h) => h.text.includes("numpy.float64"))).toBe(true);
  });

  test("passes when only mpmath is used", () => {
    const r = withFixtureFile(
      "from mpmath import mp\ny = mp.sqrt(x)\n",
      checkRespectsArchimedeanWall,
    );
    expect(r.result).toBe("pass");
  });

  test("comments mentioning math.sqrt do not trigger", () => {
    const r = withFixtureFile(
      "# we deliberately do not use math.sqrt here\ny = mp.sqrt(x)\n",
      checkRespectsArchimedeanWall,
    );
    expect(r.result).toBe("pass");
  });
});

// ─── code_is_commented ─────────────────────────────────────────

describe("checkCodeIsCommented", () => {
  test("passes with a top-of-file docstring", () => {
    const r = withFixtureFile(
      '"""Module docstring."""\nx = 1\ny = 2\n',
      checkCodeIsCommented,
    );
    expect(r.result).toBe("pass");
  });

  test("passes with docstring after `from __future__`", () => {
    const r = withFixtureFile(
      'from __future__ import annotations\n"""Doc."""\nx=1\n',
      checkCodeIsCommented,
    );
    expect(r.result).toBe("pass");
  });

  test("fails with no docstring and < 10% comments", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `x${i} = ${i}`).join("\n");
    const r = withFixtureFile(lines + "\n", checkCodeIsCommented);
    expect(r.result).toBe("fail");
    expect(r.hits[0].text).toContain("0/20");
  });

  test("passes with ≥ 10% comment density", () => {
    const code = ["# comment 1", "# comment 2"].concat(
      Array.from({ length: 15 }, (_, i) => `x${i} = ${i}`),
    ).join("\n") + "\n";
    const r = withFixtureFile(code, checkCodeIsCommented);
    expect(r.result).toBe("pass");
  });

  test("passes for empty file (n/a)", () => {
    const r = withFixtureFile("", checkCodeIsCommented);
    expect(r.result).toBe("n/a");
  });
});

// ─── variables_typed ───────────────────────────────────────────

describe("checkVariablesTyped", () => {
  test("flags def foo(x):", () => {
    const r = withFixtureFile(
      "def foo(x):\n    return x + 1\n",
      checkVariablesTyped,
    );
    expect(r.result).toBe("fail");
    expect(r.hits[0].text).toContain("def foo");
  });

  test("passes def foo(x: int) -> int:", () => {
    const r = withFixtureFile(
      "def foo(x: int) -> int:\n    return x\n",
      checkVariablesTyped,
    );
    expect(r.result).toBe("pass");
  });

  test("self / cls / *args / **kwargs are exempt", () => {
    const r = withFixtureFile(
      "class C:\n    def m(self, x: int, *args, **kwargs):\n        pass\n",
      checkVariablesTyped,
    );
    expect(r.result).toBe("pass");
  });

  test("partial typing — flags only the untyped params", () => {
    const r = withFixtureFile(
      "def foo(x: int, y):\n    pass\n",
      checkVariablesTyped,
    );
    expect(r.result).toBe("fail");
    expect(r.hits[0].text).toContain("y");
  });

  test("no-arg function is trivially typed", () => {
    const r = withFixtureFile(
      "def foo():\n    pass\n",
      checkVariablesTyped,
    );
    expect(r.result).toBe("pass");
  });
});

// ─── has_references_to_paper ───────────────────────────────────

describe("checkHasReferencesToPaper", () => {
  // CONTRACT: sidecar metadata ONLY. The checker deliberately does not grep
  // source for citations — references live as structured metadata, mirroring
  // how content blocks declare `uses: []` / `cites: []` in their manifests.
  //
  // The two tests that used to sit here asserted the opposite (a `# Ref:`
  // comment in source was enough to pass). Checker and tests landed in the
  // same merge, 109a4ff, and the tests were never updated with the contract —
  // so they had been red ever since, asserting behaviour that was removed on
  // purpose. Rewritten to pin the real contract, including the part the old
  // pair was actually reaching for: a source comment is NOT a substitute.

  test("a `# Ref: [key]` comment in SOURCE does not count — metadata only", () => {
    const r = withFixtureFile(
      "# Ref: [kassel1995] Quantum Groups\nx = 1\n",
      checkHasReferencesToPaper,
    );
    expect(r.result).toBe("fail");
  });

  test("an indented Ref comment does not count either", () => {
    const r = withFixtureFile(
      "def f():\n    # Ref: [jones1985] doi:10.1090\n    pass\n",
      checkHasReferencesToPaper,
    );
    expect(r.result).toBe("fail");
  });

  test("passes when the sidecar declares references", () => {
    const r = withFixtureFile("x = 1\n", (p) =>
      checkHasReferencesToPaper(p, ["prop:foo", "kassel1995"]),
    );
    expect(r.result).toBe("pass");
  });

  test("an explicit empty array is a deliberate declaration and passes", () => {
    // `[]` means "pure infrastructure, no paper backing" — distinct from
    // `undefined`, which means the field was never filled in.
    const r = withFixtureFile("x = 1\n", (p) => checkHasReferencesToPaper(p, []));
    expect(r.result).toBe("pass");
  });

  test("the failure message tells the author what to add", () => {
    const r = withFixtureFile("x = 1\n", checkHasReferencesToPaper);
    expect(r.result).toBe("fail");
    expect(r.hits[0]?.text).toContain("references");
  });

  test("fails with no Ref citation", () => {
    const r = withFixtureFile(
      "# normal comment\nx = 1\n",
      checkHasReferencesToPaper,
    );
    expect(r.result).toBe("fail");
  });

  test("does not match `Ref:` mid-line (must be a comment)", () => {
    const r = withFixtureFile(
      'doc = "see Ref: [key]"\nx = 1\n',
      checkHasReferencesToPaper,
    );
    expect(r.result).toBe("fail");
  });
});

// ─── connected_to_ci_pipeline ──────────────────────────────────

describe("checkConnectedToCiPipeline", () => {
  function withRepoFixture(
    files: Record<string, string>,
  ): { repoRoot: string; cleanup: () => void } {
    const repoRoot = mkdtempSync(join(tmpdir(), "qa-ci-fixture-"));
    for (const [rel, content] of Object.entries(files)) {
      const abs = join(repoRoot, rel);
      mkdirSync(join(abs, ".."), { recursive: true });
      writeFileSync(abs, content);
    }
    return {
      repoRoot,
      cleanup: () => rmSync(repoRoot, { recursive: true, force: true }),
    };
  }

  test("passes when basename appears in a workflow file", () => {
    const { repoRoot, cleanup } = withRepoFixture({
      "scripts/foo.py": "x = 1\n",
      ".github/workflows/run.yml":
        "jobs:\n  test:\n    steps:\n      - run: python scripts/foo.py\n",
    });
    try {
      const r = checkConnectedToCiPipeline(
        join(repoRoot, "scripts/foo.py"),
        repoRoot,
      );
      expect(r.result).toBe("pass");
    } finally {
      cleanup();
    }
  });

  test("fails when not referenced anywhere", () => {
    const { repoRoot, cleanup } = withRepoFixture({
      "scripts/orphan.py": "x = 1\n",
      ".github/workflows/run.yml": "jobs:\n  test:\n    steps: []\n",
    });
    try {
      const r = checkConnectedToCiPipeline(
        join(repoRoot, "scripts/orphan.py"),
        repoRoot,
      );
      expect(r.result).toBe("fail");
    } finally {
      cleanup();
    }
  });

  test("passes when imported by a sibling script", () => {
    const { repoRoot, cleanup } = withRepoFixture({
      "scripts/helper.py": "def h(): pass\n",
      "scripts/main.py": "from helper import h\nh()\n",
      ".github/workflows/run.yml": "jobs:\n  test:\n    steps:\n      - run: python scripts/main.py\n",
    });
    try {
      const r = checkConnectedToCiPipeline(
        join(repoRoot, "scripts/helper.py"),
        repoRoot,
      );
      expect(r.result).toBe("pass");
    } finally {
      cleanup();
    }
  });

  test("__init__.py is n/a", () => {
    const { repoRoot, cleanup } = withRepoFixture({
      "scripts/__init__.py": "",
    });
    try {
      const r = checkConnectedToCiPipeline(
        join(repoRoot, "scripts/__init__.py"),
        repoRoot,
      );
      expect(r.result).toBe("n/a");
    } finally {
      cleanup();
    }
  });

  test("scripts under _deprecated/ are n/a", () => {
    const { repoRoot, cleanup } = withRepoFixture({
      "scripts/_deprecated/old.py": "x = 1\n",
    });
    try {
      const r = checkConnectedToCiPipeline(
        join(repoRoot, "scripts/_deprecated/old.py"),
        repoRoot,
      );
      expect(r.result).toBe("n/a");
    } finally {
      cleanup();
    }
  });
});

// ─── deprecated ────────────────────────────────────────────────

describe("checkDeprecated", () => {
  test("flags scripts under /_deprecated/", () => {
    const dir = mkdtempSync(join(tmpdir(), "qa-deprecated-"));
    try {
      const sub = join(dir, "_deprecated");
      mkdirSync(sub);
      const file = join(sub, "old.py");
      writeFileSync(file, "x = 1\n");
      const r = checkDeprecated(file);
      expect(r.result).toBe("fail");
      expect(r.hits[0].text).toContain("_deprecated/");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("flags `# DEPRECATED` marker", () => {
    const r = withFixtureFile(
      "# DEPRECATED — use foo.py instead\nx = 1\n",
      checkDeprecated,
    );
    expect(r.result).toBe("fail");
    expect(r.hits[0].text).toContain("# DEPRECATED");
  });

  test("flags DEPRECATED in module docstring", () => {
    const r = withFixtureFile(
      '"""DEPRECATED — use foo instead."""\nx = 1\n',
      checkDeprecated,
    );
    expect(r.result).toBe("fail");
    expect(r.hits[0].text).toContain("docstring");
  });

  test("passes for normal scripts", () => {
    const r = withFixtureFile(
      '"""Normal module."""\nx = 1\n',
      checkDeprecated,
    );
    expect(r.result).toBe("pass");
  });

  test("does not match `deprecated` lowercase in prose", () => {
    const r = withFixtureFile(
      '"""This module is not deprecated."""\nx = 1\n',
      checkDeprecated,
    );
    expect(r.result).toBe("pass");
  });
});

// ─── uses_library_framework_appropriately ─────────────────────

describe("checkUsesLibraryFrameworkAppropriately", () => {
  test("flags witness-write without WitnessBuilder import", () => {
    const r = withFixtureFile(
      'out = "foo.witness.json"\nopen(out, "w").write("{}")\n',
      checkUsesLibraryFrameworkAppropriately,
    );
    expect(r.result).toBe("fail");
    expect(r.hits[0].text).toContain("WitnessBuilder");
  });

  test("passes witness-write WITH WitnessBuilder import", () => {
    const r = withFixtureFile(
      'from witness_base import WitnessBuilder\nout = "foo.witness.json"\n',
      checkUsesLibraryFrameworkAppropriately,
    );
    expect(r.result).toBe("pass");
  });

  test("flags hardcoded `pi = 3.14…` constant", () => {
    const r = withFixtureFile(
      "pi = 3.14159265\nx = 1\n",
      checkUsesLibraryFrameworkAppropriately,
    );
    expect(r.result).toBe("fail");
    expect(r.hits[0].text).toContain("pi = 3.14");
  });

  test("flags hardcoded `e = 2.71…` constant", () => {
    const r = withFixtureFile(
      "e = 2.71828\nx = 1\n",
      checkUsesLibraryFrameworkAppropriately,
    );
    expect(r.result).toBe("fail");
    expect(r.hits[0].text).toContain("e = 2.71");
  });

  test("passes script with no witness-write and no hardcoded constants", () => {
    const r = withFixtureFile(
      "x = mp.pi + mp.e\n",
      checkUsesLibraryFrameworkAppropriately,
    );
    expect(r.result).toBe("pass");
  });

  test("comment mentioning `.witness.json` does not require WitnessBuilder", () => {
    const r = withFixtureFile(
      "# we generate foo.witness.json\nx = 1\n",
      checkUsesLibraryFrameworkAppropriately,
    );
    expect(r.result).toBe("pass");
  });
});

describe("assertions_are_falsifiable", () => {
  test("fires when computed and expected are the same expression", () => {
    const src = `
w.add_assertion("gluon", computed=sel[0], expected=sel[0], source="ILP")
`;
    const r = withPy(src, (p) => checkAssertionsAreFalsifiable(p));
    expect(r.result).toBe("fail");
    expect(r.hits[0].text).toContain("compares `sel[0]` to itself");
  });

  test("fires on literal-vs-literal, the clearest form", () => {
    const src = `
wb.add_assertion("kernel_ran", computed=1, expected=1, tolerance=0)
`;
    expect(withPy(src, (p) => checkAssertionsAreFalsifiable(p)).result).toBe("fail");
  });

  test("fires across a multi-line call", () => {
    const src = `
w.add_assertion(
    "tr_M",
    computed=r["tr_M"],
    expected=r["tr_M"],
    tolerance=1e-10,
)
`;
    expect(withPy(src, (p) => checkAssertionsAreFalsifiable(p)).result).toBe("fail");
  });

  test("does NOT fire when the two sides differ", () => {
    const src = `
w.add_assertion("vol", computed=vol_computed, expected=2.0298, tolerance=1e-6)
`;
    expect(withPy(src, (p) => checkAssertionsAreFalsifiable(p)).result).toBe("pass");
  });

  test("does NOT fire inside a docstring", () => {
    // `witness.py` documents its own API with a same-value example. Firing on
    // the documentation of the function under test was the first corpus run's
    // only false positive.
    const src = [
      '"""Usage:',
      '',
      '    w.add_assertion("Vol(4_1)", computed=2.0298, expected=2.0298)',
      '"""',
      'x = 1',
    ].join("\n");
    expect(withPy(src, (p) => checkAssertionsAreFalsifiable(p)).result).toBe("pass");
  });

  test("still sees string-valued tautologies", () => {
    // Only TRIPLE-quoted blocks are blanked; blanking every string literal
    // would trade the docstring false positive for these real ones.
    const src = `
w.add_assertion("resid", computed="0", expected="0")
`;
    expect(withPy(src, (p) => checkAssertionsAreFalsifiable(p)).result).toBe("fail");
  });

  test("n/a when the file has no assertions at all", () => {
    expect(withPy("x = 1\n", (p) => checkAssertionsAreFalsifiable(p)).result).toBe("n/a");
  });
});
