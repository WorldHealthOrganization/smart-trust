# GDHCNParticipant-BOL-DEV - WHO SMART Trust v1.6.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-BOL-DEV**

## Organization: GDHCNParticipant-BOL-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Bolivia (Plurinational State of)

**endpoint**: 

* [Endpoint Bolivia (Plurinational State of) Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BOL resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BOL/did.json](Endpoint-GDHCNParticipantDID-BOL-DEV-All.md)
* [Endpoint Bolivia (Plurinational State of) Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:BOL:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BOL/DSC/did.json](Endpoint-GDHCNParticipantDID-BOL-DEV-DSC.md)
* [Endpoint Bolivia (Plurinational State of) Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:BOL:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BOL/SCA/did.json](Endpoint-GDHCNParticipantDID-BOL-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-BOL-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Bolivia (Plurinational State of)",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-BOL-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-BOL-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-BOL-DEV-SCA"
  }]
}

```
