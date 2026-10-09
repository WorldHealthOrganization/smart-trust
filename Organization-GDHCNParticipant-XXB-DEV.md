# GDHCNParticipant-XXB-DEV - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXB-DEV**

## Organization: GDHCNParticipant-XXB-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

TEST (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [TEST Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXB resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXB/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XXB](Endpoint-GDHCNParticipantDID-XXB-DEV-All.md)
* [TEST Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXB:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXB/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XXB:DSC](Endpoint-GDHCNParticipantDID-XXB-DEV-DSC.md)
* [TEST Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXB:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXB/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XXB:SCA](Endpoint-GDHCNParticipantDID-XXB-DEV-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXB-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "TEST",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-XXB-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXB-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXB-DEV-SCA"
  }]
}

```
