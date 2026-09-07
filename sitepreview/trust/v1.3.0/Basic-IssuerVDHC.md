# Resource IssuerVDHC



## Resource Content

```json
{
  "resourceType" : "Basic",
  "id" : "IssuerVDHC",
  "meta" : {
    "profile" : [
      "http://smart.who.int/base/StructureDefinition/SGRequirements"
    ]
  },
  "extension" : [
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.url",
      "valueUri" : "http://smart.who.int/trust/Requirements/IssuerVDHC"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.version",
      "valueString" : "1.3.0"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.name",
      "valueString" : "Issue VDHC"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.title",
      "valueString" : "Issue Verifiable Digital Health Certificate"
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
      "valueMarkdown" : "Issue a Verifiable Digital Health Certificate to a Holder"
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
      "valueCanonical" : "http://smart.who.int/trust/ActorDefinition/Issuer"
    },
    {
      "extension" : [
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.key",
          "valueId" : "IssuerVDHC-generate"
        },
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.label",
          "valueString" : "Generate Verifiable Digital Health Certificate"
        },
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.requirement",
          "valueMarkdown" : "Generate the content that will be signed as part of a Verifiable Digital Health Certificate"
        }
      ],
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement"
    },
    {
      "extension" : [
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.key",
          "valueId" : "IssuerVDHC-sign"
        },
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.label",
          "valueString" : "Sign Verifiable Digital Health Certificate"
        },
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.requirement",
          "valueMarkdown" : "Sign content to produce a Verifiable Digital Health Certificate."
        }
      ],
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement"
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
