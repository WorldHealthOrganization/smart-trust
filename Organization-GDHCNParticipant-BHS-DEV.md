# GDHCNParticipant-BHS-DEV - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-BHS-DEV**

## Organization: GDHCNParticipant-BHS-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Bahamas (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Bahamas Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BHS resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BHS/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:BHS](Endpoint-GDHCNParticipantDID-BHS-DEV-All.md)
* [Bahamas Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:BHS:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BHS/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:BHS:DSC](Endpoint-GDHCNParticipantDID-BHS-DEV-DSC.md)
* [Bahamas Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:BHS:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BHS/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:BHS:SCA](Endpoint-GDHCNParticipantDID-BHS-DEV-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-BHS-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Bahamas",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-BHS-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-BHS-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-BHS-DEV-SCA"
  }]
}

```
