# GDHCNParticipant-XXI-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXI-DEV**

## Organization: GDHCNParticipant-XXI-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: DEV Participant XXI

**endpoint**: 

* [Endpoint DEV Participant XXI Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXI resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXI/did.json](Endpoint-GDHCNParticipantDID-XXI-DEV-All.md)
* [Endpoint DEV Participant XXI Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXI:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXI/DSC/did.json](Endpoint-GDHCNParticipantDID-XXI-DEV-DSC.md)
* [Endpoint DEV Participant XXI Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXI:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXI/SCA/did.json](Endpoint-GDHCNParticipantDID-XXI-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXI-DEV",
  "meta" : {
    "profile" : [
      "https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"
    ]
  },
  "type" : [
    {
      "coding" : [
        {
          "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
          "code" : "govt"
        }
      ]
    }
  ],
  "name" : "DEV Participant XXI",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXI-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXI-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXI-DEV-SCA"
    }
  ]
}

```
