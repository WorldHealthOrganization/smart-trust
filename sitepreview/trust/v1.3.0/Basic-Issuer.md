# Resource Issuer



## Resource Content

```json
{
  "resourceType" : "Basic",
  "id" : "Issuer",
  "meta" : {
    "profile" : ["http://smart.who.int/base/StructureDefinition/SGActor"]
  },
  "extension" : [
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.url",
      "valueUri" : "http://smart.who.int/trust/ActorDefinition/Issuer"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.version",
      "valueString" : "1.3.0"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.name",
      "valueString" : "Issuer"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.title",
      "valueString" : "Issuer"
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
      "valueDateTime" : "2025-10-27T08:33:32+00:00"
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
      "valueMarkdown" : "An Issuer a system authorized by a Trust Network Participant to generate Verifiable Digital Health Certificates which are provided to a Holder.   An Issuer is responsible for generating the content that is digitally signed within the Verifiable Digital Health Certificate.   In order to sign this content, an Issuer should either itself be a Document Signer or utilize a Document Signer service, as authorized by the jurisdicitonal policy."
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
      "valueCode" : "system"
    },
    {
      "url" : "http://hl7.org/fhir/5.0/StructureDefinition/extension-ActorDefinition.derivedFrom",
      "valueCanonical" : "http://smart.who.int/trust/ActorDefinition/TrustNetworkParticipant"
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
