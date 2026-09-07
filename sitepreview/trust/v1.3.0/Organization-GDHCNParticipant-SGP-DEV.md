# GDHCNParticipant-SGP-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-SGP-DEV**

## Organization: GDHCNParticipant-SGP-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Singapore

**endpoint**: 

* [Endpoint Singapore Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SGP resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SGP/did.json](Endpoint-GDHCNParticipantDID-SGP-DEV-All.md)
* [Endpoint Singapore Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:SGP:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SGP/DSC/did.json](Endpoint-GDHCNParticipantDID-SGP-DEV-DSC.md)
* [Endpoint Singapore Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:SGP:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SGP/SCA/did.json](Endpoint-GDHCNParticipantDID-SGP-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-SGP-DEV",
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
  "name" : "Singapore",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SGP-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SGP-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SGP-DEV-SCA"
    }
  ]
}

```
