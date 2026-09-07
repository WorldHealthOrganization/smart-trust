# GDHCNParticipant-XXW-DEV - WHO SMART Trust v1.6.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-XXW-DEV**

## Organization: GDHCNParticipant-XXW-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Test Locality

**endpoint**: 

* [Endpoint Test Locality Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:XXW resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXW/did.json](Endpoint-GDHCNParticipantDID-XXW-DEV-All.md)
* [Endpoint Test Locality Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:XXW:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXW/DSC/did.json](Endpoint-GDHCNParticipantDID-XXW-DEV-DSC.md)
* [Endpoint Test Locality Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:XXW:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXW/SCA/did.json](Endpoint-GDHCNParticipantDID-XXW-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-XXW-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Test Locality",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-XXW-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXW-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-XXW-DEV-SCA"
  }]
}

```
