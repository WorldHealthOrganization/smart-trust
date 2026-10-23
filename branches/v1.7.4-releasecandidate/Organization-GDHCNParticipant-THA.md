# GDHCNParticipant-THA - WHO SMART Trust v1.7.4

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-THA**

## Organization: GDHCNParticipant-THA

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Thailand (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Thailand Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:THA resolvable at https://tng-cdn.who.int/v2/trustlist/-/THA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:THA](Endpoint-GDHCNParticipantDID-THA-All.md)
* [Thailand Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:THA:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/THA/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:THA:DSC](Endpoint-GDHCNParticipantDID-THA-DSC.md)
* [Thailand Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:THA:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/THA/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:THA:SCA](Endpoint-GDHCNParticipantDID-THA-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-THA",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Thailand",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-THA-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-THA-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-THA-SCA"
  }]
}

```
