# GDHCNParticipant-ALB-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-ALB-UAT**

## Organization: GDHCNParticipant-ALB-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Albania

**endpoint**: 

* [Endpoint Albania Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ALB resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/ALB/did.json](Endpoint-GDHCNParticipantDID-ALB-UAT-All.md)
* [Endpoint Albania Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:ALB:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/ALB/DSC/did.json](Endpoint-GDHCNParticipantDID-ALB-UAT-DSC.md)
* [Endpoint Albania Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:ALB:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/ALB/SCA/did.json](Endpoint-GDHCNParticipantDID-ALB-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-ALB-UAT",
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
  "name" : "Albania",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-ALB-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-ALB-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-ALB-UAT-SCA"
    }
  ]
}

```
