# GDHCNParticipant-XXT-DEV - WHO SMART Trust v1.6.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXT-DEV**

## Organization: GDHCNParticipant-XXT-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Geneva

**endpoint**: 

* [Endpoint Geneva Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXT resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXT/did.json](Endpoint-GDHCNParticipantDID-XXT-DEV-All.md)
* [Endpoint Geneva Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXT:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXT/DSC/did.json](Endpoint-GDHCNParticipantDID-XXT-DEV-DSC.md)
* [Endpoint Geneva Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXT:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXT/SCA/did.json](Endpoint-GDHCNParticipantDID-XXT-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXT-DEV",
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
    "reference" : "Endpoint/GDHCNParticipantDID-XXT-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXT-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXT-DEV-SCA"
  }]
}

```
