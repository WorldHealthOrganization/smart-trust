# GDHCNParticipant-FRA - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-FRA**

## Organization: GDHCNParticipant-FRA

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: France

**endpoint**: 

* [Endpoint France Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:FRA resolvable at https://tng-cdn.who.int/v2/trustlist/-/FRA/did.json](Endpoint-GDHCNParticipantDID-FRA-All.md)
* [Endpoint France Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:FRA:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/FRA/DSC/did.json](Endpoint-GDHCNParticipantDID-FRA-DSC.md)
* [Endpoint France Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:FRA:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/FRA/SCA/did.json](Endpoint-GDHCNParticipantDID-FRA-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-FRA",
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
  "name" : "France",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-FRA-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-FRA-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-FRA-SCA"
    }
  ]
}

```
