---
doc_id: hl7-2023-fhir-r5-testplan
doc_title: "FHIR R5 (5.0.0) — TestPlan resource"
section_id: s013-source-testplan-testplan-fivews-mapping-exceptio
section_title: "source/testplan/testplan-fivews-mapping-exceptions.xml"
file: "source/testplan/testplan-fivews-mapping-exceptions.xml"
lines: 1-17
source_sha256: a5d89cc049c0e55b
granularity: file
---
```xml
<mappingExceptions pattern="FiveWs" resource="TestPlan"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="../../tools/schema/mappingExceptions.xsd">
    <!--For information on the contents of this file and how to properly update it, see https://confluence.hl7.org/display/FHIR/Mapping+to+Patterns.-->
    <unmappedElement patternPath="FiveWs.what" reason="Unknown"/>
    <unmappedElement patternPath="FiveWs.author" reason="Unknown"/>
    <unmappedElement patternPath="FiveWs.actor" reason="Unknown"/>
    <unmappedElement patternPath="FiveWs.cause" reason="Unknown"/>
    <unmappedElement patternPath="FiveWs.where" reason="Unknown"/>
    <unmappedElement patternPath="FiveWs.context" reason="Unknown"/>
    <unmappedElement patternPath="FiveWs.init" reason="Unknown"/>
    <unmappedElement patternPath="FiveWs.source" reason="Unknown"/>
    <unmappedElement patternPath="FiveWs.who" reason="Unknown"/>
    <unmappedElement patternPath="FiveWs.grade" reason="Unknown"/>
    <unmappedElement patternPath="FiveWs.planned" reason="Unknown"/>
    <unmappedElement patternPath="FiveWs.done" reason="Unknown"/>
    <unmappedElement patternPath="FiveWs.subject" reason="Unknown"/>
</mappingExceptions>
```
