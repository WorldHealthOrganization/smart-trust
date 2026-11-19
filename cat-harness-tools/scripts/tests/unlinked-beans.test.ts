/**
 * The unlinked-beans QA report (bean `folio-assistant-w2hn`): the link
 * classifier against hand-built instances and diagram ids, and the grouping
 * step against a small corpus with two clear neighbourhoods.
 */
import { describe, expect, test } from "bun:test";

import type { BeanNode } from "../beans.ts";
import type { InstanceState } from "../../src/workflow/instance.js";
import { epicMembers, FIT_FLOOR, rankEpicsForBean } from "../lsi-epics.ts";
import {
  classifyLinks,
  diagramIdsOf,
  instanceMentions,
  MIN_GROUP_SIZE,
  namedIdsIn,
  NO_FIT,
  sizeClassOf,
  unlinkedMarkdown,
  unlinkedReport,
  unlinkedResultDocument,
  unlinkedSectionHtml,
  type BeanInput,
  type DiagramId,
} from "../unlinked-beans.ts";
import { buildLsi } from "../../pipeline/lsi.ts";

function bean(id: string, over: Partial<BeanNode> = {}): BeanNode {
  return {
    id,
    file: `beans/defs/${id}.md`,
    title: `bean ${id}`,
    status: "todo",
    type: "task",
    priority: "normal",
    parent: "",
    blocking: [],
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    body: "",
    ...over,
  };
}

const input = (b: BeanNode): BeanInput => ({ bean: b, text: `---\n# ${b.id}\ntitle: ${b.title}\n---\n${b.body}` });

function inst(over: Partial<InstanceState> = {}): InstanceState {
  return {
    $schema: "folio-workflow-instance/v1",
    id: "p--1",
    processId: "Process_P",
    source: "p.bpmn",
    subject: "something",
    tokens: [],
    arrivals: {},
    history: [],
    status: "running",
    startedAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    ...over,
  };
}

const IDS = new Map<string, DiagramId>([
  ["Process_Review", { id: "Process_Review", kind: "process", file: "p/review.bpmn", process: "Process_Review" }],
  ["Task_Review", { id: "Task_Review", kind: "activity", file: "p/review.bpmn", process: "Process_Review" }],
]);

describe("diagram ids", () => {
  test("reads processes and every activity kind, each under its process, and skips extension elements", () => {
    const xml = `<bpmn:definitions>
      <bpmn:process id="Process_A" name="A"><bpmn:userTask id="Task_One" name="x"/><bpmn:callActivity name="c" id="Call_B"/>
      <folio:task id="Not_A_Task"/></bpmn:process>
      <process id="Process_C"><serviceTask id="Task_Two"/></process></bpmn:definitions>`;
    expect(diagramIdsOf(xml, "f.bpmn")).toEqual([
      { id: "Process_A", kind: "process", file: "f.bpmn", process: "Process_A" },
      { id: "Task_One", kind: "activity", file: "f.bpmn", process: "Process_A" },
      { id: "Call_B", kind: "activity", file: "f.bpmn", process: "Process_A" },
      { id: "Process_C", kind: "process", file: "f.bpmn", process: "Process_C" },
      { id: "Task_Two", kind: "activity", file: "f.bpmn", process: "Process_C" },
    ]);
  });

  test("a bean names an id only as a whole token", () => {
    expect(namedIdsIn("see `Task_Review` and Process_Review.", IDS).map((d) => d.id)).toEqual(["Process_Review", "Task_Review"]);
    expect(namedIdsIn("Task_ReviewAll and xTask_Review and Task_Review_2", IDS)).toEqual([]);
    expect(namedIdsIn("a review task", IDS)).toEqual([]);
  });
});

