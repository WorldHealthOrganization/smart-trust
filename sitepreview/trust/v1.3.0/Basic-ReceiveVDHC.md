# Resource ReceiveVDHC



## Resource Content

```json
{
  "resourceType" : "Basic",
  "id" : "ReceiveVDHC",
  "meta" : {
    "profile" : [
      "http://smart.who.int/base/StructureDefinition/SGRequirements"
    ]
  },
  "extension" : [
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.url",
      "valueUri" : "http://smart.who.int/trust/Requirements/ReceiveVDHC"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.version",
      "valueString" : "1.3.0"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.name",
      "valueString" : "Receive VDHC"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.title",
      "valueString" : "Receive Verifiable Digital Health Certificate"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.status",
      "valueCode" : "active"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.experimental",
      "valueBoolean" : true
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.date",
      "valueDateTime" : "2025-10-27T08:33:32+00:00"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.publisher",
      "valueString" : "WHO"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.contact",
      "valueContactDetail" : {
        "name" : "WHO",
        "telecom" : [
          {
            "system" : "url",
            "value" : "http://who.int"
          }
        ]
      }
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.description",
      "valueMarkdown" : "Receive a Verifiable Digital Health Certificate from an Issuer"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.jurisdiction",
      "valueCodeableConcept" : {
        "coding" : [
          {
            "system" : "http://unstats.un.org/unsd/methods/m49/m49.htm",
            "code" : "001"
          }
        ]
      }
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.actor",
      "valueCanonical" : "http://smart.who.int/trust/ActorDefinition/Holder"
    }
  ],
  "code" : {
    "coding" : [
      {
        "system" : "http://hl7.org/fhir/fhir-types",
        "code" : "Requirements"
      }
    ]
  }
}

```
