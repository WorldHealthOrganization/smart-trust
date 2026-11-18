/**
 * The workflow view's join and its stuck-state classifier (bean
 * `folio-assistant-v49e`), against hand-built instances, beans and todos.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { BeanNode } from "../beans.ts";
import type { InstanceState } from "../../src/workflow/instance.js";
import type { ProcessModel, ProcessNode } from "../../src/workflow/process-model.js";
import {
  beanPositions,
  beanStepsOf,
  diagramLevels,
  endNodesOf,
  GATE_REFUSALS,
  instancesByProcess,
  lastMoved,
  processIdsOf,
  NO_INSTANCE_REASON,
  readInstances,
  STUCK_AFTER_DAYS,
  dayOf,
  startOfUtcDay,
  stuckStatesOf,
  todosNamedBy,
  inheritsClosure,
  workingContextOf,
  dynamicStateDocument,
  DYNAMIC_STATE_FILE,
  DYNAMIC_STATE_SCHEMA,
  DynamicStateKind,
} from "../workflow-view.ts";
import { loadProcessModel } from "../../src/workflow/process-model.js";
import { REFUSALS_KEPT, withRefusal } from "../../src/workflow/instance.js";
import type { MemoryNode } from "../../schemas/conduct/memory.js";
import type { RoleGraph } from "../../schemas/process/role-graph.js";

const NOW = new Date("2026-10-24T00:00:00Z");
const daysBefore = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

function inst(over: Partial<InstanceState> = {}): InstanceState {
  return {
    $schema: "folio-workflow-instance/v1",
    id: "p--x",
    processId: "Process_P",
    source: "p.bpmn",
    subject: "x",
    bean: "x-1",
    tokens: ["Task_A"],
    arrivals: {},
    history: [{ at: daysBefore(1), node: "Start" }],
    status: "running",
    startedAt: daysBefore(1),
    updatedAt: daysBefore(1),
    ...over,
  };
}

function bean(over: Partial<BeanNode> = {}): BeanNode {
  return {
    id: "x-1",
    file: "beans/defs/x-1.md",
    title: "a bean",
    status: "in-progress",
    type: "task",
    priority: "normal",
    parent: "",
    blocking: [],
    createdAt: daysBefore(2),
    updatedAt: daysBefore(1),
    body: "",
    ...over,
  };
}

const kinds = (s: InstanceState, beans: BeanNode[] = [bean()], ends?: Set<string>) =>
  stuckStatesOf(s, beans, NOW, ends).map((x) => x.kind);

describe("stuck states are states, from committed data and a given now", () => {
  test("the threshold is a named week", () => {
    expect(STUCK_AFTER_DAYS).toBe(7);
  });

  test("a fresh running instance is in none", () => {
    expect(kinds(inst())).toEqual([]);
  });

  test("a token unmoved past the threshold is enabled-not-taken, and just inside it is not", () => {
    expect(kinds(inst({ updatedAt: daysBefore(STUCK_AFTER_DAYS + 1) }), [bean({ updatedAt: daysBefore(STUCK_AFTER_DAYS + 1) })])).toEqual([
      "enabled-not-taken",
    ]);
    expect(kinds(inst({ updatedAt: daysBefore(STUCK_AFTER_DAYS - 1) }))).toEqual([]);
  });

  test("with no updatedAt the newest dated history entry is when it last moved", () => {
    const s = inst({ updatedAt: undefined as unknown as string, history: [{ at: daysBefore(30), node: "S" }, { at: daysBefore(20), node: "T" }] });
    expect(lastMoved(s)).toBe(daysBefore(20));
    expect(kinds(s, [bean({ updatedAt: daysBefore(20) })])).toEqual(["enabled-not-taken"]);
  });

  test("no date anywhere is age-unknown, never fresh", () => {
    const s = inst({ updatedAt: undefined as unknown as string, history: [] });
    expect(kinds(s)).toEqual(["age-unknown"]);
  });

  test("the bean updated well after the instance last moved is bean-moved-on", () => {
    const s = inst({ updatedAt: daysBefore(3) });
    expect(kinds(s, [bean({ updatedAt: daysBefore(3) })])).toEqual([]);
    const late = inst({ updatedAt: daysBefore(20) });
    expect(kinds(late, [bean({ updatedAt: daysBefore(1) })])).toEqual(["enabled-not-taken", "bean-moved-on"]);
  });

  test("a block with no expiry on the instance's bean is blocked-without-expiry, in each of its three shapes", () => {
    const heading = bean({ body: "## Blocked on\n\n- **waits on:** x\n- **since:** 2026-10-01\n- **handoff:** ask\n" });
    expect(kinds(inst(), [heading])).toEqual(["blocked-without-expiry"]);
    const withExpiry = bean({ body: "## Blocked on\n\n- **waits on:** x\n- **since:** 2026-10-01\n- **expires:** 2026-10-30\n- **handoff:** ask\n" });
    expect(kinds(inst(), [withExpiry])).toEqual([]);
    const prose = bean({ body: "This is blocked until the owner rules." });
    expect(kinds(inst(), [prose])).toEqual(["blocked-without-expiry"]);
    const relation = [bean({ declaredBlockedBy: ["x-2"] }), bean({ id: "x-2", file: "x-2.md" })];
    expect(kinds(inst(), relation)).toEqual(["blocked-without-expiry"]);
  });

  test("a closed bean under a running instance is bean-closed", () => {
    expect(kinds(inst(), [bean({ status: "completed" })])).toEqual(["bean-closed"]);
  });

  test("running with no token anywhere is no-token; a token in a running child counts", () => {
    expect(kinds(inst({ tokens: [] }))).toEqual(["no-token"]);
    const child = inst({ id: "c", processId: "Process_C", tokens: ["Task_C"] });
    expect(kinds(inst({ tokens: ["Call_C"], children: { Call_C: child } }))).toEqual([]);
  });

  test("no status is said; a token resting on an end event is finished, not waiting", () => {
    const s = inst({ status: undefined as unknown as "running", tokens: ["End_Done"], updatedAt: daysBefore(40) });
    expect(kinds(s, [bean()], new Set(["End_Done"]))).toEqual(["no-status"]);
    expect(stuckStatesOf(s, [bean()], NOW, new Set(["End_Done"]))[0]!.detail).toContain("end event");
    // Without the diagram the end event is not known, and the age is reported.
    expect(kinds(s, [bean({ updatedAt: daysBefore(40) })])).toEqual(["no-status", "enabled-not-taken"]);
  });

  test("a completed instance is in none", () => {
    expect(kinds(inst({ status: "completed", updatedAt: daysBefore(100) }), [bean({ status: "completed" })])).toEqual([]);
  });

  test("a refusal after the instance last moved is a refused gate; one before it is history", () => {
    const refused = inst({
      updatedAt: daysBefore(2),
      refusals: [
        { at: daysBefore(3), node: "Task_A", reason: "older, before the last move" },
        { at: daysBefore(1), node: "Task_B", actor: "agent", reason: "Task_B is not enabled" },
      ],
    });
    expect(kinds(refused)).toEqual(["refused-gate"]);
    const d = stuckStatesOf(refused, [bean()], NOW)[0]!.detail;
    expect(d).toContain("refused 1 step(s)");
    expect(d).toContain("`Task_B` as agent: Task_B is not enabled");
    expect(kinds(inst({ updatedAt: daysBefore(1), refusals: [{ at: daysBefore(2), node: "Task_A", reason: "x" }] }))).toEqual([]);
  });

  test("an instance with no refusals field says not recorded, never 'never refused'", () => {
    expect(GATE_REFUSALS.since).toBe("2026-10-29");
    expect(GATE_REFUSALS.why).toContain("not recorded");
  });

  test("withRefusal keeps the newest, folds the reason to one line, and moves nothing", () => {
    let s = inst();
    for (let i = 0; i < REFUSALS_KEPT + 3; i++) s = withRefusal(s, { at: daysBefore(0), node: `T${i}`, reason: "line one\n  line two" });
    expect(s.refusals!.length).toBe(REFUSALS_KEPT);
    expect(s.refusals!.at(-1)!.node).toBe(`T${REFUSALS_KEPT + 2}`);
    expect(s.refusals![0]!.reason).toBe("line one line two");
    expect(s.updatedAt).toBe(inst().updatedAt);
    expect(s.tokens).toEqual(inst().tokens);
  });
});

describe("the join: position, beans, todos", () => {
  test("every bean gets one of three positions, and none is a stated reason", () => {
    const beans = [bean(), bean({ id: "x-2" }), bean({ id: "x-3" })];
    const pos = beanPositions(beans, [inst(), inst({ id: "q", bean: "x-2", status: "completed" }), inst({ id: "r", bean: "zz", carriedBeans: ["x-1"] })]);
    expect(pos.get("x-1")).toEqual({ state: "running", instances: ["p--x", "r"] });
    expect(pos.get("x-2")).toEqual({ state: "finished", instances: ["q"] });
    expect(pos.get("x-3")).toEqual({ state: "none", reason: NO_INSTANCE_REASON });
  });

  test("todos are named by process, by step, or by a bean the instance names", () => {
    const s = inst({ tokens: ["Call_C"], children: { Call_C: inst({ id: "c", processId: "Process_C", bean: undefined }) } });
    const named = todosNamedBy(s, [
      { id: "a", summary: "by process", status: "open", processes: ["Process_P"] },
      { id: "b", summary: "by child step", status: "open", tasks: [{ process: "Process_C", task: "Task_C" }] },
      { id: "c", summary: "by bean", status: "open", references: [{ kind: "bean", id: "x-1" }] },
      { id: "d", summary: "elsewhere", status: "open", processes: ["Process_Z"], references: [{ kind: "skill", id: "x-1" }] },
    ]);
    expect(named.map((t) => [t.id, t.why])).toEqual([
      ["a", "tagged with Process_P"],
      ["b", "tagged with step Process_C▸Task_C"],
      ["c", "references x-1"],
    ]);
  });

  test("diagram levels follow a token into its running subprocess", () => {
    const child = inst({ id: "c", processId: "Process_C", tokens: ["Task_C"], history: [{ at: daysBefore(1), node: "Start_C" }] });
    const s = inst({ tokens: ["Call_C"], history: [{ at: daysBefore(2), node: "Start" }, { at: daysBefore(1), node: "Call_C" }], children: { Call_C: child } });
    const levels = diagramLevels(s);
    expect(levels.map((l) => [l.processId, l.phase, l.tokens, l.done])).toEqual([
      ["Process_P", [], ["Call_C"], ["Start"]],
      ["Process_C", ["Call_C"], ["Task_C"], ["Start_C"]],
    ]);
  });

  test("bean steps are read off the model and its subprocesses; end nodes too", () => {
    const node = (id: string, kind: ProcessNode["kind"], op?: string) => ({ id, name: id, kind, type: "bpmn:Task", ...(op ? { workPlanOp: op } : {}) }) as unknown as ProcessNode;
    const child = { nodes: new Map([["A_Close", node("A_Close", "activity", "resolve")]]), children: new Map() } as unknown as ProcessModel;
    const model = {
      nodes: new Map([
        ["A_Claim", node("A_Claim", "activity", "claim")],
        ["Task_X", node("Task_X", "activity")],
        ["End", node("End", "end")],
      ]),
      children: new Map([["Call_Close", child]]),
    } as unknown as ProcessModel;
    expect(beanStepsOf(model).map((x) => [x.op, [...x.phase, x.node].join("▸")])).toEqual([
      ["claim", "A_Claim"],
      ["resolve", "Call_Close▸A_Close"],
    ]);
    expect([...endNodesOf(model)]).toEqual(["End"]);
    expect([...endNodesOf(undefined)]).toEqual([]);
  });

  test("an unreadable or foreign file is listed with its reason, never dropped", () => {
    const dir = mkdtempSync(join(tmpdir(), "wv-"));
    try {
      writeFileSync(join(dir, "a.json"), JSON.stringify({ processId: "P", tokens: [] }));
      writeFileSync(join(dir, "b.json"), "{");
      writeFileSync(join(dir, "c.json"), JSON.stringify({ $schema: "other/v1", processId: "P", tokens: [] }));
      const r = readInstances([join(dir, "a.json"), join(dir, "b.json"), join(dir, "c.json")]);
      expect("state" in r[0]! && r[0].state.id).toBe("a");
      expect("bad" in r[1]! && r[1].bad).toBe("not readable JSON");
      expect("bad" in r[2]! && r[2].bad).toContain("other/v1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the process → instance join the processes viewer links by", () => {
  test("an instance counts for its own process and every subprocess in its children, completed ones included", () => {
    const grandchild = inst({ id: "g", processId: "Process_G", status: "completed" });
    const child = inst({ id: "c", processId: "Process_C", tokens: ["Call_G"], children: { Call_G: grandchild } });
    expect([...processIdsOf(inst({ tokens: ["Call_C"], children: { Call_C: child } }))].sort()).toEqual(["Process_C", "Process_G", "Process_P"]);
  });

  test("links group by process, sorted by store then id, and a process twice in one instance is listed once", () => {
    const by = instancesByProcess([
      { store: "s2", id: "b", processIds: ["Process_P"], route: "en/h/beans/s2/workflows/b/" },
      { store: "s1", id: "z", processIds: ["Process_P", "Process_C", "Process_C"], route: "en/h/beans/s1/workflows/z/" },
      { store: "s1", id: "a", processIds: ["Process_C"], route: "en/h/beans/s1/workflows/a/", status: "completed" },
    ]);
    expect(by.get("Process_P")!.map((l) => `${l.store}/${l.id}`)).toEqual(["s1/z", "s2/b"]);
    expect(by.get("Process_C")!.map((l) => `${l.store}/${l.id}`)).toEqual(["s1/a", "s1/z"]);
    expect(by.get("Process_Q")).toBeUndefined();
  });
});

describe("the working context at the token (item 3)", () => {
  const NS = "https://litlfred.github.io/bootstrap/v0/processes/ns/";
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bootstrap.processes="${NS}" id="D" targetNamespace="https://example.test/wf">
  <bpmn:import namespace="${NS}" location="https://litlfred.github.io/bootstrap/v0/processes/ns.jsonld" importType="http://www.w3.org/ns/json-ld"/>
  <bpmn:resource id="reviewer" name="Reviewer"/>
  <bpmn:process id="Process_P" isExecutable="false">
    <bpmn:laneSet id="LS">
      <bpmn:lane id="Lane_R" name="Review" partitionElementRef="reviewer">
        <bpmn:flowNodeRef>S</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_A</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>E</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="S"/>
    <bpmn:userTask id="Task_A" name="Review the change">
      <bpmn:extensionElements><bootstrap.processes:skill ref="step-skill"/></bpmn:extensionElements>
    </bpmn:userTask>
    <bpmn:endEvent id="E"/>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="Task_A"/>
    <bpmn:sequenceFlow id="F2" sourceRef="Task_A" targetRef="E"/>
  </bpmn:process>
</bpmn:definitions>`;
  async function model() {
    const dir = mkdtempSync(join(tmpdir(), "wv-context-"));
    const file = join(dir, "p.bpmn");
    writeFileSync(file, xml);
    try {
      return await loadProcessModel(file);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  const roles = {
    name: "test",
    roles: [
      { id: "reviewer", title: "Reviewer", skills: ["review"], inherits: ["contributor"] },
      { id: "contributor", title: "Contributor", skills: ["write"] },
      { id: "publisher", title: "Publisher", skills: ["publish"] },
    ],
  } as unknown as RoleGraph;
  const mem = (id: string, rs: string[], archived = false) =>
    ({ id, summary: `about ${id}`, label: "stable", archived, tags: { roles: rs, references: [] } }) as unknown as MemoryNode;
  const memory = [mem("for-reviewers", ["reviewer"]), mem("inherited", ["contributor"]), mem("elsewhere", ["publisher"]), mem("everyone", []), mem("gone", ["reviewer"], true)];

  test("inherits is closed over, nearest first, each role once", () => {
    expect(inheritsClosure(roles, "reviewer")).toEqual(["reviewer", "contributor"]);
    expect(inheritsClosure(undefined, "reviewer")).toEqual(["reviewer"]);
  });

  test("the step's role, its skills, and the memory its role and inherited roles reach", async () => {
    const m = await model();
    const [c] = workingContextOf(m, inst({ processId: "Process_P", tokens: ["Task_A"] }), roles, memory);
    expect(c!.node).toBe("Task_A");
    expect(c!.role).toBe("reviewer");
    expect(c!.memoryRoles).toEqual(["reviewer", "contributor"]);
    expect(c!.skills).toEqual(["review", "step-skill", "write"]);
    expect(c!.roleMemory.map((x) => x.id)).toEqual(["for-reviewers", "inherited"]);
    expect(c!.everyoneMemory).toBe(1);
  });

  test("no role graph: no role, no invented memory; a completed instance has no context", async () => {
    const m = await model();
    const [c] = workingContextOf(m, inst({ processId: "Process_P", tokens: ["Task_A"] }), undefined, memory);
    expect(c!.role).toBeUndefined();
    expect(c!.roleMemory).toEqual([]);
    expect(workingContextOf(m, inst({ status: "completed" }), roles, memory)).toEqual([]);
  });
});

describe("the dynamic-state document (bean 6h47)", () => {
  const doc = () =>
    dynamicStateDocument(
      "h",
      [
        { store: "s", state: inst({ id: "b", updatedAt: daysBefore(10) }), beans: [bean()], page: "en/h/beans/s/workflows/b/" },
        { store: "s", state: inst({ id: "a" }), beans: [bean()] },
      ],
      NOW,
      ["other"],
    );

  test("it is told apart from the stage-1 graph export by type and schema, not only by path", () => {
    const d = doc();
    expect(DYNAMIC_STATE_FILE).toBe("state.jsonld");
    expect(d.type).toBe("cat-harness:DynamicState");
    expect(d.$schema).toBe(DYNAMIC_STATE_SCHEMA);
    expect(d.generatedAt).toBe(NOW.toISOString());
  });

  test("one node per instance, sorted, with the stuck states its page shows", () => {
    const d = doc();
    expect(d.graph.map((n) => n.id)).toEqual(["#workflow/s/a", "#workflow/s/b"]);
    const b = d.graph[1]!;
    expect(b.tokens).toEqual(["Task_A"]);
    expect(b.beans).toEqual(["x-1"]);
    expect(b.page).toBe("en/h/beans/s/workflows/b/");
    expect(b.stuck.map((x) => x.kind)).toEqual(stuckStatesOf(inst({ id: "b", updatedAt: daysBefore(10) }), [bean()], NOW).map((x) => x.kind));
    expect(b.stuck.map((x) => x.kind)).toContain("enabled-not-taken");
  });

  test("what it writes is a node of the kind its docs family names, and a wrong type is refused", () => {
    const written = JSON.parse(JSON.stringify(doc()));
    expect(DynamicStateKind.schema.safeParse(written).success).toBe(true);
    expect(DynamicStateKind.schema.safeParse({ ...written, type: "cat-harness:WorkflowInstance" }).success).toBe(false);
  });

  test("an unread store is named, so its instances read as unknown, not none", () => {
    expect(doc().unreadStores).toEqual(["other"]);
  });

  test("given its published address, the document states it as @id and @base; the instance ids stay relative", () => {
    const at = "https://example.org/site/h/state.jsonld";
    const d = dynamicStateDocument("h", [{ store: "s", state: inst({ id: "a" }), beans: [bean()] }], NOW, [], at);
    expect(d.id).toBe(at);
    expect(d["@context"]["@base"]).toBe(at);
    expect(d.graph.map((n) => n.id)).toEqual(["#workflow/s/a"]);
    expect(doc().id).toBe("");
    expect(doc()["@context"]["@base"]).toBeUndefined();
  });

  test("every key it uses is declared in its context: no undeclared term, no @vocab", async () => {
    const d = doc() as unknown as Record<string, unknown>;
    const ctx = d["@context"] as Record<string, unknown>;
    expect(ctx["@vocab"]).toBeUndefined();
    const keys = new Set<string>();
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (k !== "@context") { keys.add(k); walk(x); } }
    };
    walk(d);
    keys.delete("$schema");
    for (const k of keys) expect(k in ctx || k.startsWith("@")).toBe(true);
    const jsonld = (await import("jsonld")).default;
    const expanded = await jsonld.expand(JSON.parse(JSON.stringify(d)), { base: "https://example.org/h/state.jsonld" });
    expect(JSON.stringify(expanded)).toContain("https://example.org/h/state.jsonld#workflow/s/a");
  });
});

describe("startOfUtcDay / dayOf (cat-harness-tools#1230)", () => {
  test("two builds on the same UTC day measure against the same instant", () => {
    const a = startOfUtcDay(new Date("2026-11-01T08:32:58.829Z"));
    const b = startOfUtcDay(new Date("2026-11-01T23:59:59.999Z"));
    expect(a.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(b.getTime()).toBe(a.getTime());
    expect(dayOf(a)).toBe("2026-11-01");
  });
});
