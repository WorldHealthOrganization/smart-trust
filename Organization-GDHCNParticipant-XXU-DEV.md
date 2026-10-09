# GDHCNParticipant-XXU-DEV - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXU-DEV**

## Organization: GDHCNParticipant-XXU-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Geneva (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Geneva Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXU resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXU/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XXU](Endpoint-GDHCNParticipantDID-XXU-DEV-All.md)
* [Geneva Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXU:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXU/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XXU:DSC](Endpoint-GDHCNParticipantDID-XXU-DEV-DSC.md)
* [Geneva Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXU:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXU/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XXU:SCA](Endpoint-GDHCNParticipantDID-XXU-DEV-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXU-DEV",
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
    "reference" : "Endpoint/GDHCNParticipantDID-XXU-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXU-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXU-DEV-SCA"
  }]
}

```
