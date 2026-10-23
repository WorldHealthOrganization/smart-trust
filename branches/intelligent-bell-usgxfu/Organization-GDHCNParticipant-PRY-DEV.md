# GDHCNParticipant-PRY-DEV - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-PRY-DEV**

## Organization: GDHCNParticipant-PRY-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Paraguay (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Paraguay Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:PRY resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/PRY/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:PRY](Endpoint-GDHCNParticipantDID-PRY-DEV-All.md)
* [Paraguay Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:PRY:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/PRY/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:PRY:DSC](Endpoint-GDHCNParticipantDID-PRY-DEV-DSC.md)
* [Paraguay Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:PRY:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/PRY/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:PRY:SCA](Endpoint-GDHCNParticipantDID-PRY-DEV-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-PRY-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Paraguay",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-PRY-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-PRY-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-PRY-DEV-SCA"
  }]
}

```
