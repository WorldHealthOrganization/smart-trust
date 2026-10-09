# GDHCNParticipant-TUR - WHO SMART Trust v1.7.4

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-TUR**

## Organization: GDHCNParticipant-TUR

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Türkiye (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Türkiye Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:TUR resolvable at https://tng-cdn.who.int/v2/trustlist/-/TUR/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:TUR](Endpoint-GDHCNParticipantDID-TUR-All.md)
* [Türkiye Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:TUR:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/TUR/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:TUR:DSC](Endpoint-GDHCNParticipantDID-TUR-DSC.md)
* [Türkiye Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:TUR:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/TUR/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:TUR:SCA](Endpoint-GDHCNParticipantDID-TUR-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-TUR",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Türkiye",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-TUR-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-TUR-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-TUR-SCA"
  }]
}

```
