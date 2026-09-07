# GDHCNParticipant-NIC-DEV - WHO SMART Trust v1.6.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-NIC-DEV**

## Organization: GDHCNParticipant-NIC-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Nicaragua

**endpoint**: 

* [Endpoint Nicaragua Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:NIC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/NIC/did.json](Endpoint-GDHCNParticipantDID-NIC-DEV-All.md)
* [Endpoint Nicaragua Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:NIC:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/NIC/DSC/did.json](Endpoint-GDHCNParticipantDID-NIC-DEV-DSC.md)
* [Endpoint Nicaragua Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:NIC:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/NIC/SCA/did.json](Endpoint-GDHCNParticipantDID-NIC-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-NIC-DEV",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Nicaragua",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-NIC-DEV-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-NIC-DEV-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-NIC-DEV-SCA"
  }]
}

```
