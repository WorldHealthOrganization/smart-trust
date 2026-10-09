# GDHCNParticipant-DOM-DEV - WHO SMART Trust v1.7.4

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-DOM-DEV**

## Organization: GDHCNParticipant-DOM-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Dominican Republic (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Dominican Republic Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:DOM resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/DOM/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:DOM](Endpoint-GDHCNParticipantDID-DOM-DEV-All.md)
* [Dominican Republic Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:DOM:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/DOM/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:DOM:DSC](Endpoint-GDHCNParticipantDID-DOM-DEV-DSC.md)
* [Dominican Republic Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:DOM:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/DOM/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:DOM:SCA](Endpoint-GDHCNParticipantDID-DOM-DEV-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-DOM-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Dominican Republic",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-DOM-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-DOM-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-DOM-DEV-SCA"
  }]
}

```
