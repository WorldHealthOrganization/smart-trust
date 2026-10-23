# GDHCNParticipant-AND - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-AND**

## Organization: GDHCNParticipant-AND

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Andorra (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Andorra Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:AND resolvable at https://tng-cdn.who.int/v2/trustlist/-/AND/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:AND](Endpoint-GDHCNParticipantDID-AND-All.md)
* [Andorra Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:AND:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/AND/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:AND:DSC](Endpoint-GDHCNParticipantDID-AND-DSC.md)
* [Andorra Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:AND:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/AND/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:AND:SCA](Endpoint-GDHCNParticipantDID-AND-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-AND",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Andorra",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-AND-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-AND-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-AND-SCA"
  }]
}

```
