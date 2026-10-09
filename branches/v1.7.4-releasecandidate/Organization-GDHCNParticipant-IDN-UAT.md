# GDHCNParticipant-IDN-UAT - WHO SMART Trust v1.7.4

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-IDN-UAT**

## Organization: GDHCNParticipant-IDN-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Indonesia (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Indonesia Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:IDN resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/IDN/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:IDN](Endpoint-GDHCNParticipantDID-IDN-UAT-All.md)
* [Indonesia Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:IDN:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/IDN/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:IDN:DSC](Endpoint-GDHCNParticipantDID-IDN-UAT-DSC.md)
* [Indonesia Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:IDN:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/IDN/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:IDN:SCA](Endpoint-GDHCNParticipantDID-IDN-UAT-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-IDN-UAT",
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
    "reference" : "Endpoint/GDHCNParticipantDID-IDN-UAT-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-IDN-UAT-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-IDN-UAT-SCA"
  }]
}

```
