/**
 * The beans-by-process projection and its pages (cat-harness-tools#1413,
 * bean `folio-assistant-pbv1`), against hand-built layers and beans.
 */
import { describe, expect, test } from "bun:test";

import type { BeanNode } from "../beans.ts";
import type { InstanceState } from "../../src/workflow/instance.js";
import {
  PB_SEGMENT,
  processedBeanBody,
  processedBeanIndexBody,
  processedBeansBody,
  processedBeansCombinedBody,
  processedBeansRoutes,
  processedBeansRows,
  rebase,
  RESERVED_STORE_NAMES,
  unplacedBeans,
} from "../processed-beans.ts";

const NOW = new Date("2026-11-02T00:00:00Z");

function bean(id: string, status: string, updatedAt = "2026-10-01T00:00:00Z"): BeanNode {
  return { id, file: `beans/defs/${id}.md`, title: `title of ${id}`, status, type: "task", priority: "normal", parent: "", blocking: [], createdAt: updatedAt, updatedAt, body: "" } as BeanNode;
}

function instance(id: string, o: Partial<InstanceState>): InstanceState {
  return {
    id,
    processId: "Process_A",
    source: "processes/a.bpmn",
    subject: id,
    tokens: [],
    arrivals: {},
    history: [],
    status: "running",
    startedAt: "2026-09-01T00:00:00Z",
    updatedAt: "",
    ...o,
  } as InstanceState;
}

const diagram = { nodes: new Set(["Start", "Task_1", "Task_2", "End"]), ends: new Set(["End"]) };

function rows(instances: InstanceState[], beans: BeanNode[]) {
  return processedBeansRows({
    instances,
    beans,
    now: NOW,
    diagrams: new Map(instances.map((i) => [i.id, diagram])),
    drawingFor: (src) => (src === "processes/a.bpmn" ? "../../assets/img/workflows/a.svg" : undefined),
    instanceHref: (id) => `workflows/${id}/`,
  });
}

describe("processedBeansRows", () => {
  test("a running instance unmoved for 30 days is stalled, with its bean joined", () => {
    const [r] = rows(
      [instance("i1", { bean: "fa-aaaa", tokens: ["Task_2"], history: [{ at: "2026-10-03T00:00:00Z", node: "Start" }, { at: "2026-10-03T00:00:00Z", node: "Task_1" }] } as Partial<InstanceState>)],
      [bean("fa-aaaa", "in-progress")],
    );
    expect(r.finished).toBe(false);
    expect(r.ageDays).toBe(30);
    expect(r.stuck).toContain("enabled-not-taken");
    expect(r.beans).toEqual([{ id: "fa-aaaa", found: true, title: "title of fa-aaaa", status: "in-progress", updatedAt: "2026-10-01T00:00:00Z", closed: false }]);
    expect(r.done).toEqual(["Start", "Task_1"]);
    expect(r.drawing).toBe("../../assets/img/workflows/a.svg");
    expect(r.href).toBe("workflows/i1/");
  });

  test("a bean the store does not hold is bean-missing, a token off the diagram is node-missing", () => {
    const [r] = rows([instance("i2", { bean: "fa-gone", tokens: ["A_Removed"], updatedAt: "2026-11-01T00:00:00Z" })], []);
    expect(r.beans).toEqual([{ id: "fa-gone", found: false }]);
    expect(r.stuck).toContain("bean-missing");
    expect(r.stuck).toContain("node-missing");
    expect(r.missingNodes).toEqual(["A_Removed"]);
  });

  test("a token resting on an end event is finished, not stalled", () => {
    const [r] = rows([instance("i3", { bean: "fa-aaaa", tokens: ["End"], status: undefined as never, updatedAt: "2026-09-01T00:00:00Z" })], [bean("fa-aaaa", "completed")]);
    expect(r.finished).toBe(true);
    expect(r.stuck).not.toContain("enabled-not-taken");
    expect(r.stuck).not.toContain("bean-closed");
  });

  test("rows sort oldest move first", () => {
    const out = rows(
      [instance("new", { updatedAt: "2026-11-01T00:00:00Z" }), instance("old", { updatedAt: "2026-09-01T00:00:00Z" })],
      [],
    );
    expect(out.map((r) => r.instance)).toEqual(["old", "new"]);
  });
});

