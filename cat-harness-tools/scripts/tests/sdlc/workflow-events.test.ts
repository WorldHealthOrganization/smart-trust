/**
 * Which workflows are OWED for an event — and the three states that must not
 * collapse into two.
 *
 * @module scripts/tests/workflow-events
 *
 * Bean `9x9r`. The property under test is not "it parses YAML". It is that
 * **`required`, `conditional` and `not-declared` stay three answers**, because
 * the defect being fixed is exactly a collapse: `check-head-has-run` folded
 * every workflow and every event into one boolean (`runs.length > 0`) and so
 * reported a ✓ on a head whose gates had not run.
 *
 * Every tree here is SYNTHETIC. A prior session's tests in this directory
 * walked the real corpus five times and pushed a sibling past its 5s timeout;
 * and a test reading `.github/workflows/` would pass or fail on whichever
 * workflows happen to exist today, which tests the repository rather than the
 * code. One test does read the real tree, and it asserts only a property that
 * must hold for ANY tree — see its own comment.
 *
 * The tests here that read the aggregate repository's own root
 * (`.github/workflows/`) live in
 * `test/workflow-events-workflows.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such root to read.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GITHUB_WORKFLOW_DIR, scanTriggers, triggerFor } from "../../../src/core/workflow-events.js";
import {
  blockedRequiredAdvice,
  coverageFor,
  executed,
  missingRequiredAdvice,
  type RunRow,
} from "../../check-head-has-run.js";

/** A throwaway repo root carrying exactly the workflow files named. */
function treeWith(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "wf-events-"));
  mkdirSync(join(root, GITHUB_WORKFLOW_DIR), { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(root, GITHUB_WORKFLOW_DIR, name), body);
  }
  return root;
}

const run = (name: string, event: string, conclusion: string | null = "success"): RunRow => ({
  name,
  event,
  status: "completed",
  conclusion,
  html_url: "https://example.invalid/run",
});

describe("triggerFor — the three states", () => {
  test("an unfiltered event is REQUIRED", () => {
    const t = triggerFor("w.yml", "name: Gates\non:\n  pull_request:\n", "pull_request");
    expect(t.requirement).toBe("required");
    expect(t.name).toBe("Gates");
    expect(t.filters).toEqual([]);
  });

  test("a path-filtered event is CONDITIONAL, and says which filter made it so", () => {
    const t = triggerFor("w.yml", "name: Drift\non:\n  pull_request:\n    paths: ['src/**']\n", "pull_request");
    expect(t.requirement).toBe("conditional");
    expect(t.filters).toEqual(["paths"]);
  });

  test("CONDITIONAL is not a synonym for `paths` — every narrowing key counts", () => {
    const t = triggerFor(
      "w.yml",
      "name: Stage\non:\n  pull_request:\n    types: [opened]\n    paths: ['docs/**']\n    branches: [main]\n",
      "pull_request",
    );
    expect(t.requirement).toBe("conditional");
    expect(t.filters).toEqual(["branches", "paths", "types"]);
  });

  test("a `types:` list that keeps every default PR type is no narrowing: still REQUIRED (bean dft1)", () => {
    const t = triggerFor(
      "w.yml",
      "name: Gates\non:\n  pull_request:\n    types: [opened, synchronize, reopened, ready_for_review]\n",
      "pull_request",
    );
    expect(t.requirement).toBe("required");
    expect(t.filters).toEqual([]);
    const closed = triggerFor(
      "w.yml",
      "name: Gates\non:\n  pull_request:\n    types: [opened, synchronize, reopened, closed]\n",
      "pull_request",
    );
    expect(closed.requirement).toBe("required");
  });

  test("a `types:` list missing a default PR type still narrows: CONDITIONAL", () => {
    const t = triggerFor("w.yml", "name: Ready\non:\n  pull_request:\n    types: [opened, ready_for_review]\n", "pull_request");
    expect(t.requirement).toBe("conditional");
    expect(t.filters).toEqual(["types"]);
  });

  test("the default-types rule does not hide another filter beside it", () => {
    const t = triggerFor(
      "w.yml",
      "name: Stage\non:\n  pull_request:\n    types: [opened, synchronize, reopened]\n    paths: ['docs/**']\n",
      "pull_request",
    );
    expect(t.requirement).toBe("conditional");
    expect(t.filters).toEqual(["paths"]);
  });

  test("an event the workflow does not declare is NOT-DECLARED, not a missing required", () => {
    const t = triggerFor("w.yml", "name: Nightly\non:\n  schedule:\n    - cron: '0 0 * * *'\n", "pull_request");
    expect(t.requirement).toBe("not-declared");
  });

  test("the list and scalar forms of `on:` carry no filters, so they are REQUIRED", () => {
    expect(triggerFor("a.yml", "name: A\non: [pull_request, push]\n", "pull_request").requirement).toBe("required");
    expect(triggerFor("b.yml", "name: B\non: pull_request\n", "pull_request").requirement).toBe("required");
  });

  test("a workflow with no `name:` falls back to its path, as GitHub does", () => {
    // Matching runs by name is the whole mechanism, so the fallback has to be
    // the same string the API would report. A blank name is not a valid key.
    expect(triggerFor(".github/workflows/x.yml", "on:\n  pull_request:\n", "pull_request").name).toBe(
      ".github/workflows/x.yml",
    );
  });

  test("a YAML 1.1 parser's `on: -> true` key would not blind the scan", () => {
    // `yaml` keeps `on` as a string (1.2 core schema); `Bun.YAML`/PyYAML do
    // not. Reading zero events because of a parser choice would render every
    // workflow `not-declared` — a silent all-clear, which is the one outcome
    // this module must never produce by accident.
    const t = triggerFor("w.yml", "name: Gates\ntrue:\n  pull_request:\n", "pull_request");
    expect(t.requirement).toBe("required");
  });
});

