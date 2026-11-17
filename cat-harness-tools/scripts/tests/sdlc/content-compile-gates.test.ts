/**
 * Tests for content-type compile gates.
 *
 * Bean `folio-assistant-xqdi` (Child b of merge-gate epic `folio-assistant-nok9`).
 * Design: `cat-harness/docs/proposals/merge-gate-2026-10-02.md` §5.1, §5.4.
 *
 * Asserting the 4 Done-when criteria:
 * 1. Path → gate map declared as data, read by `gates.ts`
 * 2. Each gate has a test that fails it on purpose
 * 3. An `unknown` (toolchain absent, or cache cold/timeout) blocks; never reported as green
 * 4. Each gate runs on the merge-train result, not only on each PR head
 *
 * @module scripts/tests/content-compile-gates.test
 */

import { describe, expect, test } from "bun:test";
import {
  CONTENT_COMPILE_GATES,
  compileGatesForPrHead,
  compileGatesForMergeTrain,
  unionOfChangedPaths,
  evaluateLeanGate,
  evaluateFhirIgGate,
  evaluateKgGate,
  evaluateDownstreamRendersGate,
  evaluateIgPublisherGate,
  evaluateCompileGates,
  evaluateCompileGatesForMergeTrain,
  isLeanPath,
  isFhirIgPath,
  isKgPath,
  isRenderPath,
} from "../../content-compile-gates.ts";
import {
  CONTENT_COMPILE_GATES as GATES_TS_MAP,
  contentCompileGates as gatesTsQuery,
} from "../../gates.ts";

// declared-path-literal: a changed-file VECTOR for the path classifier and gates — never read.
const RENDER_PATH_VECTOR = "docs/index.md";

describe("Done-when (1): path → gate map declared as data, read by gates.ts", () => {
  test("CONTENT_COMPILE_GATES is declared as data array with required gate metadata", () => {
    expect(Array.isArray(CONTENT_COMPILE_GATES)).toBe(true);
    expect(CONTENT_COMPILE_GATES.length).toBeGreaterThanOrEqual(5);

    const ids = CONTENT_COMPILE_GATES.map((g) => g.id);
    expect(ids).toContain("G5");
    expect(ids).toContain("G6");
    expect(ids).toContain("G7");
    expect(ids).toContain("A1");
    expect(ids).toContain("A2");

    for (const gate of CONTENT_COMPILE_GATES) {
      expect(typeof gate.id).toBe("string");
      expect(typeof gate.name).toBe("string");
      expect(typeof gate.description).toBe("string");
      expect(typeof gate.blocking).toBe("boolean");
      expect(Array.isArray(gate.pathPatterns)).toBe(true);
      expect(typeof gate.matchesPath).toBe("function");
    }
  });

  test("blocking property matches design specification (§5.1)", () => {
    const g5 = CONTENT_COMPILE_GATES.find((g) => g.id === "G5")!;
    const g6 = CONTENT_COMPILE_GATES.find((g) => g.id === "G6")!;
    const g7 = CONTENT_COMPILE_GATES.find((g) => g.id === "G7")!;
    const a1 = CONTENT_COMPILE_GATES.find((g) => g.id === "A1")!;
    const a2 = CONTENT_COMPILE_GATES.find((g) => g.id === "A2")!;

    expect(g5.blocking).toBe(true);
    expect(g6.blocking).toBe(true);
    expect(g7.blocking).toBe(true);
    expect(a1.blocking).toBe(false);
    expect(a2.blocking).toBe(false);
  });

  test("gates.ts imports and re-exports the exact same declared data map", () => {
    expect(GATES_TS_MAP).toBe(CONTENT_COMPILE_GATES);
    expect(gatesTsQuery(["test/file.lean"]).map((g) => g.id)).toContain("G5");
  });

  test("path classifiers route correctly to gates", () => {
    expect(isLeanPath("content/ch1/Theorem.lean")).toBe(true);
    expect(isLeanPath("lakefile.lean")).toBe(true);
    expect(isLeanPath("lean-toolchain")).toBe(true);
    expect(isLeanPath("readme.md")).toBe(false);

    expect(isFhirIgPath("input/fsh/patient.fsh")).toBe(true);
    expect(isFhirIgPath("sushi-config.yaml")).toBe(true);
    expect(isFhirIgPath("ig-ast/models.json")).toBe(true);
    expect(isFhirIgPath("other/doc.md")).toBe(false);

    // declared-path-literal: the test's subject is this published context path itself, written as consumers see it.
    expect(isKgPath("ns/content/v1.jsonld")).toBe(true);
    expect(isKgPath("schemas/node.ts")).toBe(true);
    expect(isKgPath("skills/math/skill.json")).toBe(true);
    expect(isKgPath("processes/lane.bpmn")).toBe(true);

    expect(isRenderPath(RENDER_PATH_VECTOR)).toBe(true);
    expect(isRenderPath("_site/index.html")).toBe(true);
    expect(isRenderPath("paper.pdf")).toBe(true);
  });
});

