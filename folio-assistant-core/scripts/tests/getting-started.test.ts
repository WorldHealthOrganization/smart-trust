/**
 * The onboarding path's two decision tables — moved here from
 * `cat-harness-tools/scripts/tests/getting-started.test.ts` (bean `ho66`).
 * `folio-intent.dmn`, `pages-live-gate.dmn` and the `getting-started.bpmn`
 * they back are this layer's, so standing alone cat-harness has none of
 * them to read; the repo scan and the Pages-address tests stay there.
 *
 * What is worth testing is that the places where a wrong answer would be
 * *confidently* wrong stay honest:
 *
 *   1. `folio-intent.dmn` returns `ask` on both ambiguous filesystem states,
 *      and never invents a branch. An agent cannot route past a question the
 *      table did not ask.
 *   2. `pages-bootstrap` distinguishes a measured 404 from a failed check.
 */

import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { evaluate, loadDecisionTable, possibleOutcomes } from "@litlfred/cat-harness-tools/src/workflow/decision-table.js";
import { loadProcessModel } from "@litlfred/cat-harness-tools/src/workflow/process-model.js";
import { outcomeFor, type PagesOutcome } from "@litlfred/cat-harness-tools/scripts/pages-bootstrap.js";
import { workflowFile } from "@litlfred/cat-harness-tools/scripts/known-skills.ts";

/** This layer's root; its diagrams are found by NAME through its declared `processes` graphs (bean `63wl`). */
const HARNESS = resolve(import.meta.dir, "../..");

describe("folio-intent.dmn — five requests, one sentence", () => {
  const load = () =>
    loadDecisionTable(workflowFile(HARNESS, "folio-intent.dmn"), "Decision_FolioIntent");

  test("bareDirIsNewRepo", async () => {
    const t = await load();
    expect(
      evaluate(t, { statedIntent: "unstated", isFolio: false, repoHasContent: false }).outcome,
    ).toBe("new-repo");
  });

  test("existingFolioAsks", async () => {
    const t = await load();
    expect(
      evaluate(t, { statedIntent: "unstated", isFolio: true, repoHasContent: true }).outcome,
    ).toBe("ask");
  });

  test("contentRepoAsks", async () => {
    const t = await load();
    expect(
      evaluate(t, { statedIntent: "unstated", isFolio: false, repoHasContent: true }).outcome,
    ).toBe("ask");
  });

  test("statedIntentWins", async () => {
    const t = await load();
    // The misspeak case: they are standing in a folio and said they want a
    // document. Scaffolding a second folio here is the bug this table exists
    // to stop, and `isFolio` must not be able to override them.
    expect(
      evaluate(t, { statedIntent: "new-content", isFolio: true, repoHasContent: true }).outcome,
    ).toBe("new-content");
    // And the converse: they asked to overlay a directory that happens to be bare.
    expect(
      evaluate(t, { statedIntent: "overlay", isFolio: false, repoHasContent: false }).outcome,
    ).toBe("overlay");
  });

  test("outcomesAreBranches", async () => {
    const t = await load();
    const model = await loadProcessModel(workflowFile(HARNESS, "getting-started.bpmn"));
    const gateway = model.nodes.get("Gateway_Intent");
    expect(gateway).toBeDefined();
    const branches = gateway!.outgoing.map((f) => model.flows.get(f)!.name);
    for (const o of possibleOutcomes(t)) expect(branches).toContain(o);
    // `ask` in particular: it is an OUTCOME, not an agent's decision to ask.
    expect(possibleOutcomes(t)).toContain("ask");
  });
});

describe("pages-live-gate.dmn — 'could not check' is not 'not yet'", () => {
  const load = () =>
    loadDecisionTable(workflowFile(HARNESS, "pages-live-gate.dmn"), "Decision_PagesLive");

  test("measured404NotYet", async () => {
    const t = await load();
    expect(evaluate(t, { pagesUrlKnown: true, probe: "not-found", ghPagesBranch: "present" }).outcome).toBe("not-yet");
    expect(evaluate(t, { pagesUrlKnown: true, probe: "error", ghPagesBranch: "present" }).outcome).toBe("unknown");
    expect(evaluate(t, { pagesUrlKnown: true, probe: "unchecked", ghPagesBranch: "present" }).outcome).toBe("unknown");
    expect(evaluate(t, { pagesUrlKnown: true, probe: "ok", ghPagesBranch: "present" }).outcome).toBe("live");
  });

  test("noBranchUnprovisioned", async () => {
    const t = await load();
    expect(evaluate(t, { pagesUrlKnown: true, probe: "ok", ghPagesBranch: "absent" }).outcome).toBe("unprovisioned");
    expect(evaluate(t, { pagesUrlKnown: false, probe: "unchecked", ghPagesBranch: "absent" }).outcome).toBe("unprovisioned");
    // A branch ls-remote could not see is not an absent one.
    expect(evaluate(t, { pagesUrlKnown: true, probe: "ok", ghPagesBranch: "unknown" }).outcome).toBe("live");
  });

  test("noUrlUnknown", async () => {
    const t = await load();
    expect(evaluate(t, { pagesUrlKnown: false, probe: "ok", ghPagesBranch: "present" }).outcome).toBe("unknown");
  });

  test("scriptAgreesWithTable", async () => {
    const t = await load();
    for (const pagesUrlKnown of [true, false]) {
      for (const probe of ["ok", "not-found", "error", "unchecked"] as const) {
        for (const ghPagesBranch of ["present", "absent", "unknown", "not-required"] as const) {
          // The table's outcome is typed `unknown` by the evaluator, which knows
          // nothing about this particular table's range. Narrowing it to
          // PagesOutcome is the assertion: if the DMN ever returns a fifth
          // value, this line is where it surfaces.
          expect(outcomeFor({ pagesUrlKnown, probe, ghPagesBranch })).toBe(
            evaluate(t, { pagesUrlKnown, probe, ghPagesBranch }).outcome as PagesOutcome,
          );
        }
      }
    }
  });
});
