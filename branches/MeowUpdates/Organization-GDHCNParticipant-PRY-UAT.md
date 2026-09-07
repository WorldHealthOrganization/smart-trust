# GDHCNParticipant-PRY-UAT - WHO SMART Trust v1.6.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-PRY-UAT**

## Organization: GDHCNParticipant-PRY-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Paraguay

**endpoint**: 

* [Endpoint Paraguay Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:PRY resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/PRY/did.json](Endpoint-GDHCNParticipantDID-PRY-UAT-All.md)
* [Endpoint Paraguay Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:PRY:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/PRY/DSC/did.json](Endpoint-GDHCNParticipantDID-PRY-UAT-DSC.md)
* [Endpoint Paraguay Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:PRY:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/PRY/SCA/did.json](Endpoint-GDHCNParticipantDID-PRY-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-PRY-UAT",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Paraguay",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-PRY-UAT-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-PRY-UAT-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-PRY-UAT-SCA"
  }]
}

```
