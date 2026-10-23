# GDHCNParticipant-BEN - WHO SMART Trust v1.7.4

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-BEN**

## Organization: GDHCNParticipant-BEN

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Benin (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Benin Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:BEN resolvable at https://tng-cdn.who.int/v2/trustlist/-/BEN/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:BEN](Endpoint-GDHCNParticipantDID-BEN-All.md)
* [Benin Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:BEN:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/BEN/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:BEN:DSC](Endpoint-GDHCNParticipantDID-BEN-DSC.md)
* [Benin Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:BEN:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/BEN/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:BEN:SCA](Endpoint-GDHCNParticipantDID-BEN-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-BEN",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Benin",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-BEN-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-BEN-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-BEN-SCA"
  }]
}

```
