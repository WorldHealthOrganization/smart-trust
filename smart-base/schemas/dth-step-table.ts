/**
 * Shared DTH step-table schema (`INPUTS | STEPS | RESOURCES | OUTPUTS | RISKS | MITIGATION`),
 * smart-base#242.
 *
 * Unifies:
 * - Product Catalogue (dth-pc) and Supply Chain (dth-sc) chapter tables
 *   (`INPUTS / STEPS / RESOURCES / OUTPUTS / RISKS / MITIGATION`),
 * - Primary Health Care (dth-phc) chapter/phase panels
 *   (`Who is involved / Inputs / Tools / Outputs`),
 * - Health Workforce Registry (dth-hrh) planning steps, and
 * - Substandard and Falsified Medical Products (dth-sfp) implementation and M&E
 *   step tables (Tables 14, 17, Annex 7).
 *
 * Key invariants (owner, 2026-10-31, smart-base#242):
 * 1. Roles in INPUTS, STEPS, OUTPUTS and RISKS are persona or role IDs
 *    (`pers:...`, `actor:...`, `<HB>-R-nn`, `DAK.Persona.*`), never free text,
 *    so BPMN 2.0 swimlanes can be generated mechanically from the table.
 * 2. Steps and outputs carry an optional `produces` field naming the DAK block
 *    kind (`persona`, `business-process`, `decision-table`, `data-element`,
 *    `functional-requirement`, `non-functional-requirement`, `indicator`, etc.)
 *    produced by the step.
 * 3. Steps can be flat (`steps`) or grouped (`groups`) by chapter or DIIG phase.
 * 4. RISKS and MITIGATION are structured rows with an `ownerRoleId` that a
 *    risk-register block or BPMN governance lane can reference.
 *
 * @module smart-base/schemas/dth-step-table
 * @graphNode schema
 */
import { z } from "zod";
import { DAK_BLOCK_KINDS, type DakBlockKind } from "./dak-kinds.ts";

export const DTH_STEP_TABLE_SCHEMA = "dth-step-table/1.0.0";

// Persona or role identifier: e.g. "pers:registration-officer", "actor:nmra",
// "PC-R-01", "HRH-R-04", "SC-R-11", "DAK.Persona.HealthWorker". Never free prose.
export const DTH_ROLE_ID_PATTERN =
  /^(?:pers:[a-z0-9][a-z0-9-]*|actor:[a-z0-9][a-z0-9-]*|[A-Z]{2,6}-R-[0-9]{2,3}|DAK\.Persona\.[A-Za-z0-9_.]+|[a-z0-9][a-z0-9-]*)$/;

export const DthRoleIdSchema = z
  .string()
  .min(1)
  .regex(
    DTH_ROLE_ID_PATTERN,
    "Role must be a structured persona or role id (e.g. pers:..., actor:..., PC-R-01, or a slug), never free-text prose",
  );

export const DthDakOutputKindSchema = z.enum(DAK_BLOCK_KINDS);

export const DthStepInputSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1).optional(),
    // Persona or role IDs that supply or review this input
    roleIds: z.array(DthRoleIdSchema).min(1),
    sourceRef: z.string().min(1).optional(),
  })
  .strict();
export type DthStepInput = z.infer<typeof DthStepInputSchema>;

export const DthStepResourceSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    kind: z
      .enum(["template", "tool", "standard", "guideline", "system", "reference"])
      .optional(),
    ref: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
  })
  .strict();
export type DthStepResource = z.infer<typeof DthStepResourceSchema>;

export const DthStepOutputSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1).optional(),
    // Persona or role IDs accountable for or receiving this output
    roleIds: z.array(DthRoleIdSchema).min(1),
    // Optional DAK block kind this output instantiates
    produces: DthDakOutputKindSchema.optional(),
  })
  .strict();
export type DthStepOutput = z.infer<typeof DthStepOutputSchema>;

