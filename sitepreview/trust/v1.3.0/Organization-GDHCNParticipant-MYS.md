# GDHCNParticipant-MYS - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-MYS**

## Organization: GDHCNParticipant-MYS

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Malaysia

**endpoint**: 

* [Endpoint Malaysia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:MYS resolvable at https://tng-cdn.who.int/v2/trustlist/-/MYS/did.json](Endpoint-GDHCNParticipantDID-MYS-All.md)
* [Endpoint Malaysia Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:MYS:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/MYS/DSC/did.json](Endpoint-GDHCNParticipantDID-MYS-DSC.md)
* [Endpoint Malaysia Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:MYS:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/MYS/SCA/did.json](Endpoint-GDHCNParticipantDID-MYS-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-MYS",
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
  "name" : "Malaysia",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-MYS-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-MYS-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-MYS-SCA"
    }
  ]
}

```
