---
doc_id: hl7-2023-fhir-r5-testplan
doc_title: "FHIR R5 (5.0.0) — TestPlan resource"
section_id: s004-source-testplan-bundle-testplan-search-params-xm
section_title: "source/testplan/bundle-TestPlan-search-params.xml"
file: "source/testplan/bundle-TestPlan-search-params.xml"
lines: 1-86
source_sha256: f01833efb5dc1bac
granularity: file
---
```xml
<?xml version="1.0" encoding="UTF-8"?>

<Bundle xmlns="http://hl7.org/fhir">
  <id value="TestPlan-search-params"/>
  <entry>
    <resource>
      <SearchParameter>
        <id value="TestPlan-scope"/>
        <extension url="http://hl7.org/fhir/StructureDefinition/structuredefinition-standards-status">
          <valueCode value="draft"/>
        </extension>
        <extension url="http://hl7.org/fhir/build/StructureDefinition/path">
          <valueString value="TestPlan.scope"/>
        </extension>
        <url value="http://hl7.org/fhir/build/SearchParameter/TestPlan-scope"/>
        <description value="The scope that is to be tested with this test plan"/>
        <code value="scope"/>
        <type value="reference"/>
        <expression value="TestPlan.scope"/>
        <processingMode value="normal"/>
      </SearchParameter>
    </resource>
  </entry>
  
  <entry>
    <resource>
      <SearchParameter>
        <id value="TestPlan-identifier"/>
        <extension url="http://hl7.org/fhir/StructureDefinition/structuredefinition-standards-status">
          <valueCode value="draft"/>
        </extension>
        <extension url="http://hl7.org/fhir/build/StructureDefinition/path">
          <valueString value="TestPlan.identifier"/>
        </extension>
        <url value="http://hl7.org/fhir/build/SearchParameter/TestPlan-identifier"/>
        <description value="An identifier for the test plan"/>
        <code value="identifier"/>
        <type value="token"/>
        <expression value="TestPlan.identifier"/>
        <processingMode value="normal"/>
      </SearchParameter>
    </resource>
  </entry>
  <entry>
    <resource>
      <SearchParameter>
        <id value="TestPlan-status"/>
        <extension url="http://hl7.org/fhir/StructureDefinition/structuredefinition-standards-status">
          <valueCode value="draft"/>
        </extension>
        <extension url="http://hl7.org/fhir/build/StructureDefinition/path">
          <valueString value="{{name}}.status"/>
        </extension>
        <url value="http://hl7.org/fhir/build/SearchParameter/TestPlan-status"/>
        <name value="status"/>
        <status value="active"/>
        <description value="The current status of the test plan"/>
        <code value="status"/>
        <base value="TestPlan"/>
        <type value="token"/>
        <expression value="TestPlan.status"/>
        <processingMode value="normal"/>
      </SearchParameter>
    </resource>
  </entry>
  <entry>
    <resource>
      <SearchParameter>
        <id value="TestPlan-url"/>
        <extension url="http://hl7.org/fhir/StructureDefinition/structuredefinition-standards-status">
          <valueCode value="normative"/>
        </extension>
        <extension url="http://hl7.org/fhir/build/StructureDefinition/path">
          <valueString value="{{name}}.url"/>
        </extension>
        <url value="http://hl7.org/fhir/build/SearchParameter/TestPlan-url"/>
        <description value="The uri that identifies the test plan"/>
        <code value="url"/>
        <type value="uri"/>
        <expression value="TestPlan.url"/>
        <processingMode value="normal"/>
      </SearchParameter>
    </resource>
  </entry>

</Bundle>
```
