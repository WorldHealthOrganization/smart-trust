# GDHCNParticipant-CHL-UAT - WHO SMART Trust v1.6.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-CHL-UAT**

## Organization: GDHCNParticipant-CHL-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Chile

**endpoint**: 

* [Endpoint Chile Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:CHL resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CHL/did.json](Endpoint-GDHCNParticipantDID-CHL-UAT-All.md)
* [Endpoint Chile Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:CHL:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CHL/DSC/did.json](Endpoint-GDHCNParticipantDID-CHL-UAT-DSC.md)
* [Endpoint Chile Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:CHL:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CHL/SCA/did.json](Endpoint-GDHCNParticipantDID-CHL-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-CHL-UAT",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Chile",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-CHL-UAT-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-CHL-UAT-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-CHL-UAT-SCA"
  }]
}

```
