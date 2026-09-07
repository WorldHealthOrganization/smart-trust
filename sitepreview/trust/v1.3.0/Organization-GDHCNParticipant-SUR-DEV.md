# GDHCNParticipant-SUR-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-SUR-DEV**

## Organization: GDHCNParticipant-SUR-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Suriname

**endpoint**: 

* [Endpoint Suriname Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SUR resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SUR/did.json](Endpoint-GDHCNParticipantDID-SUR-DEV-All.md)
* [Endpoint Suriname Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:SUR:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SUR/DSC/did.json](Endpoint-GDHCNParticipantDID-SUR-DEV-DSC.md)
* [Endpoint Suriname Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:SUR:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SUR/SCA/did.json](Endpoint-GDHCNParticipantDID-SUR-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-SUR-DEV",
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
  "name" : "Suriname",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SUR-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SUR-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SUR-DEV-SCA"
    }
  ]
}

```
