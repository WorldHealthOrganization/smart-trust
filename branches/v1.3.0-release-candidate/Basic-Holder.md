# Resource Holder



## Resource Content

```json
{
  "resourceType" : "Basic",
  "id" : "Holder",
  "meta" : {
    "profile" : ["http://smart.who.int/base/StructureDefinition/SGActor"]
  },
  "extension" : [
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.url",
      "valueUri" : "http://smart.who.int/trust/ActorDefinition/Holder"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.version",
      "valueString" : "1.3.0"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.name",
      "valueString" : "Holder"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.title",
      "valueString" : "Holder"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.status",
      "valueCode" : "active"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.experimental",
      "valueBoolean" : true
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.date",
      "valueDateTime" : "2025-10-27T07:48:32+00:00"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.publisher",
      "valueString" : "WHO"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.contact",
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
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.description",
      "valueMarkdown" : "A Holder is an individual that has Verifiable Digtial Health Certificate in their possesion, received from an Issuer.  The Holder may choose to share the Verifiable Digital Health Certificate with a Receiver."
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.jurisdiction",
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
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.type",
      "valueCode" : "person"
    }
  ],
  "code" : {
    "coding" : [
      {
        "system" : "http://hl7.org/fhir/fhir-types",
        "code" : "ActorDefinition"
      }
    ]
  }
}

```
