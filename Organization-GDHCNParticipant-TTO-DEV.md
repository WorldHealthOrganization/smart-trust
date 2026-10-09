# GDHCNParticipant-TTO-DEV - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-TTO-DEV**

## Organization: GDHCNParticipant-TTO-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Trinidad and Tobago (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Trinidad and Tobago Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:TTO resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/TTO/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:TTO](Endpoint-GDHCNParticipantDID-TTO-DEV-All.md)
* [Trinidad and Tobago Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:TTO:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/TTO/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:TTO:DSC](Endpoint-GDHCNParticipantDID-TTO-DEV-DSC.md)
* [Trinidad and Tobago Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:TTO:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/TTO/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:TTO:SCA](Endpoint-GDHCNParticipantDID-TTO-DEV-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-TTO-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Trinidad and Tobago",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-TTO-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-TTO-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-TTO-DEV-SCA"
  }]
}

```
