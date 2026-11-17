---
doc_id: hl7-2023-fhir-r5-testplan
doc_title: "FHIR R5 (5.0.0) — TestPlan resource"
section_id: s007-source-testplan-list-testplan-examples-xml
section_title: "source/testplan/list-TestPlan-examples.xml"
file: "source/testplan/list-TestPlan-examples.xml"
lines: 1-19
source_sha256: 0e810a3fa785f773
granularity: file
---
```xml
<?xml version="1.0" encoding="UTF-8"?>

<List xmlns="http://hl7.org/fhir">
  <id value="TestPlan-examples"/>
  <status value="current"/>
  <mode value="working"/>
  <entry>
    <extension url="http://hl7.org/fhir/build/StructureDefinition/description">
      <valueString value="Example of testplan"/>
    </extension>
    <extension url="http://hl7.org/fhir/build/StructureDefinition/title">
      <valueString value="testplan-example"/>
    </extension>
    <item>
      <reference value="TestPlan/example"/>
      <display value="General"/>
    </item>
  </entry>
</List>
```
