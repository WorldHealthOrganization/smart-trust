# GDHCNParticipant-TTO-DEV - WHO SMART Trust v1.6.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-TTO-DEV**

## Organization: GDHCNParticipant-TTO-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Trinidad and Tobago

**endpoint**: 

* [Endpoint Trinidad and Tobago Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:TTO resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/TTO/did.json](Endpoint-GDHCNParticipantDID-TTO-DEV-All.md)
* [Endpoint Trinidad and Tobago Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:TTO:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/TTO/DSC/did.json](Endpoint-GDHCNParticipantDID-TTO-DEV-DSC.md)
* [Endpoint Trinidad and Tobago Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:TTO:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/TTO/SCA/did.json](Endpoint-GDHCNParticipantDID-TTO-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-TTO-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Trinidad and Tobago",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-TTO-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-TTO-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-TTO-DEV-SCA"
  }]
}

```
