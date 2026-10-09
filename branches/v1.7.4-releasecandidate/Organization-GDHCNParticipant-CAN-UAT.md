# GDHCNParticipant-CAN-UAT - WHO SMART Trust v1.7.4

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-CAN-UAT**

## Organization: GDHCNParticipant-CAN-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Canada (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Canada Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:CAN resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CAN/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:CAN](Endpoint-GDHCNParticipantDID-CAN-UAT-All.md)
* [Canada Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:CAN:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CAN/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:CAN:DSC](Endpoint-GDHCNParticipantDID-CAN-UAT-DSC.md)
* [Canada Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:CAN:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CAN/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:CAN:SCA](Endpoint-GDHCNParticipantDID-CAN-UAT-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-CAN-UAT",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Canada",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-CAN-UAT-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-CAN-UAT-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-CAN-UAT-SCA"
  }]
}

```
