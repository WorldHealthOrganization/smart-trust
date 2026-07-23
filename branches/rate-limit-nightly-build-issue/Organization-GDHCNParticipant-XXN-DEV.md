# GDHCNParticipant-XXN-DEV - WHO SMART Trust v1.6.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXN-DEV**

## Organization: GDHCNParticipant-XXN-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: DEV Participant XXN

**endpoint**: 

* [Endpoint DEV Participant XXN Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXN resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXN/did.json](Endpoint-GDHCNParticipantDID-XXN-DEV-All.md)
* [Endpoint DEV Participant XXN Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXN:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXN/DSC/did.json](Endpoint-GDHCNParticipantDID-XXN-DEV-DSC.md)
* [Endpoint DEV Participant XXN Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXN:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXN/SCA/did.json](Endpoint-GDHCNParticipantDID-XXN-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXN-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "DEV Participant XXN",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-XXN-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXN-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXN-DEV-SCA"
  }]
}

```