describe("scanTriggers", () => {
  test("drops not-declared, keeps required and conditional apart", () => {
    const root = treeWith({
      "gates.yml": "name: Gates\non:\n  pull_request:\n",
      "drift.yml": "name: Drift\non:\n  pull_request:\n    paths: ['a/**']\n",
      "nightly.yml": "name: Nightly\non:\n  schedule:\n    - cron: '0 0 * * *'\n",
    });
    const scan = scanTriggers(root, "pull_request");
    expect(scan.unreadable).toEqual([]);
    expect(scan.triggers.map((t) => [t.name, t.requirement])).toEqual([
      ["Drift", "conditional"],
      ["Gates", "required"],
    ]);
  });

  test("an absent workflow directory is UNREADABLE, never an empty required set", () => {
    // The falsifier for the whole module. An empty `required` list is
    // vacuously satisfied, so "could not look" must not reach the caller
    // wearing the same shape as "nothing was owed".
    const scan = scanTriggers(join(tmpdir(), "definitely-not-a-repo-9x9r"), "pull_request");
    expect(scan.triggers).toEqual([]);
    expect(scan.unreadable).toHaveLength(1);
  });

  test("one unparseable file does not discard the others, and is reported", () => {
    const root = treeWith({
      "gates.yml": "name: Gates\non:\n  pull_request:\n",
      "broken.yml": "name: [unclosed\n  on: : :\n",
    });
    const scan = scanTriggers(root, "pull_request");
    expect(scan.triggers.map((t) => t.name)).toEqual(["Gates"]);
    expect(scan.unreadable.map((u) => u.file)).toEqual([join(GITHUB_WORKFLOW_DIR, "broken.yml")]);
  });
});

