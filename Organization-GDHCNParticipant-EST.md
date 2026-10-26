# GDHCNParticipant-EST - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-EST**

## Organization: GDHCNParticipant-EST

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Estonia (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Estonia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:EST resolvable at https://tng-cdn.who.int/v2/trustlist/-/EST/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:EST](Endpoint-GDHCNParticipantDID-EST-All.md)
* [Estonia Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:EST:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/EST/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:EST:DSC](Endpoint-GDHCNParticipantDID-EST-DSC.md)
* [Estonia Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:EST:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/EST/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:EST:SCA](Endpoint-GDHCNParticipantDID-EST-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-EST",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Estonia",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-EST-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-EST-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-EST-SCA"
  }]
}

```
