# GDHCNParticipant-IDN - WHO SMART Trust v1.7.4

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-IDN**

## Organization: GDHCNParticipant-IDN

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Indonesia (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Indonesia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:IDN resolvable at https://tng-cdn.who.int/v2/trustlist/-/IDN/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:IDN](Endpoint-GDHCNParticipantDID-IDN-All.md)
* [Indonesia Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:IDN:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/IDN/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:IDN:DSC](Endpoint-GDHCNParticipantDID-IDN-DSC.md)
* [Indonesia Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:IDN:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/IDN/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:IDN:SCA](Endpoint-GDHCNParticipantDID-IDN-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-IDN",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Indonesia",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-IDN-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-IDN-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-IDN-SCA"
  }]
}

```
