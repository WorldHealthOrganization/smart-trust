# GDHCNParticipant-XXD-UAT - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXD-UAT**

## Organization: GDHCNParticipant-XXD-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

UAT Participant XXD (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [UAT Participant XXD Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXD resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXD/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XXD](Endpoint-GDHCNParticipantDID-XXD-UAT-All.md)
* [UAT Participant XXD Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXD:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXD/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XXD:DSC](Endpoint-GDHCNParticipantDID-XXD-UAT-DSC.md)
* [UAT Participant XXD Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXD:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXD/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:XXD:SCA](Endpoint-GDHCNParticipantDID-XXD-UAT-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXD-UAT",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "UAT Participant XXD",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-XXD-UAT-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXD-UAT-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXD-UAT-SCA"
  }]
}

```
