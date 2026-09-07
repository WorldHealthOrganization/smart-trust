# Resource UtilizeVDHC



## Resource Content

```json
{
  "resourceType" : "Basic",
  "id" : "UtilizeVDHC",
  "meta" : {
    "profile" : [
      "http://smart.who.int/base/StructureDefinition/SGRequirements"
    ]
  },
  "extension" : [
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.url",
      "valueUri" : "http://smart.who.int/trust/Requirements/UtilizeVDHC"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.version",
      "valueString" : "1.3.0"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.name",
      "valueString" : "Utilize VDHC"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.title",
      "valueString" : "Utilize a Verifiable Digital Health Certificate"
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
      "valueMarkdown" : "Utilize a Verifiable Digital Health Certificate that was provided by a Holder"
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
      "valueCanonical" : "http://smart.who.int/trust/ActorDefinition/Receiver"
    },
    {
      "extension" : [
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.key",
          "valueId" : "UtilizeVDHC-reveive"
        },
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.label",
          "valueString" : "Ingest VDHC"
        },
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.requirement",
          "valueMarkdown" : "A user of a Receiver system receives a Verfiable Digital Health Certificate from a Holder. The user ingests the Verifiable Digital Health Certificate into the Receiver system.  The means of conveyance and how the Verifiable Digital Health Certificate is rendered is depedent on the use context."
        }
      ],
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement"
    },
    {
      "extension" : [
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.key",
          "valueId" : "UtilizeVDHC-retreive-keys"
        },
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.label",
          "valueString" : "Retrieve matching keys"
        },
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.requirement",
          "valueMarkdown" : "Retrieve and/or filter from an apporopriate PKI material distribution endpoint the set of public keys that match the key identifier (kid), trust domain code, participant code, and/or key usage code as applicable to the context of use of the Verfiable Digital Health Certificate."
        }
      ],
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement"
    },
    {
      "extension" : [
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.key",
          "valueId" : "UtilizeVDHC-validate-hash"
        },
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.label",
          "valueString" : "Compute Hash"
        },
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.requirement",
          "valueMarkdown" : "As appropriate  to the content type of the Verfiable Digtial Health Certificate, compute the hash of the content, and use the retrieved public keys(s) to try to verify the signature against the hashed value."
        }
      ],
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement"
    },
    {
      "extension" : [
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.key",
          "valueId" : "UtilizeVDHC-display-verified-content"
        },
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.label",
          "valueString" : "Display verified content"
        },
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.requirement",
          "valueMarkdown" : "Display verified cotent to the user of the Reciever system."
        }
      ],
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement"
    },
    {
      "extension" : [
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.key",
          "valueId" : "UtilizeVDHC-execute-business-rule"
        },
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.label",
          "valueString" : "Execute business rules"
        },
        {
          "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-Requirements.statement.requirement",
          "valueMarkdown" : "Execute zero or more business rules against the Verifiable Digital Health Certificate that was provided by a Holder.  Results of the execution of the business rules are displayed to the user of the Receiver system."
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
