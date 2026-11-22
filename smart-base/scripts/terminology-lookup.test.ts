import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { lookupTerminology } from "./terminology-lookup.ts";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");
const DTH_VOCAB = "smart-base/l1-extractions/9789240116191-eng/dth-npc-vocabulary.json";

describe("terminology-lookup (bean folio-assistant-4nfs)", () => {
  test("rung1ResolvesPersonaFromTargetGuide", () => {
    const res = lookupTerminology({
      slot: "persona",
      query: "data-steward",
      vocabularyPath: DTH_VOCAB,
      repoRoot: REPO_ROOT,
    });
    expect(res.selectedRung).toBe("rung-1-target-guide");
    expect(res.bestMatchKind).toBe("exactMatch");
    expect(res.matches[0]?.code).toBe("data-steward");
    expect(res.candidateToMint).toBeUndefined();
  });

  test("rung2FallsBackToGenericPersona", () => {
    const res = lookupTerminology({
      slot: "persona",
      query: "DAK.Persona.DataManager",
      vocabularyPath: DTH_VOCAB,
      repoRoot: REPO_ROOT,
    });
    expect(res.selectedRung).toBe("rung-2-smart-base");
    expect(res.bestMatchKind).toBe("exactMatch");
    expect(res.matches[0]?.code).toBe("DAK.Persona.DataManager");
  });

  test("rung2ResolvesDomainAndGrade", () => {
    const domainRes = lookupTerminology({
      slot: "domain",
      query: "health-system-strengthening",
      repoRoot: REPO_ROOT,
    });
    expect(domainRes.selectedRung).toBe("rung-2-smart-base");
    expect(domainRes.bestMatchKind).toBe("exactMatch");
    expect(domainRes.matches[0]?.scheme).toBe("guideline-domain");

    const gradeRes = lookupTerminology({
      slot: "recommendation-strength",
      query: "conditional",
      repoRoot: REPO_ROOT,
    });
    expect(gradeRes.selectedRung).toBe("rung-2-smart-base");
    expect(gradeRes.bestMatchKind).toBe("exactMatch");
    expect(gradeRes.matches[0]?.code).toBe("conditional");
  });

  test("rung3ResolvesExternalStandardCodes", () => {
    const cdhiRes = lookupTerminology({
      slot: "intervention",
      query: "2.3.1",
      repoRoot: REPO_ROOT,
    });
    expect(cdhiRes.selectedRung).toBe("rung-3-external-standard");
    expect(cdhiRes.bestMatchKind).toBe("exactMatch");
    expect(cdhiRes.matches[0]?.scheme).toBe("CDHIv2");

    const iscoRes = lookupTerminology({
      slot: "persona",
      query: "2221",
      schemeFilter: "ISCO08",
      repoRoot: REPO_ROOT,
    });
    expect(iscoRes.selectedRung).toBe("rung-3-external-standard");
    expect(iscoRes.bestMatchKind).toBe("exactMatch");
    expect(iscoRes.matches[0]?.scheme).toBe("ISCO08");
  });

  test("rung4CandidateOrCouldNotDetermine", () => {
    const personaMiss = lookupTerminology({
      slot: "persona",
      query: "National Regulatory Authority",
      vocabularyPath: DTH_VOCAB,
      repoRoot: REPO_ROOT,
    });
    expect(personaMiss.bestMatchKind).toBe("none");
    expect(personaMiss.selectedRung).toBe("rung-4-local-candidate");
    expect(personaMiss.candidateToMint?.action).toBe("mint-glossary-candidate");
    expect(personaMiss.candidateToMint?.term?.status).toBe("candidate");
    expect(personaMiss.candidateToMint?.warning).toContain("WARNING persona-glossary-candidate");

    const processMiss = lookupTerminology({
      slot: "business-process",
      query: "NPC-R01",
      vocabularyPath: DTH_VOCAB,
      repoRoot: REPO_ROOT,
    });
    expect(processMiss.bestMatchKind).toBe("none");
    expect(processMiss.selectedRung).toBe("rung-4-local-candidate");
    expect(processMiss.candidateToMint?.action).toBe("could-not-determine");
    expect(processMiss.candidateToMint?.status).toBe("could-not-determine");
    expect(processMiss.candidateToMint?.warning).toContain("WARNING process-not-determined");
  });
});
