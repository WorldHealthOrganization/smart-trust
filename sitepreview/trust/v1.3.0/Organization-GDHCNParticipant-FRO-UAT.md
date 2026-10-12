# GDHCNParticipant-FRO-UAT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-FRO-UAT**

## Organization: GDHCNParticipant-FRO-UAT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Faroe Islands

**endpoint**: 

* [Endpoint Faroe Islands Trustlist (DID v2) - UAT - All keys did:web:tng-cdn.who.int:v2:trustlist:-:FRO resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/FRO/did.json](Endpoint-GDHCNParticipantDID-FRO-UAT-All.md)
* [Endpoint Faroe Islands Trustlist (DID v2) - UAT - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:FRO:DSC resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/FRO/DSC/did.json](Endpoint-GDHCNParticipantDID-FRO-UAT-DSC.md)
* [Endpoint Faroe Islands Trustlist (DID v2) - UAT - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:FRO:SCA resolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/FRO/SCA/did.json](Endpoint-GDHCNParticipantDID-FRO-UAT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-FRO-UAT",
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
      "reference" : "Endpoint/GDHCNParticipantDID-FRO-UAT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-FRO-UAT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-FRO-UAT-SCA"
    }
  ]
}

```
