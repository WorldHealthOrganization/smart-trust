# GDHCNParticipant-XXH-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXH-DEV**

## Organization: GDHCNParticipant-XXH-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: DEV Participant XXH

**endpoint**: 

* [Endpoint DEV Participant XXH Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXH resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXH/did.json](Endpoint-GDHCNParticipantDID-XXH-DEV-All.md)
* [Endpoint DEV Participant XXH Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXH:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXH/DSC/did.json](Endpoint-GDHCNParticipantDID-XXH-DEV-DSC.md)
* [Endpoint DEV Participant XXH Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXH:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXH/SCA/did.json](Endpoint-GDHCNParticipantDID-XXH-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXH-DEV",
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
  "name" : "DEV Participant XXH",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXH-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXH-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-XXH-DEV-SCA"
    }
  ]
}

```
