# GDHCNParticipant-PAN-UAT - WHO SMART Trust v1.6.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-PAN-UAT**

## Organization: GDHCNParticipant-PAN-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Panama

**endpoint**: 

* [Endpoint Panama Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:PAN resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/PAN/did.json](Endpoint-GDHCNParticipantDID-PAN-UAT-All.md)
* [Endpoint Panama Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:PAN:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/PAN/DSC/did.json](Endpoint-GDHCNParticipantDID-PAN-UAT-DSC.md)
* [Endpoint Panama Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:PAN:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/PAN/SCA/did.json](Endpoint-GDHCNParticipantDID-PAN-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-PAN-UAT",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Panama",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-PAN-UAT-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-PAN-UAT-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-PAN-UAT-SCA"
  }]
}

```
