/**
 * The actors line under a BPMN drawing (owner, 2026-11-23): one shared helper,
 * `src/workflow/diagram-actors.ts`, read off the lanes and pools and drawn the
 * same by every BPMN figure renderer. Every actor in the fixtures is fictional.
 */
import { describe, expect, test } from "bun:test";

import { actorsLine, diagramActorsLine, diagramActorsOf, type ActorResolver } from "../../../src/workflow/diagram-actors.ts";
import { bpmnFigureLines } from "../../gen-docs-pages.ts";
import { processPage, type ProcessRow } from "../../gen-processes-viz.ts";
import { bpmnFigure } from "../../journeys/render.ts";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:folio="https://example.org/folio">
  <bpmn:resource id="health-worker" name="Health worker"/>
  <bpmn:resource id="registry"/>
  <bpmn:collaboration id="C">
    <bpmn:participant id="Pool_Clinic" name="Clinic" processRef="P"/>
    <bpmn:participant id="Pool_Lab" name="Reference &amp; lab" processRef="Q"/>
  </bpmn:collaboration>
  <bpmn:process id="P">
    <bpmn:laneSet id="LS">
      <bpmn:lane id="Lane_HW" name="Health&#10;worker" partitionElementRef="health-worker">
        <bpmn:flowNodeRef>T1</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_Client" name="Client">
        <bpmn:flowNodeRef>T2</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_Reg" partitionElementRef="registry">
        <bpmn:childLaneSet id="CLS">
          <bpmn:lane id="Lane_Legacy" name="Clerk">
            <bpmn:extensionElements><folio:role ref="clerk"/></bpmn:extensionElements>
          </bpmn:lane>
        </bpmn:childLaneSet>
      </bpmn:lane>
      <bpmn:lane id="Lane_HW2" name="Nurse" partitionElementRef="health-worker"/>
      <bpmn:lane id="Lane_Blank"/>
    </bpmn:laneSet>
    <bpmn:userTask id="T1" name="Vaccinate"/>
  </bpmn:process>
  <bpmn:process id="Q"/>
</bpmn:definitions>`;

const pages: Record<string, { href?: string; title?: string }> = {
  "health-worker": { href: "ActorDefinition-HealthWorker.html", title: "Health worker (persona)" },
  registry: { href: "https://example.org/role/registry", title: "Immunization registry" },
  clerk: { title: "Registry clerk" },
};
const resolve: ActorResolver = (ref) => pages[ref];

describe("the actors a drawing's lanes and pools are bound to", () => {
  test("every lane in document order, nested ones included, then each pool with no lanes", () => {
    expect(diagramActorsOf(XML)).toEqual([
      { name: "Health worker", ref: "health-worker" },
      { name: "Client" },
      { ref: "registry" },
      { name: "Clerk", ref: "clerk" },
      { name: "Reference & lab" },
    ]);
  });

  test("a lane is bound the way laneRoleRef reads it: partitionElementRef first, the legacy ref only without one", () => {
    const xml = `<bpmn:process id="P"><bpmn:laneSet><bpmn:lane id="A" name="A" partitionElementRef="std"><bpmn:extensionElements><folio:role ref="old"/></bpmn:extensionElements></bpmn:lane><bpmn:lane id="B" name="B"><bpmn:extensionElements><bootstrap.processes:role ref="old"/></bpmn:extensionElements></bpmn:lane></bpmn:laneSet></bpmn:process>`;
    expect(diagramActorsOf(xml)).toEqual([
      { name: "A", ref: "std" },
      { name: "B", ref: "old" },
    ]);
  });

  test("an unprefixed BPMN file reads the same", () => {
    const xml = `<definitions><process id="P"><laneSet><lane id="L" name="Client" partitionElementRef="client"/></laneSet></process></definitions>`;
    expect(diagramActorsOf(xml)).toEqual([{ name: "Client", ref: "client" }]);
  });
});

describe("the actors line", () => {
  test("one compact line: linked where a page exists, by name where none does, never a table", () => {
    const line = diagramActorsLine(XML, resolve);
    expect(line).toBe(
      '<p class="bpmn-actors"><span class="bpmn-actors-label">Actors:</span> ' +
        '<a href="ActorDefinition-HealthWorker.html" title="health-worker">Health worker</a> · ' +
        "<span>Client</span> · " +
        '<a href="https://example.org/role/registry" title="registry">Immunization registry</a> · ' +
        '<span title="clerk">Clerk</span> · ' +
        "<span>Reference &amp; lab</span></p>",
    );
    expect(line).not.toContain("<table");
    expect(line).not.toContain("\n");
  });

  test("a bound lane with no name falls back to its page's title, then to the ref", () => {
    expect(actorsLine([{ ref: "registry" }], resolve)).toContain(">Immunization registry</a>");
    expect(actorsLine([{ ref: "unknown-role" }], resolve)).toContain("<span>unknown-role</span>");
  });

  test("with no resolver every name is listed unlinked", () => {
    const line = diagramActorsLine(XML);
    expect(line).not.toContain("<a ");
    expect(line).toContain("<span title=\"health-worker\">Health worker</span>");
  });

  test("escapes what it writes, and carries a caller's link attribute", () => {
    const line = actorsLine([{ name: `<b>"x"</b>`, ref: "r" }], () => ({ href: `a"b.html` }), { linkAttr: "data-jv-dak" });
    expect(line).toContain('href="a&quot;b.html"');
    expect(line).toContain("data-jv-dak>");
    expect(line).toContain("&lt;b&gt;&quot;x&quot;&lt;/b&gt;");
  });

  test("a drawing with no lanes or pools has no line", () => {
    expect(diagramActorsLine(`<bpmn:definitions><bpmn:process id="P"><bpmn:task id="T"/></bpmn:process></bpmn:definitions>`)).toBe("");
  });
});

describe("every BPMN figure renderer carries the line", () => {
  const line = diagramActorsLine(XML, resolve);

  test("the journeys viewer, in the figure's caption", () => {
    const fig = bpmnFigure("<svg/>", undefined, "<code>p.bpmn</code>", undefined, line);
    expect(fig).toContain(`<figcaption><code>p.bpmn</code>${line}</figcaption>`);
  });

  test("the docs pages, right under the drawing", () => {
    const lines = bpmnFigureLines("p1", "p1.svg", "A process", line);
    expect(lines[lines.indexOf("</div>") + 1]).toBe(line);
    expect(bpmnFigureLines("p1", "p1.svg", "A process")).not.toContain("");
  });

  test("the processes viewer, under the drawing, its lanes linked to their roles' pages", () => {
    const row = {
      id: "P",
      file: "procs/p.bpmn",
      stem: "p",
      name: "P",
      group: "procs",
      svg: true,
      lanes: [],
      roles: [],
      skills: [],
      steps: [],
      decisions: [],
      laneDetails: [
        { id: "L1", name: "Health worker", roleRef: "health-worker", binding: "bound", roleId: "health-worker", roleSkills: [], activitySkills: [] },
        { id: "L2", name: "Client", binding: "ungraphed", roleSkills: [], activitySkills: [] },
      ],
    } as unknown as ProcessRow;
    const page = processPage(row, [row], new Set(), [], undefined, () => {}, () => undefined, resolve);
    expect(page).toContain(
      '<p class="bpmn-actors"><span class="bpmn-actors-label">Actors:</span> <a href="ActorDefinition-HealthWorker.html" title="health-worker">Health worker</a> · <span>Client</span></p>',
    );
    expect(page.indexOf("bpmn-actors")).toBeGreaterThan(page.indexOf("assets/img/workflows/p.svg"));
  });
});
