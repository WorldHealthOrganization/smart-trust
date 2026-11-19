import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { parseArchimate } from "../schemas/archimate.ts";
import {
  DataModelSchema,
  SequenceSetSchema,
  dataModelDot,
  dataModelMarkdown,
  dataModelMermaid,
  dataModelOf,
  dataModelPuml,
  extractDocAttributes,
  parseFshLogicalModels,
  parseRelationshipCardinality,
  sequenceMermaid,
  sequencePuml,
  sequencesFromBpmn,
  sequencesMarkdown,
  sequencesMermaid,
  sequencesOf,
  sequencesPuml,
} from "../schemas/diagrams.ts";
import { diagramsFor, formatDiagrams, reportDiagrams } from "./archimate-diagrams.ts";
import { pageDataOf, pagesFor, sitePathOf, type Written } from "./gen-archimate-pages.ts";

const DATA_AND_SEQ_XML = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="RA_D5" id="id-model" version="5.0.0">
  <folder name="Business" id="id-fb" type="business">
    <element xsi:type="archimate:BusinessObject" name="Product Master Data" id="id-pmd"/>
    <element xsi:type="archimate:BusinessObject" name="Product Classification" id="id-pc"/>
    <element xsi:type="archimate:BusinessObject" name="Generic Product" id="id-gp"/>
    <element xsi:type="archimate:BusinessObject" name="Trade Item" id="id-ti"/>
    <element xsi:type="archimate:BusinessObject" name="Regulated Trade Item" id="id-rti"/>
    <element xsi:type="archimate:BusinessObject" name="Business Object" id="id-placeholder-bo"/>
    <element xsi:type="archimate:BusinessRole" name="Data Owner" id="id-data-owner"/>
    <element xsi:type="archimate:BusinessRole" name="Test Operator" id="id-operator"/>
    <element xsi:type="archimate:BusinessRole" name="Individual" id="id-individual"/>
    <element xsi:type="archimate:BusinessProcess" name="Create and submit document" id="id-proc-submit"/>
  </folder>
  <folder name="Application" id="id-fa" type="application">
    <element xsi:type="archimate:DataObject" name="CDE-HWR: Core Data Elements for the Health Workforce Registry" id="id-cde-hwr">
      <documentation>CDE-HWR: the Core Data Elements of the Health Workforce Registry:
