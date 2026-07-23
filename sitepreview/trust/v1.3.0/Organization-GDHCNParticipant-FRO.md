# GDHCNParticipant-FRO - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-FRO**

## Organization: GDHCNParticipant-FRO

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Faroe Islands

**endpoint**: 

* [Endpoint Faroe Islands Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:FRO resolvable at https://tng-cdn.who.int/v2/trustlist/-/FRO/did.json](Endpoint-GDHCNParticipantDID-FRO-All.md)
* [Endpoint Faroe Islands Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:FRO:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/FRO/DSC/did.json](Endpoint-GDHCNParticipantDID-FRO-DSC.md)
* [Endpoint Faroe Islands Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:FRO:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/FRO/SCA/did.json](Endpoint-GDHCNParticipantDID-FRO-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-FRO",
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
  "name" : "Faroe Islands",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-FRO-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-FRO-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-FRO-SCA"
    }
  ]
}

```
