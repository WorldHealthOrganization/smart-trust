# GDHCNParticipant-ARM - WHO SMART Trust v1.7.5

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-ARM**

## Organization: GDHCNParticipant-ARM

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

Armenia (Government)

-------

| | |
| :--- | :--- |
| Type: | Government |
| Endpoint: | * [Armenia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ARM resolvable at https://tng-cdn.who.int/v2/trustlist/-/ARM/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:ARM](Endpoint-GDHCNParticipantDID-ARM-All.md)
* [Armenia Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:ARM:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/ARM/DSC/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:ARM:DSC](Endpoint-GDHCNParticipantDID-ARM-DSC.md)
* [Armenia Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:ARM:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/ARM/SCA/did.json (): did:web:tng-cdn.who.int:v2:trustlist:-:ARM:SCA](Endpoint-GDHCNParticipantDID-ARM-SCA.md)
 |



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-ARM",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Armenia",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-ARM-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-ARM-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-ARM-SCA"
  }]
}

```
