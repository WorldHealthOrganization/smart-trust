# GDHCNParticipant-OMN - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-OMN**

## Organization: GDHCNParticipant-OMN

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Oman (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Oman Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:OMN resolvable at https://tng-cdn.who.int/v2/trustlist/-/OMN/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:OMN](Endpoint-GDHCNParticipantDID-OMN-All.md)
* [Oman Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:OMN:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/OMN/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:OMN:DSC](Endpoint-GDHCNParticipantDID-OMN-DSC.md)
* [Oman Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:OMN:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/OMN/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:OMN:SCA](Endpoint-GDHCNParticipantDID-OMN-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-OMN",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Oman",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-OMN-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-OMN-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-OMN-SCA"
  }]
}

```
