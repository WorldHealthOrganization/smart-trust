# GDHCNParticipant-IOM-DEV - WHO SMART Trust v1.6.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-IOM-DEV**

## Organization: GDHCNParticipant-IOM-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: TEST

**endpoint**: 

* [Endpoint TEST Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:IOM resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/IOM/did.json](Endpoint-GDHCNParticipantDID-IOM-DEV-All.md)
* [Endpoint TEST Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:IOM:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/IOM/DSC/did.json](Endpoint-GDHCNParticipantDID-IOM-DEV-DSC.md)
* [Endpoint TEST Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:IOM:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/IOM/SCA/did.json](Endpoint-GDHCNParticipantDID-IOM-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-IOM-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "TEST",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-IOM-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-IOM-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-IOM-DEV-SCA"
  }]
}

```
