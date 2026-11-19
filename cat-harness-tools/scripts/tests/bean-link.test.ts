/**
 * The tests of this file that read the whole checkout (reads every diagram the
 * checkout ships, folio-assistant-core's among them) live in
 * `test/bean-link-checkout.test.ts` (bean `7zz1`): standing alone, cat-harness
 * has none of it.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { applyWorkPlanOp, findBean, listBeans, onlyArchiveLeft } from "../../src/workflow/bean-link";
import type { InstanceState } from "../../src/workflow/instance";
import { loadProcessModel, UnsupportedBpmn } from "../../src/workflow/process-model";

/**
 * `beans/` says what is being worked on; a layer says where it got to.
 * Kept apart they diverge. These tests are about the operations that keep them
 * one record — and about the one that deliberately refuses to fire.
 *
 * They write to a temp repo, never the real `beans/`.
 */

let repo: string;

const bean = (id: string, title: string, status: string, body = "Original body.\n"): void => {
  writeFileSync(
    join(repo, "beans", `${id}--${title.toLowerCase().replace(/\W+/g, "-")}.md`),
    `---\n# ${id}\ntitle: ${title}\nstatus: ${status}\ntype: task\n` +
      `created_at: 2026-01-01T00:00:00Z\nupdated_at: 2026-01-01T00:00:00Z\n---\n\n${body}`,
  );
};

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "bean-link-"));
  mkdirSync(join(repo, "beans"), { recursive: true });
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("reading the store", () => {
  test("a bean is found by id, not by a filename prefix that merely starts the same", () => {
    bean("fq0b", "Real bean", "todo");
    bean("fq0bx", "Different bean", "todo");
    expect(findBean(repo, "fq0b")?.title).toBe("Real bean");
    expect(findBean(repo, "fq0bx")?.title).toBe("Different bean");
    expect(listBeans(repo)).toHaveLength(2);
  });

  test("a missing bean is undefined, not an error", () => {
    expect(findBean(repo, "nope")).toBeUndefined();
    expect(listBeans(repo)).toEqual([]);
  });
});

describe("claim", () => {
  test("moves the bean to in-progress and bumps updated_at", () => {
    bean("aaaa", "Some work", "todo");
    const r = applyWorkPlanOp(repo, "aaaa", "claim");
    expect(r.summary).toBe("bean aaaa: todo → in-progress");
    const body = readFileSync(findBean(repo, "aaaa")!.path, "utf8");
    expect(body).toContain("status: in-progress");
    expect(body).not.toContain("updated_at: 2026-01-01T00:00:00Z");
  });

  test("is idempotent — re-entering the step does not churn the file", () => {
    bean("aaaa", "Some work", "in-progress");
    const before = readFileSync(findBean(repo, "aaaa")!.path, "utf8");
    expect(applyWorkPlanOp(repo, "aaaa", "claim").summary).toBe("bean aaaa already in-progress");
    expect(readFileSync(findBean(repo, "aaaa")!.path, "utf8")).toBe(before);
  });
});

describe("note", () => {
  test("appends to the body and leaves the status alone", () => {
    bean("bbbb", "Some work", "in-progress");
    applyWorkPlanOp(repo, "bbbb", "note", { note: "3 findings, 1 critical." });
    const body = readFileSync(findBean(repo, "bbbb")!.path, "utf8");
    expect(body).toContain("3 findings, 1 critical.");
    expect(body).toContain("Original body.");
    expect(body).toContain("status: in-progress");
  });
});

describe("resolve", () => {
  test("does NOT close the bean while the process it tracks is still running", () => {
    bean("cccc", "Some work", "in-progress");
    // "Resolve or re-open the bean" is a judgement about whether work is done,
    // and AGENTS.md is explicit that a bean is not closed on someone else's
    // say-so. The only thing that settles it here is the process finishing.
    const r = applyWorkPlanOp(repo, "cccc", "resolve", { instanceCompleted: false });
    expect(r.summary).toContain("left in-progress");
    expect(readFileSync(findBean(repo, "cccc")!.path, "utf8")).toContain("status: in-progress");
  });

  test("closes it once the instance has completed", () => {
    bean("cccc", "Some work", "in-progress");
    const r = applyWorkPlanOp(repo, "cccc", "resolve", {
      instanceCompleted: true,
      note: "Landed clean.",
    });
    expect(r.summary).toBe("bean cccc: in-progress → completed");
    const body = readFileSync(findBean(repo, "cccc")!.path, "utf8");
    expect(body).toContain("status: completed");
    expect(body).toContain("Landed clean.");
  });
});

describe("an instance with no bean", () => {
  test("says so rather than silently doing nothing", () => {
    // Silence is how the two records drift apart again without anyone noticing.
    const r = applyWorkPlanOp(repo, undefined, "claim");
    expect(r.summary).toContain("no bean on this instance");
    expect(r.bean).toBeUndefined();
  });

  test("a bean id that is not in the store is reported, not invented", () => {
    expect(applyWorkPlanOp(repo, "zzzz", "claim").summary).toContain("not in beans/");
  });
});