export const DthRiskMitigationRowSchema = z
  .object({
    id: z.string().min(1),
    risk: z.string().min(1),
    mitigation: z.string().min(1),
    // Owner role or persona ID responsible for the mitigation
    ownerRoleId: DthRoleIdSchema,
    stepIds: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type DthRiskMitigationRow = z.infer<typeof DthRiskMitigationRowSchema>;

export const DthStepEntrySchema = z
  .object({
    id: z.string().min(1),
    number: z.union([z.string().min(1), z.number().int().positive()]).optional(),
    title: z.string().min(1),
    description: z.string().min(1).optional(),
    // Persona or role IDs performing this step (maps to BPMN swimlanes)
    roleIds: z.array(DthRoleIdSchema).min(1),
    // Optional DAK block kind this step produces
    produces: DthDakOutputKindSchema.optional(),
    inputs: z.array(DthStepInputSchema).optional(),
    resources: z.array(DthStepResourceSchema).optional(),
    outputs: z.array(DthStepOutputSchema).optional(),
    risks: z.array(DthRiskMitigationRowSchema).optional(),
  })
  .strict();
export type DthStepEntry = z.infer<typeof DthStepEntrySchema>;

export const DthStepGroupSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    phase: z.string().min(1).optional(),
    chapter: z.string().min(1).optional(),
    inputs: z.array(DthStepInputSchema).optional(),
    steps: z.array(DthStepEntrySchema).min(1),
    resources: z.array(DthStepResourceSchema).optional(),
    outputs: z.array(DthStepOutputSchema).optional(),
    risks: z.array(DthRiskMitigationRowSchema).optional(),
  })
  .strict();
export type DthStepGroup = z.infer<typeof DthStepGroupSchema>;

export const DthStepTableSourceSchema = z
  .object({
    libraryId: z.string().min(1),
    sectionId: z.string().min(1).optional(),
    locator: z.string().min(1).optional(),
    tableNumber: z.string().min(1).optional(),
  })
  .strict();
export type DthStepTableSource = z.infer<typeof DthStepTableSourceSchema>;

export const DthStepTableSchema = z
  .object({
    $schema: z.literal(DTH_STEP_TABLE_SCHEMA).optional(),
    id: z.string().min(1),
    title: z.string().min(1),
    handbookId: z.string().min(1).optional(),
    processId: z.string().min(1).optional(),
    source: DthStepTableSourceSchema.optional(),
    // Optional closed set of persona/role IDs declared by the handbook or table;
    // when present, every roleId / ownerRoleId in the table must belong to it.
    declaredRoles: z.array(DthRoleIdSchema).min(1).optional(),
    inputs: z.array(DthStepInputSchema).optional(),
    steps: z.array(DthStepEntrySchema).optional(),
    groups: z.array(DthStepGroupSchema).optional(),
    resources: z.array(DthStepResourceSchema).optional(),
    outputs: z.array(DthStepOutputSchema).optional(),
    risks: z.array(DthRiskMitigationRowSchema).optional(),
  })
  .strict()
  .superRefine((table, ctx) => {
    const flatSteps = [
      ...(table.steps ?? []),
      ...(table.groups ?? []).flatMap((g) => g.steps),
    ];
    if (flatSteps.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["steps"],
        message: "A DTH step table must declare at least one step (in `steps` or `groups`).",
      });
    }
    const seenStepIds = new Set<string>();
    for (const s of flatSteps) {
      if (seenStepIds.has(s.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["steps"],
          message: `Duplicate step id "${s.id}" in step table "${table.id}".`,
        });
      }
      seenStepIds.add(s.id);
    }

    const allRisks = [
      ...(table.risks ?? []),
      ...(table.groups ?? []).flatMap((g) => g.risks ?? []),
      ...flatSteps.flatMap((s) => s.risks ?? []),
    ];
    for (const r of allRisks) {
      for (const sid of r.stepIds ?? []) {
        if (!seenStepIds.has(sid)) {
          ctx.addIssue({
            code: "custom",
            path: ["risks"],
            message: `Risk "${r.id}" references unknown stepId "${sid}".`,
          });
        }
      }
    }

    if (table.declaredRoles && table.declaredRoles.length > 0) {
      const allowed = new Set(table.declaredRoles);
      for (const problem of validateStepTableRoles(table, allowed)) {
        ctx.addIssue({
          code: "custom",
          path: ["declaredRoles"],
          message: problem,
        });
      }
    }
  });