1. Named demographics (name, sex, date of birth).
2. Identifier and index: the national unique health worker identifier.
3. Licensure: licence number, issuing body, status, validity dates.
4. Registration: professional registration and cadre.
5. Educational credential: qualification, awarding institution, year.
6. Organizational affiliation: employer or other affiliating organization.
7. Facility association: the facility or facilities where the worker practises.</documentation>
      <property key="logical-model" value="http://smart.who.int/ra/StructureDefinition/CDE-HWR"/>
    </element>
    <element xsi:type="archimate:DataObject" name="Health Worker" id="id-hw">
      <property key="logical-model" value="HealthWorkerModel"/>
    </element>
    <element xsi:type="archimate:DataObject" name="Facility" id="id-facility">
      <property key="logical-model" value="FacilityModel"/>
    </element>
    <element xsi:type="archimate:DataObject" name="NHWA Dataset" id="id-nhwa"/>
    <element xsi:type="archimate:DataObject" name="Traceability Event" id="id-trace-event"/>
    <element xsi:type="archimate:DataObject" name="Data Object (MS)" id="id-placeholder-do"/>
    <element xsi:type="archimate:ApplicationComponent" name="National Product Catalogue" id="id-npc"/>
    <element xsi:type="archimate:ApplicationComponent" name="Document Source" id="id-doc-source"/>
    <element xsi:type="archimate:ApplicationComponent" name="Document Repository" id="id-doc-repo"/>
    <element xsi:type="archimate:ApplicationComponent" name="System Under Test" id="id-sut"/>
    <element xsi:type="archimate:ApplicationInteraction" name="Provide and Register Document Set [ITI-41]" id="id-iti41"/>
    <element xsi:type="archimate:ApplicationInteraction" name="Application Interaction" id="id-placeholder-ai"/>
    <element xsi:type="archimate:ApplicationService" name="Register Document Set" id="id-reg-svc"/>
    <element xsi:type="archimate:ApplicationComponent" name="Warehouse Management System" id="id-wms"/>
    <element xsi:type="archimate:ApplicationComponent" name="Interoperability Component" id="id-interop"/>
    <element xsi:type="archimate:ApplicationComponent" name="Data Warehouse" id="id-dw"/>
    <element xsi:type="archimate:ApplicationService" name="Product Verification" id="id-pv"/>
  </folder>
  <folder name="Motivation" id="id-fm" type="motivation">
    <element xsi:type="archimate:Goal" name="Bad Goal Tag" id="id-bad-goal">
      <property key="logical-model" value="NotADataObject"/>
    </element>
  </folder>
  <folder name="Relations" id="id-fr" type="relations">
    <element xsi:type="archimate:CompositionRelationship" id="id-r-pmd-pc" source="id-pmd" target="id-pc"/>
    <element xsi:type="archimate:CompositionRelationship" id="id-r-pmd-gp" source="id-pmd" target="id-gp"/>
    <element xsi:type="archimate:CompositionRelationship" id="id-r-pmd-ti" source="id-pmd" target="id-ti"/>
    <element xsi:type="archimate:CompositionRelationship" id="id-r-pmd-rti" source="id-pmd" target="id-rti"/>
    <element xsi:type="archimate:AssociationRelationship" id="id-r-gp-pc" name="classification 0..*" source="id-gp" target="id-pc"/>
    <element xsi:type="archimate:AssociationRelationship" id="id-r-ti-gp" name="associatedGenericProduct 0..*" source="id-ti" target="id-gp"/>
    <element xsi:type="archimate:AssociationRelationship" id="id-r-ti-ti" name="contains 0..* (packaging hierarchy)" source="id-ti" target="id-ti"/>
    <element xsi:type="archimate:AssociationRelationship" id="id-r-rti-ti" name="authorisedTradeItem 1..1" source="id-rti" target="id-ti"/>
    <element xsi:type="archimate:AccessRelationship" id="id-r-npc-pmd" source="id-npc" target="id-pmd" accessType="3"/>
    <element xsi:type="archimate:AssociationRelationship" id="id-r-owner-pmd" name="approves changes" source="id-data-owner" target="id-pmd"/>
    <element xsi:type="archimate:AggregationRelationship" id="id-r-nhwa-cde" name="builds on" source="id-nhwa" target="id-cde-hwr"/>
    <element xsi:type="archimate:AssociationRelationship" id="id-r-cde-hw" name="core of" source="id-cde-hwr" target="id-hw"/>
    <element xsi:type="archimate:AssociationRelationship" id="id-r-cde-fac" name="facility association" source="id-cde-hwr" target="id-facility"/>
    <element xsi:type="archimate:SpecializationRelationship" id="id-r-placeholder" source="id-placeholder-do" target="id-placeholder-bo"/>
    <element xsi:type="archimate:AssignmentRelationship" id="id-r-src-iti41" source="id-doc-source" target="id-iti41"/>
    <element xsi:type="archimate:AssignmentRelationship" id="id-r-repo-iti41" source="id-doc-repo" target="id-iti41"/>
    <element xsi:type="archimate:RealizationRelationship" id="id-r-repo-svc" source="id-doc-repo" target="id-reg-svc"/>
    <element xsi:type="archimate:ServingRelationship" id="id-r-svc-src" source="id-reg-svc" target="id-doc-source"/>
    <element xsi:type="archimate:RealizationRelationship" id="id-r-sut-src" source="id-sut" target="id-doc-source"/>
    <element xsi:type="archimate:AssignmentRelationship" id="id-r-op-proc" source="id-operator" target="id-proc-submit"/>
    <element xsi:type="archimate:TriggeringRelationship" id="id-r-proc-iti41" source="id-proc-submit" target="id-iti41"/>
    <element xsi:type="archimate:FlowRelationship" id="id-r-wms-interop" source="id-wms" target="id-interop"/>
    <element xsi:type="archimate:FlowRelationship" id="id-r-interop-dw" source="id-interop" target="id-dw"/>
    <element xsi:type="archimate:AccessRelationship" id="id-r-dw-trace" source="id-dw" target="id-trace-event" accessType="3"/>
    <element xsi:type="archimate:AccessRelationship" id="id-r-pv-trace" source="id-pv" target="id-trace-event" accessType="1"/>
    <element xsi:type="archimate:ServingRelationship" id="id-r-pv-ind" source="id-pv" target="id-individual"/>
  </folder>
  <folder name="Views" id="id-fv" type="diagrams">
    <element xsi:type="archimate:ArchimateDiagramModel" name="ITI-41 Transaction View" id="id-v-iti41">
      <child xsi:type="archimate:DiagramObject" id="id-do-op" archimateElement="id-operator"><bounds x="100" y="100" width="120" height="55"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c-op" source="id-do-op" target="id-do-proc" archimateRelationship="id-r-op-proc"/>
      </child>
      <child xsi:type="archimate:DiagramObject" id="id-do-proc" archimateElement="id-proc-submit"><bounds x="240" y="100" width="120" height="55"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c-proc" source="id-do-proc" target="id-do-iti41" archimateRelationship="id-r-proc-iti41"/>
      </child>
      <child xsi:type="archimate:DiagramObject" id="id-do-src" archimateElement="id-doc-source"><bounds x="400" y="100" width="120" height="55"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c-src" source="id-do-src" target="id-do-iti41" archimateRelationship="id-r-src-iti41"/>
      </child>
      <child xsi:type="archimate:DiagramObject" id="id-do-iti41" archimateElement="id-iti41"><bounds x="550" y="100" width="120" height="55"/></child>
      <child xsi:type="archimate:DiagramObject" id="id-do-repo" archimateElement="id-doc-repo"><bounds x="700" y="100" width="120" height="55"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c-repo" source="id-do-repo" target="id-do-iti41" archimateRelationship="id-r-repo-iti41"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c-repo-svc" source="id-do-repo" target="id-do-svc" archimateRelationship="id-r-repo-svc"/>
      </child>
      <child xsi:type="archimate:DiagramObject" id="id-do-svc" archimateElement="id-reg-svc"><bounds x="550" y="200" width="120" height="55"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c-svc-src" source="id-do-svc" target="id-do-src" archimateRelationship="id-r-svc-src"/>
      </child>
    </element>
    <element xsi:type="archimate:ArchimateDiagramModel" name="Track and Trace Flow View" id="id-v-tt">
      <child xsi:type="archimate:DiagramObject" id="id-do-wms" archimateElement="id-wms"><bounds x="50" y="100" width="120" height="55"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c-wms" source="id-do-wms" target="id-do-interop" archimateRelationship="id-r-wms-interop"/>
      </child>
      <child xsi:type="archimate:DiagramObject" id="id-do-interop" archimateElement="id-interop"><bounds x="220" y="100" width="120" height="55"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c-interop" source="id-do-interop" target="id-do-dw" archimateRelationship="id-r-interop-dw"/>
      </child>
      <child xsi:type="archimate:DiagramObject" id="id-do-dw" archimateElement="id-dw"><bounds x="400" y="100" width="120" height="55"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c-dw" source="id-do-dw" target="id-do-te" archimateRelationship="id-r-dw-trace"/>
      </child>
      <child xsi:type="archimate:DiagramObject" id="id-do-te" archimateElement="id-trace-event"><bounds x="580" y="100" width="120" height="55"/></child>
      <child xsi:type="archimate:DiagramObject" id="id-do-pv" archimateElement="id-pv"><bounds x="580" y="200" width="120" height="55"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c-pv-te" source="id-do-pv" target="id-do-te" archimateRelationship="id-r-pv-trace"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c-pv-ind" source="id-do-pv" target="id-do-ind" archimateRelationship="id-r-pv-ind"/>
      </child>
      <child xsi:type="archimate:DiagramObject" id="id-do-ind" archimateElement="id-individual"><bounds x="760" y="200" width="120" height="55"/></child>
    </element>
  </folder>
