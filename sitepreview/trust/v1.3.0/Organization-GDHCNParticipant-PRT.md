# GDHCNParticipant-PRT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-PRT**

## Organization: GDHCNParticipant-PRT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Portugal

**endpoint**: 

* [Endpoint Portugal Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:PRT resolvable at https://tng-cdn.who.int/v2/trustlist/-/PRT/did.json](Endpoint-GDHCNParticipantDID-PRT-All.md)
* [Endpoint Portugal Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:PRT:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/PRT/DSC/did.json](Endpoint-GDHCNParticipantDID-PRT-DSC.md)
* [Endpoint Portugal Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:PRT:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/PRT/SCA/did.json](Endpoint-GDHCNParticipantDID-PRT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-PRT",
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
  "name" : "Portugal",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-PRT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-PRT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-PRT-SCA"
    }
  ]
}

```
