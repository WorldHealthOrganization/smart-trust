# GDHCNParticipant-ALB - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-ALB**

## Organization: GDHCNParticipant-ALB

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Albania

**endpoint**: 

* [Endpoint Albania Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ALB resolvable at https://tng-cdn.who.int/v2/trustlist/-/ALB/did.json](Endpoint-GDHCNParticipantDID-ALB-All.md)
* [Endpoint Albania Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:ALB:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/ALB/DSC/did.json](Endpoint-GDHCNParticipantDID-ALB-DSC.md)
* [Endpoint Albania Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:ALB:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/ALB/SCA/did.json](Endpoint-GDHCNParticipantDID-ALB-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-ALB",
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
      "reference" : "Endpoint/GDHCNParticipantDID-ALB-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-ALB-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-ALB-SCA"
    }
  ]
}

```
