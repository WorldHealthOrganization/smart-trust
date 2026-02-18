# GDHCNParticipant-COL-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-COL-DEV**

## Organization: GDHCNParticipant-COL-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Colombia

**endpoint**: 

* [Endpoint Colombia Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:COL resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/COL/did.json](Endpoint-GDHCNParticipantDID-COL-DEV-All.md)
* [Endpoint Colombia Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:COL:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/COL/DSC/did.json](Endpoint-GDHCNParticipantDID-COL-DEV-DSC.md)
* [Endpoint Colombia Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:COL:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/COL/SCA/did.json](Endpoint-GDHCNParticipantDID-COL-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-COL-DEV",
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
  "name" : "Colombia",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-COL-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-COL-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-COL-DEV-SCA"
    }
  ]
}

```