describe("Done-when (2): each gate has a test that fails it on purpose", () => {
  describe("G5 (Lean compile & audit)", () => {
    test("fails on purpose when lake build fails", () => {
      const evaluation = evaluateLeanGate(["Chapter1.lean"], {
        lakeBuildRunner: (target) => ({
          ok: false,
          output: `error: ${target}: unknown identifier 'foo'`,
        }),
      });
      expect(evaluation.status).toBe("fail");
      expect(evaluation.blocked).toBe(true);
      expect(evaluation.details.some((d) => d.includes("Lake build failed"))).toBe(true);
    });

    test("fails on purpose when uncited sorry is found", () => {
      const content = `
theorem my_thm : 1 + 1 = 2 := by
  sorry
`;
      const evaluation = evaluateLeanGate(["Chapter1.lean"], {
        fileContents: { "Chapter1.lean": content },
      });
      expect(evaluation.status).toBe("fail");
      expect(evaluation.blocked).toBe(true);
      expect(evaluation.details.some((d) => d.includes("Uncited sorry"))).toBe(true);
    });

    test("fails on purpose when undeclared axiom is found", () => {
      const content = `
axiom evil_axiom : False
`;
      const evaluation = evaluateLeanGate(["Chapter1.lean"], {
        fileContents: { "Chapter1.lean": content },
        declaredAxioms: ["propext", "Quot.sound", "Classical.choice"],
      });
      expect(evaluation.status).toBe("fail");
      expect(evaluation.blocked).toBe(true);
      expect(evaluation.details.some((d) => d.includes("Undeclared axiom 'evil_axiom'"))).toBe(true);
    });

    test("passes when Lean file is clean with cited sorry and declared axioms", () => {
      const content = `
-- Ref: [CIT-123] https://example.com/proof
theorem my_thm : 1 + 1 = 2 := by
  sorry
`;
      const evaluation = evaluateLeanGate(["Chapter1.lean"], {
        fileContents: { "Chapter1.lean": content },
        lakeBuildRunner: () => ({ ok: true, output: "built successfully" }),
      });
      expect(evaluation.status).toBe("pass");
      expect(evaluation.blocked).toBe(false);
    });
  });

  describe("G6 (FHIR IG compile & AST extract)", () => {
    test("fails on purpose when SUSHI reports errors", () => {
      const evaluation = evaluateFhirIgGate(["input/fsh/patient.fsh"], {
        sushiRunner: () => ({
          errors: 2,
          warnings: 1,
          output: "error: Element 'id' not found in PatientProfile\nerror: Missing URL",
        }),
      });
      expect(evaluation.status).toBe("fail");
      expect(evaluation.blocked).toBe(true);
      expect(evaluation.details.some((d) => d.includes("SUSHI reported 2 error(s)"))).toBe(true);
    });

    test("fails on purpose when IG AST extraction fails", () => {
      const evaluation = evaluateFhirIgGate(["ig-ast/bundle.json"], {
        igAstExtractor: () => ({
          ok: false,
          error: "SyntaxError: Unexpected token in IG AST bundle",
        }),
      });
      expect(evaluation.status).toBe("fail");
      expect(evaluation.blocked).toBe(true);
      expect(evaluation.details.some((d) => d.includes("IG AST extraction failed"))).toBe(true);
    });

    test("passes when SUSHI reports 0 errors and AST extracts cleanly", () => {
      const evaluation = evaluateFhirIgGate(["input/fsh/patient.fsh"], {
        sushiRunner: () => ({ errors: 0, warnings: 2, output: "SUSHI completed" }),
        igAstExtractor: () => ({ ok: true }),
      });
      expect(evaluation.status).toBe("pass");
      expect(evaluation.blocked).toBe(false);
    });
  });

  describe("G7 (KG JSON-LD expand/compact & schema validation)", () => {
    test("fails on purpose when JSON-LD drops an unmapped term", async () => {
      const invalidJsonLd = JSON.stringify({
        "@context": {
          title: "http://purl.org/dc/terms/title",
        },
        title: "Valid Title",
        unmappedSecretField: "Dropped during expansion!",
      });

      const evaluation = await evaluateKgGate(["ns/content/test.jsonld"], {
        fileContents: { "ns/content/test.jsonld": invalidJsonLd },
      });

      expect(evaluation.status).toBe("fail");
      expect(evaluation.blocked).toBe(true);
      expect(evaluation.details.some((d) => d.includes("dropped term(s) [unmappedSecretField]"))).toBe(true);
    });

    test("fails on purpose when schema validation fails", async () => {
      const evaluation = await evaluateKgGate(["schemas/skill.json"], {
        fileContents: { "schemas/skill.json": "{}" },
        schemaValidator: () => ({
          ok: false,
          error: "Required property 'title' is missing",
        }),
      });
      expect(evaluation.status).toBe("fail");
      expect(evaluation.blocked).toBe(true);
      expect(evaluation.details.some((d) => d.includes("Schema validation failed"))).toBe(true);
    });

    test("fails on purpose when kg:audit reports critical findings", async () => {
      const evaluation = await evaluateKgGate(["processes/flow.bpmn"], {
        kgAuditRunner: () => ({
          ok: false,
          criticalFindings: 1,
          findings: ["lane 'Reviewer' is not bound to a declared role in scenarios/roles.json"],
        }),
      });
      expect(evaluation.status).toBe("fail");
      expect(evaluation.blocked).toBe(true);
      expect(evaluation.details.some((d) => d.includes("kg:audit:check failed with 1 critical finding"))).toBe(true);
    });

    test("passes when JSON-LD terms are preserved and schemas validate", async () => {
      const validJsonLd = JSON.stringify({
        "@context": {
          title: "http://purl.org/dc/terms/title",
          creator: "http://purl.org/dc/terms/creator",
        },
        title: "Valid Title",
        creator: "Agent",
      });

      const evaluation = await evaluateKgGate(["ns/content/test.jsonld"], {
        fileContents: { "ns/content/test.jsonld": validJsonLd },
        schemaValidator: () => ({ ok: true }),
        kgAuditRunner: () => ({ ok: true, criticalFindings: 0, findings: [] }),
      });

      expect(evaluation.status).toBe("pass");
      expect(evaluation.blocked).toBe(false);
    });
  });

  describe("A1 & A2 (Advisory Downstream Renders & IG Publisher)", () => {
    test("A1 warns on render error but NEVER blocks merge", () => {
      const evaluation = evaluateDownstreamRendersGate([RENDER_PATH_VECTOR], {
        renderRunner: () => ({
          ok: false,
          errors: ["Jekyll build error: unclosed Liquid tag"],
          warnings: ["Broken anchor link #foo"],
        }),
      });
      expect(evaluation.status).toBe("warn");
      expect(evaluation.blocking).toBe(false);
      expect(evaluation.blocked).toBe(false); // MUST NOT block!
    });

    test("A2 warns on IG Publisher qa.html errors/warnings but NEVER blocks merge", () => {
      const evaluation = evaluateIgPublisherGate(["input/fsh/patient.fsh"], {
        publisherRunner: () => ({
          errors: 3,
          warnings: 12,
          qaHtmlPath: "output/qa.html",
        }),
      });
      expect(evaluation.status).toBe("warn");
      expect(evaluation.blocking).toBe(false);
      expect(evaluation.blocked).toBe(false); // MUST NOT block!
      expect(evaluation.details.some((d) => d.includes("qa.html errors: 3"))).toBe(true);
    });
  });
});

