# GDHCNParticipant-CRI-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-CRI-DEV**

## Organization: GDHCNParticipant-CRI-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Costa Rica

**endpoint**: 

* [Endpoint Costa Rica Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:CRI resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/CRI/did.json](Endpoint-GDHCNParticipantDID-CRI-DEV-All.md)
* [Endpoint Costa Rica Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:CRI:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/CRI/DSC/did.json](Endpoint-GDHCNParticipantDID-CRI-DEV-DSC.md)
* [Endpoint Costa Rica Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:CRI:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/CRI/SCA/did.json](Endpoint-GDHCNParticipantDID-CRI-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-CRI-DEV",
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
  "name" : "Costa Rica",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-CRI-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-CRI-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-CRI-DEV-SCA"
    }
  ]
}

```
