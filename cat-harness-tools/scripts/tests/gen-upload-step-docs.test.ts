/**
 * `gen-upload-step-docs` — the upload step's page, derived from a diagram and
 * the Tools that satisfy its skill.
 *
 * @module scripts/tests/gen-upload-step-docs
 * @graphNode none — a test
 *
 * **Synthetic diagrams only.** Every case writes a small `.bpmn` into a
 * temporary directory and loads it; nothing here walks the real corpus. That
 * is deliberate rather than tidy: a test that read `processes/` would spend a
 * sibling session's time budget and would assert today's diagram rather than
 * the generator's behaviour, so a step inserted by somebody else would fail it
 * for being different instead of for being wrong.
 *
 * What is verified FOR THE CONSUMER — the reader of the published page — is
 * that the page states the step and skill the DIAGRAM names rather than a
 * literal, that a Tool's documentation reaches it whole (description, ports,
 * and the selection triple, or the named absence of one), and that every way
 * of not being able to derive it refuses instead of publishing a page that
 * looks complete. The last is the point: an empty or half-derived page reads
 * as "this step has no mechanism", which is a finding and not a document.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CannotDerive, firstActivity, render } from "../gen-upload-step-docs.ts";
import { loadProcessModel, type ProcessModel } from "../../src/workflow/process-model.ts";
import { defineTool, type ToolDefinition } from "../../schemas/tools/tool.ts";

const NS = [
  'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"',
  'xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/"',
  'xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"',
].join(" ");

/** A one-lane diagram whose start event reaches `body`. Written, then loaded. */
async function diagram(body: string, opts: { flows?: string; refs?: string } = {}): Promise<ProcessModel> {
  const dir = mkdtempSync(join(tmpdir(), "upload-step-docs-"));
  const file = join(dir, "synthetic.bpmn");
  writeFileSync(
    file,
    `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions ${NS} id="Definitions_S" targetNamespace="urn:test">
  <bpmn:process id="Process_S" name="A synthetic process" isExecutable="false">
    <bpmn:documentation>A synthetic process, for the generator's tests.</bpmn:documentation>
    <bpmn:laneSet id="LS">
      <bpmn:lane id="L0" name="Somebody (human or agent)">
        <bpmn:documentation>The lane a synthetic contributor stands in.</bpmn:documentation>
        <bpmn:extensionElements><bootstrap.processes:role ref="user"/></bpmn:extensionElements>
        <bpmn:flowNodeRef>S</bpmn:flowNodeRef>
        ${opts.refs ?? "<bpmn:flowNodeRef>A</bpmn:flowNodeRef>"}
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="S" name="Something is needed"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    ${body}
    ${opts.flows ?? '<bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="A" />'}
  </bpmn:process>
</bpmn:definitions>
`,
  );
  try {
    return await loadProcessModel(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const ACTIVITY = `<bpmn:task id="A" name="Do the thing
[synthetic-skill]">
      <bpmn:documentation>What the diagram says about the step.</bpmn:documentation>
      <bpmn:extensionElements>
        <bootstrap.processes:skill ref="synthetic-skill" />
        <cat-harness.processes:bean op="note" />
      </bpmn:extensionElements>
      <bpmn:incoming>F1</bpmn:incoming>
    </bpmn:task>`;

function tool(over: Partial<Parameters<typeof defineTool>[0]> = {}): ToolDefinition {
  return defineTool({
    id: "synthetic-tool",
    title: "A synthetic Tool",
    description: "It does the synthetic thing, and this sentence is its documentation.",
    install: { none: true },
    invoke: { shell: "bun run nothing.ts" },
    requires: { runtime: ["bun"], network: false },
    io: {
      inputs: [
        { name: "subject", schema: "urn:test:Text", required: true, arg: { positional: 0 }, description: "What to act on." },
        { name: "check", schema: "urn:test:Flag", required: false, arg: { flag: "--check" }, description: "Write nothing." },
      ],
      outputs: [{ name: "result", schema: "urn:test:Text", description: "What it produced." }],
    },
    satisfies: ["synthetic-skill"],
    ...over,
  } as Parameters<typeof defineTool>[0]);
}

describe("deriving the step", () => {
  test("the first activity is the one the start event reaches, with its skill and lane", async () => {
    const step = firstActivity(await diagram(ACTIVITY));
    expect(step.id).toBe("A");
    expect(step.skills).toEqual(["synthetic-skill"]);
    expect(step.lane).toBe("Somebody (human or agent)");
    expect(step.roleRef).toBe("user");
  });

  test("a start event reaching an EVENT rather than an activity refuses", async () => {
    const model = await diagram(
      '<bpmn:endEvent id="A" name="Over"><bpmn:incoming>F1</bpmn:incoming></bpmn:endEvent>',
    );
    expect(() => firstActivity(model)).toThrow(CannotDerive);
  });

  test("a start event with two outgoing flows refuses rather than picking one", async () => {
    const model = await diagram(
      `${ACTIVITY}
    <bpmn:task id="B" name="The other thing"><bpmn:incoming>F2</bpmn:incoming>
      <bpmn:documentation>Another step.</bpmn:documentation>
      <bpmn:extensionElements><bootstrap.processes:skill ref="synthetic-skill" /></bpmn:extensionElements>
    </bpmn:task>`,
      {
        refs: "<bpmn:flowNodeRef>A</bpmn:flowNodeRef><bpmn:flowNodeRef>B</bpmn:flowNodeRef>",
        flows:
          '<bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="A" /><bpmn:sequenceFlow id="F2" sourceRef="S" targetRef="B" />',
      },
    );
    expect(() => firstActivity(model)).toThrow(/outgoing flow/);
  });

  test("the refusal names the diagram it read, not the generator's own subject", async () => {
    const model = await diagram(
      '<bpmn:endEvent id="A" name="Over"><bpmn:incoming>F1</bpmn:incoming></bpmn:endEvent>',
    );
    let msg = "";
    try {
      firstActivity(model);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toContain("synthetic.bpmn");
    expect(msg).not.toContain("document-ingestion");
  });
});

describe("the page", () => {
  test("states the step, lane, skill and Tool count read from the diagram", async () => {
    const model = await diagram(ACTIVITY);
    const page = render(model, firstActivity(model), [tool()]);
    expect(page).toContain("| first step | **Do the thing** (`A`) |");
    expect(page).toContain("Somebody (human or agent) (role `user`)");
    expect(page).toContain("| governed by the skill | `synthetic-skill` |");
    expect(page).toContain("| Tools that satisfy it | 1 |");
    expect(page).toContain("> What the diagram says about the step.");
  });

  test("carries the Tool's documentation whole — description, ports and invocation", async () => {
    const model = await diagram(ACTIVITY);
    const page = render(model, firstActivity(model), [tool()]);
    expect(page).toContain("It does the synthetic thing, and this sentence is its documentation.");
    expect(page).toContain("`bun run nothing.ts`");
    expect(page).toContain("| `subject` | yes | positional 0 | What to act on. |");
    expect(page).toContain("| `check` | no | `--check` | Write nothing. |");
    expect(page).toContain("| `result` | What it produced. |");
  });

  test("prints the selection triple under its three questions", async () => {
    const model = await diagram(ACTIVITY);
    const page = render(model, firstActivity(model), [
      tool({ selection: { when: "WHEN-TEXT", limits: "LIMITS-TEXT", cost: "COST-TEXT" } }),
    ]);
    expect(page).toContain("**When.** WHEN-TEXT");
    expect(page).toContain("**Limits.** LIMITS-TEXT");
    expect(page).toContain("**Cost.** COST-TEXT");
  });

  test("a Tool with no selection is reported as a gap in the Tool, not left blank", async () => {
    const model = await diagram(ACTIVITY);
    const page = render(model, firstActivity(model), [tool()]);
    expect(page).toContain("declares no `selection`");
    expect(page).toContain("gap in the Tool node, not on this page");
  });

  test("a cell may not break the table that holds it", async () => {
    const model = await diagram(ACTIVITY);
    const page = render(model, firstActivity(model), [
      tool({
        io: {
          inputs: [
            {
              name: "subject",
              schema: "urn:test:Text",
              required: true,
              arg: { positional: 0 },
              description: "a | pipe\nand a newline",
            },
          ],
          outputs: [],
        },
      }),
    ]);
    const row = page.split("\n").find((l) => l.startsWith("| `subject` |"))!;
    expect(row).toContain("a \\| pipe and a newline");
    expect(row.endsWith("|")).toBe(true);
  });

  test("the front matter marks it generated and names the generator", async () => {
    const model = await diagram(ACTIVITY);
    const page = render(model, firstActivity(model), [tool()]);
    expect(page.startsWith("---\n")).toBe(true);
    expect(page).toContain("generated: cat-harness-tools/scripts/gen-upload-step-docs.ts");
    expect(page).toContain("do not hand-edit");
  });
});