describe("the store as it is laid out now: beans/defs/ (bean folio-assistant-m8gz)", () => {
  // The flat beans/ above is the layout this module was written against. The
  // store moved to beans/defs/, and a lookup in beans/ alone then found
  // nothing, so every engine claim, note and resolve recorded nothing.
  const defsBean = (id: string, status: string, sub = ""): string => {
    const dir = join(repo, "beans", "defs", sub);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `${id}--work.md`);
    writeFileSync(path, `---\n# ${id}\ntitle: Work\nstatus: ${status}\ntype: task\nupdated_at: 2026-01-01T00:00:00Z\n---\n\nBody.\n`);
    return path;
  };

  test("a bean in beans/defs/ is found, and so is one already in its archive/", () => {
    defsBean("dddd", "todo");
    defsBean("eeee", "completed", "archive");
    expect(findBean(repo, "dddd")?.path).toBe(join(repo, "beans", "defs", "dddd--work.md"));
    expect(findBean(repo, "eeee")?.path).toBe(join(repo, "beans", "defs", "archive", "eeee--work.md"));
    expect(applyWorkPlanOp(repo, "dddd", "claim").summary).toBe("bean dddd: todo → in-progress");
  });

  test("archive moves a completed bean into archive/, keeping its status and recording why", () => {
    const from = defsBean("ffff", "completed");
    const r = applyWorkPlanOp(repo, "ffff", "archive", { instanceCompleted: true, note: "Archived: the CRDM close signed it off." });
    const to = join(repo, "beans", "defs", "archive", "ffff--work.md");
    expect(r.summary).toBe("bean ffff archived (completed) to archive/");
    expect(existsSync(from)).toBe(false);
    const body = readFileSync(to, "utf8");
    expect(body).toContain("status: completed");
    expect(body).toContain("Archived: the CRDM close signed it off.");
    expect(applyWorkPlanOp(repo, "ffff", "archive", { instanceCompleted: true }).summary).toBe("bean ffff already archived");
  });

  test("archive refuses a bean that is not terminal, and notes why (check:bean-archive's invariant)", () => {
    const path = defsBean("gggg", "in-progress");
    const r = applyWorkPlanOp(repo, "gggg", "archive", { instanceCompleted: true });
    expect(r.summary).toContain("left in place");
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, "utf8")).toContain("only a completed or scrapped bean may be archived");
  });

  test("archive refuses while the process it tracks is still running", () => {
    const path = defsBean("hhhh", "completed");
    const r = applyWorkPlanOp(repo, "hhhh", "archive", { instanceCompleted: false });
    expect(r.summary).toContain("still running");
    expect(existsSync(path)).toBe(true);
  });
});

