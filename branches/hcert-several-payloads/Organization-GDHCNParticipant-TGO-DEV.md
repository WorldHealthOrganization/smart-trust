# GDHCNParticipant-TGO-DEV - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-TGO-DEV**

## Organization: GDHCNParticipant-TGO-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Togo (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Togo Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:TGO resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/TGO/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:TGO](Endpoint-GDHCNParticipantDID-TGO-DEV-All.md)
* [Togo Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:TGO:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/TGO/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:TGO:DSC](Endpoint-GDHCNParticipantDID-TGO-DEV-DSC.md)
* [Togo Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:TGO:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/TGO/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:TGO:SCA](Endpoint-GDHCNParticipantDID-TGO-DEV-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-TGO-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Togo",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-TGO-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-TGO-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-TGO-DEV-SCA"
  }]
}

```
