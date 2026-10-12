# GDHCNParticipant-HND-DEV - WHO SMART Trust v1.7.4

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-HND-DEV**

## Organization: GDHCNParticipant-HND-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Honduras (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Honduras Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:HND resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/HND/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:HND](Endpoint-GDHCNParticipantDID-HND-DEV-All.md)
* [Honduras Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:HND:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/HND/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:HND:DSC](Endpoint-GDHCNParticipantDID-HND-DEV-DSC.md)
* [Honduras Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:HND:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/HND/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:HND:SCA](Endpoint-GDHCNParticipantDID-HND-DEV-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-HND-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Honduras",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-HND-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-HND-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-HND-DEV-SCA"
  }]
}

```
