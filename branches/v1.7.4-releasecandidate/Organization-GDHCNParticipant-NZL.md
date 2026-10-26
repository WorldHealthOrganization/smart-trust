# GDHCNParticipant-NZL - WHO SMART Trust v1.7.4

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-NZL**

## Organization: GDHCNParticipant-NZL

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

New Zealand (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [New Zealand Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:NZL resolvable at https://tng-cdn.who.int/v2/trustlist/-/NZL/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:NZL](Endpoint-GDHCNParticipantDID-NZL-All.md)
* [New Zealand Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:NZL:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/NZL/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:NZL:DSC](Endpoint-GDHCNParticipantDID-NZL-DSC.md)
* [New Zealand Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:NZL:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/NZL/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:NZL:SCA](Endpoint-GDHCNParticipantDID-NZL-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-NZL",
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
    "reference" : "Endpoint/GDHCNParticipantDID-NZL-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-NZL-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-NZL-SCA"
  }]
}

```