describe("links", () => {
  test("beans link to their source, processes to their page and steps to its steps section", () => {
    const [r] = processedBeansRows({
      instances: [instance("i1", { bean: "fa-aaaa", tokens: ["Task_1"] })],
      beans: [bean("fa-aaaa", "todo")],
      now: NOW,
      diagrams: new Map([["i1", diagram]]),
      drawingFor: () => undefined,
      instanceHref: (id) => `workflows/${id}/`,
      beanSource: (b) => `https://github.com/o/r/blob/cat/cat-harness/beans/${b.file}`,
      processPageFor: () => "../../processes/a.html",
    });
    expect(r.beans[0]!.source).toBe("https://github.com/o/r/blob/cat/cat-harness/beans/beans/defs/fa-aaaa.md");
    expect(r.processPage).toBe("../../processes/a.html");
    const [deeper] = rebase([r], "../");
    expect(deeper.processPage).toBe("../../../processes/a.html");
    expect(deeper.beans[0]!.source).toBe(r.beans[0]!.source);
    const html = processedBeansBody("s", [deeper], NOW, "../");
    expect(html).toContain("#steps");
    expect(html).toContain(">source</a>");
    expect(html).toContain("process page");
  });
});

describe("routes are path IRIs", () => {
  test("only URL-segment ids get a page", () => {
    const out = rows([instance("i1", { bean: "fa-aaaa", processId: "Process_A" }), instance("i2", { bean: "bad id", processId: "Process B" })], []);
    expect(processedBeansRoutes(out)).toEqual({ processes: ["Process_A"], beans: ["fa-aaaa"] });
    expect(PB_SEGMENT.test("folio-assistant-pbv1")).toBe(true);
    expect(PB_SEGMENT.test("a/b")).toBe(false);
  });

  test("rebase re-anchors relative hrefs and leaves absolute ones", () => {
    const [r] = rebase([{ ...rows([instance("i1", {})], [])[0], drawing: "https://x/a.svg" }], "../../");
    expect(r.href).toBe("../../workflows/i1/");
    expect(r.drawing).toBe("https://x/a.svg");
  });

  test("no page builds a query-string link", () => {
    const out = rebase(rows([instance("i1", { bean: "fa-aaaa", tokens: ["Task_1"] })], [bean("fa-aaaa", "todo")]), "../");
    const all = processedBeansBody("folio-assistant", out, NOW, "../");
    const one = processedBeanBody("folio-assistant", "fa-aaaa", out, NOW, "../../");
    for (const html of [all, one]) {
      expect(html).not.toMatch(/href="[^"]*\?/);
      expect(html).not.toContain("URLSearchParams");
      expect(html).toContain('"bean-processed/" + id + "/"');
    }
    expect(one).toContain('data-pb-bean="fa-aaaa"');
  });

  test("the embedded rows cannot close the script element", () => {
    const out = rows([instance("i1", { bean: "fa-aaaa" })], [{ ...bean("fa-aaaa", "todo"), title: "</script><b>x" }]);
    expect(processedBeansBody("s", out, NOW, "../")).not.toContain("</script><b>");
  });
});

