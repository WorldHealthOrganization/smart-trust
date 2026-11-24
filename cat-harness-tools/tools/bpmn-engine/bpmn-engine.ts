import { toolFactory } from "../../schemas/tools/tool-folders.js";
import { defineTool } from "../../schemas/tools/tool.js";

export default toolFactory((t) =>
  defineTool({
    id: "bpmn-engine",
    title: "BPMN workflow engine",
    description:
      "Run a declared BPMN process as an instance: `workflow_start` opens one for a subject, `workflow_next` reports what is enabled, `workflow_complete` records a step or answers a decision (a DMN-computed one from `facts`) and REFUSES a step that is not enabled. State is committed under the work plan, so which edge was taken is a record, not a memory.",
    install: { none: true },
    // The registrar the MCP server loads. `inProcess.module` is relative to
    // the layer that declares the node, which is this one.
    invoke: { inProcess: { module: "src/tools/workflow.ts", register: "registerWorkflowTools" }, mcp: { tool: "workflow_*" } },
    io: {
      inputs: [
        { name: "process", schema: t("ProcessId"), required: true, description: "The process to run: a diagram's file stem or its `bpmn:process` id." },
        { name: "node", schema: t("NodeId"), required: false, description: "The step or decision to complete, as `workflow_next` reported it." },
      ],
      outputs: [
        { name: "enabled", schema: t("NodeId"), description: "What may be worked next, after each call." },
      ],
    },
    satisfies: ["process-state"],
    selection: {
      when: "Work follows a declared process and its order must be enforced and recorded: a step done out of order should be refused, not just discouraged.",
      limits: "Reached over MCP; an agent without the server can walk the generated checklist (`bpmn-checklist`) by hand, but nothing then refuses a wrong turn.",
      cost: "One diagram load per call; state is a small committed file.",
    },
    requires: { runtime: ["bun"], network: false },
  }),
);
