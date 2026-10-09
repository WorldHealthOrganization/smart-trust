# GDHCNParticipant-ARG-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-ARG-DEV**

## Organization: GDHCNParticipant-ARG-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Argentina

**endpoint**: 

* [Endpoint Argentina Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:ARG resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ARG/did.json](Endpoint-GDHCNParticipantDID-ARG-DEV-All.md)
* [Endpoint Argentina Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:ARG:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ARG/DSC/did.json](Endpoint-GDHCNParticipantDID-ARG-DEV-DSC.md)
* [Endpoint Argentina Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:ARG:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ARG/SCA/did.json](Endpoint-GDHCNParticipantDID-ARG-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-ARG-DEV",
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
  "name" : "Argentina",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-ARG-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-ARG-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-ARG-DEV-SCA"
    }
  ]
}

```