describe("Done-when (3): an unknown (toolchain absent / cache cold timeout) blocks and is never green", () => {
  test("G5 (Lean) blocks on absent toolchain with status unknown", () => {
    const evaluation = evaluateLeanGate(["content/ch1/Proof.lean"], {
      toolchainAvailable: false,
    });
    expect(evaluation.status).toBe("unknown");
    expect(evaluation.blocked).toBe(true); // MUST BLOCK!
    expect(evaluation.summary).toContain("Toolchain absent");
  });

  test("G5 (Lean) blocks on cache cold / timeout with status unknown", () => {
    const evaluation = evaluateLeanGate(["content/ch1/Proof.lean"], {
      cacheTimeout: true,
    });
    expect(evaluation.status).toBe("unknown");
    expect(evaluation.blocked).toBe(true); // MUST BLOCK!
    expect(evaluation.summary).toContain("cache restore timed out");
  });

  test("G6 (FHIR IG) blocks on absent SUSHI toolchain with status unknown", () => {
    const evaluation = evaluateFhirIgGate(["input/fsh/Profile.fsh"], {
      toolchainAvailable: false,
    });
    expect(evaluation.status).toBe("unknown");
    expect(evaluation.blocked).toBe(true); // MUST BLOCK!
    expect(evaluation.summary).toContain("Toolchain absent");
  });

  test("G7 (KG) blocks on absent KG context with status unknown", () => {
    const evaluation = evaluateKgGate(["schemas/manifest.jsonld"], {
      contextAvailable: false,
    });
    // evaluateKgGate returns a promise
    return evaluation.then((ev) => {
      expect(ev.status).toBe("unknown");
      expect(ev.blocked).toBe(true); // MUST BLOCK!
      expect(ev.summary).toContain("KG context or schema validator unavailable");
    });
  });

  test("evaluateCompileGates overall is blocked and overallPassed is false when any blocking gate is unknown", async () => {
    const res = await evaluateCompileGates(["content/math.lean"], {
      lean: { toolchainAvailable: false },
    });
    expect(res.blocked).toBe(true);
    expect(res.overallPassed).toBe(false);
    expect(res.evaluations[0]!.status).toBe("unknown");
  });

  test("A1 (advisory) with absent renderer reports unknown but does NOT block merge", () => {
    const evaluation = evaluateDownstreamRendersGate([RENDER_PATH_VECTOR], {
      rendererAvailable: false,
    });
    expect(evaluation.status).toBe("unknown");
    expect(evaluation.blocking).toBe(false);
    expect(evaluation.blocked).toBe(false); // Advisory never blocks!
  });

  test("A2 (advisory) with absent publisher reports unknown but does NOT block merge", () => {
    const evaluation = evaluateIgPublisherGate(["input/fsh/patient.fsh"], {
      publisherAvailable: false,
    });
    expect(evaluation.status).toBe("unknown");
    expect(evaluation.blocking).toBe(false);
    expect(evaluation.blocked).toBe(false); // Advisory never blocks!
  });
});