</archimate:model>`;

const FSH_MODELS = `
Logical: HealthWorkerModel
Id: health-worker-model
Title: "Health Worker Logical Model"
Description: "Core fields for a health worker"
* identifier 1..* Identifier "National unique health worker identifier"
* name 1..1 HumanName "Worker name"
* primaryFacility 0..1 Reference(FacilityModel) "Primary facility"

Logical: FacilityModel
Id: facility-model
Title: "Facility Logical Model"
* identifier 1..1 Identifier "Facility Registry identifier"
* name 1..1 string "Facility name"
`;

const BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Defs_HWR">
  <bpmn:collaboration id="Collab_HWR" name="Credential Verification Collaboration">
    <bpmn:participant id="Pool_HWR" name="Health Workforce Registry" processRef="Proc_HWR"/>
    <bpmn:participant id="Pool_Council" name="Professional Council"/>
    <bpmn:messageFlow id="MF_VerifyReq" name="Verify licence request" sourceRef="Task_CheckCred" targetRef="Pool_Council"/>
    <bpmn:messageFlow id="MF_VerifyResp" name="Licence status response" sourceRef="Pool_Council" targetRef="Task_RecordCred"/>
  </bpmn:collaboration>
  <bpmn:process id="Proc_HWR" name="Health Worker Registration and Verification" isExecutable="false">
    <bpmn:laneSet id="LS_1">
      <bpmn:lane id="Lane_Operator" name="Test Operator">
        <bpmn:flowNodeRef>Start_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Submit</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Fix</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_Registry" name="Document Repository">
        <bpmn:flowNodeRef>Task_CheckCred</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>GW_Valid</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_RecordCred</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>End_1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="Start_1" name="Application received"/>
    <bpmn:userTask id="Task_Submit" name="Submit credential packet"/>
    <bpmn:serviceTask id="Task_CheckCred" name="Check credentials"/>
    <bpmn:exclusiveGateway id="GW_Valid" name="Credentials valid?"/>
    <bpmn:userTask id="Task_Fix" name="Request correction"/>
    <bpmn:serviceTask id="Task_RecordCred" name="Record verified worker"/>
    <bpmn:endEvent id="End_1" name="Worker registered"/>
    <bpmn:sequenceFlow id="SF_1" sourceRef="Start_1" targetRef="Task_Submit"/>
    <bpmn:sequenceFlow id="SF_2" sourceRef="Task_Submit" targetRef="Task_CheckCred"/>
    <bpmn:sequenceFlow id="SF_3" sourceRef="Task_CheckCred" targetRef="GW_Valid"/>
    <bpmn:sequenceFlow id="SF_4" name="no" sourceRef="GW_Valid" targetRef="Task_Fix"/>
    <bpmn:sequenceFlow id="SF_5" name="yes" sourceRef="GW_Valid" targetRef="Task_RecordCred"/>
    <bpmn:sequenceFlow id="SF_6" sourceRef="Task_Fix" targetRef="Task_CheckCred"/>
    <bpmn:sequenceFlow id="SF_7" sourceRef="Task_RecordCred" targetRef="End_1"/>
  </bpmn:process>
</bpmn:definitions>`;

