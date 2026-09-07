# GDHCNParticipant-ARE-DEV - WHO SMART Trust v1.6.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-ARE-DEV**

## Organization: GDHCNParticipant-ARE-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: United Arab Emirates

**endpoint**: 

* [Endpoint United Arab Emirates Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ARE resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ARE/did.json](Endpoint-GDHCNParticipantDID-ARE-DEV-All.md)
* [Endpoint United Arab Emirates Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:ARE:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ARE/DSC/did.json](Endpoint-GDHCNParticipantDID-ARE-DEV-DSC.md)
* [Endpoint United Arab Emirates Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:ARE:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ARE/SCA/did.json](Endpoint-GDHCNParticipantDID-ARE-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-ARE-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "United Arab Emirates",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-ARE-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-ARE-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-ARE-DEV-SCA"
  }]
}

```
