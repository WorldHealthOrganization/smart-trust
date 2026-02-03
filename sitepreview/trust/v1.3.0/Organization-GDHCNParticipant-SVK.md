# GDHCNParticipant-SVK - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-SVK**

## Organization: GDHCNParticipant-SVK

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Slovakia

**endpoint**: 

* [Endpoint Slovakia Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:SVK resolvable at https://tng-cdn.who.int/v2/trustlist/-/SVK/did.json](Endpoint-GDHCNParticipantDID-SVK-All.md)
* [Endpoint Slovakia Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:SVK:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/SVK/DSC/did.json](Endpoint-GDHCNParticipantDID-SVK-DSC.md)
* [Endpoint Slovakia Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:SVK:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/SVK/SCA/did.json](Endpoint-GDHCNParticipantDID-SVK-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-SVK",
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
  "name" : "Slovakia",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SVK-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SVK-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-SVK-SCA"
    }
  ]
}

```
