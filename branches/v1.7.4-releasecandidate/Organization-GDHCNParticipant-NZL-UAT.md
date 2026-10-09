# GDHCNParticipant-NZL-UAT - WHO SMART Trust v1.7.4

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-NZL-UAT**

## Organization: GDHCNParticipant-NZL-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

New Zealand (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [New Zealand Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:NZL resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/NZL/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:NZL](Endpoint-GDHCNParticipantDID-NZL-UAT-All.md)
* [New Zealand Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:NZL:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/NZL/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:NZL:DSC](Endpoint-GDHCNParticipantDID-NZL-UAT-DSC.md)
* [New Zealand Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:NZL:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/NZL/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:NZL:SCA](Endpoint-GDHCNParticipantDID-NZL-UAT-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-NZL-UAT",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "New Zealand",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-NZL-UAT-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-NZL-UAT-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-NZL-UAT-SCA"
  }]
}

```