describe("Done-when (4): each gate runs on the merge-train result, not only on each PR head", () => {
  test("unionOfChangedPaths combines and deduplicates changed paths from multiple PRs in a merge train", () => {
    const pr1Paths = ["content/ch1/Proof.lean", "lakefile.toml"];
    const pr2Paths = ["ns/context.jsonld", "content/ch1/Proof.lean"];
    const pr3Paths = ["docs/guide.md"];

    const union = unionOfChangedPaths([pr1Paths, pr2Paths, pr3Paths]);
    expect(union).toEqual([
      "content/ch1/Proof.lean",
      "docs/guide.md",
      "lakefile.toml",
      "ns/context.jsonld",
    ]);
  });

  test("single PR head triggers only gates for its own changed paths", () => {
    const prLeanOnly = ["content/ch1/Proof.lean"];
    const prKgOnly = ["ns/context.jsonld"];

    const leanGates = compileGatesForPrHead(prLeanOnly).map((g) => g.id);
    expect(leanGates).toContain("G5");
    expect(leanGates).not.toContain("G7");

    const kgGates = compileGatesForPrHead(prKgOnly).map((g) => g.id);
    expect(kgGates).toContain("G7");
    expect(kgGates).not.toContain("G5");
  });

  test("merge train result triggers the union of gates across all train members", () => {
    const pr1 = ["content/ch1/Proof.lean"];
    const pr2 = ["input/fsh/patient.fsh"];
    const pr3 = ["schemas/node.jsonld"];

    const trainGates = compileGatesForMergeTrain([pr1, pr2, pr3]).map((g) => g.id);
    expect(trainGates).toContain("G5"); // from PR 1
    expect(trainGates).toContain("G6"); // from PR 2
    expect(trainGates).toContain("A2"); // from PR 2 (advisory)
    expect(trainGates).toContain("G7"); // from PR 3
  });

  test("evaluateCompileGatesForMergeTrain evaluates all gates on the combined train result", async () => {
    const pr1 = ["content/ch1/Proof.lean"];
    const pr2 = ["input/fsh/patient.fsh"];

    const res = await evaluateCompileGatesForMergeTrain([pr1, pr2], {
      lean: {
        fileContents: { "content/ch1/Proof.lean": "theorem ok : True := trivial" },
        lakeBuildRunner: () => ({ ok: true, output: "ok" }),
      },
      fhir: {
        sushiRunner: () => ({ errors: 0, warnings: 0, output: "clean" }),
        igAstExtractor: () => ({ ok: true }),
      },
    });

    expect(res.triggeredGates.map((g) => g.id)).toContain("G5");
    expect(res.triggeredGates.map((g) => g.id)).toContain("G6");
    expect(res.overallPassed).toBe(true);
    expect(res.blocked).toBe(false);
  });

  test("merge train is blocked if ANY PR's touched cone in the union fails on the combined result", async () => {
    const pr1 = ["content/ch1/Proof.lean"];
    const pr2 = ["input/fsh/patient.fsh"];

    // PR 1 is clean, but PR 2 has SUSHI errors in the combined tree
    const res = await evaluateCompileGatesForMergeTrain([pr1, pr2], {
      lean: {
        fileContents: { "content/ch1/Proof.lean": "theorem ok : True := trivial" },
        lakeBuildRunner: () => ({ ok: true, output: "ok" }),
      },
      fhir: {
        sushiRunner: () => ({ errors: 1, warnings: 0, output: "SUSHI build error" }),
      },
    });

    expect(res.blocked).toBe(true);
    expect(res.overallPassed).toBe(false);
    const g6Eval = res.evaluations.find((e) => e.gateId === "G6")!;
    expect(g6Eval.status).toBe("fail");
    expect(g6Eval.blocked).toBe(true);
  });
});