describe("instance mentions", () => {
  const ids = ["fa-aaaa", "fa-bbbb", "fa-cccc", "fa-dddd", "fa-eeee", "fa-ffff"];
  const m = instanceMentions(
    [
      inst({ id: "i1", bean: "fa-aaaa", carriedBeans: ["fa-aaaa", "fa-bbbb"] }),
      inst({
        id: "i2",
        subject: "fa-cccc",
        children: { Call_X: inst({ id: "i2c", bean: "fa-dddd", history: [{ at: "2026-10-02", node: "T", note: "closes bean `eeee`" }] }) },
      }),
      inst({ id: "i3", status: "completed", history: [{ at: "2026-10-02", node: "T", note: "touched fa-ffff and ffff, aaaa alone" }] }),
    ],
    ids,
  );

  test("bean, carried, subject and subprocess are each recorded with the instance", () => {
    expect(m.get("fa-aaaa")).toEqual([{ instance: "i1", processId: "Process_P", status: "running", how: "bean" }]);
    expect(m.get("fa-bbbb")?.map((x) => x.how)).toEqual(["carried"]);
    expect(m.get("fa-cccc")?.map((x) => x.how)).toEqual(["subject"]);
    expect(m.get("fa-dddd")).toEqual([{ instance: "i2", processId: "Process_P", status: "running", how: "subprocess" }]);
  });

  test("a history note names a bean by its full id, or by its short id after the word bean — never by a bare short id", () => {
    expect(m.get("fa-eeee")?.map((x) => `${x.instance}:${x.how}`)).toEqual(["i2:history"]);
    expect(m.get("fa-ffff")?.map((x) => `${x.instance}:${x.how}:${x.status}`)).toEqual(["i3:history:completed"]);
    // "aaaa alone" in i3's note is a bare short id: i3 does not name fa-aaaa.
    expect(m.get("fa-aaaa")?.some((x) => x.instance === "i3")).toBe(false);
  });

  test("an instance's own bean carried again by its subprocess adds no second mention", () => {
    const again = instanceMentions([inst({ id: "i9", bean: "fa-aaaa", children: { C: inst({ bean: "fa-aaaa" }) } })], ["fa-aaaa"]);
    expect(again.get("fa-aaaa")?.length).toBe(1);
  });
});

describe("the link classifier", () => {
  const beans = [
    bean("fa-1"),
    bean("fa-2", { body: "Runs at `Task_Review`." }),
    bean("fa-3", { body: "Nothing about any diagram." }),
  ].map(input);
  const links = classifyLinks(beans, [inst({ bean: "fa-1" })], IDS);
  const by = new Map(links.map((l) => [l.id, l]));

  test("instance, then named id (inferred), then none", () => {
    expect(by.get("fa-1")?.basis).toBe("instance");
    expect(by.get("fa-2")?.basis).toBe("named-id");
    expect(by.get("fa-2")?.namedIds.map((d) => d.id)).toEqual(["Task_Review"]);
    expect(by.get("fa-3")?.basis).toBe("none");
  });

  test("an instance wins over a named id, and the named id is still reported", () => {
    const both = classifyLinks([input(bean("fa-9", { body: "Process_Review" }))], [inst({ bean: "fa-9" })], IDS)[0]!;
    expect(both.basis).toBe("instance");
    expect(both.namedIds.map((d) => d.id)).toEqual(["Process_Review"]);
  });

  test("front matter counts as the bean's text", () => {
    const fm: BeanInput = { bean: bean("fa-8"), text: "---\n# fa-8\ntitle: wire Process_Review\n---\n" };
    expect(classifyLinks([fm], [], IDS)[0]!.basis).toBe("named-id");
  });
});

describe("size classes", () => {
  test("5 or more is a candidate; fewer is small; one is a singleton; no-fit is its own class", () => {
    expect(sizeClassOf("e", MIN_GROUP_SIZE)).toBe("candidate");
    expect(sizeClassOf("e", MIN_GROUP_SIZE - 1)).toBe("small");
    expect(sizeClassOf("e", 2)).toBe("small");
    expect(sizeClassOf("e", 1)).toBe("singleton");
    expect(sizeClassOf(NO_FIT, 40)).toBe("no-fit");
  });
});

