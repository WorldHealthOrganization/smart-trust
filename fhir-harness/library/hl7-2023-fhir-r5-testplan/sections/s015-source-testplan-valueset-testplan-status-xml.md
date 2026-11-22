---
doc_id: hl7-2023-fhir-r5-testplan
doc_title: "FHIR R5 (5.0.0) — TestPlan resource"
section_id: s015-source-testplan-valueset-testplan-status-xml
section_title: "source/testplan/valueset-testplan-status.xml"
file: "source/testplan/valueset-testplan-status.xml"
lines: 1-40
source_sha256: 9b8fcafd1e7cc4d3
granularity: file
---
```xml
<?xml version="1.0" encoding="UTF-8"?><ValueSet xmlns="http://hl7.org/fhir">
  <id value="testplan-status"/>
  <meta>
    <profile value="http://hl7.org/fhir/StructureDefinition/shareablevalueset"/>
  </meta>
  <extension url="http://hl7.org/fhir/StructureDefinition/structuredefinition-wg">
    <valueCode value="oo"/>
  </extension>
  <extension url="http://hl7.org/fhir/StructureDefinition/structuredefinition-standards-status">
    <valueCode value="trial-use"/>
  </extension>
  <extension url="http://hl7.org/fhir/StructureDefinition/structuredefinition-fmm">
    <valueInteger value="0"/>
  </extension>
  <url value="http://hl7.org/fhir/ValueSet/testplan-status"/>
  <version value="5.0.0"/>
  <name value="TestPlanStatus"/>
  <title value="TestPlanStatus"/>
  <status value="draft"/>
  <experimental value="false"/>
  <date value="2020-12-28T16:55:11+11:00"/>
  <publisher value="HL7 (FHIR Project)"/>
  <contact>
    <telecom>
      <system value="url"/>
      <value value="http://hl7.org/fhir"/>
    </telecom>
    <telecom>
      <system value="email"/>
      <value value="fhir@lists.hl7.org"/>
    </telecom>
  </contact>
  <description value="The status of the TestPlan."/>
  <immutable value="true"/>
  <compose>
    <include>
      <system value="http://hl7.org/fhir/testplan-status"/>
    </include>
  </compose>
</ValueSet>
```
