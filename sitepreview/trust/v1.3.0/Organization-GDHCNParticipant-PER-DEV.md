# GDHCNParticipant-PER-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-PER-DEV**

## Organization: GDHCNParticipant-PER-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Peru

**endpoint**: 

* [Endpoint Peru Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:PER resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/PER/did.json](Endpoint-GDHCNParticipantDID-PER-DEV-All.md)
* [Endpoint Peru Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:PER:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/PER/DSC/did.json](Endpoint-GDHCNParticipantDID-PER-DEV-DSC.md)
* [Endpoint Peru Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:PER:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/PER/SCA/did.json](Endpoint-GDHCNParticipantDID-PER-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-PER-DEV",
  "meta" : {
    "profile" : [
      "https://profiles.ihe.net/ITI/mCSD/StructureDefinition/IHE.mCSD.Organization"
    ]
  },
  "type" : [
    {
      "coding" : [
        {
          "system" : "http://terminology.hl7.org/CodeSystem/organization-type",
          "code" : "govt"
        }
      ]
    }
  ],
  "name" : "Peru",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-PER-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-PER-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-PER-DEV-SCA"
    }
  ]
}

```