// Two neighbourhoods with disjoint vocabularies: telescopes and bread.
const SKY = ["telescope mirror lens aperture astronomy", "telescope eyepiece lens focus astronomy", "mirror aperture telescope collimation optics", "lens optics eyepiece telescope astronomy", "astronomy aperture mirror optics focus", "collimation telescope optics lens mirror"];
const BREAD = ["sourdough flour starter oven bake", "flour dough knead oven loaf", "starter sourdough loaf crust bake", "knead dough flour proof oven", "crust loaf bake proof sourdough"];

function corpus(): { inputs: BeanInput[]; nodes: BeanNode[] } {
  const nodes: BeanNode[] = [
    bean("fa-sky", { type: "epic", status: "in-progress", title: "SKY epic", body: "telescope astronomy optics mirror lens aperture" }),
    bean("fa-brd", { type: "epic", status: "in-progress", title: "BREAD epic", body: "sourdough flour oven bake loaf dough" }),
    // Filed, linked children teach each epic its vocabulary.
    bean("fa-s0", { parent: "fa-sky", status: "completed", body: `${SKY[0]} Task_Review` }),
    bean("fa-b0", { parent: "fa-brd", status: "completed", body: BREAD[0] }),
    ...SKY.map((t, i) => bean(`fa-s${i + 1}`, { body: t, ...(i < 2 ? { parent: "fa-sky" } : {}) })),
    ...BREAD.slice(1, 3).map((t, i) => bean(`fa-b${i + 1}`, { body: t })),
  ];
  return { nodes, inputs: nodes.map(input) };
}

describe("the grouping step (lsi-epics' ranking, reused)", () => {
  const { inputs, nodes } = corpus();
  const r = unlinkedReport({ store: "t", beans: inputs, archived: [], instances: [], ids: IDS, diagrams: { files: 1, unreadable: [] } });

  test("lsi-epics' exported ranking puts each topic's bean nearest its own epic", () => {
    const ix = buildLsi(inputs.map((b) => ({ id: b.bean.id, text: b.text })), { k: 4, weighting: "log-entropy", seed: 1990 });
    const members = epicMembers(nodes);
    expect(members.get("fa-sky")).toContain("fa-s1");
    expect(rankEpicsForBean(ix, members, "fa-s5")[0]!.epic).toBe("fa-sky");
    expect(rankEpicsForBean(ix, members, "fa-b2")[0]!.epic).toBe("fa-brd");
    // Self is left out of the centroid, so an epic does not rank itself by its own vector.
    expect(rankEpicsForBean(ix, members, "fa-nope")).toEqual([]);
  });

  test("open beans are counted by basis; closed ones only counted", () => {
    expect(r.open).toEqual({ total: 10, instance: 0, namedId: 0, none: 10 });
    expect(r.closed.find((c) => c.status === "completed")).toEqual({ status: "completed", total: 2, instance: 0, namedId: 1, none: 1 });
  });

  test("every unlinked open bean is in exactly one group, and the groups are the epics' neighbourhoods", () => {
    if (!("groups" in r.grouping)) throw new Error(`grouping unknown: ${r.grouping.unknown}`);
    const placed = r.grouping.groups.flatMap((g) => g.beans).sort();
    expect(placed).toEqual(r.links.filter((l) => l.basis === "none").map((l) => l.id).sort());
    const sky = r.grouping.groups.find((g) => g.key === "fa-sky")!;
    expect(sky.beans).toEqual(expect.arrayContaining(["fa-s1", "fa-s3", "fa-s4", "fa-s5", "fa-s6"]));
    expect(sky.sizeClass).toBe("candidate");
    expect(sky.terms.some((t) => /telescope|mirror|lens|optics|aperture|astronomy/.test(t))).toBe(true);
    // fa-s1 is filed under it; the others in the group are filed nowhere.
    expect(sky.filedUnder).toEqual([{ epic: "fa-sky", beans: 1 }]);
    // The epic's linked (inferred) completed child ties it to a known process.
    expect(sky.knownProcesses).toEqual([{ process: "Process_Review", beans: 1 }]);
    const bread = r.grouping.groups.find((g) => g.key === "fa-brd")!;
    expect(bread.sizeClass).toBe("small");
    expect(bread.knownProcesses).toEqual([]);
    for (const p of r.grouping.placements) if (p.group !== NO_FIT) expect(p.cosine!).toBeGreaterThanOrEqual(FIT_FLOOR);
    // fa-s2 is nearest SKY, but under the floor: it fits no epic, is listed as such, and is not forced into SKY.
    const noFit = r.grouping.groups.find((g) => g.key === NO_FIT)!;
    expect(noFit.sizeClass).toBe("no-fit");
    expect(noFit.beans).toEqual(["fa-s2"]);
    expect(noFit.nearestEpic).toBeUndefined();
    const p2 = r.grouping.placements.find((p) => p.id === "fa-s2")!;
    expect(p2.nearestEpic).toBe("fa-sky");
    expect(p2.cosine!).toBeLessThan(FIT_FLOOR);
  });

  test("the QA result is warning-only, and lists the link basis and the groups", () => {
    const doc = unlinkedResultDocument(r);
    expect(doc.$schema).toBe("qa-results/v1");
    expect(doc.subject).toEqual({ kind: "bean-store", id: "t" });
    const unl = doc.families["open-bean-unlinked"]!;
    expect(unl.count).toBe(10);
    expect((unl.entries as Array<{ severity: string; basis: string }>).every((e) => e.severity === "warning" && e.basis === "none")).toBe(true);
    const groups = doc.families["unlinked-group"]!.entries as Array<{ size_class: string; size: number }>;
    expect(groups.map((g) => g.size_class)).toContain("candidate");
    expect(doc.families["closed-bean-counts"]!.entries).toHaveLength(2);
  });

  test("the Markdown and the page section list small groups and singletons rather than dropping them", () => {
    const md = unlinkedMarkdown(r);
    expect(md).toContain("**Severity: warning.**");
    expect(md).toContain(`### Groups of ${MIN_GROUP_SIZE} or more`);
    expect(md).toContain("### Small groups (2–4) — 1");
    expect(md).toContain(`### Fit no epic (cosine < ${FIT_FLOOR}) — 1`);
    const html = unlinkedSectionHtml(r);
    expect(html).toContain('id="unlinked-beans"');
    expect(html).toContain("Warning, never a failure");
  });
});

