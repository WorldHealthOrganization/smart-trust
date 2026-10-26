# GDHCNParticipant-XYK-UAT - WHO SMART Trust v1.7.4

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XYK-UAT**

## Organization: GDHCNParticipant-XYK-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

India (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [India Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XYK resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XYK/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XYK](Endpoint-GDHCNParticipantDID-XYK-UAT-All.md)
* [India Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XYK:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XYK/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XYK:DSC](Endpoint-GDHCNParticipantDID-XYK-UAT-DSC.md)
* [India Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XYK:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XYK/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XYK:SCA](Endpoint-GDHCNParticipantDID-XYK-UAT-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XYK-UAT",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "India",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-XYK-UAT-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XYK-UAT-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XYK-UAT-SCA"
  }]
}

```
