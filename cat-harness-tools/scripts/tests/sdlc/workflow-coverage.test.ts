/**
 * A mention is not coverage, and an unreadable workflow is not an uncovered one.
 *
 * @module scripts/tests/workflow-coverage
 *
 * Bean `7yvd`. The two distinctions this check exists to make are the two a
 * simpler implementation gets wrong:
 *
 *   1. Five diagrams here MENTION a `.github/workflows/*.yml` while
 *      documenting an agent process that merely touches one —
 *      `upstream-pin-watch.bpmn` names `ci-health.yml` and documents neither.
 *      Matching on filename, or on any occurrence, would count all five as
 *      coverage and report a documented repository that is not.
 *   2. A workflow whose YAML will not parse has UNKNOWN triggers. Reporting
 *      that as "dispatch-only, uncovered" shrinks the gate in silence — the
 *      `plj1` shape, a check reporting clean over what it could not see.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  autoTriggered,
  compareJobs,
  surveyWorkflows,
  workflowJobs,
} from "../../check-workflow-coverage.js";
import { bpmnIds, workflowBpmn } from "../../workflow-bpmn.js";

describe("a workflow DECLARES its diagram (bean 61ca)", () => {
  test("the `# bpmn:` header is read", () => {
    expect(workflowBpmn("# bpmn: cat-harness/processes/x.bpmn\non:\n  push:\njobs: {}\n").diagrams)
      .toEqual(["cat-harness/processes/x.bpmn"]);
  });

  test("a MENTION in a comment is not a declaration", () => {
    const yaml = "# Runs after cat-harness/processes/x.bpmn is drawn — see bpmn.io\n#   bpmn: indented, so prose\njobs: {}\n";
    expect(workflowBpmn(yaml).diagrams).toEqual([]);
  });

  test("several headers are all read", () => {
    expect(workflowBpmn("# bpmn: a.bpmn\n# bpmn: b.bpmn\njobs: {}\n").diagrams).toEqual(["a.bpmn", "b.bpmn"]);
  });
});

describe("a job DECLARES its node", () => {
  const yaml =
    "on:\n  push:\n" +
    "jobs:\n" +
    "  # bpmn-node: Above_Is_Prose\n" +
    "  stage:\n    # bpmn-node: Start_PR\n    runs-on: x\n" +
    "  cleanup:\n    runs-on: x\n    steps:\n      # bpmn-node: Start_Closed\n";

  test("a node is attributed to the job that CONTAINS it, at any depth inside it", () => {
    expect(workflowBpmn(yaml).nodes).toEqual([
      { job: "stage", node: "Start_PR" },
      { job: "cleanup", node: "Start_Closed" },
    ]);
  });

  test("a comment ABOVE a job key belongs to no job — proximity is not containment", () => {
    expect(workflowBpmn(yaml).nodes.map((n) => n.node)).not.toContain("Above_Is_Prose");
  });

  test("a `# bpmn-node:` outside `jobs:` is not read", () => {
    expect(workflowBpmn("env:\n  X:\n    # bpmn-node: Nope\njobs: {}\n").nodes).toEqual([]);
  });

  test("bpmnIds reads every element id, and nothing that is not one", () => {
    const xml = `<bpmn:process id="P"><bpmn:startEvent id="S" name="id=&quot;x&quot;"/><bpmn:documentation>id="Y"</bpmn:documentation></bpmn:process>`;
    expect([...bpmnIds(xml)].sort()).toEqual(["P", "S"]);
  });
});

describe("autoTriggered — does it fire without somebody asking?", () => {
  test.each([
    ["on:\n  push:\n    branches: [main]\njobs: {}\n", true],
    ["on:\n  schedule:\n    - cron: '0 3 * * *'\njobs: {}\n", true],
    ["on:\n  pull_request_target:\n    types: [closed]\njobs: {}\n", true],
    ["on:\n  workflow_dispatch:\njobs: {}\n", false],
    ["on:\n  workflow_call:\njobs: {}\n", false],
    ["on:\n  workflow_dispatch:\n  workflow_call:\njobs: {}\n", false],
  ])("case %#", (yaml, expected) => {
    expect(autoTriggered(yaml as string)).toBe(expected as boolean);
  });

  test("a mixed workflow is AUTO — one automatic trigger is enough", () => {
    expect(autoTriggered("on:\n  workflow_dispatch:\n  push:\njobs: {}\n")).toBe(true);
  });

  test("unparseable YAML gives a REASON, never `false`", () => {
    // `false` would read as "dispatch-only", which is a claim about a file
    // nobody could parse.
    const r = autoTriggered("on:\n  push:\n   bad\n    indent: [\njobs:\n");
    expect(typeof r).toBe("object");
  });

  test("a workflow with no `on:` is a reason, not a quiet false", () => {
    const r = autoTriggered("jobs:\n  a:\n    runs-on: x\n");
    if (typeof r === "boolean") throw new Error("expected a reason");
    expect(r.reason).toContain("no `on:`");
  });
});

describe("the survey's three states", () => {
  /**
   * A scratch repo with a workflows directory and a `processes/` graph.
   *
   * Every call below passes the root TWICE — as the repository root and as the
   * layer root — because in this checkout they differ: `.github/workflows/`
   * is at the repository root and the diagrams are under `cat-harness/`. A
   * first version of both the tool and these tests conflated them, and the
   * tests could not catch it, because a scratch repo puts both at one path.
   * Passing both explicitly is what makes the distinction visible here.
   */
  function repoWith(workflows: Record<string, string>, diagrams: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "wfcov-"));
    mkdirSync(join(root, ".github", "workflows"), { recursive: true });
    for (const [n, b] of Object.entries(workflows)) writeFileSync(join(root, ".github/workflows", n), b);
    mkdirSync(join(root, "processes"), { recursive: true });
    for (const [n, b] of Object.entries(diagrams)) writeFileSync(join(root, "processes", n), b);
    return root;
  }
  const names = (d: string, body: string): string => `# bpmn: ${d}\n${body}`;
  const diagram = `<?xml version="1.0"?><bpmn:definitions><bpmn:process id="p"/></bpmn:definitions>`;

  test("COVERED — a declaration names it", () => {
    const root = repoWith(
      { "a.yml": names("processes/a.bpmn", "on:\n  push:\njobs: {}\n") },
      { "a.bpmn": diagram },
    );
    const { rows } = surveyWorkflows(root);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.coverage).toBe("covered");
    expect(rows[0]!.auto).toBe(true);
  });

  test("UNCOVERED is a DETERMINED absence — the file read fine, nothing declares it", () => {
    const root = repoWith({ "a.yml": "on:\n  push:\njobs: {}\n" }, { "a.bpmn": diagram });
    const { rows } = surveyWorkflows(root);
    expect(rows[0]!.coverage).toBe("uncovered");
    expect(rows[0]!.reason).toBeUndefined();
  });

  test("UNKNOWN — unreadable is never rendered as covered, even WITH a declaration", () => {
    // The declaration says a diagram exists, not that it still matches a file
    // nobody could parse.
    const root = repoWith(
      { "a.yml": names("processes/a.bpmn", "on:\n  push:\n   bad\n    indent: [\n") },
      { "a.bpmn": diagram },
    );
    const { rows } = surveyWorkflows(root);
    expect(rows[0]!.coverage).toBe("unknown");
    expect(rows[0]!.reason).toBeDefined();
  });

  test("a mention-only diagram leaves the workflow UNCOVERED", () => {
    const root = repoWith(
      { "a.yml": "on:\n  push:\njobs: {}\n" },
      {
        "other.bpmn":
          `<bpmn:definitions><bpmn:process id="p"><bpmn:documentation>` +
          `see .github/workflows/a.yml</bpmn:documentation></bpmn:process></bpmn:definitions>`,
      },
    );
    const { rows } = surveyWorkflows(root);
    expect(rows[0]!.coverage).toBe("uncovered");
  });

  test("DANGLING — a workflow naming a diagram that is not there is reported", () => {
    const root = repoWith({ "a.yml": names("processes/gone.bpmn", "on:\n  push:\njobs: {}\n") }, {});
    const { rows, dangling } = surveyWorkflows(root);
    expect(dangling).toEqual([{ diagram: "processes/gone.bpmn", workflow: ".github/workflows/a.yml" }]);
    // And it does NOT count as coverage.
    expect(rows[0]!.coverage).toBe("uncovered");
  });

  test("no workflows directory is an empty survey, not a crash", () => {
    const root = mkdtempSync(join(tmpdir(), "wfcov-empty-"));
    const { rows, dangling } = surveyWorkflows(root);
    expect(rows).toEqual([]);
    expect(dangling).toEqual([]);
  });
});

