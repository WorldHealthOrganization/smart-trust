---
doc_id: hl7-2023-fhir-r5-testplan
doc_title: "FHIR R5 (5.0.0) — TestPlan resource"
section_id: s014-source-testplan-valueset-testplan-counttype-xml
section_title: "source/testplan/valueset-testplan-counttype.xml"
file: "source/testplan/valueset-testplan-counttype.xml"
lines: 1-44
source_sha256: cf9cacba19ee33ab
granularity: file
---
```xml
<?xml version="1.0" encoding="UTF-8"?><ValueSet xmlns="http://hl7.org/fhir">
  <id value="testplan-counttype"/>
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
  <url value="http://hl7.org/fhir/ValueSet/testplan-counttype"/>
  <identifier>
    <system value="urn:ietf:rfc:3986"/>
    <value value="urn:oid:2.16.840.1.113883.4.642.3.3032"/>
  </identifier>
  <version value="5.0.0"/>
  <name value="InventoryCountType"/>
  <title value="InventoryCountType"/>
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
  <description value="The type of count."/>
  <immutable value="true"/>
  <compose>
    <include>
      <system value="http://hl7.org/fhir/testplan-counttype"/>
    </include>
  </compose>
</ValueSet>
```