describe("one bean's history (cat-harness#991 step 5; owner, 2026-11-03)", () => {
  const events = [
    { at: "2026-11-01T09:00:00Z", by: "author", kind: "created" as const, what: "created: Do it (todo)" },
    { at: "2026-11-01T10:00:00Z", by: "workflow", kind: "step-reached" as const, what: "code-change-review: Task_Review", instance: "ccr--a", node: "Task_Review" },
    { at: "2026-11-01T11:00:00Z", by: "agent", kind: "claimed" as const, what: "todo → in-progress" },
  ];

  test("the stepper: buttons for first, previous, play, next and last, a slider over every event, and the keys named", () => {
    const html = processedBeanBody("fixture", "fx-aaaa", [], new Date("2026-11-03T00:00:00Z"), "../../", { events, drawings: {} });
    for (const go of ["first", "prev", "play", "next", "last"]) expect(html).toContain(`data-pb-go="${go}"`);
    expect(html).toContain('id="pb-at" min="0" max="2" value="2"');
    expect(html).toContain("<kbd>Space</kbd> play or pause");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('id="pb-history"');
  });

  test("a history that could not be read says so, with the reason — never an empty timeline", () => {
    const html = processedBeanBody("fixture", "fx-aaaa", [], new Date(), "../../", { unknown: "the beans branch could not be fetched" });
    expect(html).toContain("The history could not be read");
    expect(html).toContain("the beans branch could not be fetched");
    expect(html).not.toContain('<button type="button" data-pb-go="play"');
  });

  test("an event's text cannot close the script it is embedded in", () => {
    const html = processedBeanBody("fixture", "fx-aaaa", [], new Date(), "../../", {
      events: [{ at: "2026-11-01T09:00:00Z", by: "x", kind: "noted", what: "</script><script>alert(1)</script>" }],
      drawings: {},
    });
    expect(html).not.toContain("</script><script>alert(1)");
  });
});

describe("finished instances, beans in no process, open and closed (owner, 2026-11-03)", () => {
  test("a finished instance with no token is marked where it ended, its last step; a running one is not", () => {
    const [fin, run] = rows(
      [
        instance("done", { bean: "fa-aaaa", status: "completed", tokens: [], history: [{ at: "2026-10-01T00:00:00Z", node: "Start" }, { at: "2026-10-02T00:00:00Z", node: "Task_2" }] } as Partial<InstanceState>),
        instance("live", { bean: "fa-bbbb", tokens: ["Task_1"] }),
      ],
      [bean("fa-aaaa", "completed"), bean("fa-bbbb", "todo")],
    ).sort((a, b) => a.instance.localeCompare(b.instance));
    expect(fin!.endedAt).toEqual(["Task_2"]);
    expect(run!.endedAt).toEqual([]);
  });

  test("a finished instance resting on an end event ends there", () => {
    const [r] = rows([instance("i", { bean: "fa-aaaa", tokens: ["End"], status: "completed" })], [bean("fa-aaaa", "completed")]);
    expect(r!.endedAt).toEqual(["End"]);
  });

  test("a bean says whether it is closed, and carries the start of its body", () => {
    const b = { ...bean("fa-aaaa", "scrapped"), body: "Why it was dropped." } as BeanNode;
    const [r] = rows([instance("i", { bean: "fa-aaaa", tokens: ["Task_1"] })], [b]);
    expect(r!.beans[0]).toMatchObject({ closed: true, excerpt: "Why it was dropped." });
  });

  test("beans no instance names are listed, so a store with beans and no instance is not an empty page", () => {
    const placed = rows([instance("i", { bean: "fa-aaaa", tokens: ["Task_1"] })], [bean("fa-aaaa", "todo")]);
    const un = unplacedBeans([bean("fa-aaaa", "todo"), bean("fa-bbbb", "todo"), bean("fa-cccc", "completed")], placed);
    expect(un.map((b) => [b.id, b.closed])).toEqual([
      ["fa-bbbb", false],
      ["fa-cccc", true],
    ]);
    const html = processedBeansBody("core", placed, NOW, "../", undefined, un);
    expect(html).toContain('id="pb-unplaced"');
    expect(html).toContain('id="pb-unplaced-data"');
    expect(html).toContain('<option value="open" selected>Open</option>');
  });

  test("a store with no instance links no `workflows/` hub: that hub is drawn only over instances", () => {
    // Found 2026-11-03 rendering a newly harnessed IG: folio-assistant-core's beans-processed page
    // linked ../workflows/, which no step writes for a store with beans and no instance.
    const none = processedBeansBody("folio-assistant-core", [], NOW, "../", undefined, unplacedBeans([bean("fa-bbbb", "todo")], []));
    expect(none).not.toContain('href="../workflows/"');
    expect(none).toContain('href="../beans-processed/"');
    const some = processedBeansBody("core", rows([instance("i", { bean: "fa-aaaa", tokens: ["Task_1"] })], [bean("fa-aaaa", "todo")]), NOW, "../");
    expect(some).toContain('href="../workflows/"');
  });

  test("the bean index filters open and closed, open by default", () => {
    const html = processedBeanIndexBody("cat-harness", [{ id: "fa-aaaa", title: "t", status: "todo", closed: false }], "../");
    expect(html).toContain('data-pb="index"');
    expect(html).toContain('<option value="open" selected>Open</option>');
    expect(html).toContain('<option value="closed">Closed</option>');
  });
});

