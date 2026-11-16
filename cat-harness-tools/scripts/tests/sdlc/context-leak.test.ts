/**
 * `check:context-leak` (cat-harness#991 §4.9, §4.13, step 22): what a
 * bean-blind agent is given names no bean, work plan or process-engine tool —
 * and a DAK's business processes are not mistaken for a leak.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { findLeaks, scanDir, scanToolList } from "../../context-leak.ts";
import { registerMemoryTools } from "../../../src/tools/memory.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

describe("the vocabulary", () => {
  test("bean, work plan, the engine's tools, bean processes and markup are leaks", () => {
    const text = [
      "Claim the bean before you start.",
      "See bean `kg83` for why.",
      "It lives in beans/defs.",
      "The cat/cat-harness/beans branch.",
      "Update the work plan.",
      "Hand it a work order.",
      "Call workflow_complete when done.",
      "work_plan_prime gives the backlog.",
      "It calls Process_BeanOpen first.",
      '<cat-harness.processes:bean op="note"/>',
    ].join("\n");
    // A line can hold more than one term: a path into the work plan is also the word "beans".
    expect(findLeaks("t", text).map((f) => `${f.line}:${f.term}`)).toEqual([
      "1:bean",
      "2:bean",
      "2:provenance-id",
      "3:bean",
      "3:beans-path",
      "4:bean",
      "4:beans-branch",
      "5:work-plan",
      "6:work-order",
      "7:workflow-tool",
      "8:work-plan-tool",
      "9:bean-process",
      "10:bean",
      "10:bean-markup",
    ]);
  });

  test("a DAK's business processes, BPMN and workflows are content, not leaks", () => {
    const dak = "The business process for immunization (BPMN) has a workflow per persona. Process the client record; beansprouts are a food.";
    expect(findLeaks("dak", dak)).toEqual([]);
  });
});

describe("scanning", () => {
  test("a built context directory: findings by file and line; a binary file is named as not read", () => {
    const d = mkdtempSync(join(tmpdir(), "leak-"));
    made.push(d);
    mkdirSync(join(d, "skills"));
    writeFileSync(join(d, "AGENTS.md"), "# Agents\nRead the skills.\n");
    writeFileSync(join(d, "skills", "x.md"), "line one\nNote it on the bean.\n");
    writeFileSync(join(d, "logo.png"), Buffer.from([0x89, 0x50]));
    const r = scanDir(d);
    expect(r.read).toBe(2);
    expect(r.findings.map((f) => [f.where, f.line, f.term])).toEqual([["skills/x.md", 2, "bean"]]);
    expect(r.unreadable).toEqual(["logo.png"]);
  });

  test("the memory tools a bean-blind agent is offered are clean", () => {
    const tools: Array<{ name: string; description: string; inputSchema: unknown }> = [];
    registerMemoryTools({ tool: (name: string, description: string, inputSchema: unknown) => tools.push({ name, description, inputSchema }) } as never, "/x");
    expect(tools.map((t) => t.name)).toEqual(["memory_note", "memory_checkpoint", "memory_recall"]);
    expect(scanToolList(tools)).toEqual([]);
  });

  test("the process engine's tools are a leak in a bean-blind tool list", () => {
    expect(scanToolList([{ name: "workflow_complete", description: "Record that an enabled step is done." }]).map((f) => f.term)).toEqual(["workflow-tool"]);
  });
});