describe("the diagrams declare which operation each step performs", () => {

  test("an op this build does not implement is refused, not ignored", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bean-op-"));
    writeFileSync(
      join(dir, "bad.bpmn"),
      `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/" xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  id="D" targetNamespace="urn:x">
  <bpmn:process id="Process_Bad" name="Bad" isExecutable="false">
    <bpmn:startEvent id="S"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="T" name="Do">
      <bpmn:extensionElements><cat-harness.processes:bean op="obliterate" /></bpmn:extensionElements>
      <bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>
`,
    );
    // A step that claims to touch the work plan and quietly does nothing is the
    // divergence this whole extension exists to close.
    await expect(loadProcessModel(join(dir, "bad.bpmn"))).rejects.toThrow(UnsupportedBpmn);
    await expect(loadProcessModel(join(dir, "bad.bpmn"))).rejects.toThrow(/obliterate/);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("a step drawn against the Beans store works the bean (Q-BR-8 F)", () => {
  // S → Work (writes the work-plan store) → Read (reads it only) → Named (writes it, op="claim") → E
  const diagram = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  id="D" targetNamespace="urn:x">
  <bpmn:dataStore id="work-plan" name="Work plan (beans)"/>
  <bpmn:process id="Process_W" name="W" isExecutable="false">
    <bpmn:startEvent id="S"/>
    <bpmn:task id="Work" name="Work">
      <bpmn:dataOutputAssociation id="DOA1"><bpmn:targetRef>Beans</bpmn:targetRef></bpmn:dataOutputAssociation>
    </bpmn:task>
    <bpmn:task id="Read" name="Read">
      <bpmn:dataInputAssociation id="DIA1"><bpmn:sourceRef>Beans</bpmn:sourceRef></bpmn:dataInputAssociation>
    </bpmn:task>
    <bpmn:task id="Named" name="Named">
      <bpmn:extensionElements><cat-harness.processes:bean op="claim"/></bpmn:extensionElements>
      <bpmn:dataOutputAssociation id="DOA2"><bpmn:targetRef>Beans</bpmn:targetRef></bpmn:dataOutputAssociation>
    </bpmn:task>
    <bpmn:dataStoreReference id="Beans" name="Beans" dataStoreRef="work-plan"/>
    <bpmn:endEvent id="E"/>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="Work"/>
    <bpmn:sequenceFlow id="F2" sourceRef="Work" targetRef="Read"/>
    <bpmn:sequenceFlow id="F3" sourceRef="Read" targetRef="Named"/>
    <bpmn:sequenceFlow id="F4" sourceRef="Named" targetRef="E"/>
  </bpmn:process>
</bpmn:definitions>
`;

  test("a write to the store is a note; a read alone is not; a named op still wins", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bean-store-"));
    writeFileSync(join(dir, "w.bpmn"), diagram);
    const model = await loadProcessModel(join(dir, "w.bpmn"));
    rmSync(dir, { recursive: true, force: true });
    const work = model.nodes.get("Work")!;
    expect([work.workPlanOp, work.worksBean, work.touchesWorkPlan]).toEqual(["note", true, true]);
    const read = model.nodes.get("Read")!;
    expect([read.workPlanOp, read.worksBean, read.touchesWorkPlan]).toEqual([undefined, undefined, false]);
    expect(model.nodes.get("Named")!.workPlanOp).toBe("claim");
  });

  test("working the bean claims one nobody has started, then notes", () => {
    bean("wb01", "Not started", "todo");
    const r = applyWorkPlanOp(repo, "wb01", "note", { note: "did a step", claimIfNotStarted: true });
    expect(r.summary).toBe("bean wb01: todo → in-progress, and noted");
    const body = readFileSync(findBean(repo, "wb01")!.path, "utf8");
    expect(body).toContain("status: in-progress");
    expect(body).toContain("did a step");
  });

  test("never claims a draft, or a bean already in progress or finished", () => {
    for (const status of ["draft", "in-progress", "completed", "scrapped"]) {
      bean(`wb${status.slice(0, 2)}`, `Bean ${status}`, status);
      const r = applyWorkPlanOp(repo, `wb${status.slice(0, 2)}`, "note", { note: "x", claimIfNotStarted: true });
      expect([status, r.summary]).toEqual([status, `noted on bean wb${status.slice(0, 2)}`]);
      expect(readFileSync(findBean(repo, `wb${status.slice(0, 2)}`)!.path, "utf8")).toContain(`status: ${status}`);
    }
  });
});

describe("resolve before a closing archive step", () => {
  // S → Work → Resolve → [Archive] → E, with the archive step optionally followed by more work.
  const diagram = (afterArchive: boolean): string => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  id="D" targetNamespace="urn:x">
  <bpmn:process id="Process_A" name="A" isExecutable="false">
    <bpmn:startEvent id="S"/>
    <bpmn:task id="Work" name="Work"/>
    <bpmn:task id="Resolve" name="Resolve"><bpmn:extensionElements><cat-harness.processes:bean op="resolve"/></bpmn:extensionElements></bpmn:task>
    <bpmn:task id="Archive" name="Archive"><bpmn:extensionElements><cat-harness.processes:bean op="archive"/></bpmn:extensionElements></bpmn:task>
    ${afterArchive ? '<bpmn:task id="More" name="More"/>' : ""}
    <bpmn:endEvent id="E"/>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="Work"/>
    <bpmn:sequenceFlow id="F2" sourceRef="Work" targetRef="Resolve"/>
    <bpmn:sequenceFlow id="F3" sourceRef="Resolve" targetRef="Archive"/>
    ${afterArchive
      ? '<bpmn:sequenceFlow id="F4" sourceRef="Archive" targetRef="More"/><bpmn:sequenceFlow id="F5" sourceRef="More" targetRef="E"/>'
      : '<bpmn:sequenceFlow id="F4" sourceRef="Archive" targetRef="E"/>'}
  </bpmn:process>
</bpmn:definitions>
`;
  const state = (tokens: string[], status: "running" | "completed" = "running"): InstanceState => ({
    id: "i", processId: "Process_A", source: "a.bpmn", subject: "s", tokens, arrivals: {}, history: [],
    status, startedAt: "", updatedAt: "",
  });
  const load = async (afterArchive: boolean) => {
    const dir = mkdtempSync(join(tmpdir(), "bean-archive-"));
    writeFileSync(join(dir, "a.bpmn"), diagram(afterArchive));
    const model = await loadProcessModel(join(dir, "a.bpmn"));
    rmSync(dir, { recursive: true, force: true });
    return model;
  };

  test("a token on a closing archive step counts as finished; one on earlier work does not", async () => {
    const model = await load(false);
    expect(onlyArchiveLeft(model, state(["Archive"]))).toBe(true);
    expect(onlyArchiveLeft(model, state(["Resolve"]))).toBe(false);
    expect(onlyArchiveLeft(model, state([], "completed"))).toBe(true);
  });

  test("an archive step with work after it does not let resolve fire early", async () => {
    const model = await load(true);
    expect(onlyArchiveLeft(model, state(["Archive"]))).toBe(false);
  });
});
