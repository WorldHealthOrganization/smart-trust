# GDHCNParticipant-JAM-DEV - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-JAM-DEV**

## Organization: GDHCNParticipant-JAM-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Jamaica (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Jamaica Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:JAM resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/JAM/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:JAM](Endpoint-GDHCNParticipantDID-JAM-DEV-All.md)
* [Jamaica Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:JAM:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/JAM/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:JAM:DSC](Endpoint-GDHCNParticipantDID-JAM-DEV-DSC.md)
* [Jamaica Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:JAM:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/JAM/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:JAM:SCA](Endpoint-GDHCNParticipantDID-JAM-DEV-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-JAM-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Jamaica",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-JAM-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-JAM-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-JAM-DEV-SCA"
  }]
}

```
