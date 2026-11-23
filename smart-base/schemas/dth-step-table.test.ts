/**
 * Unit tests for the shared DTH step-table schema (`DthStepTableSchema`) and
 * mechanical BPMN 2.0 swimlane derivation (smart-base#242).
 */
import { describe, expect, it } from "bun:test";
import {
  DTH_STEP_TABLE_SCHEMA,
  DthStepTableSchema,
  collectStepTableRoleIds,
  deriveBpmnLaneStubs,
  flattenDthRisks,
  flattenDthSteps,
  generateBpmnXmlFromStepTable,
  validateStepTableRoles,
} from "./dth-step-table.ts";

describe("DthStepTableSchema", () => {
  it("validatesFlatStepTable", () => {
    const parsed = DthStepTableSchema.parse({
      $schema: DTH_STEP_TABLE_SCHEMA,
      id: "pc-ch01-steps",
      title: "Chapter 01: Assess current state of product catalogue management",
      handbookId: "dth-pc",
      processId: "PC-BP-01",
      source: {
        libraryId: "9789240116191-eng",
        sectionId: "page-019",
        locator: "Chapter 01 table, PDF p.19",
      },
      declaredRoles: ["PC-R-01", "PC-R-02", "pers:data-steward"],
      inputs: [
        {
          id: "in-1",
          label: "Existing product lists and regulatory registers",
          roleIds: ["PC-R-01"],
        },
      ],
      steps: [
        {
          id: "step-1",
          number: 1,
          title: "Inventory current product master data sources",
          roleIds: ["PC-R-01", "pers:data-steward"],
          produces: "data-element",
        },
        {
          id: "step-2",
          number: 2,
          title: "Document governance and data stewardship gaps",
          roleIds: ["PC-R-02"],
          produces: "functional-requirement",
        },
      ],
      resources: [
        {
          id: "res-1",
          label: "WHO DIIG Phase 1 assessment worksheet",
          kind: "template",
        },
      ],
      outputs: [
        {
          id: "out-1",
          label: "Current-state NPC assessment report",
          roleIds: ["PC-R-02"],
          produces: "data-element",
        },
      ],
      risks: [
        {
          id: "risk-1",
          risk: "Fragmented product lists across vertical programmes",
          mitigation: "Convene cross-programme technical working group early",
          ownerRoleId: "PC-R-02",
          stepIds: ["step-1"],
        },
      ],
    });

    expect(flattenDthSteps(parsed)).toHaveLength(2);
    expect(flattenDthRisks(parsed)).toHaveLength(1);
    expect(collectStepTableRoleIds(parsed)).toEqual([
      "PC-R-01",
      "pers:data-steward",
      "PC-R-02",
    ]);
  });

  it("supportsGroupedSteps", () => {
    const parsed = DthStepTableSchema.parse({
      id: "phc-ch03-panel",
      title: "Chapter 3: Determine health content requirements",
      handbookId: "dth-phc",
      groups: [
        {
          id: "phase-3-2",
          title: "3.2 Get to know the users",
          phase: "DIIG Phase 5",
          chapter: "3.2",
          steps: [
            {
              id: "step-3-2-1",
              title: "Develop user personas",
              roleIds: ["pers:business-analyst"],
              produces: "persona",
            },
            {
              id: "step-3-2-2",
              title: "Draft user scenarios",
              roleIds: ["pers:business-analyst", "pers:clinical-lead"],
              produces: "user-scenario",
            },
          ],
        },
        {
          id: "phase-3-3",
          title: "3.3 Map out the business process",
          phase: "DIIG Phase 5",
          chapter: "3.3",
          steps: [
            {
              id: "step-3-3-1",
              title: "Model current and target workflows in BPMN",
              roleIds: ["pers:business-analyst"],
              produces: "business-process",
            },
          ],
          risks: [
            {
              id: "risk-3-3",
              risk: "Workflow omits exception paths",
              mitigation: "Validate diagram with frontline health workers",
              ownerRoleId: "pers:clinical-lead",
              stepIds: ["step-3-3-1"],
            },
          ],
        },
      ],
    });

    expect(flattenDthSteps(parsed).map((s) => s.id)).toEqual([
      "step-3-2-1",
      "step-3-2-2",
      "step-3-3-1",
    ]);
    expect(flattenDthRisks(parsed)).toHaveLength(1);
  });

  it("rejectsProseRoleIds", () => {
    expect(
      DthStepTableSchema.safeParse({
        id: "bad-role",
        title: "Invalid role prose",
        steps: [
          {
            id: "s1",
            title: "Do something",
            roleIds: ["Ministry of Health and all partners in the country"],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejectsUndeclaredRoles", () => {
    const res = DthStepTableSchema.safeParse({
      id: "undeclared-role",
      title: "Undeclared role check",
      declaredRoles: ["PC-R-01"],
      steps: [
        {
          id: "s1",
          title: "Step 1",
          roleIds: ["PC-R-01"],
        },
      ],
      risks: [
        {
          id: "r1",
          risk: "Some risk",
          mitigation: "Some mitigation",
          ownerRoleId: "PC-R-99",
        },
      ],
    });
    expect(res.success).toBe(false);
    expect(validateStepTableRoles(
      {
        id: "undeclared-role",
        title: "Undeclared role check",
        steps: [{ id: "s1", title: "Step 1", roleIds: ["PC-R-01"] }],
        risks: [{ id: "r1", risk: "r", mitigation: "m", ownerRoleId: "PC-R-99" }],
      },
      new Set(["PC-R-01"]),
    )[0]).toContain("PC-R-99");
  });

  it("derivesBpmnLanesAndXml", () => {
    const table = DthStepTableSchema.parse({
      id: "pc-bp-01",
      title: "Establish NPC Governance",
      processId: "PC-BP-01",
      steps: [
        {
          id: "step-1",
          title: "Form steering committee",
          roleIds: ["PC-R-01"],
          produces: "persona",
        },
        {
          id: "step-2",
          title: "Approve data stewardship charter",
          roleIds: ["PC-R-01", "PC-R-02"],
        },
      ],
    });

    const lanes = deriveBpmnLaneStubs(table, {
      "PC-R-01": "pers:steering-committee",
      "PC-R-02": "pers:data-steward",
    });
    expect(lanes).toHaveLength(2);
    expect(lanes[0]!.partitionElementRef).toBe("pers:steering-committee");
    expect(lanes[0]!.tasks.map((t) => t.stepId)).toEqual(["step-1", "step-2"]);
    expect(lanes[1]!.partitionElementRef).toBe("pers:data-steward");
    expect(lanes[1]!.tasks.map((t) => t.stepId)).toEqual(["step-2"]);

    const xml = generateBpmnXmlFromStepTable(table, {
      "PC-R-01": "pers:steering-committee",
      "PC-R-02": "pers:data-steward",
    });
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<bpmn:process id="Process_PC-BP-01"');
    expect(xml).toContain('partitionElementRef="pers:steering-committee"');
    expect(xml).toContain('partitionElementRef="pers:data-steward"');
    expect(xml).toContain("<bpmn:sequenceFlow");
  });
});
