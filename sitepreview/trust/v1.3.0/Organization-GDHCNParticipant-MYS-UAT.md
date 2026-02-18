# GDHCNParticipant-MYS-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-MYS-UAT**

## Organization: GDHCNParticipant-MYS-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Malaysia

**endpoint**: 

* [Endpoint Malaysia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:MYS resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/MYS/did.json](Endpoint-GDHCNParticipantDID-MYS-UAT-All.md)
* [Endpoint Malaysia Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:MYS:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/MYS/DSC/did.json](Endpoint-GDHCNParticipantDID-MYS-UAT-DSC.md)
* [Endpoint Malaysia Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:MYS:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/MYS/SCA/did.json](Endpoint-GDHCNParticipantDID-MYS-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-MYS-UAT",
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
      "reference" : "Endpoint/GDHCNParticipantDID-MYS-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-MYS-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-MYS-UAT-SCA"
    }
  ]
}

```
