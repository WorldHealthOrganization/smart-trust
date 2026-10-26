# GDHCNParticipant-XXA-DEV - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXA-DEV**

## Organization: GDHCNParticipant-XXA-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Geneva (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Geneva Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XXA](Endpoint-GDHCNParticipantDID-XXA-DEV-All.md)
* [Geneva Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXA:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXA/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XXA:DSC](Endpoint-GDHCNParticipantDID-XXA-DEV-DSC.md)
* [Geneva Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXA:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXA/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XXA:SCA](Endpoint-GDHCNParticipantDID-XXA-DEV-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXA-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Geneva",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-XXA-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXA-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXA-DEV-SCA"
  }]
}

```
