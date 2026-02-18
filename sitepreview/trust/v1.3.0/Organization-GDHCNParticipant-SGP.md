# GDHCNParticipant-SGP - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-SGP**

## Organization: GDHCNParticipant-SGP

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Singapore

**endpoint**: 

* [Endpoint Singapore Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SGP resolvable at https://tng-cdn.who.int/v2/trustlist/-/SGP/did.json](Endpoint-GDHCNParticipantDID-SGP-All.md)
* [Endpoint Singapore Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:SGP:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/SGP/DSC/did.json](Endpoint-GDHCNParticipantDID-SGP-DSC.md)
* [Endpoint Singapore Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:SGP:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/SGP/SCA/did.json](Endpoint-GDHCNParticipantDID-SGP-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-SGP",
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
      "reference" : "Endpoint/GDHCNParticipantDID-SGP-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SGP-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SGP-SCA"
    }
  ]
}

```
