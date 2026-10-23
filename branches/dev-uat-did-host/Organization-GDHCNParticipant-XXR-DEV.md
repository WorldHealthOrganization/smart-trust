# GDHCNParticipant-XXR-DEV - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXR-DEV**

## Organization: GDHCNParticipant-XXR-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Mumbai (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Mumbai Trustlist (DID v2) - DEV - All keys did:web:tng-cdn-dev.who.int:v2:trustlist:-:XXR resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXR/did.json (): did:web:tng-cdn-dev.who.int:v2:trustlist:-:XXR](Endpoint-GDHCNParticipantDID-XXR-DEV-All.md)
* [Mumbai Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn-dev.who.int:v2:trustlist:-:XXR:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXR/DSC/did.json (): did:web:tng-cdn-dev.who.int:v2:trustlist:-:XXR:DSC](Endpoint-GDHCNParticipantDID-XXR-DEV-DSC.md)
* [Mumbai Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn-dev.who.int:v2:trustlist:-:XXR:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXR/SCA/did.json (): did:web:tng-cdn-dev.who.int:v2:trustlist:-:XXR:SCA](Endpoint-GDHCNParticipantDID-XXR-DEV-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXR-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Mumbai",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-XXR-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXR-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXR-DEV-SCA"
  }]
}

```
