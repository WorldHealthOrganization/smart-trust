/**
 * A lane is documented when its `partitionElementRef` resolves to a content
 * block with non-empty prose (owner, 2026-11-15, Q-LANE-2 A: resolve, don't
 * copy). A reference to nothing, or to a block with no text, is still a
 * finding.
 *
 * @module scripts/tests/process/lane-documentation-by-reference.test
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkLanes, definedBlockLabels } from "../../check-lane-documentation.js";

const root = mkdtempSync(join(tmpdir(), "lane-ref-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

function block(stem: string, label: string, prose: string): void {
  writeFileSync(join(root, "blocks", `${stem}.ts`), `export default persona({ label: "${label}", title: "${stem}" });\n`);
  writeFileSync(join(root, "blocks", `${stem}.md`), prose);
}

function lane(id: string, ref: string | null, task: string): string {
  const attr = ref === null ? "" : ` partitionElementRef="${ref}"`;
  return `<bpmn:lane id="${id}" name="${id} role"${attr}><bpmn:flowNodeRef>${task}</bpmn:flowNodeRef></bpmn:lane>`;
}

mkdirSync(join(root, "blocks"));
block("pers-officer", "pers:officer", "*Person.* Staff who register practitioners.\n");
block("pers-empty", "pers:empty", "   \n");
writeFileSync(
  join(root, "blocks", "p.bpmn"),
  `<?xml version="1.0"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="P">
    <bpmn:laneSet>
      ${lane("Lane_Resolved", "pers:officer", "T1")}
      ${lane("Lane_Empty", "pers:empty", "T2")}
      ${lane("Lane_Dangling", "pers:nobody", "T3")}
      ${lane("Lane_Bare", null, "T4")}
    </bpmn:laneSet>
    <bpmn:task id="T1" name="Register"/>
    <bpmn:task id="T2" name="Review"/>
    <bpmn:task id="T3" name="Approve"/>
    <bpmn:task id="T4" name="Archive"/>
  </bpmn:process>
</bpmn:definitions>
`,
);

describe("lane documentation by persona reference", () => {
  test("only blocks with non-empty prose are definitions", () => {
    const labels = definedBlockLabels(root);
    expect(labels.has("pers:officer")).toBe(true);
    expect(labels.has("pers:empty")).toBe(false);
  });

  test("a resolved reference documents the lane; empty, dangling and bare do not", () => {
    const r = checkLanes(root);
    expect(r.lanes).toBe(4);
    expect(r.documented).toBe(1);
    expect(r.documentedByReference).toBe(1);
    expect(r.undocumented.map((u) => u.lane).sort()).toEqual(["Lane_Bare", "Lane_Dangling", "Lane_Empty"]);
    // The referenced block's text is translated with the block, so nothing
    // is asked of the lane's own (absent) documentation string.
    expect(r.unextracted.filter((u) => u.kind === "documentation")).toEqual([]);
  });
});