describe("this repository, right now", () => {
  test("every workflow is readable — a count over unreadable files is not a count", () => {
    const { rows } = surveyWorkflows();
    expect(rows.filter((r) => r.coverage === "unknown")).toEqual([]);
  });

  test("no declaration dangles", () => {
    expect(surveyWorkflows().dangling).toEqual([]);
  });

  test("the diagrams are FOUND — a workflow's path resolves from the repository root", () => {
    // The regression this guards changed shape with bean 61ca but not
    // substance: `.github/workflows/` is at the repository root and the
    // diagrams are inside `cat-harness/`, so a declaration spelled relative to
    // the wrong root finds nothing and reports a clean-looking 0.
    //
    // Asserting "> 0" rather than a count: a number here would be a claim
    // about how many diagrams somebody has drawn, which changes, and
    // `check:workflow-coverage` is where that number belongs.
    const covered = surveyWorkflows().rows.filter((r) => r.coverage === "covered");
    expect(covered.length).toBeGreaterThan(0);
  });

  test("there are workflows to survey — a green run over zero files is not coverage", () => {
    expect(surveyWorkflows().rows.length).toBeGreaterThan(0);
  });
});

describe("drift — the diagram still matches the workflow it documents", () => {
  /**
   * The half the bean cared about most. `feature-staging.bpmn` had three
   * start events for the workflow's three jobs and NOTHING saying which node
   * was which, so adding a fourth job left every check green — and the bean's
   * own words are that a diagram which drifts is worse than none, because it
   * is consulted.
   */
  describe("reading the workflow's real jobs", () => {
    test("the job names come back in order", () => {
      expect(workflowJobs("on:\n  push:\njobs:\n  stage:\n    runs-on: x\n  cleanup:\n    runs-on: x\n"))
        .toEqual(["stage", "cleanup"]);
    });

    test("UNPARSEABLE yaml is a REASON, not an empty list", () => {
      // An empty list would make every declared job look like an `extra`,
      // turning a parse failure into a wall of false findings pointing at a
      // diagram that is fine.
      const r = workflowJobs("jobs:\n  - [unbalanced\n");
      expect(typeof r === "object" && "reason" in r).toBe(true);
    });

    test("no `jobs:` key at all is a reason too", () => {
      const r = workflowJobs("on:\n  push:\n");
      expect(r).toEqual({ reason: "declares no `jobs:`" });
    });

    test("`jobs:` that is a LIST is a reason — it is not a mapping of names", () => {
      const r = workflowJobs("jobs:\n  - a\n  - b\n");
      expect(r).toEqual({ reason: "`jobs:` is not a mapping" });
    });
  });

  describe("comparing them, in BOTH directions", () => {
    const ids = new Set(["S1", "S2"]);
    const c = (job: string, node: string) => ({ job, node });

    test("matching sets drift in neither direction", () => {
      expect(compareJobs(["a", "b"], [c("b", "S2"), c("a", "S1")], ids)).toEqual({
        declared: true, missing: [], extra: [], duplicated: [],
      });
    });

    test("a job with NO node is missing — the workflow gained one", () => {
      expect(compareJobs(["a", "b"], [c("a", "S1")], ids).missing).toEqual(["b"]);
    });

    test("a node the diagram does NOT have is extra — the diagram lost one", () => {
      expect(compareJobs(["a"], [c("a", "Gone")], ids).extra).toEqual(["Gone"]);
    });

    test("one job naming TWO nodes is reported rather than silently deduped", () => {
      expect(compareJobs(["a", "b"], [c("a", "S1"), c("a", "S2"), c("b", "S1")], ids).duplicated).toEqual(["a"]);
    });

    test("NOTHING declared is `declared: false`, not fully drifted", () => {
      // "Nobody has said yet" and "said, and wrong" are different answers,
      // and only the second is a finding.
      const d = compareJobs(["a", "b"], [], ids);
      expect([d.declared, d.missing]).toEqual([false, ["a", "b"]]);
    });
  });

  describe("over the whole survey", () => {
    function repo(workflow: string, diagram: string): string {
      const root = mkdtempSync(join(tmpdir(), "wfdrift-"));
      mkdirSync(join(root, ".github", "workflows"), { recursive: true });
      writeFileSync(join(root, ".github/workflows/a.yml"), workflow);
      mkdirSync(join(root, "processes"), { recursive: true });
      writeFileSync(join(root, "processes/a.bpmn"), diagram);
      return root;
    }
    const diagram =
      `<?xml version="1.0"?><bpmn:definitions><bpmn:process id="p">` +
      `<bpmn:startEvent id="S1"/><bpmn:startEvent id="S2"/></bpmn:process></bpmn:definitions>`;
    const twoJobs = (stage?: string, cleanup?: string): string =>
      "# bpmn: processes/a.bpmn\non:\n  push:\njobs:\n" +
      `  stage:\n${stage ? `    # bpmn-node: ${stage}\n` : ""}    runs-on: x\n` +
      `  cleanup:\n${cleanup ? `    # bpmn-node: ${cleanup}\n` : ""}    runs-on: x\n`;

    test("a covered workflow whose jobs all name a node reports no drift", () => {
      const j = surveyWorkflows(repo(twoJobs("S1", "S2"), diagram)).rows[0]!.jobs!;
      expect([j.declared, j.missing, j.extra]).toEqual([true, [], []]);
    });

    test("a job added to the workflow shows up as missing", () => {
      expect(surveyWorkflows(repo(twoJobs("S1"), diagram)).rows[0]!.jobs!.missing).toEqual(["cleanup"]);
    });

    test("a node removed from the diagram shows up as extra", () => {
      expect(surveyWorkflows(repo(twoJobs("S1", "S9"), diagram)).rows[0]!.jobs!.extra).toEqual(["S9"]);
    });

    test("an UNCOVERED workflow has no drift result — there is nothing to compare", () => {
      const root = repo(twoJobs("S1", "S2").replace("# bpmn: processes/a.bpmn\n", ""), diagram);
      expect(surveyWorkflows(root).rows[0]!.jobs).toBeUndefined();
    });

    test("a covered workflow whose `jobs:` cannot be read goes UNKNOWN, not drift-free", () => {
      // The pass-shaped blindness this whole file is against: reporting a
      // covered workflow as having nothing to say about its jobs.
      const row = surveyWorkflows(repo("# bpmn: processes/a.bpmn\non:\n  push:\njobs:\n  - a\n", diagram)).rows[0]!;
      expect(row.coverage).toBe("unknown");
      expect(row.jobs).toBeUndefined();
    });
  });

  describe("this repository, right now", () => {
    test("no documented workflow has drifted", () => {
      const drifted = surveyWorkflows().rows.filter(
        (r) => r.jobs?.declared && r.jobs.missing.length + r.jobs.extra.length + r.jobs.duplicated.length > 0,
      );
      expect(drifted.map((r) => r.path)).toEqual([]);
    });

    test("every documented workflow DECLARES its jobs — coverage without it is unchecked", () => {
      // A workflow whose jobs name no node is one the drift check cannot see. That
      // is honest in the report, but it must not become the norm: a covered
      // workflow with no declaration is coverage nobody is verifying.
      const undeclared = surveyWorkflows().rows.filter((r) => r.jobs && !r.jobs.declared);
      expect(undeclared.map((r) => r.path)).toEqual([]);
    });
  });
});
