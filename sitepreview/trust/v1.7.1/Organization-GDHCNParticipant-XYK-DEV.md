# GDHCNParticipant-XYK-DEV - WHO SMART Trust v1.7.1

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XYK-DEV**

## Organization: GDHCNParticipant-XYK-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Test

**endpoint**: 

* [Endpoint Test Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XYK resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XYK/did.json](Endpoint-GDHCNParticipantDID-XYK-DEV-All.md)
* [Endpoint Test Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XYK:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XYK/DSC/did.json](Endpoint-GDHCNParticipantDID-XYK-DEV-DSC.md)
* [Endpoint Test Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XYK:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XYK/SCA/did.json](Endpoint-GDHCNParticipantDID-XYK-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XYK-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Test",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-XYK-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XYK-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XYK-DEV-SCA"
  }]
}

```
