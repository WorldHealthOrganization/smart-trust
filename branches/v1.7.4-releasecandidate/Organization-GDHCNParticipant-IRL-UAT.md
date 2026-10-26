# GDHCNParticipant-IRL-UAT - WHO SMART Trust v1.7.4

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-IRL-UAT**

## Organization: GDHCNParticipant-IRL-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Ireland (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Ireland Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:IRL resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/IRL/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:IRL](Endpoint-GDHCNParticipantDID-IRL-UAT-All.md)
* [Ireland Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:IRL:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/IRL/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:IRL:DSC](Endpoint-GDHCNParticipantDID-IRL-UAT-DSC.md)
* [Ireland Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:IRL:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/IRL/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:IRL:SCA](Endpoint-GDHCNParticipantDID-IRL-UAT-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-IRL-UAT",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Ireland",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-IRL-UAT-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-IRL-UAT-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-IRL-UAT-SCA"
  }]
}

```