describe("coverageFor — the bug this bean is about", () => {
  const scan = () =>
    scanTriggers(
      treeWith({
        "gates.yml": "name: Gates\non:\n  pull_request:\n",
        "drift.yml": "name: Drift\non:\n  pull_request:\n    paths: ['a/**']\n  push:\n",
      }),
      "pull_request",
    );

  test("a PUSH run of a workflow is not its PULL_REQUEST run", () => {
    // 9x9r in one assertion. The old check saw one run and said ✓; here the
    // same input leaves the required workflow unsatisfied.
    const cov = coverageFor([run("Drift", "push")], scan(), "pull_request");
    expect(cov.required).toEqual([
      { name: "Gates", file: join(GITHUB_WORKFLOW_DIR, "gates.yml"), ran: false, state: "absent" },
    ]);
    expect(cov.conditional[0]?.ran).toBe(false);
  });

  test("a DISPATCH run of the required workflow does not satisfy it either", () => {
    // Measured live on PR #1222's head `28f929a`, 2026-09-24: its only run was
    // `Code-quality gates` via `workflow_dispatch`, and the old check printed
    // ✓. A dispatch resolves `refs/heads/<branch>`, not the merge ref, so it
    // is a signal about a different tree (beans `yv4z`, `sddf`).
    const cov = coverageFor([run("Gates", "workflow_dispatch")], scan(), "pull_request");
    expect(cov.required[0]?.ran).toBe(false);
  });

  test("the matching run satisfies it", () => {
    const cov = coverageFor([run("Gates", "pull_request")], scan(), "pull_request");
    expect(cov.required[0]?.ran).toBe(true);
  });

  test("a run of an unrelated workflow satisfies nothing", () => {
    const cov = coverageFor([run("Something Else", "pull_request")], scan(), "pull_request");
    expect(cov.required.every((w) => w.ran)).toBe(false);
  });

  test("unreadable files are carried through to the caller, not swallowed", () => {
    const cov = coverageFor([], scanTriggers(join(tmpdir(), "nope-9x9r"), "pull_request"), "pull_request");
    expect(cov.unreadable).toHaveLength(1);
  });

  // ---- bean `1acg`: a run that was created and never EXECUTED -------------

  test("an action_required run of the right workflow and event does NOT satisfy it", () => {
    // The defect in one assertion. Measured live on #1819's head
    // `9c3d0efad8f`, 2026-10-03: three `pull_request` runs, all
    // `action_required`, and the old check printed
    // `✓ all 1 workflow(s) owed for pull_request ran` with exit 0.
    const cov = coverageFor([run("Gates", "pull_request", "action_required")], scan(), "pull_request");
    expect(cov.required[0]?.ran).toBe(false);
  });

  test("it is `blocked`, NOT `absent` — the two need opposite advice", () => {
    // Collapsing them would print `3pqn`'s "their absence is unexplained" and
    // "dispatching is safe HERE" over a head whose absence IS explained.
    const cov = coverageFor([run("Gates", "pull_request", "action_required")], scan(), "pull_request");
    expect(cov.required[0]?.state).toBe("blocked");
  });

  test("no run at all stays `absent`, so the blocked state did not swallow it", () => {
    const cov = coverageFor([], scan(), "pull_request");
    expect(cov.required[0]?.state).toBe("absent");
  });

  test("startup_failure is the same class — a run whose jobs never started", () => {
    const cov = coverageFor([run("Gates", "pull_request", "startup_failure")], scan(), "pull_request");
    expect(cov.required[0]?.state).toBe("blocked");
  });

  test("a FAILED run executed: it is a verdict about the tree, not a missing gate", () => {
    // The distinction from `check-verdict`'s FAILED set, which groups
    // `action_required` WITH failure because neither is a pass. Here the
    // question is prior — did the gate run — and a failure did.
    const cov = coverageFor([run("Gates", "pull_request", "failure")], scan(), "pull_request");
    expect(cov.required[0]?.state).toBe("ran");
  });

  test("an in-flight run (null conclusion) is not treated as unexecuted", () => {
    const cov = coverageFor([run("Gates", "pull_request", null)], scan(), "pull_request");
    expect(cov.required[0]?.state).toBe("ran");
  });

  test("one EXECUTED run settles it even beside a blocked sibling", () => {
    // A re-run that escaped the approval gate is a gate that fired; the
    // superseded `action_required` row says nothing further. Bean `0qjq`
    // measured `rerun_workflow_run` escaping it.
    const cov = coverageFor(
      [run("Gates", "pull_request", "action_required"), run("Gates", "pull_request", "success")],
      scan(),
      "pull_request",
    );
    expect(cov.required[0]?.state).toBe("ran");
  });

  test("a blocked DISPATCH run does not rescue the pull_request requirement", () => {
    // Both halves of the real #1819 shape at once: the owed event never
    // executed, and the only other run is a different event.
    const cov = coverageFor(
      [run("Gates", "pull_request", "action_required"), run("Gates", "workflow_dispatch", "success")],
      scan(),
      "pull_request",
    );
    expect(cov.required[0]?.state).toBe("blocked");
  });

  test("a conditional workflow also reports blocked rather than silently not-run", () => {
    const cov = coverageFor([run("Drift", "pull_request", "action_required")], scan(), "pull_request");
    expect(cov.conditional[0]?.state).toBe("blocked");
    expect(cov.conditional[0]?.ran).toBe(false);
  });
});