describe("the combined page, every store at …/beans/beans-processed/ (owner, 2026-11-03)", () => {
  const a = rows([instance("ia", { bean: "fa-aaaa", tokens: ["Task_1"] })], [bean("fa-aaaa", "todo")]);
  const b = rows([instance("ib", { bean: "fb-bbbb", tokens: ["Task_2"] })], [bean("fb-bbbb", "in-progress")]);
  const html = processedBeansCombinedBody(
    [
      { store: "cat-harness", rows: a, unplaced: [] },
      { store: "folio-assistant-core", rows: b, unplaced: unplacedBeans([bean("fc-cccc", "todo")], []) },
    ],
    NOW,
  );
  const embedded = JSON.parse(/<script type="application\/json" id="pb-rows">([\s\S]*?)<\/script>/.exec(html)![1]!) as Array<{ store: string; up: string; href?: string }>;

  test("each row keeps its own store: its links re-anchored at that store's page", () => {
    expect(embedded.map((r) => [r.store, r.up, r.href])).toEqual([
      ["cat-harness", "../cat-harness/", "../cat-harness/workflows/ia/"],
      ["folio-assistant-core", "../folio-assistant-core/", "../folio-assistant-core/workflows/ib/"],
    ]);
  });

  test("a tick box per store, on by default, and links to each store's own page", () => {
    expect(html).toContain('<input type="checkbox" data-pb-store-box value="cat-harness" checked>');
    expect(html).toContain('<input type="checkbox" data-pb-store-box value="folio-assistant-core" checked>');
    expect(html).toContain('href="../folio-assistant-core/beans-processed/"');
  });

  test("beans in no process say which store they are from", () => {
    expect(html).toContain('"store":"folio-assistant-core"');
  });

  test("each store's needs go to the page, kept to the stores on it, for \"and what it depends on\"", () => {
    const withNeeds = processedBeansCombinedBody(
      [
        { store: "cat-harness", rows: a, unplaced: [], needs: ["bootstrap"] },
        { store: "folio-assistant-core", rows: b, unplaced: [], needs: ["cat-harness", "bootstrap"] },
      ],
      NOW,
    );
    const needs = JSON.parse(/<script type="application\/json" id="pb-needs">([\s\S]*?)<\/script>/.exec(withNeeds)![1]!);
    expect(needs).toEqual({ "cat-harness": [], "folio-assistant-core": ["cat-harness"] });
    expect(withNeeds).toContain('id="pb-deps"');
  });

  test("no live refresh: the local server serves one store, not every store", () => {
    expect(html).not.toContain('id="pb-live"');
  });

  test("a store may not be named like a page beside it", () => {
    expect([...RESERVED_STORE_NAMES].sort()).toEqual(["bean-processed", "beans-processed"]);
  });
});
