# GDHCNParticipant-ECU-UAT - WHO SMART Trust v1.6.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-ECU-UAT**

## Organization: GDHCNParticipant-ECU-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Ecuador

**endpoint**: 

* [Endpoint Ecuador Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ECU resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/ECU/did.json](Endpoint-GDHCNParticipantDID-ECU-UAT-All.md)
* [Endpoint Ecuador Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:ECU:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/ECU/DSC/did.json](Endpoint-GDHCNParticipantDID-ECU-UAT-DSC.md)
* [Endpoint Ecuador Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:ECU:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/ECU/SCA/did.json](Endpoint-GDHCNParticipantDID-ECU-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-ECU-UAT",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Ecuador",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-ECU-UAT-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-ECU-UAT-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-ECU-UAT-SCA"
  }]
}

```
