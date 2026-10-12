# GDHCNParticipant-NLD - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-NLD**

## Organization: GDHCNParticipant-NLD

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Netherlands (Kingdom of the)

**endpoint**: 

* [Endpoint Netherlands (Kingdom of the) Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:NLD resolvable at https://tng-cdn.who.int/v2/trustlist/-/NLD/did.json](Endpoint-GDHCNParticipantDID-NLD-All.md)
* [Endpoint Netherlands (Kingdom of the) Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:NLD:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/NLD/DSC/did.json](Endpoint-GDHCNParticipantDID-NLD-DSC.md)
* [Endpoint Netherlands (Kingdom of the) Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:NLD:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/NLD/SCA/did.json](Endpoint-GDHCNParticipantDID-NLD-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-NLD",
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
      "reference" : "Endpoint/GDHCNParticipantDID-NLD-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-NLD-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-NLD-SCA"
    }
  ]
}

```