export type DthStepTable = z.infer<typeof DthStepTableSchema>;

/** Return all steps in reading order, whether declared top-level or inside groups. */
export function flattenDthSteps(table: DthStepTable): DthStepEntry[] {
  return [
    ...(table.steps ?? []),
    ...(table.groups ?? []).flatMap((g) => g.steps),
  ];
}

/** Return all risk/mitigation rows in reading order across table, groups, and steps. */
export function flattenDthRisks(table: DthStepTable): DthRiskMitigationRow[] {
  const flatSteps = flattenDthSteps(table);
  return [
    ...(table.risks ?? []),
    ...(table.groups ?? []).flatMap((g) => g.risks ?? []),
    ...flatSteps.flatMap((s) => s.risks ?? []),
  ];
}

/** Collect every unique role/persona ID referenced anywhere in the step table, in order of appearance. */
export function collectStepTableRoleIds(table: DthStepTable): string[] {
  const seen = new Set<string>();
  const add = (r: string) => seen.add(r);
  const scanInputs = (ins?: readonly DthStepInput[]) => ins?.forEach((i) => i.roleIds.forEach(add));
  const scanOutputs = (outs?: readonly DthStepOutput[]) => outs?.forEach((o) => o.roleIds.forEach(add));
  const scanRisks = (rks?: readonly DthRiskMitigationRow[]) => rks?.forEach((r) => add(r.ownerRoleId));

  scanInputs(table.inputs);
  for (const s of table.steps ?? []) {
    s.roleIds.forEach(add);
    scanInputs(s.inputs);
    scanOutputs(s.outputs);
    scanRisks(s.risks);
  }
  for (const g of table.groups ?? []) {
    scanInputs(g.inputs);
    for (const s of g.steps) {
      s.roleIds.forEach(add);
      scanInputs(s.inputs);
      scanOutputs(s.outputs);
      scanRisks(s.risks);
    }
    scanOutputs(g.outputs);
    scanRisks(g.risks);
  }
  scanOutputs(table.outputs);
  scanRisks(table.risks);
  return [...seen];
}

/** Check that every role ID referenced in the step table belongs to `declaredRoles`. */
export function validateStepTableRoles(
  table: DthStepTable,
  declaredRoles: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];
  for (const roleId of collectStepTableRoleIds(table)) {
    if (!declaredRoles.has(roleId)) {
      problems.push(
        `Step table "${table.id}" references undeclared role "${roleId}" (declared: ${[...declaredRoles].join(", ")}).`,
      );
    }
  }
  return problems;
}

export interface DthBpmnTaskStub {
  taskId: string;
  stepId: string;
  name: string;
  roleId: string;
  produces?: DakBlockKind;
}

export interface DthBpmnLaneStub {
  laneId: string;
  roleId: string;
  partitionElementRef: string;
  stepIds: string[];
  tasks: DthBpmnTaskStub[];
}

function sanitizeXmlId(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_-]/g, "_");
}

function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Derive BPMN 2.0 swimlane and task stubs mechanically from a validated DTH step table.
 *
 * Each role performing at least one step gets a swimlane (`<bpmn:lane>`) whose
 * `partitionElementRef` is resolved via `roleToPartitionRef` (or defaults to
 * `roleId` when `roleId` already starts with `pers:` / `actor:`, else `pers:${roleId.toLowerCase()}`).
 */
