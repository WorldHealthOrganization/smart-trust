# GDHCNParticipant-CZE - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-CZE**

## Organization: GDHCNParticipant-CZE

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Czechia (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Czechia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:CZE resolvable at https://tng-cdn.who.int/v2/trustlist/-/CZE/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:CZE](Endpoint-GDHCNParticipantDID-CZE-All.md)
* [Czechia Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:CZE:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/CZE/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:CZE:DSC](Endpoint-GDHCNParticipantDID-CZE-DSC.md)
* [Czechia Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:CZE:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/CZE/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:CZE:SCA](Endpoint-GDHCNParticipantDID-CZE-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-CZE",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Czechia",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-CZE-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-CZE-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-CZE-SCA"
  }]
}

```
