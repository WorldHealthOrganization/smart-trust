---
title: "Developer Mode: Topology, Tool Parity, and Capability Guard"
summary: >-
  Specification and measured reality of Developer Mode: topology preset values,
  MCP-vs-CLI tool parity measurement, and single-model capability refusal guard.
date: 2026-10-09
bean: folio-assistant-2ngl
---

# Developer Mode: Topology, Tool Parity, and Capability Guard

> **Topology reference**: Deployment topologies and operating modes (opt-in `cat-harness.proposals`)

Developer mode represents a local workstation environment for folio authors and platform developers.
It is modeled as a **point in the topology product**, paired with a **measured tool parity evaluation** and a **capability refusal guard**.

---

## 1. The Topology Point

Developer mode is defined in `schemas/cat-harness.ts` as `DEVELOPER_MODE_PROFILE` / `DEVELOPER_MODE_TOPOLOGY`:

| Axis | Value | Rationale |
|---|---|---|
| **forge** | `none` | Local git repository only; no dependency on GitHub or remote git forge |
| **visibility** | `internal` (or `private`) | Workstation checkout; not published externally |
| **publication host** | `local-server` | Local HTTP server serving previews and rendered artefacts |
| **compute** | `workstation` | The developer's own machine |
| **network reach** | `internet` | Allows model API calls or package fetches when permitted |
| **tool surface** | `cli` (or `both`) | Invoked via shell scripts / CLI commands |
| **model cardinality** | `single` | One model configured for all workflows |
| **model provenance** | `hosted` or `open-weight-local` | Flexible depending on local workstation resources |
| **data stores** | `[none]` | No live external HAPI FHIR, EMR, or national portal connections |
| **outward facing** | `false` | Not serving external users |

This preset produces zero conflicts in `topologyConflicts()`.

---

## 2. MCP-vs-CLI Tool Parity

Every capability can exist twice: as an MCP tool (`invoke.mcp`) and as a CLI
command (`invoke.shell`). Measure the split with `bun run cat check:tool-parity`;
it counts the declared Tools by surface and lists the skills satisfied **only**
by MCP tools.

The MCP-only Tools include the workflow tools (`workflow_list`,
`workflow_start`, `workflow_next`, `workflow_gate`, `workflow_complete`),
`skill_list` and `skill_fetch`, `auth_whoami`, the translation tools and
`bean_query`.

### Conclusion for Developer Mode

Developer mode configured strictly with `toolSurface: "cli"` cannot inspect or
advance BPMN workflows, or query skills dynamically. Configure:
```json
{
  "topology": {
    "toolSurface": "both"
  }
}
```
or run an MCP server alongside local CLI tooling.

---

## 3. Single-Model Capability Refusal Guard

### The Problem

In developer mode with `modelCardinality: "single"`, one model is assigned across all workflow lanes.
Different lanes carry different roles with distinct capability demands:
- A `deep-researcher` or `clinical-sme` requires `reasoning_tier: "high"`, `tool_use: true`, and `context_window: 64000+`.
- A lightweight formatting or translation pass might require only `reasoning_tier: "low"`.

A model dispatched to a lane whose required capabilities it lacks is refused rather than allowed to degrade silently, because such a model produces malformed outputs or hallucinated tool syntax.

### The Guard Mechanism

The guard is implemented in `schemas/model-capabilities.ts` and `src/workflow/model-capabilities.ts`:

1. **Role Capability Declaration**:
   A role in `scenarios/roles.json` (and `RoleDef`) may declare `requiredCapabilities`:
   ```json
   {
     "id": "deep-researcher",
     "requiredCapabilities": {
       "reasoning_tier": "high",
       "tool_use": true,
       "context_window": 64000
     }
   }
   ```

2. **Model Capability Specification**:
   The configured model declares its capabilities via `ModelConfig`:
   ```ts
   const modelConfig: ModelConfig = {
     id: "gemini-1.5-flash",
     capabilities: {
       reasoning_tier: "medium",
       tool_use: true,
       context_window: 1000000,
     },
   };
   ```

3. **Explicit Refusal**:
   When `validateWorkflowModel(processModel, modelConfig, roles)` or `startInstance(model, { model: modelConfig, roles })` or `complete(model, state, nodeId, { model: modelConfig, roles })` executes:
   If the model fails any required capability (reasoning tier hierarchy, tool use support, minimum context window, multimodal requirement, or named specific capability), execution **immediately refuses** by throwing:
   ```ts
   throw new WorkflowCapabilityRefusalError(roleId, laneName, required, model, violations);
   ```
   The resulting error specifies the exact missing capabilities and values, preventing silent corruption of workflow state.
