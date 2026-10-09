# GDHCNParticipant-XXG-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXG-DEV**

## Organization: GDHCNParticipant-XXG-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: DEV Participant XXG

**endpoint**: 

* [Endpoint DEV Participant XXG Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXG resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXG/did.json](Endpoint-GDHCNParticipantDID-XXG-DEV-All.md)
* [Endpoint DEV Participant XXG Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXG:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXG/DSC/did.json](Endpoint-GDHCNParticipantDID-XXG-DEV-DSC.md)
* [Endpoint DEV Participant XXG Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXG:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXG/SCA/did.json](Endpoint-GDHCNParticipantDID-XXG-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXG-DEV",
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
  "name" : "DEV Participant XXG",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXG-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXG-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXG-DEV-SCA"
    }
  ]
}

```
