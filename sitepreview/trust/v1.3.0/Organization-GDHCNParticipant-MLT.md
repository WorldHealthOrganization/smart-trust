# GDHCNParticipant-MLT - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* **GDHCNParticipant-MLT**

## Organization: GDHCNParticipant-MLT

Profile: [mCSD Organization](https://profiles.ihe.net/ITI/mCSD/4.0.0/StructureDefinition-IHE.mCSD.Organization.html)

**type**: Government

**name**: Malta

**endpoint**: 

* [Endpoint Malta Trustlist (DID v2) - All keys did:web:tng-cdn.who.int:v2:trustlist:-:MLT resolvable at https://tng-cdn.who.int/v2/trustlist/-/MLT/did.json](Endpoint-GDHCNParticipantDID-MLT-All.md)
* [Endpoint Malta Trustlist (DID v2) - Document Signing Certificates did:web:tng-cdn.who.int:v2:trustlist:-:MLT:DSC resolvable at https://tng-cdn.who.int/v2/trustlist/-/MLT/DSC/did.json](Endpoint-GDHCNParticipantDID-MLT-DSC.md)
* [Endpoint Malta Trustlist (DID v2) - Certificate Signing Authority did:web:tng-cdn.who.int:v2:trustlist:-:MLT:SCA resolvable at https://tng-cdn.who.int/v2/trustlist/-/MLT/SCA/did.json](Endpoint-GDHCNParticipantDID-MLT-SCA.md)



## Resource Content

```json
{
  "resourceType" : "Organization",
  "id" : "GDHCNParticipant-MLT",
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
  "name" : "Malta",
  "endpoint" : [
    {
      "reference" : "Endpoint/GDHCNParticipantDID-MLT-All"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-MLT-DSC"
    },
    {
      "reference" : "Endpoint/GDHCNParticipantDID-MLT-SCA"
    }
  ]
}

```
