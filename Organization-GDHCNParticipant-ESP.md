# GDHCNParticipant-ESP - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-ESP**

## Organization: GDHCNParticipant-ESP

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Spain (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Spain Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ESP resolvable at https://tng-cdn.who.int/v2/trustlist/-/ESP/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:ESP](Endpoint-GDHCNParticipantDID-ESP-All.md)
* [Spain Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:ESP:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/ESP/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:ESP:DSC](Endpoint-GDHCNParticipantDID-ESP-DSC.md)
* [Spain Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:ESP:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/ESP/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:ESP:SCA](Endpoint-GDHCNParticipantDID-ESP-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-ESP",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Spain",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-ESP-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-ESP-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-ESP-SCA"
  }]
}

```