describe("executed — the predicate the two sweeps share", () => {
  test("action_required and startup_failure did not execute", () => {
    expect(executed(run("w", "pull_request", "action_required"))).toBe(false);
    expect(executed(run("w", "pull_request", "startup_failure"))).toBe(false);
  });

  test("success, failure, cancelled and a null conclusion all did", () => {
    // `cancelled` ran and was stopped; that is a concurrency fact, and
    // `check-verdict` already treats it as undetermined rather than as a
    // gate that never fired. This predicate must not second-guess it.
    for (const c of ["success", "failure", "cancelled", "stale", "timed_out", null]) {
      expect(executed(run("w", "pull_request", c))).toBe(true);
    }
  });
});

describe("blockedRequiredAdvice", () => {
  test("it names the bot-actor cause rather than calling the absence unexplained", () => {
    const s = blockedRequiredAdvice(["Code-quality gates"]);
    expect(s).toContain("github-actions[bot]");
    expect(s).toContain("NOT a fork");
    expect(s).not.toContain("unexplained");
  });

  test("it does NOT tell the operator to dispatch — that is what masked this", () => {
    const s = blockedRequiredAdvice(["Code-quality gates"]);
    expect(s).toContain("Do NOT read a `workflow_dispatch` green");
    expect(s).not.toContain("Dispatching against this ref is safe");
  });

  test("it names the one change that fixes the class, and whose it is", () => {
    const s = blockedRequiredAdvice(["Code-quality gates"]);
    expect(s).toContain("#1829");
    // The credential was renamed (bean `8mlt`, folio-assistant#2532): the
    // harness App first, the named secret as the fallback, and never the old name.
    expect(s).toContain("INSTALL THE HARNESS");
    expect(s).toContain("PUSH_BRANCH_TRIGGERING_CI");
    expect(s).not.toContain("MERGE_MAIN_TOKEN");
    expect(s).toContain("owner's to make");
  });

  test("it says the run existed, which is the half the `no run` wording loses", () => {
    const s = blockedRequiredAdvice(["Gates", "Other"]);
    expect(s).toContain("Gates, Other");
    expect(s).toContain("NONE of them executed");
  });
});

describe("missingRequiredAdvice", () => {
  test("on a conflicted PR it says merge the base in, and NEVER dispatch", () => {
    // The `sddf` regression guard: this is the branch whose old advice was
    // actively harmful, and it exists as a pure function so a test can reach it.
    const s = missingRequiredAdvice(["Gates"], "conflicted");
    expect(s).toContain("MERGE THE BASE BRANCH IN");
    expect(s).toContain("Do NOT dispatch");
  });

  test("on a mergeable PR dispatching is offered, because the refs agree", () => {
    expect(missingRequiredAdvice(["Gates"], "mergeable")).toContain("safe HERE");
  });

  test("on an unknown merge state it refuses to recommend a dispatch", () => {
    const s = missingRequiredAdvice(["Gates"], "unknown");
    expect(s).toContain("by hand");
    expect(s).not.toContain("safe HERE");
  });

  test("it names the workflows, so the reader need not go looking", () => {
    expect(missingRequiredAdvice(["Gates", "Other"], "mergeable")).toContain("Gates, Other");
  });
});
