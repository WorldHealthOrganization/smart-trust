# GDHCNParticipant-ECU-DEV - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-ECU-DEV**

## Organization: GDHCNParticipant-ECU-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Ecuador (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Ecuador Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ECU resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ECU/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:ECU](Endpoint-GDHCNParticipantDID-ECU-DEV-All.md)
* [Ecuador Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:ECU:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ECU/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:ECU:DSC](Endpoint-GDHCNParticipantDID-ECU-DEV-DSC.md)
* [Ecuador Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:ECU:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ECU/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:ECU:SCA](Endpoint-GDHCNParticipantDID-ECU-DEV-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-ECU-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Ecuador",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-ECU-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-ECU-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-ECU-DEV-SCA"
  }]
}

```
