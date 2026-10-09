# GDHCNParticipant-BEN-UAT - WHO SMART Trust v1.7.4

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-BEN-UAT**

## Organization: GDHCNParticipant-BEN-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Benin (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Benin Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BEN resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/BEN/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:BEN](Endpoint-GDHCNParticipantDID-BEN-UAT-All.md)
* [Benin Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:BEN:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/BEN/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:BEN:DSC](Endpoint-GDHCNParticipantDID-BEN-UAT-DSC.md)
* [Benin Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:BEN:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/BEN/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:BEN:SCA](Endpoint-GDHCNParticipantDID-BEN-UAT-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-BEN-UAT",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Benin",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-BEN-UAT-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-BEN-UAT-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-BEN-UAT-SCA"
  }]
}

```
