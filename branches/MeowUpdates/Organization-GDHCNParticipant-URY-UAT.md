# GDHCNParticipant-URY-UAT - WHO SMART Trust v1.6.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-URY-UAT**

## Organization: GDHCNParticipant-URY-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Uruguay

**endpoint**: 

* [Endpoint Uruguay Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:URY resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/URY/did.json](Endpoint-GDHCNParticipantDID-URY-UAT-All.md)
* [Endpoint Uruguay Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:URY:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/URY/DSC/did.json](Endpoint-GDHCNParticipantDID-URY-UAT-DSC.md)
* [Endpoint Uruguay Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:URY:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/URY/SCA/did.json](Endpoint-GDHCNParticipantDID-URY-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-URY-UAT",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Uruguay",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-URY-UAT-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-URY-UAT-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-URY-UAT-SCA"
  }]
}

```