describe("could not group", () => {
  test("too few beans for an index leaves the grouping unknown, and the list stands", () => {
    const r = unlinkedReport({ store: "t", beans: [input(bean("fa-1"))], archived: [], instances: [], ids: IDS, diagrams: { files: 0, unreadable: [] } });
    expect(r.open.none).toBe(1);
    expect("unknown" in r.grouping).toBe(true);
    expect(unlinkedMarkdown(r)).toContain("Grouping **unknown**");
  });

  test("nothing unlinked is an empty grouping, not an unknown one", () => {
    const r = unlinkedReport({ store: "t", beans: [input(bean("fa-1"))], archived: [], instances: [inst({ bean: "fa-1" })], ids: IDS, diagrams: { files: 0, unreadable: [] } });
    expect(r.grouping).toEqual({ groups: [], placements: [] });
  });
});

describe("on the bean store's page (state visualiser)", () => {
  test("the section follows the bean-position section when the view carries it, and is absent otherwise", async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { beanStorePartsSection } = await import("../state-visualizer.ts");
    const store = mkdtempSync(join(tmpdir(), "bean-store-"));
    try {
      writeFileSync(join(store, "beans.json"), JSON.stringify({ name: "x", directories: [] }));
      const r = unlinkedReport({ store: "x", beans: [input(bean("fa-1"))], archived: [], instances: [], ids: IDS, diagrams: { files: 0, unreadable: [] } });
      const view = { beans: [bean("fa-1")], now: new Date("2026-10-24T00:00:00Z") };
      const html = beanStorePartsSection(store, { ...view, unlinked: unlinkedSectionHtml(r) });
      expect(html.indexOf('id="unlinked-beans"')).toBeGreaterThan(html.indexOf('id="bean-position"'));
      expect(beanStorePartsSection(store, view)).not.toContain('id="unlinked-beans"');
    } finally {
      rmSync(store, { recursive: true, force: true });
    }
  });
});
