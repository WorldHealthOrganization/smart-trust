# GDHCNParticipant-XXB-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXB-DEV**

## Organization: GDHCNParticipant-XXB-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: DEV Participant XXB

**endpoint**: 

* [Endpoint DEV Participant XXB Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXB resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXB/did.json](Endpoint-GDHCNParticipantDID-XXB-DEV-All.md)
* [Endpoint DEV Participant XXB Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXB:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXB/DSC/did.json](Endpoint-GDHCNParticipantDID-XXB-DEV-DSC.md)
* [Endpoint DEV Participant XXB Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXB:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXB/SCA/did.json](Endpoint-GDHCNParticipantDID-XXB-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXB-DEV",
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
  "name" : "DEV Participant XXB",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXB-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXB-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXB-DEV-SCA"
    }
  ]
}

```
