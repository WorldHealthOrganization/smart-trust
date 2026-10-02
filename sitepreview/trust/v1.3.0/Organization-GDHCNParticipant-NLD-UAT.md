# GDHCNParticipant-NLD-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-NLD-UAT**

## Organization: GDHCNParticipant-NLD-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Netherlands (Kingdom of the)

**endpoint**: 

* [Endpoint Netherlands (Kingdom of the) Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:NLD resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/NLD/did.json](Endpoint-GDHCNParticipantDID-NLD-UAT-All.md)
* [Endpoint Netherlands (Kingdom of the) Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:NLD:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/NLD/DSC/did.json](Endpoint-GDHCNParticipantDID-NLD-UAT-DSC.md)
* [Endpoint Netherlands (Kingdom of the) Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:NLD:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/NLD/SCA/did.json](Endpoint-GDHCNParticipantDID-NLD-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-NLD-UAT",
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
  "name" : "Netherlands (Kingdom of the)",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-NLD-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-NLD-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-NLD-UAT-SCA"
    }
  ]
}

```