describe("derived data class diagrams (D5)", () => {
  const model = parseArchimate(DATA_AND_SEQ_XML);
  const fshLogical = parseFshLogicalModels(FSH_MODELS);
  const dm = dataModelOf(model, "0.3.0-draft.1", { logicalModels: fshLogical });

  it("validates against DataModelSchema and reports invalid logical-model tags", () => {
    expect(DataModelSchema.safeParse(dm).success).toBe(true);
    expect(dm.problems).toEqual([
      `id-bad-goal "Bad Goal Tag": a Goal cannot carry logical-model (expected DataObject, BusinessObject, Representation, Contract or Artifact)`,
    ]);
    // Placeholders ("Business Object", "Data Object (MS)") are excluded.
    expect(dm.classes.map((c) => c.name)).not.toContain("Business Object");
    expect(dm.classes.map((c) => c.name)).not.toContain("Data Object (MS)");
  });

  it("extracts attributes from FSH Logical models and from numbered documentation items", () => {
    expect(fshLogical.map((m) => [m.name, m.id, m.fields.length])).toEqual([
      ["HealthWorkerModel", "health-worker-model", 3],
      ["FacilityModel", "facility-model", 2],
    ]);
    const hw = dm.classes.find((c) => c.id === "id-hw")!;
    expect(hw.logicalModel).toBe("HealthWorkerModel");
    expect(hw.attributes).toEqual([
      { name: "identifier", cardinality: "1..*", type: "Identifier", description: "National unique health worker identifier", source: "logical-model" },
      { name: "name", cardinality: "1..1", type: "HumanName", description: "Worker name", source: "logical-model" },
      { name: "primaryFacility", cardinality: "0..1", type: "Reference(FacilityModel)", description: "Primary facility", source: "logical-model" },
    ]);

    const cde = dm.classes.find((c) => c.id === "id-cde-hwr")!;
    expect(cde.logicalModel).toBe("http://smart.who.int/ra/StructureDefinition/CDE-HWR");
    expect(cde.attributes.map((a) => a.name)).toEqual([
      "Named demographics",
      "Identifier and index",
      "Licensure",
      "Registration",
      "Educational credential",
      "Organizational affiliation",
      "Facility association",
    ]);
    expect(extractDocAttributes("Not a numbered list.")).toEqual([]);
  });

  it("captures Product Master Data compositions, association cardinalities, FSH references, and accessors", () => {
    expect(parseRelationshipCardinality("classification 0..*")).toEqual({ role: "classification", cardinality: "0..*" });
    expect(parseRelationshipCardinality("contains 0..* (packaging hierarchy)")).toEqual({
      role: "contains (packaging hierarchy)",
      cardinality: "0..*",
    });
    expect(parseRelationshipCardinality("authorisedTradeItem 1..1")).toEqual({
      role: "authorisedTradeItem",
      cardinality: "1..1",
    });

    // Product Master Data is composed of its four parts.
    expect(dm.relationships.filter((r) => r.source === "id-pmd" && r.type === "Composition").map((r) => r.target).sort()).toEqual(["id-gp", "id-pc", "id-rti", "id-ti"]);

    const pmd = dm.classes.find((c) => c.id === "id-pmd")!;
    expect(pmd.accessedBy.map((a) => [a.name, a.kind, a.label])).toEqual([
      ["National Product Catalogue", "readwrite", undefined],
      ["Data Owner", "association", "approves changes"],
    ]);

    // Includes both ArchiMate relationships and the FSH Reference(FacilityModel) relationship.
    const fshRel = dm.relationships.find((r) => r.source === "id-hw" && r.target === "id-facility");
    expect(fshRel).toMatchObject({ type: "Association", role: "primaryFacility", cardinality: "0..1" });
  });

  it("renders PlantUML, Mermaid, Graphviz DOT and Markdown class diagrams", () => {
    const puml = dataModelPuml(dm);
    expect(puml.startsWith("@startuml\n")).toBe(true);
    expect(puml).toContain(`class "CDE-HWR: Core Data Elements for the Health Workforce Registry" as id_cde_hwr <<DataObject>> <<http://smart.who.int/ra/StructureDefinition/CDE-HWR>>`);
    expect(puml).toContain("  +Named demographics");
    expect(puml).toContain("  +identifier : Identifier [1..*]");
    expect(puml).toContain(`id_pmd *-- id_ti : composed of`);
    expect(puml).toContain(`id_ti --> "0..*" id_ti : contains (packaging hierarchy)`);
    expect(puml).toContain(`id_rti --> "1..1" id_ti : authorisedTradeItem`);

    const mmd = dataModelMermaid(dm);
    expect(mmd.startsWith("classDiagram\n")).toBe(true);
    expect(mmd).toContain(`id_gp --> "0..*" id_pc : classification`);

    const dot = dataModelDot(dm, {
      href: { element: (id) => `element/${id}/`, relationship: (id) => `relationship/${id}/` },
    });
    expect(dot).toContain(`URL="element/id-pmd/"`);
    expect(dot).toContain(`URL="relationship/id-r-gp-pc/"`);

    const md = dataModelMarkdown(dm);
    expect(md).toContain("## Data Class Diagram (RA_D5)");
    expect(md).toContain("```mermaid\nclassDiagram");
    expect(md).toContain("| **Product Master Data** | Business Object |");
  });
});

