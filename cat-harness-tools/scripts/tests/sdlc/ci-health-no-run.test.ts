/**
 * WHY a workflow produced no run has to be COMPUTED, and the benign classes
 * have to stay benign.
 *
 * The report carried "(dispatch-only, or vendored for a folio)" over a count of
 * 31 — a cause asserted rather than measured. These pin the four answers, and
 * three of them are regressions against drafts of this classifier rather than
 * hypotheticals.
 *
 * Imported from `src/workflow/workflow-triggers.ts` rather than from the
 * script: an earlier draft exported them from `check-ci-health.ts` and this
 * file ran the whole CI-health report — a hundred GitHub runs — on import.
 *
 * @module scripts/tests/ci-health-no-run
 */
import { describe, expect, test } from "bun:test";

import { triggersOf, unrestrictedTriggers, whyNoRun } from "../../../src/workflow/workflow-triggers.ts";

const wf = (on: string) => `name: X\n\non:\n${on}\njobs:\n  a:\n    runs-on: ubuntu-latest\n`;

describe("whyNoRun", () => {
  test("no automatic trigger is `dispatch-only` — no run is the design", () => {
    expect(whyNoRun(wf("  workflow_dispatch:\n"))).toBe("dispatch-only");
    expect(whyNoRun(wf("  workflow_dispatch:\n  workflow_call:\n"))).toBe("dispatch-only");
  });

  test("an unrestricted automatic trigger with no run is `auto-triggered`", () => {
    expect(whyNoRun(wf("  push:\n    branches: [main]\n  workflow_dispatch:\n"))).toBe(
      "auto-triggered",
    );
  });

  /* THE CLASS THAT NEARLY SHIPPED WRONG. The first draft asked "can this fire
   * at all", by testing whether any `paths:` pattern named something present,
   * and promoted `atomic-mass-gen-check.yml` to the DEFECT class because one of
   * its four patterns is its own workflow file. The question is whether no-run
   * is EXPLAINED, not whether the workflow is capable of firing. */
  test("every automatic trigger `paths:`-restricted is `path-filtered`, not a defect", () => {
    const text = wf(
      "  pull_request:\n    paths:\n      - 'content/qou/x.json'\n      - '.github/workflows/w.yml'\n" +
        "  push:\n    paths:\n      - 'content/qou/x.json'\n      - '.github/workflows/w.yml'\n" +
        "  workflow_dispatch:\n",
    );
    expect(whyNoRun(text)).toBe("path-filtered");
  });

  test("one restricted and one unrestricted trigger is still a defect", () => {
    expect(whyNoRun(wf("  pull_request:\n    paths:\n      - 'a/b'\n  push:\n    branches: [main]\n"))).toBe(
      "auto-triggered",
    );
  });

  /* `paths-ignore` SUBTRACTS FROM EVERYTHING. Reading it as a restriction
   * would explain away a silence that nothing explains. */
  test("`paths-ignore` does not explain a silence", () => {
    expect(whyNoRun(wf("  push:\n    paths-ignore:\n      - 'docs/**'\n"))).toBe("auto-triggered");
  });

  test("the inline forms parse", () => {
    expect(triggersOf("on: push\njobs:\n")).toEqual(["push"]);
    expect(triggersOf("on: [push, pull_request]\njobs:\n")).toEqual(["push", "pull_request"]);
    expect(whyNoRun("on: [workflow_dispatch]\njobs:\n")).toBe("dispatch-only");
  });

  /* NEVER FOLDED INTO THE BENIGN TWO. A file with no readable `on:` is the
   * third state this module applies everywhere. */
  test("no readable `on:` is `undetermined`, and so is an unreadable file", () => {
    expect(whyNoRun("name: X\njobs:\n  a:\n")).toBe("undetermined");
    expect(whyNoRun(undefined)).toBe("undetermined");
  });

  test("unrestrictedTriggers names which trigger is unexplained", () => {
    expect(
      unrestrictedTriggers(wf("  pull_request:\n    paths:\n      - 'a/b'\n  push:\n    branches: [main]\n")),
    ).toEqual(["push"]);
  });
});