export function deriveBpmnLaneStubs(
  table: DthStepTable,
  roleToPartitionRef: Readonly<Record<string, string>> = {},
): DthBpmnLaneStub[] {
  const steps = flattenDthSteps(table);
  const byRole = new Map<string, DthBpmnLaneStub>();

  const partitionRefFor = (roleId: string): string => {
    if (roleToPartitionRef[roleId]) return roleToPartitionRef[roleId]!;
    if (roleId.startsWith("pers:") || roleId.startsWith("actor:")) return roleId;
    return `pers:${roleId.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
  };

  for (const step of steps) {
    for (const roleId of step.roleIds) {
      let lane = byRole.get(roleId);
      if (!lane) {
        lane = {
          laneId: `Lane_${sanitizeXmlId(roleId)}`,
          roleId,
          partitionElementRef: partitionRefFor(roleId),
          stepIds: [],
          tasks: [],
        };
        byRole.set(roleId, lane);
      }
      lane.stepIds.push(step.id);
      const taskSuffix =
        step.roleIds.length > 1 ? `_${sanitizeXmlId(roleId)}` : "";
      lane.tasks.push({
        taskId: `Task_${sanitizeXmlId(step.id)}${taskSuffix}`,
        stepId: step.id,
        name: step.title,
        roleId,
        ...(step.produces ? { produces: step.produces } : {}),
      });
    }
  }
  return [...byRole.values()];
}

/**
 * Mechanically generate a BPMN 2.0 XML process definition from a DTH step table,
 * suitable for seeding `<HB>-BP-nn` business processes (e.g. PC-BP-01, PC-BP-02, PC-BP-06..08).
 */
export function generateBpmnXmlFromStepTable(
  table: DthStepTable,
  roleToPartitionRef: Readonly<Record<string, string>> = {},
): string {
  const lanes = deriveBpmnLaneStubs(table, roleToPartitionRef);
  const steps = flattenDthSteps(table);
  const processId = sanitizeXmlId(table.processId ?? table.id);

  // Ordered task list following step order so sequenceFlows connect cleanly.
  const orderedTasks: DthBpmnTaskStub[] = [];
  for (const step of steps) {
    for (const roleId of step.roleIds) {
      const lane = lanes.find((l) => l.roleId === roleId)!;
      const task = lane.tasks.find((t) => t.stepId === step.id && t.roleId === roleId);
      if (task) orderedTasks.push(task);
    }
  }

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"',
    '  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"',
    `  id="Definitions_${processId}"`,
    '  targetNamespace="http://smart.who.int/dth/bpmn">',
    `  <bpmn:process id="Process_${processId}" name="${escapeXml(table.title)}" isExecutable="false">`,
    `    <bpmn:laneSet id="LaneSet_${processId}">`,
  ];

  for (const lane of lanes) {
    lines.push(
      `      <bpmn:lane id="${lane.laneId}" name="${escapeXml(lane.roleId)}" partitionElementRef="${escapeXml(lane.partitionElementRef)}">`,
    );
    for (const t of lane.tasks) {
      lines.push(`        <bpmn:flowNodeRef>${t.taskId}</bpmn:flowNodeRef>`);
    }
    lines.push("      </bpmn:lane>");
  }

  lines.push("    </bpmn:laneSet>");
  lines.push('    <bpmn:startEvent id="StartEvent_1" name="Start" />');

  for (const t of orderedTasks) {
    lines.push(`    <bpmn:userTask id="${t.taskId}" name="${escapeXml(t.name)}" />`);
  }

  lines.push('    <bpmn:endEvent id="EndEvent_1" name="Complete" />');

  const flowNodes = ["StartEvent_1", ...orderedTasks.map((t) => t.taskId), "EndEvent_1"];
  for (let i = 0; i < flowNodes.length - 1; i++) {
    lines.push(
      `    <bpmn:sequenceFlow id="Flow_${i + 1}" sourceRef="${flowNodes[i]}" targetRef="${flowNodes[i + 1]}" />`,
    );
  }

  lines.push("  </bpmn:process>");
  lines.push("</bpmn:definitions>");
  return `${lines.join("\n")}\n`;
}