describe("derived sequence diagrams (D5)", () => {
  const model = parseArchimate(DATA_AND_SEQ_XML);
  const seqSet = sequencesOf(model, "0.3.0-draft.1", {
    bpmn: [{ id: "hwr-cred", title: "Health Worker Credential Verification", xml: BPMN_XML }],
  });

  it("validates against SequenceSetSchema and derives interaction, view-flow, and BPMN sequences", () => {
    expect(SequenceSetSchema.safeParse(seqSet).success).toBe(true);
    expect(seqSet.sequences.map((s) => [s.id, s.source])).toEqual([
      ["id-v-iti41", "interaction"],
      ["id-v-tt", "view"],
      ["hwr-cred", "bpmn"],
    ]);
  });

  it("orders ApplicationInteraction participants and messages from trigger to initiator to responder and service reply", () => {
    const iti41 = seqSet.sequences.find((s) => s.id === "id-v-iti41")!;
    expect(iti41.participants.map((p) => p.name)).toEqual([
      "Test Operator",
      "Create and submit document",
      "Document Source",
      "Document Repository",
    ]);
    expect(iti41.messages.map((m) => [m.from, m.to, m.label, m.kind])).toEqual([
      ["id-operator", "id-proc-submit", "Create and submit document", "triggering"],
      ["id-proc-submit", "id-doc-source", "triggers Provide and Register Document Set [ITI-41]", "triggering"],
      ["id-doc-source", "id-doc-repo", "Provide and Register Document Set [ITI-41]", "interaction"],
      ["id-doc-repo", "id-doc-source", "Register Document Set", "serving"],
    ]);
  });

  it("includes Flow, DataObject Access, and Actor Serving steps on a dynamic flow view", () => {
    const tt = seqSet.sequences.find((s) => s.id === "id-v-tt")!;
    expect(tt.messages.map((m) => [m.from, m.to, m.label, m.kind])).toEqual([
      ["id-wms", "id-interop", "flows to Interoperability Component", "flow"],
      ["id-interop", "id-dw", "flows to Data Warehouse", "flow"],
      ["id-dw", "id-trace-event", "reads/writes Traceability Event", "access"],
      ["id-pv", "id-trace-event", "reads Traceability Event", "access"],
      ["id-pv", "id-individual", "serves Individual", "serving"],
    ]);
  });

  it("derives cross-lane sequenceFlow handoffs (including gateway branches) and collaboration messageFlows from BPMN, linked to ArchiMate elements", () => {
    const bpmnSeq = seqSet.sequences.find((s) => s.id === "hwr-cred")!;
    // Lanes "Test Operator" and "Document Repository" match the ArchiMate elements by name.
    expect(bpmnSeq.participants).toEqual([
      { id: "Lane_Operator", name: "Test Operator", type: "BusinessRole", elementId: "id-operator" },
      { id: "Lane_Registry", name: "Document Repository", type: "ApplicationComponent", elementId: "id-doc-repo" },
      { id: "Pool_Council", name: "Professional Council", type: "ApplicationComponent" },
    ]);
    expect(bpmnSeq.messages.map((m) => [m.from, m.to, m.label, m.kind])).toEqual([
      ["Lane_Operator", "Lane_Registry", "Submit credential packet → Check credentials", "bpmn-flow"],
      ["Lane_Registry", "Lane_Operator", "Check credentials [no] → Request correction", "bpmn-flow"],
      ["Lane_Operator", "Lane_Registry", "Request correction → Check credentials", "bpmn-flow"],
      ["Lane_Registry", "Pool_Council", "Verify licence request", "bpmn-message"],
      ["Pool_Council", "Lane_Registry", "Licence status response", "bpmn-message"],
    ]);
    expect(sequencesFromBpmn(`<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"/>`)).toEqual([]);
  });

  it("renders PlantUML, Mermaid, and Markdown sequence diagrams", () => {
    const iti41 = seqSet.sequences[0]!;
    const puml = sequencePuml(iti41);
    expect(puml.startsWith("@startuml\n")).toBe(true);
    expect(puml).toContain(`actor "Test Operator" as id_operator <<BusinessRole>>`);
    expect(puml).toContain(`id_doc_source -> id_doc_repo : Provide and Register Document Set [ITI-41]`);
    expect(puml).toContain(`id_doc_repo --> id_doc_source : Register Document Set`);
    expect(sequencesPuml(seqSet)).toContain("title Track and Trace Flow View");

    const mmd = sequenceMermaid(iti41);
    expect(mmd.startsWith("sequenceDiagram\n")).toBe(true);
    expect(mmd).toContain(`id_doc_source->>id_doc_repo: Provide and Register Document Set [ITI-41]`);
    expect(mmd).toContain(`id_doc_repo-->>id_doc_source: Register Document Set`);
    expect(sequencesMermaid(seqSet)).toContain("Verify licence request");

    const md = sequencesMarkdown(seqSet);
    expect(md).toContain("## Sequence Diagrams (RA_D5)");
    expect(md).toContain("### ITI-41 Transaction View");
    expect(md).toContain("```mermaid\nsequenceDiagram");
  });
});

