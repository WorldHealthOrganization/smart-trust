# GDHCNParticipant-WHO-UAT - WHO SMART Trust v1.7.4

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-WHO-UAT**

## Organization: GDHCNParticipant-WHO-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

UAT Participant WHO (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [UAT Participant WHO Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:WHO resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/WHO/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:WHO](Endpoint-GDHCNParticipantDID-WHO-UAT-All.md)
* [UAT Participant WHO Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:WHO:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/WHO/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:WHO:DSC](Endpoint-GDHCNParticipantDID-WHO-UAT-DSC.md)
* [UAT Participant WHO Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:WHO:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/WHO/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:WHO:SCA](Endpoint-GDHCNParticipantDID-WHO-UAT-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-WHO-UAT",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "UAT Participant WHO",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-WHO-UAT-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-WHO-UAT-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-WHO-UAT-SCA"
  }]
}

```
