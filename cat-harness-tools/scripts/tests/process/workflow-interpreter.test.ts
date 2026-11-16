import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, relative, resolve } from "path";
import { isGlobalTasksFile, loadGlobalTasks, loadProcessModel, UnsupportedBpmn, processDiagrams } from "../../../src/workflow/process-model";
import { loadInstance, saveInstance } from "../../../src/workflow/store";
import { workflowFiles } from "../../known-skills.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";

/** The harness root; diagrams are found by NAME through its declared `processes` graphs (bean `63wl`). */
const HARNESS = resolve(HARNESS_ROOT);

/**
 * The workflow diagrams are the normative picture of how a change reaches the
 * corpus. These tests are about the claim that reading them at runtime buys
 * something an agent's good intentions do not: that `Commit into the corpus`
 * *cannot* be reported done before the editor has seen the validation findings,
 * because there is no token on it until then.
 *
 * They run against the real `.bpmn` files, not fixtures. A test that passes on
 * a synthetic process while the shipped one has drifted is the failure this
 * repo keeps finding.
 *
 * The tests that walk folio-assistant-core's OWN diagrams — the HCI validation
 * gate, its decisions, its store round-trip — live beside those diagrams, in
 * `folio-assistant-core/scripts/tests/workflow-interpreter.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such diagram to walk.
 */

