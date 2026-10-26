# GDHCNParticipant-SMR - WHO SMART Trust v1.7.4

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-SMR**

## Organization: GDHCNParticipant-SMR

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

San Marino (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [San Marino Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SMR resolvable at https://tng-cdn.who.int/v2/trustlist/-/SMR/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:SMR](Endpoint-GDHCNParticipantDID-SMR-All.md)
* [San Marino Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:SMR:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/SMR/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:SMR:DSC](Endpoint-GDHCNParticipantDID-SMR-DSC.md)
* [San Marino Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:SMR:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/SMR/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:SMR:SCA](Endpoint-GDHCNParticipantDID-SMR-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-SMR",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "San Marino",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-SMR-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-SMR-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-SMR-SCA"
  }]
}

```
