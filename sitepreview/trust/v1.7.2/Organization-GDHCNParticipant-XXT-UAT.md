# GDHCNParticipant-XXT-UAT - WHO SMART Trust v1.7.2

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXT-UAT**

## Organization: GDHCNParticipant-XXT-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Geneva

**endpoint**: 

* [Endpoint Geneva Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXT resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXT/did.json](Endpoint-GDHCNParticipantDID-XXT-UAT-All.md)
* [Endpoint Geneva Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXT:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXT/DSC/did.json](Endpoint-GDHCNParticipantDID-XXT-UAT-DSC.md)
* [Endpoint Geneva Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXT:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXT/SCA/did.json](Endpoint-GDHCNParticipantDID-XXT-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXT-UAT",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Geneva",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-XXT-UAT-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXT-UAT-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXT-UAT-SCA"
  }]
}

```