describe("integration with archimate-pages and archimate-diagrams", () => {
  const declaration = {
    name: "tiny",
    iriBase: "https://example.org/tiny/",
    directories: [{ id: "archimate", path: "archimate/", graphTypologies: ["archimate"] }],
    visualisers: [{ id: "archimate", renderedBy: "archimate-pages", covers: ["archimate"] }],
  };
  const config = {
    $schema: "cat-archimate-config/v1",
    directory: "archimate",
    models: [{ id: "1.0.0", file: "1.0.0/model.archimate" }],
  };

  it("writes data-model and sequences artefacts and sections onto the metamodel page, and every link resolves in-graph and in-site", () => {
    const root = mkdtempSync(join(tmpdir(), "archimate-d5-"));
    try {
      writeFileSync(join(root, "tiny.json"), JSON.stringify(declaration));
      mkdirSync(join(root, "archimate", "1.0.0"), { recursive: true });
      writeFileSync(join(root, "archimate", "1.0.0", "model.archimate"), DATA_AND_SEQ_XML);
      writeFileSync(join(root, "archimate", "cat-archimate.config.json"), JSON.stringify(config));
      mkdirSync(join(root, "input", "fsh", "models"), { recursive: true });
      writeFileSync(join(root, "input", "fsh", "models", "models.fsh"), FSH_MODELS);
      mkdirSync(join(root, "processes"), { recursive: true });
      writeFileSync(join(root, "processes", "hwr.bpmn"), BPMN_XML);

      const [d] = diagramsFor(root, { bpmnPath: "processes" });
      expect(d!.dataModel.classes.length).toBe(9);
      expect(d!.sequences.sequences.length).toBe(3);
      expect(reportDiagrams(d!)).toContain("data model: 9 class(es)");
      expect(formatDiagrams(d!, "data", "puml")).toContain("@startuml");
      expect(formatDiagrams(d!, "sequence", "mmd")).toContain("sequenceDiagram");

      const site = pagesFor(root, { site: true, drawDot: () => "<svg xmlns='http://www.w3.org/2000/svg'/>" });
      const paths = new Set(site.files.map((f) => f.path));
      expect(paths.has("1.0.0/data-model.json")).toBe(true);
      expect(paths.has("1.0.0/data-model.puml")).toBe(true);
      expect(paths.has("1.0.0/data-model.mmd")).toBe(true);
      expect(paths.has("1.0.0/data-model.dot")).toBe(true);
      expect(paths.has("1.0.0/data-model.svg")).toBe(true);
      expect(paths.has("1.0.0/sequences.json")).toBe(true);
      expect(paths.has("1.0.0/sequences.puml")).toBe(true);
      expect(paths.has("1.0.0/sequences.mmd")).toBe(true);

      const mmPage = site.files.find((f) => f.path === "1.0.0/metamodel/index.html")!;
      expect(mmPage.content).toContain("<h2>Data class diagram</h2>");
      expect(mmPage.content).toContain("<h2>Sequence diagrams</h2>");

      // Every link on every page resolves to a written file or page directory, in a site and in the graph.
      const linksResolve = (run: ReturnType<typeof pagesFor>) => {
        const at = (f: Written) => sitePathOf(run, f);
        const written = new Set(run.files.map(at));
        const resolves = (from: string, ref: string) => {
          const target = posix.normalize(posix.join(posix.dirname(from), ref));
          return written.has(target) || written.has(posix.join(target, "index.html"));
        };
        let checked = 0;
        for (const f of run.files.filter((x) => x.page)) {
          const refs = [...f.content.matchAll(/(?:href|src|data)="([^"#:]+)"/g)].map((m) => m[1]!);
          const cfg = f.path !== "index.html" ? pageDataOf(f.content) as Record<string, unknown> : {};
          for (const k of ["node", "model", "svg", "metamodel"]) if (typeof cfg[k] === "string") refs.push(cfg[k] as string);
          for (const r of refs) expect({ from: at(f), ref: r, ok: resolves(at(f), r) }).toEqual({ from: at(f), ref: r, ok: true });
          checked += refs.length;
        }
        return checked;
      };
      expect(linksResolve(site)).toBeGreaterThan(0);
      const inGraph = pagesFor(root, { drawDot: () => "<svg xmlns='http://www.w3.org/2000/svg'/>" });
      expect(inGraph.pageRoot).toBe(inGraph.graphPath);
      expect(inGraph.files.find((f) => f.path === "1.0.0/metamodel/index.html")!.content).toContain("<h2>Data class diagram</h2>");
      expect(linksResolve(inGraph)).toBeGreaterThan(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