describe("every shipped diagram is interpretable", () => {
  const files = processDiagrams(workflowFiles(HARNESS)).map((p) => relative(HARNESS, p));

  test("there are diagrams to interpret", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test.each(files)("%s parses, and every flow connects two known nodes", async (f) => {
    const model = await loadProcessModel(join(HARNESS, f));
    expect(model.id).toMatch(/^Process_/);
    expect(model.startNodes.length).toBeGreaterThan(0);
    for (const flow of model.flows.values()) {
      expect(model.nodes.has(flow.from)).toBe(true);
      expect(model.nodes.has(flow.to)).toBe(true);
    }
    // Every activity sits in a lane, i.e. some role owns it. An activity in
    // no lane is a step nobody is accountable for.
    for (const n of model.nodes.values()) {
      if (n.kind === "activity") expect(n.lane).toBeDefined();
    }
  });
});

describe("a layer's shared global-tasks file is read, not interpreted", () => {
  // It holds no process, so the loop above leaves it out; it is still read
  // here, so a broken one is not silently skipped (owner, 2026-10-20, "a1").
  const shared = workflowFiles(HARNESS)
    .filter((f) => f.endsWith(".bpmn") && isGlobalTasksFile(readFileSync(f, "utf-8")))
    .map((p) => relative(HARNESS, p));

  test.each(shared)("%s defines global tasks, each naming a skill", async (f) => {
    const defs = await loadGlobalTasks(join(HARNESS, f));
    expect(defs.length).toBeGreaterThan(0);
    for (const d of defs) expect(d.skills.length, d.id).toBeGreaterThan(0);
    await expect(loadProcessModel(join(HARNESS, f))).rejects.toBeInstanceOf(UnsupportedBpmn);
  });
});

describe("unsupported BPMN is refused, not skipped", () => {
  test("an element the interpreter cannot walk throws and names itself", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-unsupported-"));
    const file = join(dir, "has-timer.bpmn");
    await Bun.write(
      file,
      `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D" targetNamespace="t">
  <bpmn:process id="Process_T" name="T" isExecutable="false">
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:intermediateCatchEvent id="Wait">
      <bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing>
      <bpmn:timerEventDefinition id="TD" />
    </bpmn:intermediateCatchEvent>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="Wait" />
    <bpmn:sequenceFlow id="F2" sourceRef="Wait" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>
`,
    );
    await expect(loadProcessModel(file)).rejects.toThrow(UnsupportedBpmn);
    await expect(loadProcessModel(file)).rejects.toThrow(/IntermediateCatchEvent/);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("a committed instance records its diagram REPO-RELATIVELY — bean `chq5`", () => {
  // `beans/workflows/` is committed precisely so a sibling session sees the
  // same position, and `loadProcessModel` keeps whatever path its caller
  // passed. `crdm--issue-607-kg-to-cdn-portal.json` and its two children were
  // found carrying `/home/user/folio-assistant/...`, which resolves on one
  // container and nowhere else — against a sibling instance that recorded the
  // same diagram relatively.

  /** The smallest instance shape `saveInstance` will write. */
  const inst = (source: string, children?: Record<string, unknown>) =>
    ({
      id: "t--subject",
      processId: "Process_T",
      source,
      subject: "subject",
      tokens: [],
      arrivals: {},
      history: [],
      status: "running",
      startedAt: "2026-09-21T00:00:00.000Z",
      updatedAt: "2026-09-21T00:00:00.000Z",
      ...(children ? { children } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

  test("an absolute path inside the repo is written relative", () => {
    const repo = mkdtempSync(join(tmpdir(), "wf-rel-"));
    saveInstance(repo, inst(join(repo, "cat-harness/workflows/x.bpmn")));
    expect(loadInstance(repo, "t--subject")?.source).toBe("cat-harness/workflows/x.bpmn");
    rmSync(repo, { recursive: true, force: true });
  });

  test("CHILDREN are normalised too — the defect was one field deeper", () => {
    // A fix applied only at the top level would have left every child carrying
    // the absolute path, which is where the real corpus had two of its three.
    const repo = mkdtempSync(join(tmpdir(), "wf-rel-"));
    saveInstance(
      repo,
      inst(join(repo, "a/parent.bpmn"), {
        Call_One: inst(join(repo, "a/one.bpmn"), {
          Call_Deep: inst(join(repo, "a/deep.bpmn")),
        }),
      }),
    );
    const back = loadInstance(repo, "t--subject");
    expect(back?.source).toBe("a/parent.bpmn");
    expect(back?.children?.Call_One?.source).toBe("a/one.bpmn");
    expect(back?.children?.Call_One?.children?.Call_Deep?.source).toBe("a/deep.bpmn");
    rmSync(repo, { recursive: true, force: true });
  });

  test("an already-relative path is left exactly as it is", () => {
    const repo = mkdtempSync(join(tmpdir(), "wf-rel-"));
    saveInstance(repo, inst("cat-harness/workflows/x.bpmn"));
    expect(loadInstance(repo, "t--subject")?.source).toBe("cat-harness/workflows/x.bpmn");
    rmSync(repo, { recursive: true, force: true });
  });

  test("a path OUTSIDE the repository is left alone, not turned into ../..", () => {
    // `relative()` would make it a run of `../` — a path that resolves
    // somewhere, differently on every machine, and looks deliberate. An
    // absolute path at least fails honestly and says whose checkout it is.
    const repo = mkdtempSync(join(tmpdir(), "wf-rel-"));
    // input-site: inert #d0b1b04c — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    const outside = resolve("/etc/elsewhere/x.bpmn");
    saveInstance(repo, inst(outside));
    const back = loadInstance(repo, "t--subject");
    expect(back?.source).toBe(outside);
    expect(back?.source).not.toContain("..");
    rmSync(repo, { recursive: true, force: true });
  });

  test("normalising on WRITE repairs a file that was already wrong", () => {
    // The same principle `$schema` follows here: a file from before the rule
    // gains it the next time anything touches it, so no migration is needed.
    const repo = mkdtempSync(join(tmpdir(), "wf-rel-"));
    saveInstance(repo, inst(join(repo, "a/parent.bpmn")));
    const loaded = loadInstance(repo, "t--subject")!;
    // Re-save what came back; it must stay relative and stay stable.
    saveInstance(repo, loaded);
    expect(loadInstance(repo, "t--subject")?.source).toBe("a/parent.bpmn");
    rmSync(repo, { recursive: true, force: true });
  });
});
