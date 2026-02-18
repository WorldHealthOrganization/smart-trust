# GDHCNParticipant-SLV-DEV - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-SLV-DEV**

## Organization: GDHCNParticipant-SLV-DEV

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: El Salvador

**endpoint**: 

* [Endpoint El Salvador Trustlist (DID v2) - DEV - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SLV resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SLV/did.json](Endpoint-GDHCNParticipantDID-SLV-DEV-All.md)
* [Endpoint El Salvador Trustlist (DID v2) - DEV - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:SLV:DSC resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SLV/DSC/did.json](Endpoint-GDHCNParticipantDID-SLV-DEV-DSC.md)
* [Endpoint El Salvador Trustlist (DID v2) - DEV - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:SLV:SCA resolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SLV/SCA/did.json](Endpoint-GDHCNParticipantDID-SLV-DEV-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-SLV-DEV",
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
  "name" : "El Salvador",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SLV-DEV-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SLV-DEV-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SLV-DEV-SCA"
    }
  ]
}

```
