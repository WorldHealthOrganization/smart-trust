# GDHCNParticipant-XXQ-DEV - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXQ-DEV**

## Organization: GDHCNParticipant-XXQ-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Test Locality (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Test Locality Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXQ resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXQ/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XXQ](Endpoint-GDHCNParticipantDID-XXQ-DEV-All.md)
* [Test Locality Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXQ:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXQ/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XXQ:DSC](Endpoint-GDHCNParticipantDID-XXQ-DEV-DSC.md)
* [Test Locality Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXQ:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXQ/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XXQ:SCA](Endpoint-GDHCNParticipantDID-XXQ-DEV-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXQ-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Test Locality",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-XXQ-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXQ-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXQ-DEV-SCA"
  }]
}

```
