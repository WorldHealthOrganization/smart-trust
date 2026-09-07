# GDHCNParticipant-GTM-UAT - WHO SMART Trust v1.6.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-GTM-UAT**

## Organization: GDHCNParticipant-GTM-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Guatemala

**endpoint**: 

* [Endpoint Guatemala Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:GTM resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/GTM/did.json](Endpoint-GDHCNParticipantDID-GTM-UAT-All.md)
* [Endpoint Guatemala Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:GTM:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/GTM/DSC/did.json](Endpoint-GDHCNParticipantDID-GTM-UAT-DSC.md)
* [Endpoint Guatemala Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:GTM:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/GTM/SCA/did.json](Endpoint-GDHCNParticipantDID-GTM-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-GTM-UAT",
  "meta" : {
    "profile" : ["https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"]
  },
  "type" : [{
    "coding" : [{
      "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
      "code" : "govt"
    }]
  }],
  "name" : "Guatemala",
  "endpoint" : [{
    "reference" : "Endpoint/GDHCNParticipantDID-GTM-UAT-All"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-GTM-UAT-DSC"
  },
  {
    "reference" : "Endpoint/GDHCNParticipantDID-GTM-UAT-SCA"
  }]
}

```
